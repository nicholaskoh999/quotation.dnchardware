# QUOTATION.DNC — round 7 report

Round 7 covers two things: the AI extraction work accepted earlier in the round
(`f074b5b`), and the Quick Add insertion blocker found in live acceptance after
it. Baseline `6bba600191a306af2e70c3d37f37f1b052099cf4`.

Round 7 has three parts, each with its own report:

| Part | Report | Commit |
|---|---|---|
| 1 · AI extraction | `final-report-extraction.md` | `f074b5b` |
| 2 · Quick Add insertion blocker (this one) | `final-report.md` | `581d502` |
| 3 · Material identity | `final-report-materials.md` | `ddc2c87` |
| 4 · Previous price: reuse and retrieval | `final-report-previous-price.md` | **`2345502` — deploy this** |

Earlier rounds are in `final-report-rounds-1-6.md`.

> **Superseded in part 3.** Part 1 held an engineering document's `Grade 8.8`
> open as a strength class with no material. The company's ruling is that 8.8
> **is** 4140 QT and 10.9 **is** 4340 QT, on every path alike. Where this report
> or part 1's says a grade names no steel, read part 3.

**The stainless rule is taken as final and authoritative, exactly as stated:
`SS304 → N/A`, `SS316 → N/A`, no PL, no HDG, no ZP, whatever the source
document said.** `DC_NO_FINISH_MATERIALS` is preserved and is now enforced on
every surface rather than on some of them. My round-7 report raised this as an
open conflict; it is closed, and the code already matched the ruling.

---

## 1. Quick Add root cause

Three independent faults met on the same click. Each alone produces the
reported result. The full trace is in `quickadd-add-root-cause.txt`.

**1 — a stated price still had to have a rate behind it.** Every product's add
path refuses a blank Cost Rate, and the four bent products refuse a blank
Additional Cost as well. Those guards exist so a price *computed* as
`weight × rate + surcharge` can never reach a customer with no material cost in
it — the comment in `addSagRod` gives the case it was written for. **Manual
Price computes nothing.** The figure *is* the price, and reusing a price from a
previous quotation is Manual Price: `wqaHistUse` sets `priceMode='manual'` and
`manualPrice`, and deliberately leaves the rate boxes alone. Meanwhile
`syncCostRateWarning` states on the form that a J Bolt's rate must always be
typed. So the one way to price a J Bolt without typing a rate was the one way
that could not be added.

**2 — the review did not ask for what the add path insisted on.**
`wqaApplyRowToForm` calls `onMaterialSizeChange(t,false,'material')`, which for
every product except Sag Rod clears **both** rate boxes on every row. Nothing
refills the surcharge for an L Bolt or J Bolt — `applyDefaultPrice` writes only
when a rule matches, and there is none for those products. `wqaRowMissing`
never looked at either box; it asked only whether a final price was greater
than zero, and `evalExpr('')` is `0`, so a blank surcharge still produced a
perfectly good price on screen. The row said nothing was missing and the click
then failed.

**3 — the reason was overwritten and the rows were thrown away.** Each add
function states its refusal through `showToast`; `wqaAddAll` then called
`showToast` again with its summary in the same synchronous run, so no per-row
reason ever reached the screen. Its fallback re-derived a reason from
`wqaRowMissing`, which by construction returned `[]` for exactly these rows —
leaving the literal `"0 of 1 added — check the remaining rows"`. And
`wqaHardClose()` ran unconditionally, so a row that had not been added was not
merely unadded, it was gone. One blocked row also returned before anything was
attempted, silently.

## 2. Exact state/payload failure

For the reported J Bolt, at the moment of the click:

| | review row | form the add path read |
|---|---|---|
| `priceMode` | `manual` | `manual` |
| `manualPrice` | `7.40` | `7.40` |
| `finalUnitPrice` | `7.40` | `7.40` |
| Cost Rate | *not asked for* | `""` |
| Additional Cost | *not asked for* | `""` |
| `wqaRowMissing()` | `[]` | — |

`addJBolt` reached `if(!costRateRaw){ showToast('Cost Rate is blank — enter
price before adding'); return }` and returned. `quoteItems.length` never moved,
so `added` was `0`; `blocked` was empty because `wqaRowMissing` had nothing to
report; the summary degraded to the generic string; `wqaHardClose()` discarded
the row.

