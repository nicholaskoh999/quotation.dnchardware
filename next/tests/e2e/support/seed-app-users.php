<?php

/*
 * E2E ONLY. Creates a THROWAWAY schema on the LOCAL MySQL (127.0.0.1) with an
 * app_users table shaped like migrations/2026-08-26-create-app-users.sql and
 * test-only accounts. Never points anywhere but 127.0.0.1; refuses any schema
 * name not starting with "quo_next_e2e" / "dnc_next_e2e". Run by
 * tests/e2e/global-setup.ts. With --into-existing it adds app_users to a schema
 * the legacy fixture already created (W1 integration: one e2e data source).
 *
 *   php tests/e2e/support/seed-app-users.php <schema>
 */

$schema = $argv[1] ?? '';
if (preg_match('/^(quo_next_e2e|dnc_next_e2e)[a-z0-9_]*$/', $schema) !== 1) {
    fwrite(STDERR, "refusing schema name\n");
    exit(2);
}

try {
    $pdo = new PDO('mysql:host=127.0.0.1;port=3306', 'root', '', [PDO::ATTR_TIMEOUT => 3, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    if (in_array('--into-existing', $argv, true)) {
        $pdo->exec("DROP TABLE IF EXISTS `$schema`.app_users");
    } else {
        $pdo->exec("DROP DATABASE IF EXISTS `$schema`");
        $pdo->exec("CREATE DATABASE `$schema`");
    }
    $pdo->exec("CREATE TABLE `$schema`.app_users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        username VARCHAR(64) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_app_users_username (username)
    ) ENGINE=InnoDB");
    $insert = $pdo->prepare("INSERT INTO `$schema`.app_users (username, display_name, password_hash, enabled) VALUES (?, ?, ?, ?)");
    foreach ([
        ['e2etester', 'E2E Tester', 'e2e-only-password', 1],
        ['e2edisabled', 'E2E Disabled', 'e2e-only-password', 0],
        ['admin', 'Administrator', 'e2e-only-password', 0],
    ] as [$u, $d, $p, $e]) {
        $insert->execute([$u, $d, password_hash($p, PASSWORD_BCRYPT, ['cost' => 4]), $e]);
    }
} catch (Throwable $e) {
    fwrite(STDERR, "local MySQL unavailable\n");
    exit(1);
}

echo "ok\n";
