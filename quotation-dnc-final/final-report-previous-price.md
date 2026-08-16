# QUOTATION.DNC — round 7, part 4: previous price

Two related repairs. Baseline `ddc2c87666244aad786ee4a3add14f8e1897847c`
(round 7 part 3). The material vocabulary is untouched and its 236 assertions
still pass.

Parts 1–3 are in `final-report-extraction.md`, `final-report.md` and
`final-report-materials.md`.

---

## 1. Previous Price reuse — root cause

**`Use this price` copied the answer instead of the working.** A saved
quotation line records *how* its price was arrived at, and `dc_history_record`
already returned all of it — `costRate`, `addCost`, `markup`, `priceMode`.
`wqaHistUse` read none of them:

```js
r.priceMode='manual';
r.manualPrice=String(bolt);      // the historical FINAL figure
r.usedHistoryRef=rec.refNo||'';
```

Three consequences, all reported:

* **The row's own rate, surcharge and markup stayed put**, contradicting the
  total shown above them — the screenshot's `4 / 4 / 0` sitting under a
  `RM 6.84` that came from `6.50 / 3.50 / 4%`.
* **A second record merged with the first.** Nothing removed what the previous
  reuse had put on the row.
* **A different rod was quoted at the old rod's price.** Reusing Q-2026-0366 on
  an M20 × 1000 produced RM 6.84 — the price of the M16 × 300 the record was
  quoted on.

**Where the components were lost:** nowhere, in the sense that matters — they
were never read. The endpoint sends them, the card *prints* them (`Cost Rate
RM 6.50 · Add Cost RM 3.50 · Markup 4% · Auto Round`), and the reuse action
skipped straight past them to `boltUnitPrice`.

**Did the Calculator have the same bug?** No — it has no reuse action at all.
`checkPreviousPrice` renders with `phListHtml(phFormState, null, …)`, and the
`null` is the `onUse` argument, so the button is never emitted there. There
was one implementation to fix and no second interpretation to reconcile. That
is now asserted, so the Calculator cannot quietly grow a conflicting one.

## 2. Missing-history — root cause

**The newest-300 window was already gone.** `get_price_history` is retired at
this commit (it answers `ok:false` with a message) and `get_pricing_history`
has no `LIMIT` on its query. So it was not the cause, and this repair did not
need to touch it. Two older faults were.

**A legacy record's material could not be read.** A quotation saved before the
normalised fields existed carries its specification only in the printed
description, and `dc_legacy_item` read it back with

```php
'/^(\S+)\s+(FULLSIZE|UNDERSIZE)\s+(.+)$/'
```

— **one non-space token** for the material. But `buildDesc` writes the
material's *label*, and two of the four canonical materials are two words:

```
"4140 QT FULLSIZE SAG ROD"
 ^^^^ matched, then FULLSIZE was demanded and "QT" was found → no match at all
```

The record was skipped without a trace. **Every legacy `4140 QT` and `4340 QT`
line in the database was invisible to its own specification**, along with
`Y BAR`, `S45C + HARDEN = G8.8` and `4140 QT + HARDEN = G10.9`. Since the
ruling in part 3 makes 4140 QT and 4340 QT two of the four canonical
materials, this is the shape of "previous price does not come out".

**The SQL prefilter narrowed on more than it could safely narrow on.**

```sql
WHERE (q.items LIKE '%"cleanSize":"M16"%' AND q.items LIKE '%"material":"4140"%')
   OR (q.items NOT LIKE '%"cleanSize"%'   AND q.items LIKE '%M16%')
```

The second branch tested the **whole quotation blob** for the absence of
`"cleanSize"`. A legacy line sitting inside a quotation that also holds a
modern one therefore matched neither branch — and that is exactly what a
quotation edited across versions, or one containing a Welding Anchor Set
(which stores `"cleanSize":""`), looks like.

**Was the 300 limit capable of causing the symptom?** It would have been, but
it no longer exists. What remained capable of it are the two faults above,
both of which lose records silently and neither of which depends on how many
newer quotations exist.

## 3. Exact fixes

