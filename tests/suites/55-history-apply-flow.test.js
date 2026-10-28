/* ── History → Use this setup → apply to others, in one place ───────────────
   Owner smoke (2026-10-28): after History → Use this setup the next step is
   asked right there — inside the row's pricing editor (or under the row and
   its History preview when no editor is open), never in the group heading:
   "✓ Applied to this item" → "Apply this setup to N other compatible items?
   [Apply to N items] [Not now]" → "✓ Applied to N items", which fades.
   The heading stays structural: identity, count, "x of y priced".        */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');
const { setLang } = require('../lib/dom-i18n');

const SAG = 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x 100/100 - 2pcs\nM12 x 1500 x 100/100 - 3pcs\nM12 x 2000 x 100/100 - 4pcs';
const HREC = {
  quotationId: 9, refNo: 'Q-2026-0909', date: '2026-10-01', customer: 'ABC HARDWARE', companyId: 0, own: false,
  productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', finishMatch: true, cleanSize: 'M12',
  dimensionPreview: 'L 1000 x TL 100/100mm', exactDims: true, dimDistance: 0, qty: 2,
  unitPrice: 3.1, lineUnitPrice: 3.1, boltUnitPrice: 3.1, accessoryCost: 0, accessorySummary: '', accessoryAmbiguous: false,
  priceMode: 'auto', priceModeLabel: 'Auto Round', costRate: 3.5, addCost: 0.6, markup: 5, weight: 0.8878, legacy: false,
};
const HSIM = Object.assign({}, HREC, { quotationId: 10, refNo: 'Q-2026-1010', dimensionPreview: 'L 1100 x TL 100/100mm',
  exactDims: false, dimDistance: 100, costRate: 3.8, addCost: 0.6, markup: 0, priceMode: 'no_round', unitPrice: 3.9, boltUnitPrice: 3.9 });
const HIST = { ok: true, data: { records: [HREC, HSIM], total: 2, ownTotal: 0, otherTotal: 2, exactTotal: 1, closeTotal: 1, refTotal: 0, offset: 0, limit: 20 } };

const rowOf = (p, i) => p.evaluate(i => { const r = wqa.rows[i], card = document.querySelector('[data-wqa-row="' + i + '"]');
  return { ok: wqaRowAccepted(r), c: String(r.calc.costRate), a: String(r.calc.addCost), m: String(r.calc.markup), px: r.calc.finalUnitPrice,
    mode: r.priceMode || 'auto', man: r.manualPrice || '', shown: card.querySelector('.wqa-fin').textContent,
    cell: card.querySelector('.wqa-ip-set').textContent.replace(/\s+/g, ' ').trim() }; }, i);
const fuOf = (p, i) => p.evaluate(i => { const b = document.querySelector('#wqaRows [data-fu="' + i + '"]');
  const ask = b && b.querySelector('[data-recipe-offer]');
  return { on: !!b, inEditor: !!(b && b.closest('[data-pxe]')), underRow: !!(b && b.parentElement && b.parentElement.matches('[data-wqa-row]')),
    ok: ((b && b.querySelector('.wqa-fu-ok')) || {}).textContent || '', ask: ask ? ask.textContent.replace(/\s+/g, ' ').trim() : '',
    go: ((b && b.querySelector('[data-rc="apply-now"]')) || {}).textContent || '', offers: document.querySelectorAll('#wqaRows [data-recipe-offer]').length }; }, i);
const head = p => p.evaluate(() => [...document.querySelectorAll('#wqaRows .wqa-ser-head')].map(h => ({
  text: h.textContent.replace(/\s+/g, ' ').trim(), acts: h.querySelectorAll('[data-rc], [data-recipe-offer], .wqa-rcp, .wqa-grx').length })));
