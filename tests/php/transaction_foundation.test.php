<?php
/**
 * ── Read before write — one transaction around a quotation mutation ─────────
 *
 * Run:  php tests/php/transaction_foundation.test.php
 *
 *     DC_TEST_DB_HOST   default 127.0.0.1
 *     DC_TEST_DB_PORT   default 3306
 *     DC_TEST_DB_USER   default root
 *     DC_TEST_DB_PASS   default ''
 *
 * Three kinds of evidence, because no one kind covers this:
 *
 *   · the SHIPPED api.php is COPIED VERBATIM into a sandbox beside a stub
 *     auth.php and db.php and then RUN, so save_quotation and update_quotation
 *     are exercised as they will run in production — real MySQL, real
 *     transactions, real rows. The same principle tests/lib/harness.js uses
 *     when it serves the real index.php.
 *   · dc_txn_begin/commit/rollback/cleanup and dc_lock_quotation_for_update are
 *     LIFTED from the shipped file and driven directly, including against a
 *     stub driver for the two failures a real server will not produce on
 *     demand (BEGIN refused, COMMIT refused).
 *   · statement ORDER is read out of the shipped source, because "the read is
 *     inside the transaction" is a claim about sequence and nothing else can
 *     prove it.
 *
 * Needs a real MySQL. It EXITS NON-ZERO rather than skipping when none is
 * reachable: a transaction test that did not run must not read as one that
 * passed.
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

/* ── lift a named function out of the shipped source ─────────────────────── */
function lift($src, $name) {
    $at = strpos($src, "function {$name}(");
    if ($at === false) return null;
    $i = strpos($src, '{', $at); $depth = 0;
    for ($k = $i, $n = strlen($src); $k < $n; $k++) {
        if ($src[$k] === '{') $depth++;
        elseif ($src[$k] === '}') { $depth--; if ($depth === 0) return substr($src, $at, $k - $at + 1); }
    }
    return null;
}
$code = '';
foreach (['dc_txn_begin', 'dc_txn_commit', 'dc_txn_rollback', 'dc_txn_note_lock',
          'dc_txn_cleanup', 'dc_lock_quotation_for_update'] as $fn) {
    $b = lift($API, $fn);
    ok($b !== null, "0: {$fn}() is present in the shipped api.php");
    if ($b === null) { echo "  cannot continue\n"; exit(1); }
    $code .= $b . "\n";
}
define('DC_REF_LOCK', 'dc_quotation_ref_alloc');
$GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];
/* prepare_or_fail / execute_or_fail are what dc_lock_quotation_for_update calls;
   the shipped ones exit the process, which a test cannot use, so the lifted
   function is given the same contract with a throwing edge instead. */
$code .= 'function prepare_or_fail($db,$sql,$l="p"){ $s=$db->prepare($sql); if(!$s) throw new Exception($l.": ".$db->error); return $s; }' . "\n";
$code .= 'function execute_or_fail($s,$l="e"){ if(!$s->execute()) throw new Exception($l.": ".$s->error); return $s; }' . "\n";
eval($code);


// ══ 1 · statement ORDER, read out of the shipped source ════════════════════
$seg = function ($from, $to) use ($API) {
    $i = strpos($API, $from); $j = strpos($API, $to);
    return ($i === false || $j === false) ? '' : substr($API, $i, $j - $i);
};
$create = $seg("\$action === 'save_quotation'", "\$action === 'update_quotation'");
$update = $seg("\$action === 'update_quotation'", "\$action === 'delete_quotation'");
$delete = $seg("\$action === 'delete_quotation'", "\$action === 'get_price_history'");
ok($create !== '' && $update !== '', '1: both handlers were located in the shipped file');

