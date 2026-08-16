# QUOTATION.DNC — round 7 report

AI extraction / engineering-document interpretation only. Baseline
`6bba600191a306af2e70c3d37f37f1b052099cf4`. Nothing in Pricing History, the
pricing engine, accessories, saved quotations, the weight formula or Quick Add
layout was touched.

Earlier rounds are in `final-report-rounds-1-6.md`.

---

## 1. Root cause — Case A

Two independent faults met on the same drawing, and either alone would have
produced the reported result.

**The schema could not express a J Bolt.** `ai_extract.php`'s structured-output
enum was `SAG_ROD · STUD · ANCHOR_BOLT · L_BOLT · OTHER`. `J_BOLT` was absent
from the document-level enum, from the per-row enum, and from the sanitiser's
`$prodOk` allowlist. The model could not have answered "J Bolt" however clearly
the hook was drawn; the closest thing it was permitted to say was Anchor Bolt,
which is what it said. The instructions made this worse by filing a J bend
under L Bolt: *"a drawn L / J / U bend -> L_BOLT"*.

**Our own geometry rule needed evidence this drawing does not carry.**
`wqaNormalizeExtraction` promoted a row to `jbolt` only when it had **both** an
`ID` and an `S`:

```js
if(it.ID!=null && it.ID!=='' && it.S!=null && it.S!=='' && rowProd!=='jbolt') rowProd='jbolt';
```

A drawing that dimensions the hook by its **radius** (`R 25`) states no inside
diameter at all, so the condition never fired. The row stayed the Anchor Bolt
the title block said it was — and an Anchor Bolt's schema is `M · L · TL`, so
the `S 80` was dropped for having nowhere to go.

**The height had nowhere to go either.** A J Bolt is `M · H · ID · S · TL`;
there is no plain length in the schema. The drawing wrote its overall height as
`L 280`, and nothing mapped that to `H`. Even with the product corrected, `H`
would have come back empty and `280` would have sat in a field the J Bolt
schema does not have.

## 2. Root cause — Case B

**A merged specification cell reached only its first row.** The extractor is
instructed to report a merged cell on the first row it covers and leave the
rest of that block null — that is what the cell looks like on the paper, and
the prompt already promised *"our own code carries a value forward until the
next one replaces it"*. For dimensions (`M`, `TL`) it does. For **material,
finish and size type it never did**: every row after the first fell back to the
document-level value, which on a sheet whose blocks differ is correctly null.
Four of the six rows therefore arrived with no specification at all.

**A strength class was answered with an alloy.** `WQA_MATERIALS` maps
`Grade 8.8 / GR8.8 / G8.8 / HT / High Tensile` → `4140` and `Grade 10.9` → `4340`.
That is a deliberate, approved company mapping for a customer's *typed message*
— badged as a default, with the wording shown back. It was also being applied
to *extracted engineering documents*, where "DIN 975 GRADE 8.8" is the item's
specification and not a request for the steel this shop usually buys. The
`4140 QT` on the live screen came from our own rule table, not from the model.

**A2 was not in the vocabulary at all.** ISO 3506's stainless property classes
(`A2`, `A2-70`, `A4`, `A4-80`) had no rule; only the `SS304`/`SUS304` spellings
did. A specification written the ISO way produced no material.

## 3. Files changed

| File | What changed |
|---|---|
| `ai_extract.php` | `J_BOLT` added to both schema enums and the sanitiser allowlist; six new instruction blocks (hook geometry, J Bolt dimension reading, rotated tables, what a specification cell covers, row-beats-remark, strength-class-is-not-a-material); per-product field list and row-product wording extended |
| `index.php` | J Bolt geometry rule; `L → H` semantic mapping; merged-specification carry-down; `opts.noStrengthAlloy`; A2/A4 rules + paper guard; `notNear` in `wqaMatchMaterial`; row evidence fields `grade`, `hFromL`, `finishSeen`, `specRaw`; four badges and their en/zh strings |
| `tests/suites/19-drawing-interpretation.test.js` | new — 146 assertions |
| `tests/php/ai_extract.test.php` | +38 assertions on the prompt, the schema and the sanitiser |
| `tests/lib/harness.js` | exposes the new evidence fields to tests |
| `tests/extraction-shots.js`, `tests/extraction-evidence.js` | new — evidence frames and the in/out fixture dump |

