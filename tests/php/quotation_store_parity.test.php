<?php
/**
 * ── save_quotation / update_quotation: production vs. the extracted store ───
 *
 * Run:
 *   DC_TEST_DB_HOST=127.0.0.1 DC_TEST_DB_PORT=33181 DC_TEST_DB_USER=root DC_TEST_DB_PASS= \
 *     php tests/php/quotation_store_parity.test.php
 *
 * Without DC_TEST_DB_HOST and DC_TEST_DB_PORT this suite is SKIPPED: it prints
 * "SKIP", runs nothing and exits 0. A skip is not a pass. It also needs git
 * and the production commit ca5f0a5 (it reads production's api.php and
 * pricing_history.php with `git show`); without them it FAILS.
 *
 * Two sandboxes, each served by `php -S` over real HTTP, each on its own
 * fresh database of the same shape, with the same stub auth.php (a synthetic
 * signed-in staff user — the same stub the existing suites use):
 *
 *     BEFORE  production ca5f0a5 api.php
 *     AFTER   this checkout's api.php + quotation_store.php
 *
 * The same scripted sequence of synthetic creates, refusals and updates runs
 * against both. Every response BODY and HTTP STATUS must be byte-identical
 * once the only two random things are masked: the 8-hex error reference
 * "(ref …)" and each item_uid (replaced by its order of first appearance).
 * Afterwards the two databases must hold identical quotations and revisions
 * (created_at aside, uids masked the same way).
 */

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($a, $e, $msg) {
    ok($a === $e, $msg . "\n      expected: " . var_export($e, true) . "\n      actual:   " . var_export($a, true));
}
$label = 'quotation store parity — production api.php vs the extracted store, byte for byte';

if (!getenv('DC_TEST_DB_HOST') || !getenv('DC_TEST_DB_PORT')) {
    echo "\n  SKIP  $label\n\n";
    echo "   - NOT RUN: DC_TEST_DB_HOST and DC_TEST_DB_PORT are not set.\n";
    echo "   - This is a skip, not a pass. See the header of this file for the command.\n\n";
    exit(0);
}
mysqli_report(MYSQLI_REPORT_OFF);
$ROOT = dirname(__DIR__, 2);
$H = getenv('DC_TEST_DB_HOST'); $P = (int)getenv('DC_TEST_DB_PORT');
$U = getenv('DC_TEST_DB_USER') ?: 'root';
$W = getenv('DC_TEST_DB_PASS'); if ($W === false) $W = '';

$BASE = 'ca5f0a5692adc8614017ec8054f9bd9fbe337d20';
$git = function ($path) use ($ROOT, $BASE) {
    return shell_exec('git -C ' . escapeshellarg($ROOT) . " show {$BASE}:{$path} 2>" . (PHP_OS_FAMILY === 'Windows' ? 'NUL' : '/dev/null'));
};
$prodApi = $git('api.php'); $prodPh = $git('pricing_history.php');
if (!is_string($prodApi) || strlen($prodApi) < 10000 || !is_string($prodPh)) {
    echo "\n  FAIL  $label — production {$BASE} is not readable with git show\n\n"; exit(1);
}
ok(strpos($prodApi, 'quotation_store.php') === false, '0: the BEFORE side really is production (no store include)');

$admin = @new mysqli($H, $U, $W, null, $P);
if (!$admin || $admin->connect_errno) { echo "\n  FAIL  $label — no MySQL at {$H}:{$P}\n\n"; exit(1); }
$server = $admin->query('SELECT VERSION()')->fetch_row()[0];
$MIG = file_get_contents("$ROOT/migrations/2026-08-28-create-quotation-revisions.sql");
preg_match('/-- >>> SECTION 2 BEGIN\s*(.*?)\s*-- <<< SECTION 2 END/s', $MIG, $m2);