The same row, after the fix, commits as
`itemType:'jbolt' · cleanSize:'M12' · qty:50 · finalUnitPrice:7.40 ·
priceMode:'manual' · weight:0.204` — screenshot `add/2-jbolt-after-add.png`.

## 3. Exact repair

| What | Where |
|---|---|
| `DC_TYPED_RATE_PRODUCTS` — one list of the products whose rate *and* surcharge are typed, shared with `syncCostRateWarning` | `index.php` |
| `dcRateRequired(type)` = price mode is not manual — applied at all eight blank-rate guards | `addSagRod`, `addStud`, `addAnchorBolt`, `addUBolt`, `addSQUBolt`, `addLBolt`, `addJBolt` |
| `wqaRowMissing` asks for Cost Rate, and for Additional Cost on those five products, under the same rule; `Price` is no longer reported on top of a blank rate that already explains it | `wqaRowMissing` |
| `dcToastCapture` — the calculators' own refusal messages are collected as well as shown | `showToast` |
| `wqaAddAll` attempts every row, removes the ones that went in, keeps the ones that did not, and names the row and the reason | `wqaAddAll` |
| Add button enabled while at least one row can go | `wqaUpdateAddButton` |

Nothing is auto-filled to clear an error: a row that needs a rate says so, on
the row, and waits.

## 4. Stainless rule verification

The rule existed as `dcFinishFor`, but **outside Quick Add it was not the rule
that held the line** — it was a DOM side effect: `updateFinishAvailability`
ticks the N/A radio whenever the material *select* reads stainless. That holds
only where such a select exists and the value comes from the DOM. Three paths
had neither, and one comparison ignored the rule entirely:

| Path | Before | Now |
|---|---|---|
| **Welding Anchor Set** — material lives in `was-ab-material`, so the check read an element that does not exist and never fired; `onWASAnchorSpecChange` did not run it at all | could **originate** an `SS304` item wearing `HDG`, which then survived save, reload, print, WhatsApp and history | `dcFormMaterial` reads the anchor; `onWASAnchorSpecChange` runs the rule; `addWAS` applies `dcFinishFor` |
| **`pushItem`** — the one funnel every other product's item passes through | read `getFinish(type)` raw; correct only while the side effect held | `dcFinishFor(material, getFinish(type))` |
| **Draft restore** | cleared the finish, then re-applied the saved radio one statement later — a disabled radio can still be checked programmatically | radios restored first, rule applied after |
| **Quotation loaded from Companies** | size type normalised on the way in, finish not | `finish: dcFinishFor(i.material, i.finish)` |
| **Pricing-history identity** | `strcasecmp` on the stored finish, so a stainless record saved wearing `HDG` could never match its own specification — invisible in Previous Prices while still printing "(HDG)" | `dc_finish_for` normalises **both sides**; mirrors `DC_NO_FINISH_MATERIALS` exactly, on canonical stored codes |
| **Print / WhatsApp / quotation list / companies.php** | pass-through | unchanged — they now pass through a value that is always correct |

Verified end to end, in one test, with a mild-steel HDG row beside the
stainless one so the assertion is not merely "no finish anywhere":

```
review row      SS304 / N/A          MS / HDG
committed item  finish ''            finish 'HDG'
form snapshot   finish ''
description     no HDG
print sheet     no (HDG)             (HDG)
WhatsApp        no HDG               HDG
saved payload   finish ''
reopened        finish ''  ← even when the stored item arrives wearing HDG
history lookup  asks material SS304, finish ''  → matches a record stored 'HDG'
```

All ten stainless spellings map and then lose their finish: `SS304 · SUS304 ·
A2 · A2-70 · A2-80 → SS304` and `SS316 · SUS316 · A4 · A4-70 · A4-80 → SS316`,
each against source `PL / PLAIN / HDG / ZP` — 80 combinations, all `N/A`. The
source wording is kept as evidence on the row: *"PL stated — SS304 is quoted
without a finish"*. The A2/A4 paper-size guard is unchanged and still asserted.

## 5. Changed files

