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

## ACCEPTED COMPACT ROW

Keep DIA beside Size, the current density, and the Pricing Summary directly
under each compact row. **Do not move the Pricing Summary again without
explicit approval.**

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
