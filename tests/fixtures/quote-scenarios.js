/* ── Quote core scenarios ──────────────────────────────────────────────────
   The matrix tests/core/quote-core.test.js and tests/suites/80-quote-core-
   item-parity.test.js / 81-quote-core-whatsapp-parity.test.js run, and the
   page-side drivers that push each scenario through the REAL add path and the
   REAL WhatsApp copy path of whichever index.php is being served.

   The recorded production answers are tests/fixtures/quote-baseline-ca5f0a5.json,
   captured from production commit ca5f0a5 (no shared core files) with these
   same drivers BEFORE the extraction. Regenerating it from a later commit
   would test nothing: a changed item or text is a behaviour change.

   Every customer, number and inquiry here is made up.                     */
'use strict';
const { loadCores } = require('../lib/core-node');

/* The fields each entry form carries, in the order the form holds them, with
   the value a fresh form starts at (read off the page). */
const FORM_DEFAULTS = {
  sagrod:     { material: 'MS', sizeType: 'FULLSIZE', size: 'M12', diameter: '', length: '', threadLen: '', costRate: '', addCost: '', markup: '', qty: '1', priceMode: 'no_round', manualUnitPrice: '' },
  stud:       { material: 'MS', size: 'M12', diameter: '', l: '', costRate: '', addCost: '', markup: '', qty: '1', priceMode: 'auto', manualUnitPrice: '' },
  anchorbolt: { material: 'MS', sizeType: 'FULLSIZE', size: 'M12', diameter: '', threadLen: '', l: '', costRate: '', addCost: '', markup: '', qty: '1', priceMode: 'auto', manualUnitPrice: '' },
  ubolt:      { material: 'MS', sizeType: 'FULLSIZE', size: 'M12', diameter: '', length: '', threadLen: '', id: '', ih: '', costRate: '', addCost: '', markup: '', qty: '1', priceMode: 'auto', manualUnitPrice: '' },
  squbolt:    { material: 'MS', sizeType: 'FULLSIZE', size: 'M12', diameter: '', length: '', threadLen: '', oh: '', w: '', costRate: '', addCost: '', markup: '', qty: '1', priceMode: 'auto', manualUnitPrice: '' },
  lbolt:      { material: 'MS', sizeType: 'FULLSIZE', size: 'M12', diameter: '', length: '', threadLen: '', l: '', w: '', costRate: '', addCost: '', markup: '', qty: '1', priceMode: 'auto', manualUnitPrice: '' },
  lbolt45:    { material: 'MS', sizeType: 'FULLSIZE', size: 'M12', diameter: '', length: '', threadLen: '', l: '', w: '', costRate: '', addCost: '', markup: '', qty: '1', priceMode: 'auto', manualUnitPrice: '' },
  jbolt:      { material: 'MS', sizeType: 'FULLSIZE', size: 'M12', diameter: '', length: '', threadLen: '', id: '', h: '', s: '', costRate: '', addCost: '', markup: '', qty: '1', priceMode: 'auto', manualUnitPrice: '' },
};

const NONE = () => ({ nut: { enabled: false, qty: 2, finish: '', unitPrice: 0 }, fw: { enabled: false, qty: 1, finish: '', unitPrice: 0 },
                      custom: { enabled: false, text: '', unitPrice: 0 } });
const ACC = {
  none:   NONE(),
  nut:    Object.assign(NONE(), { nut: { enabled: true, qty: 2, finish: '', unitPrice: 0.35 } }),
  fw:     Object.assign(NONE(), { fw: { enabled: true, qty: 1, finish: '', unitPrice: 0.12 } }),
  custom: Object.assign(NONE(), { custom: { enabled: true, text: 'SPRING WASHER', unitPrice: 0.2 } }),
  all:    { nut: { enabled: true, qty: 4, finish: '', unitPrice: 0.35 }, fw: { enabled: true, qty: 2, finish: '', unitPrice: 0.12 },
            custom: { enabled: true, text: 'SPRING WASHER', unitPrice: 0.2 } },
  matText: Object.assign(NONE(), { custom: { enabled: true, text: '4140 QT', unitPrice: 0.5 } }),
};

