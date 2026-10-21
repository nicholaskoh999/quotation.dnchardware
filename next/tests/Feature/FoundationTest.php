<?php

use Inertia\Testing\AssertableInertia as Assert;

it('renders the Home page through Inertia with shared release props', function () {
    $this->actingAs(namedUser())->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Home')
            ->has('release.version')
            ->has('appName'));
});

it('runs on Malaysia time', function () {
    expect(config('app.timezone'))->toBe('Asia/Kuala_Lumpur')
        ->and(date_default_timezone_get())->toBe('Asia/Kuala_Lumpur');
});

it('refuses to serve the production hostname without owner approval', function () {
    config(['quotation.production_approved' => false]);

    $this->get('http://quo.dnchardware.com/health')->assertStatus(503);
    $this->get('http://quo.dnchardware.com/')->assertStatus(503);
});

it('serves a preview hostname normally', function () {
    $this->get('http://quo-preview.dnchardware.com/health')->assertOk();
});

it('ships no migration that would write to the legacy schema', function () {
    $files = glob(database_path('migrations/*.php')) ?: [];
    expect($files)->toBe([]);
});

it('keeps legacy writes switched off in Wave 1', function () {
    expect(config('quotation.legacy_writes_enabled'))->toBeFalse();
});

it('renders HTTP errors as a safe page with no exception detail', function () {
    config(['app.debug' => false]);
    $this->get('/definitely-not-a-page')
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page->component('Error')->where('status', 404));
});

it('exposes no framework storage route (and so no public PUT upload)', function () {
    $uris = collect(app('router')->getRoutes()->getRoutes())->map(fn ($r) => $r->uri());
    expect($uris->filter(fn ($u) => str_starts_with($u, 'storage')))->toBeEmpty();
});
