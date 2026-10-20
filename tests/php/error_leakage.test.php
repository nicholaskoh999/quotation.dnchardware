<?php
/**
 * ── A database failure says what failed, never how ────────────────────────
 *
 * Run:  php tests/php/error_leakage.test.php
 *
 * The driver's own error text names tables, columns, keys, values and the SQL
 * near the error. None of it may reach the browser. What the browser gets is
 * the label the call site wrote for a person plus a short reference id; the
 * driver text goes to error_log under that same id.
 *
 * Three kinds of evidence:
 *
 *   · the helpers (dc_db_fail, query_or_fail, prepare_or_fail,
 *     execute_or_fail) are LIFTED from the shipped api.php and driven in a
 *     CHILD process, because fail_json() exits — judged by the body the
 *     browser would receive and by the error_log file the child wrote;
 *   · the SHIPPED api.php is COPIED VERBATIM into a sandbox beside a stub
 *     auth.php and a stub db.php, and served by PHP's built-in server, so every
 *     leak site that used to concatenate $db->error / $stmt->error into the
 *     JSON is reached through a real request. The stub getDB() returns a
 *     SCRIPTED FAKE DRIVER — there is no database connection of any kind, real
 *     or local, so this test can never be pointed at production;
 *   · a scan of the comment-blanked source, so a new leak added later is
 *     caught even where no request here reaches it.
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

$ROOT = realpath(__DIR__ . '/../..');
$src  = file_get_contents($ROOT . '/api.php');

/* Comment-blanked copy: api.php's prose legitimately talks about $db->error. */
$code = $src;
foreach (token_get_all($src) as $t) {
    if (is_array($t) && ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT)) {
        $at = strpos($code, $t[1]);
        if ($at !== false) $code = substr_replace($code, str_repeat(' ', strlen($t[1])), $at, strlen($t[1]));
    }
}

function lift($src, $name) {
    $at = strpos($src, "function $name(");
    if ($at === false) return false;
    $open = strpos($src, '{', $at);
    $d = 0;
    for ($i = $open, $n = strlen($src); $i < $n; $i++) {
        if ($src[$i] === '{') $d++;
        elseif ($src[$i] === '}') { $d--; if ($d === 0) break; }
    }
    return substr($src, $at, $i - $at + 1);
}

/* What must never appear in a response body. Each is part of the driver text
   a scenario injects, so finding one means the detail leaked. */
function leak_needles($driverText, $errno) {
    $n = ['SQL syntax', 'Unknown column', "doesn't exist", 'Duplicate entry', 'for key',
          'mysqli', 'errno', 'Lock wait', 'Deadlock', 'field list', 'SELECT ', 'INSERT ', 'UPDATE ',
          'quotation_revisions', 'snapshot_json', 'dcq_prod', 'uq_quotations_ref', 'Data too long'];
    $n[] = $driverText;
    if ($errno) $n[] = (string)$errno;
    return $n;
}
function no_leak($body, $driverText, $errno, $label) {
    foreach (leak_needles($driverText, $errno) as $needle) {
        if ($needle === '') continue;
        /* SQL keywords are matched by case, so a label such as "Could not
           begin the update transaction" is not mistaken for a statement. */
        $hit = preg_match('/^[A-Z]+ $/', $needle) ? strpos($body, $needle) : stripos($body, $needle);
        ok($hit === false, "$label: the response does not carry \"$needle\" (body: $body)");
    }
}

// ══ 1 · the helpers, lifted and driven in a child ════════════════════════════
{
    foreach (['dc_db_fail', 'fail_json', 'dc_txn_cleanup', 'query_or_fail', 'prepare_or_fail', 'execute_or_fail'] as $fn) {
        ok(lift($src, $fn) !== false, "1: $fn is present in the shipped api.php");
    }

    $child = <<<'CHILD'
$src = file_get_contents($argv[1]);
function lift($src, $name) {
    $at = strpos($src, "function $name(");
    $open = strpos($src, '{', $at); $d = 0;
    for ($i = $open, $n = strlen($src); $i < $n; $i++) {
        if ($src[$i] === '{') $d++; elseif ($src[$i] === '}') { $d--; if (!$d) break; }
    }
    return substr($src, $at, $i - $at + 1);
}
ini_set('log_errors', '1');
ini_set('error_log', $argv[3]);
$GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];
$GLOBALS['action'] = 'lifted_test';
foreach (['dc_txn_cleanup','fail_json','dc_db_fail','query_or_fail','prepare_or_fail','execute_or_fail'] as $f)
    eval(lift($src, $f));
