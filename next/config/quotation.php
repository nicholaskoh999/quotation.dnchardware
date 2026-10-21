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
];
