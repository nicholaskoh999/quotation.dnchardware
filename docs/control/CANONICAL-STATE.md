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

## QUOTATION NEXT — OWNER AUTHORITY (R0 FINAL, 2026-10-21)

The owner-approved rewrite specification for QUOTATION NEXT is
**`docs/quotation-next/OWNER-APPROVED-REWRITE-HANDOFF.md`** — the current owner
authority for the new application, superseding earlier UI concepts and planning
notes where they conflict. R0 owner decisions: **LOCKED**. Next round: **R0b —
Characterisation / golden fixtures**.

R0 FINAL was documentation only: no application byte, database, configuration
or deployment changed, and the legacy state recorded below is unaffected. The
legacy application remains the oracle until parity / cutover; production for the
new track is gated on the explicit instruction `PRODUCTION APPROVED BY OWNER`.
Machine copy: `CANONICAL-STATE.json` `quotationNext`.

---

## CURRENT STATE — QUICK ADD TL OVERRIDE + HARDENING AUDIT CLOSED, 2026-10-20

| | |
|---|---|
| Round status | **CLOSED** |
| Active round | **NONE** |
| Production | **VERIFIED** — runs `32382327de3ecdd054707de6ceefaf7fbb1aad85` (`integration/quickadd-tl-hardening`) |
| Main | fast-forwarded `076e2ae` → `3238232`, plus this closing docs commit |
| Accepted application commit | `c38896c91df5e9698f905b5b954cc8168a69a8df` — the C → A → B integration merge; `3238232` adds evidence and control files only, the application files are byte-identical |
| Previously deployed | `f7184f192cc087cfed734fc3df66a6afcf997d51` (`integration/source-reconciliation`) |
| Full suite | **PASS WITH 8 DOCUMENTED KNOWN FAILURES** — 43 suites, 4,202 assertions; the eight are the `38-mobile-ui` Windows Chromium font-metric failures, line for line |
| Pre-existing flake | 35-edit-mode "clearing it back to the default lets the session close" — the load-sensitive flake recorded below; reproduced on base `076e2ae`, not candidate-caused |
| PHP | 12 files, 1,825 assertions, 0 failed (PHP 8.4.12, MySQL 8.4.11) |
| Translation / workbook | 15 / 15 (953 keys) · 62 / 62 (carried forward; its input workbook is not in the repository and nothing it measures moved) |
| Security | **PASS FOR THIS ROUND** — DB driver detail no longer reaches the browser; History `item_count` escaped |
| Production verify | **PASS** — owner accepted 2026-10-20 |
| Round result | **PASS** |
| Revision history | **STILL DEPLOYED / VERIFIED** |
| Database change | **NONE THIS ROUND** |
| Production config change | **NONE THIS ROUND** |
| Upload capacity | **UNVERIFIED** — owner / cPanel check remains |

**Deferred.** HIGH PRIORITY: the production `db.php` connection-error leak
(manual server-side hardening; potentially reachable before login if it matches
`db.sample.php`). VERIFY: `display_errors` Off; `upload_max_filesize`,
`post_max_size`, `memory_limit`, `max_file_uploads` and related limits. LATER
ROUND: CSRF (layered design), `Access-Control-Allow-Origin: *`, the misleading
Quick Add error when upload limits are exceeded, save-start log ordering.
Machine copy: `CANONICAL-STATE.json` `deferred` and `tlHardeningRound`.

---

## PREVIOUS ROUND (historical) — SOURCE RECONCILIATION CLOSED, 2026-10-19

| | |
|---|---|
| Round status | **CLOSED** |
| Active round | **NONE** |
| Production | **VERIFIED** — runs `f7184f192cc087cfed734fc3df66a6afcf997d51` (`integration/source-reconciliation`) |
| Main | `f7184f192cc087cfed734fc3df66a6afcf997d51` (fast-forwarded from `f57b195`) plus this closing docs commit |
| Accepted application commit | `5f5b4a76bb704e8e3709bb2adad51babc06db322` — the merge; `f7184f1` adds evidence and docs only, the application files are byte-identical |
| Previously deployed | `91f0c0b905ef402378aaeef896c80a4e6229c442` (`hotfix/quickadd-integration`) |
| Full suite | **PASS WITH 8 DOCUMENTED KNOWN FAILURES** — 41 suites, 4,010 assertions; the eight are the `38-mobile-ui` Windows Chromium font-metric failures, line for line |
| PHP | 11 suites, 1,412 assertions, 0 failed (MySQL 8.4.3; migration and `api.php` byte-identical to their 8.0.46 verification) |
| Translation / workbook | 15 / 15 (953 keys) · 62 / 62 |
| Security | **PASS** — no BLOCKER / HIGH / MEDIUM |
| Production verify | **PASS** — owner smoke accepted |
| Source reconciliation | **PASS** |
| Revision history | **DEPLOYED** — transaction foundation, revision writer, no-op suppression, history reader |
| `quotation_revisions` | **APPLIED** 2026-10-19 on MySQL 8.0.46 — Section 4 **MATCH** and **CONFORMS**; owner-confirmed backup first |
| Schema observations, accepted by the owner | `quotations.id` is signed INT (the migration assumed INT UNSIGNED; ids 1–1,278, none ≤ 0); database default charset utf8mb3 / utf8mb3_unicode_ci |

