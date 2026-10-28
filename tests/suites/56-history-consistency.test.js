/* ── History consistency + Quick Add UX polish ─────────────────────────────
   Owner smoke (2026-10-28):
   A. A row's badge, its quick preview and Full History share ONE match truth.
      The server ranks and pages against the dimensions it is sent, so each
      row's lookup is its own: an L500 row's page never stands in for L900.
   B. The badge that opens the preview closes it (▾ / ▴); X and Esc still do.
   C. Full History replaces the quick preview; the pricing editor stays.
   D. A mixed batch says "Mixed" in the summary, never "MS, 4140 QT".
   E. The analysis-note placeholder names everything a note may add.   */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');
const { setLang } = require('../lib/dom-i18n');

/* A pricing-history API that does what api.php does: classify and rank the
   whole set against the dimensionPreview it is SENT, this customer first,
   then one page of it. */
const dimsOf = s => { const o = {}; const re = /\b(L|W|TL)\s*([0-9.]+)/gi; let m;
  while ((m = re.exec(String(s || ''))) !== null) o[m[1].toUpperCase()] = Number(m[2]); return o; };
const dist = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); if (!ka.length || !kb.length) return null;
  let t = 0; new Set(ka.concat(kb)).forEach(k => { t += Math.abs((a[k] || 0) - (b[k] || 0)); }); return t; };
let qn = 0;
const BASE = { refNo: '', date: '2026-01-01', customer: 'ABC HARDWARE', companyId: 1, productType: 'L BOLT', material: '4140',
  sizeType: 'FULLSIZE', finish: 'PL', finishMatch: true, cleanSize: 'M24', qty: 2, accessoryCost: 0, accessorySummary: '',
  accessoryAmbiguous: false, priceMode: 'auto', priceModeLabel: 'Auto Round', costRate: 5.5, addCost: 4.5, markup: 5, weight: 3.4, legacy: false };
const rec = (L, extra) => { qn++; const d = Object.assign({}, BASE, extra || {});
  return Object.assign(d, { quotationId: qn, refNo: d.refNo || 'Q-2026-' + String(qn).padStart(4, '0'),
    dimensionPreview: 'L ' + L + ' x W 100 x TL 150mm', unitPrice: 20 + L / 100, boltUnitPrice: 20 + L / 100 }); };
/* 5 exact L900 (older), 2 exact L400, 30 near L500 (newer), a few long ones. */
const LIB = [].concat(
  [1, 2, 3, 4, 5].map(k => rec(900, { date: '2025-0' + k + '-01', costRate: 5.5, refNo: 'Q-EX900-' + k })),
  [1, 2].map(k => rec(400, { date: '2025-06-0' + k, refNo: 'Q-EX400-' + k })),
  Array.from({ length: 30 }, (_, k) => rec(505 + k * 2, { date: '2026-09-' + String(1 + (k % 28)).padStart(2, '0') })),
  [1100, 1200, 1300].map(L => rec(L, { date: '2026-08-01' })));
function fakeApi(lib) {
  const calls = [];
  const fn = url => {
    const q = new URL(url).searchParams;
    const want = dimsOf(q.get('dimensionPreview')), co = Number(q.get('company_id') || 0);
    calls.push({ dims: q.get('dimensionPreview'), offset: Number(q.get('offset')), limit: Number(q.get('limit')) });
    const recs = lib.map(r => { const d = dist(want, dimsOf(r.dimensionPreview));
      return Object.assign({}, r, { own: !!co && r.companyId === co, dimDistance: d, exactDims: d === 0 }); });
    recs.sort((a, b) => ((a.own ? 0 : 1) - (b.own ? 0 : 1)) || (a.dimDistance - b.dimDistance)
      || String(b.date).localeCompare(String(a.date)) || (b.quotationId - a.quotationId));
    const cls = r => r.finishMatch === false ? 'ref' : r.exactDims ? 'exact' : r.dimDistance !== null ? 'close' : 'ref';
    const off = Number(q.get('offset') || 0), lim = Number(q.get('limit') || 20);
    return { ok: true, data: { records: recs.slice(off, off + lim), total: recs.length,
      ownTotal: recs.filter(r => r.own).length, otherTotal: recs.filter(r => !r.own).length,
      exactTotal: recs.filter(r => cls(r) === 'exact').length, closeTotal: recs.filter(r => cls(r) === 'close').length,
      refTotal: recs.filter(r => cls(r) === 'ref').length, offset: off, limit: lim } };
  };
  fn.calls = calls;
  return fn;
}
const LB = '4140 QT L BOLT PL FULLSIZE\nM24 x 500 x 100 x 150 - 2pcs\nM24 x 900 x 100 x 150 - 2pcs\nM24 x 400 x 100 x 150 - 2pcs\nM24 x 1500 x 100 x 150 - 2pcs';

