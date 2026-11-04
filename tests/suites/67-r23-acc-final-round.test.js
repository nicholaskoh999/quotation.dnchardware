/* ── R2.3 Session F — Accessories: Auto Round at the final stage ─────────────
   OWNER CONTRACT OVERRIDE (R2.3, 2026-11-04): with accessories and Auto
   Round, the EXISTING engine (dcAutoRound: Sag Rod nearest RM0.05, others the
   RM0.10 band rule) rounds raw bolt + accessories once — Round(Base + Acc),
   superseding Round(Base) + Acc (Stage 0B / a173510). Held here:
     - the owner's example through the real Sag Rod form;
     - non-Sag through the band rule; no accessories → unchanged;
     - No Round unrounded; Manual = typed price; Sag Rod new items on No Round;
     - rounded once: final = engine(raw + acc), bolt = final − acc, stable on
       recalculation and Update;
     - an item saved under the old rule reopens, prints and sends exactly as
       saved, and an Update that changes nothing price-affecting keeps it;
     - zero-price confirmed proposals add nothing; Quick Add follows the rule.  */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');

/* Sag Rod M12 (Ø12) × L1000: weight 0.8878176 kg × RM5.00 + RM3.11 = RM7.5491
   base ("RM7.55"), +4 % = RM7.8511 raw. Auto: Round(7.8511) = RM7.85 (the
   owner's "existing rounded base"). Accessories: 1 Nut × RM0.16 + 1 FW ×
   RM0.10 = RM0.26. Old: 7.85 + 0.26 = 8.11. New: Round(7.8511 + 0.26 =
   8.1111) = RM8.10 — the engine's answer, not a forced figure. */
const SAG = `(mode, acc) => {
  quoteItems.length = 0; editingItemIndex = null;
  switchType('sagrod'); resetAccPanel('sagrod');
  const s = (id, v) => { document.getElementById(id).value = v; };
  s('sagrod-material', 'MS'); s('sagrod-sizeType', 'FULLSIZE');
  s('sagrod-size', 'M12'); onSizeCommit('sagrod');
  s('sagrod-diameter', '12'); s('sagrod-length', '1000'); s('sagrod-threadLen', '100/100'); s('sagrod-qty', '10');
  s('sagrod-costRate', '5'); s('sagrod-addCost', '3.11'); s('sagrod-markup', '4');
  if (mode) { setFieldValue('sagrod', 'priceMode', mode); onPriceModeChange && onPriceModeChange('sagrod'); }
  if (acc) {
    document.getElementById('sagrod-nutEnabled').checked = true; onAccChange('sagrod'); s('sagrod-nutQty', '1'); s('sagrod-nutPrice', '0.16'); onAccChange('sagrod');
    document.getElementById('sagrod-fwEnabled').checked = true; onAccChange('sagrod'); s('sagrod-fwQty', '1'); s('sagrod-fwPrice', '0.10'); onAccChange('sagrod');
  }
  calcSagRod();
  const st = priceCalcState.sagrod;
  return { mode: getPriceMode('sagrod'), raw: +st.rawUnitPrice.toFixed(4), bolt: +st.boltUnitPrice.toFixed(2), acc: +st.accessoriesCost.toFixed(2),
           final: +st.finalUnitPrice.toFixed(2), shown: document.getElementById('cpFinal').textContent.trim() };
}`;

