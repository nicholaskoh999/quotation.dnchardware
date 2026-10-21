# Golden fixtures — the QUOTATION NEXT behavioural oracle (R0b)

Generated, not hand-written:

```
node tests/characterisation/run.js           # regenerate from the shipped legacy code
node tests/characterisation/run.js --check   # CI: fail if the legacy behaviour drifted
```

Every `legacy` value is produced by the **shipped** `index.php` (driven in
Chromium through `tests/lib/harness.js`, the same harness the 43 browser suites
use) or by the shipped, DB-free `pricing_history.php`. The inputs and the
classifications live in `tests/characterisation/cases.js`.

## Case shape

```json
{ "input": …, "legacy": …, "cls": "A|B|C", "expected": …, "ref": "§n", "gate": "OG-n|DG-n", "note": "…" }
```

| cls | meaning | `expected` |
|---|---|---|
| **A** | legacy behaviour to **preserve** | `=== legacy` |
| **B** | legacy behaviour to **replace** — the owner approved a different rule (`ref` names the handoff section) | the owner rule; `legacy` kept as evidence |
| **C** | ambiguous — **owner / data gate** (`gate`) | the *safe legacy* value, never a guess |

`knownFailure: true` marks a parser case whose legacy output is wrong today. It
is recorded so the Wave 3 Quick Add rewrite improves on it knowingly; the new
engine must not be tested *against* a known failure.

**A B case is not a regression.** The owner approved it. A test that fails
because the new engine matches `expected` instead of `legacy` on a B case is
the test being wrong.

## Families

| file | what | source function(s) |
|---|---|---|
| `rounding.json` | `round05`, `roundCustom10`, `roundMoney2` incl. boundaries | index.php |
| `size.json` | size normalisation, metric/imperial, known/unknown, display | `normalizeSizeValue`, `isKnownSize`, `sizeDisplay`, `wqaInchKey` |
| `diameter.json` | built-in diameter tables by product/material/size type/size | `dcBuiltInDiameter` |
| `weight.json` | developed length + unit weight through the real entry forms | `calc*` per product |
| `pricing.json` | cost rate · add cost · markup · rounding · manual / no-round · accessories | `calc*` → `resolvePriceMode` |
| `was.json` | Welding Anchor Set incl. the accessory-markup exception | `getWASCalc` |
| `accessories.json` | qty reading (blank → default, **explicit 0 → B**), totals, `cw` wording | `getAccessories`, `accAddon`, `accCWLabel` |
| `defaultPrice.json` | code built-in default rates (prod `default_prices` has 0 rows) | `findDPMatch` / `getSystemDPRules` |
| `tlSurcharge.json` | Sag Rod thread-length Additional Cost bands | `getAddCostFromTL` |
| `sagrodTL.json` | Sag Rod TL through the manual add path (`100` → B `100/100`) | `addSagRod` |
| `material.json` | material labels, finish rule, structured Material·Treatment·Property Class | `materialLabel`, `displayItemDesc` |
| `output.json` | WhatsApp preview vs sent, print description/dimension, leak check | `buildWAItemsText`, `buildQuoteText`, `getPrint*` |
| `quickAdd.json` | deterministic parser patterns, aliases, known failures | `wqaParseText` |
| `history.json` | history identity, vintage split, ranking, imperial LIKE prefilter, ref format | `pricing_history.php` |

The R0b report is `docs/quotation-next/R0B-CHARACTERISATION.md`.
