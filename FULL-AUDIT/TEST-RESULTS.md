# TEST RESULTS

Baseline `f96714e33795e80b581b1d03deb9d04db1d94b8d` → final `97a14cf56bad6414e382c6f49f40d13eabd97dc9`.
Every suite below runs against the **shipped** code:
the browser suites strip one `require` line from `index.php` / `companies.php`,
serve the file over `http://` so localStorage behaves as it does live, answer
`api.php` from a table the test controls, and drive the page in Chromium. No
parser is re-implemented and no answer is re-exported for a test to assert
against itself.

> **On SHAs.** `97a14cf56bad6414e382c6f49f40d13eabd97dc9` is the last commit that changed the
> application, and no test suite has moved since it — it is the ONE SHA every
> number in this package was measured against, and it is the only current
> application SHA any of these documents names. It became the accepted commit
> when PHP 8.1+ MYSQLI EXCEPTION COMPATIBILITY was accepted. Eight application
> SHAs are superseded by it and must never be quoted as current:
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

## By group

| Group | Suites | Assertions | Failed |
|---|---:|---:|---:|
| Browser suites (`node tests/run.js`) | 39 | **3,907** | **0** |
| Pricing-history PHP (`tests/php/pricing_history.test.php`) | 1 | **172** | **0** |
| AI extraction PHP (`tests/php/ai_extract.test.php`) | 1 | **107** | **0** |
| Pricing workbook (`tests/tools/check-pricing-workbook.py`) | 1 | **62** | **0** |
| Translation coverage (`tests/tools/check-translations.js`) | 1 | **15** | **0** |
| Save retry PHP (`tests/php/save_retry.test.php`) | 1 | **42** | **0** |
| mysqli compatibility PHP (`tests/php/mysqli_compat.test.php`) | 1 | **94** | **0** |

## TOTAL

| | |
|---|---:|
| **TOTAL ASSERTIONS** | **4,399** |
| **TOTAL FAILED** | **0** |

| | |
|---|---:|
| Baseline | 2,810 assertions |
| Final | 4,399 assertions |
| Delta | **+1,589 assertions** |

Every one of those is new coverage over a defect this audit reproduced. The
per-round breakdown that used to sit here has been removed rather than
corrected: it mixed absolute totals with increments and no longer reconciled
to anything, and a sum that does not add up is worse than no sum. The commits
are listed one by one in `COMMIT-INFO.txt`, each naming what it added.

**Skipped or environment-limited: none.** Every suite named in the brief ran to
completion and is counted above. The pricing-workbook check takes the workbook
as an argument (`tests/tools/check-pricing-workbook.py
quotation-dnc-final/pricing-engine-v2-input.xlsx`); it was run that way and
passed, and is counted as a pass for that reason and no other.

**On the per-suite logs.** `regression-evidence/*-suite.log` are slices of the
single full-matrix run recorded in `browser-suite.log` — the same run against
the same tree, not separate invocations that might each have seen something
different. Each slice says so in its first two lines.

---

## Browser suites, in full

