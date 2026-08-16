# TEST RESULTS

Baseline `f96714e` → final. Every suite below runs against the **shipped** code:
the browser suites strip one `require` line from `index.php` / `companies.php`,
serve the file over `http://` so localStorage behaves as it does live, answer
`api.php` from a table the test controls, and drive the page in Chromium. No
parser is re-implemented and no answer is re-exported for a test to assert
against itself.

---

## By group

| Group | Suites | Assertions | Failed |
|---|---:|---:|---:|
| Browser suites (`node tests/run.js`) | 32 | **2,858** | **0** |
| Pricing-history PHP (`tests/php/pricing_history.test.php`) | 1 | **161** | **0** |
| AI extraction PHP (`tests/php/ai_extract.test.php`) | 1 | **107** | **0** |
| Pricing workbook (`tests/tools/check-pricing-workbook.py`) | 1 | **62** | **0** |
| Translation coverage (`tests/tools/check-translations.js`) | 1 | **12** | **0** |

## TOTAL

| | |
|---|---:|
| **TOTAL ASSERTIONS** | **3,200** |
| **TOTAL FAILED** | **0** |

Baseline for comparison: 2,810 assertions, 0 failed. **+390 assertions**, all of
them new coverage over defects found this run.

---

## Browser suites, in full

```
  ok  size normalisation — model, screen and weight agree              42
  ok  imperial — the first token of a run is the size                  66
  ok  weight — every product, every input that moves it                39
  ok  pricing — nothing stale, nothing fabricated                      47
  ok  pricing history — the rows we sent, and why they differed       105
  ok  mixed documents — a heading speaks only for its own rows         37
  ok  save / reload / output — no value drift, no internal costs       65
  ok  common fields and Correct Items — a blank never clears an answer 61
  ok  dense table — 29 rows, merged cells, metric beside imperial     170
  ok  engineering drawing — five parts, five lengths                   73
  ok  company rules — a size type with a reason                        68
  ok  quick add safety — corrections, item numbers, partial extraction 60
  ok  company history — a legacy description reads as words            40
  ok  accessories — charged beside the bolt, never inside it           41
  ok  dimension schema and drawing association                         71
  ok  quick add — each row's own pricing history, on the row           85
  ok  quick add layout — every product reachable at every width       280
  ok  quick add — twenty items, which is the ordinary case             30
  ok  engineering documents — geometry, merged cells, scope           148
  ok  add to quotation — the button at the end of the review          160
  ok  stainless — SS304 and SS316 carry no finish, on every screen    119
  ok  materials — four identities, one vocabulary, one answer         236
  ok  previous price — a recipe, not a number                          73
  ok  pricing history — whose price is this                            61
  ok  size type — unknown is not fullsize                              71
  ok  thread reference — a note about the thread                      100   (+13)
  ok  previous price — applied to the items it describes               79
  ok  quick add — a review screen, not a settings page                 66
  ok  quantity — fifteen thousand, one, and the ones we must not guess 81   (NEW)
  ok  English / 中文 — the screen, not the dictionary                   82   (NEW)
  ok  size system — one rod, one diameter, whichever way written      132   (NEW)
  ok  responsive — every width the brief names                         70   (NEW)

  32 suites, 2858 assertions, 0 failed          600.5s
```

---

## Tests added and modified

### Added

**`tests/suites/29-quantity.test.js` — 81 assertions.**
The live message end to end; the spec-header reader over six material spellings
plus the guard case that made it strict; every quantity variant the brief names;
thousands separators in a quantity AND in a dimension; the bare-list boundary;
absent quantity defaulting to one, at the parser, on the review screen and
through the extraction normaliser; and quantity wording with no readable value,
which must NOT default.

**`tests/suites/30-language.test.js` — 82 assertions.**
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
| `php -l` over all 13 PHP files | clean |
| Translation coverage | 658 keys, 100%, 0 bypassing `dcT` |
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
