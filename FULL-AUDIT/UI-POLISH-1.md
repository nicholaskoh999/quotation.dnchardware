# UI POLISH 1 — BASELINE RECOVERY / REAPPLY

**Round:** UI POLISH 1 — Baseline Recovery / Reapply · Visual Density & Hierarchy
**Application status:** ACCEPTED baseline, with a **candidate** presentation change
**Deploy:** NO
**Scope:** presentation only. See `docs/control/ROUND-SCOPE.md`.

---

## 1 · Why this round exists

An earlier UI POLISH 1 attempt was built on the wrong baseline — `b549308`,
which predates the accepted application commit by 71 commits. Its screenshots
were reviewed and the visual direction accepted; its implementation was not.

That attempt reported five accepted features as *"not present in this build"*
and carried on regardless: Fast Edit, the selection bar's Apply Previous Price
and Clear Selection, the per-row Pricing Summary, and the single-group Bulk
Edit. **All five exist in the accepted source.** The report was wrong because
the checkout was wrong, and continuing past that was the error, not the
missing features.

| | |
|---|---|
| Rejected attempt | `e94fc25370d668bd2c357eb3b0e468ee4f1ba98e` |
| Left untouched on | `claude/new-session-ok8rwe` — not rewritten, not merged, not cherry-picked |
| This round | reapplied by hand onto the accepted source |

## 2 · Baseline gate, passed before any file was edited

| Check | Evidence |
|---|---|
| Accepted commit exists | `7f5bc977197a658d6d4db995ee2c9bb5e106e21b` — the accepted commit at the time this round opened, superseded by `e3d659b` when the round was accepted. It was **absent from the working clone**; fetching all remote refs found it on `origin/claude/new-session-ofny46` |
| It is an ancestor of the work | yes |
| Application source == accepted baseline | `index.php`, `api.php`, `companies.php`, `ai_extract.php`, `auth.php`, `login.php`, `logout.php`, `pricing_history.php`, `manifest.webmanifest`, `php.ini` — all byte-identical between `7f5bc97` and the branch head this round started from. The commits between them touch only `FULL-AUDIT/`, `docs/` and `tests/` |
| Control files pre-existed | all four, added by `e2e9e5d`, read before implementation |
| Fast Edit | `wqa.edit`, `wqaEditStart` / `wqaEditDone` / `wqaEditRequestCancel`, `.wqa-ei` cells, `wqaSyncEditLocks()` |
| Selected Items | `wqaSetApplyScope`, `wqaToggleRowSel`, `.wqa-pick`, `#wqaSelBar` |
| History | `wqaHistToggle` / `wqaHistUse` / `wqaHistMore`, `phListHtml`, own / other counts |
| Previous Price | the same panel, plus `.wqa-prov` provenance chips |
| Full accepted regression, on the untouched source | **37 suites, 3,613 assertions, 0 failed** — matching `CANONICAL-STATE.json` before a single edit |

## 3 · What changed

**`index.php` only, and inside the stylesheet only** — every diff hunk falls
above `</style>`. No PHP, no markup, no script, no test.

### Wider panel, and the table spends it
`@media (min-width:1200px)`: the panel takes `min(1360px, 100vw − 64px)`
instead of a flat 900px, and the extra width goes into the tracks the values
live in rather than into the slack column. Written as `min()`, so there is no
width at which it can exceed the screen. **Below 1200px nothing moved.**

### The item got shorter while the row got taller
The pricing summary under every row was wrapping onto a second line purely for
want of horizontal room. Given the room, it fits on one:

| measured at 1600×1000 | before | after |
|---|---:|---:|
| panel width | 900px | **1360px** |
| compact data line | 38px | **46px** |
| metadata under a row | 38px | **21px** |
| a whole clean item | 84px | **67px** |

### Fewer boxes
- The four sections inside the open Bulk Edit body were bordered cards inside a
  bordered group. They are surfaces on one workspace now; the group keeps its
  accent edge, so shut is quiet and open is plainly active.
- The previous-price panel is a tinted band with one coloured left edge instead
  of a full outline — exact, similar and none still read at a glance.
- `1.5px` surface borders became `1px`.

### Hierarchy
- **Price** is the strongest thing on the line by weight and size rather than by
  colour. Accent blue there competed with Details, History and every provenance
  chip beside it, and a price is not a link.
- Dimensions and Qty moved 800 → 700, one step under Price.
- Metadata — Size Type, the pricing summary, the `PRICING` label — is quieter
  and still perfectly legible.
- **Delete** rests quieter than Details and History, and turns full red the
  moment it is pointed at.

### One selected count
Ticking a row printed `N selected` twice: once in the Bulk Edit bar and again
in the selection bar directly beneath it. The selection bar keeps it, because
it is the one carrying the actions. Presentation only — the node, the state and
every count behind them are untouched.

