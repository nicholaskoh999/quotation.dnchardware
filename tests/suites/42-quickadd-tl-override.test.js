/* ── A row's own thread length beats the shared heading's ────────────────────
   The WhatsApp message that 8680051 was built from: one shared heading for a
   whole list of Sag Rods, the size, material, size type, finish, accessories
   and thread all stated once, and five numbered rows of lengths underneath.

   The heading says THREAD LENGTH 70MM. A row that says "thread length 50mm" is
   a 50/50 rod — that row only. The parser used to drop the row's 50 as an extra
   number and quietly give it the heading's 70, which is a quotation-sized
   mistake with nothing on screen to say so.

   Every assertion runs the shipped path: wqaParseText for the reading, and the
   real Quick Add review for what a person sees.                              */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const HEADING = '10mm Dia MS Undersize Sag Rod c/w 4 nos nut & 4 nos washer (Zinc Plated) / THREAD LENGTH 70MM';
const FIVE = ['1) 821mm - 4 pcs',
              '2) 1021mm - 6 pcs',
              '3) 1221mm - 8 pcs',
              '4) 1421mm - 2 pcs',
              '5) 1621mm - 10 pcs'];
const msg = rows => [HEADING].concat(rows).join('\n');
/* The five-row fixture with row 1 carrying its own thread. */
const withOwn = tl => msg([FIVE[0] + ' ' + tl].concat(FIVE.slice(1)));

