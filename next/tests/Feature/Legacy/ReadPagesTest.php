<?php

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\LegacyFixtureDatabase;

// W1 integration: the read pages are behind sign-in (Session C).
beforeEach(fn () => $this->actingAs(namedUser()));
afterEach(fn () => LegacyFixtureDatabase::downAll());

it('renders the company directory with usage figures and no short code', function (string $driver) {
    LegacyFixtureDatabase::for($driver);

    $res = $this->get('/companies')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Companies/Index')
        ->where('source', 'connected')
        ->has('companies', 3)
        ->where('companies.0.name', 'ACME ENGINEERING SDN BHD')
        ->where('companies.0.quotationCount', 3)
        ->where('companies.0.lastQuotedDate', '2026-05-02')
        ->missing('companies.0.aliases')
        ->missing('companies.0.short_code'));

    foreach (['ACM"', 'BSW9', 'short_code', 'aliases'] as $leak) {
        expect($res->getContent())->not->toContain($leak);
    }

    $this->get('/companies?q=bsw9')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('companies', 1)
        ->where('companies.0.name', 'BINA STEEL WORKS')
        ->where('companies.0.matchedBy', 'alias')
        ->where('search', 'bsw9'));
})->with('legacy drivers');

it('renders a company profile with its quotations', function (string $driver) {
    LegacyFixtureDatabase::for($driver);

    $this->get('/companies/2')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Companies/Show')
        ->where('source', 'connected')
        ->where('company.name', 'BINA STEEL WORKS')
        ->where('quotations.total', 2)
        ->where('quotations.rows.0.refNo', 'Q-2026-0005'));

    $this->get('/companies/999')->assertNotFound();
})->with('legacy drivers');

it('renders the quotation list and detail without raw JSON or the pricing recipe', function (string $driver) {
    LegacyFixtureDatabase::for($driver);

    $this->get('/quotations?company=1')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Quotations/Index')
        ->where('filters.company', 1)
        ->where('quotations.total', 3)
        ->where('quotations.rows.0.refNo', 'Q-2026-0002'));

    $res = $this->get('/quotations/101')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Quotations/Show')
        ->where('quotation.refNo', 'Q-2026-0001')
        ->where('quotation.totalAmount', '158.60')
        ->where('quotation.issuer', null)
        ->where('quotation.items.1.pricing.customerUnitPrice', 33.4)
        ->where('quotation.items.1.material.label', '4140 QT')
        ->missing('quotation.rawItems')
        ->missing('quotation.items.0.raw')
        ->missing('quotation.items.0.internal')
        ->where('revisions.state', 'ok')
        ->has('revisions.entries', 2));

    foreach (['costRate', 'addCost', 'markup', 'formData', 'rawItems'] as $leak) {
        expect($res->getContent())->not->toContain($leak);
    }

    $this->get('/quotations/104')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('quotation.itemsState', 'unreadable')
        ->where('quotation.totalAmount', '50.00')
        ->where('revisions.state', 'empty'));

    $this->get('/quotations/424242')->assertNotFound();
})->with('legacy drivers');

it('degrades honestly when no legacy database is configured', function (string $url, string $component) {
    config(['database.connections.legacy.database' => '']);

    $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component($component)
        ->where('source', 'not_configured'));
})->with([
    ['/companies', 'Companies/Index'],
    ['/companies/1', 'Companies/Show'],
    ['/quotations', 'Quotations/Index'],
    ['/quotations/1', 'Quotations/Show'],
]);

it('degrades honestly, without leaking driver detail, when the database cannot be reached', function (string $url, string $component) {
    config([
        'database.connections.legacy' => [
            'driver' => 'mysql', 'host' => '127.0.0.1', 'port' => 1, 'database' => 'nope_db_xyz',
            'username' => 'secret_user_xyz', 'password' => 'secret_pass_xyz', 'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci', 'prefix' => '', 'options' => [PDO::ATTR_TIMEOUT => 1],
        ],
    ]);
    DB::purge('legacy');

    $res = $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component($component)
        ->where('source', 'unavailable'));
    foreach (['secret_user_xyz', 'secret_pass_xyz', 'nope_db_xyz', 'SQLSTATE', base_path()] as $leak) {
        expect($res->getContent())->not->toContain($leak);
    }
})->with([
    ['/companies', 'Companies/Index'],
    ['/quotations/7', 'Quotations/Show'],
]);

it('refuses non-numeric and oversized ids with a calm 404', function () {
    config(['app.debug' => false]);
    $this->get('/quotations/abc')->assertNotFound();
    $this->get('/companies/99999999999999999999')->assertNotFound();
});
