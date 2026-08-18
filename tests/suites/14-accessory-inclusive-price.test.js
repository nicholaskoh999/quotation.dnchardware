/* ── Accessories are inside the price the customer is quoted ────────────────
   Stage 0B. This suite replaces the one that protected the opposite rule.

   Under the previous rule an accessory was its own component and its own
   charge: a rod was quoted at RM5.76 and its two nuts at RM2.00 beside it, on
   their own printed row and with their own figure in the WhatsApp message. That
   rule was accepted, and it is now superseded — deliberately, by Nicholas, and
   declared by name in ROUND-SCOPE before a byte moved.

   The rule this suite protects: ONE price reaches the customer, and everything
   bolted to the item is inside it. RM5.76 of rod with RM2.00 of nuts is quoted
   at RM7.76.

   Two things must hold at once, and every assertion here checks both halves:

     · the customer sees ONE inclusive figure, and it reconciles everywhere —
       card, message, printed row, line total;
     · the BREAKDOWN survives. The bolt component and the accessory component
       are both recorded, both visible as internal detail, and Previous Price
       still compares a bolt against a bolt. A rule that folded the accessories
       in and lost the bolt would break history for every future quotation.

   The money must not move either. Two nuts at RM1.00 are RM2.00 before and
   after; only where that RM2.00 is *presented* has changed.                 */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const MSG = 'MS SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 10pcs';

/* Nicholas's own case, and the numbers it must produce.
   MS UNDERSIZE SAG ROD HDG · M12 x L1000 x TL100/100
   weight 0.6927443kg × RM6.50 + RM0.30, +20%  →  RM5.76 of rod
   two HDG nuts at RM1.00                      →  RM2.00 of accessories
                                               →  RM7.76 FINAL UNIT PRICE   */
const NICK = { costRate: '6.50', addCost: '0.30', markup: '20',
               bolt: 5.76, acc: 2.00, final: 7.76, qty: 10, total: 77.60 };

/* Drive the Sag Rod form to Nicholas's specification, then apply whichever
   accessories the case under test wants. Returns the calculator state and what
   the screen is showing for it — the two have to agree. */
const CALC = accessories => `(() => {
  quoteItems.length = 0;
  switchType('sagrod');
  productEntryTouchedFields.clear();
  resetAccPanel('sagrod');
  document.getElementById('sagrod-material').value = 'MS';
  document.getElementById('sagrod-sizeType').value = 'UNDERSIZE';
  setFinishValue('sagrod', 'HDG');
  document.getElementById('sagrod-size').value = 'M12'; onSizeCommit('sagrod');
  document.getElementById('sagrod-length').value = '1000';
  document.getElementById('sagrod-threadLen').value = '100/100';
  document.getElementById('sagrod-qty').value = '${NICK.qty}';
  document.getElementById('sagrod-costRate').value = '${NICK.costRate}';
  document.getElementById('sagrod-addCost').value = '${NICK.addCost}';
  document.getElementById('sagrod-markup').value = '${NICK.markup}';
  calcSagRod();
  ${accessories}
  const st = priceCalcState.sagrod || {};
  const note = document.getElementById('cpLine');
  return {
    bolt: st.boltUnitPrice, acc: st.accessoriesCost,
    final: st.finalUnitPrice, line: st.lineUnitPrice,
    shownFinal: document.getElementById('cpFinal').textContent,
    shownAcc:   document.getElementById('cpAcc').textContent,
    shownNote:  note.textContent,
    noteHidden: !!note.hidden,
    noteDisplay: getComputedStyle(note).display,
    headline:   document.querySelector('.cp-final label').textContent,
  };
})()`;

const NUT    = `document.getElementById('sagrod-nutEnabled').checked = true; onAccChange('sagrod');
                document.getElementById('sagrod-nutQty').value = '2';
                document.getElementById('sagrod-nutPrice').value = '1.00';
                document.getElementById('sagrod-nutFinish').value = 'HDG';
                onAccChange('sagrod');`;
const FW     = `document.getElementById('sagrod-fwEnabled').checked = true; onAccChange('sagrod');
                document.getElementById('sagrod-fwQty').value = '4';
                document.getElementById('sagrod-fwPrice').value = '0.25';
                onAccChange('sagrod');`;
