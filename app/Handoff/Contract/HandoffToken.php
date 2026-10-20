<?php

namespace App\Handoff\Contract;

use JsonException;

/**
 * DNC cross-app handoff, version 2 (docs/HANDOFF-CONTRACT.md).
 *
 * This file and InvalidHandoffToken.php are the shared contract. Internal
 * PO and Quotation copy both files unchanged into app/Handoff/Contract/, so
 * all three apps generate state, encode and verify byte-for-byte the same
 * way. Plain PHP (ext-json, ext-hash): no Laravel, no clock, no config. The
 * caller passes secrets, the current time and the browser's pending states.
 *
 * Flow: target /auth/handoff/start makes a state and keeps its hash in the
 * browser's own target session -> Portal /handoff/authorize signs a token
 * bound to that state -> target /auth/handoff/callback accepts the token
 * only in the browser that holds the state.
 *
 * Token:  v2.<base64url(payload JSON)>.<base64url(HMAC-SHA256(key, "v2." + payload segment))>
 */
final class HandoffToken
{
    public const VERSION = 2;

    public const PREFIX = 'v2';

    public const ISSUER = 'dnc-workspace';

    public const AUDIENCE_INTERNAL_PO = 'internal-po';

    public const AUDIENCE_QUOTATION = 'quotation';

    public const AUDIENCES = [self::AUDIENCE_INTERNAL_PO, self::AUDIENCE_QUOTATION];

    /** Fixed paths. Origins come from each app's own config; no URL is ever taken from a request or a token. */
    public const TARGET_START_PATH = '/auth/handoff/start';

    public const PORTAL_AUTHORIZE_PATH = '/handoff/authorize';

    public const TARGET_CALLBACK_PATH = '/auth/handoff/callback';

    /** Lifetime the Portal issues (exp - iat). */
    public const TTL_SECONDS = 60;

    /** Upper bound a verifier accepts for exp - iat, whatever the issuer did. */
    public const MAX_TTL_SECONDS = 120;

    /** Clock difference tolerated between the issuing and the verifying server. */
    public const LEEWAY_SECONDS = 5;

    /** How long a target keeps a state it created waiting for its callback. */
    public const STATE_TTL_SECONDS = 120;

    /** Pending states one target session may hold (one per open tab, roughly). */
    public const MAX_PENDING_STATES = 5;

    /** 256-bit secrets, written as "base64:<44 chars>" in .env. */
    public const MIN_SECRET_BYTES = 32;

    public const MAX_TOKEN_LENGTH = 1024;

    public const ROLES = ['admin', 'member'];

    /** Exact claim set, in issue order. Unknown or missing claims are rejected: new claims need a new version. */
    public const CLAIMS = ['ver', 'iss', 'aud', 'sub', 'username', 'role', 'iat', 'exp', 'jti', 'state_hash'];

    /** 32 random bytes, base64url: the state itself, and the SHA-256 state hash, are both 43 characters. */
    private const B64_256_PATTERN = '/^[A-Za-z0-9_-]{43}$/';

    private const USERNAME_PATTERN = '/^[a-z][a-z0-9]{1,19}$/';

    private const SUBJECT_PATTERN = '/^[1-9][0-9]{0,18}$/';

    private const JTI_PATTERN = '/^[0-9a-f]{32}$/';

    private const TOKEN_PATTERN = '/^v2\.([A-Za-z0-9_-]{1,900})\.([A-Za-z0-9_-]{43})$/';

    // ---- state (target side) -------------------------------------------------

    /** A fresh state: 256 random bits, base64url (43 characters). */
    public static function newState(): string
    {
        return self::base64UrlEncode(random_bytes(32));
    }

    public static function isState(mixed $state): bool
    {
        return is_string($state) && preg_match(self::B64_256_PATTERN, $state) === 1;
    }

    /** base64url(SHA-256(state)). The target stores and the token carries only this, never the state. */
    public static function stateHash(string $state): string
    {
        return self::base64UrlEncode(hash('sha256', $state, true));
    }

    /**
     * Start a handoff in one browser (target /auth/handoff/start). Returns the
     * new state, to send to the Portal, and the pending map to save back into
     * this browser's target session: {state_hash: expires_at}, expired entries
     * dropped, at most MAX_PENDING_STATES (oldest dropped first).
     *
     * @param  array<mixed>  $pending  what the session holds (anything malformed is discarded)
     * @return array{0: string, 1: array<string, int>}
     */
    public static function startState(array $pending, int $now): array
    {
        $state = self::newState();
        $pending = self::pendingStates($pending, $now);
        $pending[self::stateHash($state)] = $now + self::STATE_TTL_SECONDS;
        asort($pending);

        return [$state, array_slice($pending, -self::MAX_PENDING_STATES, null, true)];
    }

    /**
     * The pending map with the given state hash removed (it is used up) and
     * expired entries dropped. Save this back into the session after a
     * callback whose token verified, before anything else.
     *
     * @param  array<mixed>  $pending
     * @return array<string, int>
     */
    public static function consumeState(array $pending, string $stateHash, int $now): array
    {
        $pending = self::pendingStates($pending, $now);
        unset($pending[$stateHash]);

        return $pending;
    }

