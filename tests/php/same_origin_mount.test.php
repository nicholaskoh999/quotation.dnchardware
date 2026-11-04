<?php
ob_start();   /* BEFORE any output: sessions refuse to start once output exists. */
/**
 * ── Same-origin Portal mount: https://portal.dnchardware.com/quo/ ───────────
 *
 * Run:  php tests/php/same_origin_mount.test.php
 *
 * The same files serve https://quo.dnchardware.com/ (base '') and a real
 * directory at https://portal.dnchardware.com/quo/ (base '/quo'). No database.
 *
 *   A  dc_base_path() from SCRIPT_NAME — '' direct, '/quo' mounted, junk → ''
 *   B  dc_url() for /login.php, /index.php, / and the handoff paths
 *   C  dc_app_path(): /quo/auth/handoff/start and /auth/handoff/start are one route
 *   D  redirects — dc_safe_next(), and the handoff home / login targets
 *   E  manifest linked direct, not mounted (dc_page_head_meta)
 *   F  no root-absolute page URL left; relative API calls resolve under /quo
 *   H  CSRF — dc_csrf_refusal(): valid accepted, missing / wrong / GET / cross-site
 *      / text-plain refused; the gate is wired into api.php, ai_extract.php,
 *      login.php and logout.php, and reads stay ungated
 *   I  the handoff callback is not CSRF-gated; mounted /start asks for mount=portal
 *   R  over real HTTP: the shipped files in a sandbox twice — at / and at /quo/ —
 *      handoff routing, redirects, login next, logout, no CORS
 */

error_reporting(E_ALL);
$ROOT = dirname(__DIR__, 2);

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true)
                                   . "\n      actual:   " . var_export($actual, true));
}

$SESS = sys_get_temp_dir() . '/dc-mount-sess-' . getmypid();
$SB   = sys_get_temp_dir() . '/dc-mount-sb-' . getmypid();
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

// ══ A · base path ═════════════════════════════════════════════════════════
$direct();                                       eq(dc_base_path(), '', 'A: /index.php → base ""');
$_SERVER['SCRIPT_NAME'] = '/handoff.php';        eq(dc_base_path(), '', 'A: /handoff.php → base ""');
$mount();                                        eq(dc_base_path(), '/quo', 'A: /quo/index.php → base "/quo"');
$_SERVER['SCRIPT_NAME'] = '/quo/handoff.php';    eq(dc_base_path(), '/quo', 'A: /quo/handoff.php → base "/quo"');
$_SERVER['SCRIPT_NAME'] = '\\index.php';         eq(dc_base_path(), '', 'A: a Windows-style "\\" directory reads as ""');
foreach (['/q uo/index.php', '/../index.php', '/quo/../index.php', "/quo\0/index.php", '//evil/index.php'] as $junk) {
    $_SERVER['SCRIPT_NAME'] = $junk;
    ok(in_array(dc_base_path(), ['', '/quo'], true) && strpos(dc_base_path(), '..') === false && strpos(dc_base_path(), ' ') === false,
       'A: junk SCRIPT_NAME ' . json_encode($junk) . ' never yields an unsafe base (' . json_encode(dc_base_path()) . ')');
}
unset($_SERVER['SCRIPT_NAME']);                   eq(dc_base_path(), '', 'A: no SCRIPT_NAME → base ""');

// ══ B · URL generation ════════════════════════════════════════════════════
$direct();
eq([dc_url('/login.php'), dc_url('/index.php'), dc_url('/'), dc_url('/auth/handoff/start'), dc_url('/auth/handoff/callback')],
   ['/login.php', '/index.php', '/', '/auth/handoff/start', '/auth/handoff/callback'], 'B: direct URLs are unchanged');
$mount();
eq([dc_url('/login.php'), dc_url('/index.php'), dc_url('/'), dc_url('/auth/handoff/start'), dc_url('/auth/handoff/callback')],
   ['/quo/login.php', '/quo/index.php', '/quo/', '/quo/auth/handoff/start', '/quo/auth/handoff/callback'], 'B: mounted URLs carry /quo');

// ══ C · handoff path normalisation ════════════════════════════════════════
$_SERVER['SCRIPT_NAME'] = '/quo/handoff.php';
eq([dc_app_path('/quo/auth/handoff/start'), dc_app_path('/quo/auth/handoff/callback'), dc_app_path('/quo'), dc_app_path('/quo/')],
   ['/auth/handoff/start', '/auth/handoff/callback', '/', '/'], 'C: mounted paths lose the base');
