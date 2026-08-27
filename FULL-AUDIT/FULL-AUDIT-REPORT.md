# FULL AUDIT REPORT — QUOTATION.DNC

Overnight autonomous full-system audit and repair loop, the morning repair that
closed what external review found, and the final closing repair that read the
RENDERED screen rather than the source.

Baseline `f96714e33795e80b581b1d03deb9d04db1d94b8d`
Final application SHA `649f80a09f83a7201c0f3772e01fc270ccda3e05` · **ACCEPTED, NOT DEPLOYED** — production still runs the previous accepted commit, named in docs/control/CANONICAL-STATE under `production`.

**P0 0 · P1 13 · P2 24 · P3 2 — 39 findings, all repaired.**
**4,734 assertions, 8 failed, 0 skipped** — the eight are the recorded
`38-mobile-ui` environment exception, not an application fault.

Read `EXECUTIVE-SUMMARY.md` first if you have five minutes.
`FINDINGS.md` has every defect with its root cause and its regression.
`BUSINESS-DECISIONS-NEEDED.md` has the two questions still open, and the four
that have since been decided.

> **On SHAs.** `649f80a09f83a7201c0f3772e01fc270ccda3e05` is the last commit that changed the
> application, and no test suite has moved since it — it is the ONE SHA every
> number in this package was measured against, and it is the only current
> application SHA any of these documents names. It became the accepted commit
> when ITEM IDENTITY FOUNDATION was accepted. Ten application
> SHAs are superseded by it and must never be quoted as current:
> superseded — `e76bb85d663f96fdce3ed6c0c70b72c49d84000a`, accepted for ACTOR IDENTITY FOUNDATION;
> superseded — `97a14cf56bad6414e382c6f49f40d13eabd97dc9`, accepted for PHP 8.1+ MYSQLI EXCEPTION COMPATIBILITY;
> superseded — `86cf2629a66434bf3bdffe2efc0acbe527c358ac`, accepted for API 1062 DUPLICATE RETRY HARDENING;
> superseded — `6bb5772475e06925f6c2ac8237099fcf0c61c3b7`, accepted for QUICK ADD STABILITY;
> superseded — `cf92f27feb629134a61801dc120eba79c54fb5f6`, accepted for UI POLISH 2A;
> superseded — `3e89713400b5bcfceca31d2c074de17411169d1b`, accepted for STAGE 1;
> superseded — `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac`, accepted for STAGE 0B;
> superseded — `33ae0da14a3bd3108e8b066d4796b1bcda2de428`, accepted for UI POLISH 2;
> superseded — `e3d659bba1636cd4cfc74cb89be1b52cf92aff67`, accepted for UI POLISH 1;
> superseded — `7f5bc977197a658d6d4db995ee2c9bb5e106e21b`, accepted before that round.
> The commits after the
> application one write this package, and a report cannot name the commit it is
> inside without changing it; the exact HEAD the archive was built from is
> recorded in `MANIFEST/MANIFEST.txt`, which is generated at build time and is
> not committed.

---

## 0 · Safety

| | |
|---|---|
| Deployed | **No.** |
| Production data touched | **None.** Every test drives the shipped code against a controlled `api.php` in a local Chromium. No live database was read or written. |
| Destructive operations | None. |
| Pre-existing failures hidden | None — the baseline was green (2,810 assertions) and is recorded. |
| Pricing engine | **Untouched.** The pricing formula, Auto Round, the weight formula, Cost Rate, Additional Cost, Markup and Previous Price are byte-for-byte unchanged this round. M24 x 1000 · 3.5513 kg/pc · rate 2.80 · additional 0.60 · markup 4% still answers **RM 10.97**, and the evidence run fails loudly if it ever stops doing so. |
| Tests skipped or environment-limited | None. Every suite the brief names ran to completion. |
| Assertions weakened to get green | None. Five suites were added and one extended; nothing was relaxed. Three suites failed after the closing repair because a label key was chosen wrongly; the KEY was corrected, not the assertion. |
| Working tree at final commit | Clean. |

