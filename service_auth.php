<?php
/**
 * Der-Cheng Quotation — service API: configuration, signing, replay and actor
 * checks. FUNCTIONS AND CONSTANTS ONLY; including this file does nothing.
 *
 * Contract and operator notes: docs/SERVICE-API.md
 *
 * service.php is the only entry point. It is a server-to-server door for the
 * DNC Quick Quote backend, separate from the browser door (api.php + auth.php
 * sessions), which is left exactly as it is. This file never starts a session,
 * never reads or sets a cookie and never sends a CORS header.
 *
 * NEVER LOGGED, NEVER RETURNED: the secret, a signature, the request body or
 * any SQL / driver text. A refusal logs a reason code; the caller gets a
 * stable machine code and a fixed, generic message.
 *
 * The acting user is checked with QUO's OWN per-request rule for Portal users
 * — dc_dnc_session_check() in dnc_handoff.php — not a second copy of it.
 * dnc_handoff.php (and auth.php, which it loads) only define functions and
 * constants; nothing here calls any session function from them.
 */

require_once __DIR__ . '/dnc_handoff.php';

/** First line of every signing string. Changes only with the wire contract. */
const DC_SERVICE_SCHEME        = 'qqs1';
const DC_SERVICE_NAME          = 'quo-service';
/** Bumped when a request or response shape changes incompatibly. */
const DC_SERVICE_CONTRACT      = 1;
const DC_SERVICE_DEFAULT_KEYID = 'qq-backend-1';
/** Seconds either side of the server clock a timestamp may be. */
const DC_SERVICE_WINDOW        = 60;
/** Largest request body read, in bytes. */
const DC_SERVICE_MAX_BODY      = 524288;
/** Smallest accepted key, in bytes after base64 decoding. */
const DC_SERVICE_MIN_KEY_BYTES = 32;
const DC_SERVICE_NONCE_TABLE   = 'service_request_nonces';

/** The whole allow-list. Anything else is unknown_action. */
const DC_SERVICE_ACTIONS = [
    'ping',
    'diameter_settings.get',
    'companies.search',
    'contacts.lookup',
    'contacts.link',
];

/** code => [HTTP status, fixed message]. The only errors this door can send. */
const DC_SERVICE_ERRORS = [
    'not_available'           => [404, 'Not available'],
    'method_not_allowed'      => [405, 'Method not allowed'],
    'unsupported_media_type'  => [415, 'Content-Type must be application/json'],
    'payload_too_large'       => [413, 'Request body too large'],
    'browser_request_refused' => [403, 'Request refused'],
    'invalid_signature'       => [401, 'Request could not be authenticated'],
    'timestamp_out_of_window' => [401, 'Request timestamp is outside the accepted window'],
    'replayed'                => [409, 'Request was already received'],
    'unknown_action'          => [404, 'Unknown action'],
    'invalid_body'            => [400, 'Request body is not valid'],
    'actor_refused'           => [403, 'Acting user is not allowed'],
    'actor_check_unavailable' => [503, 'Acting user could not be checked'],
    'validation_failed'       => [422, 'Request parameters are not valid'],
    'not_found'               => [404, 'Not found'],
    'contact_conflict'        => [409, 'Contact conflicts with an existing link'],
    'quo_unavailable'         => [503, 'Service temporarily unavailable'],
];

// ── Configuration: the server-only file, and nothing else ────────────────────

/**
 * service_config.php (from service_config.sample.php; never in Git, on the
 * deploy's PROTECTED list). Deliberately NOT read from the environment: the
 * door opens only when that file exists on the server and says so.
 *
 * $path is for tests; production always uses the file beside this one.
 *
 * @return array  [] when the file is missing or does not return an array
 */
function dc_service_config_file($path = null) {
    $path = $path ?? (__DIR__ . '/service_config.php');
    if (!is_file($path)) return [];
    try {
        $loaded = include $path;
    } catch (Throwable $e) {
        return [];
    }
    return is_array($loaded) ? $loaded : [];
}

