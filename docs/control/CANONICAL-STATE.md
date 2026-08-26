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
| Accepted application commit | `97a14cf56bad6414e382c6f49f40d13eabd97dc9` |
| Application status | **ACCEPTED** |
| Accepted round | PHP 8.1+ MYSQLI EXCEPTION COMPATIBILITY — the driver contract restored, and the CSV escape stated, **FINAL ACCEPTED** |

The accepted commit moved because the database driver stopped honouring the
contract this code was written against, and for no other reason. It is
`97a14cf` because that is the last commit that changed an application file —
proven from the files, not from a branch tip:

```
git merge-base --is-ancestor 86cf262 97a14cf  →  0   (86cf262 is an ancestor)
git log -1 --format=%H 86cf262..HEAD -- api.php \
        tests/php/mysqli_compat.test.php tests/php/save_retry.test.php
        →  97a14cf   (derived from the files ROUND-SCOPE declared, not asserted)
git diff --name-only 86cf262..97a14cf -- '*.php' ':(exclude)tests/**'
        →  api.php                  (and nothing else)
git diff --name-only 97a14cf..HEAD -- '*.php'                →  (empty)
git diff --name-only 97a14cf..HEAD -- tests/suites tests/lib →  (empty)
```

**What the fix is.** PHP **8.1** changed the default `mysqli_report` mode from
`MYSQLI_REPORT_OFF` to `MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT`, so mysqli
**throws** where it used to return `false`.

Every error path in `api.php` reads a return value and then an errno —
`getDB()` checks `$conn->connect_error`, `query_or_fail()` checks `!$res`,
`execute_or_fail()` checks `!$stmt->execute()`, and
`dc_save_quotation_insert()` checks `!$stmt->execute()` and then
`$stmt->errno` — and the application contains **no `try`/`catch` and no
exception handler in any PHP file**. Under the 8.1 default every one of those
checks is dead code: the request dies on an uncaught `mysqli_sql_exception`
before a single byte of JSON is written, and the 1062 retry accepted at
`86cf262` never runs at all. Proven on a real PHP 8.4.19 runtime against the
shipped function:

```
PHP 8.0 — execute() returns false
    returned: true | executes: 2 | reallocations: 1 | ref_no now: Q-2026-0432
PHP 8.1+/8.4 default — execute() throws
    UNCAUGHT mysqli_sql_exception | executes: 1 | reallocations: 0
```

`api.php` now calls `mysqli_report(MYSQLI_REPORT_OFF)` **immediately before
`db.php` is required**. That is the earliest correct point: `api.php` is the
only file that requires `db.php` or calls `getDB()`, the only `new mysqli(...)`
in the repository lives inside `getDB()`, and nothing in `api.php` before that
line touches mysqli. It is placed there rather than in `db.php` because that
file holds the real credentials, exists only on the server and is absent from
Git — a fix that depended on editing it would never reach production.

**Why it is safe on both versions.** On PHP 8.0, which production runs,
`MYSQLI_REPORT_OFF` is already the default, so the call is a no-op and
behaviour is unchanged. On 8.4 it restores the 8.0 contract: a failed
connection returns a `mysqli` object with `connect_errno` set instead of
throwing, so `getDB()`'s own check runs again. **No version branch was
introduced** — one statement, both versions.

**And the CSV escape.** PHP 8.4 deprecates leaving `$escape` implicit on
`str_getcsv()` and `fputcsv()`. Both are called in loops, so the notice fired
once per row — into the error log, and into the download itself wherever
`display_errors` is on. The three defaults are now stated, and the output was
proven **byte-identical** to the implicit form across quoted commas, quoted
double-quotes, empty fields, UTF-8 and backslashes.

**Nothing else moved.** The allocation algorithm, `GET_LOCK`, the `ref_no`
format, the database schema, the UNIQUE index, the UI, the parser, pricing and
the quotation JSON are untouched, `update_quotation` is still not wrapped, and
no translation key changed. `migrations/2026-08-24-add-unique-ref-no.sql` is
unmodified. **No production PHP version was switched**; `quo.dnchardware.com`
remains on 8.0, and this candidate was smoke-tested there before acceptance.

Exactly four executable lines changed in `api.php`; everything else the diff
carries is commentary. The browser matrix did not move — 39 suites and 3,907
assertions, measured on `97a14cf` exactly as on `86cf262` — while
`tests/php/mysqli_compat.test.php` adds a sixth side group of **94**, which is
the whole of the +94 below.

---

## TESTS

| | |
|---|---:|
| Baseline assertions | 2,810 |
| Current final assertions | **4,399** |
| Delta | **+1,589** |
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
| mysqli compatibility (PHP 8.1+) | 94 |

**Arithmetic, which the checker performs itself rather than trusting:**

```
  3,907   browser
+   172   pricing / history
+   107   AI extraction / parser
+    62   workbook
+    15   translation
+    42   save retry
+    94   mysqli compatibility
= 4,399   final

  4,399 - 2,810 = 1,589
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
| Application commit | `86cf2629a66434bf3bdffe2efc0acbe527c358ac` — superseded by `97a14cf` when PHP 8.1+ MYSQLI EXCEPTION COMPATIBILITY was accepted |

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
