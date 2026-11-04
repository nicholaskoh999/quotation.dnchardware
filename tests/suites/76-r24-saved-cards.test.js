/* ── R2.4 Session C — compact Saved / Companies cards on the phone ──────────
   Held at 320 / 375 / 393 / 402 / 430: quotation number prominent with the
   date on its row, company (long names clamp, never overflow), one line of
   product description, Reference Total labelled as reference, View and Load
   distinct and ≥44px, no destructive action on a card (Duplicate / Delete
   are in the View dialog on the phone; Delete still asks), large amounts and
   many items handled, empty results compact, desktop unchanged.        */
'use strict';
const { openCompanies } = require('../lib/harness');

const LONG = 'ALPHA STEEL STRUCTURE ENGINEERING AND FABRICATION WORKS SDN BHD (KLANG)';
const q = (i, extra) => Object.assign({ id: 41 + i, ref_no: 'Q-2026-' + String(41 + i).padStart(4, '0'), quote_date: '2026-02-14', created_at: '2026-02-14 09:15:00',
  customer_name: LONG, company_id: 7, company_name: LONG, prepared_by: 'Nicholas', total_amount: 1234567.89, remarks: 'Long remark text for the card',
  items: Array.from({ length: 6 }, (_, k) => ({ itemType: 'sagrod', description: 'MS FULLSIZE SAG ROD', size: 'M12 x L 1000 x TL 100/100mm', cleanSize: 'M12', material: 'MS', finish: 'ZP', qty: 40 + k, finalUnitPrice: 7.9 })) }, extra || {});

module.exports = async (browser, A) => {
  A.suite('76 R2.4 Session C: compact Saved cards on the phone');
  for (const w of [320, 375, 393, 402, 430]) {
    const page = await openCompanies(browser, { viewport: { width: w, height: 852 }, api: {
      get_companies: { ok: true, data: [{ id: 7, name: LONG, short_code: 'ALPHA', phone: '03-1234 5678', quotation_count: 3 }] },
      get_quotations: { ok: true, data: [q(0), q(1), q(2)], total: 3 }, get_quotation: { ok: true, data: q(0) } } });
    const c = await page.evaluate(() => {
      const card = document.querySelector('#rightPanel .rq-card'); const R = s => { const n = card.querySelector(s); const r = n.getBoundingClientRect(); return { t: Math.round(r.top), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), vis: !!n.offsetParent }; };
      const cr = card.getBoundingClientRect();
      const btn = s => card.querySelector(s);
      return { no: R('.rq-no'), date: R('.rq-date'), co: R('.rq-company'), pv: R('.rq-preview'), total: card.querySelector('.rq-total').innerText.replace(/\s+/g, ' '),
               view: [btn('.btn-view').innerText.trim(), btn('.btn-view').getAttribute('aria-label'), Math.round(btn('.btn-view').getBoundingClientRect().height)],
               load: [btn('.btn-amber').innerText.trim(), btn('.btn-amber').getAttribute('aria-label'), Math.round(btn('.btn-amber').getBoundingClientRect().height)],
               within: [...card.querySelectorAll('*')].every(n => n.getBoundingClientRect().right <= cr.right + 0.5), h: Math.round(cr.height),
               pvOneLine: card.querySelector('.rq-preview').scrollHeight <= 22, noFontPx: parseFloat(getComputedStyle(card.querySelector('.rq-no')).fontSize),
               overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    A.ok(c.no.t === c.date.t || Math.abs(c.no.t - c.date.t) < 6, `${w}: quotation number and date on one row`);
    A.ok(c.noFontPx >= 15, `${w}: quotation number prominent (${c.noFontPx}px)`);
    A.ok(c.co.vis && c.co.h <= 40, `${w}: a long company name shows, clamped to two lines (${c.co.h}px)`);
    A.ok(c.pv.vis && c.pvOneLine, `${w}: one line of product description`);
    A.includes(c.total, 'REFERENCE TOTAL', `${w}: the total is labelled Reference Total`);
    A.includes(c.total, '1,234,567.89', `${w}: a large amount shows in full`);
    A.ok(c.view[0] !== c.load[0] && /read only/.test(c.view[1]) && /Load into Quotation/.test(c.load[1]), `${w}: View and Load distinct in words and names`);
    A.ok(c.view[2] >= 44 && c.load[2] >= 44, `${w}: View and Load ≥44px`);
    A.ok(c.within && c.overflow === 0, `${w}: everything inside the card, no sideways scroll`);
    /* at 320px a seven-figure amount pushes View / Load to their own row — the graceful wrap */
    A.ok(c.h <= (w <= 320 ? 215 : 175), `${w}: the card is compact (${c.h}px)`);
    /* company view: no destructive action on a card; it lives in View */
    await page.evaluate(() => selectCompany(7)); await page.waitForTimeout(250);
    const d = await page.evaluate(() => { const card = document.querySelector('#rightPanel .q-card'); const vis = n => !!n && getComputedStyle(n).display !== 'none' && n.offsetParent !== null;
      return { del: vis(card.querySelector('.btn-danger')), dup: vis(card.querySelector('.quote-actions .btn-ghost')), view: vis(card.querySelector('.btn-view')), load: vis(card.querySelector('.btn-amber')) }; });
    A.ok(!d.del && !d.dup && d.view && d.load, `${w}: company quotation cards carry View and Load only (no Duplicate / Delete on the card)`);
    const m = await page.evaluate(async () => { await viewQuote(41); const vis = n => !!n && getComputedStyle(n).display !== 'none';
      const btns = [...document.querySelectorAll('#viewModal .vm-more')]; let asked = 0, posted = 0; const realC = window.confirm; window.confirm = () => { asked++; return false; };
      const realF = window.fetch; window.fetch = (u, o) => { if (String(u).includes('delete_quotation')) posted++; return realF(u, o); };
      await cpViewDelete(); window.confirm = realC; window.fetch = realF;
      return { shown: btns.map(vis), asked, posted }; });
    A.eq(m.shown, [true, true], `${w}: Duplicate and Delete are in the View dialog`);
    A.eq([m.asked, m.posted], [1, 0], `${w}: Delete asks first — declined, nothing is deleted`);
    A.eq(page._dcErrors, [], `${w}: no page errors`);
    await page.close();
  }
  /* empty results: compact */
  const e = await openCompanies(browser, { viewport: { width: 393, height: 852 }, api: { get_quotations: { ok: true, data: [], total: 0 } } });
  const eh = await e.evaluate(() => { const n = document.querySelector('#rightPanel .empty-state'); return n ? Math.round(n.getBoundingClientRect().height) : -1; });
  A.ok(eh > 0 && eh <= 170, `empty results: a compact empty state (${eh}px)`);
  await e.close();
  /* desktop unchanged */
  const dk = await openCompanies(browser, { viewport: { width: 1280, height: 900 } });
  const dd = await dk.evaluate(async () => { selectCompany(7); await new Promise(r => setTimeout(r, 250)); const card = document.querySelector('#rightPanel .q-card');
    const vis = n => !!n && getComputedStyle(n).display !== 'none'; await viewQuote(41);
    return { del: vis(card.querySelector('.btn-danger')), dup: vis(card.querySelector('.quote-actions .btn-ghost')), vm: [...document.querySelectorAll('#viewModal .vm-more')].map(vis) }; });
  A.eq([dd.del, dd.dup, dd.vm], [true, true, [false, false]], 'desktop: Duplicate / Delete stay on the card, not repeated in View');
  await dk.close();
};
