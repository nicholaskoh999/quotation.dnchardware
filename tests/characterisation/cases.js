/* ── R0b characterisation cases ─────────────────────────────────────────────
   The INPUTS of the behavioural oracle, and nothing else that is a number.

   Every legacy output in fixtures/golden/*.json is produced by run.js from the
   SHIPPED index.php / pricing_history.php — never typed in here. What this file
   adds by hand is the CLASSIFICATION of each case, and only for the cases
   where the owner handoff (docs/quotation-next/OWNER-APPROVED-REWRITE-HANDOFF.md)
   says the new engine must differ:

     A  legacy behaviour to PRESERVE          expected = legacy
     B  legacy behaviour to REPLACE           expected = the owner-approved rule,
                                              legacy kept beside it as evidence
     C  ambiguous / OWNER GATE                expected = the safe legacy value,
                                              with the gate named — never a guess

   A case with no `cls` is A. A B or C case says WHICH handoff section or
   contradiction-register entry (§34 C-n) authorises it, so a reader can check
   the claim instead of trusting it.                                          */
'use strict';

/* ── Rounding ─────────────────────────────────────────────────────────────── */
const rounding = [
  // round05 — the Sag Rod / Stud / Anchor Bolt / Plate / WAS rounding.
  ...[0, 1.00, 1.01, 1.02, 1.04, 1.05, 1.06, 1.08, 1.09, 1.10, 1.11, 1.19, 1.21,
      1.29, 1.31, 1.49, 1.51, 2.534, 2.535, 2.545, 2.555, 2.991, 2.995, 3.999,
      4.00, 9.99, 10.01, 10.09, 12.345, 99.99, 100.01, 0.09, 0.01, 7.7649, 7.765]
    .map(v => ({ fn: 'round05', v })),
  // roundCustom10 — U / SQ-U / L / L45 / J Bolt: up to the next 10 sen unless
  // the last sen is 0–3.
  ...[0, 1.00, 1.01, 1.03, 1.0349, 1.035, 1.04, 1.05, 1.09, 1.10, 1.13, 1.14,
      2.999, 3.0049, 3.005, 9.94, 9.96, 10.0, 12.3456, 0.004, 0.005, 7.2, 7.23,
      7.24, 19.995, 99.991]
    .map(v => ({ fn: 'roundCustom10', v })),
  // roundMoney2 — Others, accessory totals, every stored money figure.
  ...[0, 1.005, 1.015, 2.675, 1.234, 1.235, 1.2349, 10.999, -1.005, 3.452988]
    .map(v => ({ fn: 'roundMoney2', v })),
];

/* ── Size ─────────────────────────────────────────────────────────────────── */
const size = [
  { raw: '12' }, { raw: 'm12' }, { raw: 'M 12' }, { raw: '12mm' }, { raw: 'M12' },
  { raw: '1/2' }, { raw: '1/2"' }, { raw: '3/8' }, { raw: '1-1/4' }, { raw: '1 1/4' },
  { raw: '1-1/4"' }, { raw: '1"' }, { raw: '1 INCH' }, { raw: '1in' }, { raw: '5/8 in' },
  { raw: '3/4”' }, { raw: '7/8' },
  { raw: '6', note: 'historical bare 6 — owner §12: normalise as M6' },
  { raw: '72', cls: 'B', ref: '§12',
    expected: { normalised: '72', system: 'unknown', needsReview: true },
    note: 'owner §12: bare 72 must NOT be blindly normalised; mark Needs Review. Legacy writes M72 and only then reports it unknown.' },
  { raw: '23', note: 'a metric number we do not stock is still read as M23, then reported unknown' },
  { raw: '1' , note: 'a bare 1 is metric M1 — an inch needs its mark' },
  { raw: '' }, { raw: 'abc' }, { raw: 'M12x1.75' }, { raw: 'M10.5' }, { raw: '2-1/2' },
];

/* ── Diameter: built-in tables, every product family, every scope ─────────── */
/* The built-in lookup depends on (stud OR undersize) and on material being
   4140 / 4340 QT, and on nothing else about the product — so one bent product
   (L Bolt) is enough beside Sag Rod and Stud to prove that, and the material
   set is the four that select different branches plus one stainless. */
