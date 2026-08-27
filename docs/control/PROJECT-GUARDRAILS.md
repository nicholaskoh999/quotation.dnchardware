# QUOTATION.DNC — PROJECT GUARDRAILS

## PURPOSE

This file defines accepted behaviour and protected application areas.

Claude/Codex MUST read this file before every:

- implementation round
- repair round
- audit
- evidence capture
- packaging round

A current prompt does not automatically authorize changing protected behaviour.
The current `ROUND-SCOPE.md` must explicitly allow it.

**Reading order, every round:**

1. `docs/control/PROJECT-GUARDRAILS.md` — what is permanent
2. `docs/control/CANONICAL-STATE.md` + `.json` — what the numbers are
3. `docs/control/ROUND-SCOPE.md` — what this round may touch
4. only then the task prompt

If a prompt conflicts with this file or with CANONICAL-STATE: **stop that
change and report the conflict.** Do not silently pick an interpretation.

---

## PROTECTED / ACCEPTED AREAS

Unless `ROUND-SCOPE.md` explicitly authorizes modification, **do not change**:

- parser behaviour
- extraction rules
- pricing engine
- **accessory pricing — accessories are inside the parent item's final customer
  price, and the bolt / accessory breakdown is preserved (see ACCESSORIES below)**
- weight formulas
- diameter rules
- Previous Price matching / reuse rules
- material mappings
- finish mappings
- Size Type rules
- Qty rules
- History identity rules
- customer-history priority
- Fast Edit workflow
- Bulk Edit workflow
- Details workflow
- accepted Compact row layout
- **accepted STAGE 1 UI — the narrow-width scope control, the Companies mobile
  tap targets and the print / PDF A4 quotation layout (see STAGE 1 UI below)**
- Pricing Summary position
- accepted History layout
- database behaviour
- unrelated application UI

**A failing test alone does NOT authorize changing accepted business
behaviour.** First determine whether

1. the application behaviour is wrong, **or**
2. the test expectation / evidence / report is stale.

This distinction has decided the outcome more than once in this project. When
a suite disagreed with the application over whether a manual diameter survives
an unrecognised size, the application was right and the test was corrected.
When a frame disagreed with a refusal message, the frame was wrong. Neither was
resolved by changing the code to make a check go green.

---

## CORE ACCEPTED BUSINESS RULES

### QTY

- Qty absent ⇒ **1**
- source does not state Qty ⇒ **1**
- clear explicit Qty ⇒ use the explicit value
- ambiguous / conflicting Qty ⇒ **Needs Qty / blocked**, never resolved to one
  of the candidates — and this holds wherever the ambiguity is written, on the
  item's own line as well as on a line of its own
- Qty is **NOT** a Previous Price / History identity dimension

### DIAMETER / WEIGHT

**Visible DIA must equal calculation DIA.** The number on the screen is the
diameter the weight was made of; there is no second, hidden value.

| | |
|---|---|
| M12 Fullsize | DIA = **12.0 mm** |
| M12 Undersize | DIA = **10.6 mm** |

Manual DIA:

- visible DIA = manual DIA
- calculation DIA = the same manual DIA
- weight follows the actual DIA

**Esc provenance.** A diameter is two facts — the number, and whether a person
chose it. Escape restores both:

```
Default 10.6  →  edit 10.7 (Manual)  →  Esc  →  10.6 Default
Manual 10.7   →  edit 11.0 (Manual)  →  Esc  →  10.7 Manual
```

Changing to an unsupported size must not leave a stale previous DIA or weight
on the screen. The row asks for a valid **size**, which is the real problem,
and shows no bar at all.

### MATERIAL

| written as | becomes |
|---|---|
| `8.8`, `G8.8`, `Grade 8.8`, `HT8.8`, `HT 8.8` | **4140 QT** |
| `10.9`, `Grade 10.9`, `HT10.9` | **4340 QT** |
| `A2`, `A2-xx`, `SUS304`, `SS304` | **SS304** |
| `A4`, `A4-xx`, `SUS316`, `SS316` | **SS316** |

The 8.8 / 10.9 mappings apply unless an explicit stainless base material is
present.

