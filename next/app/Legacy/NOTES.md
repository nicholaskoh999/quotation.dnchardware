# Legacy data read layer — Wave 1 · Session D

Read compatibility with the legacy QUOTATION.DNC schema (handoff §1: no schema
normalisation; §2: production read-only first). Everything here only reads.
Legacy sources of truth: `api.php`, `pricing_history.php`, `index.php` (saved-item
readers), `tests/php/*` table shapes, `migrations/2026-08-2*.sql`.

## Layout

| path | what |
|---|---|
| `LegacyReader.php` | the only door to the `legacy` connection: `select()` / `selectOne()`, SQL guard, read-only session seal |
| `DataSource.php`, `LegacyNotConfigured.php`, `LegacyUnavailable.php`, `LegacyWriteRefused.php` | honest states: `connected` / `not_configured` / `unavailable` |
| `Companies/CompanyDirectory.php` | directory list + search, quote count, last quoted, company profile |
| `Quotations/QuotationReader.php` | list (recent first, paginated, by company, text filter) and detail |
| `Quotations/ItemReader.php` | one saved item → normalised view + `raw`, vintage-aware pricing |
| `Quotations/MaterialMap.php` | stored code → Material · Treatment · Property Class (§13) |
| `Quotations/LegacyItemText.php` | ports of `materialLabel`, `displayItemDesc`, `wasDisplayData` |
| `Quotations/QuotationPresenter.php` | strips `raw`, `rawItems`, `internal` from page payloads |
| `Revisions/QuotationRevisions.php` | revision metadata (no snapshot) with distinct empty / failed states |
| `PriceHistory/PricingHistory.php` | faithful port of `pricing_history.php` (identity, vintage split, ranking, LIKE prefilter) |
| `PriceHistory/PriceHistoryRepository.php` | `get_pricing_history` read over the port (service only in Wave 1) |
| `Settings/LegacySettings.php`, `Settings/LegacyIssuers.php` | WhatsApp template, issuer names, default prices, diameter settings |
| `Search/SearchKey.php` | search-key normaliser (foundation only; no Smart Search, §22/§23) |
| `Support/Money.php` | JS `roundMoney2` emulation, DECIMAL → 2-dp string |

Controllers: `app/Http/Controllers/Read/{CompanyController,QuotationController}.php`.
Routes (GET only): `/companies`, `/companies/{id}`, `/quotations`, `/quotations/{id}`.
Pages: `resources/js/pages/{Companies,Quotations}/{Index,Show}.tsx`; types: `resources/js/types/legacy.ts`.

## Column inventory (every column api.php reads)

| table | columns | read here |
|---|---|---|
| `companies` | `id`, `name`, `short_code`, `phone`, `address` (api.php selects `c.*`; writes exactly these four besides `id`) | all five; `short_code` only as a hidden search alias |
| `quotations` | `id` (signed INT in production), `company_id`, `ref_no` (`Q-YYYY-NNNN`, UNIQUE), `previous_ref_no` (optional — api.php checks `column_exists`), `quote_date`, `valid_until`, `prepared_by`, `remarks`, `customer_name`, `customer_phone`, `items` (LONGTEXT JSON array), `total_amount` DECIMAL(12,2), `created_at` | all; detail uses `q.*` like `get_quotation`, so `previous_ref_no` is shown when the column exists |
| `quotation_revisions` | `id`, `quotation_id`, `revision_no`, `quotation_ref_no`, `event_type`, `actor_user_id`, `actor_username`, `actor_display_name`, `snapshot_schema_version`, `snapshot_json`, `created_at` | metadata only: `revision_no`, `event_type`, `created_at`, actor ×3, `snapshot_schema_version` |
| `whatsapp_templates` | `id`, `template_name`, `template_body`, `is_default` | default row (`is_default = 1`, lowest id) |
| `default_prices` | `id`, `product_type`, `material`, `size_type`, `size`, `finish`, `cost_rate`, `additional_cost`, `markup`, `is_active` | accessor only (production: 0 rows) |
| `diameter_settings` | `id`, `product_type`, `material`, `size_type`, `size`, `diameter`, `is_active` | accessor only, active rows (production: 1 row) |
| `app_users` | `id`, `username`, `display_name`, `password_hash`, `enabled`, `created_at`, `updated_at` | **not read** — authentication is Session C |

