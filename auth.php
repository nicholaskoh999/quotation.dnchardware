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
 *
 * DNC WORKSPACE HANDOFF (dnc_handoff.php) adds a second kind of session: one
 * established from the Portal, whose identity is a canonical DNC user and not
 * an app_users row. dc_current_user() reports it with source 'dnc'. Only for
 * such a session does dc_is_logged_in() load dnc_handoff.php and re-read the
 * canonical row; app_users sessions behave exactly as before.
 */

// Stay signed in for ~7 days.
const DC_AUTH_LIFETIME = 604800; // 7 * 24 * 60 * 60

/**
 * A real bcrypt hash of a random string that was generated once, never written
 * down, and immediately discarded. It exists so that dc_login() can run
 * password_verify() on EVERY credential failure, including one where no user
 * row was found — otherwise an unknown username returns without doing bcrypt
 * work while a known username pays for it, which is a username-enumeration
 * signal. Equalising the verification cost narrows that signal; it does not
 * make the two requests identical end to end.
 *
 * It authenticates nothing. It is only ever reached when there is no usable
 * row, and the row check below fails the login regardless of what
 * password_verify() returns. Even someone who knew the discarded preimage
 * could not sign in with it.
 *
 * Its cost factor matches what password_hash(..., PASSWORD_DEFAULT) produces
 * on this runtime, so the decoy costs what a real verification costs.
 */
const DC_AUTH_DUMMY_HASH = '$2y$12$beZY8mkX8rSDm4Cd/E0/D.dmpbugEPQBbP/QWXjTFwZbyr8MmSeoK';

// ── Base path (same-origin Portal mount) ─────────────────────────────────────

/**
 * The URL path this copy of the app is served under, with no trailing slash:
 * '' on https://quo.dnchardware.com/, '/quo' when the same files are served as
 * a real directory at https://portal.dnchardware.com/quo/ (so the installed
 * DNC Workspace app keeps Quotation inside its own window). Read from
 * SCRIPT_NAME, which the web server sets from the URL of the script it ran —
 * every entry point lives in the app root, so its directory IS the base.
 * Anything that is not a plain path of simple segments reads as ''.
 */
function dc_base_path() {
    $dir = str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/index.php')));
    $dir = rtrim($dir, '/');
    if ($dir === '' || $dir === '.') return '';
    if (preg_match('#^(?:/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$#', $dir) !== 1 || strpos($dir, '/..') !== false) return '';
    return $dir;
}

/** An app path ('/login.php', '/') as a URL path for this copy: dc_url('/') is '/' or '/quo/'. */
function dc_url($path) {
    return dc_base_path() . '/' . ltrim((string)$path, '/');
}

/**
 * A request path with this copy's base removed, so routing sees the same
 * logical path in both places: '/quo/auth/handoff/start' -> '/auth/handoff/start'
 * under '/quo'. A path outside the base is returned unchanged (and matches
 * nothing that expects the base).
 */
function dc_app_path($path) {
    $path = (string)$path;
    $base = dc_base_path();
    if ($base === '') return $path;
    if ($path === $base) return '/';
    if (strpos($path, $base . '/') === 0) return substr($path, strlen($base));
    return $path;
}

// ── Session bootstrap ────────────────────────────────────────────────────────