### FINISH

SS304 / SS316 ⇒ **Finish = N/A**. Never auto-assign PL, HDG or ZP to a
stainless material.

### SIZE TYPE

If the source does not state Fullsize / Undersize ⇒ **null / Needs Size Type**.
**Do not guess.** Only explicitly documented company exceptions may apply, and
the existing accepted exceptions remain protected.

A product that has no size type at all (a Stud) is not the same thing as one
whose size type is unknown, and must not be reported as missing it.

### ACCESSORIES — INSIDE THE FINAL UNIT PRICE

**All accessories belong to the parent item's final customer price.** Accepted
in STAGE 0B, `98a31e3`. It supersedes the `bolt-separate` rule, under which an
accessory was its own charge on the line — that rule is retired and must not be
reinstated without the same explicit approval that replaced it.

```
Base / bolt price   RM 5.76
Accessories         RM 2.00
FINAL UNIT PRICE    RM 7.76      ← the ONE number quoted to the customer
```

The screen reads:

```
FINAL UNIT PRICE                 最终单价
RM 7.76                          RM 7.76
Includes accessories: RM 2.00    已含配件：RM 2.00
```

With no accessories the second line is **not rendered at all**. Nut, FW and
Custom all follow this rule, and several accessories use their combined total,
added **once**.

**The breakdown is preserved, and that is not optional.** History compares a bolt
against a bolt; a "bolt price" that were really bolt-plus-hardware would grow by
its accessories every time it were reused. So every saved item carries both ends:

| field | meaning |
|---|---|
| `boltUnitPrice` | internal bolt / base component |
| `accessoryUnitPrice` | per-parent-item accessory total |
| `finalUnitPrice` | **customer-facing inclusive unit price** |
| `lineUnitPrice` | the same inclusive figure — compatibility alias |
| `accessoryTotal` | `accessoryUnitPrice × Qty` |
| `totalAmount` | `finalUnitPrice × Qty` |
| `pricingModel` | `accessory-inclusive` |

**Price mode decides which end is known, never whether accessories are charged.**

| mode | |
|---|---|
| Auto Round · No Round | the **bolt** is calculated, and the accessories are **added** to reach the customer's price |
| **Manual Price** | the **customer's** price is typed, so the accessories come **out** of it to leave the bolt component. RM10 typed with RM2 of nuts quotes **RM10**, reports RM2 of accessories, and leaves an RM8 bolt — never RM12 |

**Customer-facing output carries no separate accessory charge.**

- WhatsApp / copied text: `1. M12 x L 1000 x TL 100/100mm - RM7.76` then plain
  `cw 2nut`. **Never** `- RM5.76` with `cw 2nut - RM2.00` beneath it.
- Print / PDF: **one** priced row per parent item. Unit Price is the inclusive
  Final Unit Price, Amount is that price × Qty, and the accessory wording is a
  plain description in the dimension cell with no money in it.
- The quotation item card's headline price is the inclusive one. The bolt and
  accessory components may be shown beneath it as breakdown, and the bolt-only
  figure must **never** be presented as the customer's unit price.

**Three vintages of saved item, each read as it was written.** The money a
customer already agreed to is not ours to move:

| vintage | what it holds | what must happen |
|---|---|---|
| `accessory-inclusive` | `finalUnitPrice` already inclusive, bolt beside it | read as written |
| `bolt-separate` | `finalUnitPrice` was the **bolt**, `lineUnitPrice` was the line | normalised once on load. **The total it was saved with wins.** A manual price folds **up** to the customer figure, so re-saving neither double-charges the accessories nor drops them |
| legacy (no model) | one figure, the charge already inside it | already what this rule asks for. Read as written, and **no separation is invented** for it |

**The amount of accessory money is not what changed.** Two nuts at RM1.00 are
RM2.00 before and after. Only where that RM2.00 is *presented* moved. A change
that quietly stopped charging for accessories would be a worse defect than the
one this rule replaced.

Protected by `tests/suites/14-accessory-inclusive-price.test.js` and the
accessory sections of `tests/php/pricing_history.test.php`.

### HISTORY / PREVIOUS PRICE

