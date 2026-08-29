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
| Accepted application commit | `5729ad5001694bc62370472277dc9e5860276408` |
| Application status | **ACCEPTED** |
| Accepted round | NO-OP SUPPRESSION — an UPDATE that changes nothing records nothing, **FINAL ACCEPTED** |

The accepted commit moved because a save that changed nothing was writing a
revision anyway, and for no other reason. It is `5729ad5` because that is the
last commit that changes an application file — proven from the files, not from a
branch tip:

```
git merge-base --is-ancestor 631cb89 5729ad5  →  0   (631cb89 is an ancestor)
git log -1 --format=%H 631cb89..HEAD -- api.php \
        tests/php/noop_suppression.test.php
        →  5729ad5   (derived from the files ROUND-SCOPE declared, not asserted)
git diff --name-only 631cb89..5729ad5 -- '*.php' ':(exclude)tests/**'  →  api.php
git diff --name-only --diff-filter=MD 631cb89..5729ad5 -- tests/suites →  (empty)
git diff --name-only 5729ad5..HEAD -- '*.php' ':(exclude)tests/**'     →  (empty)
```

**What the change is.** An `UPDATE` that changes nothing used to write a revision
anyway. That is not history, it is noise: revision numbers advance and a reader
cannot tell which entries represent an edit.

```
UPDATE   BEGIN → SELECT * … FOR UPDATE → capture BEFORE
              → reconcile identity → UPDATE quotation
              → read AFTER → compare
              → if changed: write ONE revision
              → COMMIT
CREATE   unchanged in every respect
```

Three helper functions and one `if`. **`dc_write_revision()` is byte-identical** —
it is now called conditionally rather than unconditionally.

### What is compared, and why it is exactly that

**Persisted BEFORE against persisted AFTER. Never the browser payload.** BEFORE
is the row the transaction already holds `FOR UPDATE`, so it costs no extra read;
AFTER is the row read back once the `UPDATE` has run. Comparing intent instead
would be wrong in both directions — it would miss what the database did to a
value (a `DECIMAL(12,2)` rounding, a `VARCHAR` truncating) and would report a
change when the payload merely arrived differently shaped.

**The surface is the nine columns the UPDATE can write**, and that is not a
judgement call — it is the `SET` list of the statement itself:

```
company_id · quote_date · valid_until · prepared_by · remarks
customer_name · customer_phone · items · total_amount
```

Everything else in the row is unreachable from this handler. `ref_no` is
deliberately not in the `SET` list, `id` and `created_at` are never written, and
**there is no `updated_at` anywhere in this schema** — so there is no save-only
metadata to filter out.

`company_name` is resolved for the snapshot but is **not compared**: it is derived
from `company_id`, which *is* compared, and from `companies.name`, which this
request does not write. `total_amount` is compared as the `DECIMAL` **string**
MySQL returns, never as a float.

**Items are compared through `item_uid`, and order is part of the comparison.**
The normalised form states the uid sequence beside the item bodies, which are
`ksort`ed at every level so two encodings of the same item compare equal —
`ksort` applied to lists too, where it changes nothing because their keys are
already `0..n`, which is precisely what keeps order significant.

**A REORDER IS A CHANGE, DELIBERATELY.** Item order is business fact: it is the
order printed on the quotation, and *"Item 3 is item 3 on Screen, on Print and in
WhatsApp"* is a rule PROJECT-GUARDRAILS protects. What a reorder is **not** is a
removal followed by an addition — every `item_uid` that was there is still there,
and the suite proves the set is identical. Recording *what* changed is a later
round; this one answers only *whether* anything did.

**The comparison is not a storage contract.** Nothing about it is persisted,
returned, or held in a column; it exists for the length of one comparison. The
suite asserts it: no diff key in the snapshot, `snapshot_schema_version` still
`1`, still exactly one `INSERT` and no `UPDATE`/`DELETE`/`TRUNCATE` against
`quotation_revisions`, and no `ALTER` of a revision schema anywhere.

### THE PERSISTED DIFF ENGINE IS DEFERRED, ON A FACT

This round opened as **DIFF ENGINE / NO-OP SUPPRESSION**. The diff half was
stopped before a line was written: **the accepted revision schema has nowhere to
put a structured diff, and it actively refuses one.** Eleven columns, none of
them a diff, and three accepted artefacts enforce the count — the migration's
CONFORMANCE gate *"counts anything unexpected as well as anything missing"* and
reads **NO-GO**; its §4 gate says *"a twelfth column means something other than
this file created it"*; and `revision_storage.test.php` asserts *"eleven columns,
in the documented order, and nothing else"*. Adding `diff_json` would make the
**accepted, still-unapplied migration refuse the table it would then find**.
There is also no accepted diff representation anywhere to conform to.

