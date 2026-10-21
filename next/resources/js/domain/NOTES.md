# Domain engine — Wave 1 Session B notes

Framework-free TypeScript engine for QUOTATION NEXT (handoff §1, §9). Legacy
`index.php` is the oracle; the R0b golden fixtures (`fixtures/golden/*.json`)
are the test. Public API: `index.ts`.

| module | what |
|---|---|
| `numbers.ts` | legacy field readers: `evalExpr` (no eval — a parser for the same arithmetic subset), `parseNum`, `cleanNum`, `withMm` |
| `products.ts` | product ids (legacy `itemType` + `jhook`, `eyebolt`), names, stud has no size type |
| `rounding.ts` | `round05`, `roundCustom10`, `roundMoney2` (float behaviour ported) + product → rule map |
| `size.ts` | legacy readers + §12 `interpretSize` (canonical, display, system, Needs Review) |
| `material.ts` | Material · Treatment · Property Class; legacy codes ↔ structured; §14 wording; §34 C-1 bare-grade helper |
| `tables.ts` / `diameter.ts` | built-in diameter tables, custom override rules, `formatSizeLabel`, `DIAMETER_CANDIDATES` |
| `geometry.ts` / `weight.ts` | developed length per product (J Hook / Eye Bolt suggestions), rod / plate / triangle / WAS weight |
| `defaults.ts` | code built-in default prices (B-2), custom rule merge, TL surcharge bands |
| `accessories.ts` | Nut / Flat Washer / Custom, qty reading (B-1), unit total, `cw` wording |
| `pricing.ts` | calculated / no_round / manual, price list, WAS exception, saved breakdown + `priceSource`, vintage readers |
| `sagrod.ts` | Sag Rod TL canonicalisation (`100` → `100/100`, B-5) and dimension line |
| `description.ts` | dimension lines, item desc, print description / dimension, WhatsApp (one text for preview and send) |

Test-support only (Node, never imported by the app): `golden.ts`,
`golden-coverage.ts`, `golden-inputs.ts`.

## Golden coverage (asserted case-by-case)

Every family test iterates `assertedCases(family)`; `coverage.test.ts` counts
the same selection and pins the totals, and fails if any B or C case is not
asserted. No engine family contains a `knownFailure` case.

| family | A | B | C | notes |
|---|---:|---:|---:|---|
| rounding | 71 | 0 | 0 | + property tests over every sen boundary |
| size | 25 | 1 | 0 | B-4 bare `72`; legacy readers also reproduce `legacy` for all 26 |
| diameter | 277 | 2 | 46 | B-3 4140 plain M12 → 13; C = OG-1 (M12 UNDERSIZE 10.6) and DG-1 candidates, legacy kept |
| weight | 17 | 0 | 0 | developed length + weight recomputed from the input |
| pricing | 18 | 0 | 0 | recomputed through `computeGeometry` → `priceItem` |
| was | 2 | 0 | 0 | accessories inside the markup |
| accessories | 6 | 2 | 0 | B-1 explicit 0 stays 0 (no money, wording `null`) |
| defaultPrice | 33 | 9 | 0 | B-2 MS FULLSIZE Sag Rod 3.50 / 5.00 / 6.50 (HDG add 1.60 kept) |
| tlSurcharge | 12 | 0 | 0 | |
| sagrodTL | 3 | 2 | 0 | B-5 single TL → `a/a` |
| material | 8 | 3 | 0 | B-6 structured hardened, B-7 12.9, B-8 wording sample |
| output | — | — | — | one composite case (6 items): per-item print / title / price (2 hardened rows = B-8), WhatsApp preview ≡ sent and equal to the legacy SENT text with §14 wording (B-9), copy-with-weight, total, no cost/add/markup leak |
| **total** | **472** | **19** | **46** | + 1 composite (output) |

Deferred (load-only, `deferred.golden.test.ts`): `quickAdd` (parser is Wave 3 —
not implemented) and `history` (server-side ranking, later wave).

## Open gates (safe legacy behaviour in force)

