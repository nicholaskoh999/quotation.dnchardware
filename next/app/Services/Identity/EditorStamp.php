<?php

namespace App\Services\Identity;

use Carbon\CarbonImmutable;

/**
 * "Last edited by" groundwork (handoff §5: editor / activity is tracked
 * separately from Prepared By). A value object only — Wave 1 performs NO
 * database write; Wave 2 (write path) decides where it is persisted.
 *
 * `actorId` is the app_users id, or NULL for a DNC Workspace session (the
 * canonical users.id is never written where an app_users id belongs —
 * legacy revision history records actor_user_id NULL for those sessions).
 */
final class EditorStamp
{
    public function __construct(
        public readonly ?int $actorId,
        public readonly string $username,
        public readonly string $displayName,
        public readonly CarbonImmutable $at,
        public readonly ActorSource $source,
    ) {}

    public static function fromActor(Actor $actor, ?CarbonImmutable $at = null): self
    {
        return new self($actor->id, $actor->username, $actor->displayName, $at ?? CarbonImmutable::now(), $actor->source);
    }

    /** @return array{actorId: int|null, username: string, displayName: string, at: string, source: string} */
    public function toArray(): array
    {
        return [
            'actorId' => $this->actorId,
            'username' => $this->username,
            'displayName' => $this->displayName,
            'at' => $this->at->toIso8601String(),
            'source' => $this->source->value,
        ];
    }
}
