# STAGE 0 — UI POLISH 2 ACCEPTANCE, AND ACCESSORY-INCLUSIVE PRICING

**Stage:** 0, in two sub-stages, both authorised by Nicholas
**Deploy:** NO
**Scope:** `docs/control/ROUND-SCOPE.md`

| | |
|---|---|
| **0A** | UI POLISH 2 accepted. Bookkeeping only — no application byte moved. |
| **0B** | Accessories belong to the parent item's final customer price. An explicitly approved **business-rule change**, reviewed and now **FINAL ACCEPTED**. |

---

## STAGE 0A — UI POLISH 2 ACCEPTANCE BOOKKEEPING

### 1 · Proven from Git before anything was written

Three claims, each read out of the history of the files rather than out of a
report or a branch tip.

```
git merge-base --is-ancestor e3d659b 33ae0da        → 0   (it is an ancestor)
git log --oneline e3d659b..HEAD -- '*.php'          → 33ae0da   and nothing else
git show --stat 33ae0da -- '*.php'                  → index.php | 156 +++ (1 file)
git rev-parse e3d659b:index.php  → a7ffeda1a8c9711583e6ba2502614237e5dc857c
git rev-parse 33ae0da:index.php  → 5d764b57353650853a7c14dfc807c55730cb8db4
git diff --name-only 33ae0da..d86f35e -- '*.php'    → (empty)
```

| claim | verdict |
|---|---|
| `e3d659b` is an ancestor of `33ae0da` | **yes** — four commits apart, `33ae0da` last |
| `33ae0da` is the exact UI POLISH 2 application-changing commit | **yes** — the only commit in `e3d659b..HEAD` touching any `*.php`, and it changes `index.php` alone: 156 lines added, 0 removed, one block ending immediately before `</style>` |
| no application PHP changed from `33ae0da` through `d86f35e` | **yes** — empty diff. Every application blob is byte-identical across the range, and `tests/suites/` and `tests/lib/` did not move either |

Blob-level, for all eight application files:

| file | `e3d659b` | `33ae0da` | `d86f35e` |
|---|---|---|---|
| `index.php` | `a7ffeda1a8` | `5d764b5735` | `5d764b5735` |
| `api.php` · `companies.php` · `ai_extract.php` · `auth.php` · `login.php` · `logout.php` · `pricing_history.php` | unchanged | unchanged | unchanged |

### 2 · Why no browser regression was re-run for 0A

The reviewed candidate tree and the tree being promoted are **the same bytes**.
Running the 3,958 assertions again over identical source would have produced the
identical answer and evidenced nothing the recorded run had not already
evidenced. The counts are carried forward because nothing invalidated them, not
because checking was skipped — and the diff above is what says so.

### 3 · The bookkeeping performed

| | |
|---|---|
| `docs/control/CANONICAL-STATE.md` | accepted commit → `33ae0da`, round → UI POLISH 2 FINAL ACCEPTED; `e3d659b` added under SUPERSEDED VALUES |
| `docs/control/CANONICAL-STATE.json` | the same, and a second `supersededApplicationCommits` entry recording `e3d659b → 33ae0da` with its reason |
| `tests/tools/authoritative.js` | `APP_SHA` → `33ae0da` |
| `docs/control/ROUND-SCOPE.md` | the `candidate-files` block **emptied** — `index.php` is no longer excused, and any drift from `33ae0da` fails again |
| `FULL-AUDIT/UI-POLISH-2.md` | candidate wording replaced with accepted wording |
| `FULL-AUDIT/UI-POLISH-1.md`, the two `INDEX.md` files | `e3d659b` relabelled as the previous accepted commit |
| the six checked reports, `COMMIT-INFO.txt` | current SHA moved; `e3d659b` kept only on lines that label it superseded |

Closing the declaration is what makes acceptance real. Leaving `index.php` named
in `ROUND-SCOPE` after promoting the commit that carries it would have left the
checker permanently excusing the one file it exists to watch.

