/* ── Fourteen frames of the Quick Add review, for looking at ────────────────
   DOM assertions catch a clipped button; they do not catch a row that is
   technically correct and unreadable. These are the views the layout audit
   asks to be inspected by eye.
   Run:  node tests/layout-shots.js [outdir]                                  */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp, quickAddPaste } = require('./lib/harness');

const OUT = process.argv[2] || path.join(__dirname, '..', 'audit-out', 'layout');
fs.mkdirSync(OUT, { recursive: true });

const shot = async (page, name, sel) => {
  const t = sel ? await page.$(sel) : null;
  await (t || page).screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  ' + name + '.png');
};

const MSG = {
  stud:       'MS STUD PL\nM16 x 300 - 35pcs\nM20 x 400 - 40pcs\nM24 x 500 - 25pcs',
  sagrod:     'MS SAG ROD PL FULLSIZE\nM16 x 300 x 50/50 - 35pcs\nM20 x 1000 x 100/100 - 250pcs',
  anchorbolt: 'MS ANCHOR BOLT HDG FULLSIZE\n1/2 x 300 x 100 - 60pcs\nM20 x 450 x 150 - 80pcs',
  lbolt:      '4140 QT L BOLT PL FULLSIZE\nM20 x 950 x 400 x 150 - 90pcs\nM24 x 1100 x 450 x 150 - 30pcs',
  jbolt:      '4140 QT J BOLT PL FULLSIZE\nM20 x H 400 x ID 70 x S 80 x TL 100 - 28pcs\n'
            + 'M30 x H 1200 x ID 125 x S 180 x TL 200 - 8pcs',
};
const MIXED10 = [
  'MS SAG ROD PL FULLSIZE', 'M16 x 300 x 50/50 - 35pcs', 'M20 x 1000 x 100/100 - 250pcs',
  '', 'MS ANCHOR BOLT HDG FULLSIZE', '1/2 x 300 x 100 - 60pcs', '3/4 x 500 x 150 - 20pcs',
  '', '4140 QT L BOLT PL FULLSIZE', 'M20 x 950 x 400 x 150 - 90pcs',
  '', '4140 QT J BOLT PL FULLSIZE', 'M20 x H 400 x ID 70 x S 80 x TL 100 - 28pcs',
  '', 'MS STUD PL', 'M12 x 200 - 100pcs', 'M16 x 300 - 60pcs', 'M20 x 400 - 40pcs',
].join('\n');
const MIXED20 = MIXED10 + '\n' + [
  '', 'MS SAG ROD PL FULLSIZE', 'M24 x 1200 x 100/100 - 40pcs', 'M27 x 1400 x 100/100 - 12pcs',
  '', 'MS ANCHOR BOLT HDG FULLSIZE', '5/8 x 400 x 100 - 30pcs', '1-1/4 x 900 x 200 - 12pcs',
  '', '4140 QT L BOLT PL FULLSIZE', 'M27 x 1250 x 500 x 200 - 15pcs',
  '', '4140 QT J BOLT PL FULLSIZE', 'M24 x H 500 x ID 90 x S 100 x TL 150 - 18pcs',
  '', 'MS STUD PL', 'M24 x 500 - 25pcs', 'M27 x 600 - 10pcs', 'M30 x 700 - 6pcs',
].join('\n');

/* One history answer, whatever is asked for, so the panel can be looked at. */
const rec = o => Object.assign({
  quotationId: 1, refNo: 'Q2026-0001', date: '2026-01-05', customer: 'Alpha Sdn Bhd', companyId: 7,
  own: true, productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL',
  cleanSize: 'M20', dimensionPreview: 'L 1000 x TL 100/100mm', exactDims: true, qty: 40,
  unitPrice: 12.50, boltUnitPrice: 12.50, accessoryCost: 0, accessorySummary: '',
  accessoryAmbiguous: false, priceMode: 'auto', priceModeLabel: 'Auto Round',
  costRate: 2.80, addCost: 0.60, markup: 8, weight: 2.4662, legacy: false,
}, o);
const HIST = {
  get_pricing_history: url => {
    const p = new URL(url).searchParams;
    const size = String(p.get('cleanSize') || ''), dims = String(p.get('dimensionPreview') || '');
    const rows = [
      rec({ cleanSize: size, dimensionPreview: dims }),
      rec({ cleanSize: size, refNo: 'Q2025-0902', date: '2025-09-02', qty: 12,
            unitPrice: 13.20, boltUnitPrice: 12.50, accessoryCost: 0.70,
            accessorySummary: '2 Nut PL + 1 FW PL', markup: 6 }),
      rec({ cleanSize: size, refNo: 'Q2023-0044', date: '2023-04-04', customer: 'Gamma Steel',
            companyId: 9, own: false, qty: 4, unitPrice: 16.00, boltUnitPrice: null,
            accessoryCost: 0.70, accessorySummary: '2 Nut PL', accessoryAmbiguous: true,
            priceMode: '', priceModeLabel: 'Legacy / Unknown', costRate: null, addCost: null,
            markup: null, weight: null, legacy: true }),
    ];
    return { ok: true, data: { records: rows, total: rows.length, ownTotal: 2, otherTotal: 1,
                               offset: 0, limit: 20 } };
  },
};

async function review(browser, width, height, msg, opts = {}) {
  const page = await openApp(browser, { viewport: { width, height }, api: opts.api });
  await page.evaluate(() => { selectedCompanyId = 7; });
  await quickAddPaste(page, msg, { expanded: !!opts.expanded, settle: opts.settle || 900 });
  return page;
}

(async () => {
  const browser = await launch();
  const W = 1500, H = 1100;

  for (const [n, type] of [['1-stud', 'stud'], ['2-sagrod', 'sagrod'],
                           ['4-anchorbolt', 'anchorbolt'], ['5-lbolt', 'lbolt'],
                           ['6-jbolt', 'jbolt']]) {
    const page = await review(browser, W, H, MSG[type]);
    await shot(page, n + '-compact-1500', '#wqaStep2');
    await page.close();
  }

  for (const [n, type] of [['3-sagrod', 'sagrod'], ['7-jbolt', 'jbolt']]) {
    const page = await review(browser, W, 1300, MSG[type], { api: HIST });
    await page.click('[data-wqa-row="0"] .wqa-row-hist');
    await page.waitForTimeout(1000);
    await shot(page, n + '-history-open', '#wqaStep2');
    await page.close();
  }

  {
    const page = await review(browser, W, 1300, MIXED10, { settle: 1500 });
    await shot(page, '8-mixed-10', '#wqaStep2');
    await page.close();
  }
  {
    const page = await review(browser, W, 1700, MIXED20, { settle: 2200 });
    await shot(page, '9-mixed-20', '#wqaStep2');
    await page.close();
  }
  {
    const page = await review(browser, 1366, 900, MSG.jbolt);
    await shot(page, '10-jbolt-1366');
    await page.close();
  }
  {
    const page = await review(browser, 1024, 900, MSG.jbolt);
    await shot(page, '11-jbolt-1024');
    await page.close();
  }
  {
    const page = await review(browser, 390, 844, MSG.jbolt);
    await shot(page, '12-jbolt-390');
    await page.close();
  }
  {
    const page = await review(browser, 390, 844, MIXED10, { settle: 1500 });
    await shot(page, '13-mixed-390');
    await page.close();
  }
  {
    const page = await review(browser, W, 1300, MSG.jbolt, { expanded: true, settle: 1200 });
    await shot(page, '14-jbolt-expanded', '#wqaStep2');
    await page.close();
  }

  await browser.close();
  console.log('\n  layout frames in ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
