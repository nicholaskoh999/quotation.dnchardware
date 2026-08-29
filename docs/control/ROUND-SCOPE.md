# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**NO-OP SUPPRESSION**

An UPDATE that changes nothing now records nothing. The persisted BEFORE state
is compared against the persisted AFTER state, and a revision is written only if
business fact actually moved. **No persisted diff** — see the deferral below,
which is why this round is called what it is.

| | |
|---|---|
| Accepted application commit | `5729ad5001694bc62370472277dc9e5860276408` |
| Accepted candidate | `5729ad5001694bc62370472277dc9e5860276408` — promoted to `main` by fast-forward, no merge commit |
| Previous accepted commit | `631cb8945406a934b351e476ec71330ed23a2d27` — superseded, never to be quoted as current |
| Deployed application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` — production has not moved |
| Round status | **FINAL ACCEPTED / CLOSED** |
| DEPLOY = NO | accepted is not deployed, and the migration must be applied before it can be |
| STAGE 2 = NOT STARTED | nothing in Stage 2 was begun, examined or implied |
| Production DB change | **NO** — `quotation_revisions` is still NOT APPLIED to production |
| Revision schema change | **NONE** — eleven columns, `snapshot_schema_version` still 1 |
| Next round | MINIMAL HISTORY READ / UI — **NOT STARTED** |

---

## THE PERSISTED DIFF ENGINE WAS DEFERRED, AND WHY

This round opened as **DIFF ENGINE / NO-OP SUPPRESSION**. The diff half was
stopped before a line was written, on a fact read out of the accepted artefacts
rather than recalled:

**The accepted revision schema has nowhere to put a structured diff, and it
actively refuses one.**

`migrations/2026-08-28-create-quotation-revisions.sql` creates eleven columns —
`id, quotation_id, revision_no, quotation_ref_no, event_type, actor_user_id,
actor_username, actor_display_name, snapshot_schema_version, snapshot_json,
created_at`. None of them is a diff. That is not an omission this round could
route around, because three accepted artefacts enforce the count:

| authority | what it does with a twelfth column |
|---|---|
| the migration's §1 CONFORMANCE gate | *"counts anything unexpected as well as anything missing"* → **NO-GO**: *"STOP. Do not run section 2"* |
| the migration's §4 gate | *"EXPECT exactly these ELEVEN… A twelfth column means something other than this file created it"* |
| `revision_storage.test.php` | *"eleven columns, in the documented order, and nothing else"* |

Adding `diff_json` would therefore not be "write another migration". It would
make the **accepted, still-unapplied migration refuse the table it would then
find**, and fail an accepted suite that passes on both engines.

**And there is no accepted diff representation to conform to.** Every mention of
a diff anywhere in the control layer is a round *declining* to build one.

Two paths were put to the owner — a `"diff"` key inside `snapshot_json` at
`snapshot_schema_version = 2`, which needs no DDL, or a new `diff_json` column,
which needs a migration and breaks the gate — and the decision was **neither,
this round**: no persisted diff, no schema v2, no new migration. A later
**MINIMAL HISTORY READ / UI** round may derive a human-readable diff **at read
time** from two adjacent immutable snapshots, which needs no storage contract at
all.

So this round does the half that needs no schema: **whether** anything changed.
**What** changed remains unrecorded, deliberately.

---

## WHAT WAS BUILT, IN `api.php`

```
UPDATE   BEGIN → SELECT * … FOR UPDATE → capture BEFORE
              → reconcile identity → UPDATE quotation
              → read AFTER → compare
              → if changed: write ONE revision
              → COMMIT
