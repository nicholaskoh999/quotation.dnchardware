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
| Accepted application commit | `631cb8945406a934b351e476ec71330ed23a2d27` |
| Application status | **ACCEPTED** |
| Accepted round | SNAPSHOT REVISION WRITER — a quotation mutation and its immutable full snapshot are one transaction, and the 1062 retry can see what it collided with, **FINAL ACCEPTED** |

The accepted commit moved because a quotation could be changed without anything
recording what it became, and for no other reason. It is `631cb89` because that
is the last commit that changes an application file — proven from the files, not
from a branch tip:

```
git merge-base --is-ancestor 1ca6554 631cb89  →  0   (1ca6554 is an ancestor)
git log -1 --format=%H 1ca6554..HEAD -- api.php \
        tests/php/revision_writer.test.php \
        tests/php/transaction_foundation.test.php \
        tests/php/revision_storage.test.php
        →  631cb89   (derived from the files ROUND-SCOPE declared, not asserted)
git diff --name-only 1ca6554..631cb89 -- '*.php' ':(exclude)tests/**'  →  api.php
git diff --name-only --diff-filter=MD 1ca6554..631cb89 -- tests/suites →  (empty)
git diff --name-only 631cb89..HEAD -- '*.php' ':(exclude)tests/**'     →  (empty)
```

**What the change is.** Four rounds built the pieces — who (Actor Identity),
which (Item Identity), where (Revision Storage), when (Transaction Foundation).
This one joins them. Until now nothing wrote a revision: the table existed and
stayed empty by design.

```
CREATE   GET_LOCK → BEGIN → allocate → INSERT quotation (one 1062 retry)
                  → read back → write ONE revision → COMMIT → RELEASE_LOCK
UPDATE   BEGIN → SELECT * … FOR UPDATE → reconcile → UPDATE quotation
                  → read back → write ONE revision → COMMIT
```

The revision INSERT is **before** `COMMIT` on both paths, so a quotation and its
history commit together or not at all. Every failure inside the writer goes
through `fail_json()`, which the Transaction Foundation already made unwind the
scope — so **a revision that cannot be written takes the quotation change down
with it**.

**The snapshot is of persisted fact, not of request intent.** The row is read
back out of the database after the mutation, inside the same transaction, so
what is recorded is what the server actually stored: the `ref_no` the allocator
chose, the `quote_date` it defaulted, the `item_uid` values it minted, the total
it wrote. Snapshotting `$input` would record what the browser asked for, which
is a different and much less useful fact.

**`company_name` is FROZEN** into the snapshot, resolved through the same `LEFT
JOIN companies` the read paths use. Renaming a company later must not rewrite
what the document said — the same reason Actor Identity snapshots the username
beside the id. **`snapshot_schema_version = 1` lives in the COLUMN, not inside
the JSON**, because two copies of one fact can disagree. **No item table**:
identity stays inside `snapshot_json` exactly as it lives inside
`quotations.items`.

**The actor is the session, and `prepared_by` is not the actor.**
`actor_user_id` / `actor_username` / `actor_display_name` come from
`dc_current_user()` and from nowhere else, and all three are NULL when no
signed-in person is behind the request, because a placeholder id would be a lie.
`prepared_by` is a **field of the document** — whose name is printed on the
quotation — and is never written to an actor column.

**Append-only is enforced by the code**, which is what the storage round said
instead of adding a trigger: exactly **one** `INSERT INTO quotation_revisions`
in the whole application, no `UPDATE`, `DELETE` or `TRUNCATE` against it
anywhere, and no other application file mentions the table.

### The 1062 retry, broken by a previous round and fixed in this one

This was reported as a finding by the candidate and **returned as a BLOCKER**,
because the retry is part of this round's acceptance gate. It was never a
revision-writer defect: READ-BEFORE-WRITE / TRANSACTION FOUNDATION broke it, and
this round's tests are what surfaced it.

REPEATABLE READ gives a transaction one consistent snapshot at its first read
and never moves it. So when another session commits the `ref_no` the allocator
is about to use, the INSERT is refused with **1062** — writes always see the
latest state — while `next_free_ref_no()`'s plain `SELECT` still reads the
**original snapshot** and returns **the same number**. The retry collides again,
and the single permitted attempt is spent on a number that was never going to
work. Demonstrated directly: inside a transaction a plain `SELECT` reports the
row absent while an `INSERT` of that very row is refused with 1062.

The create transaction now opens at **READ COMMITTED**, which takes a fresh
snapshot per consistent read, so the reallocation sees the row it collided with
and takes the next free number. **Three executable lines**: an optional argument
on `dc_txn_begin`, one `SET TRANSACTION`, one call site.

