/* ── AI 智能识别 review (2026-10-23 redesign) ───────────────────────────────
   The review step is review-first: a row says what it is in one line and its
   values ARE the editor; identical-spec rows are one series; Bulk Adjust is a
   sheet with every field at No change; tick boxes exist only in Selection
   mode. Every write goes through the mutators the review always used, so the
   data assertions here are the same ones the old grid answered to.          */
'use strict';
const H = require('../lib/harness');
const DP = [
  { id: 1, type: 'sagrod', material: 'MS', sizeType: 'UNDERSIZE', size: '', finish: 'ZP', costRate: 4.2, addCost: 0.6, markup: 0, active: '1' },
  { id: 2, type: 'sagrod', material: 'MS', sizeType: 'UNDERSIZE', size: '', finish: 'HDG', costRate: 5.1, addCost: 0.8, markup: 2, active: '1' },
  { id: 3, type: 'anchorbolt', material: '4140', sizeType: 'FULLSIZE', size: '', finish: 'PL', costRate: 9, addCost: 2, markup: 10, active: '1' },
  { id: 4, type: 'stud', material: 'MS', sizeType: '', size: '', finish: 'ZP', costRate: 5, addCost: 1, markup: 10, active: '1' },
  { id: 5, type: 'lbolt', material: 'MS', sizeType: 'FULLSIZE', size: '', finish: 'HDG', costRate: 7, addCost: 3, markup: 8, active: '1' },
];
const LENS = [1070, 821, 763, 794, 657, 1120, 980, 1005, 1210, 875, 690, 1333, 1450, 702, 930, 1188, 845, 760, 1010, 1290, 1105, 955, 812, 1366, 1077];
const SAG = 'ms zp undersize sag rod\n' + LENS.map((l, k) => `${k + 1}. m10 x ${l} x 70/70 - ${k ? 4 : 432}pcs`).join('\n');
const SAG6 = 'ms zp undersize sag rod\n' + LENS.slice(0, 6).map((l, k) => `${k + 1}. m10 x ${l} x 70/70 - ${k + 2}pcs`).join('\n');
const MIXED = '4140 PL fullsize anchor bolt\nM20 x 600 x 150 - 8pcs\nMS ZP stud\nM16 x 300 - 20pcs\nMS HDG fullsize L bolt\nM20 x 500 x 100 x 120 - 6pcs\nsag rod ms zp undersize\nm12 x 800 x 75/75 - 12pcs';
const IMPERIAL = 'MS UNDERSIZE SAG ROD ZP\n3/8 x 1000 x 75/75 - 10pcs\n1-1/8 x 1200 x 100/100 - 5pcs';

async function open(lib, b, text, ctx, lang) {
  const c = await b.newContext(ctx || { viewport: { width: 1440, height: 900 } });
  const p = await lib.openApp(b, { context: c, api: { get_default_prices: { ok: true, data: DP } } });
  p.on('dialog', d => d.accept().catch(() => {}));
  if (lang) await p.evaluate(l => dcSetLang(l), lang);
  await p.evaluate(t => { wqaOpen(); document.getElementById('wqaInput').value = t; }, text);
  await p.evaluate(() => wqaParseAndReview());
  await p.waitForTimeout(600);
  return { c, p };
}
const ROWF = r => ({ removed: !!r.removed, product: r.product, size: r.size, length: r.length, w: r.w, h: r.h, id: r.id, s: r.s,
  threadLen: r.threadLen, threadLen2: r.threadLen2, qty: r.qty, material: r.material, finish: r.finish, sizeType: r.sizeType,
  diaMm: r.diaMm, diaManual: !!r.diaManual, acc: r.acc, priceMode: r.priceMode, manualPrice: r.manualPrice, priceOverride: r.priceOverride,
  calc: r.calc });
const rows = p => p.evaluate(f => wqa.rows.map(eval(f)), ROWF.toString());
const diffIdx = (a, b) => a.map((r, i) => JSON.stringify(r) === JSON.stringify(b[i]) ? -1 : i).filter(i => i >= 0);
const tok = (i, f) => `#wqaRows [data-wqa-row="${i}"] [data-tok="${f}"]`;
const items = p => p.evaluate(() => quoteItems.map(q => { const o = {}; Object.keys(q).sort().forEach(k => { if (!/^(id|uid|ts|createdAt|_)/.test(k)) o[k] = q[k]; }); return o; }));

