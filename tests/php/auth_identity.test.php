<?php
ob_start();   /* BEFORE any output: PHP refuses to start a session once headers
                 are considered sent, and in CLI any byte of output counts. */
/**
 * ── Individual account identity ────────────────────────────────────────────
 *
 * Run:  php tests/php/auth_identity.test.php
 *
 * This includes the REAL auth.php and drives it with REAL PHP sessions. It can,
 * because auth.php loads no database: dc_login() takes the handle as an
 * argument, which is exactly the property under test. The handle here is a fake
 * that behaves the way mysqli behaves with MYSQLI_REPORT_OFF — returning false
 * rather than throwing — so a failure of the accepted PHP 8.4 contract shows up
 * as a failure here.
 *
 * No password, real or otherwise, is stored in this file. Hashes are generated
 * at runtime from throwaway strings.
 */

ini_set('session.save_path', sys_get_temp_dir());
error_reporting(E_ALL);

require_once __DIR__ . '/../../auth.php';

$asserts = 0; $failures = [];
function ok($cond, $msg) { global $asserts, $failures; $asserts++; if (!$cond) $failures[] = $msg; }
function eq($actual, $expected, $msg) {
    ok($actual === $expected, $msg . "\n      expected: " . var_export($expected, true)
                                   . "\n      actual:   " . var_export($actual, true));
}

/* ── a mysqli stand-in that returns values instead of throwing ──────────────
   It speaks bind_param / execute / bind_result / fetch — the PORTABLE prepared
   statement pattern. It has NO get_result() at all, so if auth.php ever reaches
   for one again these tests fail at once rather than passing on mysqlnd. */
class FakeStmt {
    public $bound = null; private $db; private $out = [];
    public function __construct($db) { $this->db = $db; }
    public function bind_param($types, &$v) {
        if ($this->db->failBindParam) return false;
        $this->bound = $v; return true;
    }
    public function execute() { $this->db->executes++; return !$this->db->failExecute; }
    public function bind_result(&...$cols) {
        if ($this->db->failBindResult) return false;
        $this->out = [];
        foreach ($cols as $i => &$c) { $this->out[$i] = &$c; }
        return true;
    }
    public function fetch() {
        if ($this->db->failFetch) return false;
        $this->db->lookedUp[] = $this->bound;
        $row = $this->db->rows[$this->bound] ?? null;
        if ($row === null) return null;                 // mysqli: null = no more rows
        $vals = [$row['id'], $row['username'], $row['display_name'],
                 $row['password_hash'], $row['enabled']];
        foreach ($vals as $i => $v) { if (array_key_exists($i, $this->out)) $this->out[$i] = $v; }
        return true;
    }
    public function close() { $this->db->closes++; return true; }
}
class FakeDb {
    public $rows = [];            // username => row
    public $failPrepare    = false;   // each returns false, as MYSQLI_REPORT_OFF does
    public $failBindParam  = false;
    public $failExecute    = false;
    public $failBindResult = false;
    public $failFetch      = false;
    public $executes = 0;
    public $closes   = 0;
    public $lookedUp = [];
    public function prepare($sql) { $this->lastSql = $sql; return $this->failPrepare ? false : new FakeStmt($this); }
    public $lastSql = '';
}

/* Throwaway credentials, hashed at runtime. Nothing here is a real password. */
$GLOBALS['PW_A'] = $PW_A = 'test-only-secret-A';
$GLOBALS['PW_B'] = $PW_B = 'test-only-secret-B';

function makeDb($pwA, $pwB) {
    $db = new FakeDb();
    $db->rows['nicholas'] = ['id' => 7,  'username' => 'nicholas', 'display_name' => 'Nicholas',
                             'password_hash' => password_hash($pwA, PASSWORD_DEFAULT), 'enabled' => 1];
    $db->rows['siewling'] = ['id' => 12, 'username' => 'siewling', 'display_name' => 'Siew Ling',
                             'password_hash' => password_hash($pwB, PASSWORD_DEFAULT), 'enabled' => 1];
    $db->rows['retired']  = ['id' => 3,  'username' => 'retired',  'display_name' => 'Retired Staff',
                             'password_hash' => password_hash($pwA, PASSWORD_DEFAULT), 'enabled' => 0];
    return $db;
}
$db = makeDb($PW_A, $PW_B);

