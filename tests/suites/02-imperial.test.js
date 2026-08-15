/* ── Imperial ──────────────────────────────────────────────────────────────
   Requirements 5, 6, 45, 49.

   The defect: a dimension run written in inches without the inch mark reached
   the thread reader with its diameter still on it, and "number slash number"
   is exactly what a thread pair looks like — so 1/2 became thread 1 and thread
   2, the size box came back empty, and "1 x 100 x 100" put the 1 in Length.  */
'use strict';
const { openApp } = require('../lib/harness');

const HEAD = 'MS ANCHOR BOLT PL FULLSIZE\n';
const RHO_K = 0.0000061654;

module.exports = async (browser, A) => {
  const S = A.suite('imperial — the first token of a run is the size');
  const page = await openApp(browser);

  const parse = text => page.evaluate(t => wqaParseText(t).rows.map(r => ({
    size: r.size, length: r.length, thread: wqaThreadValue(r),
    qty: r.qty, product: r.product, w: r.w, h: r.h, id: r.id, s: r.s,
    series: r.series, raw: r.raw, issues: (r.issues || []).join(','),
  })), text);

  // ── the reported case, verbatim ──────────────────────────────────────────
  const rows = await parse(HEAD + [
    '1/2 x 100 x 100/100',
    '5/16 x 100 x 100',
    '3/8 x 100 x 100',
    '7/8 x 100 x 100',
    '1 x 100 x 100',
  ].join('\n'));

  const want = [
    ['1/2',  '100', '100/100'],
    ['5/16', '100', '100'],
    ['3/8',  '100', '100'],
    ['7/8',  '100', '100'],
    ['1"',   '100', '100'],
  ];
  A.eq(rows.length, 5, 'five lines, five rows');
  want.forEach(([size, len, thread], i) => {
    A.eq(rows[i].size,   size,   `row ${i + 1}: size is ${size}, not blank and not a thread`);
    A.eq(rows[i].length, len,    `row ${i + 1}: length is ${len}`);
    A.eq(rows[i].thread, thread, `row ${i + 1}: thread is ${thread}`);
  });
  A.eq(rows[4].length, '100', 'the whole-inch row does NOT put the 1 in Length');

  // ── an inch size never becomes a metric one ──────────────────────────────
  rows.forEach((r, i) => A.ok(!/^M\d/.test(r.size), `row ${i + 1}: ${r.size} was not converted to an M size`));

  // ── the mark is optional, not meaningful ─────────────────────────────────
  const marked = await parse(HEAD + '1/2" x 100 x 100\n3/4" x 250 x 80');
  A.eq(marked[0].size, '1/2', 'a marked 1/2" reads as the same size as an unmarked one');
  A.eq(marked[1].size, '3/4', 'and 3/4"');
  A.eq(marked[1].length, '250', 'with its own length');

  // ── a fraction we cannot weigh is still a SIZE, and says so ──────────────
  const odd = await parse(HEAD + '9/16 x 100 x 100');
  A.eq(odd[0].size, '9/16', 'an inch size the diameter table does not hold is still read as the size');
  A.eq(odd[0].thread, '100', 'and it does not steal the thread');
  const known = await page.evaluate(() => ({
    half: isKnownSize('1/2'), marked: isKnownSize('1/2"'), odd: isKnownSize('9/16'),
    whole: isKnownSize('1"'), sixteenth: isKnownSize('5/16'),
  }));
  A.eq(known.half, 'true', '1/2 is a size we can build from');
  A.eq(known.marked, 'true', 'and so is 1/2" — the mark does not change the size');
  A.eq(known.sixteenth, 'true', '5/16 too');
  A.eq(known.whole, 'true', 'and 1"');
  A.eq(known.odd, 'false', '9/16 is not — so it is flagged, never weighed');

  // ── metric must be untouched by all of this ──────────────────────────────
  const metric = await parse('MS SAG ROD PL FULLSIZE\nM12 x 1000 x 100/100 - 5pcs\nM20 x 850 x 75/75 - 3pcs');
  A.eq(metric[0].size, 'M12', 'metric size still read');
  A.eq(metric[0].length, '1000', 'metric length still read');
  A.eq(metric[0].thread, '100/100', 'metric thread pair still read');
  A.eq(metric[0].qty, '5', 'metric qty still read');
  A.eq(metric[1].size, 'M20', 'second metric row');
  A.eq(metric[1].thread, '75/75', 'with its own thread');

  const shorthand = await parse('MS L BOLT PL FULLSIZE\nM20x500x100x100 - 4pcs');
  A.eq(shorthand[0].size, 'M20', 'the compact L Bolt shorthand still reads its size');
  A.eq(shorthand[0].length, '500', 'long leg');
  A.eq(shorthand[0].w, '100', 'short leg');
  A.eq(shorthand[0].thread, '100', 'thread');

  const list = await parse('MS SAG ROD PL FULLSIZE M16 TL 100/100\n1000 x 5pcs\n850 x 8pcs');
  A.eq(list[0].size, 'M16', 'a length list under a heading still inherits its size');
  A.eq(list[0].length, '1000', 'and a leading 1000 is still a length, not an inch size');
  A.eq(list[1].length, '850', 'second length');

  // ── metric and imperial in ONE message ───────────────────────────────────
  const mixed = await parse('MS ANCHOR BOLT PL FULLSIZE\nM20 x 300 x 100\n7/8 x 400 x 120\nM24 x 500 x 150\n3/4 x 600 x 90');
  A.eq(mixed[0].size, 'M20', 'metric row unaffected by the imperial rows around it');
  A.eq(mixed[1].size, '7/8', 'imperial row keeps its own notation');
  A.eq(mixed[1].length, '400', 'and its own length');
  A.eq(mixed[2].size, 'M24', 'back to metric');
  A.eq(mixed[3].size, '3/4', 'and imperial again');
  A.eq(mixed[3].length, '600', 'with its own length');

  // ── thread standards are read and kept, and never take the diameter ──────
  const jbolt = await parse('J BOLT MS HDG\n7/8" DIA x 20-1/2" H\n3" ID x 5-1/4" S\nTHD 7-1/2"\n16 PCS\nUNC');
  A.ok(jbolt.length >= 1, 'the J Bolt drawing produces a row');
  A.eq(jbolt[0].size, '7/8', 'DIA marks the size: 7/8, not the 3" inside diameter');
  A.eq(jbolt[0].product, 'jbolt', 'and it is a J Bolt');
  A.near(jbolt[0].h, 20.5 * 25.4, 0.01, 'the overall height is the 20-1/2 inches, in millimetres');
  A.near(jbolt[0].id, 3 * 25.4, 0.01, 'ID is the three inches');
  A.near(jbolt[0].s, 5.25 * 25.4, 0.01, 'S is the 5-1/4 inches');
  A.eq(jbolt[0].qty, '16', 'sixteen of them');
  A.eq(jbolt[0].series, 'UNC', 'UNC is kept beside the row as evidence');

  const lbolt = await parse('L BOLT MS HDG\n1" DIA x 24-3/4" H\n6-1/2" BEND\nTHD 8-1/4"\nQTY 12 PCS\nUNC');
  A.eq(lbolt[0].size, '1"', 'a one-inch L Bolt keeps its mark, and UNC did not take the diameter');
  A.eq(lbolt[0].product, 'lbolt', 'read as an L Bolt');
  A.eq(lbolt[0].qty, '12', 'twelve');
  A.eq(lbolt[0].series, 'UNC', 'UNC kept');

  const bsw = await parse(HEAD + '3/4" BSW x 300 x 100');
  A.eq(bsw[0].size, '3/4', 'a thread standard after the size does not change the size');
  A.eq(bsw[0].series, 'BSW', 'and BSW is kept');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
