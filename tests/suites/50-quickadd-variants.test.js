/* ── Quick Add — multi-variant expansion ───────────────────────────────────
   One detected physical spec can become several quotation items when the user
   wants different Material / Size Type / Finish. Every variant is an ordinary
   row: its own material, its own calculator pass, its own pricing state, its
   own edits. Nothing here changes pricing arithmetic — the assertions compare
   each variant's price with the price the SAME spec gets when it is detected
   on its own.                                                               */
'use strict';
const H = require('../lib/harness');

const dp = (id, material, sizeType, finish, costRate) =>
  ({ id, type: 'lbolt', material, sizeType, size: '', finish, costRate, addCost: 1, markup: 0, active: '1' });
const DP = [];
let n = 1;
[['MS', 5], ['4140', 9]].forEach(([m, base]) => ['FULLSIZE', 'UNDERSIZE'].forEach((st, si) => ['PL', 'HDG'].forEach((f, fi) =>
  DP.push(dp(n++, m, st, f, base + si * 0.5 + fi * 1.5)))));

[['MS', 4], ['4140', 6.5]].forEach(([m, base]) => ['FULLSIZE', 'UNDERSIZE'].forEach((st, si) => ['PL', 'HDG'].forEach((f, fi) => DP.push(
  { id: n++, type: 'sagrod', material: m, sizeType: st, size: '', finish: f, costRate: base + si * 0.4 + fi * 1.1, addCost: 0.6, markup: 0, active: '1' }))));

const item = (extra = {}) => Object.assign({
  M: 'M20', L: 600, W: 150, TL: '100', qty: 1, Bmid: null, material: null, finish: null, sizeType: null,
  unclear: null, product: 'L_BOLT', threadEnds: 1, bodyDia: null, H: null, ID: null, S: null, R: null,
}, extra);
const EX = (items, top = {}) => Object.assign({
  product: 'L_BOLT', material: null, finish: null, sizeType: null, threadEnds: 1, note: null, items,
}, top);

async function open(b, opts = {}) {
  const ctx = await b.newContext(opts.context || { viewport: { width: 1440, height: 900 } });
  const p = await H.openApp(b, Object.assign({ context: ctx, api: { get_default_prices: { ok: true, data: DP } } }, opts.app || {}));
  p.on('dialog', d => d.accept().catch(() => {}));
  return { ctx, p };
}
async function extract(p, d, note) {
  await p.evaluate(async ([d, note]) => { wqaHardClose(); wqaOpen(); wqa.aiNote = note || ''; await wqaAiApply(d); }, [d, note || '']);
  await p.waitForTimeout(900);
}
const R = p => p.evaluate(() => wqa.rows.filter(r => !r.removed).map(r => ({
  m: r.material, st: r.sizeType, f: r.finish, vg: r.vg || '', len: r.length, px: r.calc && r.calc.finalUnitPrice, mode: r.priceMode })));
const key = r => `${r.m}/${r.st}/${r.f}`;
const addText = p => p.evaluate(() => document.getElementById('wqaAddBtn').textContent);
async function multi(p, k, values) {
  await p.click(`#wqaCommon [data-mv="${k}"]`);
  await p.evaluate(vs => document.querySelectorAll('#wqaCommon .wqa-mv input').forEach(i => { i.checked = vs.indexOf(i.value) >= 0; }), values);
  await p.click('#wqaCommon .wqa-mv .btn-primary');
  await p.waitForTimeout(900);
}

