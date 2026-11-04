/* ── R2.5 Session C — Saved / Customers (#04 #05 #12 #15 #20 #21) ───────────
   #04 card items: name (never broken mid-word) then qty × unit; "RM" never
       splits; two items then "+N more"; Reference Total, View / Load kept.
   #05 a selected customer on the phone: name, contact, "N saved · latest" up
       front; the four figures and remarks one tap away — nothing removed.
   #12 the search examples show while searching, not permanently.
   #15 desktop quotation cards are compact and keep all four actions.
   #20 KPI 2 × 2 at 768 and 1024; four in a row at 1280+; numbers unbroken.
   #21 tablet portrait: cards two to a row; landscape: master / detail; a
       rotation keeps the selected customer and the search text.          */
'use strict';
const { openCompanies } = require('../lib/harness');
const LONG = 'ALPHA STEEL STRUCTURE ENGINEERING AND FABRICATION WORKS SDN BHD (KLANG)';
const item = k => ({ itemType: 'sagrod', desc: k % 3 === 1 ? 'MS UNDERSIZE SAG ROD' : 'MS FULLSIZE SAG ROD', size: 'M12 x L 1000 x TL 100/100mm', material: 'MS', finish: 'HDG',
  qty: 40 + k, finalUnitPrice: 7.9 + k / 10, totalAmount: (40 + k) * (7.9 + k / 10), pricingModel: k % 2 ? 'accessory-inclusive' : '', accessoryUnitPrice: k % 2 ? 0.94 : 0 });
const q = (id, n, tot) => ({ id, ref_no: 'Q-2026-00' + id, quote_date: '2026-02-14', created_at: '2026-02-14 09:15:00', customer_name: LONG, company_id: 7, company_name: LONG,
  prepared_by: 'Nicholas', remarks: 'Price subject to change without prior notice', total_amount: tot, items: Array.from({ length: n }, (_, k) => item(k)) });
const API = { get_companies: { ok: true, data: [{ id: 7, name: LONG, short_code: 'ALPHA', phone: '03-1234 5678', quotation_count: 3, latest_quotation_date: '2026-02-14' }] },
  get_quotations: { ok: true, data: [q(41, 4, 1336.8), q(42, 2, 644), q(43, 4, 1234567.89)], total: 3 }, get_quotation: { ok: true, data: q(41, 4, 1336.8) } };
const BROKEN = `(sel) => [...document.querySelectorAll(sel)].filter(n => n.offsetParent).flatMap(t => { const range = document.createRange(), out = [], walk = document.createTreeWalker(t, NodeFilter.SHOW_TEXT); let n;
  while ((n = walk.nextNode())) { const s = n.textContent; for (let i = 1; i < s.length; i++) { if (/\\s/.test(s[i - 1]) || /\\s/.test(s[i])) continue;
    range.setStart(n, i - 1); range.setEnd(n, i); const a = range.getBoundingClientRect(); range.setStart(n, i); range.setEnd(n, i + 1); const b = range.getBoundingClientRect();
    if (b.top > a.top + 2) out.push(s.slice(Math.max(0, i - 4), i + 4)); } } return out; })`;
const select = async p => { await p.evaluate(() => selectCompany(7)); await p.waitForTimeout(300); };