| What | Where |
|---|---|
| `wqaHistUse` restores the **recipe** — rate, surcharge, markup and the record's own calculated mode — then recalculates the row | `index.php` |
| `WQA_CALC_MODES = ['auto','no_round']`; the record's mode is restored if it is one of them, never forced to Auto Round | `index.php` |
| `r.histApplied` records which components a reuse installed, so the next record replaces exactly those and nothing a person typed | `index.php` |
| Manual-priced record → Manual Price at its own figure. Legacy record with only a final figure → the same, with wording saying the breakdown was never recorded. Neither invents a rate | `index.php` |
| Apply-to-All drops the provenance only where it actually **supersedes** the recipe — "not manual" is no longer the test, because a reused recipe leaves the row on Auto Round | `wqaApplyPriceToAll` |
| The row badge says which was reused — `Reusing Q-2026-0366 pricing` vs `… price` — so it cannot be read as "RM 6.84 copied" | `wqaRowBadges` |
| `dc_legacy_item` reads the material as everything before the size type, non-greedy | `pricing_history.php` |
| `dc_material_code()` maps a printed label back to the canonical code | `pricing_history.php` |
| `dc_history_sql_where()` / `dc_history_blob_matches()` — one definition of which quotations to decode, narrowing on the **size only**, in either representation | `pricing_history.php`, used by `api.php` |
| `dc_history_material_needle()` deleted — it was the part that could wrongly exclude | `pricing_history.php` |

No arbitrary window was introduced or widened. There is no recency limit in the
query; the whole matching set is built and the browser is handed one page of it
(`limit`, capped at 100, default 20). No schema change.

A note on the legacy `4140`: a bare `4140` in a *description* is the old
internal value for 4140 QT and is read as that — the same reading
`displayItemDesc` already makes. The newer 4140-plain material shares the
printed label but its items carry the normalised fields, so they never reach
the legacy reader. Pinned by the pre-existing test that caught this.

## 4. Matching semantics preserved

Nothing in the matching rules was rewritten. Suites 05 and 16 were read first
and still hold: same customer first; exact specification preferred; another
customer's exact specification appears as a reference; quantity is not part of
identity; one customer's pricing is never merged with another's; a failed
request is not reported as "no previous price"; a real no-match says so; lazy
loading; per-row state; cache and stale invalidation; bolt/accessory
separation; the unseparable safeguard; Load More; and the customer, date and
quotation reference on every card.

Two assertions in those suites changed, both **to the new contract and both
stronger**: where they said "Use this price sets a manual price of 12.00" they
now say it restores the rate, the surcharge, the markup and the mode, sets no
manual price, and prices the row from its own weight.

**Quick Add is still lazy** — suite 16's "opening the modal asks for nothing"
and suite 18's twenty-row `asked.length === 0` both pass untouched.

## 5. Files changed

`index.php` · `pricing_history.php` · `api.php` ·
`tests/suites/23-history-recipe.test.js` *(new)* ·
`tests/suites/05-pricing-history.test.js` · `tests/suites/16-quickadd-history.test.js` ·
`tests/php/pricing_history.test.php` · `tests/history-shots.js` *(new)*

No change to `companies.php`, `ai_extract.php`, `auth.php`, `.cpanel.yml`, the
database or any configuration. No secret anywhere.

## 6. Tests added / updated

**Suite 23 — previous price, a recipe not a number (68).** The production
Q-2026-0366 record: the row's own `4 / 4 / 0` first, then the real
`Use this price` button clicked in the panel, then `6.50 / 3.50 / 4 / Auto
Round` on the row with Manual empty, then **Add**, and the quotation item
asserted to be a calculated item carrying the same three figures — not a manual
one. Q-2026-0357 after it, replacing the whole recipe with no stale `3.50`.
The different-geometry case. A manual-priced record. A legacy final-price-only
record, including that the message says the breakdown was not recorded. An
unseparable record, which offers no button at all. The save → reload → edit
round trip. And the Calculator's panel asserted to emit no reuse button.

The buttons are found by reading the quotation reference on the card, not by
counting cards — the panel ranks records itself, so position is not something a
test may assume.

**`pricing_history.test.php` (+30, now 120).** Legacy records for `4140 QT`,
`4340 QT`, `Y BAR` and `4140 QT + HARDEN = G10.9`; the canonical code reported
rather than the label; **thirteen negative pairs** proving `4140 QT ↔ 4340 QT ↔
SS304 ↔ SS316 ↔ MS` never match, on legacy and normalised records alike, plus
different product, size type and size; the prefilter predicate, including a
legacy line inside an otherwise modern quotation; and three hundred newer
unrelated quotations proving none of them is asked for while the older matching
one still is.

## 7. Before-fix failing results

Kept in the package.

* `test-results/history-recipe-BEFORE-fix.txt` — suite 23 at `ddc2c87`:
  **68 assertions, 34 failed**, including *"and it is this row's own, not the
  historical 6.84 (6.84)"* — the different rod quoted at the old rod's price.
