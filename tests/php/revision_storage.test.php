<?php
/**
 * ── Revision storage — the shape history will live in ───────────────────────
 *
 * Run:  php tests/php/revision_storage.test.php
 *
 * Unlike the other PHP suites this one needs a real MySQL, because what is
 * under test IS the database: a JSON column that validates, a UNIQUE that
 * refuses a duplicate revision number, a version column with no default. None
 * of that can be proven by reading SQL text.
 *
 *     DC_TEST_DB_HOST   default 127.0.0.1
 *     DC_TEST_DB_PORT   default 3306
 *     DC_TEST_DB_USER   default root
 *     DC_TEST_DB_PASS   default ''
 *
 * It creates its own throwaway database, does everything inside it, and drops
 * it again. It never touches an existing schema, and it refuses to run if the
 * database it wants already exists.
 *
 * The CREATE TABLE is LIFTED OUT OF THE SHIPPED MIGRATION between its
 * `-- >>> SECTION 2 BEGIN` / `-- <<< SECTION 2 END` markers and executed, the
 * same principle save_retry.test.php and item_identity.test.php use: the test
 * measures the file that ships, so editing the migration runs the edit.
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

$body = null;
if (preg_match('/-- >>> SECTION 2 BEGIN\s*(.*?)\s*-- <<< SECTION 2 END/s', $sql, $m)) $body = $m[1];
ok($body !== null, '0: section 2 is delimited by the markers the test lifts it from');
if ($body === null) { echo "  cannot continue\n"; exit(1); }

/* Structural claims are measured on a COMMENT-BLANKED copy, the same way
   save_retry.test.php counts a function name. This file argues at length about
   why there is no foreign key, and a check that reads "not a foreign key" as a
   foreign key would be measuring the commentary instead of the program. */
$strip = function ($t) {
    $t = preg_replace('/--[^\n]*/', '', $t);        // line comments
    /* Quoted literals go too. Section 3a GENERATES an ALTER inside a CONCAT so
       nobody hand-types a charset — that string is OUTPUT, not a statement, and
       a check unable to tell the two apart would forbid the very technique the
       earlier accepted migrations established. No literal in this file contains
       an escaped quote, so the simple pattern is the honest one. */
    return preg_replace("/'[^']*'/", "''", $t);
};
$sqlCode  = $strip($sql);
$bodyCode = $strip($body);

ok(stripos($bodyCode, 'CREATE TABLE IF NOT EXISTS quotation_revisions') !== false,
   '0: section 2 creates quotation_revisions, and only with IF NOT EXISTS');
ok(preg_match('/\bINSERT\s+INTO\b/i', $sqlCode) === 0, '0: the file contains no INSERT — it records no history');
ok(preg_match('/\b(ALTER|DROP|TRUNCATE|RENAME)\s+TABLE\b/i', $sqlCode) === 0,
   '0: and no executable ALTER, DROP, TRUNCATE or RENAME anywhere');
ok(preg_match('/\bCREATE\s+TRIGGER\b/i', $sqlCode) === 0,
   '0: no trigger — append-only is a contract enforced by the writer, not by DDL');
ok(preg_match('/\bFOREIGN\s+KEY\b/i', $bodyCode) === 0 && stripos($bodyCode, 'REFERENCES') === false,
   '0: and no foreign key, which is the documented decision');
foreach (['quotations', 'app_users', 'companies'] as $t) {
    ok(preg_match('/\b(ALTER|DROP)\s+TABLE\s+' . $t . '\b/i', $sqlCode) === 0,
       "0: it does not alter or drop {$t}");
}

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

$DBN = 'dc_revstore_test_' . getmypid();
$exists = $db->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$DBN}'");
if ($exists && $exists->num_rows) {
    echo "\n  FAIL  {$DBN} already exists — refusing to touch a schema this test did not create.\n\n";
    exit(1);
}
ok($db->query("CREATE DATABASE {$DBN}"), '0: a throwaway database was created for this run');
ok($db->select_db($DBN), '0: and selected');

