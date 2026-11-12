<?php
ob_start();   /* BEFORE any output: sessions refuse to start once output exists. */
/**
 * ── Return to the page that asked for a sign-in (Open in QUO) ───────────────
 *
 * Run:  php tests/php/return_to.test.php
 *
 * DNC Quick Quote opens companies.php?openId=<id>. Signed out, the login gate
 * sends the browser to login.php?next=… (a password sign-in returns there, as
 * before) and now also remembers that page in THIS session, so a DNC Workspace
 * sign-in — whose callback always lands on home (contract v2 §6.1) — is sent
 * on to it once by home. No database.
 *
 *   A  dc_return_path(): the allow-list, and every open-redirect shape refused
 *   B  dc_return_carry(): fresh, allow-listed values only
 *   C  wiring: gate, login.php, callback (Location unchanged), index.php
 *   R  over real HTTP, direct and mounted: gate remembers, home returns once
 */

error_reporting(E_ALL);
$ROOT = dirname(__DIR__, 2);

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true)
                                   . "\n      actual:   " . var_export($actual, true));
}

$SESS = sys_get_temp_dir() . '/dc-return-sess-' . getmypid();
$SB   = sys_get_temp_dir() . '/dc-return-sb-' . getmypid();
@mkdir($SESS, 0700, true);
session_save_path($SESS);
register_shutdown_function(function () use ($SESS, $SB) {
    foreach ([$SESS, $SB] as $dir) {
        if (!is_dir($dir)) continue;
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
                                            RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($it as $f) $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
        @rmdir($dir);
    }
});

require_once $ROOT . '/dnc_handoff.php';   // loads auth.php too

$mount  = function () { $_SERVER['SCRIPT_NAME'] = '/quo/index.php'; };
$direct = function () { $_SERVER['SCRIPT_NAME'] = '/index.php'; };

// ══ A · sanitizer ═════════════════════════════════════════════════════════
$direct();
eq([dc_return_path('/companies.php?openId=123'), dc_return_path('/index.php'), dc_return_path('/companies.php?openId=9999999999')],
   ['/companies.php?openId=123', '/index.php', '/companies.php?openId=9999999999'], 'A: direct allow-list');
$bad = [
    '', 'companies.php?openId=1', '/companies.php', '/companies.php?openId=', '/companies.php?openId=0', '/companies.php?openId=01',
    '/companies.php?openId=12a', '/companies.php?openId=-1', '/companies.php?openId=1&x=2', '/companies.php?open=Q1',
    '/companies.php?openId=12345678901', '/companies.php?openId=1#x', '/', '/admin', '/api.php', '/login.php',
    'https://evil.example/companies.php?openId=1', '//evil.example/companies.php?openId=1', '/\\evil.example',
    '\\\\evil.example\\companies.php?openId=1', '/%2F%2Fevil.example', '/companies.php?openId=%31', '/companies%2Ephp?openId=1',
    "/companies.php?openId=1\r\nLocation: https://evil.example", "/companies.php?openId=1\n", '/javascript:alert(1)',
    'javascript:alert(1)', 'data:text/html,x', '/companies.php?openId=1 ', '/./companies.php?openId=1', '/x/../companies.php?openId=1',
    '/quo/companies.php?openId=1', '/companies.php/?openId=1', '/COMPANIES.PHP?openId=1', '/companies.php?openid=1',
    str_repeat('/', 300), ['x'], null, 123,
];
foreach ($bad as $b) eq(dc_return_path($b), null, 'A: direct refuses ' . json_encode($b));
$mount();
eq([dc_return_path('/quo/companies.php?openId=7'), dc_return_path('/quo/index.php')], ['/companies.php?openId=7', '/index.php'],
   'A: mounted allow-list (returned without the base)');
foreach (['/companies.php?openId=7', '/quo', '/quo/', '/quotation/companies.php?openId=7', '/quo//companies.php?openId=7',
          '/quo/../companies.php?openId=7', '/portal/companies.php?openId=7', '/quo/admin'] as $b) {
    eq(dc_return_path($b), null, 'A: mounted refuses ' . json_encode($b));
}

// ══ B · carry across the handoff session reset ════════════════════════════
$direct(); $now = 1800000000;
eq(dc_return_carry(['dc_return_to' => ['path' => '/companies.php?openId=5', 'at' => $now - 60]], $now),
   ['path' => '/companies.php?openId=5', 'at' => $now], 'B: a fresh remembered page is carried, re-stamped');
