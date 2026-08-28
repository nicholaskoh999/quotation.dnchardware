<?php
/**
 * ── Revision storage — the shape history will live in ───────────────────────
 *
 * Run:  php tests/php/revision_storage.test.php
 *
 * Unlike the other PHP suites this one needs a real MySQL, because what is
 * under test IS the database: a JSON column that validates, a UNIQUE that
 * refuses a duplicate revision number, a version column with no default, and a
 * conformance gate that has to notice a table which is present but WRONG. None
 * of that can be proven by reading SQL text.
 *
 *     DC_TEST_DB_HOST   default 127.0.0.1
 *     DC_TEST_DB_PORT   default 3306
 *     DC_TEST_DB_USER   default root
 *     DC_TEST_DB_PASS   default ''
 *
 * Every scenario gets its own throwaway database, which is dropped afterwards.
 * The suite refuses to touch a schema it did not create.
 *
 * Each executable block is LIFTED OUT OF THE SHIPPED MIGRATION between its
 * markers and run — SECTION 2, SECTION 3 GENERATE, SECTION 4 GATE and
 * CONFORMANCE — the same principle save_retry.test.php and
 * item_identity.test.php use: the test measures the file that ships, so
 * editing the migration runs the edit.
 *
 * If MySQL is unreachable this EXITS NON-ZERO rather than reporting a pass. A
 * schema test that skipped is not a schema test that passed.
 */

$asserts = 0; $failures = [];
function ok($cond, $msg) {
    global $asserts, $failures;
    $asserts++;
    if (!$cond) $failures[] = $msg;
}
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true)
                                   . "\n      actual:   " . var_export($actual, true));
}

$ROOT = dirname(__DIR__, 2);
$MIG  = $ROOT . '/migrations/2026-08-28-create-quotation-revisions.sql';

// ══ 0 · the shipped migration, and what it must not contain ═════════════════
ok(is_file($MIG), '0: the migration exists');
$sql = file_get_contents($MIG);

$lift = function ($begin, $end) use ($sql) {
    $re = '/-- >>> ' . preg_quote($begin, '/') . '\s*(.*?)\s*-- <<< ' . preg_quote($end, '/') . '/s';
    return preg_match($re, $sql, $m) ? $m[1] : null;
};
$body      = $lift('SECTION 2 BEGIN',        'SECTION 2 END');
$conform   = $lift('CONFORMANCE BEGIN',      'CONFORMANCE END');
$generate  = $lift('SECTION 3 GENERATE BEGIN','SECTION 3 GENERATE END');
$gate      = $lift('SECTION 4 GATE BEGIN',   'SECTION 4 GATE END');

ok($body     !== null, '0: section 2 is delimited by markers');
ok($conform  !== null, '0: the conformance gate is delimited by markers');
ok($generate !== null, '0: the section 3 generator is delimited by markers');
ok($gate     !== null, '0: the section 4 collation gate is delimited by markers');
if ($body === null || $conform === null || $generate === null || $gate === null) {
    echo "  cannot continue\n"; exit(1);
}
$q1 = function ($t) { return rtrim(trim($t), ';'); };
$conform = $q1($conform); $generate = $q1($generate); $gate = $q1($gate);

/* Structural claims are measured on a COMMENT- and LITERAL-blanked copy, the
   same way save_retry.test.php counts a function name. This file argues at
   length about why there is no foreign key, and sections 3 and 4 BUILD SQL
   inside CONCATs — a check unable to tell a statement from a string would be
   forbidding the very technique the earlier accepted migrations established. */
$strip = function ($t) {
    $t = preg_replace('/--[^\n]*/', '', $t);
    return preg_replace("/'[^']*'/", "''", $t);
};
$sqlCode  = $strip($sql);
$bodyCode = $strip($body);

ok(stripos($bodyCode, 'CREATE TABLE IF NOT EXISTS quotation_revisions') !== false,
   '0: section 2 creates quotation_revisions, and only with IF NOT EXISTS');
ok(preg_match('/\bINSERT\s+INTO\b/i', $sqlCode) === 0, '0: the file contains no INSERT — it records no history');
ok(preg_match('/\b(DROP|TRUNCATE|RENAME)\s+TABLE\b/i', $sqlCode) === 0,
   '0: and no executable DROP, TRUNCATE or RENAME anywhere');
