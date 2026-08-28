# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**REVISION STORAGE FOUNDATION**

One table. Somewhere immutable quotation snapshots can live, and nothing that
writes one. No writer, no hooks, no transaction redesign, no diff engine, no
history API, no history UI, no backfill, no deletion policy, no deployment, no
production DB change.

| | |
|---|---|
| Accepted application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` |
| Deployed application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` — live, verified 2026-08-28 |
| Round status | **CANDIDATE — READY FOR REVIEW** |
| DEPLOY = NO | a candidate is not a deployed state |
| STAGE 2 = NOT STARTED | nothing in Stage 2 was begun, examined or implied |
| Production DB change | **NO** — the migration is prepared, NOT APPLIED |
| Revision writer | **NOT STARTED** — storage only |

---

## WHY THIS ROUND EXISTS

Two of the three questions are answered and live in production.

```
Actor Identity   →  WHO is asking          app_users, dc_current_user()
Item Identity    →  WHICH ITEM             item_uid, inside the items JSON
Revision Storage →  WHERE the past lives   ← this round
```

Nothing keeps the previous state. Every save overwrites the quotation row in
place:

```php
UPDATE quotations SET company_id=?,quote_date=?,…,items=?,…  WHERE id=?
```

So the answer to *what did this change* is currently: gone. This round adds the
place a snapshot can be kept. It does not put anything in it.

---

## THE TABLE

`quotation_revisions`, created by
`migrations/2026-08-28-create-quotation-revisions.sql`.

| column | type | why |
|---|---|---|
| `id` | `BIGINT UNSIGNED NOT NULL AUTO_INCREMENT` | the revision row's own identity |
| `quotation_id` | `INT UNSIGNED NOT NULL` | logical reference to `quotations.id`, matching its observed type |
| `revision_no` | `INT UNSIGNED NOT NULL` | monotonic **per quotation**, from 1 |
| `quotation_ref_no` | `VARCHAR(100) NOT NULL` | the number as it was; a lookup aid, and what still names the quotation after its row is deleted |
| `event_type` | `VARCHAR(32) NOT NULL` | a label. **Not an ENUM, not constrained** |
| `actor_user_id` | `INT UNSIGNED NULL` | matches `app_users.id` |
| `actor_username` | `VARCHAR(64) NULL` | snapshot, so a rename cannot rewrite the past |
| `actor_display_name` | `VARCHAR(100) NULL` | the same |
| `snapshot_schema_version` | `SMALLINT UNSIGNED NOT NULL` | **no default** — a writer must state the format it wrote |
| `snapshot_json` | `JSON NOT NULL` | the whole quotation, validated by the column |
| `created_at` | `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` | see below |

```
PRIMARY KEY (id)
UNIQUE KEY  uq_quotation_revisions_no       (quotation_id, revision_no)
KEY         idx_quotation_revisions_ref     (quotation_ref_no)
KEY         idx_quotation_revisions_actor   (actor_user_id)
KEY         idx_quotation_revisions_created (created_at)
ENGINE=InnoDB, no CHARACTER SET clause — the table inherits the database default
```

**No item table.** Item identity stays inside the snapshot JSON, exactly as it
lives inside `quotations.items` today. `snapshot_json` is queryable, so
`JSON_EXTRACT(snapshot_json, '$.items[0].item_uid')` reads it back — proven in
the suite.

### Four choices worth arguing about

**`DATETIME`, not `TIMESTAMP`, and it deviates from `app_users` on purpose.**
`TIMESTAMP` stops in 2038, and this is the one table designed never to be
rewritten. It is also converted by the *session* time zone: `api.php` sets
`+08:00` per request but the CLI migrations connect without setting it, so the
same instant written by one path and read by another would not agree.
`DATETIME` stores the literal value it was given.

**`snapshot_schema_version` has no default.** A default would let a future
format be stored silently under the old number, and the one thing a version
column must never do is be wrong. Omitting it fails the insert — proven.

