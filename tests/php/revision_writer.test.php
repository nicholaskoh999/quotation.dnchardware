<?php
/**
 * ── The revision writer — a mutation and its history commit together ────────
 *
 * Run:  php tests/php/revision_writer.test.php
 *
 *     DC_TEST_DB_HOST / _PORT / _USER / _PASS
 *
 * The shipped api.php is copied byte-identically into a sandbox and SERVED OVER
 * REAL HTTP, so save_quotation and update_quotation run exactly as production
 * runs them — real MySQL, real transactions, real request bodies. What is
 * measured is the database afterwards.
 *
 * Needs a real MySQL. EXITS NON-ZERO rather than skipping: an atomicity test
 * that did not run must not read as one that passed.
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
$API  = file_get_contents($ROOT . '/api.php');
$MIG  = file_get_contents($ROOT . '/migrations/2026-08-28-create-quotation-revisions.sql');

// ══ 0 · append-only, and the one INSERT that makes it true ═════════════════
{
    $code = preg_replace('~/\*.*?\*/~s', '', $API);
    $code = preg_replace('~//[^\n]*~', '', $code);
    eq(substr_count($code, 'INSERT INTO quotation_revisions'), 1,
       '0: exactly ONE INSERT into quotation_revisions in the whole application');
    eq(preg_match_all('/UPDATE\s+quotation_revisions/i', $code), 0,
       '0: and no UPDATE against it — append-only is enforced by the code, not a trigger');
    eq(preg_match_all('/DELETE\s+FROM\s+quotation_revisions/i', $code), 0, '0: and no DELETE');
    eq(preg_match_all('/TRUNCATE\s+(TABLE\s+)?quotation_revisions/i', $code), 0,
       '0: and no TRUNCATE against it — the bare word appears in unrelated error text');

    $seg = function ($a, $b) use ($API) {
        $i = strpos($API, $a); $j = strpos($API, $b);
        return substr($API, $i, $j - $i);
    };
    foreach ([['save_quotation', 'update_quotation', 'CREATE'],
              ['update_quotation', 'delete_quotation', 'UPDATE']] as [$a, $b, $label]) {
        $h = $seg("\$action === '{$a}'", "\$action === '{$b}'");
        $w = strpos($h, 'dc_write_revision(');
        $c = strrpos($h, 'dc_txn_commit(');
        ok($w !== false, "0: {$label} writes a revision");
        ok($w < $c, "0: {$label} writes it BEFORE the commit — they land together or not at all");
    }
    $del = $seg("\$action === 'delete_quotation'", "\$action === 'get_price_history'");
    ok(strpos($del, 'dc_write_revision(') === false,
       '0: delete_quotation writes no revision — that is the Baseline / Delete Policy round');
    ok(strpos($API, "dc_write_revision(\$db, \$new_id, 'create')") !== false, '0: the create event is named');
    ok(strpos($API, "dc_write_revision(\$db, \$id, 'update')") !== false, '0: and the update event');
    /* prepared_by is a document field. The actor must come from the session. */
    ok(strpos($API, 'dc_current_user()') !== false, '0: the actor comes from dc_current_user()');
    /* The isolation is scoped to the next transaction only, and only the create
       path asks for it — the update path depends on FOR UPDATE, which is a
       locking read and already sees the latest committed state. */
    eq(substr_count($API, 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED'), 1,
       '0: READ COMMITTED is set in exactly one place');
    ok(strpos($API, 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED') !== false
       && strpos($API, 'SET SESSION TRANSACTION ISOLATION') === false
       && strpos($API, 'SET GLOBAL TRANSACTION ISOLATION') === false,
       '0: scoped to the next transaction — neither the session nor the server is changed');
    ok(!preg_match('/actor_user\w*\s*=\s*\$?\w*prepared_by/i', $API),
       '0: prepared_by is never assigned to an actor column');
}

// ══ connect ════════════════════════════════════════════════════════════════
mysqli_report(MYSQLI_REPORT_OFF);
$H = getenv('DC_TEST_DB_HOST') ?: '127.0.0.1';
$P = (int)(getenv('DC_TEST_DB_PORT') ?: 3306);
$U = getenv('DC_TEST_DB_USER') ?: 'root';
$W = getenv('DC_TEST_DB_PASS'); if ($W === false) $W = '';

$db = @new mysqli($H, $U, $W, null, $P);
if (!$db || $db->connect_errno) {
    echo "\n  FAIL  revision writer — no MySQL at {$H}:{$P}\n\n";
    echo "   - This suite tests transactional atomicity, so it needs a server.\n";
    echo "   - It is deliberately NOT skipped.\n\n";
    exit(1);
}
$server = $db->query('SELECT VERSION()')->fetch_row()[0];

$DBN = 'dc_revwr_test_' . getmypid();
$ex = $db->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$DBN}'");
if ($ex && $ex->num_rows) { echo "\n  FAIL  {$DBN} already exists — refusing to reuse it.\n\n"; exit(1); }
$db->query("CREATE DATABASE {$DBN}");
$db->select_db($DBN);

