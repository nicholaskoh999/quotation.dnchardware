/* ── Owner-smoke follow-up — Quick Add UX and history ──────────────────────
   ALL / GROUP / ITEM pricing edits, Effective Diameter as specification,
   possible repeated groups (warning only — the owner decides), Pricing
   History as the reference layer of the item's PRICING section with
   Exact / Similar / Reference only, Manual Price context, and Accessory
   History with the customer's display name, grouped by price.            */
'use strict';
const H = require('../lib/harness');

const BLK = 'M16 x 2970 x 100/100 - 4pcs\nM16 x 3000 x 100/100 - 4pcs\nM16 x 3280 x 100/100 - 4pcs';
const MSG = 'MS SAG ROD PL FULLSIZE\n' + BLK + '\nM12 x 1100 x 70/70 - 2pcs\n' + BLK;

const rec = (o) => Object.assign({
  quotationId: 1, refNo: 'Q-2026-0001', date: '2026-10-01', customer: 'ABC HARDWARE', companyId: 0, own: false,
  productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', finishMatch: true, cleanSize: 'M12',
  dimensionPreview: 'L 1100 x TL 70/70mm', exactDims: true, dimDistance: 0, qty: 4,
  unitPrice: 13.75, lineUnitPrice: 13.75, boltUnitPrice: 13.75, accessoryCost: 0, accessorySummary: '',
  accessoryAmbiguous: false, priceMode: 'auto', priceModeLabel: 'Auto Round',
  costRate: 2.8, addCost: 0.6, markup: 0, weight: 4.6877, legacy: false,
}, o);
const HIST = {
  ok: true, data: {
    records: [
      rec({}),
      rec({ quotationId: 2, refNo: 'Q-2026-0002', customer: 'XYZ ENGINEERING', dimensionPreview: 'L 1150 x TL 70/70mm',
            exactDims: false, dimDistance: 50, costRate: 2.6, unitPrice: 13.2, boltUnitPrice: 13.2 }),
      rec({ quotationId: 3, refNo: 'Q-2026-0003', finish: 'HDG', finishMatch: false, customer: 'LMN TRADING', unitPrice: 16.1, boltUnitPrice: 16.1 }),
      rec({ quotationId: 4, refNo: 'Q-2026-0004', priceMode: 'manual', priceModeLabel: 'Manual', unitPrice: 14.5,
            boltUnitPrice: 14.5, rawUnitPrice: 13.73, autoRoundUnitPrice: 13.75 }),
      rec({ quotationId: 5, refNo: 'Q-2026-0005', priceMode: 'manual', priceModeLabel: 'Manual', unitPrice: 14.0, boltUnitPrice: 14.0 }),
    ],
    total: 22, ownTotal: 0, otherTotal: 22, exactTotal: 3, closeTotal: 9, refTotal: 10, offset: 0, limit: 20,
  },
};
const ACC = { ok: true, data: { total: 3, records: [
  { type: 'Nut', size: 'M16', finish: 'PL', unitPrice: 0.15, refNo: 'Q-2026-1057', date: '2026-10-02', customer: 'ABC HARDWARE' },
  { type: 'Nut', size: 'M16', finish: 'PL', unitPrice: 0.15, refNo: 'Q-2026-0586', date: '2026-08-18', customer: 'XYZ ENGINEERING' },
  { type: 'Nut', size: 'M16', finish: 'PL', unitPrice: 0.18, refNo: 'Q-2026-0400', date: '2026-07-01', customer: 'LMN TRADING' },
] } };

async function open(b, width, extra = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 1000 } });
  const p = await H.openApp(b, Object.assign({ context: ctx, api: { get_pricing_history: HIST, get_accessory_history: ACC } }, extra));
  p.on('dialog', d => d.accept().catch(() => {}));
  await H.quickAddPaste(p, MSG, { expanded: false, settle: 900 });
  return { ctx, p };
}
const state = p => p.evaluate(() => wqa.rows.map((r, i) => ({ i, removed: !!r.removed, size: r.size, len: r.length, qty: String(r.qty),
  add: String((r.calc || {}).addCost), mk: String((r.calc || {}).markup), rate: String((r.calc || {}).costRate), px: (r.calc || {}).finalUnitPrice })));

