/* ── The widths the brief names, and what must survive them ─────────────────
   This application targets the desk, and smaller widths are allowed to stack
   rather than become a phone layout. Four things are not allowed to happen at
   any width, because each of them loses an action rather than moving it:

     · the PAGE scrolls sideways. A column wider than the window pushes the
       right-hand side of every row out of reach, and nothing says so.
     · a modal cannot be scrolled to its own footer, so the button that
       commits the work is below the fold with no way down.
     · a footer action is off-screen.
     · a control overlaps another one, so the top one takes the click.

   2026-10-23 (AI review redesign): the Quick Add review is now three
   intentional layouts — desktop, tablet (600–1023px or any touch screen) and
   a full-screen mobile sheet (<600px) — so the widths below include the
   tablet/mobile edges and a touch screen at desktop width. The review is no
   longer a wide table, so nothing in it scrolls sideways, not even inside its
   own box: page, modal, scroller and list are all checked.                  */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');

const WIDTHS = [1920, 1600, 1366, 1280, 1024, 760, 640, 600, 599, 390]
  .map(width => ({ width, label: `${width}px` }))
  /* A touch screen at desktop width gets the tablet layout. */
  .concat([{ width: 1280, touch: true, label: '1280px touch' }]);

const layoutOf = w => (w.touch && w.width >= 600) ? 'tablet'
  : w.width >= 1024 ? 'desktop' : w.width >= 600 ? 'tablet' : 'mobile';

/* Does the document itself scroll sideways? Two pixels of slack, because a
   sub-pixel border rounding up is not a layout fault. */
const pageOverflow = page => page.evaluate(() => {
  const d = document.documentElement;
  return { doc: d.scrollWidth - d.clientWidth, body: document.body.scrollWidth - d.clientWidth };
});

/* Every element that sticks out past the right edge of the window, ignoring
   anything inside a box that is deliberately scrollable. */
const stickingOut = page => page.evaluate(() => {
  const W = document.documentElement.clientWidth;
  const out = [];
  document.querySelectorAll('body *').forEach(n => {
    const st = getComputedStyle(n);
    if (st.display === 'none' || st.visibility === 'hidden' || n.hidden) return;
    if (st.position === 'fixed') return;
    for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'auto' || ps.overflowX === 'scroll' || ps.overflowX === 'hidden') return;
    }
    const r = n.getBoundingClientRect();
    if (r.width && r.right > W + 2) {
      out.push({ tag: n.tagName, cls: String(n.className).slice(0, 40), over: Math.round(r.right - W) });
    }
  });
  return out.slice(0, 6);
});

/* The review, measured: every box that could scroll sideways, and every row
   for anything drawn outside it or any control lying on another. */
const REVIEW = () => {
  const shown = n => !!n && getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().width > 0;
  const over = n => n ? n.scrollWidth - n.clientWidth : null;
  const W = document.documentElement.clientWidth;
  const m = document.querySelector('#wqaModal .wqa-modal');
  const rows = [...document.querySelectorAll('#wqaRows .wqa-it')];
  const spill = [], clash = [];
  rows.forEach(r => {
    const b = r.getBoundingClientRect();
    if ([...r.querySelectorAll('*')].filter(shown).some(n => { const x = n.getBoundingClientRect();
      return x.left < b.left - 1 || x.right > b.right + 1; })) spill.push(+r.dataset.wqaRow + 1);
    const cs = [...r.querySelectorAll('.wqa-it-main button, .wqa-it-main input')].filter(shown)
      .map(n => n.getBoundingClientRect());
    cs.forEach((a, i) => cs.slice(i + 1).forEach(c => {
      if (!(a.right <= c.left + 0.5 || c.right <= a.left + 0.5 || a.bottom <= c.top + 0.5 || c.bottom <= a.top + 0.5))
        clash.push(+r.dataset.wqaRow + 1); }));
  });
  const reach = sel => { const n = document.querySelector(sel); if (!shown(n)) return false;
    const r = n.getBoundingClientRect(); return r.width > 8 && r.left >= -0.5 && r.right <= W + 0.5; };
  const mr = m.getBoundingClientRect();
  return {
    review: m.classList.contains('is-review'),
    over: { modal: over(m), scroller: over(document.querySelector('#wqaStep2 .wqa-scroll')),
            rows: over(document.getElementById('wqaRows')) },
    rows: rows.length, spill: [...new Set(spill)], clash: [...new Set(clash)],
    count: (document.getElementById('wqaRowsCount') || {}).textContent || '',
    selBtn: reach('#wqaRvActs .wqa-rv-selbtn'), bulkBtn: reach('#wqaRvActs .wqa-rv-bulkbtn'),
    sheet: { l: Math.round(mr.left), t: Math.round(mr.top), w: Math.round(mr.width), h: Math.round(mr.height),
             winW: window.innerWidth, winH: window.innerHeight },
    tokH: Math.min(...rows.map(r => Math.round((r.querySelector('.wqa-it-toks .wqa-tok') || r).getBoundingClientRect().height))),
  };
};

