/* ── Multi-image Quick Add: no value bleed across source images ──────────────
   Quick Add fills a row's silent M / thread / material / finish / size type
   from the row above (inheritGaps). That is right inside ONE document — a
   merged cell, a shared heading — and wrong across SEPARATE images: the 2026-11-03
   media precheck fed a correct 4-image answer through wqaAiApply and got SS304
   studs with a Sag Rod's 100/100 thread and L bolts priced as SS304.
   Several images now mean no carry-forward; one image or one PDF keeps it.  */
'use strict';
const path = require('path');
const { openApp, rowState } = require('../lib/harness');
const FIX = require(path.join(__dirname, '..', 'fixtures', 'ai-multi-image-22rows.json'));

const item = o => Object.assign({ M: null, L: null, W: null, TL: null, qty: null, Bmid: null, material: null, finish: null,
  sizeType: null, unclear: null, product: null, threadEnds: null, bodyDia: null, H: null, ID: null, S: null, R: null,
  Lref: null, Wref: null }, o);
const doc = items => ({ product: null, material: null, finish: null, sizeType: null, threadEnds: null, note: null, items });

module.exports = async (browser, A) => {
  A.suite('multi-image Quick Add — no value bleed across images');
  const p = await openApp(browser);
  const apply = async (d, sources) => {
    await p.evaluate(async ([d, n]) => { wqaResetState(); await wqaAiApply(d, undefined, { truncated: false, sources: n }); }, [d, sources]);
    await p.waitForTimeout(300);
    return (await rowState(p)).filter(r => r.removed !== true);
  };

  /* A. One image, one table: a value stated once still covers the rows under it. */
  const table = doc([item({ M: 'M12', L: 1000, TL: '100/100', qty: 5, material: 'MS', finish: 'ZP', sizeType: 'Undersize', product: 'SAG_ROD' }),
                     item({ L: 1200, qty: 4, product: 'SAG_ROD' }), item({ L: 1400, qty: 3, product: 'SAG_ROD' }),
                     item({ L: 1600, qty: 2, product: 'SAG_ROD' }), item({ L: 1800, qty: 1, product: 'SAG_ROD' })]);
  for (const [label, n] of [['one image', 1], ['caller passes no source count (text fallback)', undefined]]) {
    const r = await apply(table, n);
    A.eq(r.length, 5, `${label}: five rows`);
    A.eq(r.slice(1).map(x => x.size).join(','), 'M12,M12,M12,M12', `${label}: M carries down the table`);
    A.eq(r.slice(1).map(x => x.thread).join(','), '100/100,100/100,100/100,100/100', `${label}: thread carries down the table`);
    A.eq(r.slice(1).map(x => x.material).join(','), 'MS,MS,MS,MS', `${label}: material carries down the table`);
    A.eq(r.slice(1).map(x => x.finish).join(','), 'ZP,ZP,ZP,ZP', `${label}: finish carries down the table`);
    A.eq(r.slice(1).map(x => x.sizeType).join(','), r[0].sizeType + ',' + r[0].sizeType + ',' + r[0].sizeType + ',' + r[0].sizeType,
      `${label}: size type carries down the table`);
  }

  /* B. Image 1 Sag Rod with a thread; image 2 a Stud that states none. */
  let r = await apply(doc([item({ M: 'M12', L: 1000, TL: '100/100', qty: 5, material: 'MS', finish: 'ZP', product: 'SAG_ROD' }),
                           item({ M: 'M16', L: 170, qty: 40, material: 'S/S 304', product: 'STUD' })]), 2);
  A.eq(r[1].product, 'stud', 'B: the stud stays a stud');
  A.eq(r[1].thread, '', 'B: the stud does NOT take the Sag Rod thread 100/100 from image 1');

  /* C. Image 2 SS304 Stud; image 3 an L Bolt with no material. */
  r = await apply(doc([item({ M: 'M12', L: 1000, TL: '100/100', qty: 5, material: 'MS', product: 'SAG_ROD' }),
                       item({ M: 'M16', L: 170, qty: 40, material: 'S/S 304', product: 'STUD' }),
                       item({ M: 'M16', L: 230, W: 50, TL: 80, qty: 12, product: 'L_BOLT' })]), 3);
  A.eq(r[2].product, 'lbolt', 'C: the L bolt stays an L bolt');
  A.eq(r[2].material, '', 'C: the L bolt does NOT take SS304 from image 2');

  /* D. Every field the carry touches: M, finish and size type too. */
  r = await apply(doc([item({ M: 'M12', L: 1000, TL: '100/100', qty: 5, material: 'MS', finish: 'ZP', sizeType: 'Undersize', product: 'SAG_ROD' }),
                       item({ L: 600, W: 100, TL: 80, qty: 8, product: 'L_BOLT' })]), 2);
  A.eq(r[1].size, '', 'D: M is not taken from another image');
  A.eq(r[1].material, '', 'D: material is not taken from another image');
  A.eq(r[1].finish, '', 'D: finish is not taken from another image');
  A.eq(r[1].sizeType, '', 'D: size type is not taken from another image');
  A.ok(r[1].missing.length > 0, 'D: the blanks are asked for in review, not hidden');

  /* E/F. The measured 22-row, 4-image answer. */
  const before = await apply(FIX, 1);   // the old behaviour: one list, carried end to end
  const after = await apply(FIX, 4);
  const studs = rs => rs.filter(x => x.product === 'stud');
  const lbolts = rs => rs.filter(x => x.product === 'lbolt');
  A.ok(studs(before).some(x => x.thread === '100/100'), 'fixture reproduces the bleed when treated as ONE source (guards the fixture)');
  A.eq(after.length, 22, 'F: 22 rows after the fix');
  A.eq(after.length, before.length, 'E: row count unchanged by the fix');
  A.eq(after.map(x => x.product).join(','), before.map(x => x.product).join(','), 'E: no product changed by the fix');
  A.eq(studs(after).filter(x => x.thread === '100/100').length, 0, 'F: 0 stud rows receive the Sag Rod 100/100');
  A.eq(lbolts(after).filter(x => x.material === 'SS304').length, 0, 'F: 0 L-bolt rows receive SS304');
  A.eq(after.slice(0, 12).map(x => x.thread).join(','), Array(12).fill('100/100').join(','), 'F: the sag rods keep their own stated thread');
  A.eq(after.slice(12, 19).map(x => x.material).join(','), Array(7).fill('SS304').join(','), 'F: the studs keep their own stated SS304');

  /* 5 images, each a different single item with gaps: nothing crosses. */
  r = await apply(doc([item({ M: 'M20', H: 550, ID: 140, S: 190, TL: 120, product: 'J_BOLT', material: 'SS304' }),
                       item({ L: 400, W: 100, TL: 150, product: 'L_BOLT' }),
                       item({ M: 'M30', L: 300, TL: 80, qty: 6, product: 'ANCHOR_BOLT', finish: 'HDG' }),
                       item({ L: 500, qty: 30, product: 'SAG_ROD' }),
                       item({ M: 'M20', L: 600, qty: 24, product: 'ANCHOR_BOLT' })]), 5);
  A.eq(r[1].size + '|' + r[1].material, '|', '5 images: image 2 takes neither M20 nor SS304 from image 1');
  A.eq(r[3].size + '|' + r[3].thread + '|' + r[3].finish, '||', '5 images: image 4 takes no M, thread or HDG from image 3');
  A.eq(r[4].thread + '|' + r[4].finish, '|', '5 images: image 5 takes no thread or finish from earlier images');

  /* End to end: the real upload path tells wqaAiApply how many images it sent. */
  const wired = await p.evaluate(async fix => {
    const real = window.fetch;
    window.fetch = async (u, o) => (String(u).includes('ai_extract.php')
      ? new Response(JSON.stringify({ ok: true, data: fix, truncated: false }), { headers: { 'Content-Type': 'application/json' } })
      : real(u, o));
    const f = n => new File([new Uint8Array([137, 80, 78, 71])], n, { type: 'image/png' });
    wqa.aiFiles = ['1.png', '2.png', '3.png', '4.png'].map(n => ({ file: f(n), name: n }));
    wqa.aiFile = wqa.aiFiles[0].file;
    try { await wqaAnalyze(); } finally { window.fetch = real; }
    return wqa.rows.filter(x => !x.removed).map(x => ({ product: x.product, thread: wqaThreadValue(x), material: x.material }));
  }, FIX);
  A.eq(wired.length, 22, 'upload path: 22 rows');
  A.eq(wired.filter(x => x.product === 'stud' && x.thread === '100/100').length, 0, 'upload path (4 images): no stud gets 100/100');
  A.eq(wired.filter(x => x.product === 'lbolt' && x.material === 'SS304').length, 0, 'upload path (4 images): no L bolt gets SS304');
  await p.close();
};
