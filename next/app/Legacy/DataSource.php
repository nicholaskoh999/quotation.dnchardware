<?php

namespace App\Legacy;

/**
 * The three honest states a read page can be in. Pages render each one
 * deliberately; none of them is an error page.
 */
final class DataSource
{
    public const CONNECTED = 'connected';

    /** No legacy database configured on this host. */
    public const NOT_CONFIGURED = 'not_configured';

    /** Configured, but the read failed (details only in the log). */
    public const UNAVAILABLE = 'unavailable';

    public static function fromThrowable(\Throwable $e): string
    {
        return $e instanceof LegacyNotConfigured ? self::NOT_CONFIGURED : self::UNAVAILABLE;
    }
}