$db = new class {
    public $errno = 1146;
    public $error = "Table 'dcq_prod.quotation_revisions' doesn't exist";
    public function query($s) { return false; }
    public function prepare($s) { return false; } };
$stmt = new class {
    public $errno = 1064;
    public $error = "You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near 'SELECT snapshot_json FROM' at line 1";
    public function execute() { return false; } };
switch ($argv[2]) {
    case 'query':   query_or_fail($db, 'SELECT 1', 'Lookup failed'); break;
    case 'prepare': prepare_or_fail($db, 'SELECT 1', 'Prepare failed'); break;
    case 'execute': execute_or_fail($stmt, 'Execute failed'); break;
    case 'detail':  dc_db_fail('Missing database table', 'table default_prices'); break;
}
echo 'REACHED_END_WITHOUT_FAILING';
CHILD;
    $tmp = tempnam(sys_get_temp_dir(), 'dcel') . '.php';
    file_put_contents($tmp, "<?php\n" . $child);
    $cases = [
        ['query',   'Lookup failed',  1146, "Table 'dcq_prod.quotation_revisions' doesn't exist"],
        ['prepare', 'Prepare failed', 1146, "Table 'dcq_prod.quotation_revisions' doesn't exist"],
        ['execute', 'Execute failed', 1064, "You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near 'SELECT snapshot_json FROM' at line 1"],
        ['detail',  'Missing database table', 0, 'table default_prices'],
    ];
    foreach ($cases as [$case, $label, $errno, $driver]) {
        $log = tempnam(sys_get_temp_dir(), 'dcellog');
        file_put_contents($log, '');
        $cmd = escapeshellarg(PHP_BINARY) . ' -d error_reporting=E_ALL -d display_errors=stderr '
             . escapeshellarg($tmp) . ' ' . escapeshellarg($ROOT . '/api.php') . ' '
             . escapeshellarg($case) . ' ' . escapeshellarg($log) . ' 2>&1';
        $out = (string)shell_exec($cmd);
        $j = json_decode(trim($out), true);
        ok(is_array($j), "1: $case — the browser receives parseable JSON (got: " . trim($out) . ')');
        ok(($j['ok'] ?? null) === false, "1: $case — ok:false");
        $err = (string)($j['error'] ?? '');
        ok(preg_match('/^' . preg_quote($label, '/') . ' \(ref ([0-9a-f]{8})\)$/', $err, $m) === 1,
           "1: $case — a useful generic error: the label and a short reference id (got: $err)");
        $ref = $m[1] ?? 'NO-REF';
        ok(strpos($out, 'REACHED_END_WITHOUT_FAILING') === false, "1: $case — stopped at the failure branch");
        no_leak($out, $driver, $errno, "1: $case");
        $written = (string)file_get_contents($log);
        ok(strpos($written, 'ref=' . $ref) !== false, "1: $case — error_log carries the same reference id");
        ok(strpos($written, $driver) !== false, "1: $case — and the full driver detail, for the person fixing it");
        if ($errno) ok(strpos($written, 'errno=' . $errno) !== false, "1: $case — and the errno");
        ok(strpos($written, $label) !== false, "1: $case — and the label the client was shown");
        @unlink($log);
    }
    @unlink($tmp);

    /* Two failures, two ids — a reference that repeated would point at the
       wrong log line. */
    $refs = [];
    for ($k = 0; $k < 2; $k++) {
        $log = tempnam(sys_get_temp_dir(), 'dcellog');
        $tmp = tempnam(sys_get_temp_dir(), 'dcel') . '.php';
        file_put_contents($tmp, "<?php\n" . $child);
        $out = (string)shell_exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($tmp) . ' '
             . escapeshellarg($ROOT . '/api.php') . ' query ' . escapeshellarg($log) . ' 2>&1');
        $j = json_decode(trim($out), true);
        $refs[] = $j['error'] ?? '';
        @unlink($log); @unlink($tmp);
    }
    ok($refs[0] !== $refs[1], '1: each failure gets its own reference id');
}

