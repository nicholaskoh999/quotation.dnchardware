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
   wide behind another one is exactly the bug this suite exists to catch.

   2026-10-23 (AI review redesign): the row is now `.wqa-it` — value tokens,
   qty/price figures, a pricing summary and History / ✕ / More — laid out
   three ways: desktop (>=1024, one dense line), tablet (600–1023 or a coarse
   pointer: wide cards, 40px+ targets) and mobile (<600: the row itself is the
   control, a tap opens its panel). The geometry rule is the same for all of
   them; what counts as "the row's controls" depends on the layout.          */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* One clean fixture per product, plus the two from the production report.
   `toks` is the row's own value tokens, in drawing order. */
const FIXTURES = {
  stud:       { msg: 'MS STUD PL\nM16 x 300 - 35pcs',
                toks: ['size', 'length'], dims: { length: '300' } },
  sagrod:     { msg: 'MS SAG ROD PL FULLSIZE\nM16 x 300 x 50/50 - 35pcs',
                toks: ['size', 'length', 'threadLen'], dims: { length: '300', thread: '50/50' } },
  anchorbolt: { msg: 'MS ANCHOR BOLT PL FULLSIZE\nM16 x 300 x 100 - 35pcs',
                toks: ['size', 'length', 'threadLen'], dims: { length: '300', thread: '100' } },
  lbolt:      { msg: 'MS L BOLT PL FULLSIZE\nM20 x 950 x 400 x 150 - 90pcs',
                toks: ['size', 'length', 'w', 'threadLen'], dims: { length: '950', w: '400', thread: '150' } },
  jbolt:      { msg: 'MS J BOLT PL FULLSIZE\nM20 x H 400 x ID 70 x S 80 x TL 100 - 28pcs',
                toks: ['size', 'h', 'id', 's', 'threadLen'], dims: { h: '400', id: '70', s: '80', thread: '100' } },
};

const layoutOf = width => width >= 1024 ? 'desktop' : width >= 600 ? 'tablet' : 'mobile';

/* The item's main block, measured. Budgets are what the design draws plus a
   few px: desktop = a title line over one value line (63px measured); tablet
   = title + 42px tokens, 44px figures, 40px pricing button, stacked (188px);
   mobile = title, values, figures (88px). */
/* 2026-10-27 (owner-smoke follow-up): mobile is the owner's stacked
   hierarchy — product, material · finish · size type, values (· Ø), figures
   with weight, and the pricing line (~134px measured; a J Bolt's five
   dimensions plus Ø wrap to a second line at 390px, ~149px). */
const MAIN_BUDGET = { desktop: 66, tablet: 192, mobile: 152 };

/* Where each control actually is, and whether it is usable: a real box,
   inside the list and its own row, not overlapping any other control. */
const GEOMETRY = () => {
  const card = document.querySelector('[data-wqa-row="0"]');
  const list = document.getElementById('wqaRows');
  if (!card || !list) return { err: 'no row' };
  const lb = list.getBoundingClientRect(), cb = card.getBoundingClientRect();
  const shown = n => !!n && getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().width > 0;
  const boxOf = n => {
    const r = n.getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: Math.round(r.width), h: Math.round(r.height),
             cls: String(n.className).split(' ').slice(0, 2).join('.'),
             inside: r.width > 8 && r.height > 8 && r.left >= lb.left - 0.5 && r.right <= lb.right + 0.5
                  && r.left >= cb.left - 0.5 && r.right <= cb.right + 0.5 };
  };
  const box = sel => { const n = card.querySelector(sel); return shown(n) ? boxOf(n) : null; };
  const overlap = (a, b) => !(a.r <= b.l + 0.5 || b.r <= a.l + 0.5 || a.b <= b.t + 0.5 || b.b <= a.t + 0.5);
  /* Every control drawn on the row's own line — tokens, figures, actions. */
  const ctrls = [...card.querySelectorAll('.wqa-it-main button, .wqa-it-main input')].filter(shown).map(boxOf);
  const clash = [];
  ctrls.forEach((a, i) => ctrls.slice(i + 1).forEach(b => { if (overlap(a, b)) clash.push(a.cls + '×' + b.cls); }));
  /* Anything of the row drawn outside the row's own box. */
  const spill = [...card.querySelectorAll('*')].filter(shown).filter(n => {
    const r = n.getBoundingClientRect();
    return r.left < cb.left - 1 || r.right > cb.right + 1;
  }).map(n => String(n.className).slice(0, 30));
  const toks = [...card.querySelectorAll('.wqa-it-toks .wqa-tok')];
  const main = card.querySelector('.wqa-it-main');
  const sub = card.querySelector('.wqa-it-sub');
  return {
    hist: box('.wqa-row-hist'), del: box('.wqa-row-del'), more: box('.wqa-rv-more'),
    price: box('.wqa-fig-price'), px: box('button.wqa-it-px'), dia: box('.wqa-rv-dia'),
    clash, spill: spill.slice(0, 4),
    toks: toks.map(t => t.dataset.tok),
    toksInside: toks.every(t => shown(t) && boxOf(t).inside),
    toksClipped: toks.filter(t => t.scrollWidth > t.clientWidth + 1).map(t => t.dataset.tok),
    toksLive: toks.every(t => getComputedStyle(t).pointerEvents !== 'none'),
    tokLines: new Set(toks.map(t => Math.round(t.getBoundingClientRect().top))).size,
    /* On tablet, every value and action is meant to be a 40px+ target. */
    small: ctrls.filter(c => Math.min(c.w, c.h) < 40).map(c => `${c.cls} ${c.w}x${c.h}`),
    fits: card.scrollWidth <= card.clientWidth + 1 && main.scrollWidth <= main.clientWidth + 1,
    rowHeight: Math.round(cb.height),
    mainHeight: Math.round(main.getBoundingClientRect().height),
    subHeight: sub && !sub.hidden ? Math.round(sub.getBoundingClientRect().height) : 0,
    statusShown: !!sub && !sub.hidden,
    statusText: sub ? sub.textContent : '',
    title: (card.querySelector('.wqa-it-prod') || {}).textContent || '',
    picks: document.querySelectorAll('#wqaRows .wqa-pick').length,
    pageWide: document.documentElement.scrollWidth <= window.innerWidth + 1,
  };
};