$sides = [];
foreach (['before', 'after'] as $i => $side) {
    $dbn = "dc_qparity_{$side}_" . getmypid();
    $ex = $admin->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$dbn}'");
    if ($ex && $ex->num_rows) { echo "\n  FAIL  {$dbn} already exists — refusing to reuse it.\n\n"; exit(1); }
    $admin->query("CREATE DATABASE {$dbn} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
    $db = new mysqli($H, $U, $W, $dbn, $P); $db->set_charset('utf8mb4');
    $db->query("CREATE TABLE companies (id INT NOT NULL AUTO_INCREMENT, name VARCHAR(200) NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB");
    $db->query("CREATE TABLE quotations (
        id INT NOT NULL AUTO_INCREMENT, company_id INT NULL,
        ref_no VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
        quote_date DATE NULL, valid_until DATE NULL, prepared_by VARCHAR(100) NULL, remarks TEXT NULL,
        customer_name VARCHAR(200) NULL, customer_phone VARCHAR(50) NULL,
        items LONGTEXT NULL, total_amount DECIMAL(12,2) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id), UNIQUE KEY uq_quotations_ref (ref_no)) ENGINE=InnoDB");
    $db->query($m2[1]);
    $db->query("INSERT INTO companies (name) VALUES ('Synthetic Steel Sdn Bhd')");

    $sb = sys_get_temp_dir() . "/dc-qparity-{$side}-" . getmypid();
    @mkdir($sb, 0777, true);
    if ($side === 'before') {
        file_put_contents("$sb/api.php", $prodApi);
        file_put_contents("$sb/pricing_history.php", $prodPh);
    } else {
        copy("$ROOT/api.php", "$sb/api.php");
        copy("$ROOT/quotation_store.php", "$sb/quotation_store.php");
        copy("$ROOT/pricing_history.php", "$sb/pricing_history.php");
    }
    file_put_contents("$sb/auth.php",
        "<?php function dc_require_api_login(){} function dc_require_csrf_api(\$json){}\n"
      . "function dc_current_user(){ return ['id'=>7,'username'=>'synth.staff','display_name'=>'Synthetic Staff']; }\n");
    file_put_contents("$sb/db.php",
        "<?php function getDB(){ static \$d; if(!\$d){ \$d = new mysqli('{$H}','{$U}','{$W}',null,{$P}); \$d->select_db('{$dbn}'); } return \$d; }\n");
    $port = 36000 + (getmypid() % 800) * 2 + $i;
    $pipes = [];
    /* The server's request log goes to a file: an unread pipe fills up and
       stalls the server after a few dozen requests. */
    $proc = proc_open([PHP_BINARY, '-S', "127.0.0.1:{$port}", '-t', $sb],
                      [1 => ['file', "$sb/server.log", 'a'], 2 => ['file', "$sb/server.log", 'a']], $pipes, $sb);
    $sides[$side] = ['db' => $db, 'dbn' => $dbn, 'sb' => $sb, 'port' => $port, 'proc' => $proc, 'pipes' => $pipes];
}
register_shutdown_function(function () use (&$sides, $admin) {
    foreach ($sides as $s) {
        if (is_resource($s['proc'])) { proc_terminate($s['proc']); foreach ($s['pipes'] as $p) if (is_resource($p)) fclose($p); proc_close($s['proc']); }
        foreach (['api.php', 'quotation_store.php', 'pricing_history.php', 'auth.php', 'db.php', 'server.log'] as $f) @unlink($s['sb'] . '/' . $f);
        @rmdir($s['sb']);
        @$admin->query("DROP DATABASE IF EXISTS {$s['dbn']}");
    }
});
foreach ($sides as $name => $s) {
    $up = false;
    for ($i = 0; $i < 60 && !$up; $i++) { $fp = @fsockopen('127.0.0.1', $s['port'], $e1, $e2, 0.3); if ($fp) { fclose($fp); $up = true; } else usleep(200000); }
    ok($up, "0: the {$name} sandbox is listening");
    if (!$up) { echo "\n  FAIL  $label — sandbox did not start\n\n"; exit(1); }
}

