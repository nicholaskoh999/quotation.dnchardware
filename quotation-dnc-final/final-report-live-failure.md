# QUOTATION.DNC — round 7, live failure audit + repair

Baseline `0f4f184b8487e73803e0506b475ba2465c711a9d` (round 7 part 5).
Two live failures were reported. They are unrelated, and both are real.

---

## 1. Root cause

### A. Every imperial size was invisible to pricing history

`json_encode` escapes a forward slash. A half-inch rod is therefore stored in
`quotations.items` as:

```
"cleanSize":"1\/2"
```

The endpoint's prefilter looks for that text with `LIKE`. **A backslash is
MySQL's LIKE escape character.** Handed over raw, `LIKE` read the backslash as
an escape, consumed it, and went looking for `"cleanSize":"1/2"` — which is not
what is in the blob. The row was never returned, so `dc_history_record` (which
is the authority and compares every field) was never reached, and the panel
printed *"No pricing history for this exact specification."*

This applied to **every imperial size the business quotes** — 1/2, 3/8, 5/8,
3/4, 7/8, 1-1/4, 1-1/2 — and to no metric size, because a metric size contains
no slash. That is exactly the shape of the report: a 1/2" rod with two prior
quotations behind it, answered "no history", while metric rods answered
normally.

The same escape was missing for `%` and `_`. A `cleanSize` of `%` would have
matched **every quotation ever saved**.

### B. An unanswered size type was silently read as fullsize

`dcBuiltInDiameter` branches on `type==='stud' || sizeType==='UNDERSIZE'`, so
everything else falls through to the fullsize table. That is the right reading
of an **answer** and the wrong reading of a **silence**: a row that said *Needs
Size Type* was weighed and priced in the same breath.

```
1/2 x L1020, size type not stated   →  1.0143 kg/pc   (12.7mm — FULLSIZE)
the same rod, chosen as Undersize   →  0.7472 kg/pc   (10.9mm)
```

36% too heavy, and the price computed on it.

---

## 2. Exact production failure point

**CASE A — the backend, for the pricing-history failure.** `pricing_history.php`,
`dc_history_sql_where()`. The needle is built and put straight into the `LIKE`
parameter:

```php
return [
    '(q.items LIKE ? OR q.items LIKE ?)',
    ['%' . dc_history_needle($want['cleanSize'] ?? '') . '%',
     '%' . dc_history_size_text_needle($want['cleanSize'] ?? '') . '%'],
];
```

At `0f4f184` that produces, for a half-inch enquiry:

```
$1 = %"cleanSize":"1\/2"%          ← the \ is eaten by LIKE
$2 = %1\/2%
```

Neither can match the stored blob. The frontend was never at fault: it asks for
`cleanSize=1/2`, which is correct and is now asserted (suite 24).

**The second failure is the frontend.** `index.php`, `autoFillDiameter()` at
the point it calls `dcEffectiveDiameter` with an empty `sizeType`.

**A contributing factor, separately:** the finish-as-reference work that turns
a differently-coated record into a labelled reference is in `0f4f184`, which
**was never deployed**. Even with the LIKE fix, a deployed build without
`0f4f184` would still answer "no history" for a ZP enquiry against PL records.
Both commits have to ship.

---

## 3. Implementation change

`pricing_history.php`

