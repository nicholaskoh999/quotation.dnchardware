<?php

namespace App\Legacy\Companies;

use App\Legacy\LegacyReader;
use App\Legacy\Quotations\QuotationReader;
use App\Legacy\Search\SearchKey;

/**
 * The customer directory (handoff §11), read from the legacy `companies`
 * table with the same usage figures api.php get_companies computes:
 *
 *   quotation count   COUNT(*) of quotations with that company_id
 *   last quoted       MAX(COALESCE(quote_date, DATE(created_at)))
 *
 * Short Code is removed from the normal UI (§11) but preserved as a hidden
 * search alias: it is carried in `aliases` for matching only, and
 * CompanyDirectory::forPage() drops it from anything a page receives.
 */
final class CompanyDirectory
{
    private const SQL = 'SELECT c.id, c.name, c.short_code, c.phone, c.address,
            COALESCE(qs.quotation_count, 0) AS quotation_count,
            qs.latest_quotation_date,
            qs.latest_quotation_created_at
        FROM companies c
        LEFT JOIN (
            SELECT
                company_id,
                COUNT(*) AS quotation_count,
                MAX(COALESCE(quote_date, DATE(created_at))) AS latest_quotation_date,
                MAX(created_at) AS latest_quotation_created_at
            FROM quotations
            WHERE company_id IS NOT NULL
            GROUP BY company_id
        ) qs ON qs.company_id = c.id';

    public function __construct(
        private readonly LegacyReader $reader,
        private readonly QuotationReader $quotations,
    ) {}

    /**
     * Sorted by name (as api.php). A search matches the name, the phone digits
     * or the hidden short-code alias, all through normalised keys, so
     * "acme eng", "ACME-ENG" and "Acme Eng." are the same query.
     *
     * @return list<array<string, mixed>>
     */
    public function list(?string $search = null): array
    {
        $rows = array_map(self::company(...), $this->reader->select(self::SQL.' ORDER BY c.name ASC, c.id ASC'));
        $search = trim((string) $search);
        if ($search === '') {
            return $rows;
        }
        $key = SearchKey::compact($search);
        $digits = SearchKey::digits($search);
        $out = [];
        foreach ($rows as $row) {
            $matchedBy = self::match($row, $key, $digits);
            if ($matchedBy !== null) {
                $row['matchedBy'] = $matchedBy;
                $out[] = $row;
            }
        }

        return $out;
    }

    /**
     * One company with its usage figures and its quotations (recent first).
     *
     * @return array{company: array<string, mixed>, quotations: array<string, mixed>}|null
     */
    public function profile(int $id, int $page = 1): ?array
    {
        $row = $this->reader->selectOne(self::SQL.' WHERE c.id = ?', [$id]);
        if ($row === null) {
            return null;
        }

        return [
            'company' => self::company($row),
            'quotations' => $this->quotations->list($id, $page),
        ];
    }

    /**
     * The page view of a company: identical, minus the hidden alias.
     *
     * @param  array<string, mixed>  $company
     * @return array<string, mixed>
     */
    public static function forPage(array $company): array
    {
        unset($company['aliases'], $company['searchKey']);

        return $company;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public static function company(array $row): array
    {
        $alias = trim((string) ($row['short_code'] ?? ''));
        $last = $row['latest_quotation_date'] ?? null;

        return [
            'id' => (int) $row['id'],
            'name' => (string) ($row['name'] ?? ''),
            'phone' => self::str($row['phone'] ?? null),
            'address' => self::str($row['address'] ?? null),
            'quotationCount' => (int) ($row['quotation_count'] ?? 0),
            'lastQuotedDate' => $last === null ? null : substr((string) $last, 0, 10),
            'lastQuotationCreatedAt' => self::str($row['latest_quotation_created_at'] ?? null),
            'matchedBy' => null,
            'aliases' => $alias === '' ? [] : [$alias],
            'searchKey' => SearchKey::compact((string) ($row['name'] ?? '')),
        ];
    }

    /** @param array<string, mixed> $row */
    private static function match(array $row, string $key, string $digits): ?string
    {
        if ($key !== '' && str_contains($row['searchKey'], $key)) {
            return 'name';
        }
        foreach ($row['aliases'] as $alias) {
            if ($key !== '' && str_contains(SearchKey::compact($alias), $key)) {
                return 'alias';
            }
        }
        if (strlen($digits) >= 3 && str_contains(SearchKey::digits($row['phone'] ?? ''), $digits)) {
            return 'phone';
        }

        return null;
    }

    private static function str(mixed $v): ?string
    {
        if ($v === null || ! is_scalar($v)) {
            return null;
        }
        $s = trim((string) $v);

        return $s === '' ? null : $s;
    }
}
