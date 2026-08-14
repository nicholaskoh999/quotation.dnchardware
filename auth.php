<?php
/**
 * Der-Cheng Quotation — simple shared-account login
 * Phase 1b · 2026-08-12 · built on v2.23.2
 *
 * ONE shared account. No database, no user table, no roles.
 * Concurrent sessions are fully supported: every browser gets its own PHP
 * session id, so 3-4 staff can be signed in at the same time and one person
 * logging out never affects anyone else.
 *
 * The password is NOT stored in plaintext — only a bcrypt hash, compared with
 * password_verify().
 *
 * Deliberately NOT included (single shared account makes them harmful or
 * pointless): account lockout — locking "admin" would lock out every member of
 * staff at once; password reset / OTP / email — nothing to reset against.
 */

// ── Credentials ──────────────────────────────────────────────────────────────
// Username staff type in.
const DC_AUTH_USER = 'admin';

// bcrypt hash of the agreed password. Generated with:
//     php -r 'echo password_hash("your-new-password", PASSWORD_DEFAULT);'
// To change the password later, replace ONLY this line with a new hash.
const DC_AUTH_PASS_HASH = '$2y$10$hpBPd9vpplFfyyJiIPceYuWcdbzBuc512Gaux1E2zjyvSlL82Gd.q';

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

/** True when this browser holds a valid, unexpired login. */
function dc_is_logged_in() {
    dc_session_start();
    if (empty($_SESSION['dc_auth']) || $_SESSION['dc_auth'] !== true) return false;

    // Absolute 7-day cap, independent of how the host prunes session files.
    $since = (int)($_SESSION['dc_login_time'] ?? 0);
    if ($since <= 0 || (time() - $since) > DC_AUTH_LIFETIME) {
        dc_logout();
        return false;
    }
    return true;
}

/**
 * Verify credentials and sign this browser in.
 * Returns true on success. Concurrent logins are allowed — nothing here
 * invalidates any other browser's session.
 */
function dc_login($username, $password) {
    dc_session_start();

    $userOk = hash_equals(DC_AUTH_USER, (string)$username);
    $passOk = password_verify((string)$password, DC_AUTH_PASS_HASH);

    // Compare both regardless of the first result (no early return), then a
    // short pause so guessing is slow. No lockout: one shared account means a
    // lockout would take the whole office offline.
    if (!$userOk || !$passOk) {
        usleep(400000); // 0.4s
        return false;
    }

    session_regenerate_id(true);       // new id after login (session fixation)
    $_SESSION['dc_auth'] = true;
    $_SESSION['dc_user'] = DC_AUTH_USER;
    $_SESSION['dc_login_time'] = time();
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
