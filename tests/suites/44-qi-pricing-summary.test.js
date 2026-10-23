/* ── Quotation List card: dimensions + internal pricing composition ────────
   The right-side card shows Total Length (bent products), Qty, Weight, and a
   staff-only pricing line — Cost Rate · Add Cost · Accessories · Markup · Auto
   — so nobody has to press Edit to see how a price was made. Manual Price is an
   override of the FINAL unit price only: the Auto Round figure the calculation
   produced stays on the card beside it, with the override difference.

   Items are committed through the real add paths. Print and WhatsApp are read
   from the shipped builders and must not carry any of the internal figures. */
'use strict';
const { openApp } = require('../lib/harness');

/* Fill a product form the way Load & Edit does, then run its real Add. */
async function addItem(page, type, fields, acc) {
  return page.evaluate(({ type, fields, acc }) => {
    switchType(type);
    Object.entries(fields).forEach(([k, v]) => setFieldValue(type, k, v));
    onPriceModeChange(type);
    if (acc) {
      el(type + '-nutEnabled').checked = true; el(type + '-nutQty').value = String(acc.nut);
      el(type + '-nutPrice').value = String(acc.nutPrice);
      el(type + '-fwEnabled').checked = true;  el(type + '-fwQty').value = String(acc.fw);
      el(type + '-fwPrice').value = String(acc.fwPrice);
    }
    ({ ubolt: addUBolt, lbolt: () => addLBolt('lbolt') })[type]();
    return quoteItems.length;
  }, { type, fields, acc });
}
const card = (page, i) => page.evaluate(i => {
  const cards = [...document.querySelectorAll('#quoteItemList .qi-item')];
  const c = cards.find(c => c.querySelector('.qi-num').textContent.trim() === String(i + 1));
  const q = s => (c.querySelector(s) || {}).textContent || '';
  return { pricing: q('.qi-pricing').replace(/\s+/g, ' ').trim(), unit: q('.qi-unitline').replace(/\s+/g, ' ').trim(),
           override: q('.qi-override').trim(), meta: q('.qi-qtyweight').replace(/\s+/g, ' ').trim(),
           cw: q('.qi-cw').trim(), dim: q('.qi-dim').trim(), total: q('.qi-total').trim(),
           hasEdit: !!c.querySelector('.qi-edit-btn'), width: c.scrollWidth - c.clientWidth };
}, i);

const UB = { material: 'MS', sizeType: 'UNDERSIZE', size: '3/8', diameter: '8.2', id: '274', ih: '320',
             threadLen: '75', length: '810', costRate: '3.50', addCost: '3.00', markup: '5', qty: '1' };
const LB = { material: '4140', sizeType: 'FULLSIZE', size: 'M24', diameter: '24', l: '400', w: '80',
             threadLen: '75', length: '444', costRate: '2.80', addCost: '0', markup: '5', qty: '4' };

