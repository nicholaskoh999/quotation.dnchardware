<?php
/**
 * Database configuration — SAMPLE.
 *
 * Copy this file to  db.php  on the SERVER ONLY and fill in the real
 * credentials. db.php must never be committed to Git or shipped in a patch
 * ZIP, exactly like ai_config.php.
 */

define('DB_HOST', 'localhost');
define('DB_USER', 'REPLACE_ME');
define('DB_PASS', 'REPLACE_ME');
define('DB_NAME', 'REPLACE_ME');

function getDB() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        http_response_code(500);
        die(json_encode(['error' => 'DB connection failed: ' . $conn->connect_error]));
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}
