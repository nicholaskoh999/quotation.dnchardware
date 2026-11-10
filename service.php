<?php
/**
 * Der-Cheng Quotation — service API entry point.
 *
 *     POST service.php?action=<name>      JSON body, HMAC-signed
 *
 * A narrow server-to-server door for the DNC Quick Quote backend. Contract,
 * signing recipe and operator runbook: docs/SERVICE-API.md
 *
 * DISABLED BY DEFAULT. Without a server-only service_config.php that says
 * QQ_SERVICE_ENABLED = true and carries a valid secret, every request — any
 * method, any action — gets 404 not_available and nothing else runs.
 *
 * This is NOT the browser door. No session is started, no cookie is read or
 * set, no CORS header is sent, and a request that carries browser headers
 * (Origin, Cookie, Sec-Fetch-Site) is refused. api.php, auth.php sessions and
 * the QUO login are not involved and are not changed.
 *
 * ORDER OF CHECKS (each failure stops the request; nothing later runs):
 *   1  enabled · POST · Content-Type application/json · body size
 *   2  no browser headers
 *   3  key id + HMAC-SHA256 signature (constant time; current, then previous key)
 *   4  timestamp within ±60 s
 *   5  nonce stored — the PRIMARY KEY refuses a replay
 *   6  action on the allow-list
 *   5b occasionally: prune old nonces (bounded; a failure is swallowed)
 *   7  body envelope + acting user re-read from the canonical users table;
 *      core verdict computed from the signed body's client.cores
 *   8  only now the action's own query runs (write actions first call
 *      dc_service_require_accepted_core())
 *
 * ERROR CONTAINMENT, as handoff.php does it: display_errors off, everything
 * printed is buffered and DISCARDED, and a shutdown function replaces an
 * unexpected exit (the legacy getDB() die()s with the driver's text) with the
 * generic quo_unavailable. The only bytes ever sent are dc_service_send()'s.
 */

@ini_set('display_errors', '0');
@ini_set('html_errors', '0');
ob_start();
$GLOBALS['DC_SERVICE_SENT'] = false;
$GLOBALS['DC_SERVICE_RID']  = null;
$GLOBALS['DC_SERVICE_CORE'] = null;

