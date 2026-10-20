<?php
/**
 * Der-Cheng Quotation — DNC Workspace handoff (target side, contract v2)
 *
 * The Portal (portal.dnchardware.com) is the only issuer; Quotation is a
 * target with audience "quotation". The protocol is NOT defined here: it is
 * dnc-portal docs/HANDOFF-CONTRACT.md at bab1b67, and the shared code is
 * app/Handoff/Contract/*, copied byte for byte. This file is Quotation's
 * equivalent of the contract's reference HandoffController (§13.3), written
 * for this plain-PHP application:
 *
 *   GET /auth/handoff/start     dc_handoff_start()     (§6.1)
 *   GET /auth/handoff/callback  dc_handoff_callback()  (§6.3, order §6.4)
 *
 * handoff.php is the entry point; the host rewrites both paths to it.
 *
 * IDENTITY. A handoff session is a DNC identity, never an app_users one. The
 * canonical users.id lives only in the session (dc_dnc_user_id) for the
 * per-request recheck; dc_current_user() reports source "dnc" and id NULL, so
 * revision history records actor_user_id NULL for these sessions and an
 * app_users id and a canonical id can never be confused.
 *
 * CANONICAL USERS are Internal PO's `users` table, read through a separate
 * read-only connection (DNC_USERS_DB_*), matched by users.id only.
 *
 * NEVER LOGGED, NEVER RENDERED: the token, the state, a secret, a password or
 * a session id. Failures log a reason code; the browser sees one generic
 * message (§10).
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/app/Handoff/Contract/InvalidHandoffToken.php';
require_once __DIR__ . '/app/Handoff/Contract/HandoffToken.php';

use App\Handoff\Contract\HandoffToken;
use App\Handoff\Contract\InvalidHandoffToken;

const DC_HANDOFF_AUDIENCE    = HandoffToken::AUDIENCE_QUOTATION;
const DC_HANDOFF_STATES      = 'dnc_handoff_states';
const DC_HANDOFF_HOME        = '/';
const DC_HANDOFF_LOGIN       = '/login.php';
const DC_HANDOFF_PORTAL_URL  = 'https://portal.dnchardware.com';
/** §6.1 / §6.3: 30 requests per minute per IP, per endpoint. */
const DC_HANDOFF_RATE_LIMIT  = 30;
const DC_HANDOFF_RATE_WINDOW = 60;
/** §7: consumed jtis are kept an hour past their expiry. */
const DC_HANDOFF_REPLAY_KEEP = 3600;
/** The revision history's actor_display_name column is VARCHAR(100). */
const DC_DNC_DISPLAY_MAX     = 100;

// ── Configuration ────────────────────────────────────────────────────────────

/**
 * One setting, by its environment-variable name. The environment wins; the
 * server-only dnc_config.php (from dnc_config.sample.php, never in Git) is the
 * fallback for shared hosting where setting one is awkward — the same pattern
 * ai_config.php already follows.
 */
function dc_dnc_config($name, $default = '') {
    $env = getenv($name);
    if ($env !== false && $env !== '') return (string)$env;

    static $file = null;
    if ($file === null) {
        $file = [];
        $path = __DIR__ . '/dnc_config.php';
        if (is_file($path)) {
            $loaded = include $path;
            if (is_array($loaded)) $file = $loaded;
        }
    }
    $v = $file[$name] ?? null;
    return ($v === null || $v === '') ? $default : (string)$v;
}

/** Ships OFF. Only an explicit true turns the two endpoints on. */
function dc_handoff_enabled() {
    return in_array(strtolower(trim(dc_dnc_config('DNC_HANDOFF_ENABLED', 'false'))), ['true', '1', 'on', 'yes'], true);
}

/**
 * The ONLY place /start may send a browser (§14.4). A plain https origin —
 * no path, query, credentials or fragment — or null.
 */
function dc_handoff_portal_origin() {
    $url = rtrim(dc_dnc_config('DNC_PORTAL_URL', DC_HANDOFF_PORTAL_URL), '/');
    return preg_match('#^https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?$#', $url) === 1 ? $url : null;
}

