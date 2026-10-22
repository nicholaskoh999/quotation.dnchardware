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

it('pins the web PHP to ea-php84 in public/.htaccess (LiteSpeed would otherwise fall back to PHP 8.0)', function () {
    expect(file_get_contents(public_path('.htaccess')))->toContain('AddHandler application/x-httpd-ea-php84');
});

it('keeps every deploy / release shell script free of process substitution and rsync (ServerFreak CageFS has no /dev/fd, the host has no rsync)', function () {
    $scripts = array_merge(glob(base_path('scripts/*.sh')) ?: [], glob(base_path('deploy/preview/*.sh')) ?: []);
    expect($scripts)->not->toBeEmpty();
    foreach ($scripts as $f) {
        $src = file_get_contents($f);
        expect($src)->not->toMatch('/<\(/')->not->toMatch('/>\(/')->not->toMatch('/\brsync\b(?!.*(?:no|never))/i')
            ->and(str_starts_with($src, "#!/bin/sh"))->toBeTrue();
    }
});

it('marks the preview deploy as preview-only and denies the production host and docroot', function () {
    $conf = file_get_contents(base_path('deploy/preview/quo-preview.conf'));
    expect($conf)->toContain('PREVIEW ONLY')->toContain('DENY_HOSTS="quo.dnchardware.com"')->toContain('/home5/dnchardw/quo.dnchardware.com');
    foreach (glob(base_path('deploy/preview/*.sh')) as $f) {
        expect(file_get_contents($f))->toContain('PREVIEW ONLY');
    }
});
