/* ── The shared cores, loaded without a browser ────────────────────────────
   quo-parser-core.js, quo-pricing-core.js and quo-quote-core.js are classic
   scripts that share one global scope on the page. This loads them the same
   way — one after the other, in page order, into ONE context that holds
   nothing but the language — and returns everything the files export, plus
   the context itself.

   No document, no window, no network: if any file reaches for one, the
   load (or the first call) throws, which is the point.                      */
'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT  = path.resolve(__dirname, '..', '..');
const FILES = ['quo-parser-core.js', 'quo-pricing-core.js', 'quo-quote-core.js'];

function loadCores(root) {
  const base = root || ROOT;
  const sandbox = {};
  vm.createContext(sandbox);
  const api = {};
  for (const f of FILES) {
    sandbox.module = { exports: {} };
    vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), sandbox, { filename: f });
    Object.assign(api, sandbox.module.exports);
  }
  return { api, sandbox };
}

/* Price a scenario from tests/fixtures/pricing-scenarios.json the way the
   review screen does, with the core alone. Returns the rows. */
function priceScenario(api, sc) {
  api.quoParserCoreSetDiameterRules(sc.ds || []);
  const parsed = api.wqaParseText(sc.text);
  const rows = api.quoReviewRows(parsed);
  if (sc.tl) rows.forEach(r => {
    if (api.wqaRowMissing(r).indexOf('Thread') >= 0) {
      const p = api.wqaPairThread(sc.tl, api.wqaRowProduct(r));
      if (p.a) { r.threadLen = p.a; r.threadLen2 = p.b; }
    }
  });
  const put = (targets, p) => {
    const c = { costRate: p.costRate === undefined ? '' : p.costRate, addCost: p.addCost === undefined ? '' : p.addCost,
                markup: p.markup === undefined ? '' : p.markup, priceMode: p.mode || 'auto', manualUnitPrice: '' };
    api.wqaApplyPriceTo(targets, c, !!p.mode);
    if (p.mode === 'manual') targets.forEach(r => { r.priceMode = 'manual'; r.manualPrice = p.manual; });
  };
  if (sc.price) put(rows, sc.price);
  if (sc.rows) Object.keys(sc.rows).forEach(i => { if (rows[i]) put([rows[i]], sc.rows[i]); });
  if (sc.dia) Object.keys(sc.dia).forEach(i => { if (rows[i]) { rows[i].diaMm = sc.dia[i]; rows[i].diaManual = true; } });
  const detail = rows.map(r => api.quoPriceRow(r, parsed.common));
  return { rows, detail };
}

/* What a row's pricing came to, in one comparable shape. The page-side
   capture in tests/suites/79-pricing-core-parity.test.js builds the same one. */
function rowView(api, r) {
  return {
    product: api.wqaRowProduct(r), material: r.material, sizeType: r.sizeType, finish: r.finish, size: r.size,
    length: r.length, w: r.w, h: r.h, id: r.id, s: r.s, thread: api.wqaThreadValue(r), qty: r.qty,
    priceMode: r.priceMode, manualPrice: r.manualPrice, priceOverride: r.priceOverride,
    diaMm: r.diaMm === undefined ? null : r.diaMm, diaManual: !!r.diaManual, noDia: !!r.noDia,
    calc: r.calc ? { costRate: r.calc.costRate, addCost: r.calc.addCost, markup: r.calc.markup, weight: r.calc.weight,
                     boltUnitPrice: r.calc.boltUnitPrice, accessoriesCost: r.calc.accessoriesCost,
                     finalUnitPrice: r.calc.finalUnitPrice } : null,
    missing: api.wqaRowMissing(r), hasPricing: api.wqaRowHasPricing(r), accepted: api.wqaRowAccepted(r),
    shownPrice: api.wqaShownPrice(r) === undefined ? null : api.wqaShownPrice(r),
  };
}

module.exports = { loadCores, priceScenario, rowView, ROOT, FILES };