No change to `api.php`, `companies.php`, `pricing_history.php`, `auth.php`,
`.cpanel.yml`, the database, or any configuration. No secret anywhere.

## 4. J Bolt geometry / product fix

**Schema.** `J_BOLT` is now a value the model may return, at document level and
per row, and the sanitiser accepts it. Anything outside the list is still
refused to `null`.

**Prompt.** A new block, `RECOGNISING A J BOLT ON A DRAWING`, lists what a hook
looks like on a sheet — a curve returning **up alongside** the shank, a short
return leg dimensioned as a height, an inside width *or* a radius, a thread at
the top only — and states that **any one** of them classifies it, over the title
block. The L-vs-J distinction is written as the direction of the short leg: an
L Bolt's leaves at a right angle and goes away, a J Bolt's turns back and runs
beside the shank. The old line filing a J bend under `L_BOLT` is gone.

**Normaliser.** A stated `S` alone is now enough:

```js
/* S is the hook's return height, and no other product in this system has one …
   This used to require an ID as well, and a drawing that dimensions the hook by
   its RADIUS instead — R 25 — states no inside diameter at all. */
if(it.S!=null && it.S!=='' && rowProd!=='jbolt') rowProd='jbolt';
```

Geometry still outranks wording, and wording alone still classifies nothing: a
bend radius on its own does **not** make a row a J Bolt (asserted).

## 5. J Bolt dimension semantic mapping

```js
let srcH = (it.H==null||it.H==='') ? '' : String(it.H);
let srcL = (it.L==null||it.L==='') ? '' : String(it.L);
let hFromL = false;
if(rowProd==='jbolt' && !srcH && srcL){ srcH = srcL; srcL = ''; hFromL = true; }
```

Three gates, all required: the geometry must **already** have proved the row is
a J Bolt; no height may have been stated; and there must be a length with
nowhere else to go. It is a mapping between two names for one dimension, not a
rule about the letter L.

* On a Sag Rod, Anchor Bolt, Stud and L Bolt, `L` stays `L` — asserted for each.
* A J Bolt that states **both** `H` and `L` keeps the stated `H` — asserted.
* The reading is recorded (`hFromL`) and shown on the row: *"drawing L 280 read
  as overall height H"*, so a checker can see it rather than wonder where the L
  went.

The prompt teaches the same thing upstream, by role and not by letter: *"H is
the OVERALL height … Customer drawings label this L, LENGTH, OVERALL LENGTH,
TOTAL LENGTH or OAL far more often than they label it H."*

**Case A now produces exactly the specified result:**

```
Product J Bolt · Size M12 · H 280 · S 80 · TL 50 · ID —  (Needs ID)
evidence: drawing L 280 read as overall height H | bend radius R 25 — not an inside diameter
```

## 6. Rotated-table / merged-cell fix

**Rotation** is the model's job and is now stated as such: `A TABLE MAY BE
PRINTED SIDEWAYS` tells it to establish the table's orientation from its own
heading row and text baselines rather than the page, to turn it upright and
read rows as items and columns as fields, to keep the table's reading order,
and to change no value — *"do not transpose dimensions, do not swap length
against quantity, do not reorder or renumber the rows, and do not drop the
first or last row because it sits at an edge of the photograph."* A single
sideways cell inside an upright table is called out as a tall merged cell, not
a rotated table. No OCR heuristics, no pixel work, no preprocessing hacks.

**Merged specification inheritance** is now real in the normaliser:

```js
const carry = (k, v) => {
  if(v || said[k]){ inh[k]=v; inh.raw[k]=rawIn[k]; rawSeen[k]=rawIn[k];
                    if(k==='material') inh.grade=(own&&own.strengthGrade)||'';
                    return v; }
  if(opts.inheritGaps && !common[k] && !unread){ rawSeen[k]=inh.raw[k]; return inh[k]; }
  return v;
};
```

Three properties make it reproduce a merge rather than smear a value:

* **A statement replaces what is carried, even when it resolves to nothing.** A
  row that says "DIN 975 GRADE 8.8" has *spoken*: the material goes empty for
  the rows that cell covers, so the stainless block above stops dead where the
  merge stops. Silence inherits; speech replaces.
* **Only where the sheet itself is silent.** A document-wide value applies to
  every row that does not speak, so one row's own value can never start a block
  underneath it.
* **`specResolved` rows are untouched** — the deterministic text parser has
  already applied row > group > document, and its empty values are answers.

## 7. A2 → SS304 and A4 → SS316 handling

```js
{re:/\ba2(?:[\s-]*\d{2})?\b/i, notAfter:WQA_MEASURED_RE, notNear:WQA_PAPER_RE,
 value:'SS304', from:'A2'},
{re:/\ba4(?:[\s-]*\d{2})?\b/i, notAfter:WQA_MEASURED_RE, notNear:WQA_PAPER_RE,
 value:'SS316', from:'A4'},