**Deferred:** a row phrase "thread length 50mm" does not override the shared
Sag Rod TL (`x 50/50` does) · verify PHP `post_max_size` / `memory_limit` for
five 10 MB images · CSRF token hardening · DB error text in `fail_json` ·
history `item_count` is not escaped in `dcHistChange` (the server casts it to
int — defense in depth, INFO).

---

## APPLICATION

| | |
|---|---|
| Accepted application commit | `c38896c91df5e9698f905b5b954cc8168a69a8df` |
| Application status | **ACCEPTED** |
| Accepted round | QUICK ADD TL OVERRIDE + HARDENING AUDIT — a row's own Sag Rod TL overrides the shared heading, DB driver detail stays out of responses, History `item_count` escaped, **FINAL ACCEPTED** |

`c38896c` carries two application files. `index.php`: under a shared heading
such as `THREAD LENGTH 70MM`, a row's own `thread length 50mm`,
`THREAD LENGTH 50MM` or `TL 50` is that row's TL and no other's; and History's
created summary normalises `item_count` and escapes it. `api.php`:
`dc_db_fail()` answers the browser with the call site's label and a short ref,
and writes the errno and driver text to `error_log` under the same ref. The
paragraphs that follow describe the earlier accepted rounds this one builds on.

The accepted commit moved because nobody could see what a quotation used to be,
and for no other reason. It is `5595395` because that is the last commit that
changes an application file — proven from the files, not from a branch tip:

```
git merge-base --is-ancestor 5729ad5 5595395  →  0   (5729ad5 is an ancestor)
git log -1 --format=%H 5729ad5..HEAD -- api.php index.php \
        tests/php/history_read.test.php tests/suites/41-history.test.js
        →  5595395   (derived from the files ROUND-SCOPE declared, not asserted)
git diff --name-only 5729ad5..5595395 -- '*.php' ':(exclude)tests/**'
        →  api.php, index.php
git diff --name-only --diff-filter=MD 5729ad5..5595395 -- tests/suites →  (empty)
git diff --name-only 5595395..HEAD -- '*.php' ':(exclude)tests/**'     →  (empty)
```

**What the change is.** Four rounds recorded history; none of it could be read.
A saved quotation now has a **History** panel: revision number, event, when,
who, and what changed.

```
GET api.php?action=get_quotation_history&id=…
  → SELECT … FROM quotation_revisions WHERE quotation_id = ? ORDER BY revision_no ASC
  → walk oldest → newest, comparing each snapshot with the one before it
  → answer newest-first, with the derived changes attached
  → the page renders them through the dictionary
```

**DERIVED AT READ TIME, AND PERSISTED NOWHERE.** No `diff_json`, no revision
column, no `ALTER`, no `snapshot_schema_version = 2`, no new migration, and
nothing derived written back into a snapshot. The accepted eleven-column schema
is untouched, and the suite asserts that on the shipped source.

**ONE SELECT, AND IT WRITES NOTHING** — no `INSERT`, no `UPDATE`, no `DELETE`,
no `TRUNCATE`, no `dc_txn_begin`, no `dc_write_revision`, no `FOR UPDATE`. Three
reads in a row leave the quotation row byte-identical, every revision row
byte-identical, the revision count unmoved and no `revision_no` changed.

**Deliberately NOT joined to `quotations`.** A revision records what a quotation
*was*, and the architecture intends that record to outlive the quotation —
making `quotations` vouch for it would delete history exactly when it is most
wanted. Whether a deleted quotation's history is ever *shown* is the Baseline /
Delete Policy round's question and is not answered here.

### Items match by `item_uid`, and by nothing else

| | |
|---|---|
| same uid, fields differ | **item changed** — every moved field grouped under that one item |
| uid only in the newer snapshot | **item added** |
| uid only in the older snapshot | **item removed** |
| same uid SET, different order | **items reordered** |

**A REORDER IS A REAL CHANGE BUT NEVER A REMOVAL PLUS AN ADDITION.** Identity
did not change, so it cannot be a replacement — and it is still a change, because
No-op Suppression established that item order is business fact.

