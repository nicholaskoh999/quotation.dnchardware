<?php

namespace App\Auth;

/**
 * ONE username spelling per person — an exact port of legacy
 * dc_normalize_username(): strtolower(trim((string) $raw)). "Nicholas",
 * " NICHOLAS " and "nicholas" are one identity. (PHP 8 strtolower is
 * ASCII-only and locale-independent, exactly as on the legacy runtime.)
 * display_name keeps its own casing and is never normalised.
 */
final class Username
{
    public static function normalize(mixed $raw): string
    {
        return strtolower(trim(is_scalar($raw) ? (string) $raw : ''));
    }
}
