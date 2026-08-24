# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**UI POLISH 2A — SAVE SUCCESS MICRO-INTERACTION** *(amended before implementation)*

Frontend interaction polish. No business rule, no formula, no schema, no
generated customer data, no deploy.

**Amended on review.** Nicholas / ChatGPT accepted the baseline proof, the
save-path proof, the sequencing of this file and the declared in-flight guard,
and **corrected the row-confirmation interpretation**: a rule-table row may not
stand in for the primary Quotation Save experience. This amendment is written
**before** the bytes it governs. §CONFLICT 1 and the EVIDENCE CONTRACT below are
rewritten; nothing else in the round changes.

| | |
|---|---|
| Accepted application commit | `3e89713400b5bcfceca31d2c074de17411169d1b` |
| Previous accepted commit | `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac` — superseded by STAGE 1 |
| This round | a **candidate**, not an accepted state |
| Deploy | **NO** |

---

## BASELINE GATE — PASSED BEFORE ANY EDIT

| Check | Evidence |
|---|---|
| HEAD recorded | `f16cffef11f02fba7b9047475bffa4a1d5774c87` |
| Accepted commit exists and is an ancestor of HEAD | `3e89713` |
| Canonical and authoritative agree on it | `CANONICAL-STATE.json` and `tests/tools/authoritative.js` both read `3e89713` |
| No application php differed from it at the start | `git diff --name-only 3e89713..HEAD -- '*.php'` → empty |
| No test suite differed from it | `git diff --name-only 3e89713..HEAD -- tests/suites tests/lib` → empty |
| Working tree clean | `git status --short` → empty |
| STAGE 1's candidate declaration closed first | Stage 1 acceptance, its own commits |
| Control files present and read, not reconstructed | all four |

---

## WHAT THE SOURCE ACTUALLY SAYS

Established read-only, before this file was written. **Nothing here was
assumed.**

### The Save buttons, and which of them saves

| control | line | onclick | reaches a backend write? |
|---|---|---|---|
| `saveQuoteBtn` "Save Quotation" | 3729 | `openSaveModal()` | **no** — opens the modal |
| `mobileSaveBtn` "Save" | 3746 | `openSaveModal()` | **no** — opens the modal |
| `saveModalSubmitBtn` | 4238 | `doSaveQuotation()` | **YES** — `save_quotation` / `update_quotation` |
| "Save Rule" (Default Price) | 4321 | `saveDPRule()` | **YES** — `save_default_price` / `update_default_price` |
| "Save Rule" (Diameter) | 4451 | `saveDSRule()` | **YES** — `save_diameter_setting` / `update_diameter_setting` |
| "Save Template" (WhatsApp) | 4382 | `saveWATemplate()` | **YES** — `save_whatsapp_template` |

The button the user presses first opens a modal; **the button that saves is the
one inside it.** A compress on `saveQuoteBtn` would be tactile feedback for
opening a dialog, not for saving, so the interaction belongs to the submit
control in every one of the four paths above.

### What "confirmed success" is

Every one of the four goes through the same shape (`doSaveQuotation`, line 9691):

```js
const res = await api(action, payload, 'POST');
if (!res.ok) { showToast(dcT('tSaveFailed')…); return; }   // ← failure, returns
…                                                          // ← success continues
```

`api()` (line 8896) returns the parsed JSON; a 401 redirects to `login.php` and
returns `{ok:false}`. **Confirmed success is `res.ok === true` after the await,
and nothing earlier.** That is the only gate the success visuals may sit behind.

### The toast that already exists

`showToast(msg)` at 9065 — one `<div class="toast" id="toast">` at 4490, a
single shared timer (`toastTimer`), 2600ms, `.toast.show` fades and slides on
`--mo` / `--mo-ease`. One element, one timer, so **one save cannot produce two
toasts** as long as the round keeps using it. It also feeds `dcToastCapture`,
which the browser suites read. **This round adds no second notification system.**

### The motion system that already exists

`:root{--mo-fast:140ms; --mo:180ms; --mo-slow:220ms; --mo-ease:cubic-bezier(.2,.7,.4,1)}`
at 1646, from UI POLISH 1, with a `prefers-reduced-motion: reduce` block at 1694
that already neutralises every transition and animation and flattens `.btn:active`.
`.btn:active` is `translateY(1px)` on `--mo-fast`. **The compress belongs in this
vocabulary, not beside it.**

### The row highlight that already exists — and is ACCEPTED

`.qi-item.row-new{animation:rowflash 1s ease}` at 505, driven by
`renderQuote(newIdx)` at 8763. It fires when an item is **added to or updated in
the draft array** — `pushItem` at 8683, the WAS path at 8578 — which is a
client-side array mutation with **no API call at all**.

`.wqa-flash` (Quick Add, 900ms) and `.calc-preview.flash` / `kpiflash` (500ms)
are the same family.

### Double submission is possible today

`doSaveQuotation` has **no in-flight guard**. Two clicks inside the await window
issue two POSTs. `setQuoteLockUI` (6080) disables `saveModalSubmitBtn` only once
the quotation is already locked — after the first save has returned. The prompt
requires "no double submission", so a guard is in scope, and it is the only
behaviour change this round makes.

