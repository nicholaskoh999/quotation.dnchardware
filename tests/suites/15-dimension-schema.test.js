/* ── The drawing's own words, and whose dimension is whose ─────────────────
   Live acceptance findings, 1 and 2.

   Two faults, both found by quoting a real drawing:

     * the review screen named the same field two ways. A thread length was
       "TL" on an L Bolt and "Thread" on a Sag Rod, and a length had no label
       at all — so a row read "M30 · 950 · W 400 · TL 150" and the 950 was a
       number the reader had to identify from its position.

     * two rows of HAB-TA-01 came back asking for a length they could not have
       had. The extractor offered "865 or 1000", where 865 was already the row
       above's length — an overall dimension line belongs to one part, so there
       was only ever one answer.

   The second fix must not become a licence to guess: the last section here
   asserts that a choice which is still open stays open.                     */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* One item in the shape ai_extract.php returns. */
const item = o => Object.assign({
  M: null, L: null, W: null, TL: null, qty: null, Bmid: null, material: null,
  finish: null, sizeType: null, unclear: null, product: null, threadEnds: null,
  bodyDia: null, H: null, ID: null, S: null, R: null,
}, o);

/* HAB-TA-01 exactly as production returned it: five rows, two of them offering
   a neighbouring part's dimension as an alternative reading of their own. */
const HAB = {
  product: null, material: 'MS', finish: null, sizeType: null, threadEnds: null, note: null,
  items: [
    item({ M: 'M30', L: 950, W: 400, TL: '150', qty: 90, product: 'L_BOLT', threadEnds: 1 }),
    item({ M: 'M30', L: 865, TL: '200/200', qty: 20, product: 'SAG_ROD', threadEnds: 2 }),
    item({ M: 'M30', L: null, TL: '200/200', qty: 10, product: 'SAG_ROD', threadEnds: 2,
           unclear: 'check length 865 or 1000' }),
    item({ M: 'M30', L: 1200, TL: '200/200', qty: 20, product: 'SAG_ROD', threadEnds: 2 }),
    item({ M: 'M30', L: null, TL: '200/200', qty: 110, product: 'SAG_ROD', threadEnds: 2,
           unclear: 'check length 865 or 1285' }),
  ],
};

