# UI POLISH 2A — SAVE SUCCESS MICRO-INTERACTION

**Round:** UI POLISH 2A
**Status:** **CANDIDATE ONLY — WAITING FOR HUMAN REVIEW**
**Accepted application (unchanged):** `3e89713400b5bcfceca31d2c074de17411169d1b`
**Deploy:** NO
**Scope:** `docs/control/ROUND-SCOPE.md`

---

## 1 · Baseline gate, passed before any edit

| Check | Evidence |
|---|---|
| HEAD recorded before anything was read | `f16cffef11f02fba7b9047475bffa4a1d5774c87` |
| Accepted commit is an ancestor of HEAD | `3e89713` |
| Canonical and authoritative agree on it | `CANONICAL-STATE.json` and `tests/tools/authoritative.js` both read it |
| No application php differed from it at the start | `git diff --name-only 3e89713..HEAD -- '*.php'` → empty |
| No test suite differed from it | `git diff --name-only 3e89713..HEAD -- tests/suites tests/lib` → empty |
| Working tree clean | `git status --short` → empty |
| Control files present, read, not reconstructed | all four |

**`ROUND-SCOPE.md` was written before a single application byte moved**, and
**amended before implementation** when review corrected the row-confirmation
reading. Both are in the history: `5053d52`, then `d63891f`.

---

## 2 · What the source said, before anything was designed

Nothing below was assumed. Every line was read first.

**Six controls say "Save". Two of them do not save.** `saveQuoteBtn` and
`mobileSaveBtn` call `openSaveModal()` — they open a dialog. The button that
saves is `saveModalSubmitBtn` inside it, and three more: the Default Price rule,
the Diameter rule and the WhatsApp template. Putting the compress on the control
the user presses first would have been tactile feedback for **opening a dialog**.

**Confirmed success is one expression.** All four paths share the shape

```js
const res = await api(action, payload, 'POST');
if (!res.ok) { showToast(dcT('tSaveFailed')…); return; }
```

so the gate is `res.ok === true` after the await, and nothing earlier. There is
no optimistic path in this round and no "usually fine".

**The toast already existed** — one element, one shared timer — so this round
adds no second notification system and one save still produces one toast.

**The motion vocabulary already existed** — `--mo-fast` / `--mo` / `--mo-slow` /
`--mo-ease` from UI POLISH 1, with a `prefers-reduced-motion` block that already
flattens `.btn:active`. The new states are written **inside** that vocabulary.

**A row flash already existed** — `.qi-item.row-new`, 1s — and it fires on a
CLIENT-SIDE array mutation with no request at all. It is accepted behaviour and
this round does not touch it.

---

## 3 · The defect nobody had reported

`doSaveQuotation` had **no in-flight guard**. Two clicks inside the request
window issued two POSTs — on a save that allocates a quotation number.
`setQuoteLockUI` disables the button only *after* the first save has returned,
which is too late to help.

The brief forbids double submission, so the guard is in scope, and it is
**the only behaviour this round changes**. It is declared as such in
ROUND-SCOPE, and measured: **four clicks inside one request window issue exactly
one save** — suite §1, and `EVIDENCE/FACTS.json` → `postsForFourClicks: 1`.

---

## 4 · What was built

One helper, four call sites, and one hard rule: everything except the in-flight
state runs only after the server has said ok.

| | |
|---|---|
| `dcSvBegin(key, btn)` | the in-flight state. Returns **false** if a save on that key is already running — that return *is* the double-submission guard |
| `dcSvFail(key)` | the button comes back, and nothing else happens |
| `dcSvOk(key)` | the check. Only ever called with `res.ok` already true |
| `dcSvSettle(key, opts)` | the page-level feedback, scheduled once its targets exist |

**Why the visuals are split across two calls.** The check belongs to the moment
the answer arrives. The confirmation belongs to the moment its target exists — a
rule row is destroyed and rebuilt by `renderDPList()` *after* the save, so a
confirmation scheduled earlier would decorate a row that is about to be thrown
away, or find nothing at all.

**Why a helper and not four copies.** The part that has to be right is the
failure path, and four hand-written copies of *"did we remember to put the
button back"* is four chances to forget one.

### The interaction

```
click ──▶ .btn:active (existing, instant)
      ──▶ dcSvBegin: compress + aria-busy, second click refused
      ──▶ await api(...)
                        ✗ ──▶ dcSvFail: button back, existing error toast, nothing else
                        ✓ ──▶ dcSvOk: ✓ on the button (0ms)
                              showToast (existing, 0ms)
                              dialog closes (200ms — after the ✓ has been seen)
                              value pulse + region confirmation (240ms)
                              confirmation clears (740ms)
                              button restored (760ms)
```

Nothing waits for anything else that it does not depend on, and the interface is
never locked: the dialog is gone at ~380ms and the page is usable underneath the
confirmation the whole time.

---

## 5 · The two confirmation semantics

This is the part review corrected, and it is the part most easily got wrong.

| | persistence unit | ~500ms confirmation lands on |
|---|---|---|
| **Quotation save** | the WHOLE quotation | `reviewListPanel` — the container holding exactly the item rows that were written |
| **Rule / template save** | ONE row | that row, addressed by the identity the server confirmed |

