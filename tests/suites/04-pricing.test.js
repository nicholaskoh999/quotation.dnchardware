/* ── Pricing ───────────────────────────────────────────────────────────────
   Requirements 16, 17, 18, 50.

   A price that is stale is a wrong price, and a wrong price is worse than no
   price at all. Every case here changes one thing that the price depends on
   and asserts that the price either followed it or refused to exist.        */
'use strict';
const { openApp } = require('../lib/harness');

const DP = [
  { id: 1, type: 'stud',       material: 'MS', sizeType: '',         size: 'M16', finish: '',   costRate: 5,   addCost: 1, markup: 10, active: '1' },
  { id: 2, type: 'stud',       material: 'MS', sizeType: '',         size: 'M20', finish: '',   costRate: 7.5, addCost: 2, markup: 20, active: '1' },
  { id: 3, type: 'anchorbolt', material: 'MS', sizeType: 'FULLSIZE', size: 'M20', finish: 'PL', costRate: 4,   addCost: 1, markup: 0,  active: '1' },
  { id: 4, type: 'anchorbolt', material: 'MS', sizeType: 'FULLSIZE', size: 'M20', finish: 'HDG', costRate: 9,  addCost: 3, markup: 0,  active: '1' },
];

module.exports = async (browser, A) => {
  const S = A.suite('pricing — nothing stale, nothing fabricated');
  const page = await openApp(browser, { api: { get_default_prices: { ok: true, data: DP } } });

  // ── a Default Price rule follows the item's identity ─────────────────────
  const dp = await page.evaluate(() => {
    const read = () => ({ size: fv('stud', 'size'), rate: fv('stud', 'costRate'),
                          add: fv('stud', 'addCost'), mk: fv('stud', 'markup'),
                          badge: (document.getElementById('dpStatus') || {}).className || '' });
    switchType('stud');
    document.getElementById('stud-material').value = 'MS';
    document.getElementById('stud-size').value = 'M16'; onStudSizeCommit();
    const m16 = read();
    document.getElementById('stud-size').value = 'M20'; onStudSizeCommit();
    const m20 = read();
    document.getElementById('stud-size').value = 'M39'; onStudSizeCommit();   // no rule for M39
    const none = read();
    return { m16, m20, none };
  });
  A.eq(dp.m16.rate, '5.00', 'the M16 rule fills the M16 rate');
  A.eq(dp.m16.mk, '10', 'and its markup');
  A.eq(dp.m20.rate, '7.50', 'changing the size to M20 brings the M20 rate — it does not keep M16s');
  A.eq(dp.m20.add, '2.00', 'and the M20 additional cost');
  A.eq(dp.m20.mk, '20', 'and the M20 markup');
  A.eq(dp.none.rate, '', 'a size with no rule clears what the previous size\'s rule wrote');
  A.ok(!/show/.test(dp.none.badge), 'and the "Default price applied" badge goes out with it');

  // ── a rate the PERSON typed is theirs and survives ───────────────────────
  const mine = await page.evaluate(() => {
    switchType('stud');
    document.getElementById('stud-size').value = 'M16'; onStudSizeCommit();
    document.getElementById('stud-costRate').value = '99.99';
    markUserPriced('stud', 'costRate');
    document.getElementById('stud-size').value = 'M20'; onStudSizeCommit();
    return { rate: fv('stud', 'costRate'), add: fv('stud', 'addCost') };
  });
  A.eq(mine.rate, '99.99', 'a rate the person typed is not replaced by a rule for the new size');
  A.eq(mine.add, '2.00', 'while a field they did not touch still follows the identity');

  // ── a rate restored with a draft is still the rules', not the person's ───
  const restored = await page.evaluate(() => {
    switchType('stud');
    productEntryTouchedFields.clear();
    document.getElementById('stud-material').value = 'MS';
    document.getElementById('stud-size').value = 'M16'; onStudSizeCommit();
    document.getElementById('stud-l').value = '1000';
    /* Exactly what a recovered draft looks like: the rates are back in the
       boxes, and the touched set records only what the person actually typed. */
    const draft = { currentType: 'stud', formData: {
      __draftFields: { 'stud-material': { value: 'MS' }, 'stud-size': { value: 'M16' },
                       'stud-l': { value: '1000' }, 'stud-costRate': { value: '5.00' },
                       'stud-addCost': { value: '1.00' }, 'stud-markup': { value: '10' } },
      __draftRadioGroups: {}, __draftTouched: ['stud-size', 'stud-l'] } };
    restoreProductEntryDraft(draft);
    const afterRestore = { rate: fv('stud', 'costRate'), size: fv('stud', 'size') };
    document.getElementById('stud-size').value = 'M20'; onStudSizeCommit();
    return { afterRestore, rate: fv('stud', 'costRate'), add: fv('stud', 'addCost'), mk: fv('stud', 'markup') };
  });
  A.eq(restored.afterRestore.rate, '5.00', 'the draft came back with the M16 rate');
  A.eq(restored.rate, '7.50', 'and changing the size to M20 still refreshes it after a reload');
  A.eq(restored.add, '2.00', 'additional cost too');
  A.eq(restored.mk, '20', 'and markup');

  // ── finish is part of the identity too ───────────────────────────────────
  const fin = await page.evaluate(() => {
    switchType('anchorbolt');
    productEntryTouchedFields.clear();
    document.getElementById('anchorbolt-material').value = 'MS';
    document.getElementById('anchorbolt-sizeType').value = 'FULLSIZE';
    document.getElementById('anchorbolt-size').value = 'M20'; onSizeCommit('anchorbolt');
    setFinishValue('anchorbolt', 'PL'); onFinishChange('anchorbolt');
    const pl = fv('anchorbolt', 'costRate');
    setFinishValue('anchorbolt', 'HDG'); onFinishChange('anchorbolt');
    return { pl, hdg: fv('anchorbolt', 'costRate') };
  });
  A.eq(fin.pl, '4.00', 'the PL rule');
  A.eq(fin.hdg, '9.00', 'and changing the finish to HDG brings the HDG rate, not PLs');

  // ── material is part of the identity too ─────────────────────────────────
  const mat = await page.evaluate(() => {
    switchType('stud');
    productEntryTouchedFields.clear();
    document.getElementById('stud-material').value = 'MS';
    document.getElementById('stud-size').value = 'M16'; onStudSizeCommit();
    const before = fv('stud', 'costRate');
    document.getElementById('stud-material').value = 'SS304';
    onMaterialSizeChange('stud', false, 'material');
    return { before, after: fv('stud', 'costRate'), material: fv('stud', 'material') };
  });
  A.eq(mat.before, '5.00', 'mild steel M16 stud at 5.00');
  A.eq(mat.material, 'SS304', 'switched to stainless');
  A.eq(mat.after, '', 'and the mild-steel rate does not stay behind on a stainless item');

  // ── a price may never be the Additional Cost standing alone ──────────────
  const blank = await page.evaluate(() => {
    const out = {};
    ['sagrod', 'stud', 'anchorbolt'].forEach(t => {
      switchType(t);
      productEntryTouchedFields.clear();
      document.getElementById(t + '-material').value = 'MS';
      const st = document.getElementById(t + '-sizeType'); if (st) st.value = 'FULLSIZE';
      document.getElementById(t + '-size').value = 'M12'; onSizeCommit(t);
      const lenId = t === 'sagrod' ? 'length' : 'l';
      document.getElementById(t + '-' + lenId).value = '300';
      document.getElementById(t + '-costRate').value = '';
      markUserPriced(t, 'costRate');
      document.getElementById(t + '-addCost').value = '2.50';
      document.getElementById(t + '-markup').value = '15';
      document.getElementById(t + '-qty').value = '10';
      const before = quoteItems.length;
      ({ sagrod: addSagRod, stud: addStud, anchorbolt: addAnchorBolt })[t]();
      out[t] = quoteItems.length - before;
    });
    return out;
  });
  A.eq(blank.sagrod, '0', 'a Sag Rod with a blank Cost Rate is refused, not quoted at the Additional Cost');
  A.eq(blank.stud, '0', 'a Stud likewise');
  A.eq(blank.anchorbolt, '0', 'an Anchor Bolt likewise');

  // ── a fixed price-list entry is a price, in every rounding mode ──────────
  const special = await page.evaluate(() => {
    switchType('sagrod');
    productEntryTouchedFields.clear();
    document.getElementById('sagrod-material').value = 'MS';
    document.getElementById('sagrod-sizeType').value = 'UNDERSIZE';
    document.getElementById('sagrod-size').value = 'M12'; onSizeCommit('sagrod');
    setFinishValue('sagrod', 'PL');
    document.getElementById('sagrod-threadLen').value = '100/100';
    document.getElementById('sagrod-length').value = '1000';
    document.getElementById('sagrod-costRate').value = '2.80';
    document.getElementById('sagrod-addCost').value = '0.60';
    document.getElementById('sagrod-markup').value = '0';
    const out = { list: getMSUndersizeSagRodPLSpecialPrice('M12', 'UNDERSIZE', 'MS', 'PL', '100/100', 1000) };
    ['auto', 'no_round'].forEach(m => {
      setFieldValue('sagrod', 'priceMode', m); onPriceModeChange('sagrod'); calcSagRod();
      out[m] = (priceCalcState.sagrod || {}).finalUnitPrice;
    });
    setFieldValue('sagrod', 'priceMode', 'auto'); onPriceModeChange('sagrod');
    return out;
  });
  A.eq(special.list, '4', 'the price list holds RM 4.00 for this rod');
  A.eq(special.auto, '4', 'Auto Round quotes it');
  A.eq(special.no_round, '4', 'and No Round quotes it too — a rounding toggle does not discard a price');

  // ── Others: the printed unit price times the qty is the printed total ────
  const others = await page.evaluate(() => {
    switchType('others');
    setFieldValue('others', 'weightMode', 'manual'); onOthersWeightModeChange();
    setFieldValue('others', 'unitWeight', '0.4444');
    setFieldValue('others', 'costRate', '7.77');
    setFieldValue('others', 'addCost', '0');
    setFieldValue('others', 'markup', '0');
    calcOthers();
    const unit = (priceCalcState.others || {}).finalUnitPrice;
    return { unit, printedUnit: unit.toFixed(2), printedTotal: (unit * 37).toFixed(2) };
  });
  A.eq(others.printedTotal, (Number(others.printedUnit) * 37).toFixed(2),
    'unit x qty on the customer\'s page adds up');

  // ── a manual price belongs to the item it was typed for ──────────────────
  const manual = await page.evaluate(() => {
    switchType('anchorbolt');
    productEntryTouchedFields.clear();
    document.getElementById('anchorbolt-material').value = 'MS';
    document.getElementById('anchorbolt-sizeType').value = 'FULLSIZE';
    document.getElementById('anchorbolt-size').value = 'M27'; onSizeCommit('anchorbolt');
    document.getElementById('anchorbolt-l').value = '500';
    document.getElementById('anchorbolt-costRate').value = '2.80';
    document.getElementById('anchorbolt-qty').value = '5';
    setFieldValue('anchorbolt', 'priceMode', 'manual');
    setFieldValue('anchorbolt', 'manualUnitPrice', '12.50');
    onPriceModeChange('anchorbolt');
    const before = quoteItems.length;
    addAnchorBolt();
    const added = quoteItems.length - before;
    const saved = added ? quoteItems[quoteItems.length - 1].finalUnitPrice : null;
    return { added, saved, mode: fv('anchorbolt', 'priceMode'), manual: fv('anchorbolt', 'manualUnitPrice') };
  });
  A.eq(manual.added, '1', 'the manually priced item was added');
  A.eq(manual.saved, '12.5', 'at the price that was typed for it');
  A.eq(manual.mode, 'auto', 'and the NEXT item does not start in manual mode');
  A.eq(manual.manual, '', 'with the previous item\'s figure cleared out of the box');

  // ── numbers we cannot read whole are refused, not half-read ─────────────
  const nums = await page.evaluate(() => ({
    thousands: evalExpr('1,200'),
    decimalComma: evalExpr('2,80'),
    plain: evalExpr('2.80'),
    expr: evalExpr('3+4'),
    twoDots: evalExpr('2.5.6'),
    letters: evalExpr('R2.80'),
  }));
  A.eq(nums.thousands, '1200', '"1,200" is twelve hundred, not one');
  A.eq(nums.decimalComma, '0', '"2,80" is not a number we can read — 0 here means the guard refuses it');
  A.eq(nums.twoDots, '0', '"2.5.6" likewise, instead of being half-read as 2.5');
  A.eq(nums.plain, '2.8', 'an ordinary rate still reads');
  A.eq(nums.expr, '7', 'and so does an expression');
  A.eq(nums.letters, '0', 'and text is still refused');

  // ── the thread-length surcharge bands meet ───────────────────────────────
  const tl = await page.evaluate(() => ['29', '30', '120', '120.5', '121', '200']
    .map(v => v + '=' + getAddCostFromTL(v)).join(','));
  A.includes(tl, '120=0.6', 'a 120mm thread is in the lower band');
  A.includes(tl, '120.5=1', 'and 120.5 is in the upper one, not in a hole between them');
  A.includes(tl, '121=1', '121 too');

  // ── Plate accessories are charged, not just printed ──────────────────────
  const plate = await page.evaluate(() => {
    switchType('plate');
    productEntryTouchedFields.clear();
    document.getElementById('plate-l').value = '200';
    document.getElementById('plate-w').value = '200';
    document.getElementById('plate-t').value = '10';
    document.getElementById('plate-costRate').value = '5';
    document.getElementById('plate-addCost').value = '0';
    document.getElementById('plate-markup').value = '0';
    calcPlate();
    const withoutAcc = (priceCalcState.plate || {}).finalUnitPrice;
    document.getElementById('plate-nutEnabled').checked = true;
    onAccChange('plate');
    document.getElementById('plate-nutQty').value = '2';
    document.getElementById('plate-nutPrice').value = '1.50';
    onAccChange('plate');
    return { withoutAcc, withAcc: (priceCalcState.plate || {}).finalUnitPrice,
             addon: accAddon(getAccessories('plate')) };
  });
  A.eq(plate.addon, '3', 'two nuts at RM1.50 is RM3.00 of accessories');
  A.near(Number(plate.withAcc) - Number(plate.withoutAcc), 3, 0.001,
    'and the plate price includes them — they are promised on the printed quotation');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