## 4 · The 46px question, answered by the accepted suite

The brief asked for roughly a 48px compact row. The accepted regression pins
that row at **≤ 46px** in two independent places:

```
tests/suites/17-quickadd-layout.test.js:119   clean.sumHeight <= 46
tests/suites/34-row-meta.test.js:90           rowH        <= 46
```

46px was used. It is inside "approximately 48", it is a 21% increase over the
38px the source had, and **no accepted test was modified to accommodate it.**
Nicholas approved 46px explicitly, with no further increase.

## 5 · Regression

Run in full, on the changed source, with nothing skipped.

| group | suites | assertions | failed |
|---|---:|---:|---:|
| Browser (`tests/run.js`) | 37 | 3,613 | 0 |
| Pricing-history PHP | 1 | 161 | 0 |
| AI extraction PHP | 1 | 107 | 0 |
| Pricing workbook | 1 | 62 | 0 |
| Translation coverage | 1 | 15 | 0 |
| **Total** | **41** | **3,958** | **0** |

Skipped: **0**.

Against the **accepted regression state** (37 / 3,613 / 3,958) this round's
delta is **0**: it adds no tests and removes none, so the canonical
`BASELINE 2,810 → DELTA +1,148 → TOTAL 3,958` arithmetic is untouched and every
figure above is the canonical one, re-measured rather than restated.

Translation: 862 keys, 100%, 0 missing, 0 hard-coded, 0 unapplied.

## 6 · How the candidate was declared, and how it closed

While this round was under review, `tests/tools/verify-package.js` compared
every shipped PHP file against the then-accepted commit, and `index.php`
differed — as it should have. That is the honest signature of a candidate
awaiting acceptance, and it was reported rather than hidden: the round declared
`index.php` by name in `ROUND-SCOPE.md`, so a declared proposal could be told
apart from an unnoticed drift, and an undeclared file still failed.

Throughout the review, `CANONICAL-STATE.md`, `CANONICAL-STATE.json`,
`PROJECT-GUARDRAILS.md` and `tests/tools/authoritative.js` were left untouched.
Making that line green by moving the accepted SHA would have asserted that the
round was already accepted, which is the one thing a review package must not
do.

**UI POLISH 1 is now FINAL ACCEPTED.** The accepted application commit moved to
`e3d659bba1636cd4cfc74cb89be1b52cf92aff67` as its own deliberate step, the
candidate declaration is closed and empty, and the shipped application is once
again byte-identical to the accepted commit — with no exception declared and
none needed.

## 7 · Guardrail interaction, recorded rather than taken quietly

`PROJECT-GUARDRAILS.md` § *ACCEPTED COMPACT ROW* says to keep DIA beside Size,
**the current density**, and the Pricing Summary directly under each compact
row. This round changes the density clause only, on Nicholas's explicit
instruction, from 38px to 46px. DIA has not moved. The Pricing Summary has not
moved. Everything else in that guardrail stands.

## 8 · Observed, not fixed

**430px — the `APPLY TO:` label is clipped** at the right edge of the Bulk Edit
bar. It is clipped identically on the untouched accepted source (compare
`EVIDENCE/ui-polish-1/before/11e-phone-430.png` with `after/11e-phone-430.png`),
so it is pre-existing and outside this round. Recorded on instruction; not
repaired here.

**≤599px — the price wraps with the actions** rather than sitting at the end of
the data line, because it is now 13.5px. The row occupies the same two lines it
occupied before; nothing is clipped and no action moved.

## 9 · Self-review

| | |
|---|---|
| Is the panel genuinely wider? | 900 → 1360px at 1600, 1302 at 1366, 1216 at 1280 |
| Did border noise decrease? | four cards inside the Bulk Edit group gone; the history outline gone; surface borders halved |
| Can Size / DIA / L / TL / Qty / Weight / Price be scanned? | one weight ladder, Price on top, wider tracks |
| Are secondary fields quieter? | metadata 11 → 10.5px, the `PRICING` label no longer accent-blue |
| Are 10–20 rows still operationally compact? | a clean item costs 67px where it cost 84 |
| Is Bulk Edit quiet shut, obvious open? | yes — see frames 04 and 05 |
| Does the full accepted toolbar still fit? | yes — count, Edit, VIEW pair, Bulk Edit, APPLY TO, all present at every width tested |
| Is Fast Edit distinguishable? | yes — frame 03: Done / Cancel, every cell an input, Expanded locked, Add held |
| Is the selected count clear and non-duplicated? | one location, frame 06 |
| Are Details / History / Delete well spaced? | yes, with Delete lower priority at rest |
| **Did any accepted feature disappear?** | **No.** Every control in the before frames is in the after frames |
