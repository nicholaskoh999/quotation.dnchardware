# Pricing core

`quo-pricing-core.js` holds the arithmetic that turns a recognised item and a pricing setup into a unit price. It sits beside `quo-parser-core.js` (see `PARSER-CORE.md`) and needs it.

## What is in it

| Part | Content | How it got there |
|---|---|---|
| 1 | `evalExpr`, `isReadableAmount`, `round05`, `roundCustom10`, `roundMoney2`, `dcAutoRound`, `dcDefaultPriceMode`, `dcSizeTypeFor`, `findDSRule`, `dcEffectiveDiameter`, `accAddon`, `wqaShownPrice`, `wqaRowSetupOk`, `wqaRowPriceable`, `wqaRowPa`, `wqaRowAccepted`, `wqaApplyPriceTo`, `wqaMarkEdited`, `DC_AUTO_ROUND_STAGE` | Moved out of `index.php` without editing a character |
| 2 | `dcBarWeight`, `dcBasePrice`, `dcRawPrice`, `dcLBoltTotalLength`, `dcJBoltTotalLength`, `dcUBoltTotalLength`, `dcSQUBoltTotalLength`, `dcResolvePrice`, `dcRateEntryProblem` | The expressions that stood inline in the calculators, given names. Same expressions, same order of evaluation |
| 3 | `quoReviewRows`, `quoPriceRow`, `quoNumberBox`, `quoNumberBoxText`, `quoRowAccessoryCost`, version and contract numbers | New. For a host with no product form. `index.php` does not call them |

## What changed in index.php

- One `<script src="quo-pricing-core.js?v=…">` line, after the parser core and before the page script.
- The Part 1 declarations are gone from the page.
- `calcSagRod`, `calcStud`, `calcAnchorBolt`, `calcUBolt`, `calcSQUBolt`, `calcLBolt`, `calcJBolt`, their `add…` twins and `getSavedUBoltDebug` call the Part 2 functions instead of repeating the formula.
- `resolvePriceMode` reads the form, calls `dcResolvePrice` and stores the result in `priceCalcState` as before.
- `validateRateEntry` asks `dcRateEntryProblem` which refusal applies; the messages are unchanged.

No formula, rounding rule, default or message was changed. Plate, Welding Anchor Set and Others are not part of this file; their calculators are untouched.

## Pricing a row without the form

The review screen prices a row by writing it into the product form, running that product's calculator and reading the result back (`wqaRecomputeAll`). `quoPriceRow(row, common)` does the same steps on the row alone and leaves the same fields on it: `calc`, `noDia`, `diaMm`. It returns the intermediate figures (diameter, bar length, weight, base, raw price, rounded price, final price).

It covers the five products Quick Add reads from text: Sag Rod, Stud, Anchor Bolt, L Bolt, J Bolt.

Not included, because they are not arithmetic: the recommended rates (built-in rate tables, Default Price rules) and the price-source label (`calc.src`). Since QQ R1 Loop #7 those are shared too, in `quo-quote-core.js` (`quoRecommend`, `quoPriceSource`; see `QUOTE-CORE.md`, "Recommendation and price source"): their closure needs `quoItemDesc`, which lives there, and this file loads first. This file is unchanged by that move.

## Custom Diameter Settings

`dcEffectiveDiameter` asks `findDSRule` first and the built-in table second. The rules are whatever was last handed to the parser core: the page assigns them from `api.php?action=get_diameter_settings`; any other host calls `quoParserCoreSetDiameterRules(rows)` with the same rows. A host that has not been given the live rows is pricing with the built-in table only and must say so.

## Tests

| Test | What it proves |
|---|---|
| `node tests/core/pricing-core.test.js` | With no browser, the core prices all 251 scenarios in `tests/fixtures/pricing-scenarios.json` to exactly the figures production commit `ca5f0a5` produced through the forms (`tests/fixtures/pricing-baseline-ca5f0a5.json`): row fields, diameter, weight, base, raw price, rounding, final price. Also the `?v=` fingerprint, load order and the deploy allowlist |
| `tests/suites/79-pricing-core-parity.test.js` | In the real page, the form and `quoPriceRow` leave the same result on every row |

All inquiries in the fixtures are made up.

## Editing rules

- No DOM, no network, no storage in this file.
- After any change: update the `?v=` value in `index.php` to the first 12 hex of the file's SHA-256 and bump `QUO_PRICING_CORE_VERSION`. Bump `QUO_PRICING_CORE_CONTRACT` only when a name is removed or changes meaning.
- A changed figure in the baseline comparison is a pricing change. Do not regenerate the baseline to make a test pass.
- `.cpanel.yml` must list the file in `APPFILES`, before `version.php`.

## Known limits

- `evalExpr` evaluates typed arithmetic (`3+0.8`) with `Function(...)`. A browser extension forbids that, so in such a host an expression reads as unreadable (0) while a plain number reads the same everywhere. A host like that must accept plain numbers only.
- `quoPriceRow` reads lengths, the diameter, the markup and the Manual Price the way an `<input type="number">` keeps them. A value such a box would reject reads as blank.
