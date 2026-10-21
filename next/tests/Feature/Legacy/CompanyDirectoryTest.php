<?php

use App\Legacy\Companies\CompanyDirectory;
use App\Legacy\LegacyNotConfigured;
use Tests\Support\LegacyFixtureDatabase;

afterEach(fn () => LegacyFixtureDatabase::downAll());

it('lists companies by name with api.php quotation count and last-quoted semantics', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $rows = app(CompanyDirectory::class)->list();

    expect(array_column($rows, 'name'))->toBe(['ACME ENGINEERING SDN BHD', 'BINA STEEL WORKS', 'ZENITH FABRICATION']);
    $by = collect($rows)->keyBy('id');

    // ACME: 101 (quote_date 2026-03-01), 102 (quote_date NULL → DATE(created_at) 2026-05-02), 106 (2025-11-01).
    expect($by[1]['quotationCount'])->toBe(3)
        ->and($by[1]['lastQuotedDate'])->toBe('2026-05-02');
    // BINA: 103 (2026-04-15) and 105 (quote_date 2026-02-10 although CREATED 2026-07-01):
    // last quoted follows the business date, not the row's creation.
    expect($by[2]['quotationCount'])->toBe(2)
        ->and($by[2]['lastQuotedDate'])->toBe('2026-04-15')
        ->and($by[2]['lastQuotationCreatedAt'])->toStartWith('2026-07-01');
    // No quotations at all; the walk-in quotation (company_id NULL) is nobody's.
    expect($by[3]['quotationCount'])->toBe(0)
        ->and($by[3]['lastQuotedDate'])->toBeNull();
})->with('legacy drivers');

it('keeps Short Code out of the page payload but still finds a company by it', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $dir = app(CompanyDirectory::class);

    $hit = $dir->list('bsw9');
    expect($hit)->toHaveCount(1)
        ->and($hit[0]['name'])->toBe('BINA STEEL WORKS')
        ->and($hit[0]['matchedBy'])->toBe('alias')
        ->and($hit[0]['aliases'])->toBe(['BSW9']);

    $page = CompanyDirectory::forPage($hit[0]);
    expect($page)->not->toHaveKey('aliases')
        ->and($page)->not->toHaveKey('short_code')
        ->and(json_encode($page))->not->toContain('BSW9');
})->with('legacy drivers');

it('searches by normalised name and by phone digits', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $dir = app(CompanyDirectory::class);

    expect(array_column($dir->list('acme eng.'), 'id'))->toBe([1])
        ->and(array_column($dir->list('Acme-Engineering'), 'id'))->toBe([1])
        ->and($dir->list('acme')[0]['matchedBy'])->toBe('name')
        ->and(array_column($dir->list('0123456789'), 'id'))->toBe([1])
        ->and($dir->list('5555 1234')[0]['matchedBy'])->toBe('phone')
        ->and($dir->list('no such customer'))->toBe([])
        ->and($dir->list('  '))->toHaveCount(3);
})->with('legacy drivers');

it('reads a company profile with its quotations, recent first', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $profile = app(CompanyDirectory::class)->profile(1);

    expect($profile['company']['name'])->toBe('ACME ENGINEERING SDN BHD')
        ->and($profile['company']['phone'])->toBe('012-345 6789')
        ->and($profile['company']['address'])->toBe('LOT 1, JALAN KLANG LAMA')
        ->and($profile['quotations']['total'])->toBe(3)
        ->and(array_column($profile['quotations']['rows'], 'refNo'))->toBe(['Q-2026-0002', 'Q-2026-0001', 'Q-2025-0100']);

    expect(app(CompanyDirectory::class)->profile(999))->toBeNull();
})->with('legacy drivers');

it('says "not configured" rather than failing when there is no legacy database', function () {
    config(['database.connections.legacy.database' => '']);
    expect(fn () => app(CompanyDirectory::class)->list())->toThrow(LegacyNotConfigured::class);
});