eq([dc_app_path('/quotation/auth/handoff/start'), dc_app_path('/auth/handoff/start')],
   ['/quotation/auth/handoff/start', '/auth/handoff/start'], 'C: a path outside the base is left as it is (and routes nowhere)');
$_SERVER['SCRIPT_NAME'] = '/handoff.php';
eq([dc_app_path('/auth/handoff/start'), dc_app_path('/quo/auth/handoff/start')],
   ['/auth/handoff/start', '/quo/auth/handoff/start'], 'C: direct paths are untouched — /quo/… is not a direct route');

// ══ D · redirects ═════════════════════════════════════════════════════════
$direct();
eq([dc_safe_next(''), dc_safe_next('//evil.example/x'), dc_safe_next('https://evil.example'), dc_safe_next('/companies.php?open=Q1'), dc_safe_next('/admin')],
   ['/index.php', '/index.php', '/index.php', '/companies.php?open=Q1', '/admin'], 'D: direct next — unchanged rules');
$mount();
eq([dc_safe_next(''), dc_safe_next('//evil.example/x'), dc_safe_next('/quo/companies.php?open=Q1'), dc_safe_next('/quo'), dc_safe_next('/quo/'),
    dc_safe_next('/admin'), dc_safe_next('/'), dc_safe_next('/quotation'), dc_safe_next('/quo?x=1')],
   ['/quo/index.php', '/quo/index.php', '/quo/companies.php?open=Q1', '/quo', '/quo/',
    '/quo/index.php', '/quo/index.php', '/quo/index.php', '/quo?x=1'], 'D: mounted next stays inside /quo — never a Portal page');
$direct(); eq([dc_url(DC_HANDOFF_HOME), dc_url(DC_HANDOFF_LOGIN)], ['/', '/login.php'], 'D: direct handoff home / login');
$mount();  eq([dc_url(DC_HANDOFF_HOME), dc_url(DC_HANDOFF_LOGIN)], ['/quo/', '/quo/login.php'], 'D: mounted handoff home / login');
$hsrc = file_get_contents($ROOT . '/dnc_handoff.php');
ok(preg_match_all('/dc_handoff_response\(303, DC_HANDOFF_(HOME|LOGIN)\)/', $hsrc) === 0,
   'D: no handoff redirect uses the bare constant — every one goes through dc_url()');
ok(strpos(file_get_contents($ROOT . '/handoff.php'), "dc_handoff_send(303, '/login.php')") === false,
   'D: handoff.php containment redirect is base-aware');

// ══ E · manifest ══════════════════════════════════════════════════════════
$direct(); $h = dc_page_head_meta();
ok(strpos($h, '<link rel="manifest" href="/manifest.webmanifest">') !== false, 'E: direct — the Quotation manifest is linked');
$mount();  $h = dc_page_head_meta();
ok(strpos($h, 'manifest') === false, 'E: mounted — no manifest (the Portal is the installed app)');
ok(preg_match('#<meta name="dc-csrf" content="[0-9a-f]{64}">#', $h) === 1, 'E: both — the CSRF meta is printed');
foreach (['index.php', 'companies.php'] as $f) {
    $src = file_get_contents("$ROOT/$f");
    ok(strpos($src, '<link rel="manifest"') === false && strpos($src, '<?= dc_page_head_meta()') !== false,
       "E: $f links the manifest only through dc_page_head_meta()");
}

// ══ F · no root-absolute page URL; relative calls resolve under the base ═
foreach (['index.php', 'companies.php', 'login.php', 'logout.php'] as $f) {
    $src = file_get_contents("$ROOT/$f");
    preg_match_all('#(?:href|src|action)=["\'](/(?!/)[^"\']*)#', $src, $m);
    eq($m[1], [], "F: $f has no root-absolute href/src/action");
    preg_match_all('#fetch\(\s*[\'"`]/(?!/)#', $src, $m2);
    eq(count($m2[0]), 0, "F: $f has no root-absolute fetch()");
}
$resolve = function ($page, $rel) { return substr($page, 0, strrpos($page, '/') + 1) . $rel; };   // what a browser does for a bare file name
eq([$resolve('/quo/index.php', 'api.php'), $resolve('/quo/companies.php', 'api.php'), $resolve('/quo/index.php', 'ai_extract.php'),
    $resolve('/quo/index.php', 'assets/icons/dnc-logo.svg'), $resolve('/quo/login.php', 'login.php')],
   ['/quo/api.php', '/quo/api.php', '/quo/ai_extract.php', '/quo/assets/icons/dnc-logo.svg', '/quo/login.php'],
   'F: relative calls from a mounted page stay under /quo');
