/* ── Add to Quotation: the button at the end of the review ──────────────────
   The live blocker. A J Bolt row was complete on screen — product, size, all
   four dimensions, quantity, material, size type, and RM 7.40 reused from
   Q-2026-0125 — every warning cleared. "Add 1 Items to Quotation" answered
   "0 of 1 added — check the remaining rows", the quotation stayed empty, and
   the review closed, taking the row with it.

   These tests click the real button and read the real quotation list. Nothing
   here is proved through a helper: the assertion is the number of items in
   `quoteItems` and the text on the screen after a click.                     */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* One historical record, priced, so a row can reuse a price the way the live
   one did. The size is echoed back so any row matches. */
const histRecord = (size, price) => ({
  quotationId: 1, refNo: 'Q-2026-0125', date: '2026-01-25', customer: 'Alpha Sdn Bhd',
  companyId: 7, own: true, productType: 'J BOLT', material: '4140 QT', sizeType: 'FULLSIZE',
  finish: 'PL', cleanSize: size, dimensionPreview: 'H 150 x ID 26 x S 36 x TL 75mm',
  exactDims: true, qty: 50, unitPrice: price, boltUnitPrice: price, accessoryCost: 0,
  accessorySummary: '', accessoryAmbiguous: false, priceMode: 'manual',
  priceModeLabel: 'Manual', costRate: null, addCost: null, markup: null,
  weight: null, legacy: false,
});
const HISTORY = price => ({
  get_pricing_history: url => {
    const size = String(new URL(url).searchParams.get('cleanSize') || '');
    const rows = [histRecord(size, price)];
    return { ok: true, data: { records: rows, total: 1, ownTotal: 1, otherTotal: 0,
                               offset: 0, limit: 20 } };
  },
});

/* What the quotation actually holds, and what the screen said about it. */
const quoteState = page => page.evaluate(() => ({
  n: quoteItems.length,
  items: quoteItems.map(i => ({
    type: i.itemType, desc: i.description || i.dimensions || '',
    material: i.material, finish: i.finish, sizeType: i.sizeType,
    size: i.cleanSize, qty: i.qty, unit: i.finalUnitPrice, weight: i.weight,
  })),
  toast: (document.getElementById('toast') || {}).textContent || '',
  reviewOpen: !!(document.getElementById('wqaModal') || {}).classList
              && document.getElementById('wqaModal').classList.contains('open'),
  /* `wqa` is a script-scoped const, not a window property — read it bare. */
  rowsLeft: wqa.rows.filter(r => !r.removed).length,
  emptyNote: (document.querySelector('#quoteList') || {}).textContent || '',
}));

const clickAdd = async page => {
  await page.evaluate(() => wqaAddAll());
  await page.waitForTimeout(900);
};

/* Fill a row's price the way a person does: type a cost rate, or reuse a
   historical price through the row's own History panel. */
const setCostRate = (page, i, v) => page.evaluate(([i, v]) => wqaEditPrice(i, 'costRate', v), [i, v]);
const setAddCost  = (page, i, v) => page.evaluate(([i, v]) => wqaEditPrice(i, 'addCost', v), [i, v]);

