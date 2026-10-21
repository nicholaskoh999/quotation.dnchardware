<?php

use App\Handoff\Contract\HandoffToken;
use App\Handoff\Contract\InvalidHandoffToken;

/*
| The shared contract (app/Handoff/Contract), tested as plain PHP: no
| Laravel, no database. Internal PO and Quotation copy these files, and
| these cases double as their verifier acceptance tests
| (docs/HANDOFF-CONTRACT.md §15-16).
*/

const VECTOR_SECRET = 'base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
const VECTOR_STATE = 'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8';
const VECTOR_STATE_HASH = 'zwkx4Wi0nph1A8rxivb-JTtrPYKoEAjD6OHuZ8fI3FU';
const VECTOR_TOKEN = 'v2.eyJ2ZXIiOjIsImlzcyI6ImRuYy13b3Jrc3BhY2UiLCJhdWQiOiJpbnRlcm5hbC1wbyIsInN1YiI6IjQyIiwidXNlcm5hbWUiOiJhbHNvbiIsInJvbGUiOiJtZW1iZXIiLCJpYXQiOjE3NjA5NDcyMDAsImV4cCI6MTc2MDk0NzI2MCwianRpIjoiMDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWYiLCJzdGF0ZV9oYXNoIjoiendreDRXaTBucGgxQThyeGl2Yi1KVHRyUFlLb0VBakQ2T0h1WjhmSTNGVSJ9.1m2tdhxvKIdJ6q9934i_UArnfFcrergVXFPXc8BZvgU';
const VECTOR_IAT = 1760947200;

function vectorKey(): string
{
    return HandoffToken::parseSecret(VECTOR_SECRET);
}

function otherKey(): string
{
    return str_repeat("\x42", 32);
}

/** The vector browser's session: it started the handoff with VECTOR_STATE at VECTOR_IAT. */
function vectorPending(): array
{
    return [VECTOR_STATE_HASH => VECTOR_IAT + HandoffToken::STATE_TTL_SECONDS];
}

/** @param  array<string, mixed>  $override */
function signed(array $override = [], ?string $key = null, string $audience = 'internal-po'): string
{
    $claims = HandoffToken::claims($audience, 42, 'alson', 'member', VECTOR_STATE, VECTOR_IAT, '0123456789abcdef0123456789abcdef');

    return signRaw(array_merge($claims, $override), $key ?? vectorKey());
}

