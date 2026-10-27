/* Quick edit + alignment + accessory intelligence — owner-review screenshots.
   Every shot is the shipped page driven through its own code.
   Run:  node tests/quickedit-shots.js [outdir]                              */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp, quickAddPaste } = require('./lib/harness');

const OUT = process.argv[2] || path.join(__dirname, '..', 'quickedit-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const SMOKE = 'Morning CL, can you help me quote this price? Thank you.\nM/S SAGROD UNDERSIZE (ZP)\nM12 X TL70/70\n940 - 43pcs\n970 - 91pcs\n1050 - 8pcs\n1230 - 8 pcs\n1290 - 8pcs\n\ncw 4nuts & 4fw';
const UNEQ = 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x 70/200 - 2pcs\nM12 x 1100 x 70/70 - 2pcs';
const HIST = [
  { type: 'Nut', size: 'M12', finish: 'ZP', unitPrice: 0.20, refNo: 'Q-2026-1365', date: '2026-10-26', customer: 'LEY' },
  { type: 'Nut', size: 'M12', finish: 'ZP', unitPrice: 0.15, refNo: 'Q-2026-1057', date: '2026-10-02', customer: 'CH YODOFORM' },
  { type: 'Nut', size: 'M12', finish: 'ZP', unitPrice: 0.15, refNo: 'Q-2026-0586', date: '2026-08-18', customer: 'CH YODOFORM' },
  { type: 'Nut', size: 'M12', finish: 'PL', unitPrice: 0.15, refNo: 'Q-2026-0901', date: '2026-09-02', customer: 'ABC HARDWARE' },
  { type: 'Nut', size: 'M12', finish: '', unitPrice: 0.15, refNo: 'Q-2026-0700', date: '2026-08-02', customer: 'XYZ ENGINEERING' },
  { type: 'Nut', size: 'M12', finish: '', unitPrice: 0.15, refNo: 'Q-2026-0655', date: '2026-07-21', customer: 'XYZ ENGINEERING' },
];
const FW = [
  { type: 'Flat Washer', size: 'M12', finish: 'ZP', unitPrice: 0.10, refNo: 'Q-2026-1301', date: '2026-10-12', customer: 'DELTA STEEL' },
  { type: 'Flat Washer', size: 'M12', finish: 'HDG', unitPrice: 0.12, refNo: 'Q-2026-1188', date: '2026-09-21', customer: 'KL FASTENERS' },
];

let browser;
const open = async (w, h) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h || 1000 } });
  const p = await openApp(browser, { context: ctx, api: { get_accessory_history: url => {
    const q = Object.fromEntries(new URL(url).searchParams.entries());
    const recs = q.type === 'nut' ? HIST : q.type === 'fw' ? FW : [];
    return { ok: true, data: { total: recs.length, records: recs } };
  } } });
  p.on('dialog', d => d.accept().catch(() => {}));
  p._ctx = ctx;
  return p;
};
const shot = async (p, name, sel, opts = {}) => {
  await p.waitForTimeout(opts.wait == null ? 2700 : opts.wait);      // let the toast go
  const t = sel ? await p.$(sel) : null;
  await (t || p).screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  ' + name + '.png');
};
const modal = '#wqaModal .wqa-modal';
const zh = p => p.evaluate(() => dcSetLang('zh'));
const top = (p, sel) => p.evaluate(s => { const n = document.querySelector(s); if (n) n.scrollIntoView({ block: 'start' }); }, sel);
const setGacc = async (p, k, f, v) => { await p.fill(`[data-gacc="${k}"] [data-gacc-f="${f}"]`, v); await p.press(`[data-gacc="${k}"] [data-gacc-f="${f}"]`, 'Tab'); await p.waitForTimeout(700); };

