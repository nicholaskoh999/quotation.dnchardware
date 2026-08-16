# QUOTATION.DNC — round 7, part 3: material identity

The company's canonical mapping, as ruled. Baseline for this part:
`581d5024e0e68426de27016d742ed28139919934` (round 7 part 2).

Parts 1 and 2 are in `final-report-extraction.md` and `final-report.md`.

---

## 1. Root cause

**One specification had two answers, depending on which door it came in
through.** An earlier round in this same round-7 sequence was told not to
invent `4140 QT` from a document's `Grade 8.8`, and implemented that as
`opts.noStrengthAlloy` on the extraction path only: a typed `G8.8` resolved to
4140 QT, a photographed `DIN 975 GRADE 8.8` was held open as a strength class
with `Material = null / Needs Material`. The live finding is that this is
wrong at the business level — 8.8 *is* 4140 QT for this company, and 10.9 *is*
4340 QT — so the same stud came out of a photograph unpriceable and out of a
pasted line priced.

Three further faults sat in the vocabulary itself:

**A bare `HT` and `HIGH TENSILE` answered `4140 QT`.** Both 8.8 and 10.9 are
high tensile. The wording on its own does not say which of two real and
different steels the company would buy, so answering 4140 QT was a guess
between two materials — the one place in the table that guessed.

**Spellings were missing.** `Class8.8` and `Class 10.9` (the word `class` was
not in either pattern — `Class 8.8` only matched by accident, through the bare
`\b8\.8\b` alternative, and `Class8.8` has no word boundary so it matched
nothing). `AISI 304` / `AISI 316`. `4140 Q&T`, `4340 Q&T`, `AISI 4140`,
`AISI 4340`. `HOT-DIP` with a hyphen. `SELF COLOUR`.

**Precedence was positional by accident.** The stainless rules sat *after* the
grade families in `WQA_MATERIALS`, and the loop stops at the first match. It
happened to work only because no stainless spelling contains `8.8` or `10.9` —
but `SUS304 GRADE 8.8` resolved to `4140 QT`, overwriting an explicit stainless
identity with an alloy.

## 2. Exact vocabulary / mapping change

`index.php`, `WQA_MATERIALS` and `WQA_FINISHES`. Four identities, never merged:

| Family | Recognised | → |
|---|---|---|
| **304** | `SS304 · SS 304 · S.S.304 · S/S304 · S/S 304 · SUS304 · SUS 304 · AISI 304 · 304SS · 304 SS · 304 Stainless · 304 Stainless Steel · Stainless 304 · Stainless Steel 304 · A2 · A2-50 · A2-70 · A2-80` | `SS304` |
| **316** | the same list with 316, plus `A4 · A4-50 · A4-70 · A4-80` | `SS316` |
| **8.8** | `8.8 · G8.8 · G 8.8 · GR8.8 · GR 8.8 · GR.8.8 · Gr 8.8 · Grade 8.8 · Grade8.8 · Class 8.8 · Class8.8 · CL 8.8 · HT8.8 · HT 8.8 · H.T. 8.8 · 8.8 HT · HT G8.8 · HT GR8.8 · HT Grade 8.8 · High Tensile 8.8 · High Tensile Grade 8.8 · DIN 975 (8.8 / G8.8 / GR8.8 / Grade 8.8) · DIN975 8.8 · 4140 · 4140 QT · 4140 Q&T · AISI 4140 · AISI 4140 QT` | `4140 QT` |
| **10.9** | the same shapes with 10.9, plus `4340 · 4340 QT · 4340 Q&T · AISI 4340 · AISI 4340 QT` | `4340 QT` |

All 76 spellings are asserted individually.

Finishes, unchanged in meaning and extended in wording: `ZP · ZINC · ZINC
PLATED · ZINC PLATING · ELECTRO ZINC → ZP`; `HDG · HOT DIP GALVANISED /
GALVANIZED · HOT-DIP … → HDG`; `PL · PLAIN · BLACK · SELF COLOUR / COLOR → PL`.
Stainless then loses its finish by the rule from part 2, so `A4-70 HDG` is
`SS316 / N/A` with `HDG` kept only as evidence.

**One mapping, one path.** `wqaDetectCommon` no longer takes a
`noStrengthAlloy` option — there is nothing for it to mean. Both call sites in
`wqaNormalizeExtraction` drop it, so a pasted message, a photograph, a PDF and
an engineering table resolve identically. The class that produced the answer is
kept beside it (`row.grade`, `matFrom`) rather than replaced by it, and the
header shows the reading: **`GRADE 8.8 → 4140 QT`**.

## 3. Precedence rules

**Identity before strength — structurally.** The stainless rules were moved
*above* the grade families. The loop stops at the first match, so their
position *is* the precedence rule; there is no second mechanism to keep in
step.

* `SUS304 GRADE 8.8` → `SS304`. An explicit base material is never overwritten
  by a strength written beside it.
