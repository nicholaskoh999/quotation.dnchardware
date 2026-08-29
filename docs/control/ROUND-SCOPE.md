# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**SNAPSHOT REVISION WRITER**

The first real revision writer. A quotation mutation and its immutable full
snapshot are one atomic transaction: both land, or neither does. No diff, no
no-op suppression, no baseline, no delete revision, no history API, no history
UI, no production migration, no deployment.

| | |
|---|---|
| Accepted application commit | `631cb8945406a934b351e476ec71330ed23a2d27` |
| Accepted candidate | `631cb8945406a934b351e476ec71330ed23a2d27` — promoted to `main` by fast-forward, no merge commit |
| Previous accepted commit | `1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a` — superseded, never to be quoted as current |
| Deployed application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` — production has not moved |
| Round status | **FINAL ACCEPTED / CLOSED** |
| DEPLOY = NO | accepted is not deployed, and this one cannot be deployed until the migration is applied |
| STAGE 2 = NOT STARTED | nothing in Stage 2 was begun, examined or implied |
| Production DB change | **NO** — `quotation_revisions` is still NOT APPLIED to production |
| Next round | DIFF ENGINE / NO-OP SUPPRESSION — **NOT STARTED** |

---

## WHY THIS ROUND EXISTS

Three rounds built the pieces. This one joins them.

```
Actor Identity     WHO      dc_current_user()      live in production
Item Identity      WHICH    item_uid               live in production
Revision Storage   WHERE    quotation_revisions    accepted, not applied
Transaction Fdn    WHEN     one transaction        accepted, not deployed
Snapshot Writer    WHAT     ← this round
```

Until now nothing wrote a revision. The table existed and stayed empty by
design. This round makes every successful `save_quotation` and
`update_quotation` record exactly one immutable snapshot of what was actually
persisted, inside the transaction that persisted it.

---

## WHAT WAS BUILT, IN `api.php`

```
CREATE   GET_LOCK → BEGIN → allocate → INSERT quotation (one 1062 retry)
                  → read back → write ONE revision → COMMIT → RELEASE_LOCK
UPDATE   BEGIN → SELECT * … FOR UPDATE → reconcile → UPDATE quotation
                  → read back → write ONE revision → COMMIT
```

The revision INSERT is **before** `COMMIT` on both paths, so a quotation and its
history commit together or not at all. Every failure inside the writer goes
through `fail_json()`, which the Transaction Foundation already made unwind the
scope — so a revision that cannot be written **takes the quotation change down
with it**.

### The snapshot is of persisted fact, not of request intent

The row is read back out of the database after the mutation, inside the same
transaction. What is recorded is what the server actually stored: the `ref_no`
the allocator chose, the `quote_date` it defaulted, the `item_uid` values it
minted, the total it wrote. Snapshotting `$input` would record what the browser
asked for, which is a different and much less useful fact.

`snapshot_schema_version = 1` names this shape:

```
quotation { id, ref_no, company_id, company_name, customer_name,
            customer_phone, quote_date, valid_until, prepared_by,
            remarks, total_amount, created_at }