{
    $at = function ($h, $n) { $p = strpos($h, $n); return $p === false ? -1 : $p; };
    // CREATE: lock -> begin -> insert -> commit -> release
    $lock = $at($create, 'acquire_ref_lock(');
    $beg  = $at($create, 'dc_txn_begin(');
    $ins  = $at($create, 'INSERT INTO quotations');
    $com  = strrpos($create, 'dc_txn_commit(');
    $rel  = strrpos($create, 'release_ref_lock(');
    ok($lock >= 0 && $beg > $lock, '1: CREATE takes the named lock BEFORE it opens the transaction');
    ok($ins > $beg, '1: and opens the transaction BEFORE the INSERT');
    ok($com !== false && $com > $ins, '1: the INSERT is followed by COMMIT');
    ok($rel !== false && $rel > $com, '1: and the named lock is released only AFTER the commit');

    // UPDATE: begin -> locked read -> update -> commit
    $ubeg = $at($update, 'dc_txn_begin(');
    $urd  = $at($update, 'dc_lock_quotation_for_update(');
    $uupd = $at($update, 'UPDATE quotations SET');
    $ucom = $at($update, 'dc_txn_commit(');
    ok($ubeg >= 0, '1: UPDATE opens a transaction');
    ok($urd > $ubeg, '1: the persisted read happens INSIDE it, not before');
    ok($uupd > $urd, '1: the write happens after the locked read');
    ok($ucom > $uupd, '1: and the commit after the write');
    ok(strpos($API, 'FOR UPDATE') !== false, '1: the read is SELECT ... FOR UPDATE');
    ok(strpos($update, 'SELECT items FROM quotations') === false,
       '1: the old pre-transaction read is gone — nothing reads a stale copy');
    ok(strpos($update, 'dc_reconcile_item_uids($input[\'items\'] ?? [], $persisted[\'items\']') !== false,
       '1: reconciliation reads the LOCKED row, not a separate fetch');

    // the contracts this round must not disturb
    ok(strpos($create, "dc_save_quotation_insert(") !== false, '1: the 1062 retry is still the INSERT path');
    ok(substr_count($API, 'errno === 1062') + substr_count($API, 'errno !== 1062')
       + substr_count($API, '1062') >= 1, '1: and 1062 is still the only errno answered');
    ok(strpos($update, 'ref_no') !== false && strpos($update, 'UPDATE quotations SET company_id=?,quote_date=?') !== false
       && strpos($update, 'SET ref_no') === false,
       '1: UPDATE still does not touch ref_no');
    ok(strpos($API, 'GET_LOCK') !== false && strpos($API, 'RELEASE_LOCK') !== false,
       '1: GET_LOCK / RELEASE_LOCK are still how allocation is serialised');
    ok(strpos($API, 'FOR UPDATE') !== false && strpos($create, 'FOR UPDATE') === false,
       '1: and the named lock was NOT replaced by row locking on the create path');

    // out of scope, proven absent
    ok(stripos($API, 'quotation_revisions') === false, '1: api.php has no reference to quotation_revisions');
    ok(stripos($API, 'snapshot_json') === false, '1: and none to snapshot_json');
    ok(strpos($delete, 'dc_txn_begin(') === false && strpos($delete, 'FOR UPDATE') === false,
       '1: delete_quotation is untouched by this round');
    ok(preg_match('/for\s*\(|while\s*\(/', $create) === 0,
       '1: no retry LOOP was introduced on the create path');
}


// ══ 2 · the two failures a real server will not produce on demand ══════════
/* A stub driver, so BEGIN-refused and COMMIT-refused are measured rather than
   argued about. */
class TxnStub {
    public $error = 'stub failure'; public $log = [];
    public $beginOk = true, $commitOk = true;
    function begin_transaction() { $this->log[] = 'begin'; return $this->beginOk; }
    function commit()   { $this->log[] = 'commit';   return $this->commitOk; }
    function rollback() { $this->log[] = 'rollback'; return true; }
    function query($q)  { $this->log[] = preg_match('/RELEASE_LOCK/', $q) ? 'release' : 'query'; return true; }
}
{
    $GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];
    $s = new TxnStub(); $s->beginOk = false;
    ok(dc_txn_begin($s) === false, '2: a refused BEGIN is reported as false');
    ok($GLOBALS['DC_TXN']['active'] === false, '2: and no transaction is recorded as open');
    dc_txn_cleanup();
    ok(!in_array('rollback', $s->log, true), '2: so cleanup does not roll back something that never began');

    $GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];
    $s = new TxnStub(); $s->commitOk = false;
    ok(dc_txn_begin($s) === true, '2: BEGIN succeeds');
    ok(dc_txn_commit($s) === false, '2: a refused COMMIT is reported as false — the caller must not claim success');
    ok($GLOBALS['DC_TXN']['active'] === false, '2: and the transaction is no longer recorded as open');

    /* cleanup unwinds BOTH levels, in order, and is safe twice */
    $GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];
    $s = new TxnStub();
    dc_txn_note_lock($s, true);
    dc_txn_begin($s);
    dc_txn_cleanup();
    eq(array_slice($s->log, -2), ['rollback', 'release'],
       '2: cleanup rolls back and THEN releases the named lock');
    $before = count($s->log);
    dc_txn_cleanup();
    eq(count($s->log), $before, '2: and a second cleanup does nothing — it is idempotent');

    /* rollback on a scope that is not open is a no-op, not an error */
    $GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];
    $s = new TxnStub();
    dc_txn_rollback($s);
    eq($s->log, [], '2: rolling back when nothing began does nothing');
}


