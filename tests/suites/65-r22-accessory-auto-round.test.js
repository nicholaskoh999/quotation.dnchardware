/* ── Accessories under Auto Round — R2.2 lock, SUPERSEDED by R2.3 ───────────
   R2.3 OWNER CONTRACT OVERRIDE (2026-11-04): "If Accessories exist and Price
   Mode is Auto Round, apply the existing Auto Round engine to the combined
   final price" — Round(Base + Accessories). The R2.2 record below (contract A,
   RM4.80 + RM2.61 = RM7.41) is kept as history; every assertion now holds the
   R2.3 figures for the same inputs: raw 4.7741 + 2.61 = 7.3841 → RM7.40, bolt
   component 7.40 − 2.61 = 4.79. No Round, Manual and no-accessory Auto are
   unchanged. Original header follows.

   ── R2.2 Session C — Accessories under Auto Round: the owner's case, locked ──
   Owner observation: bolt base RM4.46 → Auto Round RM4.80; with RM2.61 of
   accessories the final is RM7.41. Is that bolt-then-add (A) or should the
   combined figure be rounded (B, RM7.40)?

   The ACCEPTED contract is A, already written down twice:
     - docs/control/PROJECT-GUARDRAILS.md "ACCESSORIES — INSIDE THE FINAL UNIT
       PRICE" (Stage 0B, 98a31e3): Auto Round · No Round — the BOLT is
       calculated and the accessories are ADDED; Manual — the customer's price
       is typed and the accessories come OUT of it.
     - tests/suites/51-auto-round-rule.test.js (owner-locked, a173510):
       "accessories are added AFTER the bolt is rounded — the combined final is
       never rounded again" (6.40 + 0.65 = 7.05, not 7.10).
   So RM7.41 is correct and nothing in the formula changes. This suite holds
   the owner's exact numbers on every path a line travels: the form in each
   mode and accessory mix, the added item, edit/update, print, WhatsApp,
   save → reopen, and Quick Add (typed and confirmed accessories).        */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');

/* M12 stud, L300, diameter 12: weight 0.26634528 kg × RM5.00 + RM3.13 = RM4.4617
   base ("RM4.46"), +7 % = RM4.7741 raw → Auto Round RM4.80 (x.x7 rounds up). */
const SPEC = { size: 'M12', dia: '12', l: '300', rate: '5.00', add: '3.13', markup: '7', qty: '10' };
const NUT = { qty: '1', price: '1.61' }, FW = { qty: '1', price: '1.00' };   // 2.61 together

const FORM = (mode, acc, manual) => `(() => {
  quoteItems.length = 0; editingItemIndex = null;
  switchType('stud');
  resetAccPanel('stud');
  const s = (id, v) => { const n = document.getElementById(id); n.value = v; };
  s('stud-size', '${SPEC.size}'); onStudSizeCommit();
  s('stud-diameter', '${SPEC.dia}'); s('stud-l', '${SPEC.l}'); s('stud-qty', '${SPEC.qty}');
  s('stud-costRate', '${SPEC.rate}'); s('stud-addCost', '${SPEC.add}'); s('stud-markup', '${SPEC.markup}');
  setFieldValue('stud', 'priceMode', '${mode}'); setFieldValue('stud', 'manualUnitPrice', '${manual || ''}');
  if (typeof onPriceModeChange === 'function') onPriceModeChange('stud');
  const acc = ${JSON.stringify(acc || {})};
  if (acc.nut) { document.getElementById('stud-nutEnabled').checked = true; onAccChange('stud'); s('stud-nutQty', acc.nut.qty); s('stud-nutPrice', acc.nut.price); onAccChange('stud'); }
  if (acc.fw)  { document.getElementById('stud-fwEnabled').checked = true;  onAccChange('stud'); s('stud-fwQty', acc.fw.qty);   s('stud-fwPrice', acc.fw.price);   onAccChange('stud'); }
  calcStud();
  const st = priceCalcState.stud || {};
  return { bolt: +(+st.boltUnitPrice).toFixed(2), acc: +(+st.accessoriesCost).toFixed(2), final: +(+st.finalUnitPrice).toFixed(2),
           shown: document.getElementById('cpFinal').textContent.trim() };
})()`;

