/* ── SOS: keep the pricing recipe after Enter / Add ─────────────────────────
   Consecutive rows usually share one recipe; only dimensions / qty change.
   After an add the next entry keeps Cost / Add / Markup / Price Mode and
   recalculates from its own dimensions. Saved rows never reprice. A typed
   manual unit price is still dropped. New Quotation still fully resets.   */
'use strict';
const { openApp } = require('../lib/harness');

module.exports = async (browser, A) => {
  A.suite('keep pricing recipe after add');
  const p = await openApp(browser);
  const setup = () => p.evaluate(() => {
    switchType('sagrod');
    setFieldValue('sagrod', 'material', 'MS'); onMaterialSizeChange('sagrod', false, 'material');
    setFieldValue('sagrod', 'sizeType', 'FULLSIZE');
    setFieldValue('sagrod', 'size', 'M12'); onSizeCommit('sagrod');
    setFinishValue('sagrod', 'PL'); onFinishChange('sagrod');
    setFieldValue('sagrod', 'threadLen', '100/100'); onThreadLenChange('sagrod');
    setFieldValue('sagrod', 'qty', '1');
    setFieldValue('sagrod', 'costRate', '4'); setFieldValue('sagrod', 'addCost', '4'); setFieldValue('sagrod', 'markup', '4');
  });
  const rec = () => p.evaluate(() => [fv('sagrod', 'costRate'), fv('sagrod', 'addCost'), fv('sagrod', 'markup'), fv('sagrod', 'priceMode')].join('/'));
  await setup();

  // A + C: Enter from Length
  await p.evaluate(() => { setFieldValue('sagrod', 'length', '1000'); recalcCurrent(); });
  await p.focus('#sagrod-length'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  const first = await p.evaluate(() => ({ n: quoteItems.length, price: quoteItems[0] && quoteItems[0].finalUnitPrice, len: fv('sagrod', 'length') }));
  A.eq(first.n, 1, 'Enter from Length adds the item');
  A.eq(await rec(), '4/4/4/no_round', 'A/C. after Enter the next entry keeps 4 / 4 / 4 and No Round');

  // B: next length recalculates with preserved recipe
  const b = await p.evaluate(() => {
    setFieldValue('sagrod', 'length', '1000'); recalcCurrent(); const same = priceCalcState.sagrod.finalUnitPrice;
    setFieldValue('sagrod', 'length', '2000'); recalcCurrent(); return { same, two: priceCalcState.sagrod.finalUnitPrice };
  });
  A.ok(Math.abs(b.same - first.price) < 1e-9, 'B. same dims + preserved recipe reproduce the first price ' + JSON.stringify([b.same, first.price]));
  A.ok(b.two > b.same, 'B. a longer length recalculates (not a frozen final price)');

  // Add button path + D: changed recipe is used
  const d = await p.evaluate(() => {
    setFieldValue('sagrod', 'markup', '10'); recalcCurrent(); addSagRod();
    return { n: quoteItems.length, m: quoteItems[1] && quoteItems[1].markup };
  });
  A.eq(d.n, 2, 'Add to Quotation adds the item');
  A.eq(String(d.m), '10', 'D. the changed recipe is used for the next item');
  A.eq(await rec(), '4/4/10/no_round', 'Add button keeps the recipe like Enter does');

  // E: saved rows never reprice
  const e = await p.evaluate(() => { const before = quoteItems.map(i => i.finalUnitPrice);
    setFieldValue('sagrod', 'costRate', '9'); recalcCurrent(); return { before, after: quoteItems.map(i => i.finalUnitPrice) }; });
  A.eq(JSON.stringify(e.after), JSON.stringify(e.before), 'E. saved rows keep their price when next-entry pricing changes');

  // Manual price is still a one-item decision
  const man = await p.evaluate(() => {
    setFieldValue('sagrod', 'priceMode', 'manual'); onPriceModeChange('sagrod');
    setFieldValue('sagrod', 'manualUnitPrice', '12.34'); setFieldValue('sagrod', 'length', '1500'); recalcCurrent(); addSagRod();
    return { n: quoteItems.length, mode: fv('sagrod', 'priceMode'), man: fv('sagrod', 'manualUnitPrice'), cost: fv('sagrod', 'costRate') };
  });
  A.ok(man.n === 3 && man.mode === 'no_round' && man.man === '' && man.cost === '9', 'manual unit price is not carried over ' + JSON.stringify(man));

  // F: New Quotation fully resets
  const f = await p.evaluate(() => { window.confirm = () => true; startNewQuotation();
    return [fv('sagrod', 'costRate'), fv('sagrod', 'addCost'), fv('sagrod', 'markup'), fv('sagrod', 'priceMode')].join('/'); });
  A.eq(f, '///no_round', 'F. New Quotation leaves no stale pricing');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors');
  await p.close();
};
