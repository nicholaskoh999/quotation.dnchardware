# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**STAGE 1 — FINAL UI CLEANUP** *(reopened)*

Presentation only. No business rule, no formula, no generated customer data.

**Reopened after review.** Nicholas / ChatGPT read the Stage 1 evidence, accepted
nothing yet, and found one further presentation-only defect that belongs in this
round rather than the next: the **print / PDF quotation layout**. The candidate
under review at that point was `16623a2a61fa2bd34cdbd5e1a2ddf8ec8cd70dfd`; this
amendment is written **before** the bytes that supersede it, and adds a third
goal to the two already repaired. Nothing already done in this round is undone.

## APPLICATION STATUS

| | |
|---|---|
| Accepted application commit | `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac` |
| Previous accepted commit | `33ae0da14a3bd3108e8b066d4796b1bcda2de428` — superseded by STAGE 0B |
| This round | a **candidate**, not an accepted state |
| Deploy | **NO** |

---

## BASELINE GATE — PASSED BEFORE ANY EDIT

| Check | Evidence |
|---|---|
| Accepted commit exists and is an ancestor of HEAD | `98a31e3` |
| Canonical and authoritative agree on it | `CANONICAL-STATE.json` and `tests/tools/authoritative.js` both read `98a31e3` |
| No application php differed from it at the start | `git diff --name-only 98a31e3..HEAD -- '*.php'` → empty |
| No test suite differed from it | `git diff --name-only 98a31e3..HEAD -- tests/suites tests/lib` → empty |
| Working tree clean | `git status --short` → empty |
| STAGE 0's candidate declaration closed first | Stage 0 promotion, its own commit |
| Control files present and read, not reconstructed | all four |

---

## THE FOUR GOALS, AND WHAT INVESTIGATION FOUND

All four were reproduced read-only, before this file was written.

### 1 · 430px APPLY TO — IN SCOPE, a real defect

Reproduced at 430, 390 and 360px. There is **no pixel overflow** — `scrollWidth`
equals `clientWidth` at every width — so "clipping" is not the right word for it.
The actual defect is worse than clipping and easy to miss:

```
┌──────────────────────────────────────────────┐
│ ▾ Bulk Edit                       APPLY TO:  │   ← label, stranded right
│   One shared value, many items               │
├──────────────────────────────────────────────┤
│ [ All Items ][ Selected Items ]              │   ← its buttons, far left
└──────────────────────────────────────────────┘
```

`.wqa-scope-lbl` carries `margin-left:auto` inside a `flex-wrap:wrap` bar, so at
narrow widths the label is pushed to the right end of the first line while the
control it names wraps to the left of the next. **The label is orphaned from its
own control** — a person reads "APPLY TO:" against the Bulk Edit button, and
reads the scope buttons as belonging to nothing.

This is a **Selected Items** control, and `PROJECT-GUARDRAILS.md` is explicit
that Selected Items must never be misread as All Items. A scope control whose
label has drifted onto another row is exactly that risk, in layout.

### 2 · Dark mode — OUT OF SCOPE, DEFERRED TO STAGE 2

**There is no dark mode in this application, so there is nothing to polish.**
Established, not assumed:

| check | index.php | companies.php | login.php |
|---|---|---|---|
| `prefers-color-scheme` colour rules | 0 | 0 | 0 |
| `[data-theme="dark"]` rules | 0 | 0 | 0 |
| `<html>` attribute | `data-theme="light"` | `data-theme="light"` | `data-theme="light"` |
| theme toggle control | none | none | — |

The palette's own comment says so: *"Not a dark theme — every surface is still
light."* Building one means authoring a second complete palette over 38 colour
tokens on three pages, plus every active / selected / focus / disabled state, and
re-proving the whole of UI POLISH 1 and UI POLISH 2 inside it. That is a feature
round, not a cleanup one, and this round is told to **preserve** those accepted
outcomes.

