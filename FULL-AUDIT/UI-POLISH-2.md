# UI POLISH 2 — INTERACTION / MICRO UX POLISH

**Round:** UI POLISH 2 — Interaction / Micro UX Polish — **FINAL ACCEPTED**
**Continues from:** UI POLISH 1 — accepted at `e3d659b`, now the previous accepted commit
**Application status:** **ACCEPTED** at `33ae0da14a3bd3108e8b066d4796b1bcda2de428`
**Deploy:** NO
**Scope:** `docs/control/ROUND-SCOPE.md`

---

## 1 · Baseline gate, passed before any edit

| Check | Evidence |
|---|---|
| Accepted commit | `e3d659bba1636cd4cfc74cb89be1b52cf92aff67` — the commit accepted when this round opened, an ancestor of HEAD and of the commit that now supersedes it |
| Canonical and authoritative agree | `CANONICAL-STATE.json` and `tests/tools/authoritative.js` both read it |
| No application php differed from it at the start | `git diff --name-only e3d659b..HEAD -- '*.php'` → empty |
| Control files present, read, not reconstructed | all four |
| Fast Edit · Bulk Edit · Compact/Expanded · Selected Items · Details · History · Previous Price · Add-to-quotation · zero-selected protection | all present |

## 2 · What changed

**`index.php` only, and one contained block at the end of the stylesheet.**
156 lines added, 0 removed. Every diff hunk falls above `</style>`. No PHP, no
markup, no script, no test.

It answers four questions a person asks without noticing: *can I click this,
am I on it, is it doing something, is it switched off.*

| Area | Change |
|---|---|
| **Focus** | One ring, at `--accent` with a soft halo, on every interactive control in the dialog. Two controls had none at all: the row tick box, and the compact row itself — which is a `role="button"` with a tab stop, so it was reachable by keyboard and showed nothing for it. |
| **Row actions** | Hovering a row tinted the whole line, which left Details and History nowhere to go: the strongest thing under the pointer was the row, so the button being aimed at looked inert. The row keeps its tint at half strength; the control under the cursor is now what changes most. |
| **Delete** | Quietest control on the row at rest, unmistakable the moment it is aimed at — and reaching it by keyboard says the same thing as reaching it by mouse. |
| **Disabled** | Fast Edit disables Delete and the history controls, and a dimmed control that still lifted and recoloured under the pointer read as broken rather than held. They stop responding, and the cursor says why. |
| **Fast Edit** | Everything needed was already on screen; nothing said *you are inside something*. The Done/Cancel cluster takes a tinted band with a marker down its leading edge for as long as the session is open, and the table it edits picks up the same accent on its own border. Colour only — no size, no position, no reflow. |
| **Selection** | The row already carried the accent and the marker but arrived by snapping, so ticking six rows read as six unrelated repaints. The scope bar now carries the same leading marker the open Bulk Edit body does. |
| **Segmented controls** | Compact / Expanded and All / Selected Items are one component, and it is a view and a scope — never a primary action. The chosen segment sits in a raised filled cell rather than merely being tinted. |
| **Bulk Edit headers** | A hover that moved only the border colour was easy to miss on a header the width of the dialog. The surface answers now, and the open header keeps a marker. |
| **Details / History** | An open panel could read as belonging to the row above it. The open row carries a quiet marker while its panel shows — the same device selection uses, in the neutral tone, so the two are readable side by side. |
| **Previous Price** | Provenance gains states without gaining weight. It is a note about where a number came from, not a call to action. |
| **Primary CTA** | Add stays the one filled control. Held back, it stops looking pressable at all: no lift, no shadow, no pointer. |
| **Motion** | Uses the sheet's existing `--mo-fast` / `--mo` tokens — 140–180ms — and nothing else. |

## 3 · Regression

Run in full, on the changed source. **No accepted test was modified.**

| group | suites | assertions | failed |
|---|---:|---:|---:|
| Browser (`tests/run.js`) | 37 | 3,613 | 0 |
| Pricing-history PHP | 1 | 161 | 0 |
| AI extraction PHP | 1 | 107 | 0 |
| Pricing workbook | 1 | 62 | 0 |
| Translation coverage | 1 | 15 | 0 |
| **Total** | **41** | **3,958** | **0** |

Skipped: **0**. Translation: 862 keys, 100%, 0 missing, 0 hard-coded, 0 unapplied.
Delta against the accepted state: **0** — this round adds no tests and removes none.

## 4 · Reduced motion, and a mistake worth recording

Every transition added here is neutralised by the sheet's global
`prefers-reduced-motion` rule. That is measured, not assumed: with the
preference emulated, all six sampled controls report a computed
`transition-duration` of `1e-06s` (`EVIDENCE/ui-polish-2/after/17-reduced-motion.json`).