* `A2-70` → `SS304`, `A4-80` → `SS316`. The `70` and the `80` are ISO 3506
  property classes and can never reach the 8.8/10.9 families.
* `A4-70 HDG` → `SS316`. A finish never changes a material.

**Explicitly named alloys stay first of all**: `4140 QT + HARDEN` and
`S45C + HARDEN` are tested before everything, so they keep selecting themselves.

**Ambiguity is not resolved by guessing.** `STAINLESS STEEL`, `STAINLESS`,
`SS`, `S/S` (304 or 316 unknown) and `HT`, `HIGH TENSILE`, `HIGH-TENSILE`
(8.8 or 10.9 unknown) all leave `Material = null` and the row asks. So does
`Class 5.8`, which has no company material. And the paper guard is unchanged:
`A4 PAPER`, `SHEET SIZE A4`, `DRAWING SIZE A2`, `A2 SHEET`, `FORMAT A4` are the
sheet, not the steel.

**Entity scoping is unchanged and still holds.** `STUD DIN 975 GRADE 8.8 / HEX
NUT DIN 934 GRADE 8 / FLAT WASHER DIN 125` gives the stud `4140 QT` from *its*
8.8. A nut's `Grade 8` is not in this vocabulary at all and names no material —
asserted on its own and inside the assembly string. A row's own specification
still beats a sheet-wide `ISO 898 Class 5.8`.

## 4. Files changed

| File | What changed |
|---|---|
| `index.php` | stainless rules moved ahead of the grade families; both grade patterns extended and the bare `HT` / `HIGH TENSILE` alternatives removed; `4140`/`4340` `Q&T` and `AISI` spellings; `AISI 304`/`AISI 316`; `hot-dip` and `self colour`; `opts.noStrengthAlloy` removed from `wqaDetectCommon` and both call sites; `strengthGrade` recorded whenever a strength rule matches; the material's provenance (`matFrom`, `matDefaulted`) carried down a merged specification block |
| `ai_extract.php` | the instruction block rewritten: copy the wording, do **not** translate it into an alloy — that mapping is the company's and runs in our code; `HT8.8`, `AISI 304/316`, `A4-70` added to the vocabulary it names |
| `tests/suites/22-material-identity.test.js` | new — 236 assertions |
| `tests/suites/19-drawing-interpretation.test.js` | Case B and the entity-scoping expectations updated to the ruling |
| `tests/php/ai_extract.test.php` | prompt assertions updated, +5 |
| `tests/lib/harness.js` | exposes `matFrom` / `matDefaulted` |
| `tests/extraction-shots.js`, `tests/extraction-evidence.js` | the two live formats added as evidence |

No change to `api.php`, `companies.php`, `pricing_history.php`, `auth.php`,
`.cpanel.yml`, the database or any configuration. No secret anywhere.

## 5. Tests added

**Suite 22 (236).** Every one of the 76 spellings above, one assertion each.
The four identities asserted distinct from one another. The seven ambiguous
wordings and the five paper-size traps asserted unresolved. Precedence:
`A2-70`, `A4-80`, `SUS304 GRADE 8.8`, `A4-70 HDG`. Ten grade-plus-finish pairs
(`GRADE 8.8 ZINC → 4140 QT / ZP`, `PLAIN G8.8 → 4140 QT / PL`, `Grade 10.9
HOT-DIP GALVANIZED → 4340 QT / HDG`, …) proving a grade is never read as a
finish and a finish never as a material. Entity scoping. Both live production
formats. And a door-to-door comparison: the same four specifications put in as
typed text and as extracted document, asserted to produce the same material and
the same finish.

**Suite 19** keeps its 148 and now expects Case B rows 3–6 as `4140 QT / HDG`
with the class as evidence and **no** `Needs Material`.

### Proved failing first

`test-results/material-identity-BEFORE-fix.txt` is suite 22 against
`581d502`: **224 assertions, 33 failed** — including every `PLAIN G8.8` part of
the HAB-TA-01 drawing (`part 1 is 4140 QT` … `part 5`), `extracted "DIN 975
GRADE 8.8" → 4140`, `Class8.8`, `AISI 304`, the bare-`HT` cases, and
`an explicit stainless is not overwritten by a grade written beside it`.
After the change the same file passes 236/236.

Each change was then re-verified by reverting it alone:

| Reverted | Result |
|---|---|
| bare `HT`/`HIGH TENSILE` → 4140, `Class8.8`/`AISI` removed | 4 failures — the guess returns and the spellings go unread |
| the document path suppresses the mapping again | **100 failures** |

## 6. Assertion total

| | Part 2 | Now |
|---|---|---|
| Browser suites | 21 / 1,762 | **22 / 2,000** |
| `ai_extract` (PHP) | 102 | **107** |
| `pricing_history` (PHP) | 90 | 90 |
| Pricing workbook (Python) | 62 | 62 |
| **Total** | **2,016** | **2,259** |
| **Failures** | 0 | **0** |