/* The revision table comes from the SHIPPED migration, lifted between its
   markers, so this suite cannot pass against a schema the migration would not
   produce. */
preg_match('/-- >>> SECTION 2 BEGIN\s*(.*?)\s*-- <<< SECTION 2 END/s', $MIG, $m2);
ok(!empty($m2[1]), 'schema: section 2 lifted from the shipped migration');

$schema = function () use ($db, $m2) {
    $db->query("DROP TABLE IF EXISTS quotation_revisions");
    $db->query("DROP TABLE IF EXISTS quotations");
    $db->query("DROP TABLE IF EXISTS companies");
    $db->query("CREATE TABLE companies (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB");
    $db->query("CREATE TABLE quotations (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id INT UNSIGNED NULL,
        ref_no VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
        quote_date DATE NULL, valid_until DATE NULL,
        prepared_by VARCHAR(100) NULL, remarks TEXT NULL,
        customer_name VARCHAR(200) NULL, customer_phone VARCHAR(50) NULL,
        items LONGTEXT NULL, total_amount DECIMAL(12,2) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id), UNIQUE KEY uq_quotations_ref (ref_no)) ENGINE=InnoDB");
    $db->query($m2[1]);
};
$schema();

// ── the sandbox: the SHIPPED api.php, served over real HTTP ────────────────
$SB = sys_get_temp_dir() . '/dc-revwr-sb-' . getmypid();
@mkdir($SB, 0777, true);
$cleanupSandbox = function () use ($SB) {
    foreach (['api.php', 'pricing_history.php', 'auth.php', 'db.php'] as $f) @unlink($SB . '/' . $f);
    @rmdir($SB);
};
register_shutdown_function($cleanupSandbox);

copy($ROOT . '/api.php', $SB . '/api.php');
copy($ROOT . '/pricing_history.php', $SB . '/pricing_history.php');
/* A stub auth.php that answers dc_current_user() with a real actor, so what the
   writer records can be checked against something known. Same shape the
   accepted Actor Identity contract returns. */
file_put_contents($SB . '/auth.php',
    "<?php function dc_require_api_login(){}\n"
  . "function dc_current_user(){ if (getenv('DC_NO_ACTOR')) return null;\n"
  . "  return ['id'=>7,'username'=>'nicholas','display_name'=>'Nicholas Koh']; }\n");
file_put_contents($SB . '/db.php',
    "<?php function getDB(){ static \$d; if(!\$d){ \$d = new mysqli('{$H}','{$U}','{$W}',null,{$P}); \$d->select_db('{$DBN}'); } return \$d; }\n");
ok(sha1_file($SB . '/api.php') === sha1_file($ROOT . '/api.php'),
   '1: the sandbox serves a byte-identical copy of the shipped api.php');

$PORT = 35000 + (getmypid() % 900);
$srvPipes = [];
$srv = proc_open([PHP_BINARY, '-S', "127.0.0.1:{$PORT}", '-t', $SB],
                 [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $srvPipes, $SB);
if (!is_resource($srv)) { echo "\n  FAIL  could not start the sandbox web server\n\n"; exit(1); }
register_shutdown_function(function () use (&$srv, &$srvPipes) {
    if (is_resource($srv)) { proc_terminate($srv);
        foreach ($srvPipes as $sp) if (is_resource($sp)) fclose($sp);
        proc_close($srv); $srv = null; }
});
$up = false;
for ($i = 0; $i < 60; $i++) {
    $fp = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 0.3);
    if ($fp) { fclose($fp); $up = true; break; }
    usleep(200000);
}
ok($up, "1: the sandbox web server is listening on 127.0.0.1:{$PORT}");
if (!$up) exit(1);

