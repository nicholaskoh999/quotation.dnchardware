<?php

/*
 * Seeds (or drops) a THROWAWAY local MySQL schema with the Session D legacy
 * fixture, for the optional data leg of tests/e2e/legacy-read.spec.ts:
 *
 *   php tests/e2e/support/legacy-fixture.php up   dnc_next_d_e2e
 *   E2E_LEGACY_SEEDED=1 LEGACY_DB_DATABASE=dnc_next_d_e2e LEGACY_DB_USERNAME=root \
 *     E2E_PORT=8774 npx playwright test
 *   php tests/e2e/support/legacy-fixture.php down dnc_next_d_e2e
 *
 * Only ever 127.0.0.1 root (the local test server); refuses any schema name
 * that does not start with dnc_next_.
 */

use Illuminate\Contracts\Console\Kernel;
use Tests\Support\LegacyFixtureDatabase;

require __DIR__.'/../../../vendor/autoload.php';
$app = require __DIR__.'/../../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[$action, $schema] = [$argv[1] ?? '', $argv[2] ?? 'dnc_next_d_e2e'];
if (! preg_match('/^dnc_next_[a-z0-9_]+$/', $schema) || ! in_array($action, ['up', 'down'], true)) {
    fwrite(STDERR, "usage: legacy-fixture.php up|down dnc_next_<name>\n");
    exit(2);
}

$admin = new PDO('mysql:host='.LegacyFixtureDatabase::MYSQL_HOST.';port=3306', 'root', '');
$admin->exec('DROP DATABASE IF EXISTS `'.$schema.'`');
if ($action === 'up') {
    (new LegacyFixtureDatabase('mysql', $schema))->up();
    echo "seeded {$schema}\n";
} else {
    echo "dropped {$schema}\n";
}
