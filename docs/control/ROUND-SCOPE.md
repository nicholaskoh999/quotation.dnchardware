# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**STAGE 0B — ACCESSORY-INCLUSIVE FINAL UNIT PRICE**

An **explicitly approved business-rule change**, authorised by Nicholas. It
supersedes an accepted rule, so it is written down here before any application
byte is touched — that is what `PROJECT-GUARDRAILS.md` requires, and a prompt
alone does not grant it.

## APPLICATION STATUS

| | |
|---|---|
| Accepted application commit | `33ae0da14a3bd3108e8b066d4796b1bcda2de428` |
| Previous accepted commit | `e3d659bba1636cd4cfc74cb89be1b52cf92aff67` — superseded by UI POLISH 2 |
| This round | a **candidate**, not an accepted state |
| Deploy | **NO** |

---

## BASELINE GATE — PASSED BEFORE ANY EDIT

| Check | Evidence |
|---|---|
| Accepted commit exists and is an ancestor of HEAD | `33ae0da` |
| Canonical and authoritative agree on it | `CANONICAL-STATE.json` and `tests/tools/authoritative.js` both read `33ae0da` |
| No application php differed from it at the start | `git diff --name-only 33ae0da..HEAD -- '*.php'` → empty |
| UI POLISH 2's candidate declaration closed first | Stage 0A, its own commit |
| Control files present and read, not reconstructed | all four |

---

## THE RULE THIS ROUND SUPERSEDES

The accepted application prices on `DC_PRICING_MODEL = 'bolt-separate'`:

```
finalUnitPrice    = bolt only
accessoryUnitPrice = accessories
lineUnitPrice     = bolt + accessories
```

`tests/suites/14-accessory-separation.test.js` exists to protect exactly that,
and `PROJECT-GUARDRAILS.md` lists Accessories calculation as protected. Both are
superseded here, deliberately and by name — not worked around, and not deleted.

## THE NEW AUTHORITATIVE RULE

**All accessories belong to the parent item's final customer price.**

```
Base / bolt price   RM 5.76
Accessories         RM 2.00
FINAL UNIT PRICE    RM 7.76      ← what the customer is quoted
```

The screen reads:

```
FINAL UNIT PRICE          最终单价
RM 7.76                   RM 7.76
Includes accessories: RM 2.00     已含配件：RM 2.00
```

With no accessories the "Includes accessories" line is not rendered at all.
Nut, FW and Custom all follow the same rule; several accessories use their
combined total.

**The internal breakdown survives.** A newly saved item carries, at minimum:

| field | meaning |
|---|---|
| `boltUnitPrice` | internal bolt / base component |
| `accessoryUnitPrice` | per-parent-item accessory total |
| `finalUnitPrice` | **customer-facing inclusive unit price** |
| `lineUnitPrice` | the same inclusive figure — compatibility alias |
| `accessoryTotal` | `accessoryUnitPrice × Qty` |
| `totalAmount` | `finalUnitPrice × Qty` |
| `pricingModel` | the explicit inclusive model name |

### MANUAL PRICE

Manual Price **is** the customer's Final Unit Price:

```
Manual Price RM10 · Accessories RM2
  →  Final Unit Price   RM10
  →  Includes accessories   RM2
  →  internal bolt component  RM8
```

Auto Round and No Round compute the bolt price and add the accessories to reach
the Final Unit Price.

### BACKWARD COMPATIBILITY — MANDATORY

Three vintages of saved item must all keep the customer total they were sent
with:

| vintage | what the record holds | what must happen |
|---|---|---|
| **inclusive** (new) | `finalUnitPrice` already inclusive | read as written |
| **bolt-separate** | `finalUnitPrice` is bolt-only, `lineUnitPrice` is the line | migrated on load to the inclusive shape; the customer total does not move, and re-saving must not charge the accessories twice |
| **legacy** (no model) | one figure with the charge already inside it | read as written; no separation invented |

---

## ALLOWED TO CHANGE

Only what this pricing rule requires.

```candidate-files
index.php
companies.php
pricing_history.php
tests/php/pricing_history.test.php
```

Nothing else may differ from `33ae0da14a3bd3108e8b066d4796b1bcda2de428`.

The fourth entry is a **test**, not application code. It is named here because
the drift check watches every `*.php` in the tree, not only the application ones,
and a file it cannot account for fails the run — correctly. Declaring it says
what it is rather than widening the check to stop looking.

**`index.php`**

- the pricing-model constant and the item-reading helpers beside it
  (`dcLineMoney`, `dcItemIsSeparated`, `dcItemAccUnit`, `dcItemBoltUnit`) and
  the migration of an older saved item on load