const DIA_SIZES = ['M6', 'M8', 'M10', 'M12', 'M14', 'M16', 'M20', 'M22', 'M24', 'M25', 'M27',
  'M30', 'M33', 'M72', '3/8', '1/2', '5/8', '3/4', '1"', '1-1/4'];
const DIA_MATERIALS = ['MS', '4140', '4140_PLAIN', '4340', 'SS304'];
const diameter = [];
for (const type of ['sagrod', 'stud']) {
  for (const material of DIA_MATERIALS) {
    for (const sizeType of (type === 'stud' ? [''] : ['FULLSIZE', 'UNDERSIZE'])) {
      for (const s of DIA_SIZES) diameter.push({ type, material, sizeType, size: s });
    }
  }
}
for (const material of DIA_MATERIALS) {
  for (const s of ['M12', 'M24', 'M27', 'M33']) diameter.push({ type: 'lbolt', material, sizeType: 'FULLSIZE', size: s });
  diameter.push({ type: 'lbolt', material, sizeType: 'UNDERSIZE', size: 'M12' });
}
/* The B / C overrides are applied by run.js through this table, keyed on the
   same identity the builder above produced, so no case is written twice. */
const diameterOverrides = [
  // §15 LOCKED: 4140 plain M12 FULLSIZE → Ø13. Legacy only applies the Ø13
  // special to 4140 QT ('4140') and 4340 QT ('4340'), so plain 4140 reads 12.
  ...['sagrod', 'lbolt'].map(type => ({
    match: { type, material: '4140_PLAIN', sizeType: 'FULLSIZE', size: 'M12' },
    cls: 'B', ref: '§15 (4140 plain M12 → Ø13 — LOCKED)', expected: 13,
    note: 'legacy DIA_FULLSIZE_SPECIAL is gated on material 4140|4340 (QT); plain 4140 falls through to 12.',
  })),
  // §34 C-2: M12 UNDERSIZE 10.6 (legacy) vs repeated historical 10.7.
  ...['sagrod', 'lbolt'].flatMap(type =>
    DIA_MATERIALS.map(material => ({
      match: { type, material, sizeType: 'UNDERSIZE', size: 'M12' },
      cls: 'C', gate: 'OG-1', ref: '§15 / §34 C-2', expected: 10.6,
      note: 'Historical evidence repeats Ø10.7, but its scope (product / material / period / customer) is not provable from repository evidence. The safe legacy 10.6 stays until OG-1 is answered.',
    }))),
  // Stud always uses the undersize bar: M12 stud is 10.6 under the same gate.
  ...DIA_MATERIALS.map(material => ({
    match: { type: 'stud', material, sizeType: '', size: 'M12' },
    cls: 'C', gate: 'OG-1', ref: '§15 / §34 C-2', expected: 10.6,
    note: 'Stud reads the undersize table; it inherits the M12 undersize gate.',
  })),
  // §15 candidates whose SCOPE needs the historical export (data gate DG-1).
  ...['sagrod', 'lbolt'].flatMap(type => DIA_MATERIALS.flatMap(material => [
    { match: { type, material, sizeType: 'FULLSIZE', size: 'M33' }, cls: 'C', gate: 'DG-1', ref: '§15 candidate FULLSIZE M33 → Ø32',
      note: 'candidate convention; scope unproven without the read-only historical export. Legacy 33 kept.' },
    { match: { type, material, sizeType: 'FULLSIZE', size: 'M24' }, cls: 'C', gate: 'DG-1', ref: '§15 candidate FULLSIZE M24 → Ø25',
      note: 'candidate convention; scope unproven without the read-only historical export. Legacy 24 kept.' },
    { match: { type, material, sizeType: 'FULLSIZE', size: '1"' }, cls: 'C', gate: 'DG-1', ref: '§15 candidate 1" → Ø25',
      note: 'candidate convention; legacy 25.4 kept until scoped.' },
    { match: { type, material, sizeType: 'UNDERSIZE', size: 'M10' }, cls: 'C', gate: 'DG-1', ref: '§15 candidate UNDERSIZE M10 → Ø8.9/9.0',
      note: 'candidate convention (two values in the evidence); legacy 8.8 kept.' },
  ])),
  { match: { type: 'lbolt', material: '4140', sizeType: 'FULLSIZE', size: 'M27' }, cls: 'C', gate: 'DG-1',
    ref: '§15 candidate scoped 4140 QT L Bolt M27 → Ø28', note: 'scoped candidate; legacy 27 kept until the export proves the scope.' },
];