/* One HTTP call: [status, raw body]. $raw === null sends no body at all. */
function http_call($port, $action, $payload, $raw = null) {
    $body = $raw !== null ? $raw : ($payload === null ? '' : json_encode($payload));
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => "Content-Type: application/json\r\n",
                                             'content' => $body, 'ignore_errors' => true, 'timeout' => 60]]);
    $out = @file_get_contents("http://127.0.0.1:{$port}/api.php?action=" . rawurlencode($action), false, $ctx);
    $status = 0;
    foreach ($http_response_header ?? [] as $h) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $mm)) $status = (int)$mm[1];
    return [$status, (string)$out];
}
/* Mask the error reference and number uids by first appearance. */
function mask($s, array &$uids) {
    $s = preg_replace('/\(ref [0-9a-f]{8}\)/', '(ref ********)', $s);
    return preg_replace_callback('/itm_[0-9a-f]{32}/', function ($m) use (&$uids) {
        if (!isset($uids[$m[0]])) $uids[$m[0]] = 'itm_#' . (count($uids) + 1);
        return $uids[$m[0]];
    }, $s);
}

$it = function ($desc, $qty, $price, array $extra = []) {
    return array_merge(['desc' => $desc, 'size' => 'M16', 'qty' => $qty, 'finalUnitPrice' => $price,
                        'totalAmount' => round($qty * $price, 2)], $extra);
};
$base = ['company_id' => 1, 'quote_date' => '2026-11-11', 'valid_until' => '', 'prepared_by' => 'Synthetic Office',
         'remarks' => 'parity', 'customer_name' => 'Parity Sdn Bhd', 'customer_phone' => '010-0000000'];

/* The script. Each step is a closure over the previous responses of the SAME
   side, so updates use the uids that side issued. */
