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

## THE DEFECT — CORRECTED AFTER REPRODUCTION

**This section was rewritten once the bug was actually reproduced. The first
reading of it was wrong, and the wrong reading is kept here because it is the
reason the first fix did not work.**

### What was assumed, and why it was wrong

The Add path reports `"L Bolt M14 — Enter Diameter"`. `wqaAddAll` builds a
`stuck` reason as `nameOf(r) + ' — ' + …` in **two** places, and the first
reading assumed the message came from the `wqaRowMissing` branch — which would
have meant `r.noDia` was true.

Reproduced, on the candidate tree, the row's state at the moment Add is pressed
is **completely clean**:

```
diaMm:"16"  diaManual:true  noDia:false  missing:[]  blocked:false
weight:0.6724  form:"16"  screenDia:"16 Manual"
ADD -> items:0   toast:"1 to fix — L Bolt M14 — Enter Diameter"
```

`wqaRowMissing` returns `[]`. The message is the OTHER branch: `said[0]`, the
toast captured from `addCurrentItem()`.

### The actual cause

`wqaAddAll` does not commit from the row. It commits through the shared form:

```js
switchType(wqaRowProduct(r));
wqaApplyRowToForm(r);
try{ addCurrentItem(); }              // the real add path: validates the FORM
…
else stuck.push({r, why:`${nameOf(r)} — `+(said[0]||dcT('wqaAddRefused'))});
```

**`wqaApplyRowToForm` never writes the diameter.** The word does not appear in
it. It writes material, size type, size, dimensions, thread length, quantity and
the price overrides — and then `onMaterialSizeChange(t,true)` auto-fills the
diameter *from the table*, which for M14 at that size type is empty.

So a manual diameter lives in `r.diaMm` and is written into the form in exactly
one place — inside `wqaRecomputeAll`, which is not the Add path. Display reads
the row and is right; `addCurrentItem` reads the form and refuses.

That is precisely the mismatch reported: **display uses `r.diaMm`, the commit
uses the shared form, and nothing carries the typed bar from one to the other.**

### The second, latent half

Measured on `54f896a`, undersize M24 with a manual 16:

```
STATE diaMm:"16" diaManual:true noDia:false calc:present
FORM  diameter:""      ← the field noDia is sampled from is already empty
```

`r.noDia = !(fn(t,'diameter') > 0)` samples that same shared input, after
`recalcCurrent()` may have re-resolved it. `noDia` was right only because the
sample landed first. Nothing orders those events, and neither display field can
self-correct afterwards — both re-syncs are guarded on `!r.diaManual`. This has
not been observed to fire, and it is repaired in the same breath rather than
left as a second way for the same two values to disagree.

## ALLOWED TO CHANGE

```candidate-files
index.php
```

Nothing else may differ from `cf92f27feb629134a61801dc120eba79c54fb5f6`.

**Two sites, one rule: a diameter a person typed is the row’s own answer, and
every consumer of the form must be given it.**

1. **`wqaApplyRowToForm`** — THE FIX. After `onMaterialSizeChange(t,true)` has
   auto-filled the diameter from the table, a row carrying a manual override
   writes that override into the form. This is the function both the recompute
   and the **Add path** go through, so the committed item is weighed on the bar
   the person typed. Without it the Add path cannot see the override at all.

2. **`wqaRecomputeAll`** — the latent half. `r.noDia` is decided from the row
   when a manual diameter is present, instead of from a shared input whose value
   depends on what happened to it last; and the value is re-asserted if the form
   has stopped holding it, so forcing the flag can never let a row reach
   `wqaReadFormPricing` with an empty diameter and be priced on a weight of zero.

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
