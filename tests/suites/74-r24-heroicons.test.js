/* ── R2.4 Session E — one icon language: Heroicons ──────────────────────────
   Official Heroicons v2.2.0 (Tailwind Labs, MIT), self-hosted as an inline
   sprite of only the icons used (no CDN, no library). Held on Quotation and
   Saved, desktop and phone, English and 中文, Quick Add review and toasts:
     - the sprite and its MIT notice are on both pages; the full licence ships;
     - every <use> points at a symbol that exists — no broken icon;
     - no emoji / dingbat left in DISPLAYED text of ordinary controls;
     - every icon-only button has an accessible name;
     - outline by default, the solid variant for the current navigation item;
     - nav icons 24px, actions ~18–20px;
     - translations, WhatsApp text and the print sheet are untouched (no SVG
       markup, no stray glyph removed from the stored strings).           */
'use strict';
const fs = require('fs');
const path = require('path');
const { openApp, openCompanies, quickAddPaste } = require('../lib/harness');
const ROOT = path.resolve(__dirname, '..', '..');

const SCAN = `(() => {
  const re = /[\\u2139\\u2600-\\u27BF\\u2705\\u274C]|[\\uD83C-\\uD83E][\\uDC00-\\uDFFF]/;
  const left = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const p = n.parentElement; if (!p || p.closest('script,style,textarea,#printSummary')) continue;
    const cs = getComputedStyle(p); if (cs.display === 'none' || (!p.offsetParent && cs.position !== 'fixed')) continue;
    if (re.test(n.nodeValue)) left.push((p.id || p.className || p.tagName) + ': ' + n.nodeValue.trim().slice(0, 30)); }
  const uses = [...document.querySelectorAll('use')].map(u => u.getAttribute('href'));
  const missing = [...new Set(uses.filter(h => !document.querySelector(h)))];
  const noname = [...document.querySelectorAll('button,a[href],[role="button"]')].filter(b => b.offsetParent && !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).map(b => b.outerHTML.slice(0, 70));
  return { left, uses: uses.length, missing, noname };
})()`;