eq(dc_return_carry([], $now), null, 'B: nothing remembered → null');
eq(dc_return_carry(['dc_return_to' => ['path' => '/companies.php?openId=5', 'at' => $now - DC_RETURN_TTL - 1]], $now), null, 'B: stale → null');
eq(dc_return_carry(['dc_return_to' => ['path' => '/companies.php?openId=5', 'at' => $now + 5]], $now), null, 'B: future-dated → null');
eq(dc_return_carry(['dc_return_to' => ['path' => '/index.php', 'at' => $now]], $now), null, 'B: home is not a return');
foreach (['//evil.example', 'https://evil.example', '/admin', '/companies.php?openId=5&x=1', "/companies.php?openId=5\r\n"] as $p) {
    eq(dc_return_carry(['dc_return_to' => ['path' => $p, 'at' => $now]], $now), null, 'B: a tampered value is dropped: ' . json_encode($p));
}
eq(dc_return_carry(['dc_return_to' => '/companies.php?openId=5'], $now), null, 'B: a non-array value → null');
eq(dc_return_carry(['dc_return_to' => ['path' => '/companies.php?openId=5', 'at' => (string)$now]], $now), null, 'B: a non-int time → null');

// ══ C · wiring ════════════════════════════════════════════════════════════
$auth = file_get_contents("$ROOT/auth.php");
ok(strpos($auth, "dc_return_remember(\$next);\n    header('Location: login.php?next=' . rawurlencode(\$next), true, 302);") !== false,
   'C: the login gate remembers, and still redirects to login.php?next= exactly as before');
$login = file_get_contents("$ROOT/login.php");
ok(strpos($login, "unset(\$_SESSION['dc_return_to']);") !== false, 'C: a password sign-in forgets it (next= already returns)');
$h = file_get_contents("$ROOT/dnc_handoff.php");
ok(strpos($h, '$return    = dc_return_carry($_SESSION, $now);') !== false
   && strpos($h, "if (\$return !== null) \$_SESSION['dc_return_after_handoff'] = \$return;") !== false,
   'C: the callback carries the remembered page across its session reset');
ok(strpos($h, "    // 10\n    return dc_handoff_response(303, dc_url(DC_HANDOFF_HOME));") !== false,
   'C: the callback Location is still the fixed home (contract v2 §6.1)');
ok(preg_match('/session_regenerate_id\(true\);\s*\$_SESSION\[\'dc_auth\'\]\s*= true;/', $h) === 1, 'C: callback still regenerates the session id');
eq(substr_count($h, '$_GET['), 1, 'C: the callback still reads only token from the query');
ok(strpos(file_get_contents("$ROOT/index.php"), "<?php require_once __DIR__ . '/auth.php'; dc_require_login(); dc_return_after_handoff(); ?>") === 0,
   'C: home sends on, after the login gate, before any output');
ok(strpos(file_get_contents("$ROOT/companies.php"), 'dc_return_after_handoff') === false, 'C: only home consumes it');

// ══ R · real HTTP ═════════════════════════════════════════════════════════
$files = ['auth.php', 'dnc_handoff.php', 'handoff.php', 'login.php', 'logout.php', 'index.php', 'companies.php',
          'app/Handoff/Contract/HandoffToken.php', 'app/Handoff/Contract/InvalidHandoffToken.php'];
foreach (['', '/quo'] as $base) {
    @mkdir("$SB$base/app/Handoff/Contract", 0777, true);
    foreach ($files as $f) copy("$ROOT/$f", "$SB$base/$f");
    file_put_contents("$SB$base/dnc_config.php", "<?php return ['DNC_HANDOFF_ENABLED' => 'false'];");
}
$PORT = 38000 + (getmypid() % 900);
$srvPipes = [];
$srv = proc_open([PHP_BINARY, '-d', 'display_errors=0', '-d', "session.save_path=$SESS", '-S', "127.0.0.1:{$PORT}", '-t', $SB],
                 [1 => ['file', "$SB/server-out.log", 'a'], 2 => ['file', "$SB/server-err.log", 'a']], $srvPipes, $SB);
register_shutdown_function(function () use (&$srv) { if (is_resource($srv)) { proc_terminate($srv); proc_close($srv); } });
$up = false;
for ($i = 0; $i < 60 && !$up; $i++) { $fp = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 0.3); if ($fp) { fclose($fp); $up = true; } else usleep(200000); }
ok($up, "R: the sandbox server is listening on 127.0.0.1:{$PORT}");

