/* ── Reusing a previous price, before and after ─────────────────────────────
   The card as it is read, and the row after the button is pressed. The point
   of every frame is the same: what came across is the recipe, and the price
   below it is this row's own.
   Run:  node tests/history-shots.js [outdir]                                 */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp, quickAddPaste } = require('./lib/harness');

const OUT = process.argv[2] || path.join(__dirname, '..', 'audit-out', 'history');
fs.mkdirSync(OUT, { recursive: true });

const REC = o => Object.assign({
  quotationId: 1, refNo: 'Q-2026-0366', date: '2026-03-06', customer: 'Alpha Sdn Bhd',
  companyId: 7, own: true, productType: 'SAG ROD', material: '4140',
  sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M16',
  dimensionPreview: 'L 300 x TL 50/50mm', exactDims: true, dimDistance: 0, qty: 35,
  unitPrice: 6.84, boltUnitPrice: 6.84, lineUnitPrice: 6.84,
  accessoryCost: 0, accessorySummary: '', accessoryAmbiguous: false,
  priceMode: 'auto', priceModeLabel: 'Auto Round',
  costRate: 6.50, addCost: 3.50, markup: 4, weight: 0.4735, legacy: false,
}, o);
/* A record is only ever offered to the specification it belongs to, so the
   stub echoes the size back — the identity that matters here is the material,
   the product, the size type and the finish. */
const Q0366 = REC({});
const Q0357 = REC({ refNo: 'Q-2026-0357', quotationId: 2, date: '2026-02-14',
                    addCost: 4.00, unitPrice: 7.36, boltUnitPrice: 7.36, lineUnitPrice: 7.36 });
const QMANUAL = REC({ refNo: 'Q-2026-0400', quotationId: 3, date: '2026-04-01',
                      priceMode: 'manual', priceModeLabel: 'Manual',
                      costRate: null, addCost: null, markup: null,
                      unitPrice: 9.90, boltUnitPrice: 9.90, lineUnitPrice: 9.90 });

/* The server's own identity rules, applied to what the row actually asked for.
   The first version of this answered every lookup with the same record whatever
   was asked, which produced a frame showing an MS row under a 4140 QT card —
   a picture of something the application does not do. Evidence has to come
   through the same gate production does. */
const serve = records => ({
  get_pricing_history: url => {
    const p = new URL(url).searchParams;
    const want = { productType: p.get('productType') || '', material: p.get('material') || '',
                   sizeType: p.get('sizeType') || '', finish: p.get('finish') || '',
                   cleanSize: p.get('cleanSize') || '' };
    const rows = records
      .map(r => Object.assign({}, r, { cleanSize: want.cleanSize }))
      .filter(r => r.productType === want.productType && r.material === want.material
                && r.sizeType === want.sizeType)
      .map(r => Object.assign({}, r, { finishMatch: r.finish === want.finish }));
    return { ok: true, data: { records: rows, total: rows.length,
                               ownTotal: rows.filter(r => r.own).length,
                               otherTotal: rows.filter(r => !r.own).length,
                               offset: 0, limit: 20 } };
  },
});

const shot = async (page, name, sel) => {
  const t = sel ? await page.$(sel) : null;
  await (t || page).screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  ' + name + '.png');
};

const useRecord = async (page, ref) => {
  await page.evaluate(() => { if (!wqa.rows[0].histOpen) wqaHistToggle(0); });
  await page.waitForTimeout(1000);
  await page.evaluate(want => {
    const card = [...document.querySelectorAll('[data-wqa-row="0"] .ph-rec')]
      .find(c => (c.querySelector('.ph-rec-ref') || {}).textContent === want);
    const btn = card && card.querySelector('.ph-rec-use');
    if (btn) btn.click();
  }, ref);
  await page.waitForTimeout(1200);
};

async function row(browser, records, msg, height) {
  const page = await openApp(browser, {
    viewport: { width: 1500, height: height || 1200 }, api: serve(records) });
  await page.evaluate(() => { selectedCompanyId = 7; });
  await quickAddPaste(page, msg, { expanded: true, settle: 1000 });
  return page;
}

/* The production case: a 4140 QT rod, which is what Q-2026-0366 is. */
const M16 = '4140 QT SAG ROD PL FULLSIZE\nM16 x 300 x 50/50 - 35pcs';