/* The tick boxes: how many, whether each can be aimed at, and where. */
const PICKS = () => {
  const boxes = [...document.querySelectorAll('#wqaRows .wqa-it .wqa-pick')];
  const list = document.getElementById('wqaRows');
  const W = document.documentElement.clientWidth;
  const bar = document.getElementById('wqaSelBar');
  return {
    n: boxes.length,
    rowsWith: [...document.querySelectorAll('#wqaRows .wqa-it')].filter(r => r.querySelector('.wqa-pick')).length,
    tiny: boxes.filter(b => { const r = b.getBoundingClientRect();
                              return r.width < 12 || r.height < 12; }).length,
    outside: boxes.filter(b => { const r = b.getBoundingClientRect(); return r.left < -0.5 || r.right > W + 2; }).length,
    bar: !!bar && !bar.hidden && bar.getBoundingClientRect().height > 0,
    listOver: list ? list.scrollWidth - list.clientWidth : 0,
  };
};

module.exports = async (browser, A) => {
  const S = A.suite('responsive — every width the brief names');

  for (const W of WIDTHS) {
    const { width, label } = W;
    const mode = layoutOf(W);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: !!W.touch });
    const page = await openApp(browser, { context: ctx });

    // ── the main screen, with a quotation on it ──────────────────────────
    await page.evaluate(() => { selectedCompanyId = 7; });
    const ov = await pageOverflow(page);
    A.ok(ov.doc <= 2, `${label}: the page does not scroll sideways (${ov.doc}px over)`);
    const out = await stickingOut(page);
    A.ok(!out.length, `${label}: nothing is pushed off the right edge`
      + (out.length ? ' — ' + out.map(o => `${o.tag}.${o.cls} +${o.over}px`).join(', ') : ''));

    // ── the sidebar's actions are reachable, however it is laid out ──────
    const nav = await page.evaluate(() => {
      const wanted = ['sideNewQuotation', 'sideCompanies', 'sideDefaultPrices',
                      'sideDiameterSettings', 'sidePricingGuide', 'sideVersionUpdates'];
      const seen = {};
      wanted.forEach(k => {
        const n = document.querySelector(`[data-i18n="${k}"]`);
        if (!n) { seen[k] = 'absent'; return; }
        const r = n.getBoundingClientRect();
        /* Reachable = in the document with a box. A collapsed sidebar behind a
           toggle still counts, because the toggle is on screen. */
        seen[k] = (r.width > 0 && r.height > 0) ? 'visible' : 'collapsed';
      });
      const toggle = document.querySelector('.sidebar-toggle, #sidebarToggle, [onclick*="toggleSidebar"]');
      return { seen, hasToggle: !!toggle };
    });
    const missing = Object.entries(nav.seen).filter(([, v]) => v === 'absent').map(([k]) => k);
    A.ok(!missing.length, `${label}: every menu entry is in the document (${missing.join(', ')})`);
    const collapsed = Object.values(nav.seen).filter(v => v === 'collapsed').length;
    A.ok(!collapsed || nav.hasToggle,
      `${label}: a collapsed menu still has the control that opens it`);

    // ── the Quick Add review, which is the tallest thing in the app ──────
    await quickAddPaste(page, [
      'MS SAG ROD ZP FULLSIZE',
      'M12 x 1000 x 100/100 - 40pcs',
      'M16 x 850 x 100/100 - 20pcs',
      'M20 x 3000 x 150/150 - 8pcs',
    ].join('\n'), { expanded: false, settle: 900 });

    const modal = await page.evaluate(() => {
      const m = document.getElementById('wqaModal');
      if (!m || !m.classList.contains('open')) return null;
      const scroller = m.querySelector('#wqaStep2 .wqa-scroll') || m;
      const btn = document.getElementById('wqaAddBtn');
      const r = btn ? btn.getBoundingClientRect() : null;
      return {
        scrollable: scroller.scrollHeight > scroller.clientHeight
                 || getComputedStyle(scroller).overflowY === 'auto',
        btn: r ? { w: r.width, h: r.height, right: r.right, bottom: r.bottom } : null,
        winW: window.innerWidth, winH: window.innerHeight,
      };
    });
    A.ok(modal, `${label}: the review opens`);
    if (modal) {
      A.ok(modal.scrollable, `${label}: the review scrolls inside itself, down to its own footer`);
      A.ok(modal.btn && modal.btn.w > 0 && modal.btn.h > 0,
        `${label}: the Add button has a box`);
      A.ok(modal.btn && modal.btn.right <= modal.winW + 2,
        `${label}: the Add button is inside the window`);
      A.ok(modal.btn && modal.btn.bottom <= modal.winH + 2,
        `${label}: and above the fold, because the footer is sticky`);
    }

    const ov2 = await pageOverflow(page);
    A.ok(ov2.doc <= 2, `${label}: the review does not make the page scroll sideways (${ov2.doc}px)`);
    const out2 = await stickingOut(page);
    A.ok(!out2.length, `${label}: nothing of the review is pushed off the right edge`
      + (out2.length ? ' — ' + out2.map(o => `${o.tag}.${o.cls} +${o.over}px`).join(', ') : ''));

    const rv = await page.evaluate(REVIEW);
    A.eq(rv.review, 'true', `${label}: the review step is drawn`);
    A.eq(rv.rows, 3, `${label}: all three items are rows`);
    A.includes(rv.count, '3', `${label}: the heading says how many were detected (${rv.count})`);
    A.ok(rv.over.modal <= 1 && rv.over.scroller <= 1 && rv.over.rows <= 1,
      `${label}: neither the modal, its scroller nor the list scrolls sideways ${JSON.stringify(rv.over)}`);
    A.eq(rv.spill.join(','), '', `${label}: no row has anything drawn outside it`);
    A.eq(rv.clash.join(','), '', `${label}: no control in a row overlaps another`);
    A.ok(rv.selBtn && rv.bulkBtn, `${label}: Select and Bulk Adjust are on screen`);
    if (mode === 'mobile') {
      A.ok(rv.sheet.l === 0 && rv.sheet.w >= rv.sheet.winW - 1 && rv.sheet.h >= rv.sheet.winH - 1,
        `${label}: the review is a full-screen sheet (${rv.sheet.w}x${rv.sheet.h} at ${rv.sheet.l},${rv.sheet.t})`);
    } else {
      A.ok(rv.sheet.w < rv.sheet.winW, `${label}: the review is a dialog over the page, not a sheet (${rv.sheet.w}px)`);
    }
    if (mode === 'tablet') {
      A.ok(rv.tokH >= 40, `${label}: the tablet layout is in force — values are 40px+ targets (${rv.tokH}px)`);
    }

    /* ── Ticks, only while selecting ───────────────────────────────────────
       Retired 2026-10-23 (AI review redesign): "every row carries its tick"
       and the header select-all `#wqaListHead .wqa-pick-all` — review rows
       carry no tick box; Select enters Selection mode, which ticks every row
       (and the selection bar holds Select all). A selection control is still
       useless if it cannot be aimed at, so each one is measured. */
    const idle = await page.evaluate(PICKS);
    A.eq(idle.n, 0, `${label}: no tick box in review mode`);
    A.eq(idle.bar, 'false', `${label}: and no selection bar`);
    await page.click('#wqaRvActs .wqa-rv-selbtn');
    await page.waitForTimeout(400);
    const picks = await page.evaluate(PICKS);
    A.eq(picks.bar, 'true', `${label}: Select opens the selection bar`);
    A.eq(picks.rowsWith, 3, `${label}: every row carries its tick in Selection mode`);
    A.eq(picks.tiny, 0, `${label}: and every tick is big enough to aim at`);
    A.eq(picks.outside, 0, `${label}: and none is pushed off the screen`);
    A.ok(picks.listOver <= 1,
      `${label}: the row list itself does not scroll sideways (${picks.listOver}px)`);
    const rvSel = await page.evaluate(REVIEW);
    A.eq(rvSel.spill.join(','), '', `${label}: with the ticks in, no row has anything drawn outside it`);
    A.ok((await pageOverflow(page)).doc <= 2, `${label}: and the page still does not scroll sideways`);
    /* The row is the target while selecting, not only its small box. */
    await page.click('[data-wqa-row="1"] .wqa-it-main', { position: { x: 4, y: 4 } });
    await page.waitForTimeout(300);
    A.eq(await page.evaluate(() => wqa.rows.map(r => !!r.sel).join(',')), 'false,true,false',
      `${label}: pressing a row ticks that row`);
    await page.click('#wqaSelBar .btn-primary');
    await page.waitForTimeout(300);
    const done = await page.evaluate(PICKS);
    A.ok(done.n === 0 && !done.bar, `${label}: Done leaves no tick box and no bar behind`);

    A.ok(!page._dcErrors.length, `${label}: no script error — ${page._dcErrors.join(' | ')}`);
    await ctx.close();
  }

  return S;
};
