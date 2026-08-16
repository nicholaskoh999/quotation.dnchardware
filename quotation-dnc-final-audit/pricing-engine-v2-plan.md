# Pricing Engine V2 — design and preparation

**Status: DESIGN ONLY. Nothing in this document is switched on.**
No raw-material rate, process charge, labour tier, markup or supplier accessory
cost has been invented, and none has been written into the application. Every
number quoted below is a number that is *already in the shipped code today*,
identified so you can decide what replaces it. The workbook beside this file
(`pricing-engine-v2-input.xlsx`) is where the real values go, and until it comes
back filled in, the current calculation stays exactly as it is.

Two systems, deliberately kept apart:

| | Pricing History | Pricing Engine |
|---|---|---|
| Question | What did we quote before, and why did the prices differ? | What should today's cost calculation produce? |
| Source | Quotations we actually sent | Rules the business maintains |
| Nature | Evidence. Never averaged, never extrapolated | Calculation. Deterministic, explainable |
| Already built? | **Yes** — shipped in this branch | No — this document |
| May it set a price on its own? | Never. A person clicks *Use this price* | Yes, that is its job |

A historical price is evidence, not a prediction. A pricing rule determines
today's number. Confusing the two is how a 2022 price ends up on a 2026
quotation.

---

## 1. Proposed architecture

Four layers, each with one job.

```
  RULE DATA                    (tables the business maintains)
  material_rates · process_cost_rules · labour_qty_rules
  finish_cost_rules · customer_markup · accessory_costs
        │   every row: effective_from, effective_to, active, remark
        ▼
  RESOLVER                     (pure functions, no DB, no HTTP, no session)
  pricing_rules.php  +  the same rules evaluated in the browser
        │   in:  item spec + customer + quotation date
        │   out: {materialCost, processCosts[], addCost, markup,
        │         unitPrice, trace[]}
        ▼
  CALCULATOR                   (the screens that exist today)
  the product forms · Quick Add rows · the accessory panel
        │   the person can override any field; an override always wins
        ▼
  FROZEN RESULT                (what is saved on the quotation item)
  every input that produced the price + the trace that explains it
```

The shape is not speculative — `pricing_history.php` in this branch is already
built this way: rules in one file with no database, session or HTTP dependency,
called by `api.php` and by the test suite alike, so one set of rules cannot
behave two ways. `pricing_rules.php` should be its sibling.

**Where the evaluation runs.** In the browser, as today. The calculator
recomputes on every keystroke and must stay instant and offline-tolerant; a
round trip per keystroke would be a downgrade. The rule *data* is fetched once
per session (as `get_diameter_settings` and `get_default_prices` already are),
and the evaluation is one function. A PHP mirror of the resolver is only needed
if a quotation is ever priced without a browser — batch re-pricing, an API for
another system, a nightly report. Build the PHP side when that need is real; if
both exist, they must share the rule data and be tested against each other on
the same fixtures, which is exactly what `tests/php/pricing_history.test.php`
and `tests/suites/05-pricing-history.test.js` do for history today.

**What must not change.** Weight. V2 consumes the unit weight; it does not
redefine it. Effective diameter stays the property of Diameter Settings, unit
weight stays `d² × developed length × 0.0000061654`, and if V2 ever needs a
diameter it asks `dcEffectiveDiameter` like everything else.

---

## 2. Current pieces that can be reused

These already work and are already covered by the regression suite. V2 should
build on them rather than around them.

| Piece | Where | Why it survives |
|---|---|---|
| Effective diameter | `dcEffectiveDiameter`, `dcBuiltInDiameter`, `diameter_settings` | Already one source of truth, screen and calculation proven equal by test |
| Unit weight | `calcWeight` + the per-product developed lengths | The physical layer; V2 is a cost layer above it |
| Rule table shaped by identity | `default_prices` (+ `findDPMatch`, `dpKey`) | Already keyed product · material · size type · size · finish — the same key V2 needs |
| Manual-entry protection | `productEntryTouchedFields`, `isUserPriced`, `setAutoRate`, the `ours()` test in `applyDefaultPrice` | The rule "an automatic value never overwrites a typed one" is already implemented and tested. V2 must reuse the semantics verbatim |
| Price modes and rounding | `resolvePriceMode`, `round05`, `roundMoney2` | Auto Round / No Round / Manual Price are a business convention, not an implementation detail |
| Accessory separation | `accAddon`, `getAccessories`, and the separation rules in `pricing_history.php` | Accessories are already outside the bolt price everywhere the code was corrected |
| Pricing History | `pricing_history.php`, `get_pricing_history`, the Review panel | The evidence layer, finished. V2 does not touch it |
| The saved item shape | `formData.costRate/addCost/markup`, `priceMode`, `weight`, `cleanSize`, `dimensionPreview` | Already stores the inputs, which is why history can explain a past price at all |
| Import/export of rules | `export_diameter_settings` / `import_diameter_settings` | The pattern for loading a filled workbook into a rule table already exists |