(async () => {
  const browser = await launch();

  // ── A/B. the production record, read and then used ───────────────────────
  {
    const page = await row(browser, [Q0366], M16, 1400);
    /* The row's own unrelated pricing, as the screenshot had it. */
    await page.evaluate(() => { wqaEditPrice(0, 'costRate', '4'); wqaEditPrice(0, 'addCost', '4');
                                wqaEditPrice(0, 'markup', '0'); });
    await page.waitForTimeout(900);
    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(1100);
    await shot(page, '1-Q0366-card-before-use', '#wqaStep2');
    await useRecord(page, 'Q-2026-0366');
    await shot(page, '2-Q0366-after-use', '#wqaStep2');
    await page.close();
  }

  // ── C. a second record replaces the whole recipe ─────────────────────────
  {
    const page = await row(browser, [Q0366, Q0357], M16, 1400);
    await useRecord(page, 'Q-2026-0366');
    await useRecord(page, 'Q-2026-0357');
    await shot(page, '3-Q0357-replaces-recipe', '#wqaStep2');
    await page.close();
  }

  // ── D. the same basis on a different rod ─────────────────────────────────
  {
    /* Same specification, different rod — which is the point of the frame. */
    const page = await row(browser, [Q0366],
      '4140 QT SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 10pcs', 1400);
    await useRecord(page, 'Q-2026-0366');
    await shot(page, '4-different-geometry-recalculated', '#wqaStep2');
    await page.close();
  }

  // ── E. a record priced by hand stays a manual price ──────────────────────
  {
    const page = await row(browser, [QMANUAL], M16, 1400);
    await useRecord(page, 'Q-2026-0400');
    await shot(page, '5-manual-history-stays-manual', '#wqaStep2');
    await page.close();
  }

  // ── H. the round trip: added, saved, reopened for editing ────────────────
  {
    let payload = null;
    const page = await openApp(browser, {
      viewport: { width: 1500, height: 1200 },
      api: Object.assign(serve([Q0366]), {
        save_quotation: (url, req) => {
          try { payload = JSON.parse(req.postData() || '{}'); } catch (e) {}
          return { ok: true, data: { id: 77, ref_no: 'DC-TEST-001' } };
        },
      }),
    });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, M16, { expanded: false, settle: 1000 });
    await useRecord(page, 'Q-2026-0366');
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1500);
    await shot(page, '6-added-to-quotation', '#step3Card');
    await page.evaluate(async () => {
      el('qi-customer').value = 'Alpha Sdn Bhd'; syncQI();
      await api('save_quotation', {
        ref_no: el('qi-refno').value, quote_date: el('qi-date').value,
        customer_name: 'Alpha Sdn Bhd', customer_phone: '', prepared_by: '',
        remarks: '', company_id: null, items: quoteItems,
        total_amount: quoteItems.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0),
      }, 'POST');
    });
    await page.waitForTimeout(800);
    await page.close();

    const reopened = await openApp(browser, {
      viewport: { width: 1500, height: 1300 },
      handoff: { id: 77, ref_no: 'DC-TEST-001', quote_date: '2026-03-06',
                 customer_name: 'Alpha Sdn Bhd', items: payload.items },
    });
    await reopened.evaluate(() => { unlockSavedQuotation(); editItem(0); });
    await reopened.waitForTimeout(900);
    await shot(reopened, '7-reopened-recipe-survived', '#step2Card');
    await reopened.close();
  }

  // ── the live half-inch case: same rod, another coating ───────────────────
  {
    const HALF = o => REC(Object.assign({
      material: 'MS', sizeType: 'UNDERSIZE', finish: 'PL', cleanSize: '1/2',
      costRate: 5.00, addCost: 2.00, markup: 6 }, o));
    const page = await openApp(browser, {
      viewport: { width: 1500, height: 1400 },
      api: serve([
        HALF({ refNo: 'Q-2026-0470', quotationId: 1, date: '2026-01-20',
               dimensionPreview: 'L 980 x TL 100/100mm', unitPrice: 11.20, boltUnitPrice: 11.20 }),
        HALF({ refNo: 'Q-2026-0471', quotationId: 2, date: '2026-02-20',
               dimensionPreview: 'L 1080 x TL 100/100mm', unitPrice: 12.30, boltUnitPrice: 12.30 }),
      ]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\n1/2 x 1020 x 100/100 - 20pcs',
      { expanded: true, settle: 1000 });
    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(1200);
    await shot(page, '8-half-inch-other-finish-reference', '#wqaStep2');
    await page.close();
  }

  await browser.close();
  console.log('\n  history frames in ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