CREATE   unchanged in every respect
```

Three helper functions and one `if`. `dc_write_revision()` — the accepted
writer — is **byte-identical**; it is now called conditionally rather than
unconditionally.

### What is compared, and why it is exactly that

**Persisted BEFORE against persisted AFTER. Never the browser payload.** The
BEFORE state is the row the transaction already holds `FOR UPDATE`, so it costs
no extra read; the AFTER state is the row read back once the UPDATE has run.
Comparing intent instead would be wrong in both directions — it would miss what
the database did to a value (a `DECIMAL(12,2)` rounding, a `VARCHAR` truncating)
and would report a change when the payload merely arrived differently shaped.

**The surface is the nine columns the UPDATE can write**, and that is not a
judgement call — it is the `SET` list of the statement itself:

```
company_id · quote_date · valid_until · prepared_by · remarks
customer_name · customer_phone · items · total_amount
```

Everything else in the row is unreachable from this handler. `ref_no` is
deliberately not in the `SET` list, `id` and `created_at` are never written, and
**there is no `updated_at` anywhere in this schema** — so there is no save-only
metadata to filter out. If none of the nine differs, the row is unchanged and a
revision would record a snapshot identical to the one already stored.

`company_name` is resolved for the snapshot but is **not compared**: it is
derived from `company_id`, which *is* compared, and from `companies.name`, which
this request does not write. Both reads happen inside one transaction, so it
cannot differ between them.

`total_amount` is compared as the `DECIMAL` **string** MySQL returns, never as a
float.

### Items are compared through `item_uid`, and order is part of the comparison

The normalised form states the **uid sequence** beside the item bodies, so
identity is part of the answer rather than incidental to it. Item bodies are
`ksort`ed at every level, so two encodings of the same item compare equal —
`ksort` is applied to lists too, where it changes nothing because their keys are
already `0..n`, which is precisely what keeps **order** significant.

### A REORDER IS A CHANGE, DELIBERATELY

This is a business decision and is recorded as one. Item order is business fact:
it is the order printed on the quotation, and *"Item 3 is item 3 on Screen, on
Print and in WhatsApp"* is a rule PROJECT-GUARDRAILS protects. Moving row 2
above row 1 edits the document, so it writes a revision.

What a reorder is **not** is a removal followed by an addition — every
`item_uid` that was there is still there, and the suite proves the set is
identical. Saying so in a *recorded* way is the later round's job, because that
is a statement about **what** changed.

### The comparison is not a storage contract

Nothing about it is persisted, returned, or held in a column. It exists for the
length of one comparison, and the suite asserts as much: no diff key in the
snapshot, `snapshot_schema_version` still `1`, still exactly one `INSERT` and no
`UPDATE`/`DELETE`/`TRUNCATE` against `quotation_revisions`, and no `ALTER` of a
revision schema anywhere in the application.

---

## ALLOWED TO CHANGE

```candidate-files
```

**EMPTY, because the round is closed.** The two files this round declared —

```
api.php
tests/php/noop_suppression.test.php
```

— are now part of the accepted commit `5729ad5`. Nothing else may differ from
it.
`api.php` is the only deployed application file. No browser suite changed, and
**no accepted PHP suite needed maintenance** — every update in
`revision_writer` and `transaction_foundation` changes real business data, so
both still measure exactly what they measured before, unedited.

---

## MUST NOT CHANGE — AND DOES NOT

`ref_no` format · server-side allocation · `GET_LOCK` and its release ordering ·
`uq_quotations_ref` · the transaction-scoped **READ COMMITTED on CREATE only** ·
**exactly one** 1062 retry and its real-race recovery · exactly one CREATE
revision carrying the settled `ref_no` · `SELECT … FOR UPDATE` · `item_uid`
reconciliation against the locked row · rollback when a revision cannot be
written · Actor Identity · pricing · Quick Add · the parser · the translation
dictionary · `delete_quotation`, which writes no revision and is untouched.

**The revision schema is untouched in every sense**: no `ALTER`, no new column,
no new migration, no change to `snapshot_schema_version`, and nothing new inside
`snapshot_json`.

---

## OUT OF SCOPE — NAMED, SO THEY ARE NOT DRIFTED INTO

**No persisted diff · no `diff_json` · no schema v2 · no new migration** · no
structured before/after in storage · no baseline backfill · no DELETE revision ·
no restore · no soft delete · no delete policy · no Saved Quotation delete UI ·
no History API · no History UI · no revision browsing · no stale-write
prevention · no optimistic concurrency · no parser, pricing, Quick Add or UI
change · no production migration · no deployment.

```
No-op Suppression                   ← this round
→ Minimal History Read / UI         (may derive diffs at READ time)
→ Baseline / Delete Policy
```

---

## MEASURED, AND NOW CANONICAL

Filled in from the runs, not carried over. **These figures are now canonical**:
CANONICAL-STATE describes `5729ad5`, the totals were recalculated from this
evidence rather than copied forward, and `4,930` / `+2,120` are recorded as
retired.

```
  3,936 browser + 172 + 107 + 62 + 15 + 42 + 94 + 150 + 159 + 92 + 101 + 171 = 5,101
  5,101 - 2,810 = +2,291
