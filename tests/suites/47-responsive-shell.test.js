/* ── DNC responsive shell — QUO Responsive R1 (2026-10-24) ───────────────────
   One information architecture, three presentations:

     <600px        compact top bar (DNC / QUOTATION + account) and a four-item
                   bottom navigation: Quotation · Saved · Tools · Account.
                   Tools and Account are bottom sheets. The old Quick Menu is gone.
     600–1023px    no bottom navigation; the shared sidebar is an off-canvas
                   drawer, 320px, opened from the top bar.
     ≥1024px       the approved desktop shell, untouched (pixel-compared outside
                   this suite against the production build).

   Held to the screen at the widths the owner named, in EN and 中文.        */
'use strict';
const { openApp, openCompanies } = require('../lib/harness');

const PHONES = [390, 430];
const TABLETS = [600, 820, 1023];
const DESKS = [1024, 1280];
const VERSION = { system: 'Quotation', commit: '0123456789abcdef0123456789abcdef01234567' };
const PO = 'https://po.dnchardware.com/auth/handoff/start';

const vis = `(n => { if (!n) return false; const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; })`;

const state = page => page.evaluate(`(() => {
  const vis = ${vis};
  const q = s => document.querySelector(s);
  const rect = s => { const n = q(s); if (!n) return null; const r = n.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }; };
  return {
    top: vis(q('#rspTop')), nav: vis(q('#rspNav')), burger: vis(q('#rspBurger')), avatar: vis(q('#rspAvatarBtn')),
    shell: vis(q('#dncShell')), shellRect: rect('#dncShell'), quick: vis(q('.rsp-quick')),
    navItems: [...document.querySelectorAll('#rspNav .rsp-nav-item')].map(n => ({ text: n.textContent.trim(), active: n.classList.contains('is-active'), tag: n.tagName, href: n.getAttribute('href') })),
    brand: [...document.querySelectorAll('#rspTop .dnc-brand-text > span')].map(n => n.textContent.trim()),
    legacy: vis(q('.app-header')) || vis(q('.page-header')) || vis(q('#sidebar')) || vis(q('.sidebar-backdrop')),
    bodyText: document.body.innerText,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    locked: document.documentElement.classList.contains('rsp-lock'),
  };
})()`);

const open = (page, id) => page.evaluate(i => document.getElementById(i).classList.contains('is-open'), id);

