/* ── Previous / Last Price ─────────────────────────────────────────────────
   Requirements 19-28, 49, 51.

   A lookup, never a suggestion. The api.php filter is mirrored here (exactly
   the fields it compares, and no others) so the test exercises the contract
   the browser actually relies on, and every request the page makes is captured
   so the parameters themselves can be asserted — quantity must never be one of
   them.                                                                      */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* Saved history. Two customers, deliberately different rates for the SAME
   specification, so a merge or an average would be visible immediately. */
const HISTORY = [
  { productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M20',
    dimensionPreview: 'L 1000 x TL 100/100mm', qty: 1,   unitPrice: 12.50, date: '2026-05-01', customer: 'Alpha Sdn Bhd', refNo: 'DC-A-100' },
  { productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M20',
    dimensionPreview: 'L 750 x TL 100/100mm',  qty: 400, unitPrice: 9.80,  date: '2026-06-01', customer: 'Alpha Sdn Bhd', refNo: 'DC-A-200' },
  { productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M24',
    dimensionPreview: 'L 1000 x TL 100/100mm', qty: 20,  unitPrice: 30.00, date: '2026-06-10', customer: 'Beta Engineering', refNo: 'DC-B-300' },
  { productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'HDG', cleanSize: 'M20',
    dimensionPreview: 'L 1000 x TL 100/100mm', qty: 5,   unitPrice: 44.00, date: '2026-06-11', customer: 'Beta Engineering', refNo: 'DC-B-301' },
  { productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE', finish: 'PL', cleanSize: 'M20',
    dimensionPreview: 'L 1000 x TL 100/100mm', qty: 5,   unitPrice: 55.00, date: '2026-06-12', customer: 'Beta Engineering', refNo: 'DC-B-302' },
  { productType: 'L BOLT', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M20',
    dimensionPreview: 'L 1000 x W 100 x TL 100mm', qty: 5, unitPrice: 66.00, date: '2026-06-13', customer: 'Beta Engineering', refNo: 'DC-B-303' },
  /* Same exact specification as Alpha's first row, different customer, very
     different price. Only ever reachable as a labelled reference. */
  { productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M22',
    dimensionPreview: 'L 1000 x TL 100/100mm', qty: 3,   unitPrice: 21.00, date: '2026-06-14', customer: 'Gamma Steel', refNo: 'DC-G-400' },
];

const ALPHA = 7;                                  // Alpha Sdn Bhd's company id
const COMPANY_OF = { 'Alpha Sdn Bhd': ALPHA, 'Beta Engineering': 8, 'Gamma Steel': 9 };

const seen = [];
/* api.php's own filter, mirrored: product, material, size type, finish and
   size, each compared exactly and case-insensitively, plus the company. There
   is deliberately no quantity here, because there is none there. */
function priceHistory(url) {
  const p = new URL(url).searchParams;
  seen.push(Object.fromEntries(p.entries()));
  const eq = (a, b) => String(a || '').toUpperCase() === String(b || '').toUpperCase();
  const cid = p.get('company_id');
  const data = HISTORY.filter(h =>
       (!p.get('productType') || eq(h.productType, p.get('productType')))
    && (!p.get('material')    || eq(h.material,    p.get('material')))
    && (!p.get('sizeType')    || eq(h.sizeType,    p.get('sizeType')))
    && (!p.get('finish')      || eq(h.finish,      p.get('finish')))
    && (!p.get('cleanSize')   || eq(h.cleanSize,   p.get('cleanSize')))
    && (cid == null || COMPANY_OF[h.customer] === Number(cid)));
  return { ok: true, data };
}