module.exports = async (browser, A) => {
  A.suite('65 accessories under Auto Round (R2.2 case, R2.3 rule: Round(4.7741 + 2.61) = RM7.40)');
  const page = await openApp(browser);

  /* ── the form: every mode × accessory mix ── */
  const CASES = [
    ['auto', null, null, 4.80, 0, 4.80, 'no accessories: Auto Round RM4.80'],
    /* R2.2 (superseded): Nut 6.41 · FW 5.80 · Nut + FW 7.41 */
    ['auto', { nut: NUT }, null, 4.79, 1.61, 6.40, 'Nut only (R2.3): Round(4.7741 + 1.61 = 6.3841) = 6.40'],
    ['auto', { fw: FW }, null, 4.80, 1.00, 5.80, 'FW only (R2.3): Round(4.7741 + 1.00 = 5.7741) = 5.80'],
    ['auto', { nut: NUT, fw: FW }, null, 4.79, 2.61, 7.40, 'Nut + FW (R2.3): Round(4.7741 + 2.61 = 7.3841) = 7.40, bolt component 4.79'],
    ['no_round', null, null, 4.77, 0, 4.77, 'No Round, no accessories: RM4.77'],
    ['no_round', { nut: NUT, fw: FW }, null, 4.77, 2.61, 7.38, 'No Round + Nut + FW: 4.77 + 2.61 = 7.38'],
    ['manual', null, '7.50', 7.50, 0, 7.50, 'Manual RM7.50, no accessories: RM7.50'],
    ['manual', { nut: NUT, fw: FW }, '7.50', 4.89, 2.61, 7.50, 'Manual RM7.50 + Nut + FW: the typed RM7.50 is the customer price, bolt 4.89'],
  ];
  for (const [mode, acc, manual, bolt, accU, final, label] of CASES) {
    const r = await page.evaluate(FORM(mode, acc, manual));
    A.eq([r.bolt, r.acc, r.final], [bolt, accU, final], `form ${label}`);
    A.includes(r.shown, final.toFixed(2), `form ${label}: the screen shows ${final.toFixed(2)}`);
  }

  /* ── added item, print, WhatsApp — one inclusive figure, breakdown kept ── */
  await page.evaluate(FORM('auto', { nut: NUT, fw: FW }));
  const added = await page.evaluate(() => {
    addStud();
    const it = quoteItems[0] || {};
    return { n: quoteItems.length, final: +it.finalUnitPrice, bolt: +it.boltUnitPrice, acc: +it.accessoryUnitPrice,
             total: +it.totalAmount, accTotal: +it.accessoryTotal, wa: buildWAItemsText('-'), model: it.pricingModel };
  });
  A.eq(added.n, 1, 'added: one line');
  A.eq([added.bolt, added.acc, added.final], [4.79, 2.61, 7.40], 'added: bolt 4.79 · accessories 2.61 · final 7.40');
  A.eq(added.total, 74.00, 'added: total = 7.40 × 10 = 74.00');
  A.eq(added.accTotal, 26.10, 'added: accessory total = 2.61 × 10, counted once');
  A.eq(added.model, 'accessory-inclusive', 'added: accessory-inclusive model');
  A.includes(added.wa, '7.40', 'WhatsApp: the unit price is 7.40');
  A.excludes(added.wa, '7.41', 'WhatsApp: never the old bolt-then-add 7.41');
  A.excludes(added.wa, '2.61', 'WhatsApp: no separate accessory charge');
  const printed = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    const rows = Array.from(document.querySelectorAll('#printItemsBody tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim()));
    const grand = document.getElementById('printGrandTotal').textContent.trim();
    window.dispatchEvent(new Event('afterprint'));
    return { rows, grand };
  });
  A.eq(printed.rows.length, 1, 'print: one row, no separate accessory row');
  A.eq(printed.rows[0] && printed.rows[0][4], 'RM 7.40', 'print: Unit Price RM 7.40');
  A.eq(printed.grand, 'RM 74.00', 'print: total RM 74.00');

  /* ── edit and update: no double rounding, no second accessory charge ── */
  const edited = await page.evaluate(() => {
    editItem(0);
    calcStud();
    const st = priceCalcState.stud || {};
    const inForm = +(+st.finalUnitPrice).toFixed(2);
    addStud();                                   // Update Item
    const it = quoteItems[0] || {};
    return { inForm, n: quoteItems.length, final: +it.finalUnitPrice, bolt: +it.boltUnitPrice, acc: +it.accessoryUnitPrice };
  });
  A.eq(edited.inForm, 7.40, 'edit: the reopened form computes 7.40 again (rounded once, not twice)');
  A.eq(edited.n, 1, 'update: still one line');
  A.eq([edited.bolt, edited.acc, edited.final], [4.79, 2.61, 7.40], 'update: 4.79 + 2.61 = 7.40, unchanged');

  /* ── save → reopen ── */
  let payload = null;
  await page.route('**/api.php?action=save_quotation*', r => { try { payload = JSON.parse(r.request().postData() || 'null'); } catch (e) {}
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { id: 7, ref_no: 'DC-TEST-001' } }) }); });
  await page.evaluate(() => api('save_quotation', { ref_no: 'DC-TEST-001', quote_date: '2026-11-04', customer_name: 'ADVANCE', items: quoteItems,
    total_amount: quoteItems.reduce((s, i) => s + i.totalAmount, 0) }, 'POST'));
  A.ok(payload && payload.items && payload.items.length === 1, 'save: one item sent');
  const sent = payload.items[0];
  A.eq([+sent.boltUnitPrice, +sent.accessoryUnitPrice, +sent.finalUnitPrice], [4.79, 2.61, 7.40], 'save: the record carries bolt 4.79, accessories 2.61, final 7.40');
  A.eq(sent.autoRoundStage, 'final', 'save: the record says it was rounded at the final stage (R2.3)');
  await page.close();

  const back = await openApp(browser, { handoff: { id: 7, ref_no: 'DC-TEST-001', customer_name: 'ADVANCE', items: payload.items } });
  const re = await back.evaluate(() => { const it = quoteItems[0] || {};
    return { final: +it.finalUnitPrice, bolt: +it.boltUnitPrice, acc: +it.accessoryUnitPrice, total: +it.totalAmount, wa: buildWAItemsText('-') }; });
  A.eq([re.bolt, re.acc, re.final, re.total], [4.79, 2.61, 7.40, 74.00], 'reopen: 4.79 / 2.61 / 7.40 / 74.00 exactly as saved');
  A.includes(re.wa, '7.40', 'reopen: WhatsApp still 7.40');
  await back.close();

  /* ── Quick Add: typed accessories, then a confirmed proposal ── */
  const qa = await openApp(browser);
  await quickAddPaste(qa, 'MS STUD BOLT ZP\nM12 x 300 - 10pcs', { settle: 900 });
  const qrow = await qa.evaluate(async ([S, N, F]) => {
    const r = wqa.rows[0];
    if (!r) return { none: true, rows: wqa.rows.length };
    wqaEditPrice(0, 'costRate', S.rate); wqaEditPrice(0, 'addCost', S.add); wqaEditPrice(0, 'markup', S.markup);
    wqaEditAcc(0, 'nut', 'enabled', true); wqaEditAcc(0, 'nut', 'qty', +N.qty); wqaEditAcc(0, 'nut', 'unitPrice', +N.price);
    wqaEditAcc(0, 'fw', 'enabled', true); wqaEditAcc(0, 'fw', 'qty', +F.qty); wqaEditAcc(0, 'fw', 'unitPrice', +F.price);
    await new Promise(x => setTimeout(x, 900));
    const c = wqa.rows[0].calc || {};
    return { type: r.type || r.itemType, raw: +c.rawUnitPrice, bolt: +(+c.boltUnitPrice).toFixed(2), final: +(+c.finalUnitPrice).toFixed(2), dia: c.diameter };
  }, [SPEC, NUT, FW]);
  A.ok(!qrow.none, `Quick Add: the stud line is read (${JSON.stringify(qrow)})`);
  /* the stud's diameter comes from the table here; the rule is what is held */
  A.eq(qrow.final, +(qrow.bolt + 2.61).toFixed(2), `Quick Add typed accessories: final = bolt component + 2.61 (${qrow.bolt} + 2.61 = ${qrow.final})`);
  A.ok(Math.abs(qrow.final * 10 - Math.round(qrow.final * 10)) < 1e-9, `Quick Add (R2.3): the FINAL sits on an RM0.10 band (${qrow.final}) — rounded once, combined`);

  const confirmed = await qa.evaluate(async () => {
    const r = wqa.rows[0];
    wqaEditAcc(0, 'nut', 'enabled', false); wqaEditAcc(0, 'fw', 'enabled', false);
    await new Promise(x => setTimeout(x, 700));
    const before = +(+wqa.rows[0].calc.finalUnitPrice).toFixed(2);
    /* built exactly as an uploaded drawing's note builds it (wqaAiApply) */
    const a = wqaAccScan('C/W 4 Nuts & 4 Flat Washers');
    r.accProposed = wqaAccFromSpec({ nut: a.nut, fw: a.fw, finish: a.finish, custom: a.custom, need: [] }, r.finish);
    r.accProposedFrom = 'C/W 4 Nuts & 4 Flat Washers';
    if (typeof wqaAccPropConfirm === 'function') wqaAccPropConfirm([0]);
    await new Promise(x => setTimeout(x, 700));
    const c = wqa.rows[0].calc || {};
    return { before, after: +(+c.finalUnitPrice).toFixed(2), acc: +accAddon(wqa.rows[0].acc).toFixed(2),
             nut: wqa.rows[0].acc && wqa.rows[0].acc.nut, fw: wqa.rows[0].acc && wqa.rows[0].acc.fw };
  });
  A.ok(confirmed.nut && confirmed.nut.enabled && confirmed.fw && confirmed.fw.enabled, 'Quick Add proposal confirmed: Nut and FW on the row');
  A.eq(confirmed.acc, 0, 'Quick Add proposal confirmed: no silent cost (unit price 0 until someone prices it)');
  A.eq(confirmed.after, confirmed.before, `Quick Add proposal confirmed: the price does not move (${confirmed.before})`);
  A.eq(qa._dcErrors, [], 'no page errors');
  await qa.close();
};