/* Stand-ins for the two tables the migration must not touch, shaped like the
   production columns section 1c documents — including ref_no's utf8mb4_general_ci,
   which is what makes the collation check in section 3a meaningful here. */
$db->query("CREATE TABLE quotations (
              id INT UNSIGNED NOT NULL AUTO_INCREMENT,
              ref_no VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
              items LONGTEXT NULL,
              PRIMARY KEY (id), UNIQUE KEY uq_quotations_ref (ref_no)) ENGINE=InnoDB");
$db->query("CREATE TABLE app_users (
              id INT UNSIGNED NOT NULL AUTO_INCREMENT,
              username VARCHAR(64) NOT NULL,
              display_name VARCHAR(100) NOT NULL,
              PRIMARY KEY (id), UNIQUE KEY uq_app_users_username (username)) ENGINE=InnoDB");

/* AUTO_INCREMENT=n is a counter, not a definition, and it moves whenever this
   test inserts a row. What must not change is the SHAPE. */
$fingerprint = function ($t) use ($db) {
    $r = $db->query("SHOW CREATE TABLE {$t}");
    if (!$r) return null;
    return preg_replace('/\s*AUTO_INCREMENT=\d+/', '', $r->fetch_row()[1]);
};
$beforeQuot = $fingerprint('quotations');
$beforeUser = $fingerprint('app_users');
ok($beforeQuot !== null && $beforeUser !== null, '0: both stand-in tables exist before the migration runs');

