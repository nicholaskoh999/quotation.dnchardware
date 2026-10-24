/* ── DNC shared desktop shell (QUO Round 2, 2026-10-24) ─────────────────────
   Quotation and Internal PO are modules of one DNC system, so on the desk both
   wear the same shell: DNC / module brand, ← Back to Workspace, the module's
   primary action, MODULES, the module's tools, EN | 中文 and the account. This
   suite holds the owner's locked decisions to the screen:

     · order, brand and the words that must never appear in the shell;
     · MODULES (Quotations active, Internal PO through its own handoff start);
     · QUOTATION TOOLS (and no Calculator, no Version Updates);
     · the account menu (What's New, System Version, Sign Out);
     · companies.php wears the same shell, byte for byte;
     · below 1024px nothing changed; print never shows the shell;
     · leaving for another module asks what New Quotation asks.          */
'use strict';
const { openApp, openCompanies } = require('../lib/harness');

const DESK = { width: 1440, height: 1000 };
const VERSION = { system: 'Quotation', environment: 'production', release: null,
  branch: 'loop/quo-shared-shell', commit: '0123456789abcdef0123456789abcdef01234567', deployed_at: '2026-10-24T12:00:00+08:00' };

/* What the shell shows, in order, read off the screen. */
const shellState = page => page.evaluate(() => {
  const vis = n => { if (!n) return false; const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const shell = document.getElementById('dncShell');
  const top = s => { const n = shell && shell.querySelector(s); return n ? Math.round(n.getBoundingClientRect().top) : -1; };
  const secs = [...shell.querySelectorAll('.dnc-sec')];
  const linksUnder = i => { const out = []; let n = secs[i].nextElementSibling;
    while (n && !n.classList.contains('dnc-sec')) { if (n.classList.contains('dnc-link')) out.push(n); n = n.nextElementSibling; } return out; };
  const info = a => ({ text: a.textContent.trim(), active: a.classList.contains('is-active'), current: a.getAttribute('aria-current'),
    href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height) });
  return {
    visible: vis(shell), width: Math.round(shell.getBoundingClientRect().width),
    brand: [...shell.querySelectorAll('.dnc-brand-text > span')].map(n => n.textContent.trim()),
    order: { brand: top('.dnc-brand'), back: top('.dnc-back'), cta: top('.dnc-cta'), modules: secs[0] ? Math.round(secs[0].getBoundingClientRect().top) : -1,
             tools: secs[1] ? Math.round(secs[1].getBoundingClientRect().top) : -1, lang: top('.dnc-lang'), acct: top('.dnc-acct') },
    secs: secs.map(n => n.textContent.trim()),
    modules: linksUnder(0).map(info), tools: secs[1] ? linksUnder(1).map(info) : [],
    back: (() => { const a = shell.querySelector('.dnc-back'); return a ? { text: a.textContent.trim(), href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height) } : null; })(),
    cta: (() => { const b = shell.querySelector('.dnc-cta'); return b ? { text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height),
      w: Math.round(b.getBoundingClientRect().width) } : null; })(),
    shellText: shell.innerText, oldHeader: vis(document.querySelector('.app-header')) || vis(document.querySelector('.page-header')),
    oldSidebar: vis(document.getElementById('sidebar')), pageTitle: (document.querySelector('.dnc-page-title') || {}).textContent || '',
    pageHeadVisible: vis(document.querySelector('.dnc-page-head')),
    acct: { name: (document.getElementById('dncAcctName') || {}).textContent, user: (document.getElementById('dncAcctUser') || {}).textContent,
            avatar: (document.getElementById('dncAvatar') || {}).textContent },
    font: getComputedStyle(shell).fontFamily,
  };
});
const FORBIDDEN = /Der-Cheng Quotation|Quotation System|v2\.\d+\.\d+|Business System|DNC Workspace|Calculator|计算器|Version Updates|版本更新|Sign Out|退出/;

