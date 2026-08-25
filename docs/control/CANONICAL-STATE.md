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
| Accepted application commit | `86cf2629a66434bf3bdffe2efc0acbe527c358ac` |
| Application status | **ACCEPTED** |
| Accepted round | API 1062 DUPLICATE RETRY HARDENING — one retry for a duplicate reference number, **FINAL ACCEPTED** |

The accepted commit moved because one database error this application can answer
is now answered, and for no other reason. It is `86cf262` because that is the
last commit that changed an application file — proven from the files, not from a
branch tip:

```
git merge-base --is-ancestor 6bb5772 86cf262  →  0   (6bb5772 is an ancestor)
git log -1 --format=%H 6bb5772..HEAD -- api.php tests/php/save_retry.test.php
        →  86cf262   (derived from the files ROUND-SCOPE declared, not asserted)
git diff --name-only 6bb5772..86cf262 -- '*.php'
        →  api.php                  (and nothing else)
git diff --name-only 86cf262..HEAD -- '*.php'                →  (empty)
git diff --name-only 86cf262..HEAD -- tests/suites tests/lib →  (empty)
```

**What the fix is.** A duplicate reference number is now a retry, not a failed
save.

`save_quotation` allocates `ref_no` through `next_free_ref_no($db)` under
`GET_LOCK('dc_quotation_ref_alloc', 10)`. That lock serialises two PHP requests
against each other and nothing more: it cannot see a second application, an
import, a manual insert, or a request that died between allocating a number and
using it. `quotations.ref_no` carries a UNIQUE index, so such a collision is
refused by the database with error **1062** rather than becoming a silent
duplicate — and the INSERT went through `execute_or_fail()`, which cannot tell
1062 from a dead connection and failed the whole save either way. The number was
chosen by the server, the person never typed it, and the machine already knows
what the next free one is; refusing the save was a poor answer to a question the
application can answer itself.

`dc_save_quotation_insert()` now wraps that one INSERT. On errno 1062 it
re-allocates through the **existing** allocator and executes once more —
`$ref_no` is taken by reference because `mysqli::bind_param` binds by reference,
so re-assigning it *is* the retry, with every other column byte for byte the one
the first attempt sent. On any other errno it returns false untouched, so the
caller fails exactly as it did before. **Maximum retry is one**: a second
collision means something other than a race, and a retry would only hide it.

**Nothing else moved.** The allocation algorithm, `GET_LOCK`, the `ref_no`
format, the database schema, the UNIQUE index, the UI, pricing, the parser and
the quotation JSON structure are untouched. `update_quotation` is **not**
wrapped. No translation key was added, changed or removed. The migration
`migrations/2026-08-24-add-unique-ref-no.sql` remains **NOT APPLIED** and
unmodified.

The browser matrix did not move — 39 suites and 3,907 assertions, measured on
`86cf262` exactly as on `6bb5772`, because no suite asserts anything this change
alters. The new PHP suite `tests/php/save_retry.test.php` adds a fifth side
group of **42**, which is the whole of the +42 below.

---

## TESTS

| | |
|---|---:|
| Baseline assertions | 2,810 |
| Current final assertions | **4,305** |
| Delta | **+1,495** |
| Failed | 0 |
| Skipped | 0 |
| Browser suites | 39 |
| Browser assertions | 3,907 |

Other accepted assertion groups:

| | |
|---|---:|
| Pricing / History | 172 |
| AI Extraction / Parser | 107 |
| Workbook | 62 |
| Translation | 15 |
| Save retry (api.php 1062) | 42 |

**Arithmetic, which the checker performs itself rather than trusting:**

```
  3,907   browser
+   172   pricing / history
+   107   AI extraction / parser
+    62   workbook
+    15   translation
+    42   save retry
= 4,305   final

  4,305 - 2,810 = 1,495
```

The browser matrix grew by 91 in UI POLISH 2A, in one new suite and no other:
*save feedback — the button, the value, the region, and the row*, which measures
the success sequence, the in-flight guard, both confirmation semantics, the
failure path sampled every 12ms, reduced motion, and the save payload key for
key. The thirty-eight suites that existed before this round are unchanged,
assertion for assertion, and the four side groups did not move.

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
| Assertion totals | 3,334 · 3,482 · 3,679 · 3,799 · 3,827 · 3,958 · 4,070 · 4,172 |
| Deltas | +734 · +869 · +989 · +1,017 · +1,148 · +1,260 · +1,362 |
| Translation keys | 512 · 658 · 756 · 843 · 853 |
| Finding totals | 29 · 33 |
| Suite counts | 34 · 36 · 37 · 38 |
| Manifest filename | `ZIP-MANIFEST.txt` |
| Application commit | `7f5bc977197a658d6d4db995ee2c9bb5e106e21b` — superseded by `e3d659b` when UI POLISH 1 was accepted |
| Application commit | `e3d659bba1636cd4cfc74cb89be1b52cf92aff67` — superseded by `33ae0da` when UI POLISH 2 was accepted |
| Application commit | `33ae0da14a3bd3108e8b066d4796b1bcda2de428` — superseded by `98a31e3` when STAGE 0B was accepted |
| Application commit | `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac` — superseded by `3e89713` when STAGE 1 was accepted |
| Application commit | `3e89713400b5bcfceca31d2c074de17411169d1b` — superseded by `cf92f27` when UI POLISH 2A was accepted |
| Application commit | `cf92f27feb629134a61801dc120eba79c54fb5f6` — superseded by `6bb5772` when QUICK ADD STABILITY was accepted |
| Application commit | `6bb5772475e06925f6c2ac8237099fcf0c61c3b7` — superseded by `86cf262` when API 1062 DUPLICATE RETRY HARDENING was accepted |

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
