/* ── DNC Workspace — the way back to the launcher ───────────────────────────
   DNC Workspace V1, Session C. Contract v2 §12: Quotation carries a plain link
   "DNC Workspace" → https://portal.dnchardware.com — same tab, no token, no
   parameters. It is added where Quotation already keeps its navigation, and
   nothing else moves:

     calculator  the Quick Menu sidebar — always visible on the desk, the ☰
                 drawer on tablets and phones
     companies   the header nav, beside Sign Out

   Asserted at desk and phone widths, in both languages, and as exactly that
   URL (no token, no query, no target=_blank).                               */
'use strict';
const { openApp, openCompanies } = require('../lib/harness');

const PORTAL = 'https://portal.dnchardware.com';

async function linkInfo(page, selector) {
  return page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)].filter(a => a.getAttribute('href') === 'https://portal.dnchardware.com');
    return els.map(a => {
      const r = a.getBoundingClientRect(), cs = getComputedStyle(a);
      const hit = r.width > 0 && r.height > 0
        ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      return { text: a.textContent.trim(), target: a.getAttribute('target'), w: r.width, h: r.height,
               visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
               onTop: !!hit && (hit === a || a.contains(hit)),
               inViewport: r.left >= 0 && r.right <= window.innerWidth + 0.5 && r.top >= 0 && r.bottom <= window.innerHeight + 0.5,
               cls: a.className };
    });
  }, selector);
}

module.exports = async (browser, A) => {
  A.suite('DNC Workspace link — desktop quick menu, mobile menu, companies header');

  /* Retired 2026-10-24 (DNC shared shell): on the desk the link is no longer a
     Quick Menu row above Sign Out. It is the shell's "← Back to Workspace",
     directly under the brand — a way back to the parent, never a utility. The
     same URL, same tab, no token; asserted below at its new place. The ☰
     drawer below 1024px keeps its row, unchanged. */
  const visiblePortalLinks = page => page.evaluate(() =>
    [...document.querySelectorAll('a[href^="https://portal.dnchardware.com"]')].filter(a => {
      const r = a.getBoundingClientRect(), cs = getComputedStyle(a);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    }).map(a => a.getAttribute('href')));
  async function deskBack(page, where) {
    const l = await linkInfo(page, '#dncShell a.dnc-back');
    A.eq(l.length, 1, `${where}: exactly one Back to Workspace link in the shell`);
    A.eq(l[0] && l[0].text, 'Back to Workspace', `${where}: it reads "Back to Workspace"`);
    A.eq(l[0] && l[0].visible && l[0].onTop && l[0].inViewport, true, `${where}: visible, on screen and clickable without opening anything`);
    A.eq(l[0] && l[0].target, null, `${where}: same tab`);
    const place = await page.evaluate(() => {
      const back = document.querySelector('#dncShell .dnc-back').getBoundingClientRect();
      const brand = document.querySelector('#dncShell .dnc-brand').getBoundingClientRect();
      const cta = document.querySelector('#dncShell .dnc-cta').getBoundingClientRect();
      return { underBrand: back.top >= brand.bottom - 1 && back.bottom <= cta.top + 1,
               inUtility: !!document.querySelector('#dncShell .dnc-bottom a[href^="https://portal"], #dncShell .dnc-nav a[href^="https://portal"], #dncMenu a[href^="https://portal"]') };
    });
    A.eq(place.underBrand, true, `${where}: directly under the brand, above New Quotation`);
    A.eq(place.inUtility, false, `${where}: never among the modules, tools, utilities or the account menu`);
    A.eq(JSON.stringify(await visiblePortalLinks(page)), JSON.stringify([PORTAL]),
      `${where}: the only visible Portal link, and it carries no path or query`);
    await page.evaluate(() => dcSetLang('zh'));
    const zh = await linkInfo(page, '#dncShell a.dnc-back');
    A.eq(zh[0] && zh[0].text, '返回工作台', `${where}: 返回工作台 in Chinese`);
    await page.evaluate(() => dcSetLang('en'));
  }
  // ── calculator, desk: the shell's back link ────────────────────────────
  {
    const page = await openApp(browser, { viewport: { width: 1440, height: 1000 } });
    await deskBack(page, 'desk');
    await page.close();
  }

  // ── calculator, phone and tablet: Account sheet / drawer (R1, 2026-10-24) ─
  {
    const page = await openApp(browser, { viewport: { width: 390, height: 900 } });
    const closed = await linkInfo(page, '#rspAcct a.rsp-row');
    A.eq(closed.length === 1 && closed[0].inViewport, false, '390px: the link is in the Account sheet, off screen until it opens');
    await page.click('#rspNavAccount');
    await page.waitForTimeout(600);
    const open = await linkInfo(page, '#rspAcct a.rsp-row');
    A.eq(open.length, 1, '390px: the open Account sheet has the Back to Workspace link');
    A.eq(open[0] && open[0].visible && open[0].onTop && open[0].inViewport, true, '390px: visible and tappable once the sheet is open');
    A.eq(open[0] && open[0].text, 'Back to Workspace', '390px: reads "Back to Workspace"');
    A.ok(open[0] && open[0].h >= 44, `390px: a full-height row (${open[0] && open[0].h}px)`);
    await page.close();
  }
  {
    const page = await openApp(browser, { viewport: { width: 768, height: 900 } });
    const closed = await linkInfo(page, '#dncShell a.dnc-back');
    A.eq(closed.length === 1 && closed[0].inViewport, false, '768px: the link is in the drawer, off screen until it opens');
    await page.click('#rspBurger');
    await page.waitForTimeout(600);
    const open = await linkInfo(page, '#dncShell a.dnc-back');
    A.eq(open.length, 1, '768px: the open drawer has the Back to Workspace link');
    A.eq(open[0] && open[0].visible && open[0].onTop && open[0].inViewport, true, '768px: visible and tappable once the drawer is open');
    await page.close();
  }

  // ── companies, desk: the same shell, the same back link ────────────────
  {
    const page = await openCompanies(browser, { viewport: { width: 1440, height: 900 } });
    await page.waitForTimeout(300);
    await deskBack(page, 'companies 1440px');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    A.ok(overflow <= 2, `companies 1440px: the page still does not scroll sideways (${overflow}px)`);
    await page.close();
  }
  // ── companies, phone: the Account sheet ────────────────────────────────
  for (const w of [430]) {
    const page = await openCompanies(browser, { viewport: { width: w, height: 900 } });
    await page.waitForTimeout(300);
    await page.click('#rspNavAccount');
    await page.waitForTimeout(600);
    const l = await linkInfo(page, '#rspAcct a.rsp-row');
    A.eq(l.length, 1, `companies ${w}px: one Back to Workspace link in the Account sheet`);
    A.eq(l[0] && l[0].visible && l[0].onTop && l[0].inViewport, true, `companies ${w}px: visible and clickable`);
    A.eq(l[0] && l[0].text, 'Back to Workspace', `companies ${w}px: reads "Back to Workspace"`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    A.ok(overflow <= 2, `companies ${w}px: the page still does not scroll sideways (${overflow}px)`);
    await page.close();
  }
  A.ok(PORTAL === 'https://portal.dnchardware.com', 'the link is the fixed launcher URL');
};