module.exports = async (browser, A) => {
  A.suite('quick add — multi-variant expansion');
  const ok = (c, m) => A.ok(!!c, m);

  /* ── A. single variant: nothing changes ─────────────────────────────── */
  const { ctx, p } = await open(browser);
  const SINGLE = EX([item()], { material: '4140', finish: 'PL', sizeType: 'FULLSIZE' });
  await extract(p, SINGLE);
  let rows = await R(p);
  A.eq(rows.length, 1, 'A: one spec, one variant → one item');
  ok(!rows[0].vg, 'A: a lone row carries no variant tag');
  ok(await p.evaluate(() => document.getElementById('wqaVarBar').hidden), 'A: no variant bar for a single item');
  A.eq(await addText(p), 'Add 1 Item to Quotation', 'A: button reads Add 1 Item');
  const single4140 = rows[0].px;
  ok(single4140 > 0, 'A: the single item is priced');

  /* ── B. two materials via the compact multi-select ──────────────────── */
  await multi(p, 'material', ['MS', '4140']);
  rows = await R(p);
  A.eq(rows.length, 2, 'B: MS + 4140 → two items');
  A.eq(rows.map(key).sort().join(), '4140/FULLSIZE/PL,MS/FULLSIZE/PL', 'B: the two combinations');
  ok(rows[0].vg && rows[0].vg === rows[1].vg, 'B: both belong to one detected spec');
  A.eq(await p.evaluate(() => document.querySelector('#wqaVarBar .wqa-var-n').textContent.trim()), '2 variants', 'B: variant count');
  A.eq(await addText(p), 'Add 2 Items to Quotation', 'B: button counts enabled variants');
  ok(await p.evaluate(() => /MS, 4140|4140 QT, MS|MS, 4140 QT/.test(document.getElementById('wqaMaterial').selectedOptions[0].textContent)), 'B: the Material control summarises both');
  A.eq(await p.evaluate(() => document.getElementById('wqaRowsCount').textContent), 'Detected 1 item', 'B: still one detected spec');
  ok(await p.evaluate(() => !/Needs Material/i.test(document.getElementById('wqaCommon').textContent)), 'B: no Needs Material with two valid materials');

  /* ── G. independent pricing ─────────────────────────────────────────── */
  const ms = rows.find(r => r.m === 'MS'), q = rows.find(r => r.m === '4140');
  ok(ms.px > 0 && q.px > 0 && ms.px !== q.px, `G: MS ${ms.px} and 4140 ${q.px} are priced independently`);
  A.eq(q.px, single4140, 'G: the 4140 variant prices exactly as the same spec detected alone');
  await extract(p, EX([item()], { material: 'MS', finish: 'PL', sizeType: 'FULLSIZE' }));
  A.eq((await R(p))[0].px, ms.px, 'G: the MS variant prices exactly as the same spec detected alone');

  /* ── H. independent edits ───────────────────────────────────────────── */
  await extract(p, SINGLE);
  await multi(p, 'material', ['MS', '4140']);
  const before = await R(p);
  const shared = await p.evaluate(() => {
    const [a, b] = wqa.rows;
    return { acc: a.acc === b.acc && a.acc != null, po: a.priceOverride === b.priceOverride, hist: a.calc === b.calc };
  });
  ok(!shared.acc && !shared.po && !shared.hist, 'H: no object is shared between variants');
  await p.evaluate(() => { wqaEdit(1, 'length', '650'); wqaEditPrice(1, 'addCost', '3'); wqaRecomputeAll('force'); });
  await p.waitForTimeout(500);
  const after = await R(p);
  A.eq(after[0].len, before[0].len, 'H: editing variant 2 leaves variant 1 length alone');
  A.eq(after[0].px, before[0].px, 'H: and its price');
  A.eq(after[1].len, '650', 'H: variant 2 took the edit');
  ok(after[1].px !== before[1].px, 'H: and re-priced');

  /* ── C / D. size types and finishes ─────────────────────────────────── */
  await extract(p, SINGLE);
  await multi(p, 'sizeType', ['FULLSIZE', 'UNDERSIZE']);
  rows = await R(p);
  A.eq(rows.map(key).join(), '4140/FULLSIZE/PL,4140/UNDERSIZE/PL', 'C: Fullsize + Undersize → two items, in order');
  ok(await p.evaluate(() => !/Needs Size Type/i.test(document.getElementById('wqaCommon').textContent)), 'C: no Needs Size Type');
  await extract(p, SINGLE);
  await multi(p, 'finish', ['PL', 'HDG']);
  rows = await R(p);
  A.eq(rows.map(key).join(), '4140/FULLSIZE/PL,4140/FULLSIZE/HDG', 'D: PL + HDG → two items');
  ok(rows[0].px !== rows[1].px, 'D: finishes price independently');

  /* ── E / F. eight combinations, exclude one ─────────────────────────── */
  await extract(p, SINGLE);
  await multi(p, 'material', ['MS', '4140']);
  await multi(p, 'sizeType', ['FULLSIZE', 'UNDERSIZE']);
  await multi(p, 'finish', ['PL', 'HDG']);
  rows = await R(p);
  A.eq(rows.length, 8, 'E: 2 × 2 × 2 = 8 variants');
  A.eq(new Set(rows.map(key)).size, 8, 'E: eight distinct combinations');
  A.eq(rows.map(key).slice(0, 4).join(), 'MS/FULLSIZE/PL,MS/FULLSIZE/HDG,MS/UNDERSIZE/PL,MS/UNDERSIZE/HDG', 'E: material outermost, then size type, then finish');
  A.eq(await addText(p), 'Add 8 Items to Quotation', 'E: Add 8 Items');
  await p.click('#wqaVarBar .wqa-var-toggle');
  A.eq(await p.evaluate(() => document.querySelectorAll('#wqaVarBar .wqa-var-row').length), 8, 'E: Review Variants lists all eight');
  ok(await p.evaluate(() => /1\. MS \/ Fullsize \/ PL/.test(document.querySelector('#wqaVarBar .wqa-var-row').textContent)), 'E: the list reads "1. MS / Fullsize / PL"');
  await p.evaluate(() => { document.querySelectorAll('#wqaVarBar .wqa-var-row input').forEach(i => { if (/4140 QT \/ Undersize \/ HDG|4140 \/ Undersize \/ HDG/.test(i.closest('label').textContent)) i.click(); }); });
  await p.waitForTimeout(500);
  A.eq(await addText(p), 'Add 7 Items to Quotation', 'F: excluding one combination → Add 7 Items');
  A.eq(await p.evaluate(() => document.querySelector('#wqaVarBar .wqa-var-n').textContent.trim()), '8 variants', 'F: total proposed stays 8');
  ok(await p.evaluate(() => /7 ready/.test(document.querySelector('#wqaVarBar .wqa-var-st').textContent) && /1 excluded/.test(document.querySelector('#wqaVarBar .wqa-var-st').textContent)), 'F: 7 ready, 1 excluded');
  A.eq((await R(p)).length, 7, 'F: seven enabled rows');
  await p.evaluate(() => { const i = [...document.querySelectorAll('#wqaVarBar .wqa-var-row input')].find(x => !x.checked); i.click(); });
  await p.waitForTimeout(700);
  A.eq(await addText(p), 'Add 8 Items to Quotation', 'F: the excluded combination can be restored without re-analysing');
  const restored = (await R(p)).find(r => r.m === '4140' && r.st === 'UNDERSIZE' && r.f === 'HDG');
  ok(restored && restored.px > 0, 'F: and it is priced');

  /* ── I. shorthand in Additional info ────────────────────────────────── */
  for (const note of ['MS 4140', 'MS, 4140', 'Material: MS 4140', 'Material: MS, 4140', 'Same dimensions: MS / 4140']) {
    await extract(p, EX([item()]), note);
    rows = await R(p);
    A.eq(rows.map(r => r.m).join(), 'MS,4140', `I: "${note}" → MS and 4140, in the order written`);
  }
  ok(await p.evaluate(() => !wqa.rows.some(r => r.material === 'MS 4140')), 'I: no false single material');
  await extract(p, EX([item()], { sizeType: null }), 'MS 4140 Fullsize Undersize PL HDG');
  rows = await R(p);
  A.eq(rows.length, 8, 'I: "MS 4140 Fullsize Undersize PL HDG" → eight proposed variants');
  A.eq(await p.evaluate(() => document.getElementById('wqaRowsCount').textContent), 'Detected 1 item', 'I: one physical spec');
  await extract(p, EX([item()]), '4140');
  A.eq((await R(p)).length, 1, 'I: one stated material is not a variant');
  await extract(p, EX([item(), item({ L: 700 })]), 'MS 4140');
  A.eq((await R(p)).length, 2, 'I: an unscoped note over two specs is not guessed at');
  await extract(p, EX([item(), item({ L: 700 })]), 'L bolt MS 4140');
  A.eq((await R(p)).length, 4, 'I: a note that names the product expands each of its specs');

  /* ── J. single-select regression ────────────────────────────────────── */
  await extract(p, SINGLE);
  await p.selectOption('#wqaMaterial', 'MS');
  await p.waitForTimeout(600);
  rows = await R(p);
  A.eq(rows.length, 1, 'J: choosing one material from the select changes the one item');
  A.eq(rows[0].m, 'MS', 'J: and it is that material');
  ok(!rows[0].vg, 'J: no variant tag appears');
  await multi(p, 'material', ['MS', '4140']);
  await p.selectOption('#wqaMaterial', '4140');
  await p.waitForTimeout(700);
  rows = await R(p);
  A.eq(rows.length, 1, 'J: picking one material from the select collapses the variants');
  A.eq(rows[0].m, '4140', 'J: onto that material');
  ok(await p.evaluate(() => document.getElementById('wqaVarBar').hidden), 'J: and the variant bar goes away');

  /* ── K. add, save, reopen ───────────────────────────────────────────── */
  await extract(p, SINGLE);
  await multi(p, 'material', ['MS', '4140']);
  await p.evaluate(() => wqaAddAll());
  await p.waitForTimeout(1200);
  const items = await p.evaluate(() => quoteItems.map(i => ({ type: i.itemType, material: i.material, sizeType: i.sizeType, finish: i.finish,
    unit: i.finalUnitPrice, desc: i.desc, vg: i.vg, dim: i.dimensionPreview })));
  A.eq(items.length, 2, 'K: two normal quotation items were added');
  A.eq(items.map(i => i.material).sort().join(), '4140,MS', 'K: one per material');
  ok(items[0].unit !== items[1].unit, 'K: with their own prices');
  ok(items.every(i => i.vg === undefined), 'K: no variant container survives into the quotation');
  await p.evaluate(async () => {
    document.getElementById('qi-customer').value = 'Alpha Sdn Bhd'; syncQI();
    await api('save_quotation', { ref_no: el('qi-refno').value, quote_date: el('qi-date').value, customer_name: 'Alpha Sdn Bhd',
      customer_phone: '', prepared_by: '', remarks: '', company_id: null, items: quoteItems, total_amount: 0 }, 'POST');
  });
  const saved = await p.evaluate(() => quoteItems.map(i => i));
  const re = await open(browser, { app: { handoff: { id: 7, ref_no: 'DC-TEST-001', quote_date: '2026-10-26', customer_name: 'Alpha Sdn Bhd', items: saved } } });
  const reopened = await re.p.evaluate(() => quoteItems.map(i => ({ material: i.material, unit: i.finalUnitPrice, size: i.size })));
  A.eq(reopened.length, 2, 'K: reopened with two independent items');
  A.eq(reopened.map(i => i.material).sort().join(), '4140,MS', 'K: materials preserved');
  A.eq(reopened.map(i => i.unit).join(), items.map(i => i.unit).join(), 'K: prices preserved');
  await re.ctx.close();
  await ctx.close();

  /* ── Product as a variant axis ──────────────────────────────────────── */
  {
    const P = await open(browser);
    const pp = P.p;
    const FS = { material: 'MS', finish: 'PL', sizeType: 'FULLSIZE' };
    const standalone = async (token, it) => {
      await extract(pp, EX([it], Object.assign({ product: token, threadEnds: token === 'SAG_ROD' ? 2 : 1 }, FS)));
      return (await pp.evaluate(() => wqa.rows.map(r => ({ px: r.calc && r.calc.finalUnitPrice, w: r.calc && r.calc.weight }))))[0];
    };
    const lAlone = await standalone('L_BOLT', item());
    const sAlone = await standalone('SAG_ROD', item({ W: null, TL: '100/100', product: 'SAG_ROD', threadEnds: 2 }));
    ok(lAlone.px > 0 && sAlone.px > 0 && lAlone.px !== sAlone.px, `P: reference prices L Bolt ${lAlone.px}, Sag Rod ${sAlone.px}`);

    /* A. two products, safe map */
    await extract(pp, EX([item()], FS));
    await multi(pp, 'product', ['lbolt', 'sagrod']);
    let pr = await pp.evaluate(() => wqa.rows.filter(r => !r.removed).map(r => ({ t: r.product, size: r.size, len: r.length, w: r.w, tl: r.threadLen, tl2: r.threadLen2,
      px: r.calc && r.calc.finalUnitPrice, wt: r.calc && r.calc.weight, missing: wqaRowMissing(r), vg: r.vg })));
    A.eq(pr.map(r => r.t).join(), 'lbolt,sagrod', 'PA: L Bolt + Sag Rod → two items, product outermost');
    const L = pr[0], S = pr[1];
    A.eq(`${S.size}/${S.len}/${S.tl}`, 'M20/600/100', 'PA: the Sag Rod keeps diameter, length and thread');
    A.eq(S.tl2, '100', 'PA: a single stated thread is both ends of a rod');
    A.eq(`${L.size}/${L.len}/${L.w}/${L.tl}`, 'M20/600/150/100', 'PA: the L Bolt keeps all four');
    ok(L.vg && L.vg === S.vg, 'PA: both belong to one detected spec');
    A.eq(await addText(pp), 'Add 2 Items to Quotation', 'PA: Add 2 Items');
    /* C. non-applicable dimension */
    A.eq(S.w, '', 'PC: Sag Rod does not carry the L Bolt Width');
    ok(!S.missing.length, 'PC: and is not asked for anything else');
    /* E. independent pricing */
    A.eq(L.px, lAlone.px, 'PE: the L Bolt variant prices exactly as an L Bolt detected alone');
    A.eq(S.px, sAlone.px, 'PE: the Sag Rod variant prices exactly as a Sag Rod detected alone');
    ok(L.wt !== S.wt, 'PE: weights are each product own');
    ok(await pp.evaluate(() => /L Bolt, Sag Rod/.test(document.getElementById('wqaProduct').selectedOptions[0].textContent)), 'PA: the Product control summarises both');

    /* B. product x material */
    await multi(pp, 'material', ['MS', '4140']);
    pr = await pp.evaluate(() => wqa.rows.filter(r => !r.removed).map(r => [r.product, r.material].join('/')));
    A.eq(pr.join(), 'lbolt/MS,lbolt/4140,sagrod/MS,sagrod/4140', 'PB: 2 products x 2 materials = 4 variants, in order');
    A.eq(await pp.evaluate(() => document.querySelector('#wqaVarBar .wqa-var-n').textContent.trim()), '4 variants', 'PB: variant count includes Product');
    ok(await pp.evaluate(() => /= 4$/.test(document.querySelector('#wqaVarBar .wqa-var-n').title)), 'PB: the count explains itself');
    await pp.click('#wqaVarBar .wqa-var-toggle');
    const labels = await pp.evaluate(() => [...document.querySelectorAll('#wqaVarBar .wqa-var-l')].map(x => x.textContent.trim()));
    A.eq(labels.join(' | '), '1. L Bolt / MS / Fullsize / PL | 2. L Bolt / 4140 QT / Fullsize / PL | 3. Sag Rod / MS / Fullsize / PL | 4. Sag Rod / 4140 QT / Fullsize / PL', 'PB: Review Variants names the product');
    const px4 = await pp.evaluate(() => wqa.rows.map(r => r.calc.finalUnitPrice));
    ok(new Set(px4).size === 4, `PB: four independent prices (${px4})`);
    /* F. exclusion */
    await pp.evaluate(() => document.querySelectorAll('#wqaVarBar .wqa-var-row input')[3].click());
    await pp.waitForTimeout(500);
    A.eq(await addText(pp), 'Add 3 Items to Quotation', 'PF: excluding one product combination -> Add 3 Items');
    A.eq(await pp.evaluate(() => document.querySelector('#wqaVarBar .wqa-var-n').textContent.trim()), '4 variants', 'PF: total proposed stays 4');
    await pp.evaluate(() => { wqaEdit(2, 'length', '700'); wqaRecomputeAll('force'); });
    await pp.waitForTimeout(500);
    ok(await pp.evaluate(() => wqa.rows[0].length === '600' && wqa.rows[2].length === '700'), 'PH: editing a Sag Rod variant leaves the L Bolt one alone');

    /* collapse by the ordinary select */
    await pp.selectOption('#wqaProduct', 'sagrod');
    await pp.waitForTimeout(800);
    pr = await pp.evaluate(() => wqa.rows.filter(r => !r.removed).map(r => [r.product, r.material].join('/')));
    ok(pr.length > 0 && pr.every(x => x.startsWith('sagrod')), `PJ: picking one product from the select collapses onto it (${pr})`);

    /* D. unsafe product */
    await extract(pp, EX([item()], FS));
    await multi(pp, 'product', ['lbolt', 'jbolt']);
    const jb = await pp.evaluate(() => { const r = wqa.rows.find(x => x.product === 'jbolt'); return r && { h: r.h, id: r.id, s: r.s, len: r.length, w: r.w, miss: wqaRowMissing(r), blocked: wqaRowBlocked(r) }; });
    ok(jb, 'PD: a J Bolt variant is proposed');
    ok(jb.h === '' && jb.id === '' && jb.s === '', 'PD: H / ID / S are not guessed from L / W');
    ok(jb.miss.indexOf('H') >= 0 && jb.miss.indexOf('ID') >= 0 && jb.miss.indexOf('S') >= 0, `PD: it asks for H, ID and S (${jb.miss})`);
    ok(jb.blocked, 'PD: and is not add-ready');
    await pp.click('#wqaVarBar .wqa-var-toggle');
    ok(await pp.evaluate(() => /Needs attention/.test(document.getElementById('wqaVarBar').textContent)), 'PD: Review Variants flags it');
    ok(await pp.evaluate(() => document.getElementById('wqaFootNeed').textContent.length > 0), 'PD: the existing need-attention footer shows');
    await pp.evaluate(() => wqaAddAll()); await pp.waitForTimeout(1200);
    A.eq(await pp.evaluate(() => quoteItems.length), 1, 'PD: only the L Bolt reached the quotation; the J Bolt waits');
    ok(await pp.evaluate(() => document.getElementById('wqaModal').classList.contains('open')), 'PD: the review stays open on the unresolved variant');
    A.eq(await pp.evaluate(() => wqa.rows.filter(r => !r.removed).length), 1, 'PD: the added row is not offered again');

    /* shorthand */
    for (const note of ['L Bolt Sag Rod', 'Product: L Bolt, Sag Rod', 'L bolt / sag rod']) {
      await extract(pp, EX([item()], FS), note);
      A.eq((await pp.evaluate(() => wqa.rows.filter(r => !r.removed).map(r => r.product))).join(), 'lbolt,sagrod', `PI: "${note}" selects both products`);
    }
    await extract(pp, EX([item()], FS), 'L Bolt Sag Rod MS 4140');
    A.eq(await pp.evaluate(() => wqa.rows.filter(r => !r.removed).length), 4, 'PI: a product list and a material list together -> 4');
    await extract(pp, EX([item()], FS), 'Sag Foo Widget');
    A.eq(await pp.evaluate(() => wqa.rows.filter(r => !r.removed).length), 1, 'PI: unknown product-like words are not variants');
    await extract(pp, EX([item(), item({ L: 700 })], FS), 'L Bolt Sag Rod');
    A.eq(await pp.evaluate(() => wqa.rows.filter(r => !r.removed).length), 2, 'PI: a product list over two specs is not guessed at');
    await P.ctx.close();
  }

  /* ── Ready count, exact variants, combination mode ───────────────────── */
  {
    const Q = await open(browser);
    const q = Q.p;
    const FS = { material: 'MS', finish: 'PL', sizeType: 'FULLSIZE' };
    const bar = () => q.evaluate(() => ({ n: document.querySelector('#wqaVarBar .wqa-var-n').textContent.trim(),
      st: document.querySelector('#wqaVarBar .wqa-var-st').textContent.trim(), btn: document.getElementById('wqaAddBtn').textContent,
      dis: document.getElementById('wqaAddBtn').disabled }));
    /* A. ready count: 2 total, 1 needs attention */
    await extract(q, EX([item()], FS));
    await multi(q, 'product', ['lbolt', 'jbolt']);
    let b = await bar();
    A.eq(b.n, '2 variants', 'RA: total proposed variants');
    ok(/1 ready/.test(b.st) && /1 need attention/.test(b.st), `RA: status line (${b.st})`);
    A.eq(b.btn, 'Add 1 Item to Quotation', 'RA: the button counts only the ready variant');
    ok(!b.dis, 'RA: and stays enabled');
    /* D. zero ready */
    await q.click('#wqaVarBar .wqa-var-toggle');
    await q.evaluate(() => document.querySelector('#wqaVarBar .wqa-var-row input').click());
    await q.waitForTimeout(500);
    b = await bar();
    ok(b.dis, 'RD: nothing ready (one excluded, one unresolved) -> Add is disabled');
    A.eq(b.n, '2 variants', 'RD: both stay listed for correction');
    ok(await q.evaluate(() => document.querySelectorAll('#wqaVarBar .wqa-var-row').length === 2), 'RD: the unresolved variant is still visible');
    /* B / C. 8 total, excluded, needs attention */
    await extract(q, EX([item()], FS));
    await multi(q, 'material', ['MS', '4140']); await multi(q, 'sizeType', ['FULLSIZE', 'UNDERSIZE']); await multi(q, 'finish', ['PL', 'HDG']);
    await q.click('#wqaVarBar .wqa-var-toggle');
    await q.evaluate(() => document.querySelectorAll('#wqaVarBar .wqa-var-row input')[7].click());
    await q.waitForTimeout(500);
    b = await bar();
    A.eq(b.btn, 'Add 7 Items to Quotation', 'RB: 8 total, 1 excluded -> Add 7 Items');
    await q.evaluate(() => { wqaEdit(2, 'length', ''); wqaRecomputeAll('force'); });
    await q.waitForTimeout(600);
    b = await bar();
    A.eq(b.n, '8 variants', 'RC: still 8 total');
    ok(/6 ready/.test(b.st) && /1 excluded/.test(b.st) && /1 need attention/.test(b.st), `RC: 6 ready / 1 excluded / 1 need attention (${b.st})`);
    A.eq(b.btn, 'Add 6 Items to Quotation', 'RC: Add 6 Items');
    await q.evaluate(() => wqaAddAll()); await q.waitForTimeout(1500);
    A.eq(await q.evaluate(() => quoteItems.length), 6, 'RC: exactly the six ready items were added');
    ok(await q.evaluate(() => document.getElementById('wqaModal').classList.contains('open')), 'RC: the unresolved variant stays open for correction');

    /* E / J. exact variants from item-by-item notes */
    const SAG = EX([item({ W: null, TL: '100/100', product: 'SAG_ROD', threadEnds: 2 })], { product: 'SAG_ROD', threadEnds: 2 });
    const exactKeys = () => q.evaluate(() => wqa.rows.filter(r => !r.removed).map(r => [r.product, r.material, r.sizeType, r.finish].join('/')));
    for (const note of [
      'Item 1: 4140 Fullsize Sag Rod PL Item 2: MS Undersize Sag Rod HDG',
      '1. 4140 Fullsize Sag Rod PL 2. MS Undersize Sag Rod HDG',
      'Item 1: 4140 Fullsize Sag Rod PL\nItem 2: MS Undersize Sag Rod HDG',
      'Sag Rod:\n- 4140 Fullsize PL\n- MS Undersize HDG',
      'Sag Rod: - 4140 Fullsize PL - MS Undersize HDG',
      '4140 Fullsize Sag Rod PL; MS Undersize Sag Rod HDG',
    ]) {
      await extract(q, SAG, note);
      A.eq((await exactKeys()).join(' | '), 'sagrod/4140/FULLSIZE/PL | sagrod/MS/UNDERSIZE/HDG', `RE: ${JSON.stringify(note)} -> exactly two exact variants`);
    }
    A.eq(await q.evaluate(() => wqa.vmode[wqa.rows[0].vg]), 'exact', 'RE: the group is in Exact variants mode');
    ok(await q.evaluate(() => document.querySelector('#wqaVarBar [data-vmode="exact"]').classList.contains('is-on')), 'RE: the mode control says Exact variants');
    A.eq(await q.evaluate(() => document.getElementById('wqaRowsCount').textContent), 'Detected 1 item', 'RE: still one detected spec');
    A.eq(await addText(q), 'Add 2 Items to Quotation', 'RE: Add 2 Items, not 8');

    /* F. combination mode */
    await extract(q, SAG, 'MS 4140 Fullsize Undersize PL HDG');
    A.eq((await exactKeys()).length, 8, 'RF: independent field lists -> 8 combinations');
    A.eq(await q.evaluate(() => wqa.vmode[wqa.rows[0].vg]), 'combine', 'RF: in Combine selections mode');
    /* ambiguity */
    await extract(q, SAG, 'Item 1: MS 4140 Fullsize PL Item 2: MS Undersize HDG');
    A.eq((await exactKeys()).length, 1, 'RF: an item that names two materials is ambiguous -> nothing is guessed');
    ok(await q.evaluate(() => /cannot be read safely/.test(document.getElementById('wqaCommon').textContent)), 'RF: and the ambiguity is surfaced');

    /* G / H. independent edit and pricing in exact mode */
    await extract(q, SAG, 'Item 1: 4140 Fullsize Sag Rod PL Item 2: MS Undersize Sag Rod HDG');
    const priced = await q.evaluate(() => wqa.rows.map(r => ({ px: r.calc && r.calc.finalUnitPrice, wt: r.calc && r.calc.weight, cr: r.calc && r.calc.costRate })));
    ok(priced[0].px > 0 && priced[1].px > 0 && priced[0].px !== priced[1].px, `RH: two independent prices (${priced[0].px}, ${priced[1].px})`);
    A.eq(Number(priced[0].cr), 6.5, 'RH: 4140 / Fullsize / PL uses its own cost rate');
    ok(Number(priced[1].cr) > 0 && Number(priced[1].cr) !== Number(priced[0].cr), `RH: MS / Undersize / HDG uses its own cost rate (${priced[1].cr})`);
    ok(priced[0].wt !== priced[1].wt, 'RH: and its own (undersize) weight');
    const alone = async (m, st, f) => { await extract(q, EX([item({ W: null, TL: '100/100', product: 'SAG_ROD', threadEnds: 2 })], { product: 'SAG_ROD', threadEnds: 2, material: m, sizeType: st, finish: f }));
      return q.evaluate(() => wqa.rows[0].calc.finalUnitPrice); };
    A.eq(await alone('4140', 'FULLSIZE', 'PL'), priced[0].px, 'RH: exact row 1 = the same spec priced alone');
    A.eq(await alone('MS', 'UNDERSIZE', 'HDG'), priced[1].px, 'RH: exact row 2 = the same spec priced alone');
    await extract(q, SAG, 'Item 1: 4140 Fullsize Sag Rod PL Item 2: MS Undersize Sag Rod HDG');
    await q.evaluate(() => wqaVarSetField(0, 'finish', 'ZP'));
    await q.waitForTimeout(600);
    let rr = await q.evaluate(() => wqa.rows.map(r => ({ m: r.material, f: r.finish, st: r.sizeType, px: r.calc && r.calc.finalUnitPrice })));
    A.eq(rr[0].f, 'ZP', 'RG: row 1 finish changed to ZP');
    A.eq(`${rr[1].m}/${rr[1].st}/${rr[1].f}`, 'MS/UNDERSIZE/HDG', 'RG: row 2 unchanged');
    A.eq(rr[1].px, priced[1].px, 'RG: and its price');
    await q.evaluate(() => wqaVarSetField(1, 'material', '4140'));
    await q.waitForTimeout(600);
    rr = await q.evaluate(() => wqa.rows.map(r => ({ m: r.material, f: r.finish, st: r.sizeType })));
    A.eq(`${rr[0].m}/${rr[0].st}/${rr[0].f}`, '4140/FULLSIZE/ZP', 'RG: changing row 2 material leaves row 1 alone');
    ok(await q.evaluate(() => (wqa.rows[0].acc == null || wqa.rows[0].acc !== wqa.rows[1].acc) && wqa.rows[0].priceOverride !== wqa.rows[1].priceOverride), 'RG: no shared state between exact rows');
    /* the header + does not Cartesian-expand an exact group */
    await q.click('#wqaCommon [data-mv="material"]');
    A.eq(await q.evaluate(() => wqa.rows.filter(r => !r.removed).length), 2, 'RG: the header multi-select does not expand exact variants');
    /* mode round trip */
    await q.click('#wqaVarBar [data-vmode="combine"]');
    await q.waitForTimeout(900);
    A.eq(await q.evaluate(() => wqa.rows.filter(r => !r.removed).length), 4, 'RM: Combine selections crosses the values the rows use (2 materials/1 size... = 4 here)');
    await q.click('#wqaVarBar [data-vmode="exact"]');
    A.eq(await q.evaluate(() => wqa.vmode[wqa.rows[0].vg]), 'exact', 'RM: and back to Exact variants without changing the rows');

    /* I. product compatibility in exact mode */
    await extract(q, EX([item()], FS), 'Item 1: L Bolt 4140 Fullsize PL Item 2: J Bolt MS Fullsize PL');
    const ie = await q.evaluate(() => wqa.rows.map(r => ({ t: r.product, ready: wqaRowReady(r), h: r.h, id: r.id, s: r.s, miss: wqaRowMissing(r) })));
    A.eq(ie.map(r => r.t).join(), 'lbolt,jbolt', 'RI: exact rows keep their products');
    ok(ie[0].ready && !ie[1].ready, 'RI: L Bolt ready, J Bolt needs attention');
    ok(ie[1].h === '' && ie[1].id === '' && ie[1].s === '', 'RI: H / ID / S are not guessed');
    A.eq(await addText(q), 'Add 1 Item to Quotation', 'RI: the button counts only the ready row');

    /* OWNER BUSINESS SEMANTIC CHECK: L Bolt TL100 -> Sag Rod thread */
    await extract(q, EX([item()], FS));
    await multi(q, 'product', ['lbolt', 'sagrod']);
    const viaVariant = await q.evaluate(() => { const r = wqa.rows.find(x => x.product === 'sagrod'); return r.threadLen + '/' + r.threadLen2; });
    await extract(q, EX([item()], FS));
    await q.evaluate(() => wqaEditRowProduct(0, 'sagrod'));
    const viaManual = await q.evaluate(() => { const r = wqa.rows[0]; return r.threadLen + '/' + r.threadLen2; });
    A.eq(viaVariant, '100/100', 'OWNER CHECK: variant expansion L Bolt TL100 -> Sag Rod thread 100/100');
    A.eq(viaManual, '100/100', 'OWNER RULE: the manual product switch gives the same 100/100');
    /* the header Product select, whole list */
    await extract(q, EX([item()], FS));
    await q.selectOption('#wqaProduct', 'sagrod');
    await q.waitForTimeout(700);
    A.eq(await q.evaluate(() => wqa.rows[0].threadLen + '/' + wqa.rows[0].threadLen2), '100/100', 'OWNER RULE: the header Product select gives 100/100');
    /* a pair stays as typed, and a one-end product keeps one value */
    await extract(q, EX([item({ TL: '50' })], FS));
    await q.evaluate(() => wqaEditRowProduct(0, 'sagrod'));
    await q.evaluate(() => { wqaEditThread(0, '50/110'); });
    await q.evaluate(() => wqaEditRowProduct(0, 'lbolt')); await q.evaluate(() => wqaEditRowProduct(0, 'sagrod'));
    ok(await q.evaluate(() => /^50\/(50|110)$/.test(wqa.rows[0].threadLen + '/' + wqa.rows[0].threadLen2)), 'OWNER RULE: an existing pair is not overwritten');
    await extract(q, EX([item()], FS));
    await q.evaluate(() => wqaEditRowProduct(0, 'anchorbolt'));
    A.eq(await q.evaluate(() => String(wqa.rows[0].threadLen2 || '')), '', 'OWNER RULE: a one-end product keeps a single thread');
    /* the status message carries no item count */
    await extract(q, EX([item()], FS), 'Item 1: L Bolt 4140 Fullsize PL Item 2: L Bolt MS Fullsize HDG');
    ok(await q.evaluate(() => /Your additional info was applied — it overrides the document\./.test(document.getElementById('wqaCommon').textContent) && !/item\(s\)/.test(document.getElementById('wqaCommon').textContent)), 'MSG: additional-info message has no misleading count');
    await Q.ctx.close();
  }

  /* ── L. mobile 390 ──────────────────────────────────────────────────── */
  const mb = await open(browser, { context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } });
  await extract(mb.p, SINGLE);
  await multi(mb.p, 'material', ['MS', '4140']);
  await multi(mb.p, 'product', ['lbolt', 'sagrod']);
  await mb.p.click('#wqaVarBar .wqa-var-toggle');
  await mb.p.waitForTimeout(300);
  const over = await mb.p.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    modal: (() => { const m = document.querySelector('#wqaModal .wqa-modal'); return m.scrollWidth - m.clientWidth; })(),
    bar: (() => { const b = document.getElementById('wqaVarBar'); return b.scrollWidth - b.clientWidth; })() }));
  ok(over.doc <= 0 && over.modal <= 0 && over.bar <= 0, `L: no horizontal overflow at 390px (${JSON.stringify(over)})`);
  A.eq(await mb.p.evaluate(() => document.querySelectorAll('#wqaVarBar .wqa-var-row').length), 4, 'L: all four product x material variants reviewable on a phone');
  await mb.p.click('#wqaCommon [data-mv="finish"]');
  const pop = await mb.p.evaluate(() => { const r = document.querySelector('#wqaCommon .wqa-mv').getBoundingClientRect(); return r.right <= window.innerWidth && r.left >= 0; });
  ok(pop, 'L: the multi-select panel fits the viewport');
  await extract(mb.p, EX([item({ W: null, TL: '100/100', product: 'SAG_ROD', threadEnds: 2 })], { product: 'SAG_ROD', threadEnds: 2 }),
    'Item 1: 4140 Fullsize Sag Rod PL Item 2: MS Undersize Sag Rod HDG');
  await mb.p.click('#wqaVarBar .wqa-var-toggle');
  await mb.p.waitForTimeout(300);
  const ov2 = await mb.p.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    modal: (() => { const m = document.querySelector('#wqaModal .wqa-modal'); return m.scrollWidth - m.clientWidth; })(),
    bar: (() => { const b = document.getElementById('wqaVarBar'); return b.scrollWidth - b.clientWidth; })() }));
  ok(ov2.doc <= 0 && ov2.modal <= 0 && ov2.bar <= 0, `K: exact variant rows fit at 390px (${JSON.stringify(ov2)})`);
  A.eq(await mb.p.evaluate(() => document.querySelectorAll('#wqaVarBar .wqa-var-ex').length), 2, 'K: two exact rows on a phone');
  ok(await mb.p.evaluate(() => /2 ready/.test(document.querySelector('#wqaVarBar .wqa-var-st').textContent) && /Add 2 Items/.test(document.getElementById('wqaAddBtn').textContent)), 'K: ready count and Add button on a phone');

  await mb.ctx.close();
};