const badge = (p, i) => p.evaluate(i => { const b = document.querySelector('#wqaRows [data-hs-cell="' + i + '"]');
  return b ? { t: (b.querySelector('.wqa-hs-t') || b).textContent.trim(), caret: ((b.querySelector('.wqa-hs-caret') || { dataset: {} }).dataset.open === '1') ? 'up' : 'down',
    exp: b.getAttribute('aria-expanded'), cls: b.className } : null; }, i);
const hqOf = p => p.evaluate(() => [...document.querySelectorAll('#wqaRows .wqa-hq')].map(h => ({
  row: h.closest('[data-wqa-row]').getAttribute('data-wqa-row'),
  cls: [...h.querySelectorAll('.wqa-hq-row')].map(x => x.getAttribute('data-hq-cls')),
  spec: [...h.querySelectorAll('.wqa-hq-spec')].map(x => x.textContent.trim()) })));
const drawer = p => p.evaluate(() => { const d = document.getElementById('wqaHd');
  return { open: !d.hidden, i: wqa.hd ? wqa.hd.i : null, dims: wqa.hd ? wqa.hd.spec.dimensionPreview : '',
    count: ((document.querySelector('#wqaHdBody .ph-count-cls')) || {}).textContent || '',
    first: ((document.querySelector('#wqaHdBody .ph-rec')) || {}).textContent || '' }; });
const editorOpen = (p, i) => p.evaluate(i => !!document.querySelector('[data-pxe="' + i + '"]')
  && ['costRate', 'addCost', 'markup', 'priceMode'].every(k => !!document.querySelector('[data-pxe="' + i + '"] [data-px="' + k + '"]')), i);
const noHScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

