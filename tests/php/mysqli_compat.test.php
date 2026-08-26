<?php
/**
 * ── PHP 8.1+ mysqli exception compatibility ────────────────────────────────
 *
 * Run:  php tests/php/mysqli_compat.test.php
 *
 * PHP 8.1 changed the DEFAULT mysqli report mode to
 * MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT, so mysqli THROWS where it used to
 * return false. This application checks return values and then errno, and has
 * no try/catch anywhere, so under that default every check is dead code and
 * the accepted 1062 retry never runs.
 *
 * api.php cannot be included here — it requires auth.php and db.php and opens
 * a connection on its first lines — so what is under test is EXTRACTED FROM
 * THE SHIPPED FILE, the same principle save_retry.test.php uses. If the source
 * changes, this test runs the change.
 *
 * The most important assertion in this file is section 4: that
 * dc_save_quotation_insert() still SEES $stmt->errno === 1062, rather than an
 * exception escaping before it can look.
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

$src = file_get_contents(__DIR__ . '/../../api.php');

/* A comment-blanked copy of the same bytes: every comment becomes an equal run
   of spaces, so offsets still line up with $src while prose can no longer
   satisfy a check about code. The comment above the call in api.php
   legitimately contains "getDB()" and "$db->error"; without this, the "nothing
   touches the database before it" assertions below would be testing the
   comment rather than the program. */
$code = $src;
foreach (token_get_all($src) as $t) {
    if (is_array($t) && ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT)) {
        $at = strpos($code, $t[1]);
        if ($at !== false) $code = substr_replace($code, str_repeat(' ', strlen($t[1])), $at, strlen($t[1]));
    }
}

/* Lift one named function out of the shipped file by brace matching. */
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

// ══ 0 · the runtime this ran on ══════════════════════════════════════════════
{
    ok(PHP_VERSION_ID >= 80000, '0: running on PHP 8 or later (this run: ' . PHP_VERSION . ')');
    ok(defined('MYSQLI_REPORT_OFF'), '0: MYSQLI_REPORT_OFF is defined on this runtime');
    eq(MYSQLI_REPORT_OFF, 0, '0: and it is the documented value 0');
    ok(function_exists('mysqli_report'), '0: mysqli_report() exists on this runtime');
}

// ══ 1 · the call is in the shipped file, once, before db.php ════════════════
{
    $call = strpos($code, 'mysqli_report(MYSQLI_REPORT_OFF);');
    ok($call !== false, '1: api.php calls mysqli_report(MYSQLI_REPORT_OFF)');
    eq(substr_count($code, 'mysqli_report('), 1, '1: exactly one such statement — not scattered');

    $reqDb = strpos($code, "require_once 'db.php';");
    ok($reqDb !== false, '1: api.php still requires db.php');
    ok($call < $reqDb, '1: the call runs BEFORE db.php is required, so it covers getDB()');

    $getdb = strpos($code, '$db = getDB();');
    ok($getdb !== false && $call < $getdb, '1: and before getDB() opens the connection');

    /* Nothing may touch mysqli before it. */
    $head = substr($code, 0, $call);
    ok(strpos($head, 'new mysqli') === false, '1: no connection is constructed before it');
    ok(strpos($head, 'getDB()') === false,    '1: getDB() is not called before it');
    ok(strpos($head, '$db->') === false,      '1: no query is issued before it');
    ok(strpos($head, 'db.php') === false,     '1: db.php is not required before it');
    ok(!preg_match('/(if|else)[^\n]{0,80}mysqli_report/', $code),
       '1: and it is not placed inside a conditional');

    /* It must not be smuggled in behind a version test that skips 8.0. */
    ok(!preg_match('/PHP_VERSION_ID[^\n]*\n[^\n]*mysqli_report/', $code),
       '1: it is unconditional — not gated on a PHP version');
}

