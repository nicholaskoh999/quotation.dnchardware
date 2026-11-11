<?php
/**
 * ── quotation_store.php against a real MySQL — numbering, retry, rollback,
 *    idempotency, parallel submits, and the migration ──────────────────────
 *
 * Run:
 *   DC_TEST_DB_HOST=127.0.0.1 DC_TEST_DB_PORT=33181 DC_TEST_DB_USER=root DC_TEST_DB_PASS= \
 *     php tests/php/quotation_store_db.test.php
 *
 * Without DC_TEST_DB_HOST and DC_TEST_DB_PORT this suite is SKIPPED: it prints
 * "SKIP", runs nothing and exits 0. A skip is not a pass.
 *
 * Use a THROWAWAY server. The suite creates one database named
 * dc_qstore_test_<pid>, refuses to reuse an existing one, and drops it at the
 * end. Synthetic data only.
 *
 * The store is driven through tests/php/quotation_store/harness.php (a
 * test-only host whose fail_json()/dc_db_fail() throw after unwinding, as
 * api.php's do before they echo). Parallel cases run in separate PHP
 * processes — two real MySQL sessions — via quotation_store/create_child.php.
 */

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($a, $e, $msg) {
    ok($a === $e, $msg . "\n      expected: " . var_export($e, true) . "\n      actual:   " . var_export($a, true));
}
$label = 'quotation store — numbering, retry, rollback, idempotency, parallel, migration';

if (!getenv('DC_TEST_DB_HOST') || !getenv('DC_TEST_DB_PORT')) {
    echo "\n  SKIP  $label\n\n";
    echo "   - NOT RUN: DC_TEST_DB_HOST and DC_TEST_DB_PORT are not set.\n";
    echo "   - This is a skip, not a pass. See the header of this file for the command.\n\n";
    exit(0);
}

$ROOT = dirname(__DIR__, 2);
require __DIR__ . '/quotation_store/harness.php';