module.exports = async (browser, A) => {
  A.suite('DNC shared desktop shell — Quotations and Companies & Saved');

  // ── 1 · the Quotations page, EN and 中文 ────────────────────────────────
  {
    const page = await openApp(browser, { viewport: DESK });
    await page.route('**/version.php', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VERSION) }));
    for (const lang of ['en', 'zh']) {
      await page.evaluate(l => dcSetLang(l), lang);
      const s = await shellState(page);
      const zh = lang === 'zh';
      A.eq(s.visible && s.width, 240, `${lang}: the shell is shown, 240px wide`);
      A.eq(s.oldHeader, false, `${lang}: the blue top bar is not shown on the desk`);
      A.eq(s.oldSidebar, false, `${lang}: nor the old Quick Menu sidebar`);
      A.eq(JSON.stringify(s.brand), JSON.stringify(['DNC', 'QUOTATION']), `${lang}: brand DNC / QUOTATION`);
      const o = s.order;
      A.ok(o.brand < o.back && o.back < o.cta && o.cta < o.modules && o.modules < o.tools && o.tools < o.lang && o.lang < o.acct,
        `${lang}: brand → back → primary action → MODULES → tools → language → account (${JSON.stringify(o)})`);
      A.eq(s.back && s.back.text, zh ? '返回工作台' : 'Back to Workspace', `${lang}: the back link reads ${zh ? '返回工作台' : 'Back to Workspace'}`);
      A.eq(s.back && s.back.href, 'https://portal.dnchardware.com', `${lang}: and goes to the Portal, unchanged`);
      A.eq(s.back && s.back.h, 32, `${lang}: a quiet 32px link`);
      A.eq(s.cta && s.cta.text, zh ? '新建报价' : 'New Quotation', `${lang}: the primary action`);
      A.ok(s.cta && s.cta.h === 40 && s.cta.w >= 200, `${lang}: full width, 40px tall (${s.cta && s.cta.w}x${s.cta && s.cta.h})`);
      A.eq(JSON.stringify(s.secs), JSON.stringify(zh ? ['模块', '报价工具'] : ['Modules', 'Quotation Tools']),
        `${lang}: two sections, MODULES then QUOTATION TOOLS, and no SYSTEM (QUO has none)`);
      A.eq(JSON.stringify(s.modules.map(m => m.text)), JSON.stringify(zh ? ['报价单', '内部 PO'] : ['Quotations', 'Internal Purchase Orders']), `${lang}: the modules`);
      A.ok(s.modules[0] && s.modules[0].active && s.modules[0].current === 'page' && s.modules[0].href === 'index.php',
        `${lang}: Quotations is active and points home, not at a handoff`);
      A.eq(s.modules[1] && s.modules[1].href, 'https://po.dnchardware.com/auth/handoff/start', `${lang}: Internal PO goes through its own handoff start`);
      A.eq(JSON.stringify(s.tools.map(t => t.text)),
        JSON.stringify(zh ? ['公司与已保存报价', '默认价格', '直径设置', '价格说明'] : ['Companies & Saved', 'Default Prices', 'Diameter Settings', 'Pricing Guide']),
        `${lang}: QUOTATION TOOLS`);
      A.ok(s.modules.concat(s.tools).every(l => l.h === 36), `${lang}: every row 36px`);
      A.ok(!FORBIDDEN.test(s.shellText.replace(/\n/g, ' ')), `${lang}: no old brand, version, Calculator, Version Updates or Sign Out in the shell`);
      A.eq(s.pageHeadVisible && s.pageTitle, zh ? '报价单' : 'Quotations', `${lang}: the page header`);
      A.ok(/IBM Plex Sans/.test(s.font), `${lang}: the shell's font is IBM Plex Sans`);
    }
    await page.evaluate(() => dcSetLang('en'));
    /* the account block and its menu */
    const acct = (await shellState(page)).acct;
    A.eq(JSON.stringify(acct), JSON.stringify({ name: 'Test User', user: 'test.user', avatar: 'TU' }), 'account: name, username and initials');
    A.eq(await page.evaluate(() => document.getElementById('dncMenu').hidden), true, 'account: the menu starts closed');
    await page.click('#dncAcctBtn');
    await page.waitForTimeout(300);
    const menu = await page.evaluate(() => ({ open: !document.getElementById('dncMenu').hidden,
      items: [...document.querySelectorAll('#dncMenu .dnc-mi')].map(n => n.textContent.trim()),
      out: (document.querySelector('#dncMenu a[href]') || {}).getAttribute ? document.querySelector('#dncMenu a[href]').getAttribute('href') : '',
      expanded: document.getElementById('dncAcctBtn').getAttribute('aria-expanded') }));
    A.ok(menu.open && menu.expanded === 'true', 'account: pressing it opens the menu');
    A.eq(JSON.stringify(menu.items), JSON.stringify(["What's New", 'System Version0123456', 'Sign Out']),
      'account: What\'s New, System Version (the short commit from /version.php), Sign Out');
    A.eq(menu.out, 'logout.php', 'account: Sign Out is the existing logout.php');
    await page.click('#dncMenu .dnc-mi');                     // What's New
    await page.waitForTimeout(300);
    A.eq(await page.evaluate(() => el('versionUpdatesModal').classList.contains('open') && document.getElementById('dncMenu').hidden), true,
      "What's New opens the existing release notes and closes the menu");
    await page.evaluate(() => closeModal('versionUpdatesModal'));
    await page.click('#dncAcctBtn'); await page.mouse.click(900, 500);
    A.eq(await page.evaluate(() => document.getElementById('dncMenu').hidden), true, 'account: a click elsewhere closes the menu');
    /* the tools open the existing screens */
    for (const [k, id] of [['dp', 'dpModal'], ['ds', 'dsModal'], ['ref', 'refModal']]) {
      await page.click(`#dncShell [data-shell="${k}"]`);
      await page.waitForTimeout(250);
      A.eq(await page.evaluate(i => el(i).classList.contains('open'), id), true, `tool ${k}: opens the existing ${id}`);
      await page.evaluate(i => closeModal(i), id);
    }
    /* New Quotation is the existing action */
    await page.evaluate(() => { window.__newCalls = 0; const f = window.startNewQuotation; window.startNewQuotation = function () { window.__newCalls++; return f.apply(this, arguments); }; });
    await page.click('#dncNew');
    A.eq(await page.evaluate(() => window.__newCalls), 1, 'New Quotation calls the existing startNewQuotation()');
    /* print never shows the shell */
    await page.emulateMedia({ media: 'print' });
    const pr = await page.evaluate(() => ({ shell: getComputedStyle(document.getElementById('dncShell')).display,
      head: getComputedStyle(document.querySelector('.dnc-page-head')).display, pad: getComputedStyle(document.body).paddingLeft }));
    A.eq(JSON.stringify(pr), JSON.stringify({ shell: 'none', head: 'none', pad: '0px' }), 'print: no shell, no page header, no shell offset');
    await page.emulateMedia({ media: 'screen' });
    await page.close();
  }

  // ── 2 · leaving for Internal PO asks what New Quotation asks ─────────────
  {
    const page = await openApp(browser, { viewport: DESK });
    const dialogs = [];
    page.removeAllListeners('dialog');
    let answer = false;
    page.on('dialog', d => { dialogs.push(d.message()); (answer ? d.accept() : d.dismiss()).catch(() => {}); });
    await page.route('**/po.dnchardware.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>PO</p>' }));
    /* nothing to lose: straight through */
    const clean = await page.evaluate(() => { let went = ''; const L = window.location; return { draft: hasMeaningfulDraft(buildUnsavedDraft()) }; });
    A.eq(clean.draft, false, 'a fresh page has no draft');
    /* a draft: confirm first, and Cancel stays */
    await page.evaluate(() => { el('qi-customer').value = 'Shell Test Sdn Bhd'; el('qi-remarks').value = 'Delivery next week'; syncQI(); });
    A.eq(await page.evaluate(() => hasMeaningfulDraft(buildUnsavedDraft())), true, 'a customer and a remark make a draft');
    await page.click('#dncShell [data-shell="ipo"]');
    await page.waitForTimeout(400);
    A.eq(dialogs.length, 1, 'a draft: leaving asks first');
    A.ok(/Internal Purchase Orders/.test(dialogs[0] || ''), `and says where it is going (${(dialogs[0] || '').slice(0, 60)})`);
    A.ok(/quotation\.test/.test(page.url()), 'Cancel stays on Quotations');
    A.ok(await page.evaluate(() => { try { return !!localStorage.getItem(UNSAVED_DRAFT_KEY); } catch (e) { return false; } }),
      'and the draft was written to this device before asking (nothing is lost either way)');
    answer = true;
    await Promise.all([page.waitForURL(/po\.dnchardware\.com\/auth\/handoff\/start/, { timeout: 5000 }).catch(() => {}),
      page.click('#dncShell [data-shell="ipo"]')]);
    A.ok(/po\.dnchardware\.com\/auth\/handoff\/start$/.test(page.url()), `OK goes to the PO handoff start (${page.url()})`);
    await page.close();
  }
  {
    /* a saved quotation with unsaved edits: the existing discard question, once */
    const page = await openApp(browser, { viewport: DESK });
    const dialogs = [];
    page.removeAllListeners('dialog');
    page.on('dialog', d => { dialogs.push(d.type() + ':' + d.message()); d.dismiss().catch(() => {}); });
    await page.evaluate(() => { loadedSavedQuote = true; savedQuoteDirty = true; });
    await page.click('#dncShell [data-shell="ipo"]');
    await page.waitForTimeout(300);
    A.eq(dialogs.length, 1, 'saved quotation with changes: asked once');
    A.ok(/unsaved changes/i.test(dialogs[0] || ''), `with the existing discard question (${(dialogs[0] || '').slice(0, 70)})`);
    A.ok(/quotation\.test/.test(page.url()), 'and Cancel keeps the changes on screen');
    await page.evaluate(() => { savedQuoteDirty = false; loadedSavedQuote = false; });
    await page.close();
  }

  // ── 3 · a tool chosen on Companies opens on Quotations ──────────────────
  {
    const page = await openApp(browser, { viewport: DESK, initScript: null });
    await page.evaluate(() => { sessionStorage.setItem('dcShellIntent', 'ds'); dcShellRunIntent(false); });
    await page.waitForTimeout(250);
    A.eq(await page.evaluate(() => el('dsModal').classList.contains('open')), true, 'a Diameter Settings intent opens Diameter Settings');
    A.eq(await page.evaluate(() => sessionStorage.getItem('dcShellIntent')), null, 'and is used once');
    await page.evaluate(() => closeModal('dsModal'));
    /* New Quotation never runs over a draft still waiting to be offered */
    await page.evaluate(() => { window.__newCalls = 0; const f = window.startNewQuotation; window.startNewQuotation = function () { window.__newCalls++; return f.apply(this, arguments); };
      pendingUnsavedDraft = { quoteInfo: { customer: 'X' }, items: [] }; sessionStorage.setItem('dcShellIntent', 'new'); dcShellRunIntent(false); });
    A.eq(await page.evaluate(() => window.__newCalls), 0, 'a New Quotation intent waits while a draft is being offered');
    await page.evaluate(() => { pendingUnsavedDraft = null; sessionStorage.setItem('dcShellIntent', 'new'); dcShellRunIntent(false); });
    A.eq(await page.evaluate(() => window.__newCalls), 1, 'and otherwise starts a new quotation through the existing action');
    await page.close();
  }

  // ── 4 · Companies & Saved wears the same shell ──────────────────────────
  {
    const q = await openApp(browser, { viewport: DESK });
    const quoShell = await q.evaluate(() => document.getElementById('dncShell').outerHTML);
    await q.close();
    for (const lang of ['en', 'zh']) {
      const page = await openCompanies(browser, { viewport: DESK, lang });
      await page.waitForTimeout(300);
      const s = await shellState(page);
      const zh = lang === 'zh';
      A.eq(s.visible && s.width, 240, `companies ${lang}: the same 240px shell`);
      A.eq(s.oldHeader, false, `companies ${lang}: the header-only layout is gone on the desk`);
      A.eq(JSON.stringify(s.brand), JSON.stringify(['DNC', 'QUOTATION']), `companies ${lang}: brand DNC / QUOTATION`);
      const act = s.modules.concat(s.tools).filter(l => l.active).map(l => l.text);
      A.eq(JSON.stringify(act), JSON.stringify([zh ? '公司与已保存报价' : 'Companies & Saved']), `companies ${lang}: Companies & Saved is the active item, and only it`);
      A.eq(s.pageHeadVisible && s.pageTitle, zh ? '公司与已保存报价' : 'Companies & Saved', `companies ${lang}: the page header`);
      A.ok(!FORBIDDEN.test(s.shellText.replace(/\n/g, ' ')), `companies ${lang}: no old brand, version or utilities in the shell`);
      if (lang === 'en') {
        const coShell = await page.evaluate(() => document.getElementById('dncShell').outerHTML);
        const norm = h => h.replace(/ is-active" aria-current="page/g, '').replace(/>[^<]*</g, '><');
        A.eq(norm(coShell), norm(quoShell), 'companies: the shell markup is the same as on Quotations, apart from the active item');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        A.ok(overflow <= 2, `companies: no sideways scroll (${overflow}px)`);
        /* a tool here hands over to Quotations */
        await page.route('**/index.php', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>quo</p>' }));
        await page.click('#dncShell [data-shell="dp"]');
        await page.waitForTimeout(400);
        A.ok(/index\.php$/.test(page.url()), `companies: Default Prices goes to Quotations (${page.url()})`);
        A.eq(await page.evaluate(() => sessionStorage.getItem('dcShellIntent')), 'dp', 'companies: carrying the Default Prices intent');
      }
      await page.close();
    }
  }

  // ── 5 · below 1024px nothing changed ────────────────────────────────────
  for (const w of [1023, 820, 390]) {
    const page = await openApp(browser, { viewport: { width: w, height: 900 } });
    const s = await shellState(page);
    A.eq(s.visible, false, `${w}px: no desktop shell`);
    A.eq(s.oldHeader, true, `${w}px: the existing header is shown`);
    A.eq(s.pageHeadVisible, false, `${w}px: no shell page header`);
    A.eq(await page.evaluate(() => getComputedStyle(document.body).paddingLeft), '0px', `${w}px: no shell offset`);
    await page.close();
    const cp = await openCompanies(browser, { viewport: { width: w, height: 900 } });
    await cp.waitForTimeout(200);
    const c = await shellState(cp);
    A.ok(!c.visible && c.oldHeader, `companies ${w}px: the existing header, no shell`);
    await cp.close();
  }
};