---

## 1 · How the loop ran

For each finding: reproduce against the shipped code → write a failing
regression that states the expected behaviour → find the root cause → make the
smallest repair that removes the cause → run the focused suite → run the full
matrix → capture evidence → re-audit the surrounding area.

Each commit is a coherent group of repairs with its own regression; they are
listed in `COMMIT-INFO.txt`, which is the one place a count belongs. One of
them is the morning repair, driven by external review rather than by the
audit's own checks — which is itself a finding, recorded as F22.

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

Suites 05 (106), 16 (86), 23 (73), 24 (61), 27 (79) and the PHP suite (172),
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

The priority deliverable. **862 keys, 100% translated, nothing bypassing the
translator, and no element relying on a hook that nothing applies**.
That is up from 512 keys with **129 strings that never reached it**, then a further ~210 the
overnight checker could not see, then 36 more and 63 unapplied hooks that the
morning one could not see either. The last of those were found by reading the
RENDERED screen, which is the only check that measured anything on a screen.
See §34, §35, F17–F22 and F25–F29.

The rendered-DOM suite has now found something a source scan could not on
three separate rounds. The third: a pricing note telling a Chinese reader that
"Auto Round 与 No Round" items recompute, while the two buttons below it read
自动进位 and 不进位 — a sentence naming controls by names they do not have on
that screen; and a history count line assembled by concatenation, so "N this
customer, N other" stayed English although both halves already had keys.
Suite 33 now also scans the surfaces this round added: Details, the row ticks,
the selected count, the scope switch, the refusal, and Fast Edit — each after
four language switches, because a re-render is where a label goes missing.

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
Add button has a box and sits inside the window. All green. Suite 17 (284
assertions) already covered every product being reachable at every width.

**The selection ticks were measured at all seven, not counted.** Adding a
column is exactly the change that quietly costs a narrow layout its last usable
width, so at each one the suite asserts that every row still carries its tick,
that no tick is under 12×12 (which is a control nobody can aim at), that none
is pushed past the right edge, and that the row list itself does not scroll
sideways. Frame R16 does the same at 1366 with twenty items on screen and
prints the measurement it checked.

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

**Ambiguous Qty was the morning's P1.** `qty 100 / 200` took the first number,
gave the leftover to a phantom row, and left the real item to fall through to
the absent-quantity default — so a count nobody could read became a confident
**1**. Nothing is read now: the line is refused whole, the item asks by name,
and neither Add All nor a partial add can take it. Evidence:
`after-fix/33-ambiguous-qty-needs-qty.png`.

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

* `screenshots/` — 96 frames, plus `INDEX.txt`. The first 32 are the set the
  overnight brief asks for; 33–38 are the morning repair; **A–F** are the six
  the closing brief names, each captured from a page proved empty first;
  **P01–P12** are the UI-polish set; **E01–E13** are Fast Edit and the diameter
  contract; **R01–R17** are the workflow polish round — twenty items with their
  ticks and DIA cells, the renamed row action, one Details open, Fast Edit over
  every row, the three Bulk Edit sections one at a time, four selected, a
  pricing change landing on those four alone, the refusal when none are
  selected, History with its sticky header and loaded count, the same three
  surfaces in 中文, 1366px with the ticks added, and Escape restoring both a
  diameter and its provenance. **C01–C09** are the closing repair and the
  overnight audit — the Selected apply naming its four rows in both languages,
  the All Items apply where "all items" is honest, both accessory actions
  refused over an empty selection, Expanded with no Close that could not close,
  a Previous Price card dropped when the identity moved under it, an inline
  ambiguous quantity refused, NO3 / NO5 read as item numbers rather than
  lengths, and an unrecognised size showing no bar at all.
* `before-fix/` — six frames from the baseline commit, same inputs.
* `after-fix/` — the matching set, 46 frames.
* `regression-evidence/` — the full-matrix log, the per-suite slices taken from
  it, and the PHP and checker logs.

