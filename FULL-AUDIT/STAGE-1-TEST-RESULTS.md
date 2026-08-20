# STAGE 1 — TEST RESULTS (CANDIDATE)

**These are the CANDIDATE's measured figures, not the canonical accepted state.**

| | |
|---|---|
| Measured on | `3e89713400b5bcfceca31d2c074de17411169d1b` — the Stage 1 candidate |
| Canonical accepted application | `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac` — **unchanged** |
| Status | **NOT PROMOTED.** Deploy: **NO** |

> **Why this document exists, and what it is not.**
> `FULL-AUDIT/TEST-RESULTS.md` records the **accepted** state and is validated
> against `docs/control/CANONICAL-STATE.json`, which still reads 37 suites and
> 4,070 assertions for `98a31e3`. Those figures are correct and are deliberately
> left alone: Stage 1 has passed review but has **not** been promoted.
>
> This file is the other half — what the Stage 1 candidate actually measured. The
> two disagree on purpose, and the disagreement is the point: a candidate's run
> is not the accepted matrix until someone accepts it. `docs/control/
> CANONICAL-STATE.json` remains the single authority for the accepted figures.

---

## By group

| Group | Suites | Assertions | Failed |
|---|---:|---:|---:|
| Browser suites (`node tests/run.js`) | 38 | **3,816** | **0** |
| Pricing-history PHP (`tests/php/pricing_history.test.php`) | 1 | **172** | **0** |
| AI extraction PHP (`tests/php/ai_extract.test.php`) | 1 | **107** | **0** |
| Pricing workbook (`tests/tools/check-pricing-workbook.py`) | 1 | **62** | **0** |
| Translation coverage (`tests/tools/check-translations.js`) | 1 | **15** | **0** |

## Total

| | |
|---|---:|
| **TOTAL ASSERTIONS** | **4,172** |
| **TOTAL FAILED** | **0** |
| **SKIPPED / ENVIRONMENT-LIMITED** | **0** |

| | |
|---|---:|
| Baseline | 2,810 assertions |
| Final | 4,172 assertions |
| Delta | **+1,362 assertions** |

**Arithmetic, which a reader can perform against the logs in this package:**

```
  3,816   browser              LOGS/browser-suite.log
+   172   pricing / history    LOGS/pricing-history-php.log
+   107   AI extraction        LOGS/ai-extract-php.log
+    62   workbook             LOGS/pricing-workbook.log
+    15   translation          LOGS/translation-coverage.log
= 4,172   total

  4,172 - 2,810 = 1,362
```

## Translation

| | |
|---|---:|
| Keys | **862** |
| Coverage | **100%** |
| Missing | 0 |
| Hard-coded | 0 |
| Unapplied | 0 |

Unchanged from the accepted state: Stage 1 added no string and removed none.

## What moved, and why

The browser matrix grew from 3,714 to **3,816** — **+102**, which is the whole of
`tests/suites/38-mobile-ui.test.js`, added by this round. It covers the 430px
scope label, the Companies tap targets, the numbering identity across three
surfaces, and the printed A4 layout. No existing suite was modified and no
coverage was dropped; the thirty-seven suites that existed before this round
report exactly the counts they did on `98a31e3`.

PHP lint: 7 of 7 files clean (`LOGS/php-lint.log`).

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
  ok   phone widths — the scope label, the tap targets, and the desk left alone        102

  38 suites, 3816 assertions, 0 failed    876.5s
```