// ══ 2 · the shipped api.php, run for real against a scripted fake driver ═════
$SB = sys_get_temp_dir() . '/dc-leak-sb-' . getmypid();
@mkdir($SB, 0777, true);
copy($ROOT . '/api.php', $SB . '/api.php');
copy($ROOT . '/pricing_history.php', $SB . '/pricing_history.php');
ok(sha1_file($SB . '/api.php') === sha1_file($ROOT . '/api.php'),
   '2: the sandbox runs a byte-identical copy of the shipped api.php');
file_put_contents($SB . '/auth.php',
    "<?php function dc_require_api_login(){}\n"
  . "function dc_current_user(){ return ['id'=>7,'username'=>'nicholas','display_name'=>'Nicholas Koh']; }\n");

/* The fake driver. Scenario chosen per request by ?scenario=, which api.php
   never reads. Each scenario names ONE operation that fails and the errno and
   driver text it fails with; everything else answers like a healthy server. */
$fakeDb = <<<'FAKE'
<?php
$GLOBALS['DC_SCENARIOS'] = [
  'query_fail'    => ['op'=>'query',   'match'=>'MAX(CAST', 'errno'=>1146,
                      'error'=>"Table 'dcq_prod.quotations' doesn't exist"],
  'prepare_fail'  => ['op'=>'prepare', 'match'=>'WHERE q.id=?', 'errno'=>1054,
                      'error'=>"Unknown column 'q.company_id' in 'on clause'"],
  'execute_fail'  => ['op'=>'execute', 'match'=>'DELETE FROM quotations', 'errno'=>1451,
                      'error'=>"Cannot delete or update a parent row: a foreign key constraint fails (`dcq_prod`.`quotation_revisions`, CONSTRAINT `fk_rev_q` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`))"],
  'save_begin'    => ['op'=>'begin', 'errno'=>2006, 'error'=>'MySQL server has gone away'],
  'save_insert'   => ['op'=>'execute', 'match'=>'INSERT INTO quotations', 'errno'=>1406,
                      'error'=>"Data too long for column 'customer_name' at row 1"],
  'save_revision' => ['op'=>'execute', 'match'=>'INSERT INTO quotation_revisions', 'errno'=>1054,
                      'error'=>"Unknown column 'snapshot_json' in 'field list'"],
  'save_commit'   => ['op'=>'commit', 'errno'=>1213,
                      'error'=>'Deadlock found when trying to get lock; try restarting transaction'],
  'update_begin'  => ['op'=>'begin', 'errno'=>1205,
                      'error'=>'Lock wait timeout exceeded; try restarting transaction'],
  'update_commit' => ['op'=>'commit', 'errno'=>1180,
                      'error'=>'Got error 1 "Operation not permitted" during COMMIT'],
  'table_missing' => ['op'=>'none', 'missing'=>'default_prices', 'errno'=>0, 'error'=>''],
];
const DC_FAKE_ITEMS = '[{"desc":"SAG ROD","size":"M20","qty":4,"finalUnitPrice":5.76,"totalAmount":23.04,"item_uid":"itm_11111111111111111111111111111111"}]';
function dc_fake_sc() { return $GLOBALS['DC_SCENARIOS'][$_GET['scenario'] ?? ''] ?? ['op'=>'none','errno'=>0,'error'=>'']; }
function dc_fake_row() {
    return ['id'=>101,'company_id'=>null,'ref_no'=>'Q-2026-0001','quote_date'=>'2026-10-20','valid_until'=>null,
            'prepared_by'=>'tester','remarks'=>'','customer_name'=>'Alpha Sdn Bhd','customer_phone'=>'',
            'items'=>DC_FAKE_ITEMS,'total_amount'=>'23.04','created_at'=>'2026-10-20 10:00:00','company_name'=>null];
}
function dc_fake_rows($sql) {
    $sc = dc_fake_sc();
    if (stripos($sql, 'GET_LOCK') !== false)     return [['l'=>1]];
    if (stripos($sql, 'RELEASE_LOCK') !== false) return [['r'=>1]];
    if (stripos($sql, 'SHOW TABLES') !== false)
        return (isset($sc['missing']) && strpos($sql, $sc['missing']) !== false) ? [] : [['t'=>'x']];
    if (stripos($sql, 'SHOW COLUMNS') !== false) return [['Field'=>'x']];
    if (stripos($sql, 'AS n FROM quotation_revisions') !== false) return [['n'=>1]];
    if (stripos($sql, 'COUNT(*) AS c') !== false) return [['c'=>0]];
    if (stripos($sql, 'MAX(CAST') !== false)     return [['m'=>0,'max_running'=>0]];
    if (stripos($sql, 'FROM quotations') !== false && stripos($sql, 'id') !== false) return [dc_fake_row()];
    return [];
}
function dc_fake_fails($op, $sql = '') {
    $sc = dc_fake_sc();
    return $sc['op'] === $op && (!isset($sc['match']) || strpos($sql, $sc['match']) !== false);
}
class DcFakeResult {
    public $num_rows; private $rows;
    public function __construct($rows) { $this->rows = $rows; $this->num_rows = count($rows); }
    public function fetch_assoc() { return array_shift($this->rows); }
    public function fetch_row() { $r = array_shift($this->rows); return $r ? array_values($r) : null; }
    public function fetch_all($m = 0) { $r = $this->rows; $this->rows = []; return $r; }
    public function free() {}
}
class DcFakeStmt {
    public $errno = 0; public $error = ''; private $sql;
    public function __construct($sql) { $this->sql = $sql; }
    public function bind_param($types, &...$vars) { return true; }
    public function execute() {
        if (dc_fake_fails('execute', $this->sql)) { $sc = dc_fake_sc(); $this->errno = $sc['errno']; $this->error = $sc['error']; return false; }
        return true;
    }
    public function get_result() { return new DcFakeResult(dc_fake_rows($this->sql)); }
    public function close() { return true; }
}
class DcFakeDb {
    public $errno = 0; public $error = ''; public $insert_id = 101;
    private function failWith() { $sc = dc_fake_sc(); $this->errno = $sc['errno']; $this->error = $sc['error']; return false; }
    public function query($sql) {
        if (dc_fake_fails('query', $sql)) return $this->failWith();
        if (preg_match('/^\s*(SET|UPDATE|INSERT|DELETE)\b/i', $sql)) return true;
        return new DcFakeResult(dc_fake_rows($sql));
    }
    public function prepare($sql) { return dc_fake_fails('prepare', $sql) ? $this->failWith() : new DcFakeStmt($sql); }
    public function begin_transaction() { return dc_fake_fails('begin') ? $this->failWith() : true; }
    public function commit() { return dc_fake_fails('commit') ? $this->failWith() : true; }
    public function rollback() { return true; }
    public function real_escape_string($s) { return addslashes($s); }
    public function set_charset($c) { return true; }
    public function close() { return true; }
}
function getDB() { static $d; return $d ?: ($d = new DcFakeDb()); }
FAKE;
file_put_contents($SB . '/db.php', $fakeDb);