- `resolvePriceMode` — which figure it returns, and the breakdown it records
- the calculator preview: the `cpFinal` headline and the `cpLine` note
- the quotation item card's price pills
- `buildWAItemsText` — no separate accessory RM price
- the print sheet — one priced row per parent item, accessory wording as a plain
  note in the dimension cell
- three translation strings, in **both** dictionaries, reused rather than
  replaced by new keys — so the key count does not move: `cpLineNote` (now
  *Includes accessories: {acc}* / *已含配件：{acc}*), `tLegacyAccSplit` (now the
  one-per-load migration notice) and `phAccSeparately` (the history card, which
  said accessories were charged *separately* — untrue of an inclusive record —
  and now reads *Accessories on that line: / 该报价行配件：*, which is true of
  all three vintages)
- the `lblFinalUnitPrice` fallback literal in the markup, which reads
  `Bolt Unit Price` and is overwritten by `dcApplyLang` on every load
- Previous Price reuse, **only** so that a reused record still reproduces the
  record's **bolt** component under the new manual semantics

**`companies.php`**

- `dcItemAccUnit` / `dcAccNote` — so `QTY × RM` on the company screens reads the
  inclusive unit price and names the accessories as a breakdown, for all three
  vintages

**`pricing_history.php`**

- `dc_history_record` — read the inclusive model, keep reading `bolt-separate`
  and legacy records, and keep `boltUnitPrice` a genuine bolt component so a
  reused recipe is never the inclusive price mistaken for a bolt-only one

**Tests, reports, evidence, packaging**

- `tests/suites/14-accessory-separation.test.js` → reframed and renamed
- `tests/suites/04-pricing.test.js`,
  `tests/suites/13-companies-legacy-desc.test.js`,
  `tests/php/pricing_history.test.php` — only the expectations the new rule
  genuinely supersedes
- a new evidence script and this round's evidence
- `docs/control/ROUND-SCOPE.md` (this file)
- the Stage 0 report and the review package

---

## NOT ALLOWED TO CHANGE

parser · extraction · AI extraction semantics · weight formulas · DIA rules ·
Qty rules · Material · Finish · Size Type · **History identity and Previous
Price matching** · History ordering · customer-history priority · Fast Edit ·
Bulk Edit · Details · selection behaviour · the accepted Compact row · Pricing
Summary position · database behaviour · Add-to-quotation logic · the cost rate,
additional cost, markup and rounding formulas that produce the **bolt** price ·
translation semantics · UI POLISH 1 and UI POLISH 2 outcomes.

The **amount of accessory money** must not change either. This round moves where
the accessory charge is *presented*, not how much it is: two nuts at RM1.00 are
RM2.00 before and after, and a rule that quietly stopped charging for them would
be the worse defect of the two.

No new keyboard shortcuts. No new asynchronous behaviour. No opportunistic
refactoring. No dark mode. No Print/WhatsApp item renumbering.

---

## CANDIDATE APPLICATION CHANGE

The three files above are declared by name, so the report checker and the
package verifier report them as a **declared candidate** rather than as drift —
and so that any file NOT on that list still fails, loudly.

`CANONICAL-STATE.md`, `CANONICAL-STATE.json`, `PROJECT-GUARDRAILS.md` and
`tests/tools/authoritative.js` are **not** touched while this round is a
candidate. If Stage 0B is accepted, the canonical application commit moves then
— deliberately, as its own step, with this declaration closed.

---

## STOP CONDITION

- targeted accessory / pricing / history / output tests pass
- the PHP pricing-history tests pass
- the FULL browser regression passes, and every authoritative side suite
- the translation audit passes: 100% coverage, 0 missing, 0 hard-coded,
  0 unapplied
- **zero failures, zero skips**
- evidence captured on Nicholas's own case — MS UNDERSIZE SAG ROD HDG,
  M12 x L1000 x TL100/100, base RM5.76, 2 nuts RM2.00, Final Unit Price
  **RM7.76** — across the calculator, the quotation item, the WhatsApp text, the
  print preview and a save/reopen
- migration proven: a bolt-separate quotation reopens on the same customer total
  and re-saves without double-charging
- counts reported as **measured**, not forced to the previous 3,958 / 862
- ONE `QUOTATION-DNC-STAGE-0-FINAL.zip`, built and independently verified after
  extraction

Then STOP. **No deploy.** The candidate is not promoted to canonical until
Nicholas / ChatGPT reviews it. Stage 1 does not begin.