    /** https://portal…/handoff/authorize?audience=…&state=… (target redirects here from /start). */
    public static function authorizeUrl(string $portalOrigin, string $audience, string $state): string
    {
        if (! in_array($audience, self::AUDIENCES, true)) {
            throw new InvalidHandoffToken(InvalidHandoffToken::WRONG_AUDIENCE);
        }
        if (! self::isState($state)) {
            throw new InvalidHandoffToken(InvalidHandoffToken::INVALID_STATE);
        }

        return rtrim($portalOrigin, '/').self::PORTAL_AUTHORIZE_PATH.'?'.http_build_query(['audience' => $audience, 'state' => $state]);
    }

    /** https://target…/auth/handoff/callback?token=… (the Portal redirects here, and only here). */
    public static function callbackUrl(string $targetOrigin, string $token): string
    {
        return rtrim($targetOrigin, '/').self::TARGET_CALLBACK_PATH.'?token='.$token;
    }

    // ---- token (Portal issues, target verifies) ------------------------------

    /** A fresh 128-bit token id. */
    public static function newJti(): string
    {
        return bin2hex(random_bytes(16));
    }

    /**
     * Build the claims for one handoff (Portal side). `$state` is the opaque
     * value the target sent; only its hash goes into the token.
     *
     * @return array{ver: int, iss: string, aud: string, sub: string, username: string, role: string, iat: int, exp: int, jti: string, state_hash: string}
     *
     * @throws InvalidHandoffToken
     */
    public static function claims(string $audience, int|string $userId, string $username, string $role, string $state, int $now, ?string $jti = null): array
    {
        if (! self::isState($state)) {
            throw new InvalidHandoffToken(InvalidHandoffToken::INVALID_STATE);
        }

        $claims = [
            'ver' => self::VERSION,
            'iss' => self::ISSUER,
            'aud' => $audience,
            'sub' => (string) $userId,
            'username' => $username,
            'role' => $role,
            'iat' => $now,
            'exp' => $now + self::TTL_SECONDS,
            'jti' => $jti ?? self::newJti(),
            'state_hash' => self::stateHash($state),
        ];

        // The issuer refuses to sign anything a verifier would refuse.
        self::assertClaims($claims, $audience);

        return $claims;
    }

