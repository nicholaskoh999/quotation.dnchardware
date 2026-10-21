<?php

use App\Auth\IdentityGuard;
use App\Http\Controllers\Auth\LoginController;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Named-user sign-in against a THROWAWAY app_users table (tests/Support/Identity.php).
 * Legacy oracle: auth.php / login.php / logout.php, tests/php/auth_identity.test.php.
 */

beforeEach(function () {
    useThrowawayAppUsers();
    $this->nicholasId = seedAppUser('nicholas', 'Nicholas Koh', 'correct horse');
    seedAppUser('alson', 'Alson', 'alson-pass');
    seedAppUser('former', 'Former Staff', 'former-pass', enabled: 0);
    // Even if someone re-enabled it, the shared admin login stays refused.
    seedAppUser('admin', 'Administrator', 'admin-pass', enabled: 1);
});

/** Turns CSRF verification back on (Laravel skips it under unit tests). */
function enforceCsrf(): void
{
    app()->bind(PreventRequestForgery::class, fn ($app) => new class($app, $app['encrypter']) extends PreventRequestForgery
    {
        protected function runningUnitTests()
        {
            return false;
        }
    });
}

it('redirects a guest to /login', function () {
    $this->get('/')->assertRedirect('/login');
    expect(Auth::check())->toBeFalse();
});

it('keeps /health public', function () {
    config(['database.connections.legacy.database' => null]);
    $this->getJson('/health')->assertOk()->assertJson(['app' => 'up']);
});

it('renders the login page with auth.user null and the workspace link', function () {
    $this->get('/login')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Auth/Login')
            ->where('auth.user', null)
            ->where('workspace.url', 'https://portal.dnchardware.com'));
});

it('signs in a named user, regenerates the session and shares auth.user', function () {
    $this->get('/login');
    $before = session()->getId();
    $snapshot = appUsersSnapshot();

    $this->post('/login', ['username' => 'nicholas', 'password' => 'correct horse'])
        ->assertStatus(303)
        ->assertRedirect('/');

    expect(session()->getId())->not->toBe($before)
        ->and(session()->get(IdentityGuard::SESSION_KEY))->toMatchArray([
            'source' => 'app_users', 'user_id' => $this->nicholasId, 'username' => 'nicholas', 'display_name' => 'Nicholas Koh',
        ])
        ->and(session()->get(IdentityGuard::SESSION_KEY))->not->toHaveKey('password_hash')
        ->and(appUsersSnapshot())->toBe($snapshot); // sign-in never writes to app_users

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Home')
            ->where('auth.user', [
                'id' => $this->nicholasId,
                'username' => 'nicholas',
                'displayName' => 'Nicholas Koh',
                'source' => 'app_users',
            ]));
});

it('normalises the username like dc_normalize_username (trim + lowercase); display name keeps its casing', function (string $typed) {
    $this->post('/login', ['username' => $typed, 'password' => 'correct horse'])->assertRedirect('/');

    expect(Auth::user()->actor->username)->toBe('nicholas')
        ->and(Auth::user()->actor->displayName)->toBe('Nicholas Koh');
})->with(['Nicholas', 'NICHOLAS', '  nicholas  ', "\tNiChOlAs\n"]);

it('does not trim or fold the password', function () {
    $this->post('/login', ['username' => 'nicholas', 'password' => ' correct horse '])->assertSessionHasErrors(['username' => LoginController::MSG_BAD]);
    $this->post('/login', ['username' => 'nicholas', 'password' => 'Correct Horse'])->assertSessionHasErrors(['username' => LoginController::MSG_BAD]);
    expect(Auth::check())->toBeFalse();
});

it('refuses with one generic message: wrong password, unknown user, disabled user, admin', function (string $username, string $password) {
    $this->from('/login')
        ->post('/login', ['username' => $username, 'password' => $password])
        ->assertRedirect('/login')
        ->assertSessionHasErrors(['username' => LoginController::MSG_BAD]);

    expect(Auth::check())->toBeFalse()
        ->and(session()->has(IdentityGuard::SESSION_KEY))->toBeFalse();
    $this->get('/')->assertRedirect('/login');
})->with([
    'wrong password' => ['nicholas', 'wrong'],
    'unknown user' => ['nobody', 'correct horse'],
    'disabled (enabled = 0)' => ['former', 'former-pass'],
    'admin, even enabled with the right password' => ['admin', 'admin-pass'],
    'ADMIN spelled differently' => ['  Admin ', 'admin-pass'],
]);

it('asks for both fields (legacy errLoginMissing)', function (array $input) {
    $this->post('/login', $input)->assertSessionHasErrors(['username' => LoginController::MSG_MISSING]);
    expect(Auth::check())->toBeFalse();
})->with([
    'nothing' => [[]],
    'blank username' => [['username' => '   ', 'password' => 'x']],
    'no password' => [['username' => 'nicholas', 'password' => '']],
    'array input' => [['username' => ['nicholas'], 'password' => 'correct horse']],
]);

it('never flashes the password back to the form', function () {
    $this->post('/login', ['username' => 'nicholas', 'password' => 'wrong']);
    expect(session()->getOldInput())->not->toHaveKey('password');
});

it('fails closed, with the generic message and no driver text, when app_users cannot be read', function () {
    config(['database.connections.legacy' => [
        'driver' => 'mysql', 'host' => '127.0.0.1', 'port' => 1, 'database' => 'nope_db',
        'username' => 'secret_user_xyz', 'password' => 'secret_pass_xyz', 'options' => [PDO::ATTR_TIMEOUT => 1],
    ]]);
    DB::purge('legacy');

    $res = $this->post('/login', ['username' => 'nicholas', 'password' => 'correct horse'])
        ->assertSessionHasErrors(['username' => LoginController::MSG_BAD]);

    expect(Auth::check())->toBeFalse()
        ->and(json_encode(session()->get('errors')?->all()))->not->toContain('secret_user_xyz')->not->toContain('SQLSTATE');
});

