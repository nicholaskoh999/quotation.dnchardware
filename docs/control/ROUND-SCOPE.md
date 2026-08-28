# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**REVISION STORAGE FOUNDATION**

One table. Somewhere immutable quotation snapshots can live, and nothing that
writes one. No writer, no hooks, no transaction redesign, no diff engine, no
history API, no history UI, no backfill, no deletion policy, no deployment, no
production DB change.

**FINAL ACCEPTED / CLOSED.**

| | |
|---|---|
| Accepted candidate | `b1fd1de7b1623150dcd6d8d609d8014af488f70e` |
| Accepted application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` — **unchanged; this round moved no application file** |
| Deployed application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` — live, verified 2026-08-28 |
| Round status | **FINAL ACCEPTED / CLOSED** |
| DEPLOY = NO | nothing was deployed; `migrations/` and `tests/` are not in the deployed file set |
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
| `quotation_ref_no` | `VARCHAR(100) NOT NULL`, charset and collation **taken from `quotations.ref_no`** | the number as it was; a lookup aid, and what still names the quotation after its row is deleted |
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
```

The block is **EMPTY**. This round is closed:
`migrations/2026-08-28-create-quotation-revisions.sql` and
`tests/php/revision_storage.test.php` were reviewed and accepted into
`b1fd1de7b1623150dcd6d8d609d8014af488f70e`.

**The accepted APPLICATION commit did not move**, and that is the whole point of
this round: it added a migration and a schema suite and changed no application
file. Neither artefact is in `.cpanel.yml`'s `APPFILES`, so neither is deployed.

```
git diff --name-only 649f80a..b1fd1de -- '*.php' ':(exclude)tests/**'   →  (empty)
```

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

**The collation, and the one authoritative answer.** An earlier draft of this
document described two different final schemas — "inherits the database
default" and "section 3a may ALTER it to match". Those are not the same table,
and the ambiguity is now removed. There is exactly one post-migration state:

> `quotation_revisions.quotation_ref_no` has the **same `COLUMN_TYPE`,
> `CHARACTER_SET_NAME` and `COLLATION_NAME` as `quotations.ref_no`.**

Inheriting the database default is only where **section 2** starts, not where
the migration ends. **Section 3 is a required step, not a conditional one**: it
reads the charset and collation off `quotations.ref_no` and generates the
`ALTER`, taking the type from the column rather than restating it — the same
"generate, don't hand-type" discipline the `NOT NULL(ref_no)` migration used.
It is unconditional by design; when the collations already agree it sets them
to what they already are, which is harmless and better than a branch an
operator has to decide about at 11pm. **Section 4a then gates on equality** and
says NO-GO until it holds.

Why it matters: MySQL refuses to compare columns whose collations differ, and
on MySQL 8 the database default is commonly `utf8mb4_0900_ai_ci` while an older
table is `utf8mb4_general_ci` — same charset, different collation, and the join
from a revision to its quotation dies with *Illegal mix of collations*.

The suite models production exactly here: its stand-in `quotations.ref_no` is
`utf8mb4_general_ci` while the test database's default is not, so section 3 has
real work to do. It then asserts all three attributes match, asserts the final
collation is **not** merely the database default, and runs the join.

**The conformance gate — what `IF NOT EXISTS` cannot do.** `CREATE TABLE IF NOT
EXISTS` protects an existing table from replacement; it does **not** tell you
whether the table that is there is the right one. Against a `quotation_revisions`
built by hand, or by an older draft, it succeeds, changes nothing, and leaves
the operator believing the schema above is what they have. That is a silent
pass over a wrong schema.

**CONFORMS means the table is already in the complete authoritative final
state** — not "section 2's `CREATE` looks about right". Section 1b compares
every expected column by name, **type, nullability, `EXTRA` and
`COLUMN_DEFAULT`**; every expected index by name, uniqueness, column list and
order; counts the unexpected as well as the missing; and checks
`quotation_ref_no` against `quotations.ref_no` on **`COLUMN_TYPE`,
`CHARACTER_SET_NAME` and `COLLATION_NAME`, read from the live database**. If
`quotations.ref_no` cannot be found the answer is NO-GO, not a CONFORMS reached
by comparing against nothing. Section 4b re-runs it after the migration.

`COLUMN_DEFAULT` is in the gate deliberately. `snapshot_schema_version` must
have **no** default, and a table correct in every other respect but carrying
`DEFAULT 1` is a different contract — it would let a future snapshot format be
stored silently under the old version number. That one difference alone reads
NO-GO.

**Twelve wrong-schema fixtures, each with exactly one defect.** They are
generated from one correct definition with a single attribute overridden, so a
NO-GO can only be caused by the thing it is named after; a fixture with two
defects proves nothing about either. The suite first asserts the generator's
untouched output CONFORMS, then: a forbidden `DEFAULT` on
`snapshot_schema_version` · `created_at` as `TIMESTAMP` · `created_at` with no
default · `quotation_ref_no` on the database default collation · wrong type ·
wrong charset · a missing column · `snapshot_json` as `LONGTEXT` · the `UNIQUE`
degraded to an ordinary key · an unexpected column · an unexpected index · a
standalone `quotation_id` index the `UNIQUE` already covers. For every one it
demonstrates that **section 2 alone succeeds and changes nothing** before
showing the gate refuses it.

**The invariant is tested, not assumed.** Section 1b must never say CONFORMS
while section 4a says otherwise. The suite walks all thirteen fixtures, asserts
that any CONFORMS implies a section 4a MATCH, and asserts that **exactly one**
of the thirteen conforms. Both ask the same live question of the same database,
which is why they cannot disagree.

---

## ACCEPTANCE — WHAT MUST BE TRUE TO CLOSE

- the table is created cleanly, and a second run of the **complete procedure**
  is safe — including when rows are already present, which are proven
  byte-identical afterwards
- `quotation_ref_no` ends with the same type, charset and collation as
  `quotations.ref_no`, asserted attribute by attribute
- an existing but WRONG `quotation_revisions` is refused by the conformance
  gate rather than silently accepted by `IF NOT EXISTS`
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
| `tests/php/revision_storage.test.php` | **198 assertions, 0 failed** |
| Counted in the application total? | **No** — see the OUTCOME below |
| MySQL **8.0.46** — the production version, exactly | 198 / 0 |
| MySQL **8.4.3** | 198 / 0 |

The suite creates its own throwaway database, does everything inside it, drops
it, and refuses to run against a schema it did not create. It **fails** rather
than skips when no MySQL is reachable: a schema test that did not run must not
read as one that passed.

**Not re-run, and why:** the forty-suite browser matrix. No application byte
changed — `git diff` over `*.php` outside `tests/` and `migrations/` is empty —
so re-running it would only reproduce the eight recorded `38-mobile-ui`
environment failures. `php -l` is clean on both new files.

**The production version was run, not argued about.** An earlier draft of this
section reasoned that the two version-sensitive values were safe on 8.0 and
labelled that an argument rather than a run. It is now a run: the same suite,
unchanged, against **MySQL 8.0.46** — the exact production version — from the
official archive at dev.mysql.com, in an isolated datadir on an isolated port,
never touching production and never using production credentials. Identical
result on both engines, assertion for assertion.

The two version-sensitive values it depends on are confirmed empirically on
8.0.46 rather than inferred: `COLUMN_TYPE` reads `int unsigned` without a
display width (8.0.19+), and `EXTRA` reads `DEFAULT_GENERATED` for a column
defaulting to `CURRENT_TIMESTAMP` (8.0.13+). MariaDB was NOT used as a
substitute — its `JSON` is an alias for `LONGTEXT`, so every native-validation
assertion would have measured something else.

---

## OUTCOME — FINAL ACCEPTED / CLOSED

Accepted on 2026-08-28. `main` was fast-forwarded from `b9663d5` to
`b1fd1de7b1623150dcd6d8d609d8014af488f70e` — no merge commit, no rebase, no
force push.

| | |
|---|---:|
| Accepted candidate | `b1fd1de7b1623150dcd6d8d609d8014af488f70e` |
| MySQL **8.0.46** — the exact production engine | 198 / 0 |
| MySQL **8.4.3** | 198 / 0 |
| Accepted application commit | `649f80a` — **unchanged** |
| Application assertion total | 4,734 — **unchanged** |

**Why the accepted application SHA did not move, and why 198 is not added to
the total.** This round changed no application file. `migrations/` and `tests/`
are not deployed, so nothing a customer can reach is different. The canonical
assertion figures describe the APPLICATION measured at `649f80a`; a suite that
measures a migration is not an application assertion any more than
`check-control`'s own tests are, and folding it in would make the total mean two
things at once. The 198 are recorded in their own canonical block instead, where
they cannot drift unnoticed either.

**Production is untouched.**

- `migrations/2026-08-28-create-quotation-revisions.sql` — **NOT APPLIED**;
  `quotation_revisions` does not exist in production
- production application — still `649f80a`, unchanged
- Revision writer — **NOT STARTED**; no application file mentions
  `quotation_revisions`

**Next: READ-BEFORE-WRITE / TRANSACTION FOUNDATION**, which is NOT started. The
sequence after it is unchanged: Snapshot Revision Writer → Diff Engine / No-op
Suppression → Baseline / Delete Policy → History API → History UI.