eq($resolve('/index.php', 'api.php'), '/api.php', 'F: and from a direct page stay at the root');

// ══ H · CSRF ══════════════════════════════════════════════════════════════
$req = function (array $s) {
    foreach (['REQUEST_METHOD', 'CONTENT_TYPE', 'HTTP_SEC_FETCH_SITE'] as $k) unset($_SERVER[$k]);
    foreach ($s as $k => $v) $_SERVER[$k] = $v;
};
$_SESSION = [];
$tok = dc_csrf_token();
ok(preg_match('/^[0-9a-f]{64}$/', $tok) === 1, 'H: the token is 32 random bytes, hex');
eq(dc_csrf_token(), $tok, 'H: stable within the session');
$json = ['REQUEST_METHOD' => 'POST', 'CONTENT_TYPE' => 'application/json'];
$req($json);                                                          eq(dc_csrf_refusal($tok, true), null, 'H: valid token, JSON POST → accepted');
$req($json + ['HTTP_SEC_FETCH_SITE' => 'same-origin']);               eq(dc_csrf_refusal($tok, true), null, 'H: Sec-Fetch-Site same-origin → accepted');
$req(['REQUEST_METHOD' => 'POST', 'CONTENT_TYPE' => 'application/json; charset=UTF-8']); eq(dc_csrf_refusal($tok, true), null, 'H: JSON with a charset → accepted');
$req($json);                                                          eq(dc_csrf_refusal(null, true), 'token', 'H: missing token → refused');
$req($json);                                                          eq(dc_csrf_refusal(str_repeat('0', 64), true), 'token', 'H: wrong token → refused');
$req($json);                                                          eq(dc_csrf_refusal(['x'], true), 'token', 'H: a non-string token → refused');
$req(['REQUEST_METHOD' => 'GET']);                                    eq(dc_csrf_refusal($tok, true), 'method', 'H: a write by GET → refused');
$req(['REQUEST_METHOD' => 'POST', 'CONTENT_TYPE' => 'text/plain']);   eq(dc_csrf_refusal($tok, true), 'content_type', 'H: text/plain "JSON" → refused');
$req($json + ['HTTP_SEC_FETCH_SITE' => 'same-site']);                 eq(dc_csrf_refusal($tok, true), 'cross_site', 'H: a sibling *.dnchardware.com page → refused');
$req($json + ['HTTP_SEC_FETCH_SITE' => 'cross-site']);                eq(dc_csrf_refusal($tok, true), 'cross_site', 'H: another site → refused');
$req(['REQUEST_METHOD' => 'POST', 'CONTENT_TYPE' => 'multipart/form-data; boundary=x']); eq(dc_csrf_refusal($tok, false), null, 'H: multipart (ai_extract) with token → accepted');
$_SESSION = [];
$req($json);                                                          eq(dc_csrf_refusal($tok, true), 'token', 'H: a token from another session → refused');

$api = file_get_contents("$ROOT/api.php");
ok(preg_match('/header\(\s*.Access-Control-/i', $api) === 0, 'H/CORS: api.php sets no Access-Control-* header');
preg_match("/const DC_MUTATING_ACTIONS = \\[(.*?)\\];/s", $api, $mm);
preg_match_all("/'([a-z_]+)'/", $mm[1] ?? '', $acts);
$writes = ['add_company', 'update_company', 'delete_company', 'save_quotation', 'update_quotation', 'delete_quotation',
           'save_default_price', 'update_default_price', 'delete_default_price', 'save_diameter_setting', 'update_diameter_setting',
           'delete_diameter_setting', 'save_whatsapp_template', 'reset_whatsapp_template', 'import_diameter_settings', 'import_default_prices'];
$got = $acts[1]; sort($got); $want = $writes; sort($want);
eq($got, $want, 'H: every write action is gated');
preg_match_all("/\\\$action === '([a-z_]+)'/", $api, $all);
$reads = array_values(array_diff(array_unique($all[1]), $writes));
ok(count($reads) >= 10 && !array_intersect($reads, $got), 'H: reads (' . implode(', ', $reads) . ') stay ungated');
$gatePos = strpos($api, 'dc_require_csrf_api(true)'); $dbPos = strpos($api, "require_once 'db.php'");
ok($gatePos !== false && $dbPos !== false && $gatePos < $dbPos, 'H: the gate runs before the database is opened');
$ai = file_get_contents("$ROOT/ai_extract.php");
ok(strpos($ai, 'dc_require_csrf_api(false)') !== false, 'H: ai_extract.php is gated (multipart)');
ok(strpos(file_get_contents("$ROOT/login.php"), "dc_csrf_refusal(\$_POST['csrf'] ?? null, false)") !== false, 'H: login.php checks its form token');
ok(strpos(file_get_contents("$ROOT/logout.php"), "dc_csrf_refusal(\$_POST['csrf'] ?? null, false)") !== false, 'H: logout.php needs a POSTed token');
foreach (['index.php', 'companies.php'] as $f) {
    $src = file_get_contents("$ROOT/$f");
    ok(strpos($src, "'X-DC-CSRF':dcCsrf()") !== false, "H: $f api() sends X-DC-CSRF on POST");
}
/* R2.2 added a third call (one request per PDF). The rule is that EVERY call
   sends the token, so the calls are counted and all of them must carry it. */
