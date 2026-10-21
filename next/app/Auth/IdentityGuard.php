<?php

namespace App\Auth;

use App\Handoff\DncUserDirectory;
use App\Handoff\HandoffLog;
use App\Services\Identity\Actor;
use App\Services\Identity\ActorSource;
use Illuminate\Auth\GuardHelpers;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Auth\StatefulGuard;
use Illuminate\Contracts\Session\Session;
use InvalidArgumentException;

/**
 * Session guard for named identities (legacy auth.php, ported).
 *
 * The session holds the identity FACTS read from the verified row — like the
 * legacy dc_user_id · dc_username · dc_display_name · dc_login_time — under
 * one key. An ordinary authenticated request therefore does NOT query
 * app_users (PROJECT-GUARDRAILS "WHO IS ASKING"); a DNC Workspace session is
 * the one exception: its canonical row is re-read on every request through
 * the read-only `dnc_users` connection, so disabling someone in Internal PO
 * ends their Quotation access on their next request (legacy branch §8).
 *
 * No remember-me, ever: `$remember` is ignored and viaRemember() is false.
 */
final class IdentityGuard implements StatefulGuard
{
    use GuardHelpers;

    public const SESSION_KEY = 'quo_identity';

    private bool $loggedOut = false;

    public function __construct(
        LegacyAppUserProvider $provider,
        private readonly Session $session,
        private readonly DncUserDirectory $dncUsers,
        private readonly HandoffLog $log,
        private readonly int $absoluteLifetimeSeconds,
    ) {
        $this->provider = $provider;
    }

    public function user(): ?Authenticatable
    {
        if ($this->loggedOut) {
            return null;
        }
        if ($this->user !== null) {
            return $this->user;
        }

        $identity = $this->session->get(self::SESSION_KEY);
        $actor = self::actorFromSession($identity);
        if ($actor === null) {
            return null;
        }

        // Absolute cap, independent of the idle session lifetime (legacy 7 days).
        $since = is_array($identity) && is_int($identity['login_time'] ?? null) ? $identity['login_time'] : 0;
        if ($since <= 0 || (time() - $since) > $this->absoluteLifetimeSeconds) {
            $this->session->forget(self::SESSION_KEY);

            return null;
        }

        if ($actor->source === ActorSource::Dnc) {
            $check = $this->dncUsers->sessionCheck((int) $actor->dncUserId, $actor->username);
            if ($check === 'unavailable') {
                return null; // cannot check: refuse THIS request, keep the session (fail closed)
            }
            if ($check !== 'ok') {
                $this->log->write('auth.dnc_session_revoked', ['reason' => $check, 'sub' => $actor->dncUserId]);
                $this->session->forget(self::SESSION_KEY);

                return null;
            }
        }

        return $this->user = new AppUser($actor);
    }

    /** @param  array<string, mixed>  $credentials */
    public function validate(array $credentials = []): bool
    {
        return $this->provider()->check($credentials) !== null;
    }

    /** @param  array<string, mixed>  $credentials */
    public function attempt(array $credentials = [], $remember = false): bool
    {
        $user = $this->provider()->check($credentials);
        if ($user === null) {
            return false;
        }
        $this->login($user);

        return true;
    }

    /** @param  array<string, mixed>  $credentials */
    public function once(array $credentials = []): bool
    {
        $user = $this->provider()->check($credentials);
        if ($user === null) {
            return false;
        }
        $this->setUser($user);

        return true;
    }

    /**
     * New session id (fixation), then the identity facts. Accepts an
     * app_users identity (password sign-in) or a DNC identity (handoff).
     */
    public function login(Authenticatable $user, $remember = false): void
    {
        if (! $user instanceof AppUser || self::actorFromSession(self::sessionFacts($user->actor, time())) === null) {
            throw new InvalidArgumentException('Not a nameable identity.');
        }

        $this->session->migrate(true);
        $this->session->put(self::SESSION_KEY, self::sessionFacts($user->actor, time()));
        $this->loggedOut = false;
        $this->setUser(new AppUser($user->actor));
    }

    public function loginUsingId($id, $remember = false): Authenticatable|false
    {
        $user = $this->provider()->retrieveById($id);
        if ($user === null) {
            return false;
        }
        $this->login($user);

        return $user;
    }

    public function onceUsingId($id): Authenticatable|false
    {
        $user = $this->provider()->retrieveById($id);
        if ($user === null) {
            return false;
        }
        $this->setUser($user);

        return $user;
    }

    public function viaRemember(): bool
    {
        return false;
    }

    /** Signs out THIS browser only; the controller invalidates the session. */
    public function logout(): void
    {
        $this->session->forget(self::SESSION_KEY);
        $this->user = null;
        $this->loggedOut = true;
    }

    public function setUser(Authenticatable $user): static
    {
        $this->user = $user;
        $this->loggedOut = false;

        return $this;
    }

    private function provider(): LegacyAppUserProvider
    {
        /** @var LegacyAppUserProvider */
        return $this->provider;
    }

    /** @return array<string, int|string|null> */
    private static function sessionFacts(Actor $actor, int $now): array
    {
        return $actor->source === ActorSource::Dnc
            ? ['source' => 'dnc', 'dnc_user_id' => $actor->dncUserId, 'username' => $actor->username,
                'display_name' => $actor->displayName, 'dnc_role' => $actor->dncRole, 'login_time' => $now]
            : ['source' => 'app_users', 'user_id' => $actor->id, 'username' => $actor->username,
                'display_name' => $actor->displayName, 'login_time' => $now];
    }

    /**
     * Validates the stored facts the way legacy dc_current_user() does:
     * malformed or partial state is null, never a partial actor.
     */
    private static function actorFromSession(mixed $facts): ?Actor
    {
        if (! is_array($facts)) {
            return null;
        }
        $username = $facts['username'] ?? null;
        $display = $facts['display_name'] ?? null;
        if (! is_string($username) || $username === '' || ! is_string($display) || $display === '') {
            return null;
        }

        return match ($facts['source'] ?? null) {
            'app_users' => is_int($facts['user_id'] ?? null) && $facts['user_id'] > 0
                ? new Actor($facts['user_id'], $username, $display, ActorSource::AppUsers)
                : null,
            'dnc' => is_int($facts['dnc_user_id'] ?? null) && $facts['dnc_user_id'] > 0
                ? new Actor(null, $username, $display, ActorSource::Dnc, $facts['dnc_user_id'],
                    is_string($facts['dnc_role'] ?? null) ? $facts['dnc_role'] : null)
                : null,
            default => null,
        };
    }
}
