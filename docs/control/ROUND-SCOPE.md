# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**STAGE 1 — FINAL UI CLEANUP · FINAL ACCEPTED / CLOSED**

Presentation only. No business rule, no formula, no generated customer data.

Nicholas / ChatGPT reviewed the implementation, the visual evidence, the
regression and the candidate package, and **accepted** them. This file is now
the record of a closed round, not a licence to change anything.

| | |
|---|---|
| Round status | **FINAL ACCEPTED / CLOSED** |
| Accepted application commit | `3e89713400b5bcfceca31d2c074de17411169d1b` |
| Previous accepted commit | `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac` — superseded by STAGE 1 |
| Deploy | **NO** |
| Stage 2 | **NOT STARTED** |

---

## THE PROOF THE PROMOTION RESTS ON

Written before the bookkeeping, from Git rather than from assertion. The
candidate SHA is **derived** from the files this round declared — it was never
asserted, and it is not HEAD.

```
git merge-base --is-ancestor 98a31e3 3e89713      →  0   (98a31e3 is an ancestor)

git log -1 --format=%H 98a31e3..HEAD -- index.php companies.php
        →  3e89713400b5bcfceca31d2c074de17411169d1b
           the last commit touching the two files ```candidate-files``` declared,
           so 3e89713 IS the Stage 1 application candidate, derived not claimed

git diff --name-only 98a31e3..3e89713 -- '*.php'
        →  index.php  companies.php          (and nothing else)

git diff --name-only 3e89713..HEAD -- '*.php'                →  (empty)
git diff --name-only 3e89713..HEAD -- tests/suites tests/lib →  (empty)
```

The only commits after `3e89713` are `ff39782`, `7ff14df` and `f132254`, which
carry reports, evidence, control files and packaging. **No application PHP byte
and no browser-test byte moved between the reviewed candidate run and this
promotion**, which is why the matrix below was promoted as measured and not
re-run — re-running it could only have produced the same numbers from a
different tree state, which is a weaker fact, not a stronger one.

---

## WHAT WAS ACCEPTED

| | |
|---|---|
| 430px APPLY TO | **repaired** — the label and its scope buttons stay together |
| Companies mobile | **repaired** — tap targets at 44px+, desk sizes unmoved |
| Print / PDF A4 layout | **repaired** — a professional quotation, not a table dump |
| Numbering identity | **verified**, Screen / Print / WhatsApp consistent |
| Numbering ORDER | **DEFERRED to Stage 2** — verified and left alone |
| Dark mode | **DEFERRED to Stage 2** — it does not exist to polish |

The accepted outcomes are written into `PROJECT-GUARDRAILS.md` under **STAGE 1
UI**, and the two deferrals under **DEFERRED TO STAGE 2**. From here they are
protected exactly as the pricing engine and the accessory rule are.

**The deferrals were not converted into changes.** Nothing about dark mode and
nothing about numbering ORDER was implemented, and neither may be treated as
accepted behaviour.

---

## ACCEPTED MATRIX

Measured on `3e89713`, promoted unchanged, and authoritative in
`docs/control/CANONICAL-STATE.json`.

| | |
|---|---:|
| Browser suites | 38 |
| Browser assertions | 3,816 |
| Pricing / History · AI Extraction · Workbook · Translation | 172 · 107 · 62 · 15 |
| **Total assertions** | **4,172** |
| Failed / Skipped | 0 / 0 |
| Baseline | 2,810 |
| Delta | **+1,362** |
| Translation keys / coverage | 862 / 100% |

The whole of the growth is one added suite — *phone widths — the scope label,
the tap targets, and the desk left alone* (102 assertions). The thirty-seven
suites that existed before this round are unchanged, assertion for assertion.

---

## ALLOWED TO CHANGE

```candidate-files
```

**The block is empty, and empty means what it has always meant: nothing may
differ from the accepted application commit.**

`3e89713` is now that commit. Any `*.php` difference from it is undeclared drift
and fails the consistency check by name, loudly, until a new round declares it
here first.

---

## NOT ALLOWED TO CHANGE

Everything under PROTECTED / ACCEPTED AREAS in `PROJECT-GUARDRAILS.md`, which
this round's outcomes have now joined:

parser · extraction · AI extraction semantics · pricing formulas · **the
accessory-inclusive final price** · weight · DIA · Previous Price matching and
reuse · History identity and ordering · Qty and default Qty · Material · Finish
· Size Type · selection behaviour · Fast Edit · Bulk Edit · Details · database
and save semantics · Add-to-quotation behaviour · translation semantics ·
**the accepted STAGE 1 narrow-width scope control, Companies mobile targets and
print / PDF A4 layout** · **item numbering identity on every surface**.

---

## STATE

- **STAGE 1 — FINAL ACCEPTED / CLOSED**
- **DEPLOY = NO**
- **STAGE 2 = NOT STARTED**

A new round begins by rewriting this file — the round, the goals, and a
```candidate-files``` block naming what it may touch — **before** any application
byte changes. Not after.
