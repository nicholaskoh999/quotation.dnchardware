/* ── Weight ────────────────────────────────────────────────────────────────
   Requirements 14, 15, 16, 17.

   Every expected value below is computed HERE — pi/4 x d^2 x developed length
   x 7.85e-6, with the developed length worked out by hand from each product's
   geometry — and compared against the number the shipped calculator produced.
   Nothing is read out of the app and asserted against itself.               */
'use strict';
const { openApp, quickAddPaste, rowState, typeRowSize } = require('../lib/harness');

const K = Math.PI / 4 * 7.85e-6;          // kg per mm^3 of round steel bar
const w = (d, L) => d * d * L * K;
const APP_K = 0.0000061654;               // what the calculators actually multiply by
const appW = (d, L) => d * d * L * APP_K;

module.exports = async (browser, A) => {
  const S = A.suite('weight — every product, every input that moves it');
  const page = await openApp(browser);

  A.near(APP_K, K, 1e-10, 'the shared constant is pi/4 x 7.85e-6');

  /* Drive the REAL entry form for each product, read the REAL preview. */
  const calcFor = (type, fields) => page.evaluate(([t, f]) => {
    switchType(t);
    Object.keys(f).forEach(k => { const e = document.getElementById(t + '-' + k); if (e) e.value = String(f[k]); });
    if (typeof window['calc' + ({ sagrod: 'SagRod', stud: 'Stud', anchorbolt: 'AnchorBolt', ubolt: 'UBolt',
        squbolt: 'SQUBolt', lbolt: 'LBolt', jbolt: 'JBolt' })[t]] === 'function') {
      const fn = window['calc' + ({ sagrod: 'SagRod', stud: 'Stud', anchorbolt: 'AnchorBolt', ubolt: 'UBolt',
        squbolt: 'SQUBolt', lbolt: 'LBolt', jbolt: 'JBolt' })[t]];
      fn.length ? fn(t, true) : fn();
    }
    const tl = document.getElementById(t + '-length');
    return { weight: (priceCalcState[t] || {}).weight, totalLength: tl ? tl.value : '' };
  }, [type, fields]);

  // ── straight rods: developed length IS the length ────────────────────────
  let r = await calcFor('sagrod', { diameter: 20, length: 1000, costRate: 5, addCost: 0, markup: 0 });
  A.near(r.weight, appW(20, 1000), 1e-9, 'Sag Rod M20 x 1000: d^2 L k');
  A.near(r.weight, w(20, 1000), 1e-5, 'and that is pi/4 d^2 L rho');

  r = await calcFor('anchorbolt', { diameter: 24, l: 750, costRate: 5, addCost: 0, markup: 0 });
  A.near(r.weight, appW(24, 750), 1e-9, 'Anchor Bolt M24 x 750');

  r = await calcFor('stud', { diameter: 10.6, l: 300, costRate: 5, addCost: 0, markup: 0 });
  A.near(r.weight, appW(10.6, 300), 1e-9, 'Stud on the undersize M12 diameter, 10.6');

  // ── bent products: the developed length is worked out per geometry ───────
  // U Bolt: (d + ID) x 1.57 + 2 x IH - ID, rounded up
  {
    const d = 12, id = 50, ih = 60;
    const dev = Math.ceil((d + id) * 1.57 + 2 * ih - id);
    r = await page.evaluate(([d, id, ih]) => {
      switchType('ubolt');
      ['diameter', 'id', 'ih'].forEach((k, n) => document.getElementById('ubolt-' + k).value = [d, id, ih][n]);
      document.getElementById('ubolt-costRate').value = 5;
      calcUBolt('ubolt');
      return { weight: (priceCalcState.ubolt || {}).weight, totalLength: document.getElementById('ubolt-length').value };
    }, [d, id, ih]);
    A.eq(r.totalLength, String(dev), 'U Bolt developed length: (d+ID)x1.57 + 2IH - ID, rounded up');
    A.near(r.weight, appW(d, dev), 1e-9, 'and it is weighed on that developed length');
  }
  // SQ U Bolt: ((W/2 + OH) - 1.5d) x 2, rounded up
  {
    const d = 16, oh = 100, wd = 150;
    const dev = Math.ceil(((wd / 2 + oh) - d * 1.5) * 2);
    r = await page.evaluate(([d, oh, wd]) => {
      switchType('squbolt');
      document.getElementById('squbolt-diameter').value = d;
      document.getElementById('squbolt-oh').value = oh;
      document.getElementById('squbolt-w').value = wd;
      document.getElementById('squbolt-costRate').value = 5;
      calcSQUBolt('squbolt');
      return { weight: (priceCalcState.squbolt || {}).weight, totalLength: document.getElementById('squbolt-length').value };
    }, [d, oh, wd]);
    A.eq(r.totalLength, String(dev), 'SQ U Bolt developed length: ((W/2 + OH) - 1.5d) x 2, rounded up');
    A.near(r.weight, appW(d, dev), 1e-9, 'weighed on it');
  }
  // L Bolt: L + W - 1.5d, rounded up
  {
    const d = 20, L = 500, W = 100;
    const dev = Math.ceil(L + W - d * 1.5);
    r = await page.evaluate(([d, L, W]) => {
      switchType('lbolt');
      document.getElementById('lbolt-diameter').value = d;
      document.getElementById('lbolt-l').value = L;
      document.getElementById('lbolt-w').value = W;
      document.getElementById('lbolt-costRate').value = 5;
      calcLBolt('lbolt');
      return { weight: (priceCalcState.lbolt || {}).weight, totalLength: document.getElementById('lbolt-length').value };
    }, [d, L, W]);
    A.eq(r.totalLength, String(dev), 'L Bolt developed length: L + W - 1.5d, rounded up');
    A.near(r.weight, appW(d, dev), 1e-9, 'weighed on it');
  }
  // J Bolt: (H - S) + [(d + ID) x 1.57 + 2(S - d) - ID], rounded up
  {
    const d = 20, H = 600, ID = 80, Sv = 120;
    const dev = Math.ceil((H - Sv) + ((d + ID) * 1.57 + 2 * (Sv - d) - ID));
    r = await page.evaluate(([d, H, ID, Sv]) => {
      switchType('jbolt');
      document.getElementById('jbolt-diameter').value = d;
      document.getElementById('jbolt-h').value = H;
      document.getElementById('jbolt-id').value = ID;
      document.getElementById('jbolt-s').value = Sv;
      document.getElementById('jbolt-costRate').value = 5;
      calcJBolt('jbolt');
      return { weight: (priceCalcState.jbolt || {}).weight, totalLength: document.getElementById('jbolt-length').value };
    }, [d, H, ID, Sv]);
    A.eq(r.totalLength, String(dev), 'J Bolt developed length: straight part + hook development');
    A.near(r.weight, appW(d, dev), 1e-9, 'weighed on it');
  }

  // ── every input that moves the weight, moves it ──────────────────────────
  await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 4pcs');
  let rows = await rowState(page);
  A.near(rows[0].weight, appW(20, 1000), 1e-9, 'the Quick Add row weighs the same as the form does');
  A.includes(rows[0].shownTotalWeight, (appW(20, 1000) * 4).toFixed(4), 'total weight is unit weight x qty');

  const setDim = async (k, v) => {
    await page.evaluate(([k, v]) => wqaEdit(0, k, v), [k, v]);
    await page.waitForTimeout(500);
    return (await rowState(page))[0];
  };

  let row = await setDim('length', '1500');
  A.near(row.weight, appW(20, 1500), 1e-9, 'editing Length reweighs');
  A.includes(row.shownTotalWeight, (appW(20, 1500) * 4).toFixed(4), 'and the total follows');

  row = await setDim('qty', '7');
  A.near(row.weight, appW(20, 1500), 1e-9, 'qty does not change the UNIT weight');
  A.includes(row.shownTotalWeight, (appW(20, 1500) * 7).toFixed(4), 'but it does change the total');

  await typeRowSize(page, 0, '30', { blur: true });
  row = (await rowState(page))[0];
  A.near(row.weight, appW(30, 1500), 1e-9, 'editing Size reweighs');

  await page.evaluate(() => wqaEditRowSpec(0, 'sizeType', 'UNDERSIZE'));
  await page.waitForTimeout(600);
  row = (await rowState(page))[0];
  A.eq(row.weight, 'null', 'there is no undersize M30, so the row has no weight at all');
  A.eq(row.price, 'null', 'and therefore no price');
  A.ok(row.missing.includes('Valid Size'), 'and it says the size is the problem');

  await page.evaluate(() => wqaEditRowSpec(0, 'sizeType', 'FULLSIZE'));
  await page.waitForTimeout(600);
  row = (await rowState(page))[0];
  A.near(row.weight, appW(30, 1500), 1e-9, 'back to fullsize, back to the fullsize weight');

  await typeRowSize(page, 0, '20', { blur: true });
  await page.evaluate(() => wqaEditRowSpec(0, 'sizeType', 'UNDERSIZE'));
  await page.waitForTimeout(600);
  row = (await rowState(page))[0];
  A.near(row.weight, appW(18, 1500), 1e-9, 'undersize M20 is an 18mm bar, and is weighed as one');

  // ── size type changes the DIAMETER, so it must change the weight ─────────
  await page.evaluate(() => wqaEditRowSpec(0, 'material', '4140'));
  await page.waitForTimeout(600);
  row = (await rowState(page))[0];
  A.near(row.weight, appW(18, 1500), 1e-9, 'material alone does not change an undersize diameter');

  // ── the undersize inch tables are a different bar, not a different spelling
  const inch = await page.evaluate(() => {
    const out = {};
    switchType('sagrod');
    [['FULLSIZE', '1/2'], ['UNDERSIZE', '1/2'], ['FULLSIZE', '1/2"'], ['UNDERSIZE', '1/2"'],
     ['UNDERSIZE', '3/4'], ['UNDERSIZE', '3/4" BSW'], ['UNDERSIZE', '1-1/4']].forEach(([st, sz]) => {
      document.getElementById('sagrod-sizeType').value = st;
      document.getElementById('sagrod-size').value = sz;
      autoFillDiameter('sagrod');
      out[st + ' ' + sz] = document.getElementById('sagrod-diameter').value;
    });
    return out;
  });
  A.eq(inch['FULLSIZE 1/2'], '12.7', 'a fullsize half inch is 12.7mm');
  A.eq(inch['UNDERSIZE 1/2'], '10.9', 'an UNDERSIZE half inch is 10.9mm — a different bar');
  A.eq(inch['FULLSIZE 1/2"'], '12.7', 'the inch mark does not change the fullsize answer');
  A.eq(inch['UNDERSIZE 1/2"'], '10.9', 'nor the undersize one — this used to return 12.7, 36% too heavy');
  A.eq(inch['UNDERSIZE 3/4'], '17.1', 'undersize 3/4 is 17.1mm');
  A.eq(inch['UNDERSIZE 3/4" BSW'], '17.1', 'a thread standard after the size does not change it either');
  A.eq(inch['UNDERSIZE 1-1/4'], '', 'a size with no undersize entry has NO diameter — it is not given the fullsize one');

  // ── a hand-entered Total Length survives being reopened ─────────────────
  const handTyped = await page.evaluate(() => {
    switchType('ubolt');
    productEntryTouchedFields.clear();
    document.getElementById('ubolt-material').value = 'MS';
    document.getElementById('ubolt-sizeType').value = 'FULLSIZE';
    document.getElementById('ubolt-size').value = 'M12'; onSizeCommit('ubolt');
    document.getElementById('ubolt-id').value = '50';
    document.getElementById('ubolt-ih').value = '60';
    calcUBolt('ubolt');
    const derived = document.getElementById('ubolt-length').value;
    /* The real bent length, typed over the derived one — the field's own
       handler passes skipAuto, so it sticks while typing. */
    document.getElementById('ubolt-length').value = '250';
    calcUBolt('ubolt', true);
    document.getElementById('ubolt-costRate').value = '4';
    document.getElementById('ubolt-addCost').value = '0';
    document.getElementById('ubolt-markup').value = '0';
    document.getElementById('ubolt-qty').value = '1';
    const before = quoteItems.length;
    addUBolt();
    const added = quoteItems.length - before;
    const saved = added ? quoteItems[quoteItems.length - 1].weight : null;
    /* Reopen it to change something else entirely. */
    if (added) editItem(quoteItems.length - 1);
    return { derived, saved, added,
             lenOnReopen: document.getElementById('ubolt-length').value,
             previewOnReopen: (priceCalcState.ubolt || {}).weight };
  });
  A.eq(handTyped.derived, '168', 'the derived total length is (d+ID)x1.57 + 2IH - ID, rounded up');
  A.eq(handTyped.added, '1', 'the hand-measured 250 was accepted');
  A.near(handTyped.saved, appW(12, 250), 1e-9, 'and the item was weighed on 250, not on 168');
  A.eq(handTyped.lenOnReopen, '250', 'reopening it for edit does not re-derive over the stored length');
  A.near(handTyped.previewOnReopen, appW(12, 250), 1e-9, 'so the preview is still the weight that was quoted');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