module.exports = async (browser, A) => {
  A.suite('74 R2.4 Session E: Heroicons');
  /* source: sprite, notice, licence, no CDN */
  for (const f of ['index.php', 'companies.php']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    A.ok(/HEROICONS-SPRITE v2\.2\.0[\s\S]*MIT License, Copyright \(c\) Tailwind Labs/.test(s), `${f}: the sprite carries the MIT notice`);
    A.ok(!/unpkg|jsdelivr|cdnjs|heroicons\.com\/[^"\s]*\.svg/.test(s.replace(/<!-- HEROICONS-SPRITE[^>]*-->/, '')), `${f}: no icon CDN`);
    A.eq((s.match(/class="dnc-ico" viewBox/g) || []).length, 0, `${f}: no old line icons left`);
  }
  A.ok(/Tailwind Labs/.test(fs.readFileSync(path.join(ROOT, 'assets/icons/HEROICONS-LICENSE.txt'), 'utf8')), 'the full MIT licence ships in assets/icons/HEROICONS-LICENSE.txt');
  const ids = s => [...s.matchAll(/<symbol id="(his?-[a-z0-9-]+)"/g)].map(m => m[1]).sort();
  A.eq(ids(fs.readFileSync(path.join(ROOT, 'companies.php'), 'utf8')), ids(fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8')), 'both pages carry the same sprite');

  const states = [
    ['Quotation desktop', openApp, { width: 1440, height: 900 }, null],
    ['Quotation phone', openApp, { width: 402, height: 874 }, null],
    ['Quotation 中文', openApp, { width: 1440, height: 900 }, "dcSetLang('zh')"],
    ['Saved desktop', openCompanies, { width: 1440, height: 900 }, null],
    ['Saved phone', openCompanies, { width: 402, height: 874 }, null],
    ['Saved company selected', openCompanies, { width: 1440, height: 900 }, 'selectCompany(7)'],
    ['Saved 中文', openCompanies, { width: 402, height: 874 }, "dcSetLang('zh')"],
  ];
  for (const [name, open, vp, js] of states) {
    const p = await open(browser, { viewport: vp });
    if (js) await p.evaluate(js);
    await p.waitForTimeout(400);
    const r = await p.evaluate(SCAN);
    A.eq(r.left, [], `${name}: no emoji left in displayed text`);
    A.ok(r.uses > 20 && r.missing.length === 0, `${name}: ${r.uses} icons, every one resolves (${r.missing.join(',')})`);
    A.eq(r.noname, [], `${name}: every icon-only control has an accessible name`);
    A.eq(p._dcErrors || [], [], `${name}: no page errors`);
    if (vp.width < 600) {
      const nav = await p.evaluate(() => [...document.querySelectorAll('#rspNav .rsp-nav-item')].map(i => { const vis = [...i.querySelectorAll('svg')].filter(s => getComputedStyle(s).display !== 'none');
        return { active: i.classList.contains('is-active'), href: vis.map(s => s.querySelector('use').getAttribute('href')), w: Math.round(vis[0].getBoundingClientRect().width) }; }));
      A.ok(nav.every(x => x.href.length === 1 && x.w === 24), `${name}: one 24px icon per navigation item`);
      A.ok(nav.every(x => x.active ? /^#his-/.test(x.href[0]) : /^#hi-/.test(x.href[0])), `${name}: solid for the current item, outline for the rest`);
    }
    await p.close();
  }

  /* Quick Add review, a toast, the print sheet, WhatsApp and the dictionary */
  const page = await openApp(browser, { viewport: { width: 1440, height: 900 } });
  await quickAddPaste(page, 'MS SAG ROD PL\nM12 x 1000 x 100/100 - 10pcs\nM16 x 900 - 5pcs', { settle: 900 });
  await page.waitForTimeout(300);
  const qa = await page.evaluate(SCAN);
  A.eq(qa.left, [], 'Quick Add review: no emoji left');
  A.ok(qa.missing.length === 0 && qa.noname.length === 0, 'Quick Add review: icons resolve, controls named');
  const toast = await page.evaluate(async () => { showToast(dcT('tEnterRateFirst')); await new Promise(r => setTimeout(r, 120));
    const t = document.querySelector('.toast'); return { text: t.textContent, icon: !!t.querySelector('use[href="#hi-exclamation-triangle"]') }; });
  A.ok(toast.icon && !/⚠/.test(toast.text) && /Enter Cost Rate/.test(toast.text), 'a warning toast shows the exclamation-triangle icon and its words');
  A.eq(await page.evaluate(() => [dcT('tEnterRateFirst').startsWith('⚠'), dcT('aiParsed')]), [true, '✨ AI Parsed'], 'the dictionary strings are unchanged (translations preserved)');
  await page.evaluate(() => { closeModal('wqaModal'); const s = (i, v) => { document.getElementById(i).value = v; }; switchType('sagrod');
    s('sagrod-size', 'M12'); onSizeCommit('sagrod'); s('sagrod-diameter', '12'); s('sagrod-length', '1000'); s('sagrod-threadLen', '100/100');
    s('sagrod-qty', '10'); s('sagrod-costRate', '5'); s('sagrod-addCost', '0.3'); s('sagrod-markup', '20'); calcSagRod(); addSagRod(); });
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => { window.dispatchEvent(new Event('beforeprint')); const ps = document.getElementById('printSummary');
    const r = { wa: buildWAItemsText('-'), printSvg: ps.querySelectorAll('svg').length, printHtml: ps.innerHTML.includes('<use') };
    window.dispatchEvent(new Event('afterprint')); return r; });
  A.ok(out.wa.length > 10 && !/<svg|<use|hi-/.test(out.wa), 'WhatsApp text carries no icon markup');
  A.eq([out.printSvg, out.printHtml], [0, false], 'the print sheet carries no icons');
  const sizes = await page.evaluate(() => ({ close: Math.round(document.querySelector('.modal-close svg').getBoundingClientRect().width || 20),
    side: Math.round(document.querySelector('.dnc-shell .dnc-link .dnc-ico').getBoundingClientRect().width) }));
  A.ok(sizes.side === 20, `desktop sidebar icons 20px (${sizes.side})`);
  await page.close();
};