/* Typical dimensions per product. */
const DIMS = {
  sagrod:     { length: '1000', threadLen: '100/100' },
  stud:       { l: '300' },
  anchorbolt: { l: '600', threadLen: '100' },
  ubolt:      { id: '64', ih: '85', threadLen: '32' },
  squbolt:    { oh: '120', w: '80', threadLen: '50' },
  lbolt:      { l: '600', w: '100', threadLen: '100' },
  lbolt45:    { l: '600', w: '100', threadLen: '100', length: '680' },
  jbolt:      { h: '300', id: '50', s: '60', threadLen: '75' },
};

/* Fill in what the form itself would hold: the diameter autoFillDiameter
   writes, and the Total Length the L / J / U / SQ U calculators write. */
function complete(sc, api) {
  const t = sc.type, f = Object.assign({}, FORM_DEFAULTS[t], DIMS[t], sc.fields || {});
  api.quoParserCoreSetDiameterRules(sc.ds || []);
  if (!sc.fields || sc.fields.diameter === undefined) {
    const size = api.normalizeSizeValue(f.size);
    const asks = Object.prototype.hasOwnProperty.call(f, 'sizeType') && api.dcProductHasSizeType(t);
    const d = (asks && !String(f.sizeType || '').trim()) ? '' : api.dcEffectiveDiameter(t, f.material, f.sizeType || '', size);
    f.diameter = (d !== '' && d != null) ? String(d) : '';
  }
  const n = k => parseFloat(f[k]) || 0;
  const d = n('diameter');
  let lengthSrc;
  if (!sc.fields || sc.fields.length === undefined) {
    if (t === 'lbolt' && (n('l') > 0 || n('w') > 0 || d > 0)) { const a = api.dcLBoltTotalLength(d, n('l'), n('w')); f.length = a > 0 ? String(a) : ''; }
    if (t === 'jbolt' && (d > 0 || n('h') > 0 || n('id') > 0 || n('s') > 0)) { const a = api.dcJBoltTotalLength(d, n('h'), n('id'), n('s')); f.length = a > 0 ? String(a) : ''; }
    if (t === 'squbolt' && (d > 0 || n('oh') > 0 || n('w') > 0)) { const a = api.dcSQUBoltTotalLength(d, n('oh'), n('w')); f.length = a > 0 ? String(a) : ''; }
    if (t === 'ubolt') {
      if (d > 0 && n('id') > 0 && n('ih') > 0) { const a = api.dcUBoltTotalLength(d, n('id'), n('ih')); f.length = a > 0 ? String(a) : ''; lengthSrc = a > 0 ? 'auto' : ''; }
      else lengthSrc = '';
    }
  } else if (t === 'ubolt') lengthSrc = sc.lengthSrc === undefined ? 'manual' : sc.lengthSrc;
  /* What the finish radios say once updateFinishAvailability has run. */
  const finish = !api.dcMaterialHasFinish(f.material) ? '' : (sc.finish || 'PL');
  return { id: sc.id, type: t, fields: f, finish, accessories: sc.acc || NONE(), threadRef: sc.threadRef || '',
           lengthSrc, ds: sc.ds || null, expect: sc.expect || 'ok', edit: sc.edit || null };
}

