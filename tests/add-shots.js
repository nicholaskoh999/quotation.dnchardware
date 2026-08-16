/* ── Add to Quotation, before and after ─────────────────────────────────────
   The live blocker was "0 of 1 added" on a row that was visibly complete, and
   a quotation that stayed empty. These frames show the row that could not go,
   the quotation it goes into now, and what the screen says when a row really
   cannot be added.
   Run:  node tests/add-shots.js [outdir]                                     */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp, quickAddPaste } = require('./lib/harness');

const OUT = process.argv[2] || path.join(__dirname, '..', 'audit-out', 'add');
fs.mkdirSync(OUT, { recursive: true });

const shot = async (page, name, sel) => {
  const t = sel ? await page.$(sel) : null;
  await (t || page).screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  ' + name + '.png');
};

/* The record the live user reused: Q-2026-0125 at RM 7.40. */
const HISTORY = {
  get_pricing_history: url => {
    const size = String(new URL(url).searchParams.get('cleanSize') || '');
    return { ok: true, data: { records: [{
      quotationId: 1, refNo: 'Q-2026-0125', date: '2026-01-25', customer: 'Alpha Sdn Bhd',
      companyId: 7, own: true, productType: 'J BOLT', material: '4140 QT',
      sizeType: 'FULLSIZE', finish: 'PL', cleanSize: size,
      dimensionPreview: 'H 150 x ID 26 x S 36 x TL 75mm', exactDims: true, qty: 50,
      unitPrice: 7.40, boltUnitPrice: 7.40, accessoryCost: 0, accessorySummary: '',
      accessoryAmbiguous: false, priceMode: 'manual', priceModeLabel: 'Manual',
      costRate: null, addCost: null, markup: null, weight: null, legacy: false }],
      total: 1, ownTotal: 1, otherTotal: 0, offset: 0, limit: 20 } };
  },
};

async function review(browser, msg, opts = {}) {
  const page = await openApp(browser, {
    viewport: { width: 1500, height: opts.height || 1100 }, api: opts.api });
  await page.evaluate(() => { selectedCompanyId = 7; });
  await quickAddPaste(page, msg, { expanded: false, settle: opts.settle || 1100 });
  return page;
}

(async () => {
  const browser = await launch();

  // ── 1/2. the reported J Bolt: priced from a previous quotation, then added ─
  {
    const page = await review(browser, '4140 QT J BOLT PL FULLSIZE\n'
      + 'M12 x H 150 x ID 26 x S 36 x TL 75 - 50pcs', { api: HISTORY });
    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(1000);
    await page.evaluate(() => wqaHistUse(0, 0));
    await page.waitForTimeout(1000);
    await shot(page, '1-jbolt-before-add', '#wqaStep2');
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1400);
    await shot(page, '2-jbolt-after-add', '#step3Card');
    await page.close();
  }

  // ── 3/4. a Sag Rod ────────────────────────────────────────────────────────
  {
    const page = await review(browser, 'MS SAG ROD PL FULLSIZE\nM16 x 300 x 50/50 - 35pcs');
    await shot(page, '3-sagrod-before-add', '#wqaStep2');
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1400);
    await shot(page, '4-sagrod-after-add', '#step3Card');
    await page.close();
  }

  // ── 5/6. a third product: the L Bolt, which asks for both figures ─────────
  {
    const page = await review(browser, '4140 QT L BOLT PL FULLSIZE\nM20 x 950 x 400 x 150 - 90pcs');
    await page.evaluate(() => { wqaEditPrice(0, 'costRate', '6.50'); });
    await page.waitForTimeout(800);
    await shot(page, '5-lbolt-asks-for-the-surcharge', '#wqaStep2');
    await page.evaluate(() => { wqaEditPrice(0, 'addCost', '2.00'); });
    await page.waitForTimeout(900);
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1400);
    await shot(page, '6-lbolt-after-add', '#step3Card');
    await page.close();
  }

  // ── 7/8. a mixed list of five, added at once ─────────────────────────────
  {
    const page = await review(browser, [
      'MS SAG ROD PL FULLSIZE', 'M16 x 300 x 50/50 - 35pcs', 'M20 x 400 x 100/100 - 20pcs',
      '', 'MS ANCHOR BOLT HDG FULLSIZE', 'M20 x 450 x 150 - 80pcs',
      '', 'MS STUD PL', 'M16 x 300 - 60pcs',
      '', 'SS304 SAG ROD PLAIN FULLSIZE', 'M16 x 300 x 50/50 - 20pcs',
    ].join('\n'), { height: 1300, settle: 1800 });
    await page.evaluate(() => {
      wqa.rows.forEach((r, i) => { if (!(Number(r.calc && r.calc.finalUnitPrice) > 0))
        { wqaEditPrice(i, 'costRate', '12'); wqaEditPrice(i, 'addCost', '1'); } });
    });
    await page.waitForTimeout(1200);
    await shot(page, '7-mixed-before-add', '#wqaStep2');
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1800);
    await shot(page, '8-mixed-after-add', '#step3Card');
    await page.close();
  }

  // ── 9. one valid, one not: the valid one goes, the other stays and says why
  {
    const page = await review(browser, ['MS SAG ROD PL FULLSIZE',
      'M16 x 300 x 50/50 - 35pcs', 'M20 x 400 x 100/100 - 20pcs'].join('\n'),
      { settle: 1300 });
    await page.evaluate(() => wqaEditRowSpec(1, 'material', ''));
    await page.waitForTimeout(1000);
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1400);
    await shot(page, '9-partial-add-row-kept', '#wqaModal');
    await page.close();
  }

  // ── 10. and the quotation it went into ───────────────────────────────────
  {
    const page = await review(browser, ['MS SAG ROD PL FULLSIZE',
      'M16 x 300 x 50/50 - 35pcs', 'M20 x 400 x 100/100 - 20pcs'].join('\n'),
      { settle: 1300 });
    await page.evaluate(() => wqaEditRowSpec(1, 'material', ''));
    await page.waitForTimeout(1000);
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1400);
    await shot(page, '10-partial-add-quotation', '#step3Card');
    await page.close();
  }

  // ── 11. stainless beside mild steel, in the quotation ────────────────────
  {
    const page = await review(browser, ['SUS304 SAG ROD HDG FULLSIZE',
      'M16 x 300 x 50/50 - 20pcs', '', 'MS SAG ROD HDG FULLSIZE',
      'M16 x 300 x 50/50 - 20pcs'].join('\n'), { settle: 1500 });
    await page.evaluate(() => {
      wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '12'); wqaEditPrice(i, 'addCost', '1'); });
    });
    await page.waitForTimeout(1200);
    await shot(page, '11-stainless-review', '#wqaStep2');
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1600);
    await shot(page, '12-stainless-quotation', '#step3Card');
    await page.close();
  }

  await browser.close();
  console.log('\n  add frames in ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
