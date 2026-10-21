<?php

use App\Auth\IdentityGuard;
use App\Handoff\Contract\HandoffToken;
use App\Handoff\HandoffLog;
use App\Http\Controllers\Auth\HandoffController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * DNC Workspace → Quotation handoff (target side), ported from
 * origin/round/r5-c-portal-handoff tests/php/handoff_flow.test.php to Pest.
 * Canonical users live in an in-memory sqlite `dnc_users` connection created
 * here; replay and rate limit use the array cache store.
 */

const FLOW_SECRET = 'base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';

beforeEach(function () {
    config([
        'quotation.handoff.enabled' => true,
        'quotation.handoff.secret' => FLOW_SECRET,
        'quotation.handoff.secret_previous' => null,
        'quotation.handoff.portal_url' => 'https://portal.dnchardware.com',
        'quotation.handoff.cache_store' => 'array',
        'database.connections.dnc_users' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''],
    ]);
    DB::purge('dnc_users');
    DB::connection('dnc_users')->statement('CREATE TABLE users (
        id INTEGER PRIMARY KEY, username VARCHAR(20) NOT NULL, name VARCHAR(255) NULL, email VARCHAR(255) NULL,
        role VARCHAR(16) NOT NULL, is_active TINYINT NOT NULL DEFAULT 1,
        is_legacy_placeholder TINYINT NOT NULL DEFAULT 0, must_change_password TINYINT NOT NULL DEFAULT 0
    )');
    DB::connection('dnc_users')->table('users')->insert([
        ['id' => 42, 'username' => 'alson', 'name' => "  Alson \n Tan ", 'email' => 'a@x', 'role' => 'member', 'is_active' => 1, 'is_legacy_placeholder' => 0, 'must_change_password' => 0],
        ['id' => 43, 'username' => 'ck', 'name' => '', 'email' => null, 'role' => 'admin', 'is_active' => 1, 'is_legacy_placeholder' => 0, 'must_change_password' => 0],
        ['id' => 50, 'username' => 'gone', 'name' => 'Gone', 'email' => null, 'role' => 'member', 'is_active' => 0, 'is_legacy_placeholder' => 0, 'must_change_password' => 0],
        ['id' => 51, 'username' => 'legacy', 'name' => 'Legacy', 'email' => null, 'role' => 'member', 'is_active' => 1, 'is_legacy_placeholder' => 1, 'must_change_password' => 0],
        ['id' => 52, 'username' => 'newbie', 'name' => 'New', 'email' => null, 'role' => 'member', 'is_active' => 1, 'is_legacy_placeholder' => 0, 'must_change_password' => 1],
    ]);

    $this->log = new class extends HandoffLog
    {
        /** @var list<string> */
        public array $lines = [];

        protected function emit(string $line): void
        {
            $this->lines[] = $line;
        }
    };
    app()->instance(HandoffLog::class, $this->log);
});

/** GET /start in this browser; returns the state the Portal would receive. */
function startHandoff($test): string
{
    $res = $test->get('/auth/handoff/start')->assertStatus(303);
    $location = $res->headers->get('Location');
    expect($location)->toStartWith('https://portal.dnchardware.com/handoff/authorize?audience=quotation&state=');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $q);

    return $q['state'];
}

/** What the Portal would sign for that state. */
function portalToken(string $state, int $sub = 42, string $username = 'alson', string $role = 'member', ?int $now = null, string $audience = 'quotation', string $secret = FLOW_SECRET): string
{
    return HandoffToken::encode(HandoffToken::claims($audience, $sub, $username, $role, $state, $now ?? time()), HandoffToken::parseSecret($secret));
}

function lastReason($test): ?string
{
    $line = collect($test->log->lines)->last(fn ($l) => str_contains($l, 'auth.handoff_failed'));

    return $line && preg_match('/reason=(\S+)/', $line, $m) ? $m[1] : null;
}