function editorScenarios() {
  const { sandbox: api } = loadCores();   // every top-level name of the two cores
  const out = [];
  const add = sc => out.push(complete(sc, api));
  const TYPES = Object.keys(FORM_DEFAULTS);
  const price = { costRate: '5.20', addCost: '0.30', markup: '20' };
  /* 1. Every product x three material / finish / mode combinations. */
  const combos = [
    { m: 'MS', fin: 'PL', mode: 'auto', acc: 'none' },
    { m: '4140', fin: 'ZP', mode: 'no_round', acc: 'nut' },
    { m: 'SS304', fin: 'HDG', mode: 'manual', acc: 'all' },
    { m: 'MS', fin: 'HDG', mode: 'no_round', acc: 'fw' },
  ];
  for (const t of TYPES) combos.forEach((c, i) => add({
    id: t + '-combo-' + (i + 1), type: t, finish: c.fin, acc: ACC[c.acc],
    fields: Object.assign({ material: c.m, priceMode: c.mode, qty: String(10 * (i + 1)) }, price,
                          c.mode === 'manual' ? { manualUnitPrice: '12.35' } : {}),
  }));
  /* 2. Accessory shapes on two products. */
  for (const t of ['sagrod', 'lbolt']) for (const a of ['nut', 'fw', 'custom', 'all', 'matText']) add({
    id: t + '-acc-' + a, type: t, finish: 'ZP', acc: ACC[a], fields: Object.assign({ priceMode: 'auto', qty: '25' }, price),
  });
  /* 3. Sizes: inch, undersize, odd, custom and typed diameters, decimals. */
  const DS = [{ id: 1, type: 'sagrod', material: 'MS', sizeType: 'FULLSIZE', size: 'M16', diameter: 15.2 }];
  const sizes = [
    ['sagrod', { size: '1/2', sizeType: 'UNDERSIZE' }],
    ['sagrod', { size: '1/2', sizeType: 'FULLSIZE', length: '1200.5', threadLen: '75.5' }],
    ['anchorbolt', { size: '5/8', l: '450.25' }],
    ['stud', { size: '3/4', l: '250.5' }],
    ['lbolt', { size: '1"', l: '700', w: '120' }],
    ['jbolt', { size: '7/8', h: '410.5', id: '60', s: '80.5' }],
    ['ubolt', { size: 'M16', sizeType: 'UNDERSIZE', id: '118', ih: '150', threadLen: '' }],
    ['squbolt', { size: 'M20', oh: '200.5', w: '150', threadLen: '' }],
    ['lbolt', { size: 'M24', diameter: '21.7' }],
    ['sagrod', { size: 'M12', diameter: '11.5' }],
    ['anchorbolt', { size: 'M20', diameter: '17.6', sizeType: 'UNDERSIZE' }],
    ['sagrod', { size: 'm16' }, DS],
    ['sagrod', { size: 'M16', length: '6000', threadLen: '' }, DS],
    ['jbolt', { size: 'M10', h: '150', id: '25', s: '40', threadLen: '' }],
    ['ubolt', { size: 'M12', id: '64', ih: '85', length: '420.4' }],
    ['lbolt45', { size: 'M16', l: '500', w: '80', length: '575' }],
  ];
  sizes.forEach(([t, f, ds], i) => add({ id: t + '-size-' + (i + 1), type: t, ds, finish: 'PL',
    fields: Object.assign({ priceMode: 'auto', qty: '12' }, price, f) }));
  /* 4. Price modes and rates written the ways people write them. */
  const rates = [
    ['sagrod', { costRate: '3+0.8', addCost: '0.5', markup: '15.5', priceMode: 'auto' }],
    ['sagrod', { costRate: '4.10', addCost: '', markup: '', priceMode: 'no_round' }],
    ['stud', { costRate: '6', addCost: '1.25', markup: '0', priceMode: 'no_round' }],
    ['lbolt', { costRate: '5.20', addCost: '0.30', markup: '20', priceMode: 'manual', manualUnitPrice: '9.99' }],
    ['jbolt', { costRate: '', addCost: '', markup: '', priceMode: 'manual', manualUnitPrice: '7.40' }],
    ['ubolt', { costRate: '5.5', addCost: '0.8', markup: '12.5', priceMode: 'auto' }],
    ['anchorbolt', { costRate: '1,200', addCost: '0', markup: '', priceMode: 'auto' }],
  ];
  rates.forEach(([t, f], i) => add({ id: t + '-rate-' + (i + 1), type: t, finish: 'ZP', acc: i % 2 ? ACC.nut : ACC.none,
    fields: Object.assign({ qty: '8' }, f) }));
  /* 5. Thread references. */
  add({ id: 'sagrod-threadref-pitch', type: 'sagrod', threadRef: '1.75P', fields: Object.assign({ qty: '5' }, price) });
  add({ id: 'sagrod-threadref-series', type: 'sagrod', threadRef: 'UNC', fields: Object.assign({ qty: '5', size: '1/2', sizeType: 'UNDERSIZE' }, price) });
  /* 6. Refusals, each product's own. */
  const refuse = [
    ['sagrod', { size: '' }, 'size_missing'],
    ['sagrod', { diameter: '' }, 'diameter_missing'],
    ['sagrod', { length: '' }, 'length_missing'],
    ['sagrod', { length: '-50' }, 'dim_not_positive'],
    ['sagrod', { costRate: '' }, 'rate_blank'],
    ['sagrod', { costRate: '-2' }, 'rate_negative'],
    ['sagrod', { costRate: 'abc', addCost: '-1' }, 'rate_unreadable'],
    ['sagrod', { addCost: '2,80' }, 'rate_unreadable'],
    ['sagrod', { qty: '0' }, 'qty_min'],
    ['sagrod', { qty: '1.5' }, 'qty_not_whole'],
    ['sagrod', { qty: '2000000' }, 'qty_too_large'],
    ['sagrod', { priceMode: 'manual', manualUnitPrice: '' }, 'manual_price_invalid'],
    ['sagrod', { priceMode: 'manual', manualUnitPrice: '-3' }, 'manual_price_invalid'],
    ['sagrod', { costRate: '0', addCost: '0.5' }, 'price_not_accepted'],
    ['stud', { l: '' }, 'l_missing'],
    ['stud', { size: 'M23', diameter: '' }, 'diameter_missing'],
    ['stud', { costRate: '' }, 'rate_blank'],
    ['anchorbolt', { l: '' }, 'l_missing'],
    ['anchorbolt', { sizeType: '' }, 'diameter_missing'],
    ['ubolt', { id: '', length: '' }, 'ubolt_geometry_incomplete'],
    ['ubolt', { id: '-5', length: '300' }, 'id_ih_negative'],
    ['ubolt', { id: '', ih: '85', length: '300' }, 'ok'],
    ['ubolt', { addCost: '' }, 'add_cost_blank'],
    ['squbolt', { oh: '' }, 'ohw_missing'],
    ['squbolt', { length: '0' }, 'total_length_missing'],
    ['lbolt', { w: '' }, 'lw_missing'],
    ['lbolt', { length: '' }, 'total_length_missing'],
    ['lbolt', { costRate: '' }, 'rate_blank'],
    ['lbolt45', { length: '' }, 'total_length_missing'],
    ['jbolt', { s: '' }, 'hids_missing'],
    ['jbolt', { h: '-10' }, 'dim_not_positive'],
    ['jbolt', { addCost: '' }, 'add_cost_blank'],
  ];
  refuse.forEach(([t, f, code], i) => add({ id: t + '-refuse-' + (i + 1), type: t, expect: code,
    fields: Object.assign({ qty: '3', priceMode: 'auto' }, price, f) }));
  /* 7. Edits of an item already in the quotation (browser only): custom
     dimensions, the item's identity, and a saved price that stands. */
  add({ id: 'edit-custom-dims', type: 'lbolt', fields: Object.assign({ qty: '4' }, price),
        edit: { customDimensions: [{ label: 'H2', value: '530' }, { label: ' A ', value: ' 120 ' }, { label: '', value: '' }], fields: { qty: '6' } } });
  add({ id: 'edit-reprice', type: 'sagrod', fields: Object.assign({ qty: '4' }, price),
        edit: { fields: { markup: '35' } } });
  add({ id: 'edit-saved-price-stands', type: 'stud', fields: Object.assign({ qty: '4' }, price),
        edit: { savedPrice: 99.9, fields: { qty: '7' } } });
  return out;
}