One detail worth recording: the checker reads **line by line**, so a SHA labelled
"superseded" three lines above still reads as a current claim. The `On SHAs` note
in all six reports was restructured so each retired SHA sits on a line that says
so itself.

### 4 · Result

`tests/tools/check-reports.js` — **57 checks, 0 disagreements.**
Test counts, translation counts and finding counts are **unchanged**, because
nothing that produces them changed.

**Commit:** `34a673b` *Acceptance is a pointer moving, not a measurement being repeated*

---

## STAGE 0B — ACCESSORY-INCLUSIVE FINAL UNIT PRICE

An **explicitly approved business-rule change**. It supersedes an accepted rule
and an accepted test suite, so it was declared in `ROUND-SCOPE.md` — by name,
file by file — **before any application byte was touched.**

### 1 · The rule that was superseded, and the rule that replaces it

The accepted application priced on `DC_PRICING_MODEL = 'bolt-separate'`:
`finalUnitPrice` was the **bolt**, `accessoryUnitPrice` sat beside it, and
`lineUnitPrice` was the two added together. The customer saw two figures: a rod
at RM5.76 and its nuts at RM2.00, on their own printed row and with their own
price in the WhatsApp message.

Nicholas superseded that. **All accessories belong to the parent item's final
customer price.**

```
Base / bolt price   RM 5.76
Accessories         RM 2.00
FINAL UNIT PRICE    RM 7.76      ← the one number the customer is quoted
```

```
FINAL UNIT PRICE                 最终单价
RM 7.76                          RM 7.76
Includes accessories: RM 2.00    已含配件：RM 2.00
```

With no accessories the second line is not rendered at all. Nut, FW and Custom
all follow the same rule; several accessories use their combined total, added
once.

**The money did not move.** Two nuts at RM1.00 are RM2.00 before and after.
What changed is where that RM2.00 is presented — inside the price instead of
beside it.

### 2 · The breakdown survives, and it had to

Folding the accessories in and losing the bolt would have broken Previous Price
for every future quotation: history compares a rod against a rod, and a record
whose "bolt price" were really a rod-plus-nuts figure would grow by its
accessories every time it were reused. So a saved item carries both ends:

| field | meaning | Nicholas's case |
|---|---|---|
| `boltUnitPrice` | internal rod / base component | `5.76` |
| `accessoryUnitPrice` | per-parent-item accessory total | `2.00` |
| `finalUnitPrice` | **customer-facing inclusive unit price** | `7.76` |
| `lineUnitPrice` | the same figure — compatibility alias | `7.76` |
| `accessoryTotal` | `accessoryUnitPrice × Qty` | `20.00` |
| `totalAmount` | `finalUnitPrice × Qty` | `77.60` |
| `pricingModel` | the explicit model name | `accessory-inclusive` |

### 3 · Where the accessory charge lands, per price mode

`resolvePriceMode` is the one place that decides, because it is the one place
that knows the mode:

| mode | which end is known | what happens |
|---|---|---|
| Auto Round · No Round | the **bolt** is calculated | the accessories are **added** to reach the customer's price |
| **Manual Price** | the **customer's** price is typed | the accessories come **out** of it to leave the bolt component |

Manual Price means what a person means when they write RM10 on a quotation:

```
Manual Price RM10 · Accessories RM2
  →  Final Unit Price          RM10      (not RM12)
  →  Includes accessories      RM2
  →  internal bolt component   RM8
```

### 4 · Three vintages of saved item, and one answer each

The only way this change could quietly cost money is a quotation that was
already sent. Each vintage is read as it was written:

| vintage | what the record holds | what happens |
|---|---|---|
| **`accessory-inclusive`** | `finalUnitPrice` already inclusive, bolt beside it | read as written |
| **`bolt-separate`** | `finalUnitPrice` was the **bolt**; `lineUnitPrice` was the customer's line | normalised once on load. The total it was **saved** with wins, so the customer total does not move; a manual price is folded **up** from RM30.00 to RM30.70, so re-saving cannot drop the nuts |
| **legacy** (no model) | one figure, the charge already inside it | which is what this rule asks for — so it is already correct, read as written, and **no separation is invented** for it |

