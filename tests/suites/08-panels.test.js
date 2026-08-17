/* ── The bulk-correction panels ────────────────────────────────────────────
   Requirements 29, 30, 31, 36, 37.

   The rule these panels live or die by: a field nobody set must never clear a
   field somebody did.                                                        */
'use strict';
const { openApp, quickAddPaste, rowState, typeRowSize } = require('../lib/harness');

const MSG = [
  'ANCHOR BOLT',
  'GRADE 8.8 HDG FULLSIZE',
  'M20 x 500 x 100 - 10pcs',
  'M24 x 600 x 100 - 8pcs',
  'SS304',
  'M30 x 700 x 100 - 6pcs',
].join('\n');

module.exports = async (browser, A) => {
  const S = A.suite('bulk fields — a blank never clears an answer');
  const page = await openApp(browser);

  await quickAddPaste(page, MSG, { settle: 900 });
  let rows = await rowState(page);
  A.eq(rows.length, 3, 'three rows to correct');
  const before = rows.map(r => ({ mat: r.material, fin: r.finish, st: r.sizeType, size: r.size, len: r.length }));
  A.eq(before[2].mat, 'SS304', 'the third row is stainless');
  A.eq(before[2].fin, '', 'and stainless has no finish');

  // ── the panel does nothing until Apply, and nothing at all while every
  //    field says "keep existing" ───────────────────────────────────────────
  await page.evaluate(() => wqaApplyFixToAll());
  await page.waitForTimeout(600);
  rows = await rowState(page);
  rows.forEach((r, i) => {
    A.eq(r.material, before[i].mat, `row ${i + 1} material untouched by an empty Apply`);
    A.eq(r.finish, before[i].fin, `row ${i + 1} finish untouched`);
    A.eq(r.sizeType, before[i].st, `row ${i + 1} size type untouched`);
  });

  // ── a field left at "keep existing" is not read, even beside one that is ─
  await page.evaluate(() => { wqaEditFix('sizeType', 'UNDERSIZE'); wqaApplyFixToAll(); });
  await page.waitForTimeout(700);
  rows = await rowState(page);
  rows.forEach((r, i) => {
    A.eq(r.sizeType, 'UNDERSIZE', `row ${i + 1} size type was the field that was set`);
    A.eq(r.material, before[i].mat, `row ${i + 1} material still its own`);
    A.eq(r.finish, before[i].fin, `row ${i + 1} finish still its own`);
    A.eq(r.length, before[i].len, `row ${i + 1} dimensions untouched by a spec correction`);
  });

  // ── the refusals hold ────────────────────────────────────────────────────
  await page.evaluate(() => { wqaEditFix('sizeType', '— Keep existing —'); wqaEditFix('finish', 'ZP'); wqaApplyFixToAll(); });
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.eq(rows[0].finish, 'ZP', 'a mild-steel row takes the new finish');
  A.eq(rows[2].material, 'SS304', 'the stainless row is still stainless');
  A.eq(rows[2].finish, '', 'and it is still not given a finish');

  // ── fill blanks only never replaces an answer ───────────────────────────
  await page.evaluate(() => {
    wqaEditFix('finish', '— Keep existing —');
    wqa.rows[1].material = '';                  // one row with nothing to say
    wqaEditFix('material', 'MS');
    wqa.commonFix.blanksOnly = true;
    wqaApplyFixToAll();
  });
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.eq(rows[1].material, 'MS', 'the blank row was filled');
  A.eq(rows[0].material, before[0].mat, 'the row that already had a material kept it');
  A.eq(rows[2].material, 'SS304', 'and so did the stainless one');

  // ── selected items only ──────────────────────────────────────────────────
  await page.evaluate(() => {
    wqa.commonFix.blanksOnly = false;
    wqaSetApplyScope('selected');
    wqa.rows.forEach(r => { r.sel = false; });
    wqa.rows[0].sel = true;
    wqaEditFix('material', '4140');
    wqaApplyFixToAll();
  });
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.includes(rows[0].material, '4140', 'the selected row changed');
  A.excludes(rows[1].material, '4140', 'the unselected row did not');
  A.eq(rows[2].material, 'SS304', 'nor the one after it');

  // ── a warning goes away with the problem it named ────────────────────────
  await page.evaluate(() => { wqaSetApplyScope('all'); });
  await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM23 x 1000 x 100/100 - 5pcs', { settle: 900 });
  rows = await rowState(page);
  A.includes(rows[0].badges, 'Valid Size', 'an unrecognised size is flagged');
  await typeRowSize(page, 0, '22', { blur: true });
  rows = await rowState(page);
  A.excludes(rows[0].badges, 'Valid Size', 'and the flag goes when the size does');
  A.eq(rows[0].missing.length, '0', 'with nothing else left outstanding');

  await page.evaluate(() => wqaEdit(0, 'length', ''));
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.ok(rows[0].missing.includes('Length'), 'clearing the length asks for a length');
  A.eq(rows[0].price, 'null', 'and the row cannot be priced without one');
  await page.evaluate(() => wqaEdit(0, 'length', '1200'));
  await page.waitForTimeout(700);
  rows = await rowState(page);
  A.eq(rows[0].missing.length, '0', 'giving it one settles the question');
  A.ok(Number(rows[0].weight) > 0, 'and the row weighs again');

  // ── a queued correction belongs to the message it was queued for ─────────
  await page.evaluate(() => { wqaEditFix('material', 'SS316'); });
  const queued = await page.evaluate(() => wqa.commonFix.material);
  A.eq(queued, 'SS316', 'a correction is queued');
  await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM20 x 800 x 100/100 - 2pcs', { settle: 900 });
  const afterReset = await page.evaluate(() => ({
    fix: JSON.stringify(wqa.commonFix), material: wqa.rows[0].material,
  }));
  A.excludes(afterReset.fix, 'SS316', 'and it does not survive into the next message');
  A.eq(afterReset.material, 'MS', 'whose rows keep their own material');

  // ── a queued correction does not survive Back then Parse either ─────────
  await page.evaluate(() => {
    wqaEditFix('material', 'SS316');
    el('wqaStep2').hidden = true; el('wqaStep1').hidden = false;   // Back
    el('wqaInput').value = 'MS ANCHOR BOLT HDG FULLSIZE\nM24 x 900 x 120 - 4pcs';
  });
  await page.evaluate(() => wqaParseAndReview());
  await page.waitForTimeout(900);
  const backThenParse = await page.evaluate(() => ({
    fix: JSON.stringify(wqa.commonFix), scope: wqa.applyScope, mat: wqa.rows[0].material,
  }));
  A.excludes(backThenParse.fix, 'SS316', 'the correction queued for the previous message is gone');
  A.eq(backThenParse.scope, 'all', 'and the apply scope is back to all items');
  A.eq(backThenParse.mat, 'MS', 'the new message keeps its own material');

  // ── one row's markup does not price the rows beside it ──────────────────
  await quickAddPaste(page, [
    'MS SAG ROD PL FULLSIZE',
    'M16 x 1000 x 100/100 - 2pcs',
    'M16 x 1200 x 100/100 - 2pcs',
    'M16 x 1400 x 100/100 - 2pcs',
  ].join('\n'), { settle: 900 });
  await page.evaluate(() => {
    wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '5'); wqaEditPrice(i, 'addCost', '0'); });
  });
  await page.waitForTimeout(900);
  const flat = (await rowState(page)).map(r => Number(r.price));
  await page.evaluate(() => wqaEditPrice(1, 'markup', '15'));
  await page.waitForTimeout(900);
  const marked = await rowState(page);
  A.ok(Number(marked[1].price) > flat[1], 'the row that was given a markup costs more');
  A.near(marked[0].price, flat[0], 0.001, 'the row above it is untouched by a markup it was never given');
  A.near(marked[2].price, flat[2], 0.001, 'and the row below it');

  // ── an untouched accessory panel removes nothing ────────────────────────
  await page.evaluate(() => {
    wqaEditAcc(0, 'nut', 'enabled', true);
    wqaEditAcc(0, 'nut', 'qty', 2);
    wqaEditAcc(0, 'nut', 'unitPrice', 1.5);
  });
  await page.waitForTimeout(900);
  const withAcc = (await rowState(page))[0];
  await page.evaluate(() => wqaApplyAccToAll());
  await page.waitForTimeout(900);
  const afterApply = (await rowState(page))[0];
  A.ok(await page.evaluate(() => wqaAccHas(wqa.rows[0].acc)), 'the row still has its accessories');
  A.near(afterApply.price, withAcc.price, 0.001, 'and its price did not fall');

  // ── a warning goes when the thing it named is corrected ─────────────────
  await page.evaluate(() => { wqa.rows[0].aiUncertain = ['segments vs length']; wqaRenderRows(true); });
  await page.waitForTimeout(300);
  A.includes((await rowState(page))[0].badges, 'segments vs length', 'the extractor\'s doubt is shown');
  await page.evaluate(() => wqaEdit(0, 'length', '1100'));
  await page.waitForTimeout(800);
  A.excludes((await rowState(page))[0].badges, 'segments vs length',
    'and it goes when a person retypes the field it was about');

  // ── a size type WE chose says it was ours ───────────────────────────────
  await quickAddPaste(page, 'MS SAG ROD\nM12 x 1000 x 75/75 - 50pcs', { settle: 900 });
  const defaulted = await rowState(page);
  const wasDefaulted = await page.evaluate(() => !!wqa.rows[0].stDefaulted);
  if (wasDefaulted) {
    A.includes(defaulted[0].badges, 'company default',
      'a size type applied by a company rule, which the customer never stated, says so on the row');
    await page.evaluate(() => wqaEditRowSpec(0, 'sizeType', 'FULLSIZE'));
    await page.waitForTimeout(700);
    A.excludes((await rowState(page))[0].badges, 'company default',
      'and stops saying so once a person has chosen one');
  } else {
    A.ok(true, 'no size type was defaulted for this message — case not applicable');
  }

  // ── compact and expanded show the same item ──────────────────────────────
  await page.evaluate(() => wqaSetView('compact'));
  await page.waitForTimeout(300);
  const compact = await page.evaluate(() => ({
    model: JSON.stringify(wqa.rows.map(r => [r.size, r.length, r.qty])),
    size: document.querySelector('[data-wqa-row="0"] .wqa-c-size').textContent,
  }));
  await page.evaluate(() => wqaSetView('expanded'));
  await page.waitForTimeout(300);
  /* The size box lives in the inline edit grid now, not in a second copy
     inside Expanded — the same field was editable in two places and only one
     of them could be right. What is asserted is unchanged: switching view
     moves no value, and the size a person sees is the same either way. */
  const expanded = await page.evaluate(() => ({
    model: JSON.stringify(wqa.rows.map(r => [r.size, r.length, r.qty])),
    size: (document.querySelector('[data-wqa-row="0"] .wqa-c-size') || {}).textContent.trim(),
  }));
  A.eq(expanded.model, compact.model, 'switching view does not change a single value');
  A.eq(expanded.size, compact.size, 'and both views show the same size');

  // ── Quick Add leaves the entry forms as it found them ────────────────────
  const forms = await openApp(browser);
  const kept = await forms.evaluate(async () => {
    switchType('sagrod');
    document.getElementById('sagrod-size').value = 'M16'; onSizeCommit('sagrod');
    document.getElementById('sagrod-length').value = '444';
    document.getElementById('sagrod-costRate').value = '3.33';
    markUserPriced('sagrod', 'costRate');
    const mine = { size: fv('sagrod', 'size'), len: fv('sagrod', 'length'), rate: fv('sagrod', 'costRate') };
    wqaOpen();
    document.getElementById('wqaInput').value = 'MS SAG ROD PL FULLSIZE\nM30 x 2000 x 150/150 - 3pcs';
    await wqaParseAndReview();
    await new Promise(r => setTimeout(r, 800));
    const during = { size: fv('sagrod', 'size'), len: fv('sagrod', 'length') };
    wqaHardClose();
    return { mine, during, after: { size: fv('sagrod', 'size'), len: fv('sagrod', 'length'), rate: fv('sagrod', 'costRate') } };
  });
  A.eq(kept.after.size, kept.mine.size, 'the half-typed size is still there after Quick Add closes');
  A.eq(kept.after.len, kept.mine.len, 'and the length');
  A.eq(kept.after.rate, kept.mine.rate, 'and the rate — the pasted message did not price it');
  await forms.close();

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