$ai_src = file_get_contents("$ROOT/index.php");
$aiCalls = substr_count($ai_src, "fetch('ai_extract.php'");
ok($aiCalls >= 3, "H: ai_extract.php is called from the page ($aiCalls calls: text fallback, upload, one per PDF)");
eq(substr_count($ai_src, "fetch('ai_extract.php',{method:'POST',headers:{'X-DC-CSRF':dcCsrf()}"), $aiCalls,
   'H: every ai_extract.php call sends the token');

// ══ I · handoff ═══════════════════════════════════════════════════════════
ok(strpos($hsrc, 'dc_csrf') === false && strpos(file_get_contents("$ROOT/handoff.php"), 'dc_csrf') === false,
   'I: the handoff endpoints are not CSRF-gated — the callback is a top-level GET from the Portal, protected by its signed, state-bound token');
$direct(); $u = dc_handoff_authorize_url('https://portal.dnchardware.com', str_repeat('s', 43));
eq($u, 'https://portal.dnchardware.com/handoff/authorize?audience=quotation&state=' . str_repeat('s', 43), 'I: direct /start → the unchanged authorize URL');
$mount();  $u = dc_handoff_authorize_url('https://portal.dnchardware.com', str_repeat('s', 43));
eq($u, 'https://portal.dnchardware.com/handoff/authorize?audience=quotation&state=' . str_repeat('s', 43) . '&mount=portal',
   'I: mounted /start → asks the Portal for its /quo callback (mount=portal), never a URL');

// ══ R · over real HTTP: one sandbox, the shipped files at / and at /quo/ ═
$files = ['auth.php', 'dnc_handoff.php', 'handoff.php', 'login.php', 'logout.php', 'index.php', 'companies.php', 'api.php',
          'pricing_history.php', 'app/Handoff/Contract/HandoffToken.php', 'app/Handoff/Contract/InvalidHandoffToken.php'];
foreach (['', '/quo'] as $base) {
    @mkdir("$SB$base/app/Handoff/Contract", 0777, true);
    foreach ($files as $f) copy("$ROOT/$f", "$SB$base/$f");
    /* Handoff ships OFF: /start and /callback answer 303 → sign-in without a database. */
    file_put_contents("$SB$base/dnc_config.php", "<?php return ['DNC_HANDOFF_ENABLED' => 'false'];");
}
/* What the two rewrites do: /auth/handoff/* → handoff.php on the direct host,
   /quo/auth/handoff/* → quo/handoff.php from /quo/.htaccess. As on Apache,
   the script that runs sets SCRIPT_NAME. */
file_put_contents("$SB/router.php", '<?php
    $p = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
    if (strpos($p, "/quo/auth/handoff/") === 0) { $_SERVER["SCRIPT_NAME"] = "/quo/handoff.php"; require __DIR__ . "/quo/handoff.php"; return true; }
    if (strpos($p, "/auth/handoff/") === 0)     { $_SERVER["SCRIPT_NAME"] = "/handoff.php";     require __DIR__ . "/handoff.php"; return true; }
    return false;');
$PORT = 37000 + (getmypid() % 900);
$srvPipes = [];
$srv = proc_open([PHP_BINARY, '-d', 'display_errors=0', '-d', "session.save_path=$SESS", '-S', "127.0.0.1:{$PORT}", '-t', $SB, "$SB/router.php"],
                 [1 => ['file', "$SB/server-out.log", 'a'], 2 => ['file', "$SB/server-err.log", 'a']], $srvPipes, $SB);
register_shutdown_function(function () use (&$srv) { if (is_resource($srv)) { proc_terminate($srv); proc_close($srv); } });
$up = false;
for ($i = 0; $i < 60 && !$up; $i++) { $fp = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 0.3); if ($fp) { fclose($fp); $up = true; } else usleep(200000); }
ok($up, "R: the sandbox server is listening on 127.0.0.1:{$PORT}");