module.exports = async (browser, A) => {
  A.suite('owner-smoke follow-up — group editing, Ø, repeated groups, pricing history');
  let { ctx, p } = await open(browser, 1440);

  // ── duplicate detection: A ───────────────────────────────────────────────
  let g = await p.evaluate(() => wqaRvGroups().map(g => ({ n: g.idx.length, dup: !!g.dupOf })));
  A.eq(JSON.stringify(g), '[{"n":3,"dup":false},{"n":1,"dup":false},{"n":3,"dup":true}]', 'A: the exact repeated group is flagged — the first stays unflagged');
  A.includes(await p.textContent('#wqaRows .wqa-dup'), 'Possible repeated group detected', 'A: the warning says so in English');
  A.eq(await p.evaluate(() => wqa.rows.filter(r => !r.removed).length), 7, 'A: detection removes nothing');

  // ── group-level inline edit ──────────────────────────────────────────────
  const before = await state(p);
  await p.click('.wqa-ser:nth-of-type(1) [data-gx="addCost"]');
  await p.waitForTimeout(200);
  A.eq(await p.evaluate(() => !!document.querySelector('[data-gx-in="addCost"]')), 'true', 'clicking Add. Cost on the heading opens it inline');
  await p.fill('[data-gx-in="addCost"]', '0.80');
  await p.press('[data-gx-in="addCost"]', 'Enter');
  await p.waitForTimeout(900);
  let after = await state(p);
  A.eq(after.slice(0, 3).map(r => r.add).join(','), '0.80,0.80,0.80', 'Enter applies 0.80 to every item of THIS group');
  A.eq(after.slice(3).map(r => r.add).join(','), '0.60,0.60,0.60,0.60', 'and to no item outside it');
  A.ok(after.slice(0, 3).every((r, k) => r.px > before[k].px), 'the group\'s rows are repriced');
  A.eq(after.slice(0, 3).map(r => r.rate + '/' + r.mk).join(','), before.slice(0, 3).map(r => r.rate + '/' + r.mk).join(','),
    'cost rate and markup are untouched');
  // blur commits too; blank changes nothing
  await p.click('.wqa-ser:nth-of-type(1) [data-gx="markup"]'); await p.waitForTimeout(150);
  await p.fill('[data-gx-in="markup"]', ''); await p.click('.wqa-rv-head', { position: { x: 5, y: 5 } }).catch(() => {});
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(500);
  A.eq((await state(p)).slice(0, 3).map(r => r.mk).join(','), '0,0,0', 'a blank heading value changes nothing');
  await p.click('.wqa-ser:nth-of-type(1) [data-gx="markup"]'); await p.waitForTimeout(150);
  await p.fill('[data-gx-in="markup"]', '10');
  await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(900);
  A.eq((await state(p)).slice(0, 3).map(r => r.mk).join(','), '10,10,10', 'leaving the box commits as well');
  A.includes(await p.textContent('.wqa-ser:nth-of-type(1) .wqa-ser-gx'), 'Markup 10%', 'the heading reads the new value');

  // ── Bulk Adjust: Current group scope, blank = no change ──────────────────
  await p.click('.wqa-ser:nth-of-type(3) button.wqa-ser-n');
  await p.waitForTimeout(300);
  const scopes = await p.$$eval('#wqaBulkSheetPanel .wqa-bs-sc', n => n.map(x => x.textContent.trim() + (x.classList.contains('is-on') ? '*' : '')).join(' | '));
  A.eq(scopes, 'All items (7) | Selected items (0) | Current group (3)*', 'Bulk Adjust from a heading opens on that group');
  await p.fill('#wqaBulkSheetPanel [data-bs="markup"]', '5');
  await p.click('#wqaBsApply'); await p.waitForTimeout(900);
  after = await state(p);
  A.eq(after.map(r => r.mk).join(','), '10,10,10,0,5,5,5', 'only the current group\'s markup changes');
  A.eq(after.map(r => r.add).join(','), '0.80,0.80,0.80,0.60,0.60,0.60,0.60', 'blank fields leave every other value as it was');
  await p.click('.wqa-rv-bulkbtn'); await p.waitForTimeout(300);
  await p.click('#wqaBulkSheetPanel .wqa-bs-sc >> nth=0');
  await p.fill('#wqaBulkSheetPanel [data-bs="costRate"]', '3');
  await p.click('#wqaBsApply'); await p.waitForTimeout(900);
  after = await state(p);
  A.eq(after.map(r => r.rate).join(','), '3,3,3,3,3,3,3', 'All items changes every row\'s cost rate');
  A.eq(after.map(r => r.mk).join(','), '10,10,10,0,5,5,5', 'and only that');

  // ── Effective Diameter is specification ──────────────────────────────────
  const dia = await p.evaluate(() => {
    const row = document.querySelector('[data-wqa-row="3"]');
    return { inSpec: !!row.querySelector('.wqa-it-toks .wqa-rv-dia'), inFig: !!row.querySelector('.wqa-it-fig .wqa-rv-dia'),
             text: row.querySelector('.wqa-it-toks .wqa-rv-dia').textContent.trim(),
             head: (document.querySelector('.wqa-ser .wqa-ser-dia') || {}).textContent || '' };
  });
  A.eq(dia.inSpec + '/' + dia.inFig, 'true/false', 'Ø sits at the end of the dimensions, not beside RM / weight');
  A.eq(dia.text, 'Ø12', 'compact Ø12 on the row');
  A.eq(dia.head, 'Ø16', 'and Ø16 on the group heading');
  await p.click('[data-wqa-row="3"] .wqa-rv-more'); await p.waitForTimeout(400);
  A.includes(await p.textContent('[data-wqa-row="3"] .wqa-rv-detail'), 'Effective Diameter', 'the panel names it Effective Diameter');
  A.eq(await p.evaluate(() => !/Diameter/.test(document.querySelector('[data-wqa-row="3"] .wqa-dt-weights').textContent)), 'true',
    'and it is no longer listed with the weights');

  // ── Pricing History: attached to THIS item's PRICING, opening mutates nothing
  const px0 = await state(p);
  const order = await p.evaluate(() => [...document.querySelectorAll('[data-wqa-row="3"] .wqa-rv-detail .wqa-dt-sec')].map(n => n.textContent.trim()));
  A.eq(order.length + '/' + order.indexOf('Pricing History') + '/' + (order.indexOf('Pricing History') - 1 === order.lastIndexOf(order[1])), '3/2/true',
    `the panel reads Specification > Pricing > Pricing History (${order.join(' > ')})`);
  await p.click('[data-wqa-row="3"] .wqa-dt-histbar'); await p.waitForTimeout(900);
  const h = await p.evaluate(() => {
    const row = document.querySelector('[data-wqa-row="3"]');
    const sec = row.querySelector('.wqa-dt-hist');
    return { inside: !!sec.querySelector('.wqa-hist-inline .ph-rec'), others: document.querySelectorAll('.wqa-hist-panel').length,
             sum: row.querySelector('.wqa-dt-histsum').textContent, classes: [...sec.querySelectorAll('.ph-cls')].map(n => n.textContent).join(','),
             strong: sec.querySelectorAll('.ph-use-strong').length, weak: sec.querySelectorAll('.ph-use-weak').length,
             refBtn: !!sec.querySelector('[data-ph-class="ref"] .ph-rec-use'),
             cust: [...sec.querySelectorAll('.ph-rec-cust')].map(n => n.textContent).join(','),
             finish: (sec.querySelector('[data-ph-class="ref"] .ph-rec-cmp') || {}).textContent || '',
             mx: [...sec.querySelectorAll('.ph-mx')].map(n => [...n.children].map(c => [...c.childNodes].map(x => x.textContent.trim()).join(' ')).join(' ')),
             thisCust: /this customer/.test(sec.textContent), btn: (row.querySelector('.wqa-it-acts .wqa-row-actn') || {}).textContent || '' };
  });
  A.eq(h.inside + '/' + h.others, 'true/1', 'history opens inside row 4\'s own panel, and nowhere else');
  A.eq(h.sum, '3 exact · 9 similar · 10 reference only', 'the summary is Exact / Similar / Reference only — never "22 matching"');
  A.eq(h.classes, 'Exact,Exact,Exact,Similar,Reference only', 'every card carries one primary class');
  A.eq(h.strong + '/' + h.weak + '/' + h.refBtn, '3/1/false', 'exact is the strong action, similar is "Use anyway", a reference offers none');
  A.includes(h.cust, 'XYZ ENGINEERING', 'each card names the customer');
  A.includes(h.finish, 'Finish HDG → current PL', 'the different finish is spelt out against the current item');
  A.eq(h.mx.length, 2, 'both Manual Price records explain themselves');
  A.eq(h.mx.filter(t => /Calculated/.test(t)).join(), 'Manual Price Calculated RM 13.73 Auto Round Ref RM 13.75 Quoted RM 14.50 Difference +RM 0.75',
    'Manual Price: Calculated · Auto Round Ref · Quoted · Difference');
  A.eq(h.mx.filter(t => !/Calculated/.test(t)).join(), 'Manual Price Quoted RM 14.00', 'an old record without stored context shows only what it has');
  A.eq(h.thisCust, 'false', 'with no customer selected there is no "this customer" count');
  A.eq(h.btn, '3', 'the row\'s History badge counts the exact matches');
  const px1 = await state(p);
  A.eq(JSON.stringify(px1), JSON.stringify(px0), 'opening Pricing History changed no price and no field');

  // ── Keep Both / Merge / Remove / Undo ────────────────────────────────────
  await p.click('[data-dup-act="keep"]'); await p.waitForTimeout(300);
  A.eq(await p.evaluate(() => wqa.rows.filter(r => !r.removed).length + '/' + !!document.querySelector('[data-dup-act="keep"]')), '7/false',
    'B: Keep Both keeps both groups and settles the warning');
  await p.click('[data-dup-act="review"]'); await p.waitForTimeout(300);
  await p.click('[data-dup-act="merge"]'); await p.waitForTimeout(700);
  after = await state(p);
  A.eq(after.filter(r => !r.removed).map(r => r.len + ':' + r.qty).join(','), '2970:8,3000:8,3280:8,1100:2', 'C: Merge Quantities adds L2970 4+4 = 8, line by line');
  await p.click('[data-dup-act="undo"]'); await p.waitForTimeout(700);
  A.eq((await state(p)).filter(r => !r.removed).map(r => r.qty).join(','), '4,4,4,2,4,4,4', 'and Undo puts both groups back');
  await p.click('[data-dup-act="remove"]'); await p.waitForTimeout(700);
  A.eq((await state(p)).filter(r => !r.removed).map(r => r.len + ':' + r.qty).join(','), '2970:4,3000:4,3280:4,1100:2', 'D: Remove Duplicate leaves one group');
  await ctx.close();

  // ── E / F: what is NOT an exact repeat ───────────────────────────────────
  for (const [why, msg] of [
    ['E: same dimensions, different qty', 'MS SAG ROD PL FULLSIZE\n' + BLK + '\nM12 x 1100 x 70/70 - 2pcs\n' + BLK.replace('3280 x 100/100 - 4pcs', '3280 x 100/100 - 6pcs')],
    ['F: same lines, different material', 'MS SAG ROD PL FULLSIZE\n' + BLK + '\n\nSS304 SAG ROD FULLSIZE\n' + BLK],
  ]) {
    const c2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p2 = await H.openApp(browser, { context: c2 });
    await H.quickAddPaste(p2, msg, { expanded: false, settle: 900 });
    A.eq(await p2.evaluate(() => wqaRvGroups().some(g => g.dupOf)), 'false', why + ' → no repeated-group warning');
    await c2.close();
  }

  // ── G: Chinese labels · H: mobile 390 and tablet 820 fit ─────────────────
  for (const [w, lang] of [[390, 'zh'], [820, 'zh'], [390, 'en']]) {
    ({ ctx, p } = await open(browser, w));
    if (lang === 'zh') { await p.evaluate(() => { dcSetLang('zh'); }); await p.waitForTimeout(400); }
    const t = await p.evaluate(() => {
      const d = document.querySelector('#wqaRows .wqa-dup');
      const sc = document.querySelector('#wqaModal .wqa-scroll');
      return { text: d ? d.textContent.replace(/\s+/g, ' ') : '', over: Math.max(sc.scrollWidth - sc.clientWidth, document.documentElement.scrollWidth - window.innerWidth),
               btns: [...d.querySelectorAll('button')].map(b => b.textContent.trim()).join('|') };
    });
    if (lang === 'zh') {
      A.includes(t.text, '检测到可能重复的分组', `${w}px 中文: 检测到可能重复的分组`);
      A.includes(t.text, '这个分组在来源内容中出现了多次。', `${w}px 中文: the explanation`);
      A.eq(t.btns, '保留两组|合并数量|删除重复项', `${w}px 中文: 保留两组 / 合并数量 / 删除重复项`);
    }
    A.ok(t.over <= 0, `${w}px ${lang}: no horizontal overflow (${t.over}px)`);
    await p.click('[data-wqa-row="3"] .wqa-it-main'); await p.waitForTimeout(400);
    await p.click('[data-wqa-row="3"] .wqa-dt-histbar'); await p.waitForTimeout(900);
    const o = await p.evaluate(() => {
      const sc = document.querySelector('#wqaModal .wqa-scroll');
      const grid = document.querySelector('[data-wqa-row="3"] .wqa-rv-detail .wqa-px-grid');
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      return { over: sc.scrollWidth - sc.clientWidth, cols, hist: !!document.querySelector('[data-wqa-row="3"] .wqa-hist-inline .ph-rec'),
               sec: (document.querySelector('[data-wqa-row="3"] .wqa-dt-sec-hist') || {}).textContent || '' };
    });
    A.ok(o.over <= 0, `${w}px ${lang}: the open panel with its history does not scroll sideways (${o.over}px)`);
    A.eq(o.cols, w < 600 ? 2 : 4, `${w}px ${lang}: the pricing editor is a ${w < 600 ? 2 : 4}-column grid`);
    A.eq(o.hist, 'true', `${w}px ${lang}: history opens under that item's pricing`);
    if (lang === 'zh') A.eq(o.sec.trim(), '历史价格', `${w}px 中文: the section is 历史价格`);
    await ctx.close();
  }

  // ── Accessory History: customer, grouped by price, icon button ───────────
  ({ ctx, p } = await open(browser, 1440));
  await p.evaluate(() => { wqaHardClose(); switchType('sagrod'); setFieldValue('sagrod', 'size', 'M16'); onSizeCommit('sagrod'); });
  const ab = await p.evaluate(() => { const b = document.querySelector('#sagrod-accPanel .acc-history-btn');
    return { icon: !!(b && b.querySelector('svg.dc-hist-ico')), text: b ? [b.getAttribute('aria-label'), b.title, b.textContent.trim()].join('|') : '' }; });
  A.eq(ab.icon + '/' + ab.text, 'true/History|History|', 'the accessory History button is the clock icon alone, named History by aria-label and tooltip');
  await p.evaluate(() => accHistoryOpen('sagrod', 'nut')); await p.waitForTimeout(600);
  const ah = await p.evaluate(() => [...document.querySelectorAll('#accHistoryBody .acc-hist-group')].map(g => ({
    price: g.querySelector('.ph-rec-unit').textContent, used: g.querySelector('.acc-hist-used').textContent,
    refs: [...g.querySelectorAll('.acc-hist-refs li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()),
    btn: g.querySelector('.ph-rec-use').textContent })));
  A.eq(ah.length, 2, 'two prices, two cards');
  A.eq(ah[0].price + ' · ' + ah[0].used, 'RM 0.15 · Used in 2 quotations', 'RM0.15 — used in 2 quotations');
  A.eq(ah[0].refs.join(' / '), 'Q-2026-1057 · 2 Oct 2026 · ABC HARDWARE / Q-2026-0586 · 18 Aug 2026 · XYZ ENGINEERING',
    'each quotation listed with its date and customer — none erased');
  A.eq(ah[0].btn, 'Use RM 0.15', 'one explicit action per price');
  const nutBefore = await p.evaluate(() => fv('sagrod', 'nutPrice'));
  A.eq(nutBefore, '0', 'opening Accessory History changed nothing');
  await p.evaluate(() => { closeModal('accHistoryModal'); dcSetLang('zh'); }); await p.waitForTimeout(300);
  const zb = await p.evaluate(() => { const b = document.querySelector('#sagrod-accPanel .acc-history-btn'); const r = b.getBoundingClientRect();
    return { text: [b.title, b.textContent.trim()].join('|'), aria: b.getAttribute('aria-label'), oneLine: r.height < 40 }; });
  A.eq(zb.text + '/' + zb.oneLine, '历史价格|/true', '中文: icon-only History, tooltip 历史价格, one line');
  A.ok(!!zb.aria, '中文: and it keeps an accessible name');
  await ctx.close();
};
