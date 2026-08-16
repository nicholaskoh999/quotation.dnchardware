# FULL AUDIT REPORT — QUOTATION.DNC

Overnight autonomous full-system audit and repair loop.
Baseline `f96714e` → final `8e1bfff`. **NOT DEPLOYED.**

Read `EXECUTIVE-SUMMARY.md` first if you have five minutes.
`FINDINGS.md` has every defect with its root cause and its regression.
`BUSINESS-DECISIONS-NEEDED.md` has the six questions that were not guessed at.

---

## 0 · Safety

| | |
|---|---|
| Deployed | **No.** |
| Production data touched | **None.** Every test drives the shipped code against a controlled `api.php` in a local Chromium. No live database was read or written. |
| Destructive operations | None. |
| Pre-existing failures hidden | None — the baseline was green (2,810 assertions) and is recorded. |
| Assertions weakened to get green | None. Four suites were added and one extended; nothing was relaxed. |
| Working tree at final commit | Clean. |

---

## 1 · How the loop ran

For each finding: reproduce against the shipped code → write a failing
regression that states the expected behaviour → find the root cause → make the
smallest repair that removes the cause → run the focused suite → run the full
matrix → capture evidence → re-audit the surrounding area.

Three commits, each a coherent group of repairs with its own regression.

---

## 2 · Priority Zero — the known live follow-up

### 2.1 The quantity continuation line

The reported message, and what it produced at baseline:

```
4140 sag rod, both thread 65mm, plain
M24 x 300mm x tl 65/65
qty - 15,000 pcs
```

**Two** rows, neither with a quantity. Two separate defects, both P1:

* The first line is a spec header — no size, no count — but `4140` is a number
  as well as a material, and the header reader counted it. Two numbers meant
  "not a thread line", so the header became a phantom rod 65 mm long. The reader
  had drifted from `wqaExtractFields`, which counts the same line correctly
  through `wqaStripSpecWords`; it now uses that same helper.
* `15,000` matched `\d+` up to the comma. The variants behaved three different
  ways: `qty 15000` attached, `qty 15,000 pcs` produced a phantom row carrying
  `qty 15`, and `15,000 pcs` attached nothing.

**Now** — one item: Sag Rod · 4140 QT · PL · M24 · 300 · TL 65/65 · **Qty 15000**.
Every variant the brief names attaches: `qty 15000`, `qty - 15000`, `qty: 15000`,
`qty = 15000`, `qty 15,000 pcs`, `qty - 15,000 pcs`, `15,000 pcs`, `15000 pcs`.
A bare standalone number still attaches to nothing.

*Evidence* `before-fix/03-*.png` → `after-fix/03-*.png`. *Regression* suite 29.

**The same comma was worse in a dimension.** `M24 x 1,000` was read as a rod
**1 mm long** with a quantity of 0, weighing 0.0036 kg, priced at **RM 0.60**,
complete and addable with nothing on screen to say so. This was not in the brief;
it was found while repairing the quantity. *Evidence*
`before-fix/A-comma-in-a-length.png`.

The rule is not new. The calculator's own number boxes have always read `1,200`
as twelve hundred, asserted by suite 04 since before this audit. The parser
disagreed with the calculator; it now agrees. A line that is nothing but
comma-separated numbers is left alone — the one place a comma really does
separate values.

### 2.2 The final Qty default rule

Applied in `wqaNormalizeExtraction`, the single funnel a pasted message, a
photograph, a PDF and a drawing all pass through, so all four give the same
answer. The distinction is the whole rule:

| the source says | result |
|---|---|
| nothing about quantity | **Qty 1**, shown as a default |
| quantity, unreadably (`qty tbc`, `qty ?`, `qty:`) | blank, and the row asks by name |
| an explicit quantity | that quantity, always |
| an explicit `0` | `0` — a stated value, refused in the ordinary way |

`M12 x 500` alone → Qty 1. Three independent lines → 1 each. A stated 40 beside
an unstated one → 40 and 1.

A related defect surfaced: a digit-less `qty tbc` line was classified as noise
and thrown away with the greetings, so the row above it looked like an item
nobody had stated a count for. The word is now the signal; the missing number is
the point.

*Evidence* `before-fix/04-*.png` → `after-fix/04-*.png`.

### 2.3 The Thread Reference placeholder

