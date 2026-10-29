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

  // ═══ entry form: what is typed is the price; no carry-over ════════════════
  A.suite('pricing reset — entry form: typed pricing is active, no carry-over');
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
    const after = dcFormPaState('sagrod').state;
    const box = el('cpAccept').hidden ? '' : el('cpAccept').textContent;
    addCurrentItem();
    const it = quoteItems[quoteItems.length - 1];
    return { refused, filled, box, after, added: quoteItems.length - n0, src: it.priceAcceptance && it.priceAcceptance.source,
             itRate: it.formData && it.formData.costRate,
             next: { c: fv('sagrod', 'costRate'), a: fv('sagrod', 'addCost'), m: fv('sagrod', 'markup') } };
  });
  A.ok(flow.refused, 'Add refuses an item whose pricing was never set');
  A.eq(JSON.stringify(flow.filled), '{"c":"2.80","a":"0.60","m":"0"}', 'Fill in copies the recommendation into the boxes (explicit)');
  A.eq(flow.after, 'accepted', 'a typed / filled setup is the item\'s price straight away — no confirmation');
  A.eq(flow.box, '', 'no confirmation row under the price');
  A.eq(flow.added, 1, 'Add works without any Use step');
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
    const lenBefore = dcFormPaState('sagrod').state;
    setFieldValue('sagrod', 'length', '1350'); recalcCurrent();
    const lenAfter = dcFormPaState('sagrod').state;
    setFieldValue('sagrod', 'costRate', '3.1'); recalcCurrent();
    const rateAfter = dcFormPaState('sagrod').state;
    setFieldValue('sagrod', 'costRate', '3'); recalcCurrent();
    addCurrentItem();
    const nr = quoteItems[quoteItems.length - 1];
    return { added: quoteItems.length - n0, man: man.finalUnitPrice, manMode: man.priceMode, nrMode: nr.priceMode,
             lenBefore, lenAfter, rateAfter };
  });
  A.eq(modes.manMode, 'manual', 'Manual Price still works');
  A.near(modes.man, 9.99, 0.001, 'at the typed figure');
  A.eq(modes.nrMode, 'no_round', 'No Round still works');
  A.eq(modes.lenAfter, 'accepted', 'a different length simply recalculates');
  A.eq(modes.rateAfter, 'accepted', 'an edited rate is active immediately');
  A.eq(modes.added, 2, 'both added');

  // ── saved items reopen with their pricing; legacy items get nothing injected ──
  const saved = await p.evaluate(() => {
    // the LAST No Round item: a new Sag Rod now starts on No Round (owner rule 2026-10-29)
    const i = quoteItems.map(it => it.priceMode === 'no_round').lastIndexOf(true);
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

  // ═══ Quick Add — live editor, History beside it, apply setup ══════════════
  A.suite('pricing reset — Quick Add: typed pricing is live, no confirmation');
  const HIST2 = { ok: true, data: { records: [HREC, Object.assign({}, HREC, { quotationId: 10, refNo: 'Q-2026-1010', dimensionPreview: 'L 1100 x TL 100/100mm',
    exactDims: false, dimDistance: 100, costRate: 3.8, addCost: 0.6, markup: 0, priceMode: 'no_round', unitPrice: 3.9, boltUnitPrice: 3.9 })],
    total: 2, ownTotal: 0, otherTotal: 2, exactTotal: 1, closeTotal: 1, refTotal: 0, offset: 0, limit: 20 } };
  p = await openApp(browser, { api: { get_default_prices: { ok: true, data: DP }, get_pricing_history: HIST2 } });
  await quickAddPaste(p, SAG, { expanded: false, settle: 900 });
  await p.waitForTimeout(400);
  const row = (i) => p.evaluate(i => { const r = wqa.rows[i], card = document.querySelector('[data-wqa-row="' + i + '"]');
    return { ok: wqaRowAccepted(r), c: String(r.calc.costRate), a: String(r.calc.addCost), m: String(r.calc.markup), px: r.calc.finalUnitPrice,
      mode: r.priceMode || 'auto', man: r.manualPrice || '', shown: card.querySelector('.wqa-fin').textContent,
      cells: card.querySelector('.wqa-ip-set').className, cellText: card.querySelector('.wqa-ip-set').textContent }; }, i);
  let r0 = await row(0);
  A.ok(r0.c === '' && r0.a === '' && r0.m === '', 'a new row starts 0 / 0 / 0');
  A.eq(r0.shown, 'Set price', 'RM/pc says Set price');
  A.ok(/is-rec/.test(r0.cells), 'the recommendation is shown as reference (view only)');
  A.eq(await p.evaluate(() => document.querySelectorAll('#wqaRows .wqa-ip-set input').length), 0, 'no editable boxes on the row');
  A.ok(await p.evaluate(() => !!(wqa.rows[0].hist && wqa.rows[0].hist.records) && !wqaRowAccepted(wqa.rows[0])), 'History loads and prices nothing');
  let foot = await p.evaluate(() => ({ need: el('wqaFootNeed').textContent, dis: el('wqaAddBtn').disabled }));
  A.includes(foot.need, '3 items need a price', 'the footer counts items without a price');
  A.ok(!/approval|accept/i.test(foot.need), 'no approval wording');

  await p.click('[data-wqa-row="0"] .wqa-fig-price');
  await p.waitForTimeout(250);
  let ed = await p.evaluate(() => ({ c: document.querySelector('[data-pxe="0"] [data-px="costRate"]').value,
    use: document.querySelectorAll('[data-px-use], .cp-pa-apply').length, rec: (document.querySelector('[data-pxe-rec="0"]') || {}).textContent || '' }));
  A.eq(ed.c, '', 'the editor opens on the row\'s own (empty) setup — the recommendation is not filled in');
  A.includes(ed.rec, '2.80 · +0.60 · 0%', 'the recommendation is shown beside the boxes');
  A.eq(ed.use, 0, 'there is no Use This Pricing button');
  await p.fill('[data-pxe="0"] [data-px="costRate"]', '4');
  await p.fill('[data-pxe="0"] [data-px="addCost"]', '4');
  await p.fill('[data-pxe="0"] [data-px="markup"]', '4');
  await p.waitForTimeout(400);
  r0 = await row(0);
  A.ok(r0.ok && r0.c === '4' && r0.a === '4' && r0.m === '4', 'typing Cost / Add / Markup makes them the row\'s active pricing at once');
  A.eq(r0.shown, 'RM' + Number(r0.px).toFixed(2), 'RM/pc shows the calculated price immediately');
  A.eq(await p.textContent('[data-pxe="0"] .wqa-pxd-v'), r0.shown, 'and the editor shows the same figure');
  await p.press('[data-pxe="0"] [data-px="markup"]', 'Tab');
  await p.waitForTimeout(600);
  let offer = await p.evaluate(() => (document.querySelector('[data-pxe="0"] [data-recipe-offer]') || {}).textContent || '');
  A.includes(offer, 'Apply this setup to 2 other compatible items?', 'C: the offer follows a setup on one row, in its editor');
  A.includes(offer, 'Apply to 2 items', 'C: counting the compatible rows');
  await p.click('#wqaRows [data-rc="dismiss"]');
  await p.waitForTimeout(250);
  A.ok(await p.evaluate(() => !document.querySelector('#wqaRows [data-recipe-offer]') && !wqaRowAccepted(wqa.rows[1])), 'C: Not now changes nothing');

  // Price modes
  await p.click('[data-wqa-row="0"] .wqa-fig-price');
  await p.waitForTimeout(200);
  if (!(await p.$('[data-pxe="0"]'))) { await p.click('[data-wqa-row="0"] .wqa-fig-price'); await p.waitForTimeout(200); }
  await p.selectOption('[data-pxe="0"] [data-px="priceMode"]', 'no_round');
  await p.waitForTimeout(300);
  r0 = await row(0);
  A.ok(r0.ok && r0.mode === 'no_round', 'No Round applies immediately');
  await p.selectOption('[data-pxe="0"] [data-px="priceMode"]', 'auto');
  await p.waitForTimeout(300);
  A.eq((await row(0)).mode, 'auto', 'Auto Round applies immediately');

  // Manual row 3 — protected later
  await p.evaluate(() => wqaPxToggle(2));
  await p.waitForTimeout(200);
  await p.selectOption('[data-pxe="2"] [data-px="priceMode"]', 'manual');
  await p.waitForTimeout(300);
  await p.fill('[data-pxe="2"] [data-px="manualPrice"]', '50');
  await p.waitForTimeout(400);
  let r2 = await row(2);
  A.ok(r2.ok && r2.mode === 'manual' && Number(r2.px) === 50, 'Manual Price is active as soon as it is typed');

  // ── B: History beside the editor — quick preview
  await p.evaluate(() => { wqa.px = null; wqaPxToggle(1); });
  await p.waitForTimeout(250);
  await p.click('[data-px-row="1"] .wqa-px-hist');
  await p.waitForTimeout(300);
  let both = await p.evaluate(() => ({ ed: !!document.querySelector('[data-pxe="1"] [data-px="costRate"]'), hq: !!document.querySelector('[data-wqa-row="1"] .wqa-hq'),
    rcp: [...document.querySelectorAll('[data-wqa-row="1"] [data-hq-recipe]')].map(n => n.textContent),
    acts: [...document.querySelectorAll('[data-wqa-row="1"] [data-hq-act="apply"]')].map(n => n.textContent) }));
  A.ok(both.ed && both.hq, 'B: the quick history preview opens WITHOUT closing the pricing editor');
  A.ok(both.rcp.some(t => t === '3.50 · +0.60 · 5% · Auto Round'), 'B: the preview shows the record\'s recipe (Cost · Add · Markup · Mode)');
  A.ok(both.acts.length >= 1 && both.acts.every(t => t === 'Use this setup'), 'B: records offer "Use this setup"');
  await p.click('[data-wqa-row="1"] [data-hq-act="apply"]');
  await p.waitForTimeout(500);
  let r1 = await row(1);
  const first = r1.c;
  A.ok(r1.ok && (Number(r1.c) === 3.8 || Number(r1.c) === 3.5), 'B: Use this setup copies the recipe and the row is priced — no second confirmation');
  A.ok(await p.evaluate(c => document.querySelector('[data-pxe="1"] [data-px="costRate"]').value === c && !!document.querySelector('[data-wqa-row="1"] .wqa-hq'), r1.c),
       'B: the editor (still open) shows the copied values, and the preview stays open');

  // ── B: Full drawer docked beside the editor
  await p.evaluate(() => wqaHdOpen(1));
  await p.waitForTimeout(600);
  const dock = await p.evaluate(() => { const inp = document.querySelector('[data-pxe="1"] [data-px="costRate"]'); const b = inp.getBoundingClientRect();
    const d = document.getElementById('wqaHd').getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { side: document.body.classList.contains('wqa-hd-side'), sep: b.right <= d.left, hit: hit === inp,
      recs: document.querySelectorAll('#wqaHdBody .ph-rec').length, nums: (document.querySelector('#wqaHdBody .ph-rec-nums') || {}).textContent || '' }; });
  A.ok(dock.side && dock.sep, 'B: desktop docks the drawer beside Quick Add — the editor is not covered');
  A.ok(dock.hit, 'B: the editor input is still reachable (not behind a backdrop)');
  A.ok(dock.recs === 2 && /Cost Rate/.test(dock.nums) && /Markup/.test(dock.nums) && /Price Mode/.test(dock.nums), 'B: drawer records show Cost / Add / Markup / Price Mode');
  await p.fill('[data-pxe="1"] [data-px="markup"]', '2');
  await p.waitForTimeout(400);
  A.eq((await row(1)).m, '2', 'B: the editor stays editable while the drawer is open');
  const want = Number(first) === 3.8 ? 'Q-2026-0909' : 'Q-2026-1010';
  await p.evaluate(ref => { const rec = [...document.querySelectorAll('#wqaHdBody .ph-rec')].find(n => n.textContent.includes(ref)); rec.querySelector('.ph-rec-use').click(); }, want);
  await p.waitForTimeout(600);
  r1 = await row(1);
  A.ok(r1.ok && Number(r1.c) === (want === 'Q-2026-1010' ? 3.8 : 3.5) && r1.m !== '2', 'B: the drawer\'s Use this setup (after its Similar prompt) is copied and active ' + JSON.stringify({ want, r1 }));
  A.ok(await p.evaluate(c => Number(document.querySelector('[data-pxe="1"] [data-px="costRate"]').value) === Number(c), r1.c), 'B: the editor beside the drawer updates at once');
  A.ok(await p.evaluate(() => !document.getElementById('wqaHd').hidden), 'B: the drawer stays open on desktop after Use this setup');
  await p.evaluate(() => wqaHdClose());

  // ── C: apply the setup on row 1 to compatible rows
  await p.evaluate(() => { wqa.px = null; wqa.hq = null; wqaPxToggle(0); });
  await p.waitForTimeout(250);
  await p.fill('[data-pxe="0"] [data-px="markup"]', '0');
  await p.press('[data-pxe="0"] [data-px="markup"]', 'Tab');
  await p.waitForTimeout(600);
  await p.click('#wqaRows [data-rc="open"]');
  await p.waitForTimeout(250);
  const pick = await p.evaluate(() => ({ items: [...document.querySelectorAll('#wqaRows [data-rcp]')].map(n => n.getAttribute('data-rcp') + ':' + n.checked),
    skip: [...document.querySelectorAll('#wqaRows [data-rcp-skip]')].map(n => n.textContent.replace(/\s+/g, ' ').trim()) }));
  A.eq(JSON.stringify(pick.items), '["1:false"]', 'C: an already-priced compatible row is listed but not ticked');
  A.ok(pick.skip.length === 1 && /Manual price kept/.test(pick.skip[0]), 'C: the Manual Price row is skipped with its reason');
  await p.click('#wqaRows [data-rcp="1"]');
  await p.waitForTimeout(200);
  await p.click('#wqaRows [data-rc="apply"]');
  await p.waitForTimeout(600);
  r0 = await row(0); r1 = await row(1); r2 = await row(2);
  A.ok(r1.c === '4' && r1.a === '4' && r1.m === '0' && r1.mode === 'auto', 'C: the target gets the setup (Cost / Add / Markup / Mode) ' + JSON.stringify({ r0, r1 }));
  A.ok(r1.ok && r1.px > r0.px, 'C: and recalculates its own, higher RM/pc for its longer length — the figure is not copied');
  A.ok(r2.mode === 'manual' && r2.man === '50', 'C: the Manual Price row is untouched');

  const add = await p.evaluate(async () => { const n0 = quoteItems.length; await wqaAddAll();
    return { n: quoteItems.length - n0, src: quoteItems.slice(-3).map(it => it.priceAcceptance && it.priceAcceptance.source) }; });
  A.eq(add.n, 3, 'Add Items to Quotation adds all three');
  A.eq(JSON.stringify(add.src), '["manual_recipe","manual_recipe","manual"]', 'each saved with its pricing source');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (multi-item Quick Add)');

  // ── incompatible basis + one-item + L Bolt
  A.suite('pricing reset — one item, L Bolt, incompatible rows');
  await p.close();
  p = await openApp(browser, { api: { get_default_prices: { ok: true, data: DP } } });
  await quickAddPaste(p, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x 100/100 - 2pcs\n1/2" x 1200 x 100/100 - 2pcs\nM12 x 1400 x 100/100 - 2pcs', { expanded: false, settle: 900 });
  const basis = await p.evaluate(() => wqa.rows.map(r => wqaSizeBasis(r)));
  await p.evaluate(() => { wqaPxToggle(0); });
  await p.waitForTimeout(200);
  await p.fill('[data-pxe="0"] [data-px="costRate"]', '4.2');
  await p.press('[data-pxe="0"] [data-px="costRate"]', 'Tab');
  await p.waitForTimeout(600);
  const of = await p.evaluate(() => { const o = wqaRecipeOffer(0); return o ? { ok: o.ok.map(r => wqa.rows.indexOf(r)), skip: o.skip.map(x => x.why) } : null; });
  if (basis.indexOf('inch') >= 0) A.ok(of && of.skip.indexOf('paSkipBasis') >= 0, 'an inch-size row is skipped as a different pricing basis');
  A.ok(of && of.ok.indexOf(2) >= 0, 'the metric row of the same group is compatible');

  await quickAddPaste(p, 'MS SAG ROD PL FULLSIZE\nM16 x 2000 x 100/100 - 5pcs', { expanded: false, settle: 900 });
  await p.evaluate(() => wqaPxToggle(0));
  await p.waitForTimeout(200);
  await p.fill('[data-pxe="0"] [data-px="costRate"]', '3');
  await p.waitForTimeout(400);
  A.ok(await p.evaluate(() => wqaRowAccepted(wqa.rows[0]) && !el('wqaAddBtn').disabled), 'one-item Quick Add: typed Cost prices it and Add is enabled');
  A.eq(await p.evaluate(() => document.querySelectorAll('#wqaRows [data-recipe-offer]').length), 0, 'one-item: no apply offer (nothing to apply to)');

  await quickAddPaste(p, 'MS L BOLT PL FULLSIZE\nM20 x 950 x 400 x 150 - 9pcs', { expanded: false, settle: 900 });
  const lb0 = await p.evaluate(() => ({ t: wqaRowProduct(wqa.rows[0]), shown: document.querySelector('[data-wqa-row="0"] .wqa-fin').textContent }));
  A.eq(lb0.t, 'lbolt', 'L Bolt row');
  A.eq(lb0.shown, 'Set price', 'L Bolt starts without a price');
  await p.evaluate(() => wqaPxToggle(0));
  await p.waitForTimeout(200);
  await p.fill('[data-pxe="0"] [data-px="costRate"]', '4.5');
  await p.fill('[data-pxe="0"] [data-px="addCost"]', '1.2');
  await p.waitForTimeout(400);
  A.ok(await p.evaluate(() => wqaRowAccepted(wqa.rows[0]) && wqa.rows[0].calc.finalUnitPrice > 0), 'L Bolt: typed Cost + Add is its price');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors');

  // ── EN / CN
  await setLang(p, 'zh');
  await quickAddPaste(p, SAG, { expanded: false, settle: 900 });
  const zh = await p.evaluate(() => ({ fin: document.querySelector('[data-wqa-row="0"] .wqa-fin').textContent, need: el('wqaFootNeed').textContent }));
  A.eq(zh.fin, '设定价格', 'CN: RM/pc reads 设定价格');
  A.includes(zh.need, '需要定价', 'CN: footer says 需要定价');
  await setLang(p, 'en');
  await p.close();

  // ── tablet / phone quick check
  for (const w of [820, 390]) {
    const q = await openApp(browser, { viewport: { width: w, height: 900 }, api: { get_pricing_history: HIST } });
    await quickAddPaste(q, SAG, { expanded: false, settle: 900 });
    await q.evaluate(() => wqaPxToggle(0));
    await q.waitForTimeout(300);
    const lay = await q.evaluate(() => { const b = document.querySelector('[data-pxe="0"] [data-px="costRate"]').closest('.wqa-pxe-box').getBoundingClientRect();
      return { on: b.width > 0 && b.right <= window.innerWidth + 1, sx: document.documentElement.scrollWidth <= window.innerWidth + 1, h: b.height }; });
    A.ok(lay.on, `${w}px: the editor is on screen`);
    A.ok(lay.sx, `${w}px: no horizontal page scroll`);
    A.ok(lay.h >= 40, `${w}px: touch-size inputs`);
    A.eq(JSON.stringify(q._dcErrors), '[]', `${w}px: no page errors`);
    await q.close();
  }
};
