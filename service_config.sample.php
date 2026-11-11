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

    // ── Core-version gate (docs/SERVICE-API.md 3.7) ─────────────────────────
    // The service accepts the parser + pricing + quote cores DEPLOYED BESIDE
    // IT (quo-parser-core.js, quo-pricing-core.js, quo-quote-core.js: SHA-256
    // of the file bytes, contract read from the file), all three together.
    // An older core is accepted ONLY as part of an exact three-core
    // combination listed here. EMPTY BY DEFAULT. Every entry needs parser,
    // pricing and quote (each sha256 = 64 lower-case hex, contract = integer),
    // a reason (text) and a date (YYYY-MM-DD); an entry missing any of them is
    // ignored. The Loop #6 keys parser / pricing / pairs are no longer read.
    // Remove an entry and that combination is refused on the next request.
    // Example (FAKE hashes):
    //   'combinations' => [
    //       ['parser'  => ['sha256' => '<64 hex>', 'contract' => 1],
    //        'pricing' => ['sha256' => '<64 hex>', 'contract' => 1],
    //        'quote'   => ['sha256' => '<64 hex>', 'contract' => 1],
    //        'reason'  => 'QQ 0.2.0 still in use during rollout', 'date' => '2026-11-11'],
    //   ],
    'QQ_SERVICE_ACCEPTED_CORES'  => [
        'combinations' => [],
    ],

    // ── Quotation create (docs/SERVICE-API.md 4.8) ──────────────────────────
    // quotations.create answers 403 create_disabled unless this is 'true'.
    // Ships OFF; it can be switched off again at any time without touching the
    // rest of the service. Requires migrations/2026-11-11-create-quotation-create-requests.sql.
    'QQ_SERVICE_CREATE_ENABLED'  => 'false',

    // ── Nonce housekeeping (docs/SERVICE-API.md 6.1) ────────────────────────
    // On about one accepted request in QQ_SERVICE_NONCE_PRUNE_EVERY (0 = never)
    // the service deletes at most QQ_SERVICE_NONCE_PRUNE_BATCH nonce rows older
    // than QQ_SERVICE_NONCE_KEEP_SECONDS. KEEP cannot go below 240 seconds
    // (2 × the 60 s window + 60 s skew + 60 s margin) whatever is set here.
    'QQ_SERVICE_NONCE_KEEP_SECONDS' => 600,
    'QQ_SERVICE_NONCE_PRUNE_EVERY'  => 50,
    'QQ_SERVICE_NONCE_PRUNE_BATCH'  => 500,
];