```

One figure moved: no-op suppression is an eleventh side group of **171**.
Nothing else did — revision writer is still 101 and transaction foundation still
92, both unedited.

### Targeted — no-op suppression

| | |
|---|---:|
| `tests/php/noop_suppression.test.php` on MySQL **8.0.46**, the production engine | **171 / 0** |
| the same suite on MySQL **8.4.3** | **171 / 0** |

The shipped `api.php` is copied byte-identically into a sandbox and served over
real HTTP; the revision table is lifted from the shipped migration, so the suite
cannot pass against a schema the migration would not produce — and cannot
quietly acquire the column the accepted schema forbids. What is measured is the
database afterwards.

**What it proves, in its own words.**

NO-OP — an identical save SUCCEEDS, adds no revision, leaves `revision_no` where
it was, and leaves the quotation row byte-identical. Five identical saves in a
row leave exactly one entry — the create. The same business fact in a different
SHAPE is also a no-op: item keys reordered within each item, and a
`total_amount` the `DECIMAL(12,2)` column rounds back to what is already stored.

CHANGED — each of the eight scalar columns the UPDATE can write is moved on its
own, and each writes **exactly one** revision, advances `revision_no` by exactly
one, is recorded as an `update`, and carries the persisted value in its
snapshot. Re-saving that same state immediately afterwards adds nothing.

ITEMS — an edit keeping the same `item_uid` writes one revision and the item
keeps its identity; an added item writes one and is minted a distinct uid while
the existing ones are untouched; a removed item writes one and the survivors
keep theirs. Each is followed by an identical re-save that adds nothing.

REORDER — a pure swap writes **exactly one** revision, because order is business
fact. The uid SET is proven identical before and after, so it is not a removal
plus an addition; the snapshot carries the new order; reordering back is another
change; and saving that same order twice suppresses.

LEGACY NULL — a row inserted directly with NULLs where this application writes
`''` is a REAL change on its first save through the handler, writes one
revision, and then settles: the second identical save adds nothing.

NUMBERING — `revision_no` runs `1..n` with no gaps, because suppression
allocates nothing. No orphan revision, no unrevisioned quotation, no duplicate
number.

ATOMICITY — with the writer deliberately broken, a NO-OP save still succeeds,
which is the clearest proof that suppression happens BEFORE the INSERT is
attempted; a REAL change is refused, says the revision was the reason, rolls the
quotation row back byte-identical, and leaves no partial revision.

CREATE — untouched: one create revision, numbered 1. And a REAL 1062 race still
recovers exactly once, on a different number, writing one revision that carries
the `ref_no` the retry settled on, with nothing claiming the number the first
attempt lost.

### THE 8.0.46 "ENVIRONMENT BLOCKER" WAS A COMMAND TYPO, AND IS RETIRED

The candidate was first reported **BLOCKED** because MySQL 8.0.46 would not
initialise. Roughly ten variations — path length, four locations, both shells,
`--no-defaults`, a cleaned `PATH`, an explicit `--tmpdir`, `--skip-log-bin`,
buffered InnoDB I/O, stopping the other server, the vanilla layout — were tried
and reported as "ruled out". **Every one of them carried the same wrong flag.**

| flag | result |
|---|---|
| `--initialize-insecure` — what the two preceding rounds used | **0 errors, 23 files** |
| `--initialize-insensitive` — not a MySQL option at all | 3 files, no data dictionary |

The working invocation was recovered from the earlier rounds' own transcript and
the cause settled by a control on the 8.4.3 binary in seconds. It was never a
Windows, filesystem, permissions or dependency problem, and the earlier
"BLOCKED — MYSQL 8.0.46 ENVIRONMENT" diagnosis **must not be quoted as an
environment fact**. It was operator error.

The recovered setup, used for the accepted measurement:

```
mysqld --initialize-insecure --datadir=$S/d80 --basedir=$S/my80/mysql-8.0.46-winx64
mysqld --datadir=$S/d80 --basedir=$S/my80/mysql-8.0.46-winx64 \
       --port=33080 --socket=$S/t80/m.sock --tmpdir=$S/t80 --console