/* The row's own panel, opened: its History and Remove, measured. */
const PANEL = () => {
  const card = document.querySelector('[data-wqa-row="0"]');
  const list = document.getElementById('wqaRows').getBoundingClientRect();
  const W = document.documentElement.clientWidth;
  const at = sel => { const n = card.querySelector(sel); if (!n) return null;
    const r = n.getBoundingClientRect();
    return r.width > 8 && r.height > 8 && r.left >= list.left - 0.5 && r.right <= Math.min(list.right, W) + 0.5; };
  return { open: !!card.querySelector('.wqa-rv-detail'),
           hist: at('.wqa-rv-detail .wqa-dt-histbar'), del: at('.wqa-rv-detail .wqa-dt-del'),
           pageWide: document.documentElement.scrollWidth <= window.innerWidth + 1 };
};

const VALUES = ['size', 'length', 'w', 'h', 'id', 's', 'thread', 'qty', 'weight', 'price'];

module.exports = async (browser, A) => {
  const S = A.suite('quick add layout — every product reachable at every width');

  // ── every product, at every width people use ─────────────────────────────
  for (const width of [1500, 1366, 1024, 768, 390]) {
    const mode = layoutOf(width);
    for (const [type, fx] of Object.entries(FIXTURES)) {
      const page = await openApp(browser, { viewport: { width, height: 1000 } });
      await quickAddPaste(page, fx.msg, { expanded: false, settle: 700 });
      const g = await page.evaluate(GEOMETRY);
      const at = `${type} @${width} (${mode})`;

      if (mode !== 'mobile') {
        A.ok(g.hist && g.hist.inside, `${at}: History is visible inside the row`);
        A.ok(g.del && g.del.inside, `${at}: remove is visible inside the row`);
        A.ok(g.more && g.more.inside, `${at}: More (the row's panel) is visible inside the row`);
        A.ok(g.price && g.price.inside, `${at}: the price is visible inside the row`);
        A.ok(g.px && g.px.inside, `${at}: the pricing summary is visible inside the row`);
      } else {
        /* The row is the control: no per-row buttons beside the values. The
           pricing line is shown (owner hierarchy, line 5) but is read-only —
           a tap still opens the row's panel. */
        A.ok(!g.hist && !g.del && !g.more,
          `${at}: no History / remove / More buttons on the compact card`);
        A.eq(await page.evaluate(() => { const n = document.querySelector('[data-wqa-row="0"] .wqa-it-px');
          return !!n && getComputedStyle(n).pointerEvents === 'none'; }), 'true',
          `${at}: the pricing line is shown read-only`);
        A.eq(g.toksLive, 'false', `${at}: values are not separate targets — the row is`);
      }
      A.ok(g.toksInside, `${at}: every value is visible inside the row`);
      A.eq(g.toksClipped.join(','), '', `${at}: no value is cut off`);
      A.eq(g.clash.join(', '), '', `${at}: no control overlaps another`);
      A.eq(g.spill.join(', '), '', `${at}: nothing of the row is drawn outside it`);
      A.eq(g.fits, 'true', `${at}: the row fits its own box, nothing clipped`);
      A.eq(g.pageWide, 'true', `${at}: the row causes no sideways scrolling of the page`);
      A.eq(g.picks, 0, `${at}: no tick box outside Selection mode`);
      if (mode === 'tablet') {
        A.eq(g.small.join(', '), '', `${at}: every value and action is a 40px+ target`);
      }
      A.ok(g.mainHeight <= MAIN_BUDGET[mode],
        `${at}: the item stays within its ${mode} budget (${g.mainHeight}px <= ${MAIN_BUDGET[mode]})`);
      if (mode === 'desktop') {
        A.eq(g.tokLines, 1, `${at}: its values read on one line`);
      }

      /* The engineering values themselves are untouched by any of this. */
      const row = (await rowState(page))[0];
      A.eq(row.product, type, `${at}: still read as a ${type}`);
      Object.entries(fx.dims).forEach(([k, v]) =>
        A.eq(row[k], v, `${at}: ${k} is still ${v}`));

      /* Retired 2026-10-23 (AI review redesign): `#wqaListHead` column headers —
         the review has no header row; each row's tokens carry their own labels. */
      A.eq(g.toks.join(' · '), fx.toks.join(' · '),
        `${at}: its own engineering values, and only its own`);

      if (mode === 'mobile') {
        /* A tap on the row opens its panel, which holds what the card leaves out. */
        await page.click('[data-wqa-row="0"] .wqa-it-main');
        await page.waitForTimeout(400);
        const p = await page.evaluate(PANEL);
        A.eq(p.open, 'true', `${at}: tapping the row opens its panel`);
        A.eq(p.hist, 'true', `${at}: the panel's History is reachable`);
        A.eq(p.del, 'true', `${at}: the panel's Remove is reachable`);
        A.eq(p.pageWide, 'true', `${at}: and the open panel causes no sideways scrolling`);
        const after = (await rowState(page))[0];
        A.eq(VALUES.map(k => String(after[k])).join('|'), VALUES.map(k => String(row[k])).join('|'),
          `${at}: opening the panel left every value untouched`);
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
    /* What these budgets protect: the item stays a title over ONE value line,
       with the pricing summary beside it rather than under it, and a warning
       adds one thin strip, not a second row. Measured: 63px item, 29px strip.
       Retired 2026-10-23 (AI review redesign): the separate `.wqa-meta`
       pricing-summary line (<=40px) — the summary is now `.wqa-it-px` on the
       item's own line, so it costs no height and is covered by the item budget. */
    A.ok(clean.mainHeight <= 66, `a clean item is a title over one value line (${clean.mainHeight}px)`);
    A.ok(clean.rowHeight <= 68, `so a clean row is that and nothing else (${clean.rowHeight}px)`);

    /* A J Bolt has no automatic rate, so it asks for one. */
    await quickAddPaste(page, FIXTURES.jbolt.msg, { expanded: false, settle: 700 });
    const warned = await page.evaluate(GEOMETRY);
    A.eq(warned.statusShown, 'true', 'a row that needs something says so on its own line');
    A.ok(warned.mainHeight <= 66,
      `and its item stays exactly as compact (${warned.mainHeight}px)`);
    A.ok(warned.subHeight <= 30, `its status line is one thin strip (${warned.subHeight}px)`);
    A.ok(warned.rowHeight <= 98,
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
    A.ok(answered.mainHeight <= 66, 'and the item is one value line again');
    A.ok(answered.rowHeight <= 68,
      `leaving the row at its clean height (${answered.rowHeight}px)`);
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
    A.ok(g.hist && g.hist.inside && g.del && g.del.inside && g.more && g.more.inside,
      'a long imperial size with a long price leaves every action in place');
    A.eq(g.clash.join(', '), '', 'nothing overlaps');
    A.eq(g.spill.join(', '), '', 'nothing is drawn outside the row');
    A.eq(g.pageWide, 'true', 'and causes no sideways scrolling');
    const shown = await page.evaluate(() => {
      const card = document.querySelector('[data-wqa-row="0"]');
      const cell = card.querySelector('.wqa-c-size');
      const fin = card.querySelector('.wqa-fin'), px = card.querySelector('button.wqa-it-px');
      return { size: cell.textContent,
               /* Shown whole, not cut off. */
               clipped: cell.scrollWidth > cell.clientWidth + 1,
               priceClipped: fin.scrollWidth > fin.clientWidth + 1,
               pxClipped: !!px && px.scrollWidth > px.clientWidth + 1,
               summary: wqaRowDimSummary(wqa.rows[0]) };
    });
    /* The review list shows the size with its inch mark, as the rest of QUO
       does (the row itself still holds the canonical 1-1/4). What matters here
       is that the whole of it is on screen. */
    A.eq(shown.size, '1-1/4"', 'the size is shown whole, with its inch mark');
    A.eq(shown.clipped, 'false', 'and is not cut off');
    A.eq(shown.priceClipped, 'false', 'the long price is not cut off');
    A.eq(shown.pxClipped, 'false', 'nor is the pricing summary that carries it');
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
      summaries: wqa.rows.map(r => wqaRowDimSummary(r)),
      rows: [...document.querySelectorAll('#wqaRows .wqa-it')].map(c => ({
        prod: (c.querySelector('.wqa-it-prod') || {}).textContent || '',
        toks: [...c.querySelectorAll('.wqa-it-toks .wqa-tok')].map(t => t.dataset.tok).join(','),
        text: (c.querySelector('.wqa-it-toks') || {}).textContent || '',
        clipped: [...c.querySelectorAll('.wqa-it-toks .wqa-tok')].some(t => t.scrollWidth > t.clientWidth + 1),
        lines: new Set([...c.querySelectorAll('.wqa-it-toks .wqa-tok')].map(t => Math.round(t.getBoundingClientRect().top))).size,
      })),
    }));
    /* Retired 2026-10-23 (AI review redesign): `wqaListCols()` = 'spec' and the
       "no empty ID header" check — there is no shared column header to answer
       for; each row draws its own tokens, asserted below. */
    A.eq(mixed.rows.map(r => r.prod).join(' | '), 'Stud | Sag Rod | J Bolt',
      'a mixed list names the product on every row');
    A.eq(mixed.rows[0].toks, 'size,length', 'the Stud row carries M · L and nothing else');
    A.eq(mixed.rows[1].toks, 'size,length,threadLen', 'the Sag Rod row M · L · TL');
    A.eq(mixed.rows[2].toks, 'size,h,id,s,threadLen', 'and the J Bolt row its own four');
    A.eq(mixed.summaries[0], 'L 300', 'the Stud shows M · L');
    A.eq(mixed.summaries[1], 'L 300 · TL 50/50', 'the Sag Rod M · L · TL');
    A.eq(mixed.summaries[2], 'H 400 · ID 70 · S 80 · TL 100', 'and the J Bolt its own four');
    /* A J Bolt's TL once vanished behind an ellipsis — a dimension
       disappearing from a quotation review. Every value is shown whole. */
    mixed.rows.forEach((c, i) => {
      A.eq(c.clipped, 'false', `row ${i + 1}'s specification is shown whole: ${JSON.stringify(c.text)}`);
      A.eq(c.lines, 1, `row ${i + 1}'s specification reads on one line`);
    });
    const g = await page.evaluate(GEOMETRY);
    A.ok(g.hist.inside && g.del.inside && g.more.inside, 'with the actions in place on a mixed list too');
    await page.close();
  }

  // ── opening a row's panel keeps the actions and the values ───────────────
  {
    const page = await openApp(browser, { viewport: { width: 1366, height: 1000 } });
    await quickAddPaste(page, FIXTURES.jbolt.msg, { expanded: false, settle: 800 });
    const before = (await rowState(page))[0];
    /* Retired 2026-10-23 (AI review redesign): the Compact / Expanded view
       switch and the per-row Details button — the review has one view; a row
       opens its own panel from More (or a tap on the row). */
    await page.click('[data-wqa-row="0"] .wqa-rv-more');
    await page.waitForTimeout(600);
    const p = await page.evaluate(PANEL);
    const g = await page.evaluate(GEOMETRY);
    A.eq(p.open, 'true', 'More opens the row\'s panel');
    A.ok(p.hist && p.del, 'the panel keeps History and Remove reachable');
    A.ok(g.hist.inside && g.del.inside && g.more.inside, 'and the row line keeps its own actions');
    A.eq(g.spill.join(', '), '', 'with nothing of the open row drawn outside it');
    const after = (await rowState(page))[0];
    ['size', 'h', 'id', 's', 'thread', 'qty', 'weight', 'price'].forEach(k =>
      A.eq(String(after[k]), String(before[k]), `opening the panel left ${k} untouched`));
    await page.click('[data-wqa-row="0"] .wqa-rv-more');
    await page.waitForTimeout(600);
    A.eq((await page.evaluate(PANEL)).open, 'false', 'and More closes it again');
    const back = (await rowState(page))[0];
    ['size', 'h', 'id', 's', 'thread', 'qty', 'weight', 'price'].forEach(k =>
      A.eq(String(back[k]), String(before[k]), `and closing it left ${k} untouched`));
    await page.close();
  }

  return S;
};
