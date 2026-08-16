/* ── A bolt's price is the bolt's ──────────────────────────────────────────
   Final delta, requirement 1.

   Ticking two nuts used to turn a bolt quoted at RM12.00 into a bolt quoted at
   RM12.50. The figure staff read as "what this bolt costs" therefore depended
   on what was packed beside it, the pricing history built from those figures
   compared bolts against bolts-plus-hardware, and nothing on the screen said
   which of the two a given number was.

   Accessories are now their own component: their own charge, on the line,
   never inside the item's own price. What must NOT change is the money — a
   separation that quietly stopped charging for nuts would be the worse bug of
   the two — so every assertion here checks both halves: the bolt price holds
   still, and the line still collects the accessories.                       */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const MSG = 'MS SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 10pcs';

module.exports = async (browser, A) => {
  const S = A.suite('accessories — charged beside the bolt, never inside it');
  const page = await openApp(browser);

  // ── the calculator ───────────────────────────────────────────────────────
  const calc = await page.evaluate(() => {
    quoteItems.length = 0;
    switchType('sagrod');
    productEntryTouchedFields.clear();
    document.getElementById('sagrod-material').value = 'MS';
    document.getElementById('sagrod-sizeType').value = 'FULLSIZE';
    document.getElementById('sagrod-size').value = 'M20'; onSizeCommit('sagrod');
    document.getElementById('sagrod-length').value = '1000';
    document.getElementById('sagrod-threadLen').value = '100';
    document.getElementById('sagrod-qty').value = '10';
    document.getElementById('sagrod-costRate').value = '5';
    document.getElementById('sagrod-addCost').value = '1';
    document.getElementById('sagrod-markup').value = '0';
    calcSagRod();
    const bare = Object.assign({}, priceCalcState.sagrod);
    document.getElementById('sagrod-nutEnabled').checked = true;
    onAccChange('sagrod');
    document.getElementById('sagrod-nutQty').value = '2';
    document.getElementById('sagrod-nutPrice').value = '0.30';
    onAccChange('sagrod');
    document.getElementById('sagrod-fwEnabled').checked = true;
    onAccChange('sagrod');
    document.getElementById('sagrod-fwQty').value = '1';
    document.getElementById('sagrod-fwPrice').value = '0.10';
    onAccChange('sagrod');
    const withAcc = Object.assign({}, priceCalcState.sagrod);
    return { bare, withAcc,
             shownFinal: (document.getElementById('cpFinal') || {}).textContent || '',
             shownAcc: (document.getElementById('cpAcc') || {}).textContent || '',
             shownLine: (document.getElementById('cpLine') || {}).textContent || '',
             lineHidden: !!(document.getElementById('cpLine') || {}).hidden };
  });

  A.ok(Number(calc.bare.finalUnitPrice) > 0, 'the bolt has a price before any accessory is chosen');
  A.near(calc.withAcc.finalUnitPrice, calc.bare.finalUnitPrice, 0.0001,
    'and choosing two nuts and a washer does not move it');
  A.near(calc.withAcc.accessoriesCost, 0.7, 0.0001, 'the accessories are RM0.70');
  A.near(calc.withAcc.lineUnitPrice, Number(calc.bare.finalUnitPrice) + 0.7, 0.0001,
    'and the line price is the two of them together');
  A.includes(calc.shownAcc, '0.70', 'the screen shows the accessory charge on its own');
  A.eq(calc.lineHidden, false, 'and says what the line comes to');
  A.includes(calc.shownLine, '0.70', 'naming the accessory charge');

  /* Hidden must mean hidden: the note sits inside a card whose own span rules
     are larger and greener, and a `display:block` of its own would have beaten
     the [hidden] attribute and left a stale line on screen after the add. */
  const noteOff = await page.evaluate(() => {
    const n = document.getElementById('cpLine');
    n.hidden = true;
    return getComputedStyle(n).display;
  });
  A.eq(noteOff, 'none', 'and it disappears when there is nothing beside the bolt');

  // ── the item it produces ─────────────────────────────────────────────────
  const item = await page.evaluate(() => {
    addSagRod();
    const it = quoteItems[0] || {};
    return { unit: it.finalUnitPrice, acc: it.accessoryUnitPrice, lineUnit: it.lineUnitPrice,
             accTotal: it.accessoryTotal, total: it.totalAmount, qty: it.qty,
             model: it.pricingModel, weight: it.weight,
             card: (document.querySelector('.qi-item') || {}).textContent || '' };
  });
  A.near(item.unit, calc.bare.finalUnitPrice, 0.0001, 'the saved item keeps the bolt\'s own price');
  A.eq(item.acc, '0.7', 'and records the accessory charge as its own figure');
  A.near(item.lineUnit, Number(calc.bare.finalUnitPrice) + 0.7, 0.0001, 'with the line price beside it');
  A.eq(item.qty, '10', 'ten of them');
  A.near(item.accTotal, 7, 0.0001, 'so the accessories come to RM7.00 across the line');
  A.near(item.total, (Number(calc.bare.finalUnitPrice) + 0.7) * 10, 0.0001,
    'and the line total charges for both — the separation does not make the nuts free');
  A.eq(item.model, 'bolt-separate', 'the item records which pricing model produced it');
  A.includes(item.card, 'Bolt', 'the item card calls the item\'s own price the bolt price');
  A.includes(item.card, 'Accessories', 'and shows the accessory charge beside it');

  // ── what the customer receives ───────────────────────────────────────────
  const out = await page.evaluate(() => {
    return { wa: buildWAItemsText('-'), dim: getPrintItemDimension(quoteItems[0]) };
  });
  A.includes(out.wa, 'cw 2nut & 1fw', 'the message names the accessories');
  A.includes(out.wa, 'RM0.70', 'and prices them, rather than promising them for nothing');
  A.excludes(out.dim, 'cw ', 'the print sheet does not also name them in the size cell — they get their own row');

  const printed = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    const rows = Array.from(document.querySelectorAll('#printItemsBody tr'))
      .map(tr => Array.from(tr.children).map(td => td.textContent.trim()));
    window.dispatchEvent(new Event('afterprint'));
    return rows;
  });
  A.eq(printed.length, 2, 'one printed row for the bolt and one for its accessories');
  A.eq(printed[0][3], '10', 'the bolt row is for ten pieces');
  A.eq(printed[1][3], '10', 'and so is the accessory row');
  A.eq(printed[1][4], 'RM 0.70', 'the accessory row carries its own unit price');
  A.eq(printed[1][5], 'RM 7.00', 'and its own amount');
  const boltUnit = Number(printed[0][4].replace(/[^\d.]/g, ''));
  const boltAmt = Number(printed[0][5].replace(/[^\d.]/g, ''));
  A.near(boltAmt, boltUnit * 10, 0.005,
    'quantity times unit price reconciles on the printed row, which it could not while the two were one figure');
  A.near(boltAmt + 7, Number(item.total), 0.005, 'and the two rows add up to the line total');

  // ── a saved quotation reopened ───────────────────────────────────────────
  let payload = null;
  const saving = await openApp(browser, {
    api: { save_quotation: (u, r) => { try { payload = JSON.parse(r.postData() || 'null'); } catch (e) {} return { ok: true, id: 7 }; } },
  });
  await quickAddPaste(saving, MSG, { settle: 900 });
  await saving.evaluate(() => {
    wqaEditPrice(0, 'costRate', '5'); wqaEditPrice(0, 'addCost', '1');
    wqaEditAcc(0, 'nut', 'enabled', true);
    wqaEditAcc(0, 'nut', 'qty', 2);
    wqaEditAcc(0, 'nut', 'unitPrice', 0.3);
  });
  await saving.waitForTimeout(900);
  const row = (await rowState(saving))[0];
  A.ok(Number(row.price) > 0, 'the Quick Add row prices the bolt');
  await saving.evaluate(() => wqaAddAll());
  await saving.waitForTimeout(1200);
  const committed = await saving.evaluate(async () => {
    const it = quoteItems[0] || {};
    await api('save_quotation', { ref_no: 'DC-TEST-001', quote_date: '2026-08-01',
      customer_name: 'ADVANCE', items: quoteItems,
      total_amount: quoteItems.reduce((s, i) => s + i.totalAmount, 0) }, 'POST');
    return { unit: it.finalUnitPrice, acc: it.accessoryUnitPrice, total: it.totalAmount, qty: it.qty };
  });
  A.eq(committed.acc, '0.6', 'a Quick Add row carries its accessories through as their own charge');
  A.near(committed.total, (Number(committed.unit) + 0.6) * Number(committed.qty), 0.005,
    'and its line total still collects them');
  await saving.close();

  const reopened = await openApp(browser, {
    handoff: { id: 7, ref_no: 'DC-TEST-001', customer_name: 'ADVANCE', items: payload.items },
  });
  const back = await reopened.evaluate(() => {
    const it = quoteItems[0] || {};
    return { unit: it.finalUnitPrice, acc: it.accessoryUnitPrice, total: it.totalAmount,
             model: it.pricingModel };
  });
  A.eq(back.unit, committed.unit, 'reopening the saved quotation returns the same bolt price');
  A.eq(back.acc, committed.acc, 'the same accessory charge');
  A.eq(back.total, committed.total, 'and the same line total — nothing drifts across the round trip');
  A.eq(back.model, 'bolt-separate', 'still marked as separately priced');
  await reopened.close();

  // ── an item priced before the separation existed ─────────────────────────
  /* Its manual price WAS the whole line: RM30.70 with RM0.70 of nuts inside it.
     Re-saving it must not charge the nuts twice, and must not quietly drop
     them either — the line the customer agreed to is RM30.70 either way. */
  const legacy = await page.evaluate(() => {
    quoteItems.length = 0;
    quoteItems.push({
      itemType: 'sagrod', desc: 'MS FULLSIZE SAG ROD', productType: 'SAG ROD',
      material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M20', sizeCode: 'M20',
      size: 'M20 x L 1000 x TL 100/100mm', dimensionPreview: 'L 1000 x TL 100/100mm',
      qty: 10, finalUnitPrice: 30.70, totalAmount: 307.00, markup: 0, weight: 2.4662,
      priceMode: 'manual', manualUnitPrice: '30.70',
      accessories: { nut: { enabled: true, qty: 2, finish: 'PL', unitPrice: 0.3 },
                     fw: { enabled: true, qty: 1, finish: 'PL', unitPrice: 0.1 },
                     custom: { enabled: false, text: '', unitPrice: 0 } },
      formData: { costRate: '5.00', addCost: '1.00', markup: '0', priceMode: 'manual',
                  manualUnitPrice: '30.70', qty: '10', size: 'M20', length: '1000', threadLen: '100/100' },
    });
    renderQuote();
    const beforeTotal = quoteItems[0].totalAmount;
    editItem(0);
    const box = document.getElementById('sagrod-manualUnitPrice');
    return { beforeTotal, manualAfterLoad: box ? box.value : '' };
  });
  A.eq(legacy.beforeTotal, '307', 'the legacy line was RM307.00 for ten');
  A.eq(legacy.manualAfterLoad, '30.00',
    'editing it moves the RM0.70 of accessories out of the manual price, leaving the bolt at RM30.00');

  const resaved = await page.evaluate(() => {
    addSagRod();
    const it = quoteItems[0] || {};
    return { unit: it.finalUnitPrice, acc: it.accessoryUnitPrice, total: it.totalAmount,
             count: quoteItems.length };
  });
  A.eq(resaved.count, '1', 'saving the edit replaces the item rather than adding a second');
  A.eq(resaved.unit, '30', 'the bolt is priced at RM30.00');
  A.eq(resaved.acc, '0.7', 'the accessories at RM0.70');
  A.eq(resaved.total, '307', 'and the customer\'s line total is exactly what it was — RM307.00');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