/* Quick Add: pasted text, priced the way the review screen prices it, added
   with Add All. */
const QUICK_ADD = [
  { id: 'qa-sagrod', text: 'MS SAG ROD FULLSIZE ZP\nM12 x 1000 TL100/100 - 40pcs\nM12 x 1200 TL100/100 - 20pcs',
    price: { costRate: '5.20', addCost: '0.30', markup: '20' } },
  { id: 'qa-lbolt', text: 'G8.8 L-BOLT FULLSIZE PLAIN\nM20 L600 W100 TL100 154PCS', price: { costRate: '6.10', addCost: '0.50', markup: '15' } },
  { id: 'qa-mixed', text: 'MS ANCHOR BOLT HDG FULLSIZE M24 X 600 TL100 - 16pcs\nMS STUD M16 x 300 - 50pcs\nMS J BOLT FULLSIZE ZP M12 H300 ID50 S60 TL75 - 10pcs',
    price: { costRate: '5.00', addCost: '0.40', markup: '10' } },
  { id: 'qa-manual', text: 'MS SAG ROD UNDERSIZE ZP M12 TL70/70\n1200 - 40pcs', price: { mode: 'manual', manual: '4.85' } },
];

/* ── Drivers, run INSIDE the page (passed to page.evaluate) ─────────────── */