The M value must match **exactly**:

- M12 must not match M10 or M14
- M20 must not match M18, M22 or M24

Qty is **not** a matching dimension. Identity uses the established dimensions:
customer priority, material, product type, finish, size type, exact M, pitch
where applicable, price mode.

Customer behaviour:

- same-customer eligible history first
- if no customer history exists, eligible global same-identity history may be used
- a different-customer source must stay evidenced with its quotation and date

Geometry changes (L, TL, W, H, ID, S) follow the accepted current-weight
recalculation rules. The Previous Price formula behaviour is protected.

**An identity change must invalidate stale Previous Price provenance.** A row
moved off the identity a record was matched on stops crediting that record —
the rates it contributed stay, because by then they are the row's own pricing
entry, but the claim goes.

---

## WORKFLOW ROLES

The three ways a row can be written to, and the boundaries between them. This
separation is accepted and is not to be blurred.

| | writes | shape |
|---|---|---|
| **Fast Edit** | many rows, **different** values | a spreadsheet |
| **Bulk Edit** | many rows, **one shared** value | a stamp |
| **Details** | one row, everything about it | a form |

### FAST EDIT

Spreadsheet editing of Size, DIA, L, W, H, ID, S, TL and Qty, over all rows at
once. Clicking an editable cell or a warning tag enters the **same** Fast Edit
mode — there is one edit state, with several doors into it.

Locks that must hold while it is open: Expanded, Add, History / Previous Price
apply, Bulk Edit, common identity fields, re-upload / re-parse, Delete.

### BULK EDIT

Common Fields (Material, Finish, Size Type, and the shared Product field where
the implementation supports it), Pricing (Cost Rate, Additional Cost, Markup,
Price Mode), and Accessories.

- All Items / Selected Items, with explicit row selection and a visible count
- **Selected Items must NEVER silently become All Items**
- Selected = 0 must **refuse** and disable every selected-scope action,
  including the destructive ones
- must not duplicate Fast Edit's geometry spreadsheet

**Documented exception — Fill Missing Size / TL.** A shorthand document states
lengths and quantities and never states the size or the thread; the extractor
is forbidden from inventing either, so thirty rows arrive with the same two
blanks. This panel exists for that case only. It fills blanks, never overwrites
a stated value, and is not rendered when nothing is missing.

### DETAILS

EN **Details** · 中文 **详情**. Deep-edit one row: Reference, Specification,
Pricing, Calculation, Accessories. Must not duplicate Fast Edit's geometry
inputs.

- Compact: Details opens and closes one row.
- Expanded: every row is open *because of the view*, so **do not render a Close
  action that cannot close the row.**

---

## STAGE 1 UI — ACCEPTED, AND PROTECTED FROM HERE

Accepted in STAGE 1 on `3e89713`. Presentation only: nothing here changed what
the application charges, parses, stores or generates. What is recorded below is
the accepted OUTCOME, not the CSS that produces it — a later round may reach the
same outcome differently, but may not lose it.

### The narrow-width scope control

At 430px and below, **the APPLY TO label and the scope buttons it names stay
together**, on one row, and the bar does not scroll horizontally at 430 / 390 /
360.

The defect this closed was not clipping. `.wqa-scope-lbl` carried
`margin-left:auto` inside a wrapping flex bar, so the label was pushed to the
right end of one row while its own buttons wrapped to the left of the next — a
person read "APPLY TO:" against the Bulk Edit button and read the scope buttons
as belonging to nothing. **This is a Selected Items control**, and the rule
under BULK EDIT that Selected Items must never be silently read as All Items is
exactly what an orphaned label puts at risk. Treat a regression here as a
correctness regression, not a cosmetic one.

Above that width the accepted desktop density from UI POLISH 1 and UI POLISH 2
is unchanged, and the suite measures the 641 / 640 boundary itself so the fix
cannot creep upward.

### Companies mobile tap targets

At phone widths and on coarse pointers, the Companies controls a thumb actually
reaches for — the `EN` / `中文` buttons, the modal close `✕`, and the search /
filter inputs — are **at least 44 × 44**. Before this round the close control
was 17 × 24, less than a third of a comfortable target.