The previous rule needed the opposite operation when an item was edited —
`dcUnfoldLegacyManualPrice` pulled the accessories back **out** of a manual
price. Under an inclusive rule that would cut the customer's price, so it is
gone, and the migration that replaces it happens once, on load, rather than once
per edit.

### 5 · Customer-facing output

**WhatsApp / copied text**

```
MS UNDERSIZE SAG ROD (HDG)
1. M12 x L 1000 x TL 100/100mm - RM7.76
cw 2nut
```

not

```
1. M12 x L 1000 x TL 100/100mm - RM5.76
cw 2nut - RM2.00
```

**Print / PDF** — one priced row per parent item:

| No. | Description | Size / Dimension | Qty | Unit Price | Total |
|---|---|---|---|---|---|
| 1 | MS UNDERSIZE SAG ROD (HDG) | M12 x L 1000 x TL 100/100mm<br>cw 2nut | 10 | RM 7.76 | RM 77.60 |

Grand Total **RM 77.60**. The separate priced accessory row is removed; `cw 2nut`
is a plain description of what is included, with no RM figure of its own. Qty ×
Unit Price reconciles exactly on the row a customer reads.

**Quotation item card** — the headline pill is `Unit RM 7.76`. `Bolt RM 5.76/pc`
and `Accessories RM 2.00/pc` sit under it as internal breakdown, so nothing about
the makeup of the price is hidden from staff, and the rod-only figure is never
presented as the customer's unit price.

### 6 · Files changed

| file | what changed |
|---|---|
| `index.php` | the pricing model and its item readers (`dcLineMoney`, `dcItemFinalUnit`, `dcItemBoltUnit`, `dcItemAccUnit`, `dcMigrateItemPricing`); `resolvePriceMode`; the calculator preview; the item card pills; `buildWAItemsText`; the print rows and `getPrintItemDimension`; the two load paths; Previous Price reuse; three reused translation strings in both dictionaries |
| `companies.php` | `dcItemFinalUnit` / `dcItemAccUnit` / `dcAccNote`, so `QTY × RM` on the company screens reads the same inclusive figure `index.php` shows, for all three vintages |
| `pricing_history.php` | `dc_history_record` reads the inclusive model, keeps reading `bolt-separate` and legacy records, and keeps `boltUnitPrice` a genuine bolt component |

No new translation key was added and none was removed — `cpLineNote`,
`tLegacyAccSplit` and `phAccSeparately` were **reused**, which is why the key
count does not move.

### 7 · Tests

`tests/suites/14-accessory-separation.test.js` protected the superseded rule. It
was **not deleted** — it was renamed and reframed around the new one:

`tests/suites/14-accessory-inclusive-price.test.js` —
*accessories — included in the final unit price, breakdown preserved*, **127
assertions** (from 41), covering: the calculator with no accessory · Nut only ·
FW only · Custom only · Nut + FW + Custom combined · the inclusive Final Unit
Price · the retained breakdown · no accessory leaving the price unchanged · the
saved item's fields · `totalAmount = finalUnitPrice × Qty` · Quick Add · normal
product entry · save and reopen · a `bolt-separate` reopen **and** resave
migration · legacy record compatibility · Manual Price semantics · WhatsApp
carrying no separate accessory price · Print having one priced row and plain `cw`
text · the customer-facing output reconciling · and Previous Price still reusing
the **bolt** component, driven through the real button in the real panel.

Other suites were changed **only** where the new rule genuinely supersedes their
expectation:

| suite | change |
|---|---:|
| `04-pricing` — the plate accessory block | 47 → **49** |
| `05-pricing-history` — the history card's accessory wording | 105 → **106** |
| `13-companies-legacy-desc` — the company screens' three vintages | 36 → **51** |
| `16-quickadd-history` — the same wording, on the row and on the form | 85 → **86** |
| `tests/php/pricing_history.test.php` — all three vintages read | 161 → **172** |