/**
 * Raw key bytes from "base64:<base64 of at least 32 bytes>", or null. The
 * same format the handoff secret uses.
 */
function dc_service_parse_secret($value) {
    if (!is_string($value)) return null;
    $value = trim($value);
    if (strncmp($value, 'base64:', 7) !== 0) return null;
    $raw = base64_decode(substr($value, 7), true);
    if ($raw === false || strlen($raw) < DC_SERVICE_MIN_KEY_BYTES) return null;
    return $raw;
}

/**
 * The usable configuration, or null = DISABLED. Disabled when: no file,
 * QQ_SERVICE_ENABLED is not an explicit true, the key id is malformed, the
 * secret is missing / malformed / shorter than 32 bytes, a non-empty previous
 * secret is malformed, or the secret equals the handoff secret (one key must
 * never do two jobs).
 *
 * @return array{key_id:string, keys:list<string>}|null
 */
function dc_service_settings(?array $config = null) {
    $c = $config ?? dc_service_config_file();
    $enabled = $c['QQ_SERVICE_ENABLED'] ?? false;
    if ($enabled !== true
        && !(is_string($enabled) && in_array(strtolower(trim($enabled)), ['true', '1', 'on', 'yes'], true))) {
        return null;
    }
    $keyId = $c['QQ_SERVICE_KEY_ID'] ?? DC_SERVICE_DEFAULT_KEYID;
    if (!is_string($keyId) || preg_match('/^[A-Za-z0-9_-]{1,32}$/D', $keyId) !== 1) return null;

    $current = dc_service_parse_secret($c['QQ_SERVICE_SECRET'] ?? null);
    if ($current === null) return null;
    $keys = [$current];

    $previous = $c['QQ_SERVICE_SECRET_PREVIOUS'] ?? '';
    if (is_string($previous) && trim($previous) !== '') {
        $p = dc_service_parse_secret($previous);
        if ($p === null) return null;
        $keys[] = $p;
    } elseif (!is_string($previous) && $previous !== null) {
        return null;
    }

    foreach (['DNC_HANDOFF_SECRET', 'DNC_HANDOFF_SECRET_PREVIOUS'] as $name) {
        $h = dc_service_parse_secret(dc_dnc_config($name));
        if ($h === null) continue;
        foreach ($keys as $k) if (hash_equals($h, $k)) return null;
    }
    return ['key_id' => $keyId, 'keys' => $keys];
}

// ── Logging: a reason code, never a secret, signature, body or SQL ───────────

function dc_service_log($event, array $fields = []) {
    $line = '[service] ' . $event;
    foreach ($fields as $k => $v) {
        if ($v === null || $v === '') continue;
        /* Reason codes, action names, decimal ids and errnos only. Anything
           else is dropped rather than written. */
        $v = (string)$v;
        if (preg_match('/^[A-Za-z0-9_.:\-]{1,64}$/D', $v) !== 1) continue;
        $line .= ' ' . $k . '=' . $v;
    }
    $sink = $GLOBALS['DC_SERVICE_LOG_SINK'] ?? null;   // tests capture here
    if (is_callable($sink)) { $sink($line); return; }
    error_log($line);
}

// ── Signing (docs/SERVICE-API.md §3) ─────────────────────────────────────────

