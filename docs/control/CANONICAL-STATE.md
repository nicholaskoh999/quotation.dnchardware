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
| Accepted application commit | `1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a` |
| Application status | **ACCEPTED** |
| Accepted round | READ-BEFORE-WRITE / TRANSACTION FOUNDATION — one transaction around a quotation mutation, and the persisted read moved inside it, **FINAL ACCEPTED** |

The accepted commit moved because a quotation could be read and then written
with nothing holding the two together, and for no other reason. It is
`1ca6554` because that is the last commit that changed an application file —
proven from the files, not from a branch tip:

```
git merge-base --is-ancestor 649f80a 1ca6554  →  0   (649f80a is an ancestor)
git log -1 --format=%H 649f80a..HEAD -- api.php \
        tests/php/transaction_foundation.test.php \
        tests/php/mysqli_compat.test.php tests/php/item_identity.test.php
        →  1ca6554   (derived from the files ROUND-SCOPE declared, not asserted)
git diff --name-only 649f80a..1ca6554 -- '*.php' ':(exclude)tests/**'  →  api.php
git diff --name-only --diff-filter=MD 649f80a..1ca6554 -- tests/suites →  (empty)
git diff --name-only 1ca6554..HEAD -- '*.php' ':(exclude)tests/**'     →  (empty)
```

**What the change is.** `update_quotation` read the persisted items, reconciled
item identity against them, and then wrote — with no transaction and no lock
around any of it. Between those two statements another request could change the
very items that had just been reconciled; nothing detected it and nothing
prevented it. `save_quotation` had the same shape: the named lock serialised
number allocation, but the allocation and the INSERT that used it were not one
atomic write.

```
CREATE   validate → mint identity → GET_LOCK → BEGIN → allocate
                  → INSERT (one 1062 retry) → COMMIT → RELEASE_LOCK
UPDATE   validate → BEGIN → SELECT * … FOR UPDATE → reconcile against THAT row
                  → UPDATE → COMMIT
```

**COMMIT precedes RELEASE_LOCK on the create path**, deliberately: the lock
exists to stop a second request allocating the same number, and letting go of it
while the INSERT is uncommitted would hand out a number that is not yet taken.
`dc_lock_quotation_for_update()` returns the **whole row**, not the one column
reconciliation needs, because it is the authoritative BEFORE state a later
revision writer will snapshot — reading it twice would reintroduce the gap it
closes.

**The hard part was never BEGIN and COMMIT.** `query_or_fail`, `prepare_or_fail`,
`execute_or_fail` and the 1062 retry all end the request through `fail_json()`,
which echoes and exits — and an exit inside an open transaction leaves the
rollback to the connection closing, and the named lock to the same. That works,
but it is a side effect of the process dying rather than a contract. The
transaction scope is now recorded as the request runs and `fail_json()` unwinds
it explicitly before it answers, so **every existing error path became
transaction safe without one call site changing** — which is also why the
helpers PROJECT-GUARDRAILS protects did not have to be rewritten. They still
branch on return values; there is still no `try`/`catch` in any PHP file.

The named lock and the transaction are tracked **separately**: `GET_LOCK` is
SESSION scoped, `COMMIT` does not release it and `ROLLBACK` does not either.

**What this claims, and what it does not.** Two UPDATE transactions cannot hold
the same quotation row at once; the second waits for the first. That is the
whole claim, and it is what gives a future writer a deterministic BEFORE state.
It is **NOT optimistic concurrency** — a browser holding a stale copy can still
overwrite a newer edit, because nothing compares versions. No version column was
added and no conflict is detected.

**Nothing else moved.** `ref_no`, server-side allocation, `GET_LOCK`,
`uq_quotations_ref`, `NOT NULL ref_no`, the **exactly one** 1062 retry,
`mysqli_report(MYSQLI_REPORT_OFF)`, item identity minting and reconciliation,
Actor Identity, pricing, Quick Add, the parser, the translation dictionary and
`delete_quotation` are untouched. `api.php` is the only application file
changed, no browser suite moved, and no application file references
`quotation_revisions`. **The revision writer is NOT started.**

