# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**ITEM IDENTITY FOUNDATION**

The smallest change that gives every persisted quotation item a stable,
immutable, server-owned identity. No revision storage, no audit rows, no
history table, no diffing, no transaction redesign, no schema change, no
deployment, no production DB write.

| | |
|---|---|
| Accepted application commit | `e76bb85d663f96fdce3ed6c0c70b72c49d84000a` |
| Round status | **CANDIDATE — READY FOR REVIEW** |
| DEPLOY = NO | a candidate is not a deployed state |
| STAGE 2 = NOT STARTED | nothing in Stage 2 was begun, examined or implied |
| Production DB change | **NO** — the backfill is prepared, NOT APPLIED |
| Revision Storage | **NOT STARTED** — identity only |

---

## WHY THIS ROUND EXISTS

Actor Identity answered *who is asking*. It is live and production verified.
The other half of "who changed this quotation item" is *which item* — and a
quotation item has no identity at all:

```php
$items = json_encode($input['items'] ?? []);   // update_quotation, before this round
```

The whole array is replaced on every save. An item is known only by its
position in that array, so the server cannot tell

```
edited item 2        from   deleted item 2 and added a new one
reordered            from   rewrote every row
```

Any audit table built on top of that would record position changes as content
changes and content changes as position changes. Identity has to come first,
and it has to come from the server: an id the browser can choose is a field,
not an identity.

---

## THE CONTRACT

```
itm_ + 32 lowercase hex        bin2hex(random_bytes(16))
itm_6f9d7e8b9f4d4ec986f0d093e7815fd2
```

**The server is the authority.** `dc_new_item_uid()` is the only place one is
made, and it lives in `api.php`.

**CREATE.** Every item is given a fresh uid before persistence and any
client-supplied one is discarded — on a create there is nothing an incoming uid
could refer to, so accepting one would let a browser choose an identity.

**UPDATE.** `update_quotation` reads the persisted `items` — one column, one
row, the minimum this needs — and reconciles before anything is written:

| incoming | outcome |
|---|---|
| uid present, valid, belongs to this quotation, seen once | **preserved exactly** |
| no uid (`absent`, `null`, `''`) | **new item**, fresh uid |
| uid present but malformed | `ITEM_IDENTITY_MALFORMED_UID` |
| the same uid twice | `ITEM_IDENTITY_DUPLICATE_UID` |
| a uid this quotation does not hold | `ITEM_IDENTITY_UNKNOWN_UID` |
| a persisted uid missing from the incoming array | **deleted** — its identity goes with it and is never reissued |

**A persisted quotation whose stored identity is missing, malformed or
duplicated is refused** with `ITEM_IDENTITY_BACKFILL_REQUIRED`. It is **not**
reconciled by array position. Position matching is the exact guess this round
exists to remove, and doing it once "just for legacy rows" would put identity
on the wrong item in the one case nobody would check.

Every refusal returns before the `UPDATE` is prepared, so a refused save leaves
the quotation untouched.

**Not this round.** The read-then-write in `update_quotation` is not wrapped in
a transaction. Two simultaneous edits of one quotation can still interleave
exactly as they always have. That is the transaction-foundation round, and
widening this one to reach it would put the allocation, the lock and the 1062
retry back on the table.

---

## THE PAGE

`index.php` carries identity and cannot mint it.

- a loaded saved item keeps its uid
- editing fields keeps it — including through the **three commit sites** where
  an item rebuilt from the entry form replaces a row that already exists.
  `dcCarryItemUid(prev, next)` moves identity across that replacement; without
  it, editing a saved row would silently delete it and add a different one
- reorder moves the uid with the item, because the uid is on the item
- a new manual / Quick Add / AI-created item starts with **no** uid — that is
  how the page asks for one
- `dcStripItemUid()` exists so anything that copies a row clears identity: a
  copy of an item is a different item
- the page contains no uid literal and no generator of its own

After a save the server answers with the normalized persisted items, and
`dcAdoptServerItems()` takes the uids it issued **before** the snapshot. That
is what makes the important case work:

```
create  →  server mints uids  →  edit again WITHOUT reloading  →  save
        →  the same uids, so the second save is an edit, not three new items
```

---

## ALLOWED TO CHANGE