* The missing-history fixes were each reverted alone afterwards:
  the single-token material pattern fails 4 assertions (`4140 QT`, `4340 QT`,
  `Y BAR`, the sentence-length label); the old prefilter fails the
  legacy-line-inside-a-modern-quotation assertion.

## 8. Assertion totals

| | Part 3 | Now |
|---|---|---|
| Browser suites | 22 / 2,000 | **23 / 2,076** |
| `pricing_history` (PHP) | 90 | **120** |
| `ai_extract` (PHP) | 107 | 107 |
| Pricing workbook (Python) | 62 | 62 |
| **Total** | **2,259** | **2,365** |
| **Failures** | 0 | **0** |

PHP lint: 10 files, no syntax errors. No page errors in any browser suite.

## 9. Evidence

`history/` — seven frames:

| | File | What it shows |
|---|---|---|
| **A** | `1-Q0366-card-before-use.png` | the card: Cost Rate RM 6.50 · Add Cost RM 3.50 · Markup 4% · Auto Round · RM 6.84, above a row priced `4 / 4 / 0` |
| **B** | `2-Q0366-after-use.png` | after the click: **6.50 · 3.50 · 4 · Auto Round**, RM 6.84, badge *Reusing Q-2026-0366 pricing* — no Manual Price |
| **C** | `3-Q0357-replaces-recipe.png` | **6.50 · 4.00 · 4 · Auto Round**, RM 7.36 — no stale 3.50 |
| **D** | `4-different-geometry-recalculated.png` | the same recipe on M20 × 1000: 2.4662 kg/pc and **RM 20.30**, against the record's own RM 6.84 |
| **E** | `5-manual-history-stays-manual.png` | a record priced by hand, reused as Manual Price |
| **H** | `6-added-to-quotation.png`, `7-reopened-recipe-survived.png` | added, saved, reopened for editing with 6.50 / 3.50 / 4 / Auto Round intact |

**F** (older-than-300) and **G** (no false match) are proved in
`test-results/php-pricing-history.txt` — the retrieval predicate and the
identity rules have no browser surface of their own; three hundred newer
unrelated quotations are asked for zero times while the older match is still
asked for, and thirteen material pairs are asserted never to match.

`extraction/`, `add/`, `screenshots/` and `layout/` are carried forward from
part 3 unchanged — nothing in this repair touches those surfaces.

## 10. Remaining real risks

**The prefilter is less selective than it was.** It narrows on the size only,
so a common size decodes more quotations in PHP than before. That is the
correctness trade the ruling asks for — the boundary applies after matching,
not before it — and the browser is still handed one page. On a shop's volume
this is not a concern; on a database an order of magnitude larger it would be
worth a size + date-window index rather than a recency cut.

**A record from a mode this application no longer supports is not reused as a
recipe.** Only `auto` and `no_round` are restored; anything else falls to the
final-price path with its provenance stated. That is deliberate — an unknown
mode is not guessed — but if a calculated mode is added later it must be added
to `WQA_CALC_MODES` or it will quietly fall back.

**Reusing a recipe marks the rate boxes as user-priced**, so the Default Price
rules will not overwrite them afterwards. That is what reuse means, but it does
mean a later material change will not re-derive a rate on that row until the
person clears it.

**Carried forward, unchanged and still awaiting your decision:** the
`TWO END STUD` vs Sag Rod schema question (explicitly deferred by this brief),
and the non-stainless `PL` form default from part 2.

## 11. Final application commit to deploy

```
2345502ed5d324ca97ed3a6fe71353ff097b1085
```

Branch `claude/quotation-dnc-audit-repair-ashi82`. The packaging commit that
follows it touches only `quotation-dnc-final/`, outside `.cpanel.yml`'s
allowlist.

## 12. Deployment status

**NOT DEPLOYED.** `.cpanel.yml` is a manual two-click deploy — *Update from
Remote*, then *Deploy HEAD Commit*. I have not run it, and nothing here
describes the live site as verified.

After deployment, worth confirming against real data: that a `4140 QT`
quotation older than the newest few hundred now appears in Previous Prices, and
that reusing Q-2026-0366 puts 6.50 / 3.50 / 4% / Auto Round on the row.

## 13. Updated ZIP

`quotation-dnc-final.zip`, rebuilt from the committed folder.

---

*Round 7 is not declared accepted here. These artifacts are for your review.*