**Two accepted suites were maintained, and both are recorded rather than
slipped in.** `mysqli_compat.test.php` lifts `fail_json()` and evaluates it, in
the parent and again in a child process; `fail_json()` now calls
`dc_txn_cleanup()`, so lifting one without the other evaluated a `fail_json`
that could not run — it died with *undefined function*, not a failed assertion.
Both lift sites take the dependency now and **every assertion is identical**.
`item_identity.test.php` asserted the literal `SELECT items FROM quotations
WHERE id=?` under *"reading the minimum it needs"* — the right contract for Item
Identity and the wrong one now, because this round deliberately makes the read
non-minimal. That one assertion became **four**, asking for more than it did:
the read goes through `dc_lock_quotation_for_update`, it is `FOR UPDATE`, the
transaction opened before it, and the old unlocked read is gone. Tightened, not
weakened — which is why item identity reads 159 below and not 156.

**ACCEPTED IS NOT LIVE, and this round parts them again.**

| | |
|---|---|
| Accepted application | `1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a` |
| **Deployed application** | **`649f80a09f83a7201c0f3772e01fc270ccda3e05`** — the Item Identity build |
| Transaction foundation in production | **NOT DEPLOYED · NOT PRODUCTION VERIFIED** |
| `migrations/2026-08-28-create-quotation-revisions.sql` | **NOT APPLIED** |

They were equal for exactly one round after the 2026-08-28 rollout. That is the
exception, not the rule: an accepted commit is not live until it is rolled out.

---

## REVISION STORAGE — FINAL ACCEPTED / CLOSED

| | |
|---|---|
| Round | REVISION STORAGE FOUNDATION |
| Status | **FINAL ACCEPTED / CLOSED**, 2026-08-28 |
| Accepted candidate | `b1fd1de7b1623150dcd6d8d609d8014af488f70e` |
| Table | `quotation_revisions` |
| Migration | `migrations/2026-08-28-create-quotation-revisions.sql` — **NOT APPLIED to production** |
| Revision writer | **NOT STARTED** |

| verified on | assertions | failed |
|---|---:|---:|
| MySQL **8.0.46** — the exact production engine | 198 | 0 |
| MySQL **8.4.3** | 198 | 0 |

**The accepted application commit does NOT move.** This round added a migration
and a schema suite and changed no application file:

```
git diff --name-only 649f80a..b1fd1de -- '*.php' ':(exclude)tests/**'   →  (empty)
```

`migrations/` and `tests/` are not in `.cpanel.yml`'s `APPFILES`, so neither
artefact is deployed. The application that is accepted, and the application that
is live, are both still `649f80a`.

**The 198 are deliberately NOT added to the assertion total below.** Those
figures describe the APPLICATION, measured at `649f80a`. A suite that measures
a migration is not an application assertion any more than a control-system
self-test is, and adding it would make the canonical total mean two things at
once — the same rule that keeps `check-control`'s own tests out of it.

**What was accepted.** `quotation_revisions` holds an immutable snapshot per
revision: `UNIQUE (quotation_id, revision_no)`, full `snapshot_json` as native
`JSON`, `snapshot_schema_version` with no default so a writer must state the
format it wrote, `created_at` as `DATETIME` rather than `TIMESTAMP`, actor id
plus name snapshots, and **no foreign keys** — because every `ON DELETE` action
would decide the Baseline / Delete Policy round's business question by accident,
in DDL. No item table: item identity stays inside the snapshot JSON. No
triggers: append-only is a contract the writer round enforces.

**One column is compared across tables, and its final state is authoritative:**
`quotation_revisions.quotation_ref_no` has the same `COLUMN_TYPE`,
`CHARACTER_SET_NAME` and `COLLATION_NAME` as `quotations.ref_no`, read from the
live database. The migration states no charset and no collation of its own, so
it cannot be wrong about a database it has never seen.

**Nothing writes to it.** No application file mentions `quotation_revisions`.
The Snapshot Revision Writer is a later round and has not begun.

---

## TESTS

| | |
|---|---:|
| Baseline assertions | 2,810 |
| Current final assertions | **4,822** |
| Delta | **+2,012** |
| Failed | **8** — see the exception below |
| Skipped | 0 |
| Browser suites | **40** |
| Browser assertions | **3,936** |

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
| Item Identity (api.php / index.php) | 159 |
| Transaction Foundation (api.php) | 85 |