**Frames that state a figure assert it.** E04, E05, E06, E09, E10, F and
R01–R17 print what they claim and throw if it moves — R09 fails unless a bulk
markup moves exactly the four selected rows and no others, and R17 fails unless
Escape returns both the 10.6 and the word Default. R10 was tightened after it
passed while the refusal text was empty: it now asserts the sentence, not only
the disabled button.

**TOTAL ASSERTIONS 4,734 · TOTAL FAILED 8 · SKIPPED 0.**

Every log the package claims exists is in `regression-evidence/`, and the list
below was checked against the directory rather than written from memory:
`browser-suite.log` (and `.json`), `pricing-history-php.log`,
`ai-extract-php.log`, `pricing-workbook.log`, `save-retry-php.log`,
`mysqli-compat-php.log`, `item-identity-php.log`,
`translation-coverage.log` (and
`.json`), `php-lint.log`, `responsive-matrix.log`, `quantity-suite.log`,
`language-suite.log`, `rendered-i18n-suite.log`, `row-meta-suite.log`,
`edit-mode-suite.log`, `diameter-suite.log`, `roles-suite.log`.
**Nineteen files, nineteen claims.** The per-suite logs are slices of the single
full-matrix run in `browser-suite.log` — the same run against the same tree,
not separate invocations that might each have seen something different — and
each says so in its first two lines.
An earlier draft named a `final-re-audit.log` that had been superseded; the
browser-suite log IS the final run and there is no longer a claim to a file that
does not exist.

---

## 33 · Final re-audit

After all repairs the full matrix was re-run from a clean tree, and Quick Add,
pricing, weight, Previous Price, Companies, save/reopen, English, 中文,
print/WhatsApp, SS304/316, 8.8/10.9, Qty and Thread Reference were each
re-exercised. The browser matrix now runs 40 suites and 3,936 assertions, of which 8 fail on
the recorded environment exception and 3,928 pass; 4,734 across everything.

Two defects were caught by re-checking rather than by a test, and both are worth
naming because both were self-inflicted:

* the bulk-edit tooling converted `index.php` and `companies.php` from CRLF to
  LF, which would have made the diff a whole-file rewrite. Restored, and line
  endings are now checked before every commit;
* a key written as `{n} record(s)` broke a suite that asserts real English
  ("6 records"). Pluralised properly rather than weakening the assertion.

## 34 · What the audit's own checks did not catch

The overnight round reported a green translation checker while the Quick Add
column headers, its row buttons, its panel labels and almost the whole
Companies page were still English in 中文, and while a language switch could
wipe the item count to 0 项 with two rows on screen.

That is recorded as F22, at the same severity as the leaks it hid, because a
check that passes while the defect is visible is worse than no check: it
converts "not looked at" into "looked at and fine".

It then happened a second time. The hardened checker reported green while the
Companies helper line, the accessory warning and the saved quotation's own Qty
and Unit were still English on the screen — recorded as **F26**.

---

## 35 · The closing round, and why it needed a different kind of check

Both false-greens have one cause, and it is worth stating on its own because
every source-reading check in this project got it wrong in the same way.

`dcApplyLang()` is an attribute scan over the document **as it stands**. It
runs, it finishes, and it does not come back. Markup a renderer builds
afterwards keeps whatever the template wrote into it, in whatever language the
template wrote it, for as long as the element lives. So a `data-i18n` on
generated markup is not a hook — it is a note to nobody. Sixty-three elements
were built that way, and every check in this repository read them as translated.

No amount of source reading fixes that, because whether a hook is ever applied
depends on WHEN the element came into being. So the closing round added a check
that reads the other end: `tests/lib/dom-i18n.js` switches the application to
中文, walks twelve reachable states, collects every visible run of text and
every visible placeholder, title, aria-label and alt, subtracts ONE explicit
table of trade vocabulary, and reports what is left.

