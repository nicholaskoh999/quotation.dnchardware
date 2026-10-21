<?php

namespace App\Auth;

use App\Services\Identity\Actor;
use App\Services\Identity\ActorSource;
use Illuminate\Contracts\Auth\Authenticatable;

/**
 * The authenticated person as Laravel's auth layer sees it. NOT an Eloquent
 * model: it cannot be saved, so no code path can write it back to app_users
 * (no rehash-on-login, no remember_token, no last-login column).
 *
 * The password hash is present only on a candidate built during the
 * credential check; it is never put in the session.
 */
final class AppUser implements Authenticatable
{
    public function __construct(
        public readonly Actor $actor,
        private readonly ?string $passwordHash = null,
        public readonly bool $enabled = true,
    ) {}

    public function getAuthIdentifierName(): string
    {
        return 'id';
    }

    /**
     * The app_users id; a DNC Workspace identity answers "dnc:<users.id>" so
     * it can never be mistaken for an app_users id.
     */
    public function getAuthIdentifier(): int|string|null
    {
        return $this->actor->source === ActorSource::Dnc
            ? 'dnc:'.$this->actor->dncUserId
            : $this->actor->id;
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    public function getAuthPassword(): string
    {
        return (string) $this->passwordHash;
    }

    /** Remember-me is disabled: app_users has no remember_token column and is never written. */
    public function getRememberToken(): ?string
    {
        return null;
    }

    public function setRememberToken($value): void
    {
        // intentionally nothing
    }

    public function getRememberTokenName(): string
    {
        return '';
    }
}
