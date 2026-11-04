/* ── R2.2 Session D — several PDFs in one Quick Add session ──────────────────
   Owner case: a customer sends three drawing PDFs (WBC, HOTR, WWTP), each with
   Purlin and Sag Rod drawings; DNC quotes the Sag Rods. Measured 2026-11-04
   through the production Sonnet PDF path, one PDF per call, no Additional
   Info: WBC 1 row, HOTR 2 rows, WWTP 1 row (L1327 kept, segments 1326 flagged),
   no Purlin rows — the fixture is those real answers.

   Up to three PDFs per session. Each is sent ALONE (the single-PDF request,
   unchanged on the server) and normalised alone; the rows are merged into one
   review, each naming its file. Held here:
     - one request per PDF, never files[] with PDFs; the note goes with each;
     - no carry across files (M, thread, finish), carry inside one PDF kept;
     - two projects with the same size stay two rows (no de-duplication);
     - a failed PDF says so on its own line, review waits, Analyze again sends
       only the failed one; removing it continues with the rest;
     - a changed file note re-reads that file only;
     - more than three, a duplicate, or mixing with images is refused;
     - a drawing's accessory wording is proposed only when every file says it;
     - one PDF behaves exactly as before.                                    */
'use strict';
const fs = require('fs');
const path = require('path');
const { openApp } = require('../lib/harness');

const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'ai-three-pdfs-sagrod.json'), 'utf8'));

/* a page-side fetch stub: answers ai_extract.php per file name from window.__ans */
const STUB = `(() => {
  window.__calls = [];
  const real = window.fetch;
  window.fetch = async (u, o) => {
    if (!String(u).includes('ai_extract.php')) return real(u, o);
    const b = o && o.body, f = b && b.get && b.get('file');
    const call = { file: f ? f.name : null, multi: !!(b && b.getAll && b.getAll('files[]').length), note: b && b.get ? b.get('note') : null,
                   fnotes: b && b.getAll ? b.getAll('file_notes[]') : [] };
    window.__calls.push(call);
    const a = (window.__ans || {})[call.file];
    const body = !a ? { ok: false, error: 'stub: no answer' } : a.fail ? { ok: false, error: a.fail } :
      { ok: true, data: a.data, truncated: false, review: !!a.review, meta: a.meta || null };
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  };
  window.__pdf = n => new File([new Uint8Array([37, 80, 68, 70, 45, 49])], n, { type: 'application/pdf' });
  window.__img = n => new File([new Uint8Array([137, 80, 78, 71])], n, { type: 'image/png' });
})()`;

const live = page => page.evaluate(() => wqa.rows.filter(r => !r.removed).map(r => ({
  size: r.size, L: String(r.length || ''), TL: wqaThreadValue(r), qty: String(r.qty || ''), finish: r.finish || '',
  product: r.product, src: r.srcFile || '', idx: r.srcIdx || 0, unc: r.aiUncertain || [],
  badges: wqaRowBadges(r).map(b => b.t), acc: r.accProposed ? wqaAccPropText(r.accProposed) : '' })));

const sag = (items, extra) => Object.assign({ product: 'SAG_ROD', material: null, finish: null, sizeType: null, threadEnds: 2, note: null,
  items: items.map(it => Object.assign({ M: null, L: null, W: null, TL: null, qty: null, Bmid: null, material: null, finish: null, sizeType: null,
    unclear: null, product: 'SAG_ROD', threadEnds: 2, bodyDia: null, H: null, ID: null, S: null, R: null, Lref: null, Wref: null, Bbad: false }, it)) }, extra || {});
const meta = { provider: 'anthropic', model: 'claude-sonnet-5-5', fallback: null, ms: 6000, est_usd: 0.02 };

