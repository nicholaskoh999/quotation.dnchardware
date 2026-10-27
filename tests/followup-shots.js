/* Owner-smoke follow-up (pricing + Quick Add UX + history) — owner-review
   screenshots. Every shot is the shipped page driven through its own code.
   Run:  node tests/followup-shots.js [outdir]                               */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp, quickAddPaste } = require('./lib/harness');

const OUT = process.argv[2] || path.join(__dirname, '..', 'followup-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const BLK = 'M16 x 2970 x 100/100 - 4pcs\nM16 x 3000 x 100/100 - 4pcs\nM16 x 3280 x 100/100 - 4pcs';
const SAG_MSG = 'MS SAG ROD PL FULLSIZE\n' + BLK + '\nM12 x 1100 x 70/70 - 2pcs\n' + BLK;
const MIX_MSG = '4140 L BOLT HDG FULLSIZE\nM36 x 860 x 110 x 150 - 12pcs\n\nMS J BOLT PL FULLSIZE\nM20 x H 550 x ID 140 x S 190 x TL 120 - 8pcs';

const rec = o => Object.assign({
  quotationId: 1, refNo: 'Q-2026-1369', date: '2026-10-26', customer: 'ABC HARDWARE', companyId: 0, own: false,
  productType: 'J BOLT', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', finishMatch: true, cleanSize: 'M20',
  dimensionPreview: 'H 550 x ID 140 x S 190 x TL 120mm', exactDims: true, dimDistance: 0, qty: 8,
  unitPrice: 8.10, lineUnitPrice: 8.10, boltUnitPrice: 8.10, accessoryCost: 0, accessorySummary: '', accessoryAmbiguous: false,
  priceMode: 'auto', priceModeLabel: 'Auto Round', costRate: 4.2, addCost: 0.6, markup: 10, weight: 2.0025, legacy: false }, o);
const HIST = { ok: true, data: { total: 12, ownTotal: 0, otherTotal: 12, exactTotal: 2, closeTotal: 6, refTotal: 4, offset: 0, limit: 20, records: [
  rec({}),
  rec({ quotationId: 2, refNo: 'Q-2026-1301', date: '2026-10-12', customer: 'DELTA STEEL', priceMode: 'manual', priceModeLabel: 'Manual',
        unitPrice: 8.00, boltUnitPrice: 8.00, rawUnitPrice: 7.63, autoRoundUnitPrice: 7.60 }),
  rec({ quotationId: 3, refNo: 'Q-2026-1201', date: '2026-09-30', customer: 'XYZ HARDWARE', dimensionPreview: 'H 570 x ID 140 x S 190 x TL 120mm',
        exactDims: false, dimDistance: 20, costRate: 4.0, addCost: 0.5, markup: 15, unitPrice: 7.90, boltUnitPrice: 7.90 }),
  rec({ quotationId: 4, refNo: 'Q-2026-1188', date: '2026-09-21', customer: 'KL FASTENERS', finish: 'HDG', finishMatch: false,
        dimensionPreview: 'H 600 x ID 140 x S 190 x TL 120mm', exactDims: false, dimDistance: 50, unitPrice: 9.60, boltUnitPrice: 9.60 }),
] } };
const ACC = { ok: true, data: { total: 3, records: [
  { type: 'Nut', size: 'M16', finish: 'PL', unitPrice: 0.15, refNo: 'Q-2026-1057', date: '2026-10-02', customer: 'ABC HARDWARE' },
  { type: 'Nut', size: 'M16', finish: 'PL', unitPrice: 0.15, refNo: 'Q-2026-0586', date: '2026-08-18', customer: 'XYZ ENGINEERING' },
  { type: 'Nut', size: 'M16', finish: 'PL', unitPrice: 0.18, refNo: 'Q-2026-0400', date: '2026-07-01', customer: 'LMN TRADING' },
] } };

let browser;
const open = async (w, h) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h || 1000 } });
  const p = await openApp(browser, { context: ctx, api: { get_pricing_history: HIST, get_accessory_history: ACC } });
  p.on('dialog', d => d.accept().catch(() => {}));
  p._ctx = ctx;
  return p;
};
const shot = async (p, name, sel, opts = {}) => {
  await p.waitForTimeout(opts.wait == null ? 2700 : opts.wait);      // let the toast go
  const t = sel ? await p.$(sel) : null;
  await (t || p).screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!opts.full });
  console.log('  ' + name + '.png');
};
const zh = p => p.evaluate(() => dcSetLang('zh'));
const caption = (p, sel, text) => p.evaluate(([sel, text]) => {
  const n = document.querySelector(sel); const c = document.createElement('div');
  c.className = 'shot-caption'; c.textContent = text;
  c.style.cssText = 'font:700 13px system-ui;color:#1e3a8a;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:6px 10px;margin:0 0 8px';
  n.parentNode.insertBefore(c, n);
}, [sel, text]);