/** True when the request arrived over HTTPS (handles LiteSpeed/proxy headers). */
function dc_is_https() {
    if (!empty($_SERVER['HTTPS']) && strtolower($_SERVER['HTTPS']) !== 'off') return true;
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') return true;
    if (!empty($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) return true;
    return false;
}

/**
 * The session cookie's name. On HTTPS (the live site) it carries the __Host-
 * prefix, which browsers accept only with Secure, Path=/ and NO Domain — so no
 * other *.dnchardware.com host can plant or overwrite a Quotation session
 * (DNC handoff contract §14.2). Plain HTTP (local only) cannot carry the
 * prefix and keeps the bare name. Renaming the cookie signs everyone out once.
 */
function dc_session_cookie_name() {
    return dc_is_https() ? '__Host-DCQUOSESS' : 'DCQUOSESS';
}

/**
 * Start the app session with cookie flags: HttpOnly, SameSite=Lax,
 * Secure (on HTTPS — the live site), Path=/, host-only (no Domain), 7-day
 * lifetime. Safe to call more than once.
 *
 * Under the Portal mount (dc_base_path() '/quo') the same cookie is bound to
 * portal.dnchardware.com, still with Path=/: __Host- forbids any other path.
 * It is a separate session from the one on quo.dnchardware.com, and the
 * browser also sends it with the Portal's own requests (the Portal ignores
 * it; its own cookie has a different name). That is why the CSRF gate below
 * exists: the cookie alone no longer marks a request as Quotation's.
 */
function dc_session_start() {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    // Keep server-side session data alive as long as the cookie.
    @ini_set('session.gc_maxlifetime', (string)DC_AUTH_LIFETIME);
    @ini_set('session.use_strict_mode', '1'); // reject attacker-supplied session ids

    session_name(dc_session_cookie_name());

    $params = [
        'lifetime' => DC_AUTH_LIFETIME,
        'path'     => '/',
        /* Explicitly empty: host-only, whatever session.cookie_domain the host
           sets. Never .dnchardware.com — Portal, PO and Quotation never share
           a cookie. */
        'domain'   => '',
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
    $user = dc_current_user();
    if ($user === null) return false;

    // Absolute 7-day cap, independent of how the host prunes session files.
    $since = (int)($_SESSION['dc_login_time'] ?? 0);
    if ($since <= 0 || (time() - $since) > DC_AUTH_LIFETIME) {
        dc_logout();
        return false;
    }

    /* A DNC Workspace session is re-checked against the canonical users row on
       EVERY protected request, so disabling someone in Internal PO ends their
       Quotation access on their next request. Only DNC sessions pay for this:
       dnc_handoff.php (and its read-only connection) is loaded for them alone,
       and an app_users session still queries nothing per request. */
    if (($user['source'] ?? null) === 'dnc') {
        require_once __DIR__ . '/dnc_handoff.php';
        $check = dc_dnc_session_check($user);
        if ($check === 'unavailable') return false;   // refuse this request, keep the session
        if ($check !== 'ok') {
            dc_handoff_log('auth.dnc_session_revoked', ['reason' => $check, 'sub' => $user['dnc_user_id']]);
            dc_logout();
            return false;
        }
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

    /* A DNC Workspace handoff session (dnc_handoff.php). Its identity is the
       canonical users.id, which is NOT an app_users id: it is reported as
       dnc_user_id with source 'dnc', and id is NULL, so nothing can record it
       as an app_users actor (revision history records actor_user_id NULL). */
    if (array_key_exists('dc_auth_source', $_SESSION)) {
        if ($_SESSION['dc_auth_source'] !== 'dnc') return null;
        $did     = $_SESSION['dc_dnc_user_id'] ?? null;
        $user    = $_SESSION['dc_username'] ?? null;
        $display = $_SESSION['dc_display_name'] ?? null;
        if (!is_int($did) || $did <= 0)                return null;
        if (!is_string($user) || $user === '')         return null;
        if (!is_string($display) || $display === '')   return null;
        return ['id' => null, 'username' => $user, 'display_name' => $display,
                'source' => 'dnc', 'dnc_user_id' => $did];
    }

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

    /* bind_result()/fetch(), NOT get_result(): get_result() needs the mysqlnd
       driver, and nothing else in this application depends on it. LIMIT 1 plus
       close() means there is never an unfetched row left on the connection.

       Every step is return-checked, which is the MYSQLI_REPORT_OFF contract the
       rest of this application is written against. */
    $row = null;
    if ($user !== '' && is_object($db) && method_exists($db, 'prepare')) {
        $stmt = $db->prepare('SELECT id, username, display_name, password_hash, enabled
                                FROM app_users WHERE username = ? LIMIT 1');
        if ($stmt) {
            $rId = $rUser = $rName = $rHash = $rEnabled = null;
            if ($stmt->bind_param('s', $user)
             && $stmt->execute()
             && $stmt->bind_result($rId, $rUser, $rName, $rHash, $rEnabled)
             && $stmt->fetch() === true) {
                $row = ['id' => $rId, 'username' => $rUser, 'display_name' => $rName,
                        'password_hash' => $rHash, 'enabled' => $rEnabled];
            }
            $stmt->close();
        }
    }

    /* password_verify() runs on EVERY path, against the real hash when a row
       was found and against the decoy constant when one was not. An unknown
       username therefore pays the same bcrypt verification cost as a known
       username. This reduces the username-enumeration timing signal; it does
       not guarantee identical end-to-end request timing, because database and
       control-flow costs may still differ. */
    $hash    = is_array($row) ? (string)($row['password_hash'] ?? '') : '';
    if ($hash === '') $hash = DC_AUTH_DUMMY_HASH;
    $enabled = is_array($row) ? (int)($row['enabled'] ?? 0) : 0;
    $passOk  = password_verify($pass, $hash);

    if (!is_array($row) || $enabled !== 1 || !$passOk) {
        usleep(400000); // 0.4s — a floor under every failure, on top of the above
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
    /* A password sign-in is an app_users identity: nothing of an earlier DNC
       Workspace session in this browser may survive into it — the pre-login
       CSRF token included (a new one is minted on first use). */
    unset($_SESSION['dc_auth_source'], $_SESSION['dc_dnc_user_id'], $_SESSION['dc_dnc_role'], $_SESSION['dc_csrf']);
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

/**
 * Only allow same-site relative paths as a post-login redirect target. Under
 * the Portal mount the path must also stay inside this copy ('/quo' or
 * '/quo/…'), so a Quotation sign-in never lands on a Portal page.
 */
function dc_safe_next($raw) {
    $raw = (string)$raw;
    if ($raw === '' || $raw[0] !== '/' || strpos($raw, '//') === 0 || strpos($raw, "\\") !== false) {
        return dc_url('/index.php');
    }
    $base = dc_base_path();
    if ($base !== '' && $raw !== $base && strpos($raw, $base . '/') !== 0 && strpos($raw, $base . '?') !== 0) {
        return dc_url('/index.php');
    }
    return $raw;
}

/**
 * Page guard (index.php, companies.php).
 * Must run before ANY output — these files emit HTML immediately.
 */
function dc_require_login() {
    if (dc_is_logged_in()) return;
    $next = $_SERVER['REQUEST_URI'] ?? dc_url('/index.php');
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

// ── CSRF (docs/audit/2026-10-20-csrf-design.md, layers 1 and 2) ──────────────
//
// SameSite=Lax alone is not enough once Quotation shares an origin with the
// Portal, and it never covered same-site sibling hosts or state changes by
// GET. Every state-changing request now also needs: POST, a token from this
// session, and — when the browser says where the request came from
// (Sec-Fetch-Site) — the same origin. The DNC Workspace handoff callback is
// NOT gated here: it is a top-level GET from the Portal, protected by its own
// signed token bound to a state this session created (dnc_handoff.php).

/** This session's CSRF token, minted on first use. Rotated at sign-in and sign-out. */
function dc_csrf_token() {
    dc_session_start();
    $t = $_SESSION['dc_csrf'] ?? null;
    if (!is_string($t) || strlen($t) !== 64) {
        $t = bin2hex(random_bytes(32));
        $_SESSION['dc_csrf'] = $t;
    }
    return $t;
}

/** True only for this session's token, compared in constant time. */
function dc_csrf_verify($sent) {
    dc_session_start();
    $t = $_SESSION['dc_csrf'] ?? null;
    return is_string($t) && strlen($t) === 64 && is_string($sent) && hash_equals($t, $sent);
}

/**
 * Why a state-changing request is refused, or null to allow it. $token is what
 * the client sent (X-DC-CSRF header or a form field); $requireJson is for
 * api.php, whose client always sends application/json — a text/plain form
 * that happens to parse as JSON is refused before anything else.
 */
function dc_csrf_refusal($token, $requireJson) {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') return 'method';
    if ($requireJson) {
        $ct = strtolower(trim(explode(';', (string)($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''))[0]));
        if ($ct !== 'application/json') return 'content_type';
    }
    $site = strtolower((string)($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
    if ($site !== '' && $site !== 'same-origin') return 'cross_site';
    if (!dc_csrf_verify($token)) return 'token';
    return null;
}

/**
 * API gate (api.php mutating actions, ai_extract.php): a JSON 405 / 415 / 403
 * and exit, or return. The client's api() helper shows the 403 as "reload".
 */
function dc_require_csrf_api($requireJson) {
    $reason = dc_csrf_refusal($_SERVER['HTTP_X_DC_CSRF'] ?? null, $requireJson);
    if ($reason === null) return;
    error_log('[csrf] rejected reason=' . $reason . ' script=' . basename((string)($_SERVER['SCRIPT_NAME'] ?? '')));
    $status = ['method' => 405, 'content_type' => 415][$reason] ?? 403;
    http_response_code($status);
    if ($status === 405) header('Allow: POST');
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'csrf', 'auth' => true]);
    exit;
}

/**
 * The page's <head> lines that depend on the server: the CSRF token for the
 * client, and the Quotation manifest — on quo.dnchardware.com only. Under the
 * Portal mount the installed DNC Workspace app is already the web app, and a
 * second manifest with scope "/" on the Portal's origin would compete with it.
 */
function dc_page_head_meta() {
    $out = '<meta name="dc-csrf" content="' . htmlspecialchars(dc_csrf_token(), ENT_QUOTES, 'UTF-8') . '">';
    if (dc_base_path() === '') $out .= "\n" . '<link rel="manifest" href="/manifest.webmanifest">';
    return $out;
}