`save_quotation` writes every item, so there is **no provable single-row
persistence context and this round invents none.** It does not pick an arbitrary
item row and it does not substitute the total bar for a row it does not have.
The region confirms; its children do not — measured across the whole
interaction, sampled every 12ms: **0 of 3 item rows ever marked.**

`EVIDENCE/06-exact-row-confirmed.png` proves the ROW semantics on the
row-specific path — rule 202 washed green, 101 and 303 clean, all three inside
the frame. **It proves nothing about the quotation path and is not offered as
if it did.**

### The value that confirms itself

Real saved values only. §5 of the brief forbids inventing one, so:

| save | value | why it is legitimate |
|---|---|---|
| quotation | `quoteTotalAmt`, `qi-refno` | both in the saved payload; the ref number may be **reassigned by the server** at save time, which makes it the one value a user most needs to see move |
| rule saves | the saved row's own cells | written by that request |
| WhatsApp template | the template body | **no numeric value is saved**, so none was fabricated — a pulse on the control that was written, per §5's own instruction |

---

## 6 · Two things that were built differently than first written

Recorded because the reasoning matters more than the result.

**The confirmation is an inset box-shadow, not a background.** The first version
tinted `background`. The review panel already has two background colours of its
own — `.review-list-panel` and `.locked` — so the animation has to know which
one to end on, and ends on the wrong one exactly when a quotation has just been
saved, because a saved quotation is a locked one. A table row's background may
be striping or a warning state that is not this round's to overwrite. An inset
shadow paints above the background and below the text: contrast is kept, nothing
underneath is replaced, and it fades to *nothing* rather than to a colour.

**The row wash holds before it fades.** The first version faded linearly from
frame one, so by the time a reader's eye arrived it was at 2% alpha — a 500ms
confirmation that reads as a 200ms one. It now holds to 75% and then releases,
the same shape as the region.

---

## 7 · Reduced motion

The page-wide rule collapses every animation to `.001ms`, which would make a
500ms confirmation **invisible rather than calm** — and §11 requires saving,
success, the affected target and the toast to still be communicated.

So the movement goes and the status stays: the check appears without animating,
the compress does not move the button, and both confirmations **hold as a static
wash for the same 500ms**, removed by the same class the animation would have
been. Measured with the preference actually emulated, not assumed —
`EVIDENCE/08-reduced-motion-confirmation.png`, `FACTS.json → frame08`.

---

## 8 · Proof

**Targeted:** `tests/suites/39-save-feedback.test.js`, **91 assertions**, 0
failed. Success sequence · the in-flight guard · the failure path watched at
12ms intervals · the retry after a failure · a second legitimate save · one
toast per save · the 500ms window measured (not asserted from the stylesheet) ·
exact-row confirmation with neighbours clean · a failed rule save marking
nothing · reduced motion · and **the save payload asserted key for key**.

**Full regression:** **39 suites, 3,907 assertions, 0 failed, 0 skipped.**
Side suites unchanged at 172 / 107 / 62 / 15. Total **4,263**, baseline 2,810,
delta **+1,453**. Translation 862 / 100%. PHP lint 7/7.

**Baseline comparison:** the same suite at `3e89713` in a clean worktree —
38 suites, 3,816, 0 failed. `3,907 − 3,816 = 91`, exactly the new suite.

**One intermittent, in a suite this round does not touch**, is recorded in
`UI-POLISH-2A-TEST-RESULTS.md` with its log, its diagnosis and its
**BLOCKED / REQUIRES NEXT ROUND** marking. It was not repaired: that is how
unrelated scope enters a round.

**Evidence:** Contract A / B / C, 23 files, plus a **recording of the actual
interaction** — 6.84s, decoder-verified — and a nine-frame timed strip of the
same save. Every frame asserts
its own figures before it is written and fails the run if they move. Frame 04 —
the one the round turns on — carries the toast, the confirmed region and the
unmarked item rows together, and the toast on it is asserted to be the **save's
own message** rather than a leftover.

---

## 8a · One evidence defect, found on review and repaired

The first package shipped a **truncated recording**. It was 786,432 bytes, it
passed the archive's CRC and its SHA-256, and it was unplayable: the container
carried no Duration element and a decoder stopped 114 frames in with *"File
ended prematurely"*.

The cause was a lifecycle mistake in `tests/ui-polish-2a-shots.js`, not in the
application: the file was copied out of Playwright's temp directory **while the
BrowserContext was still open**, so it was copied before Playwright had
finalised it.

```js
await page.close();
const from = await (await page.video()).path();
fs.copyFileSync(from, to);      // ← copied here, still unfinalised
await ctx.close();              // ← finalised here, too late
```

The repair is the documented order, and nothing else: take the handle while the
page is open, close the page, close the **context** — which is what flushes and
finalises the Matroska — and only then `saveAs()`, which waits for that
finalisation rather than racing it.

