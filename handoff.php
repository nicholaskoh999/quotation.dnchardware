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
 */
require_once __DIR__ . '/dnc_handoff.php';

$path = (string)parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
$routes = [
    '/auth/handoff/start'    => 'dc_handoff_start',
    '/auth/handoff/callback' => 'dc_handoff_callback',
];

if (!isset($routes[$path])) {
    dc_handoff_emit(dc_handoff_response(404));
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    dc_handoff_emit(dc_handoff_response(405));
    exit;
}

dc_handoff_emit($routes[$path]());
exit;
