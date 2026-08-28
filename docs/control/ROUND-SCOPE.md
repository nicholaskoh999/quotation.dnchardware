# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**READ-BEFORE-WRITE / TRANSACTION FOUNDATION**

One transaction around a quotation mutation, and a persisted read that happens
inside it. No revision is written, no snapshot is built, no history exists. The
round exists so the Snapshot Revision Writer can later add its INSERT to a
transaction that is already there.

| | |
|---|---|
| Accepted application commit | `1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a` |
| Superseded application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` |
| Deployed application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` — **production has NOT moved** |
| Round status | **FINAL ACCEPTED / CLOSED** |
| DEPLOY = NO | no deployment action was taken in the promotion step |
| STAGE 2 = NOT STARTED | nothing in Stage 2 was begun, examined or implied |
| Production DB change | **NO** |
| Revision writer | **NOT STARTED** — this round writes no revision |

---

## WHY THIS ROUND EXISTS

`update_quotation` read the persisted items, reconciled identity against them,
and then wrote — with no transaction and no lock around any of it:

```php
$sel = prepare_or_fail($db, "SELECT items FROM quotations WHERE id=?", …);   // before
…
$stmt = prepare_or_fail($db, "UPDATE quotations SET …", …);
```

Between those two statements another request could change the very items that
had just been reconciled. Nothing detected it and nothing prevented it. A
revision writer bolted onto that would snapshot a BEFORE state that was already
untrue by the time it wrote.

`save_quotation` had the same shape on the create side: the named lock
serialised number allocation, but the allocation and the INSERT that used it
were not one atomic write.

---

## WHAT CHANGED, IN `api.php`

### The transaction scope, and why `fail_json()` had to learn about it

The hard part was never `BEGIN` and `COMMIT`. It is that `query_or_fail()`,
`prepare_or_fail()`, `execute_or_fail()` and the 1062 retry all end the request
through `fail_json()`, which echoes and exits — and an exit inside an open
transaction leaves the rollback to the connection closing, and the named lock
to the same. That works. It is not a contract; it is a side effect of the
process dying.

So the scope is recorded as the request runs and `fail_json()` unwinds it
explicitly before it answers:

```php
dc_txn_begin() / dc_txn_commit() / dc_txn_rollback()
dc_txn_note_lock()      ← acquire_ref_lock / release_ref_lock report in
dc_txn_cleanup()        ← rollback, THEN release the named lock
```

Every existing error path became transaction-safe **without one call site
changing**, which is also why this round did not have to touch the helpers
PROJECT-GUARDRAILS protects. They still branch on return values; there is still
no `try`/`catch` in the application.

**The two levels are tracked separately on purpose.** `GET_LOCK` is SESSION
scoped and the transaction is not: `COMMIT` does not release a named lock and
`ROLLBACK` does not either. Merging them would be wrong in both directions.

### CREATE

```
validate → mint item identity → GET_LOCK → BEGIN → allocate ref_no
        → INSERT (one 1062 retry) → COMMIT → RELEASE_LOCK → respond
```

**COMMIT happens before the lock is released.** The lock exists to stop a second
request allocating the same number; letting go of it while the INSERT is still
uncommitted would hand out a number that is not yet taken.

If `BEGIN` fails, the lock is given back and nothing is attempted. If the INSERT
fails, `fail_json()` rolls back and releases before answering. If `COMMIT` fails
it is reported as a failure — never as success.

### UPDATE

```
validate → BEGIN → SELECT * … FOR UPDATE → reconcile against THAT row
        → UPDATE → COMMIT → respond
```

`dc_lock_quotation_for_update($db, $id)` returns the whole row, not the one
column reconciliation needs. That is deliberate: it is the authoritative BEFORE
state, and reading it twice — once to reconcile, once for a future snapshot —
would reintroduce exactly the gap this function closes.

Every refusal past `BEGIN` rolls back explicitly: not found → 404 and rollback;
malformed, unknown, duplicated or backfill-required identity → rollback and the
existing error by name.

---

## WHAT THE LOCK DOES, AND WHAT IT DOES NOT

The accepted claim is narrow, and stated narrowly on purpose:

> Two UPDATE transactions cannot hold the same quotation row at once. The second
> waits until the first commits or rolls back.

That is what gives a future revision writer a deterministic persisted BEFORE
state.

**This is NOT optimistic concurrency.** A browser holding a stale copy can still
overwrite a newer edit, because nothing here compares versions. No version
column was added and no conflict is detected. Any claim that "stale browser
edits can no longer overwrite newer edits" would be false, and this round does
not make it.