```

Verified to resolve to **SS304**: `A2`, `A2-70`, `A2-80`, `SUS304`, `SS304`,
`S/S 304`. To **SS316**: `A4`, `A4-70`, `A4-80`, `SUS316`, `SS316`, `S/S 316`.
One material identity per family — `A2` and `SUS304` do not produce two
materials, because the explicit spellings are tested first and the loop stops
at the first match.

**The paper trap.** A2 and A4 are also sheet sizes, and an engineering drawing
is exactly where that word appears. `notNear` — new in `wqaMatchMaterial` —
disqualifies a token when *sheet, paper, size of sheet, scale, format, drawing
size* or *printed on* sits within a few characters either side. Verified inert:
`SHEET SIZE A4`, `DRAWING SIZE A2`, `A4 PAPER`, `FORMAT A4`, `A2 SHEET`,
`PRINTED ON A4`, `SCALE A2` → no material. The prompt names the same trap.

## 8. Grade 8.8 / HDG handling

`Grade 8.8` and `Grade 10.9` are now marked `strength:true`, and
`wqaDetectCommon` takes `opts.noStrengthAlloy`, set **only** by
`wqaNormalizeExtraction` — the document path:

```js
if(m.strength && opts && opts.noStrengthAlloy){
  if(!out.strengthGrade) out.strengthGrade = wording;
  continue;                 // read, recorded, and NOT turned into a material
}
```

It `continue`s rather than breaking, so if the document names an actual steel
elsewhere, that steel is still the answer. The class travels with the block it
belongs to (`inh.grade`), so rows 4–6 of a merged cell carry it too, and the row
shows *"GRADE 8.8 stated — a strength class, not a material"* while Material
reads **Needs Material**.

**HDG** was already a finish and remains one; the prompt now says so explicitly
and lists the whole finish family (HDG, Hot Dip Galvanised, GI, ZP, Zinc
Plated, PL, Plain, Black, Self Colour, Painted) as *never* materials. Asserted:
no row anywhere gets `material = 'HDG'`.

**Precedence.** A sheet-wide `ISO 898 CLASS 5.8` under a block that states
`DIN 975 GRADE 8.8` leaves the rows on **8.8**, in the prompt and in the
result — verified in both the suite and `test-results/extraction-evidence.txt`.

**Entity scoping.** The prompt's `WHAT A SPECIFICATION CELL ACTUALLY COVERS`
answers two questions — *which rows* (exactly the merge) and *which part* (the
rod, not its nuts, washers, lock nuts or plates). A cell reading
`STUD DIN 975 GRADE 8.8 / HEX NUT DIN 934 GRADE 8 / FLAT WASHER DIN 125` gives
the stud **8.8**, and the nut's Grade 8 is not read as the stud's — asserted.

**Case B now produces exactly the specified result:**

| # | Size | L | Qty | Material | Finish | Grade |
|---|---|---|---|---|---|---|
| 1 | M12 | 145 | 9  | SS304 | *(see §14)* | — |
| 2 | M20 | 240 | 5  | SS304 | *(see §14)* | — |
| 3 | M10 | 120 | 27 | Needs Material | HDG | GRADE 8.8 |
| 4 | M10 | 125 | 21 | Needs Material | HDG | GRADE 8.8 |
| 5 | M10 | 130 | 21 | Needs Material | HDG | GRADE 8.8 |
| 6 | M16 | 170 | 9  | Needs Material | HDG | GRADE 8.8 |

No `4140`, no `4140 QT`, no `4340`, nowhere.

## 9. Anti-guessing protections added

* A **radius is never an inside diameter**. Not doubled, not halved, not copied.
  `R` is carried as evidence and shown as *"bend radius R 25 — not an inside
  diameter"*; `ID` stays null and the row asks. Asserted that no badge or field
  anywhere contains `ID 50` or `ID 25` for the reported drawing.
* A **strength class never becomes an alloy** on the document path — 8.8 ≠ 4140,
  10.9 ≠ 4340, 5.8 ≠ mild steel — in the prompt and in code.
* A **finish never becomes a material**, and a material is never also reported
  as a class.
* **A2 is not "grade 2" and A4 is not a strength class** — asserted from both
  directions (each maps to its stainless identity, and neither produces a
  grade).
* **A2/A4 beside a paper word is paper.**
* **No size type is guessed from a document.** The approved rule stands: not
  stated and no deterministic configured rule → `Needs Size Type`. Asserted that
  the Case B rows carry none.
* **A bend radius alone does not classify a product.**
* **`uncertain → null` preserved** — the `unclear` path is untouched.
* **Raw evidence kept beside the normalised value** (requirement 20): every row
  carries `specRaw` — the wording it was read from — carried down a merged block
  exactly as the value is, and printed in the evidence dump as
  `read from: material "A2-70 SUS304" · finish "PLAIN"`. Never invented: a row
  the document did not speak for has none.

**No hardcoding.** No filename, no pixel coordinate, no `if R25`, no
`if M12 → J Bolt`, and none of the six row values appears in application code.
The reported values appear only inside test fixtures, which is what a fixture
is. Every rule is stated in terms of geometry, cell coverage and vocabulary.

## 10. Existing regressions preserved

All 18 pre-existing browser suites pass unchanged, covering every item on the
list: HAB-TA-01 and the 950 / 865 / 1000 / 1200 / 1285 row association; the five
schemas (Stud `M·L`, Sag Rod `M·L·TL`, Anchor Bolt `M·L·TL`, L Bolt `M·L·W·TL`,
J Bolt `M·H·ID·S·TL`); imperial/metric mixed parsing; J Bolt and L Bolt
multiline parsing; UNC/UNF/BSW detection; `uncertain → null`; no unsupported
Fullsize guessing; image + WhatsApp text merging; the engineering
dimension-chain; weight; Diameter Settings; and pricing/accessories separation.

The pasted-message path is deliberately **unchanged**: a customer typing
`G8.8 STUD PL` still gets the company's established `4140 QT`, asserted in the
new suite so the distinction cannot be lost by accident.

Every fix in this round was checked by reverting it and confirming the new
assertions fail — the J Bolt geometry rule, the `L → H` mapping, the merged
carry-down, the strength-class suppression, the A2/A4 rules and the paper guard
were each verified this way.

## 11. Assertion count / failures

| Suite | Assertions | Failed |
|---|---|---|
| 19 browser suites (incl. new suite 19: 146) | **1482** | **0** |
| `ai_extract` (PHP) | 102 | 0 |
| `pricing_history` (PHP) | 72 | 0 |
| pricing workbook (Python) | 62 | 0 |
| **Total** | **1718** | **0** |

PHP lint: 10 files, no syntax errors. No page errors in any browser suite.

## 12. Evidence screenshots / results produced

`extraction/` — seven frames, both reported cases:

| File | What it shows |
|---|---|
| `1-caseA-as-drawn.png` | the hook drawing as reported → J Bolt, M12, H 280, ID empty with **Needs ID**, S 80, TL 50, radius shown as *"from the drawing — not a quotation field"* |
| `2-caseA-compact.png` | the same row in Compact |
| `3-caseA-with-stated-id.png` | the same drawing with an inside width written on it → ID 50 populated, nothing else changed |
| `4-caseB-six-rows.png` | six rows, Expanded |
| `5-caseB-compact.png` | six rows, Compact — rows 1–2 SS304, rows 3–6 HDG + *"GRADE 8.8 stated — a strength class, not a material"* |
| `6-row-beats-remark.png` | a sheet-wide Class 5.8 under a block stating Grade 8.8 |
| `7-vocabulary.png` | A2-70, A4-80, SUS316, Grade 8.8, Grade 10.9 and "SHEET SIZE A4" side by side |

`test-results/extraction-evidence.txt` — the extraction that goes **in** and the
quotation rows that come **out**, for both cases plus the remark-precedence
case, including the raw-vs-normalised `read from:` line for every row.

`screenshots/` (9 frames) and `layout/` (14 frames) regenerated unchanged, so
the earlier rounds' evidence is current against this commit.

`test-results/` — `browser-suites.txt` / `.json`, `php-ai-extract.txt`,
`php-pricing-history.txt`, `php-lint.txt`, `pricing-workbook-check.txt`.

## 13. ZIP package name

`quotation-dnc-final.zip` — 50 files, built from the committed
`quotation-dnc-final/` folder. The repository's `.gitignore` excludes `*.zip`
by design (release archives must not re-enter Git history), so the folder is
the version-controlled copy and the archive is rebuilt from it with
`zip -r quotation-dnc-final.zip quotation-dnc-final`.

## 14. Remaining risk

**A conflict between this round's requirement 11 and an approved rule from an
earlier round — your decision, not mine.** Requirement 11 asks for rows 1–2 to
read `Material SS304 / Finish PL`. The extraction does read `Plain → PL`
correctly, and the row records it. But an approved rule from round 2,
`DC_NO_FINISH_MATERIALS = ['SS304','SS316']`, clears the finish for stainless
throughout the application — a stainless rod is quoted without a coating — and
it has its own regression tests. I did **not** silently break it. The row shows
`SS304 · N/A` with the badge *"PL stated — SS304 is quoted without a finish"*,
so the reading is visible and nothing is lost. If you want stainless to carry
`PL` on the quotation, say so and it is a one-line change plus its tests; it
affects the Calculator, print output and pricing history identity as well as
Quick Add, so it should not be changed by inference.

**The model's half of both cases is unverified against the live API.** Everything
downstream of the model's answer is proven by 146 new assertions against
fixtures shaped exactly like the reported failures. What still needs one live
run with a key is whether the model, with the new schema and instructions,
actually classifies the hook as `J_BOLT` and reads the rotated table's merged
cells the way the prompt now asks. The prompt text and the schema are asserted
in `tests/php/ai_extract.test.php`; the model's behaviour cannot be.

**A stated `S` now classifies a J Bolt outright.** If a future document uses `S`
for something other than a hook's return height on a product that is not a J
Bolt, that row would be misclassified. No product in the current schema uses `S`
for anything else, and the review screen lets a person change the product, but
it is a broader rule than the one it replaced.

**Merged-cell carry-down is forward-only and unbounded.** A block's
specification carries down until another row states one or the list ends. That
is what a merge looks like; but if the extractor reports a block's value on the
first row and then *omits* a later block entirely, the earlier block's value
would reach rows it does not cover. The prompt is explicit that each block's
value must be reported on the first row it covers, and it only applies where
the document itself states no sheet-wide value.

**Round 6's open item stands:** the deferred `get4140Rates()` description
mismatch and the other business decisions in `remaining-business-decisions.md`
are unchanged by this round.

## 15. Final commit hash

```
f074b5b111fc93698968ae704fc1b3443cab6ac2
```

Branch `claude/quotation-dnc-audit-repair-ashi82`. This is the commit to deploy;
the packaging commit that follows it touches only this folder and the ZIP, both
of which are outside `.cpanel.yml`'s allowlist.

**Deployment status: NOT DEPLOYED.** `.cpanel.yml` is a manual two-click deploy
(*Update from Remote*, then *Deploy HEAD Commit*). I have not run it and no part
of this report describes the live site as verified.