/* ── Developed length + weight, per product, through the REAL entry forms ── */
const weight = [
  { type: 'sagrod', f: { diameter: 10.6, length: 1000 }, note: 'normal rod: d² × L × 0.0000061654' },
  { type: 'sagrod', f: { diameter: 12, length: 1000 } },
  { type: 'sagrod', f: { diameter: 13, length: 1200 } },
  { type: 'stud', f: { diameter: 10.6, l: 300 } },
  { type: 'anchorbolt', f: { diameter: 20, l: 600 } },
  { type: 'ubolt', f: { diameter: 12, id: 64, ih: 85 }, note: 'U: ceil((d+ID)×1.57 + 2×IH − ID)' },
  { type: 'ubolt', f: { diameter: 10, id: 30, ih: 47 } },
  { type: 'squbolt', f: { diameter: 12, oh: 100, w: 80 }, note: 'SQ-U: ceil(((W/2+OH) − 1.5d) × 2)' },
  { type: 'lbolt', f: { diameter: 20, l: 1000, w: 100 }, note: 'L: ceil(L + W − 1.5d)' },
  { type: 'lbolt', f: { diameter: 24, l: 600, w: 150 } },
  { type: 'lbolt45', f: { diameter: 20, l: 1000, w: 100 }, note: 'L45: no auto developed length — total length stays manual (blank → 0 kg)' },
  { type: 'lbolt45', f: { diameter: 20, l: 1000, w: 100, length: 1080 }, note: 'L45 with a manual developed length' },
  { type: 'jbolt', f: { diameter: 20, h: 910, id: 60, s: 150 }, note: 'J: ceil((H−S) + (d+ID)×1.57 + 2(S−d) − ID)' },
  { type: 'jbolt', f: { diameter: 16, h: 500, id: 40, s: 100 } },
  { type: 'plate', f: { l: 200, w: 200, t: 10 }, plateType: 'ms_plate', note: 'plate: L × W × T × 0.00000785' },
  { type: 'plate', f: { 'tri-l': 180, 'tri-h': 180, 'tri-t': 8 }, plateType: 'triangle_plate', note: 'triangle plate: L × H × T × 0.00000785 (no ½)' },
  { type: 'ubolt', f: { diameter: 12, length: 800.5 }, skipAuto: true, note: 'manual total length is weighed ceil()ed' },
];

