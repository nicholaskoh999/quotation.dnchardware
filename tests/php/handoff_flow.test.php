<?php
ob_start();   /* BEFORE any output: sessions refuse to start once output exists. */
/**
 * ── DNC Workspace handoff — Quotation as a target (contract v2 §6–§16) ──────
 *
 * Run:  php tests/php/handoff_flow.test.php
 *
 *     DC_TEST_DB_HOST / _PORT / _USER / _PASS   (default 127.0.0.1:3306 root)
 *
 * Two layers, both against REAL MySQL:
 *
 *   A–Q  the shipped dnc_handoff.php + auth.php driven in-process with REAL PHP
 *        sessions. Each Browser keeps its own session id, the way a browser
 *        keeps its cookie, so "copy the callback URL into another browser" is
 *        literally another session. The Portal's part is played with the
 *        copied contract code (HandoffToken::claims/encode) and the same key.
 *   R    the shipped files in a sandbox, served over REAL HTTP by the PHP
 *        built-in server, with a router doing what the host rewrite does:
 *        status codes, headers, empty bodies, the __Host- cookie, real pages,
 *        a real api.php save, and per-request enforcement on them.
 *
 * Canonical users live in a separate database with Internal PO's `users`
 * shape (prod-r4.2.2), read through a MySQL user that holds SELECT only.
 *
 * Needs a real MySQL. EXITS NON-ZERO rather than skipping.
 */

error_reporting(E_ALL);
$ROOT = dirname(__DIR__, 2);

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true)
                                   . "\n      actual:   " . var_export($actual, true));
}

// ══ connect ════════════════════════════════════════════════════════════════
mysqli_report(MYSQLI_REPORT_OFF);
$H = getenv('DC_TEST_DB_HOST') ?: '127.0.0.1';
$P = (int)(getenv('DC_TEST_DB_PORT') ?: 3306);
$U = getenv('DC_TEST_DB_USER') ?: 'root';
$W = getenv('DC_TEST_DB_PASS'); if ($W === false) $W = '';
$root = @new mysqli($H, $U, $W, null, $P);
if (!$root || $root->connect_errno) {
    echo "\n  FAIL  handoff flow — no MySQL at {$H}:{$P}\n\n";
    echo "   - This suite tests replay, read-only access and sessions against a server.\n";
    echo "   - It is deliberately NOT skipped.\n\n";
    exit(1);
}
$server = $root->query('SELECT VERSION()')->fetch_row()[0];
$PID = getmypid();
$QDB = "dc_handoff_q_{$PID}";
$UDB = "dc_handoff_u_{$PID}";
$RO_USER = "dc_ro_{$PID}";
$RO_PASS = bin2hex(random_bytes(12));
foreach ([$QDB, $UDB] as $d) {
    $ex = $root->query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{$d}'");
    if ($ex && $ex->num_rows) { echo "\n  FAIL  {$d} already exists — refusing to reuse it.\n\n"; exit(1); }
}
$SESS = sys_get_temp_dir() . "/dc-handoff-sess-{$PID}";
$SB   = sys_get_temp_dir() . "/dc-handoff-sb-{$PID}";
@mkdir($SESS, 0700, true);
register_shutdown_function(function () use ($root, $QDB, $UDB, $RO_USER, $H, $SESS, $SB) {
    $root->query("DROP DATABASE IF EXISTS {$QDB}");
    $root->query("DROP DATABASE IF EXISTS {$UDB}");
    $root->query("DROP USER IF EXISTS '{$RO_USER}'@'{$H}'");
    foreach ([$SESS, $SB] as $dir) {
        if (!is_dir($dir)) continue;
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
                                            RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($it as $f) $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
        @rmdir($dir);
    }
});

// ══ schema ═════════════════════════════════════════════════════════════════
$root->query("CREATE DATABASE {$QDB}");
$root->query("CREATE DATABASE {$UDB}");

/* Quotation's own tables. The handoff tables come from the SHIPPED migration,
   lifted between its markers; the revision table from its own migration. */
$HMIG = file_get_contents("$ROOT/migrations/2026-10-20-create-handoff-tables.sql");
preg_match('/-- >>> SECTION 2 BEGIN\s*(.*?)\s*-- <<< SECTION 2 END/s', $HMIG, $hm);
ok(!empty($hm[1]), 'schema: section 2 lifted from the shipped handoff migration');
$RMIG = file_get_contents("$ROOT/migrations/2026-08-28-create-quotation-revisions.sql");
preg_match('/-- >>> SECTION 2 BEGIN\s*(.*?)\s*-- <<< SECTION 2 END/s', $RMIG, $rm);

$q = new mysqli($H, $U, $W, $QDB, $P);
$q->set_charset('utf8mb4');
foreach (array_filter(array_map('trim', explode(';', $hm[1] ?? ''))) as $stmt) {
    ok($q->query($stmt) === true, 'schema: handoff migration statement runs: ' . substr(preg_replace('/\s+/', ' ', $stmt), 0, 60));
}
$q->query("CREATE TABLE companies (id INT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(200) NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB");
$q->query("CREATE TABLE quotations (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT, company_id INT UNSIGNED NULL,
    ref_no VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    quote_date DATE NULL, valid_until DATE NULL, prepared_by VARCHAR(100) NULL, remarks TEXT NULL,
    customer_name VARCHAR(200) NULL, customer_phone VARCHAR(50) NULL,
    items LONGTEXT NULL, total_amount DECIMAL(12,2) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uq_quotations_ref (ref_no)) ENGINE=InnoDB");
ok(!empty($rm[1]) && $q->query($rm[1]) === true, 'schema: quotation_revisions from its shipped migration');

/* Internal PO's users table, as prod-r4.2.2 leaves it (0001 + 2026_10_17_000001
   + 2026_10_19_200001 + 2026_10_21_400001). */
$root->query("CREATE TABLE {$UDB}.users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(255) NOT NULL,
    username VARCHAR(20) NOT NULL, email VARCHAR(255) NULL, email_verified_at TIMESTAMP NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'member', password VARCHAR(255) NOT NULL,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0, password_changed_at TIMESTAMP NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1, is_legacy_placeholder TINYINT(1) NOT NULL DEFAULT 0,
    disabled_at TIMESTAMP NULL, last_login_at TIMESTAMP NULL, locale VARCHAR(10) NULL,
    remember_token VARCHAR(100) NULL, created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL,
    PRIMARY KEY (id), UNIQUE KEY users_username_unique (username), UNIQUE KEY users_email_unique (email),
    KEY users_role_index (role)) ENGINE=InnoDB");