/** Close whatever session is open, so its id can be changed. */
function closeSession() {
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
}
/** Re-open one specific session by id. */
function switchTo($id) {
    closeSession();
    session_id($id);
    dc_session_start();
}
/** Start from a guaranteed signed-out session with a brand-new id. */
function freshSession() {
    if (session_status() === PHP_SESSION_ACTIVE) { $_SESSION = []; session_destroy(); }
    closeSession();
    $_SESSION = [];
    session_id(bin2hex(random_bytes(16)));
    dc_session_start();
    $_SESSION = [];
}

// ══ A · valid user ══════════════════════════════════════════════════════════
{
    freshSession();
    ok(dc_login($db, 'nicholas', $PW_A) === true, 'A: a valid enabled user with the right password logs in');
    eq($_SESSION['dc_auth'], true,               'A: dc_auth is true');
    eq($_SESSION['dc_user_id'], 7,               'A: dc_user_id is the row id, as an int');
    eq($_SESSION['dc_username'], 'nicholas',     'A: dc_username is the stored username');
    eq($_SESSION['dc_display_name'], 'Nicholas', 'A: dc_display_name is the row display_name');
    ok(($_SESSION['dc_login_time'] ?? 0) > 0,    'A: dc_login_time is set and positive');
    eq($_SESSION['dc_user'], 'nicholas',         'A: the dc_user compatibility alias is the username');

    $u = dc_current_user();
    eq($u, ['id' => 7, 'username' => 'nicholas', 'display_name' => 'Nicholas'],
       'A: dc_current_user() returns the whole identity');
    ok(dc_is_logged_in() === true,               'A: and the session is considered logged in');
}

// ══ B · wrong password ══════════════════════════════════════════════════════
{
    freshSession();
    ok(dc_login($db, 'nicholas', 'not-the-password') === false, 'B: the wrong password FAILS');
    ok(empty($_SESSION['dc_auth']),      'B: no dc_auth is left behind');
    ok(!isset($_SESSION['dc_user_id']),  'B: no dc_user_id is left behind');
    ok(dc_current_user() === null,       'B: dc_current_user() is null');
    ok(dc_is_logged_in() === false,      'B: and the session is not logged in');
}

// ══ C · unknown user ════════════════════════════════════════════════════════
{
    freshSession();
    ok(dc_login($db, 'nobody', $PW_A) === false, 'C: an unknown username FAILS');
    ok(dc_current_user() === null,               'C: and leaves no identity');
    ok(dc_is_logged_in() === false,              'C: and no authenticated session');
}

// ══ D · disabled user ═══════════════════════════════════════════════════════
{
    freshSession();
    ok(dc_login($db, 'retired', $PW_A) === false,
       'D: enabled = 0 FAILS even with the CORRECT password');
    ok(dc_current_user() === null, 'D: and leaves no identity');
    /* The row still exists — deactivation must not be deletion, because a
       user_id may be referenced by history forever. */
    ok(isset($db->rows['retired']), 'D: the disabled account still exists in the table');
}

// ══ E · username normalisation ══════════════════════════════════════════════
{
    eq(dc_normalize_username('  Nicholas  '), 'nicholas', 'E: trimmed and lowercased');
    eq(dc_normalize_username('NICHOLAS'),     'nicholas', 'E: all caps normalises');
    eq(dc_normalize_username('nicholas'),     'nicholas', 'E: already-normal is unchanged');
    eq(dc_normalize_username(''),             '',         'E: empty stays empty');

    foreach (['Nicholas', 'NICHOLAS', '  nIcHoLaS  '] as $spelling) {
        freshSession();
        ok(dc_login($db, $spelling, $PW_A) === true, "E: '$spelling' signs in as the same person");
        eq($_SESSION['dc_user_id'], 7,               "E: '$spelling' resolves to ONE user_id");
        eq($_SESSION['dc_username'], 'nicholas',     "E: '$spelling' is stored normalised");
    }
    ok(!in_array('Nicholas', $db->lookedUp, true) && !in_array('NICHOLAS', $db->lookedUp, true),
       'E: the LOOKUP itself is normalised — no un-normalised username reaches SQL');
    /* display_name casing is never touched. */
    eq($_SESSION['dc_display_name'], 'Nicholas', 'E: display_name keeps its own casing');
}

// ══ F · session fixation ════════════════════════════════════════════════════
{
    freshSession();
    $before = session_id();
    ok(dc_login($db, 'nicholas', $PW_A) === true, 'F: login succeeds');
    $after = session_id();
    ok($before !== '' && $after !== '', 'F: a session id exists on both sides');
    ok($before !== $after, 'F: the session id CHANGES on successful login');
}