PHP lint: 10 files, no syntax errors. No page errors in any browser suite.

## 7. Updated Case B evidence

`extraction/4-caseB-six-rows.png` and `5-caseB-compact.png`:

| # | Size | L | Qty | Material | Finish | Evidence |
|---|---|---|---|---|---|---|
| 1 | M12 | 145 | 9 | **SS304** | **N/A** | *PL stated — SS304 is quoted without a finish* |
| 2 | M20 | 240 | 5 | **SS304** | **N/A** | same |
| 3 | M10 | 120 | 27 | **4140 QT** | **HDG** | read from `STUD DIN 975 GRADE 8.8`; material from `GRADE 8.8` |
| 4 | M10 | 125 | 21 | **4140 QT** | **HDG** | carried down the merged cell, with its provenance |
| 5 | M10 | 130 | 21 | **4140 QT** | **HDG** | same |
| 6 | M16 | 170 | 9 | **4140 QT** | **HDG** | same |

The header carries the reading **`GRADE 8.8 → 4140 QT`**. No row says
`Needs Material`. No `4340` anywhere — that is the 10.9 material and nothing
here is 10.9. The sheet-wide `ISO 898 Class 5.8` still does not displace the
block's own 8.8.

## 8. Live production evidence

**`extraction/8-live-ht88-zinc.png` and `9-live-ht88-compact.png`** — the
photographed order list, four rows under one heading:

```
Material 4140 QT · Finish ZP · header: HT8.8 → 4140 QT
M12 · 1582 · 200/200 · 37   RM 4.62      M12 · 1104 · 200/200 · 44   RM 3.22
M12 · 1406 · 200/200 · 382  RM 4.10      M12 ·  986 · 200/200 · 28   RM 2.88
```

Every row priced, nothing outstanding, **Add 4 Items to Quotation** enabled.

**`extraction/10-live-plain-g88.png`** — HAB-TA-01, five parts each captioned
`PLAIN G8.8 M30 x` its own length: `4140 QT / PL`, lengths `950 · 865 · 1000 ·
1200 · 1285`, each still owned by the part that carries it — the dimensional
regression from the earlier round is untouched.

The typed form of the same order list is asserted in suite 22, both as four
self-describing lines and as one heading over four rows.

`test-results/extraction-evidence.txt` prints the extraction that goes in and
the rows that come out for both, with `read from:` and `material from:` beside
every value.

## 9. Remaining risks

**`TWO END STUD` resolves to Sag Rod, not Stud — and this needs your
decision.** The ruling's Example A expects `Product = Stud` with `TL =
200/200`, but a Stud in this system is `M · L` with **no thread field at all**,
so those two cannot both be true. What the app does today is deliberate and
long-standing: the wording says Stud, the geometry says two threaded ends, and
rather than choose it flags **"Conflicting product"**, keeps the `200/200`
beside the row as evidence, and waits for a person. On the extraction path the
model classifies it `SAG_ROD` and the rows go through cleanly, which is what
the live screenshot shows. **Nothing about the material depends on this** — it
is 4140 QT / ZP either way. If you want `TWO END STUD` to mean Sag Rod
silently, or a Stud to gain a thread, say which and it is a small change plus
its regressions. Not changed on my own initiative.

**A bare `HT` on an old message now asks instead of answering.** Any existing
habit of writing just `HT` will produce `Needs Material` where it used to
produce 4140 QT. That is the ruling (§9: `HT STUD → Needs Material`), and it is
the safer answer, but it is a change staff will notice.

**`Class 5.8` has no company material** and stays unresolved. The ruling names
only four families; 5.8 is not among them.

**The model's half is still unverified against the live API.** The prompt now
tells it to copy the wording and not to translate — asserted in
`tests/php/ai_extract.test.php` — but what a model does with a page can only be
seen with a key.

**The non-stainless `PL` default from part 2 is unchanged**, still pinned, still
awaiting your decision.

> **Superseded in part 4 for the deploy commit only.** The material work here
> is unchanged; the commit to deploy is now part 4's. See
> `final-report-previous-price.md`.

## 10. Final application commit to deploy

```
ddc2c87666244aad786ee4a3add14f8e1897847c
```

Branch `claude/quotation-dnc-audit-repair-ashi82`. The packaging commit that
follows it touches only `quotation-dnc-final/`, which is outside
`.cpanel.yml`'s allowlist and is never copied to the server.

**NOT DEPLOYED.** `.cpanel.yml` is a manual two-click deploy — *Update from
Remote*, then *Deploy HEAD Commit*. I have not run it, and nothing here
describes the live site as verified.

## 11. Updated ZIP

`quotation-dnc-final.zip`, rebuilt from the committed folder.

---

*Round 7 is not declared accepted here. These artifacts are for your review.*