module.exports = async (browser, A) => {
  const S = A.suite('previous price — this customer first, and only then a reference');
  const page = await openApp(browser, { api: { get_price_history: priceHistory } });

  const asAlpha = async text => {
    await page.evaluate(id => { selectedCompanyId = id; }, ALPHA);
    await quickAddPaste(page, text, { settle: 900 });
    await page.waitForTimeout(700);
    return rowState(page);
  };

  // ── 1. this customer, exact specification AND exact dimensions ───────────
  let rows = await asAlpha('MS SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 250pcs');
  A.ok(rows[0].history && rows[0].history.rec, 'a previous price was found');
  A.eq(rows[0].history.own, 'true', 'and it is this customer\'s own');
  A.eq(rows[0].history.exact, 'true', 'and the dimensions match too');
  A.eq(rows[0].history.rec.refNo, 'DC-A-100', 'it is Alpha\'s M20 x 1000 record');
  A.eq(rows[0].history.rec.unitPrice, '12.5', 'at the price that quotation actually carried');

  let html = await page.evaluate(() => document.querySelector('[data-wqa-row="0"] .wqa-hist').textContent);
  A.includes(html, 'Same customer', 'the row says whose price this is');
  A.includes(html, 'exact specification', 'and how exactly it matched');
  A.includes(html, 'Last Price RM 12.50', 'shown as a Last Price, not a suggestion');
  A.excludes(html, 'Suggest', 'nothing on this row calls it a suggestion');

  // ── 2. quantity plays no part ────────────────────────────────────────────
  A.eq(rows[0].qty, '250', 'this row is for 250 pieces');
  A.eq(rows[0].history.rec.qty, '1', 'the historical record was for 1 — and still matched');
  A.ok(seen.length > 0, 'the history endpoint was called');
  seen.forEach(q => A.ok(!('qty' in q), 'no request ever sends a quantity: ' + JSON.stringify(q)));

  // ── 3. same specification, different dimensions — labelled as such ───────
  rows = await asAlpha('MS SAG ROD PL FULLSIZE\nM20 x 1250 x 100/100 - 10pcs');
  A.eq(rows[0].history.own, 'true', 'still this customer');
  A.eq(rows[0].history.exact, 'false', 'but not the same rod');
  html = await page.evaluate(() => document.querySelector('[data-wqa-row="0"] .wqa-hist').textContent);
  A.includes(html, 'same specification, different dimensions', 'and the row says exactly that');

  // ── 4. a different M size must not match ─────────────────────────────────
  rows = await asAlpha('MS SAG ROD PL FULLSIZE\nM12 x 1000 x 100/100 - 10pcs');
  A.eq(rows[0].history, 'null', 'M12 does not match Alpha\'s M20 — no nearest size, no interpolation');
  html = await page.evaluate(() => document.querySelector('[data-wqa-row="0"] .wqa-hist').textContent);
  A.includes(html, 'No previous price found', 'and it says so plainly');

  // ── 5. a different finish, size type or product must not match ───────────
  await page.evaluate(id => { selectedCompanyId = id; }, COMPANY_OF['Beta Engineering']);
  await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 10pcs', { settle: 900 });
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.ok(!rows[0].history || rows[0].history.own !== true,
    'Beta has an HDG M20, an undersize M20 and an L Bolt M20 — none of them is this PL fullsize Sag Rod');
  if (rows[0].history && rows[0].history.rec) {
    A.eq(rows[0].history.own, 'false', 'so anything shown is another customer\'s, and says so');
    A.eq(rows[0].history.rec.refNo, 'DC-A-100', 'namely Alpha\'s — the only PL fullsize M20 Sag Rod on record');
  }

  // ── 6. the other-customer fallback, named as a reference ─────────────────
  await page.evaluate(id => { selectedCompanyId = id; }, COMPANY_OF['Beta Engineering']);
  await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM22 x 1000 x 100/100 - 10pcs', { settle: 900 });
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.ok(rows[0].history && rows[0].history.rec, 'Beta has no M22, so the search widened');
  A.eq(rows[0].history.own, 'false', 'and what it found is not Beta\'s');
  A.eq(rows[0].history.rec.refNo, 'DC-G-400', 'it is Gamma Steel\'s exact-specification record');
  html = await page.evaluate(() => document.querySelector('[data-wqa-row="0"] .wqa-hist').textContent);
  A.includes(html, 'Reference Price RM 21.00', 'shown as a Reference Price, not as a Last Price');
  A.includes(html, 'Other customer', 'labelled as somebody else\'s');
  A.includes(html, 'Gamma Steel', 'and the somebody is named');
  A.excludes(html, 'Last Price', 'it is never presented as this customer\'s own');

  // ── 7. the customer's own record outranks a stranger's ───────────────────
  await page.evaluate(id => { selectedCompanyId = id; }, ALPHA);
  await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM20 x 750 x 100/100 - 10pcs', { settle: 900 });
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.eq(rows[0].history.own, 'true', 'Alpha has their own M20, so no other customer is consulted');
  A.eq(rows[0].history.rec.refNo, 'DC-A-200', 'their 750mm record');
  A.eq(rows[0].history.rec.unitPrice, '9.8', 'at their own price');

  // ── 8. nothing anywhere ──────────────────────────────────────────────────
  await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM48 x 1000 x 100/100 - 10pcs', { settle: 900 });
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.eq(rows[0].history, 'null', 'no M48 exists for anybody');
  html = await page.evaluate(() => document.querySelector('[data-wqa-row="0"] .wqa-hist').textContent);
  A.includes(html, 'No previous price found', 'and no price is invented to fill the gap');

  // ── 9. a previous price never overwrites a price by itself ───────────────
  await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 10pcs', { settle: 900 });
  await page.waitForTimeout(700);
  rows = await rowState(page);
  const computed = Number(rows[0].price);
  A.ok(computed > 0, 'the row priced itself from its own weight and rates');
  A.ok(rows[0].history && rows[0].history.rec, 'and a previous price is on offer');
  A.ok(Math.abs(computed - 12.5) > 0.001, 'but the row is NOT showing the historical 12.50');
  const mode = await page.evaluate(() => wqa.rows[0].priceMode + '|' + wqa.rows[0].useLastPrice);
  A.eq(mode, 'auto|false', 'nothing switched the row to a manual price on its own');

  // and only when a person asks for it
  await page.evaluate(() => wqaUseLastPrice(0));
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.eq(await page.evaluate(() => String(wqa.rows[0].manualPrice)), '12.5', 'clicking Use Last Price takes the historical figure');
  A.near(rows[0].price, 12.5, 0.001, 'and the row now shows it');

  // and a manual price a person typed is not replaced by history
  await page.evaluate(() => { wqaEditRowMode(0, 'manual'); wqaEditRowManualPrice(0, '15.75'); });
  await page.waitForTimeout(700);
  await page.evaluate(() => wqaLoadHistory());
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.near(rows[0].price, 15.75, 0.001, 'a manually entered price survives a history refresh');

  // ── 10. an incomplete specification is not looked up at all ─────────────
  await page.evaluate(id => { selectedCompanyId = id; }, COMPANY_OF['Beta Engineering']);
  await quickAddPaste(page, 'MS SAG ROD FULLSIZE\nM20 x 1000 x 100/100 - 10pcs', { settle: 900 });
  await page.waitForTimeout(700);
  const noFinish = await page.evaluate(() => ({
    finish: wqa.rows[0].finish || wqa.common.finish || '',
    spec: wqaHistSpec(wqa.rows[0]),
    hist: wqa.rows[0].history,
  }));
  if (!noFinish.finish) {
    A.eq(String(noFinish.spec), 'null', 'a row with no finish stated is not looked up — an empty finish means "any" to the server');
    A.eq(String(noFinish.hist), 'null', 'so Beta\'s HDG M20 at RM 44.00 is never offered as this rod\'s own price');
  } else {
    A.ok(true, 'the message stated a finish after all — case not applicable');
  }

  // ── 11. a lookup that FAILED is not a lookup that found nothing ─────────
  const failPage = await openApp(browser, { api: { get_price_history: () => ({ ok: false, error: 'signed out' }) } });
  await failPage.evaluate(() => { selectedCompanyId = 7; });
  await quickAddPaste(failPage, 'MS SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 10pcs', { settle: 900 });
  await failPage.waitForTimeout(800);
  const failed = await failPage.evaluate(() => ({
    hist: JSON.stringify(wqa.rows[0].history),
    text: document.querySelector('[data-wqa-row="0"] .wqa-hist').textContent,
  }));
  A.includes(failed.hist, 'failed', 'a failed lookup is recorded as a failure');
  A.includes(failed.text, 'Could not check', 'and the row says the check did not run');
  A.excludes(failed.text, 'No previous price found', 'it does not assert that the customer has no history');
  await failPage.close();

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
