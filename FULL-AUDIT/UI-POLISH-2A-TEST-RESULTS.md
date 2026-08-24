# UI POLISH 2A — TEST RESULTS

**These are the CANDIDATE's figures**, measured on the tree this round proposes.

`docs/control/CANONICAL-STATE.json` still reads the accepted STAGE 1 state —
`3e89713`, 38 suites, 3,816 browser, 4,172 in all — and is **deliberately
untouched**: UI POLISH 2A has not been accepted, so canonical has not moved.
Canonical moves when Nicholas accepts, as its own step. For the accepted figures
read `FULL-AUDIT/TEST-RESULTS.md` and `docs/control/CANONICAL-STATE.md`.

> **On SHAs.** `3e89713400b5bcfceca31d2c074de17411169d1b` is the ACCEPTED
> application and has not moved. The candidate measured below is derived from
> the file `docs/control/ROUND-SCOPE.md` declares, and is named in
> `REPORTS/DIFF-PROOF.txt`.

---

## By group — measured

| Group | Suites | Assertions | Failed |
|---|---:|---:|---:|
| Browser suites (`node tests/run.js`) | 39 | **3,907** | **0** |
| Pricing-history PHP (`tests/php/pricing_history.test.php`) | 1 | **172** | **0** |
| AI extraction PHP (`tests/php/ai_extract.test.php`) | 1 | **107** | **0** |
| Pricing workbook (`tests/tools/check-pricing-workbook.py`) | 1 | **62** | **0** |
| Translation coverage (`tests/tools/check-translations.js`) | 1 | **15** | **0** |

## TOTAL

| | |
|---|---:|
| **TOTAL ASSERTIONS** | **4,263** |
| **TOTAL FAILED** | **0** |
| **SKIPPED** | **0** |

| | |
|---|---:|
| Baseline | 2,810 assertions |
| Candidate | 4,263 assertions |
| Delta | **+1,453 assertions** |

**Arithmetic, reconciled to the logs by name:**

```
  3,907   browser            LOGS/browser-suite.log · browser-suite.json
+   172   pricing / history  LOGS/pricing-history-php.log
+   107   AI extraction      LOGS/ai-extract-php.log
+    62   workbook           LOGS/pricing-workbook.log
+    15   translation        LOGS/translation-coverage.log
= 4,263   candidate total

  4,263 - 2,810 = 1,453
```

The whole of this round's growth is **one suite**:
`39-save-feedback.test.js`, **91 assertions**. The thirty-eight suites that
existed before it are unchanged, assertion for assertion, and so are all four
side groups — 172 / 107 / 62 / 15 did not move, because nothing this round
touched is in their path.

**Translation: 862 keys, 100%, 0 missing, 0 hard-coded, 0 unapplied** —
unchanged. This round added no string and removed none; the check is a glyph.

**PHP lint: 7 of 7 clean.**

---

## The baseline, run for comparison

`LOGS/baseline-3e89713-run.log` is the SAME suite run at the accepted commit in
a clean worktree: **38 suites, 3,816 assertions, 0 failed.** So the candidate is
the accepted matrix plus one suite, and nothing else moved:

```
  3,907 - 3,816 = 91   =  the new suite, exactly
```

---

## One intermittent, recorded rather than buried

The FIRST full run on the candidate tree reported **1 failure**, in a suite this
round does not touch:

```
[fast edit — one state, and everything it holds still]
  O: clearing it back to the default lets the session close
  expected: "true"   actual: "false"
```

That run is kept at `LOGS/browser-suite-earlier-intermittent.log` rather than
deleted, because deleting it would be the dishonest option.

What was established, and what was not:

| | |
|---|---|
| suite 35 alone, candidate tree | **passes** (77 assertions) |
| full run at the accepted commit `3e89713` | **passes** (38 / 3,816 / 0) |
| full run on the candidate tree, twice more | **passes** (39 / 3,907 / 0 both times) |

**It is a load-sensitive race in the TEST, not a defect this round introduced,
and not one this round repaired.** `35-edit-mode.test.js` types into a cell and
waits a fixed 600ms for a debounced commit before calling `wqaEditDone()`; under
a loaded machine that wait can be short. The helper it uses, `typeCell`, is
**byte-identical to the accepted commit** — this round does not touch
`tests/suites/`, Quick Add, or anything in that path.

Per `PROJECT-GUARDRAILS.md` AUDIT RULE, a finding outside the current
ROUND-SCOPE is recorded and **not** repaired:

> **BLOCKED / REQUIRES NEXT ROUND** — `35-edit-mode.test.js` section O uses a
> fixed 600ms wait where it should wait for the committed value. A fix belongs
> to a round scoped for test robustness. It was not repaired here, because
> "make the unrelated red thing green" is how unrelated scope enters a round.

The figures reported above are from a run in which every suite passed, on the
exact tree this package ships.