**`event_type` is a plain `VARCHAR`.** This round stores history; it does not
decide which events exist. Widening an `ENUM` or a `CHECK` later is a migration
against a table that by then holds real history, so the cheap thing now is to
decide nothing.

**No standalone index on `quotation_id`.** It is the leftmost column of the
`UNIQUE`, so MySQL already uses that index for lookups by quotation. A second
index on the same prefix costs writes and buys nothing. Its absence is
asserted, so it reads as a decision rather than an omission.

---

## NO FOREIGN KEYS — A DECISION, NOT MISSING WORK

`quotation_id` is a **logical, immutable reference**. There is no FK to
`quotations`, because every available action is wrong today:

| | |
|---|---|
| `ON DELETE CASCADE` | destroys the history of a deleted quotation — the exact record that makes a deletion auditable |
| `ON DELETE RESTRICT` | changes today's deletion behaviour, which is an application change this round is not scoped for |
| `ON DELETE SET NULL` | orphans a revision from the thing it describes, permanently |

The application can physically delete quotations today, and what history should
do about that is the **Baseline / Delete Policy** round. Choosing an FK action
now would decide that policy by accident, in DDL, where nobody would look for
it. `quotation_ref_no` is stored alongside precisely so a revision still names
its quotation once the row is gone — proven in the suite by deleting one.

No FK to `app_users` either, until user-retention policy is decided. Rows there
are never deleted today (`enabled = 0` instead), but that is a convention, not
a constraint, and history must survive it changing.

---

## APPEND-ONLY IS A CONTRACT, NOT A TRIGGER

A revision, once written, is never updated and never deleted. That is **not**
enforced with `BEFORE UPDATE` / `BEFORE DELETE` triggers, deliberately:
triggers on this shared host need privileges the project has not established,
they are awkward to inspect and reverse, and a trigger that refuses a `DELETE`
would also refuse the Baseline / Delete Policy round its own decisions.

The contract is stated here and in the migration header. The **Snapshot
Revision Writer** round enforces it the way the rest of this application
enforces things — by there being exactly one `INSERT` and no `UPDATE` or
`DELETE` in the code.

---

## ALLOWED TO CHANGE

```candidate-files
migrations/2026-08-28-create-quotation-revisions.sql
tests/php/revision_storage.test.php
```

Nothing else may differ from `649f80a09f83a7201c0f3772e01fc270ccda3e05`.

**No application file is touched by this round.** `api.php`, `index.php`,
`companies.php`, `pricing_history.php`, `ai_extract.php`, `auth.php`,
`login.php`, `logout.php` and all forty browser suites are out of scope and do
not change. The suite asserts it: `api.php` contains no revision *code*, and
its only mention of the word is a comment saying there is none.

---

## MUST NOT CHANGE — AND DOES NOT

`ref_no` format · server-side allocation · `GET_LOCK` · `uq_quotations_ref` ·
`NOT NULL ref_no` · the one-time 1062 retry · `mysqli_report(MYSQLI_REPORT_OFF)`
· `item_uid` and its reconciliation · Actor Identity · quotation create /
update / delete semantics · pricing · Quick Add · the parser · the translation
dictionary.

`quotations` and `app_users` are not altered, and the suite proves it by
fingerprinting both with `SHOW CREATE TABLE` before and after.

---

## OUT OF SCOPE — NAMED, SO THEY ARE NOT DRIFTED INTO

No save/update hook · no revision writer · no transaction redesign · no
read-before-write redesign · no diff engine · no no-op suppression · no history
API · no history UI · no baseline backfill · no deletion-history policy · no
quotation delete UI · no production migration · no deployment.

**The missing Saved Quotation delete UI is a separate future item** and is
deliberately not mixed into this round.

The sequence, unchanged:

