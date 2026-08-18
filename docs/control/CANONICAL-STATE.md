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
| Accepted application commit | `e3d659bba1636cd4cfc74cb89be1b52cf92aff67` |
| Application status | **ACCEPTED** |
| Accepted round | UI POLISH 1 — Visual Density & Hierarchy, **FINAL ACCEPTED** |

The accepted commit moved because UI POLISH 1 was accepted, and for no other
reason. It is `e3d659b` because that is the last commit that changed an
application file — proven from the file, not from a branch tip:

```
git log 7f5bc97..HEAD -- '*.php'      →  e3d659b, ca9fb71   (nothing else)
git rev-parse e3d659b:index.php       →  a7ffeda1a8c9711583e6ba2502614237e5dc857c
git rev-parse HEAD:index.php          →  a7ffeda1a8c9711583e6ba2502614237e5dc857c
git diff --name-only e3d659b..HEAD -- '*.php'   →  (empty)
```

Every commit after `e3d659b` carries reports, control files and evidence, and
changes no application byte. `api.php`, `companies.php`, `ai_extract.php`,
`auth.php`, `login.php`, `logout.php` and `pricing_history.php` are still
identical to the commit before it.

The accepted change is presentation only: every diff hunk in `index.php` falls
above `</style>`.

---

## TESTS

| | |
|---|---:|
| Baseline assertions | 2,810 |
| Current final assertions | **3,958** |
| Delta | **+1,148** |
| Failed | 0 |
| Skipped | 0 |
| Browser suites | 37 |
| Browser assertions | 3,613 |

Other accepted assertion groups:

| | |
|---|---:|
| Pricing / History | 161 |
| AI Extraction / Parser | 107 |
| Workbook | 62 |
| Translation | 15 |

**Arithmetic, which the checker performs itself rather than trusting:**

```
  3,613   browser
+   161   pricing / history
+   107   AI extraction / parser
+    62   workbook
+    15   translation
= 3,958   final

  3,958 - 2,810 = 1,148
```

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
| Assertion totals | 3,334 · 3,482 · 3,679 · 3,799 · 3,827 |
| Deltas | +734 · +869 · +989 · +1,017 |
| Translation keys | 512 · 658 · 756 · 843 · 853 |
| Finding totals | 29 · 33 |
| Suite counts | 34 · 36 · 38 |
| Manifest filename | `ZIP-MANIFEST.txt` |
| Application commit | `7f5bc977197a658d6d4db995ee2c9bb5e106e21b` — superseded by `e3d659b` when UI POLISH 1 was accepted |

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
