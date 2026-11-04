/* ── R2.2 Session A — mobile / installed-PWA layout ─────────────────────────
   Owner: in the installed iPhone app a blank GREY band sits between the iOS
   status bar and the DNC top bar (Quotation, Saved). iOS 26.1+ draws that band
   itself (WebKit bug 301994) and fills it with the page background; the page
   cannot paint into it and no safe-area inset is reported for it. So:
     - the root background below 1024px is the top bar's white (body keeps the
       grey canvas), theme-color is white, and NO top padding is added;
     - the phone top bar stays stuck to the top on Saved as well (it scrolled
       away: overflow-x:hidden on html+body made body a scroll container);
     - Saved never says "on the left" where there is no left panel. (R2.3 correction:
       at <=980px Saved is TABBED - Recent / Customers - so the R2.2 wording "above"
       was wrong too; it now says "Open Customers and choose a company".)
     - the bottom navigation never covers the end of the page.
   iOS standalone itself cannot run here (Chromium, no safe areas): the owner
   smoke on the installed app is the final check.                            */
'use strict';
const fs = require('fs');
const path = require('path');
const { openApp, openCompanies } = require('../lib/harness');

const ROOT = path.resolve(__dirname, '..', '..');
const PHONES = [{ width: 390, height: 844 }, { width: 430, height: 932 }];
const LAND = { width: 844, height: 390 };