module.exports = async (browser, A) => {
  A.suite('AI 智能识别 review — review-first, inline edit, Bulk Adjust, Selection, series');
  const b = browser;
  const ok = (c, m) => A.ok(!!c, m);
  /* ── 8 / 13: inline edit — mouse, keyboard; one item only ─────────────── */
  {
    const { c, p } = await open(H, b, MIXED);
    const before = await rows(p);
    await p.click(tok(2, 'length'));
    ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('wqa-ix') && document.activeElement.value === '500'),
      'mouse: pressing L500 opens a focused box holding 500');
    await p.keyboard.press('Control+A'); await p.keyboard.type('550'); await p.keyboard.press('Enter');
    await p.waitForTimeout(250);
    const after = await rows(p);
    ok(JSON.stringify(diffIdx(before, after)) === '[2]', `editing one item changes only that item (changed: ${diffIdx(before, after)})`);
    ok(after[2].length === '550' && after[2].calc.weight !== before[2].calc.weight, `row 3 length 550, weight re-derived ${before[2].calc.weight}→${after[2].calc.weight}`);
    ok(await p.evaluate(() => !document.querySelector('#wqaRows .wqa-ix') && document.activeElement.getAttribute('data-tok') === 'length'),
      'Enter commits and focus returns to the value');
    /* same change through the mutator, in a fresh page: identical row */
    const m = await open(H, b, MIXED);
    await m.p.evaluate(() => { wqaEdit(2, 'length', '550'); wqaRecomputeAll('force'); });
    await m.p.waitForTimeout(200);
    ok(JSON.stringify((await rows(m.p))[2]) === JSON.stringify(after[2]), 'inline commit = wqaEdit mutator result (row data + calc identical)');
    /* add-to-quotation equivalence after the inline edit */
    await p.evaluate(() => wqaAddAll()); await m.p.evaluate(() => wqaAddAll()); await p.waitForTimeout(600); await m.p.waitForTimeout(600);
    ok(JSON.stringify(await items(p)) === JSON.stringify(await items(m.p)), 'Add All after inline edit = Add All after mutator edit (quotation items identical)');
    await m.c.close();
    /* Tab moves along the row, then on to the next row */
    await c.close();
  }
  {
    const { c, p } = await open(H, b, SAG6);
    await p.click(tok(0, 'length'));
    await p.keyboard.press('Control+A'); await p.keyboard.type('1100'); await p.keyboard.press('Tab');
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.activeElement.getAttribute('data-ef') === 'qty' && document.activeElement.closest('[data-wqa-row]').getAttribute('data-wqa-row') === '0'),
      'Tab from L (series row) opens Qty on the same row');
    await p.keyboard.press('Control+A'); await p.keyboard.type('9'); await p.keyboard.press('Tab');
    await p.waitForTimeout(200);
    const at = await p.evaluate(() => ({ ef: document.activeElement.getAttribute('data-ef'), row: document.activeElement.closest('[data-wqa-row]').getAttribute('data-wqa-row') }));
    ok(at.row === '1', `Tab off the end of a row moves to the next row (${JSON.stringify(at)})`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    let r = await rows(p);
    ok(r[0].length === '1100' && String(r[0].qty) === '9', 'both Tab-committed values were written (L1100, Qty 9)');
    ok(await p.evaluate(() => document.getElementById('wqaModal').classList.contains('open')), 'Escape in a box does not close the review');
    /* Escape discards */
    await p.click(tok(2, 'qty')); await p.keyboard.press('Control+A'); await p.keyboard.type('777'); await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
    r = await rows(p);
    ok(String(r[2].qty) === '4', `Escape puts the value back (qty ${r[2].qty})`);
    /* invalid value refused */
    await p.click(tok(3, 'qty')); await p.keyboard.press('Control+A'); await p.keyboard.type('-3'); await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    r = await rows(p);
    const bad = await p.evaluate(() => { const n = document.querySelector('#wqaRows .wqa-ix'); return n ? n.classList.contains('is-bad') : false; });
    ok(bad && await p.evaluate(() => !!wqa.ix), 'an invalid qty is refused on Enter: the box stays open and is marked');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    ok(String((await rows(p))[3].qty) === '5', 'Escape then puts the old qty back (5)');
    await p.click(tok(3, 'qty')); await p.keyboard.press('Control+A'); await p.keyboard.type('abc');
    await p.click('#wqaRvActs .wqa-rv-count, #wqaRowsCount'); await p.waitForTimeout(200);
    ok(String((await rows(p))[3].qty) === '5', 'leaving a box holding nonsense restores the old value');
    await p.click(tok(3, 'qty')); await p.keyboard.press('Control+A'); await p.keyboard.type('2'); await p.waitForTimeout(400);
    ok(String((await rows(p))[3].qty) === '2' && await p.evaluate(() => !!document.querySelector('#wqaRows .wqa-ix')), 'the row follows the caret: qty 2 is on the row while the box is still open');
    await p.keyboard.press('Enter');
    /* blur commit, then a click on the next value is not lost */
    await p.click(tok(4, 'qty')); await p.keyboard.press('Control+A'); await p.keyboard.type('50');
    await p.click(tok(5, 'length'));
    await p.waitForTimeout(200);
    r = await rows(p);
    const nowEf = await p.evaluate(() => ({ ef: document.activeElement.getAttribute('data-ef'), row: document.activeElement.closest('[data-wqa-row]') && document.activeElement.closest('[data-wqa-row]').getAttribute('data-wqa-row') }));
    ok(String(r[4].qty) === '50' && nowEf.ef === 'length' && nowEf.row === '5', `leaving a box commits it and the next press still lands (${JSON.stringify(nowEf)})`);
    await p.keyboard.press('Escape');
    /* arithmetic still works */
    await p.click(tok(1, 'length')); await p.keyboard.press('Control+A'); await p.keyboard.type('800+21'); await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    ok((await rows(p))[1].length === '821', '"800+21" commits as 821 (inline arithmetic kept)');
    await c.close();
  }
  /* ── 13: tablet touch ─────────────────────────────────────────────────── */
  {
    const { c, p } = await open(H, b, SAG6, { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
    const box = await p.locator(tok(2, 'length')).boundingBox();
    ok(box && box.height >= 40, `tablet: a value is a ≥40px target (${box && Math.round(box.height)}px)`);
    await p.tap(tok(2, 'length'));
    ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('wqa-ix')), 'tablet: tapping L opens its box directly');
    await p.keyboard.press('Control+A'); await p.keyboard.type('700'); await p.keyboard.press('Enter');
    await p.waitForTimeout(200);
    ok((await rows(p))[2].length === '700', 'tablet: tap → type → Enter commits');
    await p.tap(`#wqaRows [data-wqa-row="3"] .wqa-fig-price`);
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => !!document.querySelector('#wqaRows [data-wqa-row="3"] .wqa-px [data-px="costRate"]')), 'tablet: tapping the price opens the pricing strip');
    await c.close();
  }
  /* ── mobile: tap the item, edit in its panel ──────────────────────────── */
  {
    const { c, p } = await open(H, b, SAG6, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await p.tap(`#wqaRows [data-wqa-row="1"] .wqa-it-main`);
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => !!document.querySelector('#wqaRows [data-wqa-row="1"].is-open .wqa-rv-detail')), 'mobile: tapping an item expands it');
    const inp = `#wqaRows [data-wqa-row="1"] .wqa-rv-detail [data-ef="length"]`;
    await p.tap(inp); await p.fill(inp, '905'); await p.press(inp, 'Enter');
    await p.waitForTimeout(400);
    ok((await rows(p))[1].length === '905', 'mobile: a value edited in the item panel is committed');
    const fs16 = await p.evaluate(s => parseFloat(getComputedStyle(document.querySelector(s)).fontSize), inp);
    ok(fs16 >= 16, `mobile: panel inputs are ≥16px (no iOS zoom) — ${fs16}px`);
    const m = await p.evaluate(() => { const r = document.querySelector('#wqaModal .wqa-modal').getBoundingClientRect(); return { h: r.height, vh: innerHeight }; });
    ok(Math.abs(m.h - m.vh) < 2, `mobile: the review is a full-screen sheet (${m.h}/${m.vh})`);
    ok(await p.evaluate(() => document.querySelectorAll('#wqaRows .wqa-list-head, #wqaListHead').length === 0), 'mobile: no table header');
    await c.close();
  }
  /* ── 9 / 10 / 11: bulk adjustment, No change, selection scope ─────────── */
  {
    const { c, p } = await open(H, b, SAG6);
    const before = await rows(p);
    ok(await p.evaluate(() => document.querySelectorAll('#wqaRows .wqa-pick').length === 0), 'default review shows no tick boxes');
    await p.click('#wqaRvActs .wqa-rv-bulkbtn');
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => [...document.querySelectorAll('#wqaBulkSheetPanel select[data-bs]')].every(s => s.value === '__KEEP__')
      && [...document.querySelectorAll('#wqaBulkSheetPanel input[data-bs]')].every(i => i.value === '')), 'every bulk field starts at 不修改');
    ok(await p.evaluate(() => document.getElementById('wqaBsApply').disabled), 'Apply is disabled until a field is changed');
    await p.selectOption('#wqaBulkSheetPanel select[data-bs="finish"]', 'HDG');
    await p.fill('#wqaBulkSheetPanel input[data-bs="markup"]', '12');
    const sum = await p.evaluate(() => document.getElementById('wqaBsSummary').innerText);
    ok(/HDG/.test(sum) && /12%/.test(sum) && /6/.test(sum), `summary says what will happen: ${sum.replace(/\s+/g, ' ')}`);
    await p.click('#wqaBsApply');
    await p.waitForTimeout(300);
    const after = await rows(p);
    const touched = new Set();
    after.forEach((r, i) => Object.keys(r).forEach(k => { if (JSON.stringify(r[k]) !== JSON.stringify(before[i][k])) touched.add(k); }));
    ok([...touched].sort().join() === 'calc,finish,priceOverride', `bulk Finish+Markup changed only finish, the markup override and the derived calc (${[...touched]})`);
    ok(after.every(r => r.finish === 'HDG' && r.priceOverride.markup === '12' && r.priceOverride.costRate === undefined),
      'every row got Finish HDG + Markup 12, no cost rate written');
    ok(await p.evaluate(() => el('wqaBulkSheet').hidden), 'the sheet closes after Apply');
    await c.close();
  }
  {
    const { c, p } = await open(H, b, SAG6);
    const before = await rows(p);
    await p.click('#wqaRvActs .wqa-rv-selbtn');
    ok(await p.evaluate(() => document.querySelectorAll('#wqaRows .wqa-pick').length >= 6 && !el('wqaSelBar').hidden), 'Select shows tick boxes and the selection bar');
    await p.click('#wqaRows [data-wqa-row="0"] .wqa-it-main');
    await p.click('#wqaRows [data-wqa-row="3"] .wqa-pick');
    ok(await p.evaluate(() => wqaSelCount() === 2), 'pressing a row or its box selects it (2 selected)');
    await p.click('#wqaSelBar button:has-text("' + (await p.evaluate(() => dcT('wqaBulkEdit'))) + '")');
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => wqa.bs && wqa.bs.scope === 'selected'), 'Bulk Adjust from the selection bar opens with scope = selected');
    await p.selectOption('#wqaBulkSheetPanel select[data-bs="sizeType"]', 'FULLSIZE');
    await p.click('#wqaBsApply'); await p.waitForTimeout(300);
    const after = await rows(p);
    ok(JSON.stringify(diffIdx(before, after)) === '[0,3]', `only the selected items changed (${diffIdx(before, after)})`);
    ok(after[0].sizeType === 'FULLSIZE' && after[3].sizeType === 'FULLSIZE' && after[1].sizeType === 'UNDERSIZE', 'selected rows Fullsize, others still Undersize');
    ok(await p.evaluate(() => !wqa.selMode && document.querySelectorAll('#wqaRows .wqa-pick').length === 0 && el('wqaSelBar').hidden),
      'after applying, the review returns to clean mode (no boxes, no bar)');
    /* remove selected */
    await p.click('#wqaRvActs .wqa-rv-selbtn');
    await p.click('#wqaRows [data-wqa-row="5"] .wqa-it-main');
    await p.click('#wqaSelBar .wqa-sel-del'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => wqa.rows[5].removed && wqa.rows.filter(r => !r.removed).length === 5 && !wqa.selMode), 'Remove selected removes exactly the ticked item');
    /* Escape order */
    await p.click('#wqaRvActs .wqa-rv-bulkbtn'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    ok(await p.evaluate(() => el('wqaBulkSheet').hidden && el('wqaModal').classList.contains('open')), 'Escape closes the sheet first, not the review');
    await c.close();
  }
  /* ── 12: many Sag Rods ────────────────────────────────────────────────── */
  {
    const { c, p } = await open(H, b, SAG);
    const g = await p.evaluate(() => ({ ser: document.querySelectorAll('#wqaRows .wqa-ser').length,
      rows: document.querySelectorAll('#wqaRows .wqa-ser [data-wqa-row]').length,
      head: document.querySelector('#wqaRows .wqa-ser-head').innerText.replace(/\s+/g, ' '),
      sizeToks: document.querySelectorAll('#wqaRows .wqa-ser-rows [data-tok="size"], #wqaRows .wqa-ser-rows [data-tok="threadLen"]').length,
      pxShown: document.querySelectorAll('#wqaRows .wqa-ser-rows button.wqa-it-px').length,
      h: document.querySelector('#wqaRows .wqa-ser-rows [data-wqa-row="5"]').getBoundingClientRect().height }));
    ok(g.ser === 1 && g.rows === 25, `25 Sag Rods are one series of 25 rows (${g.ser}/${g.rows})`);
    ok(/M10/.test(g.head) && /TL 70\/70/.test(g.head) && g.sizeToks === 0, `the shared M10 · TL 70/70 is said once, not per row (${g.head})`);
    ok(g.pxShown === 0, 'identical pricing is stated once in the heading');
    ok(g.h <= 46, `a series row is one short line (${Math.round(g.h)}px)`);
    await p.click(tok(9, 'length')); await p.keyboard.press('Control+A'); await p.keyboard.type('880'); await p.keyboard.press('Enter');
    await p.waitForTimeout(200);
    ok((await rows(p))[9].length === '880', 'a series row is edited in place');
    await p.click(tok(12, 'qty')); await p.keyboard.press('Control+A'); await p.keyboard.type('6'); await p.keyboard.press('Enter');
    await p.evaluate(() => wqaPxToggle(4)); await p.waitForTimeout(100);
    await p.fill('#wqaRows [data-wqa-row="4"] [data-px="markup"]', '9'); await p.waitForTimeout(500);
    await p.evaluate(() => wqaPxToggle(4)); await p.waitForTimeout(150);
    ok(await p.evaluate(() => document.querySelectorAll('#wqaRows .wqa-ser-rows button.wqa-it-px').length === 1
      && !!document.querySelector('#wqaRows [data-wqa-row="4"] button.wqa-it-px.is-own')), 'a row priced differently from its series shows its own pricing');
    /* changing one row's size moves it out of the series */
    await p.evaluate(() => wqaToggleRow(6)); await p.waitForTimeout(150);
    const sz = '#wqaRows [data-wqa-row="6"] .wqa-rv-detail [data-ef="size"]';
    await p.fill(sz, 'M12'); await p.press(sz, 'Enter'); await p.waitForTimeout(700);
    const g2 = await p.evaluate(() => [...document.querySelectorAll('#wqaRows > *')].map(n => n.classList.contains('wqa-ser') ? 'S' + n.querySelectorAll('[data-wqa-row]').length : 'I'));
    ok(JSON.stringify(g2) === '["S6","I","S18"]', `M12 on row 7 splits the series around it (${g2})`);
    const r = await rows(p);
    ok(r.filter(x => x.size === 'M10').length === 24 && r[6].size === 'M12', 'only row 7 changed size (presentation regrouped, data untouched elsewhere)');
    await c.close();
  }
  /* ── 14: original content ─────────────────────────────────────────────── */
  {
    const { c, p } = await open(H, b, SAG6);
    ok(await p.evaluate(() => !document.querySelector('#wqaSource .wqa-source-text')), 'original content is collapsed by default');
    await p.click('#wqaSource .wqa-panel-head');
    const txt = await p.evaluate(() => (document.querySelector('#wqaSource .wqa-source-text') || {}).textContent || '');
    ok(/m10 x 1070/.test(txt), 'pressing 原始内容 shows the pasted message');
    await p.click('#wqaSource .wqa-panel-head');
    ok(await p.evaluate(() => !document.querySelector('#wqaSource .wqa-source-text')), 'and pressing again hides it');
    const h = await p.evaluate(() => document.querySelector('#wqaSource').getBoundingClientRect().height);
    ok(h <= 36, `collapsed, it is one line (${Math.round(h)}px)`);
    await c.close();
  }
  /* ── 15 / 16 / 17: language ───────────────────────────────────────────── */
  const BANNED = /平垫|加 Nut|尺寸类型|规格类型|快速添加|定价历史|过往价格|成本率|附加成本|利润|加成|批量编辑|选定项目|保持不变|添加到报价单|客户原文|History/;
  for (const lang of ['zh', 'en']) {
    const { c, p } = await open(H, b, MIXED, null, lang);
    await p.evaluate(() => { wqaToggleRow(0); });
    await p.waitForTimeout(150);
    let t = await p.evaluate(() => document.getElementById('wqaModal').innerText);
    await p.evaluate(() => { wqaToggleRow(0); wqaBulkSheetOpen(); });
    t += '\n' + await p.evaluate(() => document.getElementById('wqaBulkSheetPanel').innerText);
    await p.evaluate(() => { wqaBulkSheetClose(); wqaSelEnter(); });
    t += '\n' + await p.evaluate(() => el('wqaSelBar').innerText);
    if (lang === 'zh') {
      const m = t.match(BANNED);
      ok(!m, `中文: no old/banned wording on the review${m ? ' — "' + m[0] + '"' : ''}`);
      ['AI 智能识别', '已识别 4 个项目', '批量调整', '原始内容', '客户历史报价', '加入 4 个项目到报价', '螺纹 Size', 'Size 规格', '每公斤成本', '额外加工费', 'Markup', '成本 ', '加工费 ', '不修改', '全部项目', '已选择项目', '应用调整', '选择', '已选择 0 个项目']
        .forEach(w => ok(t.includes(w), `中文 shows "${w}"`));
    } else {
      const cjk = (t.replace(/中文|English \/ 中文/g, '').match(/[一-鿿]+/g) || []);
      ok(cjk.length === 0, `English: no Chinese on the review ${cjk.slice(0, 5)}`);
      ['Quick Add', 'Detected 4 items', 'Bulk Adjust', 'Original Content', 'Pricing History', 'Add 4 Items to Quotation', 'No change', 'Apply Adjustment', 'Cost ', 'Add. Cost']
        .forEach(w => ok(t.includes(w), `English shows "${w}"`));
    }
    await c.close();
  }
  {
    /* 螺纹 Size where M20 / 1" / 3/8" are chosen: the calculator form and the item panel */
    const { c, p } = await open(H, b, IMPERIAL, null, 'zh');
    await p.evaluate(() => wqaToggleRow(0)); await p.waitForTimeout(150);
    const d = await p.evaluate(() => ({ lbl: document.querySelector('#wqaRows [data-wqa-row="0"] [data-ef="size"]').closest('label').querySelector('span').textContent,
      val: document.querySelector('#wqaRows [data-wqa-row="0"] [data-ef="size"]').value,
      head: document.querySelector('#wqaRows .wqa-ser-head, #wqaRows [data-wqa-row="1"] .wqa-tok-size') && (document.querySelector('#wqaRows [data-wqa-row="1"] [data-tok="size"]') || {}).textContent }));
    ok(d.lbl === '螺纹 Size' && d.val === '3/8"', `item panel: 螺纹 Size → ${d.val}`);
    ok(/1-1\/8"/.test(d.head || ''), `imperial size shown with its inch mark on the row (${d.head})`);
    await p.evaluate(() => { wqaHardClose(); switchType('sagrod'); });
    const f = await p.evaluate(() => document.querySelector('#form-sagrod label[data-i18n="lblSize"]').textContent);
    ok(f === '螺纹 Size', `calculator form label: ${f}`);
    await c.close();
  }
};