// ══ G · concurrent users ════════════════════════════════════════════════════
{
    freshSession();
    dc_login($db, 'nicholas', $PW_A);
    $idA = session_id(); $uidA = $_SESSION['dc_user_id'];
    session_write_close();

    freshSession();
    dc_login($db, 'siewling', $PW_B);
    $idB = session_id(); $uidB = $_SESSION['dc_user_id'];
    session_write_close();

    ok($idA !== $idB,   'G: two browsers hold two different session ids');
    eq($uidA, 7,        'G: session A is user 7');
    eq($uidB, 12,       'G: session B is user 12');
    ok($uidA !== $uidB, 'G: A and B are different people');

    /* Both must still be valid — one login must not invalidate the other. */
    switchTo($idA);
    ok(dc_is_logged_in() === true, 'G: session A is STILL authenticated after B logged in');
    eq(dc_current_user()['id'], 7, 'G: and still identifies user 7');
    session_write_close();

    switchTo($idB);
    ok(dc_is_logged_in() === true,  'G: session B is authenticated too');
    eq(dc_current_user()['id'], 12, 'G: and identifies user 12');
    session_write_close();

    // ══ H · logout isolation ════════════════════════════════════════════════
    switchTo($idA);
    dc_logout();
    ok(dc_current_user() === null, 'H: after logout, session A has no identity');

    switchTo($idB);
    ok(dc_is_logged_in() === true,  'H: session B REMAINS authenticated');
    eq(dc_current_user()['id'], 12, 'H: and still identifies user 12');
    session_write_close();
}

// ══ I · session expiry ══════════════════════════════════════════════════════
{
    freshSession();
    dc_login($db, 'nicholas', $PW_A);
    ok(dc_is_logged_in() === true, 'I: a fresh login is valid');

    $_SESSION['dc_login_time'] = time() - (DC_AUTH_LIFETIME + 60);
    ok(dc_is_logged_in() === false, 'I: a login older than the lifetime is rejected');
    ok(dc_current_user() === null,  'I: and the session is cleared, not merely reported invalid');

    freshSession();
    dc_login($db, 'nicholas', $PW_A);
    $_SESSION['dc_login_time'] = time() - (DC_AUTH_LIFETIME - 3600);
    ok(dc_is_logged_in() === true, 'I: one hour inside the lifetime is still valid');
    eq(DC_AUTH_LIFETIME, 604800,   'I: the absolute lifetime is still ~7 days');
}

// ══ L · the DB fails — authentication must fail CLOSED ══════════════════════
{
    foreach ([['failPrepare',    'prepare() returns false'],
              ['failBindParam',  'bind_param() returns false'],
              ['failExecute',    'execute() returns false'],
              ['failBindResult', 'bind_result() returns false'],
              ['failFetch',      'fetch() returns false']] as [$flag, $label]) {
        freshSession();
        $broken = makeDb($PW_A, $PW_B);
        $broken->$flag = true;
        $threw = false; $out = null;
        try { $out = dc_login($broken, 'nicholas', $PW_A); }
        catch (\Throwable $e) { $threw = true; }
        ok(!$threw,             "L: $label does not throw (the MYSQLI_REPORT_OFF contract)");
        ok($out === false,      "L: $label fails the login");
        ok(empty($_SESSION['dc_auth']), "L: $label leaves no authenticated session");
        ok(dc_current_user() === null,  "L: $label leaves no identity");
    }
    /* No handle at all — e.g. db.php missing, or getDB() unreachable. */
    freshSession();
    ok(dc_login(null, 'nicholas', $PW_A) === false, 'L: a null handle fails the login');
    ok(dc_current_user() === null,                  'L: and leaves no identity');
}

// ══ malformed session state must fail safely ════════════════════════════════
{
    freshSession();
    $_SESSION['dc_auth'] = true;          // the OLD shared-account shape
    $_SESSION['dc_user'] = 'admin';
    $_SESSION['dc_login_time'] = time();
    ok(dc_current_user() === null,
       'X: a legacy shared-account session carries no identity');
    ok(dc_is_logged_in() === false,
       'X: and is NOT trusted — the cutover does not leave anonymous actors signed in');

    foreach ([['dc_user_id', '7'], ['dc_user_id', 0], ['dc_username', ''], ['dc_display_name', '']] as [$k, $bad]) {
        freshSession();
        dc_login($db, 'nicholas', $PW_A);
        $_SESSION[$k] = $bad;
        ok(dc_current_user() === null, "X: a session whose $k is " . var_export($bad, true) . ' fails safely');
    }
}