$tables = function () use ($db, $DBN) {
    $out = [];
    $r = $db->query("SELECT TABLE_NAME FROM information_schema.TABLES
                     WHERE TABLE_SCHEMA='{$DBN}' ORDER BY TABLE_NAME");
    while ($row = $r->fetch_row()) $out[] = $row[0];
    return $out;
};
eq($tables(), ['app_users', 'quotations'], '0: and they are the only two tables in the schema');


// ══ 1 · the migration runs ══════════════════════════════════════════════════
{
    ok($db->query($body) === true, '1: section 2 executes cleanly: ' . $db->error);
    eq($tables(), ['app_users', 'quotation_revisions', 'quotations'],
       '1: exactly ONE table was created, and it is quotation_revisions');

    $r = $db->query("SELECT COUNT(*) FROM quotation_revisions");
    eq((int)$r->fetch_row()[0], 0, '1: the table starts EMPTY — no history is invented');
}


// ══ 2 · the columns, exactly ════════════════════════════════════════════════
{
    $cols = [];
    $r = $db->query("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
                     FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA='{$DBN}' AND TABLE_NAME='quotation_revisions'
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

    /* The three that carry an argument in the file, asserted so the argument
       cannot be quietly reversed. */
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
}


// ══ 3 · the indexes, and the one that is deliberately absent ════════════════
{
    $idx = [];
    $r = $db->query("SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
                     FROM information_schema.STATISTICS
                     WHERE TABLE_SCHEMA='{$DBN}' AND TABLE_NAME='quotation_revisions'
                     ORDER BY INDEX_NAME, SEQ_IN_INDEX");
    while ($row = $r->fetch_assoc()) {
        $idx[$row['INDEX_NAME']]['unique'] = ($row['NON_UNIQUE'] === '0' || $row['NON_UNIQUE'] === 0);
        $idx[$row['INDEX_NAME']]['cols'][] = $row['COLUMN_NAME'];
    }

    /* information_schema orders by INDEX_NAME under the server collation, which
       does not put PRIMARY where a person would. Sorted, so the assertion is
       about WHICH indexes exist and not about how MySQL sorted them. */
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

    /* Not an oversight: quotation_id is the leftmost column of the UNIQUE, so a
       standalone index on it would cost writes and buy nothing. */
    $standalone = array_filter($idx, function ($v, $k) {
        return $k !== 'uq_quotation_revisions_no' && $v['cols'] === ['quotation_id'];
    }, ARRAY_FILTER_USE_BOTH);
    eq($standalone, [], '3: NO standalone index on quotation_id — the UNIQUE already covers that prefix');
}


// ══ 4 · what the schema refuses, and what it allows ═════════════════════════
{
    $db->query("INSERT INTO quotations (ref_no) VALUES ('Q-2026-0001'), ('Q-2026-0002')");
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

    // 4a · the same revision number for the SAME quotation is refused
    ok($ins(1, 1, 'Q-2026-0001', 1, '{"x":1}') === false, '4a: a duplicate (quotation_id, revision_no) is refused');
    eq($db->errno, 1062, '4a: with MySQL 1062, duplicate key');

    // 4b · the same revision number for a DIFFERENT quotation is fine
    ok($ins(2, 1, 'Q-2026-0002', 1, '{"x":1}') === true,
       '4b: two different quotations may both have a revision 1: ' . $db->error);

    // 4c · numbering continues within a quotation
    ok($ins(1, 2, 'Q-2026-0001', 1, '{"x":2}') === true, '4c: quotation 1 gains a revision 2');

    // 4d · invalid JSON is refused BY THE COLUMN
    ok($ins(1, 3, 'Q-2026-0001', 1, '{not json') === false, '4d: invalid JSON is refused');
    eq($db->errno, 3140, '4d: with MySQL 3140, invalid JSON text');
    ok($ins(1, 3, 'Q-2026-0001', 1, '') === false, '4d: and so is an empty string');

    // 4e · the version must be stated
    ok($ins(1, 4, 'Q-2026-0001', null, '{"x":4}') === false,
       '4e: a NULL snapshot_schema_version is refused — the writer must say which format it wrote');
    eq($db->errno, 1048, '4e: with MySQL 1048, column cannot be null');
    ok($db->query("INSERT INTO quotation_revisions
                     (quotation_id, revision_no, quotation_ref_no, event_type, snapshot_json)
                   VALUES (1, 5, 'Q-2026-0001', 'update', '{\"x\":5}')") === false,
       '4e: and omitting the column entirely fails too — there is no default to fall back on');

    // 4f · a system actor is allowed to have no person behind it
    ok($ins(2, 2, 'Q-2026-0002', 1, '{"x":9}', null) === true,
       '4f: actor_user_id may be NULL — a migration or script is not a signed-in person');

    // 4g · JSON is stored as JSON, not as text
    $r = $db->query("SELECT JSON_EXTRACT(snapshot_json, '$.items[0].item_uid') AS uid
                     FROM quotation_revisions WHERE quotation_id=1 AND revision_no=1");
    eq(trim((string)$r->fetch_assoc()['uid'], '"'), 'itm_' . str_repeat('a', 32),
       '4g: the snapshot is queryable as JSON — item identity is readable inside it');

    // 4h · a revision survives its quotation being deleted, which is the point
    //      of having no foreign key
    $db->query("DELETE FROM quotations WHERE id=2");
    $r = $db->query("SELECT COUNT(*) FROM quotation_revisions WHERE quotation_id=2");
    eq((int)$r->fetch_row()[0], 2,
       '4h: deleting the quotation left its revisions standing — no FK, no cascade');
    $r = $db->query("SELECT quotation_ref_no FROM quotation_revisions WHERE quotation_id=2 LIMIT 1");
    eq($r->fetch_row()[0], 'Q-2026-0002',
       '4h: and the revision still names the quotation whose row is gone');
}


// ══ 5 · idempotence, and nothing else touched ═══════════════════════════════
{
    $r = $db->query("SELECT COUNT(*) FROM quotation_revisions");
    $rowsBefore = (int)$r->fetch_row()[0];
    $defBefore  = $fingerprint('quotation_revisions');

    ok($db->query($body) === true, '5: section 2 runs a SECOND time without error: ' . $db->error);

    $r = $db->query("SELECT COUNT(*) FROM quotation_revisions");
    eq((int)$r->fetch_row()[0], $rowsBefore, '5: and the rows it already held are untouched');
    eq($fingerprint('quotation_revisions'), $defBefore, '5: the table definition is byte-identical after the re-run');
    eq($tables(), ['app_users', 'quotation_revisions', 'quotations'], '5: still exactly three tables');

    eq($fingerprint('quotations'), $beforeQuot, '5: quotations is unchanged, definition for definition');
    eq($fingerprint('app_users'), $beforeUser, '5: and so is app_users');
}


// ══ 6 · the collation check the migration generates ═════════════════════════
{
    /* The stand-in quotations.ref_no is utf8mb4_general_ci while this server's
       database default is something else on MySQL 8 — exactly the situation
       section 1e warns about. Section 3a must notice and produce the fix. */
    $r = $db->query("SELECT c.COLLATION_NAME FROM information_schema.COLUMNS c
                     WHERE c.TABLE_SCHEMA='{$DBN}' AND c.TABLE_NAME='quotation_revisions'
                       AND c.COLUMN_NAME='quotation_ref_no'");
    $revColl = $r->fetch_row()[0];
    $r = $db->query("SELECT COLLATION_NAME FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA='{$DBN}' AND TABLE_NAME='quotations' AND COLUMN_NAME='ref_no'");
    $quotColl = $r->fetch_row()[0];

    /* Lift section 3a out of the shipped file and run it. */
    ok(preg_match('/(SELECT CASE WHEN q\.COLLATION_NAME.*?q\.COLUMN_NAME\s*=\s*\'ref_no\';)/s', $sql, $m3) === 1,
       '6: section 3a is present in the shipped migration');
    $r = $db->query(rtrim($m3[1], ';'));
    ok($r !== false, '6: and it runs: ' . $db->error);
    $action = $r ? $r->fetch_row()[0] : '';

    if ($revColl === $quotColl) {
        eq($action, 'MATCH — nothing to do', '6: collations agree, so it reports nothing to do');
    } else {
        ok(stripos($action, 'ALTER TABLE quotation_revisions MODIFY quotation_ref_no') === 0,
           '6: collations differ, so it GENERATES the ALTER rather than making anyone type one');
        ok(strpos($action, $quotColl) !== false,
           "6: and the generated statement adopts quotations.ref_no's own collation ({$quotColl})");
        ok(strpos($action, 'varchar(100)') !== false,
           '6: keeping the type it read from the column instead of restating it');
        /* And it must actually work. */
        ok($db->query(rtrim($action, ';')) === true, '6: the generated ALTER executes: ' . $db->error);
        $r = $db->query("SELECT COLLATION_NAME FROM information_schema.COLUMNS
                         WHERE TABLE_SCHEMA='{$DBN}' AND TABLE_NAME='quotation_revisions'
                           AND COLUMN_NAME='quotation_ref_no'");
        eq($r->fetch_row()[0], $quotColl, '6: after which the two columns share a collation');
        $r = $db->query("SELECT COUNT(*) FROM quotation_revisions r
                         JOIN quotations q ON q.ref_no = r.quotation_ref_no");
        ok($r !== false, '6: and the join that would have raised "Illegal mix of collations" now runs');
    }
}


// ══ 7 · no writer exists anywhere in the application ════════════════════════
{
    foreach (['api.php', 'index.php', 'companies.php', 'pricing_history.php',
              'ai_extract.php', 'auth.php', 'login.php', 'logout.php'] as $f) {
        $t = file_get_contents($ROOT . '/' . $f);
        ok(stripos($t, 'quotation_revisions') === false,
           "7: {$f} does not mention quotation_revisions — no writer, no reader, no hook");
    }
    /* api.php DOES say "no revision storage" in a comment, and that sentence is
       worth keeping. What must be absent is executable code, so the check is
       made against a comment-stripped copy of the file. */
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

// ── clean up ─────────────────────────────────────────────────────────────────
$db->select_db('mysql');
ok($db->query("DROP DATABASE {$DBN}") === true, '7: the throwaway database was dropped');
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