/* One entry-form scenario through the real add button path. Works on any
   index.php that has the entry forms: production and the extracted page. */
function pageDriveEditor(sc) {
  const t = sc.type;
  quoteItems.length = 0;
  if (editingItemIndex !== null) setItemEditMode(null);
  dcPaGrant = null;
  const put = (fields) => {
    Object.keys(fields).forEach(k => { const e = document.getElementById(t + '-' + k); if (e) e.value = fields[k]; });
    const len = document.getElementById(t + '-length');
    if (t === 'ubolt' && len) len.dataset.src = sc.lengthSrc || '';
  };
  switchType(t);
  resetAccPanel(t);
  dcClearCustomDims();
  put(sc.fields);
  setFinishValue(t, sc.finish);
  loadAccIntoForm(t, sc.accessories);
  recalcCurrent(true);
  dcSetItemThreadRef(sc.threadRef);
  const run = () => { dcToastCapture = []; addCurrentItem(); const s = dcToastCapture; dcToastCapture = null; return s; };
  let toasts = run();
  if (sc.edit && quoteItems.length) {
    quoteItems[0].item_uid = 'uid-test-0001';
    if (sc.edit.savedPrice) { quoteItems[0].finalUnitPrice = sc.edit.savedPrice; quoteItems[0].lineUnitPrice = sc.edit.savedPrice; }
    editItem(0);
    if (sc.edit.customDimensions) dcSetCustomDims(sc.edit.customDimensions);
    Object.keys(sc.edit.fields || {}).forEach(k => { const e = document.getElementById(t + '-' + k); if (e) e.value = sc.edit.fields[k]; });
    recalcCurrent(true);
    toasts = toasts.concat(['--edit--'], run());
  }
  return { items: JSON.parse(JSON.stringify(quoteItems)), toasts };
}

/* Quick Add: paste, price, Add All. Returns the items, plus a copy of each
   live row taken just before the add (for the row adapter). */
async function pageDriveQuickAdd(sc) {
  quoteItems.length = 0;
  const live = () => wqa.rows.filter(r => !r.removed);
  const c = { costRate: sc.price.costRate || '', addCost: sc.price.addCost || '', markup: sc.price.markup || '',
              priceMode: sc.price.mode || 'auto', manualUnitPrice: '' };
  wqaApplyPriceTo(live(), c, !!sc.price.mode);
  if (sc.price.mode === 'manual') live().forEach(r => { r.priceMode = 'manual'; r.manualPrice = sc.price.manual; });
  await wqaRecomputeAll();
  const rows = live().map(r => JSON.parse(JSON.stringify(r)));
  const common = JSON.parse(JSON.stringify(wqa.common));
  await wqaAddAll();
  return { items: JSON.parse(JSON.stringify(quoteItems)), rows, common };
}

/* ── WhatsApp scenarios ──────────────────────────────────────────────────
   Items are named by editor scenario id (the item that scenario stored in
   production) or given in full (older vintages, plate, Welding Anchor Set). */
