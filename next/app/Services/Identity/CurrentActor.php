<?php

namespace App\Services\Identity;

use App\Auth\AppUser;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Contracts\Auth\Factory as AuthFactory;

/**
 * THE one server-side way to ask "who is acting?" — the Laravel equivalent of
 * legacy dc_current_user(). Future write paths (save, revision history,
 * activity) read this and never the session, the guard internals or request
 * input, so the session shape can change without a search-and-replace.
 *
 * Malformed or partial session state yields null, never a partial actor.
 */
final class CurrentActor
{
    public function __construct(private readonly AuthFactory $auth) {}

    public function get(): ?Actor
    {
        $user = $this->auth->guard()->user();

        return $user instanceof AppUser ? $user->actor : null;
    }

    /** @throws AuthenticationException when nobody is signed in */
    public function require(): Actor
    {
        return $this->get() ?? throw new AuthenticationException;
    }
}
