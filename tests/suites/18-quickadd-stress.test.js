/* ── Twenty items, which is the ordinary case ──────────────────────────────
   Quick Add exists for the ten-to-twenty item enquiry. Every layout decision
   in it is really a decision about what twenty of something look like, so this
   suite quotes twenty at once: five product families, metric beside imperial,
   some priced and some not, some complete and some asking.

   What it holds the screen to is density and restraint — a clean item stays
   one line, a warning adds one thin line and not a second row, opening the
   modal asks the server for nothing, and opening one row's history expands one
   row.

   2026-10-23 (AI review redesign): the other ordinary case — thirty Sag Rods
   of one specification that differ only in length — is now drawn as ONE
   series: a heading that states the shared spec once, then short rows of
   L / Qty / price. Its density is measured at every layout below.          */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* Twenty rows: three Sag Rods that price themselves, an imperial Anchor Bolt
   run, L Bolts and J Bolts that will ask for a rate, and a Stud block. */
const ENQUIRY = [
  'MS SAG ROD PL FULLSIZE',
  'M16 x 300 x 50/50 - 35pcs',
  'M20 x 1000 x 100/100 - 250pcs',
  'M24 x 1200 x 100/100 - 40pcs',
  '',
  'MS ANCHOR BOLT HDG FULLSIZE',
  '1/2 x 300 x 100 - 60pcs',
  '5/8 x 400 x 100 - 30pcs',
  '3/4 x 500 x 150 - 20pcs',
  '1-1/4 x 900 x 200 - 12pcs',
  'M20 x 450 x 150 - 80pcs',
  '',
  '4140 QT L BOLT PL FULLSIZE',
  'M20 x 950 x 400 x 150 - 90pcs',
  'M24 x 1100 x 450 x 150 - 30pcs',
  'M27 x 1250 x 500 x 200 - 15pcs',
  '',
  '4140 QT J BOLT PL FULLSIZE',
  'M20 x H 400 x ID 70 x S 80 x TL 100 - 28pcs',
  'M24 x H 500 x ID 90 x S 100 x TL 150 - 18pcs',
  'M30 x H 1200 x ID 125 x S 180 x TL 200 - 8pcs',
  '',
  'MS STUD PL',
  'M12 x 200 - 100pcs',
  'M16 x 300 - 60pcs',
  'M20 x 400 x - 40pcs',
  'M24 x 500 - 25pcs',
  'M27 x 600 - 10pcs',
  'M30 x 700 - 6pcs',
].join('\n');

/* Thirty Sag Rods of one spec, every length different. */
const SERIES_N = 30;
const SERIES = ['MS SAG ROD PL FULLSIZE']
  .concat(Array.from({ length: SERIES_N }, (_, k) => `M16 x ${300 + k * 50} x 50/50 - ${10 + k}pcs`))
  .join('\n');

/* Per-row height of a series row, measured: 41px desktop (one line), 69px
   tablet (42–44px targets plus the card's padding), 42px mobile. */
const SERIES_ROW_BUDGET = { desktop: 46, tablet: 70, mobile: 46 };

/* The series, measured: its rows, their boxes, and where each price starts. */
const SERIES_SHAPE = () => {
  const shown = n => !!n && getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().width > 0;
  const sers = [...document.querySelectorAll('#wqaRows > .wqa-ser')];
  const ser = sers[0];
  const rows = ser ? [...ser.querySelectorAll('.wqa-ser-rows > .wqa-it')] : [];
  const list = document.getElementById('wqaRows').getBoundingClientRect();
  const over = n => n ? n.scrollWidth - n.clientWidth : 0;
  const head = ser && ser.querySelector('.wqa-ser-head');
  const txt = sel => head ? ((head.querySelector(sel) || {}).textContent || '') : '';
  return {
    sers: sers.length,
    standalone: document.querySelectorAll('#wqaRows > .wqa-it').length,
    n: rows.length,
    title: txt('.wqa-ser-title'), spec: txt('.wqa-ser-spec'), count: txt('.wqa-ser-n'), sharedPx: txt('.wqa-ser-px'),
    headH: head ? Math.round(head.getBoundingClientRect().height) : 0,
    total: ser ? Math.round(ser.getBoundingClientRect().height) : 0,
    heights: rows.map(r => Math.round(r.getBoundingClientRect().height)),
    toks: [...new Set(rows.map(r => [...r.querySelectorAll('.wqa-it-toks .wqa-tok')].map(t => t.dataset.tok).join(',')))],
    withFigures: rows.filter(r => shown(r.querySelector('.wqa-fig-qty .wqa-tok')) && shown(r.querySelector('.wqa-fig-price'))).length,
    ownPx: rows.filter(r => shown(r.querySelector('button.wqa-it-px'))).map(r => +r.dataset.wqaRow),
    priceX: [...new Set(rows.map(r => Math.round(r.querySelector('.wqa-fig-price').getBoundingClientRect().left)))],
    actions: rows.filter(r => ['.wqa-row-hist', '.wqa-row-del'].every(s => {
      const n = r.querySelector(s); if (!shown(n)) return false;
      const b = n.getBoundingClientRect();
      return b.width > 8 && b.left >= list.left - 0.5 && b.right <= list.right + 0.5; })).length,
    anyActions: rows.filter(r => shown(r.querySelector('.wqa-row-hist')) || shown(r.querySelector('.wqa-row-del'))).length,
    spill: rows.filter(r => { const b = r.getBoundingClientRect();
      return [...r.querySelectorAll('*')].filter(shown).some(n => { const x = n.getBoundingClientRect();
        return x.left < b.left - 1 || x.right > b.right + 1 || x.top < b.top - 1 || x.bottom > b.bottom + 1; }); })
      .map(r => +r.dataset.wqaRow),
    over: { page: over(document.documentElement), modal: over(document.querySelector('#wqaModal .wqa-modal')),
            scroller: over(document.querySelector('#wqaStep2 .wqa-scroll')), rows: over(document.getElementById('wqaRows')) },
  };
};

