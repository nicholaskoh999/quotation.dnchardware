/* UI POLISH 1 — BASELINE RECOVERY evidence.
   Uses the project's own harness, so the page under test is the shipped
   index.php and api.php is answered from the table the test controls.
   Run:  node tests/ui-polish-1-shots.js <outdir> */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { launch, openApp, quickAddPaste } = require(path.join(ROOT, 'tests/lib/harness'));

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node tests/ui-polish-1-shots.js <outdir>'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

/* A real enquiry: 16 lines, four sizes, quantities a quotation would carry. */
const LIST = [
  'MS SAG ROD ZP UNDERSIZE',
  'M12 x 853 x 70/70 - 12pcs',
  'M12 x 943 x 70/70 - 8pcs',
  'M12 x 1020 x 70/70 - 24pcs',
  'M12 x 1105 x 70/70 - 6pcs',
  'M16 x 1240 x 90/90 - 18pcs',
  'M16 x 1315 x 90/90 - 10pcs',
  'M16 x 1400 x 90/90 - 4pcs',
  'M16 x 1480 x 90/90 - 30pcs',
  'M20 x 1650 x 110/110 - 16pcs',
  'M20 x 1740 x 110/110 - 12pcs',
  'M20 x 1820 x 110/110 - 9pcs',
  'M20 x 1930 x 110/110 - 22pcs',
  'M24 x 2100 x 130/130 - 5pcs',
  'M24 x 2240 x 130/130 - 14pcs',
  'M24 x 2380 x 130/130 - 7pcs',
  'M24 x 2510 x 130/130 - 11pcs',
].join('\n');

const REC = o => Object.assign({
  quotationId: 1, refNo: 'Q-2026-0403', date: '2026-03-06', customer: 'Alpha Sdn Bhd',
  companyId: 7, own: true, productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE',
  finish: 'ZP', cleanSize: 'M12', dimensionPreview: 'L 853 x TL 70/70mm', exactDims: true,
  dimDistance: 0, qty: 4, unitPrice: 3.20, boltUnitPrice: 3.20, lineUnitPrice: 3.20,
  finishMatch: true, accessoryCost: 0, accessorySummary: '', accessoryAmbiguous: false,
  priceMode: 'auto', priceModeLabel: 'Auto Round', costRate: 4.50, addCost: 0.50,
  markup: 6, weight: 0.5909, legacy: false,
}, o);

const database = rows => ({
  get_pricing_history: url => {
    const p = new URL(url).searchParams;
    const w = { productType: p.get('productType') || '', material: p.get('material') || '',
                sizeType: p.get('sizeType') || '', cleanSize: p.get('cleanSize') || '' };
    const records = rows
      .filter(r => r.productType === w.productType && r.material === w.material
                && r.sizeType === w.sizeType && r.cleanSize === w.cleanSize)
      .map(r => Object.assign({}, r, { finishMatch: r.finish === (p.get('finish') || '') }));
    return { ok: true, data: { records, total: records.length,
                               ownTotal: records.filter(r => r.own).length,
                               otherTotal: records.filter(r => !r.own).length,
                               offset: 0, limit: 20 } };
  },
});

const HIST = [
  REC({}),
  REC({ refNo: 'Q-2026-0390', quotationId: 2, date: '2026-02-01', finish: 'PL',
        dimensionPreview: 'L 943 x TL 70/70mm', unitPrice: 3.05, boltUnitPrice: 3.05 }),
  REC({ refNo: 'Q-2026-0361', quotationId: 3, date: '2026-01-11', own: false,
        dimensionPreview: 'L 1020 x TL 70/70mm', unitPrice: 3.44, boltUnitPrice: 3.44 }),
];

const log = [];
const shot = async (page, name, sel) => {
  const t = sel ? await page.$(sel) : null;
  await (t || page).screenshot({ path: path.join(OUT, name + '.png') });
  log.push(name);
  console.log('  ✓ ' + name);
};

const open = async (browser, vp, hist) => {
  const page = await openApp(browser, { viewport: vp, api: hist ? database(HIST) : {} });
  await page.evaluate(() => { selectedCompanyId = 7; });
  await quickAddPaste(page, LIST, { expanded: false, settle: 1400 });
  return page;
};

const DESK = { width: 1600, height: 1000 };