// ══ F1 · every credential failure does the SAME bcrypt work ═════════════════
{
    /* Deterministic, not wall-clock. The proof is structural: there is exactly
       ONE password_verify() call in the shipped file and it is NOT guarded, so
       every path that reaches the decision runs it. The old code guarded it
       with `$hash !== '' &&`, which skipped bcrypt entirely for an unknown
       username — the finding this fixes. */
    $authSrc  = file_get_contents(__DIR__ . '/../../auth.php');
    $codeOnly = $authSrc;
    foreach (token_get_all($authSrc) as $tok) {
        if (is_array($tok) && ($tok[0] === T_COMMENT || $tok[0] === T_DOC_COMMENT)) {
            $at = strpos($codeOnly, $tok[1]);
            if ($at !== false) $codeOnly = substr_replace($codeOnly, str_repeat(' ', strlen($tok[1])), $at, strlen($tok[1]));
        }
    }
    eq(substr_count($codeOnly, 'password_verify('), 1,
       'F1: exactly ONE password_verify() call exists in the code');
    ok(preg_match('/\$passOk\s*=\s*password_verify\(\$pass, \$hash\);/', $codeOnly),
       'F1: it is a plain assignment — no condition can skip it');
    ok(strpos($codeOnly, '$hash !== \'\' && password_verify') === false,
       'F1: the old short-circuit that skipped bcrypt for an unknown user is gone');
    ok(strpos($codeOnly, 'if ($hash === \'\') $hash = DC_AUTH_DUMMY_HASH;') !== false,
       'F1: a missing hash falls back to the decoy rather than to an empty string');

    /* The decoy must be REAL bcrypt work, at the cost this runtime produces. */
    ok(defined('DC_AUTH_DUMMY_HASH'), 'F1: the decoy hash constant exists');
    $info = password_get_info(DC_AUTH_DUMMY_HASH);
    eq($info['algoName'], 'bcrypt', 'F1: the decoy is a real bcrypt hash, not a placeholder string');
    $ref = password_get_info(password_hash('x', PASSWORD_DEFAULT));
    eq($info['options']['cost'] ?? null, $ref['options']['cost'] ?? null,
       'F1: the decoy cost matches what PASSWORD_DEFAULT produces here — equal work');
    ok(password_verify('', DC_AUTH_DUMMY_HASH) === false
       && password_verify('admin', DC_AUTH_DUMMY_HASH) === false
       && password_verify('password', DC_AUTH_DUMMY_HASH) === false,
       'F1: the decoy verifies against no guessable password');

    /* And it can never authenticate: no row means the row check fails whatever
       password_verify() returned. Proven by seeding a user whose stored hash IS
       the decoy and then signing in as a DIFFERENT, unknown username. */
    freshSession();
    $decoyDb = new FakeDb();
    $decoyDb->rows['someone'] = ['id' => 1, 'username' => 'someone', 'display_name' => 'Someone',
                                 'password_hash' => DC_AUTH_DUMMY_HASH, 'enabled' => 1];
    ok(dc_login($decoyDb, 'nobody-at-all', 'anything') === false,
       'F1: the decoy path cannot authenticate an unknown user');
    ok(dc_current_user() === null, 'F1: and leaves no identity');

    /* Both failure kinds reach the SAME lookup-then-verify shape. */
    freshSession();
    $probe = makeDb($GLOBALS['PW_A'], $GLOBALS['PW_B']);
    ok(dc_login($probe, 'nobody', 'whatever') === false, 'F1: unknown user fails');
    eq($probe->executes, 1, 'F1: the unknown-user path still performs the DB lookup');
    freshSession();
    $probe2 = makeDb($GLOBALS['PW_A'], $GLOBALS['PW_B']);
    ok(dc_login($probe2, 'nicholas', 'wrong-password') === false, 'F1: wrong password fails');
    eq($probe2->executes, 1, 'F1: the wrong-password path performs one lookup too');

    /* Wall-clock, as CORROBORATION only — a generous ratio, never the proof. */
    $t0 = microtime(true); freshSession(); dc_login(makeDb($GLOBALS['PW_A'], $GLOBALS['PW_B']), 'nobody', 'whatever');
    $unknown = microtime(true) - $t0;
    $t1 = microtime(true); freshSession(); dc_login(makeDb($GLOBALS['PW_A'], $GLOBALS['PW_B']), 'nicholas', 'wrong-password');
    $wrong = microtime(true) - $t1;
    $ratio = $wrong > 0 ? $unknown / $wrong : 0;
    ok($ratio > 0.5 && $ratio < 2.0,
       sprintf('F1: the two failures cost comparable wall-clock (ratio %.2f, unknown %.3fs vs wrong %.3fs)',
               $ratio, $unknown, $wrong));
}

