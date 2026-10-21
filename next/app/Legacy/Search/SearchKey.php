<?php

namespace App\Legacy\Search;

/**
 * Search FOUNDATION only (handoff §22/§23: Smart Search is a later wave).
 * Builds the keys a later search can match on; it interprets nothing.
 */
final class SearchKey
{
    /**
     * Uppercase, every separator removed: "Acme Eng. Sdn-Bhd" → "ACMEENGSDNBHD".
     * Used for company names, short-code aliases and item text.
     */
    public static function compact(?string $s): string
    {
        $s = mb_strtoupper((string) $s, 'UTF-8');

        return (string) preg_replace('/[^A-Z0-9]+/u', '', $s);
    }

    /**
     * The legacy api.php search_normalize(): uppercase, separators → one
     * space, "FULL SIZE"/"UNDER SIZE" folded to the stored single words.
     */
    public static function tokens(?string $s): string
    {
        $s = mb_strtoupper((string) $s, 'UTF-8');
        $s = (string) preg_replace('/[^A-Z0-9]+/u', ' ', $s);
        $s = (string) preg_replace('/\bFULL\s+SIZE\b/', 'FULLSIZE', $s);
        $s = (string) preg_replace('/\bUNDER\s+SIZE\b/', 'UNDERSIZE', $s);

        return trim((string) preg_replace('/\s+/', ' ', $s));
    }

    /** Digits only — so "012-345 6789" is found by "0123456789" or "6789". */
    public static function digits(?string $s): string
    {
        return (string) preg_replace('/\D+/', '', (string) $s);
    }
}
