<?php
/**
 * Der-Cheng Quotation — individual account login
 *
 * Each member of staff has their OWN account in app_users, so the server knows
 * WHICH PERSON is making a request. That is the whole reason this file changed:
 * a quotation's history can only say who edited it if the session carries an
 * identity, and until now every session was the same shared 'admin'.
 *
 * Concurrent sessions are still fully supported: every browser gets its own PHP
 * session id, so several staff can be signed in at the same time and one person
 * logging out never affects anyone else.
 *
 * Passwords are NOT stored in plaintext — a bcrypt hash lives in
 * app_users.password_hash and is compared with password_verify().
 *
 * THIS FILE STILL DOES NOT LOAD THE DATABASE. It is required by index.php,
 * companies.php, api.php, login.php and logout.php; making it open a connection
 * would put one behind every page. dc_login() takes the handle as an ARGUMENT,
 * and login.php — the only caller — is the only file that loads db.php.
 *
 * Deliberately NOT included, and not in this round's scope: roles, permissions,
 * account lockout, rate limiting, password reset, OTP, 2FA, SSO, API tokens and
 * any user-management screen. Accounts are created by an operator in SQL.
 */

// Stay signed in for ~7 days.
const DC_AUTH_LIFETIME = 604800; // 7 * 24 * 60 * 60

// ── Session bootstrap ────────────────────────────────────────────────────────