(async () => {
  const browser = await launch();

  /* 01 · the whole review, compact, real toolbar */
  {
    const page = await open(browser, DESK);
    await shot(page, '01-compact-full', '#wqaStep2');

    /* 10 · deep into the table */
    await page.evaluate(() => { const b = document.querySelector('.wqa-scroll');
                                b.scrollTop = b.scrollHeight; });
    await page.waitForTimeout(300);
    await shot(page, '10-table-scrolled', '#wqaStep2');
    await page.evaluate(() => { document.querySelector('.wqa-scroll').scrollTop = 0; });

    /* 02 · expanded */
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(700);
    await shot(page, '02-expanded', '#wqaStep2');
    await page.evaluate(() => wqaSetView('compact'));
    await page.waitForTimeout(500);

    /* 03 · Fast Edit active */
    await page.evaluate(() => wqaEditStart());
    await page.waitForTimeout(500);
    await shot(page, '03-fast-edit-active', '#wqaStep2');
    await page.evaluate(() => wqaEditRequestCancel());
    await page.waitForTimeout(400);
    await page.evaluate(() => { try { wqaEditCancelConfirm && wqaEditCancelConfirm(); } catch (e) {} });
    await page.waitForTimeout(400);
    await page.close();
  }

  /* 04 · Bulk Edit collapsed   05 · Bulk Edit open */
  {
    const page = await open(browser, DESK);
    await shot(page, '04-bulk-collapsed', '#wqaStep2');
    await page.evaluate(() => wqaToggleBulk());
    await page.waitForTimeout(500);
    await page.evaluate(() => { wqa.panels.price = true; wqaRenderCommonPrice(true); });
    await page.waitForTimeout(400);
    await shot(page, '05-bulk-open', '#wqaStep2');
    await page.close();
  }

  /* 06 · Selected Items */
  {
    const page = await open(browser, DESK);
    await page.evaluate(() => wqaSetApplyScope('selected'));
    await page.waitForTimeout(400);
    /* Row ticks only — the header carries a select-all with the same class,
       and ticking that would show sixteen of sixteen instead of a partial
       selection, which is the state worth photographing. */
    const boxes = page.locator('[data-wqa-row] .wqa-pick');
    const n = await boxes.count();
    for (const i of [0, 2, 4, 7, 9].filter(i => i < n)) await boxes.nth(i).check();
    await page.waitForTimeout(400);
    await shot(page, '06-selected-items', '#wqaStep2');
    await page.close();
  }

  /* 07 · Details   08 · History   09 · Previous Price */
  {
    const page = await open(browser, DESK, true);
    /* Re-query each time: opening a row re-renders it, so a handle taken
       before the click is detached by the time it would be clicked again. */
    const details = () => page.$('[data-wqa-row="1"] .wqa-row-details');
    let d = await details();
    if (d) { await d.click(); await page.waitForTimeout(700); }
    await shot(page, '07-details', '#wqaStep2');
    d = await details();
    if (d) { await d.click(); await page.waitForTimeout(500); }

    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(1400);
    await shot(page, '08-history', '#wqaStep2');

    await page.evaluate(() => { try { wqaHistMenuToggle(0, 0); } catch (e) {} });
    await page.waitForTimeout(500);
    await shot(page, '09-previous-price', '#wqaStep2');
    await page.close();
  }

  /* 11 · responsive */
  for (const vp of [{ n: '11a-desktop-1440', width: 1440, height: 900 },
                    { n: '11b-laptop-1280',  width: 1280, height: 860 },
                    { n: '11c-laptop-1024',  width: 1024, height: 800 },
                    { n: '11d-tablet-820',   width: 820,  height: 1000 },
                    { n: '11e-phone-430',    width: 430,  height: 900 }]) {
    const page = await open(browser, { width: vp.width, height: vp.height });
    await shot(page, vp.n, '#wqaStep2');
    await page.close();
  }

  /* 12 · 中文 */
  {
    const page = await open(browser, DESK);
    await page.evaluate(() => dcSetLang('zh'));
    await page.waitForTimeout(600);
    await shot(page, '12-zh-compact', '#wqaStep2');
    await page.evaluate(() => wqaToggleBulk());
    await page.waitForTimeout(500);
    await shot(page, '12b-zh-bulk-open', '#wqaStep2');
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'INDEX.txt'), log.join('\n') + '\n');
  console.log('\n  ' + log.length + ' frames -> ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
