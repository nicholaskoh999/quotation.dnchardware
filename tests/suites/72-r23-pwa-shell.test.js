/* ── R2.3 Session E — one PWA shell geometry on Quotation and Saved ─────────
   Owner: the bottom navigation sits in slightly different places on
   Quotation and Saved. Cause (read from the code, not guessed): Saved never
   defined --sab (the home-indicator inset) and had no viewport-fit=cover, so
   on an iPhone its navigation had no home-indicator padding while
   Quotation's did. Chromium has no safe areas, so the inset is simulated by
   setting --sab to 34px — on a page that DEFINES the variable that override
   is what iOS would give; a page that does not define it reads it as empty.
   Held: same viewport meta; --sab defined on both; identical navigation box,
   icons, labels and indicator with and without the inset; nothing under the
   navigation; tablet portrait / landscape; R2.2's white root band and the
   pull-to-refresh guard still on both pages.                            */
'use strict';
const { openApp, openCompanies } = require('../lib/harness');

const geo = page => page.evaluate(() => {
  const nav = document.getElementById('rspNav'); const R = x => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
  /* R2.4: each item carries an outline and a solid Heroicon (solid for the current item); the VISIBLE one is measured */
  const icon = i => [...i.querySelectorAll('svg')].find(s => getComputedStyle(s).display !== 'none');
  return { nav: R(nav), items: [...nav.querySelectorAll('.rsp-nav-item')].map(i => [R(i), R(icon(i)), R(i.querySelector('span'))]),
           ind: (() => { const s = getComputedStyle(nav.querySelector('.is-active'), '::before'); return [s.top, s.height, s.left, s.backgroundColor]; })(),
           sab: getComputedStyle(document.documentElement).getPropertyValue('--sab').trim(),
           vp: document.querySelector('meta[name="viewport"]').content };
});

module.exports = async (browser, A) => {
  A.suite('72 R2.3 Session E: PWA shell — one navigation geometry');
  for (const vp of [{ width: 402, height: 874 }, { width: 375, height: 667 }, { width: 430, height: 932 }]) {
    const q = await openApp(browser, { viewport: vp }), s = await openCompanies(browser, { viewport: vp });
    let a = await geo(q), b = await geo(s);
    A.eq(b.vp, a.vp, `${vp.width}: Saved has the same viewport meta as Quotation (viewport-fit=cover)`);
    A.ok(a.sab !== '' && b.sab === a.sab, `${vp.width}: --sab is defined on both pages, the same way (${b.sab || 'missing'})`);
    A.eq(JSON.stringify(b.nav), JSON.stringify(a.nav), `${vp.width}: navigation box identical`);
    A.eq(JSON.stringify(b.items), JSON.stringify(a.items), `${vp.width}: icons and labels identical`);
    A.eq(JSON.stringify(b.ind), JSON.stringify(a.ind), `${vp.width}: selected indicator identical`);
    /* an iPhone home indicator: 34px */
    for (const p of [q, s]) await p.evaluate(() => document.documentElement.style.setProperty('--sab', '34px'));
    a = await geo(q); b = await geo(s);
    A.eq(a.nav[3], 56 + 34, `${vp.width}: with a 34px home indicator the navigation is 56 + 34 tall on Quotation`);
    A.eq(JSON.stringify(b.nav) + JSON.stringify(b.items), JSON.stringify(a.nav) + JSON.stringify(a.items), `${vp.width}: …and on Saved, icon for icon`);
    for (const [name, p] of [['Quotation', q], ['Saved', s]]) {
      const c = await p.evaluate(async () => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
        await new Promise(x => requestAnimationFrame(() => requestAnimationFrame(x)));
        const navTop = document.getElementById('rspNav').getBoundingClientRect().top;
        const host = document.querySelector('main.main') || document.querySelector('.wrap'); let low = 0;
        host.querySelectorAll('.card, .q-helper, button, .two-col > *, .empty-state').forEach(n => { const cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.position === 'fixed' || !n.offsetParent || n.closest('.modal-overlay,#wqaModal,.rsp-sheet,#addCompanyForm')) return;
          const r = n.getBoundingClientRect(); if (r.height) low = Math.max(low, r.bottom); });
        return { navTop: Math.round(navTop), low: Math.round(low) };
      });
      A.ok(c.low <= c.navTop, `${vp.width} ${name}: with the inset, the end of the page (${c.low}) clears the navigation (${c.navTop})`);
    }
    await q.close(); await s.close();
  }
  /* tablet portrait / landscape: drawer layout, same top bar, no sideways scroll */
  for (const vp of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 820, height: 1180 }]) {
    const q = await openApp(browser, { viewport: vp }), s = await openCompanies(browser, { viewport: vp });
    const t = p => p.evaluate(() => ({ nav: getComputedStyle(document.getElementById('rspNav')).display, top: (() => { const n = document.getElementById('rspTop'); const r = n.getBoundingClientRect(); return [getComputedStyle(n).display, Math.round(r.height)]; })(),
      ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    const a = await t(q), b = await t(s);
    A.eq(JSON.stringify(b), JSON.stringify(a), `${vp.width}x${vp.height}: Saved and Quotation shells identical (${JSON.stringify(a)})`);
    A.eq(a.ovf + b.ovf, 0, `${vp.width}x${vp.height}: no sideways scroll`);
    await q.close(); await s.close();
  }
  /* R2.2 kept: white root band mitigation and the pull-to-refresh guard on both */
  for (const [name, open] of [['Quotation', openApp], ['Saved', openCompanies]]) {
    const p = await open(browser, { viewport: { width: 402, height: 874 } });
    const r = await p.evaluate(() => ({ bg: getComputedStyle(document.documentElement).backgroundColor, theme: document.querySelector('meta[name="theme-color"]').content,
      ptr: typeof dcPtr === 'object' && typeof window.dcPtrGuard === 'function', standaloneOnly: dcPtr.enabled() === false, kb: document.documentElement.classList.contains('kb-open') }));
    A.ok(r.bg === 'rgb(255, 255, 255)' && r.theme === '#ffffff', `${name}: R2.2 white root band mitigation kept`);
    A.ok(r.ptr && r.standaloneOnly, `${name}: R2.2 pull-to-refresh guard present, installed-app only`);
    A.ok(!r.kb, `${name}: no keyboard state without a keyboard`);
    A.eq(p._dcErrors || [], [], `${name}: no page errors`);
    await p.close();
  }
};
