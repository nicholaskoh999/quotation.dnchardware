<?php
/**
 * GET /version.php — this application's own deployment metadata, for DNC
 * Workspace System Details (server-to-server). Contract shared with
 * Internal PO's /health/version (docs/SYSTEM-VERSION.md):
 *
 *   200 {"system","environment","release","branch","commit","deployed_at"}
 *   503 {"system","environment","error"}   metadata missing or not trustworthy
 *
 * WRITER / READER. The deployment (.cpanel.yml, last step) is the only
 * writer: it stamps ~/quotation-deploy/version.json, outside the docroot,
 * atomically. This file only reads it: no git, no shell, no database, no
 * session, no cookie, and it includes no other file.
 *
 * NEVER A GUESS. The stamp also lists the SHA-256 of every file that deploy
 * copied. If any live file no longer matches (a later deploy from a commit
 * that predates the stamp writer, a deploy that failed half-way, a hand
 * edit), the stamp no longer describes what is live and the answer is 503.
 *
 * Errors never reach the response: display_errors is off, everything printed
 * is discarded, and any Throwable becomes the generic 503.
 */

@ini_set('display_errors', '0');
@ini_set('html_errors', '0');
@ini_set('session.use_cookies', '0');
ob_start();

const DC_VERSION_SYSTEM = 'Quotation';
const DC_VERSION_MAX_BYTES = 65536;

/** The only bytes this endpoint ever sends. */
function dc_version_send(int $status, array $body): void {
    while (ob_get_level() > 0) ob_end_clean();
    if (!headers_sent()) {
        header_remove();
        http_response_code($status);
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: no-referrer');
        if ($status === 405) header('Allow: GET, HEAD');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
        echo json_encode($body, JSON_UNESCAPED_SLASHES);
    }
}

/** The 503 shape: no deployment field, so a reader can never show a guess. */
function dc_version_unavailable(string $environment = 'production'): void {
    dc_version_send(503, ['system' => DC_VERSION_SYSTEM, 'environment' => $environment, 'error' => 'deployment_metadata_unavailable']);
}

/**
 * The validated public metadata, or null. $docroot is where the deployed
 * files live; the stamp is beside the docroot, in ../quotation-deploy/.
 */
function dc_version_read(string $docroot): ?array {
    $path = dirname($docroot) . '/quotation-deploy/version.json';
    if (!is_file($path) || filesize($path) > DC_VERSION_MAX_BYTES) return null;

    $d = json_decode((string)file_get_contents($path), true, 4);
    if (!is_array($d)) return null;

    $environment = $d['environment'] ?? null;
    $release = $d['release'] ?? null;
    $branch = $d['branch'] ?? null;
    $commit = $d['commit'] ?? null;
    $deployedAt = $d['deployed_at'] ?? null;
    $files = $d['files'] ?? null;

    if (!is_string($environment) || !preg_match('/^[a-z]{2,20}$/', $environment)) return null;
    // A real release tag only (quo-r…), never invented: null until one exists.
    if ($release !== null && (!is_string($release) || !preg_match('/^quo-r[0-9][0-9a-z.-]{0,30}$/', $release))) return null;
    if (!is_string($branch) || !preg_match('#^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]{1,100}$#', $branch)) return null;
    if (!is_string($commit) || !preg_match('/^[0-9a-f]{40}$/', $commit)) return null;
    if (!is_string($deployedAt) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/', $deployedAt)) return null;
    if (!is_array($files) || $files === [] || !array_key_exists('version.php', $files)) return null;

    // Every file that deploy copied must still be exactly what it copied.
    foreach ($files as $name => $sha) {
        if (!is_string($name) || !preg_match('#^(?!/)(?!.*\.\.)[A-Za-z0-9._/-]{1,120}$#', $name)) return null;
        if (!is_string($sha) || !preg_match('/^[0-9a-f]{64}$/', $sha)) return null;
        $live = $docroot . '/' . $name;
        if (!is_file($live) || !hash_equals($sha, (string)hash_file('sha256', $live))) return null;
    }

    return [
        'system' => DC_VERSION_SYSTEM,
        'environment' => $environment,
        'release' => $release,
        'branch' => $branch,
        'commit' => $commit,
        'deployed_at' => $deployedAt,
    ];
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'GET' && $method !== 'HEAD') {
        dc_version_send(405, ['system' => DC_VERSION_SYSTEM, 'error' => 'method_not_allowed']);
        exit;
    }

    $meta = dc_version_read(__DIR__);
    if ($meta === null) {
        dc_version_unavailable();
    } else {
        dc_version_send(200, $meta);
    }
} catch (Throwable $e) {
    error_log('[version] deployment_metadata_unavailable reason=exception');
    dc_version_unavailable();
}
