/* ── Sag Rod default Price Mode = No Round ──────────────────────────────────
   Owner rule (2026-10-29): a genuinely NEW Sag Rod starts on No Round, so
   L1070 and L1072 keep their own prices instead of collapsing onto one RM0.05
   step. The rule is the product alone — not material, finish, size type or
   size. Every other product still starts on Auto Round. Auto Round stays
   available to a Sag Rod, and anything stated — a person's choice, History's
   setup, Apply this setup, a saved quotation — is kept as it is. A legacy
   item saved without a mode still reads as Auto Round.                     */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');

const SAG = 'MS SAG ROD PL FULLSIZE\nM12 x 1070 x 100/100 - 2pcs\nM12 x 1072 x 100/100 - 3pcs';
const HREC = {
  quotationId: 9, refNo: 'Q-2026-0909', date: '2026-10-01', customer: 'ABC HARDWARE', companyId: 0, own: false,
  productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', finishMatch: true, cleanSize: 'M12',
  dimensionPreview: 'L 1070 x TL 100/100mm', exactDims: true, dimDistance: 0, qty: 2,
  unitPrice: 3.1, lineUnitPrice: 3.1, boltUnitPrice: 3.1, accessoryCost: 0, accessorySummary: '', accessoryAmbiguous: false,
  priceMode: 'auto', priceModeLabel: 'Auto Round', costRate: 3.5, addCost: 0.6, markup: 5, weight: 0.8878, legacy: false,
};
const HIST = { ok: true, data: { records: [HREC], total: 1, ownTotal: 0, otherTotal: 1, exactTotal: 1, closeTotal: 0, refTotal: 0, offset: 0, limit: 20 } };

