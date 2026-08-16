/* ── Pricing history ───────────────────────────────────────────────────────
   Phases 4-12.

   Evidence, not a prediction. The identity, accessory-separation and ranking
   rules live in pricing_history.php and are asserted directly in
   tests/php/pricing_history.test.js's PHP counterpart; what is asserted here
   is what the browser does with the answer — what it asks for, what it shows,
   what it never shows, and what it refuses to do on its own.               */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const ALPHA = 7;
/* What the endpoint returns for 4140 QT / L BOLT / PL / FULLSIZE / M20. */
const rec = (o) => Object.assign({
  quotationId: 1, refNo: 'Q2026-0001', date: '2026-01-05', customer: 'ADVANCE', companyId: ALPHA,
  own: true, productType: 'L BOLT', material: '4140', sizeType: 'FULLSIZE', finish: 'PL',
  cleanSize: 'M20', dimensionPreview: 'L 1000 x W 100 x TL 150mm', exactDims: true,
  qty: 10, unitPrice: 30.00, boltUnitPrice: 30.00, accessoryCost: 0, accessorySummary: '',
  accessoryAmbiguous: false, priceMode: 'auto', costRate: 5.00, addCost: 4.00, markup: 4,
  weight: 2.4662, legacy: false,
}, o);

const ALL = [
  rec({}),
  rec({ quotationId: 2, refNo: 'Q2025-0831', date: '2025-08-31', unitPrice: 26.00, boltUnitPrice: 26.00,
        dimensionPreview: 'L 500 x W 100 x TL 100mm', exactDims: false, addCost: 3.00 }),
  rec({ quotationId: 3, refNo: 'Q2025-0411', date: '2025-04-11', customer: 'Gamma Steel', companyId: 9,
        own: false, unitPrice: 24.00, boltUnitPrice: 24.00, costRate: 4.70, markup: 5 }),
  rec({ quotationId: 4, refNo: 'Q2025-0102', date: '2025-01-02', unitPrice: 30.70, boltUnitPrice: 30.00,
        accessoryCost: 0.70, accessorySummary: '2 Nut PL + 1 FW PL' }),
  rec({ quotationId: 5, refNo: 'Q2023-0044', date: '2023-04-04', unitPrice: 22.00, boltUnitPrice: null,
        accessoryCost: 0.70, accessorySummary: '2 Nut PL', accessoryAmbiguous: true,
        priceMode: '', costRate: null, addCost: null, legacy: true }),
  rec({ quotationId: 6, refNo: 'Q2022-0001', date: '2022-02-02', unitPrice: 19.00, boltUnitPrice: 19.00,
        dimensionPreview: 'L 1500 x W 150 x TL 200mm', exactDims: false }),
];

const asked = [];
function pricingHistory(url) {
  const p = new URL(url).searchParams;
  asked.push(Object.fromEntries(p.entries()));
  const off = parseInt(p.get('offset') || '0', 10);
  const lim = parseInt(p.get('limit') || '20', 10);
  if (String(p.get('cleanSize') || '').toUpperCase() !== 'M20'
   || String(p.get('material') || '') !== '4140') {
    return { ok: true, data: { records: [], total: 0, ownTotal: 0, otherTotal: 0, offset: 0, limit: lim } };
  }
  return { ok: true, data: {
    records: ALL.slice(off, off + lim), total: ALL.length,
    ownTotal: ALL.filter(r => r.own).length, otherTotal: ALL.filter(r => !r.own).length,
    offset: off, limit: lim } };
}

const MSG = '4140 QT L BOLT PL FULLSIZE\nM20 x 1000 x 100 x 150 - 40pcs';