module.exports = async (browser, A) => {
  A.suite('DNC responsive shell — phone bottom navigation, tablet drawer, desktop untouched');

  // ══ PHONES ════════════════════════════════════════════════════════════
  for (const w of PHONES) {
    const page = await openApp(browser, { viewport: { width: w, height: 844 } });
    await page.route('**/version.php', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VERSION) }));
    for (const lang of ['en', 'zh']) {
      await page.evaluate(l => dcSetLang(l), lang);
      const zh = lang === 'zh', t = `${w} ${lang}`;
      const s = await state(page);
      A.ok(s.top && s.nav && s.avatar, `${t}: the compact top bar, the bottom navigation and the account button are shown`);
      A.eq(s.burger, false, `${t}: no menu button — navigation is at the bottom`);
      A.eq(s.shell, false, `${t}: no sidebar`);
      A.eq(s.legacy, false, `${t}: no legacy header, Quick Menu sidebar or scrim`);
      A.eq(JSON.stringify(s.brand), JSON.stringify(['DNC', 'QUOTATION']), `${t}: brand DNC / QUOTATION`);
      A.ok(!/Quick Menu|快捷菜单|Der-Cheng Quotation|Business System|v2\.\d+\.\d+/.test(s.bodyText), `${t}: no Quick Menu, legacy brand, Business System or version in view`);
      A.eq(JSON.stringify(s.navItems.map(n => n.text)), JSON.stringify(zh ? ['报价', '已保存', '工具', '账户'] : ['Quotation', 'Saved', 'Tools', 'Account']), `${t}: exactly four items`);
      A.eq(JSON.stringify(s.navItems.map(n => n.active)), JSON.stringify([true, false, false, false]), `${t}: Quotation is the active destination`);
      A.eq(s.navItems[1].href, 'companies.php', `${t}: Saved is Companies & Saved`);
      A.ok(s.overflow <= 2, `${t}: no horizontal overflow (${s.overflow}px)`);
      A.eq(s.quick, true, `${t}: the quick actions are on the quotation screen`);
    }
    await page.evaluate(() => dcSetLang('en'));

    // bottom navigation never covers the content or the TOTAL / Save bar
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, document.documentElement.scrollHeight); });
    await page.waitForTimeout(200);
    const clear = await page.evaluate(() => {
      const nav = document.getElementById('rspNav').getBoundingClientRect();
      const bar = document.querySelector('.mobile-bar').getBoundingClientRect();
      const cards = [...document.querySelectorAll('.main > .card, .main > div')].filter(n => n.getBoundingClientRect().height > 0);
      const last = cards[cards.length - 1].getBoundingClientRect();
      return { navTop: nav.top, barBottom: bar.bottom, barTop: bar.top, lastBottom: last.bottom, vh: innerHeight, navH: nav.height };
    });
    A.ok(clear.barBottom <= clear.navTop + 1, `${w}: the TOTAL / Save bar sits above the navigation (${clear.barBottom} ≤ ${clear.navTop})`);
    A.ok(clear.lastBottom <= clear.barTop + 1, `${w}: the last content ends above the bar — nothing hidden behind the navigation (${Math.round(clear.lastBottom)} ≤ ${Math.round(clear.barTop)})`);
    A.ok(clear.navH >= 56, `${w}: the navigation is at least 56px tall (${clear.navH})`);

    // one New Quotation on the first screen: the Step 1 copy is hidden on phones
    A.eq(await page.evaluate(() => getComputedStyle(document.querySelector('.rsp-dup-new')).display), 'none', `${w}: the duplicate Step 1 New Quotation is hidden`);
    // New Quotation keeps its guard and logic
    await page.evaluate(() => { window.__n = 0; const f = window.startNewQuotation; window.startNewQuotation = function () { window.__n++; return f.apply(this, arguments); }; });
    await page.click('.rsp-chip.is-primary');
    A.eq(await page.evaluate(() => window.__n), 1, `${w}: the quick New Quotation runs the existing startNewQuotation once`);

    // Tools sheet
    A.eq(await open(page, 'rspTools'), false, `${w}: Tools starts closed`);
    await page.click('#rspNavTools');
    await page.waitForTimeout(350);
    A.eq(await open(page, 'rspTools'), true, `${w}: Tools opens`);
    const tools = await page.evaluate(() => ({
      rows: [...document.querySelectorAll('#rspTools .rsp-row')].map(n => ({ t: n.textContent.trim(), h: Math.round(n.getBoundingClientRect().height), href: n.getAttribute('href') })),
      locked: document.documentElement.classList.contains('rsp-lock'),
      inert: document.querySelector('.app-shell').inert,
      expanded: document.getElementById('rspNavTools').getAttribute('aria-expanded'),
    }));
    A.eq(JSON.stringify(tools.rows.map(r => r.t)), JSON.stringify(['Default Prices', 'Diameter Settings', 'Pricing Guide', 'Internal Purchase Orders']), `${w}: Tools holds exactly the four tools`);
    A.ok(tools.rows.every(r => r.h >= 44), `${w}: every row is a 44px+ touch target`);
    A.eq(tools.rows[3].href, PO, `${w}: Internal Purchase Orders uses the existing handoff start`);
    A.ok(tools.locked && tools.inert && tools.expanded === 'true', `${w}: the page behind is locked and inert while it is open`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    A.eq(await open(page, 'rspTools'), false, `${w}: Escape closes Tools`);
    A.eq(await page.evaluate(() => document.documentElement.classList.contains('rsp-lock') || document.querySelector('.app-shell').inert), false, `${w}: and the page is released`);
    for (const [row, modal] of [[0, 'dpModal'], [1, 'dsModal'], [2, 'refModal']]) {
      await page.click('#rspNavTools'); await page.waitForTimeout(300);
      await page.click(`#rspTools .rsp-row:nth-of-type(${row + 1})`); await page.waitForTimeout(350);
      A.eq(await page.evaluate(m => el(m).classList.contains('open'), modal), true, `${w}: Tools row ${row + 1} opens the existing ${modal}`);
      A.eq(await open(page, 'rspTools'), false, `${w}: and the sheet has closed`);
      await page.evaluate(m => closeModal(m), modal);
    }
    await page.click('#rspNavTools'); await page.waitForTimeout(300);
    await page.mouse.click(w / 2, 60);                                  // the scrim
    await page.waitForTimeout(300);
    A.eq(await open(page, 'rspTools'), false, `${w}: tapping the scrim closes Tools`);

    // Account sheet
    await page.click('#rspNavAccount'); await page.waitForTimeout(500);
    const acct = await page.evaluate(() => ({
      open: document.getElementById('rspAcct').classList.contains('is-open'),
      name: document.getElementById('rspAcctName').textContent, user: document.getElementById('rspAcctUser').textContent,
      rows: [...document.querySelectorAll('#rspAcct .rsp-row')].map(n => ({ t: n.textContent.trim(), href: n.getAttribute('href') })),
      lang: [...document.querySelectorAll('#rspAcct .dnc-lang-btn')].map(n => ({ t: n.textContent.trim(), h: Math.round(n.getBoundingClientRect().height), w: Math.round(n.getBoundingClientRect().width) })),
    }));
    A.ok(acct.open && acct.name === 'Test User' && acct.user === 'test.user', `${w}: Account opens and names the signed-in user`);
    A.eq(JSON.stringify(acct.rows.map(r => r.t)), JSON.stringify(["What's New", 'System Version0123456', 'Back to Workspace', 'Sign Out']), `${w}: What's New, System Version (short commit), Back to Workspace, Sign Out`);
    A.eq(acct.rows[2].href, 'https://portal.dnchardware.com', `${w}: Back to Workspace is the Portal`);
    A.eq(acct.rows[3].href, 'logout.php', `${w}: Sign Out is the existing logout.php`);
    A.eq(JSON.stringify(acct.lang.map(l => l.t)), JSON.stringify(['EN', '中文']), `${w}: EN | 中文`);
    A.ok(acct.lang.every(l => l.h === 38) && acct.lang[0].w === acct.lang[1].w, `${w}: both language buttons are a compact 38px and equal width (${JSON.stringify(acct.lang)})`);
    await page.click('#rspAcct [data-lang-set="zh"]'); await page.waitForTimeout(200);
    A.eq(await page.evaluate(() => document.querySelector('#rspNav .rsp-nav-item:last-child span').textContent), '账户', `${w}: switching to 中文 relabels the navigation`);
    await page.click('#rspAcct [data-lang-set="en"]');
    await page.click('#rspAcct .rsp-row'); await page.waitForTimeout(350);        // What's New
    A.eq(await page.evaluate(() => el('versionUpdatesModal').classList.contains('open') && !document.getElementById('rspAcct').classList.contains('is-open')), true, `${w}: What's New opens the existing release notes and closes the sheet`);
    await page.evaluate(() => closeModal('versionUpdatesModal'));

    // tapping the avatar opens the same Account sheet
    await page.click('#rspAvatarBtn'); await page.waitForTimeout(350);
    A.eq(await open(page, 'rspAcct'), true, `${w}: the top-bar account button opens Account`);
    await page.click('#rspAcct .rsp-x'); await page.waitForTimeout(300);
    A.eq(await open(page, 'rspAcct'), false, `${w}: the close button closes it`);

    // keyboard up: the navigation steps aside like the footer does
    await page.evaluate(() => document.documentElement.classList.add('kb-open'));
    A.eq(await page.evaluate(() => getComputedStyle(document.getElementById('rspNav')).transform !== 'none'), true, `${w}: the navigation steps aside while the keyboard is up`);
    await page.close();
  }

  // ══ PHONE, Companies & Saved ══════════════════════════════════════════
  {
    const page = await openCompanies(browser, { viewport: { width: 390, height: 844 } });
    const s = await state(page);
    A.ok(s.top && s.nav && !s.shell && !s.legacy, 'companies 390: top bar and bottom navigation, no legacy header');
    A.eq(JSON.stringify(s.navItems.map(n => n.active)), JSON.stringify([false, true, false, false]), 'companies 390: Saved is the active destination');
    A.eq(s.navItems[0].href, 'index.php', 'companies 390: Quotation goes to the quotation screen');
    A.ok(s.overflow <= 2, `companies 390: no horizontal overflow (${s.overflow}px)`);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, document.documentElement.scrollHeight); });
    await page.waitForTimeout(200);
    const clear = await page.evaluate(() => {
      const nav = document.getElementById('rspNav').getBoundingClientRect();
      const wrap = document.querySelector('.wrap').getBoundingClientRect();
      return { navTop: nav.top, wrapBottom: wrap.bottom };
    });
    A.ok(clear.wrapBottom <= clear.navTop + 1, 'companies 390: the page ends above the navigation');
    await page.click('#rspNavTools'); await page.waitForTimeout(300);
    await page.click('#rspTools .rsp-row'); await page.waitForTimeout(300);
    A.eq(await page.evaluate(() => sessionStorage.getItem('dcShellIntent')), 'dp', 'companies 390: a tool carries its intent to the quotation screen');
    await page.close();
  }

  // the Step 1 button stays on tablet
  {
    const page = await openApp(browser, { viewport: { width: 820, height: 900 } });
    A.eq(await page.evaluate(() => getComputedStyle(document.querySelector('.rsp-dup-new')).display), 'flex', '820: the Step 1 New Quotation is unchanged on tablet');
    await page.close();
  }

  // ══ TABLETS ═══════════════════════════════════════════════════════════
  for (const w of TABLETS) {
    const page = await openApp(browser, { viewport: { width: w, height: 900 } });
    await page.route('**/version.php', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VERSION) }));
    for (const lang of ['en', 'zh']) {
      await page.evaluate(l => dcSetLang(l), lang);
      const zh = lang === 'zh', t = `${w} ${lang}`;
      const s = await state(page);
      A.ok(s.top && s.burger, `${t}: the top bar has the menu button`);
      A.eq(s.nav, false, `${t}: no bottom navigation`);
      A.eq(s.avatar, false, `${t}: no phone account button`);
      A.eq(s.quick, false, `${t}: no phone quick actions`);
      A.eq(s.legacy, false, `${t}: no legacy header or Quick Menu`);
      A.eq(s.shell, false, `${t}: the drawer is closed until asked for`);
      A.ok(s.overflow <= 2, `${t}: no horizontal overflow (${s.overflow}px)`);
      A.ok(!/Quick Menu|快捷菜单/.test(s.bodyText), `${t}: no Quick Menu`);
      await page.click('#rspBurger'); await page.waitForTimeout(450);
      const d = await page.evaluate(`(() => {
        const sh = document.getElementById('dncShell'), r = sh.getBoundingClientRect(), vis = ${vis};
        const secs = [...sh.querySelectorAll('.dnc-sec')].map(n => n.textContent.trim());
        const links = [...sh.querySelectorAll('.dnc-link')].map(n => n.textContent.trim());
        return { w: Math.round(r.width), left: Math.round(r.left), visible: vis(sh), secs, links,
          cta: sh.querySelector('.dnc-cta').getBoundingClientRect().height, back: sh.querySelector('.dnc-back').textContent.trim(),
          lang: [...sh.querySelectorAll('.dnc-lang-btn')].map(n => n.textContent.trim()), acct: vis(sh.querySelector('.dnc-acct')),
          brand: [...sh.querySelectorAll('.dnc-brand-text > span')].map(n => n.textContent.trim()),
          locked: document.documentElement.classList.contains('rsp-lock'), expanded: document.getElementById('rspBurger').getAttribute('aria-expanded') };
      })()`);
      A.ok(d.visible && d.left === 0, `${t}: the drawer opens from the left`);
      A.eq(d.w, 320, `${t}: and is 320px wide`);
      A.eq(JSON.stringify(d.brand), JSON.stringify(['DNC', 'QUOTATION']), `${t}: brand DNC / QUOTATION`);
      A.eq(d.back, zh ? '返回工作台' : 'Back to Workspace', `${t}: ← Back to Workspace first`);
      A.eq(d.cta, 36, `${t}: the lightweight 36px New Quotation action`);
      A.eq(JSON.stringify(d.secs), JSON.stringify(zh ? ['模块', '报价工具'] : ['Modules', 'Quotation Tools']), `${t}: MODULES and QUOTATION TOOLS`);
      A.eq(JSON.stringify(d.links), JSON.stringify(zh ? ['报价单', '内部 PO', '公司与已保存报价', '默认价格', '直径设置', '价格说明'] : ['Quotations', 'Internal Purchase Orders', 'Companies & Saved', 'Default Prices', 'Diameter Settings', 'Pricing Guide']), `${t}: the same shell IA as the desk`);
      A.eq(JSON.stringify(d.lang), JSON.stringify(['EN', '中文']), `${t}: EN | 中文 at the bottom`);
      A.ok(d.locked && d.expanded === 'true', `${t}: the page behind stops scrolling and the button reports it open`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(350);
      A.eq(await open(page, 'dncShell'), false, `${t}: Escape closes the drawer`);
    }
    await page.evaluate(() => dcSetLang('en'));
    // scrim, close button, tool, account menu
    await page.click('#rspBurger'); await page.waitForTimeout(350);
    await page.mouse.click(w - 10, 400); await page.waitForTimeout(350);
    A.eq(await open(page, 'dncShell'), false, `${w}: tapping the scrim closes the drawer`);
    await page.click('#rspBurger'); await page.waitForTimeout(350);
    await page.click('#dncShell .rsp-close'); await page.waitForTimeout(350);
    A.eq(await open(page, 'dncShell'), false, `${w}: the close button closes it`);
    A.eq(await page.evaluate(() => document.activeElement && document.activeElement.id), 'rspBurger', `${w}: focus returns to the menu button`);
    await page.click('#rspBurger'); await page.waitForTimeout(350);
    await page.click('#dncShell [data-shell="dp"]'); await page.waitForTimeout(350);
    A.eq(await page.evaluate(() => el('dpModal').classList.contains('open')), true, `${w}: Default Prices opens the existing screen`);
    A.eq(await open(page, 'dncShell'), false, `${w}: and the drawer has closed`);
    await page.evaluate(() => closeModal('dpModal'));
    await page.click('#rspBurger'); await page.waitForTimeout(350);
    await page.click('#dncAcctBtn'); await page.waitForTimeout(300);
    const menu = await page.evaluate(() => ({ open: !document.getElementById('dncMenu').hidden, items: [...document.querySelectorAll('#dncMenu .dnc-mi')].map(n => n.textContent.trim()) }));
    A.ok(menu.open && menu.items.join('|') === "What's New|System Version0123456|Sign Out", `${w}: the account menu — What's New, System Version, Sign Out`);
    A.eq(await open(page, 'dncShell'), true, `${w}: opening the account menu keeps the drawer open`);
    await page.keyboard.press('Escape');
    A.eq(await page.evaluate(() => document.getElementById('dncMenu').hidden), true, `${w}: Escape closes the account menu first`);
    A.eq(await open(page, 'dncShell'), true, `${w}: and the drawer on the next press`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    A.eq(await open(page, 'dncShell'), false, `${w}: drawer closed`);
    // crossing the breakpoint with the drawer open puts everything back
    await page.click('#rspBurger'); await page.waitForTimeout(300);
    await page.setViewportSize({ width: 1100, height: 900 }); await page.waitForTimeout(300);
    A.eq(await page.evaluate(() => document.documentElement.classList.contains('rsp-lock')), false, `${w}: widening past 1024 releases the page lock`);
    await page.close();
  }

  // ══ TABLET, Companies & Saved ═════════════════════════════════════════
  {
    const page = await openCompanies(browser, { viewport: { width: 820, height: 900 } });
    const s = await state(page);
    A.ok(s.top && s.burger && !s.nav && !s.legacy, 'companies 820: the top bar and menu button, no bottom navigation, no legacy header');
    await page.click('#rspBurger'); await page.waitForTimeout(450);
    const r = await page.evaluate(() => ({ w: Math.round(document.getElementById('dncShell').getBoundingClientRect().width), active: (document.querySelector('#dncShell .dnc-link.is-active') || {}).textContent }));
    A.eq(r.w, 320, 'companies 820: the drawer is 320px');
    A.eq((r.active || '').trim(), 'Companies & Saved', 'companies 820: Companies & Saved is the active row');
    await page.close();
  }

  // ══ DESKTOP, untouched ════════════════════════════════════════════════
  for (const w of DESKS) {
    for (const mk of [openApp, openCompanies]) {
      const page = await mk(browser, { viewport: { width: w, height: 900 } });
      const s = await state(page);
      A.ok(!s.top && !s.nav && !s.burger && !s.avatar && !s.quick, `${w}: none of the responsive parts is shown`);
      A.eq(s.shell && Math.round(s.shellRect.w), 240, `${w}: the 240px permanent sidebar`);
      A.eq(await page.evaluate(() => getComputedStyle(document.body).paddingLeft), '240px', `${w}: content offset 240px as before`);
      A.eq(await page.evaluate(() => getComputedStyle(document.querySelector('#dncShell .rsp-close')).display), 'none', `${w}: no drawer close button`);
      await page.close();
    }
  }
};