const LEGACY_ITEMS = {
  boltSeparate: { itemType: 'sagrod', desc: 'MS FULLSIZE SAG ROD', finish: 'ZP', size: 'M12 x L 1000 x TL 100/100mm', qty: 10, markup: 0,
                  material: 'MS', sizeType: 'FULLSIZE', productType: 'SAG ROD', cleanSize: 'M12', weight: 0.8878,
                  accessories: { nut: { enabled: true, qty: 2, finish: '', unitPrice: 0.35 }, fw: { enabled: false, qty: 1, finish: '', unitPrice: 0 }, custom: { enabled: false, text: '', unitPrice: 0 } },
                  finalUnitPrice: 5.4, lineUnitPrice: 6.1, accessoryUnitPrice: 0.7, totalAmount: 61, pricingModel: 'bolt-separate' },
  legacy:       { itemType: 'stud', desc: 'MS STUD', finish: 'PL', size: '1/2 x L 300mm', qty: 3, material: 'MS', productType: 'STUD',
                  finalUnitPrice: 2.456, totalAmount: 7.37, weight: 0 },
  noType:       { desc: 'SPECIAL ITEM (ZP)', size: 'AS DRAWING', qty: 1, finalUnitPrice: 15, totalAmount: 15 },
  plate:        { itemType: 'plate', desc: 'MS PLATE', finish: 'HDG', size: '100 x 100 x 10mm', qty: 20, material: 'MS', productType: 'PLATE',
                  formData: { plateType: 'ms_plate' }, finalUnitPrice: 3.1, totalAmount: 62, weight: 0.785 },
  triangle:     { itemType: 'plate', plateType: 'triangle_plate', desc: 'MS PLATE', finish: '', size: '80 x 80 x 8mm', qty: 8, material: 'MS',
                  finalUnitPrice: 1.2, totalAmount: 9.6, weight: 0.2 },
  was:          { itemType: 'was', desc: 'WELDING ANCHOR SET', finish: 'HDG', material: '4140', qty: 4,
                  size: 'M20 x L 600 x TL 100mm\nBase Plate: 150 x 150 x 10mm\nTriangle Plate: 80 x 80 x 8mm',
                  formData: { trianglePlateQtyPerSet: 0 },
                  accessories: { nut: { enabled: true, qty: 4, finish: '', unitPrice: 0.5 }, fw: { enabled: true, qty: 2, finish: '', unitPrice: 0.1 }, custom: { enabled: true, text: 'GROUT', unitPrice: 1 } },
                  finalUnitPrice: 48.5, totalAmount: 194, weight: 5.2 },
  longDesc:     { itemType: 'others', desc: 'S45C FULLSIZE CUSTOM MACHINED HEX HEAD BOLT WITH SHOULDER AND CROSS HOLE', productType: 'CUSTOM MACHINED HEX HEAD BOLT WITH SHOULDER AND CROSS HOLE',
                  material: 'S45C', sizeType: 'FULLSIZE', finish: 'ZP', size: 'M30 x L 450 x SHOULDER 60 x HOLE 8 AT 25 FROM END', qty: 2,
                  finalUnitPrice: 88.88, totalAmount: 177.76, weight: 2.5,
                  customDimensions: [{ label: 'H2', value: '530' }] },
};
const HEADER = { customer: 'Synthetic Trading Sdn Bhd', refno: 'Q-TEST-0001', date: '2026-01-15', prepby: 'Test Staff' };
const CUSTOM_TPL = 'Dear {customer}\n{quotationNo}\nRef {no} on {date}\nValid until {validUntil}\n\n\n\n{items}\n\nTOTAL RM{total} - {preparedBy}\n{unknown}';
const WA = [
  { id: 'wa-single', items: ['sagrod-combo-1'] },
  { id: 'wa-one-product-many', items: ['sagrod-combo-1', 'sagrod-acc-nut', 'sagrod-size-1', 'sagrod-size-2', 'sagrod-rate-1', 'sagrod-combo-1'] },
  { id: 'wa-mixed', items: ['lbolt-combo-1', 'sagrod-combo-2', 'jbolt-combo-3', 'lbolt-combo-1', 'stud-combo-1', 'ubolt-combo-2', 'squbolt-combo-4', 'anchorbolt-combo-1', 'lbolt45-combo-2'] },
  { id: 'wa-merge-identical', items: ['sagrod-acc-nut', 'lbolt-combo-1', 'sagrod-acc-nut', 'sagrod-acc-nut', 'lbolt-combo-1'] },
  { id: 'wa-same-cw-group', items: ['sagrod-acc-nut', 'sagrod-size-1', 'sagrod-combo-1'] },
  { id: 'wa-manual-acc', items: ['sagrod-combo-3', 'lbolt-acc-all', 'lbolt-acc-matText', 'lbolt-acc-custom', 'sagrod-acc-fw'] },
  { id: 'wa-weight', items: ['sagrod-combo-1', 'stud-size-4', 'jbolt-combo-1'], weight: true },
  { id: 'wa-custom-dims', items: ['edit-custom-dims', 'lbolt-combo-1'], legacy: ['longDesc'] },
  { id: 'wa-vintages', items: ['sagrod-combo-1'], legacy: ['boltSeparate', 'legacy', 'noType', 'plate', 'triangle', 'was', 'was', 'longDesc'] },
  { id: 'wa-custom-template', items: ['sagrod-combo-1', 'lbolt-combo-2'], template: CUSTOM_TPL },
  { id: 'wa-missing-header', items: ['stud-combo-2'], header: { customer: '', refno: '', date: '', prepby: '' } },
  { id: 'wa-revision', items: ['anchorbolt-combo-2'], template: 'Hi {customer},\n  {quotationNo}\nNo {no}\n{items}\nTotal {total}', revision: 2 },
  { id: 'wa-empty', items: [] },
];