**Company is ONE change**, shown by the name each snapshot **froze**. The live
`companies` table is never consulted, and the suite proves it by renaming the row
and reading the frozen name back unchanged.

### The honesty rules, because a history that guesses is worse than none

**A first recorded CREATE** says the quotation was created, with the item count,
the persisted total and the frozen company name — and invents no before values.

**A first recorded UPDATE** says *"First recorded revision · Previous state is
not available."* Baseline rollout is deferred, so a quotation older than the
writer genuinely has nothing recorded before that point. It is **not** quietly
turned into a create, and **no** from/to values are invented.

**A snapshot version this viewer does not know** is reported as unsupported,
naming the version, with its readable metadata still read and its structure not
guessed at — and it cannot serve as the baseline for the entry after it.

**An actor the record does not name** is *Legacy / Unknown*. Never a stand-in
username.

**A FAILED READ IS NOT AN EMPTY HISTORY.** One says nothing was recorded, the
other says nothing could be read, and showing the first for the second would
quietly hide a broken deployment.

### The answer is data; the words are the page's

`api.php` returns a machine `kind` and the persisted values. Every sentence a
person reads is produced in `index.php` through the same dictionary as the rest
of the UI, so history is translated like everything else rather than shipping
English out of the server. Thirteen item fields have labels; anything else that
differs is **counted** rather than named, so an internal key can never surface as
English in a translated screen. `item_uid` is used for matching and is **never
shown** to a normal reader.

### The accepted WRITE path is byte-identical

Compared function body for function body rather than assumed:
`dc_write_revision`, `dc_build_quotation_snapshot`,
`dc_read_quotation_snapshot_row`, `dc_next_revision_no`,
`dc_reconcile_item_uids`, `dc_lock_quotation_for_update`, `dc_txn_begin`,
`dc_business_state`, `dc_business_items`, `dc_ksort_deep`, `next_free_ref_no`,
`dc_save_quotation_insert`, `fail_json`.

**Nothing else moved.** `ref_no` and its allocator, `GET_LOCK` and its release
ordering, READ COMMITTED on create only, the **exactly one** 1062 retry, no-op
suppression, rollback when a revision cannot be written, `item_uid`
reconciliation, Actor Identity, pricing, Quick Add, the parser and
`delete_quotation` are untouched. **The persisted Diff Engine remains
DEFERRED.**

**ACCEPTED AND LIVE** (2026-10-19, superseding the table that stood here).

| | |
|---|---|
| Accepted application | `c38896c91df5e9698f905b5b954cc8168a69a8df` |
| **Deployed application** | **`32382327de3ecdd054707de6ceefaf7fbb1aad85`** — the TL override / hardening build; application files identical to `c38896c` |
| Transaction foundation in production | **DEPLOYED** |
| Snapshot revision writer in production | **DEPLOYED** |
| No-op suppression in production | **DEPLOYED** |
| History reader in production | **DEPLOYED** |
| `migrations/2026-08-28-create-quotation-revisions.sql` | **APPLIED** — MATCH / CONFORMS |

The four rounds that sat undeployed are live. The migration was applied **before**
the code, as the deployment order requires.

---

## REVISION STORAGE — FINAL ACCEPTED / CLOSED

| | |
|---|---|
| Round | REVISION STORAGE FOUNDATION |
| Status | **FINAL ACCEPTED / CLOSED**, 2026-08-28 |
| Accepted candidate | `b1fd1de7b1623150dcd6d8d609d8014af488f70e` |
| Table | `quotation_revisions` |
| Migration | `migrations/2026-08-28-create-quotation-revisions.sql` — **APPLIED to production 2026-10-19** |
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
| Current final assertions | **5,906** |
| Delta | **+3,096** |
| Failed | **8** — see the exception below |
| Skipped | 0 |
| Browser suites | **43** |
| Browser assertions | **4,202** |

Other accepted assertion groups:

| | |
|---|---:|
| Pricing / History | 172 |
| AI Extraction / Parser | 107 |
| Workbook | 62 |
| Translation | 15 |
| Save retry (api.php 1062) | 42 |
| mysqli compatibility (PHP 8.1+) | 97 |
| Actor Identity (auth.php / login.php) | 150 |
| Item Identity (api.php / index.php) | 159 |
| Transaction Foundation (api.php) | 92 |
| Revision Writer (api.php) | 101 |
| No-op Suppression (api.php) | 171 |
| History Read (api.php) | 126 |
| Error Leakage (api.php) | 410 |

**Arithmetic, which the checker performs itself rather than trusting:**