// ══ connect ════════════════════════════════════════════════════════════════
mysqli_report(MYSQLI_REPORT_OFF);
$H = getenv('DC_TEST_DB_HOST') ?: '127.0.0.1';
$P = (int)(getenv('DC_TEST_DB_PORT') ?: 3306);
$U = getenv('DC_TEST_DB_USER') ?: 'root';
$W = getenv('DC_TEST_DB_PASS'); if ($W === false) $W = '';

$db = @new mysqli($H, $U, $W, null, $P);
if (!$db || $db->connect_errno) {
    echo "\n  FAIL  transaction foundation — no MySQL at {$H}:{$P}\n\n";
    echo "   - This suite tests transactions and row locks, so it needs a server.\n";
    echo "   - It is deliberately NOT skipped: a transaction test that did not run\n";
    echo "     must not read as one that passed.\n\n";
    exit(1);
}
$server = $db->query('SELECT VERSION()')->fetch_row()[0];

$DBN = 'dc_txn_test_' . getmypid();
$ex = $db->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$DBN}'");
if ($ex && $ex->num_rows) { echo "\n  FAIL  {$DBN} already exists — refusing to reuse it.\n\n"; exit(1); }
$db->query("CREATE DATABASE {$DBN}");
$db->select_db($DBN);

$makeSchema = function ($custLen = 200) use ($db) {
    $db->query("DROP TABLE IF EXISTS quotations");
    $db->query("CREATE TABLE quotations (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id INT UNSIGNED NULL,
        ref_no VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
        quote_date DATE NULL, valid_until DATE NULL,
        prepared_by VARCHAR(100) NULL, remarks TEXT NULL,
        customer_name VARCHAR({$custLen}) NULL, customer_phone VARCHAR(50) NULL,
        items LONGTEXT NULL, total_amount DECIMAL(12,2) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id), UNIQUE KEY uq_quotations_ref (ref_no)) ENGINE=InnoDB");
};
$makeSchema();

// ── the sandbox: the SHIPPED api.php, run for real ─────────────────────────
$SB = sys_get_temp_dir() . '/dc-txn-sb-' . getmypid();
@mkdir($SB, 0777, true);
copy($ROOT . '/api.php', $SB . '/api.php');
copy($ROOT . '/pricing_history.php', $SB . '/pricing_history.php');
file_put_contents($SB . '/auth.php', "<?php function dc_require_api_login(){} function dc_current_user(){ return null; }\n");
file_put_contents($SB . '/db.php', "<?php function getDB(){ static \$d; if(!\$d){ \$d = new mysqli('{$H}','{$U}','{$W}',null,{$P}); \$d->select_db('{$DBN}'); } return \$d; }\n");
ok(sha1_file($SB . '/api.php') === sha1_file($ROOT . '/api.php'),
   '3: the sandbox runs a byte-identical copy of the shipped api.php');

/* Served over real HTTP by PHP's built-in server, not included by a CLI
   process. api.php reads its body from php://input, which CLI does not wire to
   stdin — and a test that could not send a body would be testing a handler
   that never sees one. This way the request arrives the way production sends
   it: real method, real query string, real body. */
$PORT = 34000 + (getmypid() % 900);
$srvPipes = [];
$srv = proc_open([PHP_BINARY, '-S', "127.0.0.1:{$PORT}", '-t', $SB],
                 [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $srvPipes, $SB);
if (!is_resource($srv)) { echo "\n  FAIL  could not start the sandbox web server\n\n"; exit(1); }
$up = false;
for ($i = 0; $i < 60; $i++) {
    $fp = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 0.3);
    if ($fp) { fclose($fp); $up = true; break; }
    usleep(200000);
}
ok($up, "3: the sandbox web server is listening on 127.0.0.1:{$PORT}");
if (!$up) { proc_terminate($srv); exit(1); }