---

## ALLOWED TO CHANGE

```candidate-files
```

The block is **EMPTY**. This round is closed: `api.php`,
`tests/php/transaction_foundation.test.php`, `tests/php/mysqli_compat.test.php`
and `tests/php/item_identity.test.php` were reviewed and accepted into
`1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a`, so nothing may now differ from the
accepted commit.

`api.php` was the only application file, and the close-out shows the diff rather
than asserting it.

`index.php`, `companies.php`, `auth.php`, `login.php`, `logout.php`,
`pricing_history.php`, `ai_extract.php` and all forty browser suites are out of
scope and do not change.

### The two accepted suites this round had to touch, and why

Both are recorded here rather than slipped in, because editing an accepted test
is exactly the move that should be visible.

**`mysqli_compat.test.php` — a lifted dependency, no assertion changed.** The
suite lifts `fail_json()` out of the shipped file and evaluates it, in the
parent and again in a child process. `fail_json()` now calls
`dc_txn_cleanup()`, so lifting one without the other evaluates a `fail_json`
that cannot run — it died with *undefined function*, not with a failed
assertion. Both lift sites now take the dependency too. **Every assertion is
identical**: a query, prepare or execute failure still has to return parseable
JSON with the existing message and no fatal.

**`item_identity.test.php` — one assertion followed a contract this round
supersedes.** It asserted the literal text `SELECT items FROM quotations WHERE
id=?` under the label *"reading the minimum it needs — one column, one row"*.
That was the right contract for Item Identity and is the wrong one now: the read
is deliberately no longer minimal, because it is the BEFORE state. The single
assertion is replaced by **four**, which ask for more than it did — that the
read goes through `dc_lock_quotation_for_update`, that it is `FOR UPDATE`, that
the transaction was opened *before* it, and that the old unlocked read is gone.
Not weakened; tightened, and pointed at the contract that now holds.

---

## MUST NOT CHANGE — AND DOES NOT

`ref_no` format · server-side allocation · `GET_LOCK` / `RELEASE_LOCK` ·
`uq_quotations_ref` · `NOT NULL ref_no` · **exactly one** 1062 retry ·
`mysqli_report(MYSQLI_REPORT_OFF)` · the return-value-and-errno helpers ·
`item_uid` minting and reconciliation · Actor Identity · pricing · Quick Add ·
the parser · the translation dictionary · `delete_quotation`.

The named lock was **not** replaced by row locking, and row locking was not
extended to the create path. `update_quotation` still does not touch `ref_no`.
No retry loop was introduced.

---

## OUT OF SCOPE — NAMED, SO THEY ARE NOT DRIFTED INTO

No revision rows · no reference to `quotation_revisions` from application code ·
no snapshot construction · no diff engine · no no-op suppression · no history
API · no history UI · no baseline or deletion policy · no Delete UI · no
optimistic concurrency or version field · no foreign keys · no triggers · no
production migration · no deployment.

`delete_quotation` is untouched; deletion history belongs to Baseline / Delete
Policy.

```
Revision Storage Foundation                     ACCEPTED / CLOSED
Read-before-write / Transaction Foundation      ← this round
→ Snapshot Revision Writer
→ Diff Engine / No-op Suppression
→ Baseline / Delete Policy
→ History API
→ History UI
```

---

## ACCEPTANCE — WHAT MUST BE TRUE TO CLOSE

- CREATE and UPDATE are both transactional, and the UPDATE's persisted read is
  inside its transaction and held `FOR UPDATE`
- COMMIT precedes `RELEASE_LOCK` on the create path
- every handled failure after `BEGIN` rolls back explicitly, and leaves the
  quotation byte-identical
- a refused `COMMIT` is never reported as success; a refused `BEGIN` writes
  nothing
- the named lock is released explicitly on success and on handled failure —
  proven while the session is still open, not by the connection closing
- two transactions cannot hold the same quotation row; a different row is not
  blocked
- item identity, `ref_no`, the 1062 retry and `delete_quotation` all behave
  exactly as before
- no application reference to `quotation_revisions` exists
- the full browser matrix runs, with its result recorded as measured

---

## MEASURED ON THIS CANDIDATE

Filled in from the runs, not carried over. **None of these are canonical** —
CANONICAL-STATE still describes `649f80a`, and a candidate does not touch it.

### Targeted — the transaction suite

| | |
|---|---:|
| `tests/php/transaction_foundation.test.php` on MySQL **8.0.46**, the production engine | **85 / 0** |
| the same suite on MySQL **8.4.3** | **85 / 0** |

