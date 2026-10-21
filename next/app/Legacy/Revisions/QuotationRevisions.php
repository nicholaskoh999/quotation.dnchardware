<?php

namespace App\Legacy\Revisions;

use App\Legacy\DataSource;
use App\Legacy\LegacyNotConfigured;
use App\Legacy\LegacyReader;
use App\Legacy\LegacyUnavailable;

/**
 * quotation_revisions, metadata only (api.php get_quotation_history without
 * the diff). The snapshot JSON is not even selected: Wave 1 shows who did
 * what and when, not what changed.
 *
 * A failed read is NOT an empty history. The result says which it is:
 *
 *   ok              one or more revisions
 *   empty           the table was read and holds none for this quotation
 *                   (normal for a quotation saved before revisions existed)
 *   unavailable     the read failed (table missing, database down)
 *   not_configured  no legacy database on this host
 */
final class QuotationRevisions
{
    public const OK = 'ok';

    public const EMPTY = 'empty';

    public function __construct(private readonly LegacyReader $reader) {}

    /**
     * @return array{state: string, entries: list<array<string, mixed>>}
     */
    public function forQuotation(int $quotationId): array
    {
        try {
            $rows = $this->reader->select(
                'SELECT revision_no, event_type, created_at, actor_user_id, actor_username,
                        actor_display_name, snapshot_schema_version
                   FROM quotation_revisions WHERE quotation_id = ? ORDER BY revision_no ASC',
                [$quotationId],
            );
        } catch (LegacyNotConfigured|LegacyUnavailable $e) {
            return ['state' => DataSource::fromThrowable($e), 'entries' => []];
        }

        $entries = array_map(fn (array $r) => [
            'revisionNo' => (int) $r['revision_no'],
            'event' => (string) $r['event_type'],
            'createdAt' => $r['created_at'] === null ? null : (string) $r['created_at'],
            'actor' => [
                'userId' => $r['actor_user_id'] !== null ? (int) $r['actor_user_id'] : null,
                'username' => $r['actor_username'] !== null ? (string) $r['actor_username'] : null,
                'displayName' => $r['actor_display_name'] !== null ? (string) $r['actor_display_name'] : null,
            ],
            'schemaVersion' => (int) $r['snapshot_schema_version'],
        ], $rows);

        return ['state' => $entries === [] ? self::EMPTY : self::OK, 'entries' => $entries];
    }
}