/* Use this setup from the row's quick History preview, by record class. */
const useHq = (p, i, cls) => p.evaluate(({ i, cls }) => {
  const b = document.querySelector('[data-wqa-row="' + i + '"] .wqa-hq-row[data-hq-cls="' + cls + '"] [data-hq-act="apply"]');
  if (!b) return false; b.click(); return true; }, { i, cls });

module.exports = async (browser, A) => {
  // ═══ the exact owner flow ═════════════════════════════════════════════════
  A.suite('history apply flow — Use this setup, then apply to others, locally');
  let p = await openApp(browser, { api: { get_pricing_history: HIST } });
  await quickAddPaste(p, SAG, { expanded: false, settle: 900 });
  await p.waitForTimeout(300);
  await p.click('[data-wqa-row="0"] .wqa-fig-price');
  await p.waitForTimeout(250);
  await p.click('[data-px-row="0"] .wqa-px-hist');
  await p.waitForTimeout(300);
  A.ok(await p.evaluate(() => !!document.querySelector('[data-pxe="0"]') && !!document.querySelector('[data-wqa-row="0"] .wqa-hq')), 'editor and History preview open together');
  A.ok(await useHq(p, 0, 'exact'), 'History Exact offers Use this setup');
  await p.waitForTimeout(500);
  let r0 = await rowOf(p, 0);
  A.ok(r0.ok && Number(r0.c) === 3.5 && Number(r0.a) === 0.6 && Number(r0.m) === 5 && r0.mode === 'auto', 'item 1 takes the setup at once');
  A.eq(r0.shown, 'RM' + Number(r0.px).toFixed(2), 'item 1 RM/pc updates immediately');
  let fu = await fuOf(p, 0);
  A.ok(fu.inEditor, 'the follow-up sits inside the active pricing editor');
  A.includes(fu.ok, 'Applied to this item', 'local success: ✓ Applied to this item');
  A.includes(fu.ask, 'Apply this setup to 2 other compatible items?', 'local question names the compatible items');
  A.eq(fu.go, 'Apply to 2 items', 'with [Apply to 2 items]');
  A.includes(fu.ask, 'Not now', 'and [Not now]');
  A.eq(fu.offers, 1, 'asked in one place only');
  let hd = await head(p);
  A.eq(hd[0].acts, 0, 'no pricing action in the group heading');
  A.ok(!/Accept|Suggested|Approved|Use this pricing|Apply setup/i.test(hd[0].text), 'no approval / apply wording in the heading: ' + hd[0].text);
  A.includes(hd[0].text, '1 of 3 priced', 'the heading only says how many are priced');
  A.ok(await p.evaluate(() => !!document.querySelector('[data-pxe="0"]') && !!document.querySelector('[data-wqa-row="0"] .wqa-hq')), 'editor and History stay open after Use');

  const top0 = await p.evaluate(() => document.querySelector('[data-pxe="0"]').getBoundingClientRect().top);
  await p.click('[data-pxe="0"] [data-rc="apply-now"]');
  await p.waitForTimeout(600);
  r0 = await rowOf(p, 0);
  const r1 = await rowOf(p, 1), r2 = await rowOf(p, 2);
  A.ok([r1, r2].every(r => r.ok && Number(r.c) === 3.5 && Number(r.a) === 0.6 && Number(r.m) === 5 && r.mode === 'auto'), 'compatible rows get Cost / Add / Markup / Mode');
  A.ok(r0.px < r1.px && r1.px < r2.px, 'each row recalculates its own RM/pc (longer = dearer) — the RM is not copied');
  A.ok([r1, r2].every(r => r.shown === 'RM' + Number(r.px).toFixed(2)), 'no stale "Set price" on updated rows');
  A.ok([r1, r2].every(r => /3\.50/.test(r.cell) && /5%/.test(r.cell)), 'their Cost · Add · Markup summaries update');
  fu = await fuOf(p, 0);
  A.includes(fu.ok, 'Applied to 2 items', 'local success replaces the question: ✓ Applied to 2 items');
  A.eq(fu.offers, 0, 'the question is gone');
  A.ok(await p.evaluate(() => !!document.querySelector('[data-pxe="0"]') && !!document.querySelector('[data-wqa-row="0"] .wqa-hq')), 'editor and History still open after Apply');
  const top1 = await p.evaluate(() => document.querySelector('[data-pxe="0"]').getBoundingClientRect().top);
  A.ok(Math.abs(top1 - top0) < 30, 'the screen does not jump (' + Math.round(top0) + ' → ' + Math.round(top1) + ')');
  hd = await head(p);
  A.eq(hd[0].acts, 0, 'still no group-heading action');
  A.includes(hd[0].text, '3 of 3 priced', 'heading: 3 of 3 priced');
  await p.waitForTimeout(4200);
  A.eq((await fuOf(p, 0)).ok, '', 'the success line fades');
  await p.fill('[data-pxe="0"] [data-px="markup"]', '6');
  await p.waitForTimeout(400);
  A.ok((await rowOf(p, 0)).m === '6' && (await rowOf(p, 1)).m === '5', 'pricing continues normally afterwards');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (owner flow)');
  await p.close();

  // ═══ Not now, then History Similar ════════════════════════════════════════
  A.suite('history apply flow — Not now and Similar');
  p = await openApp(browser, { api: { get_pricing_history: HIST } });
  await quickAddPaste(p, SAG, { expanded: false, settle: 900 });
  await p.evaluate(() => wqaPxToggle(0));
  await p.waitForTimeout(200);
  await p.click('[data-px-row="0"] .wqa-px-hist');
  await p.waitForTimeout(300);
  await useHq(p, 0, 'exact');
  await p.waitForTimeout(500);
  await p.click('[data-pxe="0"] [data-rc="dismiss"]');
  await p.waitForTimeout(300);
  fu = await fuOf(p, 0);
  A.ok(!fu.on && fu.offers === 0, 'Not now dismisses the follow-up');
  A.ok((await rowOf(p, 0)).ok && !(await rowOf(p, 1)).ok && !(await rowOf(p, 2)).ok, 'Not now: item 1 stays priced, the others unchanged');
  A.ok(await p.evaluate(() => !!document.querySelector('[data-pxe="0"]')), 'Not now keeps the editor open');

  await p.evaluate(() => { wqa.hq = null; wqaPxToggle(1); });
  await p.waitForTimeout(200);
  await p.click('[data-px-row="1"] .wqa-px-hist');
  await p.waitForTimeout(300);
  const simOk = await useHq(p, 1, 'close');
  await p.waitForTimeout(500);
  const s1 = await rowOf(p, 1);
  A.ok(simOk && s1.ok && Number(s1.c) === 3.8 && s1.mode === 'no_round', 'History Similar: Use this setup (after its prompt) prices the item');
  fu = await fuOf(p, 1);
  A.ok(fu.inEditor && /Applied to this item/.test(fu.ok), 'Similar: local success in the editor');
  A.eq(fu.go, 'Apply to 1 item', 'Similar: offers the one unpriced compatible item');
  A.includes(fu.ask, 'Choose items', 'an already-priced row is reachable only through Choose items…');
  await p.click('[data-pxe="1"] [data-rc="apply-now"]');
  await p.waitForTimeout(600);
  const s0 = await rowOf(p, 0), s2 = await rowOf(p, 2);
  A.ok(s2.ok && Number(s2.c) === 3.8 && s2.mode === 'no_round', 'the unpriced item gets the Similar setup');
  A.ok(Number(s0.c) === 3.5 && s0.mode === 'auto', 'the item already priced differently is not overwritten');
  A.includes((await fuOf(p, 1)).ok, 'Applied to 1 item', 'local success: Applied to 1 item');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (Not now / Similar)');
  await p.close();

  // ═══ Manual Price and a different basis are skipped, with reasons ══════════
  A.suite('history apply flow — skips, the drawer, no editor open');
  p = await openApp(browser, { api: { get_pricing_history: HIST } });
  await quickAddPaste(p, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x 100/100 - 2pcs\n1/2" x 1200 x 100/100 - 2pcs\nM12 x 1400 x 100/100 - 2pcs\nM12 x 1600 x 100/100 - 2pcs', { expanded: false, settle: 900 });
  const inch = await p.evaluate(() => wqaSizeBasis(wqa.rows[1]) !== wqaSizeBasis(wqa.rows[0]));
  await p.evaluate(() => wqaPxToggle(3));
  await p.waitForTimeout(200);
  await p.selectOption('[data-pxe="3"] [data-px="priceMode"]', 'manual');
  await p.waitForTimeout(300);
  await p.fill('[data-pxe="3"] [data-px="manualPrice"]', '50');
  await p.press('[data-pxe="3"] [data-px="manualPrice"]', 'Tab');
  await p.waitForTimeout(500);
  // History preview opened from the row with no editor open
  await p.evaluate(() => { wqa.px = null; wqa.recipeSrc = null; wqaHqToggle(0); });
  await p.waitForTimeout(400);
  await useHq(p, 0, 'exact');
  await p.waitForTimeout(500);
  fu = await fuOf(p, 0);
  A.ok(fu.underRow && !fu.inEditor, 'no editor open: the follow-up sits right under the row and its History preview');
  A.eq(fu.go, 'Apply to 1 item', 'only the compatible, unpriced item is counted');
  A.includes(fu.ask, 'Manual price kept', 'the Manual Price item is skipped with its reason');
  if (inch) A.includes(fu.ask, 'Different pricing basis', 'the inch item is skipped as a different pricing basis');
  await p.click('#wqaRows [data-fu="0"] [data-rc="apply-now"]');
  await p.waitForTimeout(600);
  const k2 = await rowOf(p, 2), k3 = await rowOf(p, 3), k1 = await rowOf(p, 1);
  A.ok(k2.ok && Number(k2.c) === 3.5, 'the compatible item is priced');
  A.ok(k3.mode === 'manual' && k3.man === '50', 'Manual Price is protected');
  if (inch) A.ok(!k1.ok, 'the inch item is left unpriced');
  A.includes((await fuOf(p, 0)).ok, 'Applied to 1 item', 'local success under the row');

  // the docked drawer on desktop: the ask lands in the editor beside it
  await p.evaluate(() => { wqa.hq = null; wqa.fu = null; wqaPxToggle(2); });
  await p.waitForTimeout(200);
  await p.evaluate(() => wqaHdOpen(2));
  await p.waitForTimeout(600);
  await p.evaluate(() => { const rec = [...document.querySelectorAll('#wqaHdBody .ph-rec')].find(n => n.textContent.includes('Q-2026-1010')); rec.querySelector('.ph-rec-use').click(); });
  await p.waitForTimeout(600);
  fu = await fuOf(p, 2);
  A.ok(fu.inEditor && /Applied to this item/.test(fu.ok), 'drawer Use this setup: success shows in the editor beside the drawer');
  A.ok(await p.evaluate(() => !document.getElementById('wqaHd').hidden), 'the drawer stays open on desktop');
  A.eq((await head(p))[0].acts, 0, 'no group-heading action');
  await p.evaluate(() => wqaHdClose());
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (skips / drawer)');

  // ═══ one item: success, no apply-to-others ═══════════════════════════════
  A.suite('history apply flow — one-item group');
  await quickAddPaste(p, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x 100/100 - 2pcs', { expanded: false, settle: 900 });
  await p.evaluate(() => wqaPxToggle(0));
  await p.waitForTimeout(200);
  await p.click('[data-px-row="0"] .wqa-px-hist');
  await p.waitForTimeout(300);
  await useHq(p, 0, 'exact');
  await p.waitForTimeout(500);
  fu = await fuOf(p, 0);
  A.ok((await rowOf(p, 0)).ok && /Applied to this item/.test(fu.ok), 'one item: priced, with the local success');
  A.eq(fu.offers, 0, 'one item: no apply-to-others question');
  A.ok(!/priced/.test((await head(p))[0].text), 'one item: no priced count in the heading');

  // ═══ CN ═══════════════════════════════════════════════════════════════════
  A.suite('history apply flow — 中文');
  await setLang(p, 'zh');
  await quickAddPaste(p, SAG, { expanded: false, settle: 900 });
  await p.evaluate(() => wqaPxToggle(0));
  await p.waitForTimeout(200);
  await p.click('[data-px-row="0"] .wqa-px-hist');
  await p.waitForTimeout(300);
  await useHq(p, 0, 'exact');
  await p.waitForTimeout(500);
  fu = await fuOf(p, 0);
  A.includes(fu.ok, '已应用到此项目', 'CN: 已应用到此项目');
  A.includes(fu.ask, '要将此设置应用到其他 2 个兼容项目吗', 'CN: local question');
  A.eq(fu.go, '应用到 2 个项目', 'CN: 应用到 2 个项目');
  A.includes((await head(p))[0].text, '已定价 1/3', 'CN: heading count');
  await p.click('[data-pxe="0"] [data-rc="apply-now"]');
  await p.waitForTimeout(600);
  A.includes((await fuOf(p, 0)).ok, '已应用到 2 个项目', 'CN: 已应用到 2 个项目');
  await setLang(p, 'en');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (one item / CN)');
  await p.close();

  // ═══ tablet / phone ═══════════════════════════════════════════════════════
  for (const w of [820, 390]) {
    A.suite(`history apply flow — ${w}px`);
    const q = await openApp(browser, { viewport: { width: w, height: 900 }, api: { get_pricing_history: HIST } });
    await quickAddPaste(q, SAG, { expanded: false, settle: 900 });
    await q.evaluate(() => wqaPxToggle(0));
    await q.waitForTimeout(250);
    await q.evaluate(() => wqaHdOpen(0));
    await q.waitForTimeout(600);
    await q.evaluate(() => { const rec = [...document.querySelectorAll('#wqaHdBody .ph-rec')].find(n => n.textContent.includes('Q-2026-0909')); rec.querySelector('.ph-rec-use').click(); });
    await q.waitForTimeout(600);
    A.ok(await q.evaluate(() => document.getElementById('wqaHd').hidden), `${w}px: the covering drawer closes after Use this setup`);
    const f = await fuOf(q, 0);
    A.ok(f.inEditor && /Applied to this item/.test(f.ok) && f.go === 'Apply to 2 items', `${w}px: the follow-up is in the editor, back at the row`);
    const lay = await q.evaluate(() => { const bs = [...document.querySelectorAll('#wqaRows [data-fu="0"] .btn')].map(b => b.getBoundingClientRect());
      return { in: bs.every(b => b.width > 0 && b.right <= window.innerWidth + 1 && b.left >= -1), h: Math.min(...bs.map(b => b.height)),
        sx: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
    A.ok(lay.in && lay.sx, `${w}px: the question fits, no horizontal scroll`);
    A.ok(lay.h >= 36, `${w}px: touch-size buttons (${Math.round(lay.h)}px)`);
    await q.click('[data-pxe="0"] [data-rc="apply-now"]');
    await q.waitForTimeout(600);
    A.ok(await q.evaluate(() => wqaRowAccepted(wqa.rows[1]) && wqaRowAccepted(wqa.rows[2])), `${w}px: Apply prices the compatible items`);
    A.includes((await fuOf(q, 0)).ok, 'Applied to 2 items', `${w}px: local success`);
    A.eq(JSON.stringify(q._dcErrors), '[]', `${w}px: no page errors`);
    await q.close();
  }
};