module.exports = async (browser, A) => {
  A.suite('66 R2.2 Session D: multi-PDF Quick Add + product scope');

  /* ── the owner's three PDFs ── */
  let page = await openApp(browser);
  await page.evaluate(STUB);
  await page.evaluate(fix => { window.__ans = fix; wqaOpen(); }, FIX);

  const sel = await page.evaluate(() => {
    const out = [];
    wqaAddFiles([__pdf('WBC.pdf')]); wqaAddFiles([__pdf('HOTR.pdf')]); wqaAddFiles([__pdf('WWTP.pdf')]);
    out.push(wqa.aiFiles.length);
    wqaAddFiles([__pdf('FOURTH.pdf')]); out.push(wqa.aiFiles.length, document.getElementById('wqaAiMsg').textContent);
    wqaAddFiles([__img('photo.png')]); out.push(wqa.aiFiles.length, document.getElementById('wqaAiMsg').textContent);
    wqaRemoveFile(2); wqaAddFiles([__pdf('HOTR.pdf')]); out.push(wqa.aiFiles.length, document.getElementById('wqaAiMsg').textContent);
    wqaAddFiles([__pdf('WWTP.pdf')]); out.push(wqa.aiFiles.length);
    out.push(document.getElementById('wqaFileInfo').innerText);
    return out;
  });
  A.eq(sel[0], 3, 'three PDFs can be selected together');
  A.eq(sel[1], 3, 'a fourth PDF is refused');
  A.includes(sel[2], 'Up to 3 PDFs', 'and says why');
  A.eq(sel[3], 3, 'an image is refused while PDFs are selected');
  A.includes(sel[4], 'Upload either PDFs or images', 'and says why');
  A.eq(sel[5], 2, 'the same PDF twice is refused');
  A.includes(sel[6], 'already selected', 'and says why');
  A.eq(sel[7], 3, 'WBC, HOTR, WWTP selected');
  A.includes(sel[8], 'each is read on its own', 'the list says each PDF is read on its own');
  A.includes(sel[8], '3 / 3 PDFs', 'and counts them');

  await page.evaluate(() => { document.getElementById('wqaAiNote') && (document.getElementById('wqaAiNote').value = ''); wqaAnalyze(); });
  await page.waitForTimeout(1500);
  const calls = await page.evaluate(() => __calls);
  A.eq(calls.map(c => c.file), ['WBC.pdf', 'HOTR.pdf', 'WWTP.pdf'], 'one request per PDF, in order');
  A.ok(calls.every(c => !c.multi), 'never files[] with PDFs (the single-PDF request, unchanged)');
  let rows = await live(page);
  A.eq(rows.length, 4, `4 Sag Rod rows from 3 PDFs (WBC 1 + HOTR 2 + WWTP 1): ${rows.map(r => r.L + 'x' + r.qty).join(', ')}`);
  A.ok(rows.every(r => r.product === 'sagrod'), 'every row is a Sag Rod — no Purlin row from any PDF');
  const byFile = f => rows.filter(r => r.src === f).map(r => `${r.size} L${r.L} TL${r.TL} x${r.qty}`);
  A.eq(byFile('WBC.pdf'), ['M12 L1300 TL100/100 x30'], 'WBC: M12 L1300 TL100/100 Qty30');
  A.eq(byFile('HOTR.pdf'), ['M12 L1175 TL100/100 x5', 'M12 L1300 TL100/100 x20'], 'HOTR: L1175 x5 and L1300 x20');
  A.eq(byFile('WWTP.pdf'), ['M12 L1327 TL100/100 x21'], 'WWTP: L1327 (the stated overall) x21');
  const wwtp = rows.find(r => r.src === 'WWTP.pdf');
  A.ok(wwtp && wwtp.unc.some(u => /segments vs length/.test(u)), 'WWTP: 100 + 1126 + 100 = 1326 vs 1327 is flagged for review');
  A.eq(rows.filter(r => r.L === '1300').length, 2, 'WBC L1300 x30 and HOTR L1300 x20 stay two rows (different projects, same size)');
  A.ok(rows.find(r => r.src === 'HOTR.pdf').badges.some(b => /^PDF 2 · HOTR$/.test(b)), 'each row names its PDF ("PDF 2 · HOTR")');
  const head = await page.evaluate(() => ({ badge: document.getElementById('wqaAiBadge').textContent, meta: document.getElementById('wqaAiMeta').textContent }));
  A.includes(head.meta, 'Sonnet 5.5', 'the model is shown');
  A.includes(head.meta, '0.06', 'the cost is the three reads together (≈ $0.06)');
  A.eq(await page.evaluate(() => wqa.rows.filter(r => !r.removed && r.accProposed).length), 0,
       'the drawings\' "2 Nuts M12 each end" is not turned into a Nut count (each end, not per set)');
  A.eq(page._dcErrors, [], 'no page errors');
  await page.close();

  /* ── carry: inside one PDF yes, across PDFs never ── */
  page = await openApp(browser);
  await page.evaluate(STUB);
  await page.evaluate(([a, b]) => {
    window.__ans = { 'A.pdf': { data: a, meta: { provider: 'anthropic', model: 'claude-sonnet-5-5', ms: 1, est_usd: 0.01 } },
                     'B.pdf': { data: b, meta: { provider: 'anthropic', model: 'claude-sonnet-5-5', ms: 1, est_usd: 0.01 } } };
    wqaOpen(); wqaAddFiles([__pdf('A.pdf'), __pdf('B.pdf')]); wqaAnalyze();
  }, [sag([{ M: 'M12', L: 1000, TL: '100/100', qty: 5 }, { L: 1200, qty: 6 }], { finish: 'HDG' }),
      sag([{ M: 'M16', L: 900, qty: 3 }])]);
  await page.waitForTimeout(1300);
  rows = await live(page);
  const a2 = rows.find(r => r.src === 'A.pdf' && r.L === '1200'), b1 = rows.find(r => r.src === 'B.pdf');
  A.eq(a2 && a2.size + '|' + a2.TL, 'M12|100/100', 'inside one PDF the size and thread carry down as before');
  A.eq(b1 && b1.TL, '', 'across PDFs: B takes no thread from A');
  A.eq(b1 && b1.finish, '', 'across PDFs: B takes no HDG from A');
  A.eq(b1 && b1.size, 'M16', 'across PDFs: B keeps its own size');
  await page.close();

  /* ── one fails: no review, retry only that one; removing it continues ── */
  page = await openApp(browser);
  await page.evaluate(STUB);
  await page.evaluate(fix => { window.__ans = { 'WBC.pdf': fix['WBC.pdf'], 'HOTR.pdf': { fail: 'Sonnet unavailable' }, 'WWTP.pdf': fix['WWTP.pdf'] };
    wqaOpen(); wqaAddFiles([__pdf('WBC.pdf'), __pdf('HOTR.pdf'), __pdf('WWTP.pdf')]); wqaAnalyze(); }, FIX);
  await page.waitForTimeout(1300);
  let st = await page.evaluate(() => ({ review: wqa.rows.filter(r => !r.removed).length, msg: document.getElementById('wqaAiMsg').textContent,
    status: [...document.querySelectorAll('[data-pdf-st]')].map(n => n.dataset.pdfSt), list: document.getElementById('wqaFileInfo').innerText }));
  A.eq(st.review, 0, 'one PDF failed: review does not open on a partial set');
  A.includes(st.msg, '1 of 3 PDFs could not be read', 'and says how many');
  A.eq(st.status, ['ok', 'bad', 'ok'], 'each PDF shows its own result (✓ ✗ ✓)');
  /* R2.4: the ✗ glyph is drawn as the Heroicons x-circle (Session E); the words are unchanged. */
  A.includes(st.list, 'Could not analyze', 'the failed one says so on its own line (the safe page message, never the raw server text)');
  A.ok(await page.evaluate(() => !!document.querySelector('[data-pdf-st="bad"] use[href="#hi-x-circle"]')), 'with the x-circle icon (R2.4 Heroicons)');
  await page.evaluate(fix => { __calls.length = 0; window.__ans['HOTR.pdf'] = fix['HOTR.pdf']; wqaAnalyze(); }, FIX);
  await page.waitForTimeout(1000);
  A.eq(await page.evaluate(() => __calls.map(c => c.file)), ['HOTR.pdf'], 'Analyze again sends ONLY the failed PDF');
  A.eq((await live(page)).length, 4, 'and the review opens with all four rows');
  await page.close();

  page = await openApp(browser);
  await page.evaluate(STUB);
  await page.evaluate(fix => { window.__ans = { 'WBC.pdf': fix['WBC.pdf'], 'HOTR.pdf': { fail: 'too big' }, 'WWTP.pdf': fix['WWTP.pdf'] };
    wqaOpen(); wqaAddFiles([__pdf('WBC.pdf'), __pdf('HOTR.pdf'), __pdf('WWTP.pdf')]); wqaAnalyze(); }, FIX);
  await page.waitForTimeout(1300);
  await page.evaluate(() => { __calls.length = 0; wqaRemoveFile(1); wqaAnalyze(); });
  await page.waitForTimeout(900);
  A.eq(await page.evaluate(() => __calls.length), 0, 'removing the failed PDF: the two read ones are not sent again');
  rows = await live(page);
  A.eq(rows.map(r => r.src), ['WBC.pdf', 'WWTP.pdf'], 'and review opens with WBC + WWTP');
  await page.close();

  /* ── a changed file note re-reads that file only; the note travels with it ── */
  page = await openApp(browser);
  await page.evaluate(STUB);
  await page.evaluate(fix => { window.__ans = { 'WBC.pdf': fix['WBC.pdf'], 'HOTR.pdf': { fail: 'x' } };
    wqaOpen(); wqaAddFiles([__pdf('WBC.pdf'), __pdf('HOTR.pdf')]); wqaAnalyze(); }, FIX);
  await page.waitForTimeout(1000);
  await page.evaluate(fix => { __calls.length = 0; window.__ans['HOTR.pdf'] = fix['HOTR.pdf'];
    wqaFileNoteInput(wqa.aiFiles[0].id, 'HDG'); wqaAnalyze(); }, FIX);
  await page.waitForTimeout(1000);
  const c2 = await page.evaluate(() => __calls);
  A.eq(c2.map(c => c.file), ['WBC.pdf', 'HOTR.pdf'], 'a file note changed on WBC: WBC is read again (with it), HOTR (failed) too');
  A.eq(c2[0].fnotes, ['HDG'], 'the file note goes with its own PDF only');
  A.eq(c2[1].fnotes, [], 'and not with the other');
  await page.close();

  /* ── accessory wording: proposed only when every file says the same ── */
  const cw = 'C/W 4 Nuts & 4 Flat Washers';
  page = await openApp(browser);
  await page.evaluate(STUB);
  await page.evaluate(([a, b]) => { window.__ans = { 'A.pdf': { data: a }, 'B.pdf': { data: b } };
    wqaOpen(); wqaAddFiles([__pdf('A.pdf'), __pdf('B.pdf')]); wqaAnalyze(); },
    [sag([{ M: 'M12', L: 1000, TL: '100/100', qty: 5 }], { note: cw }), sag([{ M: 'M12', L: 900, TL: '100/100', qty: 3 }], { note: cw })]);
  await page.waitForTimeout(1200);
  rows = await live(page);
  A.eq(rows.map(r => r.acc), ['4 Nut + 4 FW', '4 Nut + 4 FW'], 'both PDFs say "C/W 4 Nuts & 4 FW": proposed on every row (Review)');
  await page.close();

  page = await openApp(browser);
  await page.evaluate(STUB);
  await page.evaluate(([a, b]) => { window.__ans = { 'A.pdf': { data: a }, 'B.pdf': { data: b } };
    wqaOpen(); wqaAddFiles([__pdf('A.pdf'), __pdf('B.pdf')]); wqaAnalyze(); },
    [sag([{ M: 'M12', L: 1000, TL: '100/100', qty: 5 }], { note: cw }), sag([{ M: 'M12', L: 900, TL: '100/100', qty: 3 }])]);
  await page.waitForTimeout(1200);
  rows = await live(page);
  A.eq(rows.map(r => r.acc), ['', ''], 'only one PDF says it: nothing proposed to the other file\'s rows (or any)');
  A.includes(await page.evaluate(() => JSON.stringify(wqa.aiWarnings)), 'PDF 1: ' + cw, 'the wording stays a mention, naming its PDF');
  await page.close();

  /* ── one PDF: unchanged ── */
  page = await openApp(browser);
  await page.evaluate(STUB);
  await page.evaluate(fix => { window.__ans = { 'WBC.pdf': fix['WBC.pdf'] }; wqaOpen(); wqaAddFiles([__pdf('WBC.pdf')]); wqaAnalyze(); }, FIX);
  await page.waitForTimeout(900);
  const one = await page.evaluate(() => ({ calls: __calls.length, list: document.getElementById('wqaFileInfo').innerText }));
  rows = await live(page);
  A.eq(one.calls, 1, 'one PDF: one request');
  A.eq(rows.length, 1, 'one PDF: its row');
  A.eq(rows[0].src, '', 'one PDF: no file tag on the row (as before)');
  A.excludes(one.list, 'each is read on its own', 'one PDF: the list reads as before');
  A.eq(page._dcErrors, [], 'no page errors');
  await page.close();
};
