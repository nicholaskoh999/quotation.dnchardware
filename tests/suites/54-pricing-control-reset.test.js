/* ── Pricing Control Reset ─────────────────────────────────────────────────
   Owner rule (2026-10-28): the system never decides an item's active
   pricing. A new item starts at Cost 0 / Add 0 / Markup 0; built-in rates,
   the 4140 table, the thread-length band and Default Price rules are shown
   as a recommendation only. The owner opens RM/pc, reviews the pricing
   SETUP, presses Use This Pricing, and may then apply that setup (never the
   RM figure) to the compatible items.                                     */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');
const { setLang } = require('../lib/dom-i18n');

const DP = [
  { id: 11, type: 'stud', material: 'MS', sizeType: '', size: 'M16', finish: '', costRate: 5, addCost: 1, markup: 10, active: '1' },
];
const SAG = 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x 100/100 - 2pcs\nM12 x 1500 x 100/100 - 3pcs\nM12 x 2000 x 100/100 - 4pcs';
const HREC = {
  quotationId: 9, refNo: 'Q-2026-0909', date: '2026-10-01', customer: 'ABC HARDWARE', companyId: 0, own: false,
  productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', finishMatch: true, cleanSize: 'M12',
  dimensionPreview: 'L 1000 x TL 100/100mm', exactDims: true, dimDistance: 0, qty: 2,
  unitPrice: 3.1, lineUnitPrice: 3.1, boltUnitPrice: 3.1, accessoryCost: 0, accessorySummary: '', accessoryAmbiguous: false,
  priceMode: 'auto', priceModeLabel: 'Auto Round', costRate: 3.5, addCost: 0.6, markup: 5, weight: 0.8878, legacy: false,
};
const HIST = { ok: true, data: { records: [HREC], total: 1, ownTotal: 0, otherTotal: 1, exactTotal: 1, closeTotal: 0, refTotal: 0, offset: 0, limit: 20 } };
const pricing = (p, t) => p.evaluate(t => ({ c: fv(t, 'costRate'), a: fv(t, 'addCost'), m: fv(t, 'markup') }), t);
const zero = v => (parseFloat(v.c || 0) === 0 && parseFloat(v.a || 0) === 0 && parseFloat(v.m || 0) === 0);