items      [ … every persisted item, each carrying its item_uid … ]
item_count n
```

**`company_name` is FROZEN.** Resolved through the same `LEFT JOIN companies`
the read paths use, and stored in the snapshot. Renaming a company later must
not rewrite what the document said — the same reason Actor Identity snapshots
the username beside the id.

**The version lives in the COLUMN, not inside the JSON.** Two copies of one
fact can disagree, and the accepted storage contract already gave it a column.

**No item table.** Item identity stays inside `snapshot_json`, exactly as it
lives inside `quotations.items`.

### The actor is the session, and `prepared_by` is not the actor

`actor_user_id` / `actor_username` / `actor_display_name` come from
`dc_current_user()` and from nowhere else. All three are NULL when no signed-in
person is behind the request, because a placeholder id would be a lie.

`prepared_by` is a **field of the document** — whose name is printed on the
quotation. It is kept in the snapshot as that, and is never written to an actor
column. The suite proves the two are different values and that neither actor
field carries it.

### `revision_no`

`COALESCE(MAX(revision_no), 0) + 1` for that quotation, **inside the
transaction**. On the update path the quotation row is already held `FOR
UPDATE`, so two updates of one quotation are serialised and cannot read the same
`MAX`; on the create path the row was just inserted by this transaction and
nobody else can see it. `UNIQUE (quotation_id, revision_no)` is the backstop
that turns a mistake here into a refused write rather than a silently duplicated
history. Proven under two concurrent updates of the same quotation.

### Append-only, enforced by the code

Exactly **one** `INSERT INTO quotation_revisions` in the whole application, and
no `UPDATE`, `DELETE` or `TRUNCATE` against it anywhere. That is how the storage
round said it would be enforced, having deliberately declined to add a trigger.

---

## THE DEPLOYMENT ORDER THIS CREATES

**`migrations/2026-08-28-create-quotation-revisions.sql` must be APPLIED to
production BEFORE this application is deployed.**

The table is required. With it absent, a save FAILS and rolls back. That is not
an oversight and must not be softened into a fallback: a save that worked but
kept no history is precisely the state this round exists to make impossible.
The failure mode is safe — the save is refused, nothing partial is written — but
it is a hard ordering constraint and it is proven in the suite by dropping the
table and watching a save be refused with no quotation row created.

---

## THE 1062 RETRY, BROKEN BY A PREVIOUS ROUND AND FIXED HERE

This was reported as a finding and returned as a **BLOCKER**: the retry is part
of this round's acceptance gate, so it is fixed in this candidate. The defect
was not in the revision writer; it was in READ-BEFORE-WRITE / TRANSACTION
FOUNDATION, and this round's tests are what surfaced it.

### What was wrong

MySQL's default isolation is REPEATABLE READ, which gives a transaction one
consistent snapshot at its first read and never moves it. When another session
commits the `ref_no` the allocator is about to use:

- the INSERT is refused with **1062**, because writes always see the latest
  state;
- but `next_free_ref_no()`'s plain `SELECT` still reads the **original
  snapshot** and returns **the same number**;
- so the retry collides again and the one permitted attempt is spent.

Demonstrated directly: inside a transaction, a plain `SELECT` reports the row
absent while an `INSERT` of that very row is refused with 1062.

The retry accepted at `86cf262` became unreachable the moment `save_quotation`
was wrapped in a transaction, and nothing said so. It failed closed, which is
why it went unnoticed — a refused save with a duplicate-key message rather than
anything visibly wrong.

### The fix

The **create** transaction now opens at **READ COMMITTED**:

```php
dc_txn_begin($db, true)     →  SET TRANSACTION ISOLATION LEVEL READ COMMITTED
                               START TRANSACTION
