<?php

use Illuminate\Support\Facades\DB;
use Tests\Support\LegacyFixtureDatabase;

/*
 * Wave 2 · Session E — the Builder's customer picker. Read-only JSON over the
 * existing company directory: signed-in only, a few best matches, the hidden
 * legacy short code never returned (it may still match), nothing for an empty
 * query, an honest source state when there is no legacy database.
 */

afterEach(fn () => LegacyFixtureDatabase::downAll());

it('requires a signed-in user', function () {
    $this->getJson('/quotations/new/customers?q=acme')->assertUnauthorized();
});

it('finds customers by name, phone or hidden alias without returning the alias', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $this->actingAs(namedUser());

    $res = $this->getJson('/quotations/new/customers?q=acme eng')->assertOk()->assertJsonPath('source', 'connected');
    expect($res->json('companies'))->toHaveCount(1)
        ->and($res->json('companies.0'))->toMatchArray(['id' => 1, 'name' => 'ACME ENGINEERING SDN BHD', 'phone' => '012-345 6789', 'quotationCount' => 3, 'matchedBy' => 'name'])
        ->and(array_keys($res->json('companies.0')))->toBe(['id', 'name', 'phone', 'address', 'quotationCount', 'lastQuotedDate', 'matchedBy']);

    $alias = $this->getJson('/quotations/new/customers?q=bsw9')->assertOk();
    expect($alias->json('companies.0.name'))->toBe('BINA STEEL WORKS')
        ->and($alias->json('companies.0.matchedBy'))->toBe('alias')
        ->and($alias->getContent())->not->toContain('BSW9')->not->toContain('short_code')->not->toContain('aliases');

    expect($this->getJson('/quotations/new/customers?q=0123456789')->json('companies.0.id'))->toBe(1);
})->with('legacy drivers');

it('returns nothing for an empty or oversized query, and caps the matches', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $this->actingAs(namedUser());

    expect($this->getJson('/quotations/new/customers')->json('companies'))->toBe([])
        ->and($this->getJson('/quotations/new/customers?q='.str_repeat('a', 81))->json('companies'))->toBe([])
        ->and($this->getJson('/quotations/new/customers?q=a')->json('companies'))->toHaveCount(3);

    expect(App\Http\Controllers\Builder\CustomerSearchController::LIMIT)->toBe(8);
})->with('legacy drivers');

it('never writes: the picker only reads the directory', function (string $driver) {
    LegacyFixtureDatabase::for($driver);
    $this->actingAs(namedUser());
    $before = DB::connection('legacy')->table('companies')->count();
    $this->getJson('/quotations/new/customers?q=acme')->assertOk();
    expect(DB::connection('legacy')->table('companies')->count())->toBe($before);
})->with('legacy drivers');

it('reports a missing data source honestly instead of failing', function () {
    config(['database.connections.legacy.database' => null]);
    $this->actingAs(namedUser());
    $this->getJson('/quotations/new/customers?q=acme')->assertOk()->assertJson(['source' => 'not_configured', 'companies' => []]);
});