```
Revision Storage Foundation          ← this round
→ Read-before-write / Transaction Foundation
→ Snapshot Revision Writer
→ Diff Engine / No-op Suppression
→ Baseline / Delete Policy
→ History API
→ History UI
```

---

## THE MIGRATION

Five sections, in the shape the accepted `app_users` and `NOT NULL(ref_no)`
migrations established:

1. **PREFLIGHT**, read-only. Reads the real types of `quotations.id`,
   `quotations.ref_no` and `app_users.id` from `information_schema` rather than
   assuming them, reads the database's default collation, and gates on
   `quotation_revisions` not already existing.
2. **CREATE TABLE IF NOT EXISTS**, between `-- >>> SECTION 2 BEGIN` / `-- <<<
   SECTION 2 END` markers. Those markers are load-bearing: the test lifts
   exactly that block out of the shipped file and executes it, so the test
   measures the migration that ships rather than a copy of it.
3. **VERIFY**, read-only — columns, indexes, row count, and the collation
   check below.
4. **RE-RUNNING**, stated: `IF NOT EXISTS` makes section 2 safe twice, and
   sections 1 and 3 are read-only.
5. **ROLLBACK**, commented out. While the table is empty, dropping it reverses
   the migration completely — one practical benefit of having added no FK.

**The collation trap, and how section 3a answers it.** `quotation_ref_no` will
be compared against `quotations.ref_no`, and MySQL refuses to compare columns
whose collations differ. On MySQL 8 the database default is often
`utf8mb4_0900_ai_ci` while an older table is `utf8mb4_general_ci` — same
charset, different collation, and the join dies with *Illegal mix of
collations*. Section 2 inherits the database default (as `app_users` does);
section 3a then compares the two columns and **generates** the exact `ALTER`
that fixes it, taking the type from the column rather than restating it — the
same "generate, don't hand-type" discipline the `NOT NULL(ref_no)` migration
used. The suite runs that generated statement and proves the join works
afterwards.

---

## ACCEPTANCE — WHAT MUST BE TRUE TO CLOSE

- the table is created cleanly, and a second run is safe
- it starts **empty**, and nothing writes to it
- `quotations` and `app_users` are identical in definition afterwards
- exactly one table is created
- `UNIQUE (quotation_id, revision_no)` is enforced; the same `revision_no` is
  allowed for **different** quotations and rejected for the **same** one
- `snapshot_json` accepts valid JSON, rejects invalid, and is queryable as JSON
- `snapshot_schema_version` is present and cannot be omitted
- the logical quotation reference survives the quotation row being deleted
- no revision writer exists anywhere in the application
- `api.php` and `index.php` behaviour unchanged
- production untouched

Then STOP. **No deploy. No production DB change.** Candidate only.

---

## MEASURED ON THIS CANDIDATE

| | |
|---|---:|
| `tests/php/revision_storage.test.php` | **103 assertions, 0 failed** |
| Server it ran against | MySQL **8.4.3** |
| Production target | MySQL **8.0.46** |

The suite creates its own throwaway database, does everything inside it, drops
it, and refuses to run against a schema it did not create. It **fails** rather
than skips when no MySQL is reachable: a schema test that did not run must not
read as one that passed.

**Not re-run, and why:** the forty-suite browser matrix. No application byte
changed — `git diff` over `*.php` outside `tests/` and `migrations/` is empty —
so re-running it would only reproduce the eight recorded `38-mobile-ui`
environment failures. `php -l` is clean on both new files.

**The version gap, stated rather than glossed:** this was verified on MySQL
8.4.3 because that is what is available locally; production is 8.0.46. Every
feature used — native `JSON` with validation, `BIGINT UNSIGNED`,
`SMALLINT UNSIGNED`, `DATETIME DEFAULT CURRENT_TIMESTAMP`, composite `UNIQUE`,
`CREATE TABLE IF NOT EXISTS` — behaves identically on both, and section 1 of
the migration re-reads the real environment before section 2 runs anyway.
