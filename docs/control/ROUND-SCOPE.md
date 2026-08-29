# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**MINIMAL HISTORY READ / UI**

The first time anyone can see what a quotation used to be. A read-only History
panel on a saved quotation, showing revision number, event, when, who, and what
changed — **derived at read time** from the immutable snapshots already
recorded, and **persisted nowhere**.

| | |
|---|---|
| Accepted application commit | `5729ad5001694bc62370472277dc9e5860276408` |
| Deployed application commit | `649f80a09f83a7201c0f3772e01fc270ccda3e05` — production has not moved |
| Round status | **CANDIDATE — READY FOR REVIEW** |
| DEPLOY = NO | a candidate is not a deployed state |
| STAGE 2 = NOT STARTED | nothing in Stage 2 was begun, examined or implied |
| Production DB change | **NO** — `quotation_revisions` is still NOT APPLIED to production |
| Revision schema change | **NONE** — eleven columns, `snapshot_schema_version` still 1 |
| Persisted diff | **STILL DEFERRED** — nothing derived here is written back |

---

## IN SCOPE

- a read-only history API — `get_quotation_history`
- read-time comparison of **adjacent recorded snapshots**
- a minimal History panel on the saved-quotation screen
- a targeted PHP suite on both engines
- browser coverage for the panel

## OUT OF SCOPE

**No persisted diff · no `diff_json` · no revision column · no `ALTER` of
`quotation_revisions` · no `snapshot_schema_version = 2` · no new migration ·
nothing derived written back into a snapshot · no existing revision row
modified** · no baseline rollout · no fabricated legacy history · no restore ·
no soft delete · no DELETE revision · no Saved Quotation delete UI · no change
to `delete_quotation` · no deployment · no production migration · no production
DB action · no ERP work · no redesign of the quotation UI.

```
Minimal History Read / UI            ← this round
→ Baseline / Delete Policy
→ (back to the ERP roadmap)
```

---

## THE READ PATH

```
GET api.php?action=get_quotation_history&id=…
  → SELECT … FROM quotation_revisions WHERE quotation_id = ? ORDER BY revision_no ASC
  → walk oldest → newest, comparing each snapshot with the one before it
  → answer newest-first, with the derived changes attached
  → the page renders them through the dictionary
```

**One SELECT, no transaction, no lock, and nothing in the branch writes.** The
suite asserts that on the shipped source rather than hoping for it: no `INSERT`,
no `UPDATE`, no `DELETE`, no `TRUNCATE`, no `dc_txn_begin`, no
`dc_write_revision`, no `FOR UPDATE`.

**Deliberately NOT joined to `quotations`.** A revision records what a quotation
*was*, and the architecture intends that record to outlive the quotation —
making `quotations` vouch for it would delete history exactly when it is most
wanted. Whether a deleted quotation's history is ever *shown* is the Baseline /
Delete Policy round's question and is not answered here.

**The requested id is bound, never interpolated**, and read as an integer.

---

## WHY DERIVED, AND NOT STORED

The accepted `quotation_revisions` schema has eleven columns, no diff field, and
three artefacts that refuse a twelfth — so a persisted diff would need a schema
this round is not allowed to change. It would also not be better: two adjacent
immutable snapshots already contain the whole answer, so deriving it means a
later, smarter renderer can say more about history that has **already** been
recorded, without a migration and without rewriting anything.

---

## HONESTY RULES, BECAUSE A HISTORY THAT GUESSES IS WORSE THAN NONE

**The first recorded revision is a CREATE** → *"Quotation created"*, with the
item count, the persisted total and the frozen company name. No before values,
because there was no before.

**The first recorded revision is an UPDATE** → *"First recorded revision ·
Previous state is not available."* Baseline rollout is deferred, so a quotation
that existed before the writer did genuinely has nothing recorded before that
point. It is **not** quietly reported as a creation, and **no** from/to values
are invented against a state nobody recorded.

**A snapshot version this viewer does not know** → *"Snapshot format not
supported by this viewer."* Its structure is not guessed at, and it cannot serve
as the baseline for the entry after it either.

**An actor the record does not name** → *Legacy / Unknown*. Never a stand-in
username. The API returns the nulls as nulls; the label is the page's.

**A failed read is not an empty history.** One says nothing was recorded, the
other says nothing could be read — and showing the first for the second would
quietly hide a broken deployment. The deployment contract is unchanged:
**migration BEFORE application**.

---

## WHAT COUNTS AS A CHANGE

**Quotation fields**, named through the dictionary: `ref_no`, company,
`customer_name`, `customer_phone`, `quote_date`, `valid_until`, `prepared_by`,
`remarks`, `total_amount`. `id` and `created_at` are excluded because an update
cannot change them.

