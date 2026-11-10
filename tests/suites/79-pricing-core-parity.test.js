/* ── Pricing core parity ────────────────────────────────────────────────────
   Quick Add prices a review row by writing it into the product form and
   running that product's calculator (wqaRecomputeAll). quo-pricing-core.js
   also carries quoPriceRow, which prices the same row with no form, for hosts
   that have none (DNC Quick Quote). The two must never disagree.

   For a spread of the scenarios in tests/fixtures/pricing-scenarios.json this
   prices every row BOTH ways in the real page and compares what each leaves on
   the row: the calculation, the missing-diameter flag and the diameter. The
   full list is checked against the recorded production figures without a
   browser by tests/core/pricing-core.test.js.

   Every inquiry in the fixture is made up.                                 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { openApp, quickAddPaste } = require('../lib/harness');

const ALL = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'pricing-scenarios.json'), 'utf8'));
/* Every custom-diameter and per-row scenario, and every fourth of the rest. */
const PICK = ALL.filter((sc, i) => sc.ds || sc.rows || sc.dia || sc.tl || i % 4 === 0);

module.exports = async (browser, A) => {
  A.suite('pricing core — the form and quoPriceRow agree');
  const pages = {};
  const pageFor = async (ds) => {
    const key = ds ? JSON.stringify(ds) : '';
    if (!pages[key]) pages[key] = await openApp(browser, ds ? { api: { get_diameter_settings: { ok: true, data: ds } } } : {});
    return pages[key];
  };
  let rows = 0, priced = 0;
  for (const sc of PICK) {
    const page = await pageFor(sc.ds);
    await quickAddPaste(page, sc.text, { settle: 200 });
    const got = await page.evaluate(async (sc) => {
      const live = () => wqa.rows.filter(r => !r.removed);
      if (sc.tl) live().forEach(r => { if (wqaRowMissing(r).indexOf('Thread') >= 0) {
        const p = wqaPairThread(sc.tl, wqaRowProduct(r)); if (p.a) { r.threadLen = p.a; r.threadLen2 = p.b; } } });
      const put = (targets, p) => {
        const c = { costRate: p.costRate === undefined ? '' : p.costRate, addCost: p.addCost === undefined ? '' : p.addCost,
                    markup: p.markup === undefined ? '' : p.markup, priceMode: p.mode || 'auto', manualUnitPrice: '' };
        wqaApplyPriceTo(targets, c, !!p.mode);
        if (p.mode === 'manual') targets.forEach(r => { r.priceMode = 'manual'; r.manualPrice = p.manual; });
      };
      if (sc.price) put(live(), sc.price);
      if (sc.rows) Object.keys(sc.rows).forEach(i => { if (live()[i]) put([live()[i]], sc.rows[i]); });
      if (sc.dia) Object.keys(sc.dia).forEach(i => { const r = live()[i]; if (r) { r.diaMm = sc.dia[i]; r.diaManual = true; } });
      /* The form-free copy is taken BEFORE the form prices the row, so it
         starts from exactly what the form starts from. */
      const copies = live().map(r => JSON.parse(JSON.stringify(r)));
      await wqaRecomputeAll();
      const view = r => JSON.stringify({
        calc: r.calc ? { costRate: r.calc.costRate, addCost: r.calc.addCost, markup: r.calc.markup, weight: r.calc.weight,
                         boltUnitPrice: r.calc.boltUnitPrice, accessoriesCost: r.calc.accessoriesCost,
                         finalUnitPrice: r.calc.finalUnitPrice } : null,
        noDia: !!r.noDia, diaMm: r.diaMm === undefined ? null : r.diaMm,
        missing: wqaRowMissing(r), accepted: wqaRowAccepted(r) });
      return live().map((r, i) => { quoPriceRow(copies[i], wqa.common); return { form: view(r), core: view(copies[i]), priced: !!r.calc }; });
    }, sc);
    await page.evaluate(() => { try { wqaHardClose(); } catch (e) {} });
    got.forEach((g, i) => { rows++; if (g.priced) priced++; A.eq(g.core, g.form, sc.id + ' row ' + (i + 1)); });
  }
  A.ok(rows >= 150 && priced >= 120, 'coverage: ' + rows + ' rows compared, ' + priced + ' of them priced');
  const errs = Object.values(pages).flatMap(p => p._dcErrors || []);
  A.eq(errs.length, 0, 'no page errors while pricing' + (errs.length ? ': ' + errs[0] : ''));
  for (const p of Object.values(pages)) await p.close();
};