One fixed hint, `1.75P · UNC · BSW`, on every row — so an M12 was offered a
choice between two imperial thread series. The READING rule was already correct
(only 1/2" gets a series attached). Now context-sensitive by size: `e.g. 1.75P`
on metric, `UNC / BSW` on 1/2", `Optional reference` on every other imperial
size — and it follows the size when the size is corrected on screen.

---

## 3 · Material and finish rules — verified, unchanged

All 41 spellings checked from the parser through to the review screen. **No
defects.**

`8.8` · `G8.8` · `Grade 8.8` · `GR 8.8` · `HT8.8` · `HT 8.8` · `class 8.8` ·
`high tensile 8.8` → **4140 QT**.
`10.9` and its equivalents → **4340 QT**.
`A2` · `A2-50` · `A2-70` · `SUS304` · `SS304` · `S/S 304` · `AISI 304` ·
`stainless steel 304` · `304 SS` → **SS304**.
The `A4` / `316` family → **SS316**. Stainless carries **no finish**; PL, ZP and
HDG are refused on it.
A bare `HT`, `high tensile`, `stainless`, `SS` or `S/S` names no material and
the row asks — 8.8 and 10.9 are both high tensile and choosing between them
would be a guess.
`MS` stays `MS`.

Covered by suites 21 (119) and 22 (236), both green.

---

## 4 · Size system, diameter and weight

**Three defects found, all repaired.** See FINDINGS F2, F4, F5, F6.

* `1/2"` and `M12` are 12.7 mm and 12.0 mm — different bars, different weights
  (0.9944 vs 0.8878 kg/m), and different history identities. Proved, not
  assumed.
* Every spelling of an inch size now resolves to one bar, fullsize AND
  undersize. `1 INCH` used to be worth 25.4 mm fullsize and nothing undersize.
* An unknown size type gives no diameter, no weight and no price, and the row
  says which question it is; answering it recalculates immediately.
* A size the tables do not hold (`2"`, `9/16`, `M17`) is never silently replaced.
* **The weight of eighteen size / size-type / length combinations was recomputed
  in the test file** — π/4 × d² × L × 7.85e-6 — from the diameter the app says
  it is using, and compared. All agree.
* The company's own rule that mild steel is drawn **undersize at M12 and at the
  half inch** is deliberately not what a general engineering table says, and it
  is preserved and asserted.
* Seven inch sizes live in two diameter tables. They agree; suite 31 now reads
  both and compares them so they cannot drift apart unnoticed.

---

## 5 · Thread Reference

Reference metadata only, and it stays that way. Suite 26 (100 assertions)
asserts that the pitch and the series reach the note and **nothing else** — not
the size, the diameter, the weight, the price, the material, the finish, the
size type, the Previous Price identity or the history ranking. `M12 x 300` is a
length, not a pitch. Persistence through Quick Add → edit → Add → save → reopen
holds. It does not reach customer output, and none was added.

---

## 6 · Quick Add

**Products.** The application exposes eleven; Quick Add reads five (Sag Rod,
Stud, Anchor Bolt, L Bolt, J Bolt). Before this run, two of the other six were
read as something else — L Bolt 45DEG and Others / Special Bolt both became
plain L Bolts with an L Bolt's geometry and price. Both are fixed. The remaining
four (U-Bolt, SQ U-Bolt, Plate, Welding Anchor Set) were already safe: they
reach Review unread rather than being misread. Suite 31 §7 now pins all of this,
so a future alias cannot quietly capture one.

**Everything else** — multiline items, continuation lines, headers and notes,
dimensions, TL, H/S/ID, accessories, material, finish, size type, pricing
fields, partial parsing, incomplete items, Add, partial Add, Edit, Compact,
Expanded, remove row, bulk selection, bulk edit, history, modal scroll,
reopening — is covered by suites 06, 08, 09, 12, 15, 16, 17, 18, 20, 27 and 28
(1,300+ assertions), all green. This run added breadth where it found gaps
rather than re-deriving what was already proved.

---

## 7 · Engineering drawings and dimension chains

Suites 10 (73) and 19 (148), green. Overall length, thread length, bend radius,
inside dimension, pitch, diameter, quantity, drawing notes, material and coating
callouts are each read as themselves; a bend radius is not an inside diameter
and a note is not a dimension. No new defects found in this area.

---

## 8, 9 · Previous Price and bulk apply

Suites 05 (105), 16 (85), 23 (73), 24 (61), 27 (79) and the PHP suite (161),
all green. Identity requires the same product, material, finish, size type and
size. Different geometry reuses the RECIPE and reprices from the current row's
own weight. A different finish is reference only, with no reuse button.
Incompatible rows are disabled with the reason on them. Imperial history —
1/2, 3/8, 5/8, 3/4, 7/8, 1-1/4, 1-1/2 — and LIKE-wildcard escaping for `%` and
`_` remain covered by `tests/php/pricing_history.test.php`. No new defects.

---

## 10–19 · Pricing engine, accessories, quotation flow, companies, defaults,
diameter settings, calculator, guide, versions, output

Audited through the existing suites and targeted probes; **no new defects
found**, and the existing coverage is substantial and green: pricing state
leakage (suite 04, 47), accessories kept beside the bolt and never inside it
(suite 14, 41), save/reload/output with no value drift and no internal costs on
the page (suite 07, 65), company rules and diameter sources (suite 11, 68),
company history (suite 13, 40).

The Pricing Guide and the two unmigrated product forms were found untranslated —
see §20 — but functionally correct.

---

## 20 · English / 中文

The priority deliverable. **658 keys, 100% translated, nothing bypassing the
translator**, up from 512 keys with **129 strings that never reached it**.

Full detail in `TRANSLATION-AUDIT.md`, including the list of what is
deliberately not translated and why, and the caveat that the new Chinese strings
are first-pass and need a native speaker.

---

## 21, 22 · UI/UX and responsive

Suite 32 (new, 70 assertions) runs the seven widths the brief names — 1920,
1600, 1366, 1280, 1024, 760, 640 — and asserts at each one that the document
does not scroll sideways, nothing is pushed past the right edge (boxes that are
deliberately scrollable excepted, which is how a wide item list is meant to
behave), every menu entry is reachable or has the control that opens it, and the
Add button has a box and sits inside the window. All green. Suite 17 (280
assertions) already covered every product being reachable at every width.

No brand changes. No new motion was added, so `prefers-reduced-motion` has
nothing new to honour.

One cosmetic observation, not repaired: at 中文 the product-type buttons for
"Welding Anchor Set" and "Others / Special Bolt" wrap onto three lines and sit
slightly taller than their neighbours. Legible and reachable; noted rather than
changed, since P3 work must not destabilise the app.

---

## 23, 24 · Persistence and stale state

Suite 07 (65) covers create → save → reload → reopen with no value drift. Suite
04 (47) hunts stale pricing state between rows. Suite 16 (85) covers a history
panel open while a row's identity moves, and the use-time guard that stops a
stale record reaching a row that has changed under it. All green; no new
defects.

Older quotations without the newer metadata reopen safely — Thread Reference and
`qtyUnreadable` are read with `||''` / `!!` defaults throughout, so an absent
field is an absent field and not an error.

---

## 25 · Error, empty and edge states

Absent Qty, ambiguous Qty, zero Qty, comma Qty, very large Qty, missing
material, missing size type, missing size, unsupported input, no history, failed
history request, partial parse, mixed valid and invalid items — all covered, and
several improved this run. Nothing invalid is silently converted into a
plausible valid quotation: the comma defects were exactly that failure mode and
they are gone.

---

## 26 · Security and data safety

* **SQL** — `api.php` uses prepared statements with `bind_param` throughout via
  `prepare_or_fail`. The few interpolated queries take server-controlled values
  only (`date('Y')`, a literal prefix, a table name escaped with
  `real_escape_string`). `pricing_history.php` returns `?` placeholders and
  params. **No injection vector found.**
* **XSS** — one finding, repaired: the Companies page wrote a quotation
  reference into `innerHTML` unescaped. Everything else scanned goes through
  `escHtml` / `esc`, both of which escape `& < > " '`.
* **Secrets** — none committed. `ai_config.php` and `db.php` are gitignored and
  present only as `.sample.php`.
* **Destructive GET** — none found; deletes go through POST handlers.
* **Debug output** — the U-Bolt debug panel is behind a toggle and internal-only;
  it does not reach customer output.

No aggressive testing was performed and none was needed to find the above.

---

## 27 · Duplication

Three drifted duplicates were found, and two were removed rather than
documented:

* `wqaThreadOnlyValue` re-derived a line's numbers instead of using
  `wqaStripSpecWords`, which is what caused the phantom-item defect. **Removed.**
* The parser's number reading disagreed with the calculator's on thousands
  separators. **Reconciled** — one rule, in `wqaNorm`.
* Seven inch sizes live in two diameter tables. **Kept, and now guarded by a
  test** — merging them is a refactor with no behavioural benefit today, and an
  audit is the wrong time for it.

---

## 28 · Test quality

The suite drives the shipped code, not a re-export of it. Three specific
fidelity points are recorded in `TEST-RESULTS.md`: the pricing-history evidence
uses the real matcher rather than a prepared answer; weight is computed
independently in the test file from the diameter the app reports; and the
translation suite reads the rendered DOM rather than the dictionary — which is
the distinction the entire translation finding turns on, since the dictionary
read 100% while 129 strings were English on screen.

No test was found that hard-codes an answer the production path does not
produce. Where a defect existed despite green tests, the new regression is at
the layer that would have caught it.

---

## 29–32 · Evidence, test matrix, severity

* `screenshots/` — the 32 frames the brief asks for, plus `INDEX.txt`.
* `before-fix/` — six frames from the baseline commit, same inputs.
* `after-fix/` — the matching four.
* `regression-evidence/` — every suite's own log, plus the JSON.

**TOTAL ASSERTIONS 3,200 · TOTAL FAILED 0.**

---

## 33 · Final re-audit

After all repairs, the full matrix was re-run from a clean tree, and Quick Add,
pricing, weight, Previous Price, Companies, save/reopen, English, 中文,
print/WhatsApp, SS304/316, 8.8/10.9, Qty and Thread Reference were each
re-exercised. Green. One late defect was caught by that re-audit and fixed: two
files had had their line endings converted from CRLF to LF by the tooling used
for the bulk translation edits, which would have made the final diff
unreviewable. Restored, and the diff is 1,867 insertions over 7 files.

---

## Recommendation

**READY FOR REVIEW — NOT READY TO DEPLOY.**

Two things need a person before this ships: the new Chinese strings need a
native speaker, and six questions need a business answer — chief among them
whether the printed quotation a CUSTOMER receives should follow the operator's
language.

**ROUND STATUS: WAITING FOR NICHOLAS / CHATGPT REVIEW — NOT DEPLOYED**