**COMPANY IS ONE CHANGE, NOT TWO**, and it is shown by the name each snapshot
**froze** — never by re-reading `companies` today. Renaming a company must not
rewrite what a past document said, and the suite proves it: the frozen name
still reads correctly after the live row is renamed.

**Items are matched by `item_uid`, and by nothing else.**

| | |
|---|---|
| same uid, fields differ | **item changed** — every moved field grouped under that one item |
| uid only in the newer snapshot | **item added** |
| uid only in the older snapshot | **item removed** |
| same uid SET, different order | **items reordered** |

**A REORDER IS NEVER A REMOVAL PLUS AN ADDITION**, because identity did not
change — and it *is* a real change, because the No-op Suppression round already
established that item order is business fact.

**Unnamed item fields are counted, not named.** Thirteen item fields have
dictionary labels; anything else that differs is reported as *"and N more
details changed"*, so an internal key can never surface as English text in a
translated screen.

---

## THE ANSWER IS DATA; THE WORDS ARE THE PAGE'S

The API returns a machine `kind` and the persisted values. Every sentence a
person reads is produced in `index.php` through the same dictionary as the rest
of the UI, so history is translated like everything else rather than shipping
English out of the server. Item labels are trade vocabulary — `M12 · L 500` —
and are data, like `RM` and `M20` elsewhere.

`item_uid` is used for matching and is **never shown** to a normal reader.

---

## THE UI

A `History` control in the existing saved-quotation action area, beside *Edit
Details*, and the existing `.modal-overlay` pattern — no new component system.
**A draft does not get the control**, because it has nothing recorded: it is not
offered rather than offered and refused, and calling the opener directly on an
unsaved quotation opens nothing.

No restore, no delete, no compare-any-two, no export, no filters, no search, no
analytics. Putting a button there for any of them would be inventing a contract
nothing implements.

---

## ALLOWED TO CHANGE

```candidate-files
api.php
index.php
tests/php/history_read.test.php
tests/suites/41-history.test.js
tests/lib/harness.js
```

Nothing else may differ from `5729ad5001694bc62370472277dc9e5860276408`.
`api.php` and `index.php` are the deployed application files; `harness.js` gains
one default answer for the new action and nothing else.

---

## MUST NOT CHANGE — AND DOES NOT

The whole accepted write path: `ref_no` and its allocator · `GET_LOCK` and its
release ordering · READ COMMITTED on create only · the **exactly one** 1062
retry and its real-race recovery · exactly one CREATE revision carrying the
settled `ref_no` · `SELECT … FOR UPDATE` · `item_uid` reconciliation · **no-op
suppression** · rollback when a revision cannot be written · exactly one
`INSERT` into `quotation_revisions` and no `UPDATE`/`DELETE`/`TRUNCATE` ·
`snapshot_schema_version = 1` · Actor Identity · pricing · Quick Add · the
parser · `delete_quotation`.

---

## MEASURED ON THIS CANDIDATE

Filled in from the runs, not carried over. **None of these are canonical** —
CANONICAL-STATE still describes `5729ad5`, and a candidate does not touch it.

### Targeted — reading history

| | |
|---|---:|
| `tests/php/history_read.test.php` on MySQL **8.0.46**, the production engine | **126 / 0** |
| the same suite on MySQL **8.4.3** | **126 / 0** |

The shipped `api.php` is copied byte-identically into a sandbox and served over
real HTTP; the revision table is lifted from the shipped migration. Revisions
are made the only way the application makes them — by saving and updating real
quotations through the real endpoints — **except** where a case is about a
record this application cannot produce (a legacy first UPDATE, a nameless actor,
a future snapshot version), which is inserted directly and says so in the suite.

**What it proves.**

READ ONLY, asserted on the source: the history branch contains no `INSERT`, no
`UPDATE`, no `DELETE`, no `TRUNCATE`, opens no transaction, never reaches
`dc_write_revision`, and takes no row lock. It does **not** join `quotations`,
reads `quotation_revisions` directly by a **bound** id, and orders
`revision_no ASC` for derivation.

NOTHING IS TOUCHED BY ASKING — three reads in a row leave the quotation row
byte-identical, every revision row byte-identical, the revision count unmoved
and no `revision_no` changed.

EMPTY IS EMPTY — a quotation with no revisions, and an id nothing ever used,
both answer `ok` with an empty list rather than an error or an invented entry. A
request with no id is refused.

CREATE — one entry, numbered 1, with the item count, the persisted total and the
**frozen** company name, and **no from/to values invented for a creation**.