Raised with Nicholas before any byte was touched, and **deferred to Stage 2 by
his decision.** Recorded in the Stage 1 report under DEFERRED.

### 3 · Companies mobile tap targets — IN SCOPE, a real defect

Measured at 430, 390 and 360px. No horizontal overflow at any width, but seven
controls fall under the 44px comfortable-tap threshold, and they are the ones a
person on a phone actually reaches for:

| control | measured | |
|---|---|---|
| `EN` language button | 30.6 × 40 | too narrow **and** too short |
| `中文` language button | 39 × 40 | too short |
| modal close `✕` (×2) | 17 × 24 | less than a third of the target area |
| search / filter inputs (×3) | full width × 36 | short |

### 4 · Numbering — VERIFY ONLY, ordering DEFERRED TO STAGE 2

Verified on a deliberately interleaved four-item quotation. **Identity is already
consistent: item 3 is item 3 on all three surfaces.** What differs is ORDER:

| surface | reads | why |
|---|---|---|
| Print | 1, 2, 3, 4 | insertion order |
| Screen | 4, 3, 2, 1 | Newest First is the default view; the code states sorting is view-only and must never renumber |
| WhatsApp | 1, 3 · then 2, 4 | grouped by material and finish; each row carries its own item number rather than its position in the message |

Both orderings are deliberate and documented in the source. Changing either means
changing generated output — a data-generation change — which this round is
instructed not to make. **Verified with evidence, ordering deferred to Stage 2.**

### 5 · Print / PDF quotation layout — IN SCOPE, added on review

Reproduced by rendering the real print stylesheet to an actual A4 PDF, not by
reading CSS. The output is **functionally correct** — one priced row per item,
inclusive Unit Price, `cw 2nut` as plain description, numbering intact — and
**visually unacceptable**:

| what the page does | measured |
|---|---|
| item rows set in 8.8pt, headers in 8.5pt | small for a formal A4 document |
| `Description` column fixed at 43mm | every description wraps to two lines while `Size / Dimension` keeps ~67mm |
| Grand Total is a grey table-footer cell | reads as one more row, not as the figure the customer looks for |
| four items fill under half the sheet | the rest is empty, and nothing balances it |
| no `tabular-nums` on the money columns | digits do not line up down the column |

It reads as a raw bordered table dump rather than a quotation.

**What must survive the repair, unchanged:** every figure, the accessory rule
(`cw 2nut` stays a plain description, and a separately priced accessory row must
never come back), numbering identity, and the repeating table header that already
works on page 2.

---

## ALLOWED TO CHANGE

```candidate-files
index.php
companies.php
```

Nothing else may differ from `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac`.

**`index.php` — the scope control's narrow-width layout, and nothing else.**

- `.wqa-scope-lbl` / `.wqa-scope` / `.wqa-bulk-bar` so the label and the control
  it names stay together at narrow widths
- CSS only, inside a narrow-width media query, so the accepted desktop density
  from UI POLISH 1 and UI POLISH 2 is untouched at every width above it

**`index.php` — the print / PDF layout, inside `@media print` only.**

- `@page` margins, and the `#printSummary` block the print sheet is built from:
  type scale, the header/meta hierarchy, table column widths, numeric alignment,
  Grand Total prominence, and multi-page safety
- **`@media print` only.** `#printSummary` is a direct child of `<body>`, is
  `display:none` on screen, and the print sheet already hides every sibling — so
  a rule written inside that block cannot reach the screen UI. That is structural,
  not a promise, and the suite measures it from the screen side as well
- no change to what the print path *generates*: `beforeprint` still builds one
  priced row per parent item from `dcItemFinalUnit`, and that code is not touched

**`companies.php` — mobile tap targets, and nothing else.**

- `.lang-btn`, the modal close control, and the search / filter inputs raised to
  a comfortable target at narrow widths and on coarse pointers
- CSS only, inside `max-width` and/or `(hover:none) and (pointer:coarse)` queries,
  so desktop is byte-for-byte unaffected in behaviour and unchanged in density