// ══ F2 · the lookup is portable — no mysqlnd-only get_result() ══════════════
{
    $authSrc = file_get_contents(__DIR__ . '/../../auth.php');
    ok(strpos($authSrc, '->get_result(') === false,
       'F2: the shipped auth.php contains no ->get_result( — no mysqlnd dependency');
    ok(strpos($authSrc, 'bind_result(') !== false, 'F2: it uses bind_result()');
    ok(preg_match('/\$stmt->fetch\(\) === true/', $authSrc),
       'F2: and checks fetch() strictly against true, so null (no row) is not a login');
    ok(preg_match('/LIMIT 1/', $authSrc), 'F2: the query is bounded to one row');
    ok(preg_match('/\$stmt->close\(\);/', $authSrc),
       'F2: and the statement is closed, so no unfetched result is left on the connection');

    /* The fake driver has no get_result() method at all — if auth.php called
       one, every login test above would already have failed. */
    ok(!method_exists('FakeStmt', 'get_result'),
       'F2: the test driver deliberately offers no get_result() to fall back on');

    /* One row is retrieved with all five columns. */
    freshSession();
    $db2 = makeDb($GLOBALS['PW_A'], $GLOBALS['PW_B']);
    ok(dc_login($db2, 'siewling', $GLOBALS['PW_B']) === true, 'F2: a real login still works through bind_result/fetch');
    eq($_SESSION['dc_user_id'], 12,          'F2: id came back');
    eq($_SESSION['dc_username'], 'siewling', 'F2: username came back');
    eq($_SESSION['dc_display_name'], 'Siew Ling', 'F2: display_name came back');
    eq($db2->closes, 1, 'F2: the statement was closed exactly once');
    foreach (['id','username','display_name','password_hash','enabled'] as $col) {
        ok(strpos($db2->lastSql, $col) !== false, "F2: the SELECT retrieves $col");
    }
}