/* ── Pricing, through the REAL forms and resolvePriceMode ─────────────────── */
const pricing = [
  { type: 'sagrod', f: { diameter: 10.6, length: 1000, costRate: '2.80', addCost: '0.60', markup: '0' }, note: 'Sag Rod: weight × rate + add, × (1+markup), round05' },
  { type: 'sagrod', f: { diameter: 12, length: 1000, costRate: '3.50', addCost: '0.60', markup: '10' } },
  { type: 'sagrod', f: { diameter: 10.6, length: 1000, costRate: '2.80', addCost: '0.60', markup: '0' }, priceMode: 'no_round' },
  { type: 'sagrod', f: { diameter: 10.6, length: 1000, costRate: '2.80', addCost: '0.60', markup: '0', manualUnitPrice: '5.00' }, priceMode: 'manual' },
  { type: 'sagrod', f: { size: 'M12', diameter: 10.6, length: 1000, threadLen: '100/100', costRate: '2.80', addCost: '0.60', markup: '0' },
    material: 'MS', sizeType: 'UNDERSIZE', finish: 'PL', note: 'MS UNDERSIZE M12 PL TL 100/100 L1000 — price-list RM4.00 overrides the formula' },
  { type: 'sagrod', f: { size: 'M12', diameter: 10.6, length: 1200, threadLen: '100/100', costRate: '2.80', addCost: '0.60', markup: '0' },
    material: 'MS', sizeType: 'UNDERSIZE', finish: 'PL', note: 'price-list RM4.20 at L1200' },
  { type: 'sagrod', f: { size: 'M12', diameter: 10.6, length: 1200, threadLen: '100/100', costRate: '2.80', addCost: '0.60', markup: '0' },
    material: 'MS', sizeType: 'UNDERSIZE', finish: 'PL', priceMode: 'no_round', note: 'the price-list entry survives No Round' },
  { type: 'stud', f: { diameter: 10.6, l: 300, costRate: '6.00', addCost: '0.50', markup: '5' } },
  { type: 'anchorbolt', f: { diameter: 20, l: 600, costRate: '4.00', addCost: '1.00', markup: '0' } },
  { type: 'ubolt', f: { diameter: 12, id: 64, ih: 85, costRate: '5.00', addCost: '1.50', markup: '10' }, note: 'U-Bolt uses roundCustom10' },
  { type: 'lbolt', f: { diameter: 20, l: 1000, w: 100, costRate: '5.00', addCost: '4.00', markup: '4' } },
  { type: 'jbolt', f: { diameter: 20, h: 910, id: 60, s: 150, costRate: '5.00', addCost: '3.00', markup: '0' } },
  { type: 'squbolt', f: { diameter: 12, oh: 100, w: 80, costRate: '5.00', addCost: '1.00', markup: '0' } },
  { type: 'plate', f: { l: 200, w: 200, t: 10, costRate: '4.50', addCost: '0.50', markup: '0' }, plateType: 'ms_plate' },
  // accessories inside the final unit price
  { type: 'sagrod', f: { diameter: 10.6, length: 1000, costRate: '2.80', addCost: '0.60', markup: '0' },
    acc: { nut: { qty: '2', price: '0.50' } }, note: 'accessory-inclusive: final = rounded bolt + Σ accessories' },
  { type: 'lbolt', f: { diameter: 20, l: 1000, w: 100, costRate: '5.00', addCost: '4.00', markup: '4' },
    acc: { nut: { qty: '2', price: '1.00' }, fw: { qty: '1', price: '0.30' }, custom: { text: 'welding', price: '2.00' } } },
  { type: 'sagrod', f: { diameter: 10.6, length: 1000, costRate: '2.80', addCost: '0.60', markup: '0', manualUnitPrice: '10.00' },
    priceMode: 'manual', acc: { nut: { qty: '2', price: '1.00' } }, note: 'manual price is the CUSTOMER price; accessories come out of it (bolt RM8)' },
  { type: 'others', f: { productName: 'SPECIAL', dimensionText: 'X', diameter: 12, length: 500, costRate: '5.00', addCost: '0.33', markup: '3' },
    note: 'Others: no rounding rule — money2' },
];

/* ── WAS — the accessory markup exception ─────────────────────────────────── */
const was = [
  { f: { 'ab-diameter': 18, 'ab-length': 600, 'ab-qty': 4, 'bp-l': 250, 'bp-w': 250, 'bp-t': 12, 'bp-qty': 1,
         'tp-qty': 0, anchorCostRate: '4.00', basePlateCostRate: '3.50', addCost: '5.00', markup: '10' },
    acc: { nut: { qty: '2', price: '0.50' } },
    note: 'WAS: (base + add + ACCESSORIES) × (1+markup) → round05; accessories are marked up, unlike every other product' },
  { f: { 'ab-diameter': 18, 'ab-length': 600, 'ab-qty': 4, 'bp-l': 250, 'bp-w': 250, 'bp-t': 12, 'bp-qty': 1,
         'tp-l': 180, 'tp-h': 180, 'tp-t': 8, 'tp-qty': 4, anchorCostRate: '4.00', basePlateCostRate: '3.50',
         trianglePlateCostRate: '3.50', addCost: '5.00', markup: '0' } },
];

/* ── Accessories: how the entry form reads quantities ─────────────────────── */
const accessories = [
  { acc: { nut: { qty: '2', price: '0.50' } } },
  { acc: { nut: { qty: '', price: '0.50' } }, note: 'blank nut qty → default 2' },
  { acc: { fw: { qty: '', price: '0.30' } }, note: 'blank FW qty → default 1' },
  { acc: { nut: { qty: '0', price: '0.50' } }, cls: 'B', ref: '§18 / §34 C-5',
    expectedQty: { nut: 0 }, note: 'LOCKED bug fix: explicit 0 stays 0. Legacy parseFloat("0")||2 turns it into 2.' },
  { acc: { fw: { qty: '0', price: '0.30' } }, cls: 'B', ref: '§18 / §34 C-5',
    expectedQty: { fw: 0 }, note: 'LOCKED bug fix: explicit 0 stays 0. Legacy turns it into 1.' },
  { acc: { nut: { qty: '4', price: '0.25' }, fw: { qty: '2', price: '0.10' } } },
  { acc: { custom: { text: 'welding', price: '2.00' } } },
  { acc: { custom: { text: '4140 QT', price: '1.00' } }, note: 'custom text that is a material label is not printed as cw' },
];

