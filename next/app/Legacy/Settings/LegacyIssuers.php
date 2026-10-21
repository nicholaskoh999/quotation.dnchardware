<?php

namespace App\Legacy\Settings;

/**
 * The legacy "Issued By" choices, hard-coded in index.php's #qi-issued-by
 * select. Read-only reference data: legacy issuer names; per-issuer
 * letterhead profiles arrive later (handoff §26). The legacy app never saved
 * the chosen issuer with a quotation, so saved quotations have none.
 */
final class LegacyIssuers
{
    public const NOTE = 'Legacy issuer names; per-issuer letterhead profiles arrive later (handoff §26).';

    public const NAMES = [
        'DER-CHENG FASTENER SDN. BHD.',
        'DNC HARDWARE SDN. BHD.',
        'EVERTOP HARDWARE TRADING',
    ];

    /** @return array{names: list<string>, note: string, persisted: bool} */
    public static function all(): array
    {
        return ['names' => self::NAMES, 'note' => self::NOTE, 'persisted' => false];
    }
}