// ══ 2 · the strategy actually neutralises exception mode on THIS runtime ════
{
    /* Prove the default first, so a pass here cannot be a runtime that never
       threw in the first place. */
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $threw = false;
    try { @new mysqli('127.0.0.1', 'nobody', 'nothing', 'nodb', 3306); }
    catch (\mysqli_sql_exception $e) { $threw = true; }
    ok($threw, '2: with 8.1+ reporting ON, a failed connection throws (baseline proven)');

    /* Now the shipped strategy. */
    $ret = mysqli_report(MYSQLI_REPORT_OFF);
    ok($ret === true, '2: mysqli_report(MYSQLI_REPORT_OFF) is accepted by this runtime');

    $threw = false; $conn = null;
    try { $conn = @new mysqli('127.0.0.1', 'nobody', 'nothing', 'nodb', 3306); }
    catch (\Throwable $e) { $threw = true; }
    ok(!$threw, '2: with it OFF, a failed connection does NOT throw');
    ok(is_object($conn), '2: it returns a mysqli object instead');
    ok(!empty($conn->connect_error), "2: and connect_error is populated, so getDB()'s check runs");
    ok((int)$conn->connect_errno !== 0, '2: connect_errno is populated too');
}

/* Everything below runs with reporting OFF, i.e. the state api.php establishes. */

// ══ 3 · the existing false/errno flow still works ═══════════════════════════
{
    eval(lift($src, 'fail_json'));
    eval(lift($src, 'query_or_fail'));
    eval(lift($src, 'prepare_or_fail'));
    eval(lift($src, 'execute_or_fail'));

    ok(function_exists('query_or_fail'),   '3: query_or_fail lifted from the shipped file');
    ok(function_exists('prepare_or_fail'), '3: prepare_or_fail lifted from the shipped file');
    ok(function_exists('execute_or_fail'), '3: execute_or_fail lifted from the shipped file');

    /* Each still tests a RETURN VALUE — that is the contract this round
       preserves. Asserted against the source so a future rewrite is caught. */
    ok(strpos(lift($src, 'query_or_fail'),   'if (!$res)')   !== false,
       '3: query_or_fail still branches on a false return');
    ok(strpos(lift($src, 'prepare_or_fail'), 'if (!$stmt)')  !== false,
       '3: prepare_or_fail still branches on a false return');
    ok(strpos(lift($src, 'execute_or_fail'), '!$stmt->execute()') !== false,
       '3: execute_or_fail still branches on a false return');

    /* And none of them was converted into a try/catch. */
    foreach (['query_or_fail','prepare_or_fail','execute_or_fail'] as $fn) {
        ok(strpos(lift($src, $fn), 'catch') === false,
           "3: $fn was not redesigned into exception handling");
    }
    ok(!preg_match('/\bcatch\s*\(\s*\\\\?mysqli_sql_exception/', $code),
       '3: api.php catches no mysqli exception anywhere — the contract is return values');

    /* And the JSON contract itself. fail_json() exits, so each helper is driven
       in a CHILD process and judged by what the browser would actually have
       received: a clean JSON body, no exception, no fatal. */
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
eval(lift($src, 'fail_json'));
eval(lift($src, 'query_or_fail'));
eval(lift($src, 'prepare_or_fail'));
eval(lift($src, 'execute_or_fail'));
$db = new class { public $error = 'Table missing';
    public function query($s) { return false; }
    public function prepare($s) { return false; } };
$stmt = new class { public $error = 'Constraint failed';
    public function execute() { return false; } };
switch ($argv[2]) {
    case 'query':   query_or_fail($db, 'SELECT 1', 'Lookup failed'); break;
    case 'prepare': prepare_or_fail($db, 'SELECT 1', 'Prepare failed'); break;
    case 'execute': execute_or_fail($stmt, 'Execute failed'); break;
}
echo 'REACHED_END_WITHOUT_FAILING';
CHILD;
    $tmp = tempnam(sys_get_temp_dir(), 'dcmc') . '.php';
    file_put_contents($tmp, "<?php\n" . $child);
    $api = __DIR__ . '/../../api.php';
    foreach ([['query','Lookup failed: Table missing'],
              ['prepare','Prepare failed: Table missing'],
              ['execute','Execute failed: Constraint failed']] as [$case, $want]) {
        $cmd = escapeshellarg(PHP_BINARY) . ' -d error_reporting=E_ALL -d display_errors=stderr '
             . escapeshellarg($tmp) . ' ' . escapeshellarg($api) . ' ' . escapeshellarg($case) . ' 2>&1';
        $out = shell_exec($cmd);
        $decoded = json_decode(trim($out), true);
        ok(is_array($decoded), "3: $case failure returns parseable JSON, not a fatal (got: " . trim((string)$out) . ')');
        ok(($decoded['ok'] ?? null) === false, "3: $case failure returns ok:false");
        eq($decoded['error'] ?? null, $want, "3: $case failure carries the existing message");
        ok(strpos((string)$out, 'REACHED_END_WITHOUT_FAILING') === false,
           "3: $case really did stop at the failure branch");
        ok(stripos((string)$out, 'Uncaught') === false && stripos((string)$out, 'Fatal') === false,
           "3: $case produced no uncaught exception and no fatal");
    }
    @unlink($tmp);
}

