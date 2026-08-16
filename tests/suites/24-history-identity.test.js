/* ── Whose price is this? ───────────────────────────────────────────────────
   An acceptance reader spotted a screenshot showing an MS row with a 4140 QT
   history card under it, which the contract says can never happen. It came
   from the evidence generator, whose stub answered every lookup with the same
   record whatever was asked — so those frames never exercised matching at all.
   This suite is the answer to "was the application ever affected?", and it
   asks the question through the real path: the identity the row sends, the
   server's own rules applied to it, the panel that renders the reply, and the
   button that reuses one.

   The stub here is deliberately NOT a fixed answer. It applies the same five
   identity fields the server compares — product, material, size type, finish,
   size — so a record that could not survive dc_history_record does not survive
   here either.

   Then the harder question: a row whose material CHANGES while its history is
   open. The panel reloads, but there is a debounce between the edit and the
   reload, and a card on screen is clickable for as long as it is on screen. So
   the record is checked again at the moment it is used, against the row's
   identity as it is THEN.                                                   */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* One saved line, in the shape the endpoint returns. */
const REC = o => Object.assign({
  quotationId: 1, refNo: 'Q-2026-0366', date: '2026-03-06', customer: 'Alpha Sdn Bhd',
  companyId: 7, own: true, productType: 'SAG ROD', material: '4140',
  sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M16',
  dimensionPreview: 'L 300 x TL 50/50mm', exactDims: true, dimDistance: 0, qty: 35,
  unitPrice: 6.84, boltUnitPrice: 6.84, lineUnitPrice: 6.84, finishMatch: true,
  accessoryCost: 0, accessorySummary: '', accessoryAmbiguous: false,
  priceMode: 'auto', priceModeLabel: 'Auto Round',
  costRate: 6.50, addCost: 3.50, markup: 4, weight: 0.4735, legacy: false,
}, o);

/* The server's own identity rules, applied to what the row actually asked for.
   Finish is the one field that admits a reference — see dc_history_record. */
const database = rows => ({
  get_pricing_history: url => {
    const p = new URL(url).searchParams;
    const want = { productType: p.get('productType') || '', material: p.get('material') || '',
                   sizeType: p.get('sizeType') || '', finish: p.get('finish') || '',
                   cleanSize: p.get('cleanSize') || '' };
    const records = rows
      .filter(r => r.productType === want.productType && r.material === want.material
                && r.sizeType === want.sizeType && r.cleanSize === want.cleanSize)
      .map(r => Object.assign({}, r, { finishMatch: r.finish === want.finish }));
    return { ok: true, data: { records, total: records.length,
                               ownTotal: records.filter(r => r.own).length,
                               otherTotal: records.filter(r => !r.own).length,
                               offset: 0, limit: 20 } };
  },
});

const openHistory = async page => {
  await page.evaluate(() => { if (!wqa.rows[0].histOpen) wqaHistToggle(0); });
  await page.waitForTimeout(1000);
};
const panel = page => page.evaluate(() => {
  const card = c => ({ ref: (c.querySelector('.ph-rec-ref') || {}).textContent || '',
                       spec: (c.querySelector('.ph-rec-spec') || {}).textContent || '',
                       tags: [...c.querySelectorAll('.ph-rec-tag')].map(n => n.textContent).join(' | '),
                       canUse: !!c.querySelector('.ph-rec-use') });
  const root = document.querySelector('[data-wqa-row="0"]');
  return { cards: [...root.querySelectorAll('.ph-rec')].map(card),
           none: !!root.querySelector('.wqa-hist-none'),
           text: (root.querySelector('.wqa-hist') || {}).textContent || '' };
});

