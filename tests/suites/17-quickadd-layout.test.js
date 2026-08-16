/* ── Every product, every width, actions always reachable ──────────────────
   Live acceptance finding: a J Bolt row showed Edit but not History.

   The cause was not a missing button. The summary row is a CSS grid, and the
   badge cell was spanned with `grid-column:2/-3` — counted from the END of the
   track list — on any product with more than two dimension columns. Adding the
   History track moved that end, so on an L Bolt and a J Bolt every action
   shifted one track right and the delete fell off the row into a third
   implicit line. The same rule also made those rows permanently two lines tall
   whether or not they had anything to warn about.

   So the assertions here are geometric, not structural: for every product, at
   every width people actually use, each action must have a real box, inside
   the list, not overlapping its neighbours. A DOM node that exists but is 20px
   wide behind another one is exactly the bug this suite exists to catch.    */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* One clean fixture per product, priced so nothing is flagged, plus the two
   from the production report. */
const FIXTURES = {
  stud:       { msg: 'MS STUD PL\nM16 x 300 - 35pcs',
                cols: ['L'], dims: { length: '300' } },
  sagrod:     { msg: 'MS SAG ROD PL FULLSIZE\nM16 x 300 x 50/50 - 35pcs',
                cols: ['L', 'TL'], dims: { length: '300', thread: '50/50' } },
  anchorbolt: { msg: 'MS ANCHOR BOLT PL FULLSIZE\nM16 x 300 x 100 - 35pcs',
                cols: ['L', 'TL'], dims: { length: '300', thread: '100' } },
  lbolt:      { msg: 'MS L BOLT PL FULLSIZE\nM20 x 950 x 400 x 150 - 90pcs',
                cols: ['L', 'W', 'TL'], dims: { length: '950', w: '400', thread: '150' } },
  jbolt:      { msg: 'MS J BOLT PL FULLSIZE\nM20 x H 400 x ID 70 x S 80 x TL 100 - 28pcs',
                cols: ['H', 'ID', 'S', 'TL'], dims: { h: '400', id: '70', s: '80', thread: '100' } },
};

/* Where each action actually is, and whether it is usable: a real box, inside
   the list's own bounds, not overlapping the one beside it. */
const GEOMETRY = () => {
  const card = document.querySelector('[data-wqa-row="0"]');
  const list = document.querySelector('.wqa-rows');
  if (!card || !list) return { err: 'no row' };
  const lb = list.getBoundingClientRect();
  const box = sel => {
    const n = card.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height,
             inside: r.width > 8 && r.height > 8 && r.left >= lb.left - 0.5 && r.right <= lb.right + 0.5 };
  };
  const overlap = (a, b) => !!a && !!b &&
    !(a.r <= b.l + 0.5 || b.r <= a.l + 0.5 || a.b <= b.t + 0.5 || b.b <= a.t + 0.5);
  const edit = box('.wqa-sum-act'), hist = box('.wqa-row-hist'), del = box('.wqa-row-del');
  const sum = card.querySelector('.wqa-sum');
  return {
    edit, hist, del,
    overlaps: overlap(edit, hist) || overlap(hist, del) || overlap(edit, del),
    fits: sum.scrollWidth <= sum.clientWidth + 1,
    rowHeight: Math.round(card.getBoundingClientRect().height),
    sumHeight: Math.round(sum.getBoundingClientRect().height),
    statusShown: !!card.querySelector('.wqa-row-sub:not([hidden])'),
    statusText: (card.querySelector('.wqa-row-sub') || {}).textContent || '',
    headers: [...document.querySelectorAll('#wqaListHead .wqa-h-dim')].map(n => n.textContent),
    pageWide: document.documentElement.scrollWidth <= window.innerWidth + 1,
  };
};

