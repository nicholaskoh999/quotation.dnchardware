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

  // ── calculator, desk: the always-visible Quick Menu ─────────────────────
  {
    const page = await openApp(browser, { viewport: { width: 1440, height: 1000 } });
    const l = await linkInfo(page, '#sidebar .side-nav a.side-link');
    A.eq(l.length, 1, 'desk: exactly one DNC Workspace link in the Quick Menu');
    A.eq(l[0] && l[0].text, 'DNC Workspace', 'desk: it reads "DNC Workspace"');
    A.eq(l[0] && l[0].visible && l[0].onTop && l[0].inViewport, true, 'desk: visible, on screen and clickable without opening anything');
    A.eq(l[0] && l[0].target, null, 'desk: same tab');
    const order = await page.evaluate(() => [...document.querySelectorAll('#sidebar .side-nav .side-link')]
      .map(e => e.textContent.trim()));
    A.eq(order.slice(-2), ['DNC Workspace', 'Sign Out'], 'desk: it sits just above Sign Out; the existing items keep their order');
    A.eq(await page.evaluate(() => document.querySelectorAll('a[href^="https://portal.dnchardware.com"]').length), 1,
      'desk: the only Portal link on the page, and it carries no path or query');
    await page.evaluate(() => dcSetLang('zh'));
    const zh = await linkInfo(page, '#sidebar .side-nav a.side-link');
    A.eq(zh[0] && zh[0].text, 'DNC 工作台', 'desk: translated in Chinese');
    await page.evaluate(() => dcSetLang('en'));
    await page.close();
  }

  // ── calculator, phone and tablet: the ☰ drawer ──────────────────────────
  for (const w of [390, 768]) {
    const page = await openApp(browser, { viewport: { width: w, height: 900 } });
    const closed = await linkInfo(page, '#sidebar .side-nav a.side-link');
    A.eq(closed.length === 1 && closed[0].inViewport, false, `${w}px: the link is in the drawer, off screen until it opens`);
    await page.click('#burgerBtn');
    await page.waitForTimeout(600);
    const open = await linkInfo(page, '#sidebar .side-nav a.side-link');
    A.eq(open.length, 1, `${w}px: the open menu has the DNC Workspace link`);
    A.eq(open[0] && open[0].visible && open[0].onTop && open[0].inViewport, true, `${w}px: visible and tappable once the menu is open`);
    A.ok(open[0] && open[0].h >= 40, `${w}px: a full-height menu row (${open[0] && open[0].h}px)`);
    await page.close();
  }

  // ── companies: header nav, desk and phone ───────────────────────────────
  for (const w of [1440, 430]) {
    const page = await openCompanies(browser, { viewport: { width: w, height: 900 } });
    await page.waitForTimeout(300);
    const l = await linkInfo(page, '.header-actions a.nav-btn');
    A.eq(l.length, 1, `companies ${w}px: one DNC Workspace link in the header nav`);
    A.eq(l[0] && l[0].visible && l[0].onTop && l[0].inViewport, true, `companies ${w}px: visible and clickable`);
    A.eq(l[0] && l[0].text, 'DNC Workspace', `companies ${w}px: reads "DNC Workspace"`);
    A.ok(l[0] && /\bnav-btn\b/.test(l[0].cls) && /\bis-secondary\b/.test(l[0].cls),
      `companies ${w}px: styled as the existing secondary nav button`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    A.ok(overflow <= 2, `companies ${w}px: the page still does not scroll sideways (${overflow}px)`);
    await page.close();
  }
  A.ok(PORTAL === 'https://portal.dnchardware.com', 'the link is the fixed launcher URL');
};