// ══ 4 · THE POINT OF THE ROUND — the 1062 retry still sees errno ════════════
{
    eval(lift($src, 'dc_save_quotation_insert'));
    ok(function_exists('dc_save_quotation_insert'), '4: the shipped retry function lifted');

    /* A statement that behaves the way mysqli behaves with reporting OFF:
       execute() returns false and leaves errno/error to be read. */
    $stmt = new class {
        public $errno = 1062;
        public $error = "Duplicate entry 'Q-2026-0431' for key 'uq_quotations_ref'";
        public $executes = 0;
        public $sent = [];
        public $ref = null;                 // what the caller had bound, by reference
        public function execute() {
            $this->executes++;
            $this->sent[] = $this->ref;
            if ($this->executes === 1) { $this->errno = 1062; return false; }
            $this->errno = 0; return true;
        }
    };
    $ref = 'Q-2026-0431';
    $stmt->ref = &$ref;                     // mirrors bind_param's by-reference bind
    $reallocs = 0;
    $out = dc_save_quotation_insert($stmt, $ref, function () use (&$reallocs) {
        $reallocs++; return 'Q-2026-0432';
    });

    ok($out === true,      '4: a 1062 collision still ends in success');
    eq($stmt->executes, 2, '4: EXACTLY 2 executes');
    eq($reallocs, 1,       '4: EXACTLY 1 reallocation');
    eq($ref, 'Q-2026-0432','4: the caller-visible ref_no is the re-allocated one');
    eq($stmt->sent, ['Q-2026-0431', 'Q-2026-0432'],
       '4: and the NEW number is what the second execute actually sent');

    /* The errno test itself must still be the thing that decides. */
    ok(strpos(lift($src, 'dc_save_quotation_insert'), '1062') !== false,
       '4: the function still decides on errno 1062');
    ok(strpos(lift($src, 'dc_save_quotation_insert'), 'catch') === false,
       '4: and it was not rewritten to catch an exception instead');
}

// ══ 5 · a second 1062 stops; no loop ════════════════════════════════════════
{
    $stmt = new class {
        public $errno = 1062; public $error = 'Duplicate entry'; public $executes = 0;
        public function execute() { $this->executes++; $this->errno = 1062; return false; }
    };
    $ref = 'Q-2026-0431'; $reallocs = 0;
    $out = dc_save_quotation_insert($stmt, $ref, function () use (&$reallocs) {
        $reallocs++; return 'Q-2026-0432';
    });
    ok($out === false,     '5: a second 1062 is a failure, not a third attempt');
    eq($stmt->executes, 2, '5: exactly 2 executes — the retry count is still ONE');
    eq($reallocs, 1,       '5: exactly 1 reallocation');
}

// ══ 6 · non-1062 is never retried, even where a retry would have worked ═════
{
    foreach ([2006 => 'MySQL server has gone away',
              1146 => 'Table does not exist',
              1452 => 'Foreign key constraint fails',
              1406 => 'Data too long for column'] as $errno => $label) {
        $stmt = new class($errno) {
            public $errno; public $error = 'x'; public $executes = 0;
            public function __construct($e) { $this->errno = $e; }
            /* Would SUCCEED on a second attempt — so a pass here means the
               errno guard held, not that a retry happened to fail. */
            public function execute() { $this->executes++; return $this->executes > 1; }
        };
        $ref = 'Q-2026-0431'; $reallocs = 0;
        $out = dc_save_quotation_insert($stmt, $ref, function () use (&$reallocs) {
            $reallocs++; return 'Q-2026-0432';
        });
        ok($out === false,     "6: errno $errno ($label) fails, uncaught by the retry");
        eq($stmt->executes, 1, "6: errno $errno is executed once and not retried");
        eq($reallocs, 0,       "6: errno $errno triggers no reallocation");
        eq($ref, 'Q-2026-0431',"6: errno $errno leaves the ref_no alone");
    }
}