$seed = [
    [42, 'Alson Tan',      'alson',   'member', 1, 0, 0],
    [43, 'Chee Keong',     'ck',      'admin',  1, 0, 0],
    [44, 'Former Staff',   'former',  'member', 0, 0, 0],
    [45, 'Legacy Import',  'legacy',  'member', 1, 1, 0],
    [46, 'New Starter',    'newbie',  'member', 1, 0, 1],
    [47, str_repeat('Very Long Name ', 12), 'longname', 'member', 1, 0, 0],
    [48, '   ',            'noname',  'member', 1, 0, 0],
];
foreach ($seed as [$id, $name, $un, $role, $act, $leg, $must]) {
    $st = $root->prepare("INSERT INTO {$UDB}.users (id, name, username, email, role, password, is_active, is_legacy_placeholder, must_change_password)
                          VALUES (?, ?, ?, ?, ?, 'x-not-a-hash', ?, ?, ?)");
    $em = "$un@example.invalid";
    $st->bind_param('issssiii', $id, $name, $un, $em, $role, $act, $leg, $must);
    $st->execute();
}
$setUser = function ($id, $col, $val) use ($root, $UDB) {
    $st = $root->prepare("UPDATE {$UDB}.users SET {$col} = ? WHERE id = ?");
    is_int($val) ? $st->bind_param('ii', $val, $id) : $st->bind_param('si', $val, $id);
    $st->execute();
};

/* The read-only database user: SELECT on that one table, nothing else. */
$root->query("DROP USER IF EXISTS '{$RO_USER}'@'{$H}'");
ok($root->query("CREATE USER '{$RO_USER}'@'{$H}' IDENTIFIED BY '{$RO_PASS}'") === true, 'schema: read-only user created');
ok($root->query("GRANT SELECT ON {$UDB}.users TO '{$RO_USER}'@'{$H}'") === true, 'schema: it holds SELECT on users only');

// ══ configuration and wiring ═══════════════════════════════════════════════
$SECRET     = 'base64:' . base64_encode(random_bytes(32));
$SECRET_OLD = 'base64:' . base64_encode(random_bytes(32));
$PO_SECRET  = 'base64:' . base64_encode(random_bytes(32));
$ENV = [
    'DNC_HANDOFF_ENABLED' => 'true', 'DNC_HANDOFF_SECRET' => $SECRET, 'DNC_HANDOFF_SECRET_PREVIOUS' => '',
    'DNC_PORTAL_URL' => 'https://portal.dnchardware.com',
    'DNC_USERS_DB_HOST' => $H, 'DNC_USERS_DB_PORT' => (string)$P, 'DNC_USERS_DB_DATABASE' => $UDB,
    'DNC_USERS_DB_USERNAME' => $RO_USER, 'DNC_USERS_DB_PASSWORD' => $RO_PASS,
];
function setenv_all(array $env) { foreach ($env as $k => $v) putenv("$k=$v"); }
setenv_all($ENV);

ini_set('session.save_path', $SESS);
$GETDB_CALLS = 0;
function getDB() { global $q, $GETDB_CALLS; $GETDB_CALLS++; return $q; }

$LOG = [];
$GLOBALS['DC_HANDOFF_LOG_SINK'] = function ($line) { $GLOBALS['LOG'][] = $line; };
function logs_since($n) { return array_slice($GLOBALS['LOG'], $n); }
function logged($n, $needle) { foreach (logs_since($n) as $l) if (strpos($l, $needle) !== false) return true; return false; }

require_once "$ROOT/dnc_handoff.php";

use App\Handoff\Contract\HandoffToken;

$KEY    = HandoffToken::parseSecret($SECRET);
$OLDKEY = HandoffToken::parseSecret($SECRET_OLD);
$POKEY  = HandoffToken::parseSecret($PO_SECRET);
$T      = time();

/* Everything secret this run produces, to prove none of it reaches a log or a
   response. */
$SECRETS_SEEN = [substr($SECRET, 7), substr($SECRET_OLD, 7), $RO_PASS];

// ══ browsers ═══════════════════════════════════════════════════════════════
final class Browser
{
    public string $sid = '';
    public array $session = [];
    public function __construct(public string $ip) {}
}
$ipN = 1;
function browser(): Browser { global $ipN; return new Browser('10.20.' . intdiv($ipN, 250) . '.' . ($ipN++ % 250 + 1)); }

/** One request in one browser: its own session id in, whatever it holds out. */
function req(Browser $b, callable $fn, array $get = []) {
    global $SESS, $SECRETS_SEEN;
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    $_SESSION = [];
    session_id($b->sid);
    $_GET = $get;
    $_SERVER['REMOTE_ADDR'] = $b->ip;
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $r = $fn();
    if (session_status() === PHP_SESSION_ACTIVE) {
        $b->sid = session_id();
        $b->session = $_SESSION;
        $SECRETS_SEEN[] = $b->sid;
        session_write_close();
    } elseif ($b->sid !== '' && !is_file("$SESS/sess_{$b->sid}")) {
        $b->sid = '';                        // destroyed: the cookie is gone too
        $b->session = [];
    }
    return $r;
}
function start(Browser $b, array $get = [], $now = null) { return req($b, fn () => dc_handoff_start($now ?? $GLOBALS['T']), $get); }
function callback(Browser $b, $token, $now = null) {
    return req($b, fn () => dc_handoff_callback($now ?? $GLOBALS['T']), $token === null ? [] : ['token' => $token]);
}
function whoami(Browser $b) { return req($b, fn () => dc_is_logged_in() ? dc_current_user() : null); }

/** The Portal's part: a token for the state in a /start Location. */
function portal(array $startResponse, int $id, string $username, string $role, ?int $now = null, ?string $key = null, string $aud = 'quotation') {
    global $KEY, $T, $TOKENS;
    parse_str((string)parse_url((string)$startResponse['location'], PHP_URL_QUERY), $qs);
    $claims = HandoffToken::claims($aud, $id, $username, $role, (string)($qs['state'] ?? ''), $now ?? $T);
    $token = HandoffToken::encode($claims, $key ?? $KEY);
    $TOKENS[] = $token;
    $GLOBALS['STATES'][] = $qs['state'];
    return $token;
}
function state_of(array $startResponse) {
    parse_str((string)parse_url((string)$startResponse['location'], PHP_URL_QUERY), $qs);
    return (string)($qs['state'] ?? '');
}
$TOKENS = []; $STATES = [];
$jtiRows = function () use ($q) { return (int)$q->query('SELECT COUNT(*) FROM handoff_consumed_tokens')->fetch_row()[0]; };

const LOGIN = ['status' => 303, 'location' => '/login.php'];
const HOME  = ['status' => 303, 'location' => '/'];

// ══ A · feature switch OFF preserves today's Quotation ═════════════════════
{
    putenv('DNC_HANDOFF_ENABLED=false');
    $calls = $GETDB_CALLS; $n = count($LOG);
    $a = browser();
    eq(start($a), LOGIN, 'A: switched off, /start goes to the normal sign-in page');
    eq(callback($a, 'v2.whatever.' . str_repeat('A', 43)), LOGIN, 'A: switched off, /callback goes to the normal sign-in page');
    eq($a->sid, '', 'A: and no session was started for it');
    eq($GETDB_CALLS, $calls, 'A: and no database was opened');
    eq(count($LOG), $n, 'A: and nothing was logged (step 0)');
    putenv('DNC_HANDOFF_ENABLED=');
    eq(start(browser()), LOGIN, 'A: unset is OFF too — the handoff ships switched off');
    $sample = include "$ROOT/dnc_config.sample.php";
    eq($sample['DNC_HANDOFF_ENABLED'] ?? null, 'false', 'A: the shipped sample says false');
    eq($sample['DNC_HANDOFF_SECRET'] ?? null, '', 'A: and carries no secret');
    eq($sample['DNC_PORTAL_URL'] ?? null, 'https://portal.dnchardware.com', 'A: and the fixed Portal URL');
    putenv('DNC_HANDOFF_ENABLED=true');
}

// ══ B · /start: target-owned state, fixed redirect, nothing taken from the request
{
    $b = browser(); $n = count($LOG);
    $r = start($b, ['redirect_uri' => 'https://evil.example/x', 'next' => '//evil.example', 'url' => 'https://evil.example',
                    'callback' => 'https://evil.example/cb', 'audience' => 'internal-po', 'state' => 'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8']);
    $state = state_of($r);
    eq($r['status'], 303, 'B: /start answers 303');
    ok(preg_match('#^https://portal\.dnchardware\.com/handoff/authorize\?audience=quotation&state=[A-Za-z0-9_-]{43}$#', (string)$r['location']) === 1,
       'B: to exactly DNC_PORTAL_URL/handoff/authorize?audience=quotation&state=<43 chars>');
    ok(strpos((string)$r['location'], 'evil') === false, 'B: redirect_uri / next / url / callback injection changes nothing');
    ok($state !== 'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8', 'B: a state in the query is ignored; Quotation makes its own');
    eq(strlen(base64_decode(strtr($state, '-_', '+/'))), 32, 'B: the state is 32 random bytes (256 bits)');
    eq($b->session[DC_HANDOFF_STATES] ?? null, [HandoffToken::stateHash($state) => $T + 120],
       'B: the session holds only {sha256(state): now + 120}');
    ok(strpos(serialize($b->session), $state) === false, 'B: the raw state is not stored');
    ok(!logged($n, $state), 'B: and not logged');
    ok(array_keys($b->session) === [DC_HANDOFF_STATES], 'B: and nothing else is written to the session');
    $r2 = start(browser());
    ok(state_of($r2) !== $state, 'B: every start makes a different state');
}

// ══ C · Browser A: the whole handoff ═══════════════════════════════════════
{
    $a = browser(); $n = count($LOG);
    $r = start($a);
    $token = portal($r, 42, 'alson', 'member');
    $sidBefore = $a->sid;
    $rows = $jtiRows();
    eq(callback($a, $token), HOME, 'C: a valid callback answers 303 to Quotation home');
    ok($a->sid !== '' && $a->sid !== $sidBefore, 'C: with a NEW session id');
    ok(!is_file("$SESS/sess_{$sidBefore}"), 'C: the old session is gone, not merely left behind');
    eq($a->session['dc_auth_source'] ?? null, 'dnc', 'C: the session is a DNC identity');
    eq($a->session['dc_dnc_user_id'] ?? null, 42, 'C: carrying the canonical users.id');
    ok(!array_key_exists('dc_user_id', $a->session), 'C: and NO app_users id');
    eq($a->session[DC_HANDOFF_STATES] ?? null, [], 'C: the state is used up');
    eq(whoami($a), ['id' => null, 'username' => 'alson', 'display_name' => 'Alson Tan', 'source' => 'dnc', 'dnc_user_id' => 42],
       'C: dc_current_user(): source dnc, id NULL, canonical username and display name');
    eq($jtiRows(), $rows + 1, 'C: one handoff_consumed_tokens row');
    $claims = json_decode(base64_decode(strtr(explode('.', $token)[1], '-_', '+/')), true);
    $row = $q->query("SELECT user_id, UNIX_TIMESTAMP(expires_at) FROM handoff_consumed_tokens WHERE jti='{$claims['jti']}'")->fetch_row();
    eq([(int)$row[0], (int)$row[1]], [42, $claims['exp']], 'C: keyed by the jti, with sub and exp');
    ok(logged($n, "auth.handoff_succeeded jti={$claims['jti']} sub=42"), 'C: success logged with jti and sub');
    $keys = implode(',', array_keys($a->session));
    ok(stripos($keys, 'remember') === false, 'C: no remember-me of any kind');
    $GLOBALS['ALSON'] = $a;
}

// ══ D · the callback URL copied into Browser B ═════════════════════════════
{
    $a = browser();
    $token = portal(start($a), 42, 'alson', 'member');
    $rows = $jtiRows();

    $b = browser(); $n = count($LOG);
    eq(callback($b, $token), LOGIN, 'D: the same callback in a fresh Browser B goes to sign-in');
    ok(logged($n, 'reason=state_mismatch'), 'D: refused as state_mismatch');
    eq(whoami($b), null, 'D: Browser B is not signed in');
    ok(!logged($n, 'jti='), 'D: no jti is logged for it (nothing was consumed)');
    eq($jtiRows(), $rows, 'D: the jti was NOT consumed');

    $b2 = browser();
    $own = start($b2);
    $n = count($LOG);
    eq(callback($b2, $token), LOGIN, 'D: Browser B with its own pending handoff is refused too');
    ok(logged($n, 'reason=state_mismatch'), 'D: state_mismatch');
    eq(array_keys($b2->session[DC_HANDOFF_STATES] ?? []), [HandoffToken::stateHash(state_of($own))],
       'D: and Browser B\'s own pending state is untouched');

    eq(callback($a, $token), HOME, 'D: Browser A still completes with the token afterwards');
    eq(whoami($a)['dnc_user_id'] ?? null, 42, 'D: and is signed in');
}

// ══ E · two tabs, two pending states, each callback consumes its own ═══════
{
    $a = browser();
    $r1 = start($a); $r2 = start($a);
    $t1 = portal($r1, 42, 'alson', 'member'); $t2 = portal($r2, 43, 'ck', 'admin');
    eq(count($a->session[DC_HANDOFF_STATES]), 2, 'E: two tabs, two pending states');
    eq(callback($a, $t2), HOME, 'E: the second tab completes');
    eq(array_keys($a->session[DC_HANDOFF_STATES]), [HandoffToken::stateHash(state_of($r1))],
       'E: the first tab\'s state survives the new session');
    eq(callback($a, $t1), HOME, 'E: and the first tab then completes as well');
    eq(whoami($a)['username'] ?? null, 'alson', 'E: the last completed handoff is who is signed in');
}

// ══ F · missing state, wrong state ═════════════════════════════════════════
{
    $never = browser(); $n = count($LOG);
    $fake = ['location' => 'https://portal.dnchardware.com/handoff/authorize?audience=quotation&state=' . HandoffToken::newState()];
    eq(callback($never, portal($fake, 42, 'alson', 'member')), LOGIN, 'F: a browser that never called /start is refused');
    ok(logged($n, 'reason=state_mismatch'), 'F: state_mismatch');

    $a = browser();
    $mine = start($a);
    $n = count($LOG);
    eq(callback($a, portal($fake, 42, 'alson', 'member')), LOGIN, 'F: a token bound to a state Quotation did not make is refused');
    ok(logged($n, 'reason=state_mismatch'), 'F: state_mismatch');
    eq(array_keys($a->session[DC_HANDOFF_STATES]), [HandoffToken::stateHash(state_of($mine))], 'F: and the real pending state is untouched');

    $n = count($LOG);
    eq(callback($a, null), LOGIN, 'F: no token at all is refused');
    ok(logged($n, 'reason=malformed'), 'F: malformed');
    $n = count($LOG);
    eq(req($a, fn () => dc_handoff_callback($GLOBALS['T']), ['token' => ['v2', 'x']]), LOGIN, 'F: an array token is refused, not a 500');
    ok(logged($n, 'reason=malformed'), 'F: malformed');
}

// ══ G · expired state, expired / future token ══════════════════════════════
{
    $a = browser();
    $r = start($a, [], $T);
    $n = count($LOG);
    eq(callback($a, portal($r, 42, 'alson', 'member', $T + 100), $T + 121), LOGIN, 'G: a state older than 120 s is refused');
    ok(logged($n, 'reason=state_expired'), 'G: state_expired');

    $a = browser();
    $r = start($a, [], $T);
    $n = count($LOG);
    eq(callback($a, portal($r, 42, 'alson', 'member', $T), $T + 65), LOGIN, 'G: a token at exp + 5 s is refused');
    ok(logged($n, 'reason=expired'), 'G: expired');

    $a = browser();
    $r = start($a, [], $T);
    $n = count($LOG);
    eq(callback($a, portal($r, 42, 'alson', 'member', $T + 6), $T), LOGIN, 'G: a token issued more than 5 s in the future is refused');
    ok(logged($n, 'reason=not_yet_valid'), 'G: not_yet_valid');

    $a = browser();
    $r = start($a);
    $c = HandoffToken::claims('quotation', 42, 'alson', 'member', state_of($r), $T);
    $c['exp'] = $T + 121;
    $p = rtrim(strtr(base64_encode(json_encode($c, JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
    $long = 'v2.' . $p . '.' . rtrim(strtr(base64_encode(hash_hmac('sha256', 'v2.' . $p, $KEY, true)), '+/', '-_'), '=');
    $n = count($LOG);
    eq(callback($a, $long), LOGIN, 'G: a correctly signed token living longer than 120 s is refused');
    ok(logged($n, 'reason=lifetime_too_long'), 'G: lifetime_too_long');
}

// ══ H · consumed state: a reload after success ═════════════════════════════
{
    $a = browser();
    $token = portal(start($a), 42, 'alson', 'member');
    eq(callback($a, $token), HOME, 'H: signed in');
    $sid = $a->sid; $n = count($LOG);
    eq(callback($a, $token), LOGIN, 'H: reloading the callback is refused');
    ok(logged($n, 'reason=state_mismatch'), 'H: state_mismatch (the state is gone)');
    eq($a->sid, $sid, 'H: the existing session keeps its id');
    eq(whoami($a)['dnc_user_id'] ?? null, 42, 'H: and its user — a step 1–4 failure changes nothing');
}

// ══ I · at most five pending states ════════════════════════════════════════
{
    $a = browser();
    $rs = [];
    for ($i = 0; $i < 6; $i++) $rs[] = start($a, [], $T + $i);
    eq(count($a->session[DC_HANDOFF_STATES]), 5, 'I: six starts keep five pending states');
    ok(!isset($a->session[DC_HANDOFF_STATES][HandoffToken::stateHash(state_of($rs[0]))]), 'I: the oldest was dropped');
    $n = count($LOG);
    eq(callback($a, portal($rs[0], 42, 'alson', 'member', $T + 6), $T + 6), LOGIN, 'I: the dropped one no longer works');
    ok(logged($n, 'reason=state_mismatch'), 'I: state_mismatch');
    eq(callback($a, portal($rs[5], 42, 'alson', 'member', $T + 6), $T + 6), HOME, 'I: the newest works');
    eq(count($a->session[DC_HANDOFF_STATES]), 4, 'I: and the other four still wait');
}

// ══ J · replay ═════════════════════════════════════════════════════════════
{
    $a = browser();
    $r = start($a);
    $token = portal($r, 42, 'alson', 'member');
    $pendingBefore = $a->session[DC_HANDOFF_STATES];
    eq(callback($a, $token), HOME, 'J: first use succeeds');
    /* Put the state back, as if the session had raced: only the jti stops it. */
    req($a, function () use ($pendingBefore) { dc_session_start(); $_SESSION[DC_HANDOFF_STATES] = $pendingBefore; });
    $n = count($LOG);
    eq(callback($a, $token), LOGIN, 'J: the same jti a second time is refused');
    ok(logged($n, 'reason=replayed'), 'J: replayed');

    /* Concurrency: eight processes, eight connections, one jti, released
       together. The primary key must let exactly one through. */
    $jti = HandoffToken::newJti();
    $child = sys_get_temp_dir() . "/dc-handoff-race-{$PID}.php";
    file_put_contents($child, '<?php
        mysqli_report(MYSQLI_REPORT_OFF);
        function getDB() { return null; }
        require ' . var_export("$ROOT/dnc_handoff.php", true) . ';
        $db = new mysqli(' . var_export($H, true) . ', ' . var_export($U, true) . ', ' . var_export($W, true) . ', ' . var_export($QDB, true) . ', ' . $P . ');
        $go = (float)$argv[1];
        while (microtime(true) < $go) usleep(200);
        $r = dc_handoff_consume_jti($db, ["jti" => ' . var_export($jti, true) . ', "sub" => "42", "exp" => ' . ($T + 60) . '], ' . $T . ');
        echo $r === null ? "WON" : $r;
    ');
    $go = microtime(true) + 1.5;
    $procs = [];
    for ($i = 0; $i < 8; $i++) {
        $procs[] = proc_open([PHP_BINARY, $child, (string)$go], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        $outs[$i] = $pipes;
    }
    $results = [];
    foreach ($procs as $i => $p) { $results[] = trim(stream_get_contents($outs[$i][1])); proc_close($p); }
    @unlink($child);
    $won = count(array_filter($results, fn ($x) => $x === 'WON'));
    $rep = count(array_filter($results, fn ($x) => $x === 'replayed'));
    eq([$won, $rep], [1, 7], 'J: eight concurrent consumers of one jti — exactly one wins, seven are replayed (' . implode(',', $results) . ')');
}

// ══ K · the canonical user ═════════════════════════════════════════════════
{
    foreach ([[999, 'ghost', 'member', 'user_not_found', 'a missing user'],
              [44, 'former', 'member', 'user_inactive', 'an inactive user'],
              [45, 'legacy', 'member', 'user_legacy_placeholder', 'a legacy placeholder'],
              [46, 'newbie', 'member', 'user_must_change_password', 'a user who must change their password'],
              [42, 'alsonx', 'member', 'user_mismatch', 'a username that does not match users.username'],
              [42, 'alson', 'admin', 'user_mismatch', 'a role that does not match users.role']] as [$id, $un, $role, $why, $label]) {
        $a = browser();
        $r = start($a);
        $rows = $jtiRows(); $n = count($LOG);
        eq(callback($a, portal($r, $id, $un, $role)), LOGIN, "K: $label is refused");
        ok(logged($n, "reason=$why"), "K: as $why");
        eq(whoami($a), null, "K: $label is not signed in");
        eq($jtiRows(), $rows + 1, "K: $label still uses up the jti (one attempt per handoff)");
        eq($a->session[DC_HANDOFF_STATES] ?? null, [], "K: and the state");
    }

    /* Display name: the canonical name, trimmed and cut to the 100 characters
       quotation_revisions.actor_display_name holds; else the username. */
    $a = browser();
    eq(callback($a, portal(start($a), 47, 'longname', 'member')), HOME, 'K: a very long name signs in');
    eq(mb_strlen(whoami($a)['display_name']), 100, 'K: its display name is cut to 100 characters');
    $a = browser();
    eq(callback($a, portal(start($a), 48, 'noname', 'member')), HOME, 'K: a blank name signs in');
    eq(whoami($a)['display_name'], 'noname', 'K: and is shown by username');

    /* The connection really is read-only, both ways. */
    dc_dnc_users_db(true);
    $ro = dc_dnc_users_db();
    ok($ro instanceof mysqli, 'K: the read-only connection opens with the SELECT-only user');
    ok($ro->query("INSERT INTO users (name, username, role, password) VALUES ('x','intruder','admin','x')") === false, 'K: it cannot INSERT');
    ok($ro->query("UPDATE users SET is_active = 1 WHERE id = 44") === false, 'K: it cannot UPDATE');
    ok($ro->query("DELETE FROM users WHERE id = 44") === false, 'K: it cannot DELETE');
    dc_dnc_users_db(true);
    putenv("DNC_USERS_DB_USERNAME=$U"); putenv("DNC_USERS_DB_PASSWORD=$W");
    $priv = dc_dnc_users_db();
    ok($priv instanceof mysqli && $priv->query("UPDATE users SET is_active = 1 WHERE id = 44") === false && $priv->errno === 1792,
       'K: even with a broader grant the session is READ ONLY (1792)');
    eq((int)$root->query("SELECT is_active FROM {$UDB}.users WHERE id = 44")->fetch_row()[0], 0, 'K: nothing was written');
    dc_dnc_users_db(true);
    setenv_all($ENV);

    $a = browser();
    $r = start($a);
    putenv('DNC_USERS_DB_PASSWORD=wrong'); dc_dnc_users_db(true);
    $n = count($LOG);
    eq(callback($a, portal($r, 42, 'alson', 'member')), LOGIN, 'K: with the users database unreachable, the handoff fails closed');
    ok(logged($n, 'reason=user_source_unavailable'), 'K: user_source_unavailable');
    ok(!logged($n, 'wrong'), 'K: the password tried is not logged');
    setenv_all($ENV); dc_dnc_users_db(true);

    $src = file_get_contents("$ROOT/dnc_handoff.php");
    ok(preg_match_all('/\b(INSERT|UPDATE|DELETE|REPLACE)\b[^;]*\busers\b/i', preg_replace('~/\*.*?\*/~s', '', $src)) === 0,
       'K: dnc_handoff.php contains no write against users');
    ok(strpos($src, 'FROM users WHERE id = ? LIMIT 1') !== false, 'K: users are matched by id only');
}

// ══ L · Quotation's own session ════════════════════════════════════════════
{
    /* Already signed in as one person; a valid handoff for another. */
    $a = browser();
    eq(callback($a, portal(start($a), 42, 'alson', 'member')), HOME, 'L: signed in as alson');
    $sid = $a->sid;
    eq(callback($a, portal(start($a), 43, 'ck', 'admin')), HOME, 'L: a valid handoff for ck in the same browser');
    eq(whoami($a)['username'] ?? null, 'ck', 'L: is now ck');
    ok($a->sid !== $sid, 'L: with a new session id');

    /* An app_users (password) session in the browser; the handoff replaces it
       whole — no app_users identity survives into the DNC session. */
    $p = browser();
    req($p, function () { dc_session_start(); $_SESSION = ['dc_auth' => true, 'dc_user_id' => 7, 'dc_username' => 'nicholas',
        'dc_display_name' => 'Nicholas', 'dc_login_time' => time(), 'dc_user' => 'nicholas']; });
    eq(whoami($p), ['id' => 7, 'username' => 'nicholas', 'display_name' => 'Nicholas'], 'L: an app_users session reads exactly as before');
    eq(callback($p, portal(start($p), 42, 'alson', 'member')), HOME, 'L: a handoff over it');
    ok(!array_key_exists('dc_user_id', $p->session), 'L: leaves no app_users id behind');

    /* And the other way: a password sign-in over a DNC session. */
    req($p, function () {
        $db = new class {
            public function prepare($sql) { return new class {
                public function bind_param($t, &$v) { return true; }
                public function execute() { return true; }
                public function bind_result(&$a, &$b, &$c, &$d, &$e) { $a = 7; $b = 'nicholas'; $c = 'Nicholas';
                    $d = password_hash('pw-for-this-test', PASSWORD_DEFAULT); $e = 1; return true; }
                public function fetch() { return true; }
                public function close() {}
            }; }
        };
        dc_login($db, 'nicholas', 'pw-for-this-test');
    });
    eq(whoami($p), ['id' => 7, 'username' => 'nicholas', 'display_name' => 'Nicholas'],
       'L: a password sign-in over a DNC session is a clean app_users identity');
    ok(!array_key_exists('dc_auth_source', $p->session) && !array_key_exists('dc_dnc_user_id', $p->session),
       'L: with no DNC key left behind');

    /* A session that claims some other source is not trusted. */
    $x = browser();
    req($x, function () { dc_session_start(); $_SESSION = ['dc_auth' => true, 'dc_auth_source' => 'portal', 'dc_user_id' => 7,
        'dc_username' => 'nicholas', 'dc_display_name' => 'Nicholas', 'dc_login_time' => time()]; });
    eq(whoami($x), null, 'L: an unknown identity source is no identity');
    $x = browser();
    req($x, function () { dc_session_start(); $_SESSION = ['dc_auth' => true, 'dc_auth_source' => 'dnc', 'dc_dnc_user_id' => '42',
        'dc_username' => 'alson', 'dc_display_name' => 'Alson', 'dc_login_time' => time()]; });
    eq(whoami($x), null, 'L: a DNC session with a non-integer id is no identity');

    /* Cookie configuration (the live header is checked over HTTP in R). */
    $_SERVER['HTTPS'] = 'on';
    eq(dc_session_cookie_name(), '__Host-DCQUOSESS', 'L: on HTTPS the cookie is __Host-DCQUOSESS');
    unset($_SERVER['HTTPS']);
    eq(dc_session_cookie_name(), 'DCQUOSESS', 'L: on plain HTTP (local only) it keeps the bare name');
    ini_set('session.cookie_domain', '.dnchardware.com');
    $c = browser();
    req($c, function () { dc_session_start(); $GLOBALS['CP'] = session_get_cookie_params(); });
    eq($GLOBALS['CP']['domain'], '', 'L: no Domain, even when the host sets session.cookie_domain');
    eq([$GLOBALS['CP']['path'], $GLOBALS['CP']['httponly'], $GLOBALS['CP']['samesite']], ['/', true, 'Lax'], 'L: Path=/, HttpOnly, SameSite=Lax');
    ini_set('session.cookie_domain', '');
}

// ══ M · every protected request re-checks the canonical user ═══════════════
{
    $a = browser();
    eq(callback($a, portal(start($a), 42, 'alson', 'member')), HOME, 'M: alson signed in');
    ok(whoami($a) !== null, 'M: works while active');

    $setUser(42, 'is_active', 0);
    $n = count($LOG);
    eq(whoami($a), null, 'M: disabled in Internal PO → the very next request is refused');
    eq($a->sid, '', 'M: and the Quotation session is ended, not just refused');
    ok(logged($n, 'auth.dnc_session_revoked reason=user_inactive sub=42'), 'M: revoked, reason logged');
    $setUser(42, 'is_active', 1);
    eq(whoami($a), null, 'M: re-enabling does not resurrect the ended session');

    foreach ([['must_change_password', 1, 0, 'user_must_change_password'],
              ['is_legacy_placeholder', 1, 0, 'user_legacy_placeholder'],
              ['username', 'alson2', 'alson', 'user_mismatch']] as [$col, $bad, $good, $why]) {
        $a = browser();
        eq(callback($a, portal(start($a), 42, 'alson', 'member')), HOME, "M: alson signed in again ($col)");
        $setUser(42, $col, $bad);
        $n = count($LOG);
        eq(whoami($a), null, "M: $col switched after sign-in blocks the next request");
        ok(logged($n, "reason=$why"), "M: as $why");
        $setUser(42, $col, $good);
    }

    $a = browser();
    eq(callback($a, portal(start($a), 42, 'alson', 'member')), HOME, 'M: alson signed in again');
    putenv('DNC_USERS_DB_PASSWORD=wrong'); dc_dnc_users_db(true);
    eq(whoami($a), null, 'M: users database unreachable → the request is refused (fail closed)');
    ok($a->sid !== '', 'M: but the session is kept');
    setenv_all($ENV); dc_dnc_users_db(true);
    eq(whoami($a)['username'] ?? null, 'alson', 'M: and works again once the database is back');

    /* An app_users session does not touch the canonical database at all. */
    putenv('DNC_USERS_DB_HOST=192.0.2.1'); dc_dnc_users_db(true);
    $p = browser();
    req($p, function () { dc_session_start(); $_SESSION = ['dc_auth' => true, 'dc_user_id' => 7, 'dc_username' => 'nicholas',
        'dc_display_name' => 'Nicholas', 'dc_login_time' => time(), 'dc_user' => 'nicholas']; });
    $t0 = microtime(true);
    eq(whoami($p)['id'] ?? null, 7, 'M: an app_users session is unaffected by the canonical database');
    ok(microtime(true) - $t0 < 1.0, 'M: and does not try to reach it');
    setenv_all($ENV); dc_dnc_users_db(true);
}

// ══ N · secrets, the Portal URL, key rotation ══════════════════════════════
{
    putenv('DNC_HANDOFF_SECRET=');
    $a = browser(); $r = start($a); $n = count($LOG);
    eq(callback($a, portal($r, 42, 'alson', 'member')), LOGIN, 'N: no secret configured → refused');
    ok(logged($n, 'reason=bad_secret') && logged($n, 'auth.handoff_misconfigured'), 'N: bad_secret, flagged as misconfiguration');
    putenv('DNC_HANDOFF_SECRET=base64:' . base64_encode(random_bytes(31)));
    $a = browser(); $r = start($a); $n = count($LOG);
    eq(callback($a, portal($r, 42, 'alson', 'member')), LOGIN, 'N: a 31-byte secret → refused');
    ok(logged($n, 'reason=bad_secret'), 'N: bad_secret');
    setenv_all($ENV);

    $a = browser(); $r = start($a);
    $old = portal($r, 42, 'alson', 'member', null, $OLDKEY);
    $n = count($LOG);
    eq(callback($a, $old), LOGIN, 'N: a token under the old key is refused without DNC_HANDOFF_SECRET_PREVIOUS');
    ok(logged($n, 'reason=bad_signature'), 'N: bad_signature');
    putenv("DNC_HANDOFF_SECRET_PREVIOUS=$SECRET_OLD");
    $a = browser(); $r = start($a);
    eq(callback($a, portal($r, 42, 'alson', 'member', null, $OLDKEY)), HOME, 'N: and accepted while it is set (rotation)');
    setenv_all($ENV);

    $a = browser(); $r = start($a); $n = count($LOG);
    eq(callback($a, portal($r, 42, 'alson', 'member', null, $POKEY)), LOGIN, 'N: a token signed with the Internal PO key is refused');
    ok(logged($n, 'reason=bad_signature'), 'N: bad_signature');
    $a = browser(); $r = start($a); $n = count($LOG);
    eq(callback($a, portal($r, 42, 'alson', 'member', null, null, 'internal-po')), LOGIN, 'N: a token for audience internal-po is refused');
    ok(logged($n, 'reason=wrong_audience'), 'N: wrong_audience');
    $a = browser(); $r = start($a); $n = count($LOG);
    eq(callback($a, 'v1.' . substr(portal($r, 42, 'alson', 'member'), 3)), LOGIN, 'N: a v1 token is refused');
    ok(logged($n, 'reason=unsupported_version'), 'N: unsupported_version');
    $a = browser(); $r = start($a); $n = count($LOG);
    $good = portal($r, 42, 'alson', 'member');
    eq(callback($a, substr($good, 0, -1) . ($good[-1] === 'A' ? 'B' : 'A')), LOGIN, 'N: a tampered signature is refused');
    ok(logged($n, 'reason=bad_signature') || logged($n, 'reason=malformed'), 'N: bad_signature');
    eq(callback($a, $good), HOME, 'N: and the genuine token still works in that browser after it');

    foreach (['http://portal.dnchardware.com', 'https://portal.dnchardware.com/x', 'https://user@evil.example', 'javascript:alert(1)'] as $bad) {
        putenv("DNC_PORTAL_URL=$bad");
        $a = browser(); $n = count($LOG);
        eq(start($a), LOGIN, "N: DNC_PORTAL_URL \"$bad\" is not a plain https origin → /start refuses");
        ok(logged($n, 'reason=bad_portal_url'), 'N: bad_portal_url');
        eq($a->session[DC_HANDOFF_STATES] ?? [], [], 'N: and creates no state');
    }
    setenv_all($ENV);
}

// ══ O · rate limit: 30 per minute per IP, per endpoint ═════════════════════
{
    $a = browser(); $other = browser();
    $W0 = intdiv($T, 60) * 60 + 600;   // a fresh window of our own
    for ($i = 0; $i < 30; $i++) $last = start($a, [], $W0 + 1);
    eq($last['status'], 303, 'O: thirty starts in a minute are served');
    eq(start($a, [], $W0 + 2), ['status' => 429, 'location' => null], 'O: the thirty-first is 429');
    eq(start($other, [], $W0 + 2)['status'], 303, 'O: another IP is unaffected');
    eq(start($a, [], $W0 + 61)['status'], 303, 'O: and the next minute is served again');
    for ($i = 0; $i < 30; $i++) callback($a, 'junk', $W0 + 121);
    eq(callback($a, 'junk', $W0 + 121), ['status' => 429, 'location' => null], 'O: the callback is limited the same way');
    $ips = $q->query("SELECT COUNT(*) FROM handoff_rate_limits WHERE bucket LIKE '%10.20%'")->fetch_row()[0];
    eq((int)$ips, 0, 'O: no raw IP is stored');
}

// ══ P · replay rows are cleaned up opportunistically ═══════════════════════
{
    $q->query("INSERT INTO handoff_consumed_tokens VALUES ('" . str_repeat('a', 32) . "', 1, FROM_UNIXTIME(" . ($T - 7200) . "), FROM_UNIXTIME(" . ($T - 7260) . "))");
    $q->query("INSERT INTO handoff_consumed_tokens VALUES ('" . str_repeat('b', 32) . "', 1, FROM_UNIXTIME(" . ($T - 600) . "), FROM_UNIXTIME(" . ($T - 660) . "))");
    $a = browser();
    eq(callback($a, portal(start($a), 42, 'alson', 'member')), HOME, 'P: a successful handoff');
    eq((int)$q->query("SELECT COUNT(*) FROM handoff_consumed_tokens WHERE jti = '" . str_repeat('a', 32) . "'")->fetch_row()[0], 0,
       'P: deletes rows more than an hour past expiry');
    eq((int)$q->query("SELECT COUNT(*) FROM handoff_consumed_tokens WHERE jti = '" . str_repeat('b', 32) . "'")->fetch_row()[0], 1,
       'P: and keeps the recent ones');
}

// ══ Q · nothing secret in any log line or response ═════════════════════════
{
    $all = implode("\n", $LOG);
    $leaks = [];
    foreach (array_merge($TOKENS, $STATES, $SECRETS_SEEN) as $s) {
        if ($s === '' || $s === null) continue;
        foreach (explode('.', $s) as $part) if (strlen($part) >= 16 && strpos($all, $part) !== false) $leaks[] = substr($part, 0, 12) . '…';
    }
    eq($leaks, [], 'Q: no token, token segment, state, secret, password or session id in ' . count($LOG) . ' log lines');
    ok(count(array_filter($LOG, fn ($l) => !preg_match('/^\[handoff\] [a-z_.]+( [a-z]+=[A-Za-z0-9_.:\-]+)*$/', $l))) === 0,
       'Q: every log line is an event plus key=code pairs');
}

// ══ R · over real HTTP ═════════════════════════════════════════════════════
@mkdir("$SB/app/Handoff/Contract", 0777, true);
foreach (['auth.php', 'dnc_handoff.php', 'handoff.php', 'login.php', 'logout.php', 'index.php', 'companies.php', 'api.php',
          'pricing_history.php', 'app/Handoff/Contract/HandoffToken.php', 'app/Handoff/Contract/InvalidHandoffToken.php'] as $f) {
    copy("$ROOT/$f", "$SB/$f");
}
file_put_contents("$SB/db.php", "<?php function getDB(){ static \$d; if(!\$d){ \$d = new mysqli(" . var_export($H, true) . ','
    . var_export($U, true) . ',' . var_export($W, true) . ',' . var_export($QDB, true) . ",{$P}); \$d->set_charset('utf8mb4'); } return \$d; }\n");
/* What the host rewrite does: /auth/handoff/* → handoff.php. Nothing else. */
file_put_contents("$SB/router.php", '<?php
    $p = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
    if (strpos($p, "/auth/handoff/") === 0) { require __DIR__ . "/handoff.php"; return true; }
    return false;');
$writeConfig = function (array $over = []) use ($SB, $ENV) {
    file_put_contents("$SB/dnc_config.php", '<?php return ' . var_export(array_merge($ENV, $over), true) . ';');
};
$writeConfig();
$ok = true;
foreach (['auth.php', 'dnc_handoff.php', 'handoff.php', 'index.php', 'api.php'] as $f) $ok = $ok && sha1_file("$SB/$f") === sha1_file("$ROOT/$f");
ok($ok, 'R: the sandbox serves byte-identical copies of the shipped files');

$PORT = 36000 + ($PID % 900);
$LOGFILE = "$SB/php-error.log";
$env = [];
foreach (getenv() as $k => $v) if (strpos($k, 'DNC_') !== 0) $env[$k] = $v;   // config comes from dnc_config.php
$env['PHP_CLI_SERVER_WORKERS'] = '4';
$srv = proc_open([PHP_BINARY, '-d', "error_log=$LOGFILE", '-d', 'log_errors=1', '-d', 'display_errors=0',
                  '-d', "session.save_path=$SESS", '-S', "127.0.0.1:{$PORT}", '-t', $SB, "$SB/router.php"],
                 [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $srvPipes, $SB, $env);
register_shutdown_function(function () use (&$srv, &$srvPipes) {
    if (is_resource($srv)) { proc_terminate($srv); foreach ($srvPipes as $sp) if (is_resource($sp)) fclose($sp); proc_close($srv); }
});
$up = false;
for ($i = 0; $i < 60 && !$up; $i++) { $fp = @fsockopen('127.0.0.1', $PORT, $e1, $e2, 0.3); if ($fp) { fclose($fp); $up = true; } else usleep(200000); }
ok($up, "R: the sandbox server is listening on 127.0.0.1:{$PORT}");

/** A raw HTTP request. $https adds X-Forwarded-Proto: https (what the live proxy sends). */
function http($method, $path, ?string $cookie = null, bool $https = true, string $body = '') {
    global $PORT;
    $s = fsockopen('127.0.0.1', $PORT, $en, $es, 5);
    $req = "$method $path HTTP/1.1\r\nHost: quo.dnchardware.com\r\nConnection: close\r\n"
         . ($https ? "X-Forwarded-Proto: https\r\n" : '')
         . ($cookie ? "Cookie: $cookie\r\n" : '')
         . ($body !== '' ? "Content-Type: application/json\r\nContent-Length: " . strlen($body) . "\r\n" : '')
         . "\r\n" . $body;
    fwrite($s, $req);
    $raw = ''; while (!feof($s)) $raw .= fread($s, 65536);
    fclose($s);
    [$head, $content] = array_pad(explode("\r\n\r\n", $raw, 2), 2, '');
    $lines = explode("\r\n", $head);
    preg_match('#^HTTP/\S+ (\d+)#', array_shift($lines), $m);
    $h = []; $cookies = [];
    foreach ($lines as $l) {
        [$k, $v] = array_pad(explode(':', $l, 2), 2, '');
        $k = strtolower(trim($k)); $v = trim($v);
        if ($k === 'set-cookie') $cookies[] = $v; else $h[$k] = $v;
    }
    return ['status' => (int)($m[1] ?? 0), 'h' => $h, 'cookies' => $cookies, 'body' => $content];
}
function jar(array $r, ?string $old) {
    foreach ($r['cookies'] as $c) { $pair = explode(';', $c)[0]; return strpos($pair, '=deleted') !== false || substr($pair, -1) === '=' ? null : $pair; }
    return $old;
}
function handoff_headers_ok(array $r, string $label) {
    eq($r['body'], '', "$label: empty body");
    eq($r['h']['referrer-policy'] ?? null, 'no-referrer', "$label: Referrer-Policy: no-referrer");
    ok(strpos($r['h']['cache-control'] ?? '', 'no-store') !== false, "$label: Cache-Control: no-store");
}

if ($up) {
    $r = http('GET', '/auth/handoff/start?redirect_uri=https://evil.example&next=/x');
    eq($r['status'], 303, 'R: GET /auth/handoff/start → 303');
    handoff_headers_ok($r, 'R: /start');
    ok(preg_match('#^https://portal\.dnchardware\.com/handoff/authorize\?audience=quotation&state=[A-Za-z0-9_-]{43}$#', $r['h']['location'] ?? '') === 1,
       'R: Location is the fixed Portal authorize URL');
    eq(count($r['cookies']), 1, 'R: exactly one cookie is set — the session, no remember-me');
    $c = $r['cookies'][0] ?? '';
    ok(strpos($c, '__Host-DCQUOSESS=') === 0, 'R: the production cookie is __Host-DCQUOSESS');
    ok(stripos($c, '; secure') !== false && stripos($c, '; path=/') !== false && stripos($c, '; httponly') !== false
       && stripos($c, 'samesite=lax') !== false, 'R: Secure; Path=/; HttpOnly; SameSite=Lax');
    ok(stripos($c, 'domain=') === false, 'R: no Domain attribute — host-only, never .dnchardware.com');
    $cookie = jar($r, null);
    $STATES[] = state_of(['location' => $r['h']['location'] ?? '']);
    $SECRETS_SEEN[] = explode('=', (string)$cookie, 2)[1] ?? '';

    $token = portal(['location' => $r['h']['location'] ?? ''], 42, 'alson', 'member', time());
    $b = http('GET', '/auth/handoff/callback?token=' . $token, $cookie);
    eq($b['status'], 303, 'R: GET /auth/handoff/callback in the same browser → 303');
    eq($b['h']['location'] ?? null, '/', 'R: to Quotation home');
    handoff_headers_ok($b, 'R: /callback');
    $cookie2 = jar($b, $cookie);
    ok($cookie2 !== null && $cookie2 !== $cookie, 'R: with a new session cookie (regenerated id)');
    $SECRETS_SEEN[] = explode('=', (string)$cookie2, 2)[1] ?? '';

    $copy = http('GET', '/auth/handoff/callback?token=' . $token, null);
    eq([$copy['status'], $copy['h']['location'] ?? null], [303, '/login.php'], 'R: the copied callback URL in another browser → sign-in');
    handoff_headers_ok($copy, 'R: failed /callback');
    $lp = http('GET', '/login.php', jar($copy, null));
    ok(strpos($lp['body'], 'That sign-in link is invalid or has expired. Please sign in.') !== false,
       'R: the sign-in page then shows the one generic message');
    ok(strpos($lp['body'], 'state_mismatch') === false, 'R: and never the reason');

    $page = http('GET', '/index.php', $cookie2);
    eq($page['status'], 200, 'R: the signed-in DNC user opens Quotation');
    ok(strpos($page['body'], 'href="https://portal.dnchardware.com"') !== false, 'R: the page carries the DNC Workspace link');
    $co = http('GET', '/companies.php', $cookie2);
    ok($co['status'] === 200 && strpos($co['body'], 'href="https://portal.dnchardware.com"') !== false, 'R: and so does Companies');

    $q->query("INSERT INTO companies (name) VALUES ('Alpha Engineering Sdn Bhd')");
    $cid = (int)$q->insert_id;
    $save = http('POST', '/api.php?action=save_quotation', $cookie2, true, json_encode([
        'company_id' => $cid, 'ref_no' => '', 'quote_date' => date('Y-m-d'), 'valid_until' => '', 'prepared_by' => 'Desk',
        'remarks' => '', 'customer_name' => 'Beta', 'customer_phone' => '', 'total_amount' => 1,
        'items' => [['desc' => 'SAG ROD', 'size' => 'M20', 'qty' => 1, 'finalUnitPrice' => 1, 'totalAmount' => 1]]]));
    $sj = json_decode(trim($save['body']), true);
    ok(($sj['ok'] ?? false) === true, 'R: a DNC user saves a quotation through the shipped api.php (' . substr(trim($save['body']), 0, 120) . ')');
    $rev = $q->query('SELECT actor_user_id, actor_username, actor_display_name FROM quotation_revisions ORDER BY id DESC LIMIT 1');
    $rev = $rev ? $rev->fetch_assoc() : null;
    eq($rev, ['actor_user_id' => null, 'actor_username' => 'alson', 'actor_display_name' => 'Alson Tan'],
       'R: its revision: actor_user_id NULL, actor_username and display name from the canonical user');

    $setUser(42, 'is_active', 0);
    $page = http('GET', '/index.php', $cookie2);
    eq([$page['status'], strpos($page['h']['location'] ?? '', 'login.php') === 0], [302, true],
       'R: disabled in Internal PO → the next page request goes to sign-in');
    $api = http('POST', '/api.php?action=get_companies', $cookie2, true, '{}');
    eq($api['status'], 401, 'R: and the API answers 401');
    $setUser(42, 'is_active', 1);
    eq(http('GET', '/index.php', $cookie2)['status'], 302, 'R: the ended session stays ended');

    /* Concurrent duplicate in one browser: exactly one signs in. */
    $r = http('GET', '/auth/handoff/start');
    $ck = jar($r, null);
    $token = portal(['location' => $r['h']['location'] ?? ''], 43, 'ck', 'admin', time());
    $socks = [];
    for ($i = 0; $i < 2; $i++) {
        $socks[$i] = fsockopen('127.0.0.1', $PORT, $en, $es, 5);
        fwrite($socks[$i], "GET /auth/handoff/callback?token=$token HTTP/1.1\r\nHost: quo.dnchardware.com\r\nX-Forwarded-Proto: https\r\nCookie: $ck\r\nConnection: close\r\n\r\n");
    }
    $locs = [];
    foreach ($socks as $s) { $raw = ''; while (!feof($s)) $raw .= fread($s, 8192); fclose($s);
        preg_match('/\r\nLocation: (\S+)/i', $raw, $lm); $locs[] = $lm[1] ?? '?'; }
    sort($locs);
    eq($locs, ['/', '/login.php'], 'R: the same callback twice at once — exactly one succeeds');

    $plain = http('GET', '/auth/handoff/start', null, false);
    ok(strpos($plain['cookies'][0] ?? '', 'DCQUOSESS=') === 0 && stripos($plain['cookies'][0] ?? '', 'secure') === false,
       'R: on plain HTTP (local) the cookie keeps its bare name, without Secure');

    eq(http('GET', '/auth/handoff/other')['status'], 404, 'R: any other /auth/handoff/ path is 404');
    $post = http('POST', '/auth/handoff/start', null, true, '{}');
    eq($post['status'], 405, 'R: POST is 405');

    $writeConfig(['DNC_HANDOFF_ENABLED' => 'false']);
    $off = http('GET', '/auth/handoff/start');
    eq([$off['status'], $off['h']['location'] ?? null], [303, '/login.php'], 'R: switched off → /start goes to sign-in');
    eq($off['cookies'], [], 'R: and sets no cookie');
    $writeConfig();

    $all = (string)@file_get_contents($LOGFILE);
    $leaks = [];
    foreach (array_merge($TOKENS, $STATES, $SECRETS_SEEN) as $s) {
        foreach (explode('.', (string)$s) as $part) if (strlen($part) >= 16 && strpos($all, $part) !== false) $leaks[] = substr($part, 0, 12) . '…';
    }
    eq($leaks, [], 'R: the server error log holds no token, state, secret or session id');
    ok(strpos($all, '[handoff] auth.handoff_succeeded') !== false && strpos($all, 'reason=state_mismatch') !== false,
       'R: and does hold the reason codes');
    ok(stripos($all, 'Fatal') === false && stripos($all, 'Warning') === false, 'R: no PHP warning or fatal on any path');
}

// ── report ──────────────────────────────────────────────────────────────────
$label = 'DNC handoff — Quotation as a target, contract v2';
if ($failures) {
    echo "\n  FAIL  $label  ($asserts assertions, " . count($failures) . " failed)  [MySQL $server]\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    $label  ($asserts assertions)  [MySQL $server]\n\n";
