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
| Accepted application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` |
| Application status | **ACCEPTED** |
| Accepted round | ITEM IDENTITY FOUNDATION — every persisted quotation item carries a server-owned `item_uid`, **FINAL ACCEPTED** |

The accepted commit moved because a quotation item had no identity at all, and
for no other reason. It is `649f80a` because that is the last commit that
changed an application file — proven from the files, not from a branch tip:

```
git merge-base --is-ancestor e76bb85 649f80a  →  0   (e76bb85 is an ancestor)
git log -1 --format=%H e76bb85..HEAD -- api.php index.php \
        migrations/2026-08-27-backfill-item-uids.php \
        tests/php/item_identity.test.php tests/suites/40-item-identity.test.js
        →  649f80a   (derived from the files ROUND-SCOPE declared, not asserted)
git diff --name-only e76bb85..649f80a -- '*.php' ':(exclude)tests/**'
        →  api.php, index.php, migrations/2026-08-27-backfill-item-uids.php
git diff --name-only --diff-filter=MD e76bb85..649f80a -- tests/suites  →  (empty)
git diff --name-only 649f80a..HEAD -- '*.php'                →  (empty)
```

**What the change is.** `update_quotation` re-encoded the whole items array on
every save, so an item was known only by its position in it. The server could
not tell an edit of item 2 from a delete of item 2 plus an add, or a reorder
from a rewrite. Actor Identity answered *who is asking*; no audit table can use
that answer until the server can also say *which item*.

```
itm_ + 32 lowercase hex        bin2hex(random_bytes(16))
```

inside the existing `quotations.items` JSON. **No schema change, no item
table.**

**CREATE** mints one per item and discards any the client sent — on a create
there is nothing an incoming uid could refer to, so honouring one would let a
browser choose an identity. **UPDATE** reads the persisted items, one column
and one row, and reconciles before writing: a uid that is valid, belongs to
that quotation and appears once is preserved; an item with no uid is new; and
everything else fails closed **by name, before the `UPDATE` is prepared** —
`ITEM_IDENTITY_UNKNOWN_UID`, `ITEM_IDENTITY_DUPLICATE_UID`,
`ITEM_IDENTITY_MALFORMED_UID`, and `ITEM_IDENTITY_BACKFILL_REQUIRED` for a
stored quotation whose identity is missing or damaged.

**Nothing is ever reconciled by array position.** That is the guess this round
exists to remove, and doing it once "just for legacy rows" would put identity
on the wrong item in the one case nobody would check. A deleted item's uid is
never reissued either: `$used` starts as a copy of the persisted set, so every
uid the quotation ever held stays reserved for the whole reconciliation.

**The page carries identity and cannot mint it.** `dcCarryItemUid()` moves it
across the three commit sites where an item rebuilt from the entry form
replaces an existing row — without that, editing a saved item would silently
delete it and add a different one. `dcStripItemUid()` clears it for a copy.
`dcAdoptServerItems()` takes the uids the server issued **before** the
snapshot, which is what makes *create → edit again without reloading → save* an
edit rather than a set of new items. `index.php` holds no uid literal and no
generator.

**The backfill adds identity; it does not rewrite identity that exists.**
`migrations/2026-08-27-backfill-item-uids.php` is CLI-only, dry-run by default,
requires `--db=PATH`, runs in a transaction and is idempotent. Malformed or
duplicated **stored** uids are detected, their quotation ids named, and the
whole run refuses — not just those rows — with `GATE CLOSED` and a non-zero
exit. There is no repair flag, by any name. Its proof is not a promise: every
row's items array is compared before and after with `item_uid` stripped, and
one difference aborts the transaction.

**Nothing else moved.** `ref_no`, server-side allocation, `GET_LOCK`,
`uq_quotations_ref`, `NOT NULL ref_no`, the one-time 1062 retry,
`mysqli_report(MYSQLI_REPORT_OFF)`, pricing, material mapping, Previous Price,
Quick Add, the parser, the UI and Actor Identity are untouched, and no
translation key changed. **Revision storage is not started.**

**DEPLOYED AND PRODUCTION VERIFIED, 2026-08-28.** Accepted and deployed are
equal again. They remain two separate fields, and the next accepted commit will
separate them once more until it is rolled out.

| | |
|---|---|
| Accepted application | `649f80a09f83a7201c0f3772e01fc270ccda3e05` |
| **Deployed application** | **`649f80a09f83a7201c0f3772e01fc270ccda3e05`** |
| Production runtime | **PHP 8.4.24** |
| Item Identity in production | **LIVE · PRODUCTION VERIFIED** |
| `migrations/2026-08-27-backfill-item-uids.php` | **APPLIED** |
| Rollback | **NOT REQUIRED** |

**The backfill, in numbers.** 690 quotations, 2,079 items, 2,079 holding a
valid `item_uid`, **0** missing or invalid. The proof that it finished is the
re-run: a dry run immediately after `--apply` reported *already had identity
2,079 · identity minted 0 · quotation rows to write 0 · quotation rows
unchanged 690*. Idempotence and total coverage are the same observation read
twice.

**The deploy, verified path by path.** 18 of 18 deployed application paths
match the accepted commit — **0 drift, 0 missing** — with the file list read
from `.cpanel.yml`'s own `APPFILES` plus `assets/icons` rather than typed out,
and each path compared as a sha256 of the deployed file against the blob at the
accepted commit.

**The smoke.** One temporary quotation, `Q-2026-0693`: CREATE issued a
server-generated valid `item_uid`, EDIT preserved it, RE-SAVE preserved it, and
REOPEN showed normal business data. It was deleted afterwards — exactly one row
removed, remaining `Q-2026-0693` = 0, and the quotation count returned to 690.

Production previously ran `e76bb85d663f96fdce3ed6c0c70b72c49d84000a`. That is
**history, not current state**, and is recorded under
`production.previouslyDeployedApplicationCommit`. Actor Identity remains live,
`app_users` remains applied and seeded, and production `NOT NULL(ref_no)` is
unaffected — accepting and deploying `649f80a` disturbed none of them.

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
| Current final assertions | **4,734** |
| Delta | **+1,924** |
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
| Item Identity (api.php / index.php) | 156 |

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
+   156   item identity
= 4,734   final

  4,734 - 2,810 = 1,924
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
| Reproduced on | `ce26146a6a792f2bac0ebb4bab77389d19ff0660` — a pristine worktree at this round's own starting point fails the same eight with the same numbers |

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
| Assertion totals | 3,334 · 3,482 · 3,679 · 3,799 · 3,827 · 3,958 · 4,070 · 4,172 · 4,263 · 4,305 · 4,399 · 4,549 |
| Deltas | +734 · +869 · +989 · +1,017 · +1,148 · +1,260 · +1,362 · +1,453 · +1,495 · +1,589 · +1,739 |
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
| Application commit | `e76bb85d663f96fdce3ed6c0c70b72c49d84000a` — superseded by `649f80a` when ITEM IDENTITY FOUNDATION was accepted. **Still the DEPLOYED commit**, which is a different fact and is current, not superseded |

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