$LOG = $SB . '/php-error.log';
file_put_contents($LOG, '');
$PORT = 35000 + (getmypid() % 900);
$srvPipes = [];
$srv = proc_open([PHP_BINARY, '-d', 'log_errors=1', '-d', 'error_log=' . $LOG,
                  '-d', 'display_errors=1', '-d', 'error_reporting=' . E_ALL,
                  '-S', "127.0.0.1:{$PORT}", '-t', $SB],
                 [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $srvPipes, $SB);
if (!is_resource($srv)) { echo "\n  FAIL  could not start the sandbox web server\n\n"; exit(1); }
register_shutdown_function(function () use (&$srv, &$srvPipes) {
    if (is_resource($srv)) {
        proc_terminate($srv);
        foreach ($srvPipes as $sp) if (is_resource($sp)) fclose($sp);
        proc_close($srv);
        $srv = null;
    }
});
$up = false;
for ($i = 0; $i < 60; $i++) {
    $fp = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 0.3);
    if ($fp) { fclose($fp); $up = true; break; }
    usleep(200000);
}
ok($up, "2: the sandbox web server is listening on 127.0.0.1:{$PORT}");
if (!$up) { proc_terminate($srv); exit(1); }

$call = function ($action, $scenario, $payload = null, $query = '') use ($PORT) {
    $ctx = stream_context_create(['http' => [
        'method'        => $payload === null ? 'GET' : 'POST',
        'header'        => "Content-Type: application/json\r\n",
        'content'       => $payload === null ? '' : json_encode($payload),
        'ignore_errors' => true,
        'timeout'       => 20,
    ]]);
    return (string)@file_get_contents("http://127.0.0.1:{$PORT}/api.php?action=" . rawurlencode($action)
                                      . '&scenario=' . rawurlencode($scenario) . $query, false, $ctx);
};

