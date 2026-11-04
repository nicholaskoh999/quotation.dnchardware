/* ── R2.1 owner-smoke polish ─────────────────────────────────────────────────
   1. Every user sees which model read the source (Sonnet 5.5 / Luna · Fallback),
      its latency and estimated cost; the backup reader is always Review Needed.
   2. No "Customer label: undefined" line.
   3. A suggestion is never a price: the applied columns show "—" until Use This
      Pricing; each item takes its OWN suggestion; Sag Rod keeps No Round.
   4. Item removed · Undo, consecutive, exact restore, cleared with the session.
   5. A drawing's accessory wording is proposed per item, collapsed, costing
      nothing until confirmed, and never counted twice.
   6. WhatsApp wording: greetings are not "Unrecognized"; "change length to N"
      is read; accessory wording never becomes a W or a finish; a message value
      that replaces a drawing value is kept as evidence and flagged Review.   */
'use strict';
const { openApp } = require('../lib/harness');

const item = o => Object.assign({ M: null, L: null, W: null, TL: null, qty: null, Bmid: null, material: null, finish: null,
  sizeType: null, unclear: null, product: null, threadEnds: null, bodyDia: null, H: null, ID: null, S: null, R: null,
  Lref: null, Wref: null }, o);
const doc = (items, o) => Object.assign({ product: null, material: null, finish: null, sizeType: null, threadEnds: null, note: null, items }, o || {});
const SONNET = { provider: 'anthropic', model: 'claude-sonnet-5-5', fallback: null, ms: 5230, est_usd: 0.0402 };
const LUNA_FB = { provider: 'openai', model: 'gpt-5.6-luna', fallback: 'network', ms: 9800, est_usd: 0.0009 };
const SAG = 'ms zp undersize sag rod\n1. m12 x 1000 x 100/100 - 5pcs\n2. m12 x 1200 x 100/100 - 8pcs\n3. m16 x 900 x 120/120 - 4pcs';