function assertGenericFailure($res): void
{
    $res->assertStatus(303)
        ->assertHeader('Location', '/login')
        ->assertHeader('Referrer-Policy', 'no-referrer')
        ->assertSessionHas('error', HandoffController::MSG_FAILED);
    expect($res->getContent())->toBe('')
        ->and(Auth::check())->toBeFalse();
}

it('answers 404 on both endpoints while DNC_HANDOFF_ENABLED is off (the default)', function () {
    config(['quotation.handoff.enabled' => false]);

    $this->get('/auth/handoff/start')->assertNotFound();
    $this->get('/auth/handoff/callback?token=v2.x.y')->assertNotFound();
    expect($this->log->lines)->toBe([]);
});

it('ships off by default in config', function () {
    expect(filter_var(env('DNC_HANDOFF_ENABLED', false), FILTER_VALIDATE_BOOLEAN))->toBeFalse();
});

it('starts: 303 to the fixed Portal authorize URL, keeping only the state hash in this session', function () {
    $res = $this->get('/auth/handoff/start?redirect_uri=https://evil.example&next=//evil')
        ->assertStatus(303)
        ->assertHeader('Referrer-Policy', 'no-referrer')
        ->assertHeader('Cache-Control', 'no-store, private');
    expect($res->getContent())->toBe('');

    parse_str((string) parse_url($res->headers->get('Location'), PHP_URL_QUERY), $q);
    expect(array_keys($q))->toBe(['audience', 'state'])
        ->and(session()->get(HandoffController::STATES_KEY))->toHaveKey(HandoffToken::stateHash($q['state']))
        ->and(json_encode(session()->all()))->not->toContain($q['state']);
});

it('refuses to send a browser to a Portal URL that is not a plain https origin', function (string $url) {
    config(['quotation.handoff.portal_url' => $url]);
    assertGenericFailure($this->get('/auth/handoff/start'));
    expect(lastReason($this))->toBe('bad_portal_url');
})->with(['http://portal.dnchardware.com', 'https://portal.dnchardware.com/path', 'https://u:p@portal.dnchardware.com', 'javascript:alert(1)']);

it('signs a DNC user in through the full flow, with a DNC identity and a new session id', function () {
    $state = startHandoff($this);
    $before = session()->getId();

    $res = $this->get('/auth/handoff/callback?token='.portalToken($state))
        ->assertStatus(303)
        ->assertHeader('Location', '/')
        ->assertHeader('Referrer-Policy', 'no-referrer');
    expect($res->getContent())->toBe('')
        ->and(session()->getId())->not->toBe($before)
        ->and(session()->get(IdentityGuard::SESSION_KEY))->toMatchArray([
            'source' => 'dnc', 'dnc_user_id' => 42, 'username' => 'alson', 'display_name' => 'Alson Tan', 'dnc_role' => 'member',
        ])
        ->and(session()->get(IdentityGuard::SESSION_KEY))->not->toHaveKey('user_id');

    Auth::forgetGuards();
    $this->get('/')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('auth.user', ['id' => null, 'username' => 'alson', 'displayName' => 'Alson Tan', 'source' => 'dnc']));

    expect(collect($this->log->lines)->last())->toMatch('/^\[handoff\] auth\.handoff_succeeded jti=[0-9a-f]{32} sub=42 ip=127\.0\.0\.1$/');
});

it('uses the username when the canonical name is blank', function () {
    $this->get('/auth/handoff/callback?token='.portalToken(startHandoff($this), 43, 'ck', 'admin'))->assertHeader('Location', '/');
    expect(session()->get(IdentityGuard::SESSION_KEY)['display_name'])->toBe('ck');
});

it('refuses a replayed token (one consumer only)', function () {
    $state = startHandoff($this);
    $token = portalToken($state);
    $this->get('/auth/handoff/callback?token='.$token)->assertHeader('Location', '/');

    // Same browser starts again with the same state hash restored: the jti is still used up.
    $this->post('/logout');
    session()->put(HandoffController::STATES_KEY, [HandoffToken::stateHash($state) => time() + 120]);
    assertGenericFailure($this->get('/auth/handoff/callback?token='.$token));
    expect(lastReason($this))->toBe('replayed');
});