Nothing else was touched.

### 8 · Results — measured, not carried forward

| group | suites | assertions | failed | skipped |
|---|---:|---:|---:|---:|
| Browser (`tests/run.js`) | 37 | **3,714** | 0 | 0 |
| Pricing-history PHP | 1 | **172** | 0 | 0 |
| AI extraction PHP | 1 | 107 | 0 | 0 |
| Pricing workbook | 1 | 62 | 0 | 0 |
| Translation coverage | 1 | 15 | 0 | 0 |
| **Total** | **41** | **4,070** | **0** | **0** |

```
  3,714   browser
+   172   pricing / history
+   107   AI extraction / parser
+    62   workbook
+    15   translation
= 4,070   total

  4,070 − 2,810 = 1,260
```

Translation: **862 keys, 100% coverage, 0 missing, 0 hard-coded, 0 unapplied.**

**These are the measured figures. The previous 3,958 / +1,148 were not forced
onto this run** — the suite grew because the new rule needed more coverage than
the old one, and 862 held because every string this stage changed was an existing
key reused rather than a new one added.

`CANONICAL-STATE` read **3,958** and **`33ae0da`** while this stage was under
review, deliberately. Nicholas has since accepted it, and the canonical numbers
moved as their own step — see §10.

### 9 · Evidence

Ten frames, `FULL-AUDIT/stage-0b/`, on Nicholas's own case — MS UNDERSIZE SAG ROD
HDG, M12 x L1000 x TL100/100, base RM5.76, 2 nuts RM2.00, **Final Unit Price
RM7.76**. Every figure is asserted by the capture script before its frame is
written, and the run fails if any of them moves; the values it read are in
`evidence/FACTS.json`. A toast is dismissed and the dismissal **verified** before
each shot, so no frame carries a message from the step that set it up.

Calculator (with and without accessories, and in 中文) · quotation item card ·
WhatsApp / copied text · print preview · save and reopen · and the two migration
frames, in which a `bolt-separate` quotation reopens on **RM 307.00** and
re-saves on **RM 307.00**.

### 10 · Status — ACCEPTED

**Nicholas accepted Stage 0B.** The promotion was performed as its own step, over
a tree that did not move: no application byte and no test byte changed between
the reviewed candidate and this promotion, so the browser regression was **not**
re-run — it would have produced the same 3,714 assertions from the same source.

| | |
|---|---|
| Accepted application commit | **`98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac`** |
| Previous accepted commit | `33ae0da14a3bd3108e8b066d4796b1bcda2de428` — superseded |
| `docs/control/CANONICAL-STATE.md` · `.json` | accepted commit → `98a31e3`, round → STAGE 0B FINAL ACCEPTED; 3,714 browser / 172 pricing-history / **4,070** total / **+1,260**; `33ae0da`, 3,958 and +1,148 recorded as superseded |
| `docs/control/PROJECT-GUARDRAILS.md` | **the accessory-inclusive rule added** as an accepted, protected business rule, and named in PROTECTED / ACCEPTED AREAS |
| `tests/tools/authoritative.js` | `APP_SHA` → `98a31e3`; `BROWSER` 3,714, `TOTAL` 4,070, `DELTA` 1,260, pricing-history 172 |
| `docs/control/ROUND-SCOPE.md` | the `candidate-files` block **emptied** — the four declared files are no longer excused, and any drift from `98a31e3` fails again |
| `FULL-AUDIT/regression-evidence/` | refreshed to the accepted run; the eight per-suite logs re-sliced from it, which is what they have always been — slices, not separate invocations |

**Deploy: NO.** Acceptance is not deployment, and only Nicholas may approve that.

This is the first of the three accepted rounds that changes **behaviour** rather
than presentation, which is why its rule now lives in `PROJECT-GUARDRAILS.md`
rather than only in this report. Changing accessory pricing again needs the same
explicit approval that changed it this time.
