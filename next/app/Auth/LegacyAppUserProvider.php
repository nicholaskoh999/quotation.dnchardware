<?php

namespace App\Auth;

use App\Services\Identity\Actor;
use App\Services\Identity\ActorSource;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Auth\UserProvider;
use Illuminate\Database\ConnectionResolverInterface;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Reads the legacy `app_users` table (READ-ONLY) — the current QUO
 * authentication source (handoff §5; legacy auth.php dc_login()).
 *
 *  - Lookup by the NORMALISED username (Username::normalize), LIMIT 1.
 *  - password_verify() against password_hash — the PHP function itself, so a
 *    legacy bcrypt hash verifies exactly as it does in production.
 *  - enabled = 0 is refused.
 *  - A missing row verifies against a dummy bcrypt hash, so an unknown
 *    username pays the same bcrypt cost as a known one. This REDUCES the
 *    username-enumeration timing signal; it does not claim identical
 *    end-to-end timing (PROJECT-GUARDRAILS "WHO IS ASKING").
 *  - The usernames in quotation.auth.refused_usernames (`admin`) are refused
 *    even if someone re-enabled the row: `admin` is a role, never a shared
 *    login. Defence in depth — the row stays disabled per the owner.
 *  - Fails CLOSED: a database error, a row that cannot name a person, or any
 *    other surprise is a failed sign-in, never a fallback.
 *  - NEVER writes: no rehash-on-login, no remember token, no last-login.
 */
final class LegacyAppUserProvider implements UserProvider
{
    /**
     * Legacy DC_AUTH_DUMMY_HASH: a real bcrypt hash of a random string that
     * was discarded. It authenticates nothing — it is only reached when there
     * is no usable row, and that path fails regardless of the result.
     */
    public const DUMMY_HASH = '$2y$12$beZY8mkX8rSDm4Cd/E0/D.dmpbugEPQBbP/QWXjTFwZbyr8MmSeoK';

    /** @param  list<string>  $refusedUsernames */
    public function __construct(
        private readonly ConnectionResolverInterface $db,
        private readonly string $connection,
        private readonly array $refusedUsernames,
        private readonly int $failureDelayMs = 0,
    ) {}

    /**
     * The whole legacy dc_login() credential decision. Returns the person, or
     * null — and on null the caller must not reveal which check failed.
     *
     * @param  array<string, mixed>  $credentials  ['username' => …, 'password' => …]
     */
    public function check(#[\SensitiveParameter] array $credentials): ?AppUser
    {
        $candidate = $this->retrieveByCredentials($credentials);
        $ok = $this->validateCredentials($candidate ?? new AppUser(self::placeholderActor(), self::DUMMY_HASH, false), $credentials);

        if (! $ok || $candidate === null) {
            if ($this->failureDelayMs > 0) {
                usleep($this->failureDelayMs * 1000);
            }

            return null;
        }

        // The session carries the identity only — never the hash.
        return new AppUser($candidate->actor);
    }

    /** @param  array<string, mixed>  $credentials */
    public function retrieveByCredentials(#[\SensitiveParameter] array $credentials): ?AppUser
    {
        $username = Username::normalize($credentials['username'] ?? '');
        if ($username === '') {
            return null;
        }

        return $this->candidate($this->row('username', $username));
    }

    /**
     * Runs password_verify on EVERY path (dummy hash when the row has none),
     * then refuses disabled, refused-name and nameless rows.
     *
     * @param  array<string, mixed>  $credentials
     */
    public function validateCredentials(Authenticatable $user, #[\SensitiveParameter] array $credentials): bool
    {
        $hash = $user->getAuthPassword();
        if ($hash === '') {
            $hash = self::DUMMY_HASH;
        }
        $password = $credentials['password'] ?? '';
        $passOk = password_verify(is_string($password) ? $password : '', $hash);

        return $passOk
            && $user instanceof AppUser
            && $user->enabled
            && $this->isAcceptableIdentity($user->actor);
    }

    /** By app_users id — only enabled, nameable, non-refused rows. Not used per request. */
    public function retrieveById($identifier): ?AppUser
    {
        if (! is_int($identifier) && ! (is_string($identifier) && ctype_digit($identifier))) {
            return null;
        }
        $candidate = $this->candidate($this->row('id', (int) $identifier));
        if ($candidate === null || ! $candidate->enabled || ! $this->isAcceptableIdentity($candidate->actor)) {
            return null;
        }

        return new AppUser($candidate->actor);
    }

    public function retrieveByToken($identifier, #[\SensitiveParameter] $token): ?AppUser
    {
        return null; // remember-me is disabled
    }

    public function updateRememberToken(Authenticatable $user, #[\SensitiveParameter] $token): void
    {
        // never written — app_users has no remember_token column
    }

    public function rehashPasswordIfRequired(Authenticatable $user, #[\SensitiveParameter] array $credentials, bool $force = false): void
    {
        // never written — Wave 1 is read-only against app_users
    }

    private function isAcceptableIdentity(Actor $actor): bool
    {
        return $actor->id !== null && $actor->id > 0
            && $actor->username !== ''
            && $actor->displayName !== ''
            && ! in_array($actor->username, $this->refusedUsernames, true);
    }

    /** @return array<string, mixed>|null */
    private function row(string $column, string|int $value): ?array
    {
        try {
            $row = $this->db->connection($this->connection)
                ->table('app_users')
                ->select(['id', 'username', 'display_name', 'password_hash', 'enabled'])
                ->where($column, $value)
                ->limit(1)
                ->first();
        } catch (Throwable $e) {
            // A reason code only — never the driver text (it can name a user/host).
            Log::warning('auth.app_users_unavailable', ['exception' => $e::class]);

            return null;
        }

        return $row === null ? null : (array) $row;
    }

    /** @param  array<string, mixed>|null  $row */
    private function candidate(?array $row): ?AppUser
    {
        if ($row === null) {
            return null;
        }

        $actor = new Actor(
            id: (int) ($row['id'] ?? 0),
            username: Username::normalize($row['username'] ?? ''),
            displayName: trim((string) ($row['display_name'] ?? '')),
            source: ActorSource::AppUsers,
        );

        return new AppUser($actor, (string) ($row['password_hash'] ?? ''), (int) ($row['enabled'] ?? 0) === 1);
    }

    private static function placeholderActor(): Actor
    {
        return new Actor(null, '', '', ActorSource::AppUsers);
    }
}
