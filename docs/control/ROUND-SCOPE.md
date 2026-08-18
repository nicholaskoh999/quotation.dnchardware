# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**UI POLISH 2 — Interaction / Micro UX Polish**

## APPLICATION STATUS

Continues from **UI POLISH 1 — FINAL ACCEPTED**.

| | |
|---|---|
| Accepted application commit | `e3d659bba1636cd4cfc74cb89be1b52cf92aff67` |
| Previous accepted commit | `7f5bc977197a658d6d4db995ee2c9bb5e106e21b` — superseded by UI POLISH 1 |
| This round | a **candidate**, not an accepted state |
| Deploy | **NO** |

---

## BASELINE GATE — PASSED BEFORE ANY EDIT

| Check | Evidence |
|---|---|
| Accepted commit exists and is an ancestor of HEAD | `e3d659b` |
| Canonical and authoritative agree on it | `CANONICAL-STATE.json` and `tests/tools/authoritative.js` both read `e3d659b` |
| No application php differs from it | `git diff --name-only e3d659b..HEAD -- '*.php'` → empty |
| Control files present and read, not reconstructed | all four |
| Fast Edit | `wqaEditing` · `wqaEditStart` · `wqaSyncEditLocks` |
| Bulk Edit | `wqaRenderBulk` · `wqaToggleBulk` |
| Compact / Expanded | `wqaSetView` |
| Selected Items | `wqaSetApplyScope` · `wqaToggleRowSel` |
| Details | `.wqa-row-details` · `.wqa-row-body` |
| History | `wqaHistToggle` · `wqaHistMore` |
| Previous Price | `wqaHistUse` · `.wqa-prov` |
| Add-to-quotation | `wqaAddAll` |
| Zero-selected protection | `.wqa-none-sel` and the refusal toast |

---

## ALLOWED TO CHANGE

Presentation of **interaction state** only:

- hover, active/pressed, keyboard-focus and disabled styling
- mode awareness for Fast Edit (how it *looks* while open)
- selection feedback
- the Compact / Expanded segmented control's states
- Bulk Edit accordion header states and disclosure affordance
- Details / History open-state feedback and panel-to-row relationship
- Previous Price state clarity — available / applied / provenance / unavailable
- primary-CTA enabled / disabled confidence
- footer status vs secondary vs primary separation
- subtle motion, 140–220ms, using the existing `--mo-*` tokens
- `docs/control/ROUND-SCOPE.md` (this file)
- evidence capture scripts and this round's evidence
- the review package

---

## NOT ALLOWED TO CHANGE

parser · extraction · AI extraction semantics · pricing formulas · weight · DIA ·
Previous Price matching · History identity · History ordering · Qty rules ·
Material · Finish · Size Type · selection behaviour · Fast Edit behaviour ·
Bulk Edit behaviour · Details behaviour · Accessories calculation · database ·
Add-to-quotation logic · translation semantics.

Also out of scope this round, by instruction: dark mode, accessories carry-over,
Print/WhatsApp item numbering, Companies mobile polish, the 430px `APPLY TO`
clipping, PHP 8.2, the DB UNIQUE deployment. No new keyboard shortcuts. No new
asynchronous behaviour. No opportunistic refactoring.

UI POLISH 1's outcomes — modal width, density, hierarchy, row spacing, border
noise, Bulk Edit density — are **not** to be redesigned again.

---

## CANDIDATE APPLICATION CHANGE

This round proposes a change to the accepted application. It is declared here,
by name, so the report checker and the package verifier can tell a **declared
candidate** apart from an **unnoticed drift** — and so that any file NOT on this
list still fails, loudly.

```candidate-files
index.php
```

Nothing else may differ from `e3d659bba1636cd4cfc74cb89be1b52cf92aff67`.

The change is presentation only: every diff hunk in `index.php` must fall above
`</style>`. `CANONICAL-STATE.md`, `CANONICAL-STATE.json`,
`PROJECT-GUARDRAILS.md` and `tests/tools/authoritative.js` are **not** touched
while this round is a candidate. If UI POLISH 2 is accepted, the canonical
application commit moves then — deliberately, as its own step, with this
declaration closed.

---

## STOP CONDITION

- the full authoritative regression passes at or above the accepted counts,
  with zero failures and zero skips, and **no accepted test modified** to
  accommodate the candidate
- protected behaviour proven unchanged
- the required interaction evidence captured on 10–20 realistic rows, including
  hover, focus, active and disabled states and a reduced-motion frame
- ONE `QUOTATION-DNC-REVIEW.zip`, built and independently verified after
  extraction
- **no accepted control does anything different from what it did before**

Then STOP. No deploy. No further round.
