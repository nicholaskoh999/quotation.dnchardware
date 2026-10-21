<?php

/*
 * QUOTATION NEXT application settings. Business rules do NOT live here — they
 * live in the framework-free domain engine. This file only holds deployment
 * switches, all of them safe by default.
 */
return [

    /* The production legacy hostname. Any attempt to boot this application
       with APP_URL on it is refused unless the deployment states, in the
       environment, that the owner approved production (handoff §2). */
    'production_host' => 'quo.dnchardware.com',

    'production_approved' => (bool) env('QUOTATION_PRODUCTION_APPROVED', false),

    /* /health only touches the database when told to, so a preview without a
       database configured answers "not_configured" instead of an error. */
    'health_checks_database' => (bool) env('HEALTH_CHECK_DATABASE', true),

    /* Wave 1 is read-only against the legacy schema. Write paths arrive in
       Wave 2 behind this switch, which stays false until write-path proof. */
    'legacy_writes_enabled' => false,

    /* Release identity. Normally stamped into RELEASE.json at build time; the
       environment may override it. See App\Support\Release. */
    'release' => [
        'version' => env('APP_RELEASE'),
        'sha' => env('APP_GIT_SHA'),
        'built_at' => env('APP_BUILT_AT'),
    ],

    /* Named-user sign-in against the legacy `app_users` table (handoff §5).
       See app/Auth/NOTES.md. Nothing here is a credential. */
    'auth' => [
        // The connection `app_users` is READ through. Never written.
        'connection' => 'legacy',

        /* Absolute cap on one sign-in, independent of the idle
           SESSION_LIFETIME — legacy DC_AUTH_LIFETIME (7 days). */
        'absolute_lifetime_seconds' => (int) env('QUO_AUTH_ABSOLUTE_LIFETIME', 604800),

        /* Floor under every failed sign-in, on top of the bcrypt work
           (legacy usleep(400000)). Tests set it to 0. */
        'failure_delay_ms' => (int) env('QUO_AUTH_FAILURE_DELAY_MS', 400),

        /* Usernames refused even if the row is enabled. `admin` is a role,
           never a shared login; the owner disabled the row and it stays
           disabled — this is defence in depth, not a replacement for it. */
        'refused_usernames' => ['admin'],
    ],

    /* "Back to DNC Workspace" (handoff §4). A link only. */
    'workspace' => [
        'url' => env('DNC_PORTAL_URL', 'https://portal.dnchardware.com'),
    ],

    /* DNC Workspace → Quotation sign-in handoff, contract v2
       (app/Handoff/Contract, copied byte for byte from the Portal). SHIPS OFF:
       both endpoints answer 404 until DNC_HANDOFF_ENABLED=true. */
    'handoff' => [
        'enabled' => filter_var(env('DNC_HANDOFF_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
        // "base64:" + 32 random bytes; same value as the Portal's DNC_HANDOFF_SECRET_QUOTATION.
        'secret' => env('DNC_HANDOFF_SECRET'),
        // The old key, only while a rotation is in progress.
        'secret_previous' => env('DNC_HANDOFF_SECRET_PREVIOUS'),
        // The only place /auth/handoff/start may send a browser.
        'portal_url' => env('DNC_PORTAL_URL', 'https://portal.dnchardware.com'),
        // Replay (consumed jti) and rate-limit counters. No database tables.
        'cache_store' => env('DNC_HANDOFF_CACHE_STORE', 'file'),
        'rate_limit' => 30,            // requests per window, per IP, per endpoint
        'rate_window_seconds' => 60,
        'replay_keep_seconds' => 3600, // a consumed jti is remembered this long past its exp
        /* Canonical DNC users (Internal PO `users`), READ-ONLY, separate
           credentials. Unset by default: the callback then refuses (fail
           closed). Registered as the `dnc_users` connection at boot. */
        'users_connection' => 'dnc_users',
        'users_db' => [
            'driver' => 'mysql',
            'host' => env('DNC_USERS_DB_HOST'),
            'port' => env('DNC_USERS_DB_PORT', '3306'),
            'database' => env('DNC_USERS_DB_DATABASE'),
            'username' => env('DNC_USERS_DB_USERNAME'),
            'password' => env('DNC_USERS_DB_PASSWORD', ''),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'strict' => true,
            'options' => extension_loaded('pdo_mysql') ? [PDO::ATTR_TIMEOUT => 5] : [],
        ],
    ],
];
