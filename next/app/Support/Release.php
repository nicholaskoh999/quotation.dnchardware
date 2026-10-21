<?php

namespace App\Support;

/**
 * What release is running — semver, Git SHA, build time — from the one source
 * a deployment controls.
 *
 * Order: environment (APP_RELEASE / APP_GIT_SHA / APP_BUILT_AT, read through
 * config/quotation.php so config:cache keeps working) wins, else the
 * RELEASE.json the build stamps into the artefact (scripts/release-stamp.mjs),
 * else the version in config with no SHA. Nothing here shells out to git: the
 * server holds an artefact, not a repository, and `exec` may be disabled.
 *
 * Only a SHA that looks like a SHA is ever reported, so a mistyped env value
 * cannot become a way to print arbitrary text on the health page.
 */
final class Release
{
    /** @return array{version: string, sha: string|null, shortSha: string|null, builtAt: string|null, environment: string} */
    public static function info(): array
    {
        $stamp = self::stamp();

        $version = (string) (config('quotation.release.version') ?: ($stamp['version'] ?? '0.0.0'));
        $sha = config('quotation.release.sha') ?: ($stamp['sha'] ?? null);
        $sha = is_string($sha) && preg_match('/^[0-9a-f]{7,40}$/', strtolower($sha)) ? strtolower($sha) : null;
        $builtAt = config('quotation.release.built_at') ?: ($stamp['builtAt'] ?? null);
        $builtAt = is_string($builtAt) && preg_match('/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/', $builtAt) ? $builtAt : null;

        return [
            'version' => preg_match('/^[0-9A-Za-z.+-]{1,40}$/', $version) ? $version : '0.0.0',
            'sha' => $sha,
            'shortSha' => $sha ? substr($sha, 0, 7) : null,
            'builtAt' => $builtAt,
            'environment' => (string) config('app.env'),
        ];
    }

    /** @return array<string, mixed> */
    private static function stamp(): array
    {
        $file = base_path('RELEASE.json');
        if (! is_file($file)) {
            return [];
        }
        $data = json_decode((string) @file_get_contents($file), true);

        return is_array($data) ? $data : [];
    }
}
