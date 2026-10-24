/* ── QUO mobile action bar — R2A (2026-10-25) ────────────────────────────────
   On a phone (<600px) there is ONE bottom layer, never two:

     nav     browsing        no customer, no items      → Quotation · Saved · Tools · Account
     work    in progress     a customer or any items,   → total · items · + Add · Save
                             not yet saved
     output  saved           items saved and unchanged  → total · items · + Add · Print · WhatsApp

   The state is written to <html data-rsp-bottom> by refreshWorkflow() from the
   same facts as the stepper. It is never read off scroll position. Tablet,
   desktop and Companies are held where R1 left them.                        */
'use strict';
const { openApp, openCompanies, quickAddPaste, typeInto } = require('../lib/harness');

const MSG = ['MS SAG ROD ZP UNDERSIZE', 'M12 x 853 x 70/70 - 12pcs', 'M16 x 1240 x 90/90 - 18pcs'].join('\n');
const PHONES = [390, 430];

const snap = page => page.evaluate(() => {
  const vis = n => {
    if (!n) return false;
    const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' && r.width > 0 && r.height > 0;
  };
  const q = s => document.querySelector(s);
  const bar = q('.mobile-bar'), nav = q('#rspNav');
  const br = bar.getBoundingClientRect();
  return {
    state: document.documentElement.getAttribute('data-rsp-bottom'),
    nav: vis(nav), bar: vis(bar), barH: br.height, barBottom: br.bottom, vh: innerHeight,
    barPadBottom: parseFloat(getComputedStyle(bar).paddingBottom),
    total: q('#mbTotal').textContent, count: q('#mbCount').textContent,
    add: vis(q('#mbAddBtn')), save: vis(q('#mobileSaveBtn')), print: vis(q('#mbPrintBtn')), wa: vis(q('#mbWaBtn')),
    countBtn: vis(q('.mb-count')),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    barOverflow: bar.scrollWidth - bar.clientWidth,
    handlers: {
      add: q('#mbAddBtn').getAttribute('onclick'), save: q('#mobileSaveBtn').getAttribute('onclick'),
      print: q('#mbPrintBtn').getAttribute('onclick'), wa: q('#mbWaBtn').getAttribute('onclick'),
    },
    btnRects: ['#mbAddBtn', '#mobileSaveBtn', '#mbPrintBtn', '#mbWaBtn', '.mb-count', '#mbTotal'].map(s => {
      const n = q(s);
      if (!vis(n)) return null;
      const r = n.getBoundingClientRect();
      return { s, l: r.left, r: r.right, t: r.top, b: r.bottom };
    }),
  };
});

const settle = page => page.waitForTimeout(260);
const inside = (r, w) => r.l >= 0 && r.r <= w + 0.5;
const disjoint = rs => rs.every((a, i) => rs.every((b, j) =>
  i >= j || a.r <= b.l + 0.5 || b.r <= a.l + 0.5 || a.b <= b.t + 0.5 || b.b <= a.t + 0.5));
const clearAll = async page => {
  await page.evaluate(() => startNewQuotation());   // the real New Quotation; the harness accepts its confirm
  await page.waitForTimeout(300);
};

