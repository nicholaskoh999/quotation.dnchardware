/* ── One previous price, onto every item it actually describes ──────────────
   A message of nine sag rods at nine lengths is one specification quoted nine
   times, and pressing Use nine times is nine chances to press it on the wrong
   row. So a reusable record can be applied to the rows it describes at once.

   "Describes" is the strict part, and it is the SAME rule the single-row guard
   uses — wqaHistCompat, asked with wqaHistSpec, the identity the lookup itself
   was made with. Product, material, finish, size type and size must match.
   Geometry may differ, and that is the point: every row is then repriced from
   its OWN weight, so a longer rod costs what a longer rod costs.

   A reference — another coating, or a line whose accessories cannot be told
   apart from its bolt — offers none of this. That is the safety boundary, and
   half of this suite is about it.                                           */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const RHO = 0.0000061654;

/* The app's own rounding, written out here rather than read off the page, so
   the arithmetic is checked against a second statement of the rule and not
   against itself. Auto Round nudges a price whose cents end in 9 up to the ten
   and one that ends in 1 down to it; everything else is two decimal places. */
const round05 = v => {
  const r = Math.round(v * 100) / 100;
  const cents = Math.round(r * 100) % 10;
  if (cents === 9) return Math.round((r + 0.01) * 10) / 10;
  if (cents === 1) return Math.floor(r * 10) / 10;
  return r;
};

const REC = o => Object.assign({
  quotationId: 1, refNo: 'Q-2026-0403', date: '2026-03-06', customer: 'Alpha Sdn Bhd',
  companyId: 7, own: true, productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE',
  finish: 'ZP', cleanSize: 'M12', dimensionPreview: 'L 853 x TL 70/70mm', exactDims: true,
  dimDistance: 0, qty: 4, unitPrice: 3.20, boltUnitPrice: 3.20, lineUnitPrice: 3.20,
  finishMatch: true, accessoryCost: 0, accessorySummary: '', accessoryAmbiguous: false,
  priceMode: 'auto', priceModeLabel: 'Auto Round', costRate: 7.25, addCost: 1.75,
  markup: 9, weight: 0.5909, legacy: false,
}, o);

/* The server's own identity rules, applied to what the row asked for. */
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

const openHist = async (page, i) => {
  await page.evaluate(k => { if (!wqa.rows[k].histOpen) wqaHistToggle(k); }, i);
  await page.waitForTimeout(1000);
};
const compat = (page, i, n) => page.evaluate(([a, b]) =>
  wqaHistCompatRows(a, b).map(x => ({ i: x.i, size: wqa.rows[x.i].size,
    len: wqa.rows[x.i].length, ok: x.ok, why: x.reason ? dcT(x.reason) : '' })), [i, n]);

