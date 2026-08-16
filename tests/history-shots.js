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
const Q0366 = REC({});
const Q0357 = REC({ refNo: 'Q-2026-0357', quotationId: 2, date: '2026-02-14',
                    addCost: 4.00, unitPrice: 7.36, boltUnitPrice: 7.36, lineUnitPrice: 7.36 });
const QMANUAL = REC({ refNo: 'Q-2026-0400', quotationId: 3, date: '2026-04-01',
                      priceMode: 'manual', priceModeLabel: 'Manual',
                      costRate: null, addCost: null, markup: null,
                      unitPrice: 9.90, boltUnitPrice: 9.90, lineUnitPrice: 9.90 });

const serve = records => ({
  get_pricing_history: url => {
    const size = String(new URL(url).searchParams.get('cleanSize') || '');
    const rows = records.map(r => Object.assign({}, r, { cleanSize: size }));
    return { ok: true, data: { records: rows, total: rows.length, ownTotal: rows.length,
                               otherTotal: 0, offset: 0, limit: 20 } };
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

const M16 = 'MS SAG ROD PL FULLSIZE\nM16 x 300 x 50/50 - 35pcs';

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
    const page = await row(browser, [Q0366],
      'MS SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 10pcs', 1400);
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

  await browser.close();
  console.log('\n  history frames in ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