module.exports = async (browser, A) => {
  A.suite('quotation list card — dimensions, internal pricing, manual override');
  let payload = null;
  const page = await openApp(browser, { api: { save_quotation: (u, req) => {
    try { payload = JSON.parse(req.postData() || 'null'); } catch (e) {}
    return { ok: true, id: 77, ref_no: 'DC-TEST-001' };
  } } });

  // 1 · U-Bolt Auto Round
  await addItem(page, 'ubolt', { ...UB, priceMode: 'auto' });
  let c = await card(page, 0);
  A.includes(c.dim, 'ID', 'U-Bolt card keeps its own dimension format (ID / IH / TL)');
  A.includes(c.meta, 'Total Length 810mm', 'U-Bolt card shows the stored Total Length');
  A.includes(c.meta, 'Qty 1', 'and Qty');
  A.includes(c.meta, 'Weight 0.336kg', 'and Weight');
  A.eq(c.pricing, 'Cost 3.50 · Add 3.00 · Markup 5% · Calc 4.40', 'U-Bolt pricing composition line');
  A.includes(c.unit, 'Unit RM 4.40', 'Auto: unit is the calculated price');
  A.includes(c.unit, 'Auto Round', 'Auto: mode label says Auto Round');
  A.eq(c.override, '', 'Auto: no Manual Override line');
  A.excludes(c.pricing, 'Acc ', 'no accessories → no Accessories RM 0.00');
  A.eq(c.cw, '', 'no accessories → no accessories line');

  // 2 · U-Bolt Manual Price RM4.50 over Auto RM4.40
  await addItem(page, 'ubolt', { ...UB, priceMode: 'manual', manualUnitPrice: '4.50' });
  c = await card(page, 1);
  A.includes(c.pricing, 'Calc 4.40', 'Manual: the Auto price stays visible');
  A.includes(c.pricing, 'Markup 5%', 'Manual: markup shown as the pricing markup');
  A.includes(c.unit, 'Unit RM 4.50', 'Manual: unit is the typed override');
  A.includes(c.unit, 'Manual Override', 'Manual: labelled Manual Override');
  A.eq(c.override, 'Override +RM 0.10 (+2.3%)', 'Manual: override difference vs Auto, not vs markup');
  A.includes(c.total, 'RM 4.50', 'Manual: total uses the override');
  const stored = await page.evaluate(() => ({ r: quoteItems[1].roundedUnitPrice, f: quoteItems[1].finalUnitPrice }));
  A.near(stored.r, 4.40, 1e-9, 'the item stores the Auto Round price beside the manual one');
  A.near(stored.f, 4.50, 1e-9, 'final unit price is the manual one (unchanged pricing)');

  // 3 · L-Bolt Auto Round, Qty 4
  await addItem(page, 'lbolt', { ...LB, priceMode: 'auto' });
  c = await card(page, 2);
  const lb = await page.evaluate(() => ({ u: quoteItems[2].finalUnitPrice, t: quoteItems[2].totalAmount }));
  A.includes(c.dim, 'L', 'L-Bolt keeps its own dimension format');
  A.includes(c.meta, 'Total Length 444mm', 'L-Bolt shows stored Total Length');
  A.includes(c.meta, 'Qty 4', 'Qty 4');
  A.includes(c.meta, 'Weight 6.307kg', 'line weight = unit weight x qty');
  A.eq(c.pricing, `Cost 2.80 · Add 0.00 · Markup 5% · Calc ${lb.u.toFixed(2)}`, 'L-Bolt pricing line');
  A.includes(c.unit, 'Auto Round', 'L-Bolt auto label');
  A.near(lb.t, lb.u * 4, 1e-9, 'Qty > 1: total = unit x qty');
  A.includes(c.total, 'RM ' + (lb.u * 4).toFixed(2), 'card total follows qty');

  // 4 · L-Bolt Manual Price
  await addItem(page, 'lbolt', { ...LB, priceMode: 'manual', manualUnitPrice: '14.50' });
  c = await card(page, 3);
  const diff = 14.50 - lb.u;
  A.includes(c.pricing, 'Calc ' + lb.u.toFixed(2), 'L-Bolt manual keeps Auto visible');
  A.eq(c.override, `Override +RM ${diff.toFixed(2)} (+${(diff / lb.u * 100).toFixed(1)}%)`, 'L-Bolt override line');
  A.includes(c.total, 'RM 58.00', 'manual 14.50 x 4 = 58.00');

  // 5 · item with accessories (2 nut @0.30 + 2 FW @0.10 = RM0.80)
  await addItem(page, 'ubolt', { ...UB, priceMode: 'auto' }, { nut: 2, nutPrice: 0.30, fw: 2, fwPrice: 0.10 });
  c = await card(page, 4);
  A.includes(c.cw, '2nut', 'accessories line lists the nuts');
  A.includes(c.cw, '2fw', 'and the washers');
  A.eq(c.pricing, 'Cost 3.50 · Add 3.00 · Acc 0.80 · Markup 5% · Calc 5.20', 'accessory pricing in the composition');
  A.includes(c.unit, 'Unit RM 5.20', 'unit includes accessories');

  // manual with accessories: override compared against the accessory-inclusive Auto
  await addItem(page, 'ubolt', { ...UB, priceMode: 'manual', manualUnitPrice: '5.50' }, { nut: 2, nutPrice: 0.30, fw: 2, fwPrice: 0.10 });
  c = await card(page, 5);
  A.includes(c.pricing, 'Calc 5.20', 'manual+accessories: Auto includes accessories');
  A.eq(c.override, 'Override +RM 0.30 (+5.8%)', 'manual+accessories override');

  // manual with no cost rate: no invented Auto price
  await addItem(page, 'lbolt', { ...LB, costRate: '', addCost: '', priceMode: 'manual', manualUnitPrice: '9.00' });
  c = await card(page, 6);
  A.excludes(c.pricing, 'Calc', 'manual without a rate: no Auto figure invented');
  A.eq(c.override, '', 'and no override line');
  A.includes(c.unit, 'Manual Override', 'still labelled Manual Override');

  // no horizontal overflow at desktop width
  const overflow = await page.evaluate(() => [...document.querySelectorAll('#quoteItemList .qi-item')].some(c => c.scrollWidth > c.clientWidth + 1));
  A.ok(!overflow, 'no card overflows horizontally at 1440px');

  // 9 / 10 · Print and WhatsApp carry no internal costing
  const out = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    const print = el('printSummary').innerText;
    window.dispatchEvent(new Event('afterprint'));
    return { print, wa: buildWAItemsText(), quote: buildQuoteText() };
  });
  A.ok(out.print.includes('4.50'), 'print sheet was built (has the manual unit price)');
  ['Cost Rate', 'Cost 3', 'Add Cost', 'Additional Cost', 'Markup', 'Calc', 'Override', 'Manual Override'].forEach(w => {
    A.excludes(out.print, w, `print never shows "${w}"`);
    A.excludes(out.wa, w, `WhatsApp never shows "${w}"`);
    A.excludes(out.quote, w, `quotation text never shows "${w}"`);
  });

  // 7 · saved / locked quotation keeps the same summary
  await page.evaluate(async () => {
    await api('save_quotation', { ref_no: el('qi-refno').value, quote_date: el('qi-date').value,
      customer_name: 'Locked Co', customer_phone: '', prepared_by: '', remarks: '', company_id: null,
      items: quoteItems, total_amount: quoteItems.reduce((s, i) => s + i.totalAmount, 0) }, 'POST');
  });
  const re = await openApp(browser, { handoff: { id: 77, ref_no: 'DC-TEST-001', quote_date: payload.quote_date,
                                                 customer_name: 'Locked Co', items: payload.items } });
  const locked = await re.evaluate(() => quoteLocked && loadedSavedQuote);
  A.ok(locked, 'reopened quotation is locked');
  c = await card(re, 1);
  A.ok(!c.hasEdit, 'locked: Edit button hidden');
  A.includes(c.meta, 'Total Length 810mm', 'locked: Total Length still visible');
  A.includes(c.meta, 'Weight 0.336kg', 'locked: Weight still visible');
  A.includes(c.pricing, 'Cost 3.50 · Add 3.00 · Markup 5% · Calc 4.40', 'locked: pricing composition still visible');
  A.eq(c.override, 'Override +RM 0.10 (+2.3%)', 'locked: override still visible');
  c = await card(re, 4);
  A.includes(c.pricing, 'Acc 0.80', 'locked: accessory pricing still visible');

  // legacy item saved before price-mode data existed: no crash, no invented Auto
  const legacy = await re.evaluate(() => {
    quoteItems.push({ itemType: 'lbolt', desc: 'MS L BOLT', finish: 'PL', size: 'M20 x L 300 x W 60', qty: 2,
                      markup: 0, material: 'MS', finalUnitPrice: 6, totalAmount: 12, weight: 1, priceMode: 'manual' });
    renderQuote(); return quoteItems.length;
  });
  c = await card(re, legacy - 1);
  A.excludes(c.pricing, 'Calc', 'legacy manual item: Auto unknown, not shown');
  A.excludes(c.meta, 'Total Length', 'legacy item without stored length: no Total Length');
  A.includes(c.unit, 'Unit RM 6.00', 'legacy item still shows its unit');

  // 中文 labels render
  const zh = await page.evaluate(() => { dcSetLang('zh'); const t = document.querySelector('#quoteItemList .qi-pricing').textContent; dcSetLang('en'); return t; });
  A.includes(zh, 'Markup', 'zh: Markup stays English (approved wording)'); A.excludes(zh, '利润', 'zh: no old 利润 label');

  A.eq((page._dcErrors || []).concat(re._dcErrors || []).join(' | '), '', 'no page errors');
  await page.close(); await re.close();
};