(async () => {
  browser = await launch();
  try {
    // 1 · 2 — Auto Round evidence on the form's own price preview
    {
      const p = await open(1280, 900);
      for (const [type, raw, name, label] of [
        ['stud', 6.43, '01a-non-sag-auto-round-6.43-to-6.40', 'Stud · Auto Round · raw RM6.43'],
        ['stud', 6.44, '01b-non-sag-auto-round-6.44-to-6.50', 'Stud · Auto Round · raw RM6.44'],
        ['sagrod', 4.32, '02a-sag-rod-nearest-0.05-4.32-to-4.30', 'Sag Rod · Auto Round · raw RM4.32'],
        ['sagrod', 4.34, '02b-sag-rod-nearest-0.05-4.34-to-4.35', 'Sag Rod · Auto Round · raw RM4.34'],
      ]) {
        await p.evaluate(([t, raw]) => { document.querySelectorAll('.shot-caption').forEach(n => n.remove());
          switchType(t); setFieldValue(t, 'priceMode', 'auto'); resolvePriceMode(t, raw, 0, 0); }, [type, raw]);
        await caption(p, '#priceModePreview', label);
        await p.evaluate(() => document.getElementById('priceModePreview').scrollIntoView({ block: 'center' }));
        await shot(p, name, '#priceModePreview', { wait: 200 });
        await p.screenshot({ path: path.join(OUT, name + '-context.png'), clip: await p.evaluate(() => {
          const b = document.getElementById('priceModePreview').getBoundingClientRect();
          return { x: Math.max(0, b.left - 20), y: Math.max(0, b.top - 60), width: Math.min(900, b.width + 40), height: b.height + 80 }; }) });
      }
      await p._ctx.close();
    }

    // 3 · 4 · 9 · 11 · 12 · 8 — the Sag Rod list with a repeated group
    {
      const p = await open(1440);
      await quickAddPaste(p, SAG_MSG, { expanded: false, settle: 900 });
      await shot(p, '09-duplicate-group-warning-en', '#wqaRows', { wait: 300 });
      await p.click('.wqa-ser:nth-of-type(1) [data-gx="addCost"]');
      await p.waitForTimeout(200);
      await p.fill('[data-gx-in="addCost"]', '0.80');
      await shot(p, '03a-group-header-click-to-edit-addcost', '.wqa-ser:nth-of-type(1)', { wait: 200 });
      await p.press('[data-gx-in="addCost"]', 'Enter');
      await p.waitForTimeout(900);
      await shot(p, '03b-group-header-after-addcost-0.80', '.wqa-ser:nth-of-type(1)');
      await p.hover('.wqa-ser:nth-of-type(1) [data-gx="markup"]');
      await shot(p, '03c-group-header-hover-affordance', '.wqa-ser:nth-of-type(1) .wqa-ser-head', { wait: 300 });
      // Bulk Adjust with a selection AND a current group, opened on the group
      await p.evaluate(() => { wqaSelEnter(); wqaRvToggleSel(3); wqaSelExit && 0; });
      await p.evaluate(() => { wqa.selMode = false; wqaRenderRows(true); wqaBulkSheetOpen('group', null, 4); });
      await p.fill('#wqaBulkSheetPanel [data-bs="markup"]', '10');
      await shot(p, '04-bulk-adjust-all-selected-current-group', '#wqaBulkSheetPanel', { wait: 400 });
      await p.evaluate(() => wqaBulkSheetClose());
      await p.click('[data-dup-act="keep"]'); await p.waitForTimeout(300);
      await shot(p, '11-keep-both-result', '#wqaRows', { wait: 300 });
      await p.click('[data-dup-act="review"]'); await p.waitForTimeout(200);
      await p.click('[data-dup-act="merge"]');
      await shot(p, '12-merge-quantities-result', '#wqaRows');
      await p.click('[data-dup-act="undo"]'); await p.waitForTimeout(500);
      await zh(p); await p.waitForTimeout(400);
      await shot(p, '10-duplicate-group-warning-zh', '.wqa-ser:nth-of-type(3)', { wait: 300 });
      await p._ctx.close();
    }

    // 5 · 6 · 7 · 8 · A · B · C · 16 · 17 · 18 · E — the row hierarchy and its pricing history
    for (const [w, name, letter] of [[1440, '05-desktop', 'A'], [820, '06-tablet-820', 'B'], [390, '07-mobile-390', 'C']]) {
      const p = await open(w, w < 600 ? 900 : 1000);
      await quickAddPaste(p, MIX_MSG, { expanded: false, settle: 900 });
      await shot(p, name + '-quick-add-row-hierarchy', '#wqaRows', { wait: 300 });
      if (w === 1440) {
        await shot(p, '08-effective-diameter-in-spec', '[data-wqa-row="0"] .wqa-it-main', { wait: 100 });
      }
      await p.evaluate(() => { wqa.rows.forEach(r => { r.open = false; }); wqa.rows[1].open = true; wqaRenderRows(true); });
      await p.waitForTimeout(300);
      await p.click('[data-wqa-row="1"] .wqa-dt-histbar'); await p.waitForTimeout(1000);
      await p.evaluate(() => document.querySelector('[data-wqa-row="1"] .wqa-it-main').scrollIntoView({ block: 'start' }));
      await shot(p, `${letter}1-${name}-expanded-row-spec-and-status`, '#wqaModal .wqa-modal', { wait: 300 });
      await p.evaluate(() => document.querySelector('[data-wqa-row="1"] .wqa-dt-sec-px').scrollIntoView({ block: 'start' }));
      await shot(p, `${letter}2-${name}-expanded-pricing-plus-inline-history`, '#wqaModal .wqa-modal', { wait: 300 });
      if (w === 1440) {
        await shot(p, '08b-effective-diameter-label-in-panel', '[data-wqa-row="1"] .wqa-dt-grid', { wait: 100 });
        await shot(p, '16-pricing-history-summary-exact-similar-reference', '[data-wqa-row="1"] .wqa-dt-hist .wqa-dt-histbar', { wait: 100 });
        await shot(p, '16b-pricing-history-count-bar', '[data-wqa-row="1"] .wqa-dt-hist .ph-count', { wait: 100 });
        await shot(p, '17-pricing-history-card-customer-and-difference', '[data-wqa-row="1"] [data-ph-class="close"]', { wait: 100 });
        await shot(p, '18-D-manual-price-history-card', '[data-wqa-row="1"] .ph-rec:has(.ph-mx)', { wait: 100 });
        await shot(p, 'E-reference-only-different-finish-card', '[data-wqa-row="1"] [data-ph-class="ref"]', { wait: 100 });
      }
      if (w === 390) {
        await zh(p); await p.waitForTimeout(500);
        await p.evaluate(() => document.querySelector('[data-wqa-row="1"] .wqa-dt-sec-px').scrollIntoView({ block: 'start' }));
        await shot(p, 'C3-mobile-390-zh-pricing-plus-history', '#wqaModal .wqa-modal', { wait: 300 });
      }
      await p._ctx.close();
    }

    // 13 · 14 · 15 — Accessory History and its button
    {
      const p = await open(1280, 900);
      await p.evaluate(() => { switchType('sagrod'); setFieldValue('sagrod', 'size', 'M16'); onSizeCommit('sagrod');
        const cb = document.getElementById('sagrod-nutEnabled'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof setAccPanelOpen === 'function') setAccPanelOpen('sagrod', true); });
      await p.evaluate(() => document.querySelector('#sagrod-accPanel').scrollIntoView({ block: 'center' }));
      await shot(p, '15a-history-button-with-icon-en', '#sagrod-accPanel .acc-item', { wait: 300 });
      await zh(p); await p.waitForTimeout(300);
      await shot(p, '15b-history-button-with-icon-zh', '#sagrod-accPanel .acc-item', { wait: 300 });
      await p.evaluate(() => dcSetLang('en')); await p.waitForTimeout(200);
      await p.evaluate(() => accHistoryOpen('sagrod', 'nut')); await p.waitForTimeout(700);
      await shot(p, '13-14-accessory-history-customer-and-grouped-price', '#accHistoryModal .acc-history-modal', { wait: 200 });
      await p._ctx.close();
    }
  } finally { await browser.close(); }
})();