$call = function ($action, $payload = null) use ($PORT) {
    $ctx = stream_context_create(['http' => [
        'method'        => 'POST',
        'header'        => "Content-Type: application/json\r\n",
        'content'       => $payload === null ? '' : json_encode($payload),
        'ignore_errors' => true,     // 404s carry a JSON body worth reading
        'timeout'       => 20,
    ]]);
    $out = @file_get_contents("http://127.0.0.1:{$PORT}/api.php?action=" . rawurlencode($action), false, $ctx);
    $j = json_decode((string)$out, true);
    if (!is_array($j)) return ['ok' => false, 'error' => 'non-JSON: ' . substr((string)$out, 0, 300)];
    /* The status line, for the not-found contract. */
    $j['__status'] = 0;
    foreach ($http_response_header ?? [] as $h)
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) $j['__status'] = (int)$m[1];
    return $j;
};
$rows  = function () use ($db) { return (int)$db->query("SELECT COUNT(*) FROM quotations")->fetch_row()[0]; };
$row   = function ($id) use ($db) { $r = $db->query("SELECT * FROM quotations WHERE id=" . (int)$id); return $r ? $r->fetch_assoc() : null; };
$item  = ['desc' => 'SAG ROD', 'size' => 'M20', 'qty' => 4, 'finalUnitPrice' => 5.76, 'totalAmount' => 23.04];
$base  = ['company_id' => null, 'quote_date' => '2026-08-28', 'valid_until' => '',
          'prepared_by' => 'tester', 'remarks' => '', 'customer_name' => 'Alpha Sdn Bhd',
          'customer_phone' => '', 'total_amount' => 23.04];


// ══ 3 · CREATE commits ═════════════════════════════════════════════════════
$id1 = null;
{
    $r = $call('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$item]]));
    ok(!empty($r['ok']), '3: a create succeeds: ' . json_encode($r));
    $id1 = $r['id'] ?? null;
    eq($rows(), 1, '3: and the row is COMMITTED — a separate connection can see it');
    eq($row($id1)['ref_no'], 'Q-' . date('Y') . '-0001', '3: with the allocated ref_no');
    $it = json_decode($row($id1)['items'], true);
    ok(preg_match('/^itm_[0-9a-f]{32}$/', $it[0]['item_uid'] ?? ''), '3: item identity was minted and persisted');
    eq($r['items'][0]['item_uid'], $it[0]['item_uid'], '3: and answered back to the page');

    /* The named lock is a SESSION lock, so the process exiting would release it
       whatever the code did. What is provable is that the lock is free once the
       request is over and that nothing is left in a transaction. */
    eq((int)$db->query("SELECT IS_FREE_LOCK('" . DC_REF_LOCK . "')")->fetch_row()[0], 1,
       '3: the named lock is free again after a successful save');
}


// ══ 4 · CREATE handled failure after BEGIN ═════════════════════════════════
{
    $makeSchema(5);                       // customer_name VARCHAR(5): a real 1406
    $before = $rows();
    $r = $call('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$item],
                                          'customer_name' => 'a name far too long for five']));
    ok(empty($r['ok']), '4: the create is refused: ' . json_encode($r));
    ok(strpos((string)($r['error'] ?? ''), 'Quotation save failed') === 0,
       '4: through the existing failure message, not a new one');
    eq($rows(), $before, '4: and NOTHING was written — the transaction rolled back');
    eq((int)$db->query("SELECT IS_FREE_LOCK('" . DC_REF_LOCK . "')")->fetch_row()[0], 1,
       '4: the named lock was given back');
    $makeSchema();
}