/** Sign arbitrary claims the way a buggy or hostile issuer holding the key could, bypassing claims() checks. */
function signRaw(array $claims, string $key): string
{
    $payload = rtrim(strtr(base64_encode(json_encode($claims, JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
    $signature = rtrim(strtr(base64_encode(hash_hmac('sha256', 'v2.'.$payload, $key, true)), '+/', '-_'), '=');

    return 'v2.'.$payload.'.'.$signature;
}

function refusal(callable $verify): ?string
{
    try {
        $verify();
    } catch (InvalidHandoffToken $e) {
        return $e->reason;
    }

    return null;
}

function verifyVector(string $token = VECTOR_TOKEN, string $audience = 'internal-po', ?array $keys = null, int $now = VECTOR_IAT, ?array $pending = null): ?string
{
    return refusal(fn () => HandoffToken::verify($token, $audience, $keys ?? [vectorKey()], $now, $pending ?? vectorPending()));
}

// ---- test vector ---------------------------------------------------------------

it('matches the published test vector byte for byte', function () {
    $claims = HandoffToken::claims('internal-po', 42, 'alson', 'member', VECTOR_STATE, VECTOR_IAT, '0123456789abcdef0123456789abcdef');

    expect(HandoffToken::stateHash(VECTOR_STATE))->toBe(VECTOR_STATE_HASH)
        ->and(HandoffToken::encode($claims, vectorKey()))->toBe(VECTOR_TOKEN);
});

it('verifies the test vector in the browser holding its state and returns exactly the contract claims', function () {
    $claims = HandoffToken::verify(VECTOR_TOKEN, 'internal-po', [vectorKey()], VECTOR_IAT + 30, vectorPending());

    expect($claims)->toBe([
        'ver' => 2,
        'iss' => 'dnc-workspace',
        'aud' => 'internal-po',
        'sub' => '42',
        'username' => 'alson',
        'role' => 'member',
        'iat' => VECTOR_IAT,
        'exp' => VECTOR_IAT + 60,
        'jti' => '0123456789abcdef0123456789abcdef',
        'state_hash' => VECTOR_STATE_HASH,
    ]);
});

// ---- issuing ---------------------------------------------------------------------

it('issues with the fixed issuer, a 60-second lifetime and a random 128-bit jti', function () {
    $a = HandoffToken::claims('quotation', 7, 'ck', 'admin', VECTOR_STATE, VECTOR_IAT);
    $b = HandoffToken::claims('quotation', 7, 'ck', 'admin', VECTOR_STATE, VECTOR_IAT);

    expect($a['iss'])->toBe('dnc-workspace')
        ->and($a['aud'])->toBe('quotation')
        ->and($a['exp'] - $a['iat'])->toBe(60)
        ->and($a['jti'])->toMatch('/^[0-9a-f]{32}$/')
        ->and($a['jti'])->not->toBe($b['jti']);
});

it('carries only the hash of the state, and no password, session id or other secret claim', function () {
    $claims = HandoffToken::claims('quotation', 7, 'ck', 'admin', VECTOR_STATE, VECTOR_IAT);

    expect(array_keys($claims))->toBe(HandoffToken::CLAIMS)
        ->and(json_encode($claims))->not->toContain(VECTOR_STATE)
        ->and(HandoffToken::CLAIMS)->not->toContain('password')->not->toContain('session')->not->toContain('sid')
        ->not->toContain('state')->not->toContain('email')->not->toContain('name')->not->toContain('url');
});

it('will not issue claims a verifier would refuse', function (callable $issue, string $reason) {
    expect(refusal($issue))->toBe($reason);
})->with([
    'unknown audience' => [fn () => HandoffToken::claims('portal', 1, 'ck', 'member', VECTOR_STATE, VECTOR_IAT), 'wrong_audience'],
    'short state' => [fn () => HandoffToken::claims('quotation', 1, 'ck', 'member', 'abc', VECTOR_IAT), 'invalid_state'],
    'URL as state' => [fn () => HandoffToken::claims('quotation', 1, 'ck', 'member', 'https://evil.example/aaaaaaaaaaaaaaaaaaaaaaaaaaa', VECTOR_IAT), 'invalid_state'],
    'bad username' => [fn () => HandoffToken::claims('quotation', 1, 'CK', 'member', VECTOR_STATE, VECTOR_IAT), 'invalid_claims'],
    'short key' => [fn () => HandoffToken::encode(HandoffToken::claims('quotation', 1, 'ck', 'member', VECTOR_STATE, VECTOR_IAT), str_repeat('k', 31)), 'bad_secret'],
]);

// ---- state ---------------------------------------------------------------------------

it('makes 256-bit states and remembers only their hashes, with a 120-second expiry', function () {
    [$state, $pending] = HandoffToken::startState([], VECTOR_IAT);
    [$other] = HandoffToken::startState([], VECTOR_IAT);

    expect($state)->toMatch('/^[A-Za-z0-9_-]{43}$/')
        ->and(strlen(base64_decode(strtr($state, '-_', '+/'))))->toBe(32)
        ->and($state)->not->toBe($other)
        ->and($pending)->toBe([HandoffToken::stateHash($state) => VECTOR_IAT + 120])
        ->and(json_encode($pending))->not->toContain($state);
});

it('keeps at most five pending states per browser, dropping expired and then oldest ones', function () {
    $pending = ['expired-hash-expired-hash-expired-hash-expi' => VECTOR_IAT - 1, 'junk' => 'x'];
    $states = [];
    foreach (range(0, 6) as $i) {
        [$states[], $pending] = HandoffToken::startState($pending, VECTOR_IAT + $i);
    }

    expect($pending)->toHaveCount(5)
        ->and(array_keys($pending))->toBe(array_map(HandoffToken::stateHash(...), array_slice($states, 2)));
});

it('builds the authorize and callback URLs from fixed paths only', function () {
    expect(HandoffToken::authorizeUrl('https://portal.dnchardware.com', 'quotation', VECTOR_STATE))
        ->toBe('https://portal.dnchardware.com/handoff/authorize?audience=quotation&state='.VECTOR_STATE)
        ->and(HandoffToken::callbackUrl('https://po.dnchardware.com', VECTOR_TOKEN))
        ->toBe('https://po.dnchardware.com/auth/handoff/callback?token='.VECTOR_TOKEN)
        ->and(refusal(fn () => HandoffToken::authorizeUrl('https://portal.dnchardware.com', 'evil', VECTOR_STATE)))->toBe('wrong_audience')
        ->and(refusal(fn () => HandoffToken::authorizeUrl('https://portal.dnchardware.com', 'quotation', 'x&next=evil')))->toBe('invalid_state');
});

it('refuses the token in a browser that does not hold its state: copied URL, other browser, none started', function (array $pending) {
    expect(verifyVector(pending: $pending))->toBe('state_mismatch');
})->with([
    'no handoff started' => [[]],
    'another browser\'s state' => fn () => [HandoffToken::startState([], VECTOR_IAT)[1]],
    'raw state stored instead of hash' => [[VECTOR_STATE => VECTOR_IAT + 120]],
    'malformed session data' => [[VECTOR_STATE_HASH => (string) (VECTOR_IAT + 120)]],
]);

it('refuses a state that is pending but expired', function () {
    expect(verifyVector(now: VECTOR_IAT + 30, pending: [VECTOR_STATE_HASH => VECTOR_IAT + 30]))->toBe('state_expired')
        ->and(verifyVector(now: VECTOR_IAT + 29, pending: [VECTOR_STATE_HASH => VECTOR_IAT + 30]))->toBeNull();
});

it('refuses a state once it has been consumed', function () {
    $pending = vectorPending() + HandoffToken::startState([], VECTOR_IAT)[1];

    $after = HandoffToken::consumeState($pending, VECTOR_STATE_HASH, VECTOR_IAT + 1);

    expect($after)->toHaveCount(1)->not->toHaveKey(VECTOR_STATE_HASH)
        ->and(verifyVector(now: VECTOR_IAT + 1, pending: $after))->toBe('state_mismatch');
});

it('checks the state only after the signature, so unsigned input never touches session data', function () {
    $forged = signed([], otherKey());

    expect(verifyVector($forged, pending: []))->toBe('bad_signature');
});

// ---- token -----------------------------------------------------------------------------

it('accepts a token until its expiry plus the 5-second leeway, then refuses it', function () {
    $pending = [VECTOR_STATE_HASH => VECTOR_IAT + 3600];

    expect(verifyVector(now: VECTOR_IAT + 64, pending: $pending))->toBeNull()
        ->and(verifyVector(now: VECTOR_IAT + 65, pending: $pending))->toBe('expired')
        ->and(verifyVector(now: VECTOR_IAT + 3599, pending: $pending))->toBe('expired');
});

it('refuses a token issued in the future beyond the leeway', function () {
    expect(verifyVector(now: VECTOR_IAT - 5))->toBeNull()
        ->and(verifyVector(now: VECTOR_IAT - 6))->toBe('not_yet_valid');
});

it('refuses a token for another audience', function () {
    expect(verifyVector(audience: 'quotation'))->toBe('wrong_audience')
        ->and(verifyVector(audience: 'portal'))->toBe('wrong_audience');
});

it('refuses a token signed with another key, such as another target\'s', function () {
    expect(verifyVector(signed([], otherKey())))->toBe('bad_signature')
        ->and(verifyVector(keys: []))->toBe('bad_signature');
});

it('detects tampering with the payload or the signature', function () {
    [$prefix, $payload, $signature] = explode('.', VECTOR_TOKEN);
    $claims = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
    $reencode = fn (array $c) => rtrim(strtr(base64_encode(json_encode($c, JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');

    // Same signature, payload re-encoded as an admin, or bound to the attacker's own state.
    expect(verifyVector("$prefix.".$reencode(['role' => 'admin'] + $claims).".$signature"))->toBe('bad_signature');
    $mine = HandoffToken::stateHash(HandoffToken::newState());
    expect(verifyVector("$prefix.".$reencode(['state_hash' => $mine] + $claims).".$signature", pending: [$mine => VECTOR_IAT + 120]))->toBe('bad_signature');

    // One character of the signature flipped.
    $flipped = substr($signature, 0, -2).($signature[-2] === 'A' ? 'B' : 'A').$signature[-1];
    expect(verifyVector("$prefix.$payload.$flipped"))->toBe('bad_signature');

    // A non-canonical spelling of the same signature bytes.
    expect(verifyVector("$prefix.$payload.$signature="))->toBe('malformed');
});

it('refuses malformed tokens', function (string $token, string $reason) {
    expect(verifyVector($token))->toBe($reason);
})->with([
    'empty' => ['', 'malformed'],
    'garbage' => ['not-a-token', 'malformed'],
    'two parts' => ['v2.abc', 'malformed'],
    'four parts' => [VECTOR_TOKEN.'.x', 'malformed'],
    'bad characters' => ['v2.ab+c/.'.str_repeat('A', 43), 'malformed'],
    'short signature' => ['v2.abc.'.str_repeat('A', 42), 'malformed'],
    'oversized' => ['v2.'.str_repeat('A', 1100).'.'.str_repeat('A', 43), 'malformed'],
    'withdrawn v1 bearer token' => ['v1.abc.'.str_repeat('A', 43), 'unsupported_version'],
    'other version' => ['v3.abc.'.str_repeat('A', 43), 'unsupported_version'],
    'JWT alg none' => ['eyJhbGciOiJub25lIn0.eyJzdWIiOiI0MiJ9.', 'malformed'],
]);

it('refuses a correctly signed payload that is not a JSON object', function (string $json) {
    $payload = rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
    $token = 'v2.'.$payload.'.'.rtrim(strtr(base64_encode(hash_hmac('sha256', 'v2.'.$payload, vectorKey(), true)), '+/', '-_'), '=');

    expect(verifyVector($token))->toBe('malformed');
})->with(['not json', '[1,2,3]', '"text"', '{"a":{"b":{"c":{"d":1}}}}']);

it('refuses correctly signed tokens whose claims break the contract', function (array $override, string $reason) {
    expect(verifyVector(signed($override)))->toBe($reason);
})->with([
    'wrong issuer' => [['iss' => 'po'], 'wrong_issuer'],
    'version 1 claim' => [['ver' => 1], 'unsupported_version'],
    'string version' => [['ver' => '2'], 'unsupported_version'],
    'numeric subject' => [['sub' => 42], 'invalid_claims'],
    'zero subject' => [['sub' => '0'], 'invalid_claims'],
    'bad username' => [['username' => 'Alson Tan'], 'invalid_claims'],
    'unknown role' => [['role' => 'owner'], 'invalid_claims'],
    'short jti' => [['jti' => 'abc'], 'invalid_claims'],
    'string iat' => [['iat' => (string) VECTOR_IAT], 'invalid_claims'],
    'short state hash' => [['state_hash' => 'abc'], 'invalid_claims'],
    'long-lived' => [['exp' => VECTOR_IAT + 121], 'lifetime_too_long'],
    'exp before iat' => [['exp' => VECTOR_IAT], 'lifetime_too_long'],
    'extra claim' => [['password' => 'x'], 'invalid_claims'],
    'extra session claim' => [['sid' => 'abc'], 'invalid_claims'],
    'extra return URL' => [['redirect' => 'https://evil.example'], 'invalid_claims'],
]);

it('refuses a token with a missing claim', function () {
    $claims = HandoffToken::claims('internal-po', 42, 'alson', 'member', VECTOR_STATE, VECTOR_IAT);
    unset($claims['state_hash']);

    expect(verifyVector(signRaw($claims, vectorKey())))->toBe('invalid_claims');
});

it('accepts the previous key during a rotation, and only listed keys', function () {
    $old = signed([], otherKey());

    expect(verifyVector($old, keys: [vectorKey(), otherKey()]))->toBeNull()
        ->and(verifyVector($old, keys: [vectorKey()]))->toBe('bad_signature');
});

it('accepts only base64 secrets of at least 32 bytes', function (?string $secret, bool $valid) {
    expect(refusal(fn () => HandoffToken::parseSecret($secret)))->toBe($valid ? null : 'bad_secret');
})->with([
    'generated' => [VECTOR_SECRET, true],
    '64 bytes' => ['base64:'.base64_encode(random_bytes(64)), true],
    'missing' => [null, false],
    'empty' => ['', false],
    'no prefix' => [base64_encode(random_bytes(32)), false],
    'plain text' => ['base64:password', false],
    '31 bytes' => ['base64:'.base64_encode(random_bytes(31)), false],
    'not base64' => ['base64:!!!!', false],
]);

it('never puts the token, the state, a claim or the secret in an error message', function () {
    foreach ([signed([], otherKey()), VECTOR_TOKEN] as $token) {
        try {
            HandoffToken::verify($token, 'internal-po', [vectorKey()], VECTOR_IAT, []);
        } catch (InvalidHandoffToken $e) {
            $text = $e->getMessage().' '.$e->reason;
        }

        expect($text)->not->toContain(explode('.', $token)[1])
            ->not->toContain(explode('.', $token)[2])
            ->not->toContain(VECTOR_STATE)->not->toContain(VECTOR_STATE_HASH)
            ->not->toContain('alson')
            ->not->toContain(substr(VECTOR_SECRET, 7));
    }

    expect(refusal(fn () => HandoffToken::parseSecret('base64:c2hvcnQtc2VjcmV0')))->toBe('bad_secret');
});