**The desk sizes are equally protected.** The suite asserts the same controls at
exactly their accepted desktop dimensions, so raising a phone target may never
be paid for by moving accepted desktop density.

### The print / PDF quotation

The printed sheet is a **professional A4 quotation**, not a dump of the items
array. Accepted and protected:

- A4 with real margins; readable body type; a title that reads as a title, with
  a rule under it; meta fields as label-above-value rather than run together
- a Description column wide enough for its content, money and Qty columns
  right-aligned, and **tabular numerals** so digits line up down the column
- a **Grand Total a reader finds at once** — larger than the row type, above a
  heavy rule, not one more grey cell in the table
- multi-page safety: the table header repeats on every page, and a row does not
  break across a page boundary

### The two rules the print work must never undo

- **Accessory-inclusive pricing survives into print.** The Unit Price on the
  printed sheet is `dcItemFinalUnit` — the customer's final price, accessories
  included — and the accessory wording (`cw 2nut`) prints as plain description
  text carrying no money of its own.
- **No separately priced accessory row may return, in any form,** on the printed
  sheet or anywhere else. See ACCESSORIES above.

### Numbering identity

**Item 3 is item 3 on Screen, on Print and in WhatsApp.** Verified in STAGE 1 on
a deliberately interleaved quotation and protected from here.

The three surfaces deliberately ORDER those items differently — Print in
insertion order, Screen in the Newest First view, WhatsApp grouped by material
and finish with each row carrying its own item number rather than its position
in the message. **That difference was verified and left alone, not repaired.**

### Print rules stay in print

`#printSummary` is a direct child of `<body>` and is `display:none` on screen;
the print sheet hides every sibling. A rule written for the printed page must
stay inside `@media print`, and the screen must be measurable as unmoved from
the screen side after `afterprint`.

---

## DEFERRED TO STAGE 2 — NOT ACCEPTED BEHAVIOUR

Raised in STAGE 1, deferred by Nicholas's decision. **Neither is an accepted
change, and neither may be treated as one until a round is scoped for it.**

- **Dark mode.** There is no dark mode in this application: all three pages
  hardcode `data-theme="light"`, there are zero `prefers-color-scheme` colour
  rules, zero dark rules and no toggle. Building one is a feature round — a
  second complete palette over the colour tokens on three pages, every active /
  selected / focus / disabled state, and UI POLISH 1 and UI POLISH 2 re-proved
  inside it — not a cleanup.
- **Numbering ORDER** on any surface. Changing it changes generated customer
  output. Identity is protected above; order is open, and open means unchanged.

---

## ACCEPTED COMPACT ROW

Keep DIA beside Size, the current density, and the Pricing Summary directly
under each compact row. **Do not move the Pricing Summary again without
explicit approval.**

---

## ACCEPTED — THE ONE DATABASE ERROR THE SAVE PATH ANSWERS

`save_quotation` retries its INSERT **once**, and only on MySQL **1062**
(duplicate key on `quotations.ref_no`). On 1062 it re-allocates through the
existing `next_free_ref_no($db)` and executes again; on any other errno it
returns false untouched so the caller fails exactly as it did before.

Protected from here:

- **Maximum retry is one.** A second 1062 is a failure, not another attempt. A
  loop would hide a fault that is no longer a race.
- **Only 1062.** A prepare failure, a lost connection, a foreign-key violation
  or a truncation must never be retried — that is how a hard failure becomes a
  silent double-write. Widening the errno test is a business-rule change and
  needs explicit approval.
- **`GET_LOCK` stays.** The lock is not made redundant by the retry and is not
  a substitute for it: the lock serialises two PHP requests, 1062 catches what a
  lock held in one process cannot see.
- **The allocator is not redesigned.** `next_free_ref_no($db)` and the
  `Q-YYYY-NNNN` format are unchanged; the retry calls the existing allocator
  rather than inventing a number.
- **`update_quotation` is not wrapped**, and must not be — it does not allocate
  a reference number.
- `$ref_no` is bound **by reference**. Anything that copies it before the retry
  breaks the fix silently, because the second attempt would re-send the taken
  number.