/* ── Default price: CODE built-ins (production DB has 0 custom rows) ──────── */
const defaultPrice = [];
for (const [type, material, sizeType, s] of [
  ['sagrod', 'MS', 'FULLSIZE', 'M12'], ['sagrod', 'MS', 'FULLSIZE', 'M16'], ['sagrod', 'MS', 'FULLSIZE', '1/2'],
  ['sagrod', 'MS', 'UNDERSIZE', 'M12'], ['sagrod', 'MS', 'UNDERSIZE', 'M10'], ['sagrod', 'MS', 'UNDERSIZE', '1/2'],
  ['sagrod', '4140', 'FULLSIZE', 'M12'], ['sagrod', '4140', 'FULLSIZE', 'M16'], ['sagrod', '4140', 'UNDERSIZE', 'M12'],
  ['sagrod', '4140', 'UNDERSIZE', 'M16'], ['sagrod', '4140', 'FULLSIZE', 'M20'], ['sagrod', 'SS304', 'FULLSIZE', 'M12'],
  ['lbolt', 'MS', 'FULLSIZE', 'M20'], ['stud', 'MS', '', 'M12'],
]) for (const finish of ['PL', 'ZP', 'HDG']) defaultPrice.push({ type, material, sizeType, size: s, finish });
const defaultPriceOverrides = [
  // §16 LOCKED: MS FULLSIZE Sag Rod suggested Cost Rate.
  ...['M12', 'M16', '1/2'].flatMap(s => [
    { match: { type: 'sagrod', material: 'MS', sizeType: 'FULLSIZE', size: s, finish: 'PL' }, cls: 'B', ref: '§16', expectedCostRate: 3.50 },
    { match: { type: 'sagrod', material: 'MS', sizeType: 'FULLSIZE', size: s, finish: 'ZP' }, cls: 'B', ref: '§16', expectedCostRate: 5.00 },
    { match: { type: 'sagrod', material: 'MS', sizeType: 'FULLSIZE', size: s, finish: 'HDG' }, cls: 'B', ref: '§16 (HDG default 6.50; UI may show 6.50–7.00 typical, engine stores one number)', expectedCostRate: 6.50,
      note: 'Additional Cost 1.60 (HDG thread brushing) is legacy and is NOT restated by the owner; it is preserved (A) for the add-cost half of the rule.' },
  ]),
];
const tlSurcharge = ['', '100/100', '30', '29', '120', '120.5', '121', '200', '201', '50/150', '75/75', 'abc'];

/* ── Sag Rod TL as typed into the MANUAL form (addSagRod's own label) ────── */
const sagrodTL = [
  { threadLen: '100/100' }, { threadLen: '100', cls: 'B', ref: '§21', expectedTL: '100/100',
    note: 'Sag Rod threads both ends: single 100 canonicalises to 100/100. Legacy manual form prints "TL 100mm"; legacy Quick Add already reads 100 → 100/100 (see quickAdd.json).' },
  { threadLen: '70', cls: 'B', ref: '§21', expectedTL: '70/70' }, { threadLen: '' }, { threadLen: '75/50' },
];

/* ── Material ─────────────────────────────────────────────────────────────── */
const material = ['MS', 'S45C', 'S45C_HARDEN_G8_8', '4140', '4140_HARDEN_G10_9', '4140_PLAIN', '4340', 'SS304', 'SS316', 'Y_BAR'];