$script = function ($port, $db) use ($it, $base) {
    $log = []; $r = [];
    $call = function ($tag, $action, $payload, $raw = null) use ($port, &$log, &$r) {
        [$st, $body] = http_call($port, $action, $payload, $raw);
        $log[] = [$tag, $st, $body];
        $r[$tag] = json_decode($body, true);
    };
    $call('c1 create, blank ref', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('SAG ROD', 4, 5.76)], 'total_amount' => 23.04]);
    $call('c2 create, free custom ref', 'save_quotation', $base + ['ref_no' => 'CUSTOM-PARITY-1', 'items' => [$it('STUD', 2, 3.5), $it('NUT', 4, 0.25)], 'total_amount' => 8]);
    $call('c3 create, taken ref → reassigned', 'save_quotation', $base + ['ref_no' => 'CUSTOM-PARITY-1', 'items' => [$it('STUD', 1, 3.5)], 'total_amount' => 3.5]);
    $call('c4 create, previewed number already used', 'save_quotation', $base + ['ref_no' => $r['c1 create, blank ref']['ref_no'] ?? 'x', 'items' => [$it('U-BOLT', 3, 2.1)], 'total_amount' => 6.3]);
    $call('c5 create, client uid discarded', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('J BOLT', 1, 9, ['item_uid' => 'itm_' . str_repeat('ab', 16)])], 'total_amount' => 9]);
    $call('c6 create, accepted price', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('L BOLT', 2, 4, ['priceAcceptance' => ['state' => 'accepted', 'value' => 4, 'source' => 'manual']])], 'total_amount' => 8]);
    $call('c7 create, no company, unicode', 'save_quotation', ['company_id' => 0, 'ref_no' => '', 'customer_name' => "Syarikat Ujian — 测试", 'items' => [$it('WASHER Ø16', 10, 0.1)], 'total_amount' => 1, 'quote_date' => '']);
    $call('v1 no items', 'save_quotation', $base + ['ref_no' => '', 'items' => [], 'total_amount' => 0]);
    $call('v2 qty 0', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('ROD', 0, 1)], 'total_amount' => 0]);
    $call('v3 qty 1.5', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('ROD', 1.5, 1)], 'total_amount' => 1.5]);
    $call('v4 negative price', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('ROD', 1, -1)], 'total_amount' => 0]);
    $call('v5 negative total', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('ROD', 1, 1)], 'total_amount' => -1]);
    $call('v6 bad date', 'save_quotation', $base + ['ref_no' => '', 'quote_date' => '11/11/2026', 'items' => [$it('ROD', 1, 1)], 'total_amount' => 1]);
    $call('v7 price not accepted', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('ROD', 1, 1, ['priceAcceptance' => ['state' => 'suggested']])], 'total_amount' => 1]);
    $call('v8 accepted price differs', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('ROD', 1, 1, ['priceAcceptance' => ['state' => 'accepted', 'value' => 2]])], 'total_amount' => 1]);
    $call('v9 unknown price source', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('ROD', 1, 1, ['priceAcceptance' => ['state' => 'accepted', 'value' => 1, 'source' => 'guess']])], 'total_amount' => 1]);
    $call('v10 item not an object', 'save_quotation', $base + ['ref_no' => '', 'items' => ['ROD'], 'total_amount' => 1]);
    $call('v11 empty body', 'save_quotation', null, '');
    $call('v12 body not JSON', 'save_quotation', null, 'not json');

    $c1 = $r['c1 create, blank ref']; $c2 = $r['c2 create, free custom ref'];
    $items1 = $c1['items'] ?? [];
    $items1[0]['qty'] = 5; $items1[0]['totalAmount'] = 28.8;
    $call('u1 update, changed', 'update_quotation', $base + ['id' => $c1['id'] ?? 0, 'items' => $items1, 'total_amount' => 28.8]);
    $call('u2 update, unchanged (no-op)', 'update_quotation', $base + ['id' => $c1['id'] ?? 0, 'items' => $r['u1 update, changed']['items'] ?? [], 'total_amount' => 28.8]);
    $items2 = $c2['items'] ?? []; $items2 = array_reverse($items2); $items2[] = $it('NEW WASHER', 1, 0.5);
    $call('u3 update, reorder + add', 'update_quotation', $base + ['id' => $c2['id'] ?? 0, 'items' => $items2, 'total_amount' => 8.5]);
    $call('u4 update, unknown uid', 'update_quotation', $base + ['id' => $c1['id'] ?? 0, 'items' => [$it('X', 1, 1, ['item_uid' => 'itm_' . str_repeat('0', 32)])], 'total_amount' => 1]);
    $call('u5 update, malformed uid', 'update_quotation', $base + ['id' => $c1['id'] ?? 0, 'items' => [$it('X', 1, 1, ['item_uid' => 'nope'])], 'total_amount' => 1]);
    $call('u6 update, missing id', 'update_quotation', $base + ['items' => [$it('X', 1, 1)], 'total_amount' => 1]);
    $call('u7 update, not found', 'update_quotation', $base + ['id' => 999999, 'items' => [$it('X', 1, 1)], 'total_amount' => 1]);
    $call('u8 update, validation', 'update_quotation', $base + ['id' => $c1['id'] ?? 0, 'items' => [], 'total_amount' => 1]);

    /* The numbering lock is busy: another session holds it for the whole
       10-second wait. */
    $hold = new mysqli(getenv('DC_TEST_DB_HOST'), getenv('DC_TEST_DB_USER') ?: 'root', getenv('DC_TEST_DB_PASS') ?: '', null, (int)getenv('DC_TEST_DB_PORT'));
    $hold->query("SELECT GET_LOCK('dc_quotation_ref_alloc', 1)");
    $call('b1 lock busy', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('ROD', 1, 1)], 'total_amount' => 1]);
    $hold->query("SELECT RELEASE_LOCK('dc_quotation_ref_alloc')"); $hold->close();

    /* The revision table is missing: the create fails and rolls back. */
    $db->query('RENAME TABLE quotation_revisions TO quotation_revisions_away');
    $call('f1 revision table missing', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('ROD', 1, 1)], 'total_amount' => 1]);
    $call('f2 update, revision table missing', 'update_quotation', $base + ['id' => $c1['id'] ?? 0, 'items' => $r['u1 update, changed']['items'] ?? [], 'total_amount' => 1]);
    $db->query('RENAME TABLE quotation_revisions_away TO quotation_revisions');
    /* A duplicate ref the lock could not see: one retry. */
    $db->query("CREATE TRIGGER t_dup BEFORE INSERT ON quotations FOR EACH ROW
                BEGIN IF NEW.ref_no = 'CUSTOM-RACE' THEN
                  SIGNAL SQLSTATE '23000' SET MYSQL_ERRNO = 1062, MESSAGE_TEXT = 'synthetic duplicate'; END IF; END");
    $call('r1 1062 retried', 'save_quotation', $base + ['ref_no' => 'CUSTOM-RACE', 'items' => [$it('ROD', 2, 2)], 'total_amount' => 4]);
    $db->query('DROP TRIGGER t_dup');
    $call('c8 create after all that', 'save_quotation', $base + ['ref_no' => '', 'items' => [$it('PLATE', 1, 12)], 'total_amount' => 12]);
    return $log;
};