$item = ['desc' => 'SAG ROD', 'size' => 'M20', 'qty' => 4, 'finalUnitPrice' => 5.76, 'totalAmount' => 23.04];
$base = ['company_id' => null, 'quote_date' => '2026-10-20', 'valid_until' => '', 'prepared_by' => 'tester',
         'remarks' => '', 'customer_name' => 'Alpha Sdn Bhd', 'customer_phone' => '', 'total_amount' => 23.04];
$save   = array_merge($base, ['ref_no' => '', 'items' => [$item]]);
$update = array_merge($base, ['id' => 101, 'items' => [array_merge($item, ['item_uid' => 'itm_11111111111111111111111111111111'])]]);

/* [label, action, scenario, payload, extra query, the label the client must see] */
$sites = [
    ['query_or_fail (get_next_ref)',               'get_next_ref',       'query_fail',    null,    '',        'Next reference lookup failed'],
    ['prepare_or_fail (get_quotation)',            'get_quotation',      'prepare_fail',  null,    '&id=101', 'Quotation load prepare failed'],
    ['execute_or_fail (delete_quotation)',         'delete_quotation',   'execute_fail',  ['id' => 101], '',  'Quotation delete failed'],
    ['save: BEGIN refused',                        'save_quotation',     'save_begin',    $save,   '',        'Could not begin the save transaction'],
    ['save: INSERT refused',                       'save_quotation',     'save_insert',   $save,   '',        'Quotation save failed'],
    ['save: revision INSERT refused',              'save_quotation',     'save_revision', $save,   '',        'Revision write failed'],
    ['save: COMMIT refused',                       'save_quotation',     'save_commit',   $save,   '',        'Quotation save could not be committed'],
    ['update: BEGIN refused',                      'update_quotation',   'update_begin',  $update, '',        'Could not begin the update transaction'],
    ['update: COMMIT refused',                     'update_quotation',   'update_commit', $update, '',        'Quotation update could not be committed'],
    ['require_table (get_default_prices)',         'get_default_prices', 'table_missing', null,    '',        'Missing database table. Import database-safe-patch.sql in phpMyAdmin'],
];
$fakeSrc = $fakeDb;
foreach ($sites as [$label, $action, $scenario, $payload, $q, $want]) {
    preg_match("/'" . preg_quote($scenario, '/') . "'\s*=>\s*\[(.*?)\],\n/s", $fakeSrc, $mm);
    preg_match("/'errno'=>(\d+)/", $mm[1] ?? '', $me);
    preg_match("/'error'=>(['\"])(.*?)\\1\s*$/s", $mm[1] ?? '', $mt);
    $errno  = (int)($me[1] ?? 0);
    $driver = $mt[2] ?? '';
    if ($scenario === 'table_missing') $driver = 'table default_prices';

    $before = strlen((string)file_get_contents($LOG));
    $body = $call($action, $scenario, $payload, $q);
    clearstatcache();
    $logNew = substr((string)file_get_contents($LOG), $before);

    $j = json_decode($body, true);
    ok(is_array($j), "2: $label — the browser receives clean JSON, no warning or notice (got: " . substr($body, 0, 300) . ')');
    ok(($j['ok'] ?? null) === false, "2: $label — ok:false");
    $err = (string)($j['error'] ?? '');
    ok(preg_match('/^' . preg_quote($want, '/') . ' \(ref ([0-9a-f]{8})\)$/', $err, $m) === 1,
       "2: $label — the generic error is \"$want (ref …)\" (got: $err)");
    eq(array_keys($j ?: []), ['ok', 'error'], "2: $label — the response shape is unchanged");
    no_leak($body, $driver, $errno, "2: $label");
    $ref = $m[1] ?? 'NO-REF';
    ok(strpos($logNew, 'ref=' . $ref) !== false, "2: $label — error_log has the same reference id");
    ok($driver !== '' && strpos($logNew, $driver) !== false, "2: $label — and the driver detail (log: " . trim($logNew) . ')');
    if ($errno) ok(strpos($logNew, 'errno=' . $errno) !== false, "2: $label — and errno $errno");
    ok(strpos($logNew, 'action=' . $action) !== false, "2: $label — and the action");
}