$admin = dc_test_connect(null);
if (!$admin) { echo "\n  FAIL  $label — no MySQL at " . getenv('DC_TEST_DB_HOST') . ':' . getenv('DC_TEST_DB_PORT') . "\n\n"; exit(1); }
$server = $admin->query('SELECT VERSION()')->fetch_row()[0];
$DBN = 'dc_qstore_test_' . getmypid();
$ex = $admin->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$DBN}'");
if ($ex && $ex->num_rows) { echo "\n  FAIL  {$DBN} already exists — refusing to reuse it.\n\n"; exit(1); }
$admin->query("CREATE DATABASE {$DBN} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
register_shutdown_function(function () use ($admin, $DBN) { @$admin->query("DROP DATABASE IF EXISTS {$DBN}"); });

$db = dc_test_connect($DBN);
$db->query('SET SESSION information_schema_stats_expiry = 0');

$MIG_REV = file_get_contents("$ROOT/migrations/2026-08-28-create-quotation-revisions.sql");
$MIG_FWD = file_get_contents("$ROOT/migrations/2026-11-11-create-quotation-create-requests.sql");
$MIG_RBK = file_get_contents("$ROOT/migrations/2026-11-11-create-quotation-create-requests.rollback.sql");

/* Run a whole SQL script the way a person pastes it: statement after
   statement, stopping at the first error. Returns [ok, errno]. */
function run_script($db, $sql) {
    if (!$db->multi_query($sql)) return [false, (int)$db->errno];
    do {
        if ($r = $db->store_result()) $r->free();
        if ($db->errno) return [false, (int)$db->errno];
        if (!$db->more_results()) break;
        if (!$db->next_result()) return [false, (int)$db->errno];
    } while (true);
    return [true, 0];
}
function one($db, $q) { $r = $db->query($q); return $r ? ($r->fetch_row()[0] ?? null) : null; }
function rows($db, $q) { $r = $db->query($q); $o = []; while ($r && ($x = $r->fetch_assoc())) $o[] = $x; return $o; }
function table_exists_t($db, $t) { return (int)one($db, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='{$t}'") === 1; }

/* The base schema: the shapes the existing suites use for companies and
   quotations, and quotation_revisions from its SHIPPED migration. */
$db->query("CREATE TABLE companies (id INT NOT NULL AUTO_INCREMENT, name VARCHAR(200) NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB");
$db->query("CREATE TABLE quotations (
    id INT NOT NULL AUTO_INCREMENT, company_id INT NULL,
    ref_no VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    quote_date DATE NULL, valid_until DATE NULL, prepared_by VARCHAR(100) NULL, remarks TEXT NULL,
    customer_name VARCHAR(200) NULL, customer_phone VARCHAR(50) NULL,
    items LONGTEXT NULL, total_amount DECIMAL(12,2) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uq_quotations_ref (ref_no)) ENGINE=InnoDB");
preg_match('/-- >>> SECTION 2 BEGIN\s*(.*?)\s*-- <<< SECTION 2 END/s', $MIG_REV, $m);
ok(!empty($m[1]) && $db->query($m[1]), 'schema: quotation_revisions from its shipped migration');
$db->query("INSERT INTO companies (name) VALUES ('Synthetic Steel Sdn Bhd')");
$COMPANY = (int)$db->insert_id;

// ══ M · the migration: forward, again, rollback, forward ═══════════════════
{
    ok(!table_exists_t($db, 'quotation_create_requests'), 'M: fresh schema has no request table');
    eq(run_script($db, $MIG_FWD), [true, 0], 'M: forward runs clean on a fresh schema');
    ok(table_exists_t($db, 'quotation_create_requests'), 'M: …and creates the table');
    $shape = rows($db, "SELECT CONCAT(COLUMN_NAME,':',COLUMN_TYPE,':',IS_NULLABLE) c FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='quotation_create_requests' ORDER BY ORDINAL_POSITION");
    eq(count($shape), 14, 'M: fourteen columns');
    $uq = rows($db, "SELECT COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
                     AND TABLE_NAME='quotation_create_requests' AND INDEX_NAME='uq_qcr_actor_key' ORDER BY SEQ_IN_INDEX");
    eq(array_column($uq, 'COLUMN_NAME'), ['actor_user_id', 'idempotency_key'], 'M: UNIQUE (actor_user_id, idempotency_key)');
    eq(array_column($uq, 'NON_UNIQUE'), ['0', '0'], 'M: …and it is unique');
    $ddl1 = rows($db, 'SHOW CREATE TABLE quotation_create_requests')[0]['Create Table'];
    eq(run_script($db, $MIG_FWD), [true, 0], 'M: forward again is a no-op');
    eq(rows($db, 'SHOW CREATE TABLE quotation_create_requests')[0]['Create Table'], $ddl1, 'M: …the table is unchanged');

    $db->query("INSERT INTO quotation_create_requests (source,idempotency_key,payload_sha256,actor_user_id,actor_username)
                VALUES ('qq','00000000-0000-4000-8000-000000000000',REPEAT('a',64),1,'synth')");
    $db->query('SET @qcr_export_verified := NULL');
    eq(run_script($db, $MIG_RBK), [false, 1242], 'M: rollback REFUSES while rows exist and no export is confirmed');
    eq((int)one($db, 'SELECT COUNT(*) FROM quotation_create_requests'), 1, 'M: …and drops nothing');
    $db->query("SET @qcr_export_verified := 'YES'");
    eq(run_script($db, $MIG_RBK), [true, 0], 'M: rollback with the export confirmed drops it');
    $db->query('SET @qcr_export_verified := NULL');
    ok(!table_exists_t($db, 'quotation_create_requests'), 'M: …the table is gone');
    eq((int)one($db, 'SELECT COUNT(*) FROM quotations'), 0, 'M: …and quotations is untouched');

    $db->query('CREATE TABLE quotation_create_requests (id INT NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB');
    eq(run_script($db, $MIG_FWD), [false, 1242], 'M: forward REFUSES an existing table of another shape');
    eq((int)one($db, "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='quotation_create_requests'"),
       1, 'M: …and leaves it exactly as it was');
    $db->query('DROP TABLE quotation_create_requests');
    eq(run_script($db, $MIG_RBK), [false, 1146], 'M: rollback on an absent table stops at its first look (1146), changing nothing');
    eq(run_script($db, $MIG_FWD), [true, 0], 'M: forward again after the rollback');
    eq(rows($db, 'SHOW CREATE TABLE quotation_create_requests')[0]['Create Table'], $ddl1, 'M: …re-creates the identical table');
}

$count = function ($t) use ($db) { return (int)one($db, "SELECT COUNT(*) FROM {$t}"); };
$state = function () use ($count) { return [$count('quotations'), $count('quotation_revisions'), $count('quotation_create_requests')]; };
$autoinc = function () use ($db) {
    return rows($db, "SELECT TABLE_NAME, AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
                      AND TABLE_NAME IN ('quotations','quotation_revisions','quotation_create_requests') ORDER BY TABLE_NAME");
};
$lockFree = function () use ($db) { return (int)one($db, "SELECT IS_FREE_LOCK('" . DC_REF_LOCK . "')") === 1; };
$YEAR = date('Y');
$ACT_A = ['id' => null, 'username' => 'synth.alpha', 'display_name' => 'Synthetic Alpha', 'source' => 'dnc', 'dnc_user_id' => 41];
$ACT_B = ['id' => null, 'username' => 'synth.beta',  'display_name' => 'Synthetic Beta',  'source' => 'dnc', 'dnc_user_id' => 42];
$ACT_STAFF = ['id' => 7, 'username' => 'synth.staff', 'display_name' => 'Synthetic Staff'];
$item = function ($desc, $qty, $price) {
    return ['desc' => $desc, 'size' => 'M12', 'qty' => $qty, 'finalUnitPrice' => $price, 'totalAmount' => round($qty * $price, 2)];
};
$payload = function ($cust, array $items, $ref = '') use ($COMPANY) {
    $t = 0; foreach ($items as $i) $t += $i['totalAmount'];
    return ['company_id' => $COMPANY, 'ref_no' => $ref, 'quote_date' => '2026-11-11', 'valid_until' => '',
            'prepared_by' => 'Synthetic Office', 'remarks' => 'synthetic', 'customer_name' => $cust,
            'customer_phone' => '', 'items' => $items, 'total_amount' => round($t, 2)];
};
$K1 = '11111111-1111-4111-8111-111111111111';
$K2 = '22222222-2222-4222-9222-222222222222';

// ══ 1 · a plain create, no key ═════════════════════════════════════════════
{
    $r = dc_test_create($db, $payload('Plain Co', [$item('SAG ROD', 4, 5.5)]), $ACT_STAFF, null);
    ok($r['ok'] === true, '1: a create without a key succeeds: ' . json_encode($r));
    eq($r['ref_no'], "Q-{$YEAR}-0001", '1: numbered by the existing allocator');
    eq($r['replayed'], false, '1: not a replay');
    eq($state(), [1, 1, 0], '1: one quotation, one revision, and the request table untouched');
    $rev = rows($db, 'SELECT * FROM quotation_revisions')[0];
    eq([$rev['event_type'], (int)$rev['actor_user_id'], $rev['actor_username']], ['create', 7, 'synth.staff'],
       '1: the create revision records the actor that was passed');
    ok($lockFree() && !$GLOBALS['DC_TXN']['active'] && !$GLOBALS['DC_TXN']['lock'], '1: lock released, no transaction left open');
}

// ══ 2 · idempotency: first use, replay, canonical replay, conflict ═════════
$Q1 = null;
{
    $p = $payload('Idem Co', [$item('STUD', 10, 1.25), $item('NUT', 10, 0.2)]);
    $idem = ['key' => $K1, 'source' => 'qq', 'ext_version' => '0.1.0', 'parser_core_sha256' => str_repeat('b', 64),
             'pricing_core_sha256' => str_repeat('c', 64), 'settings_version' => 'ds:2026-11-11', 'wa_contact_id' => 9];
    $r = dc_test_create($db, $p, $ACT_A, $idem);
    ok($r['ok'] === true && $r['replayed'] === false, '2: first use of a key creates: ' . json_encode($r));
    $Q1 = $r;
    eq($state(), [2, 2, 1], '2: quotation + revision + ONE request row');
    $req = rows($db, 'SELECT * FROM quotation_create_requests')[0];
    eq([(int)$req['quotation_id'], $req['ref_no']], [$r['id'], $r['ref_no']], '2: the request row names its quotation');
    eq($req['payload_sha256'], dc_store_payload_sha256($p), '2: and the canonical payload hash');
    eq([$req['source'], $req['idempotency_key'], (int)$req['actor_user_id'], $req['actor_username']],
       ['qq', $K1, 41, 'synth.alpha'], '2: scoped to the canonical user');
    eq([$req['ext_version'], $req['settings_version'], (int)$req['wa_contact_id']], ['0.1.0', 'ds:2026-11-11', 9], '2: provenance kept');
    $rev = rows($db, "SELECT * FROM quotation_revisions WHERE quotation_id={$r['id']}");
    eq(count($rev), 1, '2: exactly one revision');
    eq([$rev[0]['actor_user_id'], $rev[0]['actor_username']], [null, 'synth.alpha'],
       '2: a canonical (Portal) actor is recorded like a handoff session: NULL app_users id, the username');

    $before = [$state(), $autoinc()];
    $r2 = dc_test_create($db, $p, $ACT_A, ['key' => $K1]);
    ok($r2['ok'] === true && $r2['replayed'] === true, '2: same key + same payload replays: ' . json_encode($r2));
    eq([$r2['id'], $r2['ref_no']], [$r['id'], $r['ref_no']], '2: …the SAME quotation (id, ref no)');
    eq(json_encode($r2['items']), json_encode($r['items']), '2: …with its persisted items and their uids');
    eq([$state(), $autoinc()], $before, '2: …and NOTHING was written (row counts and AUTO_INCREMENT unchanged)');

    $shuffled = array_reverse($p, true);
    $shuffled['items'] = array_map(function ($i) { return array_reverse($i, true); }, $p['items']);
    $r3 = dc_test_create($db, $shuffled, $ACT_A, ['key' => $K1]);
    ok($r3['ok'] === true && $r3['replayed'] === true && $r3['id'] === $r['id'], '2: key order in the JSON does not matter (canonical hash)');

    $changed = $p; $changed['items'][0]['qty'] = 11; $changed['items'][0]['totalAmount'] = 13.75; $changed['total_amount'] = 15.75;
    $r4 = dc_test_create($db, $changed, $ACT_A, ['key' => $K1]);
    eq([$r4['ok'], $r4['code'] ?? null], [false, 'key_reused_with_different_payload'], '2: same key + different payload is refused');
    eq([$state(), $autoinc()], $before, '2: …and nothing was written');
    $reordered = $p; $reordered['items'] = array_reverse($p['items']);
    eq(dc_test_create($db, $reordered, $ACT_A, ['key' => $K1])['code'] ?? null, 'key_reused_with_different_payload',
       '2: reordering items is a different payload');
    ok($lockFree() && !$GLOBALS['DC_TXN']['active'], '2: every path gave the lock back and closed the transaction');

    $r5 = dc_test_create($db, $p, $ACT_B, ['key' => $K1]);
    ok($r5['ok'] === true && $r5['replayed'] === false && $r5['id'] !== $r['id'],
       '2: ANOTHER user with the same key is independent — a new quotation');
    eq($state(), [3, 3, 2], '2: …with its own request row');

    foreach (['', 'not-a-uuid', 'ABCDEF12-3456-4789-ABCD-EF1234567890', '22222222-2222-1222-9222-222222222222', $K2 . "\n", 42] as $bad) {
        $before = [$state(), $autoinc()];
        $rb = dc_test_create($db, $p, $ACT_A, ['key' => $bad]);
        eq($rb['code'] ?? null, 'idempotency_key_invalid', '2: malformed key refused: ' . json_encode($bad));
        eq([$state(), $autoinc()], $before, '2: …nothing written');
    }
    eq(dc_test_create($db, $p, $ACT_STAFF, ['key' => $K2])['code'] ?? null, 'idempotency_actor_invalid',
       '2: an app_users session without a canonical id cannot use a key');
    eq(dc_test_create($db, $p, null, ['key' => $K2])['code'] ?? null, 'idempotency_actor_invalid', '2: nor can no actor');
    $inval = $payload('Bad', [$item('X', 0, 1)]);
    eq(dc_test_create($db, $inval, $ACT_A, ['key' => $K2])['code'] ?? null, 'validation_failed', '2: validation runs before the key');
    eq($count('quotation_create_requests'), 2, '2: no refusal left a request row');
}

// ══ 3 · a failure before COMMIT leaves nothing ═════════════════════════════
{
    $before = [$state(), $autoinc()];
    $db->query('RENAME TABLE quotation_revisions TO quotation_revisions_away');
    $r = dc_test_create($db, $payload('Fail Co', [$item('WASHER', 3, 0.5)]), $ACT_A, ['key' => $K2]);
    $db->query('RENAME TABLE quotation_revisions_away TO quotation_revisions');
    eq([$r['ok'], $r['code'] ?? null], [false, 'db_failure'], '3: the revision write fails: ' . json_encode($r));
    eq($r['error'] ?? null, 'Revision number prepare failed', '3: …through the existing error channel and label (the revision writer cannot read its table)');
    eq($state(), $before[0], '3: NO quotation, NO revision, NO request row survived');
    eq($r['txn_after'] ?? null, ['active' => false, 'lock' => false], '3: the unwind rolled back and released');
    ok($lockFree(), '3: the numbering lock is free');
    $r2 = dc_test_create($db, $payload('Fail Co', [$item('WASHER', 3, 0.5)]), $ACT_A, ['key' => $K2]);
    ok($r2['ok'] === true && $r2['replayed'] === false, '3: the same key afterwards creates it once, fresh');

    /* A failure in the request-row write itself. */
    $db->query("CREATE TRIGGER t_qcr_fail BEFORE INSERT ON quotation_create_requests FOR EACH ROW
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic request failure'");
    $before = $state();
    $r3 = dc_test_create($db, $payload('Fail Two', [$item('WASHER', 1, 0.5)]), $ACT_A, ['key' => '33333333-3333-4333-a333-333333333333']);
    $db->query('DROP TRIGGER t_qcr_fail');
    eq([$r3['ok'], $r3['error'] ?? null], [false, 'Quotation request record failed'], '3: a failed request-row write fails the create');
    eq($state(), $before, '3: …leaving nothing');
    ok($lockFree(), '3: …and the lock free');

    /* A failure AFTER the quotation and revision are written: the link
       UPDATE. Everything before it must roll back too. */
    $db->query("CREATE TRIGGER t_qcr_link BEFORE UPDATE ON quotation_create_requests FOR EACH ROW
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic link failure'");
    $before = [$state(), $count('quotations')];
    $r4 = dc_test_create($db, $payload('Fail Three', [$item('WASHER', 2, 0.5)]), $ACT_A, ['key' => '44444444-4444-4444-b444-444444444444']);
    $db->query('DROP TRIGGER t_qcr_link');
    eq([$r4['ok'], $r4['error'] ?? null], [false, 'Quotation request link failed'], '3: a failed link fails the create');
    eq([$state(), $count('quotations')], $before, '3: …and the quotation and revision already written are rolled back with it');
}

// ══ 4 · the duplicate-ref retry, inside the one create path ═══════════════
{
    /* A BEFORE INSERT trigger raises 1062 ONCE per session — exactly what an
       out-of-lock writer taking the number would cause. */
    $db->query("CREATE TRIGGER t_q_dup BEFORE INSERT ON quotations FOR EACH ROW
                BEGIN
                  IF @dc_dup_always = 1 OR @dc_dup_once IS NULL THEN
                    SET @dc_dup_once = 1;
                    SIGNAL SQLSTATE '23000' SET MYSQL_ERRNO = 1062, MESSAGE_TEXT = 'synthetic duplicate';
                  END IF;
                END");
    $db->query('SET @dc_dup_once = NULL, @dc_dup_always = 0');
    $next = dc_store_test_next($db);
    $r = dc_test_create($db, $payload('Retry Co', [$item('ROD', 1, 9)], 'CUSTOM-RETRY-1'), $ACT_A,
                        ['key' => '55555555-5555-4555-8555-555555555555']);
    ok($r['ok'] === true, '4: one 1062 is retried and the create succeeds: ' . json_encode($r));
    eq([$r['ref_no'], $r['reassigned']], [$next, true], '4: …with the NEXT FREE number, reported as reassigned');
    eq(rows($db, "SELECT quotation_ref_no FROM quotation_revisions WHERE quotation_id=" . (int)$r['id'])[0]['quotation_ref_no'] ?? null,
       $next, '4: the revision records the reassigned number');
    eq(rows($db, "SELECT ref_no FROM quotation_create_requests WHERE idempotency_key='55555555-5555-4555-8555-555555555555'")[0]['ref_no'] ?? null,
       $next, '4: so does the request row');

    $db->query('SET @dc_dup_always = 1');
    $before = $state();
    $r2 = dc_test_create($db, $payload('Retry Two', [$item('ROD', 1, 9)]), $ACT_A, ['key' => '66666666-6666-4666-8666-666666666666']);
    $db->query('SET @dc_dup_always = 0');
    eq([$r2['ok'], $r2['error'] ?? null], [false, 'Quotation save failed'], '4: a SECOND 1062 is not retried — the save fails as before');
    eq($state(), $before, '4: …and leaves nothing, the request row included');
    $db->query('DROP TRIGGER t_q_dup');
    ok($lockFree(), '4: lock free');
}
function dc_store_test_next($db) { return next_free_ref_no($db); }

// ══ 5 · parallel: the numbering lock serialises creates ════════════════════
$PHP = PHP_BINARY;
$CHILD = __DIR__ . '/quotation_store/create_child.php';
$TMP = sys_get_temp_dir() . '/dc-qstore-' . getmypid();
@mkdir($TMP, 0777, true);
register_shutdown_function(function () use ($TMP) { foreach (glob("$TMP/*") ?: [] as $f) @unlink($f); @rmdir($TMP); });

/* Start N children, wait until every one has connected, then open the
   barrier so they all call the store at once. Returns their results. */
$parallel = function (array $jobs, $holdLockMs = 0) use ($PHP, $CHILD, $TMP, $DBN, $db) {
    static $round = 0; $round++;
    $barrier = "$TMP/go-$round"; $procs = []; $outs = [];
    if ($holdLockMs) one($db, "SELECT GET_LOCK('" . DC_REF_LOCK . "', 5)");
    foreach ($jobs as $i => $job) {
        $jf = "$TMP/job-$round-$i.json"; $of = "$TMP/out-$round-$i.json";
        file_put_contents($jf, json_encode($job)); $outs[$i] = $of;
        $procs[$i] = proc_open([$PHP, $CHILD, $DBN, $jf, $of, $barrier], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        $GLOBALS['dc_pipes'][$round][$i] = $pipes;
    }
    $t = microtime(true);
    while (microtime(true) - $t < 30) {
        $ready = 0; foreach ($outs as $of) if (file_exists("$of.ready")) $ready++;
        if ($ready === count($outs)) break;
        usleep(5000);
    }
    touch($barrier);
    if ($holdLockMs) { usleep($holdLockMs * 1000); one($db, "SELECT RELEASE_LOCK('" . DC_REF_LOCK . "')"); }
    $res = [];
    foreach ($procs as $i => $p) {
        foreach ($GLOBALS['dc_pipes'][$round][$i] as $pp) { stream_get_contents($pp); fclose($pp); }
        proc_close($p);
        $res[$i] = json_decode((string)@file_get_contents($outs[$i]), true);
    }
    return $res;
};

{
    $before = $count('quotations');
    $jobs = [];
    for ($i = 0; $i < 8; $i++) $jobs[] = ['payload' => $payload("Parallel {$i}", [$item('BOLT', $i + 1, 2)]), 'actor' => $ACT_STAFF, 'idem' => null];
    $res = $parallel($jobs);
    $okN = count(array_filter($res, function ($r) { return is_array($r) && $r['ok'] === true; }));
    eq($okN, 8, '5: eight simultaneous creates all succeed: ' . json_encode(array_map(function ($r) { return $r['code'] ?? 'ok'; }, $res)));
    $refs = array_map(function ($r) { return $r['ref_no'] ?? null; }, $res);
    eq(count(array_unique($refs)), 8, '5: …with eight DIFFERENT numbers');
    $nums = array_map(function ($x) { return (int)substr((string)$x, -4); }, $refs); sort($nums);
    eq($nums, range($nums[0], $nums[0] + 7), '5: …consecutive, no gaps and no duplicates');
    eq($count('quotations'), $before + 8, '5: eight rows');
    eq((int)one($db, 'SELECT COUNT(*) FROM (SELECT ref_no FROM quotations GROUP BY ref_no HAVING COUNT(*) > 1) d'), 0,
       '5: no duplicate ref_no anywhere');
    ok($lockFree(), '5: lock free afterwards');
}

// ══ 6 · parallel double submit with the SAME key → one quotation ═══════════
foreach ([[0, 'released together'], [400, 'all queued on the held lock, then released']] as [$hold, $how]) {
    $key = sprintf('%08x-7777-4777-8777-%012x', $hold + 7, $hold + 7);
    $p = $payload("Double {$hold}", [$item('PLATE', 2, 30)]);
    $before = $state();
    $res = $parallel(array_fill(0, 4, ['payload' => $p, 'actor' => $ACT_A, 'idem' => ['key' => $key]]), $hold);
    $okR = array_filter($res, function ($r) { return is_array($r) && $r['ok'] === true; });
    eq(count($okR), 4, "6 ({$how}): all four submits answer ok: " . json_encode($res));
    eq(count(array_unique(array_map(function ($r) { return $r['id']; }, $okR))), 1, "6 ({$how}): …with ONE quotation id");
    eq(count(array_filter($okR, function ($r) { return $r['replayed'] === false; })), 1, "6 ({$how}): exactly one created, three replayed");
    eq($state(), [$before[0] + 1, $before[1] + 1, $before[2] + 1], "6 ({$how}): one quotation, one revision, one request row");
    ok($lockFree(), "6 ({$how}): lock free");
}
{
    /* Same key, two DIFFERENT payloads at once: one wins, the other is
       refused — never two quotations. */
    $key = '88888888-8888-4888-8888-888888888888';
    $before = $state();
    $res = $parallel([['payload' => $payload('Race A', [$item('PIPE', 1, 3)]), 'actor' => $ACT_A, 'idem' => ['key' => $key]],
                      ['payload' => $payload('Race B', [$item('PIPE', 2, 3)]), 'actor' => $ACT_A, 'idem' => ['key' => $key]]]);
    $codes = array_map(function ($r) { return $r['ok'] ? 'ok' : $r['code']; }, $res); sort($codes);
    eq($codes, ['key_reused_with_different_payload', 'ok'], '6: same key, different payloads at once → one created, one refused');
    eq($state(), [$before[0] + 1, $before[1] + 1, $before[2] + 1], '6: …exactly one quotation');
    /* Different users, same key, at once: independent. */
    $key = '99999999-9999-4999-9999-999999999999';
    $before = $state();
    $res = $parallel([['payload' => $payload('Users', [$item('PIPE', 1, 3)]), 'actor' => $ACT_A, 'idem' => ['key' => $key]],
                      ['payload' => $payload('Users', [$item('PIPE', 1, 3)]), 'actor' => $ACT_B, 'idem' => ['key' => $key]]]);
    ok($res[0]['ok'] && $res[1]['ok'] && $res[0]['id'] !== $res[1]['id'] && !$res[0]['replayed'] && !$res[1]['replayed'],
       '6: two users, same key, at once → two independent quotations');
    eq($state(), [$before[0] + 2, $before[1] + 2, $before[2] + 2], '6: …two of everything');
}

// ══ 7 · the backstop: a request row the lock did not see ═══════════════════
{
    /* An existing row is always answered from (here inserted directly, as a
       writer outside DC_REF_LOCK would), never duplicated. */
    $key = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    $p = $payload('Backstop', [$item('ROD', 1, 1)]);
    $db->query("INSERT INTO quotation_create_requests (source,idempotency_key,payload_sha256,actor_user_id,actor_username,quotation_id,ref_no)
                VALUES ('qq','{$key}','" . dc_store_payload_sha256($p) . "',41,'synth.alpha',{$Q1['id']},'{$Q1['ref_no']}')");
    $before = $state();
    $r = dc_test_create($db, $p, $ACT_A, ['key' => $key]);
    ok($r['ok'] && $r['replayed'] && $r['id'] === $Q1['id'], '7: an existing row is always answered from, never duplicated');
    eq($state(), $before, '7: …nothing written');
    $dup = @$db->query("INSERT INTO quotation_create_requests (source,idempotency_key,payload_sha256,actor_user_id,actor_username)
                        VALUES ('quo','{$key}',REPEAT('d',64),41,'synth.alpha')");
    eq([$dup, (int)$db->errno], [false, 1062], '7: the UNIQUE key refuses a second row for the same user and key, whatever the source');
    /* The 1062 fallback: the request INSERT is refused as a duplicate but the
       re-read finds no row (forced by a trigger). It fails closed, writes nothing. */
    $db->query("CREATE TRIGGER t_qcr_dup BEFORE INSERT ON quotation_create_requests FOR EACH ROW
                SIGNAL SQLSTATE '23000' SET MYSQL_ERRNO = 1062, MESSAGE_TEXT = 'synthetic duplicate'");
    $before = $state();
    $r = dc_test_create($db, $payload('Fallback', [$item('ROD', 1, 1)]), $ACT_A, ['key' => 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb']);
    $db->query('DROP TRIGGER t_qcr_dup');
    eq([$r['ok'], $r['error'] ?? null], [false, 'Quotation request record failed'], '7: a duplicate with no row to answer from fails closed');
    eq($state(), $before, '7: …nothing written');
    ok($lockFree() && !$GLOBALS['DC_TXN']['active'], '7: lock free, transaction closed');
}

// ── report ──────────────────────────────────────────────────────────────────
if ($failures) {
    echo "\n  FAIL  $label  ($asserts assertions, " . count($failures) . " failed)  [MySQL $server, PHP " . PHP_VERSION . "]\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n"; exit(1);
}
echo "\n  ok    $label  ($asserts assertions)  [MySQL $server, PHP " . PHP_VERSION . "]\n\n";