**The lesson is the part worth keeping.** A checksum proves the bytes survived
the archive. It says nothing about whether those bytes were a complete recording
when they went in, and this round's own package verification reported thirty-six
green checks over a file that would not play. So the evidence script now **asks a
decoder before the run is allowed to pass**: the container must report a real
duration, the file must demux to the end with no premature-end warning, and
decoding it must yield the frame count its duration promises. A missing decoder
is a failure, not a skip — evidence nothing has decoded is not evidence.

Verified independently of the script, on the packaged copy:

```
Duration: 00:00:06.84   bitrate: 1261 kb/s   vp8 1440x1000 25fps
full decode -> 171 frames, 171 expected, no warnings
```

**No application byte, no CSS, no save timing and no test suite changed for
this.** `git diff cf92f27..HEAD -- '*.php'` and
`-- tests/suites tests/lib` are both empty; the candidate is still `cf92f27`.

---

## 9 · What did not change

The save payload, key for key, asserted in the suite. Pricing, Cost Rate,
Additional Cost, Markup, Previous Price matching and application, weight, DIA,
Size Type, material mapping, Qty, the parser, Quick Add business logic,
quotation numbering and `ref_no` allocation, `GET_LOCK`, the database schema,
authentication, authorization, PDF generation, print logic, WhatsApp item
numbering, accessories carry-over, the accessory-inclusive final price, the
accepted STAGE 1 UI, dark mode, the PHP version.

`REPORTS/DIFF-PROOF.txt` states this as a diff rather than as a promise.

---

## 9a · CONTROL-SYSTEM FOLLOW-UP FINDING — raised at close-out, not repaired

**BLOCKED / REQUIRES NEXT ROUND.** Recorded under the `PROJECT-GUARDRAILS.md`
AUDIT RULE: a finding outside the current round's scope is written down and left
alone.

`tests/tools/check-control.js` validates the control layer against the accepted
state. Its SHA and count pointers are designed to move at each acceptance and
were moved — `cf92f27`, 39 / 3,907 / 4,263 / +1,453, and the five-entry
supersession chain. But several of its assertions were written for the SHAPE of
the STAGE 1 close-out, and that shape is not the shape of every close-out. They
are left exactly as they were, because redesigning a validator is not
bookkeeping.

### What now fails, and why it is not a defect in the accepted state

| assertion | why it fails |
|---|---|
| `the candidate-files block is EMPTY` | STAGE 1 closed by emptying the block. UI POLISH 2A's close-out was told to record the acceptance and leave the implementation contract as written, so the block still names `index.php`. |
| `the promotion carries exactly index.php and companies.php` | STAGE 1 carried both files. UI POLISH 2A carries `index.php` only. |
| `ROUND-SCOPE records DEPLOY = NO` | the string is a literal from STAGE 1's document. This round's ROUND-SCOPE states it as a table row, `\| Deploy \| **NO** \|`. |
| `ROUND-SCOPE records STAGE 2 = NOT STARTED` | a STAGE 1 gate. UI POLISH 2A is not a Stage-2 boundary and states no such line. |

**None of these four indicates anything wrong with the accepted application or
the canonical state.** The facts they were written to protect are all separately
asserted and all pass: no application PHP differs from the accepted commit, no
browser-test byte differs from it, the derived candidate SHA equals the accepted
commit, and canonical records deployment as not approved.

### And one FALSE GREEN, which is the more serious half

```
  ok   ROUND-SCOPE is marked FINAL ACCEPTED / CLOSED
```

That is **not** true of this document. The check is a substring search, and what
it matched is a sentence in the prose section about this very checker:

> `ROUND-SCOPE no longer reads FINAL ACCEPTED / CLOSED — because a candidate round…`

A check that passes on a sentence saying the opposite of what it is checking for
is worth more attention than the four honest failures above it. It is the same
class of defect `check-reports.js` was rebuilt to eliminate — matching text
rather than reading a fact — and it is the reason this finding is recorded rather
than patched in passing.

### What a scoped round should do

Decide whether `check-control.js` is a **per-acceptance snapshot** (re-authored
each time, which is what it is today) or a **round-agnostic control validator**
(reading the expected shape from CANONICAL-STATE the way `check-reports.js`
does). Both are defensible; the file currently sits between them, which is why
it now carries UI POLISH 2A pointers under a header that still describes it as
the STAGE 1 acceptance checker. Whichever is chosen, the substring matching
should go.

Until then: **`check-reports.js` is the round-agnostic gate and it is green at
57 / 0.** `check-control.js` reports 4 shape failures and 1 false green, all
enumerated above, and none of them contradicts a canonical fact.

---

## 10 · Candidate status

**CANDIDATE ONLY — WAITING FOR HUMAN REVIEW.**

`CANONICAL-STATE.md`, `CANONICAL-STATE.json`, `PROJECT-GUARDRAILS.md` and
`tests/tools/authoritative.js` are **not** touched. The accepted commit stays
`3e89713` and the accepted matrix stays 38 / 3,816 / 4,172 until Nicholas
accepts this round, which is its own step.

Nothing deployed. Stage 2 not started. No DB hardening, no `UNIQUE(ref_no)`, no
numbering work, no dark mode, no next polish round.
