/* ── Twenty items, which is the ordinary case ──────────────────────────────
   Quick Add exists for the ten-to-twenty item enquiry. Every layout decision
   in it is really a decision about what twenty of something look like, so this
   suite quotes twenty at once: five product families, metric beside imperial,
   some priced and some not, some complete and some asking.

   What it holds the screen to is density and restraint — a clean item stays
   one line, a warning adds one thin line and not a second row, opening the
   modal asks the server for nothing, and opening one row's history expands one
   row.                                                                      */
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
    const cards = [...document.querySelectorAll('.wqa-row')];
    const heights = cards.map(c => Math.round(c.getBoundingClientRect().height));
    const sums = cards.map(c => Math.round(c.querySelector('.wqa-sum').getBoundingClientRect().height));
    const status = cards.filter(c => c.querySelector('.wqa-row-sub:not([hidden])')).length;
    const subs = cards.map(c => { const n = c.querySelector('.wqa-row-sub:not([hidden])');
                                  return n ? Math.round(n.getBoundingClientRect().height) : 0; });
    const list = document.querySelector('.wqa-rows').getBoundingClientRect();
    const actionsOk = cards.every(c => {
      const lb = list, sel = ['.wqa-row-edit', '.wqa-row-hist', '.wqa-row-del'];
      return sel.every(s => { const n = c.querySelector(s); if (!n) return false;
        const r = n.getBoundingClientRect();
        return r.width > 8 && r.left >= lb.left - 0.5 && r.right <= lb.right + 0.5; });
    });
    return { n: cards.length, heights, sums, status, subs, actionsOk,
             total: Math.round(list.height),
             pageWide: document.documentElement.scrollWidth <= window.innerWidth + 1 };
  });

  A.eq(shape.actionsOk, 'true', 'every one of the twenty rows offers Edit, History and Delete, in the list');
  A.eq(shape.pageWide, 'true', 'and twenty rows cause no sideways scrolling');
  A.ok(Math.max(...shape.sums) <= 46,
    `no item's data line is taller than one compact row (tallest ${Math.max(...shape.sums)}px)`);
  /* A mixed enquiry has to say what each row IS — five product families in one
     list — so every row carries the identity strip. It is ONE strip: the
     product/material and any warning share it. */
  A.eq(shape.status, shape.n, 'a mixed enquiry names the product of every row');
  A.ok(Math.max(...shape.subs) <= 26,
    `on one thin strip apiece (tallest ${Math.max(...shape.subs)}px)`);
  /* One data line, one thin strip, and the row's controls — which are now
     32px, because a control a finger cannot land on is not a control. That is
     what took the ceiling from 68 to 72; the shape it protects is unchanged
     and every other measurement above is unmoved. A card would be over 100. */
  A.ok(Math.max(...shape.heights) <= 72,
    `so no item is two full rows tall (tallest ${Math.max(...shape.heights)}px)`);
  A.ok(shape.total <= shape.n * 72,
    `twenty rows stay compact overall: ${shape.total}px for ${shape.n} rows`);
  /* And the controls really are the size they are meant to be. */
  const targets = await page.evaluate(() =>
    [...document.querySelectorAll('[data-wqa-row="0"] .wqa-row-act')]
      .map(n => Math.round(n.getBoundingClientRect().height)));
  A.eq(targets.length, 3, 'the row has its three controls');
  A.ok(targets.every(h => h >= 32 && h <= 40),
    `each between 32 and 40px tall (${targets.join('/')})`);

  // ── one row's history is one row's ───────────────────────────────────────
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.wqa-row')];
    cards[6].querySelector('.wqa-row-hist').click();
  });
  await page.waitForTimeout(800);
  A.eq(asked.length, 1, 'clicking History on row 7 asks once');
  const opened = await page.evaluate(() => ({
    panels: [...document.querySelectorAll('.wqa-row')].map(c => !!c.querySelector('.wqa-hist')),
    open: wqa.rows.filter(r => r.histOpen).length,
  }));
  A.eq(opened.panels.filter(Boolean).length, 1, 'and expands exactly one row');
  A.eq(opened.panels[6], 'true', 'the one that was asked');
  A.eq(opened.open, '1', 'with one row holding the open state');

  /* A second row of the SAME specification would reuse the answer; a different
     one asks for itself. */
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.wqa-row')];
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
  return S;
};