/* ── Output ───────────────────────────────────────────────────────────────── */
const ITEM = (over) => Object.assign({
  itemType: 'sagrod', productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE', finish: 'ZP',
  desc: 'MS UNDERSIZE SAG ROD', size: 'M12 x L 1000 x TL 100/100mm', cleanSize: 'M12', qty: 10,
  finalUnitPrice: 2.50, boltUnitPrice: 2.50, accessoryUnitPrice: 0, lineUnitPrice: 2.50, totalAmount: 25.00,
  pricingModel: 'accessory-inclusive', weight: 0.6928, accessories: null,
}, over);
const outputQuote = [
  ITEM({}),
  ITEM({ itemType: 'lbolt', productType: 'L BOLT', material: '4140', sizeType: 'FULLSIZE', finish: 'HDG', desc: '4140 QT FULLSIZE L BOLT',
    size: 'M20 x L 1000 x W 100 x TL 150mm', cleanSize: 'M20', qty: 4, finalUnitPrice: 33.40, boltUnitPrice: 31.10,
    accessoryUnitPrice: 2.30, lineUnitPrice: 33.40, totalAmount: 133.60,
    accessories: { nut: { enabled: true, qty: 2, unitPrice: 1.00 }, fw: { enabled: true, qty: 1, unitPrice: 0.30 }, custom: { enabled: false } } }),
  ITEM({ size: 'M12 x L 1000 x TL 100/100mm' }),            // identical to item 1
  ITEM({ itemType: 'stud', productType: 'STUD', material: 'S45C_HARDEN_G8_8', sizeType: '', finish: 'PL',
    desc: 'S45C + HARDEN = G8.8 STUD', size: 'M16 x L 300mm', cleanSize: 'M16', qty: 20, finalUnitPrice: 4.10,
    boltUnitPrice: 4.10, lineUnitPrice: 4.10, totalAmount: 82.00 }),
  ITEM({ itemType: 'stud', productType: 'STUD', material: '4140_HARDEN_G10_9', sizeType: '', finish: 'PL',
    desc: '4140 QT + HARDEN = G10.9 STUD', size: 'M20 x L 400mm', cleanSize: 'M20', qty: 5, finalUnitPrice: 9.90,
    boltUnitPrice: 9.90, lineUnitPrice: 9.90, totalAmount: 49.50 }),
  ITEM({ itemType: 'sagrod', material: 'SS304', finish: '', desc: 'SS304 FULLSIZE SAG ROD', sizeType: 'FULLSIZE',
    size: 'M10 x L 500 x TL 50/50mm', cleanSize: 'M10', qty: 2, finalUnitPrice: 6.00, boltUnitPrice: 6.00, lineUnitPrice: 6.00, totalAmount: 12.00 }),
];
const outputMeta = { customer: 'ACME ENGINEERING SDN BHD', refno: 'Q-2026-1317', date: '2026-10-21', prepby: 'Nicholas' };

/* ── Quick Add — the deterministic parser (wqaParseText) ──────────────────── */
const quickAdd = [
  'M12 x 1000 x 100/100 ZP 50pcs sag rod',
  'sag rod M12 undersize ZP\n1000mm x 50\n1200mm x 30',
  'MS UNDERSIZE SAG ROD M12 ZP\nL1000 TL 100/100 qty 100',
  'L bolt M20 x 1000 x 100 HDG 4140 qty 8',
  'J bolt M20 H910 ID60 S150 qty 10',
  'U bolt 1/2 ID 64 IH 85 HDG 20 pcs',
  'stud M16 x 300 8.8 qty 20',
  'stud M20 x 400 10.9 qty 5',
  'anchor bolt M20 x 600 c/w 2 nut 1 washer qty 12',
  'SS304 sag rod M10 x 500 TL 50/50 qty 4',
  'sagrod M12 1000 TL 100 qty 10',
  'J hook M10 L150 W50 TL50 qty 30',
  'eye bolt M12 L150 ID40 TL60 qty 6',
  'sag rod 1/2" BSW x 1000mm qty 25 HDG',
  'M16 sag rod fullsize\nthread length 70mm\n800 x 10\n900 x 10 thread length 50mm',
  '72 x 1000 sag rod qty 5',
  'sagrod 6 x 300 qty 10',
  'U-bolt M12 for 2" pipe qty 10',
];

/* ── Pricing history (PHP, pricing_history.php — DB-free) ─────────────────── */
// The records and the item being quoted are defined in history.php beside the
// PHP that ranks them; the golden is that script's JSON output.

module.exports = {
  rounding, size, diameter, diameterOverrides, weight, pricing, was, accessories,
  defaultPrice, defaultPriceOverrides, tlSurcharge, sagrodTL, material, outputQuote, outputMeta, quickAdd,
};