module.exports = async (browser, A) => {
  const p = await openApp(browser);
  const W = ms => p.waitForTimeout(ms);
  const ai = async (d, meta, note) => {
    await p.evaluate(async ([d, m, n]) => { wqaResetState(); wqa.aiFile = true; wqa.aiNote = n || ''; await wqaAiApply(d, undefined, m); },
                     [d, meta, note || '']);
    await W(250);
  };
  /* Use This Pricing on one item: from its pricing editor. */
  const useOne = async i => { await p.evaluate(i => { wqa.px = null; wqaPxToggle(i); }, i); await W(150);
                              await p.click(`[data-px-fill="${i}"]`); await W(300); };
  const paste = async t => { await p.evaluate(async t => { wqaOpen(); el('wqaInput').value = t; await wqaParseAndReview(); }, t); await W(400); };

  /* 1 ─ model display */
  A.suite('R2.1 · AI model, latency and cost for every user');
  const sag2 = doc([item({ M: 'M12', L: 1000, TL: '100/100', qty: 20, product: 'SAG_ROD' }),
                    item({ M: 'M12', L: 1200, TL: '100/100', qty: 12, product: 'SAG_ROD' })],
                   { product: 'SAG_ROD', material: 'MS', finish: 'ZP', sizeType: 'Undersize', threadEnds: 2 });
  await ai(sag2, { truncated: false, sources: 1, review: false, diag: SONNET });
  let s = await p.evaluate(() => ({ badge: el('wqaAiBadge').textContent, meta: el('wqaAiMeta').textContent, hidden: el('wqaAiMeta').hidden }));
  A.ok(/AI Parsed/.test(s.badge), 'clean Sonnet read: AI Parsed');
  A.ok(!s.hidden && /Sonnet 5\.5/.test(s.meta) && /5\.2 s/.test(s.meta) && /\$0\.040/.test(s.meta), 'shows Sonnet 5.5 · 5.2 s · ≈ $0.040');
  A.ok(!/Fallback/.test(s.meta), 'no Fallback on a Sonnet answer');
  await ai(sag2, { truncated: false, sources: 1, review: true, diag: LUNA_FB });
  s = await p.evaluate(() => ({ badge: el('wqaAiBadge').textContent, meta: el('wqaAiMeta').textContent }));
  A.ok(/Review Needed/.test(s.badge), 'Luna fallback: Review Needed');
  A.ok(/^Luna · Fallback · 9\.8 s/.test(s.meta), 'shows Luna · Fallback · 9.8 s');
  s = await p.evaluate(() => { wqaResetState(); return el('wqaAiMeta').hidden; });
  A.ok(s, 'a new session hides the run details');

  /* 2 ─ no undefined customer label */
  A.suite('R2.1 · no "undefined" customer label');
  await ai(doc([item({ M: 'M16', L: 230, W: 50, TL: 80, qty: 12, product: 'L_BOLT' }),
                item({ M: 'M16', L: 170, qty: 40, product: 'STUD', material: '304' })]),
           { truncated: false, sources: 4, review: false, diag: SONNET });
  s = await p.evaluate(() => el('wqaCommon').innerText);
  A.ok(!/undefined/i.test(s), 'mixed upload with run details: no "undefined" anywhere in the review header');
  A.ok(!/Customer label/i.test(s), 'no customer-label line without both labels');

  /* 3 ─ suggested vs applied */
  A.suite('R2.1 · Suggested Pricing vs Applied Pricing');
  await paste(SAG);
  s = await p.evaluate(() => ({
    sug: document.querySelectorAll('#wqaRows .wqa-sug').length,
    cols: [...document.querySelectorAll('#wqaRows .wqa-ip-set')].map(n => n.innerText.replace(/\s+/g, ' ').trim()),
    price: wqa.rows.map(r => wqaRowPriceText(r)), ov: wqa.rows.map(r => Object.keys(r.priceOverride).length),
    modes: wqa.rows.map(r => r.priceMode) }));
  A.eq(s.sug, 1, 'one Suggested Pricing line for the group (all three share it), rows stay one line');
  A.ok(await p.evaluate(() => /3 items not priced yet/.test(document.querySelector('[data-sug-grp]').innerText)), 'the group line says how many items it covers');
  A.ok(s.cols.every(c => c === '— — —'), 'applied columns show — while only a suggestion exists');
  A.ok(s.price.every(t => t === 'Set price'), 'RM/pc is not a price yet');
  A.ok(s.ov.every(n => n === 0), 'nothing committed by the suggestion');
  A.ok(s.modes.every(m => m === 'no_round'), 'Sag Rod defaults to No Round');
  await useOne(0);
  s = await p.evaluate(() => ({ price: wqa.rows.map(r => wqaRowPriceText(r)), offer: (document.querySelector('[data-sug-offer]') || {}).innerText || '',
    ov0: wqa.rows[0].priceOverride, mode0: wqa.rows[0].priceMode }));
  A.ok(/^RM/.test(s.price[0]) && s.price[1] === 'Set price' && s.price[2] === 'Set price', 'Use This Pricing applies to THIS item only');
  A.eq(JSON.stringify(s.ov0), JSON.stringify({ costRate: '4.20', addCost: '0.60', markup: '0' }), 'the item takes its own suggestion');
  A.eq(s.mode0, 'no_round', 'No Round is kept');
  A.ok(/2 other items/.test(s.offer), 'offers the other items their OWN suggested pricing');
  await p.click('[data-sug="apply-all"]'); await W(300);
  s = await p.evaluate(() => ({ price: wqa.rows.map(r => wqaRowPriceText(r)), sug: document.querySelectorAll('#wqaRows .wqa-sug').length }));
  A.ok(s.price.every(t => /^RM/.test(t)), 'bulk: all three priced');
  A.eq(s.sug, 0, 'no suggestion line left once applied');
  /* the group's own button: every unpriced item, each with its own suggestion */
  await paste(SAG);
  await p.click('[data-sug-grp-use]'); await W(300);
  s = await p.evaluate(() => wqa.rows.map(r => wqaRowPriceText(r)));
  A.ok(s.every(t => /^RM/.test(t)), 'Use Suggested Pricing for 3 items prices the group');
  /* one item left with a suggestion: it gets its own line */
  await paste(SAG);
  await useOne(0); await p.evaluate(() => wqaRecipeDismiss()); await useOne(1); await p.evaluate(() => wqaRecipeDismiss()); await W(200);
  s = await p.evaluate(() => ({ row: document.querySelectorAll('#wqaRows [data-sug-row]').length, grp: document.querySelectorAll('#wqaRows [data-sug-grp]').length }));
  A.ok(s.row === 1 && s.grp === 0, 'a single unpriced item shows its own Suggested Pricing line');
  /* Manual Price is never overwritten by a suggestion */
  await paste(SAG);
  await p.evaluate(() => { wqa.rows[1].priceMode = 'manual'; wqa.rows[1].manualPrice = '9.99'; wqaRecomputeAll('force'); });
  await W(250);
  await useOne(0);
  s = await p.evaluate(() => ({ t: wqaSugTargets(0).length, m: wqa.rows[1].manualPrice, offer: (document.querySelector('[data-sug-offer]') || {}).innerText || '' }));
  A.ok(/1 other item/.test(s.offer) && s.m === '9.99', 'a Manual Price item is not offered and keeps its price');

  /* 4 ─ remove / undo */
  A.suite('R2.1 · Item removed · Undo');
  await paste(SAG);
  await useOne(0);
  s = await p.evaluate(async () => {
    const snap = r => JSON.stringify([r.size, r.length, r.threadLen, r.threadLen2, r.qty, r.material, r.finish, r.priceOverride, r.priceMode, r.acc, r.issues]);
    const before = wqa.rows.map(snap);
    wqaRemoveRow(0); wqaRemoveRow(2);
    const bar = el('wqaUndoBar').innerText, live = wqa.rows.filter(r => !r.removed).length;
    wqaUndoRemove(); const live1 = wqa.rows.filter(r => !r.removed).length, back2 = !wqa.rows[2].removed;
    wqaUndoRemove();
    const order = [...document.querySelectorAll('#wqaRows [data-wqa-row]')].map(n => n.getAttribute('data-wqa-row')).join(',');
    return { bar, live, live1, back2, order, same: wqa.rows.map(snap).every((x, i) => x === before[i]), hidden: el('wqaUndoBar').hidden,
             price0: wqaRowPriceText(wqa.rows[0]) };
  });
  A.ok(/Item removed/.test(s.bar) && /Undo/.test(s.bar), 'shows Item removed · Undo');
  A.eq(s.live, 1, 'two consecutive removals');
  A.ok(s.live1 === 2 && s.back2, 'Undo restores the latest removal first');
  A.eq(s.order, '0,1,2', 'original positions');
  A.ok(s.same, 'dimensions, material/finish, qty, pricing, accessories and warnings restored exactly');
  A.ok(/^RM/.test(s.price0), 'applied pricing survives remove + undo');
  A.ok(s.hidden, 'nothing left to undo: bar hidden');
  s = await p.evaluate(() => { wqaRemoveRow(1); closeModal('wqaModal'); wqaOpen(); return { n: (wqa.rmUndo || []).length, hidden: el('wqaUndoBar').hidden }; });
  A.ok(s.n === 0 && s.hidden, 'undo history cleared when the Quick Add session ends');

  /* 5 ─ accessories from a drawing */
  A.suite('R2.1 · Nut / Flat Washer from the document');
  const sag12 = doc(Array.from({ length: 12 }, (_, k) => item({ M: 'M12', L: 600 + k * 50, TL: '100/100', qty: 10 + k, product: 'SAG_ROD' })),
                    { product: 'SAG_ROD', material: 'MS', finish: 'ZP', sizeType: 'Undersize', threadEnds: 2, note: '4 Nuts + 4 FW' });
  await ai(sag12, { truncated: false, sources: 1, review: false, diag: SONNET });
  s = await p.evaluate(() => ({ chips: [...document.querySelectorAll('.wqa-accp-chip')].map(n => n.textContent.trim()),
    acc: wqa.rows.filter(r => wqaAccHas(r.acc)).length, badge: el('wqaAiBadge').textContent,
    bulk: (document.querySelector('.wqa-accp-bulk') || {}).innerText || '', rows: wqa.rows.length }));
  A.eq(s.rows, 12, 'example B: 12 Sag Rod rows, no accessory rows');
  A.ok(s.chips.length === 12 && s.chips.every(c => /^4 Nut \+ 4 FW · Review/.test(c)), 'each item: "4 Nut + 4 FW · Review", collapsed');
  A.eq(s.acc, 0, 'nothing applied before confirmation');
  A.ok(/Review Needed/.test(s.badge), 'a pending accessory proposal is Review Needed');
  A.ok(/Confirm for all 12 items/.test(s.bulk), 'bulk confirm offered');
  await p.evaluate(() => wqaAccPropConfirm('all')); await W(300);
  s = await p.evaluate(() => ({ acc: wqa.rows.map(r => wqaAccShortSummary(r.acc)), px: wqa.rows.map(r => [r.acc.nut.unitPrice, r.acc.fw.unitPrice]),
    fin: wqa.rows[0].acc.nut.finish, left: document.querySelectorAll('.wqa-accp-chip').length }));
  A.ok(s.acc.every(a => a === 'Nut ×4 · FW ×4'), 'confirmed: Nut ×4 · FW ×4 per set on every item (not the document total)');
  A.ok(s.px.every(([a, b]) => a === 0 && b === 0), 'no accessory cost added silently');
  A.eq(s.fin, 'ZP', 'finish follows the item (the existing accessory rule)');
  A.eq(s.left, 0, 'no proposal left');
  s = await p.evaluate(() => { wqa.rows[0].accProposed = wqaCloneAcc(wqa.rows[0].acc); wqaAccPropConfirm([0]); return wqaAccShortSummary(wqa.rows[0].acc); });
  A.eq(s, 'Nut ×4 · FW ×4', 'confirming again does not double-count');
  /* example A: four AISI 4140 bolts, C/W 1 Nut & 1 Washer (Plain) */
  const b4140 = doc(Array.from({ length: 4 }, (_, k) => item({ M: 'M20', L: 300 + k * 100, TL: 80, qty: 8, product: 'ANCHOR_BOLT' })),
                    { product: 'ANCHOR_BOLT', material: '4140', note: '1 Nut + 1 Washer (Plain)' });
  await ai(b4140, { truncated: false, sources: 1, review: false, diag: SONNET });
  s = await p.evaluate(() => ({ chips: [...document.querySelectorAll('.wqa-accp-chip')].map(n => n.textContent.trim()), fin: wqa.rows.map(r => r.finish) }));
  A.ok(s.chips.length === 4 && s.chips.every(c => /^1 Nut \+ 1 FW · Review/.test(c)), 'example A: 4 items, "1 Nut + 1 FW · Review"');
  A.ok(s.fin.every(f => f !== 'PL'), '"Washer (Plain)" does not set the bolt finish');
  /* mixed document: stays a mention */
  await ai(doc([item({ M: 'M12', L: 900, TL: '100/100', qty: 5, product: 'SAG_ROD' }), item({ M: 'M16', L: 170, qty: 40, product: 'STUD' })],
               { note: '4 Nuts + 4 FW' }), { truncated: false, sources: 2, review: false, diag: SONNET });
  s = await p.evaluate(() => ({ chips: document.querySelectorAll('.wqa-accp-chip').length, warn: (wqa.aiWarnings || []).map(w => w.k) }));
  A.ok(s.chips === 0 && s.warn.indexOf('wqaAccMention') >= 0, 'mixed products: not proposed, kept as a mention');

  /* 6 ─ WhatsApp natural context */
  A.suite('R2.1 · WhatsApp wording in notes');
  s = await p.evaluate(() => {
    const rb = t => wqaNoteReadHtml(t, 'all').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
    return {
      a: rb('Afternoon boss, please check price for HDG @ 592 sets. Attached drawing.'),
      b: rb('Good morning sir, can quote? thanks'),
      c: wqaNoteFacts('Hi boss pls quote 50 sets HDG, change length to 1200 thank you'),
      d: wqaNoteFacts('each set c/w 1 nut 1 washer'),
      e: wqaNoteFacts('C/W 1 Nut & 1 Washer (Plain)'),
      f: wqaNoteFacts('pls quote L 1200 c/w 2 nuts') };
  });
  A.ok(/Finish HDG/.test(s.a) && /Qty 592/.test(s.a) && !/Unrecognized/.test(s.a), 'greeting + "HDG @ 592 sets": finish and qty, no Unrecognized');
  A.eq(s.b, '', 'a greeting alone says nothing');
  A.ok(s.c.length === 1 && s.c[0].facts.length === '1200' && s.c[0].facts.qty === '50' && s.c[0].facts.finish === 'HDG', '"change length to 1200" read as L 1200');
  A.eq(JSON.stringify(s.d), '[]', '"c/w 1 nut 1 washer" never becomes W 1 on every row');
  A.eq(JSON.stringify(s.e), '[]', '"Washer (Plain)" never becomes the rod finish');
  A.ok(s.f.length === 1 && s.f[0].facts.length === '1200' && s.f[0].facts.w === undefined, '"c/w 2 nuts" never becomes W 2');
  const lb = doc([item({ M: 'M16', L: 500, W: 100, TL: 75, qty: 20, product: 'L_BOLT' })], { product: 'L_BOLT', material: 'MS', sizeType: 'Fullsize' });
  await ai(lb, { truncated: false, sources: 1, review: false, diag: SONNET }, 'Afternoon boss, please check price for HDG @ 592 sets. Attached drawing.');
  s = await p.evaluate(() => ({ r: wqa.rows[0], badge: el('wqaAiBadge').textContent }));
  A.ok(s.r.qty === '592' && s.r.finish === 'HDG', 'the message qty and finish are used');
  A.ok((s.r.aiUncertain || []).some(t => /Qty 20 → 592/.test(t)) && /Review Needed/.test(s.badge), 'drawing qty kept as evidence, flagged Review');
  A.ok(s.r.length === '500' && s.r.w === '100', 'dimensions untouched');
  await ai(lb, { truncated: false, sources: 1, review: false, diag: SONNET }, 'Good morning sir, can quote? thanks');
  s = await p.evaluate(() => ({ r: wqa.rows[0], badge: el('wqaAiBadge').textContent, warn: (wqa.aiWarnings || []).map(w => w.k) }));
  A.ok(s.r.qty === '20' && /AI Parsed/.test(s.badge) && s.warn.indexOf('wqaNoteUnused') < 0, 'a greeting changes nothing and warns nothing');

  await p.close();
};
