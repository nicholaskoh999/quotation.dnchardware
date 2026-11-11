# Quote core

`quo-quote-core.js` builds the two things a quotation is made of: the item that Add to Quotation stores, and the WhatsApp quotation text that the copy buttons produce. It loads after `quo-parser-core.js` and `quo-pricing-core.js` (see `PARSER-CORE.md` and `PRICING-CORE.md`) and needs both of them.

## What is in it

| Part | Content | How it got there |
|---|---|---|
| 1 | `ITEM_TYPES`, `cleanNum`, `withMm`, `isMaterialOptionText`, `dcNormalizeCustomDims`, `dcCustomDimsText`, `DC_PRICE_SOURCES`, `dcPaMeta`, `DC_PA_KEEP_FD`, `dcPaKeepSaved`, `getNominalDiameter`, `sizeDisplay`, `dcSizeLabelDisplay`, `formatSizeLabel`, `DC_PRICING_MODEL`, `DC_PRICING_MODEL_SEPARATE`, `dcItemIsInclusive`, `dcItemIsSeparated`, `dcItemAccUnit`, `dcItemFinalUnit`, `dcItemBoltUnit`, `dcLineMoney`, `accCWLines`, `accCWLabel`, `wasCWLabel`, `wasDisplayData`, `quotationDisplayRef`, `WA_DEFAULT_TPL`, `sanitizeWATemplate`, `fmtWAUnitPrice`, `getWAGroupTitle`, `dcSizeBoxText`, `dcCanonicalFormSize`, `wqaAccForForm`, `wqaCloneAcc` | Moved out of `index.php` without editing a character, with the comments above them |
| 2 | `quoItemDesc`, `quoItemFormData`, `quoBuildItem`, `quoItemInputFromRow`, `quoBuildItemFromRow`, `quoCustomDimsLine`, `quoFillRefPlaceholders`, `quoWAItemsText`, `quoQuoteText` | What `buildDesc`, `captureItemFormData`, the eight bolt `add…` functions with `pushItem`, `wqaApplyRowToForm`, `dcCustomDimsLine`, `dcFillRefPlaceholders`, `buildWAItemsText` and `buildQuoteText` did with the form, written against plain data. Same steps, same order, same refusals |
| 3 (1.1.0) | `RATES`, `RATES_4140`, `ZP_SURCHARGE`, `HDG_SURCHARGE`, `HDG_THREAD_BRUSHING`, `get4140Rates`, `getAddCostFromTL`, `normalizeDPRule`, `dpKey`, `makeSystemDPRule`, `getSystemDPRules`, `dcRecSame` | Moved out of `index.php` without editing a character (QQ R1 Loop #7). See "Recommendation and price source" |
| 4 (1.1.0) | `quoDPDisplayRules`, `quoFindDPMatch`, `quoRecommend`, `quoPriceSource` | `getDPDisplayRules` / `findDPMatch` with the Default Price rules handed in instead of read from the page cache; the bodies of `dcRecommendFor` and of `dcSuggestSource` / `wqaRowSuggestSource`, without the form |

## What changed in index.php

- One `<script src="quo-quote-core.js?v=…">` line, after the pricing core and before the page script.
- The Part 1 declarations are gone from the page.
- `addSagRod`, `addStud`, `addAnchorBolt`, `addUBolt`, `addSQUBolt`, `addLBolt` (also L Bolt 45DEG) and `addJBolt` call `dcAddFromForm(type)`: it reads the form into plain data (`dcReadItemForm`), calls `quoBuildItem`, says a refusal in the person's language (`dcBuildRefusalText`) and places the item (`dcPlaceItem`, the former tail of `pushItem`: edit replaces and keeps `item_uid`, a new item is appended). What each add function does after a successful add (clearing the length box, focus, toasts, Sag Rod repeat entry) is unchanged.
- The page state the core cannot see is handed in: `dcPaCommit` as the price acceptance, `dcRateRequired`, the quotation lock, the last preview weight, and a hook that publishes the price state exactly as `resolvePriceMode` did.
- `captureItemFormData`, `buildDesc`, `dcCustomDimsLine`, `dcFillRefPlaceholders`, `buildWAItemsText` and `buildQuoteText` are one-line adapters around the Part 2 functions.
- `pushItem` stays for Others / Special Bolt. Plate and the Welding Anchor Set keep their own add paths. Quick Add (`wqaAddAll`) still commits each row through the entry form and `addCurrentItem`, so it builds through the core too.

## Building an item without the form

```js
const res = quoBuildItem({
  type: 'lbolt',
  fields: { material: 'MS', sizeType: 'FULLSIZE', size: 'M20', diameter: '20', length: '670', threadLen: '100',
            l: '600', w: '100', costRate: '6.10', addCost: '0.50', markup: '15', qty: '154',
            priceMode: 'auto', manualUnitPrice: '' },
  finish: 'PL',
  accessories: quoNoAccessories(),
  acceptance: { source: 'manual_recipe' },
});
// res.ok ? res.item : res.code / res.field
```

- `fields` holds the entry form's boxes as text, with exactly the keys in `QUO_ITEM_FORM_FIELDS[type]`. `diameter` and the bent products' Total Length (`length`) are what the form would hold: the core does not fill them in, because the form does not either at Add time. Use `dcEffectiveDiameter` and `dcLBoltTotalLength` / `dcJBoltTotalLength` / `dcUBoltTotalLength` / `dcSQUBoltTotalLength` from the pricing core for that.
- `acceptance` is `{source, historyRef}` for a price calculated from the setup, `{grant:{v,src,ref}}` for a priced Quick Add row, or `{meta, keep}` already decided. `at` replaces the moment of acceptance.
- Refusal codes: `size_missing`, `diameter_missing`, `length_missing`, `l_missing`, `lw_missing`, `hids_missing`, `ohw_missing`, `id_ih_negative`, `ubolt_geometry_incomplete`, `total_length_missing`, `dim_not_positive`, `rate_blank`, `add_cost_blank`, `manual_price_invalid`, `rate_negative`, `rate_unreadable`, `qty_not_whole`, `qty_min`, `qty_too_large`, `locked`, `final_qty_invalid`, `unit_negative`, `line_negative`, `price_not_accepted`, `price_changed`, `unsupported_type`. `field` names the box (or, for `dim_not_positive` / rate refusals, the label the form shows). When both rates are wrong the second refusal is in `more`.
- `quoBuildItemFromRow(row, common)` builds from a Quick Add review row that the review screen has priced (`row.calc`). It refuses a row the review screen would refuse: `row_conflict`, `row_missing`, `qty_missing`, `price_not_accepted`.

## Recommendation and price source

The recommendation the editor and Quick Add show next to the pricing setup, and the price source an accepted price records (`priceAcceptance.source`, one of `DC_PRICE_SOURCES`). Version 1.1.0.

```js
quoRecommend({ type, material, sizeType, size, finish, threadLen, productName, dpRules })
// → { costRate, addCost, markup, src: 'default_rule' | 'built_in' } (strings) or null
quoPriceSource({ priceMode, setup: { costRate, addCost, markup }, rec, history })
// → 'manual' | 'history_manual' | 'history_recipe' | rec.src | 'manual_recipe'
```

- `quoRecommend` is `dcRecommendFor` without the form: the values are what the product form holds (text), `finish` is the checked finish (`''` for none; the page passes `getFinish(type)`, which reads "nothing checked" as `PL`). `dpRules` are the Default Price rules **as the server sends them** — `api.php?action=get_default_prices`'s `data`, or the service's `default_prices.get` `rules` — active and inactive (`quoFindDPMatch` filters). Order: a custom Default Price rule leads (`default_rule`); then the built-in MS Sag Rod rate with the thread-length band (HDG: fixed +1.60); then the 4140 table; then a system Default Price row (`built_in`).
- `quoPriceSource` is the shared body of `dcSuggestSource` (entry form) and `wqaRowSuggestSource` (Quick Add). Manual Price → `manual` without looking at `rec` (or `history_manual` when the Manual Price came from history). A history recipe applied → `history_recipe`. A setup equal to `rec` (`dcRecSame`: blank reads as 0) → `rec.src`. Anything else → `manual_recipe`. `history` is `{usedHistoryRef, usedHistoryRecipe, histApplied}`; the entry form passes none, and so does QQ, which has no price history — so for QQ only `manual`, `manual_recipe`, `built_in` and `default_rule` can come out.
- Why this file and not `quo-pricing-core.js`: the dependency closure (computed with espree + eslint-scope from `dcRecommendFor`, `dcSuggestSource`, `wqaRowSuggestSource`) reaches `buildDesc` → `quoItemDesc` and `ITEM_TYPES`, which are this file's, for the 4140 table key. The pricing core loads first and does not reach forward.
- In `index.php`: `dcRecommendFor(type)` keeps its form guard (`el(type+'-costRate')`) and calls `quoRecommend` with the form's values and `loadDPRules()` (the page's `dpRulesCache`, still loaded from `get_default_prices`); `getDPDisplayRules()` and `findDPMatch(...)` hand `loadDPRules()` to `quoDPDisplayRules` / `quoFindDPMatch`; `dcSuggestSource` and `wqaRowSuggestSource` call `quoPriceSource`. The editor still asks for the recommendation only when the mode is not Manual.
- Found, unchanged: with material `4140` (`materialLabel` → `4140 QT`) the description never equals a `RATES_4140` key, so `get4140Rates` answers nothing and the 4140 recommendation comes from the system Default Price rows built from the same table (same figures). Kept as it is; the baseline pins it.