The first attempt at that evidence was wrong. The test harness builds its page
with `browser.newPage({viewport})` and forwards nothing else, so a
context-level `reducedMotion` option was silently dropped — the frame reported
full 140–180ms durations while claiming to be reduced-motion evidence. It is
now asked of the page directly with `emulateMedia`, which cannot be ignored.
The same pass caught frame 14 claiming a disabled CTA on a list where the
accepted rule keeps it enabled; that frame now uses a list where every row is
genuinely blocked, and the script fails the run if the button is not disabled.

## 5 · Self-review

| | |
|---|---|
| Can I tell what is clickable? | Yes — one focus ring, and hover now belongs to the control rather than the row |
| Can I tell what is active? | Yes — open headers, the chosen segment and the editing mode all carry a marker |
| Does Fast Edit feel like a mode? | Yes — frame 03: the banded toolbar, the ringed table, the held row actions |
| Does Selected Items feel selected? | Yes — frame 06: tick, tint and leading marker as one statement |
| Do Compact / Expanded feel like view controls? | Yes — a raised segment in a segmented well, not a filled button |
| Is Bulk Edit open/close clearer? | Yes — the surface answers hover, the open header is marked |
| Are Details / History still secondary? | Yes — outlined pills, unchanged in weight |
| Does Delete stay quiet? | Yes, until hovered or focused |
| Is Add obviously primary? | Yes, and obviously unusable when held — frame 14 |
| Is motion subtle? | 140–180ms, colour and shadow only, no movement that shifts layout |
| **Did any interaction behaviour change?** | **No.** 3,958 assertions, 0 failed, no test touched |

## 6 · Recorded, not fixed

Out of scope by instruction and untouched: dark mode, accessories carry-over,
Print/WhatsApp item numbering, Companies mobile polish, the **430px `APPLY TO`
clipping**, PHP 8.2, the DB UNIQUE deployment.

## 7 · Three commits, and which is which

| | |
|---|---|
| **Previous accepted commit** | `e3d659bba1636cd4cfc74cb89be1b52cf92aff67` — the baseline this round opened on, superseded by acceptance |
| **Accepted application commit** | `33ae0da14a3bd3108e8b066d4796b1bcda2de428` — the only commit since that baseline that touches an application file, and now canonical |
| **Package HEAD** | the commit the archive was built from; it sits after the application commit, carrying evidence, reports, packaging tooling and bookkeeping only |

Proven from the history of the file itself, not from the branch tip:

```
git merge-base --is-ancestor e3d659b 33ae0da   →  0   (e3d659b is an ancestor)
git log --oneline e3d659b..HEAD -- index.php   →  33ae0da   (and nothing else)
git log --oneline e3d659b..HEAD -- '*.php'     →  33ae0da   (and nothing else)
git show --stat 33ae0da -- '*.php'             →  index.php | 156 +++ (1 file)
git rev-parse 33ae0da:index.php                →  5d764b57353650853a7c14dfc807c55730cb8db4
git rev-parse HEAD:index.php                   →  5d764b57353650853a7c14dfc807c55730cb8db4
git diff --name-only 33ae0da..HEAD -- '*.php'  →  (empty)
git diff --name-only 33ae0da..HEAD -- tests/suites tests/lib   →  (empty)
```

**The 37 / 3,613 / 3,958 regression was measured on this tree** (`33ae0da`), and
that tree is now the accepted one — so for the first time in this round the
measured tree and the accepted tree are the same object. Nothing was re-run to
achieve that, and nothing needed to be: no application byte and no test byte
moved between the reviewed candidate and this promotion.

While the round was under review, `MANIFEST.txt` and `COMMIT-INFO.txt` had to
name the accepted commit and the candidate separately, because the figures
belonged to the candidate and the accepted wording — *"the last commit that
changed application code"*, *"every figure was measured against it"* — would
have credited a tree that never had the run. Both are generated. With the
candidate declaration closed, both now emit the plain accepted-state header
again, and that header is true.

## 8 · Accepted status

**UI POLISH 2 is FINAL ACCEPTED.** Nicholas accepted the round; the acceptance
was recorded as its own step, over a tree that did not move:

| | |
|---|---|
| `docs/control/CANONICAL-STATE.md` | accepted commit → `33ae0da`, accepted round → UI POLISH 2, `e3d659b` recorded under SUPERSEDED VALUES |
| `docs/control/CANONICAL-STATE.json` | the same, and a `supersededApplicationCommits` entry stating `e3d659b → 33ae0da` and why |
| `tests/tools/authoritative.js` | `APP_SHA` → `33ae0da` |
| `docs/control/ROUND-SCOPE.md` | the `candidate-files` block emptied — `index.php` is no longer excused, and any drift from `33ae0da` fails again |
| this report and the reports beside it | current SHA moved; `e3d659b` kept only on lines that label it superseded |

No browser regression was re-run for this acceptance, deliberately. The
candidate tree and the accepted tree are the same bytes; a rerun would have
produced the same 3,958 assertions from the same source and proved nothing the
recorded run has not already proved. Test counts, translation counts and finding
counts are therefore unchanged — the acceptance moved a pointer, not a
measurement.

The shipped application is once again byte-identical to the accepted commit,
with no exception declared and none needed.