---

## 3. Current pieces that should eventually be replaced

Each of these is a business number living in source code. None is wrong; all of
them are invisible to the people who own them.

| Today | Where | Replaced by |
|---|---|---|
| `RATES = {PL:2.80, ZP:4.20, HDG:6.00}` — mild steel sag rod, cost rate per kg by finish | index.php | `MATERIAL_RATES` (rate per kg) + `FINISH_COST_RULES` (the difference between finishes) |
| `RATES_4140` — 8.50/6.50 fullsize, 9.50/8.00 undersize, M12/M16 only | index.php | `MATERIAL_RATES` rows keyed by material, size type and size band |
| `ZP_SURCHARGE = 1.50`, `HDG_SURCHARGE = 3.20` | index.php | `FINISH_COST_RULES`, per material, per size band, effective-dated |
| `HDG_THREAD_BRUSHING = 1.00`, and the flat `1.60` HDG additional cost for MS | index.php | `PROCESS_COST_RULES` (process = FINISH / THREAD) |
| `getAddCostFromTL`: TL 30–120mm → 0.60, TL 121–200mm → 1.00, else 0 | index.php | `PROCESS_COST_RULES` (process = THREAD, condition field = TL, min/max, cost) |
| `getSystemDPRules()` — synthesises "System Default" price rules from the constants above | index.php | Real rows in the rule tables, with effective dates and remarks |
| `get4140Rates()` keyed on the built description | index.php | Deleted. It is already dead code — see the note below |
| A single typed *Additional Cost* box | every product form | A computed sum of process costs, with the box kept as a visible override |
| No labour component at all | — | `LABOUR_QTY_RULES` |
| Accessory unit price typed by hand, no supplier, no markup, no history | the accessory panel | `ACCESSORY_COSTS` + an accessory markup, priced like a small product |

**About `get4140Rates` — verified, and not a pricing defect.** `RATES_4140` is
keyed `'4140 FULLSIZE SAG ROD'` while `buildDesc` emits `'4140 QT FULLSIZE SAG
ROD'`, so that lookup returns `null` every time. The rates still reach the boxes,
because `getSystemDPRules()` reads the same table by *identity* rather than by
description and the Default Price path fills them: a 4140 QT fullsize M16 PL sag
rod is rated 6.50 with 3.50 additional, undersize M12 at 9.50, ZP adds 1.50, HDG
adds 3.20 and 1.00 of thread brushing. That behaviour is now pinned by
assertions in `tests/suites/11-business-rules.test.js`, including the fact that
the description-keyed lookup finds nothing. So this is one dead code path and one
live one, not a wrong price — but the dead path must not be "fixed" casually:
doing so would also make a *material change* force-overwrite a rate somebody
typed, which today it does not. See `remaining-business-decisions.md`.

---

## 4. Data required from the business

The workbook has one sheet per table. Nothing is pre-filled with a business
value; where a sheet shows an example row it is marked `EXAMPLE — DELETE` in the
Remark column and contains obviously fake numbers.

| Sheet | What it answers | Mandatory columns |
|---|---|---|
| `README` | How to fill the rest in, and what each rule means | — |
| `MATERIAL_RATES` | What does a kilogram of this material cost us, and what do we quote it at? | Material, Internal Cost Rate Per KG, Effective Date, Active |
| `DIAMETER_RULES` | What bar diameter is this size actually cut from? | Product Type, Material, Size Type, Size, Diameter (mm) |
| `PROCESS_COST_RULES` | What does threading / bending / cutting / machining / heat treatment add? | Product Type, Process, Cost Basis, Cost, Effective Date, Active |
| `LABOUR_QTY_RULES` | How does labour per piece change with the quantity? | Qty From, Qty To, Labour Cost Per PC, Effective Date, Active |
| `FINISH_COST_RULES` | What do PL, ZP and HDG cost, and is it per kg or per piece? | Finish, Cost Basis, Cost, Effective Date, Active |
| `CUSTOMER_MARKUP` | What margin does this customer carry? | Customer, Markup %, Effective Date, Active |
| `ACCESSORY_COSTS` | What does a nut/washer cost from the supplier, and at what markup do we sell it? | Accessory Type, Material, Finish, Size, Supplier Cost, Markup %, Effective Date, Active |

Two questions the workbook deliberately asks twice, because the audit found the
distinction is not currently recorded anywhere:

* **Supplier Cost Per KG vs Internal Cost Rate Per KG.** Today one number does
  both jobs. If the internal quoting rate is not the supplier's invoice rate,
  V2 must hold both — the first to know the true margin, the second to price
  with. Both columns exist in `MATERIAL_RATES`; fill in what you have.
* **Cost Basis.** Every process and finish row must say whether its number is
  per kg, per piece, per mm, or a percentage. A charge whose basis is
  ambiguous is a wrong price waiting for a size it was not calibrated on.

---

## 5. Calculation dependency flow

The chain, with the boxes that exist today marked *(live)* and the boxes V2 adds
marked *(new)*:

```
  size + size type + material                         (live)
        └─► EFFECTIVE DIAMETER      Diameter Settings, else the built-in table
              └─► UNIT WEIGHT       d² × developed length × 0.0000061654
                    │
                    ├─► MATERIAL COST     = unit weight × internal rate per kg      (new rate source)
                    │
                    └─► PROCESS COST      = Σ of the rules that match this item     (new)
                            THREAD          by TL band            (today: 0.60 / 1.00)
                            BEND            by product            (today: none)
                            CUTTING         by product/size       (today: none)
                            MACHINING       by size type          (today: inside the rate)
                            FINISH          by finish             (today: a surcharge on the rate)
                            HEAT TREATMENT  by material           (today: inside the material choice)
                            LABOUR          by quantity band      (today: none)
                            LOW-QTY         by quantity band      (today: none)
                            OTHER           free rule             (today: the typed box)
                    │
                    ▼
              ADDITIONAL COST = Σ process costs        (live box, becomes computed + overridable)
                    │
        SUBTOTAL = material cost + additional cost     (live)
                    │
                    ▼
              × (1 + MARKUP %)                         (live; customer rules are new)
                    │
                    ▼
              ROUNDING  Auto Round / No Round / Manual (live, unchanged)
                    │
                    ▼
              UNIT PRICE (the bolt)                    (live)
                    +
              ACCESSORIES, priced separately           (live; supplier cost + accessory markup are new)
                    ▼
              QUOTATION LINE
```

**The migration acceptance test, stated now so it cannot be argued away later:**
with one `MATERIAL_RATES` row per (material, finish) carrying today's numbers,
one `PROCESS_COST_RULES` row per TL band carrying today's 0.60/1.00, and no
other rules, **V2 must reproduce today's unit price to the cent on every item in
the regression suite.** If it does not, the difference is a mistake in V2, not a
"better price". Only after that passes should real rules replace the transcribed
ones.

Quantity affects process and labour cost. Quantity is still **not** part of
historical item identity — a past quantity of 1 says nothing about what the item
costs to make, which is why Pricing History matches on specification and reports
quantity as context.

---

## 6. How overrides should work

Four levels, most specific wins, and the person always outranks the machine:

```
  1. GLOBAL RULE          material_rates / process_cost_rules / finish_cost_rules
  2. CUSTOMER RULE        customer_markup, and any customer-specific rate rows
  3. QUOTATION OVERRIDE   a markup set for this whole quotation
  4. ITEM OVERRIDE        a rate, an additional cost or a manual price typed on the item
```

Rules that already hold today and must not be weakened:

* **A typed value is never overwritten by an automatic one.** This exists —
  `isUserPriced` / `setAutoRate` / `ours()` — and it is why a rule refresh cannot
  silently undo a correction. V2 inherits it unchanged.
* **Manual Price replaces the calculation entirely** and adds no accessory
  charge on top. Auto Round and No Round add accessories to the computed price.
  This is the distinction `pricing_history.php` relies on to separate a past
  bolt price from its accessories, so changing it would make past records
  unreadable.
* **An override is visible.** The item shows that it is overridden, and what the
  rule *would* have produced, so an unusual price can be explained a year later.
* **An override is scoped.** Changing a rule does not retro-edit a saved
  quotation. Saved items keep their own numbers, always.

---

## 7. How audit history should work

Every saved item already carries `formData.costRate`, `formData.addCost`,
`markup`, `priceMode` and `weight` — which is exactly why Pricing History can
explain a past price at all. V2 extends this to a **trace**: the list of rule
rows that produced the number, each with its id, its version and the value it
contributed.

```
  trace: [
    {component:'material',  rule:'MR-014 v3', basis:'per_kg',   input:2.4662, rate:…, value:…},
    {component:'thread',    rule:'PC-007 v1', basis:'per_pc',   input:'TL 150',        value:…},
    {component:'finish',    rule:'FC-003 v2', basis:'per_kg',   input:'HDG',           value:…},
    {component:'labour',    rule:'LQ-002 v1', basis:'per_pc',   input:'qty 250',       value:…},
    {component:'markup',    rule:'CM-011 v4', basis:'percent',  input:'ALPHA',         value:…},
    {component:'override',  rule:null,        note:'cost rate typed by staff', was:…, now:…}
  ]
```