**Arithmetic, which the checker performs itself rather than trusting:**

```
  3,936   browser (40 suites)
+   172   pricing / history
+   107   AI extraction / parser
+    62   workbook
+    15   translation
+    42   save retry
+    94   mysqli compatibility
+   150   actor identity
+   159   item identity
+    85   transaction foundation
= 4,822   final

  4,822 - 2,810 = 2,012
```

**The browser matrix moved for the first time in five rounds.** The
thirty-nine suites that existed before this round still measure **3,907**,
assertion for assertion — that figure is historical from here and may only be
quoted as such — and `tests/suites/40-item-identity.test.js` adds **29**, which
is the whole of the difference. Not one earlier suite was modified or deleted;
Git is asked, not trusted:

```
git diff --name-only --diff-filter=MD e76bb85..649f80a -- tests/suites  →  (empty)
```

### THE EIGHT FAILURES — recorded, not rounded away

This is the first accepted matrix that does not read *0 failed*, so it is
written out in full rather than left as a number.

| | |
|---|---|
| Count | **8** |
| Suite | `tests/suites/38-mobile-ui.test.js` — *phone widths — the scope label, the tap targets, and the desk left alone* |
| What | the `companies.php` modal close control at 1440 / 980 / 700 / 600px: **27 tall where 24 was accepted, 16.3 wide where 17 was** |
| Cause | font metrics. This matrix was re-measured on Windows Chromium; the accepted figures were measured in a Linux sandbox, and the harness strips the Google Fonts link so each falls back to whatever the host provides |
| Application fault | **No** |
| Introduced by this round | **No** — `companies.php` and `38-mobile-ui.test.js` are both untouched by it |
| Reproduced on | `ce26146a6a792f2bac0ebb4bab77389d19ff0660` — a pristine worktree at the Item Identity round's starting point fails the same eight with the same numbers |
| Re-measured on | `1ca6554`, with the transaction change in place: the same eight, the same widths, the same numbers |

**What must not happen to them.** Do not relax those assertions, and do not
restate this total as *0 failed*. The accepted desktop dimensions they measure
are protected in PROJECT-GUARDRAILS precisely because raising a phone target
must never be paid for by moving desk density. What is unproven here is the
measurement **environment**, not the rule. The honest reading is: 3,928 of
3,936 browser assertions pass, and the remaining 8 have not been measured on a
runtime that can settle them.

`tests/php/item_identity.test.php` runs the shipped `api.php` functions and
executes the shipped migration as a real subprocess against a stub `db.php`;
its 156 are the whole of the +156 above. The PHP evidence for Actor Identity
remains the accepted PHP 8.4.19 run, and its side log is still absent for the
reason recorded when that round closed.

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

GitHub is source/history reference only. Deployment is **NEVER automatic**
and never happens without Nicholas's explicit approval. Actor Identity was
approved and deployed on 2026-08-27; that approval was for that release and
does not carry to the next one.

---

## SUPERSEDED VALUES

Recorded so a checker can recognise them as stale rather than re-deriving them.
**Never quote any of these as current.**

| | superseded |
|---|---|
| Assertion totals | 3,334 · 3,482 · 3,679 · 3,799 · 3,827 · 3,958 · 4,070 · 4,172 · 4,263 · 4,305 · 4,399 · 4,549 · 4,734 |
| Deltas | +734 · +869 · +989 · +1,017 · +1,148 · +1,260 · +1,362 · +1,453 · +1,495 · +1,589 · +1,739 · +1,924 |
| Translation keys | 512 · 658 · 756 · 843 · 853 |
| Finding totals | 29 · 33 |
| Suite counts | 34 · 36 · 37 · 38 · 39 |
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
| Application commit | `e76bb85d663f96fdce3ed6c0c70b72c49d84000a` — superseded by `649f80a` when ITEM IDENTITY FOUNDATION was accepted |
| Application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` — superseded by `1ca6554` when READ-BEFORE-WRITE / TRANSACTION FOUNDATION was accepted. **Still the DEPLOYED commit**, which is a different fact and is current, not superseded |

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