function dc_service_b64url($bytes) {
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

/**
 * The exact bytes that are signed: six lines joined by "\n", no trailing
 * newline. The acting user and the request id are inside the body, so the
 * body hash covers them.
 */
function dc_service_signing_string($action, $timestamp, $nonce, $body) {
    return implode("\n", [
        DC_SERVICE_SCHEME,
        'POST',
        (string)$action,
        (string)$timestamp,
        (string)$nonce,
        hash('sha256', (string)$body),
    ]);
}

/** base64url, unpadded, of HMAC-SHA256(key bytes, signing string). */
function dc_service_sign($keyBytes, $action, $timestamp, $nonce, $body) {
    return dc_service_b64url(hash_hmac('sha256', dc_service_signing_string($action, $timestamp, $nonce, $body), $keyBytes, true));
}

/**
 * Constant-time check against the current key, then the previous one. Every
 * configured key is tried on every call so the time taken does not say which
 * (or whether) one matched.
 */
function dc_service_signature_ok(array $keys, $action, $timestamp, $nonce, $body, $provided) {
    if (!is_string($provided) || $provided === '') return false;
    $ok = false;
    foreach ($keys as $k) {
        if (hash_equals(dc_service_sign($k, $action, $timestamp, $nonce, $body), $provided)) $ok = true;
    }
    return $ok;
}

/** Shape checks for the signed header values. A bad shape is a bad signature. */
function dc_service_timestamp_shape_ok($ts) { return is_string($ts) && preg_match('/^[1-9][0-9]{9,10}$/D', $ts) === 1; }
function dc_service_nonce_shape_ok($n)      { return is_string($n) && preg_match('/^[0-9a-f]{32}$/D', $n) === 1; }

function dc_service_timestamp_in_window($ts, $now) {
    return abs((int)$now - (int)$ts) <= DC_SERVICE_WINDOW;
}

// ── Replay: the nonce primary key lets exactly one request through ──────────

/**
 * Records the nonce. Of two requests carrying the same nonce exactly one
 * INSERT succeeds; the other gets error 1062 from the primary key.
 *
 * @return string|null  null when stored now; 'replayed'; 'nonce_store_failed'
 */
function dc_service_consume_nonce($db, $nonce, $keyId, $now) {
    if (!($db instanceof mysqli)) return 'nonce_store_failed';
    $stmt = $db->prepare('INSERT INTO ' . DC_SERVICE_NONCE_TABLE . ' (nonce, key_id, received_at) VALUES (?, ?, FROM_UNIXTIME(?))');
    if (!$stmt) return 'nonce_store_failed';
    $ok = $stmt->bind_param('ssi', $nonce, $keyId, $now) && $stmt->execute();
    $errno = (int)$stmt->errno;
    $stmt->close();
    if ($ok) return null;
    return $errno === 1062 ? 'replayed' : 'nonce_store_failed';
}

// ── Body and acting user ─────────────────────────────────────────────────────

/**
 * The decoded request envelope, or null. Must be a JSON object with
 * actor.sub (a positive JSON integer) and actor.username (a non-empty string);
 * params, when present, must be a JSON object.
 *
 * @return array{sub:int, username:string, params:array, request_id:?string}|null
 */
function dc_service_parse_body($raw) {
    if (!is_string($raw) || $raw === '') return null;
    $d = json_decode($raw, true, 32);
    if (!is_array($d) || ($d !== [] && array_is_list($d))) return null;
    $actor = $d['actor'] ?? null;
    if (!is_array($actor)) return null;
    $sub = $actor['sub'] ?? null;
    $username = $actor['username'] ?? null;
    if (!is_int($sub) || $sub <= 0) return null;
    if (!is_string($username) || $username === '' || strlen($username) > 255) return null;
    $params = $d['params'] ?? [];
    if (!is_array($params) || ($params !== [] && array_is_list($params))) return null;
    $rid = $d['requestId'] ?? null;
    /* Echoed back in meta for correlation, so only a plain token is kept. */
    if (!is_string($rid) || preg_match('/^[A-Za-z0-9_.:\-]{1,64}$/D', $rid) !== 1) $rid = null;
    return ['sub' => $sub, 'username' => $username, 'params' => $params, 'request_id' => $rid];
}

/**
 * QUO's own per-request rule for a Portal user, unchanged: the canonical row
 * is read fresh by users.id through the read-only connection, and refused
 * when missing, inactive, a legacy placeholder, must-change-password, or when
 * the username differs.
 *
 * @return string  'ok', 'unavailable', or a refusal reason code
 */
function dc_service_actor_check($sub, $username) {
    return dc_dnc_session_check(['dnc_user_id' => $sub, 'username' => $username]);
}