$call = function ($action, $payload = null) use ($PORT) {
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'header' => "Content-Type: application/json\r\n",
        'content' => $payload === null ? '' : json_encode($payload),
        'ignore_errors' => true, 'timeout' => 30,
    ]]);
    $out = @file_get_contents("http://127.0.0.1:{$PORT}/api.php?action=" . rawurlencode($action), false, $ctx);
    $j = json_decode((string)$out, true);
    return is_array($j) ? $j : ['ok' => false, 'error' => 'non-JSON: ' . substr((string)$out, 0, 300)];
};
$one  = function ($q) use ($db) { $r = $db->query($q); return $r ? $r->fetch_row()[0] : null; };
$revs = function ($qid = null) use ($db) {
    $w = $qid === null ? '' : ' WHERE quotation_id=' . (int)$qid;
    $r = $db->query("SELECT * FROM quotation_revisions{$w} ORDER BY id");
    $out = []; while ($x = $r->fetch_assoc()) $out[] = $x;
    return $out;
};
$qrow = function ($id) use ($db) {
    $r = $db->query("SELECT * FROM quotations WHERE id=" . (int)$id); return $r ? $r->fetch_assoc() : null;
};
$nRevs = function () use ($one) { return (int)$one("SELECT COUNT(*) FROM quotation_revisions"); };
$nQuot = function () use ($one) { return (int)$one("SELECT COUNT(*) FROM quotations"); };

$db->query("INSERT INTO companies (name) VALUES ('Alpha Engineering Sdn Bhd')");
$COMPANY = (int)$db->insert_id;

$item = ['desc' => 'SAG ROD', 'size' => 'M20', 'qty' => 4, 'finalUnitPrice' => 5.76, 'totalAmount' => 23.04];
$base = ['company_id' => $COMPANY, 'quote_date' => '2026-08-28', 'valid_until' => '',
         'prepared_by' => 'Siti from the office', 'remarks' => 'handle with care',
         'customer_name' => 'Beta Sdn Bhd', 'customer_phone' => '012-3456789',
         'total_amount' => 23.04];


