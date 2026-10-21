<?php

use Inertia\Testing\AssertableInertia as Assert;

// W1 integration: every shell page is behind sign-in (Session C).
beforeEach(fn () => $this->actingAs(namedUser()));

dataset('shell routes', [
    'home' => ['home', '/', 'Home'],
    'quotations.index' => ['quotations.index', '/quotations', 'Quotations/Index'],
    'quotations.create' => ['quotations.create', '/quotations/new', 'Quotations/Create'],
    'companies.index' => ['companies.index', '/companies', 'Companies/Index'],
    'price-lookup' => ['price-lookup', '/price-lookup', 'PriceLookup'],
    'calculator' => ['calculator', '/calculator', 'Calculator'],
    'system-health' => ['system-health', '/system-health', 'SystemHealth'],
    'settings' => ['settings', '/settings', 'Settings'],
]);

it('serves each shell route with its Inertia page', function (string $name, string $uri, string $component) {
    expect(route($name, absolute: false))->toBe($uri);

    $this->get($uri)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component)->has('release.version'));
})->with('shell routes');

it('ships a page component file for every shell route', function (string $name, string $uri, string $component) {
    expect(resource_path("js/pages/{$component}.tsx"))->toBeFile();
})->with('shell routes');

it('keeps New Quotation query entry points on the placeholder page', function () {
    $this->get('/quotations/new?mode=quick')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Quotations/Create'));
    $this->get('/quotations/new?product=sagrod')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Quotations/Create'));
});

it('does not route any retired legacy settings page', function () {
    foreach (['/default-prices', '/diameter-settings', '/pricing-guide', '/version-updates'] as $uri) {
        config(['app.debug' => false]);
        $this->get($uri)->assertNotFound();
    }
});

it('does not fake recent quotations on Home before a data source exists', function () {
    $this->get('/')->assertInertia(fn (Assert $page) => $page->component('Home')->missing('recentQuotations'));
});

it('shows the newest five saved quotations on Home, read from the legacy data', function () {
    \Tests\Support\LegacyFixtureDatabase::for('sqlite');
    try {
        $this->get('/')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Home')
            ->has('recentQuotations')
            ->where('recentQuotations', fn ($rows) => count($rows) >= 1 && count($rows) <= 5
                && isset($rows[0]['id'], $rows[0]['refNo'])
                && preg_match('/^Q-\d{4}-\d{4}$/', $rows[0]['refNo']) === 1));
    } finally {
        \Tests\Support\LegacyFixtureDatabase::downAll();
    }
});