module.exports = async (browser, A) => {
  A.suite('67 R2.3 Session F: accessories — Auto Round on the combined final price');
  let page = await openApp(browser);

  /* ── the owner's example, through the real form ── */
  const fresh = await page.evaluate(`(${SAG})(null, false)`);
  A.eq(fresh.mode, 'no_round', 'a new Sag Rod starts on No Round (unchanged default)');
  const none = await page.evaluate(`(${SAG})('auto', false)`);
  A.eq(none.raw, 7.8511, 'raw Sag Rod price RM7.8511 (base RM7.55 + 4 %)');
  A.eq([none.bolt, none.final], [7.85, 7.85], 'Auto, no accessories: RM7.85 — unchanged');
  const auto = await page.evaluate(`(${SAG})('auto', true)`);
  A.eq(auto.acc, 0.26, 'accessories RM0.26 (1 Nut × 0.16 + 1 FW × 0.10)');
  A.eq(auto.final, 8.10, 'Auto + accessories: Round(7.8511 + 0.26 = 8.1111) = RM8.10 (old rule gave 7.85 + 0.26 = 8.11)');
  A.eq(auto.bolt, 7.84, 'bolt component = final − accessories = 7.84 (never rounded on its own)');
  A.includes(auto.shown, '8.10', 'the screen shows RM8.10');
  const engine = await page.evaluate(() => [dcAutoRound('sagrod', 7.8511 + 0.26), round05(7.8511 + 0.26)]);
  A.eq(engine, [8.10, 8.10], 'it IS the existing Sag Rod engine (round05) on the combined raw input');
  const nr = await page.evaluate(`(${SAG})('no_round', true)`);
  A.eq([nr.bolt, nr.final], [7.85, 8.11], 'No Round + accessories: 7.85 + 0.26 = 8.11 — unrounded, unchanged');
  const man = await page.evaluate(() => { setFieldValue('sagrod', 'priceMode', 'manual'); setFieldValue('sagrod', 'manualUnitPrice', '8.50'); calcSagRod();
    const st = priceCalcState.sagrod; return [+st.boltUnitPrice.toFixed(2), +st.finalUnitPrice.toFixed(2)]; });
  A.eq(man, [8.24, 8.50], 'Manual RM8.50 + accessories: the typed price stands, bolt 8.24 — unchanged');

  /* ── non-Sag through the band rule ── */
  const bands = await page.evaluate(() => {
    const run = (t, mode, raw, acc) => { setFieldValue(t, 'priceMode', mode); setFieldValue(t, 'manualUnitPrice', '');
      const f = resolvePriceMode(t, raw, 0, acc); const st = priceCalcState[t]; setFieldValue(t, 'priceMode', 'auto');
      return [+st.boltUnitPrice.toFixed(2), +f.toFixed(2)]; };
    return { stud: run('stud', 'auto', 6.43, 0.65), studNone: run('stud', 'auto', 6.43, 0), jb: run('jbolt', 'auto', 10.24, 1.12),
             lbNR: run('lbolt', 'no_round', 6.43, 0.65), twice: [resolvePriceMode('stud', 6.43, 0, 0.65), resolvePriceMode('stud', 6.43, 0, 0.65)] };
  });
  A.eq(bands.stud, [6.45, 7.10], 'Stud: Round(6.43 + 0.65 = 7.08) = 7.10 by the RM0.10 band rule, bolt 6.45');
  A.eq(bands.studNone, [6.40, 6.40], 'Stud without accessories: 6.43 → 6.40 — unchanged');
  A.eq(bands.jb, [10.28, 11.40], 'J Bolt: Round(10.24 + 1.12 = 11.36) = 11.40');
  A.eq(bands.lbNR, [6.43, 7.08], 'L Bolt No Round: 6.43 + 0.65 = 7.08 exactly');
  A.eq(bands.twice, [7.10, 7.10], 'resolving again gives the same answer (never rounded twice)');

  /* ── add / edit / update / print / WhatsApp / save agree ── */
  await page.evaluate(`(${SAG})('auto', true)`);
  const added = await page.evaluate(() => { addSagRod(); const it = quoteItems[0];
    return { f: +it.finalUnitPrice, b: +it.boltUnitPrice, a: +it.accessoryUnitPrice, t: +it.totalAmount, stage: it.autoRoundStage, wa: buildWAItemsText('-') }; });
  A.eq([added.b, added.a, added.f, added.t], [7.84, 0.26, 8.10, 81.00], 'added: 7.84 + 0.26 = 8.10 × 10 = 81.00');
  A.eq(added.stage, 'final', 'the item records autoRoundStage "final"');
  A.includes(added.wa, '8.10', 'WhatsApp: RM8.10');
  const printed = await page.evaluate(() => { window.dispatchEvent(new Event('beforeprint'));
    const row = [...document.querySelectorAll('#printItemsBody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()))[0];
    const g = document.getElementById('printGrandTotal').textContent.trim(); window.dispatchEvent(new Event('afterprint')); return { u: row && row[4], g }; });
  A.eq([printed.u, printed.g], ['RM 8.10', 'RM 81.00'], 'print: RM 8.10, total RM 81.00');
  const upd = await page.evaluate(() => { editItem(0); calcSagRod(); const inForm = +priceCalcState.sagrod.finalUnitPrice.toFixed(2);
    addSagRod(); const it = quoteItems[0]; return { inForm, n: quoteItems.length, f: +it.finalUnitPrice, b: +it.boltUnitPrice }; });
  A.eq([upd.inForm, upd.n, upd.b, upd.f], [8.10, 1, 7.84, 8.10], 'edit + update: still 8.10, one line, bolt 7.84');
  let saved = null;
  await page.route('**/api.php?action=save_quotation*', r => { saved = JSON.parse(r.request().postData() || 'null');
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { id: 3, ref_no: 'DC-T-3' } }) }); });
  await page.evaluate(() => api('save_quotation', { ref_no: 'DC-T-3', quote_date: '2026-11-04', customer_name: 'X', items: quoteItems, total_amount: 81 }, 'POST'));
  const newItem = saved.items[0];
  A.eq([+newItem.finalUnitPrice, newItem.autoRoundStage], [8.10, 'final'], 'save: 8.10 and its rounding stage are stored');

  /* the manual card's "Auto" reference is the whole-piece Auto figure */
  const card = await page.evaluate(() => { setFieldValue('sagrod', 'priceMode', 'manual'); setFieldValue('sagrod', 'manualUnitPrice', '8.50');
    editItem(0); setFieldValue('sagrod', 'priceMode', 'manual'); setFieldValue('sagrod', 'manualUnitPrice', '8.50'); calcSagRod(); addSagRod();
    return dcItemPricingSummary(quoteItems[0]); });
  A.eq([card.mode, card.final, card.auto], ['manual', 8.50, 8.10], 'Manual 8.50 on the card: its Auto reference is RM8.10 (the R2.3 whole-piece Auto)');
  await page.close();

  /* ── an item saved under the OLD rule: never re-priced ── */
  const legacy = JSON.parse(JSON.stringify(newItem));
  delete legacy.autoRoundStage; delete legacy.autoFinalUnitPrice;
  Object.assign(legacy, { finalUnitPrice: 8.11, lineUnitPrice: 8.11, boltUnitPrice: 7.85, accessoryUnitPrice: 0.26, totalAmount: 81.10, roundedUnitPrice: 7.85 });
  page = await openApp(browser, { handoff: { id: 5, ref_no: 'DC-OLD-5', customer_name: 'OLD', items: [legacy] } });
  const old = await page.evaluate(() => { const it = quoteItems[0]; window.dispatchEvent(new Event('beforeprint'));
    const u = [...document.querySelectorAll('#printItemsBody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()))[0];
    window.dispatchEvent(new Event('afterprint'));
    return { f: +it.finalUnitPrice, b: +it.boltUnitPrice, t: +it.totalAmount, wa: buildWAItemsText('-'), u: u && u[4], card: dcItemPricingSummary(it).auto }; });
  A.eq([old.b, old.f, old.t], [7.85, 8.11, 81.10], 'reopened old quotation: 7.85 / 8.11 / 81.10 exactly as saved');
  A.includes(old.wa, '8.11', 'old quotation WhatsApp: still RM8.11');
  A.eq(old.u, 'RM 8.11', 'old quotation print: still RM 8.11');
  const kept = await page.evaluate(() => { if (typeof unlockQuote === 'function') unlockQuote(); quoteLocked = false;
    editItem(0); addSagRod(); const it = quoteItems[0]; return { f: +it.finalUnitPrice, stage: it.autoRoundStage || null }; });
  A.eq(kept.f, 8.11, 'old item, Update with nothing price-affecting changed: the saved 8.11 stands');
  A.eq(kept.stage, null, 'and it still records no R2.3 stage (priced under the earlier rule)');
  const repriced = await page.evaluate(() => { editItem(0); setFieldValue('sagrod', 'priceMode', 'auto'); document.getElementById('sagrod-markup').value = '4.01'; calcSagRod(); addSagRod();
    const it = quoteItems[0]; return { f: +it.finalUnitPrice, stage: it.autoRoundStage }; });
  A.eq(repriced.stage, 'final', 'old item with its pricing EDITED: priced under the R2.3 rule from then on');
  A.eq(repriced.f, 8.10, `and Round(7.8586 + 0.26 = 8.1186) = 8.10`);
  await page.close();

  /* ── Quick Add: typed accessories follow the rule; a confirmed zero-price proposal adds nothing ── */
  page = await openApp(browser);
  await quickAddPaste(page, 'MS STUD BOLT ZP\nM12 x 300 - 10pcs', { settle: 900 });
  const qa = await page.evaluate(async () => {
    wqaEditPrice(0, 'costRate', '5.00'); wqaEditPrice(0, 'addCost', '3.13'); wqaEditPrice(0, 'markup', '7');
    await new Promise(x => setTimeout(x, 700));
    const before = wqa.rows[0].calc; const raw = (before.weight * 5 + 3.13) * 1.07, f0 = +(+before.finalUnitPrice).toFixed(2);   // weight × rate + add, + markup
    const a = wqaAccScan('C/W 4 Nuts & 4 Flat Washers');
    wqa.rows[0].accProposed = wqaAccFromSpec({ nut: a.nut, fw: a.fw, finish: a.finish, custom: a.custom, need: [] }, wqa.rows[0].finish);
    wqaAccPropConfirm([0]); await new Promise(x => setTimeout(x, 700));
    const f1 = +(+wqa.rows[0].calc.finalUnitPrice).toFixed(2);
    wqaEditAcc(0, 'nut', 'unitPrice', 0.16); wqaEditAcc(0, 'fw', 'unitPrice', 0.10); await new Promise(x => setTimeout(x, 700));
    const c = wqa.rows[0].calc; const f2 = +(+c.finalUnitPrice).toFixed(2);
    return { raw, f0, f1, f2, acc: +accAddon(wqa.rows[0].acc).toFixed(2), expect: dcAutoRound('stud', raw + accAddon(wqa.rows[0].acc)), bolt: +(+c.boltUnitPrice).toFixed(2) };
  });
  A.eq(qa.f1, qa.f0, `confirmed zero-price Nut/FW proposal: price unchanged (${qa.f0})`);
  A.eq(qa.acc, 1.04, 'once priced: 4 × 0.16 + 4 × 0.10 = 1.04');
  A.eq(qa.f2, qa.expect, `Quick Add: Round(raw ${qa.raw.toFixed(4)} + 1.04) = ${qa.expect}`);
  A.eq(+(qa.bolt + qa.acc).toFixed(2), qa.f2, 'Quick Add: bolt + accessories = final');
  await page.evaluate(() => wqaAddAll()); await page.waitForTimeout(1200);
  const qi = await page.evaluate(() => { const it = quoteItems[0] || {}; return { f: +it.finalUnitPrice, stage: it.autoRoundStage }; });
  A.eq([qi.f, qi.stage], [qa.f2, 'final'], 'Quick Add commits the same price, stage "final"');
  A.eq(page._dcErrors, [], 'no page errors');
  await page.close();
};