module.exports = async (browser, A) => {
  A.suite('81 R2.5 Session C: Saved / Customers');
  for (const w of [320, 375, 393, 402, 430]) for (const lang of ['en', 'zh']) {
    const p = await openCompanies(browser, { viewport: { width: w, height: 852 }, lang, api: API }); await select(p);
    const tag = `${w} ${lang}`;
    const c = await p.evaluate(() => {
      const card = document.querySelector('#companyQuotesList .q-card'), lines = [...card.querySelectorAll('.item-line')];
      return { lines: lines.length, names: lines.map(l => l.querySelector('.il-name').textContent.trim()), qp: lines.map(l => l.querySelector('.il-qp').textContent.replace(/\s+/g, ' ').trim()),
        more: (card.querySelector('.item-more') || {}).textContent || '', money: [...card.querySelectorAll('.money')].every(m => m.getBoundingClientRect().height < parseFloat(getComputedStyle(m).fontSize) * 1.7),
        total: card.querySelector('.ref-total b').textContent, view: !!card.querySelector('.btn-view').offsetParent, load: !!card.querySelector('.btn-amber').offsetParent,
        within: [...card.querySelectorAll('*')].every(n => n.getBoundingClientRect().right <= card.getBoundingClientRect().right + 0.5) }; });
    A.eq(c.lines, 2, `${tag}: a 4-item card previews two items`);
    A.ok(/2/.test(c.more), `${tag}: then "+2 more" (${c.more.trim()})`);
    A.ok(c.names.every(n => /SAG ROD/.test(n)) && c.qp[0] === '40 × RM 7.90' && c.qp[1] === '41 × RM 8.00', `${tag}: name, then qty × unit as saved`);
    A.eq(await p.evaluate(`(${BROKEN})('#companyQuotesList .il-name')`), [], `${tag}: no product name broken mid-word`);
    A.ok(c.money && c.within, `${tag}: "RM" never splits; nothing outside the card`);
    A.ok(c.total === 'RM 1,336.80' && c.view && c.load, `${tag}: Reference Total, View and Load kept`);
    /* #05 */
    const s = await p.evaluate(async () => { const panel = document.querySelector('.selected-panel'), vis = n => !!n && n.offsetParent !== null && getComputedStyle(n).display !== 'none';
      const h0 = Math.round(panel.getBoundingClientRect().height), sum = panel.querySelector('.sp-sum').textContent.replace(/\s+/g, ' ').trim(), closed = [vis(panel.querySelector('.sp-stats')), vis(panel.querySelector('.sp-remarks'))];
      const b = panel.querySelector('.sp-more-btn'); b.click(); await new Promise(r => setTimeout(r, 50));
      const open = [vis(panel.querySelector('.sp-stats')), vis(panel.querySelector('.sp-remarks')), panel.querySelectorAll('.sp-stat').length, b.getAttribute('aria-expanded')];
      b.click(); return { h0, sum, closed, open, bh: Math.round(b.getBoundingClientRect().height) }; });
    A.ok(s.h0 <= (w < 375 ? 250 : 215), `${tag}: the customer summary is compact (${s.h0}px)`);
    A.ok(/3/.test(s.sum) && /14/.test(s.sum), `${tag}: saved count and latest date up front (${s.sum})`);
    A.eq([s.closed, s.open, s.bh >= 44], [[false, false], [true, true, 4, 'true'], true], `${tag}: the four figures and remarks one tap away (44px)`);
    A.eq(p._dcErrors, [], `${tag}: no page errors`);
    await p.close();
  }
  /* #12 search examples */
  const h = await openCompanies(browser, { viewport: { width: 393, height: 852 }, api: API });
  const hint = await h.evaluate(async () => { const v = () => getComputedStyle(document.querySelector('.item-search-hint')).display !== 'none', i = document.getElementById('itemSearchInput');
    const a = v(); i.focus(); const b = v(); i.value = 'M16'; i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); const c = v();
    i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); const d = v(); return [a, b, c, d]; });
  A.eq(hint, [false, true, true, false], 'search examples: hidden at rest, shown while searching, hidden when cleared');
  await h.close();
  /* #15 desktop density */
  const d = await openCompanies(browser, { viewport: { width: 1280, height: 900 }, api: API }); await select(d);
  const dc = await d.evaluate(() => { const card = document.querySelector('#companyQuotesList .q-card'); const vis = n => !!n && getComputedStyle(n).display !== 'none';
    return { h: Math.round(card.getBoundingClientRect().height), acts: [...card.querySelectorAll('.quote-actions .btn')].filter(vis).length,
      noDate: Math.abs(card.querySelector('.q-no').getBoundingClientRect().top - card.querySelector('.q-dates').getBoundingClientRect().top) < 6 }; });
  A.ok(dc.h <= 235, `desktop: a 4-item quotation card is compact (${dc.h}px; 267px at R2.4)`);
  A.ok(dc.acts === 4 && dc.noDate, 'desktop: View / Load / Duplicate / Delete kept; date beside the number');
  await d.close();
  /* #20 KPI, #21 tablet flow */
  for (const [w, hgt, cols] of [[768, 1024, 2], [1024, 768, 2], [1280, 900, 4], [1440, 900, 4]]) {
    const p = await openCompanies(browser, { viewport: { width: w, height: hgt }, api: API });
    const k = await p.evaluate(() => { const g = document.getElementById('summaryGrid'), cards = [...g.children];
      const latest = cards[3].querySelector('.summary-value,.sc-value,b,strong') || cards[3];
      return { cols: new Set(cards.map(c => Math.round(c.getBoundingClientRect().left))).size, ref: [...cards[3].querySelectorAll('*')].filter(n => /^Q-2026-0041$/.test(n.textContent.trim())).every(n => n.getBoundingClientRect().height < 40),
        ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    A.eq([k.cols, k.ref, k.ovf], [cols, true, 0], `${w}×${hgt}: KPI ${cols} per row, the latest quotation number on one line`);
    await p.close();
  }
  const t = await openCompanies(browser, { viewport: { width: 768, height: 1024 }, api: API });
  const tp = await t.evaluate(() => { const cs = [...document.querySelectorAll('#rightPanel .rq-card')].map(c => c.getBoundingClientRect()); return { row1: cs.filter(r => Math.abs(r.top - cs[0].top) < 2).length }; });
  A.eq(tp.row1, 2, '768 portrait: recent quotations two to a row');
  await t.evaluate(() => { document.getElementById('itemSearchInput').value = 'M16'; }); await select(t);
  await t.setViewportSize({ width: 1024, height: 768 }); await t.waitForTimeout(250);
  const land = await t.evaluate(() => { const l = document.querySelector('.company-card'), r = document.querySelector('.selected-panel');
    return { side: !!l && !!r && l.getBoundingClientRect().right <= r.getBoundingClientRect().left + 1 && l.offsetParent !== null, sel: !!document.querySelector('.selected-panel'), q: document.getElementById('itemSearchInput').value }; });
  A.eq(land, { side: true, sel: true, q: 'M16' }, '1024 landscape: customers beside the selected customer; selection and search kept');
  await t.setViewportSize({ width: 768, height: 1024 }); await t.waitForTimeout(250);
  A.eq(await t.evaluate(() => [!!document.querySelector('.selected-panel'), document.getElementById('itemSearchInput').value]), [true, 'M16'], 'back to portrait: nothing reset');
  A.eq(t._dcErrors, [], 'tablet: no page errors');
  await t.close();
};
