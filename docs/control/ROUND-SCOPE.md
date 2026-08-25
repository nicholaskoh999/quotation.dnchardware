# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**QUICK ADD — MANUAL DIAMETER VALIDATION FIX**

One derived flag, read from the wrong place. No parser, no size-type rules, no
Diameter Settings rules, no weight formula, no pricing, no database, no
translations.

| | |
|---|---|
| Accepted application commit | `cf92f27feb629134a61801dc120eba79c54fb5f6` |
| Base for this round | `54f896a` — Quick Add Size Type Display Fix |
| This round | a **candidate**, not an accepted state |
| Deploy | **NO** |

---

## THE DEFECT, AND WHY IT IS A STATE-SOURCE DEFECT

A Quick Add row carries its own answer for the bar it is cut from:
`r.diaMm = "16"`, `r.diaManual = true`. The compact cell reads exactly that and
shows **DIA 16 MANUAL**. The weight is computed from it and reads 0.6724 kg/pc.

Validation reads something else. In `wqaRecomputeAll` (index.php ~16449):

```js
if (r.diaManual && String(r.diaMm||'').trim()!==''){ setFieldValue(t,'diameter',r.diaMm); recalcCurrent(); }
r.noDia = !(fn(t,'diameter') > 0);        // ← the SHARED form input, not the row
```

`fn(t,'diameter')` reads `#<type>-diameter` — one global input that every row of
that product type writes to and reads from in turn, and that `recalcCurrent()`
may re-resolve from the diameter table or from Diameter Settings **after** the
manual value was written. For a size with no stocked bar it re-resolves to
empty.

**Measured, on `54f896a`**, undersize M24 with a manual 16:

```
STATE  diaMm:"16"  diaManual:true  noDia:false  calc:present
SCREEN diaCell:"16 Manual"  weight:"1.2627 kg/pc"
FORM   diameter:""     ← the field noDia is sampled from is already empty
```

`noDia` was correct only because the sample landed before the field was cleared.
Nothing orders those two events. When the sample lands after, `noDia` becomes
`true` while `diaManual` stays `true` — and **neither display field can ever
correct itself**, because both re-syncs are guarded on that same flag:

```js
// recompute:     if(!r.diaManual) r.diaMm = ...      ← the typed value is never reset
// wqaPatchRows:  if(dIn && !r.diaManual && …)        ← the DIA cell is never re-synced
```

So the row shows **16 MANUAL** and a weight, while `wqaRowMissing(r)` returns
`['Diameter']` and `wqaAddAll` reports **“L Bolt M14 — Enter Diameter”** — that
message format proves `wqaRowMissing` returned Diameter and nothing else.

**The three surfaces do not use different objects or stale copies.** They all
read the same `wqa.rows[i]`. The disagreement is inside one object, between a
field the row owns and a flag sampled from shared mutable DOM.

---

## ALLOWED TO CHANGE

```candidate-files
index.php
```

Nothing else may differ from `cf92f27feb629134a61801dc120eba79c54fb5f6`.

**One block, in `wqaRecomputeAll`.** A diameter a person typed becomes
authoritative for that row:

- when `r.diaManual` is true and `r.diaMm` parses to a positive number,
  `r.noDia` is **false** — decided from the row, not from the form
- and the manual value is **re-asserted into the form if the form no longer
  holds it**, so the calculator below weighs the bar the person typed rather
  than an empty field. Without that, forcing `noDia=false` alone would let a row
  reach `wqaReadFormPricing` with no diameter and be priced at weight 0 — a
  worse defect than the one being fixed
- when there is no manual diameter, the existing resolution is untouched

**Tests**

- a suite case asserting the invariant directly: `diaManual && diaMm > 0`
  implies `noDia === false`, on a size with **no** table bar, where the old code
  depended on sampling order
- and asserting the form is left holding the manual bar, which is the
  observable difference between the two versions

---

## NOT ALLOWED TO CHANGE

The parser · `DC_SIZE_TYPE_RULES` and size-type resolution · Diameter Settings
rules and how they are read · the weight formula · pricing · the database ·
translations (no key added, changed or removed) · `wqaEditDia`'s meaning of a
manual override · `wqaClearManualDia`'s rule that changing size, size type,
material or product drops the override · item numbering · the accepted UI POLISH
2A save interaction.

`r.diaMm` and `r.diaManual` keep their present meanings and are still written in
exactly the places they are written now. This round decides `noDia` from them;
it does not decide them.

---

## STOP CONDITION

- L Bolt · 4140 QT · M14 · Ø16 manual · L300 · W150 · Qty 10 → **adds**, and
  never shows *Enter Diameter*
- weight stays **0.6724 kg/pc** — computed from the manual bar, not from 0
- a row with a manual diameter on a size with no stocked bar has
  `noDia === false` and a form still holding that bar
- M12 Fullsize, M12 Undersize Ø10.6, a non-manual diameter from settings, and
  clearing an override back to the table all behave exactly as they do today
- the FULL browser regression re-run — application bytes change — every side
  suite, and the translation audit at **862 keys / 100%**
- **zero failures, zero skips**

Then STOP. **No deploy.** Candidate only.