module.exports = async (browser, A) => {
  // ═══ A — one match truth per row ══════════════════════════════════════════
  A.suite('history consistency — each row classifies its own history');
  let api = fakeApi(LIB);
  let p = await openApp(browser, { api: { get_pricing_history: api } });
  await quickAddPaste(p, LB, { expanded: false, settle: 1200 });
  const dimsSent = await p.evaluate(() => wqa.rows.map(r => wqaHistSpec(r).dimensionPreview));
  A.ok(/L 900/.test(dimsSent[1]) && /W 100/.test(dimsSent[1]) && /TL 150/.test(dimsSent[1]), 'row 2 asks with its own L900 × W100 × TL150: ' + dimsSent[1]);
  A.eq((await badge(p, 1)).t, 'Exact', 'L900 row: Exact (L500 row before it does not leak its page)');
  A.eq((await badge(p, 2)).t, 'Exact', 'L400 row: Exact');
  A.eq((await badge(p, 0)).t, 'Similar', 'L500 row: Similar (no exact L500 exists)');
  A.eq((await badge(p, 3)).t, 'Similar', 'L1500 row: Similar only');
  A.ok(new Set(api.calls.filter(c => c.offset === 0).map(c => c.dims)).size === 4, 'one lookup per distinct geometry (4 rows, 4 sizes)');
  // quick preview: Exact first, the row's own dims
  await p.click('#wqaRows [data-hs="1"]');
  await p.waitForTimeout(300);
  let hq = await hqOf(p);
  A.eq(hq.length, 1, 'one preview open');
  A.eq(hq[0].row, '1', 'on row 2');
  A.eq(hq[0].cls[0], 'exact', 'Exact records first in the preview');
  A.ok(hq[0].spec[0].includes('L900') && hq[0].spec[0].includes('W100') && hq[0].spec[0].includes('TL150'), 'the first record is M24 × L900 × W100 × TL150: ' + hq[0].spec[0]);
  A.ok(hq[0].cls.indexOf('close') < 0 || hq[0].cls.lastIndexOf('exact') < hq[0].cls.indexOf('close'), 'no Similar ranked above an Exact');
  // Full History of the same row: same truth
  await p.evaluate(() => document.querySelector('#wqaRows [data-wqa-row="1"] .wqa-hq-foot .btn').click());
  await p.waitForTimeout(600);
  let d = await drawer(p);
  A.ok(d.open && d.i === 1 && /L 900/.test(d.dims), 'Full History is for row 2 itself (L900), not row 1');
  A.includes(d.count, '5 exact', 'Full History: 5 exact');
  A.includes(d.first, 'L 900', 'Full History lists the exact L900 first');
  await p.evaluate(() => wqaHdClose());
  // row 3 (L400) never reads row 1/2's dims
  await p.evaluate(() => wqaHdOpen(2));
  await p.waitForTimeout(600);
  d = await drawer(p);
  A.ok(d.i === 2 && /L 400/.test(d.dims) && /2 exact/.test(d.count), 'History on row 3 uses L400 (2 exact), not another row');
  await p.evaluate(() => wqaHdClose());
  // editing a row's length reloads its own truth
  await p.evaluate(() => { wqa.rows[0].length = '900'; wqaRecomputeAll('force'); });
  await p.waitForTimeout(900);
  A.eq((await badge(p, 0)).t, 'Exact', 'row 1 changed to L900 → Exact on reload');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (consistency)');
  await p.close();

  // exact records of other customers below this customer's similar ones
  A.suite('history consistency — this customer first, exact still found');
  qn = 1000;
  const OWN = [].concat(LIB.slice(0, 5).map(r => Object.assign({}, r, { companyId: 2 })),
    Array.from({ length: 26 }, (_, k) => rec(600 + k, { companyId: 7 })));
  api = fakeApi(OWN);
  p = await openApp(browser, { api: { get_pricing_history: api } });
  await p.evaluate(() => { selectedCompanyId = 7; });
  await quickAddPaste(p, '4140 QT L BOLT PL FULLSIZE\nM24 x 900 x 100 x 150 - 2pcs', { expanded: false, settle: 1200 });
  A.eq((await badge(p, 0)).t, 'Exact', 'own similar records fill page one; the row still says Exact');
  A.ok(api.calls.some(c => c.offset > 0), 'the further page holding the exact records was read');
  await p.click('#wqaRows [data-hs="0"]');
  await p.waitForTimeout(300);
  hq = await hqOf(p);
  A.eq(hq[0].cls[0], 'exact', 'preview leads with Exact');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (own first)');
  await p.close();

  // ═══ B + C — toggle, drawer handoff ══════════════════════════════════════
  for (const w of [1440, 820, 390]) {
    A.suite(`history toggle + drawer handoff — ${w}px`);
    qn = 0;
    p = await openApp(browser, { viewport: { width: w, height: 900 }, api: { get_pricing_history: fakeApi(LIB) } });
    await quickAddPaste(p, LB, { expanded: false, settle: 1200 });
    await p.click('#wqaRows [data-hs="1"]');
    await p.waitForTimeout(250);
    let b = await badge(p, 1);
    A.ok((await hqOf(p)).length === 1 && b.exp === 'true' && b.caret === 'up' && /is-on/.test(b.cls), `${w}: Exact ▾ opens the preview, badge shows ▴`);
    await p.click('#wqaRows [data-hs="1"]');
    await p.waitForTimeout(250);
    b = await badge(p, 1);
    A.ok((await hqOf(p)).length === 0 && b.exp === 'false' && b.caret === 'down', `${w}: the same badge closes it (▾)`);
    await p.click('#wqaRows [data-hs="1"]');
    await p.waitForTimeout(250);
    A.eq((await hqOf(p)).length, 1, `${w}: and reopens it`);
    await p.click('#wqaRows [data-hs="0"]');
    await p.waitForTimeout(250);
    hq = await hqOf(p);
    A.ok(hq.length === 1 && hq[0].row === '0' && (await badge(p, 1)).exp === 'false', `${w}: Similar on row 1 → only row 1's preview is open`);
    await p.click('#wqaRows [data-hs="0"]');
    await p.waitForTimeout(250);
    A.eq((await hqOf(p)).length, 0, `${w}: Similar closes the same way`);
    await p.click('#wqaRows [data-hs="1"]');
    await p.waitForTimeout(250);
    await p.click('#wqaRows .wqa-hq-x');
    await p.waitForTimeout(250);
    A.eq((await hqOf(p)).length, 0, `${w}: X still closes`);
    await p.click('#wqaRows [data-hs="1"]');
    await p.waitForTimeout(250);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(250);
    A.ok((await hqOf(p)).length === 0 && await p.evaluate(() => document.getElementById('wqaModal').classList.contains('open')), `${w}: Esc closes the preview, not Quick Add`);
    // with the editor open
    await p.evaluate(() => wqaPxToggle(1));
    await p.waitForTimeout(250);
    await p.click('#wqaRows [data-hs="1"]');
    await p.waitForTimeout(250);
    A.ok((await hqOf(p)).length === 1 && await editorOpen(p, 1), `${w}: preview opens beside the open pricing editor`);
    const ph = await p.evaluate(() => { const b = document.querySelector('[data-px-row="1"] .wqa-px-hist'); return { exp: b.getAttribute('aria-expanded'), up: !!b.querySelector('.wqa-hs-caret.is-up') }; });
    A.ok(ph.exp === 'true' && ph.up, `${w}: the editor's History button shows open too`);
    await p.click('#wqaRows [data-hs="1"]');
    await p.waitForTimeout(250);
    A.ok((await hqOf(p)).length === 0 && await editorOpen(p, 1), `${w}: closing the preview leaves the editor open`);
    // C — Full History replaces the preview
    await p.click('#wqaRows [data-hs="1"]');
    await p.waitForTimeout(250);
    const y0 = await p.evaluate(() => window.scrollY + (document.getElementById('wqaRows').closest('.modal-body,.wqa-body') || document.body).scrollTop);
    await p.evaluate(() => document.querySelector('#wqaRows [data-wqa-row="1"] .wqa-hq-foot .btn').click());
    await p.waitForTimeout(700);
    d = await drawer(p);
    A.ok(d.open && d.i === 1, `${w}: Full History opens for row 2`);
    A.eq((await hqOf(p)).length, 0, `${w}: the quick preview collapses — no duplicate history`);
    A.ok(await editorOpen(p, 1), `${w}: the pricing editor stays open (Cost / Add / Markup / Mode)`);
    if (w === 1440) {
      A.ok(await p.evaluate(() => document.body.classList.contains('wqa-hd-side')), '1440: the drawer docks beside the editor');
      await p.fill('[data-pxe="1"] [data-px="costRate"]', '6');
      await p.press('[data-pxe="1"] [data-px="costRate"]', 'Tab');
      await p.waitForTimeout(400);
      A.ok(await p.evaluate(() => String(wqa.rows[1].calc.costRate) === '6' && !document.getElementById('wqaHd').hidden), '1440: current pricing stays editable beside the drawer');
    }
    A.ok(await noHScroll(p), `${w}: no horizontal overflow with the drawer open`);
    const dr = await p.evaluate(() => { const r = document.getElementById('wqaHd').getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= -1 && r.width > 0; });
    A.ok(dr, `${w}: drawer sits inside the viewport`);
    await p.evaluate(() => wqaHdClose());
    await p.waitForTimeout(300);
    A.eq((await hqOf(p)).length, 0, `${w}: closing Full History does not bring the preview back`);
    A.ok(await editorOpen(p, 1), `${w}: back to the row with its editor`);
    // Full History opened directly
    await p.evaluate(() => wqaHdOpen(2));
    await p.waitForTimeout(600);
    A.ok((await hqOf(p)).length === 0 && (await drawer(p)).i === 2, `${w}: Full History opened directly → no preview alongside`);
    await p.evaluate(() => wqaHdClose());
    A.ok(await noHScroll(p), `${w}: no horizontal overflow`);
    A.eq(JSON.stringify(p._dcErrors), '[]', `${w}: no page errors`);
    await p.close();
  }

  // ═══ D — Mixed material summary ══════════════════════════════════════════
  A.suite('mixed material summary');
  p = await openApp(browser, { api: { get_pricing_history: fakeApi(LIB) } });
  const sel = id => p.evaluate(id => { const s = document.getElementById(id); const o = s.options[s.selectedIndex];
    return { text: o ? o.text : '', title: s.getAttribute('title') || '' }; }, id);
  await quickAddPaste(p, '4140 QT L BOLT PL FULLSIZE\nM24 x 900 x 100 x 150 - 2pcs\nM24 x 400 x 100 x 150 - 2pcs', { expanded: false, settle: 900 });
  let m = await sel('wqaMaterial');
  A.eq(m.text, '4140 QT', 'single material batch: Material 4140 QT');
  A.eq(m.title, '', 'single: no mixed tooltip');
  await quickAddPaste(p, 'MS L BOLT PL FULLSIZE\nM24 x 900 x 100 x 150 - 2pcs\nM24 x 400 x 100 x 150 - 2pcs\n\n4140 QT L BOLT PL FULLSIZE\nM24 x 900 x 100 x 150 - 2pcs\nM24 x 400 x 100 x 150 - 2pcs', { expanded: false, settle: 900 });
  const mats = await p.evaluate(() => wqa.rows.filter(r => !r.removed).map(r => wqaRowSpec(r, 'material')));
  if (new Set(mats).size < 2) {
    // the parser kept one material for the paste: build the mixed batch by row
    await p.evaluate(() => { wqa.rows[2].material = 'MS'; wqa.rows[3].material = 'MS'; wqaRecomputeAll('force'); wqaRenderCommon(); });
    await p.waitForTimeout(400);
  }
  const before = await p.evaluate(() => wqa.rows.filter(r => !r.removed).map(r => wqaRowSpec(r, 'material')));
  m = await sel('wqaMaterial');
  A.eq(m.text, 'Mixed', 'mixed batch: Material reads Mixed');
  A.ok(!/,/.test(m.text), 'never a comma-joined value');
  A.ok(/MS/.test(m.title) && /4140/.test(m.title), 'which materials: in the tooltip (' + m.title + ')');
  const heads = await p.evaluate(() => [...document.querySelectorAll('#wqaRows .wqa-ser-head')].map(h => h.textContent.replace(/\s+/g, ' ').trim()));
  A.eq(heads.length, 2, 'two groups, one per material');
  A.ok(heads.some(h => /^MS\b/i.test(h) || / MS /i.test(' ' + h + ' ')) && heads.some(h => /4140 QT/i.test(h)), 'MS … L BOLT · PL and 4140 QT … L BOLT · PL: ' + heads.join(' | '));
  const after = await p.evaluate(() => wqa.rows.filter(r => !r.removed).map(r => wqaRowSpec(r, 'material')));
  A.eq(JSON.stringify(after), JSON.stringify(before), 'Mixed is a summary only: no row material rewritten');
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (mixed)');

  // ═══ E — analysis-note placeholder ═══════════════════════════════════════
  A.suite('analysis note placeholder');
  const ph = () => p.evaluate(() => document.getElementById('wqaAiNote').getAttribute('placeholder'));
  A.eq(await ph(), 'Add missing details for AI, e.g. M12 Fullsize, L1000 W100 TL75, Qty 20, MS, ZP, Remark: urgent', 'EN placeholder');
  await setLang(p, 'zh');
  A.eq(await ph(), '补充 AI 识别不到的资料，例如 M12 Fullsize，L1000 W100 TL75，Qty 20，MS，ZP，Remark：urgent', 'CN placeholder');
  A.eq(await p.evaluate(() => { const s = document.getElementById('wqaMaterial'); return s.options[s.selectedIndex].text; }), '多种', 'CN: Mixed reads 多种');
  await setLang(p, 'en');
  A.eq(await ph(), 'Add missing details for AI, e.g. M12 Fullsize, L1000 W100 TL75, Qty 20, MS, ZP, Remark: urgent', 'switching back restores EN');
  // the note still reads the same way
  const read = await p.evaluate(() => wqaNoteSummary('M12 Fullsize, L1000 W100 TL75, Qty 20').join(' | '));
  A.ok(/Size M12/.test(read) && /L 1000/.test(read) && /TL 75/.test(read) && /Qty 20/.test(read), 'note parsing unchanged: ' + read);
  A.eq(JSON.stringify(p._dcErrors), '[]', 'no page errors (note)');
  await p.close();
};