module.exports = async (browser, A) => {
  const S = A.suite('add to quotation — the button at the end of the review');

  // ══ the reported failure, reproduced ══════════════════════════════════════
  {
    /* A J Bolt never gets an automatic cost rate — syncCostRateWarning says so
       in as many words: "Cost Rate must be entered manually for this product
       type." So the only way this row gets a price is the one the live user
       used: reuse the price from a previous quotation, which is Manual Price
       mode — the final unit price stated outright, cost rate untouched. */
    const page = await openApp(browser, { api: HISTORY(7.40) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page,
      '4140 QT J BOLT PL FULLSIZE\nM12 x H 150 x ID 26 x S 36 x TL 75 - 50pcs',
      { expanded: false, settle: 900 });

    /* Price it from history, exactly as the screenshot shows. */
    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(900);
    await page.evaluate(() => wqaHistUse(0, 0));
    await page.waitForTimeout(900);

    const row = (await rowState(page))[0];
    A.eq(row.product, 'jbolt', 'the row is a J Bolt');
    A.eq(row.size, 'M12', 'M12');
    A.eq(`${row.h}/${row.id}/${row.s}/${row.thread}`, '150/26/36/75',
      'with all four of its dimensions');
    A.eq(row.qty, '50', 'and a quantity');
    A.eq(String(row.price), '7.4', 'priced 7.40 from the previous quotation');
    A.eq(row.missing.join(', '), '',
      'and the review screen says nothing at all is missing');

    await clickAdd(page);
    const q = await quoteState(page);

    /* THE BUG. Everything above says this row is ready; the button disagreed. */
    A.eq(q.n, 1, 'clicking Add puts the item in the quotation');
    A.eq(q.items[0] && q.items[0].type, 'jbolt', 'as a J Bolt');
    A.eq(q.items[0] && String(q.items[0].unit), '7.4',
      'at the price the row was showing');
    A.eq(q.items[0] && String(q.items[0].qty), '50', 'with its quantity');
    A.excludes(q.toast, 'of 1 added', 'and does not report a partial failure');
    await page.close();
  }

  // ══ every Quick Add product, priced by hand, adds ═════════════════════════
  /* Quick Add reads five products. Each is created valid, changed through the
     review screen, and added — and what lands in the quotation is compared
     against what the row was showing. */
  const PRODUCTS = [
    { type: 'sagrod', msg: 'MS SAG ROD PL FULLSIZE\nM16 x 300 x 50/50 - 35pcs',
      dims: { length: '300', thread: '50/50' } },
    { type: 'stud', msg: 'MS STUD PL\nM16 x 300 - 60pcs',
      dims: { length: '300' } },
    { type: 'anchorbolt', msg: 'MS ANCHOR BOLT PL FULLSIZE\nM20 x 450 x 150 - 80pcs',
      dims: { length: '450', thread: '150' } },
    /* These two have no automatic pricing at all — the form says so on its
       face — so their add path insists on the surcharge as well as the rate,
       and the review now asks for both. */
    { type: 'lbolt', msg: '4140 QT L BOLT PL FULLSIZE\nM20 x 950 x 400 x 150 - 90pcs',
      dims: { length: '950', w: '400', thread: '150' }, addCost: '2.00' },
    { type: 'jbolt', msg: '4140 QT J BOLT PL FULLSIZE\nM20 x H 400 x ID 70 x S 80 x TL 100 - 28pcs',
      dims: { h: '400', id: '70', s: '80', thread: '100' }, addCost: '2.00' },
  ];

  for (const p of PRODUCTS) {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, p.msg, { expanded: false, settle: 900 });

    /* One change made through the review screen, as a person would: a rate the
       document never carried. The canonical row must take it, the recalculation
       must use it, and the added item must carry its result. */
    await setCostRate(page, 0, '6.50');
    if (p.addCost) {
      /* Asked for BEFORE the click, on the row, which is the whole point. */
      const short = (await rowState(page))[0];
      A.ok(short.missing.includes('Additional Cost'),
        `${p.type}: a rate on its own is not enough, and the row says so`);
      await setAddCost(page, 0, p.addCost);
    }
    await page.waitForTimeout(900);

    const before = (await rowState(page))[0];
    A.eq(before.product, p.type, `${p.type}: the row is a ${p.type}`);
    A.eq(String(Number(before.costRate)), '6.5', `${p.type}: the rate typed in the review reached the row`);
    A.ok(Number(before.price) > 0, `${p.type}: and the row repriced from it (${before.price})`);
    A.eq(before.missing.join(', '), '', `${p.type}: nothing is missing`);
    Object.entries(p.dims).forEach(([k, v]) =>
      A.eq(before[k], v, `${p.type}: ${k} is ${v}`));

    await clickAdd(page);
    const q = await quoteState(page);
    A.eq(q.n, 1, `${p.type}: exactly one item enters the quotation`);
    A.eq(q.items[0] && q.items[0].type, p.type, `${p.type}: as a ${p.type}`);
    A.eq(q.items[0] && String(q.items[0].unit), String(before.price),
      `${p.type}: at the price the review was showing`);
    A.eq(q.items[0] && String(q.items[0].weight), String(before.weight),
      `${p.type}: and the weight the review was showing`);
    A.eq(q.items[0] && String(q.items[0].qty), String(before.qty),
      `${p.type}: with its own quantity`);
    A.ok(page._dcErrors.length === 0, `${p.type}: no page errors: ` + page._dcErrors.join(' | '));
    await page.close();
  }

  // ══ a stainless row adds, and carries no finish ═══════════════════════════
  /* SS304 and SS316 are quoted without a finish. They are also two of the
     materials that never get an automatic cost rate, so this row exercises the
     same manual-price path the blocker did. */
  for (const [wording, material] of [['SS304', 'SS304'], ['SS316', 'SS316']]) {
    for (const src of ['PL', 'HDG', 'ZP', 'PLAIN']) {
      const page = await openApp(browser);
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, `${wording} SAG ROD ${src} FULLSIZE\nM16 x 300 x 50/50 - 20pcs`,
        { expanded: false, settle: 900 });
      await setCostRate(page, 0, '12.00');
      await page.waitForTimeout(800);

      const row = (await rowState(page))[0];
      A.eq(row.material, material, `${wording} ${src}: the row's material is ${material}`);
      A.eq(row.finish, '', `${wording} ${src}: and it carries no finish in the review`);

      await clickAdd(page);
      const q = await quoteState(page);
      A.eq(q.n, 1, `${wording} ${src}: the stainless row adds`);
      A.eq(q.items[0] && q.items[0].material, material,
        `${wording} ${src}: the quotation item is ${material}`);
      A.eq(q.items[0] && (q.items[0].finish || ''), '',
        `${wording} ${src}: and its finish is N/A, whatever the message said`);
      A.excludes(String(q.items[0] && q.items[0].desc), src === 'PLAIN' ? 'PLAIN' : src,
        `${wording} ${src}: the description carries no ${src} either`);
      await page.close();
    }
  }

  // ══ three valid rows add as three ═════════════════════════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ['MS SAG ROD PL FULLSIZE',
                               'M16 x 300 x 50/50 - 35pcs',
                               'M20 x 400 x 100/100 - 20pcs',
                               'M24 x 500 x 100/100 - 10pcs'].join('\n'),
                        { expanded: false, settle: 1100 });
    const rows = await rowState(page);
    A.eq(rows.length, 3, 'three rows');
    A.ok(rows.every(r => r.missing.length === 0), 'all three complete');

    await clickAdd(page);
    const q = await quoteState(page);
    A.eq(q.n, 3, 'three valid rows add as three items');
    A.eq(q.items.map(i => i.size).join(','), 'M16,M20,M24', 'in order, each its own size');
    A.eq(q.rowsLeft, 0, 'and no row is left behind');
    A.includes(q.toast, '3 item', 'the toast says three were added');
    await page.close();
  }

  // ══ one valid, one not: the valid one still goes in ═══════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ['MS SAG ROD PL FULLSIZE',
                               'M16 x 300 x 50/50 - 35pcs',
                               'M20 x 400 x 100/100 - 20pcs'].join('\n'),
                        { expanded: false, settle: 1200 });
    /* Row 2's material is taken back off, the way a person would when the
       message turns out not to have said. Row 1 is complete and has nothing
       whatever to do with row 2. */
    await page.evaluate(() => wqaEditRowSpec(1, 'material', ''));
    await page.waitForTimeout(900);
    const rows = await rowState(page);
    A.eq(rows.length, 2, 'two rows');
    A.eq(rows[0].missing.join(', '), '', 'the first is complete');
    A.ok(rows[1].missing.includes('Material'), 'the second is missing its material');

    await clickAdd(page);
    const q = await quoteState(page);
    A.eq(q.n, 1, 'the complete row is added');
    A.eq(q.items[0] && q.items[0].size, 'M16', 'the right one');
    A.eq(q.reviewOpen, 'true', 'and the review stays open for the other');
    A.eq(q.rowsLeft, 1, 'holding exactly the row that could not go');
    A.includes(q.toast, 'Material', 'the message names what is actually wrong');
    await page.close();
  }

  // ══ a row that cannot be added says why, by name ══════════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM20 x 400 x 100/100 - 20pcs',
                        { expanded: false, settle: 900 });
    await page.evaluate(() => wqaEditRowSpec(0, 'material', ''));
    await page.waitForTimeout(900);
    await clickAdd(page);
    const q = await quoteState(page);
    A.eq(q.n, 0, 'a row with no material is not added');
    A.eq(q.reviewOpen, 'true', 'the review stays open');
    A.eq(q.rowsLeft, 1, 'with the row still in it, to be corrected');
    A.includes(q.toast, 'Material', 'and the reason is named, not "check the remaining rows"');
    A.excludes(q.toast, 'check the remaining rows', 'the generic wording is gone');
    await page.close();
  }

  // ══ Apply to All reaches the rows, and the rows reach the quotation ═══════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    /* No size type stated anywhere: every row asks for one. */
    await quickAddPaste(page, ['SAG ROD',
                               'MS M16 x 300 x 50/50 - 35pcs',
                               'MS M20 x 400 x 100/100 - 20pcs'].join('\n'),
                        { expanded: false, settle: 1100 });
    const before = await rowState(page);
    A.ok(before.every(r => r.missing.includes('Size Type')),
      'both rows ask for a size type');

    await page.evaluate(() => wqaSetCommon('sizeType', 'FULLSIZE'));
    await page.waitForTimeout(900);
    const after = await rowState(page);
    A.ok(after.every(r => r.sizeType === 'FULLSIZE'),
      'Apply to All writes the size type into every row object, not just the header');
    A.ok(after.every(r => !r.missing.includes('Size Type')),
      'and the rows stop asking for it');

    await clickAdd(page);
    const q = await quoteState(page);
    A.eq(q.n, 2, 'both rows add');
    A.ok(q.items.every(i => i.sizeType === 'FULLSIZE'),
      'and each quotation item carries the size type the header applied');
    await page.close();
  }

  // ══ a per-row edit changes that row and no other ══════════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ['MS SAG ROD PL FULLSIZE',
                               'M16 x 300 x 50/50 - 35pcs',
                               'M20 x 400 x 100/100 - 20pcs'].join('\n'),
                        { expanded: false, settle: 1100 });
    const before = await rowState(page);
    await page.evaluate(() => { wqaEditPrice(1, 'markup', '25'); });
    await page.waitForTimeout(900);
    const after = await rowState(page);
    A.eq(String(after[0].price), String(before[0].price), 'row 1 is untouched by row 2 being edited');
    A.ok(Number(after[1].price) !== Number(before[1].price),
      `row 2 repriced on its own markup (${before[1].price} -> ${after[1].price})`);

    await clickAdd(page);
    const q = await quoteState(page);
    A.eq(q.n, 2, 'both add');
    A.eq(String(q.items[0].unit), String(after[0].price), "item 1 carries row 1's price");
    A.eq(String(q.items[1].unit), String(after[1].price), "item 2 carries row 2's own");
    await page.close();
  }

  // ══ Quick Add quotes what the Calculator quotes ══════════════════════════
  /* The same item, entered both ways. Quick Add commits every row through the
     product's own calculator, so the two screens must not be able to disagree
     — and they did: the thread-length surcharge survived on the first row of a
     list and was wiped from every row after it, so a two-item enquiry quoted
     RM 1.33 for a rod the Calculator quotes at RM 1.93. */
  {
    const ITEMS = [
      { size: 'M16', len: '300', tl: '50/50' },
      { size: 'M20', len: '400', tl: '100/100' },
      { size: 'M24', len: '500', tl: '150/150' },
    ];
    /* By hand, one at a time, through the Calculator's own form. */
    const byHand = [];
    for (const it of ITEMS) {
      const page = await openApp(browser);
      byHand.push(await page.evaluate(x => {
        switchType('sagrod');
        setFieldValue('sagrod', 'material', 'MS'); setFinishValue('sagrod', 'PL');
        setFieldValue('sagrod', 'sizeType', 'FULLSIZE');
        onMaterialSizeChange('sagrod', false, 'material');
        setFieldValue('sagrod', 'size', x.size); autoFillDiameter('sagrod');
        setFieldValue('sagrod', 'length', x.len);
        setFieldValue('sagrod', 'threadLen', x.tl); onThreadLenChange('sagrod');
        setFieldValue('sagrod', 'qty', '10');
        onMaterialSizeChange('sagrod', true); applyDefaultPrice(); recalcCurrent();
        addCurrentItem();
        return quoteItems[0].finalUnitPrice;
      }, it));
      await page.close();
    }
    A.ok(byHand.every(v => v > 0), `the Calculator prices all three (${byHand.join(', ')})`);

    /* And as one Quick Add list. */
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ['MS SAG ROD PL FULLSIZE']
      .concat(ITEMS.map(i => `${i.size} x ${i.len} x ${i.tl} - 10pcs`)).join('\n'),
      { expanded: false, settle: 1400 });

    const first = await rowState(page);
    A.eq(first.map(r => String(r.price)).join(' · '), byHand.map(String).join(' · '),
      'every row of the list is priced exactly as the Calculator prices it');

    /* And it does not change its mind on the next recompute. */
    await page.evaluate(() => wqaRecomputeAll('force'));
    await page.waitForTimeout(1000);
    const again = await rowState(page);
    A.eq(again.map(r => String(r.price)).join(' · '), byHand.map(String).join(' · '),
      'and still is after a recompute — the screen does not change its mind');

    await clickAdd(page);
    const q = await quoteState(page);
    A.eq(q.n, 3, 'all three add');
    A.eq(q.items.map(i => String(i.unit)).join(' · '), byHand.map(String).join(' · '),
      'and the quotation carries those same three prices');
    await page.close();
  }

  // ══ mixed materials do not contaminate each other ═════════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ['MS SAG ROD HDG FULLSIZE',
                               'M16 x 300 x 50/50 - 10pcs',
                               '',
                               'SS304 SAG ROD PL FULLSIZE',
                               'M16 x 300 x 50/50 - 10pcs',
                               '',
                               '4140 QT SAG ROD ZP FULLSIZE',
                               'M16 x 300 x 50/50 - 10pcs'].join('\n'),
                        { expanded: false, settle: 1400 });
    /* The 4140 QT row has no automatic rate; give it one so all three can go. */
    const rows = await rowState(page);
    for (let i = 0; i < rows.length; i++) {
      if (!(Number(rows[i].price) > 0)) { await setCostRate(page, i, '9.00'); }
    }
    await page.waitForTimeout(900);
    const ready = await rowState(page);
    A.eq(ready.map(r => `${r.material}/${r.finish || 'N/A'}`).join(' · '),
      'MS/HDG · SS304/N/A · 4140/ZP',
      'each row keeps its own material and finish, and the stainless one has none');

    await clickAdd(page);
    const q = await quoteState(page);
    A.eq(q.n, 3, 'all three add');
    A.eq(q.items.map(i => `${i.material}/${i.finish || 'N/A'}`).join(' · '),
      'MS/HDG · SS304/N/A · 4140/ZP',
      'and the quotation holds three separate specifications, uncontaminated');
    await page.close();
  }

  return S;
};