The table is the whole design. It holds material codes, sizes, finishes, product
names, units and registered entities — and no verbs, and no prose. "the", "is",
"to", "please", "select", "never", "automatically" are not in it and never will
be, so no English sentence can pass it. Adding a word to it is a visible edit to
a short list; a pattern like "allow anything capitalised" would have swallowed
whole sentences silently.

Its first run found **thirty-eight** leaks on a screen the previous round had
signed off as fully translated — including all four the review had named by
hand — and one defect that is not about language at all: ten of the eleven
product forms lost their Price Mode control when the application opened in 中文,
because the injector looked its anchor up by the English word "Pricing" (F25).

The source checker learned the same rule afterwards, so it now catches the cause
as well as the screen catching the symptom: inside a `<script>`, a `data-i18n`
is not a hook unless the element also resolves through `dcT`. It also reads
whole STATEMENTS rather than one literal after an `=`, which is how seven
`confirm()` dialogs, a dozen ternaries, four side-by-side `'Locked / 已锁定'`
pairs and an object literal of price-mode labels had stayed English (F27).

### The evidence, and the number that looked wrong

One screenshot in the previous package printed **RM 24.42** where manual
verification says **RM 10.97**. The pricing engine was not at fault and has not
been changed. The frame typed 6.20 and 2.40 into the row — values borrowed from
the pricing-history helper further up the same file, where they exist so a
stored record differs visibly from a fresh calculation — and 3.5513 kg × 6.20 +
2.40 is 24.4179 exactly. The arithmetic was right; the FIXTURE was uncontrolled,
so the evidence was unreadable.

Three changes, none of them to pricing:

* every pricing frame now types the verified rates — 2.80, 0.60, 4% — the way a
  person does, into the real inputs. Calling `wqaEditPrice()` from a script set
  the state and recomputed but deliberately did not write the value back into
  the box (that is correct: overwriting a box somebody is typing in would move
  the caret), so the frame had shown "Markup 0" beside a price that included 4%;
* every evidence page proves its storage is empty before it captures anything,
  and throws by name if it is not;
* frame F states the whole calculation on one screen and **fails the run** if
  the answer is not RM 10.97.

---

## 36 · UI copy: what the Quick Add entry is called, and where its scope lives

Two things were wrong with the homepage entry, and neither was a translation
defect — both strings were already under `dcT` and already translated.

**It was called "WhatsApp Quick Add".** A photograph, a screenshot, a drawing
and a PDF all go through the same door, and have since v2.23; the name said
otherwise. The homepage entry is now **Quick Add** / **快速添加**, and its
subtitle says what actually goes in: *Paste customer text or upload image / PDF*
/ *粘贴客户文字或上传图片 / PDF*. It has its own key, `wqaOpenTitle`, rather
than sharing the modal's `wqaTitle` — the two are no longer the same words, and
a shared key would mean neither could be changed on its own.

**It named three products, and the parser reads five.** The button said
"Sag Rod / Stud / Anchor Bolt"; `WQA_PRODUCTS` holds Sag Rod, Stud, Anchor Bolt,
**L Bolt and J Bolt**. Two of the five were being under-sold on the front page.

The scope no longer lives on a button. It lives once, inside the modal, beside
the box it describes, and it is complete:

> Paste the customer's WhatsApp message. Sag Rod · Stud · Anchor Bolt · L Bolt ·
> J Bolt are read.
>
> 粘贴客户的 WhatsApp 信息。可识别 Sag Rod · Stud · Anchor Bolt · L Bolt · J Bolt。

Suite 33 §2b asserts the list against **`WQA_PRODUCTS` itself**, not against a
copy of it — so teaching the parser a sixth product and forgetting the hint
fails the suite rather than shipping a quiet inaccuracy. It also asserts that
the homepage entry names no product at all, in either language.

---

## 37 · The three editing mechanisms, and the overlap between them

A Quick Add row can be written to from three places. The polish round's finding
was that the boundaries were not merely blurred in the UI — they were crossed
in the naming.