**Safe here** because the create transaction never reads the same thing twice
expecting it not to move — it allocates, inserts, and if refused allocates
again, which is precisely the read that MUST move. Allocation is already
serialised by `DC_REF_LOCK`, so nothing changes for ordinary concurrent saves;
this only lets the retry see reality in the rare case something **outside** that
lock took the number.

**NOT applied to the update path**, which stays at the server default. It
depends on `SELECT … FOR UPDATE` — a locking read that already sees the latest
committed state — so it has nothing to gain, and its accepted read-before-write
behaviour is not disturbed by a change it does not need. `SET TRANSACTION`
without `SESSION` or `GLOBAL` scopes to the **next transaction only**; the suite
asserts no session- or global-scoped form appears anywhere.

**Proven on a real race, not a simulation.** Another connection holds the number
uncommitted, the request blocks on the duplicate key, the other connection
commits, MySQL raises a genuine 1062 — and the save now **succeeds** on
`Q-YYYY-0002`, **exactly one** revision is written rather than one per attempt,
numbered 1, recorded as a `create`, carrying the `ref_no` the retry **settled
on**, and **no revision claims the number the first attempt lost**. On MySQL
8.0.46 — the production engine — and again on 8.4.3.

**The retry contract is unchanged in shape**: maximum one attempt, only on
errno 1062, no loop. What changed is that the attempt can now see.

**Nothing else moved.** `ref_no`, server-side allocation, `GET_LOCK` and its
release ordering, `uq_quotations_ref`, `NOT NULL ref_no`,
`mysqli_report(MYSQLI_REPORT_OFF)`, `SELECT … FOR UPDATE`, item identity minting
and reconciliation, Actor Identity, pricing, Quick Add, the parser, the
translation dictionary and `delete_quotation` — which writes no revision — are
untouched. `api.php` is the only application file changed, and no browser suite
moved.

**Two accepted suites were maintained, and both are recorded rather than slipped
in.** `transaction_foundation` and `revision_storage` each asserted that the
writer did **not exist** — the right out-of-scope guard for their own rounds,
and wrong the moment this round started the writer by authorisation. Both guards
were replaced by the contract that now holds, which is stricter than the absence
it replaced. `transaction_foundation` also needed its fixture completed: it had
no `companies` and no `quotation_revisions`, so with the writer in place every
save in it failed. Both tables were added, the revision one lifted from the
shipped migration so it cannot drift. **No assertion was weakened** — the suite
went from 85 to **92**.

**ACCEPTED IS NOT LIVE, and this round does not change that.**

| | |
|---|---|
| Accepted application | `631cb8945406a934b351e476ec71330ed23a2d27` |
| **Deployed application** | **`649f80a09f83a7201c0f3772e01fc270ccda3e05`** — the Item Identity build |
| Transaction foundation in production | **NOT DEPLOYED · NOT PRODUCTION VERIFIED** |
| Snapshot revision writer in production | **NOT DEPLOYED · NOT PRODUCTION VERIFIED** |
| `migrations/2026-08-28-create-quotation-revisions.sql` | **NOT APPLIED** |

**AND THE ORDER IS NOW A HARD CONSTRAINT.** The migration must be **APPLIED to
production BEFORE this accepted application is deployed**. With the table absent
a save FAILS and rolls back. That is not an oversight and must not be softened
into a fallback: a save that worked but kept no history is precisely the state
this round exists to make impossible. The failure mode is safe — the save is
refused, nothing partial is written — but the ordering is not optional.

---

## REVISION STORAGE — FINAL ACCEPTED / CLOSED

| | |
|---|---|
| Round | REVISION STORAGE FOUNDATION |
| Status | **FINAL ACCEPTED / CLOSED**, 2026-08-28 |
| Accepted candidate | `b1fd1de7b1623150dcd6d8d609d8014af488f70e` |
| Table | `quotation_revisions` |
| Migration | `migrations/2026-08-28-create-quotation-revisions.sql` — **NOT APPLIED to production** |
| Revision writer | **STARTED AND ACCEPTED** — see the application section above |

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
figures describe the APPLICATION. A suite that measures
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

**One thing writes to it, and only one.** `api.php` holds exactly one `INSERT
INTO quotation_revisions` and no `UPDATE`, `DELETE` or `TRUNCATE` against it;
no other application file mentions the table. That is how append-only is
enforced, this round having inherited the storage round's deliberate decision
not to add a trigger.

**Its 198 still stay out of the application total**, and that is not a
contradiction now that the writer exists: the WRITER's own suite measures
`api.php` and does count, at 101. This one still measures a migration. The
storage suite was maintained by the writer round — its section 7 *"nothing
writes to this table"* guard became the writer contract — and did not move
from 198.