/* One WhatsApp scenario on the page: the items as stored, the header boxes,
   the template the server sent, then every output the page makes from them. */
function pageDriveWA(sc) {
  quoteItems.length = 0;
  sc.items.forEach(i => quoteItems.push(JSON.parse(JSON.stringify(i))));
  const h = sc.header;
  [['qi-customer', h.customer], ['qi-refno', h.refno], ['qi-date', h.date], ['qi-prepby', h.prepby]]
    .forEach(([id, v]) => { const e = document.getElementById(id); if (e) e.value = v; });
  waTemplateCache = sc.template;
  if (sc.revision) { editingQuoteId = 990001; dcQuoteRevisionFor = 990001; dcQuoteRevision = sc.revision; }
  else { editingQuoteId = null; dcQuoteRevisionFor = null; dcQuoteRevision = 0; }
  const out = {
    copy: buildQuoteText(false),
    copyWeight: buildQuoteText(true),
    merged: buildWAItemsText('-', true, false),
    mergedWeight: buildWAItemsText('-', true, true),
    unmerged: buildWAItemsText('-', false, false),
    previewItems: buildWAItemsText('(No items yet)'),
  };
  editingQuoteId = null; dcQuoteRevisionFor = null; dcQuoteRevision = 0;
  return out;
}

/* The production items a WhatsApp scenario is made of. */
function waItems(sc, itemsById) {
  const list = sc.items.map(id => {
    const b = itemsById[id];
    if (!b || !b.items || !b.items.length) throw new Error('no stored item for ' + id);
    return b.items[b.items.length - 1];
  });
  (sc.legacy || []).forEach(k => list.push(LEGACY_ITEMS[k]));
  return list;
}
function waScenarios(itemsById) {
  return WA.map(sc => ({ id: sc.id, items: waItems(sc, itemsById), header: sc.header || HEADER,
                         template: sc.template === undefined ? null : sc.template, revision: sc.revision || 0, weight: !!sc.weight }));
}

/* The one value that differs on every run: when the price was accepted. */
function normaliseItem(item) {
  const c = JSON.parse(JSON.stringify(item));
  if (c.priceAcceptance && typeof c.priceAcceptance.at === 'string') c.priceAcceptance.at = '<at>';
  return c;
}

module.exports = { FORM_DEFAULTS, ACC, editorScenarios, QUICK_ADD, pageDriveEditor, pageDriveQuickAdd,
                   pageDriveWA, waScenarios, LEGACY_ITEMS, HEADER, normaliseItem };
