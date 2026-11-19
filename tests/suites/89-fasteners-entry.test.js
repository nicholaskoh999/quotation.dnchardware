/* ── Accessories / Fasteners: standalone line items, 4-decimal unit price ──
   Owner request 2026-11-19 (decisions D1–D5 and the precision rule).

     · A nut or washer is quoted as its OWN line (HEX NUT, HT HEX NUT, FLAT
       WASHER, SPRING WASHER, F436 WASHER, OTHERS / CUSTOM), priced per piece
       from an RM/PCS or RM/KG purchase cost.
     · Its unit SELLING price keeps 4 decimals (RM0.0350); the line total is
       unit x qty rounded once to 2 decimals (RM0.0350 x 1000 = RM35.00).
     · No Round is the default (D1); Auto Round never turns a positive price
       into RM0.00.
     · SS304 / SS316 default to N/A but may carry a finish, for fasteners only
       (D2); every other product keeps the stainless rule.
     · Bulk Edit Pricing leaves fastener items exactly as they are.
     · Every other product keeps its 2-decimal behaviour.

   Everything runs through the real entry form, the real add path, the real
   save payload and a fresh page reopened from it.                           */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');

/* Fill the fastener form the way the inputs would, then calculate. */
const FILL = o => `(() => {
  switchType('fastener');
  const v = (id, x) => { const e = document.getElementById('fastener-' + id); e.value = x; };
  v('fastenerType', ${JSON.stringify(o.type || 'HEX NUT')});
  v('customName', ${JSON.stringify(o.customName || '')});
  v('material', ${JSON.stringify(o.material || '')});
  v('materialOther', ${JSON.stringify(o.materialOther || '')});
  onFastenerUiSync();
  ${o.finish !== undefined ? `setFinishValue('fastener', ${JSON.stringify(o.finish)});` : ''}
  v('sizeText', ${JSON.stringify(o.size || 'M20')});
  v('costBasis', ${JSON.stringify(o.basis || 'PCS')});
  v('purchaseCost', ${JSON.stringify(o.cost === undefined ? '0.035' : o.cost)});
  v('pcsPerKg', ${JSON.stringify(o.pcsPerKg || '')});
  v('addCost', ${JSON.stringify(o.addCost || '')});
  v('markup', ${JSON.stringify(o.markup || '0')});
  v('qty', ${JSON.stringify(String(o.qty || 1000))});
  document.getElementById('fastener-priceMode').value = ${JSON.stringify(o.mode || 'no_round')};
  document.getElementById('fastener-manualUnitPrice').value = ${JSON.stringify(o.manual || '')};
  onFastenerUiSync();
  onPriceModeChange('fastener');
  calcFastener();
})()`;