it('refuses a token in a browser that did not start the handoff (state bound to this session)', function () {
    $state = HandoffToken::newState(); // never started here
    assertGenericFailure($this->get('/auth/handoff/callback?token='.portalToken($state)));
    expect(lastReason($this))->toBe('state_mismatch');
});

it('refuses an expired token, and one from the future', function () {
    $state = startHandoff($this);
    assertGenericFailure($this->get('/auth/handoff/callback?token='.portalToken($state, now: time() - 66)));
    expect(lastReason($this))->toBe('expired');

    $state = startHandoff($this);
    assertGenericFailure($this->get('/auth/handoff/callback?token='.portalToken($state, now: time() + 60)));
    expect(lastReason($this))->toBe('not_yet_valid');
});

it('refuses a token for another audience (an Internal PO token)', function () {
    $state = startHandoff($this);
    assertGenericFailure($this->get('/auth/handoff/callback?token='.portalToken($state, audience: 'internal-po')));
    expect(lastReason($this))->toBe('wrong_audience');
});

it('refuses a token signed with another key; accepts the previous key during a rotation', function () {
    $other = 'base64:'.base64_encode(str_repeat("\x42", 32));
    $state = startHandoff($this);
    assertGenericFailure($this->get('/auth/handoff/callback?token='.portalToken($state, secret: $other)));
    expect(lastReason($this))->toBe('bad_signature');

    config(['quotation.handoff.secret_previous' => $other]);
    $state = startHandoff($this);
    $this->get('/auth/handoff/callback?token='.portalToken($state, secret: $other))->assertHeader('Location', '/');
});

it('refuses missing, malformed and tampered tokens', function (string $query) {
    startHandoff($this);
    assertGenericFailure($this->get('/auth/handoff/callback'.$query));
    expect(lastReason($this))->toBeIn(['malformed', 'unsupported_version', 'bad_signature']);
})->with(['', '?token=', '?token=garbage', '?token[]=x', '?token=v1.abc.'.'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']);

it('fails closed when the secret is missing or weak', function (?string $secret) {
    config(['quotation.handoff.secret' => $secret]);
    $state = startHandoff($this);
    assertGenericFailure($this->get('/auth/handoff/callback?token='.portalToken($state)));
    expect(lastReason($this))->toBe('bad_secret')
        ->and(implode("\n", $this->log->lines))->toContain('auth.handoff_misconfigured reason=bad_secret');
})->with([null, '', 'base64:c2hvcnQ=', 'plain-text-secret-of-enough-length-000000']);

it('fails closed when the canonical users DB is not configured (the default)', function () {
    config(['database.connections.dnc_users' => config('quotation.handoff.users_db')]); // DNC_USERS_DB_* unset
    DB::purge('dnc_users');

    $state = startHandoff($this);
    assertGenericFailure($this->get('/auth/handoff/callback?token='.portalToken($state)));
    expect(lastReason($this))->toBe('user_source_unavailable');
});

it('fails closed, with no driver text anywhere, when the canonical users DB is unreachable', function () {
    config(['database.connections.dnc_users' => [
        'driver' => 'mysql', 'host' => '127.0.0.1', 'port' => 1, 'database' => 'secret_schema_xyz',
        'username' => 'secret_user_xyz', 'password' => 'secret_pass_xyz', 'options' => [PDO::ATTR_TIMEOUT => 1],
    ]]);
    DB::purge('dnc_users');

    $state = startHandoff($this);
    $res = $this->get('/auth/handoff/callback?token='.portalToken($state));
    assertGenericFailure($res);
    expect(lastReason($this))->toBe('user_source_unavailable');

    $everything = $res->getContent().json_encode($res->headers->all()).json_encode(session()->all()).implode("\n", $this->log->lines);
    foreach (['secret_user_xyz', 'secret_pass_xyz', 'secret_schema_xyz', 'SQLSTATE', base_path()] as $leak) {
        expect($everything)->not->toContain($leak);
    }
});