| File | What changed |
|---|---|
| `index.php` | `DC_TYPED_RATE_PRODUCTS` + `dcRateRequired`; eight rate guards; `wqaRowMissing`; `dcToastCapture` in `showToast`; `wqaAddAll` rewritten to a partial add; `wqaUpdateAddButton`; `dcFormMaterial`; `updateFinishAvailability` uses the rule; `pushItem`, `addWAS`, `checkHandoff` and `phFormSpec` apply `dcFinishFor`; `onWASAnchorSpecChange` runs the rule; draft-restore ordering; `applyDefaultPrice` provenance; two i18n strings in both languages |
| `pricing_history.php` | `DC_NO_FINISH_MATERIALS` + `dc_finish_for`; both sides of the finish comparison in `dc_history_record` |
| `tests/suites/20-quickadd-add.test.js` | new — 160 assertions |
| `tests/suites/21-stainless-finish.test.js` | new — 119 assertions |
| `tests/php/pricing_history.test.php` | +18 assertions on the server-side rule |
| `tests/suites/17-quickadd-layout.test.js` | updated: a J Bolt now asks for the surcharge as well as the rate |
| `tests/add-shots.js` | new — the twelve Add evidence frames |

`api.php`, `companies.php`, `ai_extract.php`, `auth.php`, `.cpanel.yml`, the
database and every configuration file are untouched. No secret anywhere.

## 6. New tests

**Suite 20 — add to quotation (160).** The reported J Bolt, priced by reusing
Q-2026-0125, clicked through the real button and read out of `quoteItems`. Then
each of the five Quick Add products in turn: created valid, **changed through
the review screen**, checked that the canonical row took the change and
repriced from it, added, and the committed item compared field by field against
what the row was showing. Then: three valid rows add as three; one valid and
one incomplete — the valid one goes in, the other stays with its reason;
a row that cannot be added names the missing field, and the generic wording is
asserted **gone**; Apply-to-All writes into every row object and those values
reach the quotation; a per-row edit changes that row and no other; mixed
materials do not contaminate each other; and a stainless row adds carrying no
finish, for `SS304`/`SS316` against source `PL / PLAIN / HDG / ZP`.

Also in suite 20: **Quick Add quotes what the Calculator quotes.** Three items
entered by hand through the Calculator's own form, then the same three as one
Quick Add list — the prices must be identical, must not change on a recompute,
and must be what the quotation carries.

**Suite 21 — stainless (119).** The table in §4, plus the Calculator (choosing
SS304 takes the finish away; choosing MS again restores one), the Welding
Anchor Set, the draft restore, and a history lookup against a record stored
wearing a finish.

**`pricing_history.test.php` (+18).** A stainless record stored with `''`, `PL`,
`HDG`, `ZP` or `Plain` is the same item as a stainless specification asking for
none; a mild-steel `PL` is still not a mild-steel `HDG`.

### Proved failing first

Required, and done. `test-results/quickadd-add-BEFORE-fix.txt` is suite 20
against `f074b5b`: **153 assertions, 31 failed**, including *"clicking Add puts
the item in the quotation — expected 1, actual 0"* and the toast reading
*"0 of 1 added — check the remaining rows"*. After the repair the same file
passes 160/160.

Each fix was then re-verified by reverting it alone:

| Reverted | New assertions that fail |
|---|---|
| `dcRateRequired` → always true | 4 — the reported J Bolt is not added |
| partial add → always close | 6 — the review closes, rows are lost, no reason named |
| `dcFinishFor` at `pushItem` / `checkHandoff` | 3 — a stainless item reopens wearing HDG and prints it |
| `applyDefaultPrice` provenance | Quick Add falls back to RM 1.33 against the Calculator's RM 1.93 |

## 7. Assertion totals

| | Before this work | Now |
|---|---|---|
| Browser suites | 19 / 1,482 | **21 / 1,762** |
| `ai_extract` (PHP) | 102 | 102 |
| `pricing_history` (PHP) | 72 | **90** |
| Pricing workbook (Python) | 62 | 62 |
| **Total** | **1,718** | **2,016** |
| **Failures** | 0 | **0** |

PHP lint: 10 files, no syntax errors. No page errors in any browser suite.

## 8. Screenshot / evidence list

`add/` — twelve frames:

| File | What it shows |
|---|---|
| `1-jbolt-before-add.png` | the reported row, complete, RM 7.40 reused from Q-2026-0125 |
| `2-jbolt-after-add.png` | it in the quotation: qty 50, Unit RM 7.40, Manual Price, total RM 370.00 |
| `3/4-sagrod-*.png` | a Sag Rod before and after |
| `5-lbolt-asks-for-the-surcharge.png` | a rate typed, and the row saying it still needs the Additional Cost — **before** the click |
| `6-lbolt-after-add.png` | the same L Bolt in the quotation |
| `7/8-mixed-*.png` | five rows across four products, added at once |
| `9-partial-add-row-kept.png` | *"1 added · 1 to fix — Sag Rod M20 — Needs Material"*, the review still open holding only that row |
| `10-partial-add-quotation.png` | and the item that did go in |
| `11-stainless-review.png` / `12-stainless-quotation.png` | SS304 beside MS from one message that said HDG for both: the stainless item carries no finish chip, the MS one keeps HDG |