```
  4,202   browser (43 suites)
+   172   pricing / history
+   107   AI extraction / parser
+    62   workbook
+    15   translation
+    42   save retry
+    97   mysqli compatibility     (94 -> 97, amended)
+   150   actor identity
+   159   item identity
+    92   transaction foundation
+   101   revision writer
+   171   no-op suppression
+   126   history read
+   410   error leakage            (new)
= 5,906   final

  5,906 - 2,810 = 3,096
```

**At the TL override / hardening round three figures moved, all measured.**
`tests/php/error_leakage.test.php` is a thirteenth side group of **410**;
`tests/php/mysqli_compat.test.php` moved 94 → **97** under an owner-approved
amendment that ADDED three checks that the driver text is absent and weakened
none; and two browser suites were added — `42-quickadd-tl-override` (**173**)
and `43-history-escape` (**19**) — so 41 / 4,010 became **43 / 4,202** with the
same eight recorded environment failures and none added. **5,301**, **+2,491**
and **41 suites** are recorded as retired.

**At the history round (historical), two figures moved, and both were measured.**
`tests/php/history_read.test.php` is a twelfth side group of **126**, run on
MySQL **8.0.46** — the production engine — and again on **8.4.3**, with the same
count and no failures on either. And **the browser matrix moved for the first
time since Item Identity**: `tests/suites/41-history.test.js` is a forty-first
suite adding **74**, so 40 / 3,936 became **41 / 4,010** with the same eight
recorded environment failures and none added. Nothing else moved — no-op
suppression 171, revision writer 101 and transaction foundation 92 are all
**unedited** and all re-confirmed on 8.0.46. Revision storage stayed 198 and
stays out of this total. **5,101**, **+2,291**, **40 suites** and **862
translation keys** are recorded as retired.

**One side suite does not read 0 failed, and is not restated as though it did.**
`tests/php/auth_identity.test.php` measures **150 / 1** on the local PHP 8.3.30
runtime — a runtime-relative bcrypt-cost artifact, not an application fault. The
accepted Actor Identity evidence remains the PHP 8.4.19 run recorded when that
round closed.

**The browser matrix moved at Item Identity, and again at this round.** The
thirty-nine suites that existed before Item Identity still measure **3,907**,
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

**Seen again at the TL override / hardening round, and classified the same
way.** Suite 35 alone failed the same assertion 2 of 4 on base `076e2ae`, 2 of 3
on Session C and 2 of 3 on the integration candidate, while the integration
full matrix returned exactly the recorded eight. It reproduces on the base, so
it is pre-existing and not candidate-caused; the owner accepted it as such.
Still not fixed, still not counted among the eight
(`FULL-AUDIT/stage-tl-hardening/logs/35-runs.log`).

`tests/php/item_identity.test.php` runs the shipped `api.php` functions and
executes the shipped migration as a real subprocess against a stub `db.php`.

---

## TRANSLATION

| | |
|---|---:|
| Keys | **953** |
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
| Assertion totals | 3,334 · 3,482 · 3,679 · 3,799 · 3,827 · 3,958 · 4,070 · 4,172 · 4,263 · 4,305 · 4,399 · 4,549 · 4,734 · 4,822 · 4,930 · 5,101 |
| Deltas | +734 · +869 · +989 · +1,017 · +1,148 · +1,260 · +1,362 · +1,453 · +1,495 · +1,589 · +1,739 · +1,924 · +2,012 · +2,120 · +2,291 |
| Translation keys | 512 · 658 · 756 · 843 · 853 · 862 |
| Finding totals | 29 · 33 |
| Suite counts | 34 · 36 · 37 · 38 · 39 · 40 |
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
| Application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` — superseded by `1ca6554` when READ-BEFORE-WRITE / TRANSACTION FOUNDATION was accepted. It was the deployed commit until the hotfix chain; production now runs `f7184f1` |
| Application commit | `1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a` — superseded by `631cb89` when SNAPSHOT REVISION WRITER was accepted |
| Application commit | `631cb8945406a934b351e476ec71330ed23a2d27` — superseded by `5729ad5` when NO-OP SUPPRESSION was accepted |
| Application commit | `5729ad5001694bc62370472277dc9e5860276408` — superseded by `5595395` when MINIMAL HISTORY READ / UI was accepted |
| Application commit | `5595395fefb49adcb1140a3c9b2a1c36dc7a2186` — superseded by `5f5b4a7` when SOURCE RECONCILIATION / REVISION HISTORY DEPLOYMENT was accepted |
| Application commit | `5f5b4a76bb704e8e3709bb2adad51babc06db322` — superseded by `c38896c` when QUICK ADD TL OVERRIDE + HARDENING AUDIT was accepted |

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
