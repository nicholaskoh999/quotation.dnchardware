/* ── Corrections survive, numbers trace, a short answer says it is short ────
   Phases 13, 14, 15.

   Three ways a Quick Add session can lie to the person using it, all of them
   quiet:

     * choosing the product at the top re-read the message and threw away every
       correction already made to the rows,
     * the WhatsApp message numbered its own lines, so "item 2" meant one thing
       to the customer and another to the member of staff reading the quotation,
     * an analysis that stopped half way through a document produced a short
       list that looked exactly like a complete one.

   None of them shows up as an error. Each is asserted here against the shipped
   path — the real parse, the real message builder, the real Add button.       */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* One item in the shape ai_extract.php returns, as suite 09 builds it. */
const aiItem = (M, L, TL, qty, extra = {}) => Object.assign({
  M, L, W: null, TL, qty, Bmid: null, material: null, finish: null, sizeType: null,
  unclear: null, product: null, threadEnds: null, bodyDia: null,
  H: null, ID: null, S: null, R: null,
}, extra);

module.exports = async (browser, A) => {
  const S = A.suite('quick add safety — corrections, item numbers, partial extraction');
  const page = await openApp(browser);

  /* ── Phase 13 · choosing a product must not discard corrections ──────────
     A message that never names its product parses under the general shape and
     leaves the Product box empty — the review screen asks for one. That ask is
     answered AFTER the list has been read and corrected, which is exactly when
     re-reading the message costs the most. */
  const NOPROD = ['MS PL FULLSIZE',
                  'M20 x 1000 x 100 - 4pcs',
                  'M24 x 1200 x 150 - 2pcs',
                  'M16 x 800 x 100 - 6pcs'].join('\n');

  await quickAddPaste(page, NOPROD, { settle: 900 });
  let rows = await rowState(page);
  A.eq(rows.length, 3, 'three rows from a message that names no product');
  A.eq(await page.evaluate(() => wqa.product || ''), '', 'and no product is guessed for them');

  /* Corrections a person makes on the screen: a retyped length, a changed
     quantity, a material only this row has, a manual price, a deleted row. */
  await page.evaluate(() => {
    wqaEdit(0, 'length', '1100');
    wqaEdit(1, 'qty', '9');
    wqaEditRowSpec(0, 'material', '4140');
    wqaEditPrice(2, 'costRate', '7.5');
    wqaRemoveRow(2);
  });
  await page.waitForTimeout(700);

  await page.evaluate(() => wqaChangeProduct('lbolt'));
  await page.waitForTimeout(900);
  rows = await rowState(page);
  const live = rows.filter(r => r.removed !== true);

  A.eq(live.length, 2, 'a deleted row stays deleted when the product is chosen');
  A.eq(live[0].length, '1100', 'the retyped length survives the product being chosen');
  A.eq(live[1].qty, '9', 'and the corrected quantity');
  A.eq(live[0].material, '4140', 'and a material set on one row only');
  A.eq(live[0].product, 'lbolt', 'while every row in scope takes the chosen product');
  A.eq(live[1].product, 'lbolt', 'including the second one');
  A.eq(rows[2].removed, 'true', 'the third row is still the deleted one, not a fresh row in its place');
  A.eq(await page.evaluate(() => String(wqa.rows[2].priceOverride.costRate || '')), '7.5',
    'and the rate typed into it before it was deleted is still on it');

  /* The scope is obeyed: with Apply Selected on, a product reaches the ticked
     rows and no others. */
  await page.evaluate(() => {
    wqaSetApplyScope('selected');
    wqa.rows.forEach((r, i) => { r.sel = (i === 1); });
    wqaChangeProduct('jbolt');
  });
  await page.waitForTimeout(900);
  rows = await rowState(page);
  A.eq(rows[1].product, 'jbolt', 'the ticked row takes the new product');
  A.eq(rows[0].product, 'lbolt', 'and the row nobody ticked keeps the one it had');
  await page.evaluate(() => wqaSetApplyScope('all'));

  /* Preserved behaviour: an UNTOUCHED list from a pasted message is still
     re-read under the new product, because there is nothing to lose and the new
     product's vocabulary reads the dimensions better. */
  await quickAddPaste(page, ['MS PL FULLSIZE',
                             'M20 x 1000 x 100 - 4pcs'].join('\n'), { settle: 800 });
  rows = await rowState(page);
  A.eq(rows.length, 1, 'one row, from a message that still names no product');
  A.eq(rows[0].product, '', 'so no product is on the row');
  A.eq(rows[0].w, '', 'and the trailing 100 is not yet placed anywhere');
  await page.evaluate(() => wqaChangeProduct('lbolt'));
  await page.waitForTimeout(900);
  rows = await rowState(page);
  A.eq(rows.length, 1, 'an untouched list is re-read, not multiplied');
  A.eq(rows[0].product, 'lbolt', 'under the product just chosen');
  A.eq(rows[0].w, '100', 'and the same 100 is read as an L Bolt\'s short leg — the re-read still happens');
  A.eq(rows[0].length, '1000', 'with the length unchanged');

  /* A correction made from a PANEL is a correction too. Common Item Fields,
     Common Fields, Pricing and Accessories panels all write into the rows, and
     a re-read discards what they wrote just as thoroughly as it discards a
     typed length — more quietly, because filling only the blanks leaves the
     header reading "Mixed" and the header is where the value would otherwise
     have survived. */
  await quickAddPaste(page, ['PL FULLSIZE',
                             'MS M20 x 1000 x 100 - 4pcs',
                             'SS304 M24 x 1200 x 150 - 2pcs'].join('\n'), { settle: 900 });
  rows = await rowState(page);
  A.eq(rows.map(r => r.finish || '-').join(','), 'PL,-',
    'the message says PL, and the stainless row takes no finish at all');

  const panelApplied = await page.evaluate(() => {
    wqa.commonFix = Object.assign(wqaEmptyFix(), { finish: 'HDG' });
    wqaApplyFixToAll();
    return { finishes: wqa.rows.map(r => r.finish || '-'), header: wqa.common.finish || '-' };
  });
  await page.waitForTimeout(800);
  A.eq(panelApplied.finishes.join(','), 'HDG,-',
    'Common Item Fields galvanises the mild steel row and refuses the stainless one');
  A.eq(panelApplied.header, 'PL',
    'so the header still reads PL — it cannot carry the correction through a re-read');

  await page.evaluate(() => wqaChangeProduct('lbolt'));
  await page.waitForTimeout(900);
  rows = await rowState(page);
  A.eq(rows.map(r => r.finish || '-').join(','), 'HDG,-',
    'and choosing a product afterwards keeps what the panel applied');
  A.eq(rows.map(r => r.product).join(','), 'lbolt,lbolt', 'while every row takes the product');

  /* The same for a price applied from the panel. */
  await quickAddPaste(page, ['MS PL FULLSIZE',
                             'M20 x 1000 x 100 - 4pcs'].join('\n'), { settle: 900 });
  await page.evaluate(() => {
    wqa.commonPrice = Object.assign(wqaEmptyPrice(), { costRate: '9.25', addCost: '2', markup: '' });
    wqaApplyPriceToAll();
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => wqaChangeProduct('lbolt'));
  await page.waitForTimeout(900);
  const keptRate = await page.evaluate(() => String((wqa.rows[0].priceOverride || {}).costRate || ''));
  A.eq(keptRate, '9.25', 'a cost rate applied from the Pricing panel survives the product being chosen');

  /* An extraction has no transcript to re-read, so its rows are never replaced
     — "[uploaded] drawing.png" would parse to nothing at all. */
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, {
    product: 'ANCHOR_BOLT', material: 'MS', finish: 'HDG', sizeType: 'Fullsize',
    threadEnds: 1, note: null, items: [aiItem('M20', 300, 150, 4), aiItem('M24', 400, 150, 2)],
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => wqaChangeProduct('lbolt'));
  await page.waitForTimeout(900);
  rows = await rowState(page);
  A.eq(rows.length, 2, 'an extracted list is not emptied by choosing a product');
  A.eq(rows[0].size, 'M20', 'its first row is still the row that was extracted');
  A.eq(rows[1].length, '400', 'and its second row keeps its own length');

  /* ── Phase 14 · the number the customer quotes back at us ────────────────
     The message groups by material and finish, so its rows come out in a
     different order from the quotation. The numbers must still be the
     quotation's own, and two identical items merged onto one line must carry
     both numbers rather than silently dropping one. */
  const wa = await page.evaluate(() => {
    quoteItems.length = 0;
    const base = {
      itemType: 'sagrod', productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE',
      finish: 'PL', cleanSize: 'M20', sizeCode: 'M20', qty: 4, weight: 2.4,
      accessories: null, customDimensions: null, totalAmount: 48,
    };
    quoteItems.push({ ...base, desc: 'MS FULLSIZE SAG ROD', size: 'M20 x L 1000', finalUnitPrice: 12 });
    quoteItems.push({ ...base, desc: 'MS FULLSIZE SAG ROD (HDG)', finish: 'HDG',
                      size: 'M16 x L 600', finalUnitPrice: 8 });
    quoteItems.push({ ...base, desc: 'MS FULLSIZE SAG ROD (HDG)', finish: 'HDG',
                      size: 'M24 x L 1400', finalUnitPrice: 20 });
    quoteItems.push({ ...base, desc: 'MS FULLSIZE SAG ROD', size: 'M20 x L 1000', finalUnitPrice: 12 });
    return { text: buildWAItemsText('-'),
             printed: quoteItems.map((it, i) => (i + 1) + ' ' + it.size).join(' | ') };
  });

  A.eq(wa.printed, '1 M20 x L 1000 | 2 M16 x L 600 | 3 M24 x L 1400 | 4 M20 x L 1000',
    'the quotation numbers its items 1,2,3,4 by position');
  A.includes(wa.text, '1, 4. M20 x L 1000',
    'two identical items merge onto one message line that carries BOTH their numbers');
  A.includes(wa.text, '2. M16 x L 600', 'the HDG group keeps item 2\'s own number');
  A.includes(wa.text, '3. M24 x L 1400', 'and item 3\'s');
  A.excludes(wa.text, '1. M16', 'the message never renumbers a row by its position in the message');
  const nos = (wa.text.match(/^\s*([\d, ]+)\./gm) || []).map(s => s.trim().replace(/\.$/, ''));
  A.eq(nos.join(' / '), '1, 4 / 2 / 3',
    'every number on the message is a quotation item number, and none is missing');

  /* A quantity difference is a different line, and keeps its own number. */
  const wa2 = await page.evaluate(() => {
    quoteItems[3].finalUnitPrice = 13;
    return buildWAItemsText('-');
  });
  A.includes(wa2, '1. M20 x L 1000 - RM12.00', 'a differently-priced twin is its own line');
  A.includes(wa2, '4. M20 x L 1000 - RM13.00', 'numbered as item 4, where it sits in the quotation');

  /* ── Phase 15 · a partial extraction is not a successful one ─────────────*/
  const PARTIAL = {
    product: 'ANCHOR_BOLT', material: 'MS', finish: 'HDG', sizeType: 'Fullsize',
    threadEnds: 1, note: null,
    items: [aiItem('M20', 300, 150, 4), aiItem('M24', 400, 150, 2), aiItem('M16', 250, 100, 6)],
  };
  const readPartial = () => page.evaluate(() => {
    const box = document.getElementById('wqaPartial');
    const btn = document.getElementById('wqaAddBtn');
    const foot = document.getElementById('wqaFootNeed');
    return {
      rows: wqa.rows.filter(r => !r.removed).length,
      truncated: !!wqa.truncated, ack: !!wqa.truncAck,
      shown: !!box && !box.hidden,
      text: box ? box.textContent.replace(/\s+/g, ' ').trim() : '',
      hasCheckbox: !!document.getElementById('wqaPartialAckBox'),
      disabled: !!btn && btn.disabled,
      foot: foot ? (foot.hidden ? '' : foot.textContent) : '',
      items: quoteItems.length,
    };
  });

  await page.evaluate(() => { quoteItems.length = 0; });
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d, undefined, { truncated: true }); },
    PARTIAL);
  await page.waitForTimeout(1000);
  /* Give every row a rate, so that nothing but the acknowledgement is holding
     the Add button — otherwise this proves only that incomplete rows block. */
  await page.evaluate(() => wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '5'); wqaEditPrice(i, 'addCost', '1'); }));
  await page.waitForTimeout(900);

  let p = await readPartial();
  A.eq(p.rows, 3, 'every row that DID arrive is kept — a partial answer is not thrown away');
  A.eq(p.truncated, true, 'and the session knows the answer was cut short');
  A.eq(p.shown, true, 'a banner says so, at the top of the review screen');
  A.includes(p.text, 'Partial extraction', 'in words nobody has to interpret');
  A.includes(p.text, 'Only 3 item(s) were recovered', 'with the number of rows that actually arrived');
  A.includes(p.text, 'the source may contain more', 'and what that means for the document');
  A.eq(p.hasCheckbox, true, 'and an acknowledgement to tick');
  A.eq(p.disabled, true, 'Add Items is disabled until it is ticked');
  A.includes(p.foot, 'Confirm the partial extraction', 'and the footer says why');

  await page.evaluate(() => wqaAddAll());
  await page.waitForTimeout(600);
  p = await readPartial();
  A.eq(p.items, 0, 'calling Add directly adds nothing either — the rule is not in the button');
  A.eq(p.rows, 3, 'and the rows are still there afterwards');

  await page.click('#wqaPartialAckBox');
  await page.waitForTimeout(500);
  p = await readPartial();
  A.eq(p.ack, true, 'ticking it is a deliberate act, recorded');
  A.eq(p.disabled, false, 'and only then does Add Items become available');
  A.eq(p.foot, '', 'with nothing left to confirm');
  A.eq(p.shown, true, 'the warning stays on screen — acknowledging it does not erase it');

  await page.evaluate(() => wqaAddAll());
  await page.waitForTimeout(1500);
  p = await readPartial();
  A.eq(p.items, 3, 'and the three recovered items reach the quotation');

  /* Unticking it takes the permission back. */
  await page.evaluate(() => { quoteItems.length = 0; });
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d, undefined, { truncated: true }); },
    PARTIAL);
  await page.waitForTimeout(1000);
  await page.evaluate(() => wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '5'); wqaEditPrice(i, 'addCost', '1'); }));
  await page.waitForTimeout(900);
  await page.click('#wqaPartialAckBox');
  await page.waitForTimeout(300);
  await page.click('#wqaPartialAckBox');
  await page.waitForTimeout(300);
  p = await readPartial();
  A.eq(p.ack, false, 'unticking the acknowledgement takes it back');
  A.eq(p.disabled, true, 'and Add Items is disabled again');

  /* A complete extraction is unaffected: no banner, no extra click. */
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, PARTIAL);
  await page.waitForTimeout(1000);
  await page.evaluate(() => wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '5'); wqaEditPrice(i, 'addCost', '1'); }));
  await page.waitForTimeout(900);
  p = await readPartial();
  A.eq(p.truncated, false, 'a complete extraction is not marked partial');
  A.eq(p.shown, false, 'shows no banner');
  A.eq(p.disabled, false, 'and asks for no extra click');

  /* Nor does a plain parse inherit the last analysis\'s warning. */
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d, undefined, { truncated: true }); },
    PARTIAL);
  await page.waitForTimeout(900);
  await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 4pcs', { settle: 800 });
  p = await readPartial();
  A.eq(p.truncated, false, 'a pasted message parsed afterwards is not a partial extraction');
  A.eq(p.shown, false, 'and carries no banner from the analysis before it');

  A.eq((page._dcErrors || []).join(' | '), '', 'and none of it threw');
  await page.close();
  return S;
};