```

READ COMMITTED takes a fresh snapshot for each consistent read, so the
reallocation sees the row it collided with and takes the next free number. That
is the whole change: one optional argument, one `SET TRANSACTION`, one call
site.

**Why this is safe here.** The create transaction never reads the same thing
twice expecting it not to move. It allocates a number, inserts, and — if
refused — allocates again, which is precisely the read that MUST move.
Allocation is already serialised by `DC_REF_LOCK`, so nothing changes for
ordinary concurrent saves; this only lets the retry see reality in the rare case
something **outside** that lock took the number.

**Why it is not applied everywhere.** The update path stays at the server
default. It depends on `SELECT … FOR UPDATE`, which is a locking read and
already sees the latest committed state, so it has nothing to gain — and its
accepted read-before-write behaviour is not disturbed by a change it does not
need.

**Scope of the setting.** `SET TRANSACTION` without `SESSION` or `GLOBAL`
applies to the next transaction only. Neither the session nor the server is
changed, and the suite asserts that no `SET SESSION` or `SET GLOBAL` form
appears anywhere.

### Proven, not argued

The suite runs a **real** race — another connection holds the number
uncommitted, the request blocks on the duplicate key, the other connection
commits, MySQL raises a genuine 1062 — and asserts that the save now
**succeeds** on `Q-YYYY-0002`, that **exactly one** revision was written rather
than one per attempt, that it is numbered 1 and recorded as a `create`, that it
carries the `ref_no` the retry **settled on** rather than the one it first
tried, and that **no revision claims the number the first attempt lost**. On
MySQL 8.0.46 — the production engine — and on 8.4.3.

---

## ALLOWED TO CHANGE

```candidate-files
```

**EMPTY, because the round is closed.** Those four files —

```
api.php
tests/php/revision_writer.test.php
tests/php/transaction_foundation.test.php
tests/php/revision_storage.test.php
```

— were what this round declared, and they are now part of the accepted commit
`631cb89`. Nothing may differ from it. `api.php` was the only deployed
application file, and no browser suite changed.

### The two accepted suites this round had to maintain

Both for the same reason, and both recorded rather than slipped in.

**They asserted the writer did not exist.** `transaction_foundation` asserted
`api.php` mentions neither `quotation_revisions` nor `snapshot_json`;
`revision_storage` asserted it contains no revision code at all. Those were each
round's own out-of-scope guard and were correct while the writer did not exist.
This round starts it by authorisation, so both guards are replaced by the
contract that now holds — exactly one `INSERT`, never an `UPDATE` or `DELETE`,
the writer inside the transaction, and every *other* application file still
innocent of the table. Stricter than the absence they replaced.

**`transaction_foundation` also needed its fixture completed.** Its schema had
no `companies` and no `quotation_revisions`, so with the writer in place every
save in it failed and the suite died on a null. A fixture that lacks what a
successful save touches measures a missing table, not the transaction it is
about. Both tables were added, the revision one lifted from the shipped
migration so it cannot drift, and its stub `dc_current_user()` now answers with
an actor. **No assertion was weakened**; the suite went from 85 to 92
assertions.

While fixing it, one real hygiene defect: the suite's web server was only
stopped at the foot of the file, so a fatal error leaked it. A leaked server
keeps the port, the next run's readiness check succeeds against the *stale*
server, and the run then talks to a deleted sandbox — which looks exactly like a
hang and cost real time here. Both HTTP suites now stop the server from a
shutdown handler.

---

## MUST NOT CHANGE — AND DOES NOT

`ref_no` format · server-side allocation · `GET_LOCK` and its release ordering ·
`uq_quotations_ref` · **exactly one** 1062 retry — still one, still only 1062,
still no loop; what changed is that it can now see what it collided with ·
`SELECT … FOR UPDATE` · `item_uid` reconciliation ·
Actor Identity · pricing · Quick Add · the parser · the translation dictionary ·
`delete_quotation`, which writes no revision and is untouched.

---

## OUT OF SCOPE — NAMED, SO THEY ARE NOT DRIFTED INTO

No diff engine · no structured before/after · **no no-op suppression — an
UPDATE with unchanged business data still writes an UPDATE revision in this
round, deliberately** · no baseline backfill · no DELETE revision · no restore ·
no soft delete · no delete policy · no History API · no History UI · no delete
UI · no revision browsing · no optimistic concurrency · no production migration
· no deployment.

```
Snapshot Revision Writer            ← this round
→ Diff Engine / No-op Suppression
→ Baseline / Delete Policy
→ History API
→ History UI
```

---

## MEASURED, AND NOW CANONICAL

Filled in from the runs, not carried over. **These figures are now canonical**:
CANONICAL-STATE describes `631cb89`, the totals were recalculated from this
evidence rather than copied forward, and `4,822` / `+2,012` are recorded as
retired.

```
  3,936 browser + 172 + 107 + 62 + 15 + 42 + 94 + 150 + 159 + 92 + 101 = 4,930
  4,930 - 2,810 = +2,120
