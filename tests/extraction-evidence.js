/* ── The two reported documents, in and out ─────────────────────────────────
   Prints the extraction that goes in and the quotation rows that come out, so
   the acceptance report can be checked line by line without a browser.
   Run:  node tests/extraction-evidence.js [outfile]                          */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp } = require('./lib/harness');

const OUT = process.argv[2]
  || path.join(__dirname, '..', 'audit-out', 'test-results', 'extraction-evidence.txt');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const item = o => Object.assign({
  M: null, L: null, W: null, TL: null, qty: null, Bmid: null,
  material: null, finish: null, sizeType: null, unclear: null,
  product: null, threadEnds: null, bodyDia: null,
  H: null, ID: null, S: null, R: null,
}, o);
const doc = o => Object.assign({
  product: null, material: null, finish: null, sizeType: null,
  threadEnds: null, note: null, items: [],
}, o);

const CASES = [
  ['CASE A — hook bolt titled "ANCHOR BOLT", dimensioned D1 12 / L 280 / S 80 / T 50 / R 25',
   doc({ product: 'ANCHOR_BOLT',
         items: [item({ M: 'M12', L: 280, S: 80, TL: 50, R: 25, qty: 40 })] })],
  ['CASE A variant — the same drawing with an inside width written on it',
   doc({ product: 'ANCHOR_BOLT',
         items: [item({ M: 'M12', L: 280, ID: 50, S: 80, TL: 50, R: 25, qty: 40 })] })],
  ['CASE B — six stud rows, two merged specification cells',
   doc({ items: [
     item({ M: 'M12', L: 145, qty: 9,  product: 'STUD', material: 'A2-70 SUS304', finish: 'PLAIN' }),
     item({ M: 'M20', L: 240, qty: 5,  product: 'STUD' }),
     item({ M: 'M10', L: 120, qty: 27, product: 'STUD', material: 'STUD DIN 975 GRADE 8.8', finish: 'HDG' }),
     item({ M: 'M10', L: 125, qty: 21, product: 'STUD' }),
     item({ M: 'M10', L: 130, qty: 21, product: 'STUD' }),
     item({ M: 'M16', L: 170, qty: 9,  product: 'STUD' }),
   ] })],
  ['A sheet-wide "ISO 898 CLASS 5.8" under a block that states DIN 975 GRADE 8.8',
   doc({ material: 'ISO 898 CLASS 5.8', items: [
     item({ M: 'M10', L: 120, qty: 27, product: 'STUD', material: 'DIN 975 GRADE 8.8', finish: 'HDG' }),
     item({ M: 'M10', L: 125, qty: 21, product: 'STUD' }),
   ] })],
  ['LIVE — HT8.8 two-end studs, zinc (photographed order list)',
   doc({ items: [
     item({ M: 'M12', L: 1582, TL: '200/200', qty: 37,  threadEnds: 2, product: 'SAG_ROD',
            material: 'HT8.8', finish: 'ZINC' }),
     item({ M: 'M12', L: 1406, TL: '200/200', qty: 382, threadEnds: 2, product: 'SAG_ROD' }),
     item({ M: 'M12', L: 1104, TL: '200/200', qty: 44,  threadEnds: 2, product: 'SAG_ROD' }),
     item({ M: 'M12', L: 986,  TL: '200/200', qty: 28,  threadEnds: 2, product: 'SAG_ROD' }),
   ] })],
  ['LIVE — HAB-TA-01, five parts captioned PLAIN G8.8 M30 x their own length',
   doc({ items: [950, 865, 1000, 1200, 1285].map((L, i) => item({
     M: 'M30', L, TL: i ? '200/200' : null, threadEnds: i ? 2 : null,
     Bmid: [null, 465, 600, 800, 885][i], product: 'SAG_ROD',
     material: i ? null : 'PLAIN G8.8', finish: i ? null : 'PLAIN' })) })],
];

const pad = (s, n) => String(s === '' || s == null ? '—' : s).padEnd(n);

(async () => {
  const browser = await launch();
  const page = await openApp(browser);
  const lines = [];
  const say = s => { lines.push(s); console.log(s); };

  say('Extraction evidence — ' + new Date().toISOString().slice(0, 10));
  say('Every row below is produced by wqaAiApply, the path a photograph takes.');

  for (const [title, d] of CASES) {
    say('');
    say('═'.repeat(78));
    say(title);
    say('─'.repeat(78));
    say('IN  ' + JSON.stringify(d.items));
    if (d.product)  say('IN  document product: ' + d.product);
    if (d.material) say('IN  document material: ' + JSON.stringify(d.material));

    const rows = await page.evaluate(async x => {
      wqaOpen();
      await wqaAiApply(x);
      return wqa.rows.map(r => ({
        product: r.product, size: r.size, length: r.length, w: r.w,
        h: r.h, id: r.id, s: r.s, thread: wqaThreadValue(r), qty: r.qty,
        material: r.material, finish: r.finish, sizeType: r.sizeType,
        matFrom: r.matFrom || '',
        grade: r.grade, radius: r.radius, hFromL: r.hFromL, finishSeen: r.finishSeen,
        specRaw: r.specRaw || {},
        missing: wqaRowMissing(r).join(', '),
        badges: wqaRowBadges(r).map(b => b.t).join(' | '),
      }));
    }, d);

    say('');
    say('OUT ' + pad('product', 12) + pad('size', 7) + pad('L', 7) + pad('H', 7)
        + pad('ID', 6) + pad('S', 6) + pad('TL', 8) + pad('qty', 6)
        + pad('material', 10) + pad('finish', 8) + 'grade');
    rows.forEach(r => say('    ' + pad(r.product, 12) + pad(r.size, 7) + pad(r.length, 7)
        + pad(r.h, 7) + pad(r.id, 6) + pad(r.s, 6) + pad(r.thread, 8) + pad(r.qty, 6)
        + pad(r.material, 10) + pad(r.finish, 8) + pad(r.grade, 12)));
    say('');
    rows.forEach((r, i) => {
      say(`    row ${i + 1}: needs ${r.missing || '—'}`);
      const raw = [['material', r.specRaw.material], ['finish', r.specRaw.finish],
                   ['sizeType', r.specRaw.sizeType]].filter(([, v]) => v)
                  .map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(' · ');
      if (raw) say(`            read from: ${raw}`);
      if (r.matFrom) say(`            material from: ${JSON.stringify(r.matFrom)}`);
      if (r.badges) say(`            ${r.badges}`);
    });
  }

  await page.close();
  await browser.close();
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log('\n  written to ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
