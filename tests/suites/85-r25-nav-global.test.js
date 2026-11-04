/* ── R2.5 Session G — bottom navigation (#13) + global consistency guards ────
   Navigation, both pages, 320 / 393 / 430: one geometry (same top and
   height on Quotation and Saved), four 24px Heroicons centred over centred
   labels, the indicator centred on its tab, the current page solid — and
   only ONE tab active at a time (an open Tools / Account sheet takes it;
   closing gives it back). The keyboard state still hides the bar; the page
   ends above it; a half-typed item is in the draft store before leaving.
   Global guards from the R2.5 audit (Chromium emulation): no sideways scroll
   and no "RM 1,234.56" split over two lines at 320–1920, EN and 中文, on
   Quotation (30 items) and Saved (customer selected).                   */
'use strict';
const { openApp, openCompanies } = require('../lib/harness');

const NAV = `(() => { const nav = document.getElementById('rspNav'), nr = nav.getBoundingClientRect();
  return { top: Math.round(nr.top), h: Math.round(nr.height), items: [...nav.querySelectorAll('.rsp-nav-item')].map(it => { const r = it.getBoundingClientRect();
    const svg = [...it.querySelectorAll('svg')].filter(s => getComputedStyle(s).display !== 'none')[0], sr = svg.getBoundingClientRect(), lr = it.querySelector('span').getBoundingClientRect();
    const b = getComputedStyle(it, '::before'); const ind = b.content !== 'none' ? parseFloat(b.left) + parseFloat(b.width) / 2 : null;
    return { solid: /#his-/.test(svg.querySelector('use').getAttribute('href')), color: getComputedStyle(it).color, iw: Math.round(sr.width), ih: Math.round(sr.height),
      iconOff: Math.abs(sr.left + sr.width / 2 - (r.left + r.width / 2)), labOff: Math.abs(lr.left + lr.width / 2 - (r.left + r.width / 2)), indOff: ind === null ? null : Math.abs(ind - r.width / 2),
      h: Math.round(r.height), indOpacity: b.content !== 'none' ? +b.opacity : null }; }) }; })()`;
const SCAN = `(() => { const out = { ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth, rmWrap: [] };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; const range = document.createRange();
  while ((n = walk.nextNode())) { const p = n.parentElement; if (!p || !p.offsetParent || p.closest('script,style,#printSummary,.modal-overlay:not(.open),[hidden],option,svg')) continue;
    const m = /RM\\s?-?[\\d,]+\\.\\d{2}/.exec(n.textContent); if (!m) continue; range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length);
    const rs = [...range.getClientRects()].filter(x => x.width > 0); if (new Set(rs.map(x => Math.round(x.top))).size > 1) out.rmWrap.push(n.textContent.trim().slice(0, 40)); }
  return out; })()`;
const LONG = 'ALPHA STEEL STRUCTURE ENGINEERING AND FABRICATION WORKS SDN BHD (KLANG)';
const item = k => ({ itemType: 'sagrod', desc: k % 3 === 1 ? 'MS UNDERSIZE SAG ROD' : 'MS FULLSIZE SAG ROD', size: 'M12 x L ' + (1000 + k * 50) + ' x TL 100/100mm', cleanSize: 'M12', material: 'MS', finish: 'HDG',
  sizeType: 'FULLSIZE', qty: 40 + k, finalUnitPrice: 7.9 + k / 10, totalAmount: (40 + k) * (7.9 + k / 10) });
const quote = n => ({ id: 41, ref_no: 'Q-2026-0041', quote_date: '2026-02-14', created_at: '2026-02-14 09:15:00', customer_name: LONG, company_id: 7, company_name: LONG, prepared_by: 'Nicholas',
  remarks: 'Price subject to change without prior notice', total_amount: 1234567.89, items: Array.from({ length: n }, (_, k) => item(k)) });

