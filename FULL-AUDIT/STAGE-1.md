# STAGE 1 — FINAL UI CLEANUP

**Round:** STAGE 1 — Final UI Cleanup *(reopened for print / PDF layout)* — **FINAL ACCEPTED / CLOSED**
**Continues from:** STAGE 0B — the previously accepted commit `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac`, superseded by this round
**Accepted application commit:** `3e89713400b5bcfceca31d2c074de17411169d1b`
**Deploy:** NO
**Stage 2:** NOT STARTED
**Scope:** `docs/control/ROUND-SCOPE.md`

---

## 1 · Baseline gate, passed before any edit

| Check | Evidence |
|---|---|
| Accepted commit exists and is an ancestor of HEAD | `98a31e3` |
| Canonical and authoritative agree | `CANONICAL-STATE.json` and `tests/tools/authoritative.js` both read it |
| No application php differed from it at the start | `git diff --name-only 98a31e3..HEAD -- '*.php'` → empty |
| No test suite differed from it | `git diff --name-only 98a31e3..HEAD -- tests/suites tests/lib` → empty |
| Working tree clean | `git status --short` → empty |
| Control files present, read, not reconstructed | all four |

**`ROUND-SCOPE.md` was rewritten before a single application byte moved**, and it
records what the investigation found on each of the four goals — including the
two it refuses.

---

## 2 · The four goals, and what was actually there

All four were reproduced read-only, first.

### Goal 1 · 430px APPLY TO — REPAIRED

There is **no pixel overflow** at 430, 390 or 360px: `scrollWidth` equals
`clientWidth` at every one. So "clipping" understates it. The real defect:

```
BEFORE, at 430px
┌──────────────────────────────────────────────┐
│ ▾ Bulk Edit                       APPLY TO:  │   label, at x = 340.5
│   One shared value, many items               │
├──────────────────────────────────────────────┤
│ [ All Items ][ Selected Items ]              │   its buttons, at x = 22.6
└──────────────────────────────────────────────┘
                                    318px apart, on different lines
```

`.wqa-scope-lbl` carries `margin-left:auto`. On a bar wide enough for one line
that is right — the label sits hard right with its buttons beside it. Once the
bar wraps, the same rule strands the label at the **end of the first line** while
its control drops to the **left of the second**. A person reads "APPLY TO:"
against the Bulk Edit button, and reads All Items / Selected Items as belonging
to nothing.

This is the **scope** control. `PROJECT-GUARDRAILS.md` is explicit that Selected
Items must never be mistaken for All Items — and a label that has drifted onto
another row is that mistake waiting to happen.

**Repair.** Below 640px the label and its control each claim a full-width line,
in order, with no auto margin between them:

```css
@media (max-width:640px){
  .wqa-bulk-bar .wqa-scope-lbl{margin-left:0;flex:1 1 100%;margin-top:2px}
  .wqa-bulk-bar .wqa-scope{flex:1 1 100%}
  .wqa-bulk-bar .wqa-scope .wqa-view-btn{flex:1 1 0;min-width:0}
}
```

Measured after: label at x = 22.6, control at x = 22.6, 9px apart. **Nothing
above 640px changes** — at 641px and every width above it the bar is byte-for-byte
the accepted one.

### Goal 2 · Dark mode — DEFERRED TO STAGE 2

**There is no dark mode in this application, so there was nothing to polish.**
Established rather than assumed:

| check | index.php | companies.php | login.php |
|---|---|---|---|
| `prefers-color-scheme` colour rules | 0 | 0 | 0 |
| `[data-theme="dark"]` rules | 0 | 0 | 0 |
| `<html>` attribute | `data-theme="light"` | `data-theme="light"` | `data-theme="light"` |
| theme toggle | none | none | — |

The palette's own comment says it: *"Not a dark theme — every surface is still
light."*

Building one means a second complete palette over 38 colour tokens on three
pages, plus every active / selected / focus / disabled state, plus re-proving the
whole of UI POLISH 1 and UI POLISH 2 inside it. That is a feature round, and this
round is told to **preserve** those accepted outcomes.

Raised with Nicholas before any byte was touched. **Deferred to Stage 2 by his
decision.**

### Goal 3 · Companies mobile tap targets — REPAIRED

Measured at 430px with the modals actually open, because a hidden element still
reports a box and measuring one is how a "fixed" target stays broken:

| control | before | after (≤560px / coarse pointer) | desktop |
|---|---|---|---|
| `EN` language button | 30.6 × 40 | **44 × 44** | 40, unchanged |
| `中文` language button | 39 × 40 | **44 × 44** | 40, unchanged |
| modal close `×` | **17 × 24** | **44 × 44** | 24 × 17, unchanged |
| Edit Company fields | 36 tall | **44 tall** | unchanged |

The `×` is the one that matters most: on a phone it is the only way out of a
modal, it sits in the corner where the hand is least steady, and at 17 × 24 it
was under a fifth of the area a finger needs.

Every rule is inside `@media (max-width:560px)` or
`@media (hover:none) and (pointer:coarse)`. **No behaviour changed — only how big
the targets are.**