module.exports = async (browser, A) => {
  A.suite('fasteners — standalone Accessories / Fasteners line items');
  let payload = null;
  const histUrls = [];
  const page = await openApp(browser, {
    api: {
      save_quotation: (url, req) => {
        try { payload = JSON.parse(req.postData() || 'null'); } catch (e) { payload = null; }
        return { ok: true, id: 77, ref_no: 'DC-TEST-077' };
      },
      get_pricing_history: url => { histUrls.push(url); return { ok: true, data: { records: [], total: 0, ownTotal: 0, otherTotal: 0, offset: 0, limit: 20 } }; },
      get_accessory_history: url => { histUrls.push(url); return { ok: true, data: { records: [
        { type: 'Nut', size: 'M20', finish: 'ZP', unitPrice: 0.5, refNo: 'Q-2026-0101', date: '2026-10-01', customer: 'Alpha' }], total: 1 } }; },
    },
  });

  // ── 1. the product entry exists, and starts on No Round (D1) ─────────────
  const ui = await page.evaluate(() => {
    switchType('fastener');
    return {
      btn: !!document.querySelector('#typePicker .type-btn[data-type="fastener"]'),
      opt: !![...document.getElementById('typeSelect').options].find(o => o.value === 'fastener'),
      types: [...document.getElementById('fastener-fastenerType').options].map(o => o.value),
      mats: [...document.getElementById('fastener-material').options].map(o => o.value),
      mode: document.getElementById('fastener-priceMode').value,
      manualStep: document.getElementById('fastener-manualUnitPrice').step,
      active: document.getElementById('form-fastener').classList.contains('active'),
      label: ITEM_TYPES.fastener,
    };
  });
  A.ok(ui.btn, 'the product picker has an Accessories / Fasteners button');
  A.ok(ui.opt, 'and the phone product select lists it');
  A.ok(ui.active, 'choosing it shows its own form');
  A.eq(ui.types.join('|'), 'HEX NUT|HT HEX NUT|FLAT WASHER|SPRING WASHER|F436 WASHER|OTHERS', 'the six types, HT HEX NUT named as the owner names it');
  A.eq(ui.mats.join('|'), '|MS|S45C|4140_PLAIN|SS304|SS316|OTHER', 'material suggestions plus Others free text (D4)');
  A.eq(ui.mode, 'no_round', 'a new fastener starts on No Round (D1)');
  A.eq(ui.manualStep, '0.0001', 'its Manual Price is typed to 4 decimals');

  // ── 2. RM/PCS: RM0.0350 x 1000 = RM35.00, kept to 4 decimals ─────────────
  const add1 = await page.evaluate(`(() => {${FILL({ type: 'HEX NUT', finish: 'ZP', cost: '0.035', qty: 1000 })};
    const preview = document.getElementById('cpFinal').textContent;
    addCurrentItem();
    const it = quoteItems[quoteItems.length - 1];
    return { preview, n: quoteItems.length, it,
      card: document.querySelector('.qi-item .qi-unitval').textContent,
      lineTotal: document.querySelector('.qi-item .qi-total').textContent,
      grand: document.getElementById('quoteTotalAmt').textContent };
  })()`);
  A.eq(add1.preview, 'RM 0.0350', 'the preview shows the 4-decimal unit price');
  A.eq(add1.n, 1, 'the fastener was added');
  A.eq(add1.it.itemType, 'fastener', 'as a fastener item');
  A.eq(add1.it.finalUnitPrice, 0.035, 'unit selling price stored as 0.035 — not rounded to 0.04');
  A.eq(add1.it.totalAmount, 35, 'line total RM35.00 = 0.0350 x 1000');
  A.eq(add1.it.priceAcceptance.value, 0.035, 'the accepted price is recorded to 4 decimals too');
  A.eq(add1.it.desc, 'HEX NUT', 'description is the product name');
  A.eq(add1.it.productType, 'HEX NUT', 'productType is the fastener type');
  A.eq(add1.it.size, 'M20', 'size');
  A.eq(add1.it.cleanSize, 'M20', 'and the size history looks it up by');
  A.eq(add1.it.finish, 'ZP', 'finish');
  A.eq(add1.it.sellingUnit, 'PCS', 'sold per piece');
  A.eq(add1.it.costBasis, 'PCS', 'purchase basis RM/PCS');
  A.eq(add1.it.purchaseCost, 0.035, 'purchase cost recorded');
  A.eq(add1.it.priceMode, 'no_round', 'priced on No Round');
  A.eq(Object.keys(add1.it.accessories).filter(k => add1.it.accessories[k].enabled).length, 0, 'no C/W accessory on a standalone fastener');
  A.includes(add1.card, 'RM 0.0350', 'the item card shows RM 0.0350');
  A.eq(add1.lineTotal, 'RM 35.00', 'and the line total RM 35.00');
  A.eq(add1.grand, 'RM 35.00', 'quotation total RM 35.00');

  // ── 3. RM/KG with PCS per KG; RM0.1250 ───────────────────────────────────
  const add2 = await page.evaluate(`(() => {${FILL({ type: 'FLAT WASHER', finish: 'ZP', basis: 'KG', cost: '12.50', pcsPerKg: '100', qty: 200 })};
    const shown = getComputedStyle(document.getElementById('fastener-pcsPerKgField')).display;
    const base = document.getElementById('cpBase').textContent;
    addCurrentItem();
    return { shown, base, it: quoteItems[quoteItems.length - 1], n: quoteItems.length };
  })()`);
  A.ok(add2.shown !== 'none', 'PCS per KG is asked for when RM/KG is chosen');
  A.eq(add2.base, 'RM 0.1250', 'cost per piece = 12.50 / 100');
  A.eq(add2.n, 2, 'the washer was added');
  A.eq(add2.it.finalUnitPrice, 0.125, 'unit selling price 0.1250');
  A.eq(add2.it.totalAmount, 25, '0.1250 x 200 = RM25.00');
  A.eq(add2.it.costBasis, 'KG', 'basis RM/KG recorded');
  A.eq(add2.it.pcsPerKg, 100, 'PCS per KG recorded');

  // Additional Cost + Markup, then rounded once to 4 decimals
  const mk = await page.evaluate(`(() => {${FILL({ cost: '0.0331', addCost: '0.002', markup: '25', qty: 3 })};
    return priceCalcState.fastener.finalUnitPrice; })()`);
  A.eq(mk, 0.0439, '(0.0331 + 0.002) x 1.25 = 0.043875 → 0.0439 (4 decimals)');

  // ── 4. Auto Round never makes a positive price RM0.00 (D1) ──────────────
  const az = await page.evaluate(`(() => {${FILL({ cost: '0.03', mode: 'auto', qty: 10 })};
    const warn = getComputedStyle(document.getElementById('fastener-autoZeroWarn')).display;
    const before = quoteItems.length; addCurrentItem();
    return { warn, added: quoteItems.length - before, state: priceCalcState.fastener.finalUnitPrice };
  })()`);
  A.eq(az.state, 0, 'the RM0.10 band rule would make RM0.03 into RM0.00');
  A.ok(az.warn !== 'none', 'the form says so before anyone presses Add');
  A.eq(az.added, 0, 'and the item is refused rather than quoted at RM0.00');
  const ar = await page.evaluate(`(() => {${FILL({ cost: '0.13', mode: 'auto', qty: 10 })};
    addCurrentItem(); const it = quoteItems[quoteItems.length - 1];
    return { u: it.finalUnitPrice, m: it.priceMode }; })()`);
  A.eq(ar.m, 'auto', 'Auto Round is still available');
  A.eq(ar.u, 0.1, 'and uses the existing RM0.10 band rule (0.13 → 0.10)');

  // ── 5. Manual Selling Price to 4 decimals ────────────────────────────────
  const man = await page.evaluate(`(() => {${FILL({ cost: '0.03', mode: 'manual', manual: '0.0355', qty: 1000 })};
    addCurrentItem(); const it = quoteItems[quoteItems.length - 1];
    return { u: it.finalUnitPrice, t: it.totalAmount, m: it.priceMode }; })()`);
  A.eq(man.m, 'manual', 'Manual Price item');
  A.eq(man.u, 0.0355, 'typed 0.0355 is kept exactly');
  A.eq(man.t, 35.5, '0.0355 x 1000 = RM35.50');

  // ── 6. SS304: N/A by default, finish override allowed — fasteners only ──
  const ss = await page.evaluate(`(() => {
    switchType('fastener');
    document.getElementById('fastener-material').value = 'SS304'; onFastenerMaterialChange();
    const afterPick = getFinish('fastener');
    const zpDisabled = document.querySelector('input[name="fastener-finish"][value="ZP"]').disabled;
    ${FILL({ type: 'HT HEX NUT', material: 'SS304', finish: 'ZP', cost: '0.5', qty: 4 })};
    addCurrentItem(); const it = quoteItems[quoteItems.length - 1];
    return { afterPick, zpDisabled, finish: it.finish, desc: it.desc, material: it.material };
  })()`);
  A.eq(ss.afterPick, '', 'choosing SS304 defaults the finish to N/A (D2)');
  A.eq(ss.zpDisabled, false, 'but every finish stays selectable');
  A.eq(ss.finish, 'ZP', 'and an SS304 fastener keeps the finish chosen for it');
  A.eq(ss.desc, 'SS304 HT HEX NUT', 'HT HEX NUT keeps its name, material in front');
  const studSS = await page.evaluate(() => {
    switchType('stud');
    document.getElementById('stud-material').value = 'SS304';
    onMaterialSizeChange('stud', false, 'material');
    return { finish: getFinish('stud'), fn: dcItemFinishFor('stud', 'SS304', 'ZP') };
  });
  A.eq(studSS.finish, '', 'a Stud in SS304 still has no finish');
  A.eq(studSS.fn, '', 'the stainless rule is unchanged for every other product');

  // ── 7. Others / Custom and Others material: no duplicated material ──────
  const cu = await page.evaluate(`(() => {
    ${FILL({ type: 'OTHERS', customName: 'ss304 eye nut', material: 'SS304', finish: '', cost: '1.2', qty: 2 })};
    dcFastenerUpperAll(); addCurrentItem(); const a = quoteItems[quoteItems.length - 1];
    ${FILL({ type: 'HEX NUT', material: 'OTHER', materialOther: 'grade 8', finish: 'HDG', cost: '0.4', qty: 2 })};
    dcFastenerUpperAll(); addCurrentItem(); const b = quoteItems[quoteItems.length - 1];
    return { a: { desc: a.desc, pt: a.productType, ft: a.fastenerType }, b: { desc: b.desc, mat: b.material } };
  })()`);
  A.eq(cu.a.desc, 'SS304 EYE NUT', 'custom name already says SS304 — not printed twice');
  A.eq(cu.a.pt, 'SS304 EYE NUT', 'its productType is the custom name');
  A.eq(cu.a.ft, 'OTHERS', 'recorded as Others / Custom');
  A.eq(cu.b.desc, 'GRADE 8 HEX NUT', 'a typed grade prints in front of the type');
  A.eq(cu.b.mat, 'GRADE 8', 'and is the stored material');

  // ── 8. print sheet and WhatsApp carry the 4-decimal unit price ──────────
  const out = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    const row = document.querySelector('#printItemsBody tr');
    const cells = [...row.querySelectorAll('td')].map(td => td.textContent.trim());
    return { cells, grand: document.getElementById('printGrandTotal').textContent, wa: buildWAItemsText() };
  });
  A.eq(out.cells[1], 'HEX NUT (ZP)', 'printed description');
  A.eq(out.cells[2], 'M20', 'printed size');
  A.eq(out.cells[3], '1000', 'printed qty');
  A.eq(out.cells[4], 'RM 0.0350', 'printed unit price keeps 4 decimals');
  A.eq(out.cells[5], 'RM 35.00', 'printed amount 2 decimals');
  A.includes(out.wa, 'HEX NUT (ZP)', 'WhatsApp groups under the fastener title');
  A.includes(out.wa, 'M20 - RM0.0350', 'WhatsApp quotes RM0.0350');
  A.includes(out.wa, 'RM0.1250', 'and RM0.1250 for the washer');

  // ── 9. save → reopen → edit → duplicate: 4 decimals survive ─────────────
  await page.evaluate(async () => {
    await api('save_quotation', { ref_no: el('qi-refno').value, quote_date: el('qi-date').value,
      customer_name: 'Alpha', customer_phone: '', prepared_by: '', remarks: '', company_id: null,
      items: quoteItems, total_amount: roundMoney2(quoteItems.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0)) }, 'POST');
  });
  A.ok(payload && Array.isArray(payload.items), 'the save payload carried the items');
  A.eq(payload.items[0].finalUnitPrice, 0.035, 'saved unit price 0.035');
  A.eq(payload.items[0].priceAcceptance.value, 0.035, 'saved accepted price 0.035');
  const ssSaved = payload.items.find(i => i.desc === 'SS304 HT HEX NUT');

  const re = await openApp(browser, { handoff: { id: 77, ref_no: 'DC-TEST-077', quote_date: payload.quote_date,
                                                 customer_name: 'Alpha', items: payload.items } });
  const back = await re.evaluate(() => ({
    items: quoteItems.map(i => ({ u: i.finalUnitPrice, t: i.totalAmount, f: i.finish, d: i.desc, it: i.itemType })),
    card: [...document.querySelectorAll('.qi-item')].find(c => c.querySelector('.qi-num').textContent.trim() === '1').querySelector('.qi-unitval').textContent }));
  A.eq(back.items[0].u, 0.035, 'reopened: unit price still 0.035');
  A.eq(back.items[0].t, 35, 'reopened: line total still 35.00');
  A.includes(back.card, 'RM 0.0350', 'reopened card shows RM 0.0350');
  const ssBack = back.items.find(i => i.d === 'SS304 HT HEX NUT');
  A.ok(ssSaved && ssBack && ssBack.f === 'ZP', 'reopened SS304 fastener keeps its ZP finish');

  const ed = await re.evaluate(() => {
    unlockSavedQuotation();
    editItem(0);
    const form = { type: currentType, cost: el('fastener-purchaseCost').value, size: el('fastener-sizeText').value,
                   ft: el('fastener-fastenerType').value, mode: el('fastener-priceMode').value, qty: el('fastener-qty').value };
    el('fastener-qty').value = '2000';
    addCurrentItem();
    const a = quoteItems[0];
    duplicateItem(0);
    const dupForm = el('fastener-purchaseCost').value;
    addCurrentItem();
    const d = quoteItems[1];
    return { form, a: { u: a.finalUnitPrice, t: a.totalAmount, q: a.qty },
             d: { u: d.finalUnitPrice, t: d.totalAmount, uid: d.item_uid, desc: d.desc }, dupForm };
  });
  A.eq(ed.form.type, 'fastener', 'Edit opens the fastener form');
  A.eq(ed.form.cost, '0.035', 'with its purchase cost');
  A.eq(ed.form.size, 'M20', 'its size');
  A.eq(ed.form.ft, 'HEX NUT', 'its type');
  A.eq(ed.form.mode, 'no_round', 'and its price mode');
  A.eq(ed.a.u, 0.035, 'updated qty: unit price unchanged at 0.035');
  A.eq(ed.a.t, 70, '0.0350 x 2000 = RM70.00');
  A.eq(ed.dupForm, '0.035', 'Duplicate opens the copy with the same recipe');
  A.eq(ed.d.u, 0.035, 'the duplicate keeps 0.035');
  A.eq(ed.d.desc, 'HEX NUT', 'and its description');

  // ── 10. Bulk Edit Pricing leaves fasteners untouched ────────────────────
  const bp = await re.evaluate(() => {
    const before = JSON.stringify(quoteItems[0]);
    const r = dcBpReprice(quoteItems[0], { costRate: 9, markup: 50 });
    let toast = '';
    const orig = window.showToast; window.showToast = m => { toast = m; };
    dcBpSel.clear(); dcBpSel.add(0); dcBpOpen();
    window.showToast = orig;
    const open = document.getElementById('bpModal') ? document.getElementById('bpModal').classList.contains('open') : false;
    return { changed: r.changed, repriced: r.repriced, same: JSON.stringify(r.item) === before, note: r.notes.join(' '), toast, open };
  });
  A.eq(bp.repriced, false, 'a fastener is never repriced by Bulk Edit');
  A.ok(bp.same && !bp.changed, 'its 4-decimal price is left exactly as it was');
  A.includes(bp.note, 'not bulk edited', 'the row says why');
  A.includes(bp.toast, 'cannot be bulk edited', 'selecting only fasteners says so instead of opening the editor');
  A.eq(bp.open, false, 'and the editor does not open');

  // ── 11. revision history shows a fastener unit price to 4 decimals ──────
  const hv = await re.evaluate(() => ({ f: dcHistValue('finalUnitPrice', 0.035, 'fastener'),
                                        s: dcHistValue('finalUnitPrice', 7.76, 'sagrod'),
                                        n: dcHistValue('finalUnitPrice', 7.76) }));
  A.eq(hv.f, 'RM 0.0350', 'revision history: fastener unit RM 0.0350');
  A.eq(hv.s, 'RM 7.76', 'other items unchanged');
  A.eq(hv.n, 'RM 7.76', 'and without a type, unchanged');

  // ── 12. Pricing History asks for the fastener identity + selling unit ───
  await page.evaluate(`(() => { ${FILL({ type: 'HEX NUT', finish: 'ZP', cost: '0.035', qty: 10 })}; })()`);
  await page.evaluate(() => checkPreviousPrice());
  await page.waitForTimeout(600);
  const ph = await page.evaluate(() => ({ list: document.getElementById('phList').innerHTML }));
  const q = histUrls.find(u => u.includes('get_pricing_history')) || '';
  const p = new URL(q, 'http://x').searchParams;
  A.eq(p.get('productType'), 'HEX NUT', 'history: product type');
  A.eq(p.get('cleanSize'), 'M20', 'history: size');
  A.eq(p.get('finish'), 'ZP', 'history: finish');
  A.eq(p.get('sellingUnit'), 'PCS', 'history: selling unit');
  A.ok(histUrls.some(u => u.includes('get_accessory_history') && u.includes('type=nut') && u.includes('cleanSize=M20')),
       'C/W nut charges for M20 are looked up as a reference');
  A.includes(ph.list, 'C/W Charge — reference only', 'shown labelled C/W Charge, reference only (D3)');
  A.includes(ph.list, 'RM 0.50', 'with the charge it carried');
  A.ok(!/ph-cw[\s\S]*ph-rec-use/.test(ph.list), 'and no way to apply it');

  // ── 13. legacy products keep 2 decimals ─────────────────────────────────
  const leg = await page.evaluate(() => ({
    sag: dcRoundUnit('sagrod', 0.035), none: dcRoundUnit(undefined, 1.23456),
    lm: dcLineMoney(1.234, null, 10, 'stud').finalUnitPrice, lmNoType: dcLineMoney(1.234, null, 10).finalUnitPrice,
    wa: fmtWAUnitPrice(7.7, 'sagrod'), card: fmtUnit('lbolt', 7.7),
  }));
  A.eq(leg.sag, 0.04, 'Sag Rod unit precision is still 2 decimals');
  A.eq(leg.none, 1.23, 'and with no type at all');
  A.eq(leg.lm, 1.23, 'line money for a Stud stays 2 decimals');
  A.eq(leg.lmNoType, 1.23, 'and for a caller that passes no type');
  A.eq(leg.wa, 'RM7.70', 'WhatsApp price for a bolt unchanged');
  A.eq(leg.card, 'RM 7.70', 'card price for a bolt unchanged');

  // ── 14. Quick Add never maps a nut or washer line to a bolt (V1) ────────
  await quickAddPaste(page, ['4140 QT FULLSIZE L BOLT ZP', 'M20 x 600 x 150 x TL 100 - 10pcs',
                             'M20 HEX NUT (ZP) - 20pcs', 'M20 FLAT WASHER (ZP) - 20pcs'].join('\n'), { settle: 800 });
  const qa = await page.evaluate(() => ({
    rows: wqa.rows.filter(r => !r.removed).map(r => ({ p: r.product, len: r.length, q: r.qty })),
    skipped: wqa.fastenerSkipped.slice(),
    flag: (document.querySelector('#wqaCommon .wqa-flag-fastener') || {}).textContent || '' }));
  A.eq(qa.rows.length, 1, 'Quick Add keeps only the L Bolt row');
  A.eq(qa.rows[0].p + '|' + qa.rows[0].len + '|' + qa.rows[0].q, 'lbolt|600|10', 'the bolt row is read as before');
  A.eq(qa.skipped.length, 2, 'the nut and washer lines are set aside, not turned into L Bolts');
  A.includes(qa.flag, 'Accessories / Fasteners', 'and Review says where to add them');
  const only = await page.evaluate(async () => {
    wqaHardClose(); wqaOpen();
    document.getElementById('wqaInput').value = 'F436 WASHER 3/4 HDG 40pcs';
    await wqaParseAndReview();
    return { msg: document.getElementById('wqaParseMsg').textContent, review: !document.getElementById('wqaStep2').hidden };
  });
  A.includes(only.msg, 'does not read Accessories / Fasteners', 'a washer-only paste is refused with the reason');
  A.eq(only.review, false, 'and no Sag Rod 436 long is invented');
  const acc = await page.evaluate(() => ({
    cw: wqaIsFastenerLine('M20 x 1000 x 100/100 c/w 2 nuts & 2 washers - 10pcs'),
    head: wqaIsFastenerLine('MS SAG ROD c/w 2 HEX NUT'),
    rod: wqaIsFastenerLine('M12 x 1000 2 nuts'),
  }));
  A.eq(acc.cw, false, 'C/W accessory wording on a bolt line is still read as before');
  A.eq(acc.head, false, 'as is a heading that names the bolt');
  A.eq(acc.rod, false, 'and a rod row with a length');
  await page.evaluate(() => { try { wqaHardClose(); } catch (e) {} });

  A.eq(page._dcErrors.length, 0, 'no page errors: ' + page._dcErrors.join(' | '));
  A.eq(re._dcErrors.length, 0, 'no page errors after reopening: ' + re._dcErrors.join(' | '));
  await page.close(); await re.close();
};
