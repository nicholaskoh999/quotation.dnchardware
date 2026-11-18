/* ── SOS Bulk Edit Pricing (Step 3 Quotation List) ─────────────────────────
   One focused gate for the fast fix:
     · a locked saved quotation refuses Select mode until it is unlocked;
     · only the SELECTED items change, and only the TICKED fields;
     · the repriced figure is the entry form's arithmetic, No Round kept;
     · material / size / finish / identity / order are untouched;
     · the Update Quotation payload carries every other item byte-for-byte and
       passes the server's accepted-price rule.                              */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');

const U = n => 'itm_' + String(n).repeat(32).slice(0, 32);

module.exports = async (browser, A) => {
  A.suite('bulk edit pricing — selected items, ticked fields only');

  let updatePayload = null;
  const page = await openApp(browser, {
    api: {
      save_quotation: (url, req) => {
        const p = JSON.parse(req.postData() || 'null');
        const items = (p.items || []).map((it, i) => Object.assign({}, it, { item_uid: U(i + 1) }));
        return { ok: true, id: 77, ref_no: 'DC-TEST-001', items };
      },
      update_quotation: (url, req) => {
        updatePayload = JSON.parse(req.postData() || 'null');
        return { ok: true, items: updatePayload.items };
      },
    },
  });

  await quickAddPaste(page, [
    'MS SAG ROD PL FULLSIZE',
    'M20 x 1000 x 100/100 - 10pcs',
    'M20 x 1200 x 100/100 - 10pcs',
    'M16 x 1500 x 100/100 - 4pcs',
    '',
    'MS ANCHOR BOLT HDG FULLSIZE',
    'M16 x 300 x 100 - 6pcs',
  ].join('\n'), { settle: 900 });
  await page.evaluate(() => { wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '5'); wqaEditPrice(i, 'addCost', '1'); }); });
  await page.waitForTimeout(700);
  await page.evaluate(() => wqaAddAll());
  await page.waitForTimeout(1000);
  A.eq(await page.evaluate(() => quoteItems.length), 4, 'four items reached the quotation');

  await page.evaluate(() => { document.getElementById('qi-customer').value = 'Alpha Sdn Bhd'; syncQI(); });
  await page.evaluate(async () => { await openSaveModal(); });
  await page.waitForTimeout(200);
  await page.evaluate(async () => { await doSaveQuotation(); });
  await page.waitForTimeout(900);

  // ── locked: Select mode refused ───────────────────────────────────────────
  const lockedTry = await page.evaluate(() => { dcBpToggleSelect(); return { locked: quoteLocked, sel: dcBpSelecting }; });
  A.ok(lockedTry.locked && !lockedTry.sel, 'a locked saved quotation refuses Select mode');

  // ── unlock -> select items 1 and 3 -> Cost Rate 6 + Markup 10 ────────────
  const before = await page.evaluate(() => JSON.parse(JSON.stringify(quoteItems)));
  const r = await page.evaluate(() => {
    unlockSavedQuotation();
    dcBpToggleSelect();
    const cards = document.querySelectorAll('#quoteItemList .qi-chk input').length;
    dcBpToggleItem(0); dcBpToggleItem(2);
    dcBpOpen();
    const open = document.getElementById('bpModal').classList.contains('open');
    document.getElementById('bpVal-costRate').value = '6'; dcBpTick('costRate');
    document.getElementById('bpVal-markup').value = '10'; dcBpTick('markup');
    const rows = document.querySelectorAll('#bpPreview tbody tr').length;
    const sum = document.getElementById('bpSum').textContent;
    const applyEnabled = !document.getElementById('bpApplyBtn').disabled;
    dcBpApply();
    return { sel: dcBpSelecting, cards, open, rows, sum, applyEnabled, after: JSON.parse(JSON.stringify(quoteItems)) };
  });
  A.ok(r.sel && r.cards === 4, 'unlocked: Select mode shows a checkbox on every item');
  A.ok(r.open && r.rows === 2, 'the modal previews exactly the two selected items');
  A.ok(/→/.test(r.sum) && r.applyEnabled, 'the preview shows the quotation total change and Apply is enabled');

  const strip = it => { const c = JSON.parse(JSON.stringify(it)); return c; };
  A.eq(JSON.stringify(strip(r.after[1])), JSON.stringify(strip(before[1])), 'unselected item 2 is byte-for-byte unchanged');
  A.eq(JSON.stringify(strip(r.after[3])), JSON.stringify(strip(before[3])), 'unselected item 4 is byte-for-byte unchanged');

  for (const k of [0, 2]) {
    const o = before[k], n = r.after[k];
    const expectRaw = ((parseFloat(o.weight) * 6) + 1) * 1.1;
    const expectUnit = Math.round(Math.round(expectRaw * 100) / 100 * 100) / 100;   // No Round
    A.eq(n.priceMode, o.priceMode, `item ${k + 1}: price mode kept (${o.priceMode})`);
    A.eq(n.finalUnitPrice, expectUnit, `item ${k + 1}: unit price = (weight x 6 + 1) x 1.10, No Round`);
    A.eq(n.totalAmount, Math.round(expectUnit * o.qty * 100) / 100, `item ${k + 1}: line total = unit x qty`);
    A.eq(n.qty, o.qty, `item ${k + 1}: QTY untouched (not ticked)`);
    A.eq(n.formData.addCost, o.formData.addCost, `item ${k + 1}: Additional Cost untouched (not ticked)`);
    A.eq(n.formData.costRate, '6', `item ${k + 1}: recipe records Cost Rate 6`);
    A.eq(String(n.formData.markup), '10', `item ${k + 1}: recipe records Markup 10`);
    A.ok(n.material === o.material && n.size === o.size && n.finish === o.finish && n.desc === o.desc,
      `item ${k + 1}: material / size / finish / description unchanged`);
    A.eq(n.item_uid, o.item_uid, `item ${k + 1}: identity kept`);
    A.eq(n.priceAcceptance.value, n.finalUnitPrice, `item ${k + 1}: accepted price matches the new unit price`);
  }

  // ── QTY only on item 2: unit price stays, total follows ──────────────────
  const q = await page.evaluate(() => {
    dcBpSelectAll(false); dcBpToggleItem(1); dcBpOpen();
    document.getElementById('bpVal-qty').value = '25'; dcBpTick('qty');
    dcBpApply();
    return JSON.parse(JSON.stringify(quoteItems[1]));
  });
  A.eq(q.qty, 25, 'QTY-only edit sets the new quantity');
  A.eq(q.finalUnitPrice, before[1].finalUnitPrice, 'QTY-only edit keeps the unit price');
  A.eq(q.totalAmount, Math.round(before[1].finalUnitPrice * 25 * 100) / 100, 'QTY-only edit recomputes the line total');

  // ── Update Quotation: other items intact, order and identity intact ──────
  await page.evaluate(() => dcBpToggleSelect(false));
  await page.evaluate(async () => { await openSaveModal(); });
  await page.waitForTimeout(200);
  await page.evaluate(async () => { await doSaveQuotation(); });
  await page.waitForTimeout(900);
  A.ok(updatePayload && updatePayload.items.length === 4, 'Update Quotation sent all four items');
  A.eq(JSON.stringify(updatePayload.items.map(i => i.item_uid)), JSON.stringify([U(1), U(2), U(3), U(4)]),
    'item order and identity are unchanged in the saved revision');
  A.eq(JSON.stringify(updatePayload.items[3]), JSON.stringify(before[3]), 'the never-selected item is saved exactly as it was');
  A.ok(updatePayload.items.every(i => !i.priceAcceptance || Math.abs(i.priceAcceptance.value - i.finalUnitPrice) < 0.005),
    'every item passes the server accepted-price rule');
  const total = Math.round(updatePayload.items.reduce((s, i) => s + i.totalAmount, 0) * 100) / 100;
  A.eq(Math.round(updatePayload.total_amount * 100) / 100, total, 'quotation total = sum of line totals');
  A.ok(await page.evaluate(() => quoteLocked), 'the quotation is locked again after Update');

  await page.close();
};