function http($method, $path, ?string $cookie = null, string $body = '', string $ctype = '') {
    global $PORT;
    $s = fsockopen('127.0.0.1', $PORT, $en, $es, 5);
    fwrite($s, "$method $path HTTP/1.1\r\nHost: portal.dnchardware.com\r\nConnection: close\r\nX-Forwarded-Proto: https\r\n"
             . ($cookie ? "Cookie: $cookie\r\n" : '')
             . ($body !== '' ? 'Content-Type: ' . ($ctype ?: 'application/x-www-form-urlencoded') . "\r\nContent-Length: " . strlen($body) . "\r\n" : '')
             . "\r\n" . $body);
    $raw = ''; while (!feof($s)) $raw .= fread($s, 65536);
    fclose($s);
    [$head, $content] = array_pad(explode("\r\n\r\n", $raw, 2), 2, '');
    $lines = explode("\r\n", $head);
    preg_match('#^HTTP/\S+ (\d+)#', array_shift($lines), $m);
    $h = []; $cookies = [];
    foreach ($lines as $l) {
        [$k, $v] = array_pad(explode(':', $l, 2), 2, '');
        $k = strtolower(trim($k)); $v = trim($v);
        if ($k === 'set-cookie') $cookies[] = explode(';', $v)[0]; else $h[$k] = $v;
    }
    return ['status' => (int)($m[1] ?? 0), 'h' => $h, 'cookies' => $cookies, 'body' => $content];
}

if ($up) {
    foreach (['' => 'direct', '/quo' => 'mounted'] as $base => $label) {
        $r = http('GET', "$base/auth/handoff/start");
        eq([$r['status'], $r['h']['location'] ?? null, $r['body']], [303, "$base/login.php", ''], "R/$label: $base/auth/handoff/start reaches handoff.php → $base/login.php");
        $r = http('GET', "$base/auth/handoff/callback?token=x");
        eq([$r['status'], $r['h']['location'] ?? null], [303, "$base/login.php"], "R/$label: $base/auth/handoff/callback → $base/login.php (not CSRF-gated)");
        eq(http('GET', "$base/auth/handoff/other")['status'], 404, "R/$label: any other $base/auth/handoff/ path is 404");

        $r = http('GET', "$base/index.php");
        eq([$r['status'], $r['h']['location'] ?? null], [302, 'login.php?next=' . rawurlencode("$base/index.php")],
           "R/$label: signed out, $base/index.php → login with next=$base/index.php");

        $lp = http('GET', "$base/login.php?next=" . rawurlencode('/admin/users'));
        preg_match('#name="next" value="([^"]*)"#', $lp['body'], $nm);
        eq($nm[1] ?? null, $base === '' ? '/admin/users' : '/quo/index.php', "R/$label: login next=/admin/users → " . ($base === '' ? 'kept (direct rules)' : '/quo/index.php'));
        ok(strpos($lp['body'], 'href="assets/icons/favicon.ico"') !== false && strpos($lp['body'], 'href="/assets') === false,
           "R/$label: login icons are relative");
        ok(preg_match('#name="csrf" value="[0-9a-f]{64}"#', $lp['body']) === 1, "R/$label: the login form carries a token");

        $ck = $lp['cookies'][0] ?? null;
        $bad = http('POST', "$base/login.php", $ck, 'username=a&password=b&csrf=' . str_repeat('0', 64));
        ok($bad['status'] === 200 && strpos($bad['body'], 'errLoginExpired') !== false, "R/$label: a login POST with a wrong token is refused, not attempted");

        $lo = http('GET', "$base/logout.php");
        eq([$lo['status'], $lo['h']['location'] ?? null], [302, 'login.php?out=1'], "R/$label: logout.php signed out → sign-in");

        $a = http('POST', "$base/api.php?action=delete_quotation", null, '{"id":1}', 'application/json');
        eq($a['status'], 401, "R/$label: api.php still answers 401 first when signed out");
        ok(stripos(implode("\n", array_keys($a['h'])), 'access-control-') === false, "R/$label: no CORS headers");
    }
    eq(http('GET', '/auth/handoff/start')['h']['location'] ?? null, '/login.php', 'R: the direct copy is unaffected by the mounted one');
}

// ══ report ════════════════════════════════════════════════════════════════
$out = ob_get_clean();
echo $out;
echo "\n  same-origin mount: {$asserts} asserts, " . count($failures) . " failures\n";
foreach ($failures as $f) echo "  FAIL  $f\n";
echo "\n";
exit($failures ? 1 : 0);
