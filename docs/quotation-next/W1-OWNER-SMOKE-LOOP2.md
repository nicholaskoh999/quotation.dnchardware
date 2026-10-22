# QUOTATION NEXT — W1 OWNER SMOKE LOOP #2

| | |
|---|---|
| Branch | `round/w1-owner-smoke-loop1` |
| Base | Loop #1 `c94cbeb8508052faa05052c23f8a90db96d03a1f` |
| Scope | final Quotation List + Quotation Detail display rules (owner decisions below) |
| Not in scope | business calculations, Wave 2, UOM, Builder, customer output (print / WhatsApp / copy), production |

## Locked display principles (owner)

- No colour / chips to separate Material, Product, Size Type, Finish — plain
  text hierarchy. Colour stays for real states only (the "accessory charge
  inside price" warning, active toggles).
- Prepared By is not shown in any list (global or company). It stays on the
  quotation detail as stored, else `Not recorded`; never inferred.
- No UOM: the system has no canonical UOM field. Quantities read `Qty 30`,
  never `30 pcs` / KG / SET. **TODO(Wave 2): formal UOM field / semantics,
  designed with the Builder** (also noted in `components/legacy/format.ts`).

## Quotation list

| width | columns |
|---|---|
| desktop (≥ 1024) | Quotation · Date · Customer · **Item Summary** (flexible, ellipsis) · Valid until · Total |
| tablet (768–1023) | Quotation · Date · Customer · Item Summary · Total (Valid until on the detail) |
| phone (< 768) | card: customer + total / quotation no. · date / item summary (3 lines) |

- One row per quotation (fixed-layout table, no wrapping); no sizes,
  accessories, weight, prices recipe or Prepared By.
- **Item Summary** (`itemSummaryText`, one shared formatter): first readable
  item (stored #1 first) as Material + Size Type + Product (+ `HARDENED TO
  G8.8`) · Finish, then `+N` for the other items —
  `4140 QT FULLSIZE L BOLT · PL`, `S45C STUD · HARDENED TO G8.8 · PL +1`.
  The server sends only identity fields + count (`QuotationReader::itemSummary`).
- **Sort**: Newest first (default) / Oldest first via `?sort=oldest`
  (`ORDER BY created_at, id` ASC/DESC). Presentation only: nothing renumbered,
  no write.
- Company Quotations tab uses the same list without the Customer column.

## Quotation detail

- **Groups** by Product + Size Type (`groupItems`): material, finish and
  accessories never split a group. Header = `FULLSIZE L BOLT`; meta =
  `MS · ZP · 2 items` when every item shares material · finish, otherwise
  `2 items` and each row carries its own `4140 QT · PL` line.
- **Row order** (owner hierarchy): `#n  dimensions · Qty n` → `+ accessories`
  (only when present) → `Weight x.xxx kg` → `Unit RMx.xx  ⭐ +5% | Manual …
  Total RMx.xx`. Original item numbers always shown.
- **Weight** = stored per-piece weight × qty, 3 dp — the legacy item card's
  own display rule; nothing recalculated. **Total Weight** footer only for a
  group with more than one item (sum of the displayed line weights).
- **Markup**: `⭐ +N%` when the stored markup (item, else its form) is > 0 on a
  calculated price; `Manual` when the typed price replaced it; nothing at 0 %.
  The page receives only the derived `pricing.markupPercent` / `pricing.manual`
  (`QuotationPresenter`); Cost Rate / Additional Cost never reach a page.
  Customer output is unchanged.
- **Item order**: Oldest first (default, historical) / Newest first — display
  only; groups re-form in that order; numbers unchanged.
- Multi-line sizes (Welding Anchor Sets): `Qty` follows the first line, the
  component lines sit beneath it.

## Loop #3 — final W1 display polish

- **`+N more`**: the list shows the main summary in primary text and the
  other-item count separately — `+5 more`, smaller, muted, normal weight,
  spaced from the finish, no badge / background. Phone cards may wrap it to
  its own line. Same in the global list, company tab and phone cards.
- **Group heading**: when every item in a Product + Size Type group shares
  material + finish, the heading is the whole natural identity
  (`MS UNDERSIZE SAG ROD · ZP`, `4140 QT FULLSIZE L BOLT · HDG`) with only the
  item count on the right; when they differ, the heading is Size Type +
  Product and each row carries its own `4140 QT · PL`.
- **Detail rhythm**: four levels on every width — dimensions · Qty /
  accessories / Weight / price row — with spacing between them and a
  readable measure (max ≈ 42 rem) so the price row never stretches into an
  accounting line; Total is the strongest figure, on the right.
- **Sort**: the list now orders by the quotation's own date,
  `COALESCE(quote_date, DATE(created_at))` (the company directory's "last
  quoted" reading), then `created_at`, then `id`. Ordering by `created_at`
  alone had put a quotation dated 10 Feb but saved on 1 Jul above June.
  Regression test with non-monotonic dates (both drivers).
- **Markup source**: only the item's own saved `markup` — the legacy item
  card's source. The price-form copy is no longer read, so no legacy
  quotation gains a badge it never showed (e.g. Q-2026-0002 #1). Manual and
  0 % unchanged.