module.exports = async (browser, A) => {
  A.suite('mobile action bar R2A — one bottom layer: nav when browsing, quotation bar when working');

  for (const w of PHONES) {
    const page = await openApp(browser, { viewport: { width: w, height: 844 } });
    for (const lang of ['en', 'zh']) {
      await page.evaluate(l => dcSetLang(l), lang);
      const t = `${w} ${lang}`;
      await clearAll(page);
      await settle(page);

      // CASE 1 · idle
      let s = await snap(page);
      A.eq(s.state, 'nav', `${t}: idle -> state nav`);
      A.ok(s.nav && !s.bar, `${t}: idle shows the bottom navigation only`);
      A.eq(s.overflow, 0, `${t}: idle has no sideways scroll`);

      // CASE 2 · active work: a customer, typed the way a person types
      if (!(await page.isVisible('#qi-customer'))) await page.evaluate(() => toggleQIEdit());
      await typeInto(page, '#qi-customer', 'ADVANCE ENGINEERING');
      await settle(page);
      s = await snap(page);
      A.eq(s.state, 'work', `${t}: a customer alone starts active work`);
      A.ok(s.bar && !s.nav, `${t}: work shows the quotation bar and hides the navigation`);
      A.ok(s.add && s.save && s.countBtn && !s.print && !s.wa, `${t}: work offers Add, Save and the count, not Print / WhatsApp`);

      await quickAddPaste(page, MSG, { settle: 900 });
      await page.evaluate(() => wqaAddAll());
      await page.waitForTimeout(1100);
      s = await snap(page);
      const model = await page.evaluate(() => {
        const sum = quoteItems.reduce((a, i) => a + i.totalAmount, 0);
        return { n: quoteItems.length, fmt: fmt(sum) };
      });
      A.ok(model.n >= 2, `${t}: items were added (${model.n})`);
      A.eq(s.state, 'work', `${t}: unsaved items -> work`);
      A.eq(s.count, String(model.n), `${t}: the bar's item count matches the quotation`);
      A.eq(s.total, model.fmt, `${t}: the bar's total matches the quotation`);
      A.ok(s.barH <= 64 + s.barPadBottom && s.barH >= 48, `${t}: the bar is compact (${s.barH.toFixed(1)}px)`);
      A.near(s.barBottom, s.vh, 0.6, `${t}: the bar sits on the bottom edge, no navigation underneath`);
      A.eq(s.overflow, 0, `${t}: no sideways scroll while working`);
      A.eq(s.barOverflow, 0, `${t}: nothing clipped inside the bar`);
      const rects = s.btnRects.filter(Boolean);
      A.ok(rects.every(r => inside(r, w)) && disjoint(rects), `${t}: every bar control fits and none overlaps another`);
      A.eq(JSON.stringify([s.handlers.add, s.handlers.save]), JSON.stringify(['addCurrentItem()', 'openSaveModal()']), `${t}: Add and Save are the existing handlers`);

      // content clears the bar at the very end of the page
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(250);
      const clear = await page.evaluate(() => {
        const bar = document.querySelector('.mobile-bar').getBoundingClientRect().top;
        const last = [...document.querySelectorAll('.main > *')].filter(n => n.getBoundingClientRect().height > 0).pop();
        return { gap: bar - last.getBoundingClientRect().bottom };
      });
      A.ok(clear.gap >= 0, `${t}: the last card clears the bar (gap ${clear.gap.toFixed(0)}px)`);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

      // iPhone safe area: the controls rise above the home indicator
      const base = (await snap(page)).barH;
      await page.evaluate(() => document.documentElement.style.setProperty('--sab', '34px'));
      s = await snap(page);
      A.ok(s.barPadBottom >= 34 && s.barH >= base + 33, `${t}: bottom safe-area inset lifts the controls (${s.barPadBottom}px)`);
      await page.evaluate(() => document.documentElement.style.removeProperty('--sab'));

      // CASE 3 · save -> output
      await page.evaluate(() => openSaveModal());
      await page.waitForTimeout(450);
      await page.evaluate(() => document.getElementById('saveModalSubmitBtn').click());
      await page.waitForTimeout(1600);
      await page.evaluate(() => { if (typeof closeModal === 'function') closeModal('saveModal'); });
      await settle(page);
      s = await snap(page);
      A.eq(s.state, 'output', `${t}: saved and unchanged -> output`);
      A.ok(s.bar && !s.nav && s.print && s.wa && s.add && !s.save, `${t}: output offers Print / WhatsApp (+ Add), not Save, and no navigation`);
      A.eq(JSON.stringify([s.handlers.print, s.handlers.wa]), JSON.stringify(['doPrint()', 'doWhatsApp()']), `${t}: Print and WhatsApp are the existing handlers`);
      A.eq(s.total, model.fmt, `${t}: output keeps the same total`);
      const r2 = s.btnRects.filter(Boolean);
      A.ok(s.overflow === 0 && s.barOverflow === 0 && r2.every(r => inside(r, w)) && disjoint(r2), `${t}: output fits at ${w}px, no overlap, no sideways scroll`);

      // changing a saved quotation puts the work bar back
      await page.evaluate(() => { quoteItems[0].qty = (quoteItems[0].qty || 1) + 1; refreshWorkflow(); });
      s = await snap(page);
      A.eq(s.state, 'work', `${t}: changing a saved quotation returns to work`);
      A.ok(s.save && !s.print && !s.wa, `${t}: Save is back, Print / WhatsApp gone`);

      // emptied -> idle, navigation back, nothing stale
      await clearAll(page);
      await settle(page);
      s = await snap(page);
      A.eq(s.state, 'nav', `${t}: emptied -> state nav`);
      A.ok(s.nav && !s.bar, `${t}: the navigation returns and the bar leaves`);
      A.eq(s.count, '0', `${t}: no stale count`);
    }
    A.eq(page._dcErrors.length, 0, `${w}: no script errors (${page._dcErrors.join(' | ')})`);
    await page.close();
  }

  // Companies: the normal bottom navigation, no quotation bar
  {
    const page = await openCompanies(browser, { viewport: { width: 390, height: 844 } });
    const c = await page.evaluate(() => {
      const n = document.querySelector('.rsp-nav');
      const cs = n && getComputedStyle(n);
      return {
        nav: !!n && cs.display !== 'none' && cs.visibility !== 'hidden' && n.getBoundingClientRect().height > 0,
        bar: !!document.querySelector('.mobile-bar'),
        attr: document.documentElement.getAttribute('data-rsp-bottom'),
      };
    });
    A.ok(c.nav && !c.bar && c.attr === null, 'Companies 390: keeps the normal bottom navigation and has no quotation bar');
    await page.close();
  }

  // Tablet and desktop: exactly as R1
  for (const w of [820, 1024]) {
    const page = await openApp(browser, { viewport: { width: w, height: 900 } });
    const read = () => page.evaluate(() => {
      const b = document.querySelector('.mobile-bar'), cs = getComputedStyle(b);
      const c = getComputedStyle(document.querySelector('.mb-count'));
      return {
        display: cs.display, grid: cs.gridTemplateColumns, vis: cs.visibility, op: cs.opacity, bottom: cs.bottom,
        nav: getComputedStyle(document.getElementById('rspNav')).display, countBorder: c.borderTopWidth,
      };
    });
    const idle = await read();
    await page.evaluate(() => { document.getElementById('qi-customer').value = 'X'; syncQI(); });
    const work = await read();
    A.eq(idle.nav, 'none', `${w}: no bottom navigation`);
    if (w < 1024) {
      A.eq(JSON.stringify([idle.display, idle.grid]), JSON.stringify(['flex', 'none']), `${w}: the sticky bar is still R1's flex row (not the phone grid)`);
      A.ok(idle.vis === 'visible' && idle.op === '1' && work.vis === 'visible' && work.op === '1', `${w}: the bar is visible in every state`);
      A.eq(JSON.stringify([idle.bottom, idle.countBorder]), JSON.stringify([work.bottom, '1px']), `${w}: position and the outlined count are unchanged by state`);
    } else {
      A.eq(idle.display, 'none', `${w}: the sticky bar stays hidden on desktop`);
    }
    await page.close();
  }
};
