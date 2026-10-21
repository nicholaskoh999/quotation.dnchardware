<?php

namespace App\Services\Identity;

/**
 * The person behind a request. Every value comes from the row verified at
 * sign-in (app_users, or the canonical DNC users row) — never from POST, JSON,
 * a cookie or any other client-controlled input.
 *
 * `id` is an app_users id, or NULL for a DNC Workspace session: a canonical
 * DNC users.id is NOT an app_users id and is carried separately as
 * `dncUserId`, so nothing can ever record one where the other belongs
 * (mirrors legacy dc_current_user() on round/r5-c-portal-handoff).
 */
final class Actor
{
    public function __construct(
        public readonly ?int $id,
        public readonly string $username,
        public readonly string $displayName,
        public readonly ActorSource $source,
        public readonly ?int $dncUserId = null,
        public readonly ?string $dncRole = null,
    ) {}

    /**
     * The shape shared with the browser as `auth.user`. Deliberately small:
     * no canonical id, no role (Wave 1 has no permission model).
     *
     * @return array{id: int|null, username: string, displayName: string, source: string}
     */
    public function toSharedArray(): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'displayName' => $this->displayName,
            'source' => $this->source->value,
        ];
    }
}
