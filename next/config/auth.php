<?php

/*
 * QUOTATION NEXT authentication (app/Auth/NOTES.md).
 *
 * Named users from the legacy `app_users` table, read-only (handoff §5). The
 * `quo-identity` guard keeps the verified identity facts in the Laravel
 * session (file driver); the `legacy-app-users` provider only ever SELECTs.
 * There is no remember-me, no password reset and no shared-admin fallback.
 * Both drivers are registered by App\Auth\AuthServiceProvider.
 */
return [

    'defaults' => [
        'guard' => 'web',
        'passwords' => null,
    ],

    'guards' => [
        'web' => [
            'driver' => 'quo-identity',
            'provider' => 'app_users',
        ],
    ],

    'providers' => [
        'app_users' => [
            'driver' => 'legacy-app-users',
        ],
    ],

    // No password reset broker: accounts are managed by an operator (legacy).
    'passwords' => [],

    'password_timeout' => 10800,

];