/**
 * Raw key bytes: the current secret, then the previous one during a rotation
 * (§4.3). Throws InvalidHandoffToken(bad_secret) without echoing a value.
 *
 * @return list<string>
 */
function dc_handoff_keys() {
    $keys = [HandoffToken::parseSecret(dc_dnc_config('DNC_HANDOFF_SECRET'))];
    $previous = dc_dnc_config('DNC_HANDOFF_SECRET_PREVIOUS');
    if (trim($previous) !== '') $keys[] = HandoffToken::parseSecret($previous);
    return $keys;
}

// ── Logging: a reason code, never a token, state, secret or session id ──────

function dc_handoff_log($event, array $fields = []) {
    $line = '[handoff] ' . $event;
    foreach ($fields as $k => $v) {
        if ($v === null || $v === '') continue;
        /* Every value is a reason code, an IP, a 32-hex jti or a decimal id.
           Anything else is dropped rather than written. */
        $v = (string)$v;
        if (!preg_match('/^[A-Za-z0-9_.:\-]{1,64}$/', $v)) continue;
        $line .= ' ' . $k . '=' . $v;
    }
    $sink = $GLOBALS['DC_HANDOFF_LOG_SINK'] ?? null;   // tests capture here
    if (is_callable($sink)) { $sink($line); return; }
    error_log($line);
}

function dc_handoff_ip() {
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    return filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
}

// ── Database handles ─────────────────────────────────────────────────────────

/**
 * Quotation's own database (replay table and rate limits), through the same
 * db.php / getDB() every other entry point uses, opened only when a handoff
 * endpoint needs it. MYSQLI_REPORT_OFF first, as api.php and login.php do.
 *
 * Fails CLOSED and SILENT: null, and a reason code in the log. A db.php that
 * throws (PDO, or mysqli in exception mode) is caught here and its message —
 * which can carry a DSN, user, host or SQLSTATE — is never used. A db.php that
 * prints and die()s cannot be caught by any code; handoff.php's containment
 * discards what it printed and answers with the generic failure instead.
 */
function dc_handoff_quo_db() {
    static $db = null;
    if ($db !== null) return $db ?: null;
    mysqli_report(MYSQLI_REPORT_OFF);
    $h = null;
    try {
        if (!function_exists('getDB')) {
            $path = __DIR__ . '/db.php';
            if (is_file($path)) require_once $path;
        }
        $h = function_exists('getDB') ? getDB() : null;
    } catch (Throwable $e) {
        $h = null;
    }
    $db = ($h instanceof mysqli && !$h->connect_errno) ? $h : false;
    if (!$db) dc_handoff_log('quo_db.unavailable');
    return $db ?: null;
}

/**
 * The canonical users connection: READ-ONLY, separate credentials, opened on
 * demand. Read-only twice over: the database user should hold SELECT only,
 * and the session is put into READ ONLY so even a broader grant cannot write.
 * Returns null when it is not configured or cannot be opened; callers fail
 * closed on null.
 *
 * $reset closes and forgets the handle (tests, and nothing else).
 */
function dc_dnc_users_db($reset = false) {
    static $db = null;
    if ($reset) {
        if ($db instanceof mysqli) @$db->close();
        $db = null;
        return null;
    }
    if ($db !== null) return $db ?: null;

    $host = dc_dnc_config('DNC_USERS_DB_HOST');
    $name = dc_dnc_config('DNC_USERS_DB_DATABASE');
    $user = dc_dnc_config('DNC_USERS_DB_USERNAME');
    $pass = dc_dnc_config('DNC_USERS_DB_PASSWORD');
    $port = (int)dc_dnc_config('DNC_USERS_DB_PORT', '3306');
    if ($host === '' || $name === '' || $user === '') { $db = false; return null; }

    mysqli_report(MYSQLI_REPORT_OFF);
    /* Warnings are suppressed and exceptions caught: a failed connection is a
       reason code and an errno in the log, never the driver's text (which
       names the user and host) in a response. */
    try {
        $h = mysqli_init();
        if (!$h) { $db = false; return null; }
        @$h->options(MYSQLI_OPT_CONNECT_TIMEOUT, 5);
        if (!@$h->real_connect($host, $user, $pass, $name, $port > 0 ? $port : 3306)
            || !@$h->set_charset('utf8mb4')
            || !@$h->query('SET SESSION TRANSACTION READ ONLY')) {
            dc_handoff_log('dnc_users_db.unavailable', ['errno' => (int)$h->connect_errno ?: (int)$h->errno]);
            $db = false;
            return null;
        }
    } catch (Throwable $e) {
        dc_handoff_log('dnc_users_db.unavailable', ['errno' => (int)$e->getCode()]);
        $db = false;
        return null;
    }
    $db = $h;
    return $db;
}

