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

   A table that scrolls inside its OWN box is fine, and is how a wide item
   list is meant to behave — so the check is on the document, not on the
   scroller.                                                                 */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');

const WIDTHS = [1920, 1600, 1366, 1280, 1024, 760, 640];

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

module.exports = async (browser, A) => {
  const S = A.suite('responsive — every width the brief names');

  for (const width of WIDTHS) {
    const page = await openApp(browser, { viewport: { width, height: 900 } });

    // ── the main screen, with a quotation on it ──────────────────────────
    await page.evaluate(() => { selectedCompanyId = 7; });
    const ov = await pageOverflow(page);
    A.ok(ov.doc <= 2, `${width}px: the page does not scroll sideways (${ov.doc}px over)`);
    const out = await stickingOut(page);
    A.ok(!out.length, `${width}px: nothing is pushed off the right edge`
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
    A.ok(!missing.length, `${width}px: every menu entry is in the document (${missing.join(', ')})`);
    const collapsed = Object.values(nav.seen).filter(v => v === 'collapsed').length;
    A.ok(!collapsed || nav.hasToggle,
      `${width}px: a collapsed menu still has the control that opens it`);

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
      const scroller = m.querySelector('.wqa-body, .modal-body, #wqaStep2') || m;
      const btn = document.getElementById('wqaAddBtn');
      const r = btn ? btn.getBoundingClientRect() : null;
      return {
        scrollable: scroller.scrollHeight > scroller.clientHeight
                 || getComputedStyle(scroller).overflowY === 'auto',
        btn: r ? { w: r.width, h: r.height, right: r.right, bottom: r.bottom } : null,
        winW: window.innerWidth, winH: window.innerHeight,
      };
    });
    A.ok(modal, `${width}px: the review opens`);
    if (modal) {
      A.ok(modal.btn && modal.btn.w > 0 && modal.btn.h > 0,
        `${width}px: the Add button has a box`);
      A.ok(modal.btn && modal.btn.right <= modal.winW + 2,
        `${width}px: the Add button is inside the window`);
      A.ok(modal.btn && modal.btn.bottom <= modal.winH + 2,
        `${width}px: and above the fold, because the footer is sticky`);
    }

    const ov2 = await pageOverflow(page);
    A.ok(ov2.doc <= 2, `${width}px: the review does not make the page scroll sideways (${ov2.doc}px)`);

    A.ok(!page._dcErrors.length, `${width}px: no script error — ${page._dcErrors.join(' | ')}`);
    await page.close();
  }

  return S;
};
