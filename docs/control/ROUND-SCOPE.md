# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**SNAPSHOT REVISION WRITER**

The first real revision writer. A quotation mutation and its immutable full
snapshot are one atomic transaction: both land, or neither does. No diff, no
no-op suppression, no baseline, no delete revision, no history API, no history
UI, no production migration, no deployment.

| | |
|---|---|
| Accepted application commit | `1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a` |
| Deployed application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` — production has not moved |
| Round status | **CANDIDATE — READY FOR REVIEW** |
| DEPLOY = NO | a candidate is not a deployed state |
| STAGE 2 = NOT STARTED | nothing in Stage 2 was begun, examined or implied |
| Production DB change | **NO** — `quotation_revisions` is still NOT APPLIED to production |

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

## A DEFECT FOUND IN A PREVIOUSLY ACCEPTED ROUND

**The one-time 1062 retry cannot recover inside the transaction that
READ-BEFORE-WRITE / TRANSACTION FOUNDATION introduced.** Found by this round's
test, caused by the previous one, and **not fixed here**.

MySQL's default isolation is REPEATABLE READ, which gives a transaction a
consistent snapshot at its first read. When another session commits the `ref_no`
the allocator is about to use:

- the INSERT is refused with 1062, because writes always see the latest state;
- but `next_free_ref_no()`'s plain `SELECT` still reads the transaction's
  original snapshot and returns **the same number**;
- so the single permitted retry collides again and is spent.

Demonstrated directly: inside a transaction, a plain `SELECT` reports the row
absent while an `INSERT` of that very row is refused with 1062.

Before the transaction existed each `SELECT` saw the latest committed data and
the retry recovered. It no longer can.

**Severity, stated plainly.** It fails CLOSED: the save is refused with the
duplicate-key error, nothing partial is written, no wrong number is issued, and
the operator's own retry runs in a fresh transaction with a fresh snapshot and
succeeds. It only fires when something outside `DC_REF_LOCK` — a second
application, an import, a manual insert — takes the exact number this request
chose, which is the rare case the retry was built for in the first place.

**Not fixed in this round**, because the fix is either a change of isolation
level for the save transaction or a change to the allocator's read semantics.
Both are Transaction Foundation decisions with their own consequences, and
widening this round to make them would be exactly the scope creep the brief
forbids. Recorded here for its own round.

The suite therefore proves what is true rather than what was assumed: a real
1062 race leaves **no quotation row and no revision**, and the writer is called
exactly once, after the retrying INSERT returns, with no loop around either.

---

## ALLOWED TO CHANGE

```candidate-files
api.php
tests/php/revision_writer.test.php
tests/php/transaction_foundation.test.php
tests/php/revision_storage.test.php
```

Nothing else may differ from `1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a`.
`api.php` is the only deployed application file. No browser suite changed.

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
`uq_quotations_ref` · the exactly-one 1062 retry (unchanged, and its limitation
is a finding, not an edit) · `SELECT … FOR UPDATE` · `item_uid` reconciliation ·
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

## MEASURED ON THIS CANDIDATE

Filled in from the runs, not carried over. **None of these are canonical** —
CANONICAL-STATE still describes `1ca6554`, and a candidate does not touch it.

### Targeted — the revision writer

| | |
|---|---:|
| `tests/php/revision_writer.test.php` on MySQL **8.0.46**, the production engine | **94 / 0** |
| the same suite on MySQL **8.4.3** | **94 / 0** |

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
machine. Unrelated to this round.

### Full browser matrix — run, because application code changed

| | |
|---|---:|
| Suites | **40** |
| Assertions | **3,936** — 3,928 passed |
| Failed | **8** |
| Skipped | **0** |
| Elapsed | 913.6s |

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