module.exports = async (browser, A) => {
  const S = A.suite('quick add layout — every product reachable at every width');

  // ── every product, at every width people use ─────────────────────────────
  for (const width of [1500, 1366, 1024, 768, 390]) {
    for (const [type, fx] of Object.entries(FIXTURES)) {
      const page = await openApp(browser, { viewport: { width, height: 1000 } });
      await quickAddPaste(page, fx.msg, { expanded: false, settle: 700 });
      const g = await page.evaluate(GEOMETRY);
      const at = `${type} @${width}`;

      A.ok(g.edit && g.edit.inside, `${at}: Edit is visible inside the list`);
      A.ok(g.hist && g.hist.inside, `${at}: History is visible inside the list`);
      A.ok(g.del && g.del.inside, `${at}: Delete is visible inside the list`);
      A.eq(g.overlaps, 'false', `${at}: the three actions do not overlap each other`);
      A.eq(g.pageWide, 'true', `${at}: the row causes no sideways scrolling of the page`);
      if (width >= 1024) A.eq(g.fits, 'true', `${at}: the summary grid fits its own box, nothing clipped`);

      /* The engineering values themselves are untouched by any of this. */
      const row = (await rowState(page))[0];
      A.eq(row.product, type, `${at}: still read as a ${type}`);
      Object.entries(fx.dims).forEach(([k, v]) =>
        A.eq(row[k], v, `${at}: ${k} is still ${v}`));

      if (width >= 1024) {
        A.eq(g.headers.join(' · '), fx.cols.join(' · '),
          `${at}: its own engineering columns, and only its own`);
      }
      await page.close();
    }
  }

  // ── a clean row is one line; a warning adds a thin one ───────────────────
  {
    const page = await openApp(browser, { viewport: { width: 1366, height: 1000 } });
    /* MS Sag Rod prices itself from the built-in rate, so nothing is flagged. */
    await quickAddPaste(page, FIXTURES.sagrod.msg, { expanded: false, settle: 700 });
    const clean = await page.evaluate(GEOMETRY);
    A.eq(clean.statusShown, 'false', 'a clean row carries no status line');
    A.ok(clean.rowHeight <= 46, `a clean row is one compact line (${clean.rowHeight}px)`);

    /* A J Bolt has no automatic rate, so it asks for one. */
    await quickAddPaste(page, FIXTURES.jbolt.msg, { expanded: false, settle: 700 });
    const warned = await page.evaluate(GEOMETRY);
    A.eq(warned.statusShown, 'true', 'a row that needs something says so on its own line');
    A.ok(warned.sumHeight <= 46,
      `and its data line stays exactly as compact (${warned.sumHeight}px)`);
    A.ok(warned.rowHeight <= 80,
      `with the status line adding one thin strip, not a second row (${warned.rowHeight}px)`);
    A.includes(warned.statusText, 'Needs', 'and the warning is on it');

    /* Answer the warning and the line goes away again. A J Bolt has no
       automatic pricing at all, so what it asks for is a rate AND a surcharge —
       the two figures its own add path insists on. Answering only one of them
       used to clear the warning and then fail at the click. */
    await page.evaluate(() => { wqaEditPrice(0, 'costRate', '5'); });
    await page.waitForTimeout(700);
    A.includes((await page.evaluate(GEOMETRY)).statusText, 'Additional Cost',
      'a rate on its own leaves it asking for the surcharge as well');
    await page.evaluate(() => { wqaEditPrice(0, 'addCost', '1'); });
    await page.waitForTimeout(900);
    const answered = await page.evaluate(GEOMETRY);
    A.eq(answered.statusShown, 'false', 'answering it takes the line away');
    A.ok(answered.rowHeight <= 46, 'and the row is one line again');
    await page.close();
  }

  // ── long values do not push anything out of the row ──────────────────────
  {
    const page = await openApp(browser, { viewport: { width: 1366, height: 1000 } });
    await quickAddPaste(page, ['MS ANCHOR BOLT PL FULLSIZE',
                               '1-1/4" x 1200 x 100/100 - 250pcs'].join('\n'),
                        { expanded: false, settle: 800 });
    await page.evaluate(() => { wqaEditPrice(0, 'costRate', '123.45'); });
    await page.waitForTimeout(800);
    const g = await page.evaluate(GEOMETRY);
    A.ok(g.edit.inside && g.hist.inside && g.del.inside,
      'a long imperial size with a long price leaves all three actions in place');
    A.eq(g.pageWide, 'true', 'and causes no sideways scrolling');
    const shown = await page.evaluate(() => {
      const card = document.querySelector('[data-wqa-row="0"]');
      const cell = card.querySelector('.wqa-c-size');
      return { size: cell.textContent,
               /* Shown whole, not cut off by its column. */
               clipped: cell.scrollWidth > cell.clientWidth + 1,
               summary: wqaRowDimSummary(wqa.rows[0]) };
    });
    /* The review list carries the canonical size — the inch mark is added by
       sizeDisplay where a customer reads it. What matters here is that the
       whole of it is on screen. */
    A.eq(shown.size, '1-1/4', 'the size is shown whole');
    A.eq(shown.clipped, 'false', 'and is not cut off by its column');
    A.includes(shown.summary, 'TL 100/100', 'and a paired thread length reads as it was written');
    await page.close();
  }

  // ── a mixed enquiry shows each row only its own dimensions ───────────────
  {
    const page = await openApp(browser, { viewport: { width: 1366, height: 1000 } });
    await quickAddPaste(page, [
      'MS STUD PL', 'M16 x 300 - 10pcs',
      'MS SAG ROD PL FULLSIZE', 'M16 x 300 x 50/50 - 10pcs',
      'MS J BOLT PL FULLSIZE', 'M20 x H 400 x ID 70 x S 80 x TL 100 - 10pcs',
    ].join('\n'), { expanded: false, settle: 1000 });
    const mixed = await page.evaluate(() => ({
      cols: wqaListCols().map(c => c.k),
      summaries: wqa.rows.map(r => wqaRowDimSummary(r)),
      headers: [...document.querySelectorAll('#wqaListHead .wqa-h-dim')].map(n => n.textContent),
    }));
    A.eq(mixed.cols.join(','), 'spec',
      'a mixed list uses one specification column, not every dimension every product could have');
    A.excludes(mixed.headers.join(' '), 'ID',
      'so a Stud row is never given an empty ID column to answer for');
    A.eq(mixed.summaries[0], 'L 300', 'the Stud shows M · L');
    A.eq(mixed.summaries[1], 'L 300 · TL 50/50', 'the Sag Rod M · L · TL');
    A.eq(mixed.summaries[2], 'H 400 · ID 70 · S 80 · TL 100', 'and the J Bolt its own four');
    /* The one spec column has to hold the longest product's whole
       specification. At its old width a J Bolt's TL vanished behind an
       ellipsis — a dimension disappearing from a quotation review. */
    const specCells = await page.evaluate(() =>
      [...document.querySelectorAll('.wqa-c-spec')].map(n => ({
        text: n.textContent, clipped: n.scrollWidth > n.clientWidth + 1 })));
    specCells.forEach((c, i) => A.eq(c.clipped, 'false',
      `row ${i + 1}'s specification is shown whole: ${JSON.stringify(c.text)}`));
    const g = await page.evaluate(GEOMETRY);
    A.ok(g.edit.inside && g.hist.inside && g.del.inside, 'with the actions in place on a mixed list too');
    await page.close();
  }

  // ── expanded mode keeps the actions and the values ───────────────────────
  {
    const page = await openApp(browser, { viewport: { width: 1366, height: 1000 } });
    await quickAddPaste(page, FIXTURES.jbolt.msg, { expanded: false, settle: 800 });
    const before = (await rowState(page))[0];
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(600);
    const g = await page.evaluate(GEOMETRY);
    A.ok(g.edit.inside && g.hist.inside && g.del.inside, 'Expanded mode keeps all three actions reachable');
    const after = (await rowState(page))[0];
    ['size', 'h', 'id', 's', 'thread', 'qty', 'weight', 'price'].forEach(k =>
      A.eq(String(after[k]), String(before[k]), `switching to Expanded left ${k} untouched`));
    await page.evaluate(() => wqaSetView('compact'));
    await page.waitForTimeout(600);
    const back = (await rowState(page))[0];
    ['size', 'h', 'id', 's', 'thread', 'qty', 'weight', 'price'].forEach(k =>
      A.eq(String(back[k]), String(before[k]), `and switching back left ${k} untouched`));
    await page.close();
  }

  return S;
};