module.exports = async (browser, A) => {
  const S = A.suite('pricing history — the rows we sent, and why they differed');
  const page = await openApp(browser, { api: { get_pricing_history: pricingHistory } });
  await page.evaluate(id => { selectedCompanyId = id; }, ALPHA);

  await quickAddPaste(page, MSG, { settle: 1000 });
  await page.waitForTimeout(800);
  let rows = await rowState(page);
  A.eq(rows.length, 1, 'one row to price');
  A.eq(rows[0].size, 'M20', 'an M20 L Bolt');

  // ── nothing is asked for until somebody asks ─────────────────────────────
  A.eq(asked.length, 0,
    'opening the modal looks nothing up — a ten-item enquiry is not ten lookups nobody wanted');
  await page.evaluate(() => wqaHistToggle(0));
  await page.waitForTimeout(500);

  // ── what it asks for ─────────────────────────────────────────────────────
  A.ok(asked.length > 0, 'the endpoint was called');
  const q = asked[asked.length - 1];
  A.eq(q.action, 'get_pricing_history', 'the pricing-history action');
  A.eq(q.cleanSize, 'M20', 'with the size');
  A.eq(q.material, '4140', 'the material');
  A.eq(q.sizeType, 'FULLSIZE', 'the size type');
  A.eq(q.finish, 'PL', 'the finish');
  A.eq(q.productType, 'L BOLT', 'and the product');
  A.ok(!('qty' in q), 'and never a quantity — a historical qty of 1 is still the same item');
  A.ok('dimensionPreview' in q, 'dimensions are sent to RANK the answer');
  A.eq(q.company_id, String(ALPHA), 'for this customer');

  // ── the bar, and the records behind it ───────────────────────────────────
  let ui = await page.evaluate(() => {
    const card = document.querySelector('[data-wqa-row="0"]');
    return { bar: (card.querySelector('.wqa-hist-bar') || {}).textContent || '',
             open: !!card.querySelector('.ph-scroll') };
  });
  A.includes(ui.bar, 'Pricing History', 'the row carries a Pricing History bar');
  A.includes(ui.bar, '6 records', 'with the count on it');
  A.includes(ui.bar, '5 this customer', 'and how many are this customer\'s');
  A.includes(ui.bar, '1 other', 'and how many are not');
  A.eq(ui.open, 'true', 'and the records themselves, because this row was asked about');

  const panel = await page.evaluate(() => {
    const card = document.querySelector('[data-wqa-row="0"]');
    return { text: (card.querySelector('.ph-scroll') || {}).textContent || '',
             count: card.querySelectorAll('.ph-rec').length,
             refs: [...card.querySelectorAll('.ph-rec-ref')].map(n => n.textContent),
             own: [...card.querySelectorAll('.ph-rec')].map(n => n.className.includes('ph-rec-own')),
             countLine: (card.querySelector('.ph-count') || {}).textContent || '' };
  });
  A.eq(panel.count, '6', 'opening it shows every record');
  A.includes(panel.countLine, 'Showing 6 of 6', 'and says how many of how many');

  // ── each record explains its own price ───────────────────────────────────
  A.includes(panel.text, 'Q2026-0001', 'the quotation reference');
  A.includes(panel.text, 'ADVANCE', 'the customer');
  A.includes(panel.text, 'L 1000 x W 100 x TL 150mm', 'the dimensions that rod was');
  A.includes(panel.text, 'RM 5.00', 'the cost rate');
  A.includes(panel.text, 'RM 4.00', 'the additional cost');
  A.includes(panel.text, '4%', 'the markup');
  A.includes(panel.text, 'RM 30.00', 'and the unit price');
  A.includes(panel.text, 'Q2025-0831', 'a second quotation of the same specification');
  A.includes(panel.text, 'L 500 x W 100 x TL 100mm', 'at a different length');
  A.includes(panel.text, 'RM 3.00', 'with a different additional cost — which is why it cost less');
  A.includes(panel.text, 'RM 26.00', 'and its own price');
  A.includes(panel.text, 'RM 4.70', 'a third at a different cost rate');
  A.includes(panel.text, '5%', 'and a different markup');

  // ── dimensions rank; they never hide ─────────────────────────────────────
  A.includes(panel.text, 'Same dimensions', 'the identical rod is marked');
  A.includes(panel.text, 'Differs by', 'and the ones that differ say by how much, rather than only that they do');
  A.includes(panel.text, 'L 1500 x W 150 x TL 200mm', 'including the longest one');

  // ── what makes two similar records cost different money ──────────────────
  A.includes(panel.text, 'Unit Weight', 'the weight that rod was, so a heavier rod explains a dearer price');
  A.includes(panel.text, '2.4662 kg/pc', 'as it was recorded');
  A.includes(panel.text, 'Price Mode', 'and how the price was arrived at');
  A.includes(panel.text, 'Auto Round', 'named for a record that says so');
  A.includes(panel.text, 'Legacy / Unknown', 'and said to be unknown for one that never recorded it');

  // ── same customer first, others named ────────────────────────────────────
  A.eq(panel.own.slice(0, 5).every(Boolean), 'true', 'this customer\'s five records come first');
  A.eq(panel.own[5], 'false', 'and the other customer\'s comes after them');
  A.includes(panel.text, 'Gamma Steel', 'who is named');
  A.includes(panel.text, 'Other customer reference', 'and labelled as a reference, not as this customer\'s price');

  // ── accessories are a separate component ─────────────────────────────────
  A.includes(panel.text, 'Bolt Unit Price', 'a record with accessories reports the BOLT price');
  A.includes(panel.text, 'Accessories, separately', 'and the accessories separately');
  A.includes(panel.text, '2 Nut PL + 1 FW PL', 'naming them');
  A.includes(panel.text, 'RM 0.70', 'and what they cost');
  A.includes(panel.text, 'quotation line was RM 30.70', 'while still reporting the line the customer received');
  A.includes(panel.text, 'Accessories not separable',
    'and an old record that cannot prove the separation says so instead of inventing one');
  A.includes(panel.text, 'Legacy record', 'legacy records are labelled');

  // ── no statistics, no recommendation ─────────────────────────────────────
  /* The visible page, not the script element that also lives in the body. */
  const wholePage = await page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style').forEach(n => n.remove());
    return clone.textContent || '';
  });
  ['Avg', 'Average', 'Suggest', 'Suggested', 'Recommended'].forEach(word =>
    A.excludes(wholePage, word, `nothing on the screen says "${word}"`));
  A.excludes(panel.text, 'Last Quoted', 'and there is no headline figure to read as a recommendation');

  // ── nothing is copied without being asked ────────────────────────────────
  rows = await rowState(page);
  A.eq(rows[0].priceMode, 'auto', 'the row is still pricing itself');
  A.eq(rows[0].manualPrice, '', 'with no historical figure copied into it');
  A.eq(rows[0].usedHistoryRef, '', 'and no record claimed');
  const computed = Number(rows[0].price);
  A.ok(Math.abs(computed - 30) > 0.001 || computed === 0,
    'the row\'s own price is its own, not the RM 30.00 sitting in its history');

  await page.evaluate(() => wqaHistUse(0, 0));
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.eq(rows[0].priceMode, 'manual', 'pressing Use this price is what moves the row to a manual price');
  A.eq(rows[0].manualPrice, '30', 'at the BOLT price, not the quotation line');
  A.eq(rows[0].usedHistoryRef, 'Q2026-0001', 'and the row records which quotation it came from');
  A.near(rows[0].price, 30, 0.001, 'which is what it now charges');
  A.includes(rows[0].badges, 'Q2026-0001', 'and says so on the row');

  // a record that cannot be separated from its accessories is not reusable
  const before = await page.evaluate(() => wqa.rows[0].manualPrice);
  const ambiguousAt = await page.evaluate(() =>
    wqa.rows[0].hist.records.findIndex(r => r.accessoryAmbiguous));
  A.ok(Number(ambiguousAt) >= 0, 'the ambiguous record is in the list');
  await page.evaluate(n => wqaHistUse(0, n), Number(ambiguousAt));
  await page.waitForTimeout(500);
  A.eq(await page.evaluate(() => wqa.rows[0].manualPrice), before,
    'an ambiguous record refuses to be reused rather than reusing a price that includes nuts');

  // ── a manual price is not replaced by a later lookup ─────────────────────
  await page.evaluate(() => { wqaEditRowManualPrice(0, '99.50'); });
  await page.waitForTimeout(500);
  await page.evaluate(() => wqaLoadHistory());
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.eq(rows[0].manualPrice, '99.50', 'a price typed by hand survives a history refresh');
  A.eq(rows[0].usedHistoryRef, '', 'and stops claiming a record it is no longer using');

  // ── pagination: the whole history, a page at a time ──────────────────────
  const paged = await openApp(browser, {
    api: { get_pricing_history: url => {
      const p = new URL(url).searchParams;
      const off = parseInt(p.get('offset') || '0', 10);
      const lim = parseInt(p.get('limit') || '20', 10);
      const many = [];
      for (let n = 0; n < 47; n++) many.push(rec({ quotationId: 100 + n, refNo: 'Q-' + n, date: '2026-01-01' }));
      return { ok: true, data: { records: many.slice(off, off + lim), total: many.length,
                                 ownTotal: many.length, otherTotal: 0, offset: off, limit: lim } };
    } },
  });
  await paged.evaluate(id => { selectedCompanyId = id; }, ALPHA);
  await quickAddPaste(paged, MSG, { settle: 1000 });
  await paged.waitForTimeout(800);
  await paged.evaluate(() => wqaHistToggle(0));
  await paged.waitForTimeout(400);
  let pg = await paged.evaluate(() => ({
    shown: document.querySelectorAll('[data-wqa-row="0"] .ph-rec').length,
    line: (document.querySelector('[data-wqa-row="0"] .ph-count') || {}).textContent || '',
    more: !!document.querySelector('[data-wqa-row="0"] .ph-more'),
  }));
  A.eq(pg.shown, '20', 'a long history renders one page, not all of it');
  A.includes(pg.line, 'Showing 20 of 47', 'and says how much more there is');
  A.eq(pg.more, 'true', 'with a way to see it');
  await paged.evaluate(() => wqaHistMore(0));
  await paged.waitForTimeout(700);
  pg = await paged.evaluate(() => ({
    shown: document.querySelectorAll('[data-wqa-row="0"] .ph-rec').length,
    line: (document.querySelector('[data-wqa-row="0"] .ph-count') || {}).textContent || '',
  }));
  A.eq(pg.shown, '40', 'Load more brings the next page');
  A.includes(pg.line, 'Showing 40 of 47', 'and the count follows');
  await paged.close();

  // ── an incomplete specification is not looked up ─────────────────────────
  const partial = await openApp(browser, { api: { get_pricing_history: pricingHistory } });
  await partial.evaluate(id => { selectedCompanyId = id; }, ALPHA);
  await quickAddPaste(partial, '4140 QT L BOLT FULLSIZE\nM20 x 1000 x 100 x 150 - 40pcs', { settle: 900 });
  await partial.waitForTimeout(700);
  const spec = await partial.evaluate(() => ({
    finish: wqa.rows[0].finish || wqa.common.finish || '',
    spec: wqaHistSpec(wqa.rows[0]),
  }));
  if (!spec.finish) A.eq(String(spec.spec), 'null',
    'a row with no finish stated is not looked up — an empty field means "any" to the server');
  else A.ok(true, 'the message stated a finish after all — case not applicable');
  await partial.close();

  // ── a failed lookup is not an empty one ──────────────────────────────────
  const failed = await openApp(browser, { api: { get_pricing_history: () => ({ ok: false, error: 'signed out' }) } });
  await failed.evaluate(id => { selectedCompanyId = id; }, ALPHA);
  await quickAddPaste(failed, MSG, { settle: 900 });
  await failed.evaluate(() => wqaHistToggle(0));
  await failed.waitForTimeout(800);
  const failText = await failed.evaluate(() =>
    (document.querySelector('[data-wqa-row="0"] .wqa-hist') || {}).textContent || '');
  A.includes(failText, 'Could not load', 'a failed lookup says the check did not run');
  A.excludes(failText, 'No pricing history', 'not that the customer has none');

  // ── the entry form reads the same history, the same way ──────────────────
  const form = await openApp(browser, { api: { get_pricing_history: pricingHistory } });
  await form.evaluate(id => { selectedCompanyId = id; }, ALPHA);
  const formPanel = await form.evaluate(async () => {
    switchType('lbolt');
    document.getElementById('lbolt-material').value = '4140';
    document.getElementById('lbolt-sizeType').value = 'FULLSIZE';
    document.getElementById('lbolt-size').value = 'M20'; onSizeCommit('lbolt');
    setFinishValue('lbolt', 'PL');
    await checkPreviousPrice();
    return { text: (document.getElementById('phList') || {}).textContent || '',
             recs: document.querySelectorAll('#phList .ph-rec').length,
             shown: document.getElementById('phResults').style.display };
  });
  A.eq(formPanel.shown, 'block', 'the entry form panel opens');
  A.eq(formPanel.recs, '6', 'showing the same six records');
  A.includes(formPanel.text, 'Q2026-0001', 'the same references');
  A.includes(formPanel.text, 'Gamma Steel', 'the same other-customer labelling');
  A.excludes(formPanel.text, 'Avg', 'and no average anywhere');
  await form.close();

  /* ── Closeness, measured the same way on both sides ──────────────────────
     The server ranks the page it sends and the browser re-ranks it for the row
     that asked, so the two formulas have to agree to the millimetre. The table
     below is the same one tests/php/pricing_history.test.php runs through
     dc_dim_distance; if either implementation drifts, one of the two suites
     fails. */
  const DIST = [
    ['L 600 x W 100 x TL 150mm', 'L 600 x W 100 x TL 150mm', 0, 'the identical rod'],
    ['L 600 x W 100 x TL 150mm', 'L 500 x W 100 x TL 150mm', 100, '100mm shorter'],
    ['L 600 x W 100 x TL 150mm', 'L 1000 x W 100 x TL 150mm', 400, '400mm longer'],
    ['L 600 x W 100 x TL 150mm', 'L 1200 x W 100 x TL 150mm', 600, '600mm longer'],
    ['L 600 x W 100 x TL 150mm', 'L 500 x W 100 x TL 100mm', 150, 'shorter rod and shorter thread together'],
    ['L 600 x W 100 x TL 150mm', 'L 1000 x W 200 x TL 250mm', 600, 'every dimension the product uses'],
    ['L 1000 x TL 100/100mm', 'L 1000 x TL 100/50mm', 50, 'a thread pair is read as both of its ends'],
    ['L 1000 x TL 100/100mm', 'L 900 x TL 100/100mm', 100, 'with the length still counting'],
    ['L 600 x W 100 x TL 150mm', '', null, 'a record with no dimensions has no distance'],
    ['', 'L 600 x W 100 x TL 150mm', null, 'and neither has an item quoted without them'],
  ];
  const measured = await page.evaluate(rows => rows.map(r => {
    const d = phDimDistance(r[0], r[1]);
    return d === null ? 'null' : String(d);
  }), DIST);
  DIST.forEach((c, i) => A.eq(measured[i], c[2] === null ? 'null' : String(c[2]),
    'closeness: ' + c[3]));

  /* An M24 is never a candidate at all — core identity is a hard boundary that
     closeness is only asked about afterwards. The endpoint is asked for M20 and
     answers with M20s; the browser never widens that. */
  const asked20 = asked.filter(q => String(q.cleanSize || '').toUpperCase() === 'M20');
  A.ok(asked20.length > 0, 'the lookup asks for the size on the row');
  A.eq(asked.some(q => /M24|M18|M22/i.test(String(q.cleanSize || ''))), 'false',
    'and never for a neighbouring size');

  const ordered = await page.evaluate(() => {
    const rec = (ref, own, dist, date) => ({ refNo: ref, own, dimDistance: dist, date, quotationId: 1 });
    const rows = [
      rec('OTHER-EXACT', false, 0, '2026-09-09'),
      rec('OWN-1200', true, 600, '2026-01-01'),
      rec('OWN-500', true, 100, '2025-01-01'),
      rec('OWN-1000', true, 400, '2026-06-06'),
      rec('OWN-EXACT', true, 0, '2024-01-01'),
      rec('OTHER-1000', false, 400, '2026-12-12'),
    ];
    return phSortRecords(rows).map(r => r.refNo).join(',');
  });
  A.eq(ordered, 'OWN-EXACT,OWN-500,OWN-1000,OWN-1200,OTHER-EXACT,OTHER-1000',
    'reading order: this customer first, nearest rod first within them, and a stranger\'s exact match never above them');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