---

## THREE CONFLICTS, REPORTED RATHER THAN SILENTLY RESOLVED

`PROJECT-GUARDRAILS.md` requires a prompt conflict to be reported. These are
recorded here, before implementation, with the resolution this round proceeds
under. Nicholas may overrule any of them.

### 1 · "the exact row affected" vs "the whole quotation was saved"

§7 requires the **exact** affected row to be confirmed and forbids highlighting
every item row. But `save_quotation` persists the entire quotation: **every item
row is affected.** The two instructions cannot both be met literally on that
path.

**Resolution, as corrected on review.** There are two distinct semantics, and
each is proved on its own path. **Neither stands in for the other.**

| | persistence unit | ~500ms confirmation lands on |
|---|---|---|
| **Quotation save** — `doSaveQuotation` | the whole quotation | the **quotation-level region**: `reviewListPanel`, the container holding exactly the item rows that were persisted |
| **Rule / template save** — `saveDPRule`, `saveDSRule`, `saveWATemplate` | one row | the **exact saved row**, addressed by identity, with its neighbours provably not confirmed |

For the quotation save there is **no provable single-row persistence context**,
so this round does **not fabricate one**. It does not pick an arbitrary item row,
and it does not substitute the total bar for a row it does not have. The
confirmation is applied to the quotation-level region, in the existing accent
language, because that region is exactly co-extensive with what was written: the
persisted items and nothing else.

**An earlier draft of this file proposed the total bar for that role and offered
the rule-table row as the frame-04 proof of "the correct row, not an arbitrary
one". Both are withdrawn.** The rule-table row proves the ROW semantics on the
row-specific paths and proves nothing at all about the quotation path, and this
round must not claim otherwise. The item rows are still left alone on a
quotation save — the region confirms, its children do not.

### 2 · §9's "edit item → save" is not a backend save

The item-edit path mutates `quoteItems` in memory and calls `renderQuote(idx)`.
There is no request, so there is no genuine success and §3 and §10 have nothing
to gate. It already confirms itself with the **accepted** 1s `.row-new` flash.

**Resolution.** The accepted 1s flash is **not touched** — changing it would
alter UI POLISH 1 behaviour this round is told to preserve, and it signals a
different event (an item entered the draft) from the one this round signals (the
quotation reached the database). The new ~500ms confirmation is a separate class
on the genuine-save paths only. Raised for Nicholas; reversible in one line.

### 3 · dark mode does not exist

§7 says "do not make dark mode worse". Established in STAGE 1 and recorded in
`PROJECT-GUARDRAILS.md` under DEFERRED TO STAGE 2: all three pages hardcode
`data-theme="light"`, zero `prefers-color-scheme` colour rules, zero dark rules,
no toggle. The instruction is satisfied trivially — but this round expresses
every new colour as an **existing accent/green token**, so a future dark palette
inherits the interaction instead of having to re-author it.

---

## ALLOWED TO CHANGE

```candidate-files
index.php
```

Nothing else may differ from `3e89713400b5bcfceca31d2c074de17411169d1b`.

**`index.php` — the save-success interaction, and nothing else.**

- **CSS**: a compress state on the submitting button, a checkmark state, a value
  confirmation pulse, and a ~500ms row/target confirmation — all inside the
  `--mo` / `--mo-ease` vocabulary, all neutralised by the existing
  `prefers-reduced-motion` block, all coloured from existing tokens
- **JS**: one shared helper the four save paths call **after** `res.ok`, plus an
  in-flight guard on each so a second click cannot issue a second POST
- **markup**: a `data-*` hook on the Default Price and Diameter rule rows so the
  affected row can be addressed by identity rather than by position. The
  quotation-level region needs no new markup — `reviewListPanel` already exists

The value animated is a **real saved value**, never a fabricated one:

| save | value confirmed | why it is legitimate |
|---|---|---|
| quotation | `quoteTotalAmt` (grand total) and `qi-refno` | both are in the saved payload; the ref number may be **reassigned by the server** at save time (line 9702), so it is the one value a user most needs to see move. This is the §5 VALUE feedback and is **not** the §7 region confirmation — they are separate signals on separate elements |
| default price rule | the saved row's Cost Rate / Markup cells | written by this request |
| diameter rule | the saved row's own cells | written by this request |
| WhatsApp template | none — no numeric value is saved | a small pulse on the saved control instead, per §5's own instruction not to fabricate one |

**Tests, evidence, reports, packaging**

- a new suite for the interaction: success gating, failure gating, the correct
  affected row, highlight clearing, button restoration, consecutive saves, one
  toast per save, no duplicate POST, reduced motion, and **the save payload
  proved byte-identical to the accepted one**
- a UI POLISH 2A evidence script, its five frames, and a recording
- `docs/control/ROUND-SCOPE.md` (this file)
- the round report and the review package

---

## NOT ALLOWED TO CHANGE

**Strictly protected this round.** The prompt's own no-change list and
`PROJECT-GUARDRAILS.md` PROTECTED / ACCEPTED AREAS, which include everything
STAGE 1 added:

pricing logic · Cost Rate · Additional Cost · Markup · **the
accessory-inclusive final price** and accessories carry-over · Previous Price
matching and application · weight · DIA · Size Type · Material mapping · Qty ·
parsing · Quick Add business logic · **quotation numbering and `ref_no`
allocation** · `GET_LOCK` · database schema · authentication · authorization ·
PDF generation · print logic · **WhatsApp item numbering** · the accepted STAGE
1 narrow-width scope control, Companies mobile targets and print/PDF A4 layout ·
item numbering identity on every surface · PHP version.

Specifically, and not negotiable:

- **the save payload is byte-identical.** The object passed to `api()` is not
  touched, and the suite asserts it against the accepted shape
- **no success visual before `res.ok`.** Not optimistically, not "usually"
- **the accepted 1s `.row-new` add-item flash is untouched** (conflict 2)
- `showToast` stays the only notification system, with its one timer
- no schema change, no `UNIQUE(ref_no)`, no DB hardening, no error-semantics
  change to make testing easier
- no unrelated cleanup, no renaming, no restructuring "because it could be
  cleaner"

---

## ON `tests/tools/check-control.js`

That checker was written for the **STAGE 1 final acceptance** and its own header
says it is pinned to it deliberately: an acceptance check that derived what to
expect from the files it checks would agree with itself while being wrong.

Pinned means pinned. With this round open it reports four expected
disagreements — the working tree is dirty, the candidate block names a file, and
ROUND-SCOPE no longer reads FINAL ACCEPTED / CLOSED — because a candidate round
is exactly the state it was written to reject. **That is the checker working, not
failing.**

So while UI POLISH 2A is a candidate, the round's consistency gate is
`tests/tools/check-reports.js`, which is round-agnostic and reads CANONICAL-STATE.
`check-control.js` is re-pointed at the acceptance step, as its own deliberate
edit, **if and when Nicholas accepts this round** — and not to make a check go
green. Canonical facts are not touched to satisfy a checker.

---

## EVIDENCE CONTRACT

Two semantics, proved separately, and **labelled** so neither can be read as
evidence for the other. `PROJECT-GUARDRAILS.md` EVIDENCE RULE applies to every
frame: the claim must be visible inside the frame, the figure must be asserted
so the run fails if it moves, and no frame may carry a toast left over from the
step that set it up.

### A · PRIMARY — Quotation Save, the complete micro-interaction

The five frames the brief names, on `doSaveQuotation`:

```
01  BEFORE SAVE
02  SAVE ACTIVE — the submitting button compressed
03  SUCCESS ✓
04  TOAST VISIBLE  +  the ~500ms QUOTATION-LEVEL region confirmed
05  FINAL NORMAL STATE — no ✓, no highlight, no stale class, button usable
```

Frame 04 must show the toast and the confirmed quotation-level region **in the
same frame**, with the item rows inside it visibly not individually highlighted.
Plus a recording of the whole interaction end to end.

### B · SECONDARY — row-specific save, exact-row confirmation

On `saveDPRule`, a genuine one-row backend write:

```
06  the exact saved row confirmed ~500ms, with neighbouring rows NOT confirmed
```

**This frame proves the ROW semantics on the row-specific path only.** It is not
offered as, and must not be reported as, proof of the quotation path's
behaviour. The round report states that in those words.

### C · the gates, proved by their absence

```
07  FAILED SAVE — no ✓, no value pulse, no success toast, no confirmation
                  anywhere, button restored, existing error feedback intact
08  REDUCED MOTION — ✓, toast and confirmation all still legible with the
                  preference actually emulated, not assumed
```

---

## STOP CONDITION

- the submitting button compresses on press, recovers on success **and** on
  failure, and cannot issue a second POST while one is in flight
- ✓, value pulse, toast and row confirmation appear **only** after `res.ok`,
  proven by a controlled failure that produces none of them
- on the **quotation** save, the ~500ms confirmation lands on the
  quotation-level region and on no individual item row, proven in a frame that
  shows the region confirmed and its rows not
- on a **row-specific** save, the confirmed row is the row that was saved, proven
  in a frame that also shows neighbouring rows NOT confirmed — and reported as
  evidence for that path only
- highlight ≈500ms, no permanent class, no stale timer, no mutated selection
- consecutive saves work, one toast each
- reduced motion still communicates saving / success / affected row / toast,
  measured with the preference actually emulated
- the save payload asserted unchanged
- targeted suite, the FULL browser regression — application bytes change, so it
  is re-run and not carried forward — every authoritative side suite, and the
  translation audit
- **zero failures, zero skips**
- counts reported as **measured**, never forced to the accepted 3,816 / 4,172 / 862
- ONE `QUOTATION-DNC-UI-POLISH-2A.zip`, built and independently verified after
  extraction, with a README-review.md and the diff/scope proof

Then STOP. **No deploy.** No DB hardening, no `UNIQUE(ref_no)`, no numbering
work, no dark mode, no next polish round. The candidate is not promoted until
Nicholas reviews it.