/**
 * The canonical row for one users.id, read fresh. The only columns read:
 * id, username, name (display only), role, is_active, is_legacy_placeholder,
 * must_change_password. Never matched by name, username or email.
 *
 * @return array|null|false  the row; null when no such id; false on a read error
 */
function dc_dnc_user_row($db, $id) {
    if (!($db instanceof mysqli) || !is_int($id) || $id <= 0) return false;
    $stmt = $db->prepare('SELECT id, username, name, role, is_active, is_legacy_placeholder, must_change_password
                            FROM users WHERE id = ? LIMIT 1');
    if (!$stmt) return false;
    $rId = $rUser = $rName = $rRole = $rActive = $rLegacy = $rMust = null;
    if (!$stmt->bind_param('i', $id) || !$stmt->execute()
        || !$stmt->bind_result($rId, $rUser, $rName, $rRole, $rActive, $rLegacy, $rMust)) {
        $stmt->close();
        return false;
    }
    $f = $stmt->fetch();
    $stmt->close();
    if ($f === false) return false;
    if ($f !== true) return null;
    return [
        'id'                    => (int)$rId,
        'username'              => (string)$rUser,
        'name'                  => (string)$rName,
        'role'                  => (string)$rRole,
        'is_active'             => (int)$rActive === 1,
        'is_legacy_placeholder' => (int)$rLegacy === 1,
        'must_change_password'  => (int)$rMust === 1,
    ];
}

/**
 * Why this row may not use Quotation, or null when it may (§6.4 step 7).
 * With $claims, username and role must also equal the token's (cross-check
 * only — access never comes from the token's role).
 */
function dc_dnc_user_refusal($row, ?array $claims = null) {
    if (!is_array($row))                 return 'user_not_found';
    if (!$row['is_active'])              return 'user_inactive';
    if ($row['is_legacy_placeholder'])   return 'user_legacy_placeholder';
    if ($row['must_change_password'])    return 'user_must_change_password';
    if ($claims !== null
        && ($row['username'] !== $claims['username'] || $row['role'] !== $claims['role'])) {
        return 'user_mismatch';
    }
    return null;
}

/** What History shows for this person: the canonical name, else the username. */
function dc_dnc_display_name(array $row) {
    $name = trim(preg_replace('/\s+/u', ' ', (string)$row['name']) ?? '');
    if ($name === '') $name = $row['username'];
    return mb_substr($name, 0, DC_DNC_DISPLAY_MAX, 'UTF-8');
}

// ── Per-request enforcement (auth.php calls this for DNC sessions) ──────────

/**
 * Is the DNC user behind this session still allowed in? Re-read on every
 * protected request through the read-only connection, so disabling someone
 * in Internal PO ends their Quotation access on their next request.
 *
 * @return string  'ok', 'unavailable' (could not check: refuse this request,
 *                 keep the session), or a refusal reason (end the session)
 */
function dc_dnc_session_check(array $user) {
    $db = dc_dnc_users_db();
    if ($db === null) return 'unavailable';
    $row = dc_dnc_user_row($db, $user['dnc_user_id']);
    if ($row === false) return 'unavailable';
    $reason = dc_dnc_user_refusal($row);
    if ($reason === null && $row['username'] !== $user['username']) $reason = 'user_mismatch';
    return $reason ?? 'ok';
}

// ── Rate limit (§6.1 / §6.3): 30 per minute per IP, per endpoint ────────────

/**
 * Counts this request and says whether it is over the limit. One row per
 * (endpoint, IP hash, minute); the increment is a single atomic upsert, so
 * concurrent requests cannot both read a stale count. Old windows are pruned
 * opportunistically. The IP is stored only as a SHA-256.
 *
 * @return bool|null  true = over the limit; null = could not be counted
 */
function dc_handoff_rate_limited($db, $endpoint, $now) {
    if (!($db instanceof mysqli)) return null;
    $bucket = hash('sha256', $endpoint . '|' . dc_handoff_ip());
    $window = intdiv($now, DC_HANDOFF_RATE_WINDOW) * DC_HANDOFF_RATE_WINDOW;
    $stmt = $db->prepare('INSERT INTO handoff_rate_limits (bucket, window_start, hits) VALUES (?, ?, LAST_INSERT_ID(1))
                          ON DUPLICATE KEY UPDATE hits = LAST_INSERT_ID(hits + 1)');
    if (!$stmt) return null;
    $ok = $stmt->bind_param('si', $bucket, $window) && $stmt->execute();
    $stmt->close();
    if (!$ok) return null;
    $hits = (int)$db->insert_id;

    if (random_int(1, 20) === 1) {
        $old = $window - 10 * DC_HANDOFF_RATE_WINDOW;
        $db->query('DELETE FROM handoff_rate_limits WHERE window_start < ' . (int)$old);
    }
    return $hits > DC_HANDOFF_RATE_LIMIT;
}

// ── Replay (§7): the jti primary key lets exactly one consumer through ─────

/** @return string|null  null when consumed now; 'replayed'; 'replay_store_failed' */
function dc_handoff_consume_jti($db, array $claims, $now) {
    if (!($db instanceof mysqli)) return 'replay_store_failed';
    $stmt = $db->prepare('INSERT INTO handoff_consumed_tokens (jti, user_id, expires_at, consumed_at)
                          VALUES (?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))');
    if (!$stmt) return 'replay_store_failed';
    $jti = $claims['jti']; $sub = $claims['sub']; $exp = $claims['exp'];
    $ok = $stmt->bind_param('ssii', $jti, $sub, $exp, $now) && $stmt->execute();
    $errno = (int)$stmt->errno;
    $stmt->close();
    if ($ok) return null;
    return $errno === 1062 ? 'replayed' : 'replay_store_failed';
}

function dc_handoff_prune_jtis($db, $now) {
    if ($db instanceof mysqli) {
        $db->query('DELETE FROM handoff_consumed_tokens WHERE expires_at < FROM_UNIXTIME(' . (int)($now - DC_HANDOFF_REPLAY_KEEP) . ')');
    }
}

// ── Responses ────────────────────────────────────────────────────────────────

/**
 * Every handoff answer: 303 (or 429), empty body, no-referrer, no-store.
 * handoff.php's dc_handoff_send() writes it, after discarding anything else
 * the request printed.
 */
function dc_handoff_response($status, $location = null) {
    return ['status' => $status, 'location' => $location];
}

function dc_handoff_fail($reason, ?array $claims = null) {
    $f = ['reason' => $reason, 'ip' => dc_handoff_ip()];
    if ($claims !== null) { $f['jti'] = $claims['jti']; $f['sub'] = $claims['sub']; }
    dc_handoff_log('auth.handoff_failed', $f);
    $_SESSION['dc_flash'] = 'handoff_failed';
    return dc_handoff_response(303, DC_HANDOFF_LOGIN);
}

/** The pending map this browser's session holds, or [] for anything else. */
function dc_handoff_pending() {
    $p = $_SESSION[DC_HANDOFF_STATES] ?? [];
    return is_array($p) ? $p : [];
}

// ── GET /auth/handoff/start (§6.1) ───────────────────────────────────────────

/** Reads no query parameter: redirect_uri, next, url, callback… are ignored. */
function dc_handoff_start($now = null) {
    $now = $now ?? time();
    if (!dc_handoff_enabled()) return dc_handoff_response(303, DC_HANDOFF_LOGIN);

    dc_session_start();
    $limited = dc_handoff_rate_limited(dc_handoff_quo_db(), 'start', $now);
    if ($limited === true) {
        dc_handoff_log('auth.handoff_throttled', ['endpoint' => 'start', 'ip' => dc_handoff_ip()]);
        return dc_handoff_response(429);
    }
    if ($limited === null) return dc_handoff_fail('throttle_unavailable');

    $portal = dc_handoff_portal_origin();
    if ($portal === null) return dc_handoff_fail('bad_portal_url');

    [$state, $pending] = HandoffToken::startState(dc_handoff_pending(), $now);
    $_SESSION[DC_HANDOFF_STATES] = $pending;

    return dc_handoff_response(303, HandoffToken::authorizeUrl($portal, DC_HANDOFF_AUDIENCE, $state));
}

// ── GET /auth/handoff/callback (§6.3, processing order §6.4) ─────────────────

function dc_handoff_callback($now = null) {
    $now = $now ?? time();
    // 0
    if (!dc_handoff_enabled()) return dc_handoff_response(303, DC_HANDOFF_LOGIN);

    dc_session_start();
    $quoDb   = dc_handoff_quo_db();
    $limited = dc_handoff_rate_limited($quoDb, 'callback', $now);
    if ($limited === true) {
        dc_handoff_log('auth.handoff_throttled', ['endpoint' => 'callback', 'ip' => dc_handoff_ip()]);
        return dc_handoff_response(429);
    }

    // 3 (read before anything can change it)
    $pending = dc_handoff_pending();
    try {
        // 1
        $token = $_GET['token'] ?? null;
        if (!is_string($token)) throw new InvalidHandoffToken(InvalidHandoffToken::MALFORMED);
        // 2
        try {
            $keys = dc_handoff_keys();
        } catch (InvalidHandoffToken $e) {
            dc_handoff_log('auth.handoff_misconfigured', ['reason' => 'bad_secret']);
            throw $e;
        }
        // 4 — format, signature, iss, aud, claims, lifetime, time, then state
        $claims = HandoffToken::verify($token, DC_HANDOFF_AUDIENCE, $keys, $now, $pending);
    } catch (InvalidHandoffToken $e) {
        return dc_handoff_fail($e->reason);           // steps 1–4: nothing written
    }
    if ($limited === null) return dc_handoff_fail('throttle_unavailable', $claims);

    // 5 — from here a failure leaves the state and the jti used up
    $_SESSION[DC_HANDOFF_STATES] = HandoffToken::consumeState($pending, $claims['state_hash'], $now);

    // 6
    $replay = dc_handoff_consume_jti($quoDb, $claims, $now);
    if ($replay !== null) return dc_handoff_fail($replay, $claims);

    // 7 — fresh read of the canonical row, by users.id only
    $usersDb = dc_dnc_users_db();
    $row = $usersDb === null ? false : dc_dnc_user_row($usersDb, (int)$claims['sub']);
    if ($row === false) return dc_handoff_fail('user_source_unavailable', $claims);
    $reason = dc_dnc_user_refusal($row, $claims);
    if ($reason !== null) return dc_handoff_fail($reason, $claims);

    // 8 — Quotation's own session: drop the old one, new id, DNC identity
    $remaining = $_SESSION[DC_HANDOFF_STATES];
    $_SESSION = [];
    session_regenerate_id(true);
    $_SESSION['dc_auth']          = true;
    $_SESSION['dc_auth_source']   = 'dnc';
    $_SESSION['dc_dnc_user_id']   = $row['id'];
    $_SESSION['dc_username']      = $row['username'];
    $_SESSION['dc_display_name']  = dc_dnc_display_name($row);
    $_SESSION['dc_dnc_role']      = $row['role'];
    $_SESSION['dc_login_time']    = $now;
    $_SESSION['dc_user']          = $row['username'];     // compatibility alias only
    $_SESSION[DC_HANDOFF_STATES]  = $remaining;            // other tabs' pending handoffs survive

    // 9
    dc_handoff_log('auth.handoff_succeeded', ['jti' => $claims['jti'], 'sub' => $claims['sub'], 'ip' => dc_handoff_ip()]);
    dc_handoff_prune_jtis($quoDb, $now);

    // 10
    return dc_handoff_response(303, DC_HANDOFF_HOME);
}