There is **no `updated_at` on `quotations`** — api.php says so explicitly ("there is no
updated_at anywhere in this schema"), so none is read or shown.

### Item JSON keys (inside `quotations.items`)

`item_uid` (`itm_` + 32 hex, server-minted), `itemType`, `productType`, `desc`, `material`,
`sizeType`, `finish`, `cleanSize`, `sizeCode`, `size`, `dimensionPreview`, `qty`,
`finalUnitPrice`, `boltUnitPrice`, `accessoryUnitPrice`, `lineUnitPrice`, `accessoryTotal`,
`totalAmount`, `pricingModel`, `markup`, `weight`, `accessories{nut,fw,custom}`, `priceMode`,
`manualUnitPrice`, `rawUnitPrice`, `roundedUnitPrice`, `formData{…}`, `customDimensions`,
`threadRef`, `wasData{abLine,compLines}`, `plateType`. Items saved before the normalised
fields existed carry only `desc`, `size`, `qty`, `finalUnitPrice`, `totalAmount`, `finish`;
their identity is read out of `desc` + `size` with the `pricing_history.php` rule
(`fieldsSource = legacy-description`), or left `partial` — never guessed.

## What is read, and how

- **Companies**: sorted by name (as api.php); quote count = `COUNT(*)` per `company_id`;
  last quoted = `MAX(COALESCE(quote_date, DATE(created_at)))` — identical SQL to
  `get_companies`. Quotations with `company_id IS NULL` belong to no company. Search matches
  the normalised name, phone digits (≥ 3) or the hidden short-code alias.
- **Quotations**: list ordered `created_at DESC, id DESC` (api.php orders by `created_at`
  only; `id` added as a deterministic tie-break). Customer shown = `customer_name`, else the
  company name (legacy reading). **Total = stored `total_amount`**, never recomputed.
- **Items, read as written** (three pricing vintages, `index.php` `dcItemFinalUnit` /
  `dcItemBoltUnit` / `dcMigrateItemPricing` + `pricing_history.php`):
  - *accessory-inclusive*: customer unit = `finalUnitPrice`; bolt = `boltUnitPrice`
    (else `final − accessoryUnitPrice`); accessory = `accessoryUnitPrice`.
  - *bolt-separate*: customer unit = `lineUnitPrice` (else `final + accessoryUnitPrice`);
    bolt = `finalUnitPrice`; total = stored `totalAmount`, derived as unit × qty only when
    the record has none (the `dcMigrateItemPricing` rule).
  - *legacy (no model)*: customer unit = `finalUnitPrice`. No accessories → bolt = the same
    figure. Accessories + recorded Auto/No Round → bolt = unit − accessory cost; + Manual →
    bolt = unit, accessory share `null`; **no recorded mode → bolt `null`, `ambiguous`**.
  - *Welding Anchor Set*: price per set with marked-up accessories inside; no split reported.
  - Money rounding is the browser's `Math.round(v*100)/100`, pinned to `rounding.json`.
- **Materials** (§13): `4140`→4140 QT, `4140_PLAIN`→4140 plain, `4340`→4340 QT,
  `4140_HARDEN_G10_9`→4140 QT · HARDEN · 10.9, `S45C_HARDEN_G8_8`→S45C · HARDEN · 8.8,
  `Y_BAR`→Y BAR (a material). The stored code is always returned beside the reading;
  unknown codes stay as written (`recognised = false`).
- **Malformed data**: undecodable / non-array `items` → `itemsState = unreadable` (raw kept);
  `NULL` → `missing`; `[]` → `empty`; a non-object element or a field of the wrong type →
  that item alone is `unreadable`. Never an exception page.
- **Raw preservation**: `rawItems` = the column byte for byte; per item `raw` = the decoded
  stored object, untouched.
- **Revisions**: `ok` / `empty` / `unavailable` / `not_configured` — a failed read is never
  reported as an empty history.
- **Price history**: `PricingHistory` is a namespaced copy of `pricing_history.php`; parity
  is tested against `fixtures/golden/history.json` (matched set, per-vintage split, ranking
  order, imperial LIKE prefilter) and differentially against the shipped file itself.
- **Settings**: WhatsApp template = default DB row, else `index.php` `WA_DEFAULT_TPL`
  (byte-pinned by a test); `effectiveBody` applies `sanitizeWATemplate` (drops the
  `{validUntil}` line) because that is what the legacy page sends. Issuers = the three
  hard-coded `index.php` names, marked "legacy issuer names; per-issuer letterhead profiles
  arrive later (handoff §26)".

## Deliberately NOT read / NOT exposed

- `snapshot_json` (Wave 1 shows revision metadata only; no diff).
- `app_users`, the old `users` table (Session C / §5).
- `short_code` in any page payload (hidden alias for search only, §11).
- The internal pricing recipe (cost rate, additional cost, markup, price mode) and the raw
  item JSON (which carries `formData`) — kept in the server DTO, **stripped from every page
  payload**, because Wave 1 pages are not yet behind auth and Inertia embeds props in HTML.
- A price-history page/endpoint: the records carry the recipe; the company profile shows a
  Price History placeholder (§22–§24 are later waves).
- No §14 hardened customer wording and no customer output (print / WhatsApp) — output wave.

## Read-only guarantees

1. `LegacyReader` exposes `select()` / `selectOne()` only — no query builder, no Eloquent,
   no `statement()`. Every SQL string must be a single `SELECT` (comments stripped first);
   locking reads (`for update`, `lock in share mode`, `for share`) and `into outfile/@var`
   are refused (`LegacyWriteRefused`).
2. Each PDO handle is sealed on first use: MySQL `SET SESSION TRANSACTION READ ONLY`,
   SQLite `PRAGMA query_only = ON`. A test proves a direct write through the `legacy`
   connection is then refused by the database itself, on both engines.
3. `LegacyReadOnlyGuardTest` fails if any PHP file under `app/Legacy` contains an SQL write
   keyword (INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/TRUNCATE/REPLACE/GRANT/RENAME, uppercase)
   or a query-builder / Eloquent write method, or uses `exec()` for anything but the seal.
4. Read routes are GET-only (tested). No migrations (R1 test). `legacy_writes_enabled`
   stays `false`.
5. Not configured → `not_configured`; unreachable / table missing → `unavailable` (driver
   text only in the log). Pages render either state honestly, never an error page.

## Tests

`tests/Feature/Legacy/*` — each DB test runs on a throwaway SQLite file **and** a throwaway
local MySQL 8 schema (`dnc_next_d_test_<pid>_<rand>`, dropped afterwards; the MySQL leg is
skipped where no local server answers, e.g. the current next-ci workflow). Fixture:
`tests/Fixtures/legacy/dataset.json`; history inputs: `tests/Fixtures/legacy/history-records.json`
(copied from `tests/characterisation/history.php`). Vitest DOM tests render the four pages
with fixture props; Playwright covers the not-connected state and, with
`tests/e2e/support/legacy-fixture.php` + `E2E_LEGACY_SEEDED=1`, the seeded pages.

## Open questions / gates (safe legacy behaviour in force)

1. **Issuer is not persisted server-side.** `issued_by` exists only in the browser draft; a
   saved quotation has no issuer. The detail shows "Not recorded". Whether historical
   quotations get an issuer (and from what evidence) is an owner question (§6, §26).
2. **Legacy bolt price with accessories** — two legacy readers disagree: `index.php`
   `dcItemBoltUnit` returns `finalUnitPrice` for every legacy item, `pricing_history.php`
   subtracts the accessory cost when the row recorded Auto/No Round. The read layer follows
   `pricing_history.php` (and returns `null` when ambiguous). Internal only — the customer
   unit price and totals are identical under both. Confirm before Wave 2 reuses it.
3. **WhatsApp fallback text**: api.php's fallback includes a `Valid Until` line (and its
   reset text drops the comma after `{customer}`); `index.php` `WA_DEFAULT_TPL` has neither
   and the page strips `{validUntil}` anyway. The read layer uses `WA_DEFAULT_TPL`.
4. **Raw JSON / recipe exposure** waits for authentication (Session C). If an internal
   "raw view" or price-history endpoint is wanted, it must sit behind auth + a role.
5. A legacy description-only item whose `desc` carries a finish suffix
   (`"MS UNDERSIZE SAG ROD (ZP)"`) does not match pricing history (its product reads as
   `SAG ROD (ZP)`) — pinned by the R0b golden as legacy behaviour; not changed.
6. `quotations.id` is signed INT in production while `quotation_revisions.quotation_id` is
   INT UNSIGNED; the read layer casts both to PHP int, so nothing is affected.
7. Company name ordering uses the database collation (as api.php); SQLite tests sort
   binary — the fixture uses upper-case names so both agree.