```candidate-files
api.php
index.php
migrations/2026-08-27-backfill-item-uids.php
tests/php/item_identity.test.php
tests/suites/40-item-identity.test.js
```

Nothing else may differ from `e76bb85d663f96fdce3ed6c0c70b72c49d84000a`.

`auth.php`, `login.php`, `logout.php`, `companies.php`, `pricing_history.php`,
`ai_extract.php`, `db.sample.php` and the existing thirty-nine browser suites
are **out of scope and must not change**.

---

## MUST NOT CHANGE — AND DOES NOT

`ref_no` format · server-side allocation · `GET_LOCK` · `uq_quotations_ref` ·
`NOT NULL ref_no` · the one-time 1062 retry · `mysqli_report(MYSQLI_REPORT_OFF)`
· quotation create / update / delete semantics · pricing · material mapping ·
Previous Price · Quick Add · the item JSON structure apart from the one new key
· Actor Identity · the translation dictionary.

`update_quotation`'s own `UPDATE` statement is unchanged, `ref_no` is still not
in it, and `save_quotation`'s allocation path is untouched.

**No schema change.** `item_uid` lives inside the existing `quotations.items`
JSON. There is no item table and no migration that alters one.

---

## BACKFILL

`migrations/2026-08-27-backfill-item-uids.php` — CLI only, refuses to run from
the web, **dry run by default**, writes only with `--apply`, and requires
`--db=/path/to/db.php` rather than guessing which database it is about to
touch. It runs inside a transaction and rolls back on any failure.

- preserves every existing valid uid
- adds one only where it is missing
- **detects malformed and duplicated stored uids and refuses to write anything
  at all** — see the gate below
- idempotent — a second run reports 0 to write
- updates only the rows that changed
- prints counts, and quotation ids for problem rows only. No customer data.

**THE GATE, and why there is no repair flag.** This file adds identity where
there is none. It does **not** rewrite identity that already exists, even when
that identity is damaged, and there is no option that makes it. If any stored
`item_uid` is malformed, or two items in one quotation claim the same one, the
run prints those quotation ids, prints `GATE CLOSED`, rolls back and **exits
non-zero** — in dry run and under `--apply` alike.

The refusal is deliberately total: **not just the damaged rows, the whole run.**
A backfill that quietly did the healthy rows and skipped the rest would report
success and leave an operator believing the job was finished.

Deciding which of two items keeps a duplicated uid, or what a malformed one was
meant to be, is a decision about *which item is which*. A migration that made
that choice on its own would be guessing precisely the thing this round exists
to stop guessing. A person inspects those quotations and decides. Until then
`update_quotation` refuses them with `ITEM_IDENTITY_BACKFILL_REQUIRED`, which
is the correct refusal and not a bug to route around.

**The proof it carries.** For every row, the items array is compared before and
after **with `item_uid` stripped out**, and a single difference aborts the whole
transaction. So the quotation id, `ref_no`, company, customer, item order,
descriptions, sizes, materials, quantities, pricing, totals and dates cannot
move — not because the file promises it, but because the run stops if they do.

`migrations/` is **not** part of the deployed file set in `.cpanel.yml`, so the
backfill runs from the server-side git checkout and is never reachable over
HTTP.

---

## ROLLOUT DESIGN — DOCUMENTED, NOT EXECUTED

1. production database backup
2. pause quotation edits briefly
3. backfill **DRY RUN**, and read the counts
4. review — if the dry run printed `GATE CLOSED`, step 5 will refuse; the
   named quotations must be inspected and decided by hand first
5. backfill `--apply`
6. verify every persisted item now holds a valid unique uid
7. deploy the accepted Item Identity application
8. production smoke
9. resume edits

**Why the pause is in step 2 and not somewhere more convenient.** The build
that is live today never reads `item_uid`, so a backfilled quotation renders,
prices and prints under it exactly as before, and the extra JSON key changes
nothing a customer or a calculation sees — verified: the accepted build
contains no reference to `item_uid` at all, and its load path spreads unknown
item keys through untouched.

But the old build's *edit* path rebuilds an item object from the entry form,
and an object it rebuilds does not carry the new key. So an item edited under
the OLD application after the backfill loses its identity again and its
quotation would need backfilling a second time. Nothing breaks — the backfill
is idempotent and `update_quotation` fails closed rather than guessing — but
the window between step 5 and step 7 is the one to keep short.