$logs = [];
foreach ($sides as $name => $s) $logs[$name] = $script($s['port'], $s['db']);

eq(count($logs['after']), count($logs['before']), '1: the same number of calls ran on both sides');
$uB = []; $uA = [];
foreach ($logs['before'] as $i => [$tag, $stB, $bodyB]) {
    [, $stA, $bodyA] = $logs['after'][$i];
    ok($bodyB !== '' && json_decode($bodyB, true) !== null, "1: [{$tag}] production answered JSON: " . substr($bodyB, 0, 200));
    eq($stA, $stB, "1: [{$tag}] same HTTP status");
    eq(mask($bodyA, $uA), mask($bodyB, $uB), "1: [{$tag}] byte-identical body");
}
/* The script must have exercised what it claims to. */
$byTag = []; foreach ($logs['after'] as [$tag, $st, $body]) $byTag[$tag] = json_decode($body, true);
ok(($byTag['c3 create, taken ref → reassigned']['reassigned'] ?? null) === true, '1: the reassigned path ran');
ok(($byTag['r1 1062 retried']['reassigned'] ?? null) === true, '1: the 1062 retry path ran');
ok(strpos($byTag['b1 lock busy']['error'] ?? '', 'busy') !== false, '1: the lock-busy path ran');
ok(strpos($byTag['f1 revision table missing']['error'] ?? '', '(ref ') !== false, '1: the database-failure path ran');
ok(($byTag['u7 update, not found']['error'] ?? null) === 'Not found', '1: the update not-found path ran');

/* The databases afterwards. */
$dump = function ($db, array &$uids) {
    $q = []; $r = $db->query('SELECT * FROM quotations ORDER BY id');
    while ($x = $r->fetch_assoc()) { unset($x['created_at']); $q[] = $x; }
    $v = []; $r = $db->query('SELECT * FROM quotation_revisions ORDER BY id');
    while ($x = $r->fetch_assoc()) {
        unset($x['created_at']);
        $s = json_decode($x['snapshot_json'], true); unset($s['quotation']['created_at']);
        $x['snapshot_json'] = json_encode($s);
        $v[] = $x;
    }
    return mask(json_encode([$q, $v]), $uids);
};
$dB = []; $dA = [];
eq($dump($sides['after']['db'], $dA), $dump($sides['before']['db'], $dB),
   '2: quotations and quotation_revisions are identical on both sides afterwards');
eq((int)$sides['after']['db']->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='{$sides['after']['dbn']}'")->fetch_row()[0],
   3, '2: the store created no table (quotation_create_requests is never touched by the browser path)');
$free = (int)$admin->query("SELECT IS_FREE_LOCK('dc_quotation_ref_alloc')")->fetch_row()[0];
eq($free, 1, '2: the numbering lock is free at the end');

if ($failures) {
    echo "\n  FAIL  $label  ($asserts assertions, " . count($failures) . " failed)  [MySQL $server, PHP " . PHP_VERSION . "]\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n"; exit(1);
}
echo "\n  ok    $label  ($asserts assertions)  [MySQL $server, PHP " . PHP_VERSION . "]\n\n";
