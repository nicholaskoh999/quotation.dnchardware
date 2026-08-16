/* ── Reusing a previous price means reusing how it was worked out ───────────
   A saved quotation line is not a number, it is a recipe: a cost rate, a
   surcharge, a markup and the mode the total was rounded in. Pressing
   "Use this price" put none of that on the row — it copied the historical
   FINAL figure into Manual Price and left the row's own unrelated rate,
   surcharge and markup sitting behind it, contradicting the number on screen.

   Two things follow from that. The recipe has to come across, so a different
   length priced on the same basis produces its own correct price rather than
   last quarter's; and the row's rate boxes have to be REPLACED, so choosing a
   second record cannot leave a component of the first behind.

   Not every record has a recipe. One that was priced by hand has a manual
   price and nothing else, and reusing it means reusing the manual price — the
   one case where Manual is right. One saved before the breakdown was recorded
   has only a final figure, and nothing may be invented to dress it up as a
   calculation.

   Every assertion here clicks the real button in the panel.               */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* The two records from the production screenshot, and the shapes around them.
   Both are Sag Rod · 4140 QT · PL · Fullsize · M16 · L 300 · TL 50/50. */
const REC = (o) => Object.assign({
  quotationId: 1, refNo: 'Q-2026-0366', date: '2026-03-66'.replace('66', '06'),
  customer: 'Alpha Sdn Bhd', companyId: 7, own: true,
  productType: 'SAG ROD', material: '4140', sizeType: 'FULLSIZE', finish: 'PL',
  cleanSize: 'M16', dimensionPreview: 'L 300 x TL 50/50mm', exactDims: true,
  dimDistance: 0, qty: 35,
  unitPrice: 6.84, boltUnitPrice: 6.84, lineUnitPrice: 6.84,
  accessoryCost: 0, accessorySummary: '', accessoryAmbiguous: false,
  priceMode: 'auto', priceModeLabel: 'Auto Round',
  costRate: 6.50, addCost: 3.50, markup: 4, weight: 0.4735, legacy: false,
}, o);

const Q0366 = REC({});
const Q0357 = REC({ refNo: 'Q-2026-0357', quotationId: 2, date: '2026-02-14',
                    addCost: 4.00, unitPrice: 7.36, boltUnitPrice: 7.36, lineUnitPrice: 7.36 });
/* Priced by hand when it was quoted: there is no recipe to restore. */
const QMANUAL = REC({ refNo: 'Q-2026-0400', quotationId: 3, date: '2026-04-01',
                      priceMode: 'manual', priceModeLabel: 'Manual',
                      costRate: null, addCost: null, markup: null,
                      unitPrice: 9.90, boltUnitPrice: 9.90, lineUnitPrice: 9.90 });
/* Saved before the breakdown was recorded: a final figure and nothing else. */
const QLEGACY = REC({ refNo: 'Q-2023-0044', quotationId: 4, date: '2023-04-04',
                      priceMode: '', priceModeLabel: 'Legacy / Unknown', legacy: true,
                      costRate: null, addCost: null, markup: null, weight: null,
                      unitPrice: 5.20, boltUnitPrice: 5.20, lineUnitPrice: 5.20 });
/* Its accessories cannot be taken back out, so no bolt price can be stated. */
const QUNSEPARABLE = REC({ refNo: 'Q-2024-0100', quotationId: 5, date: '2024-01-10',
                           priceMode: '', priceModeLabel: 'Legacy / Unknown', legacy: true,
                           costRate: null, addCost: null, markup: null,
                           boltUnitPrice: null, accessoryCost: 0.70,
                           accessorySummary: '2 Nut PL', accessoryAmbiguous: true });

/* The server's own identity rules, applied to what the row actually asked for,
   so a record can never be offered to a specification it does not belong to.
   A stub that answers everything with the same record is how a frame showing
   an MS row under a 4140 QT card came to exist — see suite 24. */
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

/* Open row 0's history and press "Use this price" on the card for a named
   quotation — the real button, found the way a person finds it, by reading the
   reference on the card rather than by counting cards. The panel ranks records
   itself, so position is not something a test may assume. */
const useRecord = async (page, ref) => {
  await page.evaluate(() => { if (!wqa.rows[0].histOpen) wqaHistToggle(0); });
  await page.waitForTimeout(900);
  const clicked = await page.evaluate(want => {
    const card = [...document.querySelectorAll('[data-wqa-row="0"] .ph-rec')]
      .find(c => (c.querySelector('.ph-rec-ref') || {}).textContent === want);
    const btn = card && card.querySelector('.ph-rec-use');
    if (!btn) return false;
    btn.click();
    return true;
  }, ref);
  await page.waitForTimeout(1100);
  return clicked;
};