```
  ok   size normalisation — model, screen and weight agree                              42
  ok   imperial — the first token of a run is the size                                  66
  ok   weight — every product, every input that moves it                                40
  ok   pricing — nothing stale, nothing fabricated                                      49
  ok   pricing history — the rows we sent, and why they differed                       106
  ok   mixed documents — a heading speaks only for its own rows                         37
  ok   save / reload / output — no value drift, no internal costs on the page           65
  ok   bulk fields — a blank never clears an answer                                     61
  ok   dense table — 29 rows, merged cells, metric beside imperial                     170
  ok   engineering drawing — five parts, five lengths, no borrowed dimensions           73
  ok   company rules — a size type with a reason, a diameter with one source            68
  ok   quick add safety — corrections, item numbers, partial extraction                103
  ok   company history — a legacy description reads as words, not as a stored value     51
  ok   accessories — included in the final unit price, breakdown preserved             127
  ok   dimension schema and drawing association                                         71
  ok   quick add — each row's own pricing history, on the row                           86
  ok   quick add layout — every product reachable at every width                       285
  ok   quick add — twenty items, which is the ordinary case                             31
  ok   engineering documents — geometry, merged cells and specification scope          148
  ok   add to quotation — the button at the end of the review                          160
  ok   stainless — SS304 and SS316 carry no finish, on every screen                    119
  ok   materials — four identities, one vocabulary, one answer                         236
  ok   previous price — a recipe, not a number                                          73
  ok   pricing history — whose price is this                                            61
  ok   size type — unknown is not fullsize                                              71
  ok   thread reference — a note about the thread                                      100
  ok   previous price — applied to the items it describes                               79
  ok   quick add — a review screen, not a settings page                                 65
  ok   quantity — fifteen thousand, one, and the ones we must not guess                176
  ok   English / 中文 — the screen, not the dictionary                                   165
  ok   size system — one rod, one diameter, whichever way it was written               132
  ok   responsive — every width the brief names                                         98
  ok   rendered 中文 — the DOM, not the dictionary                                       166
  ok   compact row — the pricing summary, from the row's own state                      54
  ok   fast edit — one state, and everything it holds still                             77
  ok   diameter — the bar the weight is made of                                         94
  ok   roles — Fast Edit, Bulk Edit and Details do not overlap                         109
  ok   phone widths — the scope label, the tap targets, and the desk left alone       102
  ok   save feedback — the button, the value, the region, and the row                  91

  39 suites, 3907 assertions, 0 failed    893.9s
```

---

## Tests added and modified

### Added

**`tests/suites/29-quantity.test.js` — 136 assertions.**
The live message end to end; the spec-header reader over six material spellings
plus the guard case that made it strict; every quantity variant the brief names;
thousands separators in a quantity AND in a dimension; the bare-list boundary;
absent quantity defaulting to one, at the parser, on the review screen and
through the extraction normaliser; and quantity wording with no readable value,
which must NOT default.

**`tests/suites/30-language.test.js` — 165 assertions.**
Switches the language the way the button does and reads the rendered SCREEN, not
the dictionary. Presses real buttons and reads real toasts in 中文. Covers the
Pricing Guide, the Plate and Welding Anchor Set forms, the Companies page and
the Quick Add review. Asserts the trade's vocabulary survives, and that no key
name is ever shown raw.

**`tests/suites/31-size-system.test.js` — 132 assertions.**
Every spelling of an inch size resolving to one bar, fullsize and undersize; the
two fullsize inch tables read against each other; 1/2" and M12 proved to be
different diameters, different weights and different history identities; the
weight of eighteen size / size-type / length combinations recomputed here from
the diameter the app says it is using; the company's own undersize rule at M12
and the half inch; and a product word proved to be a word.

**`tests/suites/32-responsive.test.js` — 70 assertions.**
1920, 1600, 1366, 1280, 1024, 760 and 640. Asserts the document does not scroll
sideways, nothing is pushed past the right edge (ignoring boxes that are
deliberately scrollable), every menu entry is reachable, and the Add button has
a box and is inside the window at every width.

**`tests/tools/check-translations.js` — 12 assertions.**
Static analysis of the shipped source. Reports all four ways a screen can stay
English and holds the deliberate exclusions explicitly.

### Added in the morning repair

Suite 29 grew §10–§12 (55 assertions): the ambiguous quantity refusing to
resolve, the row being blocked from Add All AND from a partial add, the
correction path, and the comma-in-a-length **after** proof whose weight is
computed in the test file from the diameter the app reports.

Suite 30 grew §7–§9 (83 assertions): the item count across 0, 1, 2 and 4 rows
in both directions and with the same language button pressed twice; the saved
quotation's own Edit/Delete controls in one language at a time; and the whole
Companies page in 中文, which is drawn almost entirely from data.

`tests/lib/harness.js` gained a `get_quotation` fixture that returns items as
an ARRAY, the shape the endpoint returns — the previous placeholder was a
string and the Companies renderer could not map over it.

### Added in STAGE 1

**`tests/suites/38-mobile-ui.test.js` — 102 assertions.** The one suite this
round added, and the whole of the round's growth — the thirty-seven suites that
existed before it are unchanged, assertion for assertion, because no behaviour
they cover was touched.

