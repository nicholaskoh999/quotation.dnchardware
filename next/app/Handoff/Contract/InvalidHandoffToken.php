<?php

namespace App\Handoff\Contract;

use RuntimeException;

/**
 * Why a handoff was refused (docs/HANDOFF-CONTRACT.md §10). The message is
 * only the reason code: it never contains the token, the state, a claim
 * value or a secret, so it is safe to log. Never show it to the user; the
 * browser always gets the same generic message.
 */
final class InvalidHandoffToken extends RuntimeException
{
    public const MALFORMED = 'malformed';

    public const UNSUPPORTED_VERSION = 'unsupported_version';

    public const BAD_SIGNATURE = 'bad_signature';

    public const WRONG_ISSUER = 'wrong_issuer';

    public const WRONG_AUDIENCE = 'wrong_audience';

    public const INVALID_CLAIMS = 'invalid_claims';

    public const LIFETIME_TOO_LONG = 'lifetime_too_long';

    public const NOT_YET_VALID = 'not_yet_valid';

    public const EXPIRED = 'expired';

    /** A state that is not 43 base64url characters (Portal authorize, or building URLs). */
    public const INVALID_STATE = 'invalid_state';

    /** The token's state_hash is not pending in this browser's session: copied URL, other browser, already used, or none started. */
    public const STATE_MISMATCH = 'state_mismatch';

    /** The state is pending here but older than STATE_TTL_SECONDS. */
    public const STATE_EXPIRED = 'state_expired';

    /** The configured secret is missing, not "base64:…", or shorter than 32 bytes. */
    public const BAD_SECRET = 'bad_secret';

    public function __construct(public readonly string $reason)
    {
        parent::__construct($reason);
    }
}