| | |
|---|---|
| `dc_history_like_escape($s)` | **new.** Escapes `\`, `%`, `_` — backslash first, or it would escape the escapes. Applied to both needles in `dc_history_sql_where`. |
| `dc_like_matches($subject,$pattern)` | **new.** Models MySQL's LIKE — `%` any run, `_` any character, `\` the escape. |
| `dc_history_blob_matches` | rewritten to run the **same params `dc_history_sql_where` returns** through `dc_like_matches`. It used `strpos` before, and `strpos` and `LIKE` disagree on exactly the character that broke this — which is why the existing tests passed. |

After the change:

```
$1 = %"cleanSize":"1\\/2"%
$2 = %1\\/2%
```

`index.php`

| | |
|---|---|
| `autoFillDiameter` | asks once: `fieldExists(type,'sizeType') && dcProductHasSizeType(type)` and no size type ⇒ **no diameter**. The rest of the app already treats no diameter as no weight and no price (`wqaRecomputeAll` sets `r.noDia` and `r.calc=null`). |
| `wqaSizeTypeOpen(r)` | **new.** The one question a row cannot answer anything else without. |
| `wqaRowMissing` | uses it in three places, so a row with no size type asks for **that and nothing else** — not also for a Cost Rate it could not have and a Price it could not compute. The `Valid Size` question already worked this way; the rate and price questions now do too. |

**Deliberately unchanged:** `dcBuiltInDiameter` itself, so an explicit
`FULLSIZE` still means fullsize everywhere it is passed one — including the
Diameter Settings coverage listing, which enumerates both size types by name.
A Stud (`DC_NO_SIZE_TYPE_PRODUCTS`) is never asked and keeps its undersize bar.
Others, whose diameter is typed by hand, has no `-size` field and never reaches
the line.

**`DC_SIZE_TYPE_RULES` is untouched.** A company rule is an answer, not a
guess: mild steel is drawn undersize at M12 and at the half inch, the QT grades
are fullsize away from M12, and those rows are still answered and still weighed.

---

## 4. Tests added / changed

| Suite | Was | Now | What is new |
|---|---|---|---|
| **25 — size type: unknown is not fullsize** | — | **68** | new |
| 24 — pricing history: whose price is this | 45 | **61** | imperial vs metric, and no lookup without a size type |
| 10 — engineering drawing | 48 | **73** | updated to the new contract, **stronger** |
| `pricing_history.test.php` | 139 | **161** | the imperial prefilter, both ways |

**Suite 25** — the live figure `1.0143` spelled out so it cannot come back
quietly; the row asks for its size type and asks for **that alone**; choosing
Undersize computes, choosing Fullsize computes the other bar; the same rule on
anchorbolt / lbolt / jbolt; the three established company rules still answered
and still weighed; a Stud never asked and still weighed on 14.5mm; and the
Calculator — no choice → `''`, Undersize → `10.9`, Fullsize → `12.7`.

**Suite 24 (+16)** — a half-inch row asks for `cleanSize=1/2` verbatim and is
shown its own record, never the M12 one; an M12 row asks for `M12` and is shown
its own, never the half-inch one; neither panel prints the other size anywhere.
Then: a row with no size type has **no history identity at all**
(`wqaHistSpec` → `null`), **no lookup is made**, and no fullsize record is
offered — and once answered the lookup carries that answer and the record
appears.

**Suite 10 (+25)** — the HAB-TA-01 drawing states no size type, and mild steel
at M30 has no rule. The five parts now assert they ask, and are not weighed or
priced on a guess; the size type is then answered and every part is weighed on
its **own** length, which is what the suite has always been about. Nothing was
weakened: the borrowed-dimension assertions all survive, on the answered path.

**`pricing_history.test.php` (+22)** — all seven imperial sizes reachable
through the real `dc_history_sql_where` params; imperial↔metric negative
controls; wildcard-leak controls (`%`, `M_6`); and the live case end to end
through `dc_history_record`.

**`tests/php/imperial-like-evidence.php`** — new, and not a fixture: it builds
the blob with `json_encode` itself, prints the actual SQL params, and applies
MySQL's LIKE semantics to them.

---

## 5. Before-fix failing proof

### A — imperial history, at `0f4f184`

`test-results/imperial-history-BEFORE-fix.txt`:

```
── what the database actually stores ───────────────────────
  the size, as stored:  "cleanSize":"1\/2","de

── what the endpoint asks it for (HEAD) ────────────────────
  WHERE (q.items LIKE ? OR q.items LIKE ?)
    $1 = %"cleanSize":"1\/2"%
    $2 = %1\/2%

── could that query ever return this row? ──────────────────
    pattern 1 -> no match
    pattern 2 -> no match
  FAIL  the half-inch row is reachable at all
  ok    a metric row is reachable

  FAIL  1/2 · 3/8 · 5/8 · 3/4 · 7/8 · 1-1/4 · 1-1/2
  FAIL  a bare % must not match every quotation ever saved
  FAIL  an underscore must not stand in for a digit

  10 FAILED