It measures the narrow-width scope control at 430 / 390 / 360 (the APPLY TO
label and its buttons on one row, no horizontal overflow) and at 1440 / 1024 /
820 / 700 / 641 (side by side, the accepted desktop density unmoved), including
the 641 / 640 boundary itself; the Companies controls at phone widths and on a
coarse pointer at 44px or more, and the same controls at exactly their accepted
desk sizes so the fix cannot leak upward; reduced motion still honoured with the
preference actually emulated; item-numbering IDENTITY across Screen, Print and
WhatsApp on a deliberately interleaved quotation, with the three ORDERINGS
recorded rather than changed; and the printed A4 sheet — six columns, the type
scale, the 52mm Description column, tabular numerals, right-aligned money and
Qty, the Grand Total's size and its 2pt rule, a repeating table header, rows
that do not break across pages, one priced row per parent item, `cw 2nut`
carrying no money of its own, and the RM 284.80 total. It also fires
`afterprint` and re-measures the screen, so the print rules are proved unable to
reach the screen UI from the screen side.

### Added in UI POLISH 2A

**`tests/suites/39-save-feedback.test.js` — 91 assertions.** The one suite this
round added, and the whole of its growth — the thirty-eight suites before it are
unchanged, assertion for assertion.

It measures the success sequence on the real Save dialog (compress → `res.ok` →
check → value pulse → toast → ~500ms confirmation → normal); the in-flight
guard, by clicking four times inside one held request and counting **one** POST;
the failure path, sampled inside the page every 12ms so "no success visual ever
appeared" is a measurement rather than an absence of looking; that the guard is
released so a retry after a failure is allowed through; a second legitimate save;
one toast per save; the ~500ms window measured from the running page rather than
read off the stylesheet; **both confirmation semantics** — the quotation-level
region with no item row singled out, and the exact rule row with its neighbours
clean; a failed rule save marking nothing; reduced motion with the preference
actually emulated; and **the save payload asserted key for key** against the
accepted shape.

### Modified

**`tests/suites/26-thread-reference.test.js` — 87 → 100.**
Thirteen assertions for the context-sensitive placeholder: metric, the one
imperial size with an approved series, every other imperial size, that it
follows a size corrected on screen, and that 中文 keeps the codes.

**`tests/lib/harness.js`.** Added `openCompanies` / `buildCompaniesPage`, which
serve `companies.php` by the same rule as `index.php` and from the same origin —
so the language choice stored by one page is already in force when the other
paints, which is the behaviour under test.

---

## Static checks

| Check | Result |
|---|---|
| `php -l` over every PHP file | clean |
| Translation coverage | 862 keys, 100%, 0 bypassing `dcT`, 0 unapplied hooks |
| Rendered 中文 DOM | 12 states scanned, 0 English runs outside the trade allowlist |
| Browser console errors | asserted per-page in suites 30, 31 and 32 (`page._dcErrors` empty at every viewport) |
| Pricing workbook contains no business values | 62 assertions, clean |

---

## Fidelity — what these tests are worth

The brief asked whether the fixtures could lie. Three notes:

1. **The pricing-history screenshots are not fixed answers.** `api.php` is
   answered with stored records; the MATCHER inside the page decides what is
   reusable and what is reference-only. A screenshot of a prepared answer would
   prove nothing, so none is used.

2. **Weight is computed independently.** Suite 03 and the new suite 31 both
   compute π/4 × d² × L × 7.85e-6 in the test file and compare it to what the
   shipped calculator produced. Suite 31 reads the diameter the app says it is
   using and recomputes from that, so a wrong table entry surfaces as a wrong
   diameter rather than hiding inside a self-consistent answer.

3. **The translation suite reads the DOM, not the dictionary.** This is the
   distinction the whole translation finding turns on: the dictionary read 100%
   translated at baseline while 129 strings were English on screen.

One fixture was corrected this run: `tests/lib/harness.js`'s `rowState` was
already reading through the production helpers, and no test was found that
hard-codes an answer the production path does not produce.