### Goal 4 · Numbering — VERIFIED, ordering DEFERRED TO STAGE 2

Verified on a deliberately interleaved four-item quotation, which is the
arrangement where the message's grouping and the sheet's insertion order
disagree.

**Identity is already consistent.** M12 x L 1000 is item 1 on screen, on paper
and in the message; M20 x L 1500 is item 3 on all three. What differs is order:

| surface | reads | why |
|---|---|---|
| Print | `1, 2, 3, 4` | insertion order |
| Screen | `4, 3, 2, 1` | Newest First is the default view; the source states sorting is view-only and must never renumber |
| WhatsApp | `1, 3` · `2, 4` | grouped by material and finish; each row carries its own item number, not its position in the message |

Both orderings are deliberate and documented in the source. Making them agree
would change generated output — a data-generation change, which this round was
instructed not to make. **Verified with evidence, ordering deferred.**

### Goal 5 · Print / PDF quotation layout — REPAIRED *(added on review)*

Nicholas / ChatGPT read the Stage 1 evidence, promoted nothing, and found one
further presentation-only defect. `ROUND-SCOPE.md` was amended before the bytes
that address it; the candidate under review at that point was `16623a2`.

**Reproduced by rendering the real print stylesheet to an actual A4 PDF**, not by
reading CSS. The sheet was already functionally correct — one priced row per
item, the inclusive Unit Price, `cw 2nut` as plain description, numbering intact
— and unpresentable:

| | before | after |
|---|---|---|
| item rows | 8.8pt | **9.6pt** |
| table header | 8.5pt | **9pt** |
| QUOTATION | 18pt, no rule | **21pt** over a rule |
| meta values (No., Date, Customer, Prepared By) | 9.5pt beside a 30mm label | **11pt**, label above value |
| Description column | **43mm** — every description wrapped | **52mm** |
| Grand Total | 10pt, grey row, hairline above | **13pt**, bold, **2px** rule above |
| money columns | no tabular numerals | `tabular-nums`, digits line up |
| Qty | centred | aligned to its column |
| even rows | flat | a faint band, so the eye tracks across |

The layout is more efficient as well as more readable: a 26-item quotation still
fits in **2 pages**, exactly as before, despite the larger type.

**Multi-page.** `thead` already repeated on page 2 — browsers do that for a real
`<thead>`, and this table has always had one. What was missing is the rest, and
is now explicit: `table-header-group` so the repeat is intentional rather than
incidental, `break-inside:avoid` so no row is torn, `table-footer-group` so the
Grand Total cannot be stranded away from the rows it totals, and the remarks and
footer note kept whole.

**What did not change, and is asserted frame by frame:** every figure, the
accessory rule, and the numbering. Four items still produce **four** priced rows
— no separately priced accessory row has returned — `cw 2nut` still carries no
money, item 1 still quotes RM 7.76 / RM 77.60, and the sheet still totals
**RM 284.80** before and after.

**Print only, measured from the screen side.** Every rule is inside
`@media print`, and `#printSummary` is `display:none` on screen with every
sibling hidden in print. Rather than assert that, the same harness measured
eleven screen elements at 1440 / 820 / 430px against the previous candidate:
**zero differences**.

---

## 3 · Files changed

| file | change |
|---|---|
| `index.php` | one `@media (max-width:640px)` block: the APPLY TO label and its control kept together. **And** the `@media print` block rebuilt: A4 margins, type scale, header hierarchy, column widths, numeric alignment, Grand Total prominence, multi-page safety. CSS only |
| `companies.php` | two media blocks — `max-width:560px` and `(hover:none) and (pointer:coarse)` — raising the language buttons, the modal close and the form fields to 44px. CSS only |

No markup, no script, no PHP, no translation key, no behaviour. Every diff is a
stylesheet rule inside a media query. The `beforeprint` handler that builds the
printed rows is **untouched** — same `dcItemFinalUnit`, same `totalAmount`, same
`getPrintItemDimension`, same `formatPrintMoney`.

---

## 4 · Tests

**New:** `tests/suites/38-mobile-ui.test.js` — *phone widths — the scope label,
the tap targets, and the desk left alone*, **102 assertions**.

It protects the two repairs, the one deferral, and — deliberately — the thing
that must NOT have moved:

- APPLY TO and its control asserted as a **pair** at 430 / 390 / 360px (stacked,
  left edges aligned) and at 1440 / 1024 / 820 / 700 / 641px (side by side)
- **641px and 640px**, one pixel either side of the boundary, so the pair must be
  correct in both arrangements rather than correct in one by accident
- Companies controls ≥ 44 × 44 at phone widths, with a modal genuinely open
- Companies controls at **exactly** 40 and 24 × 17 on the desk — stated as the
  exact numbers, because "still under 44" would not notice a 43
- reduced motion still switching every sampled transition off, with the media
  **emulated on the page**, not passed as a context option the harness drops
- numbering identity across all three surfaces, plus the three orderings recorded
  as assertions so a later round cannot change them unnoticed
