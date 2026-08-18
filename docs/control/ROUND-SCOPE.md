# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**UI POLISH 1 — BASELINE RECOVERY / REAPPLY**
Visual Density & Hierarchy

## APPLICATION STATUS

**ACCEPTED.** This is a presentation round on accepted application behaviour.

---

## WHY THIS ROUND EXISTS

An earlier UI POLISH 1 attempt was implemented on the wrong baseline. It was
made from `b549308`, which predates the accepted application commit by 71
commits, and it is **NOT ACCEPTED**:

| | |
|---|---|
| Rejected attempt | `e94fc25370d668bd2c357eb3b0e468ee4f1ba98e` |
| Left where it was | branch `claude/new-session-ok8rwe`, not rewritten, not merged |

Its **screenshots** were reviewed and the visual direction accepted. Its
**implementation** is not reused: it is reapplied here, by hand, against the
real accepted Quick Add.

That attempt reported five accepted features as *"not present in this build"*
and continued anyway — Fast Edit, the selection bar's Apply Previous Price and
Clear Selection, the per-row Pricing Summary, and the single-group Bulk Edit.
All five exist in the accepted source. The report was wrong because the
checkout was wrong.

---

## BASELINE GATE — PASSED BEFORE ANY EDIT

| Check | Evidence |
|---|---|
| Accepted commit exists | `7f5bc977197a658d6d4db995ee2c9bb5e106e21b`, found on `origin/claude/new-session-ofny46` after fetching all remote refs; it was absent from the working clone |
| Accepted commit is an ancestor of HEAD | yes |
| Application source == accepted baseline | `index.php`, `api.php`, `companies.php`, `ai_extract.php`, `auth.php`, `login.php`, `logout.php`, `pricing_history.php`, `manifest.webmanifest`, `php.ini` all byte-identical between `7f5bc97` and the branch head; the later commits touch only `FULL-AUDIT/`, `docs/` and `tests/` |
| Control files existed before this round | all four, added by `e2e9e5d` on the accepted line |
| Fast Edit present | `wqa.edit`, `wqaEditStart/Done/RequestCancel`, `.wqa-ei`, `wqaSyncEditLocks()` |
| Selected Items present | `wqaSetApplyScope`, `wqaToggleRowSel`, `.wqa-pick`, `#wqaSelBar` |
| History present | `wqaHistToggle/Use/More`, `phListHtml`, own / other record counts |
| Previous Price present | the same history panel, plus `.wqa-prov` provenance |
| Full accepted regression found and run | `tests/run.js` over 37 suites → **37 suites, 3,613 assertions, 0 failed** on the untouched source, matching `CANONICAL-STATE.json` exactly |

Work branch: `claude/ui-polish-1-recovery`, cut from the accepted line. The
rejected branch is not rewritten and its history is not merged in.

---

## ALLOWED TO CHANGE

- presentation
- layout
- spacing
- typography
- visual hierarchy
- border / background treatment
- responsive modal sizing
- non-functional row-action styling
- `docs/control/ROUND-SCOPE.md` (this file)
- evidence capture scripts and current evidence screenshots
- the review package

---

## NOT ALLOWED TO CHANGE

business logic · parser · extraction · pricing · weight · DIA · Previous Price
logic · History identity · Qty behaviour · Material / Finish · Size Type rules ·
selection behaviour · Fast Edit behaviour · Bulk Edit behaviour · Details
behaviour · Accessories calculations · database · Add-to-quotation behaviour.

No opportunistic refactoring. No fixes to the recorded N2–N6 observations.

---

## ONE GUARDRAIL INTERACTION, RECORDED RATHER THAN TAKEN SILENTLY

`PROJECT-GUARDRAILS.md` § *ACCEPTED COMPACT ROW* reads:

> Keep DIA beside Size, **the current density**, and the Pricing Summary
> directly under each compact row.

The round brief asks, in §6C, for roughly a **48px** compact row — the density
that was accepted from the previous attempt's screenshots — where the accepted
source sets `min-height:38px`. The two cannot both hold, so this round treats
the brief as the explicit approval the guardrail requires, and changes **only**
that one clause:

- DIA stays beside Size.
- The Pricing Summary stays directly under each compact row.
- Row height moves from 38px to 48px on desktop, and nowhere else.

If that is not what was intended, this is the line to reverse, and it is one
CSS declaration.

`PROJECT-GUARDRAILS.md`, `CANONICAL-STATE.md` and `CANONICAL-STATE.json` are
**not** modified by this round.

---

## STOP CONDITION

- the full accepted regression passes at or above the canonical counts, with
  zero failures and zero skips
- protected application behaviour is proven unchanged
- the required screenshot evidence is captured on 10–20 realistic rows
- ONE `QUOTATION-DNC-REVIEW.zip` is built and independently verified after
  extraction
- **no accepted feature has disappeared to make the UI cleaner**

Then STOP. Do not start UI POLISH 2. Do not deploy.
