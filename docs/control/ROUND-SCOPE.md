# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**QUICK ADD — SIZE TYPE DISPLAY FIX**

Display only. No parser, no resolution logic, no pricing, no weight, no database.

| | |
|---|---|
| Accepted application commit | `cf92f27feb629134a61801dc120eba79c54fb5f6` |
| Previous accepted commit | `3e89713400b5bcfceca31d2c074de17411169d1b` — superseded by UI POLISH 2A |
| This round | a **candidate**, not an accepted state |
| Deploy | **NO** |

---

## BASELINE GATE — PASSED BEFORE ANY EDIT

| Check | Evidence |
|---|---|
| Accepted commit is an ancestor of HEAD | `cf92f27` |
| No application php differed from it at the start | `git diff --name-only cf92f27..HEAD -- '*.php'` → empty |
| No test suite differed from it | `git diff --name-only cf92f27..HEAD -- tests/suites tests/lib` → empty |
| Working tree clean | `git status --short` → empty |
| Control files present and read | all four |

---

## THE DEFECT, READ FROM SOURCE

A Quick Add row whose size type the customer never stated has it applied by the
company's own rule, and the row records that: `r.stDefaulted = true`,
`r.stWhy = 'companyDefault' | 'configured'`.

**Two surfaces then show the provenance INSTEAD OF the value**, not beside it:

| line | surface | renders |
|---|---|---|
| 12620 | `wqaRowBadges` → `.wqa-sum-badges` | `dcT('wqaStCompany')` → *"Size Type: company default"* |
| 16682 | `wqaMetaSizeTypeHtml` → `.wqa-meta-line` | the same string, and **returns early** so the value branch below it never runs |

Meanwhile the Bulk Edit selector and the expanded editor both read
`wqaRowSpec(r,'sizeType')` and show **Fullsize**. So three places describe one
row and one of them names a source where the others name a value. That is the
inconsistency, and it is entirely in the rendering: the resolved value is
already correct in state.

**Why the provenance exists at all**, from the code's own comment: a size type
the customer never stated changes the diameter, and therefore the weight and the
price, by about 22% at M12. It was once shown as if the document had said it.
The provenance is not noise — so this round **adds the value, it does not
remove the source**.

---

## ALLOWED TO CHANGE

```candidate-files
index.php
```

Nothing else may differ from `cf92f27feb629134a61801dc120eba79c54fb5f6`.

- `wqaRowBadges` and `wqaMetaSizeTypeHtml` — show the RESOLVED value, read from
  `wqaRowSpec(r,'sizeType')`, the same expression the Bulk Edit selector and the
  expanded editor already read, so the three cannot disagree again
- the source is kept as a suffix: **`Size Type: Fullsize · company default`**
- `wqaStCompany` / `wqaStConfigured` lose their now-duplicated `Size Type:`
  prefix and become the source phrase alone. **The keys are reused, not added:**
  the dictionary stays at 862 keys and canonical does not move
- `Fullsize` / `Undersize` stay untranslated, as they are in every select in the
  application — accepted trade vocabulary, not a new hard-coded string

---

## NOT ALLOWED TO CHANGE

The parser · size-type RESOLUTION (`DC_SIZE_TYPE_RULES`, `dcSizeTypeFor`,
`wqaRowSpec`) · which rows are `stDefaulted` and why · pricing · weight · DIA ·
Previous Price · Qty · material mapping · quotation numbering · the database ·
`GET_LOCK` · translations as a KEY SET · the accepted UI POLISH 2A save
interaction · the accepted STAGE 1 UI.

`r.stDefaulted` and `r.stWhy` keep their present meanings and are still set in
exactly the places they are set now. This round reads them; it does not decide
them.

---

## STOP CONDITION

- a defaulted row's badge and meta line both read
  `Size Type: <value> · <source>` — the value first
- a row whose size type the DOCUMENT stated still reads `Size Type: <value>`
  with no source suffix, exactly as it does today
- a product with no size type still renders no line at all
- the badge still contains the words the existing suites assert
  (`08-panels`, `11-business-rules` check `includes('company default')`)
- M12 Fullsize, M12 Undersize, company-default mapping and manual override all
  unchanged in behaviour and in resolved value
- the FULL browser regression re-run — application bytes change — every side
  suite, and the translation audit at **862 keys / 100%**
- **zero failures, zero skips**

Then STOP. **No deploy.** Not promoted until Nicholas reviews it.