/* The pricing the row is actually holding, model and form together. */
const pricing = page => page.evaluate(() => {
  const r = wqa.rows[0];
  return {
    mode: r.priceMode || 'auto', manual: String(r.manualPrice || ''),
    ovRate: String(r.priceOverride.costRate === undefined ? '' : r.priceOverride.costRate),
    ovAdd: String(r.priceOverride.addCost === undefined ? '' : r.priceOverride.addCost),
    ovMk: String(r.priceOverride.markup === undefined ? '' : r.priceOverride.markup),
    calcRate: String((r.calc && r.calc.costRate) || ''),
    calcAdd: String((r.calc && r.calc.addCost) || ''),
    calcMk: String((r.calc && r.calc.markup) || ''),
    price: r.calc ? r.calc.finalUnitPrice : null,
    weight: r.calc ? r.calc.weight : null,
    ref: r.usedHistoryRef || '',
    badges: wqaRowBadges(r).map(b => b.t).join(' | '),
    toast: (document.getElementById('toast') || {}).textContent || '',
  };
});

/* The row these records belong to: Q-2026-0366 is a 4140 QT rod. */
const ROW = '4140 QT SAG ROD PL FULLSIZE\nM16 x 300 x 50/50 - 35pcs';

module.exports = async (browser, A) => {
  const S = A.suite('previous price — a recipe, not a number');

  // ══ PRODUCTION Q-2026-0366 ═══════════════════════════════════════════════
  {
    const page = await openApp(browser, { api: serve([Q0366]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ROW, { expanded: false, settle: 900 });
    /* The row's own unrelated pricing, exactly as the screenshot had it. */
    await page.evaluate(() => { wqaEditPrice(0, 'costRate', '4'); wqaEditPrice(0, 'addCost', '4');
                                wqaEditPrice(0, 'markup', '0'); });
    await page.waitForTimeout(900);
    const before = await pricing(page);
    A.eq(before.calcRate, '4', 'the row starts on its own rate');

    A.eq(await useRecord(page, 'Q-2026-0366'), true, 'the record offers a Use this price button');
    const after = await pricing(page);

    A.eq(after.calcRate, '6.50', 'using Q-2026-0366 puts its cost rate on the row');
    A.eq(after.calcAdd, '3.50', 'and its additional cost');
    A.eq(after.calcMk, '4', 'and its markup');
    A.eq(after.mode, 'auto', 'and its price mode, which was a calculated one');
    A.eq(after.manual, '', 'Manual Price is not used and is left empty');
    A.eq(after.ref, 'Q-2026-0366', 'the row records where the pricing came from');

    /* The row's own geometry, priced on that basis. Same dimensions as the
       historical line, so the calculator lands on the same figure. */
    A.eq(String(after.price), '6.84',
      'and the row prices itself from the recipe, reaching the same figure');
    A.includes(after.badges, 'Q-2026-0366', 'the provenance is on the row');

    // ── and it is the recipe that is committed, not a manual number ────────
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1400);
    const item = await page.evaluate(() => quoteItems[0] && ({
      mode: quoteItems[0].priceMode, manual: String(quoteItems[0].manualUnitPrice || ''),
      unit: quoteItems[0].finalUnitPrice, markup: quoteItems[0].markup,
      rate: (quoteItems[0].formData || {}).costRate,
      add: (quoteItems[0].formData || {}).addCost,
    }));
    A.eq(item.mode, 'auto', 'the quotation item is a calculated item, not a manual one');
    A.eq(String(item.rate), '6.50', 'carrying the cost rate');
    A.eq(String(item.add), '3.50', 'the additional cost');
    A.eq(String(item.markup), '4', 'and the markup');
    A.eq(String(item.unit), '6.84', 'at the calculated price');
    A.eq(item.manual, '', 'with no manual price hidden behind it');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ══ Q-2026-0357 REPLACES the recipe, it does not merge with it ═══════════
  {
    const page = await openApp(browser, { api: serve([Q0366, Q0357]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ROW, { expanded: false, settle: 900 });

    await useRecord(page, 'Q-2026-0366');
    const first = await pricing(page);
    A.eq(first.calcAdd, '3.50', 'the first record is in force');

    await useRecord(page, 'Q-2026-0357');
    const second = await pricing(page);
    A.eq(second.calcRate, '6.50', 'the second record replaces the rate');
    A.eq(second.calcAdd, '4.00', 'and the surcharge — 3.50 does not survive');
    A.eq(second.calcMk, '4', 'and the markup');
    A.eq(second.mode, 'auto', 'still a calculated mode');
    A.eq(second.manual, '', 'and no manual price left from anywhere');
    A.eq(second.ref, 'Q-2026-0357', 'the provenance names the record now in force');
    A.eq(String(second.price), '7.36', 'the row prices itself on the new basis');
    A.excludes(second.badges, 'Q-2026-0366', 'and no longer claims the first one');
    await page.close();
  }

  // ══ THE POINT — a different geometry, priced on the same basis ═══════════
  {
    /* The recipe is reused; the price is this row's own. If the historical
       final figure were being copied, both rows would read 6.84. */
    const page = await openApp(browser, { api: serve([Q0366]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, '4140 QT SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 10pcs',
      { expanded: false, settle: 900 });
    await useRecord(page, 'Q-2026-0366');
    const now = await pricing(page);

    A.eq(now.calcRate, '6.50', 'the historical rate is in force');
    A.eq(now.calcAdd, '3.50', 'the historical surcharge');
    A.eq(now.calcMk, '4', 'the historical markup');
    A.eq(now.mode, 'auto', 'and the historical mode');
    A.ok(Number(now.price) > 0, `the row has a price (${now.price})`);
    A.ok(Number(now.price) !== 6.84,
      `and it is this row's own, not the historical 6.84 (${now.price})`);
    A.ok(Number(now.weight) !== 0.4735,
      'because this row weighs what it weighs, not what the old one weighed');
    /* Worked out from the row's own weight, at the historical rate. */
    const expected = await page.evaluate(() => {
      const w = wqa.rows[0].calc.weight;
      return round05((w * 6.5 + 3.5) * 1.04);
    });
    A.eq(String(now.price), String(expected),
      'the figure is the calculator run on this row at the historical rates');
    A.eq(now.ref, 'Q-2026-0366', 'and the provenance still names the recipe it used');
    await page.close();
  }

  // ══ a record priced by hand stays a manual price ═════════════════════════
  {
    const page = await openApp(browser, { api: serve([QMANUAL]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ROW, { expanded: false, settle: 900 });
    await useRecord(page, 'Q-2026-0400');
    const p = await pricing(page);
    A.eq(p.mode, 'manual', 'a record that was priced by hand is reused as a manual price');
    A.eq(p.manual, '9.9', 'at its own figure');
    A.eq(String(p.price), '9.9', 'which is the price');
    A.eq(p.ovRate, '', 'and no cost rate was invented to dress it up as a calculation');
    A.eq(p.ovAdd, '', 'nor a surcharge');
    A.eq(p.ovMk, '', 'nor a markup');
    A.eq(p.ref, 'Q-2026-0400', 'with its provenance');
    await page.close();
  }

  // ══ switching from a recipe to a manual record leaves nothing behind ═════
  {
    const page = await openApp(browser, { api: serve([Q0366, QMANUAL]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ROW, { expanded: false, settle: 900 });
    await useRecord(page, 'Q-2026-0366');
    A.eq((await pricing(page)).calcAdd, '3.50', 'the recipe is in force');
    await useRecord(page, 'Q-2026-0400');
    const p = await pricing(page);
    A.eq(p.mode, 'manual', 'the manual record takes over');
    A.eq(p.manual, '9.9', 'at its figure');
    A.eq(p.ovRate, '', "and the previous record's rate is taken back off the row");
    A.eq(p.ovAdd, '', 'and its surcharge');
    A.eq(p.ovMk, '', 'and its markup');
    await page.close();
  }

  // ══ a legacy record: a final figure, and nothing pretended ═══════════════
  {
    const page = await openApp(browser, { api: serve([QLEGACY]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ROW, { expanded: false, settle: 900 });
    /* The panel says what it has, and does not claim a mode it never recorded. */
    const shown = await page.evaluate(() => {
      if (!wqa.rows[0].histOpen) wqaHistToggle(0);
      return null;
    });
    await page.waitForTimeout(900);
    const card = await page.evaluate(() =>
      (document.querySelector('[data-wqa-row="0"] .ph-rec') || {}).textContent || '');
    A.includes(card, 'Legacy', 'the card says the record is a legacy one');

    await useRecord(page, 'Q-2023-0044');
    const p = await pricing(page);
    A.eq(p.mode, 'manual', 'a record with only a final figure is reused as that figure');
    A.eq(p.manual, '5.2', 'exactly as it stands');
    A.eq(p.ovRate, '', 'no cost rate is manufactured');
    A.eq(p.ovAdd, '', 'no surcharge');
    A.eq(p.ovMk, '', 'no markup');
    A.includes(p.toast.toLowerCase(), 'breakdown',
      'and the message says the breakdown was never recorded');
    await page.close();
  }

  // ══ a record whose accessories cannot be separated is still refused ══════
  {
    const page = await openApp(browser, { api: serve([QUNSEPARABLE]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ROW, { expanded: false, settle: 900 });
    await page.evaluate(() => { if (!wqa.rows[0].histOpen) wqaHistToggle(0); });
    await page.waitForTimeout(900);
    const hasBtn = await page.evaluate(() =>
      !!document.querySelector('[data-wqa-row="0"] .ph-rec-use'));
    A.eq(hasBtn, 'false',
      'a record whose bolt price cannot be stated offers no reuse button at all');
    await page.close();
  }

  // ══ save, reload, edit: the recipe survives the round trip ═══════════════
  {
    let payload = null;
    const page = await openApp(browser, {
      api: Object.assign(serve([Q0366]), {
        save_quotation: (url, req) => {
          try { payload = JSON.parse(req.postData() || '{}'); } catch (e) {}
          return { ok: true, data: { id: 77, ref_no: 'DC-TEST-001' } };
        },
      }),
    });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ROW, { expanded: false, settle: 900 });
    await useRecord(page, 'Q-2026-0366');
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1400);
    await page.evaluate(async () => {
      el('qi-customer').value = 'Alpha Sdn Bhd'; syncQI();
      await api('save_quotation', {
        ref_no: el('qi-refno').value, quote_date: el('qi-date').value,
        customer_name: 'Alpha Sdn Bhd', customer_phone: '', prepared_by: '',
        remarks: '', company_id: null, items: quoteItems,
        total_amount: quoteItems.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0),
      }, 'POST');
    });
    await page.waitForTimeout(700);
    const saved = (payload.items || [])[0];
    A.eq(String(saved.priceMode), 'auto', 'the saved item is a calculated one');
    A.eq(String(saved.formData.costRate), '6.50', 'with the rate it was priced at');
    A.eq(String(saved.formData.addCost), '3.50', 'the surcharge');
    A.eq(String(saved.formData.markup), '4', 'and the markup');
    await page.close();

    const reopened = await openApp(browser, {
      handoff: { id: 77, ref_no: 'DC-TEST-001', quote_date: '2026-03-06',
                 customer_name: 'Alpha Sdn Bhd', items: payload.items },
    });
    const back = await reopened.evaluate(() => {
      unlockSavedQuotation();
      editItem(0);
      const t = resolveItemType(quoteItems[0]);
      return { mode: getPriceMode(t), rate: fv(t, 'costRate'), add: fv(t, 'addCost'),
               mk: fv(t, 'markup'), manual: fv(t, 'manualUnitPrice'),
               unit: quoteItems[0].finalUnitPrice };
    });
    A.eq(back.mode, 'auto', 'reopening and editing it restores a calculated mode');
    A.eq(String(back.rate), '6.50', 'with the cost rate');
    A.eq(String(back.add), '3.50', 'the additional cost');
    A.eq(String(back.mk), '4', 'and the markup');
    A.eq(String(back.manual || ''), '', 'and no manual price crept in');
    A.eq(String(back.unit), '6.84', 'the price is unchanged by the round trip');
    A.ok(reopened._dcErrors.length === 0, 'no page errors: ' + reopened._dcErrors.join(' | '));
    await reopened.close();
  }

  // ══ the Calculator's panel is reference-only, and stays that way ═════════
  {
    const page = await openApp(browser, { api: serve([Q0366]) });
    const cal = await page.evaluate(() => {
      /* phListHtml is given no onUse from the Calculator side. */
      const html = phListHtml({ records: [{ refNo: 'X', boltUnitPrice: 5, priceMode: 'auto',
        costRate: 1, addCost: 1, markup: 1, own: true, exactDims: true, dimDistance: 0,
        qty: 1, unitPrice: 5, cleanSize: 'M16', dimensionPreview: '', accessoryCost: 0 }],
        total: 1, ownTotal: 1, otherTotal: 0, offset: 0, limit: 20 }, null, 'x()');
      return { hasUse: /ph-rec-use/.test(html) };
    });
    A.eq(cal.hasUse, 'false',
      'the Calculator shows previous prices for reading, and offers no reuse button');
    await page.close();
  }

  return S;
};