`tests/php/save_retry.test.php` extracts the function from the shipped `api.php`
and fails if any of the above stops being true.

---

## ACCEPTED — THE DRIVER CONTRACT THIS CODE IS WRITTEN AGAINST

`api.php` calls `mysqli_report(MYSQLI_REPORT_OFF)` immediately before `db.php`
is required. Everything in this application checks a RETURN VALUE and then an
errno; there is no `try`/`catch` in any PHP file. PHP 8.1 changed the default
report mode so mysqli throws instead, which turns every one of those checks
into dead code and kills the 1062 retry.

Protected from here:

- **The call stays, and stays before `db.php`.** `getDB()` lives in the
  server-only `db.php`, which is absent from Git; the call must precede it, and
  nothing before it may touch mysqli.
- **It stays unconditional.** No `PHP_VERSION_ID` gate. On 8.0 it is a no-op
  because OFF is already the default; on 8.1+ it restores the contract. One
  statement, every version.
- **The helpers keep branching on return values.** `query_or_fail`,
  `prepare_or_fail`, `execute_or_fail` and `dc_save_quotation_insert` must not
  be rewritten into exception handling. Converting them is a change of error
  architecture and needs explicit approval.
- **`dc_save_quotation_insert()` must keep SEEING `$stmt->errno`.** If an
  exception can reach it first, the duplicate-ref_no retry is gone.
- **A new file that opens its own database connection needs the same call.**
  Today `api.php` is the only DB entry point, which is why one call suffices.

Accepted and deliberate: OFF also silences mysqli warnings — exactly what PHP
8.0 does today, and the application reports `$db->error` / `$stmt->error` in
its own JSON.

**CSV.** `str_getcsv()` and `fputcsv()` state all three defaults
(`','`, `'"'`, `"\\"`). PHP 8.4 deprecates leaving them implicit and PHP 9
changes them. Proven byte-identical to the implicit form; do not drop them
back.

`tests/php/mysqli_compat.test.php` drives the shipped `api.php` and fails if
any of the above stops being true.

---

## ACCEPTED — WHO IS ASKING

Accepted in ACTOR IDENTITY FOUNDATION on `e76bb85`. Authentication is DB-backed
per individual person: the server can name the staff member behind a request
instead of seeing one shared `admin`. `auth.php` and `login.php` are the only
application files it changed.

Protected from here:

- **`app_users` supplies an immutable numeric user id**, and that id — not the
  username — is the actor's identity. A username can be re-cased or corrected;
  the id is what future audit rows will point at.
- **A successful authenticated session stores exactly four identity facts**,
  all read from the authenticated row and never from the client:

```
dc_user_id  ·  dc_username  ·  dc_display_name  ·  dc_login_time
```

- **`dc_user` is a compatibility alias only.** It is not identity, and no new
  code may read it as identity.
- **`dc_current_user()` is the canonical server-side actor accessor.** Audit
  and revision code consumes that helper — never `$_SESSION` internals, never
  `dc_user`.
- **Passwords stay hashes, verified by `password_verify()`.** No plaintext
  credential is committed, and a disabled account (`enabled = 0`) cannot
  authenticate.
- **Unknown-user verification runs against a dummy bcrypt hash**, so every
  credential failure does the same bcrypt work. What this claims is narrow and
  must stay narrow: it **reduces the username-enumeration timing signal**. It
  is **not** a claim of identical end-to-end timing, and nothing in the round
  measured that. Do not restate it as one.
- **`get_result()` is NOT used.** It requires mysqlnd, a dependency this
  application never had. The lookup is the portable
  `bind_param` → `execute` → `bind_result` → `fetch`, bounded by `LIMIT 1` and
  closed, every step return-checked under the accepted `MYSQLI_REPORT_OFF`
  contract.
- **`auth.php` does not load the database.** `dc_login()` takes an injected
  handle; `login.php` is the only caller and the only file that requires
  `db.php`, lazily inside the POST branch, and calls
  `mysqli_report(MYSQLI_REPORT_OFF)` first exactly as `api.php` does.
