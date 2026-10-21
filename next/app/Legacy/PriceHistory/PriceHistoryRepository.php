<?php

namespace App\Legacy\PriceHistory;

use App\Legacy\LegacyReader;

/**
 * The legacy `get_pricing_history` read, on top of the ported rules.
 *
 * Same SQL shape as api.php: the SIZE is the only text prefilter on the items
 * blob (in both of the ways a saved quotation can carry it), every surviving
 * item is compared field by field by PricingHistory::historyRecord, the whole
 * matching set is ranked and one page of it is returned. No recency window.
 *
 * Wave 1 exposes this as a service only (the company profile shows a Price
 * History placeholder; the Price Lookup UX is a later wave, handoff §22/§23).
 * The records carry the internal pricing recipe (cost rate, additional cost,
 * markup), so they must never be handed to an unauthenticated page.
 */
final class PriceHistoryRepository
{
    public function __construct(private readonly LegacyReader $reader) {}

    /**
     * @param  array{productType?: string, material?: string, sizeType?: string, finish?: string, cleanSize?: string, dimensionPreview?: string, companyId?: int}  $want
     * @return array{records: list<array<string, mixed>>, total: int, ownTotal: int, otherTotal: int, offset: int, limit: int}
     */
    public function lookup(array $want, int $offset = 0, int $limit = 20): array
    {
        $want = [
            'productType' => trim((string) ($want['productType'] ?? '')),
            'material' => trim((string) ($want['material'] ?? '')),
            'sizeType' => trim((string) ($want['sizeType'] ?? '')),
            'finish' => trim((string) ($want['finish'] ?? '')),
            'cleanSize' => trim((string) ($want['cleanSize'] ?? '')),
            'dimensionPreview' => trim((string) ($want['dimensionPreview'] ?? '')),
            'companyId' => (int) ($want['companyId'] ?? 0),
        ];
        $offset = max(0, $offset);
        $limit = min(100, max(1, $limit));

        if ($want['cleanSize'] === '' || $want['productType'] === '') {
            return ['records' => [], 'total' => 0, 'ownTotal' => 0, 'otherTotal' => 0, 'offset' => 0, 'limit' => $limit];
        }

        [$whereSql, $params] = PricingHistory::sqlWhere($want);
        // MySQL's LIKE escapes with a backslash by default (the legacy query
        // relies on that); SQLite has no default escape and must be told.
        if ($this->reader->driver() === 'sqlite') {
            $whereSql = "(q.items LIKE ? ESCAPE '\\' OR q.items LIKE ? ESCAPE '\\')";
        }

        $rows = $this->reader->select(
            'SELECT q.id, q.ref_no, q.quote_date, q.created_at, q.company_id, q.customer_name, q.items,
                    c.name AS company_name
               FROM quotations q
               LEFT JOIN companies c ON q.company_id = c.id
              WHERE '.$whereSql.'
              ORDER BY COALESCE(q.quote_date, q.created_at) DESC, q.id DESC',
            $params,
        );

        $records = [];
        foreach ($rows as $row) {
            $items = json_decode((string) ($row['items'] ?? ''), true);
            if (! is_array($items)) {
                continue;
            }
            $meta = [
                'quotationId' => (int) $row['id'],
                'refNo' => $row['ref_no'],
                'date' => $row['quote_date'] ?: $row['created_at'],
                'customer' => $row['customer_name'] ?: $row['company_name'],
                'companyId' => (int) $row['company_id'],
            ];
            foreach ($items as $item) {
                try {
                    $rec = PricingHistory::historyRecord($item, $want, $meta);
                } catch (\ErrorException $e) {
                    // The legacy page shrugs off a malformed field with a PHP
                    // warning and no match; Laravel turns that warning into an
                    // exception. Same outcome here: the item is skipped.
                    report($e);
                    $rec = null;
                }
                if ($rec !== null) {
                    $records[] = $rec;
                }
            }
        }
        PricingHistory::sort($records);

        $own = count(array_filter($records, fn ($r) => $r['own']));

        return [
            'records' => array_values(array_slice($records, $offset, $limit)),
            'total' => count($records),
            'ownTotal' => $own,
            'otherTotal' => count($records) - $own,
            'offset' => $offset,
            'limit' => $limit,
        ];
    }
}
