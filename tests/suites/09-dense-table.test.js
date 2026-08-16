/* ── A dense table is an ordinary document ─────────────────────────────────
   Requirements 9, 10, 11, 44.

   The extraction is fed in exactly as ai_extract.php returns it, so this
   exercises the one shared normaliser and the review screen — the same path a
   real photograph takes once the model has answered.                         */
'use strict';
const { openApp, rowState } = require('../lib/harness');

/* One item in the shape the strict schema produces. */
const item = (M, L, TL, qty, extra = {}) => Object.assign({
  M, L, W: null, TL, qty, Bmid: null, material: null, finish: null, sizeType: null,
  unclear: null, product: null, threadEnds: null, bodyDia: null,
  H: null, ID: null, S: null, R: null,
}, extra);

/* 29 anchor-bolt rows, metric and imperial together, with a TL merged across
   rows 1-18 and a second merge across the rest — reported on the first row of
   each block, exactly as the instructions ask. */
const SIZES = ['3/8"', 'M8', 'M12', 'M16', '3/4"', 'M18', 'M20', '7/8"', 'M22', 'M24', '1"', 'M27', 'M30'];
const ROWS = [];
for (let i = 0; i < 29; i++) {
  ROWS.push(item(SIZES[i % SIZES.length], 250 + i * 10, i === 0 ? 150 : (i === 18 ? 300 : null), 4 + i));
}
const EXTRACTION = {
  product: 'ANCHOR_BOLT', material: 'MS', finish: 'HDG', sizeType: 'Fullsize',
  threadEnds: 1, note: null, items: ROWS,
};

module.exports = async (browser, A) => {
  const S = A.suite('dense table — 29 rows, merged cells, metric beside imperial');
  const page = await openApp(browser);

  await page.evaluate(async d => { wqaOpen(); await wqaAiApply(d); }, EXTRACTION);
  await page.evaluate(() => wqaSetView('expanded'));
  await page.waitForTimeout(1200);

  const rows = await rowState(page);
  A.eq(rows.length, 29, 'twenty-nine rows produce twenty-nine rows — a long table is not a failure');

  // ── the merged TL reaches the rows it covers, and stops ─────────────────
  for (let i = 0; i < 18; i++) A.eq(rows[i].thread, '150', `row ${i + 1} takes the TL merged across rows 1-18`);
  for (let i = 18; i < 29; i++) A.eq(rows[i].thread, '300', `row ${i + 1} takes the second merge, not the first`);

  // ── each row keeps its own size, length and quantity ────────────────────
  rows.forEach((r, i) => {
    A.eq(r.size, SIZES[i % SIZES.length].replace(/^(\d+\/\d+)"$/, '$1'),
      `row ${i + 1} kept its own size`);
    A.eq(r.length, String(250 + i * 10), `row ${i + 1} kept its own length`);
    A.eq(r.qty, String(4 + i), `row ${i + 1} kept its own quantity`);
  });

  // ── metric and imperial in one table, each weighed as itself ────────────
  const K = 0.0000061654;
  const imperialRow = rows.find(r => r.size === '3/4');
  const metricRow = rows.find(r => r.size === 'M20');
  A.ok(!!imperialRow, 'the 3/4" rows are imperial');
  A.ok(!!metricRow, 'the M20 rows are metric');
  A.near(imperialRow.weight, 19.05 * 19.05 * Number(imperialRow.length) * K, 1e-6,
    'the imperial row is weighed on 19.05mm');
  A.near(metricRow.weight, 20 * 20 * Number(metricRow.length) * K, 1e-6,
    'and the metric row on 20mm — one row\'s unit system says nothing about the next');
  rows.forEach((r, i) => A.ok(Number(r.weight) > 0, `row ${i + 1} has a weight`));

  // ── one unreadable row costs one row, not the document ──────────────────
  const withBad = JSON.parse(JSON.stringify(EXTRACTION));
  withBad.items[5] = item(null, null, null, null, { unclear: 'size M20 or M30' });
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, withBad);
  await page.evaluate(() => wqaSetView('expanded'));
  await page.waitForTimeout(1200);
  const mixed = await rowState(page);
  A.eq(mixed.length, 29, 'the unreadable row does not cost the other 28');
  A.ok(mixed[5].missing.length > 0, 'it asks for what it could not read');
  A.includes(mixed[5].badges, 'M20 or M30', 'and says what the extractor could not tell apart');
  A.eq(mixed[5].weight, 'null', 'it is not weighed');
  A.eq(mixed[5].price, 'null', 'and not priced');
  A.ok(Number(mixed[4].weight) > 0, 'the row above it is priced as usual');
  A.ok(Number(mixed[6].weight) > 0, 'and the row below it');
  A.eq(mixed[6].thread, '150', 'and the merged TL still reaches past it');

  // ── a truncated analysis says so, above everything else ─────────────────
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d, undefined, { truncated: true }); },
    EXTRACTION);
  await page.waitForTimeout(900);
  const warned = await page.evaluate(() => {
    const b = document.getElementById('wqaPartial');
    return { shown: !!b && !b.hidden, text: b ? b.textContent.replace(/\s+/g, ' ').trim() : '',
             addDisabled: !!(document.getElementById('wqaAddBtn') || {}).disabled };
  });
  A.eq(warned.shown, true, 'a cut-off analysis warns that rows may be missing');
  A.includes(warned.text, 'Only 29 item(s) were recovered',
    'and says how many of them there were, so a short list cannot pass for a whole one');
  A.eq(warned.addDisabled, true, 'with Add Items held until somebody acknowledges it');
  A.ok((await rowState(page)).length === 29, 'while still showing every row that did arrive');

  // ── a table column outranks the description beside it ───────────────────
  const withDesc = JSON.parse(JSON.stringify(EXTRACTION));
  withDesc.items = [item('M20', 300, 150, 4)];
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, withDesc);
  await page.waitForTimeout(900);
  const single = await rowState(page);
  A.eq(single.length, 1, 'a row described in prose AND given columns is still one row');
  A.eq(single[0].size, 'M20', 'with the column value');
  A.eq(single[0].length, '300', 'and the column length');

  // ── a size the diameter table does not hold is refused, with a reason ────
  const noDia = JSON.parse(JSON.stringify(EXTRACTION));
  noDia.items = [item('M20', 300, 150, 4), item('M14', 300, 150, 4)];   // no FULLSIZE M14
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, noDia);
  await page.waitForTimeout(900);
  const dia = await rowState(page);
  A.ok(Number(dia[0].weight) > 0, 'the M20 row weighs');
  A.eq(dia[1].weight, 'null', 'the M14 row does not — there is no fullsize M14 diameter');
  A.eq(dia[1].price, 'null', 'so it has no price either');
  A.includes(dia[1].badges, 'no diameter', 'and it says exactly why');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