/** The only bytes a service request ever sends. */
function dc_service_send($status, array $payload) {
    while (ob_get_level() > 0) ob_end_clean();          // whatever anyone printed: gone
    if (!headers_sent()) {
        header_remove();
        http_response_code((int)$status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
    }
    /* The core verdict, once the signed body has been read (check 7 onward). */
    if (isset($GLOBALS['DC_SERVICE_CORE']) && is_array($GLOBALS['DC_SERVICE_CORE'])) $payload['core'] = $GLOBALS['DC_SERVICE_CORE'];
    $payload['meta'] = ['requestId' => $GLOBALS['DC_SERVICE_RID'], 'serverTime' => gmdate('Y-m-d\TH:i:s\Z')];
    $GLOBALS['DC_SERVICE_SENT'] = true;
    echo json_encode($payload);
}

/** A refusal: stable code, fixed message, never anything from the request. */
function dc_service_refuse($code, array $extra = []) {
    $known = [
        'not_available'           => [404, 'Not available'],
        'quo_unavailable'         => [503, 'Service temporarily unavailable'],
    ];
    $table = defined('DC_SERVICE_ERRORS') ? DC_SERVICE_ERRORS : $known;
    [$status, $message] = $table[$code] ?? $known['quo_unavailable'];
    if (!isset($table[$code])) $code = 'quo_unavailable';
    $error = ['code' => $code, 'message' => $message];
    foreach (['field', 'reason'] as $k) {   // fixed words only
        if (isset($extra[$k]) && is_string($extra[$k]) && preg_match('/^[A-Za-z_]{1,40}$/D', $extra[$k]) === 1) $error[$k] = $extra[$k];
    }
    dc_service_send($status, ['ok' => false, 'error' => $error]);
    exit;
}

register_shutdown_function(function () {
    if (!empty($GLOBALS['DC_SERVICE_SENT'])) return;
    /* The request ended without a service response: something exited or died
       underneath (db.php's die(), a fatal error). Generic failure only. */
    error_log('[service] request.failed reason=internal_error');
    $GLOBALS['DC_SERVICE_RID'] = null;
    $GLOBALS['DC_SERVICE_CORE'] = null;
    dc_service_send(503, ['ok' => false, 'error' => ['code' => 'quo_unavailable', 'message' => 'Service temporarily unavailable']]);
});

try {
    mysqli_report(MYSQLI_REPORT_OFF);
    require_once __DIR__ . '/service_auth.php';

    // ── 1 · enabled, POST, JSON, size ────────────────────────────────────────
    $settings = dc_service_settings();
    if ($settings === null) dc_service_refuse('not_available');

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        dc_service_log('request.refused', ['reason' => 'method']);
        dc_service_refuse('method_not_allowed');
    }
    $ctype = strtolower(trim(explode(';', (string)($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''))[0]));
    if ($ctype !== 'application/json') {
        dc_service_log('request.refused', ['reason' => 'content_type']);
        dc_service_refuse('unsupported_media_type');
    }
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > DC_SERVICE_MAX_BODY) {
        dc_service_log('request.refused', ['reason' => 'too_large']);
        dc_service_refuse('payload_too_large');
    }
    $body = file_get_contents('php://input', false, null, 0, DC_SERVICE_MAX_BODY + 1);
    if (!is_string($body)) $body = '';
    if (strlen($body) > DC_SERVICE_MAX_BODY) {
        dc_service_log('request.refused', ['reason' => 'too_large']);
        dc_service_refuse('payload_too_large');
    }

    // ── 2 · a browser never calls this ───────────────────────────────────────
    foreach (['HTTP_ORIGIN', 'HTTP_COOKIE', 'HTTP_SEC_FETCH_SITE'] as $h) {
        if (isset($_SERVER[$h]) && $_SERVER[$h] !== '') {
            dc_service_log('request.refused', ['reason' => 'browser_header']);
            dc_service_refuse('browser_request_refused');
        }
    }

    // ── 3 · key id and signature ─────────────────────────────────────────────
    $action = $_GET['action'] ?? '';
    if (!is_string($action)) $action = '';
    $keyId = (string)($_SERVER['HTTP_X_QQS_KEY_ID'] ?? '');
    $ts    = (string)($_SERVER['HTTP_X_QQS_TIMESTAMP'] ?? '');
    $nonce = (string)($_SERVER['HTTP_X_QQS_NONCE'] ?? '');
    $sig   = (string)($_SERVER['HTTP_X_QQS_SIGNATURE'] ?? '');

    /* The signature is computed in every case, so a wrong key id, a malformed
       header and a wrong signature are indistinguishable from outside. */
    $sigOk   = dc_service_signature_ok($settings['keys'], $action, $ts, $nonce, $body, $sig);
    $keyOk   = hash_equals($settings['key_id'], $keyId);
    $shapeOk = dc_service_timestamp_shape_ok($ts) && dc_service_nonce_shape_ok($nonce)
               && preg_match('/^[a-z0-9_.]{1,64}$/D', $action) === 1;
    if (!$sigOk || !$keyOk || !$shapeOk) {
        dc_service_log('request.refused', ['reason' => !$keyOk ? 'key_id' : (!$shapeOk ? 'header_shape' : 'signature')]);
        dc_service_refuse('invalid_signature');
    }

    // ── 4 · timestamp ────────────────────────────────────────────────────────
    $now = time();
    if (!dc_service_timestamp_in_window($ts, $now)) {
        dc_service_log('request.refused', ['reason' => 'timestamp', 'action' => $action]);
        dc_service_refuse('timestamp_out_of_window');
    }

    // ── 5 · nonce (Quotation's own database, replay table only) ─────────────
    $db = dc_handoff_quo_db();
    if (!($db instanceof mysqli)) dc_service_refuse('quo_unavailable');
    $replay = dc_service_consume_nonce($db, $nonce, $keyId, $now);
    if ($replay === 'replayed') {
        dc_service_log('request.refused', ['reason' => 'replayed', 'action' => $action]);
        dc_service_refuse('replayed');
    }
    if ($replay !== null) {
        dc_service_log('request.refused', ['reason' => $replay, 'errno' => (int)$db->errno]);
        dc_service_refuse('quo_unavailable');
    }
    /* Housekeeping, only now that this request's nonce is stored. Bounded,
       occasional, and unable to fail the request (docs/SERVICE-API.md §6.1). */
    dc_service_maybe_prune_nonces($db, $now, $settings['nonce']);

    // ── 6 · allow-list ───────────────────────────────────────────────────────
    if (!in_array($action, DC_SERVICE_ACTIONS, true)) {
        dc_service_log('request.refused', ['reason' => 'unknown_action']);
        dc_service_refuse('unknown_action');
    }

    // ── 7 · envelope and acting user ─────────────────────────────────────────
    $req = dc_service_parse_body($body);
    if ($req === null) {
        dc_service_log('request.refused', ['reason' => 'invalid_body', 'action' => $action]);
        dc_service_refuse('invalid_body');
    }
    $GLOBALS['DC_SERVICE_RID'] = $req['request_id'];
    $check = dc_service_actor_check($req['sub'], $req['username']);
    if ($check === 'unavailable') {
        dc_service_log('request.refused', ['reason' => 'actor_check_unavailable', 'action' => $action]);
        dc_service_refuse('actor_check_unavailable');
    }
    if ($check !== 'ok') {
        dc_service_log('request.refused', ['reason' => $check, 'action' => $action, 'actor' => $req['sub']]);
        dc_service_refuse('actor_refused');
    }

    /* Core verdict from the SIGNED body's client.cores. Reported on every
       answer from here on; enforced only by the write actions' guard. */
    $claims = dc_service_core_claims($body);
    $GLOBALS['DC_SERVICE_CORE'] = dc_service_core_evaluate($claims, dc_service_server_cores(), $settings['core_allow']);

    // ── 8 · the action ───────────────────────────────────────────────────────
    require_once __DIR__ . '/service_actions.php';
    /* Same pins as api.php: Malaysia time for PHP and for this MySQL session,
       so a DATETIME default written here reads like every other QUO row. */
    date_default_timezone_set('Asia/Kuala_Lumpur');
    @$db->query("SET time_zone = '+08:00'");

    $handler = dc_service_handlers()[$action];
    $result = $handler($db, $req['params'], ['sub' => $req['sub'], 'username' => $req['username']],
                       ['claims' => $claims, 'core_allow' => $settings['core_allow']]);
    if (isset($result['error'])) dc_service_refuse((string)$result['error'], $result);
    dc_service_log('request.ok', ['action' => $action, 'actor' => $req['sub']]);
    dc_service_send(200, ['ok' => true, 'data' => $result['data']]);
} catch (Throwable $e) {
    /* The class name only: a message can carry a DSN, a path or SQL. */
    error_log('[service] request.failed reason=exception type=' . preg_replace('/[^A-Za-z0-9_\\\\]/', '', get_class($e)));
    $GLOBALS['DC_SERVICE_RID'] = null;
    $GLOBALS['DC_SERVICE_CORE'] = null;
    if (empty($GLOBALS['DC_SERVICE_SENT'])) {
        dc_service_send(503, ['ok' => false, 'error' => ['code' => 'quo_unavailable', 'message' => 'Service temporarily unavailable']]);
    }
}