module.exports = async (browser, A) => {
  const S = A.suite('dimension schema and drawing association');
  const page = await openApp(browser, { viewport: { width: 1500, height: 1200 } });

  /* ── 1 · every product names its dimensions the way the drawing does ─────*/
  const labels = await page.evaluate(() => {
    const of = t => {
      const p = wqaProductByType(t);
      return p.dims.map(d => d === 'size' ? 'M' : wqaDimLabel(t, d)).join(' · ');
    };
    return { stud: of('stud'), sagrod: of('sagrod'), anchorbolt: of('anchorbolt'),
             lbolt: of('lbolt'), jbolt: of('jbolt'),
             /* the column headers a list of one product shows */
             headThread: wqaDimLabel('sagrod', 'threadLen'),
             headLength: wqaDimLabel('sagrod', 'length') };
  });
  A.eq(labels.stud, 'M · L', 'a Stud is M and L');
  A.eq(labels.sagrod, 'M · L · TL', 'a Sag Rod is M, L and TL');
  A.eq(labels.anchorbolt, 'M · L · TL', 'an Anchor Bolt the same');
  A.eq(labels.lbolt, 'M · L · W · TL', 'an L Bolt adds its short leg');
  A.eq(labels.jbolt, 'M · H · ID · S · TL', 'and a J Bolt is a hook, not a rod with a length');
  A.eq(labels.headThread, 'TL', 'a Sag Rod\'s thread length is TL, not "Thread"');
  A.eq(labels.headLength, 'L', 'and its length is L');

  /* ── the rendered row, with a space between every label and its value ────*/
  const shown = await page.evaluate(() => {
    const mk = (product, over) => Object.assign({
      product, size: 'M30', length: '', w: '', h: '', id: '', s: '',
      threadLen: '', threadLen2: '', qty: '4', removed: false, issues: [], aiUncertain: [],
    }, over);
    wqa.rows = [
      mk('stud',       { length: '600' }),
      mk('sagrod',     { length: '865', threadLen: '200', threadLen2: '200' }),
      mk('anchorbolt', { length: '950', threadLen: '150' }),
      mk('lbolt',      { length: '950', w: '400', threadLen: '150' }),
      mk('jbolt',      { h: '300', id: '100', s: '80', threadLen: '150' }),
    ];
    return wqa.rows.map(r => wqaRowDimSummary(r));
  });

  A.eq(shown[0], 'L 600', 'a Stud row shows its length, labelled');
  A.eq(shown[1], 'L 865 · TL 200/200', 'a Sag Rod shows TL 200/200 — not "Thread 200/200"');
  A.eq(shown[2], 'L 950 · TL 150', 'an Anchor Bolt the same way');
  A.eq(shown[3], 'L 950 · W 400 · TL 150', 'an L Bolt in its own order');
  A.eq(shown[4], 'H 300 · ID 100 · S 80 · TL 150', 'and a J Bolt in its own');

  shown.forEach((line, i) => {
    A.ok(!/\b(?:L|W|H|S|ID|TL)\d/.test(line),
      `row ${i + 1} puts a space between the label and the value: ${JSON.stringify(line)}`);
    A.ok(!/(?:^|·\s)\d/.test(line),
      `row ${i + 1} shows no naked value: ${JSON.stringify(line)}`);
    A.excludes(line, 'Thread', `row ${i + 1} does not use the generic word`);
  });

  /* The label a narrow screen puts in front of each value is the same one. */
  const shortLabels = await page.evaluate(() => ({
    sagLen: wqaDimShort('sagrod', 'length'), sagTl: wqaDimShort('sagrod', 'threadLen'),
    lbW: wqaDimShort('lbolt', 'w'), jbId: wqaDimShort('jbolt', 'id'),
  }));
  A.eq(shortLabels.sagLen, 'L', 'on a phone a length still says L');
  A.eq(shortLabels.sagTl, 'TL', 'a thread length says TL');
  A.eq(shortLabels.lbW, 'W', 'a short leg says W');
  A.eq(shortLabels.jbId, 'ID', 'and a hook diameter says ID');

  /* The shared "apply to every row" panel names the same field the same way. */
  const panel = await page.evaluate(() => {
    wqa.commonItem = { size: 'M30', thread: '200/200' };
    wqa.panels.item = true;
    wqaRenderCommonItem(true);
    const box = document.getElementById('wqaCommonItem');
    return { text: (box.textContent || '').replace(/\s+/g, ' '),
             summary: wqaItemSummary(wqa.commonItem) };
  });
  A.eq(panel.summary, 'Size M30 · TL 200/200', 'the shared panel summarises in the same words');
  A.excludes(panel.text, 'Thread', 'and its field is not called Thread either');

  /* ── 2 · HAB-TA-01: five parts, five overall dimensions ─────────────────*/
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, HAB);
  await page.waitForTimeout(1200);
  const hab = await rowState(page);

  A.eq(hab.length, 5, 'five parts on the sheet, five rows');
  const expected = ['950', '865', '1000', '1200', '1285'];
  expected.forEach((L, i) => A.eq(hab[i].length, L,
    `row ${i + 1} takes its own overall length, ${L}`));

  A.eq(hab[0].product, 'lbolt', 'the bent part is an L Bolt');
  A.eq(hab[0].w, '400', 'with its short leg');
  A.eq(hab[0].thread, '150', 'and one thread');
  for (let i = 1; i < 5; i++) {
    A.eq(hab[i].product, 'sagrod', `row ${i + 1} is a Sag Rod`);
    A.eq(hab[i].thread, '200/200', `threaded both ends, 200/200, on row ${i + 1}`);
  }
  A.eq(hab.map(r => r.qty).join(','), '90,20,10,20,110', 'each row keeps its own quantity');

  /* The two that were asking are not asking any more, and say why. */
  A.excludes(hab[2].missing.join('|'), 'Length', 'row 3 no longer asks for a length');
  A.excludes(hab[4].missing.join('|'), 'Length', 'nor does row 5');
  A.excludes(hab[2].badges, '865 or 1000', 'the doubt that had only one answer is gone');
  A.excludes(hab[4].badges, '865 or 1285', 'on both rows');
  A.includes(hab[2].badges, 'L 1000', 'and the row says where its length came from');
  A.includes(hab[4].badges, 'L 1285', 'so a worked-out value is never mistaken for a measured one');

  const summaries = await page.evaluate(() => wqa.rows.map(r => wqaRowDimSummary(r)));
  A.eq(summaries[0], 'L 950 · W 400 · TL 150', 'and the sheet reads as the drawing does');
  A.eq(summaries[4], 'L 1285 · TL 200/200', 'down to the last row');

  /* ── 3 · uncertainty that is still uncertain stays uncertain ────────────*/
  const open = JSON.parse(JSON.stringify(HAB));
  open.items[3].L = null;                      // now rows 3, 4 and 5 are all asking
  open.items[3].unclear = 'check length 1000 or 1200';
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, open);
  await page.waitForTimeout(1000);
  const still = await rowState(page);
  A.includes(still[3].missing.join('|'), 'Length',
    'row 4, both of whose candidates were free when the sheet was read, goes on asking');
  A.eq(still[2].length, '1000', 'row 3 is still settled — 865 was row 2\'s before any of this');
  A.eq(still[4].length, '1285', 'and so is row 5');
  /* One round, deliberately. Row 3 taking the 1000 does NOT then hand row 4 the
     1200 by elimination: a value worked out is not evidence for working out the
     next one, and a chain of inferences is exactly how a wrong length would
     travel down a sheet unnoticed. */
  A.excludes(still[3].badges, 'L 1200',
    'and nothing is chained: a worked-out length is never used to work out another');

  /* Two rows wanting the same free value settles nothing for either. */
  const tie = JSON.parse(JSON.stringify(HAB));
  tie.items[4].unclear = 'check length 865 or 1000';    // both rows now want 1000
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, tie);
  await page.waitForTimeout(1000);
  const tied = await rowState(page);
  A.includes(tied[2].missing.join('|'), 'Length', 'two rows, one free length: row 3 asks');
  A.includes(tied[4].missing.join('|'), 'Length', 'and row 5 asks — neither is forced');

  /* A doubt about something else is not a length, and is left alone. */
  const other = JSON.parse(JSON.stringify(HAB));
  other.items[2] = item({ M: null, L: 1000, TL: '200/200', qty: 10, product: 'SAG_ROD',
                          threadEnds: 2, unclear: 'size M20 or M30' });
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, other);
  await page.waitForTimeout(1000);
  const sizeDoubt = await rowState(page);
  A.includes(sizeDoubt[2].badges, 'M20 or M30', 'a doubt about the size is still a doubt about the size');
  A.includes(sizeDoubt[2].missing.join('|'), 'Size', 'and the row asks for it');
  A.eq(sizeDoubt[2].length, '1000', 'while its length, which was never in doubt, stands');

  /* A long note is trimmed to fit its pill. The candidates must be read from
     the note as written, or "1000" becomes "100" and the row is handed a
     length nobody drew. */
  const longNote = {
    product: 'SAG_ROD', material: 'MS', finish: null, sizeType: null, threadEnds: 2, note: null,
    items: [
      item({ M: 'M30', L: 865, TL: '200/200', qty: 5 }),
      item({ M: 'M30', L: null, TL: '200/200', qty: 5,
             unclear: 'dimension line unreadable, overall length reads as either 865 or 1000 on this part' }),
    ],
  };
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, longNote);
  await page.waitForTimeout(1000);
  const long = await rowState(page);
  A.eq(long[1].length, '1000', 'a note too long for its pill is still read whole');

  /* And the reverse case: when the neighbour has claimed the larger value, the
     row gets the smaller one — the rule is elimination, not a preference. */
  const reverse = {
    product: 'SAG_ROD', material: 'MS', finish: null, sizeType: null, threadEnds: 2, note: null,
    items: [
      item({ M: 'M30', L: 1000, TL: '200/200', qty: 5 }),
      item({ M: 'M30', L: null, TL: '200/200', qty: 5, unclear: 'check length 865 or 1000' }),
    ],
  };
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, reverse);
  await page.waitForTimeout(1000);
  const rev = await rowState(page);
  A.eq(rev[1].length, '865', 'the value left over is the answer, whichever of the two it is');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