const CUSTOM = `document.getElementById('sagrod-customEnabled').checked = true; onAccChange('sagrod');
                document.getElementById('sagrod-customText').value = 'coupler';
                document.getElementById('sagrod-customPrice').value = '0.50';
                onAccChange('sagrod');`;

module.exports = async (browser, A) => {
  const S = A.suite('accessories — included in the final unit price, breakdown preserved');
  const page = await openApp(browser);

  // ══ 1 · the calculator, one accessory kind at a time ══════════════════════
  /* The rod on its own is the control. Every case below adds accessories to
     THIS rod, so any movement in the final price is the accessories and
     nothing else. */
  const bare = await page.evaluate(CALC(''));
  A.near(bare.bolt, NICK.bolt, 0.0001, 'the rod alone is RM5.76 — weight × rate + surcharge, marked up and rounded');
  A.near(bare.final, NICK.bolt, 0.0001, 'and with nothing bolted to it the Final Unit Price is the same RM5.76');
  A.near(bare.acc, 0, 0.0001, 'there are no accessories');
  A.includes(bare.shownFinal, '5.76', 'the headline shows RM5.76');
  A.eq(bare.headline, 'Final Unit Price', 'and calls it the Final Unit Price, not the bolt price');
  A.eq(bare.noteHidden, true, 'with no "includes accessories" line, because there is nothing to include');
  A.eq(bare.noteDisplay, 'none',
    'hidden means hidden: the note lives inside a card whose own span rules are larger and greener');

  const nut = await page.evaluate(CALC(NUT));
  A.near(nut.acc, 2.00, 0.0001, 'two HDG nuts at RM1.00 are RM2.00');
  A.near(nut.final, NICK.final, 0.0001, 'so the Final Unit Price is RM7.76 — the nuts are inside it');
  A.near(nut.bolt, NICK.bolt, 0.0001, 'and the rod component is still RM5.76, kept for history and for staff');
  A.near(nut.line, NICK.final, 0.0001, 'the line unit price is the same inclusive figure');
  A.includes(nut.shownFinal, '7.76', 'the headline shows RM7.76');
  A.eq(nut.noteHidden, false, 'and the breakdown line appears');
  A.eq(nut.shownNote, 'Includes accessories: RM 2.00', 'saying what of that RM7.76 is accessories');
  A.includes(nut.shownAcc, '2.00', 'the Accessories card still shows the charge on its own, for internal reading');

  const fw = await page.evaluate(CALC(FW));
  A.near(fw.acc, 1.00, 0.0001, 'four flat washers at RM0.25 are RM1.00');
  A.near(fw.final, 6.76, 0.0001, 'FW-only follows the same rule: RM5.76 + RM1.00 = RM6.76');
  A.near(fw.bolt, NICK.bolt, 0.0001, 'the rod component is untouched by what is packed beside it');
  A.eq(fw.shownNote, 'Includes accessories: RM 1.00', 'and the breakdown names the washers\' share');

  const custom = await page.evaluate(CALC(CUSTOM));
  A.near(custom.acc, 0.50, 0.0001, 'a custom accessory at RM0.50 is RM0.50');
  A.near(custom.final, 6.26, 0.0001, 'Custom-only follows it too: RM5.76 + RM0.50 = RM6.26');
  A.near(custom.bolt, NICK.bolt, 0.0001, 'with the rod component still RM5.76');

  const all = await page.evaluate(CALC(NUT + FW + CUSTOM));
  A.near(all.acc, 3.50, 0.0001, 'nut, washer and custom together are RM2.00 + RM1.00 + RM0.50 = RM3.50');
  A.near(all.final, 9.26, 0.0001, 'and the Final Unit Price is their combined total added once: RM9.26');
  A.near(all.bolt, NICK.bolt, 0.0001, 'the rod is still RM5.76 underneath all three');
  A.eq(all.shownNote, 'Includes accessories: RM 3.50', 'the breakdown carries the combined figure');

  /* The rule reads the same in 中文, from the same key. */
  const zh = await page.evaluate(() => {
    dcSetLang('zh');
    const note = document.getElementById('cpLine').textContent;
    const label = document.querySelector('.cp-final label').textContent;
    dcSetLang('en');
    return { note, label };
  });
  A.eq(zh.note, '已含配件：RM 3.50', 'and in 中文 it is 已含配件, from the same translation key');
  A.eq(zh.label, '最终单价', 'under a 最终单价 headline');

  // ══ 2 · the item a normal product entry produces ══════════════════════════
  const item = await page.evaluate(() => {
    addSagRod();
    const it = quoteItems[0] || {};
    return { bolt: it.boltUnitPrice, acc: it.accessoryUnitPrice, final: it.finalUnitPrice,
             line: it.lineUnitPrice, accTotal: it.accessoryTotal, total: it.totalAmount,
             qty: it.qty, model: it.pricingModel, weight: it.weight,
             card: (document.querySelector('.qi-item') || {}).textContent || '' };
  });
  A.eq(item.model, 'accessory-inclusive', 'the saved item records the pricing model that produced it');
  A.near(item.final, 9.26, 0.0001, 'finalUnitPrice is the CUSTOMER-FACING inclusive price');
  A.near(item.bolt, NICK.bolt, 0.0001, 'boltUnitPrice preserves the internal rod component');
  A.near(item.acc, 3.50, 0.0001, 'accessoryUnitPrice preserves the per-item accessory total');
  A.near(item.line, 9.26, 0.0001, 'lineUnitPrice is the same inclusive figure — a compatibility alias, not a second price');
  A.eq(item.qty, '10', 'ten of them');
  A.near(item.accTotal, 35, 0.0001, 'accessoryTotal is RM3.50 across the ten');
  A.near(item.total, 92.60, 0.0001, 'and totalAmount is finalUnitPrice × Qty — RM9.26 × 10');
  A.near(item.total, Number(item.final) * Number(item.qty), 0.005,
    'stated as the arithmetic itself, so the two cannot drift apart');
  A.includes(item.card, 'Unit', 'the item card labels the headline figure Unit, not Bolt');
  A.includes(item.card, 'RM 9.26', 'and shows the inclusive price there');
  A.includes(item.card, 'Bolt', 'with the internal breakdown beside it');
  A.includes(item.card, 'RM 5.76', 'naming the rod component');
  A.includes(item.card, 'Accessories', 'and the accessory component');
  A.includes(item.card, 'RM 3.50', 'so nothing about the makeup of the price is hidden from staff');

  // ══ 3 · Nicholas's case exactly, end to end ═══════════════════════════════
  /* Two nuts and nothing else, which is the case the rule was written from. */
  const nickCalc = await page.evaluate(CALC(NUT));
  A.near(nickCalc.final, NICK.final, 0.0001, 'MS UNDERSIZE SAG ROD HDG M12 x L1000 x TL100/100 quotes at RM7.76');
  const nick = await page.evaluate(() => {
    addSagRod();
    const it = quoteItems[0] || {};
    return { final: it.finalUnitPrice, bolt: it.boltUnitPrice, acc: it.accessoryUnitPrice,
             total: it.totalAmount, qty: it.qty, desc: it.desc, size: it.size,
             wa: buildWAItemsText('-'), dim: getPrintItemDimension(it) };
  });
  A.eq(nick.desc, 'MS UNDERSIZE SAG ROD', 'the item is the one Nicholas described');
  A.eq(nick.size, 'M12 x L 1000 x TL 100/100mm', 'at the size he described');
  A.near(nick.final, NICK.final, 0.0001, 'RM7.76 final unit price');
  A.near(nick.bolt, NICK.bolt, 0.0001, 'RM5.76 rod component');
  A.near(nick.acc, NICK.acc, 0.0001, 'RM2.00 of nuts');
  A.near(nick.total, NICK.total, 0.0001, 'RM77.60 for ten');

  // ══ 4 · what the customer receives ════════════════════════════════════════
  A.includes(nick.wa, 'M12 x L 1000 x TL 100/100mm - RM7.76',
    'the message quotes the inclusive price against the item');
  A.includes(nick.wa, 'cw 2nut', 'and names the nuts as part of what is included');
  A.excludes(nick.wa, 'cw 2nut - RM',
    'with NO second RM figure beside them — that was the superseded rule, and it read as a separate charge');
  A.excludes(nick.wa, 'RM5.76', 'the rod-only figure never reaches the customer');
  A.excludes(nick.wa, 'RM2.00', 'and neither does a standalone accessory price');
  A.includes(nick.dim, 'cw 2nut', 'the print sheet names them in the item\'s own description');

  const printed = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    const rows = Array.from(document.querySelectorAll('#printItemsBody tr'))
      .map(tr => Array.from(tr.children).map(td => td.textContent.trim()));
    const grand = document.getElementById('printGrandTotal').textContent;
    window.dispatchEvent(new Event('afterprint'));
    return { rows, grand };
  });
  A.eq(printed.rows.length, 1, 'ONE priced row for the item — the separate accessory row is gone');
  A.eq(printed.rows[0][3], '10', 'for ten pieces');
  A.eq(printed.rows[0][4], 'RM 7.76', 'Unit Price is the inclusive Final Unit Price');
  A.eq(printed.rows[0][5], 'RM 77.60', 'and Amount is that price times the quantity');
  A.includes(printed.rows[0][2], 'cw 2nut',
    'the accessories are plain wording in the description, not a charge of their own');
  A.excludes(printed.rows[0][2], 'RM', 'with no money in that cell at all');
  const pUnit = Number(printed.rows[0][4].replace(/[^\d.]/g, ''));
  const pAmt = Number(printed.rows[0][5].replace(/[^\d.]/g, ''));
  A.near(pAmt, pUnit * 10, 0.005, 'Qty × Unit Price reconciles exactly on the row a customer reads');
  A.eq(printed.grand, 'RM 77.60', 'and the quotation total is the sum of those inclusive rows');

  // ══ 5 · Manual Price is the CUSTOMER'S price ══════════════════════════════
  /* RM10 typed with RM2 of nuts quotes RM10, not RM12. The nuts come out of the
     typed figure to leave the rod component, because RM10 is what the person
     writing it meant the customer to pay. */
  const manual = await page.evaluate(() => {
    quoteItems.length = 0;
    switchType('sagrod');
    productEntryTouchedFields.clear();
    resetAccPanel('sagrod');
    document.getElementById('sagrod-material').value = 'MS';
    document.getElementById('sagrod-sizeType').value = 'UNDERSIZE';
    setFinishValue('sagrod', 'HDG');
    document.getElementById('sagrod-size').value = 'M12'; onSizeCommit('sagrod');
    document.getElementById('sagrod-length').value = '1000';
    document.getElementById('sagrod-threadLen').value = '100/100';
    document.getElementById('sagrod-qty').value = '10';
    document.getElementById('sagrod-costRate').value = '6.50';
    document.getElementById('sagrod-addCost').value = '0.30';
    document.getElementById('sagrod-markup').value = '20';
    document.getElementById('sagrod-priceMode').value = 'manual';
    onPriceModeChange('sagrod');
    document.getElementById('sagrod-manualUnitPrice').value = '10';
    document.getElementById('sagrod-nutEnabled').checked = true; onAccChange('sagrod');
    document.getElementById('sagrod-nutQty').value = '2';
    document.getElementById('sagrod-nutPrice').value = '1.00';
    onAccChange('sagrod');
    const st = priceCalcState.sagrod || {};
    const shown = { final: document.getElementById('cpFinal').textContent,
                    note: document.getElementById('cpLine').textContent };
    addSagRod();
    const it = quoteItems[0] || {};
    return { st: { bolt: st.boltUnitPrice, acc: st.accessoriesCost, final: st.finalUnitPrice },
             shown, item: { bolt: it.boltUnitPrice, acc: it.accessoryUnitPrice,
                            final: it.finalUnitPrice, total: it.totalAmount, qty: it.qty } };
  });
  A.near(manual.st.final, 10, 0.0001, 'a Manual Price of RM10 with RM2 of nuts quotes RM10 — the typed figure IS the final price');
  A.near(manual.st.acc, 2, 0.0001, 'the accessory breakdown still says RM2.00');
  A.near(manual.st.bolt, 8, 0.0001, 'so the internal rod component is RM8.00 — the nuts came out of the ten, not on top of it');
  A.includes(manual.shown.final, '10.00', 'the headline reads RM10.00');
  A.eq(manual.shown.note, 'Includes accessories: RM 2.00', 'with the breakdown under it');
  A.near(manual.item.final, 10, 0.0001, 'the saved item keeps RM10.00 as the customer price');
  A.near(manual.item.bolt, 8, 0.0001, 'and RM8.00 as its rod component');
  A.near(manual.item.total, 100, 0.0001, 'RM10.00 × 10 = RM100.00, and not RM120.00');

  // ══ 6 · Quick Add reaches the same answer ═════════════════════════════════
  let payload = null;
  const saving = await openApp(browser, {
    api: { save_quotation: (u, r) => { try { payload = JSON.parse(r.postData() || 'null'); } catch (e) {} return { ok: true, id: 7 }; } },
  });
  await quickAddPaste(saving, MSG, { settle: 900 });
  await saving.evaluate(() => {
    wqaEditPrice(0, 'costRate', '5'); wqaEditPrice(0, 'addCost', '1');
    wqaEditAcc(0, 'nut', 'enabled', true);
    wqaEditAcc(0, 'nut', 'qty', 2);
    wqaEditAcc(0, 'nut', 'unitPrice', 0.3);
  });
  await saving.waitForTimeout(900);
  const row = (await rowState(saving))[0];
  A.ok(Number(row.price) > 0, 'the Quick Add row prices the item');

  const bareRow = await saving.evaluate(() => {
    const before = wqa.rows[0].calc.finalUnitPrice;
    wqaEditAcc(0, 'nut', 'enabled', false);
    return { before };
  });
  await saving.waitForTimeout(700);
  const noAccRow = await saving.evaluate(() => wqa.rows[0].calc.finalUnitPrice);
  A.near(Number(bareRow.before) - Number(noAccRow), 0.6, 0.005,
    'the Quick Add row\'s price carries its accessories inside it — taking the nuts off drops it by exactly their RM0.60');
  await saving.evaluate(() => wqaEditAcc(0, 'nut', 'enabled', true));
  await saving.waitForTimeout(700);

  await saving.evaluate(() => wqaAddAll());
  await saving.waitForTimeout(1200);
  const committed = await saving.evaluate(async () => {
    const it = quoteItems[0] || {};
    await api('save_quotation', { ref_no: 'DC-TEST-001', quote_date: '2026-08-01',
      customer_name: 'ADVANCE', items: quoteItems,
      total_amount: quoteItems.reduce((s, i) => s + i.totalAmount, 0) }, 'POST');
    return { bolt: it.boltUnitPrice, acc: it.accessoryUnitPrice, final: it.finalUnitPrice,
             line: it.lineUnitPrice, total: it.totalAmount, qty: it.qty, model: it.pricingModel };
  });
  A.eq(committed.model, 'accessory-inclusive', 'a Quick Add row commits under the same pricing model as the form');
  A.eq(committed.acc, '0.6', 'carrying its accessory total as its own recorded figure');
  A.near(Number(committed.final) - Number(committed.bolt), 0.6, 0.005,
    'the difference between the customer price and the rod component IS the accessories');
  A.near(committed.total, Number(committed.final) * Number(committed.qty), 0.005,
    'and the line total is the inclusive price times the quantity');

  // ══ 7 · save, reopen, and reopen again ════════════════════════════════════
  const reopened = await openApp(browser, {
    handoff: { id: 7, ref_no: 'DC-TEST-001', customer_name: 'ADVANCE', items: payload.items },
  });
  const back = await reopened.evaluate(() => {
    const it = quoteItems[0] || {};
    return { bolt: it.boltUnitPrice, acc: it.accessoryUnitPrice, final: it.finalUnitPrice,
             line: it.lineUnitPrice, total: it.totalAmount, model: it.pricingModel,
             wa: buildWAItemsText('-') };
  });
  A.eq(back.final, committed.final, 'reopening the saved quotation returns the same customer price');
  A.eq(back.bolt, committed.bolt, 'the same rod component');
  A.eq(back.acc, committed.acc, 'the same accessory breakdown');
  A.eq(back.total, committed.total, 'and the same line total — nothing drifts across the round trip');
  A.eq(back.model, 'accessory-inclusive', 'still recorded under the inclusive model');
  A.excludes(back.wa, ' - RM0.60', 'and its message still carries no separate accessory charge');
  await reopened.close();
  await saving.close();

  // ══ 8 · an item saved under the SUPERSEDED bolt-separate rule ═════════════
  /* Its finalUnitPrice was the ROD and its lineUnitPrice was the customer's
     price. RM30.00 + RM0.70 of nuts, ten of them, RM307.00 — that is the money
     the customer agreed to, and it is the money that must come back. */
  const SEPARATE = {
    itemType: 'sagrod', desc: 'MS FULLSIZE SAG ROD', productType: 'SAG ROD',
    material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M20', sizeCode: 'M20',
    size: 'M20 x L 1000 x TL 100/100mm', dimensionPreview: 'L 1000 x TL 100/100mm',
    qty: 10, markup: 0, weight: 2.4662,
    finalUnitPrice: 30.00, accessoryUnitPrice: 0.70, lineUnitPrice: 30.70,
    accessoryTotal: 7.00, totalAmount: 307.00, pricingModel: 'bolt-separate',
    priceMode: 'manual', manualUnitPrice: '30.00',
    accessories: { nut: { enabled: true, qty: 2, finish: 'PL', unitPrice: 0.3 },
                   fw: { enabled: true, qty: 1, finish: 'PL', unitPrice: 0.1 },
                   custom: { enabled: false, text: '', unitPrice: 0 } },
    formData: { costRate: '5.00', addCost: '1.00', markup: '0', priceMode: 'manual',
                manualUnitPrice: '30.00', qty: '10', size: 'M20', length: '1000', threadLen: '100/100' },
  };

  const sep = await openApp(browser, {
    handoff: { id: 9, ref_no: 'DC-OLD-001', customer_name: 'ADVANCE', items: [SEPARATE] },
  });
  const migrated = await sep.evaluate(() => {
    const it = quoteItems[0] || {};
    return { bolt: it.boltUnitPrice, acc: it.accessoryUnitPrice, final: it.finalUnitPrice,
             line: it.lineUnitPrice, total: it.totalAmount, model: it.pricingModel,
             manual: it.manualUnitPrice, formManual: (it.formData || {}).manualUnitPrice,
             wa: buildWAItemsText('-'),
             card: (document.querySelector('.qi-item') || {}).textContent || '' };
  });
  A.eq(migrated.total, '307', 'a bolt-separate quotation reopens on the SAME customer total it was sent with');
  A.near(migrated.final, 30.70, 0.0001, 'its unit price now reads as the RM30.70 the customer was actually charged');
  A.near(migrated.bolt, 30.00, 0.0001, 'with the RM30.00 rod component kept, not lost');
  A.near(migrated.acc, 0.70, 0.0001, 'and the RM0.70 of accessories kept as the breakdown');
  A.eq(migrated.model, 'accessory-inclusive', 'read into the current model on the way in, once');
  A.eq(migrated.manual, '30.70',
    'its typed Manual Price is folded up too: RM30.00 meant the rod then, and RM30.70 means the customer now');
  A.eq(migrated.formManual, '30.70', 'in the saved form data as well, so editing it starts from the right figure');
  A.includes(migrated.card, 'RM 30.70', 'the card shows the inclusive price');
  A.includes(migrated.card, 'RM 30.00', 'and the rod component under it');
  A.includes(migrated.wa, '- RM30.70', 'the message quotes RM30.70');
  A.excludes(migrated.wa, '- RM0.70', 'and never the accessory charge on its own');

  /* Editing and re-saving it must not charge the nuts a second time. */
  const resaved = await sep.evaluate(() => {
    unlockSavedQuotation();
    editItem(0);
    const box = document.getElementById('sagrod-manualUnitPrice');
    const boxValue = box ? box.value : '';
    addSagRod();
    const it = quoteItems[0] || {};
    return { boxValue, count: quoteItems.length, bolt: it.boltUnitPrice,
             acc: it.accessoryUnitPrice, final: it.finalUnitPrice, total: it.totalAmount,
             model: it.pricingModel };
  });
  A.eq(resaved.boxValue, '30.70', 'the Manual Price box opens on the customer\'s figure, RM30.70');
  A.eq(resaved.count, '1', 'saving the edit replaces the item rather than adding a second');
  A.eq(resaved.final, '30.7', 'and re-saving quotes RM30.70 — the accessories are NOT charged twice');
  A.eq(resaved.acc, '0.7', 'the accessory breakdown is still RM0.70');
  A.eq(resaved.bolt, '30', 'the rod component is still RM30.00');
  A.eq(resaved.total, '307', 'and the customer\'s line total is exactly what it was — RM307.00');
  A.eq(resaved.model, 'accessory-inclusive', 'now recorded under the current model');
  await sep.close();

  // ══ 9 · a legacy item, saved before any separation existed ════════════════
  /* One figure, with the accessory charge already inside it — which is what
     this rule now asks for, so it is already right and nothing is invented for
     it. Its accessory share stays unknowable, and the code says so by reporting
     no breakdown rather than by guessing one. */
  const legacy = await page.evaluate(() => {
    quoteItems.length = 0;
    quoteItems.push({
      itemType: 'sagrod', desc: 'MS FULLSIZE SAG ROD', productType: 'SAG ROD',
      material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M20', sizeCode: 'M20',
      size: 'M20 x L 1000 x TL 100/100mm', dimensionPreview: 'L 1000 x TL 100/100mm',
      qty: 10, finalUnitPrice: 30.70, totalAmount: 307.00, markup: 0, weight: 2.4662,
      priceMode: 'manual', manualUnitPrice: '30.70',
      accessories: { nut: { enabled: true, qty: 2, finish: 'PL', unitPrice: 0.3 },
                     fw: { enabled: true, qty: 1, finish: 'PL', unitPrice: 0.1 },
                     custom: { enabled: false, text: '', unitPrice: 0 } },
      formData: { costRate: '5.00', addCost: '1.00', markup: '0', priceMode: 'manual',
                  manualUnitPrice: '30.70', qty: '10', size: 'M20', length: '1000', threadLen: '100/100' },
    });
    renderQuote();
    const it = quoteItems[0];
    return { unit: dcItemFinalUnit(it), acc: dcItemAccUnit(it), bolt: dcItemBoltUnit(it),
             total: it.totalAmount, wa: buildWAItemsText('-') };
  });
  A.near(legacy.unit, 30.70, 0.0001, 'a legacy item\'s one figure IS the customer price, and is read as written');
  A.eq(legacy.total, '307', 'its line total is unchanged');
  A.near(legacy.acc, 0, 0.0001,
    'no accessory breakdown is invented for it — what it folded in cannot be told apart from what it folded into');
  A.near(legacy.bolt, 30.70, 0.0001, 'so its only component figure is the one it has');
  A.includes(legacy.wa, '- RM30.70', 'and it quotes at RM30.70, exactly as it always did');

  const legacyResaved = await page.evaluate(() => {
    editItem(0);
    const box = document.getElementById('sagrod-manualUnitPrice');
    const boxValue = box ? box.value : '';
    addSagRod();
    const it = quoteItems[0] || {};
    return { boxValue, final: it.finalUnitPrice, acc: it.accessoryUnitPrice,
             bolt: it.boltUnitPrice, total: it.totalAmount, count: quoteItems.length };
  });
  A.eq(legacyResaved.boxValue, '30.70',
    'editing it leaves its manual price alone — under this rule RM30.70 already means what the customer pays');
  A.eq(legacyResaved.count, '1', 'and replaces the item rather than adding a second');
  A.eq(legacyResaved.final, '30.7', 're-saving quotes the same RM30.70');
  A.eq(legacyResaved.total, '307', 'for the same RM307.00 line total — no drift');
  A.eq(legacyResaved.acc, '0.7', 'and it gains a real breakdown, because the accessories beside it are now readable');
  A.eq(legacyResaved.bolt, '30', 'with the rod component at RM30.00');

  // ══ 10 · History / Previous Price still sees the ROD ══════════════════════
  /* The whole point of keeping the breakdown. A record's boltUnitPrice is the
     rod's own price under every model, and reusing a record must put the ROD's
     price back on the row — never the inclusive one, which would grow by the
     accessories every time it were reused.

     Driven through the real button in the real panel, on a real Quick Add row,
     because that is the only way to prove the whole path rather than one
     function inside it. */
  const HIST = {
    quotationId: 1, refNo: 'Q-2026-0500', date: '2026-05-01',
    customer: 'ADVANCE', companyId: 7, own: true,
    productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL',
    cleanSize: 'M20', dimensionPreview: 'L 1000 x TL 100/100mm', exactDims: true,
    dimDistance: 0, qty: 10,
    /* An inclusive record as pricing_history.php now reports one: the customer
       paid RM30.70, of which RM30.00 was the rod. */
    unitPrice: 30.70, lineUnitPrice: 30.70, boltUnitPrice: 30.00,
    accessoryCost: 0.70, accessorySummary: '2 Nut PL', accessoryAmbiguous: false,
    priceMode: 'manual', priceModeLabel: 'Manual',
    costRate: null, addCost: null, markup: null, weight: 2.4662, legacy: false,
    finishMatch: true,
  };
  const serveHist = { get_pricing_history: () => ({ ok: true, data: {
    records: [HIST], total: 1, ownTotal: 1, otherTotal: 0, offset: 0, limit: 20 } }) };
  const useRecord = async (pg) => {
    await pg.evaluate(() => { if (!wqa.rows[0].histOpen) wqaHistToggle(0); });
    await pg.waitForTimeout(900);
    const clicked = await pg.evaluate(() => {
      const btn = document.querySelector('[data-wqa-row="0"] .ph-rec .ph-rec-use');
      if (!btn) return false;
      btn.click();
      return true;
    });
    await pg.waitForTimeout(1100);
    return clicked;
  };

  /* (a) a row with no accessories — the common case, and it must be exactly
         what it was before this round: the record's rod price, verbatim. */
  const hp = await openApp(browser, { api: serveHist });
  await hp.evaluate(() => { selectedCompanyId = 7; });
  await quickAddPaste(hp, MSG, { expanded: false, settle: 900 });
  const shownCard = await hp.evaluate(async () => {
    if (!wqa.rows[0].histOpen) wqaHistToggle(0);
    await new Promise(r => setTimeout(r, 900));
    const card = document.querySelector('[data-wqa-row="0"] .ph-rec');
    return card ? card.textContent.replace(/\s+/g, ' ').trim() : '';
  });
  A.includes(shownCard, '30.00', 'the history card names the record\'s ROD price');
  A.includes(shownCard, '30.70', 'and says what the customer\'s line came to');

  A.eq(await useRecord(hp), 'true', 'the record offers a Use button, so it is a reusable recipe');
  const plain = await hp.evaluate(() => ({
    mode: wqa.rows[0].priceMode, manual: String(wqa.rows[0].manualPrice || ''),
    price: wqa.rows[0].calc ? wqa.rows[0].calc.finalUnitPrice : null,
  }));
  A.eq(plain.mode, 'manual', 'reusing a hand-priced record sets the row to Manual Price');
  A.eq(plain.manual, '30', 'at the record\'s RM30.00 rod price — unchanged from before this round');
  A.near(plain.price, 30, 0.005, 'so the row quotes RM30.00, with nothing bolted to it to include');

  /* (b) the same record, on a row that HAS accessories. The rod component must
         still come out at the record's RM30.00 — the accessories are the new
         row's own, and they go inside the customer's figure as always. */
  await hp.evaluate(() => {
    wqaEditAcc(0, 'nut', 'enabled', true);
    wqaEditAcc(0, 'nut', 'qty', 2);
    wqaEditAcc(0, 'nut', 'unitPrice', 0.35);
  });
  await hp.waitForTimeout(900);
  A.eq(await useRecord(hp), 'true', 'the record can be reused onto that row too');
  const withAcc = await hp.evaluate(() => ({
    manual: String(wqa.rows[0].manualPrice || ''),
    price: wqa.rows[0].calc ? wqa.rows[0].calc.finalUnitPrice : null,
  }));
  A.eq(withAcc.manual, '30.7',
    'the typed figure becomes RM30.70 — the record\'s rod price plus THIS row\'s RM0.70 of nuts');
  A.near(withAcc.price, 30.7, 0.005, 'so the customer sees RM30.70');
  A.near(Number(withAcc.price) - 0.7, 30, 0.005,
    'and the rod component underneath is the record\'s RM30.00 exactly — a reused price does not grow by its accessories');

  await hp.evaluate(() => wqaAddAll());
  await hp.waitForTimeout(1400);
  const histItem = await hp.evaluate(() => {
    const it = quoteItems[0] || {};
    return { bolt: it.boltUnitPrice, acc: it.accessoryUnitPrice, final: it.finalUnitPrice };
  });
  A.near(histItem.final, 30.7, 0.005, 'and the item it commits carries RM30.70 as the customer price');
  A.near(histItem.bolt, 30, 0.005, 'with RM30.00 recorded as the rod component');
  A.near(histItem.acc, 0.7, 0.005, 'and RM0.70 as its accessories — the breakdown history will read next time');
  await hp.close();

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
