<?php

use App\Auth\AppUser;
use App\Auth\SafeNext;
use App\Auth\Username;
use App\Services\Identity\Actor;
use App\Services\Identity\ActorSource;
use App\Services\Identity\CurrentActor;
use App\Services\Identity\EditorStamp;
use App\Services\Identity\PreparedBy;
use Carbon\CarbonImmutable;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    useThrowawayAppUsers();
    seedAppUser('nicholas', 'Nicholas Koh', 'correct horse');

    // A stand-in for a future "new quotation" write path.
    Route::middleware(['web', 'auth'])->post('/__test/prepared-by', fn () => response()->json([
        'preparedBy' => PreparedBy::forNewQuotation(),
    ]));
});

it('fills Prepared By from the signed-in session, never from request input', function () {
    $this->post('/login', ['username' => 'nicholas', 'password' => 'correct horse']);

    $this->postJson('/__test/prepared-by', ['prepared_by' => 'Mallory', 'preparedBy' => 'Mallory', 'display_name' => 'Mallory'])
        ->assertOk()
        ->assertExactJson(['preparedBy' => 'Nicholas Koh']);
});

it('has no Prepared By for a guest', function () {
    $this->postJson('/__test/prepared-by', ['prepared_by' => 'Mallory'])->assertUnauthorized();
    expect(fn () => PreparedBy::forNewQuotation())->toThrow(AuthenticationException::class);
});

it('exposes the actor through CurrentActor only from the verified identity', function () {
    expect(app(CurrentActor::class)->get())->toBeNull();

    $this->actingAs(namedUser(12, 'alson', 'Alson Tan'));
    $actor = app(CurrentActor::class)->require();

    expect($actor->id)->toBe(12)
        ->and($actor->username)->toBe('alson')
        ->and($actor->displayName)->toBe('Alson Tan')
        ->and($actor->source)->toBe(ActorSource::AppUsers)
        ->and($actor->toSharedArray())->toBe(['id' => 12, 'username' => 'alson', 'displayName' => 'Alson Tan', 'source' => 'app_users']);
});

it('never reports a canonical DNC id as an app_users id', function () {
    $dnc = new AppUser(new Actor(null, 'alson', 'Alson Tan', ActorSource::Dnc, 42, 'member'));

    expect($dnc->getAuthIdentifier())->toBe('dnc:42')
        ->and($dnc->actor->toSharedArray())->toBe(['id' => null, 'username' => 'alson', 'displayName' => 'Alson Tan', 'source' => 'dnc'])
        ->and(EditorStamp::fromActor($dnc->actor)->actorId)->toBeNull();
});

it('stamps an editor separately from Prepared By (value object only, no write)', function () {
    $at = CarbonImmutable::parse('2026-10-21 10:00:00', 'Asia/Kuala_Lumpur');
    $stamp = EditorStamp::fromActor(namedUser(3, 'alson', 'Alson')->actor, $at);

    expect($stamp->toArray())->toBe([
        'actorId' => 3, 'username' => 'alson', 'displayName' => 'Alson', 'at' => '2026-10-21T10:00:00+08:00', 'source' => 'app_users',
    ]);
});

it('ports dc_normalize_username exactly', function () {
    expect(Username::normalize('  NiCHolas '))->toBe('nicholas')
        ->and(Username::normalize("\n\tALSON\0"))->toBe('alson')
        ->and(Username::normalize(null))->toBe('')
        ->and(Username::normalize(['x']))->toBe('')
        ->and(Username::normalize('ÉMILE'))->toBe(strtolower(trim('ÉMILE'))); // ASCII-only, like legacy
});

it('ports dc_safe_next (same-origin paths only)', function (mixed $raw, string $expected) {
    expect(SafeNext::path($raw))->toBe($expected);
})->with([
    ['/quotations?x=1', '/quotations?x=1'],
    ['', '/'],
    [null, '/'],
    ['quotations', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ["/ok\r\nLocation: x", '/'],
    ['https://evil.example/', '/'],
]);

it('reduces an intended URL to a path only when it is this host', function () {
    expect(SafeNext::fromIntended('http://localhost/quotations?id=5', 'localhost'))->toBe('/quotations?id=5')
        ->and(SafeNext::fromIntended('http://evil.example/quotations', 'localhost'))->toBe('/')
        ->and(SafeNext::fromIntended('javascript://localhost/%0aalert(1)', 'localhost'))->toBe('/')
        ->and(SafeNext::fromIntended('http://user:pw@localhost/x', 'localhost'))->toBe('/')
        ->and(SafeNext::fromIntended(null, 'localhost'))->toBe('/');
});