module.exports = async (browser, A) => {
  const S = A.suite('pricing history — whose price is this');

  // ══ an MS row is never shown a 4140 QT record ════════════════════════════
  {
    const asked = [];
    const api = database([REC({})]);
    const spy = { get_pricing_history: (url, req) => {
      asked.push(String(new URL(url).searchParams.get('material') || ''));
      return api.get_pricing_history(url, req);
    } };
    const page = await openApp(browser, { api: spy });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM16 x 300 x 50/50 - 35pcs',
      { expanded: false, settle: 900 });
    const row = (await rowState(page))[0];
    A.eq(row.material, 'MS', 'the row is mild steel');

    await openHistory(page);
    const p = await panel(page);
    A.eq(asked.join(','), 'MS', 'the lookup asked for this row\'s own material');
    A.eq(p.cards.length, 0, 'and a 4140 QT record is not offered to it');
    A.eq(p.none, 'true', 'the panel says there is no history for this specification');
    A.excludes(p.text, '4140', 'and does not print another material anywhere');
    await page.close();
  }

  // ══ the same row, once it really is 4140 QT ══════════════════════════════
  {
    const page = await openApp(browser, { api: database([REC({})]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, '4140 QT SAG ROD PL FULLSIZE\nM16 x 300 x 50/50 - 35pcs',
      { expanded: false, settle: 900 });
    A.eq((await rowState(page))[0].material, '4140', 'the row is 4140 QT');
    await openHistory(page);
    const p = await panel(page);
    A.eq(p.cards.length, 1, 'and its own record is offered');
    A.eq(p.cards[0].ref, 'Q-2026-0366', 'the right one');
    A.eq(p.cards[0].canUse, 'true', 'and it can be reused');
    await page.close();
  }

  // ══ every material change takes the old answer away ══════════════════════
  for (const [from, to, wording] of [
    ['4140', 'MS', 'MS SAG ROD PL FULLSIZE'],
    ['MS', '4140', '4140 QT SAG ROD PL FULLSIZE'],
    ['4140', '4340', '4340 QT SAG ROD PL FULLSIZE'],
    ['4140', 'SS304', 'SS304 SAG ROD FULLSIZE'],
    ['SS304', 'SS316', 'SS316 SAG ROD FULLSIZE'],
  ]) {
    const page = await openApp(browser, { api: database([REC({ material: from,
      finish: from === 'SS304' || from === 'SS316' ? '' : 'PL' })]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    const startWording = { '4140': '4140 QT SAG ROD PL FULLSIZE', 'MS': 'MS SAG ROD PL FULLSIZE',
                           'SS304': 'SS304 SAG ROD FULLSIZE' }[from];
    await quickAddPaste(page, `${startWording}\nM16 x 300 x 50/50 - 35pcs`,
      { expanded: false, settle: 900 });
    await openHistory(page);
    const before = await panel(page);
    A.eq(before.cards.length, 1, `${from}: its own record is showing`);

    /* The material is corrected on the row, the way a person corrects it. */
    await page.evaluate(m => wqaEditRowSpec(0, 'material', m), to);
    await page.waitForTimeout(1400);
    const after = await panel(page);
    A.eq((await rowState(page))[0].material, to, `${from} → ${to}: the row changed`);
    A.eq(after.cards.length, 0, `${from} → ${to}: the old record is no longer offered`);
    A.excludes(after.text, 'Q-2026-0366', `${from} → ${to}: and is not on screen at all`);
    await page.close();
  }

  // ══ and a card that survives the moment is refused at the moment of use ══
  {
    /* The panel reloads when the identity moves, but the edit is debounced and
       a card is clickable for as long as it is on screen. This forces exactly
       that race: the row is changed underneath a record that is still in hand,
       and the record is then used. */
    const page = await openApp(browser, { api: database([REC({})]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, '4140 QT SAG ROD PL FULLSIZE\nM16 x 300 x 50/50 - 35pcs',
      { expanded: false, settle: 900 });
    await openHistory(page);
    A.eq((await panel(page)).cards.length, 1, 'the 4140 QT record is in hand');

    const raced = await page.evaluate(() => {
      /* Change the row and use the record in the SAME tick, before any
         debounce, any recompute or any reload can run. */
      wqa.rows[0].material = 'MS';
      const before = { mode: wqa.rows[0].priceMode, ref: wqa.rows[0].usedHistoryRef,
                       ov: JSON.stringify(wqa.rows[0].priceOverride) };
      wqaHistUse(0, 0);
      return { before, after: { mode: wqa.rows[0].priceMode, ref: wqa.rows[0].usedHistoryRef,
                                ov: JSON.stringify(wqa.rows[0].priceOverride) },
               toast: (document.getElementById('toast') || {}).textContent || '' };
    });
    A.eq(raced.after.mode, raced.before.mode, 'the row keeps its own price mode');
    A.eq(raced.after.ref, raced.before.ref, 'and claims no record');
    A.eq(raced.after.ov, raced.before.ov, "and none of another material's pricing reaches it");
    A.includes(raced.toast.toLowerCase(), 'no longer',
      'and it says the record no longer describes this item');
    await page.close();
  }

  // ══ LIVE — 1/2" MS UNDERSIZE, quoted PL before and ZP today ══════════════
  /* Q-2026-0470. The same rod, the same material, the same size type, the same
     diameter — quoted at two lengths before, and asked for at a third today
     with a different coating. Calling that "no previous price" hides two
     records a person would want to see; showing them as if the coating were
     the same would let a PL rate be reused on a ZP rod, and a coating is
     precisely what changes the rate. So they appear, labelled, and cannot be
     reused as a recipe. */
  {
    const HALF = o => REC(Object.assign({
      productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE', finish: 'PL',
      cleanSize: '1/2', costRate: 5.00, addCost: 2.00, markup: 6,
      priceMode: 'auto', priceModeLabel: 'Auto Round',
    }, o));
    const page = await openApp(browser, { api: database([
      HALF({ refNo: 'Q-2026-0470', quotationId: 1, date: '2026-01-20',
             dimensionPreview: 'L 980 x TL 100/100mm', unitPrice: 11.20, boltUnitPrice: 11.20 }),
      HALF({ refNo: 'Q-2026-0471', quotationId: 2, date: '2026-02-20',
             dimensionPreview: 'L 1080 x TL 100/100mm', unitPrice: 12.30, boltUnitPrice: 12.30 }),
    ]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\n1/2 x 1020 x 100/100 - 20pcs',
      { expanded: false, settle: 1000 });
    const row = (await rowState(page))[0];
    A.eq(row.size, '1/2', 'a half-inch rod');
    A.eq(`${row.material}/${row.sizeType}/${row.finish}`, 'MS/UNDERSIZE/ZP',
      'mild steel, undersize, zinc plated');

    await openHistory(page);
    const p = await panel(page);
    A.eq(p.none, 'false', 'it is NOT reported as having no previous price');
    A.eq(p.cards.length, 2, 'both earlier quotations of the same rod are shown');
    A.eq(p.cards.map(c => c.ref).join(','), 'Q-2026-0470,Q-2026-0471',
      'the nearer length first: 980 is 40 away from 1020, 1080 is 60');
    A.ok(p.cards.every(c => /finish/i.test(c.tags)),
      `each is labelled as a different finish (${p.cards[0].tags})`);
    A.ok(p.cards.every(c => !c.canUse),
      'and neither offers to be reused as a recipe, because a coating changes the rate');

    /* A different diameter is still a different rod. */
    await page.evaluate(() => wqaEdit(0, 'size', 'M16'));
    await page.waitForTimeout(1400);
    const other = await panel(page);
    A.eq(other.cards.length, 0, 'an M16 is not shown a half-inch rod\'s history');
    await page.close();
  }

  // ══ the same rod in the same coating is still an exact, reusable record ══
  {
    const page = await openApp(browser, { api: database([REC({
      productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE', finish: 'ZP',
      cleanSize: '1/2', dimensionPreview: 'L 980 x TL 100/100mm',
      refNo: 'Q-2026-0480', costRate: 5.00, addCost: 2.00, markup: 6 })]) });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\n1/2 x 1020 x 100/100 - 20pcs',
      { expanded: false, settle: 1000 });
    await openHistory(page);
    const p = await panel(page);
    A.eq(p.cards.length, 1, 'a record in the same coating is shown');
    A.excludes(p.cards[0].tags.toLowerCase(), 'different finish', 'with no finish caveat');
    A.eq(p.cards[0].canUse, 'true', 'and it can be reused as the recipe it is');
    await page.close();
  }

  // ══ 1/2" is not M12, and never asks as one ═══════════════════════════════
  /* The live report was a half-inch rod with two half-inch records behind it,
     answered "no pricing history". The cause was on the server, and is proved
     there; this is the other half of the same question — what the ROW asks for.
     A half inch asks for a half inch, verbatim, and a metric rod of nearly the
     same diameter is a different rod: 1/2" is 12.7mm and M12 is 12, and quoting
     one from the other's price is quoting the wrong bar. */
  {
    const asked = [];
    const HALF = REC({ productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE',
      finish: 'ZP', cleanSize: '1/2', refNo: 'Q-2026-0470',
      dimensionPreview: 'L 980 x TL 100/100mm', costRate: 5.00, addCost: 2.00, markup: 6 });
    const METRIC = REC({ productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE',
      finish: 'ZP', cleanSize: 'M12', refNo: 'Q-2026-0490',
      dimensionPreview: 'L 980 x TL 100/100mm', costRate: 5.00, addCost: 2.00, markup: 6 });
    const api = database([HALF, METRIC]);
    const spy = { get_pricing_history: (url, req) => {
      asked.push(String(new URL(url).searchParams.get('cleanSize') || ''));
      return api.get_pricing_history(url, req);
    } };
    const page = await openApp(browser, { api: spy });
    await page.evaluate(() => { selectedCompanyId = 7; });

    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\n1/2 x 1020 x 100/100 - 20pcs',
      { expanded: false, settle: 1000 });
    await openHistory(page);
    const half = await panel(page);
    A.eq(asked[0], '1/2', 'a half-inch rod asks for a half inch, written as it is stored');
    A.eq(half.cards.length, 1, 'and is shown one record');
    A.eq(half.cards[0].ref, 'Q-2026-0470', 'its own — not the M12 one');
    A.excludes(half.text, 'M12', 'no metric size appears anywhere on the panel');

    /* The same rod written metric: the half-inch record must not surface. */
    await page.evaluate(() => wqaEdit(0, 'size', 'M12'));
    await page.waitForTimeout(1400);
    const metric = await panel(page);
    A.eq(asked[asked.length - 1], 'M12', 'an M12 rod asks for M12');
    A.eq(metric.cards.length, 1, 'and is shown one record');
    A.eq(metric.cards[0].ref, 'Q-2026-0490', 'its own — not the half-inch one');
    A.excludes(metric.text, '1/2', 'no imperial size appears anywhere on the panel');
    await page.close();
  }

  // ══ no size type, no lookup — history is never asked a guessed question ═══
  {
    /* The same rule as the weight: an unanswered size type is not FULLSIZE.
       Asking the endpoint for a fullsize history would return real records
       belonging to a rod this may not be. */
    const asked = [];
    const api = database([REC({ productType: 'SAG ROD', material: 'MS',
      sizeType: 'FULLSIZE', finish: 'ZP', cleanSize: 'M16', refNo: 'Q-2026-0499' })]);
    const spy = { get_pricing_history: (url, req) => {
      asked.push(String(new URL(url).searchParams.get('sizeType') || ''));
      return api.get_pricing_history(url, req);
    } };
    const page = await openApp(browser, { api: spy });
    await page.evaluate(() => { selectedCompanyId = 7; });
    /* MS at M16 has no company rule, so the size type is genuinely open. */
    await quickAddPaste(page, 'MS SAG ROD ZP\nM16 x 1020 x 100/100 - 20pcs',
      { expanded: false, settle: 1000 });
    const row = (await rowState(page))[0];
    A.eq(row.sizeType, '', 'the size type is unanswered');
    const spec = await page.evaluate(() => wqaHistSpec(wqa.rows[0]));
    A.eq(String(spec), 'null', 'so the row has no history identity to ask with');
    await openHistory(page);
    A.eq(asked.join(','), '', 'and no lookup is made at all');
    const p = await panel(page);
    A.eq(p.cards.length, 0, 'no fullsize record is offered to it');
    A.excludes(p.text, 'Q-2026-0499', 'not even by name');

    /* Answer the question and the lookup happens, with the answer given. */
    await page.evaluate(() => wqaEditRowSpec(0, 'sizeType', 'FULLSIZE'));
    await page.waitForTimeout(1400);
    A.eq(asked.join(','), 'FULLSIZE', 'once answered, the lookup carries that answer');
    const after = await panel(page);
    A.eq(after.cards.length, 1, 'and the record appears');
    A.eq(after.cards[0].ref, 'Q-2026-0499', 'the fullsize one it really is');
    await page.close();
  }

  return S;
};