ok(preg_match('/\bCREATE\s+TRIGGER\b/i', $sqlCode) === 0,
   '0: no trigger — append-only is a contract enforced by the writer, not by DDL');
ok(preg_match('/\bFOREIGN\s+KEY\b/i', $bodyCode) === 0 && stripos($bodyCode, 'REFERENCES') === false,
   '0: and no foreign key, which is the documented decision');
foreach (['quotations', 'app_users', 'companies'] as $t) {
    ok(preg_match('/\b(ALTER|DROP)\s+TABLE\s+' . $t . '\b/i', $sqlCode) === 0,
       "0: it does not alter or drop {$t}");
}
/* The only ALTER this file can produce is the generated one, and it may only
   ever touch quotation_revisions.quotation_ref_no. */
ok(preg_match('/\bALTER\s+TABLE\b/i', $sqlCode) === 0,
   '0: there is no hand-written ALTER — section 3 generates the only one');

// ══ connect ════════════════════════════════════════════════════════════════
mysqli_report(MYSQLI_REPORT_OFF);
$H = getenv('DC_TEST_DB_HOST') ?: '127.0.0.1';
$P = (int)(getenv('DC_TEST_DB_PORT') ?: 3306);
$U = getenv('DC_TEST_DB_USER') ?: 'root';
$W = getenv('DC_TEST_DB_PASS');
if ($W === false) $W = '';

$db = @new mysqli($H, $U, $W, null, $P);
if (!$db || $db->connect_errno) {
    echo "\n  FAIL  revision storage — no MySQL at {$H}:{$P}\n\n";
    echo "   - This suite tests a schema, so it needs a server. Set\n";
    echo "     DC_TEST_DB_HOST / _PORT / _USER / _PASS and re-run.\n";
    echo "   - It is deliberately NOT skipped: a schema test that did not run\n";
    echo "     must not read as one that passed.\n\n";
    exit(1);
}
$server = $db->query('SELECT VERSION()')->fetch_row()[0];

/* Production ref_no, as the previous audits recorded it. The stand-in uses
   utf8mb4_general_ci deliberately: on MySQL 8 the database default is
   utf8mb4_0900_ai_ci, so section 3 has real work to do here. */
$REFCOLL = 'utf8mb4_general_ci';
$REFCS   = 'utf8mb4';