const shape = page => page.evaluate(() => {
  const cs = n => n ? getComputedStyle(n) : null;
  const top = document.querySelector('#rspTop');
  const nav = document.querySelector('#rspNav');
  return {
    htmlBg: cs(document.documentElement).backgroundColor,
    bodyBg: cs(document.body).backgroundColor,
    topBg: cs(top).backgroundColor,
    topY: top.getBoundingClientRect().top,
    topPad: cs(top).paddingTop,
    bodyPad: cs(document.body).paddingTop,
    theme: (document.querySelector('meta[name="theme-color"]') || {}).content,
    vp: (document.querySelector('meta[name="viewport"]') || {}).content,
    navShown: !!nav && cs(nav).visibility !== 'hidden' && cs(nav).display !== 'none',
    navTop: nav ? nav.getBoundingClientRect().top : null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

module.exports = async function (browser, A) {
  A.suite('63 R2.2 Session A: mobile PWA layout');

  /* source-level: one viewport rule for the top, no top safe-area padding on the bar */
  const idx = fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8');
  const cmp = fs.readFileSync(path.join(ROOT, 'companies.php'), 'utf8');
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  A.eq(man.theme_color, '#ffffff', 'manifest theme_color is the top bar white');
  A.eq(man.display, 'standalone', 'manifest still standalone');
  for (const [n, s] of [['index', idx], ['companies', cmp]]) {
    A.ok(!/\.rsp-top\{[^}]*safe-area-inset-top/.test(s), `${n}: no safe-area-inset-top padding on the top bar (no double inset)`);
    A.ok(/apple-mobile-web-app-status-bar-style" content="default"/.test(s), `${n}: status bar style unchanged (default)`);
  }

  for (const [name, open] of [['Quotation', openApp], ['Saved', openCompanies]]) {
    for (const vp of PHONES) {
      const page = await open(browser, { viewport: vp });
      let s = await shape(page);
      const tag = `${name} ${vp.width}`;
      A.eq(s.htmlBg, 'rgb(255, 255, 255)', `${tag}: root background is white (the band iOS paints matches the top bar)`);
      A.eq(s.topBg, 'rgb(255, 255, 255)', `${tag}: top bar is white`);
      A.ok(s.bodyBg !== 'rgb(255, 255, 255)', `${tag}: page canvas stays grey (${s.bodyBg})`);
      A.eq(s.theme, '#ffffff', `${tag}: theme-color is white`);
      A.eq(s.topY, 0, `${tag}: top bar starts at the very top, no gap above it`);
      A.eq(s.topPad, '0px', `${tag}: no top padding on the bar`);
      A.eq(s.bodyPad, '0px', `${tag}: no top padding on body`);
      A.eq(s.overflow, 0, `${tag}: no sideways scroll`);
      A.ok(s.navShown, `${tag}: bottom navigation shown`);

      /* scroll to the end: the bar stays stuck, the last content clears the nav */
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      s = await shape(page);
      const scrolled = await page.evaluate(() => window.scrollY);
      A.eq(s.topY, 0, `${tag}: top bar still at the top after scrolling ${scrolled}px`);
      const lastBottom = await page.evaluate(() => {
        const host = document.querySelector('main.main') || document.querySelector('.wrap');
        let low = 0;
        host.querySelectorAll('.card, .q-helper, .cc, .rq-card, .company-card, button, .stepper, .two-col > *').forEach(n => {
          const cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' || n.closest('.modal-overlay,#wqaModal,.rsp-sheet')) return;
          const r = n.getBoundingClientRect(); if (r.width && r.height && n.offsetParent) low = Math.max(low, r.bottom);
        });
        return low;
      });
      A.ok(lastBottom <= s.navTop + 0.5, `${tag}: end of page (${Math.round(lastBottom)}) clears the bottom navigation (${Math.round(s.navTop)})`);
      A.eq(page._dcErrors || [], [], `${tag}: no page errors`);
      await page.close();
    }
  }

  /* landscape phone (tablet-width drawer layout): still white root, bar at top */
  for (const [name, open] of [['Quotation', openApp], ['Saved', openCompanies]]) {
    const page = await open(browser, { viewport: LAND });
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(200);
    const s = await shape(page);
    A.eq(s.htmlBg, 'rgb(255, 255, 255)', `${name} landscape: root background white`);
    A.eq(s.topY, 0, `${name} landscape: top bar stays at the top while scrolled`);
    A.eq(s.overflow, 0, `${name} landscape: no sideways scroll`);
    await page.close();
  }

  /* desktop untouched: root background not forced white, desktop wording kept */
  {
    const page = await openCompanies(browser, { viewport: { width: 1440, height: 1000 } });
    const s = await shape(page);
    A.ok(s.htmlBg !== 'rgb(255, 255, 255)', `desktop Saved: root background not changed (${s.htmlBg})`);
    const helper = await page.evaluate(() => { const n = document.querySelector('.q-helper'); return n ? n.innerText.trim() : ''; });
    A.includes(helper, 'on the left', 'desktop Saved: "Select a company on the left" (the list IS on the left)');
    await page.close();
  }

  /* phone wording: there is no left panel */
  for (const lang of ['en', 'zh']) {
    const page = await openCompanies(browser, { viewport: PHONES[0], lang });
    const r = await page.evaluate(() => {
      const n = document.querySelector('.q-helper');
      const list = document.querySelector('#companyList');
      return { text: n ? n.innerText.trim() : '', helperTop: n ? n.getBoundingClientRect().top : 0,
               listTop: list ? list.getBoundingClientRect().top : 0 };
    });
    if (lang === 'en') {
      A.excludes(r.text, 'on the left', 'phone Saved EN: no "on the left"');
      /* R2.2 asserted "Select a company above"; superseded by R2.3 (the list is in the Customers tab) */
      A.includes(r.text, 'Open Customers', 'phone Saved EN: "Open Customers and choose a company" (R2.3)');
    } else {
      A.excludes(r.text, '左侧', 'phone Saved 中文: no 左侧');
      A.includes(r.text, '「客户」', 'phone Saved 中文: 打开「客户」 (R2.3)');
    }
    /* R2.2 compared positions while the Customers pane was hidden (top 0) - it proved nothing. R2.3: the list is in the Customers tab. */
    A.ok(await page.evaluate(() => !!document.querySelector('#mobTabCustomers') && !!document.querySelector('#mobPaneCustomers #companyList')),
      `phone Saved ${lang}: the company list is in the Customers tab the hint names`);
    await page.close();
  }
};