it('refuses canonical users that may not sign in', function (int $sub, string $username, string $role, string $reason) {
    $state = startHandoff($this);
    assertGenericFailure($this->get('/auth/handoff/callback?token='.portalToken($state, $sub, $username, $role)));
    expect(lastReason($this))->toBe($reason);
})->with([
    'no such id' => [99, 'alson', 'member', 'user_not_found'],
    'inactive' => [50, 'gone', 'member', 'user_inactive'],
    'legacy placeholder' => [51, 'legacy', 'member', 'user_legacy_placeholder'],
    'must change password' => [52, 'newbie', 'member', 'user_must_change_password'],
    'username differs from token' => [42, 'mallory', 'member', 'user_mismatch'],
    'role differs from token (cross-check only)' => [42, 'alson', 'admin', 'user_mismatch'],
]);

it('rate-limits each endpoint at 30 requests a minute per IP', function () {
    foreach (range(1, 30) as $i) {
        $this->get('/auth/handoff/start')->assertStatus(303);
    }
    $res = $this->get('/auth/handoff/start')->assertStatus(429)->assertHeader('Cache-Control', 'no-store, private');
    expect($res->getContent())->toBe('')
        ->and(implode("\n", $this->log->lines))->toContain('auth.handoff_throttled endpoint=start ip=127.0.0.1');

    // The callback has its own bucket.
    $this->get('/auth/handoff/callback?token=x')->assertStatus(303);
});

it('fails closed when the replay / rate-limit store is unavailable', function () {
    config(['quotation.handoff.cache_store' => 'no-such-store']);
    assertGenericFailure($this->get('/auth/handoff/start'));
    expect(lastReason($this))->toBe('throttle_unavailable');
});

it('re-checks a DNC session on every request and ends it when the canonical user is disabled', function () {
    $this->get('/auth/handoff/callback?token='.portalToken(startHandoff($this)));
    Auth::forgetGuards();
    $this->get('/')->assertOk();

    DB::connection('dnc_users')->table('users')->where('id', 42)->update(['is_active' => 0]);
    Auth::forgetGuards();
    $this->get('/')->assertRedirect('/login');
    expect(session()->has(IdentityGuard::SESSION_KEY))->toBeFalse()
        ->and(implode("\n", $this->log->lines))->toContain('auth.dnc_session_revoked reason=user_inactive sub=42');
});

it('refuses (but keeps) a DNC session while the canonical users DB is unavailable', function () {
    $this->get('/auth/handoff/callback?token='.portalToken(startHandoff($this)));

    config(['database.connections.dnc_users' => config('quotation.handoff.users_db')]);
    DB::purge('dnc_users');
    Auth::forgetGuards();

    $this->get('/')->assertRedirect('/login');
    expect(session()->get(IdentityGuard::SESSION_KEY)['dnc_user_id'])->toBe(42);
});

it('never logs or renders the token, the state or the secret', function () {
    $state = startHandoff($this);
    $token = portalToken($state, now: time() - 3600); // fails: expired
    $res = $this->get('/auth/handoff/callback?token='.$token);

    $logged = implode("\n", $this->log->lines);
    foreach ([$state, HandoffToken::stateHash($state), explode('.', $token)[1], explode('.', $token)[2], substr(FLOW_SECRET, 7)] as $secret) {
        expect($logged)->not->toContain($secret)
            ->and($res->getContent())->not->toContain($secret);
    }
});

it('keeps the shared contract byte-identical to the Portal copy', function () {
    // git blob ids of dnc-portal app/Handoff/Contract/* (docs/handoff/QUOTATION-HANDOFF.md §2).
    $blob = fn (string $path) => sha1('blob '.filesize($path)."\0".file_get_contents($path));

    expect($blob(app_path('Handoff/Contract/HandoffToken.php')))->toBe('9544a1bb1e500323a3985fd9983051601ccb989e')
        ->and($blob(app_path('Handoff/Contract/InvalidHandoffToken.php')))->toBe('abeb10419a1c4832fc9f5adcc4fddb1d292d4376');
});
