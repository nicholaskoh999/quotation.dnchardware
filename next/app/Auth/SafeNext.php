<?php

namespace App\Auth;

/**
 * Post-login redirect target: same-origin paths only. Port of legacy
 * dc_safe_next() — must start with "/", must not start with "//", must not
 * contain a backslash — plus: an absolute URL (Laravel's url.intended) is
 * reduced to its path + query, and only when its host is this request's host.
 */
final class SafeNext
{
    public const DEFAULT = '/';

    public static function path(mixed $raw): string
    {
        $raw = is_string($raw) ? $raw : '';
        if ($raw === '' || $raw[0] !== '/' || str_starts_with($raw, '//') || str_contains($raw, '\\')
            || preg_match('/[\x00-\x1F\x7F]/', $raw) === 1) {
            return self::DEFAULT;
        }

        return $raw;
    }

    /** Laravel stores url.intended as an absolute URL of this application. */
    public static function fromIntended(mixed $intended, string $requestHost): string
    {
        if (! is_string($intended) || $intended === '') {
            return self::DEFAULT;
        }
        if ($intended[0] === '/') {
            return self::path($intended);
        }
        $parts = parse_url($intended);
        if (! is_array($parts) || ! isset($parts['host']) || strcasecmp($parts['host'], $requestHost) !== 0
            || ! in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || isset($parts['user']) || isset($parts['pass'])) {
            return self::DEFAULT;
        }
        $path = ($parts['path'] ?? '/') ?: '/';

        return self::path($path.(isset($parts['query']) ? '?'.$parts['query'] : ''));
    }
}