(async () => {
  browser = await launch();
  try {
    // 1 · 2 · 3 · 5 · 12 · 13 · 14 · 16 · 17 · 18 · appendix 1–5 — desktop smoke
    {
      const p = await open(1440);
      await quickAddPaste(p, SMOKE, { expanded: false, settle: 1100 });
      await shot(p, '12-accessory-detected-nut4-fw4', modal, { wait: 400 });
      await shot(p, '01-desktop-group-header-direct-edit-values', '.wqa-ser .wqa-ser-head', { wait: 100 });
      await shot(p, '05-desktop-5-row-aligned-grid', '.wqa-ser', { wait: 100 });
      await shot(p, '13-A1-group-accessory-editor-history-counts', '.wqa-ser .wqa-gacc', { wait: 100 });
      await shot(p, '14-accessory-finish-default-from-main-ZP', '.wqa-ser .wqa-gacc', { wait: 100 });
      await p.click('.wqa-ser .wqa-ser-head [data-gx="dia"]'); await p.waitForTimeout(200);
      await p.fill('#wqaRows [data-gx-in="dia"]', '10.5');
      await shot(p, '02-group-dia-direct-edit-active', '.wqa-ser .wqa-ser-head', { wait: 200 });
      await p.press('#wqaRows [data-gx-in="dia"]', 'Enter'); await p.waitForTimeout(600);
      await p.click('.wqa-ser .wqa-ser-head [data-gx="costRate"]'); await p.waitForTimeout(200);
      await p.fill('#wqaRows [data-gx-in="costRate"]', '4.50');
      await shot(p, '03-group-cost-direct-edit-active', '.wqa-ser .wqa-ser-head', { wait: 200 });
      await p.press('#wqaRows [data-gx-in="costRate"]', 'Enter'); await p.waitForTimeout(600);
      await shot(p, '03b-after-group-dia-10.5-and-cost-4.50', '.wqa-ser');
      await p.click('[data-gacc="nut"] .wqa-gacc-hist'); await p.waitForTimeout(800);
      await shot(p, '16-A2-inline-nut-history-Nut-M12-ZP', '.wqa-ser .wqa-gacc', { wait: 200 });
      await shot(p, '17-same-price-split-ZP-PL-NA', '[data-gacc="nut"] ~ .wqa-gacc-hp, .wqa-gacc-hp', { wait: 100 });
      await shot(p, '18-A3-same-vs-different-finish-labels', '[data-gacc="nut"] .wqa-gacc-hp', { wait: 100 }).catch(() => {});
      await p.click('[data-gacc="nut"] [data-acc-finish="PL"] .ph-rec-use'); await p.waitForTimeout(700);
      await p.evaluate(() => { wqa.accH = null; wqaRenderRows(true); });
      await shot(p, 'A4-applied-historical-PL-price-finish-stays-ZP', '.wqa-ser .wqa-gacc');
      await setGacc(p, 'nut', 'unitPrice', '0.18');
      await setGacc(p, 'fw', 'unitPrice', '0.10');
      await p.evaluate(() => wqaEditAcc(2, 'nut', 'qty', '6')); await p.waitForTimeout(600);
      await p.evaluate(() => wqaRenderRows(true));
      await shot(p, '19-A5-A6-group-default-and-row3-override-nut6', '.wqa-ser');
      await p.selectOption('[data-gacc="nut"] [data-gacc-f="finish"]', ''); await p.waitForTimeout(600);
      await shot(p, '15-accessory-finish-manually-overridden-NA', '.wqa-ser .wqa-gacc');
      // 20 — the price proof on an L Bolt: RM3.40 rod + 4 × 0.18 + 4 × 0.10
      await p.evaluate(() => { wqaHardClose(); switchType('lbolt'); setFieldValue('lbolt', 'priceMode', 'auto');
        resolvePriceMode('lbolt', 3.43, 0, accAddon({ nut: { enabled: true, qty: 4, unitPrice: 0.18 }, fw: { enabled: true, qty: 4, unitPrice: 0.10 } }));
        const st = priceCalcState.lbolt, box = document.getElementById('priceModePreview');
        const c = document.createElement('div'); c.className = 'shot-caption';
        c.style.cssText = 'font:700 13px system-ui;color:#1e3a8a;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:6px 10px;margin:0 0 8px';
        c.textContent = 'L Bolt · raw RM' + st.rawUnitPrice.toFixed(2) + ' → Auto Round RM' + st.boltUnitPrice.toFixed(2)
          + ' · + Nut 4 × RM0.18 + FW 4 × RM0.10 = RM' + st.accessoriesCost.toFixed(2) + ' · Final RM' + st.finalUnitPrice.toFixed(2) + ' (not re-rounded)';
        box.parentNode.insertBefore(c, box); c.parentNode.scrollIntoView({ block: 'center' }); });
      await p.waitForTimeout(400);
      const wrap = await p.evaluateHandle(() => { const c = document.querySelector('.shot-caption'), b = document.getElementById('priceModePreview');
        const w = document.createElement('div'); w.style.cssText = 'padding:10px;background:#fff;display:inline-block;min-width:640px';
        c.parentNode.insertBefore(w, c); w.appendChild(c); w.appendChild(b); w.scrollIntoView({ block: 'center' }); return w; });
      await wrap.screenshot({ path: path.join(OUT, '20-accessories-added-after-main-rounding-4.52.png') });
      console.log('  20-accessories-added-after-main-rounding-4.52.png');
      await p._ctx.close();
    }
    // 4 — single-row quick edit
    {
      const p = await open(1440);
      await quickAddPaste(p, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x 70/70 - 20pcs\n\nMS STUD PL\nM16 x 300 - 5pcs', { expanded: false, settle: 1000 });
      await p.click('[data-wqa-row="1"] .wqa-it-main [data-gx="addCost"]'); await p.waitForTimeout(200);
      await p.fill('#wqaRows [data-gx-in="addCost"]', '0.70');
      await shot(p, '04-single-row-quick-edit-add-cost', '#wqaRows', { wait: 200 });
      await p._ctx.close();
    }
    // 6 · 7 · 8 · 9 · appendix 7 · 8
    for (const [w, name, lang] of [[820, '06-tablet-820-aligned-grid', 'en'], [390, '07-mobile-390-aligned-grid', 'en'],
                                   [1440, '08-chinese-desktop', 'zh'], [390, '09-chinese-mobile-390', 'zh']]) {
      const p = await open(w, w < 600 ? 900 : 1000);
      await quickAddPaste(p, SMOKE, { expanded: false, settle: 1100 });
      if (lang === 'zh') { await zh(p); await p.waitForTimeout(500); }
      await shot(p, name, modal, { wait: 300 });
      await top(p, '.wqa-ser-rows');
      await shot(p, name + '-rows', modal, { wait: 300 });
      if (w === 390 || (w === 1440 && lang === 'zh')) {
        await p.click('[data-gacc="nut"] .wqa-gacc-hist'); await p.waitForTimeout(800);
        await top(p, '.wqa-gacc');
        await shot(p, (lang === 'zh' ? (w === 390 ? 'A8-mobile-390-zh-accessory-history' : 'A7-chinese-accessory-history') : 'A8-mobile-390-accessory-history'), modal, { wait: 300 });
      }
      await p._ctx.close();
    }
    // 10 · 11 — Unequal Thread
    {
      const p = await open(1440);
      await quickAddPaste(p, UNEQ, { expanded: false, settle: 900 });
      await shot(p, '10-unequal-thread-en', '#wqaRows', { wait: 300 });
      await zh(p); await p.waitForTimeout(400);
      await shot(p, '11-unequal-thread-zh', '#wqaRows', { wait: 300 });
      await p._ctx.close();
    }
  } finally { await browser.close(); }
})();