Rule tables are **append-only**. Editing a rate creates a new row with a new
effective date; the old row stays, marked inactive or expired. That is what makes
"why was this RM2 cheaper in March?" answerable, and it is the same discipline
that lets `diameter_settings` keep custom rules beside system ones today.

One honest limitation: `auth.php` is a single shared account with no user table,
so the trail can record **what changed and when**, but not **who**. If the
business wants per-person attribution on a rate change, that is a separate
decision (individual logins), not something V2 can synthesise.

---

## 8. How effective dates should work

Every rule row carries `effective_from`, an optional `effective_to`, and
`active`.

* **Resolution uses the quotation's date, not today's.** Re-opening a quotation
  from March must recompute with March's rules, or the recomputation contradicts
  the document the customer holds. `quotations.quote_date` already exists and is
  already what Pricing History sorts by.
* **A superseded rule is never deleted.** It is how an old quotation still
  explains itself.
* **Ties break by specificity first, then by the latest `effective_from`.** An
  exact size beats a size band; a size band beats a material default.
* **A future-dated rule is visible but not in force.** Staff can enter next
  quarter's rates the day they are agreed, and nothing changes until the date.
* **A gap is an error, not a zero.** If no rate covers the quotation's date, the
  item must say "no rate in force for this date" and refuse to price. A missing
  value with a visible reason is acceptable; a silent zero is not.

---

## 9. How customer-specific rules should work

Resolution order, most specific first:

```
  customer + product type + material + size
  customer + product type + material
  customer + material
  customer                                   ← CUSTOMER_MARKUP in the workbook
  global default
```

Recommended: **customer rules move the markup, not the cost.** Cost is what the
item costs to make and it does not change because of who is buying. Keeping cost
global and margin per customer keeps the margin visible, which is the number the
business actually manages.

If a customer genuinely does have a different *cost* — a supplier arrangement
tied to one contract, say — that belongs in a second, explicitly-named table with
its own effective dates, so it is never mistaken for the general rate. Flagged in
`remaining-business-decisions.md` rather than assumed either way.

The Pricing History panel already separates *this customer* from *other
customers* and labels every foreign record, so the evidence layer is consistent
with this model.

---

## 10. Recommended implementation phases

Each phase is shippable on its own and none of them changes a price until the
one that says so.

| Phase | What ships | Risk to a live quotation |
|---|---|---|
| **V2.0 — Data in, read-only** | The rule tables, the import of the filled workbook, a Settings screen that lists the rules exactly as Diameter Settings does. Nothing reads them when pricing | None. The calculator is untouched |
| **V2.1 — Shadow mode** | The resolver runs beside the current calculation and shows *"V2 would price this at RM x.xx"* next to the live number, plus a report of every difference across the last N quotations | None. The number sent to customers is still today's |
| **V2.2 — Explain the difference** | Every shadow difference is traced to the rule that caused it. The business signs off the list, or corrects the workbook and reloads | None |
| **V2.3 — Material rate + finish** | The material rate and finish cost come from the rules; process cost still comes from today's `getAddCostFromTL`. Prices can now change — deliberately, with the difference report already signed off | **Real.** Gated on V2.2 |
| **V2.4 — Process costs** | Thread, bend, cut, machining, heat treatment move to `PROCESS_COST_RULES`. `getAddCostFromTL` is deleted | Real, gated the same way |
| **V2.5 — Labour and quantity** | `LABOUR_QTY_RULES` joins the sum. First time quantity affects a unit price | Real, and the most visible to customers — quote the same item twice at different quantities and compare |
| **V2.6 — Accessories engine** | Supplier cost, accessory markup and accessory history. Accessories stay outside the bolt price | Real, but contained: accessories are already separate |
| **V2.7 — Retire the constants** | `RATES`, `RATES_4140`, the surcharge constants, `getSystemDPRules` and the dead `get4140Rates` are removed | None if V2.3–V2.6 shipped; this is deletion of code nothing reads |

**The gate between every phase is the same:** the full regression suite passes,
and the shadow-difference report contains no difference that cannot be explained
by a rule somebody intended. Not "the tests are green" — *the factory user can
trust the quotation.*

---

## What this pass did not do

* Did not invent a raw material rate, a process charge, a labour tier, a markup
  or a supplier accessory cost.
* Did not change any price, rate, weight, diameter or rounding rule.
* Did not create a database table, an endpoint or a settings screen for V2.
* Did not turn any example value in the workbook into production data — the
  example rows are marked and are meant to be deleted.

Activation waits for the filled workbook.
