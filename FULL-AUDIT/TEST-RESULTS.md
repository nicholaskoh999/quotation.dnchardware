# TEST RESULTS

Baseline `f96714e33795e80b581b1d03deb9d04db1d94b8d` → final `dd15663cc391546ae4cac34026b00e23cd083358`.
Every suite below runs against the **shipped** code:
the browser suites strip one `require` line from `index.php` / `companies.php`,
serve the file over `http://` so localStorage behaves as it does live, answer
`api.php` from a table the test controls, and drive the page in Chromium. No
parser is re-implemented and no answer is re-exported for a test to assert
against itself.

> **On SHAs.** `dd15663cc391546ae4cac34026b00e23cd083358` is the last commit that changed the
> application or its tests — it is the ONE SHA every number in this package was
> measured against, and it is the only application SHA any of these documents
> names. The commits after it write this package, and a report cannot name the
> commit it is inside without changing it; the exact HEAD the archive was built
> from is recorded in `ZIP-MANIFEST.txt`, which is generated at build time and
> is not committed.

---

## By group

| Group | Suites | Assertions | Failed |
|---|---:|---:|---:|
| Browser suites (`node tests/run.js`) | 33 | **3,105** | **0** |
| Pricing-history PHP (`tests/php/pricing_history.test.php`) | 1 | **161** | **0** |
| AI extraction PHP (`tests/php/ai_extract.test.php`) | 1 | **107** | **0** |
| Pricing workbook (`tests/tools/check-pricing-workbook.py`) | 1 | **62** | **0** |
| Translation coverage (`tests/tools/check-translations.js`) | 1 | **15** | **0** |

## TOTAL

| | |
|---|---:|
| **TOTAL ASSERTIONS** | **3,450** |
| **TOTAL FAILED** | **0** |

Baseline for comparison: 2,810 assertions, 0 failed. **+640 assertions**, all
of them new coverage over defects found this round — 3,338 after the morning
repair, and 112 more added by the closing one (109 in the new rendered-DOM
suite, 3 in the source checker).

**Skipped or environment-limited: none.** Every suite named in the brief ran to
completion and is counted above.

---

## Browser suites, in full

```
  ok    size normalisation — model, screen and weight agree                            42
  ok    imperial — the first token of a run is the size                                66
  ok    weight — every product, every input that moves it                              39
  ok    pricing — nothing stale, nothing fabricated                                    47
  ok    pricing history — the rows we sent, and why they differed                     105
  ok    mixed documents — a heading speaks only for its own rows                       37
  ok    save / reload / output — no value drift, no internal costs on the page         65
  ok    common fields and Correct Items — a blank never clears an answer               61
  ok    dense table — 29 rows, merged cells, metric beside imperial                   170
  ok    engineering drawing — five parts, five lengths, no borrowed dimensions         73
  ok    company rules — a size type with a reason, a diameter with one source          68
  ok    quick add safety — corrections, item numbers, partial extraction               60
  ok    company history — a legacy description reads as words, not as a stored value   40
  ok    accessories — charged beside the bolt, never inside it                         41
  ok    dimension schema and drawing association                                       71
  ok    quick add — each row's own pricing history, on the row                         85
  ok    quick add layout — every product reachable at every width                     280
  ok    quick add — twenty items, which is the ordinary case                           30
  ok    engineering documents — geometry, merged cells and specification scope        148
  ok    add to quotation — the button at the end of the review                        160
  ok    stainless — SS304 and SS316 carry no finish, on every screen                  119
  ok    materials — four identities, one vocabulary, one answer                       236
  ok    previous price — a recipe, not a number                                        73
  ok    pricing history — whose price is this                                          61
  ok    size type — unknown is not fullsize                                            71
  ok    thread reference — a note about the thread                                    100
  ok    previous price — applied to the items it describes                             79
  ok    quick add — a review screen, not a settings page                               66
  ok    quantity — fifteen thousand, one, and the ones we must not guess              136
  ok    English / 中文 — the screen, not the dictionary                                 165
  ok    size system — one rod, one diameter, whichever way it was written             132
  ok    responsive — every width the brief names                                       70
  ok    rendered 中文 — the DOM, not the dictionary                                     109

  33 suites, 3105 assertions, 0 failed                                                    632.5s
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
| Translation coverage | 808 keys, 100%, 0 bypassing `dcT`, 0 unapplied hooks |
| Rendered 中文 DOM | 11 states scanned, 0 English runs outside the trade allowlist |
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