```

The PHP suite carried the same failure: nine assertions red before the escape
was added.

### B — size type, at `0f4f184`

`test-results/sizetype-weight-BEFORE-fix.txt`: **68 assertions, 12 failed**,
including the live numbers exactly —

```
and the row now has no weight at all      expected ""   actual "1.01430571332"
and no price                              expected ""   actual "4.86"
the screen shows no weight either ("1.0143 kg/pc")
and it is not weighed on the 16mm bar     expected ""   actual "1.6099092480000001"
and not priced at RM 7.36                 expected ""   actual "7.36"
with no size type chosen the calculator has no diameter
                                          expected ""   actual "12.7"
```

---

## 6. After the fix

| | |
|---|---|
| Browser suites | **25 / 2,230** |
| `pricing_history` (PHP) | **161** |
| `ai_extract` (PHP) | **107** |
| Pricing workbook (Python) | **62** |
| **Total** | **2,560** |
| **Failures** | **0** |

PHP lint: 10 files, no syntax errors. No page errors in any browser suite.
Previous total was 2,429 — **+131**, none removed.

`test-results/imperial-history-AFTER-fix.txt` prints the same run green,
ending with the two records the live case should have had all along:

```
Q-2026-0470  1/2  L 980 x TL 100/100mm   finishMatch=false  dimDistance=40  RM 11.2
Q-2026-0470  1/2  L 1080 x TL 100/100mm  finishMatch=false  dimDistance=60  RM 12.3
```

---

## 7. New application commit

```
16b5f3c    Imperial pricing history, and an unanswered size type
```

Branch `claude/quotation-dnc-audit-repair-ashi82`.

**Both this and `0f4f184` are required.** `0f4f184` is what makes a
differently-coated record appear as a labelled reference; `16b5f3c` is what
makes an imperial record reachable at all. Deploying either alone leaves the
live case broken.

---

## 8. Deployment status

**NOT DEPLOYED.** `.cpanel.yml` is a manual two-click deploy. I have not run it,
and nothing in this report describes the live site as verified.

---

## 9. Updated ZIP

`quotation-dnc-final.zip`, rebuilt from the committed folder.

---

## 10. Evidence

**The imperial failure is proved in text, not in pictures** — a stubbed browser
cannot exercise a SQL escape, so a screenshot of one would prove nothing. See
`test-results/imperial-history-BEFORE-fix.txt` and `-AFTER-fix.txt`, both
produced by `tests/php/imperial-like-evidence.php` against the real functions
and a blob written by `json_encode` itself.

`sizetype/` — the second failure, on screen:

| File | What it shows |
|---|---|
| `1-half-inch-no-size-type.png` | 1/2 × L1020, nothing stated: **unit weight —, total weight —, RM—**, badges *Needs Material* · *Needs Size Type*, and no third question |
| `2-M16-no-size-type.png` | MS M16, no rule covers it: the same, where it used to show 1.6099 kg/pc and RM 7.36 |
| `3-M16-undersize-chosen.png` | Undersize chosen from the row's own select: **1.3222 kg/pc**, RM 6.15 |
| `4-M16-fullsize-chosen.png` | Fullsize chosen: the 16mm bar, because it was chosen |
| `5-half-inch-company-rule-undersize.png` | `MS SAG ROD ZP 1/2` — the company rule answers Undersize and the row is weighed, unchanged |

`history/8-half-inch-other-finish-reference.png` — the live case as it should
read: 2 records, Q-2026-0470 (L980) first, labelled *Different finish*, no reuse
button.

### Still open, and not decided here

The part-5 brief said *"1/2 and M12 **may** belong to the same approved diameter
family."* An earlier accepted round states the opposite as a rule. I have not
merged them: the current behaviour is that a half-inch record is offered to
neither an M16 nor an M12, and that is now pinned from both sides, in the PHP
suite and in suite 24. It is a small, well-tested change when you say so — it is
not something to infer from *may*.

The `TWO END STUD` vs Sag Rod schema conflict remains deferred, as instructed.

---

*Round 7 is not declared accepted here. These artifacts are for your review.*
