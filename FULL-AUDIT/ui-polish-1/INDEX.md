# UI POLISH 1 — EVIDENCE

Every pair was captured by one script (`tests/ui-polish-1-shots.js`) driving the
**real accepted Quick Add** through the project's own test harness, on the same
16-line Sag Rod enquiry (M12–M24, MS / ZP / Undersize, quantities 4–30).
`before/` is the accepted source at `7f5bc97`; `after/` is the same source with
this round's stylesheet changes. Desktop frames are 1600×1000; the image is the
review panel itself.

| # | Proof | File |
|---|---|---|
| 01 | Compact — the whole review, with the real toolbar: item count, **Edit** (Fast Edit), `VIEW Compact / Expanded`, Bulk Edit and `APPLY TO`, and the item table | `01-compact-full.png` |
| 02 | Expanded — every row open, metadata and actions intact | `02-expanded.png` |
| 03 | **Fast Edit active** — `✓ Done` / `Cancel` replace Edit, every geometry cell becomes an input, `Expanded` is locked, the Previous-Price note appears, Add is held | `03-fast-edit-active.png` |
| 04 | Bulk Edit collapsed — the quiet state | `04-bulk-collapsed.png` |
| 05 | Bulk Edit open, Pricing Entry expanded — the workspace marked active, the sections inside it no longer four cards | `05-bulk-open.png` |
| 06 | Selected Items — five rows ticked, the count stated **once**, with Bulk Edit / Apply Previous Price / Clear Selection | `06-selected-items.png` |
| 07 | Details — one row's deep edit, opened from the row's own control | `07-details.png` |
| 08 | History — the record list, own and other counts, inside the row | `08-history.png` |
| 09 | Previous Price — the record's menu, the accepted apply workflow | `09-previous-price.png` |
| 10 | The 16-row table scrolled deep, which is what the density is for | `10-table-scrolled.png` |
| 11a–e | Responsive: 1440, 1280, 1024, 820, 430 | `11a-desktop-1440.png` … `11e-phone-430.png` |
| 12 | 中文 compact, and 中文 Bulk Edit open | `12-zh-compact.png`, `12b-zh-bulk-open.png` |

## What to compare first

- **01** — the headline: a 900px panel becomes 1360px, and the pricing summary
  under every row stops wrapping onto a second line.
- **10** — the same list scrolled: nine items on screen instead of eight, each
  with more air, not less.
- **05** — Bulk Edit open: four bordered cards inside a bordered group become
  surfaces on one workspace.
- **06** — the selected count, now in one place.
- **03** — Fast Edit, unchanged in behaviour and still unmistakable when active.

## Measured, on these exact frames

| | before | after |
|---|---:|---:|
| Panel width @1600 | 900px | 1360px |
| Compact data line | 38px | 46px |
| Metadata under a row | 38px (two lines) | 21px (one line) |
| A whole clean item | 84px | 67px |
| Horizontal overflow, 1600→430 | none | none |

Below 1200px nothing about the layout changed: the new rules are inside a
`@media (min-width:1200px)` block, and the measured tablet and phone frames are
the accepted ones.