- **An ordinary authenticated API request does not query `app_users`.** After
  login the identity lives in the session; putting a lookup on every request
  would put a connection behind every page.
- **There is no legacy shared-admin fallback**, and none may be reinstated. A
  fallback would be a permanent backdoor. Old shared sessions therefore stop
  being trusted at cutover — that is the design, not a defect.

**Unchanged by this round, and still protected as before:** quotation create /
update / delete behaviour · the `ref_no` format · `GET_LOCK` · the one-time
1062 retry · pricing · Quick Add · the item JSON structure. `item_uid` is
**not implemented**. Audit revisions are **not implemented**.

**ACCEPTED IN SOURCE IS NOT DEPLOYED.** `migrations/2026-08-26-create-app-users.sql`
is prepared and **NOT APPLIED**, no production user has been seeded, and
production still runs the previous shared-login build. Nothing here may be
described as production-verified until that rollout happens and is smoke-tested.

`tests/php/auth_identity.test.php` drives the shipped `auth.php` with real PHP
sessions and fails if any of the above stops being true.

---

## CONTROL-ONLY ROUND

**Two SHAs, and they are not the same thing.**

```
Accepted Application SHA   the last commit that changed an application file,
                           and the commit every canonical figure was measured
                           against

Repository / Close-out SHA the tip of main, which also carries control tooling,
                           validators, documentation and bookkeeping
```

They have always differed in practice — every acceptance close-out advances main
without advancing the application. This rule states it, so a round that touches
only the control layer can be accepted without falsely advancing the accepted
application SHA.

**A CONTROL-ONLY ROUND may modify:**

- `tests/tools/*` — validators, authoritative pointers, packagers
- control validators and their own self-tests
- control documentation — `PROJECT-GUARDRAILS.md`, `ROUND-SCOPE.md`,
  `CANONICAL-STATE.md` / `.json`
- accepted-state bookkeeping and the `FULL-AUDIT/` reports

**It must NOT modify application PHP.**

**Acceptance requirements — all of them, or it is not a control-only round:**

```
application PHP diff                = 0 files
Accepted Application SHA            unchanged
canonical application figures       unchanged
database / schema / migrations      unchanged
production application              unchanged, unless separately deployed
```

**A control-only close-out MAY advance the repository / main SHA without
advancing the Accepted Application SHA.** That is the whole point of the
distinction, and it is not a loophole: the accepted application SHA means "the
application was reviewed and accepted in this state", and a control-only round
does not put that claim in question.

**Assertion counting.** A control-system self-test is not an application
assertion. It must not be added to `finalAssertions`, to the side-suite matrix
in `authoritative.js`, or to any accepted-state report. Those figures describe
the application; inflating them with tests of the validators would make the
canonical total mean two different things at once.

**Verification is still verification.** `check-control.js` and
`check-reports.js` must both reach zero disagreements, and the application PHP
diff must be *shown*, not asserted:

```
git diff --name-only <accepted-app-sha>..HEAD -- '*.php' ':(exclude)tests/**'
        →  (empty)
```

If that command prints anything at all, the round is not control-only. Stop and
re-scope it.

---

## CHANGE SAFETY PROCEDURE

Before modifying any protected application area:

1. reproduce the defect
2. record the exact input and state
3. capture evidence
4. determine whether the application or the test/report is wrong
5. write a failing regression test where practical
6. make the smallest safe repair
7. rerun the targeted test
8. rerun the related suite
9. capture after-evidence
10. document the finding

No speculative refactors. No unrelated cleanup.

---

## AUDIT RULE

An audit finding does **not** automatically authorize a repair. If the current
ROUND-SCOPE does not cover the relevant application area:

- record the finding
- mark it **BLOCKED / REQUIRES NEXT ROUND**
- do not change application behaviour

---

## EVIDENCE RULE

A screenshot is evidence only if the thing it claims to prove is **visible
inside the captured frame**. A DOM assertion is not a screenshot: the reviewer
looks at the picture. A frame that states a figure must assert that figure and
fail the run if it moves, and must not carry a message from the step that set
it up.

---

## DEPLOYMENT

**NEVER deploy automatically.** Only Nicholas may approve deployment after
final review.
