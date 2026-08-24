# README — REVIEW

**Round:**
UI POLISH 2A

**Goal:**
Save success micro-interaction

**Implementation:**
**PASS**

**Targeted tests:**
`tests/suites/39-save-feedback.test.js` — **91 assertions, 0 failed.**
The success sequence; the in-flight guard (four clicks in one request window →
one POST); the failure path sampled every 12ms so "never appeared" is a
measurement rather than an absence of looking; the retry after a failure; a
second legitimate save; one toast per save; the ~500ms window measured from the
running page rather than read off the stylesheet; exact-row confirmation with
its neighbours clean; a failed rule save marking nothing; reduced motion with
the preference actually emulated; and the save payload asserted key for key.

**Full regression:**
**39 suites · 3,907 browser assertions · 0 failed · 0 skipped.**
Side suites unchanged: pricing/history 172, AI extraction 107, workbook 62,
translation 15. **Total 4,263**, baseline 2,810, delta **+1,453**.
Translation 862 keys / 100%. PHP lint 7 of 7 clean.

Baseline comparison, same suite at the accepted commit in a clean worktree:
**38 suites, 3,816, 0 failed.** `3,907 − 3,816 = 91`, exactly the new suite.

**Baseline SHA:**
`3e89713400b5bcfceca31d2c074de17411169d1b` — the accepted application,
unchanged by this round.

**Candidate SHA:**
`cf92f27feb629134a61801dc120eba79c54fb5f6`
Derived from the file `docs/control/ROUND-SCOPE.md` declares, not asserted.

**Files changed:**

| file | why |
|---|---|
| `index.php` | the application change, and the only one: the CSS states, one shared post-`res.ok` helper, the in-flight guard, ids on three Save buttons, `data-rule-id` on the rule rows |
| `tests/suites/39-save-feedback.test.js` | NEW — the targeted suite |
| `tests/lib/harness.js` | one optional parameter, so the evidence run can record video of the same page the suites drive. No test behaviour changes |
| `tests/ui-polish-2a-shots.js` | NEW — the evidence script |
| `tests/tools/build-ui-polish-2a-zip.js` | NEW — this package's builder |
| `docs/control/ROUND-SCOPE.md` | written before any application byte; amended before implementation on review |

Full statement, as diffs rather than promises: `REPORTS/DIFF-PROOF.txt`.

**What to look at first**

1. `EVIDENCE/04-toast-and-quotation-confirmation.png` — the frame the round
   turns on. Toast, the ~500ms confirmation on the quotation-level region, and
   **0 of 3 item rows singled out**, in one frame.
2. `EVIDENCE/00-quotation-save-interaction.webm` — the whole interaction. If
   you have no player, `strip-000ms` … `strip-900ms` is the same save as nine
   timed frames.
3. `EVIDENCE/06-exact-row-confirmed.png` — the OTHER semantics. Rule 202
   confirmed, 101 and 303 clean. **This proves the row behaviour of the
   row-specific save. It is not evidence about the quotation save.**
4. `EVIDENCE/07-failed-save-no-success-visuals.png` — 129 samples, zero checks,
   zero confirmations, zero value pulses, button restored, existing error text.
5. `EVIDENCE/02a-button-at-rest` vs `02b-button-compressed` — the same
   rectangle. 296px of layout either way; 288.3px painted while in flight.

**Known issues:**

**One intermittent, in a suite this round does not touch.** The first full run
reported 1 failure in `35-edit-mode.test.js` section O. Suite 35 passes alone
on the candidate; the full run passes at the accepted commit; the full run
passes twice more on the candidate. It is a load-sensitive race in the TEST — a
fixed 600ms wait for a debounced commit — in a helper that is byte-identical to
the accepted commit. Recorded, with its log, as
**BLOCKED / REQUIRES NEXT ROUND**, and deliberately **not** repaired: fixing an
unrelated red thing is how unrelated scope enters a round. Details and the log:
`REPORTS/TEST-RESULTS.md`, `LOGS/browser-suite-earlier-intermittent.log`.

**Two things raised for your decision, not decided here.**

- The accepted 1s `.qi-item.row-new` add-item flash was **left untouched**. It
  fires on a client-side array change with no request, and it signals a
  different event from the one this round signals. If you would rather the two
  row languages unify at 500ms, that is a one-line change — but it alters UI
  POLISH 1 behaviour, so it is your call, not mine.
- The dialog now holds **200ms** after the check before closing, so the check
  can be seen. Everything else runs immediately; only the visual close is
  deferred. If that reads as slow, it is one constant.

**Deployment:**
**NOT DEPLOYED**

**Acceptance:**
**CANDIDATE ONLY — WAITING FOR HUMAN REVIEW**

`CANONICAL-STATE.md`, `CANONICAL-STATE.json`, `PROJECT-GUARDRAILS.md` and
`tests/tools/authoritative.js` are untouched. The accepted commit stays
`3e89713` and the accepted matrix stays 38 / 3,816 / 4,172 until you accept
this round, which is its own step.