`extraction/` — seven frames, both attached cases, regenerated at this commit:
Case A (J Bolt · M12 · H 280 · S 80 · TL 50 · **Needs ID**, radius shown as
evidence) and Case B (six rows; rows 1–2 **SS304 · N/A**; rows 3–6 HDG +
*"GRADE 8.8 stated — a strength class, not a material"*; no 4140 anywhere).

`screenshots/` (9) and `layout/` (14) regenerated unchanged.

`test-results/` — `browser-suites.txt`/`.json`, `php-ai-extract.txt`,
`php-pricing-history.txt`, `php-lint.txt`, `pricing-workbook-check.txt`,
`extraction-evidence.txt` (the in/out fixture dump, with the raw wording beside
every normalised value), and `quickadd-add-BEFORE-fix.txt`.

`quickadd-add-root-cause.txt` — the full trace, including what was checked and
ruled **out**.

## 9. Remaining real risks

**A non-stainless row with no finish commits `PL`.** Where a document states no
finish, the review row shows none, but `updateFinishAvailability` gives every
non-stainless form a `PL` default, so the committed item is `PL`. The screen
and the quotation therefore disagree on that one field. It is long-standing, it
is not the reported blocker, and either direction is a business decision —
showing `PL` on the row would put a finish on screen the document never stated;
committing no finish would change descriptions and history identity for every
MS row. **Not changed. Pinned by assertion so it cannot drift, and flagged for
your decision.**

**The review now asks for an Additional Cost on U-Bolt, SQ U-Bolt, L Bolt,
L Bolt 45° and J Bolt.** That is what their add paths have always required, so
it is the screen catching up — but it means a J Bolt row that used to look
complete after a rate alone now asks for one more figure. Intended, and it is
the second half of the blocker.

**A 0-quantity row is now kept instead of skipped.** It used to be dropped with
"N skipped — enter a quantity for those" and the review closed over it. It now
stays with *"Needs Qty"*. Better, but it is a change in what the screen does.

**Quick Add reads five products.** Sag Rod, Stud, Anchor Bolt, L Bolt, J Bolt —
`WQA_PRODUCTS`. U-Bolt, SQ U-Bolt, L Bolt 45°, Plate, Welding Anchor Set and
Others are Calculator-only and cannot be reached from Quick Add at all, so
"Add from Quick Add" was tested for the five that exist. The stainless rule was
tested on the Welding Anchor Set through the Calculator, because that is the
only way to reach it.

**The model's half of both extraction cases is still unverified against the
live API**, unchanged from the extraction report: the schema and the prompt
text are asserted, the model's own reading of a page cannot be.

## 10. Final application commit hash

```
581d5024e0e68426de27016d742ed28139919934
```

Branch `claude/quotation-dnc-audit-repair-ashi82`. This is the commit to
deploy. The packaging commit that follows it touches only `quotation-dnc-final/`,
which is outside `.cpanel.yml`'s allowlist and is never copied to the server.

## 11. Deployment status

**NOT DEPLOYED.** `.cpanel.yml` is a manual two-click deploy — *Update from
Remote*, then *Deploy HEAD Commit*. I have not run it, and no part of this
report describes the live site as verified.

After deployment, the checks that need real production evidence:

* **Case A** — J Bolt · M12 · H 280 · ID null / Needs ID · S 80 · TL 50
* **Case B** — the six rows, with rows 1–2 `SS304 / N/A` and rows 3–6
  Needs Material / HDG / Grade 8.8, and **no 4140, 4140 QT or 4340**
* **Add** — the corrected J Bolt adds; a Sag Rod adds; no generic
  "0 of 1 added" on a valid row

## 12. Updated ZIP

`quotation-dnc-final.zip` — rebuilt from the committed `quotation-dnc-final/`
folder. `.gitignore` excludes `*.zip` by design, so the folder is the
version-controlled copy and the archive is regenerated with
`zip -r quotation-dnc-final.zip quotation-dnc-final`.

---

*Round 7 is not declared accepted here. These artifacts are for your acceptance
review.*