Rolling the application back is the real rollback: the previous release ignores
`item_uid` entirely, so the backfilled data stays valid and nothing has to be
undone.

---

## ACCEPTANCE — WHAT MUST BE TRUE TO CLOSE

- CREATE: every item receives a uid; a supplied one is ignored; two new items
  receive different uids
- UPDATE: an ordinary edit preserves the uid; a reorder preserves the
  uid-to-item pairing; a delete removes that uid and never reissues it; an
  added item receives a fresh uid that differs from every retained one
- every refusal above fails closed, by name, before anything is written
- a legacy persisted quotation asks for the backfill rather than being guessed
- the page: load → edit → save preserves identity; create → save → edit again
  without reloading preserves identity; a copy clears it; a reorder does not
  regenerate it
- backfill: dry run writes nothing; apply adds only what was missing; a second
  apply is idempotent; business data identical with `item_uid` stripped, and
  `item_uid` is the only key any item gains
- backfill: a malformed or duplicated **stored** uid is detected, named, and
  refuses the apply outright — nothing written, non-zero exit, and no flag
  anywhere that would repair it instead
- `php -l` clean on every changed PHP file
- the existing regression, unchanged: the thirty-nine accepted browser suites,
  translation **862 keys / 100%**, and the accepted PHP side suites at their
  accepted figures

Then STOP. **No deploy. No production DB write.** Candidate only.

---

## MEASURED ON THIS CANDIDATE

Filled in from the actual runs, not from the accepted figures. This round adds
tests, so the totals move and are reported as they were measured. **None of
these are canonical** — CANONICAL-STATE still describes `e76bb85`, and it is
not touched by a candidate.

| | |
|---|---:|
| Browser suites | **40** (39 accepted + `40-item-identity`) |
| Browser assertions | **3,936** |
| Item identity PHP (`tests/php/item_identity.test.php`) | **156** |
| Pricing / History | 172 |
| AI Extraction / Parser | 107 |
| Workbook | 62 |
| Translation | 15 |
| Save retry | 42 |
| mysqli compatibility | 94 |
| Actor Identity | 150 |
| **Candidate total** | **4,734** |
| Baseline | 2,810 |
| **Delta** | **+1,924** |

```
  3,936   browser (40 suites)
+   172 + 107 + 62 + 15 + 42 + 94 + 150   the accepted side groups
+   156   item identity
= 4,734   candidate total          4,734 - 2,810 = +1,924
```

The thirty-nine accepted suites still measure **3,907** — 3,936 − 29, the new
suite's own count. Not one existing suite's assertion count moved, which is the
point: this round adds a key and changes no behaviour any of them measure.

Translation **862 keys / 100%**, unchanged — `index.php` gained no user-visible
string. `php -l` clean on every PHP file.

### What did NOT come out green here, and why

**Eight browser assertions failed, all in `38-mobile-ui`, and none of them
belong to this round.** They are the companies.php modal `✕` desktop
dimensions — expected 24 tall / 17 wide, measured 27 / 16.3 at 1440, 980, 700
and 600px. `companies.php` is untouched by this candidate. Proven rather than
asserted: a pristine `git worktree` at `ce26146` — this round's own starting
point — fails the same eight assertions with the same numbers. They are font
metrics on this Windows Chromium; the accepted matrix was measured in a Linux
sandbox with a different fallback stack, and the harness strips the Google
Fonts link. Nothing here may be read as the accepted 39/3,907 run being
reproduced on this machine.

**Two side figures are carried forward, not re-measured here:**

- **Workbook 62** — `check-pricing-workbook.py` needs `openpyxl`, which is not
  installed on this machine. Untouched by this round.
- **Actor Identity 150** — measured on this machine as 150 assertions, **1
  failed**: the deliberately runtime-relative bcrypt-cost assertion, which
  needs PHP 8.4 (default cost 12) and gets 10 on the local 8.3.30. Already
  recorded in CANONICAL-STATE. Unrelated to this round and not to be relaxed.

The six suites that ran clean here — item identity 137, pricing 172, AI
extraction 107, mysqli 94, save retry 42, translation 15 — match their accepted
figures exactly.
