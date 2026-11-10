<?php
/**
 * Service API configuration (service.php) — SAMPLE.
 *
 * service.php is DISABLED unless a file named service_config.php exists on the
 * SERVER, beside service.php, and returns this array with
 * QQ_SERVICE_ENABLED => 'true' and a valid QQ_SERVICE_SECRET. These settings
 * are read from that file ONLY (never from the environment).
 *
 * service_config.php must never be committed to Git or shipped in a patch ZIP,
 * exactly like db.php, ai_config.php and dnc_config.php; the deploy
 * (.cpanel.yml PROTECTED) can neither create nor overwrite it.
 *
 * Contract and runbook: docs/SERVICE-API.md
 */

return [
    // Ships OFF. Only "true" opens the door. "false" (or deleting the file)
    // closes it again at once: service.php then answers 404 not_available.
    'QQ_SERVICE_ENABLED'         => 'false',

    // The caller's X-QQS-Key-Id must equal this. Letters, digits, _ and -.
    'QQ_SERVICE_KEY_ID'          => 'qq-backend-1',

    // "base64:" + base64 of 32 random bytes. Generate it ON THE SERVER:
    //   php -r 'echo "base64:".base64_encode(random_bytes(32)), PHP_EOL;'
    // The same value goes into the QQ backend's own server-only configuration.
    // It MUST differ from DNC_HANDOFF_SECRET (service.php stays disabled if
    // the two are equal) and from every other key. Never put a real value in
    // this sample, in Git, in chat or in a document.
    'QQ_SERVICE_SECRET'          => '',

    // The old key, only during a rotation; empty otherwise.
    'QQ_SERVICE_SECRET_PREVIOUS' => '',
];
