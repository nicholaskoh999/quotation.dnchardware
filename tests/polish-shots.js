/* ── The polished review screen, frame by frame ─────────────────────────────
   Run:  node tests/polish-shots.js [outdir]
   Nothing here is a fixture pretending to be the application: the pricing
   history stub applies the SAME five identity fields the server compares, so a
   record that could not survive dc_history_record does not appear in a frame
   either.                                                                    */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp, quickAddPaste } = require('./lib/harness');

const OUT = process.argv[2] || path.join(__dirname, '..', 'audit-out', 'polish');
fs.mkdirSync(OUT, { recursive: true });

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
                sizeType: p.get('sizeType') || '', finish: p.get('finish') || '',
                cleanSize: p.get('cleanSize') || '' };
    const records = rows
      .filter(r => r.productType === w.productType && r.material === w.material
                && r.sizeType === w.sizeType && r.cleanSize === w.cleanSize)
      .map(r => Object.assign({}, r, { finishMatch: r.finish === w.finish }));
    return { ok: true, data: { records, total: records.length,
                               ownTotal: records.filter(r => r.own).length,
                               otherTotal: records.filter(r => !r.own).length,
                               offset: 0, limit: 20 } };
  },
});

const shot = async (page, name, sel) => {
  const t = sel ? await page.$(sel) : null;
  await (t || page).screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  ' + name + '.png');
};

/* The four-length enquiry this whole feature exists for. */
const LIST = [
  'MS SAG ROD ZP UNDERSIZE',
  'M12 x 853 x 70/70 - 4pcs',
  'M12 x 943 x 70/70 - 6pcs',
  'M16 x 500 x 70/70 - 2pcs',
  'M12 x 700 x 70/70 - 3pcs',
].join('\n');

const open = async (browser, records, msg, h) => {
  const page = await openApp(browser, {
    viewport: { width: 1500, height: h || 1250 },
    api: records ? database(records) : {},
  });
  await page.evaluate(() => { selectedCompanyId = 7; });
  await quickAddPaste(page, msg || LIST, { expanded: false, settle: 1300 });
  return page;
};

(async () => {
  const browser = await launch();
  const HALF = REC({ refNo: 'Q-2026-0390', quotationId: 2, date: '2026-02-01', finish: 'PL',
                     dimensionPreview: 'L 900 x TL 70/70mm', unitPrice: 3.05, boltUnitPrice: 3.05 });
  const UNSEP = REC({ refNo: 'Q-2026-0361', quotationId: 3, date: '2026-01-11',
                      boltUnitPrice: null, accessoryAmbiguous: true, accessoryCost: 0.70,
                      dimensionPreview: 'L 853 x TL 70/70mm' });

  // ── 1 · the default state ────────────────────────────────────────────────
  {
    const page = await open(browser, [REC({})]);
    await shot(page, '1-default-bulk-collapsed', '#wqaStep2');

    // ── 2 · bulk edit expanded ─────────────────────────────────────────────
    await page.evaluate(() => wqaToggleBulk());
    await page.waitForTimeout(500);
    await shot(page, '2-bulk-edit-expanded', '#wqaStep2');

    // ── 3 · the selected-item scope ────────────────────────────────────────
    await page.evaluate(() => { wqaToggleBulk(); wqaSetApplyScope('selected'); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { wqaToggleRowSel(0); wqaToggleRowSel(1); wqaToggleRowSel(3); });
    await page.waitForTimeout(500);
    await shot(page, '3-selected-scope', '#wqaStep2');
    await page.close();
  }

  // ── 4 · the row's own controls, open and shut ────────────────────────────
  {
    const page = await open(browser, [REC({})]);
    await page.evaluate(() => document.querySelector('[data-wqa-row="1"] .wqa-row-details').click());
    await page.waitForTimeout(500);
    await shot(page, '4-row-controls', '#wqaRows');
    await page.close();
  }

  // ── 6 · reusable and reference, in their own sections ────────────────────
  {
    const page = await open(browser, [REC({}), HALF, UNSEP], LIST, 1500);
    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(1300);
    await shot(page, '6-history-reusable-and-references', '#wqaStep2');

    // ── 7 · the menu, and what it offers ─────────────────────────────────
    await page.evaluate(() => wqaHistMenuToggle(0, 0));
    await page.waitForTimeout(450);
    await shot(page, '7-apply-to-compatible-menu', '#wqaStep2');

    // ── 8 · the picker, with the incompatible row disabled and saying why ─
    await page.evaluate(() => wqaHistPickOpen(0, 0));
    await page.waitForTimeout(450);
    await shot(page, '8-incompatible-items-disabled', '#wqaStep2');

    // ── 12 · applied: the prices that moved are marked, briefly ───────────
    await page.evaluate(() => wqaHistPickApply());
    await page.waitForTimeout(320);
    await shot(page, '12-price-recalculated-highlight', '#wqaRows');

    // ── 5 · and where each of those prices came from ─────────────────────
    await page.waitForTimeout(1400);
    await shot(page, '5-previous-price-provenance', '#wqaRows');
    await page.close();
  }

  // ── 9, 10, 11 · the thread references ────────────────────────────────────
  {
    const page = await open(browser, null,
      'MS SAG ROD ZP UNDERSIZE\nM12 x 1.75P x 853 x 70/70 - 4pcs\nM12 x 943 x 70/70 - 6pcs', 1100);
    await shot(page, '9-metric-pitch-reference', '#wqaRows');
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(700);
    await shot(page, '9b-metric-pitch-editable', '#wqaRows');
    await page.close();
  }
  {
    const page = await open(browser, null,
      'MS SAG ROD ZP UNDERSIZE\n1/2 UNC x 1020 x 100/100 - 20pcs', 1000);
    await shot(page, '10-imperial-unc-reference', '#wqaRows');
    await page.close();
  }
  {
    const page = await open(browser, null,
      'MS SAG ROD ZP UNDERSIZE\n1/2 BSW x 1020 x 100/100 - 20pcs', 1000);
    await shot(page, '11-imperial-bsw-reference', '#wqaRows');
    await page.close();
  }

  await browser.close();
  console.log('\n  polish frames in ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
