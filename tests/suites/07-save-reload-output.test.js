/* ── Save, reload, edit, save again — and what the customer reads ──────────
   Requirements 39, 40, 41, 42.

   The round trip is the real one: items are committed through the real add
   path, the payload the app would POST is captured, and a FRESH page is opened
   with that payload handed over in sessionStorage exactly as companies.php
   does. Nothing is re-implemented, so a drift between what is written and what
   is read back shows up here.                                                */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');

const RHO_K = 0.0000061654;

module.exports = async (browser, A) => {
  const S = A.suite('save / reload / output — no value drift, no internal costs on the page');

  let payload = null;
  const page = await openApp(browser, {
    api: {
      save_quotation: (url, req) => {
        try { payload = JSON.parse(req.postData() || 'null'); } catch (e) { payload = null; }
        return { ok: true, id: 42, ref_no: 'DC-TEST-001' };
      },
    },
  });

  // ── build a quotation with a metric row and an imperial row ──────────────
  await quickAddPaste(page, [
    'MS SAG ROD PL FULLSIZE',
    'M20 x 1000 x 100/100 - 4pcs',
    '',
    'MS ANCHOR BOLT HDG FULLSIZE',
    '1/2 x 300 x 100 - 6pcs',
  ].join('\n'), { settle: 900 });

  const built = await page.evaluate(() => {
    /* Give every row a rate so the calculator will accept them. */
    wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '5'); wqaEditPrice(i, 'addCost', '1'); });
    return wqa.rows.map(r => ({ size: r.size, len: r.length, qty: r.qty, product: r.product }));
  });
  await page.waitForTimeout(900);
  A.eq(built.length, 2, 'two rows to commit');
  A.eq(built[0].size, 'M20', 'a metric one');
  A.eq(built[1].size, '1/2', 'and an imperial one');

  await page.evaluate(() => wqaAddAll());
  await page.waitForTimeout(1200);

  const committed = await page.evaluate(() => quoteItems.map(i => ({
    itemType: i.itemType, desc: i.desc, size: i.size, sizeCode: i.sizeCode, cleanSize: i.cleanSize,
    sizeType: i.sizeType, material: i.material, finish: i.finish, qty: i.qty,
    weight: i.weight, unit: i.finalUnitPrice, total: i.totalAmount,
    dimensionPreview: i.dimensionPreview, priceMode: i.priceMode,
  })));
  A.eq(committed.length, 2, 'both rows reached the quotation');

  const metric = committed.find(i => i.sizeCode === 'M20');
  const imperial = committed.find(i => i.sizeCode === '1/2');
  A.ok(!!metric, 'the metric item is there');
  A.ok(!!imperial, 'and the imperial one');
  A.includes(metric.size, 'M20', 'the metric size carries its M on the printed label');
  A.includes(imperial.size, '1/2"', 'and the imperial size carries its inch mark');
  A.eq(imperial.sizeCode, '1/2', 'while the canonical size the app looks prices up by stays 1/2');
  A.near(metric.weight, 20 * 20 * 1000 * RHO_K, 1e-9, 'the metric weight is the one the calculator produced');
  A.near(imperial.weight, 12.7 * 12.7 * 300 * RHO_K, 1e-9, 'and the imperial weight uses 12.7mm, the half inch');
  A.near(metric.total, metric.unit * metric.qty, 1e-9, 'line total is unit price x qty');
  A.near(imperial.total, imperial.unit * imperial.qty, 1e-9, 'for both');

  // ── save ─────────────────────────────────────────────────────────────────
  await page.evaluate(() => {
    document.getElementById('qi-customer').value = 'Alpha Sdn Bhd';
    syncQI();
  });
  await page.evaluate(async () => {
    /* The save modal's own submit path, without the modal. */
    await api('save_quotation', {
      ref_no: el('qi-refno').value, quote_date: el('qi-date').value,
      customer_name: el('qi-customer').value, customer_phone: '',
      prepared_by: '', remarks: '', company_id: null,
      items: quoteItems, total_amount: quoteItems.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0),
    }, 'POST');
  });
  A.ok(payload && Array.isArray(payload.items), 'the save payload carried the items');
  A.eq(payload.items.length, 2, 'both of them');

  // ── reload it into a fresh page, the way companies.php hands it over ──────
  const reopened = await openApp(browser, {
    handoff: { id: 42, ref_no: 'DC-TEST-001', quote_date: payload.quote_date,
               customer_name: 'Alpha Sdn Bhd', items: payload.items },
  });
  const reloaded = await reopened.evaluate(() => quoteItems.map(i => ({
    itemType: i.itemType, desc: i.desc, size: i.size, sizeCode: i.sizeCode,
    sizeType: i.sizeType, material: i.material, finish: i.finish, qty: i.qty,
    weight: i.weight, unit: i.finalUnitPrice, total: i.totalAmount,
    dimensionPreview: i.dimensionPreview,
  })));
  A.eq(reloaded.length, 2, 'the saved quotation reopened with both items');
  ['itemType', 'desc', 'size', 'sizeCode', 'sizeType', 'material', 'finish', 'qty',
   'weight', 'unit', 'total', 'dimensionPreview'].forEach(k => {
    A.eq(String(reloaded[0][k]), String(committed[0][k]), `${k} survived save and reload (item 1)`);
    A.eq(String(reloaded[1][k]), String(committed[1][k]), `${k} survived save and reload (item 2)`);
  });

  // ── edit an item and save again: only what was edited changes ────────────
  const edited = await reopened.evaluate(() => {
    unlockSavedQuotation();
    editItem(0);
    const t = resolveItemType(quoteItems[0]);
    const before = { weight: quoteItems[0].weight, unit: quoteItems[0].finalUnitPrice, qty: quoteItems[0].qty };
    document.getElementById(t + '-qty').value = '9';
    ({ sagrod: addSagRod, stud: addStud, anchorbolt: addAnchorBolt, ubolt: addUBolt,
       squbolt: addSQUBolt, lbolt: addLBolt, jbolt: addJBolt })[t]();
    return { before, after: { weight: quoteItems[0].weight, unit: quoteItems[0].finalUnitPrice,
                              qty: quoteItems[0].qty, total: quoteItems[0].totalAmount,
                              size: quoteItems[0].size, count: quoteItems.length } };
  });
  A.eq(edited.after.count, '2', 'updating an item does not add a second copy of it');
  A.eq(edited.after.qty, '9', 'the quantity changed');
  A.near(edited.after.weight, edited.before.weight, 1e-9, 'and the weight did not drift');
  A.near(edited.after.unit, edited.before.unit, 1e-9, 'nor the unit price');
  A.near(edited.after.total, edited.after.unit * 9, 1e-9, 'the line total followed the quantity');

  // ── what the customer reads ──────────────────────────────────────────────
  const output = await reopened.evaluate(() => ({
    wa: buildWAItemsText(),
    quote: buildQuoteText(),
    printDesc: quoteItems.map(getPrintItemDescription).join(' | '),
    printDim: quoteItems.map(getPrintItemDimension).join(' | '),
  }));
  ['Cost Rate', 'costRate', 'Additional Cost', 'addCost', 'Markup', 'markup'].forEach(word => {
    A.excludes(output.wa, word, `the WhatsApp message never mentions ${word}`);
    A.excludes(output.quote, word, `nor does the quotation text`);
  });
  A.includes(output.printDim, 'M20', 'the printed dimension carries the metric M');
  A.includes(output.printDim, '1/2"', 'and the imperial inch mark');
  A.includes(output.wa, 'M20', 'the WhatsApp message carries the metric M');
  A.includes(output.wa, '1/2"', 'and the inch mark');

  // ── two items that differ only by a custom dimension are two lines ────────
  const dedupe = await reopened.evaluate(() => {
    quoteItems.length = 0;
    const base = { itemType: 'sagrod', desc: 'MS FULLSIZE SAG ROD', finish: 'PL',
                   size: 'M20 x L 1000', qty: 1, finalUnitPrice: 12, totalAmount: 12,
                   markup: 0, material: 'MS', sizeCode: 'M20', sizeType: 'FULLSIZE',
                   productType: 'SAG ROD', cleanSize: 'M20', dimensionPreview: 'L 1000',
                   accessories: null, weight: 2.47 };
    quoteItems.push({ ...base, customDimensions: [{ label: 'H2', value: '530' }] });
    quoteItems.push({ ...base, customDimensions: [{ label: 'H2', value: '700' }] });
    renderQuote();
    return buildWAItemsText();
  });
  A.includes(dedupe, '530', 'the first annotated rod is in the message');
  A.includes(dedupe, '700', 'and so is the second — they are not the same line');

  A.ok(page._dcErrors.length === 0, 'no page errors on the building page: ' + page._dcErrors.join(' | '));
  A.ok(reopened._dcErrors.length === 0, 'none on the reopened one: ' + reopened._dcErrors.join(' | '));
  await reopened.close();
  await page.close();
  return S;
};
