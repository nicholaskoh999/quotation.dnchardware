<?php
/**
 * DNC Workspace handoff configuration — SAMPLE.
 *
 * Every setting is read from the ENVIRONMENT first (same names). Where the
 * host makes environment variables awkward, copy this file to dnc_config.php
 * on the SERVER ONLY and fill it in. dnc_config.php must never be committed to
 * Git or shipped in a patch ZIP, exactly like db.php and ai_config.php; the
 * deploy (.cpanel.yml) refuses to overwrite it.
 *
 * Contract: dnc-portal docs/HANDOFF-CONTRACT.md (v2, bab1b67) §4.
 * Setup:    docs/handoff/QUOTATION-HANDOFF.md
 */

return [
    // Ships OFF. "true" serves /auth/handoff/start and /auth/handoff/callback.
    'DNC_HANDOFF_ENABLED'         => 'false',

    // Quotation's own handoff key: "base64:" + base64 of 32 random bytes:
    //   php -r 'echo "base64:".base64_encode(random_bytes(32)), PHP_EOL;'
    // The SAME value as the Portal's DNC_HANDOFF_SECRET_QUOTATION, and it MUST
    // differ from the Internal PO key. Never put a real value in this sample.
    'DNC_HANDOFF_SECRET'          => '',
    // The old key, only during a rotation (contract §4.3); empty otherwise.
    'DNC_HANDOFF_SECRET_PREVIOUS' => '',

    // The only place /auth/handoff/start may redirect to. Plain https origin.
    'DNC_PORTAL_URL'              => 'https://portal.dnchardware.com',

    // Canonical DNC users (Internal PO's `users` table), READ-ONLY. Use a
    // MySQL user that holds SELECT on that table and nothing else. Host,
    // schema and user must be confirmed from Internal PO's real production
    // configuration — never guessed.
    'DNC_USERS_DB_HOST'           => '',
    'DNC_USERS_DB_PORT'           => '3306',
    'DNC_USERS_DB_DATABASE'       => '',
    'DNC_USERS_DB_USERNAME'       => '',
    'DNC_USERS_DB_PASSWORD'       => '',
];