---

## TESTS

| | |
|---|---:|
| Baseline assertions | 2,810 |
| Current final assertions | **4,930** |
| Delta | **+2,120** |
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
| Transaction Foundation (api.php) | 92 |
| Revision Writer (api.php) | 101 |

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
+    92   transaction foundation   (was 85)
+   101   revision writer          (new)
= 4,930   final

  4,930 - 2,810 = 2,120
```

**Two figures moved, and both are measured, not estimated.**
`tests/php/revision_writer.test.php` is a tenth side group of **101**, run on
MySQL **8.0.46** — the production engine — and again on **8.4.3**, with the same
count and no failures on either. Transaction foundation is **92**, not 85,
because its fixture was completed and its two *"no writer exists"* guards became
the writer contract. Revision storage stayed 198 on both engines and stays out
of this total. **4,822** and **+2,012** are recorded as retired.

**One side suite does not read 0 failed, and is not restated as though it did.**
`tests/php/auth_identity.test.php` measures **150 / 1** on the local PHP 8.3.30
runtime — a runtime-relative bcrypt-cost artifact, not an application fault. The
accepted Actor Identity evidence remains the PHP 8.4.19 run recorded when that
round closed.

**The browser matrix last moved at Item Identity, and has not moved since.**
The thirty-nine suites that existed before that round still measure **3,907**,
assertion for assertion — that figure is historical from here and may only be
quoted as such — and `tests/suites/40-item-identity.test.js` adds **29**, which
is the whole of the difference. Not one earlier suite was modified or deleted;
Git is asked, not trusted:

```
git diff --name-only --diff-filter=MD e76bb85..649f80a -- tests/suites  →  (empty)
git diff --name-only 1ca6554..631cb89 -- tests/suites tests/lib index.php  →  (empty)
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
| Re-measured on | `631cb89`, with the revision writer and the isolation fix in place: the same eight, the same widths, the same numbers |
| Reachable by this round | **No** — the harness intercepts every `api.php` request and answers it from a stub table, so the matrix never executes the one file this round changed |

**What must not happen to them.** Do not relax those assertions, and do not
restate this total as *0 failed*. The accepted desktop dimensions they measure
are protected in PROJECT-GUARDRAILS precisely because raising a phone target
must never be paid for by moving desk density. What is unproven here is the
measurement **environment**, not the rule. The honest reading is: 3,928 of
3,936 browser assertions pass, and the remaining 8 have not been measured on a
runtime that can settle them.

### A NINTH FAILURE APPEARED ONCE, AND WAS CHASED DOWN

The first candidate matrix run reported **nine** — the known eight plus
`35-edit-mode`'s *"clearing it back to the default lets the session close"*. The
acceptance gate treats a new browser failure as a blocker, so it was
investigated rather than waved through.

| run | tree | failures |
|---|---|---:|
| 1 | candidate | 9 — the known 8 plus this one |
| 2 | candidate | **8** |
| 3 | pristine worktree at `1ca6554` | **8** |
| 5× | candidate, suite 35 alone | **0** |

Unobserved on rerun **and** unreachable by mechanism: `index.php`,
`tests/suites` and `tests/lib` are byte-identical to `1ca6554`, and the harness
answers every `api.php` request from a stub table. Recorded as a load-sensitive
flake, with the brittleness named — the assertion ends a chain of
`typeCell` / `wqaEditDone` pairs that carry no settle wait, unlike the ones above
it in the same suite. **Not fixed**: `tests/suites` is out of scope for this
round and was not touched. Worth a settle wait in whichever round next opens
that file.

`tests/php/item_identity.test.php` runs the shipped `api.php` functions and
executes the shipped migration as a real subprocess against a stub `db.php`.

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
does not carry to the next one. The next deployment, whenever it is approved,
must apply `migrations/2026-08-28-create-quotation-revisions.sql` **first**.

---

## SUPERSEDED VALUES

Recorded so a checker can recognise them as stale rather than re-deriving them.
**Never quote any of these as current.**

| | superseded |
|---|---|
| Assertion totals | 3,334 · 3,482 · 3,679 · 3,799 · 3,827 · 3,958 · 4,070 · 4,172 · 4,263 · 4,305 · 4,399 · 4,549 · 4,734 · 4,822 |
| Deltas | +734 · +869 · +989 · +1,017 · +1,148 · +1,260 · +1,362 · +1,453 · +1,495 · +1,589 · +1,739 · +1,924 · +2,012 |
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
| Application commit | `1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a` — superseded by `631cb89` when SNAPSHOT REVISION WRITER was accepted |

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