**Tests, evidence, reports, packaging**

- a new responsive/tap-target suite proving the fixes and the numbering
  verification, and asserting **no horizontal overflow** at 430 / 390 / 360
- print-layout assertions: the column widths, the type scale, the money
  alignment, the Grand Total, one priced row per item, `cw` carrying no money,
  and the screen UI provably unmoved by the print rules
- a Stage 1 evidence script and this round's frames
- `docs/control/ROUND-SCOPE.md` (this file)
- the Stage 1 report and the review package

---

## NOT ALLOWED TO CHANGE

**Strictly protected this round**, and none of it is touched by a media query:

parser · extraction · AI extraction semantics · pricing formulas ·
**the accessory-inclusive final price** · weight · DIA · Previous Price matching
and reuse · History identity and ordering · Qty and default Qty · Material ·
Finish · Size Type · selection behaviour · Fast Edit behaviour · Bulk Edit
behaviour · Details behaviour · database and save semantics · Add-to-quotation
behaviour · translation semantics.

Specifically for the print work, and not negotiable:

- the `beforeprint` handler's **data generation** — one priced row per parent
  item, `dcItemFinalUnit` as the Unit Price, `totalAmount` as the Amount, and
  `getPrintItemDimension` putting the accessory wording in the dimension cell
- **no separately priced accessory row may return**, in any form
- item numbering and its order on any surface
- currency formatting — `formatPrintMoney` is untouched

Also out of scope, deliberately:

- **dark mode** — deferred to Stage 2, see §2 above
- **numbering ORDER** on any surface — deferred to Stage 2, see §4 above
- desktop density, spacing and hierarchy accepted in UI POLISH 1 and UI POLISH 2
- the `index.php` sidebar toggle (34 × 34) and the step pills (36px) — recorded
  as observations, not repaired, because this round's tap-target goal names the
  Companies screens and widening the header would move accepted density
- no new translation keys, no new keyboard shortcuts, no new asynchronous
  behaviour, no opportunistic refactoring

**Motion.** Only subtle motion, and every transition must remain neutralised by
the existing `prefers-reduced-motion` rules. Proven with the preference actually
emulated, not assumed.

---

## CANDIDATE APPLICATION CHANGE

The two files above are declared by name, so the report checker and the package
verifier report them as a **declared candidate** rather than as drift — and so
that any file NOT on that list still fails, loudly.

`CANONICAL-STATE.md`, `CANONICAL-STATE.json`, `PROJECT-GUARDRAILS.md` and
`tests/tools/authoritative.js` are **not** touched while this round is a
candidate. If Stage 1 is accepted, the canonical application commit moves then —
deliberately, as its own step, with this declaration closed.

---

## STOP CONDITION

- no horizontal overflow and no orphaned label at 430 / 390 / 360px
- Companies mobile controls at a comfortable target size
- the print sheet renders as a professional A4 quotation — readable type, a
  Description column wide enough for its content, aligned money, a Grand Total a
  reader finds at once, and a second page that stays usable — with every figure,
  the accessory rule and the numbering identical to before
- the screen UI measured unchanged by the print rules, from the screen side
- screen / print / WhatsApp numbering verified consistent in identity, with the
  ordering difference recorded rather than changed
- desktop density from UI POLISH 1 and UI POLISH 2 provably unchanged
- reduced motion still honoured, measured with the preference emulated
- targeted responsive tests, the FULL browser regression — application CSS bytes
  change, so it is re-run and not carried forward — every authoritative side
  suite, and the translation audit
- **zero failures, zero skips**
- counts reported as **measured**, never forced to the previous 3,714 / 4,070 / 862
- ONE `QUOTATION-DNC-STAGE-1-UI-FINAL.zip`, built and independently verified
  after extraction

Then STOP. **No deploy.** The candidate is not promoted until Nicholas reviews it.