module.exports = async (browser, A) => {
  const S = A.suite('previous price — applied to the items it describes');

  // ══ 1-8 · what is compatible, and what is refused, and why ═══════════════
  {
    const page = await openApp(browser, { api: database([REC({})]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, [
      'MS SAG ROD ZP UNDERSIZE',
      'M12 x 853 x 70/70 - 4pcs',      // 1 · same everything
      'M12 x 943 x 70/70 - 6pcs',      // 2 · a different length
      'M12 x 853 x 90/90 - 2pcs',      // 3 · a different thread length
      'M16 x 853 x 70/70 - 2pcs',      // 4 · a different size
    ].join('\n'), { expanded: false, settle: 1200 });
    await openHist(page, 0);

    const c = await compat(page, 0, 0);
    A.eq(c.length, 4, 'every live row is judged');
    A.eq(c[0].ok, 'true', '1 · the same product, material, finish, size type and size — compatible');
    A.eq(c[1].ok, 'true', '2 · a different length is still the same specification — compatible');
    A.eq(c[2].ok, 'true', '3 · so is a different thread length — compatible');
    A.eq(c[3].ok, 'false', '4 · a different size is a different rod');
    A.eq(c[3].why, 'different size', 'and it says so');

    // ── applied, and every row repriced from its own weight ───────────────
    const before = await rowState(page);
    await page.evaluate(() => wqaHistApplyCompatible(0, 0));
    await page.waitForTimeout(1500);
    const after = await rowState(page);

    A.eq(after.slice(0, 3).map(r => r.usedHistoryRef).join(','),
      'Q-2026-0403,Q-2026-0403,Q-2026-0403', 'the three compatible rows carry the record');
    A.eq(after[3].usedHistoryRef, '', 'and the M16 does not');
    A.eq(after[3].price, before[3].price, 'its price is exactly what it was');

    /* 11 · only the recipe fields moved. */
    A.eq(after.slice(0, 3).map(r => r.costRate).join(','), '7.25,7.25,7.25',
      '11 · the record\'s cost rate is on each of them');
    A.eq(after.slice(0, 3).map(r => r.addCost).join(','), '1.75,1.75,1.75',
      'and its additional cost');
    A.eq(await page.evaluate(() => wqa.rows.slice(0, 3).map(r => r.priceMode).join(',')),
      'auto,auto,auto', 'and its price mode, which was a calculated one');
    A.eq(await page.evaluate(() => wqa.rows.slice(0, 3).map(r => r.manualPrice).join('|')),
      '||', 'and no Manual Price was written anywhere');

    /* 2, 12 · each price is this row's own arithmetic, not the record's. */
    const priced = after.slice(0, 3).map(r => Number(r.price));
    A.ok(priced.every(p => p > 0), `every applied row has a price (${priced.join(' / ')})`);
    A.ok(priced[0] !== priced[1],
      `12 · an 853 and a 943 on one recipe are not one price (${priced[0]} vs ${priced[1]})`);
    for (const k of [0, 1, 2]) {
      const w = Number(after[k].weight);
      const want = round05((w * 7.25 + 1.75) * 1.09);
      A.near(Number(after[k].price), want, 0.001,
        `row ${k + 1}: ${w.toFixed(4)}kg x 7.25 + 1.75, +9% = ${want.toFixed(2)}`);
    }
    A.ok(priced.every(p => p !== 3.20),
      'and none of them is the record\'s own RM 3.20 copied across');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ══ 5, 6, 7, 8 · the other four ways a row can be a different item ═══════
  {
    /* Two identical rows, and then the second one is changed — which is how a
       person makes a row different, and exercises the path they would use. */
    for (const [change, why, note] of [
      [() => wqaEditRowProduct(1, 'anchorbolt'),      'different product',   '5 · another product'],
      [() => wqaEditRowSpec(1, 'material', '4140'),   'different material',  '6 · another material'],
      [() => wqaEditRowSpec(1, 'finish', 'PL'),       'different finish',    '7 · another coating'],
      [() => wqaEditRowSpec(1, 'sizeType', 'FULLSIZE'), 'different size type', '8 · another size type'],
    ]) {
      const page = await openApp(browser, { api: database([REC({})]) });
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs\nM12 x 853 x 70/70 - 2pcs',
        { expanded: false, settle: 1200 });
      await openHist(page, 0);
      A.eq((await compat(page, 0, 0)).filter(x => x.ok).length, 2,
        `${note}: both rows fit the record to begin with`);
      await page.evaluate(change);
      await page.waitForTimeout(1300);
      const c = await compat(page, 0, 0);
      const other = c[c.length - 1];
      A.eq(other.ok, 'false', `${note} is not compatible`);
      A.eq(other.why, why, `and the reason given is "${why}"`);

      /* And applying to everything leaves it exactly as it was. */
      await page.evaluate(() => wqaHistApplyCompatible(0, 0));
      await page.waitForTimeout(1500);
      const after = (await rowState(page))[1];
      A.eq(after.usedHistoryRef, '', `${note}: nothing was applied to it`);
      /* Its price is its own — worked out from its own rate, not from the
         record's 4.50 and 0.50. Comparing the RM figure across a spec change
         would compare two different items; comparing the recipe does not. */
      A.ok(String(after.costRate) !== '7.25' && String(after.addCost) !== '1.75',
        `and the record's recipe did not reach it (${after.costRate} / ${after.addCost})`);
      A.eq(await page.evaluate(() => (wqa.rows[1].histApplied || []).length), 0,
        'nothing of the record is installed on it at all');
      A.eq((await rowState(page))[0].usedHistoryRef, 'Q-2026-0403',
        'while the row that does describe it took the price');
      await page.close();
    }
  }

  // ══ 9 · a different-finish record offers no reuse of any kind ════════════
  {
    /* The accepted rule, from the other side: the record is SHOWN, labelled,
       and there is no route from it to a price — not on this item, not in
       bulk, not through the picker. */
    const page = await openApp(browser, { api: database([
      REC({ refNo: 'Q-2026-0390', finish: 'PL', dimensionPreview: 'L 980 x TL 70/70mm' }),
    ]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs\nM12 x 943 x 70/70 - 6pcs',
      { expanded: false, settle: 1200 });
    await openHist(page, 0);

    const card = await page.evaluate(() => {
      const c = document.querySelector('[data-wqa-row="0"] .ph-rec');
      return { there: !!c,
               sect: [...document.querySelectorAll('[data-wqa-row="0"] .ph-sect-lbl')].map(n => n.textContent).join(','),
               tags: c ? [...c.querySelectorAll('.ph-rec-tag')].map(n => n.textContent).join(' | ') : '',
               use: !!(c && c.querySelector('.ph-rec-use')),
               menu: !!(c && c.querySelector('.ph-rec-menu')) };
    });
    A.eq(String(card.there), 'true', 'the record in another coating is shown');
    A.eq(card.sect, 'References', 'filed under References, not under Reusable');
    A.includes(card.tags.toLowerCase(), 'different finish', 'and labelled as one');
    A.eq(String(card.use), 'false', '9 · it offers no "Use on this item"');
    A.eq(String(card.menu), 'false', 'and no menu to apply it in bulk from');

    /* And if something reaches the functions anyway, they refuse. */
    A.eq(JSON.stringify(await compat(page, 0, 0)), '[]',
      'asking which rows it fits returns none at all');
    const before = await rowState(page);
    await page.evaluate(() => { wqaHistApplyCompatible(0, 0); wqaHistApplyRows(0, 0, [0, 1]); });
    await page.waitForTimeout(1300);
    const after = await rowState(page);
    A.eq(after.map(r => r.usedHistoryRef).join('|'), '|',
      'and calling the bulk apply on it directly changes nothing');
    A.eq(after.map(r => String(r.price)).join(','), before.map(r => String(r.price)).join(','),
      'no price moved');
    await page.close();
  }

  // ══ 10 · a record that has gone stale cannot be applied ══════════════════
  {
    const page = await openApp(browser, { api: database([REC({})]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs\nM12 x 943 x 70/70 - 6pcs',
      { expanded: false, settle: 1200 });
    await openHist(page, 0);
    A.eq((await compat(page, 0, 0)).filter(x => x.ok).length, 2, 'both rows fit the record');

    /* The material changes, and the card is still on screen — the debounce.
       Everything that could apply it must refuse in that window. */
    const before = await rowState(page);
    await page.evaluate(() => {
      wqaEditRowSpec(0, 'material', '4140');
      wqaEditRowSpec(1, 'material', '4140');
      wqaHistApplyCompatible(0, 0);
      wqaHistApplyRows(0, 0, [0, 1]);
      wqaHistUse(0, 0);
    });
    await page.waitForTimeout(1500);
    const after = await rowState(page);
    A.eq(after.map(r => r.material).join(','), '4140,4140', 'the rows are 4140 QT now');
    A.eq(after.map(r => r.usedHistoryRef).join('|'), '|',
      '10 · and the mild steel record reached neither of them');
    A.ok(after.every((r, k) => String(r.costRate) !== '4.50' || String(before[k].costRate) === '4.50'),
      'no cost rate of its came across either');
    await page.close();
  }

  // ══ the picker: ticked, disabled, and what it does ═══════════════════════
  {
    const page = await openApp(browser, { api: database([REC({})]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, [
      'MS SAG ROD ZP UNDERSIZE',
      'M12 x 853 x 70/70 - 4pcs',
      'M12 x 943 x 70/70 - 6pcs',
      'M16 x 500 x 70/70 - 2pcs',
    ].join('\n'), { expanded: false, settle: 1200 });
    await openHist(page, 0);

    /* The menu, then the picker. */
    await page.evaluate(() => wqaHistMenuToggle(0, 0));
    await page.waitForTimeout(400);
    const menu = await page.evaluate(() =>
      [...document.querySelectorAll('[data-wqa-row="0"] .ph-menu-i')].map(n => n.textContent.trim()));
    A.eq(menu.length, 2, 'the caret opens two ways to apply the price');
    A.includes(menu[0], 'compatible', 'apply to compatible items');
    A.includes(menu[0], '2', 'saying how many that is');
    A.includes(menu[1], 'Select', 'and choose them by hand');

    await page.evaluate(() => wqaHistPickOpen(0, 0));
    await page.waitForTimeout(400);
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('.ph-pick-row')].map(n => ({
        what: (n.querySelector('.ph-pick-what') || {}).textContent || '',
        why: (n.querySelector('.ph-pick-why') || {}).textContent || '',
        on: n.querySelector('input').checked,
        off: n.querySelector('input').disabled })));
    A.eq(rows.length, 3, 'every item is listed');
    A.eq(rows.filter(r => r.on).length, 2, 'the compatible ones start ticked');
    A.eq(rows[2].off + '', 'true', 'and the incompatible one cannot be ticked');
    A.eq(rows[2].why, 'different size', 'with the reason beside it');
    A.includes(rows[2].what, 'M16', 'and enough of the row to know which it is');
    A.includes(rows[0].what, 'MS', 'each line names its material');

    /* A disabled row is disabled in the model too, not only in the markup. */
    await page.evaluate(() => wqaHistPickToggle(2));
    await page.waitForTimeout(300);
    A.eq(await page.evaluate(() => Object.keys(wqa.histPick.sel).sort().join(',')), '0,1',
      'forcing the incompatible row through the toggle does nothing');

    /* Untick one, apply, and only the ticked one moves. */
    await page.evaluate(() => wqaHistPickToggle(1));
    await page.waitForTimeout(300);
    const before = await rowState(page);
    await page.evaluate(() => wqaHistPickApply());
    await page.waitForTimeout(1500);
    const after = await rowState(page);
    A.eq(after[0].usedHistoryRef, 'Q-2026-0403', 'the ticked row takes the price');
    A.eq(after[1].usedHistoryRef, '', 'the unticked one does not');
    A.eq(String(after[1].price), String(before[1].price), 'and its price is untouched');
    A.eq(after[2].usedHistoryRef, '', 'nor the incompatible one');
    A.eq(await page.evaluate(() => wqa.histPick === null ? 'closed' : 'open'), 'closed',
      'and the picker closes when it is done');
    await page.close();
  }

  // ══ still added to the quotation afterwards ══════════════════════════════
  {
    const page = await openApp(browser, { api: database([REC({})]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs\nM12 x 943 x 70/70 - 6pcs',
      { expanded: false, settle: 1200 });
    await openHist(page, 0);
    await page.evaluate(() => wqaHistApplyCompatible(0, 0));
    await page.waitForTimeout(1500);
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1500);
    const items = await page.evaluate(() => quoteItems.map(i => ({
      size: i.cleanSize, price: i.finalUnitPrice, rate: (i.formData || {}).costRate })));
    A.eq(items.length, 2, 'both rows reached the quotation');
    A.eq(items.map(i => i.rate).join(','), '7.25,7.25', 'each carrying the reused cost rate');
    A.ok(Number(items[0].price) !== Number(items[1].price),
      `and each its own price (${items[0].price} / ${items[1].price})`);
    await page.close();
  }

  return S;
};