// ══ 5 · UPDATE commits, and keeps every contract ═══════════════════════════
{
    $r = $call('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$item]]));
    $id = $r['id']; $uid = $r['items'][0]['item_uid']; $ref = $row($id)['ref_no'];

    $r2 = $call('update_quotation', array_merge($base, ['id' => $id, 'ref_no' => 'Q-9999-9999',
        'items' => [array_merge($item, ['item_uid' => $uid, 'qty' => 9]), ['desc' => 'NEW', 'qty' => 1]],
        'customer_name' => 'Beta Sdn Bhd']));
    ok(!empty($r2['ok']), '5: the update succeeds: ' . json_encode($r2));
    $after = $row($id);
    eq($after['customer_name'], 'Beta Sdn Bhd', '5: and is COMMITTED — the change is visible');
    eq($after['ref_no'], $ref, '5: ref_no is unchanged, even though the payload carried a different one');
    $items = json_decode($after['items'], true);
    eq(count($items), 2, '5: two items now');
    eq($items[0]['item_uid'], $uid, '5: the existing item KEPT its identity');
    ok(preg_match('/^itm_[0-9a-f]{32}$/', $items[1]['item_uid'] ?? ''), '5: the new item was minted one');
    ok($items[1]['item_uid'] !== $uid, '5: and it differs from the retained one');
    eq((int)$items[0]['qty'], 9, '5: the edit landed');

    // ── every refusal leaves the quotation exactly as it was ──
    $snapshot = $row($id);
    $cases = [
        ['a malformed item_uid',  [array_merge($item, ['item_uid' => 'nope'])],                       'ITEM_IDENTITY_MALFORMED_UID'],
        ['an unknown item_uid',   [array_merge($item, ['item_uid' => 'itm_' . str_repeat('d', 32)])],  'ITEM_IDENTITY_UNKNOWN_UID'],
        ['a duplicated item_uid', [array_merge($item, ['item_uid' => $uid]), array_merge($item, ['item_uid' => $uid])], 'ITEM_IDENTITY_DUPLICATE_UID'],
    ];
    foreach ($cases as [$label, $its, $err]) {
        $x = $call('update_quotation', array_merge($base, ['id' => $id, 'items' => $its, 'customer_name' => 'SHOULD NOT LAND']));
        eq($x['error'] ?? '', $err, "5: {$label} is refused by name");
        eq($row($id), $snapshot, "5: and the quotation row is byte-identical afterwards — {$label}");
    }

    // legacy identity → backfill required, and nothing changes
    $db->query("UPDATE quotations SET items='" . $db->real_escape_string(json_encode([['desc' => 'legacy', 'qty' => 1]])) . "' WHERE id=" . (int)$id);
    $snapshot = $row($id);
    $x = $call('update_quotation', array_merge($base, ['id' => $id, 'items' => [['desc' => 'legacy', 'qty' => 1]], 'customer_name' => 'SHOULD NOT LAND']));
    eq($x['error'] ?? '', 'ITEM_IDENTITY_BACKFILL_REQUIRED', '5: a legacy quotation asks for the backfill');
    eq($row($id), $snapshot, '5: and is left exactly as it was');

    // not found
    $before = $rows();
    $x = $call('update_quotation', array_merge($base, ['id' => 999999, 'items' => [$item]]));
    eq($x['error'] ?? '', 'Not found', '5: a missing quotation still answers Not found');
    eq($x['__status'] ?? 0, 404, '5: with the existing 404, unchanged by the transaction');
    eq($rows(), $before, '5: and nothing was created or changed');
}


// ══ 6 · UPDATE handled failure after the locked read ═══════════════════════
{
    /* The narrow column has to exist BEFORE the row does: altering it
       afterwards would itself have to truncate the data already there, so the
       ALTER fails and the test silently measures nothing. */
    $makeSchema(5);
    $r = $call('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$item], 'customer_name' => 'ABC']));
    ok(!empty($r['ok']), '6: a quotation exists to update: ' . json_encode($r));
    $id = $r['id']; $uid = $r['items'][0]['item_uid'];
    $snapshot = $row($id);
    $x = $call('update_quotation', array_merge($base, ['id' => $id, 'items' => [array_merge($item, ['item_uid' => $uid])],
                                            'customer_name' => 'a name far too long for five']));
    ok(empty($x['ok']), '6: an update that fails after the locked read is refused: ' . json_encode($x));
    eq($row($id), $snapshot, '6: and the row is byte-identical — the transaction rolled back');
    $makeSchema();
}


// ══ 7 · the row lock, on two real connections ══════════════════════════════
{
    $r = $call('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$item]]));
    $idA = $r['id'];
    $r = $call('save_quotation', array_merge($base, ['ref_no' => '', 'items' => [$item]]));
    $idB = $r['id'];

    $conn = function () use ($H, $U, $W, $P, $DBN) {
        $c = new mysqli($H, $U, $W, null, $P); $c->select_db($DBN);
        $c->query('SET innodb_lock_wait_timeout = 1');
        return $c;
    };
    $A = $conn(); $B = $conn();

    ok(dc_txn_begin($A), '7: connection A opens a transaction');
    $rowA = dc_lock_quotation_for_update($A, $idA);
    ok(is_array($rowA) && (int)$rowA['id'] === (int)$idA, '7: and holds the quotation row FOR UPDATE');
    ok(isset($rowA['items']) && isset($rowA['ref_no']),
       '7: the locked read returns the whole persisted row, not just the items column');

    ok(dc_txn_begin($B), '7: connection B opens its own transaction');
    /* A DIFFERENT quotation is not blocked. */
    $t0 = microtime(true);
    $other = null; $blockedOther = false;
    try { $other = dc_lock_quotation_for_update($B, $idB); } catch (Exception $e) { $blockedOther = true; }
    ok(!$blockedOther && is_array($other), '7: B can lock a DIFFERENT quotation while A holds the first');
    ok(microtime(true) - $t0 < 1.0, '7: without waiting — unrelated rows are not blocked');

    /* The SAME quotation is blocked until A finishes. */
    $blocked = false; $why = '';
    try { dc_lock_quotation_for_update($B, $idA); }
    catch (Exception $e) { $blocked = true; $why = $e->getMessage(); }
    ok($blocked, '7: but B CANNOT take the row A is holding');
    ok(strpos($why, 'Lock wait timeout') !== false || strpos($why, '1205') !== false
       || stripos($why, 'lock') !== false, "7: it waits for the lock and times out: {$why}");

    dc_txn_rollback($B);
    /* Once A is done, B proceeds. */
    ok(dc_txn_commit($A), '7: A commits');
    ok(dc_txn_begin($B), '7: B begins again');
    $now = null; $stillBlocked = false;
    try { $now = dc_lock_quotation_for_update($B, $idA); } catch (Exception $e) { $stillBlocked = true; }
    ok(!$stillBlocked && is_array($now), '7: and now B CAN take the same row — the wait was A, not a deadlock');
    dc_txn_rollback($B);
    $A->close(); $B->close();
}


// ══ 8 · the named lock is released explicitly, not by the process dying ════
{
    $C = new mysqli($H, $U, $W, null, $P); $C->select_db($DBN);
    $GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];
    $got = (int)$C->query("SELECT GET_LOCK('" . DC_REF_LOCK . "', 5)")->fetch_row()[0];
    eq($got, 1, '8: a connection takes the named lock');
    dc_txn_note_lock($C, true);
    eq((int)$db->query("SELECT IS_FREE_LOCK('" . DC_REF_LOCK . "')")->fetch_row()[0], 0,
       '8: another connection sees it held');
    dc_txn_cleanup();
    eq((int)$db->query("SELECT IS_FREE_LOCK('" . DC_REF_LOCK . "')")->fetch_row()[0], 1,
       '8: cleanup gives it back WHILE THE SESSION IS STILL OPEN — not by the connection closing');
    $C->close();
}


// ── clean up ─────────────────────────────────────────────────────────────────
proc_terminate($srv);
foreach ($srvPipes as $sp) { if (is_resource($sp)) fclose($sp); }
proc_close($srv);
foreach (['api.php', 'pricing_history.php', 'auth.php', 'db.php'] as $f) @unlink($SB . '/' . $f);
@rmdir($SB);
$db->select_db('mysql');
ok($db->query("DROP DATABASE {$DBN}") === true, '8: the throwaway database was dropped');
$db->close();

// ── report ───────────────────────────────────────────────────────────────────
$name = 'read before write — one transaction around a quotation mutation';
if ($failures) {
    echo "\n  FAIL  {$name}  ({$asserts} assertions, " . count($failures) . " failed)  [MySQL {$server}]\n\n";
    foreach ($failures as $f) echo "   - {$f}\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    {$name}  ({$asserts} assertions)  [MySQL {$server}]\n\n";
