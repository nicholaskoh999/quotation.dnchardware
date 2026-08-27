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
| Accepted application commit | `e76bb85d663f96fdce3ed6c0c70b72c49d84000a` |
| Application status | **ACCEPTED** |
| Accepted round | ACTOR IDENTITY FOUNDATION — the server learns which individual person is asking, **FINAL ACCEPTED** |

The accepted commit moved because the server could not tell one member of staff
from another, and for no other reason. It is `e76bb85` because that is the last
commit that changed an application file — proven from the files, not from a
branch tip:

```
git merge-base --is-ancestor 97a14cf e76bb85  →  0   (97a14cf is an ancestor)
git log -1 --format=%H 97a14cf..HEAD -- auth.php login.php \
        tests/php/auth_identity.test.php
        →  e76bb85   (derived from the files ROUND-SCOPE declared, not asserted)
git diff --name-only 97a14cf..e76bb85 -- '*.php' ':(exclude)tests/**'
        →  auth.php, login.php       (and nothing else)
git diff --name-only e76bb85..HEAD -- '*.php'                →  (empty)
git diff --name-only e76bb85..HEAD -- tests/suites tests/lib →  (empty)
```

**What the change is.** `auth.php` was one shared hard-coded account —
`const DC_AUTH_USER = 'admin'` and a single password hash — so three or four
staff signed in as the same identity and the server could not tell Nicholas
from anyone else. The accepted Audit / Revision History architecture has to
answer *who changed this quotation?*, and no audit table can answer it while
every request is `admin`. This round supplies the missing half:

```
authenticated request  →  immutable numeric user_id + username + display_name
```

read from the SERVER session, never from the client.

**Where the credentials live.** A new `app_users` table, keyed by an immutable
numeric id, with `UNIQUE` on a normalised lowercase username. `dc_login()`
takes an **injected** database handle, so `auth.php` keeps the zero-DB property
it has always had — it is required by `index.php`, `companies.php`, `api.php`,
`login.php` and `logout.php`, and making it load the database would put a
connection behind every page. `login.php` is the only caller and the only file
that requires `db.php`, lazily inside the POST branch, and it calls
`mysqli_report(MYSQLI_REPORT_OFF)` before it does — the same driver contract
`api.php` restored at `97a14cf`. After login nothing queries `app_users` again:
an ordinary authenticated API request reads the session.

**What a session now carries.** `dc_user_id`, `dc_username`, `dc_display_name`
and `dc_login_time`, all from the authenticated row. `dc_user` survives as a
**compatibility alias only** and is not identity; `dc_current_user()` is the
canonical server-side actor accessor, and future audit code consumes that
helper rather than `$_SESSION` internals. `dc_is_logged_in()` additionally
requires a valid identity, so a session carrying only the old `dc_auth` +
`dc_user` shape is no longer authenticated — on cutover every existing
shared-account session stops being trusted rather than silently becoming an
unidentified actor. There is **no shared-admin fallback**; a fallback would be
a permanent backdoor.

**What the failed-login work does and does not claim.** Passwords are hashes
verified by `password_verify()`, a disabled account cannot authenticate, and an
unknown username is now verified against `DC_AUTH_DUMMY_HASH` — a real bcrypt
hash of a random string, generated once and discarded — so every credential
failure pays the same bcrypt cost. That **reduces the username-enumeration
timing signal.** It is **not** a claim of identical end-to-end request timing:
database and control-flow costs may still differ, and nothing in this round
measured them. The first candidate claimed the stronger thing; the claim was
withdrawn because the evidence did not support it, and the narrower one is what
this file records. `get_result()` is not used anywhere — it needs mysqlnd,
which this application never depended on — so the lookup is the portable
`bind_param` → `execute` → `bind_result` → `fetch`, bounded by `LIMIT 1`.

**Nothing else moved.** Quotation create / update / delete behaviour, the
`ref_no` format, `GET_LOCK`, the one-time 1062 retry, pricing, Quick Add, the
item JSON structure, the parser and the UI are untouched. `item_uid` is **not
implemented** and audit revisions are **not implemented**. `api.php` did not
change. The browser matrix did not move — 39 suites and 3,907 assertions,
measured on `e76bb85` exactly as on `97a14cf` — while
`tests/php/auth_identity.test.php` adds a seventh side group of **150**, which
is the whole of the +150 below.

**ACCEPTED IN SOURCE IS NOT DEPLOYED, and the two are different facts.**
`e76bb85` is the accepted application. `quo.dnchardware.com` still runs the
previous shared-login build.

| | |
|---|---|
| Actor Identity in production | **NOT DEPLOYED · NOT PRODUCTION VERIFIED** |
| `migrations/2026-08-26-create-app-users.sql` | **NOT APPLIED** |
| Production `app_users` rows | **NONE SEEDED** |

Production `NOT NULL(ref_no)` was applied and verified in its own separate
round and remains accepted; that fact is unaffected by this one.
`migrations/2026-08-26-set-ref-no-not-null.sql` still carries the
preparation-time header saying NOT APPLIED, which records what was true when
the file was written. History is not rewritten to make an old header read like
today; current state is stated here.

---

## TESTS

| | |
|---|---:|
| Baseline assertions | 2,810 |
| Current final assertions | **4,549** |
| Delta | **+1,739** |
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
| Actor Identity (auth.php / login.php) | 150 |

**Arithmetic, which the checker performs itself rather than trusting:**

```
  3,907   browser
+   172   pricing / history
+   107   AI extraction / parser
+    62   workbook
+    15   translation
+    42   save retry
+    94   mysqli compatibility
+   150   actor identity
= 4,549   final

  4,549 - 2,810 = 1,739
```

The browser matrix grew by 91 in UI POLISH 2A, in one new suite and no other:
*save feedback — the button, the value, the region, and the row*, which measures
the success sequence, the in-flight guard, both confirmation semantics, the
failure path sampled every 12ms, reduced motion, and the save payload key for
key. It has not moved since, through four subsequent rounds, because none of
them changed a browser-visible byte.

The PHP evidence for the Actor Identity group was measured on **PHP 8.4.19**
under `error_reporting = E_ALL`, against the real `auth.php` with real PHP
sessions. One assertion in it is deliberately runtime-relative: the decoy
hash's bcrypt cost is compared against what `PASSWORD_DEFAULT` produces on the
runtime the suite is running on. PHP 8.4 raised that default from 10 to 12, so
the suite is green on 8.4 and reports that one assertion as failed on 8.3 or
earlier. That is the test measuring its runtime, not a defect, and it must not
be relaxed to make an older interpreter agree.

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
| Assertion totals | 3,334 · 3,482 · 3,679 · 3,799 · 3,827 · 3,958 · 4,070 · 4,172 · 4,263 · 4,305 · 4,399 |
| Deltas | +734 · +869 · +989 · +1,017 · +1,148 · +1,260 · +1,362 · +1,453 · +1,495 · +1,589 |
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
| Application commit | `97a14cf56bad6414e382c6f49f40d13eabd97dc9` — superseded by `e76bb85` when ACTOR IDENTITY FOUNDATION was accepted |

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