## The WhatsApp text

```js
quoQuoteText({ items, header: { customer, refno, date, prepby }, template, revision: 0, includeUnitWeight: false });
quoWAItemsText(items, { emptyText: '-', mergeIdentical: true, includeUnitWeight: false });
```

`template` is the saved template body; empty means the default. Two pieces of text follow the UI language on the page: the custom-dimension prefix and the revised-quotation heading. The page hands in its own (`labels: {customPrefix, revisedQuotation}`); a host that hands in nothing gets `Custom:` and `REVISED QUOTATION`.

## Tests

| Test | What it proves |
|---|---|
| `node tests/core/quote-core.test.js` | With no browser, the core builds every entry-form scenario in `tests/fixtures/quote-scenarios.js` into exactly the item production commit `ca5f0a5` stored through the page (`tests/fixtures/quote-baseline-ca5f0a5.json`), or refuses it with the right code, and formats every WhatsApp scenario to the same text, byte for byte. Also the `?v=` fingerprint, load order and the deploy allowlist |
| `tests/suites/80-quote-core-item-parity.test.js` | In the real page, Add to Quotation and Quick Add Add All store what production stored, with the same toasts; `quoBuildItemFromRow` builds the same items as Add All |
| `tests/suites/81-quote-core-whatsapp-parity.test.js` | In the real page, every copy path produces production's text |
| `node tests/core/recommend-core.test.js` | `quoRecommend` / `quoPriceSource` answer exactly what the page's `dcRecommendFor`, `dcSuggestSource` and `wqaRowSuggestSource` answered **before** the extraction (`tests/fixtures/recommend-baseline-f4e233c.json`, captured from `f4e233c` with `tests/tools/capture-recommend-baseline.js`), for 2 314 synthetic scenarios (`tests/fixtures/recommend-scenarios.json`) × setups × price modes × history provenance; and the page's adapters, lifted as they are now, still answer the same |

Normalised field: `priceAcceptance.at` (the clock). Nothing else.

The baseline was captured from a `git archive ca5f0a5` export, which has no core files, with the drivers in `quote-scenarios.js`. All data in the fixtures is made up; `Q-TEST-0001` is a test-only reference.

## Editing rules

- No DOM, no network, no storage in this file.
- After any change: update the `?v=` value in `index.php` to the first 12 hex of the file's SHA-256 and bump `QUO_QUOTE_CORE_VERSION`. Bump `QUO_QUOTE_CORE_CONTRACT` only when a name is removed or changes meaning.
- A changed item or text in the baseline comparison is a behaviour change. Do not regenerate the baseline to make a test pass.
- `.cpanel.yml` must list the file in `APPFILES`, after `quo-pricing-core.js` and before `version.php`.

## Known limits

- Others / Special Bolt, Plate and the Welding Anchor Set are not built here.
- Editing a saved item (keep the saved price, carry `item_uid`) needs the page's acceptance state. A host passes `acceptance: {meta, keep}` itself; the browser suite covers the page's edit path.
- `quoBuildItemFromRow` takes the row's pricing setup from `row.calc`, so the row must have been priced by the review screen (Default Price rules and the thread-length surcharge are page logic).
