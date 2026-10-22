<?php

namespace App\Legacy\Quotations;

use App\Legacy\LegacyReader;
use App\Legacy\Support\Money;

/**
 * Saved legacy quotations, read only (api.php get_quotations / get_quotation).
 *
 * The stored total_amount is the authority for the quotation total: money a
 * customer agreed to is reported, never recomputed from the items.
 *
 * The issuer ("Issued By") is NOT persisted server-side by the legacy app — it
 * lives only in the browser draft — so every detail reports issuer = null with
 * that reason, rather than guessing one.
 */
final class QuotationReader
{
    // Issued By was never persisted server-side by the legacy app (D-1). The
    // page shows "Not recorded" with this short, employee-facing hint.
    public const ISSUER_NOTE = 'Legacy quotation — issuer was not stored.';

    private const SUMMARY_COLUMNS = 'q.id, q.ref_no, q.quote_date, q.valid_until, q.prepared_by, q.customer_name,
        q.customer_phone, q.total_amount, q.created_at, q.company_id, c.name AS company_name';

    public function __construct(private readonly LegacyReader $reader) {}

    /**
     * Recent first (created_at, then id), paginated, optionally for one company
     * and/or narrowed by a plain text filter on ref no / customer / company.
     *
     * @return array{rows: list<array<string, mixed>>, total: int, page: int, perPage: int, lastPage: int}
     */
    public function list(?int $companyId = null, int $page = 1, int $perPage = 25, ?string $search = null): array
    {
        $perPage = min(100, max(1, $perPage));
        $page = max(1, $page);
        $where = [];
        $bindings = [];
        if ($companyId !== null) {
            $where[] = 'q.company_id = ?';
            $bindings[] = $companyId;
        }
        $search = trim((string) $search);
        if ($search !== '') {
            $like = '%'.self::likeEscape($search).'%';
            $where[] = "(q.ref_no LIKE ? ESCAPE '!' OR q.customer_name LIKE ? ESCAPE '!' OR c.name LIKE ? ESCAPE '!')";
            array_push($bindings, $like, $like, $like);
        }
        $whereSql = $where ? ' WHERE '.implode(' AND ', $where) : '';

        $count = $this->reader->selectOne(
            'SELECT COUNT(*) AS total FROM quotations q LEFT JOIN companies c ON q.company_id = c.id'.$whereSql,
            $bindings,
        );
        $total = (int) ($count['total'] ?? 0);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $offset = ($page - 1) * $perPage;

        $rows = $this->reader->select(
            'SELECT '.self::SUMMARY_COLUMNS.' FROM quotations q LEFT JOIN companies c ON q.company_id = c.id'
            .$whereSql.' ORDER BY q.created_at DESC, q.id DESC LIMIT '.(int) $perPage.' OFFSET '.(int) $offset,
            $bindings,
        );

        return [
            'rows' => array_map(self::summary(...), $rows),
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'lastPage' => $lastPage,
        ];
    }

    /**
     * The whole saved quotation: header, items read per vintage, the raw
     * items column preserved byte for byte.
     *
     * @return array<string, mixed>|null
     */
    public function find(int $id): ?array
    {
        $row = $this->reader->selectOne(
            'SELECT q.*, c.name AS company_name FROM quotations q LEFT JOIN companies c ON q.company_id = c.id WHERE q.id = ?',
            [$id],
        );
        if ($row === null) {
            return null;
        }

        $rawItems = $row['items'] ?? null;
        [$itemsState, $items] = self::items($rawItems);

        return [
            ...self::summary($row),
            'previousRefNo' => self::str($row['previous_ref_no'] ?? null),
            'remarks' => self::str($row['remarks'] ?? null),
            'issuer' => null,
            'issuerNote' => self::ISSUER_NOTE,
            'itemsState' => $itemsState,
            'itemCount' => count($items),
            'unreadableItemCount' => count(array_filter($items, fn ($i) => $i['state'] !== 'ok')),
            'items' => $items,
            'rawItems' => is_string($rawItems) ? $rawItems : null,
        ];
    }

    /**
     * @return array{0: string, 1: list<array<string, mixed>>} [state, items]
     *                                                         state: ok | empty | missing | unreadable
     */
    public static function items(mixed $rawItems): array
    {
        if ($rawItems === null) {
            return ['missing', []];
        }
        if (! is_string($rawItems) || trim($rawItems) === '') {
            return ['unreadable', []];
        }
        $decoded = json_decode($rawItems, true);
        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($decoded) || ! array_is_list($decoded)) {
            return ['unreadable', []];
        }
        if ($decoded === []) {
            return ['empty', []];
        }
        $items = [];
        foreach ($decoded as $i => $item) {
            $items[] = ItemReader::read($item, $i + 1);
        }

        return ['ok', $items];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public static function summary(array $row): array
    {
        $customer = self::str($row['customer_name'] ?? null);
        $company = self::str($row['company_name'] ?? null);

        return [
            'id' => (int) $row['id'],
            'refNo' => (string) ($row['ref_no'] ?? ''),
            'quoteDate' => self::date($row['quote_date'] ?? null),
            'validUntil' => self::date($row['valid_until'] ?? null),
            'preparedBy' => self::str($row['prepared_by'] ?? null),
            'customerName' => $customer,
            'customerPhone' => self::str($row['customer_phone'] ?? null),
            'companyId' => isset($row['company_id']) ? (int) $row['company_id'] : null,
            'companyName' => $company,
            // The legacy reading: the typed customer name, else the company's.
            'customerDisplay' => $customer ?? $company,
            'totalAmount' => Money::decimal($row['total_amount'] ?? null),
            'createdAt' => self::str($row['created_at'] ?? null),
        ];
    }

    private static function date(mixed $v): ?string
    {
        $s = self::str($v);
        if ($s === null || str_starts_with($s, '0000-00-00')) {
            return null;
        }

        return substr($s, 0, 10);
    }

    private static function str(mixed $v): ?string
    {
        if ($v === null || ! is_scalar($v)) {
            return null;
        }
        $s = trim((string) $v);

        return $s === '' ? null : $s;
    }

    private static function likeEscape(string $s): string
    {
        return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $s);
    }
}