$dbn = 0;
$fresh = function () use ($db, &$dbn, $REFCS, $REFCOLL) {
    $name = 'dc_revstore_t' . getmypid() . '_' . (++$dbn);
    $r = $db->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$name}'");
    if ($r && $r->num_rows) { echo "\n  FAIL  {$name} already exists — refusing to reuse it.\n\n"; exit(1); }
    $db->query("CREATE DATABASE {$name}");
    $db->select_db($name);
    $db->query("CREATE TABLE quotations (
                  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                  ref_no VARCHAR(100) CHARACTER SET {$REFCS} COLLATE {$REFCOLL} NOT NULL,
                  items LONGTEXT NULL,
                  PRIMARY KEY (id), UNIQUE KEY uq_quotations_ref (ref_no)) ENGINE=InnoDB");
    $db->query("CREATE TABLE app_users (
                  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                  username VARCHAR(64) NOT NULL,
                  display_name VARCHAR(100) NOT NULL,
                  PRIMARY KEY (id), UNIQUE KEY uq_app_users_username (username)) ENGINE=InnoDB");
    return $name;
};
$drop = function ($name) use ($db) { $db->select_db('mysql'); $db->query("DROP DATABASE {$name}"); };
$one  = function ($q) use ($db) { $r = $db->query($q); return $r ? $r->fetch_row()[0] : ('ERROR: ' . $db->error); };
$fingerprint = function ($t) use ($db) {
    $r = $db->query("SHOW CREATE TABLE {$t}");
    if (!$r) return null;
    return preg_replace('/\s*AUTO_INCREMENT=\d+/', '', $r->fetch_row()[1]);
};
$tables = function ($name) use ($db) {
    $out = []; $r = $db->query("SELECT TABLE_NAME FROM information_schema.TABLES
                                WHERE TABLE_SCHEMA='{$name}' ORDER BY TABLE_NAME");
    while ($row = $r->fetch_row()) $out[] = $row[0];
    return $out;
};

/* THE COMPLETE PROCEDURE: section 2, then the statement section 3 generates.
   Anything that runs only section 2 has not finished the migration. */
$runComplete = function () use ($db, $body, $generate, $one) {
    if ($db->query($body) !== true) return 'section 2 failed: ' . $db->error;
    $alter = $one($generate);
    if (stripos($alter, 'ALTER TABLE quotation_revisions MODIFY quotation_ref_no') !== 0) {
        return 'section 3 did not generate an ALTER: ' . $alter;
    }
    if ($db->query(rtrim($alter, ';')) !== true) return 'the generated ALTER failed: ' . $db->error;
    return true;
};


// ══ 1 · a clean run of the complete procedure ═══════════════════════════════
$A = $fresh();
{
    eq($one($conform), 'ABSENT — section 2 will create it',
       '1: with no table there, the conformance gate says ABSENT');

    $beforeQuot = $fingerprint('quotations');
    $beforeUser = $fingerprint('app_users');

    eq($runComplete(), true, '1: the complete procedure — section 2 then the generated ALTER — runs');
    eq($tables($A), ['app_users', 'quotation_revisions', 'quotations'],
       '1: exactly ONE table was created, and it is quotation_revisions');
    eq((int)$one("SELECT COUNT(*) FROM quotation_revisions"), 0,
       '1: the table starts EMPTY — no history is invented');
    eq($fingerprint('quotations'), $beforeQuot, '1: quotations is unchanged, definition for definition');
    eq($fingerprint('app_users'), $beforeUser, '1: and so is app_users');
}


// ══ 2 · the columns, exactly ════════════════════════════════════════════════
{
    $cols = [];
    $r = $db->query("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA,
                            CHARACTER_SET_NAME, COLLATION_NAME
                     FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA='{$A}' AND TABLE_NAME='quotation_revisions'
                     ORDER BY ORDINAL_POSITION");
    while ($row = $r->fetch_assoc()) $cols[$row['COLUMN_NAME']] = $row;

    eq(array_keys($cols),
       ['id', 'quotation_id', 'revision_no', 'quotation_ref_no', 'event_type',
        'actor_user_id', 'actor_username', 'actor_display_name',
        'snapshot_schema_version', 'snapshot_json', 'created_at'],
       '2: eleven columns, in the documented order, and nothing else');

    $expect = [
        'id'                      => ['bigint unsigned',   'NO',  'auto_increment'],
        'quotation_id'            => ['int unsigned',      'NO',  ''],
        'revision_no'             => ['int unsigned',      'NO',  ''],
        'quotation_ref_no'        => ['varchar(100)',      'NO',  ''],
        'event_type'              => ['varchar(32)',       'NO',  ''],
        'actor_user_id'           => ['int unsigned',      'YES', ''],
        'actor_username'          => ['varchar(64)',       'YES', ''],
        'actor_display_name'      => ['varchar(100)',      'YES', ''],
        'snapshot_schema_version' => ['smallint unsigned', 'NO',  ''],
        'snapshot_json'           => ['json',              'NO',  ''],
        'created_at'              => ['datetime',          'NO',  'DEFAULT_GENERATED'],
    ];
    foreach ($expect as $name => [$type, $nullable, $extra]) {
        eq(strtolower($cols[$name]['COLUMN_TYPE']), $type, "2: {$name} is {$type}");
        eq($cols[$name]['IS_NULLABLE'], $nullable, "2: {$name} nullability");
        eq($cols[$name]['EXTRA'], $extra, "2: {$name} extra");
    }

    eq($cols['snapshot_schema_version']['COLUMN_DEFAULT'], null,
       '2: snapshot_schema_version has NO default — a writer must state the version it wrote');
    ok(stripos((string)$cols['created_at']['COLUMN_DEFAULT'], 'CURRENT_TIMESTAMP') !== false,
       '2: created_at defaults to CURRENT_TIMESTAMP');
    ok(strtolower($cols['created_at']['COLUMN_TYPE']) !== 'timestamp',
       '2: and is NOT a TIMESTAMP — this table outlives 2038 and must not shift with session time zone');
    ok($cols['actor_user_id']['IS_NULLABLE'] === 'YES'
       && $cols['actor_username']['IS_NULLABLE'] === 'YES'
       && $cols['actor_display_name']['IS_NULLABLE'] === 'YES',
       '2: all three actor columns are nullable — a system actor has no person behind it');

    // ── THE AUTHORITATIVE POST-MIGRATION STATE ──
    $q = $db->query("SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
                     FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA='{$A}' AND TABLE_NAME='quotations' AND COLUMN_NAME='ref_no'")
            ->fetch_assoc();
    eq($cols['quotation_ref_no']['COLUMN_TYPE'], $q['COLUMN_TYPE'],
       '2: quotation_ref_no has the same COLUMN_TYPE as quotations.ref_no');
    eq($cols['quotation_ref_no']['CHARACTER_SET_NAME'], $q['CHARACTER_SET_NAME'],
       '2: the same CHARACTER SET (' . $q['CHARACTER_SET_NAME'] . ')');
    eq($cols['quotation_ref_no']['COLLATION_NAME'], $q['COLLATION_NAME'],
       '2: and the same COLLATION (' . $q['COLLATION_NAME'] . ') — intentionally, not by accident');
    eq($q['COLLATION_NAME'], $REFCOLL, '2: which is the production collation this fixture models');

    /* And it is NOT simply the database default — proving section 3 did work
       rather than section 2 having got lucky. */
    $dbDefault = $one("SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA
                       WHERE SCHEMA_NAME='{$A}'");
    ok($dbDefault !== $q['COLLATION_NAME'],
       "2: the database default ({$dbDefault}) differs from it, so section 3 had real work to do");

    /* The join that would have failed. */
    $db->query("INSERT INTO quotations (ref_no) VALUES ('Q-2026-0001')");
    $r = $db->query("SELECT COUNT(*) FROM quotation_revisions r JOIN quotations q ON q.ref_no = r.quotation_ref_no");
    ok($r !== false, '2: and a ref_no join runs instead of raising "Illegal mix of collations": ' . $db->error);
}


// ══ 3 · the indexes, and the one that is deliberately absent ════════════════
{
    $idx = [];
    $r = $db->query("SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
                     FROM information_schema.STATISTICS
                     WHERE TABLE_SCHEMA='{$A}' AND TABLE_NAME='quotation_revisions'
                     ORDER BY INDEX_NAME, SEQ_IN_INDEX");
    while ($row = $r->fetch_assoc()) {
        $idx[$row['INDEX_NAME']]['unique'] = ($row['NON_UNIQUE'] === '0' || $row['NON_UNIQUE'] === 0);
        $idx[$row['INDEX_NAME']]['cols'][] = $row['COLUMN_NAME'];
    }
    $names = array_keys($idx); sort($names);
    eq($names,
       ['PRIMARY', 'idx_quotation_revisions_actor', 'idx_quotation_revisions_created',
        'idx_quotation_revisions_ref', 'uq_quotation_revisions_no'],
       '3: five indexes, and no others');
    eq($idx['PRIMARY']['cols'], ['id'], '3: the primary key is id');
    ok($idx['uq_quotation_revisions_no']['unique'], '3: uq_quotation_revisions_no is UNIQUE');
    eq($idx['uq_quotation_revisions_no']['cols'], ['quotation_id', 'revision_no'],
       '3: on (quotation_id, revision_no), in that order');
    eq($idx['idx_quotation_revisions_ref']['cols'], ['quotation_ref_no'], '3: ref_no is indexed');
    eq($idx['idx_quotation_revisions_actor']['cols'], ['actor_user_id'], '3: actor is indexed');
    eq($idx['idx_quotation_revisions_created']['cols'], ['created_at'], '3: created_at is indexed');

    $standalone = array_filter($idx, function ($v, $k) {
        return $k !== 'uq_quotation_revisions_no' && $v['cols'] === ['quotation_id'];
    }, ARRAY_FILTER_USE_BOTH);
    eq($standalone, [], '3: NO standalone index on quotation_id — the UNIQUE already covers that prefix');
}


// ══ 4 · what the schema refuses, and what it allows ═════════════════════════
{
    $db->query("INSERT INTO quotations (ref_no) VALUES ('Q-2026-0002')");
    $db->query("INSERT INTO app_users (username, display_name) VALUES ('nicholas','Nicholas Koh')");

    $ins = function ($qid, $rev, $ref, $ver, $json, $actor = 1) use ($db) {
        $sqlv = $ver === null ? 'NULL' : (string)$ver;
        $cols = 'quotation_id, revision_no, quotation_ref_no, event_type, actor_user_id, '
              . 'actor_username, actor_display_name, snapshot_schema_version, snapshot_json';
        return $db->query("INSERT INTO quotation_revisions ({$cols}) VALUES ("
            . (int)$qid . ", " . (int)$rev . ", '" . $db->real_escape_string($ref) . "', 'update', "
            . ($actor === null ? 'NULL' : (int)$actor) . ", 'nicholas', 'Nicholas Koh', "
            . $sqlv . ", '" . $db->real_escape_string($json) . "')");
    };

    ok($ins(1, 1, 'Q-2026-0001', 1, '{"ref_no":"Q-2026-0001","items":[{"item_uid":"itm_'
        . str_repeat('a', 32) . '","qty":4}]}') === true,
       '4: a valid revision inserts: ' . $db->error);

    ok($ins(1, 1, 'Q-2026-0001', 1, '{"x":1}') === false, '4a: a duplicate (quotation_id, revision_no) is refused');
    eq($db->errno, 1062, '4a: with MySQL 1062, duplicate key');

    ok($ins(2, 1, 'Q-2026-0002', 1, '{"x":1}') === true,
       '4b: two different quotations may both have a revision 1: ' . $db->error);
    ok($ins(1, 2, 'Q-2026-0001', 1, '{"x":2}') === true, '4c: quotation 1 gains a revision 2');

    ok($ins(1, 3, 'Q-2026-0001', 1, '{not json') === false, '4d: invalid JSON is refused');
    eq($db->errno, 3140, '4d: with MySQL 3140, invalid JSON text');
    ok($ins(1, 3, 'Q-2026-0001', 1, '') === false, '4d: and so is an empty string');

    ok($ins(1, 4, 'Q-2026-0001', null, '{"x":4}') === false,
       '4e: a NULL snapshot_schema_version is refused — the writer must say which format it wrote');
    eq($db->errno, 1048, '4e: with MySQL 1048, column cannot be null');
    ok($db->query("INSERT INTO quotation_revisions
                     (quotation_id, revision_no, quotation_ref_no, event_type, snapshot_json)
                   VALUES (1, 5, 'Q-2026-0001', 'update', '{\"x\":5}')") === false,
       '4e: and omitting the column entirely fails too — there is no default to fall back on');

    ok($ins(2, 2, 'Q-2026-0002', 1, '{"x":9}', null) === true,
       '4f: actor_user_id may be NULL — a migration or script is not a signed-in person');

    eq(trim((string)$one("SELECT JSON_EXTRACT(snapshot_json, '\$.items[0].item_uid')
                          FROM quotation_revisions WHERE quotation_id=1 AND revision_no=1"), '"'),
       'itm_' . str_repeat('a', 32),
       '4g: the snapshot is queryable as JSON — item identity is readable inside it');

    $db->query("DELETE FROM quotations WHERE id=2");
    eq((int)$one("SELECT COUNT(*) FROM quotation_revisions WHERE quotation_id=2"), 2,
       '4h: deleting the quotation left its revisions standing — no FK, no cascade');
    eq($one("SELECT quotation_ref_no FROM quotation_revisions WHERE quotation_id=2 LIMIT 1"), 'Q-2026-0002',
       '4h: and the revision still names the quotation whose row is gone');
}


// ══ 5 · idempotence — including rows that are already there ═════════════════
{
    eq($one($conform), 'CONFORMS — the expected table is already there; re-running is safe',
       '5: the conformance gate now reads CONFORMS');
    eq($one($gate), 'MATCH — quotation_ref_no is varchar(100) ' . $REFCS . ' / ' . $REFCOLL
                  . ', the same as quotations.ref_no. Migration complete.',
       '5: and the collation gate reads MATCH, naming the exact final state');

    $rowsBefore = (int)$one("SELECT COUNT(*) FROM quotation_revisions");
    $dataBefore = [];
    $r = $db->query("SELECT id, quotation_id, revision_no, snapshot_json FROM quotation_revisions ORDER BY id");
    while ($row = $r->fetch_assoc()) $dataBefore[] = $row;
    $defBefore  = $fingerprint('quotation_revisions');
    $quotBefore = $fingerprint('quotations');
    $userBefore = $fingerprint('app_users');
    ok($rowsBefore > 0, '5: there are rows in the table before the re-run — the point of the check');

    eq($runComplete(), true, '5: the COMPLETE procedure runs a SECOND time without error');

    eq((int)$one("SELECT COUNT(*) FROM quotation_revisions"), $rowsBefore, '5: the row count is unchanged');
    $dataAfter = [];
    $r = $db->query("SELECT id, quotation_id, revision_no, snapshot_json FROM quotation_revisions ORDER BY id");
    while ($row = $r->fetch_assoc()) $dataAfter[] = $row;
    eq($dataAfter, $dataBefore, '5: and every existing row is byte-identical — a re-run modifies no history');
    eq($fingerprint('quotation_revisions'), $defBefore, '5: the table definition is identical after the re-run');
    eq($fingerprint('quotations'), $quotBefore, '5: quotations still unchanged');
    eq($fingerprint('app_users'), $userBefore, '5: app_users still unchanged');
    eq($tables($A), ['app_users', 'quotation_revisions', 'quotations'], '5: still exactly three tables');
    eq($one($conform), 'CONFORMS — the expected table is already there; re-running is safe',
       '5: and it still CONFORMS');
}
$drop($A);


// ══ 6 · THE WRONG-SCHEMA GATE ══════════════════════════════════════════════
/* CREATE TABLE IF NOT EXISTS is not a check. Against a quotation_revisions
   that is present but WRONG it succeeds, changes nothing, and leaves the
   operator believing the migration worked. Each case below builds a wrong
   table, proves section 2 alone would have called it fine, and proves the
   shipped conformance gate refuses it. */
{
    $wrongCases = [
        ['a column is missing',
         "CREATE TABLE quotation_revisions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            quotation_id INT UNSIGNED NOT NULL,
            revision_no INT UNSIGNED NOT NULL,
            quotation_ref_no VARCHAR(100) NOT NULL,
            event_type VARCHAR(32) NOT NULL,
            actor_user_id INT UNSIGNED NULL,
            actor_username VARCHAR(64) NULL,
            actor_display_name VARCHAR(100) NULL,
            snapshot_json JSON NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_quotation_revisions_no (quotation_id, revision_no),
            KEY idx_quotation_revisions_ref (quotation_ref_no),
            KEY idx_quotation_revisions_actor (actor_user_id),
            KEY idx_quotation_revisions_created (created_at)) ENGINE=InnoDB"],

        ['snapshot_json is TEXT instead of JSON',
         "CREATE TABLE quotation_revisions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            quotation_id INT UNSIGNED NOT NULL,
            revision_no INT UNSIGNED NOT NULL,
            quotation_ref_no VARCHAR(100) NOT NULL,
            event_type VARCHAR(32) NOT NULL,
            actor_user_id INT UNSIGNED NULL,
            actor_username VARCHAR(64) NULL,
            actor_display_name VARCHAR(100) NULL,
            snapshot_schema_version SMALLINT UNSIGNED NOT NULL,
            snapshot_json LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_quotation_revisions_no (quotation_id, revision_no),
            KEY idx_quotation_revisions_ref (quotation_ref_no),
            KEY idx_quotation_revisions_actor (actor_user_id),
            KEY idx_quotation_revisions_created (created_at)) ENGINE=InnoDB"],

        ['the UNIQUE is only an ordinary index',
         "CREATE TABLE quotation_revisions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            quotation_id INT UNSIGNED NOT NULL,
            revision_no INT UNSIGNED NOT NULL,
            quotation_ref_no VARCHAR(100) NOT NULL,
            event_type VARCHAR(32) NOT NULL,
            actor_user_id INT UNSIGNED NULL,
            actor_username VARCHAR(64) NULL,
            actor_display_name VARCHAR(100) NULL,
            snapshot_schema_version SMALLINT UNSIGNED NOT NULL,
            snapshot_json JSON NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY uq_quotation_revisions_no (quotation_id, revision_no),
            KEY idx_quotation_revisions_ref (quotation_ref_no),
            KEY idx_quotation_revisions_actor (actor_user_id),
            KEY idx_quotation_revisions_created (created_at)) ENGINE=InnoDB"],

        ['snapshot_schema_version has a default it must not have',
         "CREATE TABLE quotation_revisions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            quotation_id INT UNSIGNED NOT NULL,
            revision_no INT UNSIGNED NOT NULL,
            quotation_ref_no VARCHAR(100) NOT NULL,
            event_type VARCHAR(32) NOT NULL,
            actor_user_id INT UNSIGNED NULL,
            actor_username VARCHAR(64) NULL,
            actor_display_name VARCHAR(100) NULL,
            snapshot_schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
            snapshot_json JSON NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_quotation_revisions_no (quotation_id, revision_no),
            KEY idx_quotation_revisions_ref (quotation_ref_no),
            KEY idx_quotation_revisions_actor (actor_user_id),
            KEY idx_quotation_revisions_created (created_at)) ENGINE=InnoDB"],

        ['an unexpected extra column is present',
         "CREATE TABLE quotation_revisions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            quotation_id INT UNSIGNED NOT NULL,
            revision_no INT UNSIGNED NOT NULL,
            quotation_ref_no VARCHAR(100) NOT NULL,
            event_type VARCHAR(32) NOT NULL,
            actor_user_id INT UNSIGNED NULL,
            actor_username VARCHAR(64) NULL,
            actor_display_name VARCHAR(100) NULL,
            snapshot_schema_version SMALLINT UNSIGNED NOT NULL,
            snapshot_json JSON NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            leftover_column VARCHAR(10) NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_quotation_revisions_no (quotation_id, revision_no),
            KEY idx_quotation_revisions_ref (quotation_ref_no),
            KEY idx_quotation_revisions_actor (actor_user_id),
            KEY idx_quotation_revisions_created (created_at)) ENGINE=InnoDB"],
    ];

    foreach ($wrongCases as [$label, $ddl]) {
        $W = $fresh();
        ok($db->query($ddl) === true, "6: fixture built — {$label}: " . $db->error);

        /* This is the danger being demonstrated: section 2 on its own is happy. */
        eq($db->query($body), true, "6: section 2 alone SUCCEEDS over it — {$label}");
        eq($db->affected_rows, 0, "6: having changed nothing — {$label}");

        $verdict = $one($conform);
        ok(strpos($verdict, 'NO-GO') === 0,
           "6: and the conformance gate REFUSES it — {$label}\n      verdict: {$verdict}");
        ok(strpos($verdict, 'Do NOT run section 2') !== false,
           "6: telling the operator to stop — {$label}");
        ok(strpos($verdict, 'CONFORMS') === false,
           "6: it is never reported as conforming — {$label}");
        $drop($W);
    }

    /* And the gate is not simply always negative: the right table passes it. */
    $G = $fresh();
    eq($runComplete(), true, '6: a correctly migrated database');
    eq($one($conform), 'CONFORMS — the expected table is already there; re-running is safe',
       '6: reads CONFORMS, so the gate discriminates rather than always refusing');
    $drop($G);
}


// ══ 7 · no writer exists anywhere in the application ════════════════════════
{
    foreach (['api.php', 'index.php', 'companies.php', 'pricing_history.php',
              'ai_extract.php', 'auth.php', 'login.php', 'logout.php'] as $f) {
        $t = file_get_contents($ROOT . '/' . $f);
        ok(stripos($t, 'quotation_revisions') === false,
           "7: {$f} does not mention quotation_revisions — no writer, no reader, no hook");
    }
    $phpCode = function ($file) {
        $out = '';
        foreach (token_get_all(file_get_contents($file)) as $t) {
            if (is_array($t)) {
                if ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT) continue;
                $out .= $t[1];
            } else { $out .= $t; }
        }
        return $out;
    };
    ok(stripos($phpCode($ROOT . '/api.php'), 'revision') === false,
       '7: api.php contains no revision CODE — the only mention is a comment saying there is none');
    ok(stripos(file_get_contents($ROOT . '/api.php'), 'no revision storage') !== false,
       '7: and that comment still says so');
}

$db->close();

// ── report ───────────────────────────────────────────────────────────────────
$name = 'revision storage — the shape history will live in';
if ($failures) {
    echo "\n  FAIL  {$name}  ({$asserts} assertions, " . count($failures) . " failed)  [MySQL {$server}]\n\n";
    foreach ($failures as $f) echo "   - {$f}\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    {$name}  ({$asserts} assertions)  [MySQL {$server}]\n\n";