Three kinds of evidence, because no one kind covers a transaction. The shipped
`api.php` is copied byte-identically into a sandbox beside a stub `auth.php` and
`db.php` and **served over real HTTP by PHP's built-in server**, so
`save_quotation` and `update_quotation` run against real MySQL with a real
request body. `dc_txn_*` and `dc_lock_quotation_for_update` are lifted from the
shipped file and driven directly, including against a stub driver for the two
failures a real server will not produce on demand — `BEGIN` refused and `COMMIT`
refused. Statement ORDER is read out of the source, because "the read is inside
the transaction" is a claim about sequence and nothing else can prove it.

The row lock is measured on two real connections: A holds a quotation
`FOR UPDATE`; B is refused the same row and times out; B takes a *different*
quotation immediately; A commits; B then takes the first row. The named lock is
proven released **while the session is still open**, so the proof is the code
giving it back and not the connection closing.

### Existing PHP suites, re-run against the changed `api.php`

| | |
|---|---:|
| save retry | 42 / 0 |
| mysqli compatibility | 94 / 0 |
| item identity | **159** / 0 (was 156 — see the four replacing one, above) |
| pricing / history | 172 / 0 |
| AI extraction | 107 / 0 |
| revision storage | 198 / 0 |
| actor identity | 150 / **1** — the known PHP 8.4 bcrypt-cost artifact |

Actor identity's single failure is the deliberately runtime-relative assertion
recorded in CANONICAL-STATE: the decoy hash's cost against what
`PASSWORD_DEFAULT` produces, which needs PHP 8.4 and gets 10 on this 8.3.30
machine. Unrelated to this round and not to be relaxed.

### Full browser matrix — run, because application code changed

| | |
|---|---:|
| Suites | **40** |
| Assertions | **3,936** |
| Failed | **8** |
| Skipped | **0** |
| Elapsed | 901.5s |

**The 8 are the recorded environment exception, unchanged and not one more.**
All in `tests/suites/38-mobile-ui.test.js`, all on the `companies.php` modal
close control at 1440 / 980 / 700 / 600px — 27 tall where 24 was accepted, 16.3
wide where 17 was. Font metrics on this Windows Chromium against a matrix
measured in a Linux sandbox; `companies.php` is untouched by this round, and
CANONICAL-STATE's `tests.browserFailureException` already records the same
eight, reproduced on `ce26146`.

**This is not being restated as 0 failed.** 3,928 of 3,936 pass; the remaining
8 have not been measured on a runtime that can settle them, and the transaction
change added none of them.

`php -l` clean on every PHP file.

---

## OUTCOME — FINAL ACCEPTED / CLOSED

Accepted on 2026-08-28. `main` was fast-forwarded from `77a788e` to
`1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a` — one commit, no merge commit, no
rebase, no force push.

| | |
|---|---:|
| Accepted application commit | `1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a` |
| Browser suites | 40 |
| Browser assertions | 3,936 — **3,928 passed, 8 failed**, 0 skipped |
| Transaction foundation, MySQL **8.0.46** | 85 / 0 |
| Transaction foundation, MySQL **8.4.3** | 85 / 0 |
| Side suites | 172 · 107 · 62 · 15 · 42 · 94 · 150 · **159** · **85** |
| Total assertions | **4,822** (+2,012 on the 2,810 baseline) |
| Translation | 862 keys, 100% |

**The 8 failures are recorded, not rounded away.** The same
`38-mobile-ui` `companies.php` modal-close metrics at the same four widths,
already in CANONICAL-STATE and reproduced on `ce26146` before this round
existed — re-measured here with the transaction change in place and returning
the same eight. This round added none and fixed none.

**Item identity reads 159, not 156,** because one assertion that measured a
superseded contract became four stricter ones. The total is recalculated from
the evidence, not carried over.

**ACCEPTED IS NOT LIVE.** Production still runs
`649f80a09f83a7201c0f3772e01fc270ccda3e05`, the Item Identity build. The
transaction foundation exists in source only.

- transaction foundation in production — **NOT DEPLOYED**
- `migrations/2026-08-28-create-quotation-revisions.sql` — **NOT APPLIED**
- revision writer — **NOT STARTED**; no application file mentions
  `quotation_revisions`
- `delete_quotation` — unchanged

**Next: SNAPSHOT REVISION WRITER**, which is NOT started. It is the round that
finally adds the INSERT this one made a safe place for.
