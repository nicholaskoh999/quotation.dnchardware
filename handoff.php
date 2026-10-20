<?php
/**
 * Entry point for the two DNC Workspace handoff URLs (dnc_handoff.php):
 *
 *   GET /auth/handoff/start
 *   GET /auth/handoff/callback?token=v2.…
 *
 * The host rewrites exactly those two paths here (docs/handoff/QUOTATION-HANDOFF.md
 * §5). The action comes from the request PATH, never from a parameter, and
 * any other path or method is a 404 / 405 with an empty body.
 *
 * ERROR CONTAINMENT — set up here, BEFORE any other file is loaded.
 *
 * The browser may only ever see a handoff response: a status, a Location and
 * the fixed headers, with an EMPTY body (contract §6, §10). Nothing an
 * underlying layer prints may reach it — in particular the legacy getDB() in
 * db.php, which on a connection failure sets 500, prints the driver's error
 * (user, host) and calls die(), and the PHP warning mysqli raises on the way,
 * which display_errors would render with a filesystem path. So:
 *
 *   1. display_errors is switched off for this request: engine messages go to
 *      the server error log only, never into the response.
 *   2. Everything printed is captured in an output buffer that is DISCARDED;
 *      the only bytes sent are the ones dc_handoff_send() writes.
 *   3. Any Throwable from an endpoint (a PDOException from a different db.php,
 *      a mysqli_sql_exception, a bug) becomes the generic failure.
 *   4. A shutdown function catches the exits nothing can catch — die()/exit in
 *      db.php, a fatal error — and replaces whatever was about to be sent with
 *      the generic failure: 303 to /login.php, the one flash message.
 *
 * Headers set along the way are dropped too (the 500 db.php sets, a
 * Content-Type), except Set-Cookie: the session cookie must survive, or the
 * browser would lose the state /start just stored. The log line is a reason
 * code only.
 *
 * This file depends on nothing until the guard is in place, so a failure
 * while loading dnc_handoff.php itself is contained as well.
 */

@ini_set('display_errors', '0');
@ini_set('html_errors', '0');
ob_start();
$GLOBALS['DC_HANDOFF_SENT'] = false;

/** The only bytes a handoff request ever sends: status + fixed headers, no body. */
function dc_handoff_send($status, $location = null) {
    while (ob_get_level() > 0) ob_end_clean();          // whatever anyone printed: gone
    if (!headers_sent()) {
        $cookies = array_values(array_filter(headers_list(),
            function ($h) { return stripos($h, 'Set-Cookie:') === 0; }));
        header_remove();
        foreach ($cookies as $c) header($c, false);
        http_response_code((int)$status);
        if ($location !== null) header('Location: ' . $location);
        header('Referrer-Policy: no-referrer');
        header('Cache-Control: no-store, private');
        header('Content-Length: 0');
    }
    $GLOBALS['DC_HANDOFF_SENT'] = true;
}

register_shutdown_function(function () {
    if (!empty($GLOBALS['DC_HANDOFF_SENT'])) return;
    /* Reached the end of the request without a handoff response: something
       exited or died underneath (db.php's die(), a fatal). Generic failure. */
    $line = '[handoff] auth.handoff_failed reason=internal_error';
    if (function_exists('dc_handoff_log')) {
        dc_handoff_log('auth.handoff_failed', ['reason' => 'internal_error', 'ip' => dc_handoff_ip()]);
    } else {
        error_log($line);
    }
    if (session_status() === PHP_SESSION_ACTIVE) $_SESSION['dc_flash'] = 'handoff_failed';
    dc_handoff_send(303, '/login.php');
});

require_once __DIR__ . '/dnc_handoff.php';

$path = (string)parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
$routes = [
    '/auth/handoff/start'    => 'dc_handoff_start',
    '/auth/handoff/callback' => 'dc_handoff_callback',
];

if (!isset($routes[$path])) {
    dc_handoff_send(404);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    dc_handoff_send(405);
    header('Allow: GET');
    exit;
}

try {
    $r = $routes[$path]();
} catch (Throwable $e) {
    /* Never the message: it may carry a DSN, a user, a host or a path. */
    $r = dc_handoff_fail('internal_error');
}
dc_handoff_send($r['status'], $r['location']);
exit;