// ══ 2 · CREATE writes exactly one revision, of persisted fact ══════════════
$id1 = null; $uid1 = null;
{
    $r = $call('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$item]]));
    ok(!empty($r['ok']), '2: the create succeeds: ' . json_encode($r));
    $id1  = (int)$r['id'];
    $uid1 = $r['items'][0]['item_uid'];

    $rows = $revs($id1);
    eq(count($rows), 1, '2: exactly ONE revision was written');
    $rev = $rows[0];
    eq($rev['event_type'], 'create', '2: its event_type is create');
    eq((int)$rev['revision_no'], 1, '2: numbered 1');
    eq((int)$rev['snapshot_schema_version'], 1, '2: with the schema version stated');
    $q = $qrow($id1);
    eq($rev['quotation_ref_no'], $q['ref_no'], '2: quotation_ref_no matches the persisted ref_no');

    // ── the snapshot is of PERSISTED fact ──
    $s = json_decode($rev['snapshot_json'], true);
    ok(is_array($s), '2: snapshot_json is valid JSON');
    eq((int)$s['quotation']['id'], $id1, '2: snapshot carries the quotation id');
    eq($s['quotation']['ref_no'], $q['ref_no'], '2: and the SERVER-allocated ref_no, not a requested one');
    eq($s['quotation']['customer_name'], $q['customer_name'], '2: customer_name matches the persisted row');
    eq($s['quotation']['customer_phone'], $q['customer_phone'], '2: customer_phone too');
    eq($s['quotation']['quote_date'], $q['quote_date'], '2: quote_date as stored');
    eq($s['quotation']['remarks'], $q['remarks'], '2: remarks as stored');
    eq((string)$s['quotation']['total_amount'], (string)$q['total_amount'], '2: total_amount as stored');
    eq((int)$s['quotation']['company_id'], $COMPANY, '2: company_id as stored');

    // ── the frozen company name ──
    eq($s['quotation']['company_name'], 'Alpha Engineering Sdn Bhd',
       '2: the resolved company_name is FROZEN into the snapshot');

    // ── items, with identity ──
    eq(count($s['items']), 1, '2: the items are in the snapshot');
    eq((int)$s['item_count'], 1, '2: and counted');
    eq($s['items'][0]['item_uid'], $uid1, '2: carrying the item_uid the server minted');
    /* Compared by VALUE, not by key order. snapshot_json is a native JSON
       column and MySQL normalises what it stores — keys come back sorted, so a
       strict === on the decoded arrays would be asserting MySQL's storage
       format rather than the snapshot's content. The values are what matter
       and they are identical. */
    $persistedItem = json_decode($q['items'], true)[0];
    $snapItem      = $s['items'][0];
    ksort($persistedItem); ksort($snapItem);
    eq($snapItem, $persistedItem, '2: item for item, the snapshot IS the persisted items array');
    eq(count($s['items'][0]), count(json_decode($q['items'], true)[0]),
       '2: with no field added or lost');

    // ── the actor, and what is not the actor ──
    eq((int)$rev['actor_user_id'], 7, '2: actor_user_id comes from the session');
    eq($rev['actor_username'], 'nicholas', '2: actor_username too');
    eq($rev['actor_display_name'], 'Nicholas Koh', '2: and the display name is snapshotted beside it');
    eq($q['prepared_by'], 'Siti from the office', '2: prepared_by is a different value entirely');
    ok($rev['actor_username'] !== $q['prepared_by'] && $rev['actor_display_name'] !== $q['prepared_by'],
       '2: prepared_by was NOT substituted for the audit actor');
    eq($s['quotation']['prepared_by'], 'Siti from the office',
       '2: and prepared_by is kept in the snapshot as the DOCUMENT field it is');
}


// ══ 3 · UPDATE writes exactly one more, numbered after it ══════════════════
{
    $r = $call('update_quotation', array_merge($base, [
        'id' => $id1, 'ref_no' => 'Q-9999-9999',
        'items' => [array_merge($item, ['item_uid' => $uid1, 'qty' => 9]), ['desc' => 'NEW', 'qty' => 1]],
        'customer_name' => 'Gamma Sdn Bhd']));
    ok(!empty($r['ok']), '3: the update succeeds: ' . json_encode($r));

    $rows = $revs($id1);
    eq(count($rows), 2, '3: exactly ONE more revision — two in all');
    $rev = $rows[1];
    eq($rev['event_type'], 'update', '3: the second is an update');
    eq((int)$rev['revision_no'], 2, '3: numbered 2 — deterministic, per quotation');

    $q = $qrow($id1);
    $s = json_decode($rev['snapshot_json'], true);
    eq($s['quotation']['customer_name'], 'Gamma Sdn Bhd', '3: the snapshot is the state AFTER the write');
    eq($s['quotation']['ref_no'], $q['ref_no'], '3: ref_no is the persisted one');
    eq($rows[0] ? json_decode($rows[0]['snapshot_json'], true)['quotation']['ref_no'] : null, $q['ref_no'],
       '3: which the update did not change');
    ok($s['quotation']['ref_no'] !== 'Q-9999-9999',
       '3: the ref_no the payload carried was ignored, as it always is');
    eq(count($s['items']), 2, '3: both items are in the snapshot');
    eq($s['items'][0]['item_uid'], $uid1, '3: the retained item kept its identity');
    ok(preg_match('/^itm_[0-9a-f]{32}$/', $s['items'][1]['item_uid'] ?? ''), '3: the new one was minted');
    $ps = json_decode($q['items'], true);
    $ss = $s['items'];
    foreach ($ps as $k => $v) { ksort($ps[$k]); }
    foreach ($ss as $k => $v) { ksort($ss[$k]); }
    eq($ss, $ps, '3: and the snapshot items ARE the persisted items');
    eq((int)$s['items'][0]['qty'], 9, '3: with the edit in them');

    // a third mutation continues the numbering
    $call('update_quotation', array_merge($base, ['id' => $id1,
        'items' => [array_merge($item, ['item_uid' => $uid1])], 'customer_name' => 'Delta Sdn Bhd']));
    $rows = $revs($id1);
    eq(count($rows), 3, '3: a third mutation, a third revision');
    eq(array_map(function ($x) { return (int)$x['revision_no']; }, $rows), [1, 2, 3],
       '3: numbered 1, 2, 3 in order');
    eq(array_map(function ($x) { return $x['event_type']; }, $rows), ['create', 'update', 'update'],
       '3: create then update then update');
}


// ══ 4 · a refused mutation leaves no revision ══════════════════════════════
{
    $before = [$nQuot(), $nRevs()];
    $x = $call('update_quotation', array_merge($base, ['id' => $id1,
        'items' => [array_merge($item, ['item_uid' => 'itm_' . str_repeat('d', 32)])]]));
    eq($x['error'] ?? '', 'ITEM_IDENTITY_UNKNOWN_UID', '4: a forged item_uid is still refused');
    eq([$nQuot(), $nRevs()], $before, '4: and neither the quotation nor a revision moved');

    $x = $call('update_quotation', array_merge($base, ['id' => 999999, 'items' => [$item]]));
    eq($x['error'] ?? '', 'Not found', '4: a missing quotation is still Not found');
    eq([$nQuot(), $nRevs()], $before, '4: and writes nothing');
}


// ══ 5 · a failed CREATE writes neither row ═════════════════════════════════
{
    /* total_amount is DECIMAL(12,2); a larger value is out of range and strict
       mode refuses the INSERT. No ALTER, so nothing here depends on a schema
       change that a populated column would silently reject. */
    $before = [$nQuot(), $nRevs()];
    $x = $call('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$item],
                                                     'total_amount' => 99999999999999]));
    ok(empty($x['ok']), '5: a create that fails at the INSERT is refused: ' . json_encode($x));
    eq([$nQuot(), $nRevs()], $before, '5: no quotation row AND no revision — the first attempt left nothing');
}