FIELDS — a `customer_name` change is exactly one change with the right old and
new values. A company change is **one** change, not id-plus-name, carrying the
name each snapshot froze — and it still reads the frozen name **after the live
companies row is renamed**, which is the point.

ITEMS — an edit on the same `item_uid` is an item CHANGED with **both** moved
fields grouped under that one item, and zero additions or removals; an added
item is exactly one addition; a removed item exactly one removal. The `item_uid`
never appears in the label.

REORDER — one change, `items_reordered`, with **zero** false additions, **zero**
false removals, no item reported as edited, and the uid SET proven identical on
both sides in a different order.

EACH ENTRY IS A STEP — seven revisions read back newest-first and deterministic,
each describing only its own difference from the one immediately before it; the
company-change entry carries one change and not everything since #1. Two
identical reads answer identically.

HONESTY — a legacy first UPDATE reports *no previous state*, is still shown as
the UPDATE it is, and invents no from/to; its null actor fields stay null; the
revision after it derives normally; and a snapshot at version 9 is reported as
unsupported, naming the version, with its readable metadata still read and its
structure not guessed at.

THE ID ASKED FOR IS THE ID ANSWERED — two quotations with different histories
stay separate, and `id=1 OR 1=1` is read as the integer 1.

### Every other PHP suite, against the changed `api.php`

| | |
|---|---:|
| no-op suppression | **171 / 0** — re-confirmed on **8.0.46** |
| revision writer | **101 / 0** — re-confirmed on **8.0.46** |
| transaction foundation | **92 / 0** — re-confirmed on **8.0.46** |
| revision storage | **198 / 0** — re-confirmed on **8.0.46** |
| item identity | 159 / 0 |
| mysqli compatibility | 94 / 0 |
| pricing / history | 172 / 0 |
| AI extraction | 107 / 0 |
| save retry | 42 / 0 |
| actor identity | 150 / **1** — the known PHP 8.3.30 bcrypt-cost artifact |

**No accepted suite was edited.** `auth_identity`'s single failure is the
recorded runtime-relative assertion and is **not** restated as 150 / 0.

`php -l` clean on every PHP file.

**THE ACCEPTED WRITE PATH IS BYTE-IDENTICAL**, compared function body for
function body rather than assumed: `dc_write_revision`,
`dc_build_quotation_snapshot`, `dc_read_quotation_snapshot_row`,
`dc_next_revision_no`, `dc_reconcile_item_uids`, `dc_lock_quotation_for_update`,
`dc_txn_begin`, `dc_business_state`, `dc_business_items`, `dc_ksort_deep`,
`next_free_ref_no`, `dc_save_quotation_insert`, `fail_json`.

### Translation

`index.php` **100% translated · 0 missing zh · 0 undefined · 0 identical ·
0 hard-coded**. The history strings are dictionary keys in both languages; the
em dash for an absent value is a symbol, not a key, for the same reason `RM` and
`M12` are not.

The key count moves **862 → 903**. That is a canonical figure and is recorded
here as measured, not written into CANONICAL-STATE.

### Full browser matrix — run, because `index.php` changed

| | |
|---|---:|
| Suites | **41** — the fortieth plus `41-history` |
| Assertions | **4,010** — 3,936 before this round, **+74** from the new suite |
| Failed | **8** |
| Skipped | **0** |
| Elapsed | 914.4s |

The 41 per-suite lines sum to 4,010, which is asked rather than assumed.

**ALL EIGHT ARE THE RECORDED `38-mobile-ui` ENVIRONMENT EXCEPTION** — the
`companies.php` modal close control at 1440 / 980 / 700 / 600px. `companies.php`
is untouched by this round, and the total is **not** restated as 0 failed.

**`35-edit-mode` did not fire on this run.** It is a load-sensitive flake
already characterised against a pristine control; the matrix was run with both
MySQL engines stopped, which is the condition under which it measured 0 of 10
previously. **This round does NOT claim it is mechanically unreachable** —
`index.php` changed here, so that argument no longer holds and is deliberately
not made.

**No new regression.** The new suite is green at **74 / 0**, and no existing
browser assertion was weakened: `tests/lib/harness.js` gains one default answer
for the new action and nothing else.

### Canonical figures this round would move, recorded but NOT written

| | now | would become |
|---|---:|---:|
| browser suites | 40 | **41** |
| browser assertions | 3,936 | **4,010** |
| side group — history read | — | **126** |
| final assertions | 5,101 | **5,301** |
| delta | +2,291 | **+2,291 → +2,491** |
| translation keys | 862 | **903** |

CANONICAL-STATE is not touched by a candidate.
