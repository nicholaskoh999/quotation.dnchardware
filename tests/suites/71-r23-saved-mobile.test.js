/* ── R2.3 Session D — Saved / Companies on the phone ────────────────────────
   Search first; statistics one line, cards on demand; the Recent heading the
   tab already names is not repeated; Add Company is a focused bottom sheet
   (validation and data unchanged); View says it is read-only, Load says it
   loads into Quotation; each tab keeps its own scroll; wording matches the
   tabbed phone layout; desktop untouched.                                 */
'use strict';
const { openCompanies } = require('../lib/harness');

module.exports = async (browser, A) => {
  A.suite('71 R2.3 Session D: Saved / Companies on the phone');
  const many = Array.from({ length: 30 }, (_, i) => ({ id: 41 + i, ref_no: 'Q-2026-' + String(41 + i).padStart(4, '0'), quote_date: '2026-02-14', created_at: '2026-02-14 09:15:00',
    customer_name: 'Alpha Steel Sdn Bhd', company_id: 7, company_name: 'Alpha Steel Sdn Bhd', total_amount: 100 + i, remarks: '', items: [{ itemType: 'sagrod', size: 'M12', cleanSize: 'M12', qty: 1, finalUnitPrice: 1 }] }));
  const page = await openCompanies(browser, { viewport: { width: 402, height: 874 }, api: { get_quotations: { ok: true, data: many, total: 30 } } });
  const r = await page.evaluate(() => {
    const vis = n => !!n && getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().height > 0;
    const top = s => Math.round(document.querySelector(s).getBoundingClientRect().top);
    return { sumLine: vis(document.getElementById('cpSumLine')), sumText: document.getElementById('cpSumText').textContent,
             grid: vis(document.getElementById('summaryGrid')), note: vis(document.querySelector('.summary-note')),
             searchTop: top('#itemSearchInput'), rqHead: vis(document.querySelector('#rightPanel .rq-head')),
             helper: document.querySelector('.q-helper').innerText,
             view: document.querySelector('#rightPanel .btn-view').getAttribute('title'), load: document.querySelector('#rightPanel .btn-amber').getAttribute('title') };
  });
  A.ok(r.sumLine && !r.grid && !r.note, 'statistics collapsed to one line (cards and note hidden)');
  A.includes(r.sumText, '30 saved', `the line says what the cards say (${r.sumText})`);
  A.ok(r.searchTop < 300, `search is near the top, the first action (${r.searchTop}px)`);
  A.ok(!r.rqHead, 'the Recent Quotations heading the tab names is not repeated');
  A.includes(r.helper, 'Open Customers', 'wording matches the tabbed phone layout');
  A.excludes(r.helper, 'on the left', 'never "on the left" on the phone');
  A.includes(r.view, 'read only', 'View says it is read-only');
  A.includes(r.load, 'Load into Quotation', 'Load says it loads into Quotation');
  const ex = await page.evaluate(() => { cpSumToggle(); const o = { grid: getComputedStyle(document.getElementById('summaryGrid')).display, exp: document.getElementById('cpSumLine').getAttribute('aria-expanded') }; cpSumToggle(); return o; });
  A.ok(ex.grid !== 'none' && ex.exp === 'true', 'one press shows the four cards (aria-expanded)');

  /* each tab keeps its place */
  const sc = await page.evaluate(async () => {
    const wait = () => new Promise(x => requestAnimationFrame(() => requestAnimationFrame(x)));
    window.scrollTo({ top: 700, behavior: 'instant' }); await wait(); const a = window.scrollY;
    switchMobTab('customers'); await wait(); const b = window.scrollY;
    switchMobTab('recent'); await wait(); return { a, b, c: window.scrollY };
  });
  A.ok(sc.a > 0 && sc.c === sc.a, `Recent keeps its scroll across a visit to Customers (${sc.a} → ${sc.c})`);
  A.eq(sc.b, 0, 'Customers opens at its own (top) position');

  /* Add Company: a focused bottom sheet, same validation and data */
  await page.evaluate(() => switchMobTab('customers'));
  const sheet = await page.evaluate(() => { toggleAddCompanyForm(); const f = document.getElementById('addCompanyForm'); const r = f.getBoundingClientRect(); const cs = getComputedStyle(f);
    return { pos: cs.position, bottom: Math.round(window.innerHeight - r.bottom), z: +cs.zIndex, focus: document.activeElement && document.activeElement.id, navZ: +getComputedStyle(document.getElementById('rspNav')).zIndex }; });
  A.eq(sheet.pos, 'fixed', 'Add Company opens as a sheet');
  A.ok(Math.abs(sheet.bottom) <= 1, 'anchored to the bottom of the screen');
  A.ok(sheet.z > sheet.navZ, 'above the bottom navigation');
  A.eq(sheet.focus, 'c-name', 'Company Name focused');
  let posted = null;
  await page.route('**/api.php?action=add_company*', r => { posted = JSON.parse(r.request().postData() || 'null'); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 9 }) }); });
  const empty = await page.evaluate(async () => { await addCompany(); return !document.getElementById('addCompanyForm').hidden; });
  A.ok(empty && posted === null, 'an empty name is refused as before (sheet stays, nothing sent)');
  await page.evaluate(async () => { document.getElementById('c-name').value = 'Gamma Works'; document.getElementById('c-code').value = 'gam'; await addCompany(); });
  await page.waitForTimeout(300);
  A.eq(posted && [posted.name, posted.short_code], ['Gamma Works', 'GAM'], 'a company is added with the same data as before');
  A.eq(await page.evaluate(() => [document.getElementById('addCompanyForm').hidden, document.body.classList.contains('cp-sheet-open')]), [true, false], 'the sheet closes after adding');
  await page.evaluate(() => { toggleAddCompanyForm(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
  A.eq(await page.evaluate(() => document.getElementById('addCompanyForm').hidden), true, 'Escape closes the sheet');
  A.eq(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'no sideways scroll');
  A.eq(page._dcErrors, [], 'no page errors');
  await page.close();

  const d = await openCompanies(browser, { viewport: { width: 1280, height: 900 } });
  const dd = await d.evaluate(() => ({ line: getComputedStyle(document.getElementById('cpSumLine')).display, grid: getComputedStyle(document.getElementById('summaryGrid')).display,
    head: getComputedStyle(document.querySelector('#rightPanel .rq-head')).display, sheet: (toggleAddCompanyForm(), getComputedStyle(document.getElementById('addCompanyForm')).position) }));
  A.eq([dd.line, dd.grid !== 'none', dd.head !== 'none', dd.sheet], ['none', true, true, 'static'], 'desktop: cards, heading and inline Add Company unchanged');
  await d.close();
};