// ══ 6 · a revision that cannot be written takes the mutation with it ═══════
{
    // ── CREATE ──
    /* A NOT NULL column with no default. Existing rows are backfilled, so the
       ALTER succeeds even on a populated table, but the writer's INSERT does
       not name it and strict mode refuses that with 1364. The failure lands on
       the revision INSERT and nowhere else. */
    ok($db->query("ALTER TABLE quotation_revisions ADD COLUMN dc_force_fail INT NOT NULL") === true,
       '6: the forced-failure column was added: ' . $db->error);
    $before = [$nQuot(), $nRevs()];
    $x = $call('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$item]]));
    ok(empty($x['ok']), '6: a create whose revision cannot be written is REFUSED: ' . json_encode($x));
    ok(strpos((string)($x['error'] ?? ''), 'Revision') === 0,
       '6: and says the revision was the reason: ' . ($x['error'] ?? ''));
    eq([$nQuot(), $nRevs()], $before,
       '6: NO quotation row survived — the mutation rolled back with its revision');
    eq((int)$one("SELECT IS_FREE_LOCK('dc_quotation_ref_alloc')"), 1,
       '6: and the named lock was given back');

    // ── UPDATE ──
    $q = $qrow($id1);
    $revsBefore = $revs($id1);
    $x = $call('update_quotation', array_merge($base, ['id' => $id1,
        'items' => [array_merge($item, ['item_uid' => $uid1])], 'customer_name' => 'SHOULD NOT LAND']));
    ok(empty($x['ok']), '6: an update whose revision cannot be written is REFUSED');
    eq($qrow($id1), $q, '6: and the quotation row is byte-identical — the update rolled back');
    eq($revs($id1), $revsBefore, '6: with no revision added');
    ok($db->query("ALTER TABLE quotation_revisions DROP COLUMN dc_force_fail") === true,
       '6: and removed again');
}


// ══ 7 · the table is REQUIRED, and its absence fails loudly ════════════════
{
    $db->query("DROP TABLE quotation_revisions");
    $beforeQ = $nQuot();
    $x = $call('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$item]]));
    ok(empty($x['ok']), '7: with quotation_revisions absent, a save is REFUSED, not silently unrecorded');
    eq($nQuot(), $beforeQ, '7: and no quotation row is created');
    $db->query($m2[1]);   // put it back
    ok((int)$one("SELECT COUNT(*) FROM quotation_revisions") === 0, '7: the table is back and empty');
    /* Deployment order, proven rather than assumed: the migration has to be
       applied BEFORE this application is deployed. */
}


// ══ 8 · a real 1062 race writes exactly one revision ═══════════════════════
{
    $schema();
    $db->query("INSERT INTO companies (name) VALUES ('Alpha Engineering Sdn Bhd')");
    $C2 = (int)$db->insert_id;

    /* A second connection takes the number the allocator is about to choose and
       holds it UNCOMMITTED. The API request blocks on the duplicate key, we
       commit, it gets a real 1062, retries once through next_free_ref_no and
       succeeds on the next number. This is the retry happening for real, inside
       the transaction, not simulated with a fake driver. */
    $T = new mysqli($H, $U, $W, null, $P); $T->select_db($DBN);
    $T->begin_transaction();
    $T->query("INSERT INTO quotations (ref_no, customer_name, items, total_amount)
               VALUES ('Q-" . date('Y') . "-0001', 'squatter', '[]', 0)");

    $payload = json_encode(array_merge($base, ['company_id' => $C2, 'ref_no' => '', 'items' => [$item]]));
    $sock = @fsockopen('127.0.0.1', $PORT, $en, $es, 5);
    ok($sock !== false, '8: a raw connection to the sandbox opened');
    $req = "POST /api.php?action=save_quotation HTTP/1.1\r\nHost: 127.0.0.1\r\n"
         . "Content-Type: application/json\r\nContent-Length: " . strlen($payload) . "\r\n"
         . "Connection: close\r\n\r\n" . $payload;
    fwrite($sock, $req);
    usleep(700000);                 // let it reach the INSERT and block on the key
    $T->commit();                   // now the duplicate is real → 1062 → one retry
    $resp = ''; while (!feof($sock)) { $resp .= fread($sock, 8192); }
    fclose($sock); $T->close();

    $body = substr($resp, strpos($resp, "\r\n\r\n") + 4);
    $j = json_decode(trim($body), true);

    /* THE RETRY RECOVERS, and this is the assertion that proves the fix.

       Under the server default, REPEATABLE READ, it could not: the transaction
       holds one snapshot for its whole life, so after the other session
       commits, next_free_ref_no()'s plain SELECT still returned the SAME
       number and the single retry collided again. The create transaction now
       opens at READ COMMITTED, so the reallocation sees the row it collided
       with and takes the next free number.

       This is a real race, not a simulation: another connection held the
       number uncommitted, this request blocked on the duplicate key, the
       other connection committed, and MySQL raised a genuine 1062. */
    $body = substr($resp, strpos($resp, "\r\n\r\n") + 4);
    $j = json_decode(trim($body), true);
    ok(is_array($j) && !empty($j['ok']),
       '8: the save SUCCEEDS through a real 1062 retry: ' . substr($body, 0, 200));

    if (is_array($j) && !empty($j['ok'])) {
        $newId = (int)$j['id'];
        eq($j['ref_no'], 'Q-' . date('Y') . '-0002',
           '8: on the NEXT number — the reallocation could see the squatter this time');
        eq(count($revs($newId)), 1,
           '8: and EXACTLY ONE revision was written, not one per attempt');
        $rev = $revs($newId)[0];
        eq((int)$rev['revision_no'], 1, '8: numbered 1 — it is still a create');
        eq($rev['event_type'], 'create', '8: and recorded as one');
        eq($rev['quotation_ref_no'], $j['ref_no'],
           '8: recording the ref_no the retry SETTLED on, not the one it first tried');
        $s8 = json_decode($rev['snapshot_json'], true);
        eq($s8['quotation']['ref_no'], $j['ref_no'], '8: and the snapshot agrees with it');
        /* The number it first tried belongs to the other session, and nothing
           in this history claims it. */
        eq((int)$one("SELECT COUNT(*) FROM quotation_revisions WHERE quotation_ref_no = 'Q-"
                     . date('Y') . "-0001'"), 0,
           '8: no revision claims the number the first attempt lost');
    }
    eq((int)$one("SELECT IS_FREE_LOCK('dc_quotation_ref_alloc')"), 1, '8: the named lock was released');

    /* And the property the round asked about, proven structurally too: the
       revision write happens ONCE, after the retry has settled, not once per
       attempt. There is no loop between them and exactly one call site. */
    $createSeg = substr($API, strpos($API, "\$action === 'save_quotation'"),
                        strpos($API, "\$action === 'update_quotation'") - strpos($API, "\$action === 'save_quotation'"));
    eq(substr_count($createSeg, 'dc_write_revision('), 1,
       '8: the create path calls the writer exactly once, whatever the INSERT did internally');
    ok(strpos($createSeg, 'dc_save_quotation_insert(') < strpos($createSeg, 'dc_write_revision('),
       '8: and only after the retrying INSERT has returned');
    ok(preg_match('/for\s*\(|while\s*\(/', $createSeg) === 0,
       '8: with no loop around either of them');
    ok(strpos($createSeg, 'dc_txn_begin($db, true)') !== false,
       '8: the create transaction asks for fresh reads, which is what makes the retry able to recover');

    /* Clean the directly-inserted squatter away: it never went through the
       application, so it is not part of what section 9 is measuring. */
    $db->query("DELETE FROM quotations WHERE customer_name = 'squatter'");
}


// ══ 9 · no orphans, no unrevisioned mutations ══════════════════════════════
{
    $orphans = (int)$one("SELECT COUNT(*) FROM quotation_revisions r
                          LEFT JOIN quotations q ON q.id = r.quotation_id
                          WHERE q.id IS NULL");
    eq($orphans, 0, '9: no revision refers to a quotation that does not exist');
    $unrevisioned = (int)$one("SELECT COUNT(*) FROM quotations q
                               LEFT JOIN quotation_revisions r ON r.quotation_id = q.id
                               WHERE r.id IS NULL");
    eq($unrevisioned, 0, '9: and every quotation this application created has a history');
    $dupes = (int)$one("SELECT COUNT(*) FROM (SELECT quotation_id, revision_no, COUNT(*) c
                        FROM quotation_revisions GROUP BY quotation_id, revision_no HAVING c > 1) x");
    eq($dupes, 0, '9: no quotation holds two revisions with the same number');
}


// ══ 10 · concurrent updates of one quotation cannot collide on a number ════
{
    $r = $call('save_quotation', array_merge($base, ['company_id' => null, 'ref_no' => '', 'items' => [$item]]));
    $idA = (int)$r['id']; $uidA = $r['items'][0]['item_uid'];

    /* Two updates of the SAME quotation, issued at once. The row lock from the
       transaction foundation serialises them, so the revision numbers cannot
       both read the same MAX. */
    $mk = function ($name) use ($base, $idA, $uidA, $item) {
        return json_encode(array_merge($base, ['company_id' => null, 'id' => $idA,
            'items' => [array_merge($item, ['item_uid' => $uidA])], 'customer_name' => $name]));
    };
    $socks = [];
    foreach (['Racer One', 'Racer Two'] as $n) {
        $pl = $mk($n);
        $s2 = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 5);
        fwrite($s2, "POST /api.php?action=update_quotation HTTP/1.1\r\nHost: 127.0.0.1\r\n"
                  . "Content-Type: application/json\r\nContent-Length: " . strlen($pl) . "\r\n"
                  . "Connection: close\r\n\r\n" . $pl);
        $socks[] = $s2;
    }
    $bodies = [];
    foreach ($socks as $s2) { $t = ''; while (!feof($s2)) $t .= fread($s2, 8192); fclose($s2); $bodies[] = $t; }
    $okCount = 0;
    foreach ($bodies as $b) {
        $j = json_decode(trim(substr($b, strpos($b, "\r\n\r\n") + 4)), true);
        if (is_array($j) && !empty($j['ok'])) $okCount++;
    }
    eq($okCount, 2, '10: both concurrent updates succeeded');
    $rows = $revs($idA);
    eq(count($rows), 3, '10: three revisions — the create and both updates');
    $nos = array_map(function ($x) { return (int)$x['revision_no']; }, $rows);
    eq($nos, [1, 2, 3], '10: numbered 1, 2, 3 with no collision and no gap');
    eq(count(array_unique($nos)), 3, '10: every number distinct');
}


// ── clean up ─────────────────────────────────────────────────────────────────
$db->select_db('mysql');
ok($db->query("DROP DATABASE {$DBN}") === true, '10: the throwaway database was dropped');
$db->close();

$name = 'revision writer — a mutation and its history commit together';
if ($failures) {
    echo "\n  FAIL  {$name}  ({$asserts} assertions, " . count($failures) . " failed)  [MySQL {$server}]\n\n";
    foreach ($failures as $f) echo "   - {$f}\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    {$name}  ({$asserts} assertions)  [MySQL {$server}]\n\n";
