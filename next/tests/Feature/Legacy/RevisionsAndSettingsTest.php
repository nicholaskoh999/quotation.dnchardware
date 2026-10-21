<?php

use App\Legacy\Revisions\QuotationRevisions;
use App\Legacy\Settings\LegacyIssuers;
use App\Legacy\Settings\LegacySettings;
use Tests\Support\LegacyFixtureDatabase;

afterEach(fn () => LegacyFixtureDatabase::downAll());

it('reads revision metadata in revision order, without the snapshot', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $h = app(QuotationRevisions::class)->forQuotation(101);

    expect($h['state'])->toBe('ok')
        ->and(array_column($h['entries'], 'revisionNo'))->toBe([1, 2])
        ->and(array_column($h['entries'], 'event'))->toBe(['create', 'update'])
        ->and($h['entries'][0]['actor'])->toBe(['userId' => 7, 'username' => 'nicholas', 'displayName' => 'Nicholas Koh'])
        ->and($h['entries'][1]['createdAt'])->toBe('2026-03-02 14:10:00')
        ->and($h['entries'][0]['schemaVersion'])->toBe(1)
        ->and(json_encode($h))->not->toContain('snapshot_json')
        ->and(json_encode($h))->not->toContain('158.60');
})->with('legacy drivers');

it('tells an empty history apart from a failed read', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    expect(app(QuotationRevisions::class)->forQuotation(102))->toBe(['state' => 'empty', 'entries' => []]);
    LegacyFixtureDatabase::downAll();

    // The table does not exist: that is "unavailable", NOT "no history".
    LegacyFixtureDatabase::for($driver, ['quotation_revisions']);
    expect(app(QuotationRevisions::class)->forQuotation(101))->toBe(['state' => 'unavailable', 'entries' => []]);
})->with('legacy drivers');

it('reports not_configured history when there is no legacy database', function () {
    config(['database.connections.legacy.database' => null]);
    expect(app(QuotationRevisions::class)->forQuotation(101))->toBe(['state' => 'not_configured', 'entries' => []]);
});

it('reads the default WhatsApp template and what the legacy page actually uses of it', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $t = app(LegacySettings::class)->whatsappTemplate();

    expect($t['state'])->toBe('connected')
        ->and($t['source'])->toBe('database')
        ->and($t['name'])->toBe('Shop default')
        ->and($t['body'])->toContain('{validUntil}')
        // sanitizeWATemplate(): the Valid Until line goes, runs of blank lines collapse
        ->and($t['effectiveBody'])->toBe("Hello {customer}\nItems:\n{items}\n\nTotal: RM{total}");
})->with('legacy drivers');

it('falls back to the legacy built-in WhatsApp template', function (string $driver) {
    LegacyFixtureDatabase::for($driver, ['whatsapp_templates']);
    $t = app(LegacySettings::class)->whatsappTemplate();

    expect($t['state'])->toBe('unavailable')
        ->and($t['source'])->toBe('default')
        ->and($t['body'])->toBe(LegacySettings::WA_DEFAULT_TPL)
        ->and($t['body'])->toStartWith("Hi {customer},\nQuotation {quotationNo} is ready.");
})->with('legacy drivers');

it('pins the built-in template to index.php WA_DEFAULT_TPL byte for byte', function () {
    $index = (string) file_get_contents(base_path('../index.php'));
    preg_match('/const WA_DEFAULT_TPL=`([^`]*)`;/', $index, $m);
    expect($m)->toHaveKey(1)
        ->and(LegacySettings::WA_DEFAULT_TPL)->toBe(str_replace('\n', "\n", $m[1]));
});

it('exposes the three legacy issuer names as read-only reference data', function () {
    $index = (string) file_get_contents(base_path('../index.php'));
    preg_match('/<select id="qi-issued-by"[^>]*>(.*?)<\/select>/s', $index, $m);
    preg_match_all('/<option value="([^"]+)">/', $m[1] ?? '', $opts);

    expect(LegacyIssuers::NAMES)->toBe($opts[1])
        ->and(app(LegacySettings::class)->issuers())->toMatchArray(['persisted' => false])
        ->and(LegacyIssuers::NOTE)->toContain('per-issuer letterhead profiles arrive later');
});

it('reads default prices and active diameter settings without a UI', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $s = app(LegacySettings::class);

    expect($s->defaultPrices())->toBe([]);
    $d = $s->diameterSettings();
    expect($d)->toHaveCount(1)
        ->and($d[0])->toMatchArray(['product_type' => 'sagrod', 'material' => 'MS', 'size' => 'M12', 'diameter' => 10.6, 'is_active' => 1]);
})->with('legacy drivers');