| | writes | shape |
|---|---|---|
| **Fast Edit** | many rows, **different** values | a spreadsheet |
| **Bulk Edit** | many rows, **one shared** value | a stamp |
| **Details** | one row, everything about it | a form |

**Two controls said "Edit".** The toolbar's opened a grid over every row; the
row's opened a form over one. The row action is **Details / 详情** now, reading
**Close / 关闭** while open, and `btnEdit` stays where it was — Diameter
Settings, the quotation items and Companies all use it and all still mean Edit.
A quiet `VIEW` label sits in front of Compact/Expanded so Edit stops reading as
a third tab in a group it was never part of.

**The two Bulk Edit panels had each other's names.** This is worth stating
plainly, because the brief for this round described them the other way round
and the code disagreed with the brief:

* `wqaCommonFix`, titled **"Correct Items"**, held Product, Material, Finish and
  Size Type — one value stamped across many rows, which is the definition of a
  bulk field, and exactly the list the brief assigns to "Common Item Fields".
* `wqaCommonItem`, titled **"Common Item Fields"**, bulk-edited **Size and TL** —
  geometry, which belongs to Fast Edit.

So the names were put on the right panels rather than the panels rearranged to
fit the labels.

**The geometry panel was not deleted, and here is the documented reason.** The
brief asks for no second place to bulk-edit geometry "unless there is a specific
existing business rule that absolutely requires it", and allows the exception if
it is documented instead of silently kept. There is one. A shorthand document
routinely states lengths and quantities and states neither the size nor the
thread:

> 1068 - 38pcs / 1430 - 148pcs / 1295 - 34pcs / under size / ZP

The extractor is deliberately forbidden from inventing either — a guessed M12
would be silently wrong on every row — so thirty rows arrive with the same two
blanks, and typing M12 thirty times is not a workflow. The exception is confined
three ways: it is titled **Fill Missing Size / TL** rather than claiming the
generic name, it fills blanks and never overwrites a stated value, and it is
**not rendered at all** unless rows are actually missing one. When nothing is
missing — the ordinary case — Bulk Edit is exactly the three shared-value
sections and this panel is not on the screen. Suite 37 asserts both halves.

**Sections open one at a time**, so Bulk Edit can no longer grow taller than the
items it exists to correct.

**Selection became a set a person owns.** Every row carries a tick from the
start rather than only once the scope says "Selected" — the old order asked you
to promise to use a selection before you could make one. The header takes or
releases the whole list, the count rides on the Bulk Edit heading, and the ticks
**survive the scope switch**: they used to be wiped by it, so comparing "all"
against "these four" cost you the four by looking. Scope "Selected" with nothing
selected now **refuses** — the Apply is disabled and says *Select at least one
item.* / *请至少选择一个项目。* — rather than quietly widening to every row,
which is how twenty items get a markup meant for four.

**No two write surfaces at once.** Opening Details closes Bulk Edit and the
reverse; Fast Edit outranks both, and freezes the ticks while it is open because
the selection decides where a *bulk* apply lands.

Four defects came out of this work and are recorded as F30–F33. F30 was reported
by external review; F31 and F32 were found while separating the mechanisms; F33
was found by the rendered-DOM 中文 suite rather than by reading source, which is
the third time that suite has found something a source scan could not.

---

## Recommendation

**READY FOR REVIEW — NOT READY TO DEPLOY.**

Two things need a person before this ships: the new Chinese strings need a
native speaker, and two questions need a business answer — whether Quick Add should
learn the other six products, and whether the diameter tables' missing M6/M14
fullsize bars are intentional. Four earlier questions have since been decided
and are no longer counted as open.

The quantity-range wording ("50 to 80") reads as an unreadable count and the row
says Needs Qty. That is deliberate and shipped; it is a possible enhancement, not
a deployment blocker, and is not counted among the two.

**ROUND STATUS: WAITING FOR NICHOLAS / CHATGPT REVIEW — NOT DEPLOYED**