```

Disposable instance, isolated datadir, non-default port, never connected to
production, removed afterwards. `SELECT VERSION()` → **8.0.46**.

The three shipped side logs under `FULL-AUDIT/regression-evidence/` were
produced on that engine and say so.

### Every other PHP suite, against the changed `api.php`

| | |
|---|---:|
| revision writer | **101 / 0** — unedited, re-confirmed on **8.0.46** |
| transaction foundation | **92 / 0** — unedited, re-confirmed on **8.0.46** |
| revision storage | 198 / 0 |
| item identity | 159 / 0 |
| mysqli compatibility | 94 / 0 |
| pricing / history | 172 / 0 |
| AI extraction | 107 / 0 |
| save retry | 42 / 0 |
| actor identity | 150 / **1** — the known PHP 8.3.30 bcrypt-cost artifact |

**No accepted suite needed maintenance.** `revision_writer` and
`transaction_foundation` each drive updates that change real business data, so
both still measure exactly what they measured before, byte for byte. That was
checked rather than assumed, and it is why neither appears in `candidate-files`.

`auth_identity`'s single failure is the deliberately runtime-relative assertion
recorded in CANONICAL-STATE: the decoy hash is cost 10 and `PASSWORD_DEFAULT`
produces cost 12 on this 8.3.30 machine. Unrelated to this round, and **not**
restated as 150 / 0.

`php -l` clean on every PHP file.

### Full browser matrix — run, because application code changed

**40 suites · 3,936 assertions · 8 failed · 0 skipped.** The 40 per-suite lines
sum to 3,936, which is asked rather than assumed. All eight are the recorded
`38-mobile-ui` environment exception — the `companies.php` modal close control
at 1440 / 980 / 700 / 600px — and `companies.php` is untouched by this round.

**A NINTH APPEARED ON ONE RUN, AND IT WAS MEASURED RATHER THAN ASSUMED TO BE
THE KNOWN FLAKE.** The round's own rule is that the previously recorded
`35-edit-mode` timing failure must not be silently accepted as a new
deterministic one, so it was put to a control on both trees:

| | full matrix run 1 | full matrix run 2 | suite 35 alone, machine BUSY | suite 35 alone, machine IDLE |
|---|---:|---:|---:|---:|
| candidate | 9 | **8** | **2 of 5** | **0 of 10** |
| pristine worktree at `631cb89` | **8** | — | **2 of 5** | **0 of 10** |

Three things follow, and each is a measurement rather than an argument.

**It is not deterministic**: the candidate's own second full matrix returned 8.

**It is not this round's**: a pristine worktree at the accepted commit — holding
none of this change — fails the SAME assertion at the SAME rate, with the same
expected `"true"` and actual `"false"`.

**It tracks machine load, not the tree**: 2 of 5 while other work was running,
0 of 10 on each tree once the machine was quiet.

**And the mechanism is closed, not merely unobserved.** `index.php`,
`tests/suites` and `tests/lib` are byte-identical to `631cb89`, and
`tests/lib/harness.js` line 87 intercepts every `api.php` request and answers it
from a stub table. **The browser matrix never executes the one file this round
changed**, so a differing browser result cannot be caused by it.

**Not fixed here.** `tests/suites` is outside this round's declared scope and
was not touched. The brittleness is the one already recorded: the assertion ends
a chain of `typeCell()` / `wqaEditDone()` pairs that carry no settle wait, unlike
the ones above it in the same suite. It is worth a settle wait in whichever
round next owns that file.

**No NEW application regression.** That is the acceptance condition, and it
holds.

### One defect found in the test harness, and where it was fixed

The new suite hung on its first run, and the cause is worth recording because it
is a trap rather than a mistake: `proc_open` hands the PHP built-in web server
an **unread stderr pipe**. That server logs one line per request and serves
requests one at a time, so once the OS pipe buffer fills — a few kilobytes,
about forty requests — it blocks on the write and never serves again. The suite
then hangs with the server alive and idle, which looks nothing like the cause.

`noop_suppression.test.php` gives the server FILE descriptors instead.
`revision_writer.test.php` has the same latent pattern and survives only because
it makes fewer requests than the buffer holds. **It was NOT changed** — it is
accepted, passing, and outside this round — but it will hang for whoever grows
it next.