module.exports = async (browser, A) => {
  // ═══ Session A — entry form starts neutral, nothing injects pricing ══════
  A.suite('pricing reset — new items start at 0 / 0 / 0');
  let p = await openApp(browser, { api: { get_default_prices: { ok: true, data: DP } } });
  await p.evaluate(() => switchType('sagrod'));
  A.ok(zero(await pricing(p, 'sagrod')), 'fresh Sag Rod starts 0 / 0 / 0');
  const sag = await p.evaluate(() => {
    const out = [];
    const snap = (why) => out.push({ why, c: fv('sagrod', 'costRate'), a: fv('sagrod', 'addCost'), m: fv('sagrod', 'markup') });
    setFieldValue('sagrod', 'material', 'MS'); onMaterialSizeChange('sagrod', false, 'material'); snap('material MS');
    setFieldValue('sagrod', 'size', 'M12'); onSizeCommit('sagrod'); snap('size M12');
    setFinishValue('sagrod', 'ZP'); onFinishChange('sagrod'); snap('finish ZP');
    setFinishValue('sagrod', 'HDG'); onFinishChange('sagrod'); snap('finish HDG');
    setFinishValue('sagrod', 'ZP'); onFinishChange('sagrod');
    setFieldValue('sagrod', 'threadLen', '150/150'); onThreadLenChange('sagrod'); snap('TL 150');
    setFieldValue('sagrod', 'material', '4140'); onMaterialSizeChange('sagrod', false, 'material'); snap('material 4140');
    return out;
  });
  sag.forEach(s => A.ok(zero(s), `Sag Rod stays 0 / 0 / 0 after ${s.why}`));
  const rec = await p.evaluate(() => {
    setFieldValue('sagrod', 'material', 'MS'); onMaterialSizeChange('sagrod', false, 'material');
    setFinishValue('sagrod', 'ZP'); onFinishChange('sagrod');
    setFieldValue('sagrod', 'threadLen', '150/150'); onThreadLenChange('sagrod');
    return { show: el('dpStatus').classList.contains('show'), v: el('dpRecV').textContent, src: el('dpRecSrc').textContent,
             c: fv('sagrod', 'costRate') };
  });
  A.ok(rec.show, 'a recommendation is shown for MS ZP Sag Rod');
  A.eq(rec.v, '4.20 · +1.00 · 0%', 'recommendation = built-in ZP 4.20, TL band +1.00, 0% — the setup, not an RM figure');
  A.eq(rec.c, '', 'and the active Cost Rate is still empty (0)');
  const r4140 = await p.evaluate(() => {
    setFieldValue('sagrod', 'material', '4140'); onMaterialSizeChange('sagrod', false, 'material');
    setFieldValue('sagrod', 'size', 'M16'); onSizeCommit('sagrod');
    setFinishValue('sagrod', 'PL'); onFinishChange('sagrod');
    const r = dcRecommendFor('sagrod');
    return { r, c: fv('sagrod', 'costRate'), a: fv('sagrod', 'addCost') };
  });
  A.ok(r4140.r && Number(r4140.r.costRate) > 0, '4140 Sag Rod: the 4140 table is a recommendation');
  A.ok(r4140.c === '' && r4140.a === '', '4140 Sag Rod: active Cost / Add stay 0');

  for (const t of ['stud', 'ubolt', 'squbolt', 'lbolt', 'jbolt', 'anchorbolt']) {
    await p.evaluate(t => { switchType(t); setFieldValue(t, 'size', 'M16'); if (t === 'stud') onStudSizeCommit(); else onSizeCommit(t);
      setFieldValue(t, 'material', 'MS'); onMaterialSizeChange(t, false, 'material'); }, t);
    A.ok(zero(await pricing(p, t)), `fresh ${t} starts 0 / 0 / 0 through size and material changes`);
  }
  const studRec = await p.evaluate(() => {
    switchType('stud'); setFieldValue('stud', 'material', 'MS'); setFieldValue('stud', 'size', 'M16'); onStudSizeCommit();
    return { r: dcRecommendFor('stud'), v: el('dpRecV').textContent, src: el('dpRecSrc').textContent, c: fv('stud', 'costRate'),
             pa: dcFormPaState('stud').state };
  });
  A.eq(studRec.v, '5.00 · +1.00 · 10%', 'custom Default Price rule is shown as the recommendation');
  A.eq(studRec.src, 'Default Price', 'named as a Default Price rule');
  A.eq(studRec.c, '', 'custom Default Price rule does NOT fill the Cost Rate');
  A.ok(studRec.pa !== 'accepted', 'showing a recommendation creates no pricing state');

  // ═══ entry form: Fill in → Use This Pricing → Add; no carry-over ══════════
  A.suite('pricing reset — entry form Use This Pricing and no carry-over');
  const flow = await p.evaluate(() => {
    switchType('sagrod');
    setFieldValue('sagrod', 'material', 'MS'); onMaterialSizeChange('sagrod', false, 'material');
    setFieldValue('sagrod', 'sizeType', 'FULLSIZE');
    setFieldValue('sagrod', 'size', 'M12'); onSizeCommit('sagrod');
    setFinishValue('sagrod', 'PL'); onFinishChange('sagrod');
    setFieldValue('sagrod', 'length', '1000'); setFieldValue('sagrod', 'threadLen', '100/100'); onThreadLenChange('sagrod');
    const n0 = quoteItems.length;
    addCurrentItem();
    const refused = quoteItems.length === n0;
    dcRecFill();
    const filled = { c: fv('sagrod', 'costRate'), a: fv('sagrod', 'addCost'), m: fv('sagrod', 'markup') };
    const before = dcFormPaState('sagrod').state;
    const box = el('cpAccept').textContent;
    addCurrentItem();
    const refused2 = quoteItems.length === n0;
    dcFormPaApply();
    const after = dcFormPaState('sagrod').state;
    addCurrentItem();
    const it = quoteItems[quoteItems.length - 1];
    return { refused, refused2, filled, before, box, after, added: quoteItems.length - n0, src: it.priceAcceptance && it.priceAcceptance.source,
             itRate: it.formData && it.formData.costRate,
             next: { c: fv('sagrod', 'costRate'), a: fv('sagrod', 'addCost'), m: fv('sagrod', 'markup') } };
  });
  A.ok(flow.refused, 'Add refuses an item whose pricing was never set');
  A.eq(JSON.stringify(flow.filled), '{"c":"2.80","a":"0.60","m":"0"}', 'Fill in copies the recommendation into the boxes (explicit)');
  A.ok(flow.before !== 'accepted', 'filled but not used yet');
  A.includes(flow.box, 'Use This Pricing', 'the entry form offers Use This Pricing');
  A.ok(!/Suggested Price|Accepted Price|Accept/.test(flow.box), 'no Suggested / Accepted wording');
  A.ok(flow.refused2, 'still refused until Use This Pricing');
  A.eq(flow.after, 'accepted', 'Use This Pricing prices the item');
  A.eq(flow.added, 1, 'then Add works');
  A.eq(flow.src, 'built_in', 'saved with the recommendation as its source');
  A.eq(flow.itRate, '2.80', 'the added item keeps its own Cost Rate');
  A.ok(zero(flow.next), 'the next new item starts 0 / 0 / 0 — no carry-over');

  const modes = await p.evaluate(() => {
    const n0 = quoteItems.length;
    setFieldValue('sagrod', 'length', '1200');
    setFieldValue('sagrod', 'priceMode', 'manual'); onPriceModeChange('sagrod');
    setFieldValue('sagrod', 'manualUnitPrice', '9.99'); recalcCurrent();
    addCurrentItem();
    const man = quoteItems[quoteItems.length - 1];
    setFieldValue('sagrod', 'length', '1300');
    setFieldValue('sagrod', 'costRate', '3'); setFieldValue('sagrod', 'addCost', '0.5'); setFieldValue('sagrod', 'markup', '0');
    setFieldValue('sagrod', 'priceMode', 'no_round'); onPriceModeChange('sagrod'); recalcCurrent();
    dcFormPaApply();
    const lenBefore = dcFormPaState('sagrod').state;
    setFieldValue('sagrod', 'length', '1350'); recalcCurrent();
    const lenAfter = dcFormPaState('sagrod').state;
    setFieldValue('sagrod', 'costRate', '3.1'); recalcCurrent();
    const rateAfter = dcFormPaState('sagrod').state;
    setFieldValue('sagrod', 'costRate', '3'); recalcCurrent();
    dcFormPaApply();
    addCurrentItem();
    const nr = quoteItems[quoteItems.length - 1];
    return { added: quoteItems.length - n0, man: man.finalUnitPrice, manMode: man.priceMode, nrMode: nr.priceMode,
             lenBefore, lenAfter, rateAfter };
  });
  A.eq(modes.manMode, 'manual', 'Manual Price still works');
  A.near(modes.man, 9.99, 0.001, 'at the typed figure');
  A.eq(modes.nrMode, 'no_round', 'No Round still works');
  A.eq(modes.lenAfter, 'accepted', 'a different length keeps the used setup (the RM figure is not what was approved)');
  A.ok(modes.rateAfter !== 'accepted', 'changing the setup itself needs Use This Pricing again');
  A.eq(modes.added, 2, 'both added');

  // ── saved items reopen with their pricing; legacy items get nothing injected ──
  const saved = await p.evaluate(() => {
    const i = quoteItems.findIndex(it => it.priceMode === 'no_round');
    editItem(i);
    const kept = { c: fv('sagrod', 'costRate'), a: fv('sagrod', 'addCost'), m: fv('sagrod', 'markup'), pa: dcFormPaState('sagrod').state };
    editingItemIndex = null; setItemEditMode(null);
    const legacy = JSON.parse(JSON.stringify(quoteItems[i]));
    delete legacy.formData.costRate; delete legacy.formData.addCost;
    quoteItems.push(legacy);
    editItem(quoteItems.length - 1);
    const leg = { c: fv('sagrod', 'costRate'), a: fv('sagrod', 'addCost'), pa: dcFormPaState('sagrod').state };
    editingItemIndex = null; setItemEditMode(null); quoteItems.pop();
    return { kept, leg };
  });
  A.eq(JSON.stringify([saved.kept.c, saved.kept.a, saved.kept.m]), '["3","0.5","0"]', 'a saved item reopens with its saved Cost / Add / Markup');
  A.eq(saved.kept.pa, 'accepted', 'and its saved price stands');
  A.eq(saved.leg.c, '', 'a legacy item with no saved rate gets no current default injected');
  A.eq(saved.leg.pa, 'accepted', 'and keeps its saved price');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (entry form)');
  await p.close();

  // ═══ Sessions B / C / D — Quick Add ═══════════════════════════════════════
  A.suite('pricing reset — Quick Add recommendation, editor, apply setup');
  p = await openApp(browser, { api: { get_default_prices: { ok: true, data: DP }, get_pricing_history: HIST } });
  await quickAddPaste(p, SAG, { expanded: false, settle: 900 });
  let st = await p.evaluate(() => wqa.rows.map((r, i) => ({ c: String(r.calc.costRate), a: String(r.calc.addCost), m: String(r.calc.markup),
    rec: r.rec, ok: wqaRowAccepted(r), shown: document.querySelector('[data-wqa-row="' + i + '"] .wqa-fin').textContent,
    cells: document.querySelector('[data-wqa-row="' + i + '"] .wqa-ip-set').className, miss: wqaRowMissing(r) })));
  A.eq(st.length, 3, 'three rows');
  A.ok(st.every(r => r.c === '' && r.a === '' && r.m === ''), 'every Quick Add row starts 0 / 0 / 0');
  A.ok(st.every(r => r.rec && r.rec.costRate === '2.80' && r.rec.addCost === '0.60'), 'each row carries the built-in recommendation (2.80 · +0.60)');
  A.ok(st.every(r => !r.ok), 'no row is priced by a recommendation');
  A.ok(st.every(r => r.shown === 'Set price'), 'RM/pc says "Set price" until the row is priced');
  A.ok(st.every(r => /is-rec/.test(r.cells)), 'the row shows the recommendation as a recommendation (view only)');
  A.ok(st.every(r => r.miss.indexOf('Cost Rate') < 0), 'an unpriced row is not flagged as missing a Cost Rate');
  A.eq(await p.evaluate(() => document.querySelectorAll('#wqaRows .wqa-ip-set input').length), 0, 'no editable boxes on the row');
  const foot = await p.evaluate(() => ({ need: el('wqaFootNeed').textContent, dis: el('wqaAddBtn').disabled }));
  A.includes(foot.need, '3 items not priced yet', 'the footer counts unpriced items');
  A.ok(foot.dis, 'Add waits for pricing');
  A.eq(await p.evaluate(() => document.querySelectorAll('#wqaRows .wqa-grx-acc, #wqaRows .wqa-grx-n, .wqa-sel-acc').length), 0,
       'no Accept-all / Accepted N/M group UX');

  // history loads as reference and never prices the row on its own
  await p.waitForTimeout(400);
  A.ok(await p.evaluate(() => !!(wqa.rows[0].hist && wqa.rows[0].hist.records) && !wqaRowAccepted(wqa.rows[0])),
       'History loads automatically and does not price the row');

  // ── C: RM/pc opens the editor on the recommendation; typing touches only the draft
  await p.click('[data-wqa-row="0"] .wqa-fig-price');
  await p.waitForTimeout(250);
  let ed = await p.evaluate(() => ({ c: document.querySelector('[data-pxe="0"] [data-px="costRate"]').value,
    a: document.querySelector('[data-pxe="0"] [data-px="addCost"]').value, m: document.querySelector('[data-pxe="0"] [data-px="markup"]').value,
    out: document.querySelector('[data-pxe="0"] .wqa-pxd-v').textContent, use: document.querySelector('[data-px-use="0"]').textContent,
    rowOv: JSON.stringify(wqa.rows[0].priceOverride), ok: wqaRowAccepted(wqa.rows[0]) }));
  A.eq(JSON.stringify([ed.c, ed.a, ed.m]), '["2.80","0.60","0"]', 'the editor opens on the recommended setup');
  A.ok(/^RM\d+\.\d\d$/.test(ed.out), 'and shows what it calculates to');
  A.eq(ed.use, 'Use This Pricing', 'button says Use This Pricing (not Use RM…)');
  A.eq(ed.rowOv, '{}', 'opening the editor changes nothing on the row');
  await p.fill('[data-pxe="0"] [data-px="costRate"]', '3.5');
  await p.dispatchEvent('[data-pxe="0"] [data-px="costRate"]', 'input');
  const out2 = await p.textContent('[data-pxe="0"] .wqa-pxd-v');
  A.ok(out2 !== ed.out, 'editing Cost recalculates the draft figure');
  A.ok(await p.evaluate(() => !wqaRowAccepted(wqa.rows[0]) && wqa.rows[0].priceOverride.costRate === undefined), 'the row is untouched until Use');
  await p.click('[data-px-use="0"]');
  await p.waitForTimeout(500);
  st = await p.evaluate(() => wqa.rows.map((r, i) => ({ ok: wqaRowAccepted(r), c: String(r.calc.costRate), px: r.calc.finalUnitPrice,
    shown: document.querySelector('[data-wqa-row="' + i + '"] .wqa-fin').textContent })));
  A.ok(st[0].ok && st[0].c === '3.5', 'Use This Pricing prices the row with the reviewed setup');
  A.eq(st[0].shown, 'RM' + Number(st[0].px).toFixed(2), 'and RM/pc shows the calculated price');
  A.ok(!st[1].ok && !st[2].ok, 'other rows stay unpriced');
  // ── D: the offer appears only now
  let offer = await p.evaluate(() => (document.querySelector('#wqaRows [data-recipe-offer]') || {}).textContent || '');
  A.includes(offer, 'Apply this pricing setup to other compatible items?', 'D: the offer appears after Use This Pricing');
  A.includes(offer, 'Apply to 2 other items', 'D: counting the compatible items');
  await p.click('#wqaRows [data-rc="dismiss"]');
  await p.waitForTimeout(200);
  A.ok(await p.evaluate(() => !document.querySelector('#wqaRows [data-recipe-offer]') && !wqaRowAccepted(wqa.rows[1])), 'D: Not now changes nothing');

  // manual row is protected
  await p.click('[data-wqa-row="2"] .wqa-fig-price');
  await p.waitForTimeout(200);
  await p.selectOption('[data-pxe="2"] [data-px="priceMode"]', 'manual');
  await p.waitForTimeout(300);
  await p.fill('[data-pxe="2"] [data-px="manualPrice"]', '50');
  await p.dispatchEvent('[data-pxe="2"] [data-px="manualPrice"]', 'input');
  await p.click('[data-px-use="2"]');
  await p.waitForTimeout(500);
  A.ok(await p.evaluate(() => wqaRowAccepted(wqa.rows[2]) && wqa.rows[2].priceMode === 'manual'), 'Manual Price via the editor prices the row');
  A.eq(await p.evaluate(() => document.querySelectorAll('#wqaRows [data-recipe-offer]').length), 0, 'a Manual Price is not offered as a setup');
  // use row 0 again → offer → apply
  await p.click('[data-wqa-row="0"] .wqa-fig-price');
  await p.waitForTimeout(200);
  await p.click('[data-px-use="0"]');
  await p.waitForTimeout(500);
  await p.click('#wqaRows [data-rc="open"]');
  await p.waitForTimeout(250);
  const pick = await p.evaluate(() => ({ items: [...document.querySelectorAll('#wqaRows [data-rcp]')].map(n => n.getAttribute('data-rcp') + ':' + n.checked),
    skip: [...document.querySelectorAll('#wqaRows [data-rcp-skip]')].map(n => n.textContent.replace(/\s+/g, ' ').trim()) }));
  A.eq(JSON.stringify(pick.items), '["1:true"]', 'D: preview lists the compatible unpriced item, ticked');
  A.ok(pick.skip.length === 1 && /Manual price kept/.test(pick.skip[0]), 'D: the Manual Price row is listed as skipped (protected)');
  await p.click('#wqaRows [data-rc="apply"]');
  await p.waitForTimeout(600);
  st = await p.evaluate(() => wqa.rows.map(r => ({ ok: wqaRowAccepted(r), c: String(r.calc.costRate), a: String(r.calc.addCost), m: String(r.calc.markup),
    px: r.calc.finalUnitPrice, mode: r.priceMode, man: r.manualPrice })));
  A.ok(st[1].ok && st[1].c === '3.5' && st[1].a === '0.60' && st[1].m === '0', 'D: the target gets the SETUP (3.5 · 0.60 · 0%) and is priced');
  A.ok(st[1].px > st[0].px, 'D: a longer rod recalculates to its own, higher RM/pc — the figure is not copied');
  A.ok(st[2].mode === 'manual' && st[2].man === '50', 'D: the Manual Price row is untouched');

  // History explicit Apply prices a row (and only then)
  await p.evaluate(() => { wqa.rows[1].pa = null; wqa.rows[1].priceOverride = {}; return wqaRecomputeAll('force'); });
  await p.waitForTimeout(400);
  A.ok(await p.evaluate(() => !wqaRowAccepted(wqa.rows[1])), 'History: row 2 reset to unpriced');
  await p.evaluate(() => wqaHistUse(1, 0));
  await p.waitForTimeout(500);
  const h = await p.evaluate(() => ({ ok: wqaRowAccepted(wqa.rows[1]), src: wqaRowPa(wqa.rows[1]).src, c: String(wqa.rows[1].calc.costRate) }));
  A.ok(h.ok && h.src === 'history_recipe' && Number(h.c) === 3.5, 'History explicit Apply prices the row from the record\'s setup');

  // Add: every priced row goes in with its acceptance
  const add = await p.evaluate(async () => { const n0 = quoteItems.length; await wqaAddAll();
    return { n: quoteItems.length - n0, src: quoteItems.slice(-3).map(it => it.priceAcceptance && it.priceAcceptance.source) }; });
  A.eq(add.n, 3, 'Add puts the three priced rows into the quotation');
  A.eq(JSON.stringify(add.src), '["manual_recipe","history_recipe","manual"]', 'each with the source of its pricing');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (Quick Add)');

  // ── EN / CN
  await setLang(p, 'zh');
  await quickAddPaste(p, SAG, { expanded: false, settle: 900 });
  const zh = await p.evaluate(() => ({ fin: document.querySelector('[data-wqa-row="0"] .wqa-fin').textContent, need: el('wqaFootNeed').textContent }));
  A.eq(zh.fin, '设定价格', 'CN: RM/pc reads 设定价格');
  A.includes(zh.need, '尚未定价', 'CN: footer says 尚未定价');
  await p.click('[data-wqa-row="0"] .wqa-fig-price');
  await p.waitForTimeout(200);
  A.eq(await p.textContent('[data-px-use="0"]'), '使用此定价', 'CN: Use This Pricing = 使用此定价');
  await setLang(p, 'en');
  await p.close();

  // ── tablet / phone quick check: editor fits, no sideways scroll
  for (const w of [820, 390]) {
    const q = await openApp(browser, { viewport: { width: w, height: 900 }, api: { get_pricing_history: HIST } });
    await quickAddPaste(q, SAG, { expanded: false, settle: 900 });
    await q.evaluate(() => wqaPxToggle(0));
    await q.waitForTimeout(300);
    const lay = await q.evaluate(() => { const b = document.querySelector('[data-px-use="0"]').getBoundingClientRect();
      const m = document.querySelector('#wqaModal .modal, #wqaModal .modal-box, #wqaModal') ;
      return { use: b.width > 0 && b.right <= window.innerWidth + 1, sx: document.documentElement.scrollWidth <= window.innerWidth + 1,
               h: b.height }; });
    A.ok(lay.use, `${w}px: Use This Pricing is on screen`);
    A.ok(lay.sx, `${w}px: no horizontal page scroll`);
    A.ok(lay.h >= 40, `${w}px: Use This Pricing is a touch-size target`);
    A.eq(JSON.stringify(q._dcErrors), '[]', `${w}px: no page errors`);
    await q.close();
  }
};