it('has no remember-me: no remember cookie even when asked', function () {
    $res = $this->post('/login', ['username' => 'nicholas', 'password' => 'correct horse', 'remember' => 'on']);

    foreach ($res->headers->getCookies() as $cookie) {
        expect($cookie->getName())->not->toStartWith('remember_');
    }
    expect(Auth::viaRemember())->toBeFalse();
});

it('returns to the intended page after sign-in (same-origin path only)', function () {
    Route::middleware(['web', 'auth'])->get('/__test/deep', fn () => 'deep');

    $this->get('/__test/deep?tab=items')->assertRedirect('/login');
    $this->post('/login', ['username' => 'alson', 'password' => 'alson-pass'])->assertRedirect('/__test/deep?tab=items');
});

it('honours a safe ?next= and ignores an unsafe one', function (string $next, string $expected) {
    Route::middleware(['web', 'auth'])->get('/__test/deep', fn () => 'deep');

    $this->get('/login?next='.rawurlencode($next))->assertOk();
    $this->post('/login', ['username' => 'alson', 'password' => 'alson-pass'])->assertRedirect($expected);
})->with([
    'path' => ['/__test/deep', '/__test/deep'],
    'protocol-relative' => ['//evil.example/x', '/'],
    'absolute URL' => ['https://evil.example/x', '/'],
    'backslash' => ['/\\evil.example', '/'],
    'relative' => ['evil', '/'],
]);

it('sends a signed-in user away from /login', function () {
    $this->actingAs(namedUser())->get('/login')->assertRedirect('/');
});

it('requires the CSRF token on POST /login', function () {
    enforceCsrf();

    $this->postJson('/login', ['username' => 'nicholas', 'password' => 'correct horse'])->assertStatus(419);
    expect(Auth::check())->toBeFalse();

    // A browser (non-JSON) post without a token is turned away too — never signed in.
    $this->from('/login')->post('/login', ['username' => 'nicholas', 'password' => 'correct horse'])->assertRedirect('/login');
    expect(Auth::check())->toBeFalse();

    // With the session's token it works.
    $this->withSession(['_token' => 'test-token'])
        ->post('/login', ['_token' => 'test-token', 'username' => 'nicholas', 'password' => 'correct horse'])
        ->assertRedirect('/');
    expect(Auth::check())->toBeTrue();
});

it('requires the CSRF token on POST /logout', function () {
    enforceCsrf();
    $this->actingAs(namedUser());

    $this->postJson('/logout')->assertStatus(419);
    expect(Auth::check())->toBeTrue();
});

it('signs out this browser: identity gone, session invalidated, message shown', function () {
    $this->post('/login', ['username' => 'nicholas', 'password' => 'correct horse']);
    $signedInId = session()->getId();

    $this->post('/logout')->assertStatus(303)->assertRedirect('/login')->assertSessionHas('success', LoginController::MSG_SIGNED_OUT);

    expect(session()->getId())->not->toBe($signedInId)
        ->and(session()->has(IdentityGuard::SESSION_KEY))->toBeFalse()
        ->and(Auth::check())->toBeFalse();
    $this->get('/')->assertRedirect('/login');
});

it('does not trust a session that cannot name a person (old shared-admin shape, partial, wrong types)', function (array $facts) {
    $this->withSession([IdentityGuard::SESSION_KEY => $facts, 'dc_auth' => true, 'dc_user' => 'admin'])
        ->get('/')->assertRedirect('/login');
})->with([
    'legacy shared shape only' => [[]],
    'no id' => [['source' => 'app_users', 'username' => 'nicholas', 'display_name' => 'N', 'login_time' => time()]],
    'string id' => [['source' => 'app_users', 'user_id' => '7', 'username' => 'nicholas', 'display_name' => 'N', 'login_time' => time()]],
    'no display name' => [['source' => 'app_users', 'user_id' => 7, 'username' => 'nicholas', 'display_name' => '', 'login_time' => time()]],
    'unknown source' => [['source' => 'admin', 'user_id' => 7, 'username' => 'nicholas', 'display_name' => 'N', 'login_time' => time()]],
    'no login time' => [['source' => 'app_users', 'user_id' => 7, 'username' => 'nicholas', 'display_name' => 'N']],
]);

it('ends a sign-in after the absolute lifetime (legacy 7 days)', function () {
    $facts = ['source' => 'app_users', 'user_id' => 7, 'username' => 'nicholas', 'display_name' => 'Nicholas Koh'];

    $this->withSession([IdentityGuard::SESSION_KEY => $facts + ['login_time' => time() - 604801]])->get('/')->assertRedirect('/login');
    expect(session()->has(IdentityGuard::SESSION_KEY))->toBeFalse();

    Auth::forgetGuards();
    $this->withSession([IdentityGuard::SESSION_KEY => $facts + ['login_time' => time() - 604000]])->get('/')->assertOk();
});

it('does not query app_users on an ordinary signed-in request', function () {
    $this->post('/login', ['username' => 'nicholas', 'password' => 'correct horse']);
    Auth::forgetGuards();

    DB::connection('legacy')->enableQueryLog();
    $this->get('/')->assertOk();
    expect(DB::connection('legacy')->getQueryLog())->toBe([]);
});