- **the printed sheet**, with `print` media really emulated: the six columns in
  order, the type scale, the 52mm Description, tabular numerals, right-aligned
  money and Qty, a Grand Total larger and bolder over a heavier rule, the
  repeating header, `break-inside:avoid` — and, as the other half of every one of
  those, four items producing four priced rows, `cw 2nut` with no money in it,
  RM 7.76 / RM 77.60 and a RM 284.80 total unchanged, and `#printSummary` back to
  `display:none` with its rows cleared once `afterprint` fires

**No accepted test was modified.**

---

## 5 · Results — measured, not carried forward

| group | suites | assertions | failed | skipped |
|---|---:|---:|---:|---:|
| Browser (`tests/run.js`) | **38** | **3,816** | 0 | 0 |
| Pricing-history PHP | 1 | 172 | 0 | 0 |
| AI extraction PHP | 1 | 107 | 0 | 0 |
| Pricing workbook | 1 | 62 | 0 | 0 |
| Translation coverage | 1 | 15 | 0 | 0 |
| **Total** | **42** | **4,172** | **0** | **0** |

```
  3,816   browser
+   172   pricing / history
+   107   AI extraction / parser
+    62   workbook
+    15   translation
= 4,172   total

  4,172 − 2,810 = 1,362
```

Translation: **862 keys, 100% coverage, 0 missing, 0 hard-coded, 0 unapplied** —
unchanged, because this round added no string and removed none.

PHP lint: 7 of 7 clean.

The browser matrix grew by **102** — the whole of the new suite, which now
carries the print assertions too (75 → 102 when the round reopened). The
figures accepted before this round — 3,714 browser and 4,070 in all — were not
forced onto this run, and neither were the 3,789 / 4,145 this round reported
before it reopened. Every number here is the measured one.

`CANONICAL-STATE` now reads **4,172** and **`3e89713`**. It moved when Nicholas
accepted this round, as its own step, over a tree that had not changed since the
figures were measured.

---

## 6 · Protected behaviour, proven unchanged

The full regression is the proof, and it re-ran in full because application CSS
bytes changed. Every protected suite passed at its accepted count: pricing (49),
pricing history (106), accessories (127), previous price (73), history identity
(61), Qty (176), materials (236), stainless (119), size type (71), diameter (94),
Fast Edit (77), roles (109), save/reload/output (65).

The accessory-inclusive rule accepted in Stage 0B is untouched: suite 14 passes at
127, and `pricing_history.test.php` at 172.

---

## 7 · Deferred to Stage 2

| | why |
|---|---|
| **Dark mode** | Nothing exists to polish; building it is a feature round. Deferred by Nicholas's decision, raised before any byte moved |
| **Numbering order** on screen and in the message | Needs a data-generation change, which Stage 1 was instructed not to make |
| **Printed page numbering** (`Page 1 of 2`) | Chrome does not support CSS paged-media margin boxes, so a page number cannot be placed from the stylesheet; the browser's own print dialog supplies headers and footers. Recorded rather than faked |
| **A signature / terms block** for the lower half of a short quotation | That is document *content*, not layout — it needs wording Nicholas decides, not a CSS rule |
| `index.php` sidebar toggle (34 × 34), step pills (36px) | Recorded, not repaired: this round's tap-target goal names the Companies screens, and widening the header would move density accepted in UI POLISH 1 |

---

## 8 · Acceptance

Nicholas / ChatGPT reviewed the implementation, the visual evidence, the
regression and the candidate package, and **accepted** them. The promotion that
followed is bookkeeping over a tree that did not move, and it rests on Git
rather than on assertion:

```
git merge-base --is-ancestor 98a31e3 3e89713      →  0
git log -1 --format=%H 98a31e3..HEAD -- index.php companies.php
        →  3e89713   (the candidate SHA, DERIVED from the declared files)
git diff --name-only 98a31e3..3e89713 -- '*.php'  →  index.php  companies.php
git diff --name-only 3e89713..HEAD -- '*.php'                →  (empty)
git diff --name-only 3e89713..HEAD -- tests/suites tests/lib →  (empty)
```

This round superseded its own earlier candidate `16623a2` when it reopened for
the print work; `16623a2` was never promoted and must not be quoted as accepted.

Because **no application byte and no browser-test byte moved between the
reviewed run and the promotion**, the 38 / 3,816 / 4,172 matrix was promoted as
measured and the browser regression was not re-run. Re-running it could only
have produced the same numbers from a different tree state, which is a weaker
fact than the one above, not a stronger one.

What the promotion changed: `CANONICAL-STATE.md`, `CANONICAL-STATE.json`,
`tests/tools/authoritative.js` now read `3e89713` and the new matrix;
`PROJECT-GUARDRAILS.md` records the accepted Stage 1 UI outcomes and the two
deferrals; `ROUND-SCOPE.md` is closed with an **empty** ```candidate-files```
block, so nothing may now differ from `3e89713`.

**Deploy: NO. Stage 2: NOT STARTED.**