| gate | question | engine behaviour |
|---|---|---|
| **OG-1** | M12 UNDERSIZE: is Ø10.7 scoped (4140 QT UNDERSIZE Sag Rod only), global, or not canonical? (§34 C-2) | **10.6** everywhere (stud inherits). 10.7 listed in `DIAMETER_CANDIDATES`, not applied. A custom diameter rule can scope it once decided. |
| **DG-1** | provide the read-only historical export (or confirm each scope) for §15 candidates: FULLSIZE M33→32, M24→25, 1"→25, UNDERSIZE M10→8.9/9.0, 4140 QT L Bolt M27→28 | legacy table values; candidates exported as data (`status: 'candidate'`, `applied: false`) |
| **OG-2** | Eye Bolt with S: J Bolt geometry needs H; the Eye Bolt's only length is L | H := L; result offered as `suggestedDevelopedLength` only — never applied, always editable; without S the developed length is manual |
| **OG-B1** | rounding rule for **J Hook** and **Eye Bolt** (new products, §19 / §20 name none) | `money2` (two decimals, no product-specific rule). Choosing round05 / roundCustom10 is a pricing decision for the owner. |
| **OG-B2** | hardened 4140 QT (legacy `4140_HARDEN_G10_9`) M12 FULLSIZE: legacy Ø12 (the Ø13 special was gated on the plain codes `4140` / `4340`) | **Ø12** kept. The structured model might suggest Ø13 (it is 4140 QT), but that changes weight and price. |
| note | §34 C-1 bare `10.9` ⇒ 4340 QT | kept as the oracle (`legacyBareGradeMaterial`) |
| note | MS FULLSIZE HDG Sag Rod Additional Cost | legacy 1.60 kept; §16 restates only the Cost Rate |

## Decisions and deviations (documented, none changes an A case)

- **§12 bare `72` rule.** Implemented as: a *bare* number (no `M`, optional `mm`)
  greater than the largest metric size in the built-in tables (M65) is not turned
  into an M-size — it stays as typed, `system: 'unknown'`, `needsReview: true`.
  This satisfies the B case without inventing a list and leaves every A case
  intact (bare `6` → M6, bare `23` → M23 flagged unknown, bare `1` → M1 flagged,
  explicit `M72` → M72 flagged).
- **Zero-quantity accessory wording.** `accessoryWording()` returns `null` when
  an item has no accessory at all (none selected, or only zero-quantity ones —
  the B case) and `''` when it has accessories none of which print (custom text
  that is a material label — A case). A zero-qty accessory never prints
  (`cw 0nut` is not invented) and never adds money.
- **WhatsApp grouping.** The single builder reproduces the legacy **sent** text
  (one row per item, a new heading whenever the material + finish title changes,
  each row carrying its own insertion-order number). Preview, send and copy all
  use it, so they are equal by construction. A `grouping: 'byTitle'` option
  groups by title across the quotation without ever merging two items into one
  row (`1, 3)` is gone). Choosing it as default is an owner/UI decision (§34 C-4).
- **Hardened wording beyond the stud sample.** `<MAT> [<SIZE TYPE>] <PRODUCT> ·
  HARDENED TO G<PC> (<FINISH>)` — e.g. `4140 QT FULLSIZE L BOLT · HARDENED TO
  G10.9 (HDG)`; a WAS reads `<MAT> WELDING ANCHOR SET · HARDENED TO …`.
- **J Hook / Eye Bolt dimension lines** (no legacy format exists):
  J Hook `M12 x L 300 x W 80 x TL 75mm`; Eye Bolt `M16 x L 250 x ID 40 [x S 60]
  [x TL 50mm] [FW]`.
- **Price mode spelling.** The engine uses `calculated | no_round | manual` and
  reads/writes legacy `auto` via `normalizePriceMode` / `legacyPriceMode`.
  Every result carries `priceSource` (`calculated | no_round | manual |
  price_list`) for history identity (§34 C-3).
- **WAS stored total** is `finalUnitPrice × qty` unrounded, as legacy `addWAS`
  stores it (every other product's total goes through `roundMoney2`).
- **`evalExpr` without `eval`.** A recursive-descent parser for the same
  JavaScript arithmetic subset; anything strict-mode JS rejects (e.g. `012`,
  `2--1`, `-2**2`) falls back to `Number()` exactly like the legacy catch block.
- **WhatsApp template placeholders** are substituted with replacer functions, so
  a `$&` inside a customer name is printed literally (legacy would expand it).
- **Material inputs** may be legacy codes (`4140`, `4140_PLAIN`, `Y_BAR`, …),
  canonical names (`4140 QT`, `Y BAR`) or structured objects; diameter, default
  price and price-list lookups normalise them, so `4140` and `4140 QT` resolve
  identically.