module.exports = async (browser, A) => {
  const S = A.suite('quick add — twenty items, which is the ordinary case');

  const asked = [];
  const page = await openApp(browser, {
    viewport: { width: 1366, height: 1000 },
    api: {
      get_pricing_history: url => {
        const p = new URL(url).searchParams;
        asked.push(String(p.get('cleanSize') || '') + '/' + String(p.get('productType') || ''));
        return { ok: true, data: { records: [], total: 0, ownTotal: 0, otherTotal: 0,
                                   offset: 0, limit: 20 } };
      },
    },
  });
  await page.evaluate(() => { selectedCompanyId = 7; });
  await quickAddPaste(page, ENQUIRY, { expanded: false, settle: 2000 });

  const rows = await rowState(page);
  A.ok(rows.length >= 20, `a twenty-item enquiry produces its items (${rows.length})`);

  /* Nothing was lost on the way in. */
  const byProduct = {};
  rows.forEach(r => { byProduct[r.product] = (byProduct[r.product] || 0) + 1; });
  ['sagrod', 'anchorbolt', 'lbolt', 'jbolt', 'stud'].forEach(t =>
    A.ok(byProduct[t] > 0, `the ${t} block is there (${byProduct[t] || 0} rows)`));
  A.ok(rows.every(r => r.size), 'every row kept a size');
  const jb = rows.filter(r => r.product === 'jbolt');
  A.eq(jb.map(r => `${r.size} H${r.h} ID${r.id} S${r.s} TL${r.thread}`).join(' | '),
    'M20 H400 ID70 S80 TL100 | M24 H500 ID90 S100 TL150 | M30 H1200 ID125 S180 TL200',
    'and every J Bolt kept all four of its own dimensions');
  const imperial = rows.filter(r => /\//.test(r.size));
  A.ok(imperial.length >= 4, 'the imperial run survived beside the metric one');
  A.ok(imperial.some(r => r.size === '1-1/4'), 'including the long one');

  // ── the screen asked the server for nothing ──────────────────────────────
  A.eq(asked.length, 0, 'opening a twenty-item enquiry looks up no history at all');

  // ── density ──────────────────────────────────────────────────────────────
  const shape = await page.evaluate(() => {
    const shown = n => !!n && getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().width > 0;
    const cards = [...document.querySelectorAll('#wqaRows .wqa-it')];
    const heights = cards.map(c => Math.round(c.getBoundingClientRect().height));
    const mains = cards.map(c => Math.round(c.querySelector('.wqa-it-main').getBoundingClientRect().height));
    const subs = cards.map(c => { const n = c.querySelector('.wqa-it-sub:not([hidden])');
                                  return n ? Math.round(n.getBoundingClientRect().height) : 0; });
    const named = cards.filter(c => ((c.querySelector('.wqa-it-prod') || {}).textContent || '').trim()).length;
    const list = document.getElementById('wqaRows').getBoundingClientRect();
    const actionsOk = cards.every(c => ['.wqa-row-hist', '.wqa-row-del', '.wqa-rv-more'].every(s => {
      const n = c.querySelector(s); if (!shown(n)) return false;
      const r = n.getBoundingClientRect();
      return r.width > 8 && r.left >= list.left - 0.5 && r.right <= list.right + 0.5; }));
    const valuesOk = cards.every(c => shown(c.querySelector('.wqa-it-toks .wqa-tok'))
      && shown(c.querySelector('.wqa-fig-price')) && shown(c.querySelector('.wqa-fig-qty .wqa-tok')));
    const spill = cards.filter(c => { const b = c.getBoundingClientRect();
      return [...c.querySelectorAll('*')].filter(shown).some(n => { const x = n.getBoundingClientRect();
        return x.left < b.left - 1 || x.right > b.right + 1 || x.top < b.top - 1 || x.bottom > b.bottom + 1; }); })
      .map(c => +c.dataset.wqaRow + 1);
    return { n: cards.length, heights, mains, subs, named, actionsOk, valuesOk, spill,
             total: Math.round(list.height),
             pageWide: document.documentElement.scrollWidth <= window.innerWidth + 1 };
  });

  A.eq(shape.n, rows.length, 'every item is drawn as a row');
  A.eq(shape.actionsOk, 'true', 'every one of the twenty rows offers History, remove and More, in the list');
  A.eq(shape.valuesOk, 'true', 'and shows its values, quantity and price');
  A.eq(shape.spill.join(','), '', 'no row has anything drawn outside its own box');
  A.eq(shape.pageWide, 'true', 'and twenty rows cause no sideways scrolling');
  /* Retired 2026-10-23 (AI review redesign): the identity/status strip on every
     row — a mixed list now names the product in the row's own title line, and
     the strip below appears only when there is something to say. */
  A.eq(shape.named, shape.n, 'a mixed enquiry names the product of every row');
  /* An item is a title over one value line, with pricing and actions beside
     it (67px measured), plus one thin warning strip when it asks for
     something (29px). Each part is measured separately so a row that grows
     anything else still fails. Retired 2026-10-23 (AI review redesign): the
     separate pricing-summary line (<=40px) — it now sits on the item line. */
  A.ok(Math.max(...shape.mains) <= 70,
    `no item is taller than a title over one value line (tallest ${Math.max(...shape.mains)}px)`);
  A.ok(Math.max(...shape.subs) <= 30,
    `a warning is one thin strip (tallest ${Math.max(...shape.subs)}px)`);
  A.ok(Math.max(...shape.heights) <= 100,
    `so no item is two full rows tall (tallest ${Math.max(...shape.heights)}px)`);
  A.ok(shape.total <= shape.n * 108,
    `twenty rows stay compact overall: ${shape.total}px for ${shape.n} rows`);
  /* And the controls really are the size they are meant to be. On desktop a
     mouse aims at them; a touch screen gets the tablet layout (40px+, held in
     17-quickadd-layout), so the desktop floor is the design's 30px. */
  const targets = await page.evaluate(() =>
    [...document.querySelectorAll('[data-wqa-row="0"] .wqa-it-acts .wqa-rv-act')]
      .map(n => Math.round(n.getBoundingClientRect().height)));
  A.eq(targets.length, 3, 'the row has its three controls');
  A.ok(targets.every(h => h >= 32 && h <= 40),
    `each between 30 and 40px tall (${targets.join('/')})`);

  // ── one row's history is one row's ───────────────────────────────────────
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#wqaRows .wqa-it')];
    cards[6].querySelector('.wqa-row-hist').click();
  });
  await page.waitForTimeout(800);
  A.eq(asked.length, 1, 'clicking History on row 7 asks once');
  const opened = await page.evaluate(() => ({
    panels: [...document.querySelectorAll('#wqaRows .wqa-it')].map(c => !!c.querySelector('.wqa-hist')),
    open: wqa.rows.filter(r => r.histOpen).length,
  }));
  A.eq(opened.panels.filter(Boolean).length, 1, 'and expands exactly one row');
  A.eq(opened.panels[6], 'true', 'the one that was asked');
  A.eq(opened.open, '1', 'with one row holding the open state');

  /* A second row of the SAME specification would reuse the answer; a different
     one asks for itself. */
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#wqaRows .wqa-it')];
    cards[0].querySelector('.wqa-row-hist').click();
  });
  await page.waitForTimeout(800);
  A.eq(asked.length, 2, 'a different specification asks for itself');
  A.eq(await page.evaluate(() => wqa.rows.filter(r => r.histOpen).length), '2',
    'and both rows stay open independently');

  // ── nothing about the items changed by looking ───────────────────────────
  const after = await rowState(page);
  A.eq(after.length, rows.length, 'no row was lost');
  A.eq(after.map(r => r.size + ':' + r.length + ':' + r.thread + ':' + r.qty).join('|'),
       rows.map(r => r.size + ':' + r.length + ':' + r.thread + ':' + r.qty).join('|'),
       'and not one dimension or quantity moved');
  A.eq(after.map(r => String(r.price)).join('|'), rows.map(r => String(r.price)).join('|'),
       'nor one price');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();

  // ── thirty of one specification: one series, short rows ──────────────────
  const LAYOUTS = [
    { name: 'desktop @1366', mode: 'desktop', viewport: { width: 1366, height: 1000 } },
    { name: 'tablet @768', mode: 'tablet', viewport: { width: 768, height: 1000 } },
    /* A touch screen at desktop width is a tablet, not a narrow desktop. */
    { name: 'touch @1366', mode: 'tablet', viewport: { width: 1366, height: 1000 }, touch: true },
    { name: 'mobile @390', mode: 'mobile', viewport: { width: 390, height: 844 } },
  ];
  for (const L of LAYOUTS) {
    const ctx = await browser.newContext({ viewport: L.viewport, hasTouch: !!L.touch });
    const sp = await openApp(browser, { context: ctx });
    await quickAddPaste(sp, SERIES, { expanded: false, settle: 1500 });
    const at = L.name;
    if (L.touch) A.eq(await sp.evaluate(() => matchMedia('(pointer:coarse)').matches), 'true',
      `${at}: the browser reports a coarse pointer`);
    const st = await rowState(sp);
    A.eq(st.length, SERIES_N, `${at}: thirty lines produce thirty items`);
    A.eq(st.map(r => r.length).join(','), Array.from({ length: SERIES_N }, (_, k) => String(300 + k * 50)).join(','),
      `${at}: every length kept, in order`);
    const s = await sp.evaluate(SERIES_SHAPE);
    A.eq(s.sers, 1, `${at}: they are drawn as one series`);
    A.eq(s.standalone, 0, `${at}: with no item left standing outside it`);
    A.eq(s.n, SERIES_N, `${at}: holding all thirty rows`);
    A.eq(s.title, 'Sag Rod', `${at}: the heading names the product once`);
    A.includes(s.spec, 'M16', `${at}: states the shared size once`);
    A.includes(s.spec, 'TL 50/50', `${at}: and the shared TL once`);
    A.includes(s.count, String(SERIES_N), `${at}: and how many rows it holds`);
    A.ok(s.sharedPx.trim().length > 0, `${at}: the shared pricing is stated in the heading`);
    A.eq(s.toks.join(' / '), 'length', `${at}: each row carries only its own L, not the size or TL again`);
    A.eq(s.withFigures, SERIES_N, `${at}: every row shows its Qty and price`);
    A.eq(s.ownPx.join(','), '', `${at}: no row repeats the pricing its heading already states`);
    A.eq(s.spill.join(','), '', `${at}: nothing of any row is drawn outside it`);
    A.ok(s.over.page <= 1 && s.over.modal <= 1 && s.over.scroller <= 1 && s.over.rows <= 1,
      `${at}: no sideways scroll — page/modal/scroller/list ${JSON.stringify(s.over)}`);
    const budget = SERIES_ROW_BUDGET[L.mode];
    A.ok(Math.max(...s.heights) <= budget,
      `${at}: every series row is short (tallest ${Math.max(...s.heights)}px <= ${budget})`);
    A.ok(s.total <= s.headH + SERIES_N * budget + 2,
      `${at}: thirty rows stay compact overall: ${s.total}px (heading ${s.headH}px)`);
    if (L.mode !== 'mobile') {
      A.eq(s.actions, SERIES_N, `${at}: every series row keeps History and remove, inside the list`);
      /* The rows read as a column: each price starts where the one above did. */
      A.ok(Math.max(...s.priceX) - Math.min(...s.priceX) <= 1,
        `${at}: every price in the series starts at the same x (${s.priceX.join(',')})`);
    } else {
      A.eq(s.anyActions, 0, `${at}: the compact rows carry no per-row buttons — the row is the target`);
    }
    if (L.mode === 'desktop') {
      /* A row whose pricing differs from its heading says so on its own line.
         Edited the way a person does: its price opens the pricing strip. */
      await sp.click('[data-wqa-row="5"] .wqa-fig-price');
      await sp.waitForTimeout(400);
      await sp.fill('[data-wqa-row="5"] [data-px="costRate"]', '9.99');
      await sp.waitForTimeout(700);
      await sp.click('[data-wqa-row="5"] .wqa-px-foot .btn');
      await sp.waitForTimeout(700);
      const s2 = await sp.evaluate(SERIES_SHAPE);
      A.eq(s2.ownPx.join(','), '5', `${at}: the one row priced differently shows its own pricing`);
      A.eq(s2.sers, 1, `${at}: and stays in its series`);
      A.ok(Math.max(...s2.heights) <= budget, `${at}: still within the row budget (${Math.max(...s2.heights)}px)`);
      A.eq(s2.spill.join(','), '', `${at}: with nothing drawn outside it`);
    }
    A.ok(sp._dcErrors.length === 0, `${at}: no page errors: ` + sp._dcErrors.join(' | '));
    await ctx.close();
  }
  return S;
};