module.exports = async (browser, A) => {
  A.suite('sag rod default — entry form');
  let p = await openApp(browser, { api: { get_pricing_history: HIST } });

  const fresh = await p.evaluate(() => ['sagrod', 'stud', 'lbolt', 'anchorbolt', 'jbolt', 'plate']
    .reduce((o, t) => (o[t] = fv(t, 'priceMode'), o), {}));
  A.eq(fresh.sagrod, 'no_round', '1. a fresh Sag Rod starts on No Round');
  ['stud', 'lbolt', 'anchorbolt', 'jbolt', 'plate'].forEach(t => A.eq(fresh[t], 'auto', `2. a fresh ${t} starts on Auto Round`));
  A.eq(await p.evaluate(() => dcDefaultPriceMode('sagrod') + '/' + dcDefaultPriceMode('lbolt')), 'no_round/auto', 'one helper decides the default');

  // 3. product-based, not material / finish / size type / size
  const combos = [['MS', 'FULLSIZE', 'M12', 'PL'], ['MS', 'UNDERSIZE', 'M12', 'ZP'], ['4140', 'FULLSIZE', 'M24', 'PL'], ['4140', 'UNDERSIZE', 'M16', 'HDG']];
  const variations = await p.evaluate(combos => {
    switchType('sagrod');
    return combos.map(([m, st, s, f]) => {
      setFieldValue('sagrod', 'material', m); onMaterialSizeChange('sagrod', false, 'material');
      setFieldValue('sagrod', 'sizeType', st);
      setFieldValue('sagrod', 'size', s); onSizeCommit('sagrod');
      setFinishValue('sagrod', f); onFinishChange('sagrod');
      setFieldValue('sagrod', 'length', '1070'); recalcCurrent();
      return m + ' ' + st + ' ' + s + ' ' + f + ':' + fv('sagrod', 'priceMode');
    });
  }, combos);
  variations.forEach(v => A.ok(/:no_round$/.test(v), '3. ' + v));

  // B. L1070 vs L1072 keep their own price on No Round
  const twoLen = await p.evaluate(() => {
    setFieldValue('sagrod', 'material', 'MS'); onMaterialSizeChange('sagrod', false, 'material');
    setFieldValue('sagrod', 'sizeType', 'FULLSIZE');
    setFieldValue('sagrod', 'size', 'M12'); onSizeCommit('sagrod');
    setFinishValue('sagrod', 'PL'); onFinishChange('sagrod');
    setFieldValue('sagrod', 'threadLen', '100/100'); onThreadLenChange('sagrod');
    setFieldValue('sagrod', 'costRate', '3.5'); setFieldValue('sagrod', 'addCost', '0.6'); setFieldValue('sagrod', 'markup', '5');
    setFieldValue('sagrod', 'length', '1070'); recalcCurrent();
    const a = priceCalcState.sagrod.finalUnitPrice;
    setFieldValue('sagrod', 'length', '1072'); recalcCurrent();
    return { a, b: priceCalcState.sagrod.finalUnitPrice, mode: fv('sagrod', 'priceMode') };
  });
  A.eq(twoLen.mode, 'no_round', 'B. changing L1070 → L1072 keeps No Round');
  A.ok(twoLen.b > twoLen.a, 'B. and L1072 is priced above L1070 ' + JSON.stringify(twoLen));

  // 8 / E. an explicit Auto Round survives recalculation
  const kept = await p.evaluate(() => {
    setFieldValue('sagrod', 'priceMode', 'auto'); onPriceModeChange('sagrod');
    setFieldValue('sagrod', 'length', '1070'); recalcCurrent();
    setFieldValue('sagrod', 'markup', '6'); recalcCurrent();
    setFinishValue('sagrod', 'ZP'); onFinishChange('sagrod');
    setFieldValue('sagrod', 'qty', '7'); recalcCurrent();
    return fv('sagrod', 'priceMode');
  });
  A.eq(kept, 'auto', '8. an explicit Auto Round is kept through length / markup / finish / qty changes');

  // 4. Add resets the next new Sag Rod to No Round, others to Auto Round
  const added = await p.evaluate(() => {
    setFinishValue('sagrod', 'PL'); onFinishChange('sagrod');
    setFieldValue('sagrod', 'markup', '5'); setFieldValue('sagrod', 'qty', '2'); recalcCurrent();
    const n0 = quoteItems.length; addCurrentItem();
    const it = quoteItems[quoteItems.length - 1];
    return { n: quoteItems.length - n0, itMode: it.priceMode, next: fv('sagrod', 'priceMode') };
  });
  A.eq(added.n, 1, '4. the Sag Rod is added');
  A.eq(added.itMode, 'auto', '4. the added item keeps the Auto Round it was given');
  A.eq(added.next, 'no_round', '4. the next new Sag Rod starts on No Round again');
  const lb = await p.evaluate(() => {
    switchType('lbolt');
    setFieldValue('lbolt', 'priceMode', 'no_round'); onPriceModeChange('lbolt');
    resetPriceModeAfterAdd('lbolt');
    return fv('lbolt', 'priceMode');
  });
  A.eq(lb, 'auto', '4. the next new L Bolt starts on Auto Round');

  // 10. Recommendation Fill in leaves the mode alone
  const fill = await p.evaluate(() => {
    switchType('sagrod');
    setFieldValue('sagrod', 'material', 'MS'); onMaterialSizeChange('sagrod', false, 'material');
    setFinishValue('sagrod', 'ZP'); onFinishChange('sagrod');
    setFieldValue('sagrod', 'threadLen', '150/150'); onThreadLenChange('sagrod');
    const had = !!dcRecommendFor('sagrod'); dcRecFill();
    return { had, c: fv('sagrod', 'costRate'), mode: fv('sagrod', 'priceMode') };
  });
  A.ok(fill.had && fill.c !== '', '10. Fill in copies the recommendation ' + JSON.stringify(fill));
  A.eq(fill.mode, 'no_round', '10. and Price Mode stays No Round');

  // 9. History Use with an Auto Round record makes the Sag Rod Auto Round
  const hist = await p.evaluate(rec => {
    phFormState = Object.assign({}, phFormState || {}, { records: [rec] }); phUseIndex = 0; phCfApply();
    return fv('sagrod', 'priceMode');
  }, HREC);
  A.eq(hist, 'auto', '9. History → Use this setup keeps the record\'s Auto Round');

  // 11 / 12. saved quotation restore
  const restore = await p.evaluate(() => {
    const base = quoteItems.find(it => it.type === 'sagrod' || (it.formData && it.formData.type === 'sagrod')) || quoteItems[0];
    const out = {};
    const open = (mut, key) => {
      const c = JSON.parse(JSON.stringify(base)); mut(c); quoteItems.push(c);
      editItem(quoteItems.length - 1);
      out[key] = { mode: fv('sagrod', 'priceMode'), pa: dcFormPaState('sagrod').state, unit: c.finalUnitPrice };
      editingItemIndex = null; setItemEditMode(null); quoteItems.pop();
    };
    open(c => { c.priceMode = 'auto'; if (c.formData) c.formData.priceMode = 'auto'; }, 'auto');
    open(c => { c.priceMode = 'no_round'; if (c.formData) c.formData.priceMode = 'no_round'; }, 'nr');
    open(c => { delete c.priceMode; if (c.formData) delete c.formData.priceMode; }, 'legacy');
    out.legacyUnit = dcItemFinalUnit(Object.assign(JSON.parse(JSON.stringify(base)), { priceMode: undefined }));
    out.baseUnit = dcItemFinalUnit(base);
    out.summary = dcItemPricingSummary(Object.assign(JSON.parse(JSON.stringify(base)), { priceMode: undefined, formData: Object.assign({}, base.formData, { priceMode: undefined }) })).mode;
    return out;
  });
  A.eq(restore.auto.mode, 'auto', '11. a saved Sag Rod on Auto Round reopens on Auto Round');
  A.eq(restore.nr.mode, 'no_round', '11. a saved Sag Rod on No Round reopens on No Round');
  A.eq(restore.legacy.mode, 'auto', '12. a legacy Sag Rod with no saved mode still reads as Auto Round');
  A.eq(restore.summary, 'auto', '12. and its pricing summary says Auto Round');
  A.eq(restore.legacyUnit, restore.baseUnit, '12. its final price is unchanged');
  A.ok(['accepted'].includes(restore.legacy.pa), '12. and stands as saved ' + restore.legacy.pa);

  // 5. New Quotation
  const nq = await p.evaluate(() => {
    setFieldValue('sagrod', 'priceMode', 'auto'); setFieldValue('stud', 'priceMode', 'no_round');
    startNewQuotation();
    return { s: fv('sagrod', 'priceMode'), t: fv('stud', 'priceMode'), n: quoteItems.length };
  });
  A.eq(nq.s, 'no_round', '5. New Quotation: Sag Rod starts on No Round');
  A.eq(nq.t, 'auto', '5. New Quotation: Stud starts on Auto Round');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (entry form)');
  await p.close();

  // ═══ Quick Add ════════════════════════════════════════════════════════════
  A.suite('sag rod default — Quick Add / AI');
  p = await openApp(browser, { api: { get_pricing_history: HIST } });
  await quickAddPaste(p, SAG, { expanded: false, settle: 800 });
  const parsed = await p.evaluate(() => wqa.rows.map(r => wqaRowProduct(r) + ':' + r.priceMode));
  A.ok(parsed.length === 2 && parsed.every(s => s === 'sagrod:no_round'), '6. parsed Sag Rod rows start on No Round ' + JSON.stringify(parsed));
  const lbRows = await p.evaluate(() => { wqaChangeProduct('lbolt'); return wqa.rows.map(r => wqaRowProduct(r) + ':' + r.priceMode); });
  A.ok(lbRows.every(s => s === 'lbolt:auto'), '7. switching the list Sag Rod → L Bolt gives Auto Round ' + JSON.stringify(lbRows));
  const sgRows = await p.evaluate(() => { wqaChangeProduct('sagrod'); return wqa.rows.map(r => wqaRowProduct(r) + ':' + r.priceMode); });
  A.ok(sgRows.every(s => s === 'sagrod:no_round'), '7. switching L Bolt → Sag Rod gives No Round ' + JSON.stringify(sgRows));

  // row-level product switch (variant setter)
  const rowSw = await p.evaluate(() => {
    wqaVarSetField(0, 'product', 'lbolt'); const a = wqa.rows[0].priceMode;
    wqaVarSetField(0, 'product', 'sagrod'); const b = wqa.rows[0].priceMode;
    return { a, b };
  });
  A.eq(rowSw.a, 'auto', '7. a row switched Sag Rod → L Bolt goes to Auto Round');
  A.eq(rowSw.b, 'no_round', '7. a row switched L Bolt → Sag Rod goes to No Round');

  // an explicitly chosen mode is not reset by a list product change
  const explicit = await p.evaluate(() => {
    wqaPxMode(1, 'auto');
    wqaChangeProduct('lbolt'); wqaChangeProduct('sagrod');
    return wqa.rows[1].priceMode;
  });
  A.eq(explicit, 'auto', '8. a row someone set to Auto Round keeps it through a list product change');

  // 9. History Use on a row
  await p.close();
  p = await openApp(browser, { api: { get_pricing_history: HIST } });
  await quickAddPaste(p, SAG, { expanded: false, settle: 900 });
  await p.waitForTimeout(400);
  const hu = await p.evaluate(rec => { wqaHistUseRec(0, rec); return { m: wqa.rows[0].priceMode, ok: wqaRowAccepted(wqa.rows[0]) }; }, HREC);
  A.ok(hu.ok && hu.m === 'auto', '9. Quick Add History → Use this setup keeps Auto Round ' + JSON.stringify(hu));

  // 13. Apply this setup to others copies Auto Round onto a No Round row
  const ap = await p.evaluate(() => {
    const before = wqa.rows[1].priceMode;
    const of = wqaRecipeOffer(0);
    if (of) wqaRecipeApplyTo(0, of, of.ok);
    return { before, after: wqa.rows[1].priceMode, offered: !!of };
  });
  A.eq(ap.before, 'no_round', '13. the target row started on No Round');
  A.ok(ap.offered && ap.after === 'auto', '13. Apply this setup copies Auto Round onto it ' + JSON.stringify(ap));

  // 14. Manual Price unaffected
  const man = await p.evaluate(() => {
    wqaPxMode(1, 'manual'); wqa.rows[1].manualPrice = '50'; wqaRecomputeAll('force');
    return { m: wqa.rows[1].priceMode, px: wqa.rows[1].calc && wqa.rows[1].calc.finalUnitPrice };
  });
  A.ok(man.m === 'manual' && Number(man.px) === 50, '14. Manual Price still sets the final price ' + JSON.stringify(man));

  // 6. AI path — same review entry
  const ai = await p.evaluate(async () => {
    wqaHardClose(); wqaOpen();
    await wqaEnterReview({ product: 'sagrod', material: 'MS', finish: 'PL', sizeType: 'FULLSIZE' },
      wqaParseText('M12 x 1070 x 100/100 - 2pcs', 'sagrod').rows, 'ai text', [], 'ai', 'text');
    const s = wqa.rows.map(r => r.priceMode);
    wqaHardClose(); wqaOpen();
    await wqaEnterReview({ product: 'lbolt', material: 'MS', finish: 'PL', sizeType: 'FULLSIZE' },
      wqaParseText('M16 x 300 x 100 - 2pcs', 'lbolt').rows, 'ai text', [], 'ai', 'text');
    return { s, l: wqa.rows.map(r => r.priceMode) };
  });
  A.eq(JSON.stringify(ai.s), '["no_round"]', '6. an AI (shared review entry) Sag Rod row starts on No Round');
  A.eq(JSON.stringify(ai.l), '["auto"]', '6. an AI (shared review entry) L Bolt row starts on Auto Round');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (Quick Add)');
  await p.close();
};