// ══ 7 · CSV — explicit escape, unchanged values, zero deprecations ══════════
{
    eval(lift($src, 'parse_csv_text'));
    eval(lift($src, 'build_csv'));

    /* The arguments are stated in the shipped source. */
    ok(strpos($code, 'str_getcsv($line, \',\', \'"\', "\\\\")') !== false,
       '7: str_getcsv states its $escape');
    eq(substr_count($code, 'fputcsv($fh, $header, \',\', \'"\', "\\\\")'), 1,
       '7: the header fputcsv states its $escape');
    eq(substr_count($code, 'fputcsv($fh, $r, \',\', \'"\', "\\\\")'), 1,
       '7: the row fputcsv states its $escape');
    ok(!preg_match('/(str_getcsv|fputcsv)\([^)]*\)\s*;/', str_replace(
            ["str_getcsv(\$line, ',', '\"', \"\\\\\")",
             "fputcsv(\$fh, \$header, ',', '\"', \"\\\\\")",
             "fputcsv(\$fh, \$r, ',', '\"', \"\\\\\")"], '', $src)),
       '7: no CSV call is left with the implicit default');

    /* Deprecations are counted, not eyeballed. */
    $seen = [];
    set_error_handler(function ($no, $str) use (&$seen) {
        if ($no === E_DEPRECATED || $no === E_USER_DEPRECATED) $seen[] = $str;
        return true;
    });
    $old = error_reporting(E_ALL);

    $cases = [
        'single row'          => [['a','b','c']],
        'multiple rows'       => [['a','b'],['c','d'],['e','f']],
        'quoted commas'       => [['ACME, Sdn Bhd','1,200.50']],
        'quoted double-quote' => [['He said "hello"','x']],
        'empty field'         => [['a','','c']],
        'UTF-8'               => [['吉隆坡 螺栓','M14 × 100','Ø16']],
    ];
    foreach ($cases as $name => $rows) {
        $csv  = build_csv(['h1','h2','h3'], $rows);
        $body = substr($csv, 3);                      // drop the UTF-8 BOM
        $back = parse_csv_text($body);
        array_shift($back);                           // drop the header row
        eq($back, $rows, "7: $name round-trips unchanged through build/parse");
    }

    /* BOM and header still exactly as before. */
    $csv = build_csv(['ref_no','company'], [['Q-2026-0001','ACME']]);
    ok(substr($csv, 0, 3) === "\xEF\xBB\xBF", '7: the UTF-8 BOM is still written');
    ok(strpos($csv, "ref_no,company") !== false,  '7: the header row is unchanged');
    ok(strpos($csv, "Q-2026-0001,ACME") !== false,'7: the data row is unchanged');

    /* Escape semantics themselves are unchanged: a backslash is still the
       escape character, so a field containing one survives the round trip. */
    $round = parse_csv_text(substr(build_csv(['h'], [['back\\slash']]), 3));
    eq($round[1], ['back\\slash'], '7: a backslash in a field still round-trips');

    error_reporting($old);
    restore_error_handler();
    eq($seen, [], '7: ZERO deprecation notices across every CSV case');
}

// ══ 8 · nothing outside the two findings moved ══════════════════════════════
{
    ok(strpos($src, "GET_LOCK") !== false,            '8: GET_LOCK is still there');
    ok(strpos($src, 'function next_free_ref_no($db)') !== false,
       '8: the allocator is untouched');
    ok(strpos($src, "'Q-' . \$year . '-'") !== false || strpos($src, 'Q-') !== false,
       '8: the ref_no format is still Q-YYYY-NNNN');
    ok(strpos($src, "elseif (\$action === 'update_quotation')") !== false,
       '8: update_quotation is still there');
    $upd = substr($src, strpos($src, "elseif (\$action === 'update_quotation')"));
    ok(strpos(substr($upd, 0, 2000), 'dc_save_quotation_insert') === false,
       '8: and update_quotation is still NOT wrapped by the retry');
    ok(strpos($code, 'ALTER TABLE') === false && strpos($code, 'ADD UNIQUE') === false,
       '8: no schema statement was introduced');
}

// ── report ───────────────────────────────────────────────────────────────────
$name = 'mysqli compatibility — PHP 8.1+ reporting, and the retry it would have killed';
if ($failures) {
    echo "\n  FAIL  $name  ($asserts assertions, " . count($failures) . " failed)\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    $name  ($asserts assertions)\n\n";