// ══ M/J/K/N · source-level contracts ════════════════════════════════════════
{
    $auth  = file_get_contents(__DIR__ . '/../../auth.php');
    $login = file_get_contents(__DIR__ . '/../../login.php');
    $sql   = file_get_contents(__DIR__ . '/../../migrations/2026-08-26-create-app-users.sql');

    // M · password storage
    ok(strpos($auth, 'password_verify(') !== false, 'M: password_verify() is used');
    ok(strpos($auth, 'DC_AUTH_PASS_HASH') === false, 'M: the shared-account hash constant is gone');
    ok(strpos($auth, 'DC_AUTH_USER') === false,      'M: the shared-account username constant is gone');
    ok(!preg_match('/\$2y\$[A-Za-z0-9.\/]{20,}/', $auth . $login . $sql),
       'M: no bcrypt hash is committed in auth.php, login.php or the migration');
    ok(strpos($auth, 'password_hash') === false || strpos($auth, 'password_hash\']') !== false,
       'M: auth.php only READS a hash, it does not embed one');

    // no shared-account fallback anywhere
    /* Checked on a COMMENT-BLANKED copy: auth.php's header legitimately explains
       that the shared 'admin' account is what this change replaced. The claim is
       about the program, not the commentary. */
    $authCode = $auth;
    foreach (token_get_all($auth) as $tok) {
        if (is_array($tok) && ($tok[0] === T_COMMENT || $tok[0] === T_DOC_COMMENT)) {
            $at = strpos($authCode, $tok[1]);
            if ($at !== false) $authCode = substr_replace($authCode, str_repeat(' ', strlen($tok[1])), $at, strlen($tok[1]));
        }
    }
    ok(stripos($authCode, "'admin'") === false,
       'M: no hard-coded admin account remains in auth.php CODE');
    ok(!preg_match('/(DC_AUTH_USER|DC_AUTH_PASS_HASH)/', $authCode),
       'M: and neither shared-account constant is referenced in code');

    // J · page guard  ·  K · API guard
    ok(preg_match('/function dc_require_login\(\)[\s\S]{0,300}Location: login\.php/', $auth),
       'J: the page guard still redirects to login.php');
    ok(preg_match('/function dc_require_api_login\(\)[\s\S]{0,400}http_response_code\(401\)/', $auth),
       'K: the API guard still returns HTTP 401');
    ok(preg_match('/function dc_require_api_login\(\)[\s\S]{0,400}application\/json/', $auth),
       'K: and returns JSON');
    ok(preg_match('/function dc_require_api_login\(\)[\s\S]{0,200}if \(dc_is_logged_in\(\)\) return;/', $auth),
       'K: and it gates on dc_is_logged_in(), which now requires an identity');

    // session security properties, unchanged
    ok(strpos($auth, "session_regenerate_id(true)") !== false, 'S: session id is regenerated on login');
    ok(strpos($auth, "'httponly' => true") !== false,          'S: the cookie stays HttpOnly');
    ok(strpos($auth, "'samesite' => 'Lax'") !== false,         'S: SameSite stays Lax');
    ok(strpos($auth, "'secure'   => dc_is_https()") !== false, 'S: Secure still follows HTTPS');
    ok(strpos($auth, "session_name('DCQUOSESS')") !== false,   'S: the session name is unchanged');
    ok(strpos($auth, 'session_destroy()') !== false,           'S: logout still destroys this session only');

    // auth.php must remain free of any database dependency
    ok(!preg_match('/^\s*(require|include)(_once)?\s/m', $auth),
       'S: auth.php requires nothing — it still loads no database');
    ok(strpos($auth, 'getDB(') === false, 'S: and never calls getDB()');
    ok(preg_match('/function dc_login\(\$db,/', $auth),
       'S: dc_login takes the handle as an argument');

    // login.php · the PHP 8.4 contract and lazy loading
    $callAt = strpos($login, 'mysqli_report(MYSQLI_REPORT_OFF);');
    $reqAt  = strpos($login, "require_once \$path;");
    ok($callAt !== false, 'S: login.php calls mysqli_report(MYSQLI_REPORT_OFF)');
    ok($reqAt !== false && $callAt < $reqAt,
       'S: and calls it BEFORE db.php is required');
    ok(strpos($login, 'dc_login(dc_login_db(), $u, $p)') !== false,
       'S: login.php passes the handle into dc_login');
    ok(preg_match('/function dc_login_db\(\)/', $login),
       'S: the handle is opened by a dedicated function, not at file scope');
    ok(!preg_match('/^require_once __DIR__ \. \'\/db\.php\';/m', $login),
       'S: db.php is NOT required at the top of login.php — a GET opens no connection');

    // identity may never come from the client
    ok(!preg_match('/dc_user_id.{0,40}\$_(POST|GET|REQUEST)/s', $auth . $login),
       'S: no identity field is ever taken from client input');

    // N · the migration's unique-username contract
    ok(strpos($sql, 'UNIQUE KEY uq_app_users_username (username)') !== false,
       'N: the migration declares UNIQUE on username');
    ok(strpos($sql, 'CREATE TABLE IF NOT EXISTS app_users') !== false,
       'N: it creates app_users');
    foreach (['id', 'username', 'display_name', 'password_hash', 'enabled', 'created_at'] as $col) {
        ok(preg_match('/^\s{2}' . $col . '\s/m', $sql), "N: the migration declares $col");
    }
    ok(strpos($sql, 'NOT APPLIED') !== false, 'N: the migration states it is NOT APPLIED');
    ok(!preg_match('/^\s*DROP\s+TABLE/mi', $sql),
       'N: no uncommented DROP TABLE can run by executing the file top to bottom');
    ok(!preg_match('/^\s*INSERT\s+INTO\s+app_users/mi', $sql),
       'N: the migration creates NO accounts — structure only');
}

// ── report ───────────────────────────────────────────────────────────────────
ob_end_clean();
$name = 'actor identity — one person per session, verified by the server';
if ($failures) {
    echo "\n  FAIL  $name  ($asserts assertions, " . count($failures) . " failed)\n\n";
    foreach ($failures as $f) echo "   - $f\n";
    echo "\n";
    exit(1);
}
echo "\n  ok    $name  ($asserts assertions)\n\n";
