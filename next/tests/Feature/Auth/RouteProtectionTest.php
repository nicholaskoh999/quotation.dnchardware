<?php

/*
 * Every application route needs a signed-in user. Only these are public; a
 * new route added outside the `auth` group in routes/web.php fails here.
 */
const PUBLIC_ROUTES = ['health', 'login', 'logout', 'auth/handoff/start', 'auth/handoff/callback'];

it('protects every route except the public allowlist', function () {
    $unprotected = collect(app('router')->getRoutes()->getRoutes())
        ->reject(fn ($route) => in_array($route->uri(), PUBLIC_ROUTES, true))
        ->reject(fn ($route) => str_starts_with($route->uri(), '__test'))
        ->reject(fn ($route) => in_array('auth', $route->gatherMiddleware(), true))
        ->map(fn ($route) => implode('|', $route->methods()).' '.$route->uri())
        ->values()
        ->all();

    expect($unprotected)->toBe([]);
});

it('uses a host-only, HttpOnly, SameSite=Lax session cookie that never collides with the legacy one', function () {
    expect(config('session.cookie'))->toBe('dcquo_next_session')
        ->not->toBe('DCQUOSESS')->not->toBe('__Host-DCQUOSESS')
        ->and(config('session.domain'))->toBeNull()
        ->and(config('session.http_only'))->toBeTrue()
        ->and(config('session.same_site'))->toBe('lax')
        ->and(config('auth.guards.web.driver'))->toBe('quo-identity');
});