/* A request that does not fail is untouched by any of this. */
{
    $raw = $call('get_next_ref', 'healthy');
    $j = json_decode($raw, true);
    ok(!empty($j['ok']) && preg_match('/^Q-\d{4}-0001$/', $j['ref_no'] ?? ''), '2: a healthy request still succeeds: ' . $raw);
}

proc_terminate($srv);
foreach ($srvPipes as $sp) if (is_resource($sp)) fclose($sp);
proc_close($srv); $srv = null;
foreach (['api.php', 'pricing_history.php', 'auth.php', 'db.php', 'php-error.log'] as $f) @unlink($SB . '/' . $f);
@rmdir($SB);

// ══ 3 · the source: no driver text is built into a response ══════════════════
{
    /* Every read of ->error / ->connect_error in the program is inside
       dc_db_fail(), which writes it to error_log only. */
    $helper = lift($code, 'dc_db_fail');
    $rest   = str_replace($helper, '', $code);
    ok(!preg_match('/->(error|connect_error)\b/', $rest),
       '3: api.php reads driver error text nowhere but dc_db_fail()');
    ok(!preg_match('/getMessage\s*\(/', $code), '3: and no exception message is echoed anywhere');
    ok(!preg_match('/fail_json\([^;]*->(error|errno)/', $code), '3: no fail_json() call is given driver text');
    ok(!preg_match('/json_encode\([^;]*->(error|errno)/', $code), '3: no json_encode() is given driver text');
    ok(strpos($helper, 'error_log(') !== false, '3: dc_db_fail() writes the diagnostic to error_log');
    ok(preg_match("/fail_json\(\\\$label \. ' \(ref ' \. \\\$ref \. '\)'\)/", $helper) === 1,
       '3: and answers the browser with the label and the reference only');
    ok(strpos($helper, 'catch') === false && strpos($helper, 'throw') === false,
       '3: dc_db_fail() stays on the return-value contract — nothing thrown or caught');
    /* The PHP 8.4 contract is untouched. */
    ok(preg_match('/^mysqli_report\(MYSQLI_REPORT_OFF\);\s*$/m', $code) === 1, '3: mysqli_report(MYSQLI_REPORT_OFF) is still set');
    ok(strpos($code, 'mysqli_report(MYSQLI_REPORT_OFF)') < strpos($code, "require_once 'db.php'"),
       '3: and still before db.php is required');
    foreach (['query_or_fail' => 'if (!$res)', 'prepare_or_fail' => 'if (!$stmt)', 'execute_or_fail' => '!$stmt->execute()'] as $fn => $branch) {
        ok(strpos(lift($src, $fn), $branch) !== false, "3: $fn still branches on a false return");
    }
}

echo "\n";
if ($failures) {
    echo "  FAIL  error leakage — the browser is told what failed, never how  ({$asserts} assertions, "
       . count($failures) . " failed)\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n";
    exit(1);
}
echo "  ok    error leakage — the browser is told what failed, never how  ({$asserts} assertions)\n\n";