function http($path, ?string $cookie = null) {
    global $PORT;
    $s = fsockopen('127.0.0.1', $PORT, $en, $es, 5);
    fwrite($s, "GET $path HTTP/1.1\r\nHost: portal.dnchardware.com\r\nConnection: close\r\nX-Forwarded-Proto: https\r\n"
             . ($cookie ? "Cookie: $cookie\r\n" : '') . "\r\n");
    $raw = ''; while (!feof($s)) $raw .= fread($s, 65536);
    fclose($s);
    [$head] = explode("\r\n\r\n", $raw, 2);
    $lines = explode("\r\n", $head);
    preg_match('#^HTTP/\S+ (\d+)#', array_shift($lines), $m);
    $h = []; $cookies = [];
    foreach ($lines as $l) {
        [$k, $v] = array_pad(explode(':', $l, 2), 2, '');
        $k = strtolower(trim($k)); $v = trim($v);
        if ($k === 'set-cookie') $cookies[] = explode(';', $v)[0]; else $h[$k] = $v;
    }
    return ['status' => (int)($m[1] ?? 0), 'h' => $h, 'cookies' => $cookies];
}
/** The server-side session data behind a cookie "name=id". */
function sess_data($cookie) {
    global $SESS;
    $id = explode('=', (string)$cookie, 2)[1] ?? '';
    $raw = @file_get_contents("$SESS/sess_$id");
    if ($raw === false) return null;
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    session_id($id); session_start(['read_and_close' => true]);
    $d = $_SESSION; $_SESSION = [];
    return $d;
}
/** Write a signed-in (app_users shape) session file, as a completed sign-in leaves it. */
function sess_make(array $extra) {
    global $SESS;
    $id = bin2hex(random_bytes(16));
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    session_id($id); session_start();
    $_SESSION = ['dc_auth' => true, 'dc_user_id' => 1, 'dc_username' => 'tester', 'dc_display_name' => 'Tester',
                 'dc_login_time' => time(), 'dc_user' => 'tester'] + $extra;
    session_write_close();
    $_SESSION = [];
    return '__Host-DCQUOSESS=' . $id;
}

if ($up) {
    foreach (['' => 'direct', '/quo' => 'mounted'] as $base => $label) {
        /* Signed out: the gate is unchanged on the wire, and remembers the page. */
        $r = http("$base/companies.php?openId=42");
        eq([$r['status'], $r['h']['location'] ?? null], [302, 'login.php?next=' . rawurlencode("$base/companies.php?openId=42")],
           "R/$label: signed out, companies.php?openId=42 → login with next (unchanged)");
        $d = sess_data($r['cookies'][0] ?? '');
        eq($d['dc_return_to']['path'] ?? null, '/companies.php?openId=42', "R/$label: the gate remembered /companies.php?openId=42");

        $r2 = http("$base/companies.php?openId=42%2F%2Fevil", $r['cookies'][0] ?? null);
        eq((sess_data($r['cookies'][0] ?? '') ?? [])['dc_return_to'] ?? null, null, "R/$label: a non-allow-listed page replaces it with nothing");
        $r3 = http("$base/index.php");
        eq(sess_data($r3['cookies'][0] ?? '')['dc_return_to'] ?? 'absent', 'absent', "R/$label: home is never remembered");

        /* After a handoff sign-in: home sends on exactly once. */
        $ck = sess_make(['dc_return_after_handoff' => ['path' => '/companies.php?openId=42', 'at' => time()]]);
        $h1 = http("$base/index.php", $ck);
        eq([$h1['status'], $h1['h']['location'] ?? null], [303, "$base/companies.php?openId=42"], "R/$label: home → the remembered page (303)");
        $h2 = http("$base/index.php", $ck);
        eq($h2['status'], 200, "R/$label: one time only — home renders on the next visit");

        $ck = sess_make(['dc_return_after_handoff' => ['path' => '//evil.example', 'at' => time()]]);
        eq(http("$base/index.php", $ck)['status'], 200, "R/$label: a tampered value is never followed");
        $ck = sess_make(['dc_return_after_handoff' => ['path' => '/companies.php?openId=42', 'at' => time() - 600]]);
        eq(http("$base/index.php", $ck)['status'], 200, "R/$label: an old value is not followed");
        $ck = sess_make([]);
        eq(http("$base/index.php", $ck)['status'], 200, "R/$label: an ordinary signed-in home is unchanged");
    }
}

// ══ report ════════════════════════════════════════════════════════════════
while (ob_get_level() > 0) ob_end_flush();
foreach ($failures as $f) echo "  FAIL  $f\n";
echo "\n  return-to: $asserts assertions, " . count($failures) . " failed\n";
exit($failures ? 1 : 0);
