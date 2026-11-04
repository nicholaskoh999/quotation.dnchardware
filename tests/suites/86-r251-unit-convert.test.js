/* ── R2.5.1 — Unit Convert on the phone ─────────────────────────────────────
   Owner (real iPhone PWA): the number field was a sliver, the unit select took
   the row, the panel was tall and the keyboard toolbar covered Fill L / TL.
   Held at 320 / 375 / 393 / 430, EN and 中文:
     - number ~60–65% of the row, unit the rest, both inside the panel, 44px;
     - the panel is compact (Exact | Integer side by side, Copy under each);
     - with the keyboard up (the visual viewport shrinks, as on iOS) the whole
       panel — input to the Fill buttons — is above it and the input is not
       under the header;
     - conversion, Copy, Fill and Close unchanged.
   (Chromium emulation — the installed iOS app is Owner Smoke.)          */
'use strict';
const { openApp } = require('../lib/harness');

module.exports = async (browser, A) => {
  A.suite('86 R2.5.1: Unit Convert on the phone');
  for (const w of [320, 375, 393, 430]) for (const lang of ['en', 'zh']) {
    const tag = `${w} ${lang}`, p = await openApp(browser, { viewport: { width: w, height: 852 } });
    await p.evaluate(l => { dcSetLang(l); switchType('sagrod'); }, lang);
    /* open it low on the page, as staff do mid-form */
    await p.evaluate(() => { document.querySelector('#form-sagrod .uc-open').scrollIntoView({ block: 'end', behavior: 'instant' }); document.querySelector('#form-sagrod .uc-open').click(); });
    await p.waitForTimeout(200);
    await p.fill('#ucInput', '1 1/8"'); await p.waitForTimeout(80);
    const g = await p.evaluate(() => { const R = s => document.querySelector(s).getBoundingClientRect(); const pn = R('#unitConvPanel'), row = R('#unitConvPanel .uc-inrow'), i = R('#ucInput'), u = R('#ucUnit');
      const rows = [...document.querySelectorAll('#unitConvPanel .uc-row')].map(n => n.getBoundingClientRect());
      return { share: i.width / row.width, inside: u.right <= pn.right + 0.5 && i.left >= pn.left, ih: Math.round(i.height), uh: Math.round(u.height), h: Math.round(pn.height),
        side: rows.length === 2 && Math.abs(rows[0].top - rows[1].top) < 2, exact: document.getElementById('ucExact').textContent.trim(), rounded: document.getElementById('ucRounded').textContent.trim(),
        fill: [...document.querySelectorAll('#ucApplyBtns .btn')].map(b => b.textContent.trim()), ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    A.ok(g.share >= 0.58 && g.share <= 0.68, `${tag}: the number field takes ${Math.round(g.share * 100)}% of the row`);
    A.ok(g.inside && g.ih >= 44 && g.uh >= 44 && g.ovf === 0, `${tag}: number and unit inside the panel, 44px, no sideways scroll`);
    A.ok(g.side && g.h <= 300, `${tag}: compact — Exact and Integer side by side (${g.h}px)`);
    A.eq([g.exact, g.rounded], ['28.575 mm', '29 mm'], `${tag}: conversion unchanged (1 1/8" = 28.575 mm, 29 mm)`);
    A.ok(g.fill.length === 2, `${tag}: Fill L / Fill TL present (${g.fill.join(', ')})`);
    /* the keyboard: the visual viewport shrinks by ~386px (keyboard + iOS toolbar) */
    await p.focus('#ucInput');
    await p.setViewportSize({ width: w, height: 852 - 386 }); await p.waitForTimeout(300);
    /* what iOS does: scroll only until the focused input clears the keyboard, then report the resize */
    await p.evaluate(() => { document.getElementById('ucInput').scrollIntoView({ block: 'end', behavior: 'instant' }); visualViewport.dispatchEvent(new Event('resize')); }); await p.waitForTimeout(500);
    const k = await p.evaluate(() => { const vv = window.visualViewport, pn = document.getElementById('unitConvPanel').getBoundingClientRect(), i = document.getElementById('ucInput').getBoundingClientRect();
      const fills = [...document.querySelectorAll('#ucApplyBtns .btn')].map(b => b.getBoundingClientRect().bottom);
      const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 58;
      return { fillsAbove: fills.every(b => b <= vv.offsetTop + vv.height), inputBelowHead: i.top >= head - 1, focused: document.activeElement.id === 'ucInput', vh: Math.round(vv.height), pb: Math.round(pn.bottom) }; });
    A.ok(k.fillsAbove && k.inputBelowHead && k.focused, `${tag}: keyboard up — Fill buttons above it (panel ends ${k.pb}/${k.vh}), input visible and focused`);
    await p.setViewportSize({ width: w, height: 852 });
    /* Fill / Copy / Close still work */
    const f = await p.evaluate(async () => { document.querySelector('#ucApplyBtns .btn').click(); await new Promise(x => setTimeout(x, 80));
      const v = document.getElementById('sagrod-length').value; return v; });
    A.eq(f, '29', `${tag}: Fill L puts the integer value in Length`);
    const c = await p.evaluate(async () => { if (document.getElementById('unitConvPanel').hidden) document.querySelector('#form-sagrod .uc-open').click(); await new Promise(x => setTimeout(x, 80));
      document.querySelector('#unitConvPanel .uc-x').click(); return document.getElementById('unitConvPanel').hidden; });
    A.ok(c && await p.evaluate(() => getComputedStyle(document.getElementById('unitConvPanel')).display === 'none'), `${tag}: Close closes — and a closed converter is not drawn`);
    A.ok(await p.evaluate(() => { const r = document.querySelector('#unitConvPanel .uc-x'); document.querySelector('#form-sagrod .uc-open').click(); const b = r.getBoundingClientRect(); closeUnitConverter(); return b.width >= 44 && b.height >= 44; }), `${tag}: Close is a 44px target`);
    A.eq(p._dcErrors, [], `${tag}: no page errors`);
    await p.close();
  }
  /* desktop unchanged in shape */
  const d = await openApp(browser, { viewport: { width: 1280, height: 900 } });
  await d.evaluate(() => document.querySelector('#form-sagrod .uc-open').click()); await d.waitForTimeout(150);
  const dd = await d.evaluate(() => { const row = document.querySelector('#unitConvPanel .uc-inrow').getBoundingClientRect(), i = document.getElementById('ucInput').getBoundingClientRect(); return i.width / row.width; });
  A.ok(dd >= 0.58, `desktop: the number field is the wide one (${Math.round(dd * 100)}%)`);
  await d.close();
};
