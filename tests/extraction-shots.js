/* ── What the two reported documents look like after the round ──────────────
   Assertions prove the values; these are for reading the screen. Each frame is
   an extraction of exactly the shape the live cases produced, applied through
   wqaAiApply — the same path a photograph takes.
   Run:  node tests/extraction-shots.js [outdir]                              */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp } = require('./lib/harness');

const OUT = process.argv[2] || path.join(__dirname, '..', 'audit-out', 'extraction');
fs.mkdirSync(OUT, { recursive: true });

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

/* CASE A, as the drawing is dimensioned: the title block says ANCHOR BOLT, the
   hook is dimensioned by radius, and the overall height is written as L. */
const CASE_A = doc({
  product: 'ANCHOR_BOLT',
  items: [item({ M: 'M12', L: 280, S: 80, TL: 50, R: 25, qty: 40 })],
});
const CASE_A_WITH_ID = doc({
  product: 'ANCHOR_BOLT',
  items: [item({ M: 'M12', L: 280, ID: 50, S: 80, TL: 50, R: 25, qty: 40 })],
});

/* CASE B: six stud rows, two merged specification cells, each reported on the
   first row it covers. */
const CASE_B = doc({
  items: [
    item({ M: 'M12', L: 145, qty: 9,  product: 'STUD',
           material: 'A2-70 SUS304', finish: 'PLAIN' }),
    item({ M: 'M20', L: 240, qty: 5,  product: 'STUD' }),
    item({ M: 'M10', L: 120, qty: 27, product: 'STUD',
           material: 'STUD DIN 975 GRADE 8.8', finish: 'HDG' }),
    item({ M: 'M10', L: 125, qty: 21, product: 'STUD' }),
    item({ M: 'M10', L: 130, qty: 21, product: 'STUD' }),
    item({ M: 'M16', L: 170, qty: 9,  product: 'STUD' }),
  ],
});

/* A sheet-wide Class 5.8 remark under a block that states its own Grade 8.8. */
const REMARK = doc({
  material: 'ISO 898 CLASS 5.8',
  items: [
    item({ M: 'M10', L: 120, qty: 27, product: 'STUD',
           material: 'DIN 975 GRADE 8.8', finish: 'HDG' }),
    item({ M: 'M10', L: 125, qty: 21, product: 'STUD' }),
  ],
});

/* The stainless vocabulary and the paper trap, side by side. */
const VOCAB = doc({
  items: [
    item({ M: 'M16', L: 300, qty: 10, product: 'STUD', material: 'A2-70' }),
    item({ M: 'M16', L: 300, qty: 10, product: 'STUD', material: 'A4-80' }),
    item({ M: 'M16', L: 300, qty: 10, product: 'STUD', material: 'SUS316' }),
    item({ M: 'M16', L: 300, qty: 10, product: 'STUD', material: 'GRADE 8.8' }),
    item({ M: 'M16', L: 300, qty: 10, product: 'STUD', material: 'GRADE 10.9' }),
    item({ M: 'M16', L: 300, qty: 10, product: 'STUD', material: 'SHEET SIZE A4' }),
  ],
});

const shot = async (page, name, sel) => {
  const t = sel ? await page.$(sel) : null;
  await (t || page).screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  ' + name + '.png');
};

async function frame(browser, name, d, opts = {}) {
  const page = await openApp(browser, { viewport: { width: 1500, height: opts.height || 1000 } });
  await page.evaluate(() => { selectedCompanyId = 7; });
  await page.evaluate(async x => { wqaOpen(); await wqaAiApply(x); }, d);
  await page.evaluate(v => wqaSetView(v), opts.view || 'expanded');
  await page.waitForTimeout(opts.settle || 1100);
  await shot(page, name, '#wqaStep2');
  await page.close();
}

(async () => {
  const browser = await launch();
  await frame(browser, '1-caseA-as-drawn',       CASE_A);
  await frame(browser, '2-caseA-compact',        CASE_A, { view: 'compact' });
  await frame(browser, '3-caseA-with-stated-id', CASE_A_WITH_ID);
  await frame(browser, '4-caseB-six-rows',       CASE_B, { height: 1300, settle: 1500 });
  await frame(browser, '5-caseB-compact',        CASE_B, { height: 1200, view: 'compact', settle: 1500 });
  await frame(browser, '6-row-beats-remark',     REMARK);
  await frame(browser, '7-vocabulary',           VOCAB, { height: 1300, settle: 1500 });
  await browser.close();
  console.log('\n  extraction frames in ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
