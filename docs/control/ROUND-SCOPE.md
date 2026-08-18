# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**STAGE 1 — FINAL UI CLEANUP**

Presentation only. No business rule, no formula, no generated customer data.

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

**`companies.php` — mobile tap targets, and nothing else.**

- `.lang-btn`, the modal close control, and the search / filter inputs raised to
  a comfortable target at narrow widths and on coarse pointers
- CSS only, inside `max-width` and/or `(hover:none) and (pointer:coarse)` queries,
  so desktop is byte-for-byte unaffected in behaviour and unchanged in density

**Tests, evidence, reports, packaging**

- a new responsive/tap-target suite proving the two fixes and the numbering
  verification, and asserting **no horizontal overflow** at 430 / 390 / 360
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