module.exports = async (browser, A) => {
  A.suite('85 R2.5 Session G: navigation + global guards');
  for (const w of [320, 393, 430]) {
    const geo = {};
    for (const [name, open, cur] of [['Quotation', openApp, 0], ['Saved', openCompanies, 1]]) {
      const p = await open(browser, { viewport: { width: w, height: 852 } });
      const g = await p.evaluate(NAV); geo[name] = g;
      A.ok(g.items.length === 4 && g.items.every(i => i.iw === 24 && i.ih === 24 && i.iconOff <= 1 && i.labOff <= 1 && i.h === g.h), `${w} ${name}: four tabs, 24px icons centred over centred labels`);
      A.ok(g.items[cur].solid && g.items[cur].indOff !== null && g.items[cur].indOff <= 1 && g.items.filter(i => i.solid).length === 1, `${w} ${name}: the current page is the one solid tab, its marker centred`);
      for (const [s, k] of [['tools', 2], ['account', 3]]) {
        const o = await p.evaluate(async s => { rspOpen(s); await new Promise(x => setTimeout(x, 280)); return true; }, s);
        const g2 = await p.evaluate(NAV);
        A.ok(o && g2.items[k].solid && g2.items.filter(i => i.solid).length === 1 && g2.items[cur].color === g2.items[(cur + 1) % 2].color && g2.items[cur].indOpacity < 0.5,
          `${w} ${name}: with ${s} open only ${s} is active; the page tab steps back`);
        await p.evaluate(async () => { rspClose(); await new Promise(x => setTimeout(x, 280)); });
        const g3 = await p.evaluate(NAV);
        A.ok(g3.items[cur].solid && g3.items.filter(i => i.solid).length === 1, `${w} ${name}: closing ${s} gives the page tab back`);
      }
      const end = await p.evaluate(() => { window.scrollTo({ top: 1e6, behavior: 'instant' }); const nav = document.getElementById('rspNav').getBoundingClientRect().top;
        const all = [...document.querySelectorAll('.main *, #rightPanel *')].filter(x => x.offsetParent && x.getBoundingClientRect().height > 0 && !x.closest('.rsp-nav,.mobile-bar'));
        return Math.max(...all.map(x => x.getBoundingClientRect().bottom)) <= nav + 1; });
      A.ok(end, `${w} ${name}: the page ends above the navigation`);
      A.eq(p._dcErrors, [], `${w} ${name}: no page errors`);
      await p.close();
    }
    A.eq([geo.Quotation.top, geo.Quotation.h], [geo.Saved.top, geo.Saved.h], `${w}: the bar sits in the same place on both pages (no jump)`);
  }
  /* a half-typed item is in the draft store before the user taps Saved */
  const d = await openApp(browser, { viewport: { width: 393, height: 852 } });
  await d.evaluate(() => { switchType('sagrod'); const s = (i, v) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; s('sagrod-costRate', '5'); s('sagrod-length', '1500'); });
  await d.waitForTimeout(900);
  A.ok(await d.evaluate(() => /1500/.test(localStorage.getItem('dc_quote_unsaved_draft_v1') || '')), 'a half-typed item is saved as a draft before navigating away');
  await d.close();
  /* global guards */
  for (const w of [320, 393, 768, 1024, 1180, 1280, 1920]) for (const lang of ['en', 'zh']) {
    const p = await openApp(browser, { viewport: { width: w, height: 900 }, handoff: quote(30) }); await p.evaluate(l => dcSetLang(l), lang); await p.waitForTimeout(200);
    await p.evaluate(() => { if (typeof dcErShow === 'function') dcErShow('review'); });
    const a = await p.evaluate(SCAN), n = await p.evaluate(() => quoteItems.length);
    A.ok(a.ovf === 0 && a.rmWrap.length === 0 && n === 30, `Quotation ${w} ${lang}: 30 items, no sideways scroll, no split RM (${a.rmWrap.join(' | ')})`);
    await p.close();
    const c = await openCompanies(browser, { viewport: { width: w, height: 900 }, lang, api: { get_companies: { ok: true, data: [{ id: 7, name: LONG, short_code: 'ALPHA', phone: '03-1234 5678', quotation_count: 3 }] },
      get_quotations: { ok: true, data: [quote(4), Object.assign(quote(50), { id: 42, ref_no: 'Q-2026-0042' })], total: 2 }, get_quotation: { ok: true, data: quote(50) } } });
    await c.evaluate(() => selectCompany(7)); await c.waitForTimeout(250);
    const s = await c.evaluate(SCAN);
    A.ok(s.ovf === 0 && s.rmWrap.length === 0, `Saved ${w} ${lang}: no sideways scroll, no split RM (${s.rmWrap.join(' | ')})`);
    await c.close();
  }
};