```

Two figures moved: the writer is a tenth side group of **101**, and transaction
foundation went **85 → 92**. Revision storage stayed 198 and stays out of the
total, because it measures a migration rather than the application.

### Targeted — the revision writer

| | |
|---|---:|
| `tests/php/revision_writer.test.php` on MySQL **8.0.46**, the production engine | **101 / 0** |
| the same suite on MySQL **8.4.3** | **101 / 0** |

The shipped `api.php` is copied byte-identically into a sandbox and served over
real HTTP; the revision table is lifted from the shipped migration, so the suite
cannot pass against a schema the migration would not produce. What is measured
is the database afterwards.

### Every other PHP suite, against the changed `api.php`

| | |
|---|---:|
| transaction foundation | **92 / 0** (was 85 — fixture completed, guards superseded) |
| revision storage | 198 / 0 |
| item identity | 159 / 0 |
| mysqli compatibility | 94 / 0 |
| pricing / history | 172 / 0 |
| AI extraction | 107 / 0 |
| save retry | 42 / 0 |
| actor identity | 150 / **1** — the known PHP 8.4 bcrypt-cost artifact |

`auth_identity`'s single failure is the deliberately runtime-relative assertion
recorded in CANONICAL-STATE: it needs PHP 8.4 and gets cost 10 on this 8.3.30
machine. Unrelated to this round, and **not** restated as 150 / 0.

The shipped side logs are this round's runs:
`FULL-AUDIT/regression-evidence/revision-writer-php.log` is new at 101, and
`transaction-foundation-php.log` was regenerated at 92.

### Full browser matrix — run, because application code changed

| | |
|---|---:|
| Suites | **40** |
| Assertions | **3,936** — 3,928 passed |
| Failed | **8** |
| Skipped | **0** |
| Elapsed | 908.1s |

**A ninth failure appeared once and was chased down rather than waved through.**
The first matrix run on this candidate reported 9: the known eight plus
`35-edit-mode` — *"O: clearing it back to the default lets the session close"*.
Because the acceptance gate says any new application regression blocks the
candidate, it was treated as one until proven otherwise.

| run | tree | failures |
|---|---|---:|
| 1 | candidate | 9 — the known 8 plus `fast edit` |
| 2 | candidate | **8** |
| 3 | **pristine worktree at `1ca6554`**, no writer at all | **8** |
| 5 × | candidate, suite 35 alone | **0** |

And the mechanism is closed, not merely unobserved: `index.php`, `tests/suites`
and `tests/lib` are byte-identical to the accepted commit, and the harness
**intercepts every `api.php` request and answers it from a stub table** — the
matrix never executes the one file this round changed. A differing browser
result therefore cannot be caused by it.

**Recorded as an observation, not fixed here:** the assertion sits at the end of
a chain of `typeCell()` / `wqaEditDone()` pairs that — unlike the ones above it —
carry no settle wait, so under full-matrix load the input event can still be in
flight when `wqaEditDone()` is asked. `tests/suites` is out of scope for this
round and was not touched. Worth a settle wait in whichever round next has
reason to open that file.

**The 8 are the recorded environment exception, unchanged and not one more.**
All in `38-mobile-ui`, all the `companies.php` modal close control at 1440 /
980 / 700 / 600px. `companies.php` is untouched by this round.
CANONICAL-STATE's `tests.browserFailureException` already records the same
eight, reproduced on `ce26146` before any of this existed.

**No NEW application regression.** That is the acceptance condition, and it
holds: the browser matrix returned the same figures and the same eight, and
every PHP suite is green apart from the pre-existing runtime artifact.

`php -l` clean on every PHP file.

### What the suite proves, in its own words

CREATE — one revision, event `create`, numbered 1, schema version stated;
snapshot equals the persisted row field by field; `item_uid` values equal the
persisted ones; `company_name` frozen; actor from the session; `prepared_by`
present as a document field and **not** substituted for the actor.

UPDATE — one more revision, event `update`, numbered 2 then 3; snapshot is the
state *after* the write; `ref_no` unchanged even when the payload carried a
different one; retained identity preserved, new item minted.

ATOMICITY — a refused mutation writes neither row; a create that fails at the
INSERT leaves nothing; a revision that cannot be written rolls the quotation
mutation back, byte-identical, with the named lock released; with
`quotation_revisions` absent a save is refused rather than silently unrecorded;
no orphan revision, no unrevisioned quotation, no duplicate `(quotation_id,
revision_no)`.

CONCURRENCY — two simultaneous updates of one quotation both succeed and
produce revisions 2 and 3, no collision and no gap.

THE 1062 RETRY — a real race, recovered: the save succeeds on the next number,
exactly one revision is written, it carries the ref_no the retry settled on, and
nothing claims the number the first attempt lost.
