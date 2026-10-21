<?php

namespace App\Services\Identity;

use Illuminate\Auth\AuthenticationException;

/**
 * Prepared By (handoff §5): SYSTEM-FILLED and READ-ONLY. It is never a normal
 * free-text field and is never taken from request input — this class does not
 * accept a request, by design.
 *
 * Rules (also in app/Auth/NOTES.md):
 *  - A NEW quotation's Prepared By is the authenticated person's display name.
 *  - On save the original creator is PRESERVED with the quotation. A later
 *    edit by someone else must NOT replace it.
 *  - Later editors are tracked separately (see EditorStamp — groundwork only;
 *    Wave 1 writes nothing).
 *  - `prepared_by` is document data, not the actor: it is what the customer
 *    document shows, while audit/history identity is the Actor.
 *  - An admin-only legacy/import override may exist later if genuinely
 *    required (owner decision, not implemented).
 */
final class PreparedBy
{
    /** @throws AuthenticationException when nobody is signed in */
    public static function forNewQuotation(): string
    {
        return app(CurrentActor::class)->require()->displayName;
    }
}
