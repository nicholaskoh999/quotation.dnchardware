# QUOTATION.DNC — CANONICAL STATE

**IMPORTANT.** These values are authoritative for the current accepted
application and package state.

Reports must **not** derive expected values from other reports. Reports are
outputs being validated, not sources of truth. Checkers must read
`CANONICAL-STATE.json` as machine-readable truth.

> Why this file exists: the consistency checker false-greened four rounds
> running, and the root cause was always the same — it worked out what to
> expect from the same documents it was checking, so a number that was wrong
> everywhere agreed with itself and passed. Truth now lives outside the things
> being checked.

---

## APPLICATION

| | |
|---|---|
| Accepted application commit | `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac` |
| Application status | **ACCEPTED** |
| Accepted round | STAGE 0B — Accessory-Inclusive Final Unit Price, **FINAL ACCEPTED** |

The accepted commit moved because STAGE 0B was accepted, and for no other
reason. It is `98a31e3` because that is the last commit that changed an
application file — proven from the files, not from a branch tip:

```
git merge-base --is-ancestor 33ae0da 98a31e3    →  0   (33ae0da is an ancestor)
git log 33ae0da..HEAD -- '*.php'                →  98a31e3   (nothing else)
git diff --name-only 33ae0da..98a31e3 -- '*.php'
        →  index.php  companies.php  pricing_history.php
           tests/php/pricing_history.test.php   (a test, declared as such)
git diff --name-only 98a31e3..HEAD -- '*.php'   →  (empty)
```

`api.php`, `ai_extract.php`, `auth.php`, `login.php` and `logout.php` are
byte-identical to the commit before it. Every commit after `98a31e3` carries
reports, control files and packaging, and changes no application byte.

**This one is not presentation.** UI POLISH 1 and UI POLISH 2 changed how the
application looked; STAGE 0B changed what it charges. The accepted business rule
it carries is written into `PROJECT-GUARDRAILS.md` under *ACCESSORIES*, and is
protected from here exactly as the pricing engine and the Previous Price rules
are.

Acceptance was bookkeeping over a tree that did not move: no application or test
byte changed between the reviewed candidate and this promotion, so the
4,070-assertion matrix below stands exactly as measured on `98a31e3` and was not
re-run to promote it.

---

## TESTS

| | |
|---|---:|
| Baseline assertions | 2,810 |
| Current final assertions | **4,070** |
| Delta | **+1,260** |
| Failed | 0 |
| Skipped | 0 |
| Browser suites | 37 |
| Browser assertions | 3,714 |

Other accepted assertion groups:

| | |
|---|---:|
| Pricing / History | 172 |
| AI Extraction / Parser | 107 |
| Workbook | 62 |
| Translation | 15 |

**Arithmetic, which the checker performs itself rather than trusting:**

```
  3,714   browser
+   172   pricing / history
+   107   AI extraction / parser
+    62   workbook
+    15   translation
= 4,070   final

  4,070 - 2,810 = 1,260
```

The browser matrix grew by 101 and the pricing-history PHP suite by 11, both in
STAGE 0B: the accessory suite was reframed around the rule that replaced the one
it protected and grew from 41 assertions to 127, and the company, history and
plate suites gained the cases the new rule needed. No suite was removed and no
coverage was dropped.

---

## TRANSLATION

| | |
|---|---:|
| Keys | **862** |
| Coverage | **100%** |
| Missing | 0 |
| Hard-coded | 0 |
| Unapplied | 0 |

---

## FINDINGS

| | |
|---|---:|
| P1 | **13** |
| P2 | **24** |
| P3 | **2** |
| **Total** | **39** |

All 39 finding entries are repaired / closed according to the current accepted
audit state.

**5 additional observations remain recorded but were not changed by design:**
N2, N3, N4, N5, N6.

**N1 is not included, because it was resolved by F7.** It describes behaviour
that F7 repaired, so counting it among the unrepaired would be counting a fixed
defect twice.

This must not be presented as *"39 repaired + 6 unresolved bugs."* The five are
observations with stated reasons — a parser scope decision, a duplicated
diameter table, two deliberate non-translations and a trade-vocabulary
boundary — not outstanding defects.

---

## DELIVERY

**ONE ZIP only:** `QUOTATION-DNC-REVIEW.zip`

Required top-level folders:

```
SOURCE/  EVIDENCE/  REPORTS/  LOGS/  MANIFEST/  docs/control/
```

Manifest path: `MANIFEST/MANIFEST.txt`

**Forbidden:** a separate `FULL-AUDIT.zip`, a separate
`quotation-dnc-final.zip`, nested delivery ZIPs, old delivery dump folders,
secrets, `db.php`, `ai_config.php`.

GitHub is source/history reference only. Deployment: **NO**, unless Nicholas
explicitly approves.

---

## SUPERSEDED VALUES

Recorded so a checker can recognise them as stale rather than re-deriving them.
**Never quote any of these as current.**

| | superseded |
|---|---|
| Assertion totals | 3,334 · 3,482 · 3,679 · 3,799 · 3,827 · 3,958 |
| Deltas | +734 · +869 · +989 · +1,017 · +1,148 |
| Translation keys | 512 · 658 · 756 · 843 · 853 |
| Finding totals | 29 · 33 |
| Suite counts | 34 · 36 · 38 |
| Manifest filename | `ZIP-MANIFEST.txt` |
| Application commit | `7f5bc977197a658d6d4db995ee2c9bb5e106e21b` — superseded by `e3d659b` when UI POLISH 1 was accepted |
| Application commit | `e3d659bba1636cd4cfc74cb89be1b52cf92aff67` — superseded by `33ae0da` when UI POLISH 2 was accepted |
| Application commit | `33ae0da14a3bd3108e8b066d4796b1bcda2de428` — superseded by `98a31e3` when STAGE 0B was accepted |

2,810 is a superseded *total* but remains the current *baseline*, and is the
one number in that column that a current line may legitimately quote — always
as the baseline, never as the present figure.

---

## CHANGING THIS FILE

Change CANONICAL-STATE only when a newly accepted application state, test
result, finding set or package state supersedes the old one. When it changes:
update the `.md`, update the `.json`, validate that both agree, and record why.

**Do not casually mutate a canonical fact to make a checker pass.** That
inverts the whole arrangement.
