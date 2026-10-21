<?php

namespace App\Legacy\Support;

/**
 * Money as the legacy application reads it. Nothing here recomputes what a
 * customer agreed to: stored totals are reported as stored.
 */
final class Money
{
    /**
     * The browser's roundMoney2(): Math.round(v * 100) / 100. Math.round is
     * "floor, plus one when the fraction is at least one half" on the float it
     * is given — NOT PHP's round(), which pre-rounds and turns 2.675 into
     * 2.68 where the legacy page shows 2.67, and not floor(x + 0.5), whose
     * addition can itself round up.
     */
    public static function round2(float $v): float
    {
        $x = $v * 100;
        $f = floor($x);
        $r = ($x - $f >= 0.5 ? $f + 1 : $f) / 100;

        return $r == 0.0 ? 0.0 : $r; // never -0.0
    }

    /** A JS-style Number(): finite number or null. Booleans and arrays are not money. */
    public static function number(mixed $v): ?float
    {
        if (is_int($v) || is_float($v)) {
            return is_finite((float) $v) ? (float) $v : null;
        }
        if (is_string($v)) {
            $t = trim($v);
            if ($t !== '' && is_numeric($t)) {
                return (float) $t;
            }
        }

        return null;
    }

    /**
     * A DECIMAL(12,2) column value as a 2-dp string ("1234.50"), without a
     * float round-trip when the driver already gave a decimal string.
     */
    public static function decimal(mixed $v): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }
        if (is_string($v) && preg_match('/^(-?\d+)(?:\.(\d{0,2}))?$/', trim($v), $m)) {
            // The common case: the driver handed over the DECIMAL as text.
            return $m[1].'.'.str_pad($m[2] ?? '', 2, '0');
        }
        if (is_string($v) && is_numeric(trim($v))) {
            return self::fromFloat((float) trim($v));
        }
        if (is_int($v) || is_float($v)) {
            return self::fromFloat((float) $v);
        }

        return null;
    }

    private static function fromFloat(float $v): string
    {
        return number_format($v, 2, '.', '');
    }
}