module.exports = async (browser, A) => {
  const S = A.suite('quick add — a row\'s own thread length overrides the shared heading');
  const page = await openApp(browser);

  const parse = text => page.evaluate(t => wqaParseText(t).rows.map(r => ({
    size: r.size, product: r.product, material: r.material, finish: r.finish,
    sizeType: r.sizeType, length: r.length, qty: r.qty,
    tl: r.threadLen + '/' + r.threadLen2, thread: wqaThreadValue(r),
    nut: r.accParsed && r.accParsed.nut.enabled ? r.accParsed.nut.qty : null,
    fw:  r.accParsed && r.accParsed.fw.enabled  ? r.accParsed.fw.qty  : null,
    raw: r.raw,
  })), text);

  /* What the heading gives every row, checked on each one. */
  const inherits = (r, label) => {
    A.eq(r.size, 'M10', label + ': size M10 from the heading');
    A.eq(r.product, 'sagrod', label + ': a Sag Rod');
    A.eq(r.material, 'MS', label + ': material MS');
    A.eq(r.sizeType, 'UNDERSIZE', label + ': undersize');
    A.eq(r.finish, 'ZP', label + ': zinc plated');
  };

  // ══ the fixture as received: five rows, every one inherits 70/70 ═════════
  {
    const rows = await parse(msg(FIVE));
    A.eq(rows.length, 5, 'the five-row fixture is exactly five items — no phantom heading row');
    const lengths = ['821', '1021', '1221', '1421', '1621'], qtys = ['4', '6', '8', '2', '10'];
    rows.forEach((r, k) => {
      inherits(r, 'row ' + (k + 1));
      A.eq(r.length, lengths[k], 'row ' + (k + 1) + ': length ' + lengths[k]);
      A.eq(r.qty, qtys[k], 'row ' + (k + 1) + ': qty ' + qtys[k]);
      A.eq(r.tl, '70/70', 'row ' + (k + 1) + ': inherits the heading thread 70/70');
      A.eq(r.nut, 4, 'row ' + (k + 1) + ': 4 nuts per rod from the heading');
      A.eq(r.fw, 4, 'row ' + (k + 1) + ': 4 washers per rod from the heading');
    });
  }

  // ══ every accepted spelling of the row's own thread ══════════════════════
  for (const own of ['thread length 50mm', 'THREAD LENGTH 50MM', 'TL 50', 'TL50', 'x 50/50']) {
    const text = own === 'x 50/50'
      ? msg(['1) 821mm x 50/50 - 4 pcs'].concat(FIVE.slice(1)))
      : withOwn(own);
    const rows = await parse(text);
    A.eq(rows.length, 5, `"${own}": still exactly five items`);
    A.eq(rows[0].tl, '50/50', `"${own}": row 1 is 50/50`);
    A.eq(rows[0].length, '821', `"${own}": row 1 keeps its length 821 — the 50 is not a length`);
    A.eq(rows[0].qty, '4', `"${own}": row 1 keeps its qty 4`);
    inherits(rows[0], `"${own}" row 1`);
    A.eq(rows[0].nut, 4, `"${own}": row 1 still gets the heading's 4 nuts`);
    A.eq(rows[0].fw, 4, `"${own}": row 1 still gets the heading's 4 washers`);
    rows.slice(1).forEach((r, k) =>
      A.eq(r.tl, '70/70', `"${own}": row ${k + 2} still inherits 70/70`));
  }

  // ══ mixed: the override is that row's only, wherever it sits ═════════════
  {
    const rows = await parse(msg([
      '1) 821mm - 4 pcs',
      '2) 1021mm - 6 pcs thread length 50mm',
      '3) 1221mm - 8 pcs',
      '4) 1421mm - 2 pcs TL 60',
      '5) 1621mm - 10 pcs',
    ]));
    A.eq(rows.length, 5, 'mixed: five items');
    A.eq(rows.map(r => r.tl).join(' '), '70/70 50/50 70/70 60/60 70/70',
         'mixed: rows 2 and 4 carry their own thread, the rest inherit 70/70');
    A.eq(rows.map(r => r.length).join(' '), '821 1021 1221 1421 1621', 'mixed: every length intact');
    A.eq(rows.map(r => r.qty).join(' '), '4 6 8 2 10', 'mixed: every qty intact');
    rows.forEach((r, k) => inherits(r, 'mixed row ' + (k + 1)));
    A.eq(rows.map(r => r.nut + '/' + r.fw).join(' '), '4/4 4/4 4/4 4/4 4/4',
         'mixed: accessory inheritance unchanged on every row');
  }

  // ══ a row's own accessories still win, its own thread alongside ═════════
  {
    const rows = await parse(msg([
      '1) 821mm - 4 pcs thread length 50mm c/w 2 nos nut & 2 nos washer',
      '2) 1021mm - 6 pcs',
    ]));
    A.eq(rows.length, 2, 'own accessories: two items');
    A.eq(rows[0].tl, '50/50', 'own accessories: row 1 thread 50/50');
    A.eq(rows[0].nut, 2, 'own accessories: row 1 its own 2 nuts');
    A.eq(rows[0].fw, 2, 'own accessories: row 1 its own 2 washers');
    A.eq(rows[1].tl, '70/70', 'own accessories: row 2 inherits 70/70');
    A.eq(rows[1].nut, 4, 'own accessories: row 2 the heading\'s 4 nuts');
    A.eq(rows[1].fw, 4, 'own accessories: row 2 the heading\'s 4 washers');
  }

  // ══ the heading itself is still read as the shared spec ═════════════════
  {
    /* With no rows of its own the heading's 70 stays a thread, never a length. */
    const rows = await parse(msg(['1) 821mm - 4 pcs TL 50']));
    A.eq(rows.length, 1, 'one row under the heading is one item');
    A.eq(rows[0].tl, '50/50', 'and its own TL 50 wins');
    A.ok(rows.every(r => r.length !== '70'), 'the heading\'s 70 never became a length');
  }

  // ══ "TL1 60" still names an end, not a 1mm thread ═══════════════════════
  {
    const rows = await parse('SAG ROD MS PL\nM12 x 1000 - 10pcs\nTL1 60\nTL2 80');
    A.eq(rows.length, 1, 'TL1 / TL2 lines: one item');
    A.eq(rows[0].tl, '60/80', 'TL1 60 / TL2 80 is still read as the two ends');
  }

  // ══ what a person sees in the review ════════════════════════════════════
  {
    await quickAddPaste(page, withOwn('thread length 50mm'), { settle: 900 });
    const rows = (await rowState(page)).filter(r => r.removed !== true);
    A.eq(rows.length, 5, 'review: five rows on screen');
    A.eq(rows[0].thread, '50/50', 'review: row 1 shows 50/50');
    A.eq(rows.slice(1).map(r => r.thread).join(' '), '70/70 70/70 70/70 70/70',
         'review: rows 2–5 show the inherited 70/70');
    A.eq(rows[0].length, '821', 'review: row 1 length 821');
    A.eq(rows[0].size, 'M10', 'review: row 1 size M10');
  }

  await page.close();
};