/** True when the request arrived over HTTPS (handles LiteSpeed/proxy headers). */
function dc_is_https() {
    if (!empty($_SERVER['HTTPS']) && strtolower($_SERVER['HTTPS']) !== 'off') return true;
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') return true;
    if (!empty($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) return true;
    return false;
}

/**
 * Start the app session with cookie flags: HttpOnly, SameSite=Lax,
 * Secure (on HTTPS — the live site), 7-day lifetime.
 * Safe to call more than once.
 */
function dc_session_start() {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    // Keep server-side session data alive as long as the cookie.
    @ini_set('session.gc_maxlifetime', (string)DC_AUTH_LIFETIME);
    @ini_set('session.use_strict_mode', '1'); // reject attacker-supplied session ids

    session_name('DCQUOSESS');

    $params = [
        'lifetime' => DC_AUTH_LIFETIME,
        'path'     => '/',
        'secure'   => dc_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params($params);
    } else {
        // PHP 7.2 and older have no samesite key — append it to the path.
        session_set_cookie_params(
            $params['lifetime'], $params['path'] . '; SameSite=Lax',
            '', $params['secure'], $params['httponly']
        );
    }

    session_start();
}

// ── State ────────────────────────────────────────────────────────────────────

/** True when this browser holds a valid, unexpired login BY A KNOWN PERSON. */
function dc_is_logged_in() {
    dc_session_start();
    if (empty($_SESSION['dc_auth']) || $_SESSION['dc_auth'] !== true) return false;

    /* An authenticated session must carry an identity. A session holding only
       the old shared-account shape — dc_auth with no dc_user_id — is NOT
       trusted, which is deliberate: on cutover every shared 'admin' session
       must stop being accepted rather than quietly become an actor nobody can
       name. It is also what makes a half-written session fail safely. */
    if (dc_current_user() === null) return false;

    // Absolute 7-day cap, independent of how the host prunes session files.
    $since = (int)($_SESSION['dc_login_time'] ?? 0);
    if ($since <= 0 || (time() - $since) > DC_AUTH_LIFETIME) {
        dc_logout();
        return false;
    }
    return true;
}

/**
 * The authenticated person, or null. THE one way for application code to ask
 * who is acting — future audit code reads this and never $_SESSION directly,
 * so the session shape can change without a search-and-replace.
 *
 * Every value comes from the row that was verified at login. Nothing here is
 * ever read from POST, JSON, a cookie or any other client-controlled input.
 * Malformed session state returns null rather than a partial actor.
 */
function dc_current_user() {
    dc_session_start();
    if (empty($_SESSION['dc_auth']) || $_SESSION['dc_auth'] !== true) return null;

    $id      = $_SESSION['dc_user_id'] ?? null;
    $user    = $_SESSION['dc_username'] ?? null;
    $display = $_SESSION['dc_display_name'] ?? null;

    if (!is_int($id) || $id <= 0)                      return null;
    if (!is_string($user) || $user === '')             return null;
    if (!is_string($display) || $display === '')       return null;

    return ['id' => $id, 'username' => $user, 'display_name' => $display];
}

/**
 * ONE username spelling per person. Trimmed and lowercased on the way in and on
 * the way to the lookup, and UNIQUE in the table, so "Nicholas", "NICHOLAS" and
 * "nicholas" are one identity and not three. display_name keeps its own casing
 * — that is what a person is CALLED, not how they are addressed by the system.
 */
function dc_normalize_username($raw) {
    return strtolower(trim((string)$raw));
}

/**
 * Verify credentials against app_users and sign this browser in.
 * Returns true on success. Concurrent logins are allowed — nothing here
 * invalidates any other browser's session.
 *
 * $db is PASSED IN, never fetched. That is what keeps this file free of any
 * database dependency: login.php is the only caller and the only file that
 * loads db.php.
 *
 * FAILS CLOSED, without exception. No handle, a prepare that fails, an execute
 * that fails, no such user, enabled = 0, a bad password, or a row missing the
 * fields an identity needs — every one of them returns false and leaves the
 * session exactly as it was. There is no shared-account fallback: it would be a
 * permanent backdoor, and application rollback already restores the old app.
 *
 * The caller is expected to have put mysqli into MYSQLI_REPORT_OFF, which is
 * the contract the rest of this application is written against. The `!$stmt`
 * and `!execute()` checks below are that contract; under PHP 8.1+ defaults
 * those calls would throw instead and this function would never see false.
 */
function dc_login($db, $username, $password) {
    dc_session_start();

    $user = dc_normalize_username($username);
    $pass = (string)$password;

    /* Look up first, THEN decide — and always spend the same 0.4s on any
       failure, so a wrong username and a wrong password are not distinguishable
       by how long the answer took. No lockout in this round: it is recorded as
       a future security item, not smuggled in here. */
    $row = null;
    if ($user !== '' && $pass !== '' && is_object($db) && method_exists($db, 'prepare')) {
        $stmt = $db->prepare('SELECT id, username, display_name, password_hash, enabled
                                FROM app_users WHERE username = ? LIMIT 1');
        if ($stmt) {
            $stmt->bind_param('s', $user);
            if ($stmt->execute()) {
                $res = $stmt->get_result();
                if ($res) $row = $res->fetch_assoc();
            }
            $stmt->close();
        }
    }

    $hash    = is_array($row) ? (string)($row['password_hash'] ?? '') : '';
    $enabled = is_array($row) ? (int)($row['enabled'] ?? 0) : 0;
    $passOk  = $hash !== '' && password_verify($pass, $hash);

    if (!is_array($row) || $enabled !== 1 || !$passOk) {
        usleep(400000); // 0.4s
        return false;
    }

    $id      = (int)($row['id'] ?? 0);
    $display = trim((string)($row['display_name'] ?? ''));
    $stored  = dc_normalize_username($row['username'] ?? '');
    if ($id <= 0 || $display === '' || $stored === '') {
        usleep(400000);
        return false;                  // a row that cannot name a person is not a login
    }

    session_regenerate_id(true);       // new id after login (session fixation)
    $_SESSION['dc_auth']         = true;
    $_SESSION['dc_user_id']      = $id;
    $_SESSION['dc_username']     = $stored;
    $_SESSION['dc_display_name'] = $display;
    $_SESSION['dc_login_time']   = time();
    /* Compatibility alias for any code still reading the old key. NOT the
       canonical actor field — dc_current_user() is. */
    $_SESSION['dc_user']         = $stored;
    return true;
}

/** Sign out THIS browser only. Other staff/devices keep their sessions. */
function dc_logout() {
    dc_session_start();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

// ── Guards ───────────────────────────────────────────────────────────────────

/** Only allow same-site relative paths as a post-login redirect target. */
function dc_safe_next($raw) {
    $raw = (string)$raw;
    if ($raw === '' || $raw[0] !== '/' || strpos($raw, '//') === 0 || strpos($raw, "\\") !== false) {
        return '/index.php';
    }
    return $raw;
}

/**
 * Page guard (index.php, companies.php).
 * Must run before ANY output — these files emit HTML immediately.
 */
function dc_require_login() {
    if (dc_is_logged_in()) return;
    $next = $_SERVER['REQUEST_URI'] ?? '/index.php';
    header('Location: login.php?next=' . rawurlencode($next), true, 302);
    exit;
}

/** API guard (api.php) — JSON 401, never an HTML redirect. */
function dc_require_api_login() {
    if (dc_is_logged_in()) return;
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'Not signed in', 'auth' => false]);
    exit;
}
