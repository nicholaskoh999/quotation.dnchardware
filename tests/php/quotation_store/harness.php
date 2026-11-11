<?php
/**
 * TEST-ONLY host for quotation_store.php. Never deployed (not in .cpanel.yml
 * APPFILES) and not reachable over HTTP: it lives under tests/.
 *
 * It plays the part api.php plays for the store — the error channel, the
 * transaction scope global, the timezone and the mysqli report mode — but
 * its fail_json()/dc_db_fail() THROW instead of echoing and exiting, after
 * unwinding exactly as api.php's do (dc_txn_cleanup first).
 */

mysqli_report(MYSQLI_REPORT_OFF);
date_default_timezone_set('Asia/Kuala_Lumpur');

class DcStoreFail extends RuntimeException {}

$GLOBALS['DC_TXN'] = ['db' => null, 'active' => false, 'lock' => false];

function fail_json($error) {
    dc_txn_cleanup();
    throw new DcStoreFail((string)$error);
}

function dc_db_fail($label, $handle = null) {
    $detail = is_object($handle) ? (int)@$handle->errno . ' ' . (string)@$handle->error : (string)$handle;
    $GLOBALS['DC_LAST_DB_FAIL'] = $label . ' | ' . $detail;
    fail_json($label);
}

/* Only dc_write_revision() (the browser wrapper) calls this; the store's
   create path takes the actor explicitly. */
function dc_current_user() { return $GLOBALS['DC_TEST_SESSION_USER'] ?? null; }

require_once dirname(__DIR__, 3) . '/quotation_store.php';

function dc_test_connect($dbName) {
    $H = getenv('DC_TEST_DB_HOST') ?: '127.0.0.1';
    $P = (int)(getenv('DC_TEST_DB_PORT') ?: 3306);
    $U = getenv('DC_TEST_DB_USER') ?: 'root';
    $W = getenv('DC_TEST_DB_PASS'); if ($W === false) $W = '';
    $db = @new mysqli($H, $U, $W, $dbName, $P);
    if (!$db || $db->connect_errno) return null;
    $db->set_charset('utf8mb4');
    @$db->query("SET time_zone = '+08:00'");
    return $db;
}

/* Run one create and turn the outcome into plain data. */
function dc_test_create($db, $payload, $actor, $idem) {
    $GLOBALS['DC_LAST_DB_FAIL'] = null;
    try {
        return dc_store_create_quotation($db, $payload, $actor, $idem);
    } catch (DcStoreFail $e) {
        return ['ok' => false, 'code' => 'db_failure', 'error' => $e->getMessage(),
                'detail' => $GLOBALS['DC_LAST_DB_FAIL'],
                'txn_after' => ['active' => $GLOBALS['DC_TXN']['active'], 'lock' => $GLOBALS['DC_TXN']['lock']]];
    }
}