A later **MINIMAL HISTORY READ / UI** round may derive a human-readable diff **at
read time** from two adjacent immutable snapshots, which needs no storage
contract at all.

### The accepted writer, and nine other accepted functions, are byte-identical

Compared function body for function body rather than assumed: `dc_write_revision`,
`dc_build_quotation_snapshot`, `dc_read_quotation_snapshot_row`,
`dc_next_revision_no`, `dc_reconcile_item_uids`, `dc_lock_quotation_for_update`,
`dc_txn_begin`, `next_free_ref_no`, `dc_save_quotation_insert`, `fail_json`.

**Nothing else moved.** `ref_no`, the allocator, `GET_LOCK` and its release
ordering, READ COMMITTED on create only, the **exactly one** 1062 retry and its
real-race recovery, exactly one CREATE revision carrying the settled `ref_no`,
`SELECT … FOR UPDATE`, `item_uid` reconciliation, rollback when a revision cannot
be written, Actor Identity, pricing, Quick Add, the parser, the translation
dictionary and `delete_quotation` are untouched. `api.php` is the only
application file changed, and **no accepted PHP suite needed maintenance** —
every update in `revision_writer` and `transaction_foundation` changes real
business data, so both still measure 101 and 92 unedited.

### THE 8.0.46 "ENVIRONMENT BLOCKER" IS RETIRED — IT WAS A COMMAND TYPO

The candidate was first reported **BLOCKED** because MySQL 8.0.46 would not
initialise, after roughly ten variations of path, location, shell,
`--no-defaults`, `PATH`, `--tmpdir`, `--skip-log-bin`, InnoDB flush method and
layout had been tried and "ruled out". Every one of them carried the same wrong
flag.

| flag | result |
|---|---|
| `--initialize-insecure` — what the two preceding rounds used | **0 errors, 23 files** |
| `--initialize-insensitive` — not a MySQL option | 3 files, no data dictionary |

Recovered from the earlier rounds' own transcript and settled by a control on the
8.4.3 binary. **The earlier diagnosis was wrong and must not be quoted as an
environment fact.** The correct entry is operator error in the initialize
command.

**ACCEPTED IS NOT LIVE.**

| | |
|---|---|
| Accepted application | `5729ad5001694bc62370472277dc9e5860276408` |
| **Deployed application** | **`649f80a09f83a7201c0f3772e01fc270ccda3e05`** — the Item Identity build |
| Transaction foundation in production | **NOT DEPLOYED** |
| Snapshot revision writer in production | **NOT DEPLOYED** |
| No-op suppression in production | **NOT DEPLOYED** |
| `migrations/2026-08-28-create-quotation-revisions.sql` | **NOT APPLIED** |

Three accepted rounds now sit undeployed, and the migration must be **APPLIED
BEFORE** any of them is deployed — with the table absent a save FAILS and rolls
back, deliberately.

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
| Current final assertions | **5,101** |
| Delta | **+2,291** |
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
| No-op Suppression (api.php) | 171 |

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
+    92   transaction foundation
+   101   revision writer
+   171   no-op suppression        (new)
= 5,101   final

  5,101 - 2,810 = 2,291
```

**One figure moved, and it is measured, not estimated.**
`tests/php/noop_suppression.test.php` is an eleventh side group of **171**, run
on MySQL **8.0.46** — the production engine — and again on **8.4.3**, with the
same count and no failures on either. **Nothing else moved**: revision writer is
still 101 and transaction foundation still 92, both **unedited** and both
re-confirmed on 8.0.46, because every update in them changes real business data.
Revision storage stayed 198 and stays out of this total. **4,930** and
**+2,120** are recorded as retired.

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
| Assertion totals | 3,334 · 3,482 · 3,679 · 3,799 · 3,827 · 3,958 · 4,070 · 4,172 · 4,263 · 4,305 · 4,399 · 4,549 · 4,734 · 4,822 · 4,930 |
| Deltas | +734 · +869 · +989 · +1,017 · +1,148 · +1,260 · +1,362 · +1,453 · +1,495 · +1,589 · +1,739 · +1,924 · +2,012 · +2,120 |
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
| Application commit | `631cb8945406a934b351e476ec71330ed23a2d27` — superseded by `5729ad5` when NO-OP SUPPRESSION was accepted |

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