    /**
     * @param  array<string, mixed>  $claims  from claims()
     *
     * @throws InvalidHandoffToken
     */
    public static function encode(array $claims, string $key): string
    {
        self::assertKey($key);
        self::assertClaims($claims, (string) ($claims['aud'] ?? ''));

        $payload = self::base64UrlEncode(json_encode($claims, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $signed = self::PREFIX.'.'.$payload;

        return $signed.'.'.self::base64UrlEncode(hash_hmac('sha256', $signed, $key, true));
    }

    /**
     * Verify a callback token for one audience in one browser (target side).
     * Checks, in this order: format, signature (constant time, against each
     * key: current, then the previous one during a rotation), claims (issuer,
     * audience, shapes, lifetime), time, and finally that the token's
     * state_hash is one this browser's session is waiting for and has not
     * expired. No side effects: the caller then consumes the state and the
     * jti (docs/HANDOFF-CONTRACT.md §7).
     *
     * @param  list<string>  $keys  raw secret bytes, see parseSecret()
     * @param  array<mixed>  $pending  this browser's {state_hash: expires_at}, from startState()
     * @return array{ver: int, iss: string, aud: string, sub: string, username: string, role: string, iat: int, exp: int, jti: string, state_hash: string}
     *
     * @throws InvalidHandoffToken
     */
    public static function verify(string $token, string $audience, array $keys, int $now, array $pending): array
    {
        if (! in_array($audience, self::AUDIENCES, true)) {
            throw new InvalidHandoffToken(InvalidHandoffToken::WRONG_AUDIENCE);
        }
        if ($keys === []) {
            throw new InvalidHandoffToken(InvalidHandoffToken::BAD_SIGNATURE);
        }

        if (strlen($token) > self::MAX_TOKEN_LENGTH || preg_match(self::TOKEN_PATTERN, $token, $parts) !== 1) {
            throw new InvalidHandoffToken(preg_match('/^v[0-9]+\./', $token) === 1 && ! str_starts_with($token, self::PREFIX.'.')
                ? InvalidHandoffToken::UNSUPPORTED_VERSION
                : InvalidHandoffToken::MALFORMED);
        }

        [, $payload, $signature] = $parts;
        $signed = self::PREFIX.'.'.$payload;
        $given = (string) self::base64UrlDecode($signature);

        $valid = false;
        foreach ($keys as $key) {
            self::assertKey($key);
            // Every key is tried so the timing does not depend on which one matched.
            $valid = hash_equals(hash_hmac('sha256', $signed, $key, true), $given) || $valid;
        }
        if (! $valid) {
            throw new InvalidHandoffToken(InvalidHandoffToken::BAD_SIGNATURE);
        }

        // Only signed bytes are parsed.
        $json = self::base64UrlDecode($payload);
        try {
            $claims = $json === null ? null : json_decode($json, true, 4, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            $claims = null;
        }
        if (! is_array($claims) || array_is_list($claims)) {
            throw new InvalidHandoffToken(InvalidHandoffToken::MALFORMED);
        }

        self::assertClaims($claims, $audience);

        if ($claims['iat'] > $now + self::LEEWAY_SECONDS) {
            throw new InvalidHandoffToken(InvalidHandoffToken::NOT_YET_VALID);
        }
        if ($now >= $claims['exp'] + self::LEEWAY_SECONDS) {
            throw new InvalidHandoffToken(InvalidHandoffToken::EXPIRED);
        }

        // Browser binding: only the session that started this handoff holds its state.
        $expiresAt = self::validPendingEntries($pending)[$claims['state_hash']] ?? null;
        if ($expiresAt === null) {
            throw new InvalidHandoffToken(InvalidHandoffToken::STATE_MISMATCH);
        }
        if ($now >= $expiresAt) {
            throw new InvalidHandoffToken(InvalidHandoffToken::STATE_EXPIRED);
        }

        /** @var array{ver: int, iss: string, aud: string, sub: string, username: string, role: string, iat: int, exp: int, jti: string, state_hash: string} $claims */
        return $claims;
    }

    /**
     * Turn the .env value ("base64:" + base64 of at least 32 random bytes)
     * into raw key bytes. Throws without echoing the value.
     *
     * @throws InvalidHandoffToken
     */
    public static function parseSecret(?string $configured): string
    {
        $configured = trim((string) $configured);

        if (! str_starts_with($configured, 'base64:')) {
            throw new InvalidHandoffToken(InvalidHandoffToken::BAD_SECRET);
        }

        $key = base64_decode(substr($configured, 7), true);
        if ($key === false) {
            throw new InvalidHandoffToken(InvalidHandoffToken::BAD_SECRET);
        }

        self::assertKey($key);

        return $key;
    }

    /**
     * @param  array<mixed>  $pending
     * @return array<string, int> well-formed, unexpired entries
     */
    private static function pendingStates(array $pending, int $now): array
    {
        return array_filter(self::validPendingEntries($pending), fn (int $expiresAt) => $expiresAt > $now);
    }

    /**
     * @param  array<mixed>  $pending
     * @return array<string, int>
     */
    private static function validPendingEntries(array $pending): array
    {
        return array_filter($pending, fn ($expiresAt, $hash) => is_string($hash) && preg_match(self::B64_256_PATTERN, $hash) === 1 && is_int($expiresAt), ARRAY_FILTER_USE_BOTH);
    }

    /** @throws InvalidHandoffToken */
    private static function assertKey(string $key): void
    {
        if (strlen($key) < self::MIN_SECRET_BYTES) {
            throw new InvalidHandoffToken(InvalidHandoffToken::BAD_SECRET);
        }
    }

    /**
     * @param  array<mixed>  $claims
     *
     * @throws InvalidHandoffToken
     */
    private static function assertClaims(array $claims, string $audience): void
    {
        $keys = array_keys($claims);
        sort($keys);
        $expected = self::CLAIMS;
        sort($expected);
        if ($keys !== $expected) {
            throw new InvalidHandoffToken(InvalidHandoffToken::INVALID_CLAIMS);
        }

        if ($claims['ver'] !== self::VERSION) {
            throw new InvalidHandoffToken(InvalidHandoffToken::UNSUPPORTED_VERSION);
        }
        if ($claims['iss'] !== self::ISSUER) {
            throw new InvalidHandoffToken(InvalidHandoffToken::WRONG_ISSUER);
        }
        if (! in_array($audience, self::AUDIENCES, true) || $claims['aud'] !== $audience) {
            throw new InvalidHandoffToken(InvalidHandoffToken::WRONG_AUDIENCE);
        }

        $shapes = is_string($claims['sub']) && preg_match(self::SUBJECT_PATTERN, $claims['sub']) === 1
            && is_string($claims['username']) && preg_match(self::USERNAME_PATTERN, $claims['username']) === 1
            && in_array($claims['role'], self::ROLES, true)
            && is_int($claims['iat']) && $claims['iat'] > 0
            && is_int($claims['exp'])
            && is_string($claims['jti']) && preg_match(self::JTI_PATTERN, $claims['jti']) === 1
            && is_string($claims['state_hash']) && preg_match(self::B64_256_PATTERN, $claims['state_hash']) === 1;
        if (! $shapes) {
            throw new InvalidHandoffToken(InvalidHandoffToken::INVALID_CLAIMS);
        }

        $lifetime = $claims['exp'] - $claims['iat'];
        if ($lifetime < 1 || $lifetime > self::MAX_TTL_SECONDS) {
            throw new InvalidHandoffToken(InvalidHandoffToken::LIFETIME_TOO_LONG);
        }
    }

    private static function base64UrlEncode(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $text): ?string
    {
        $bytes = base64_decode(strtr($text, '-_', '+/'), true);

        // Canonical encoding only, so one payload has exactly one valid spelling.
        return $bytes === false || self::base64UrlEncode($bytes) !== $text ? null : $bytes;
    }
}
