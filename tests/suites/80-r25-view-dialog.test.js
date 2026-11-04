/* ── R2.5 Session B — the Saved View dialog (#03 phone, #16 desktop) ────────
   Phone 320–430, EN and 中文, 1 / 4 / 30 / 50 items:
     - the dialog fits the screen; Close is a 44px target at the top;
     - one scrolling region (the body) — the action bar never scrolls away;
     - Load & Edit full width, Duplicate / Delete side by side under it, every
       label on ONE horizontal line (no vertical 中文);
     - each item: product name, dimensions, qty × unit, line amount; "RM" never
       splits from its number; values exactly as saved; nothing is written.
   Desktop: one item ≈640px, several items wider; Duplicate / Delete stay on
   the card (R2.4); Escape closes and focus returns to View.
   (Chromium emulation — the installed iOS app is Owner Smoke.)          */
'use strict';
const { openCompanies } = require('../lib/harness');

const LONG = 'ALPHA STEEL STRUCTURE ENGINEERING AND FABRICATION WORKS SDN BHD (KLANG)';
const item = k => ({ itemType: 'sagrod', desc: k % 3 === 1 ? 'MS UNDERSIZE SAG ROD' : 'MS FULLSIZE SAG ROD', size: 'M12 x L ' + (1000 + k * 50) + ' x TL 100/100mm',
  material: 'MS', finish: 'HDG', qty: 40 + k, finalUnitPrice: 7.9 + k / 10, totalAmount: (40 + k) * (7.9 + k / 10),
  pricingModel: k % 2 ? 'accessory-inclusive' : '', accessoryUnitPrice: k % 2 ? 0.94 : 0 });
const quote = n => { const items = Array.from({ length: n }, (_, k) => item(k));
  return { id: 41, ref_no: 'Q-2026-0041', quote_date: '2026-02-14', created_at: '2026-02-14 09:15:00', customer_name: LONG, customer_phone: '012-345 6789',
    company_id: 7, company_name: LONG, prepared_by: 'Nicholas', remarks: 'Price subject to change without prior notice',
    total_amount: n === 50 ? 1234567.89 : items.reduce((s, i) => s + i.totalAmount, 0), items }; };
const api = n => ({ get_quotations: { ok: true, data: [quote(n)], total: 1 }, get_quotation: { ok: true, data: quote(n) } });

const PROBE = `(async () => { const m = document.getElementById('viewModal'), box = m.querySelector('.vm-box'), body = m.querySelector('.vm-body'), acts = m.querySelector('.vm-actions');
  const R = n => n.getBoundingClientRect(), vis = n => !!n && getComputedStyle(n).display !== 'none' && R(n).width > 0;
  body.scrollTop = body.scrollHeight; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const b = R(box), a = R(acts), x = R(m.querySelector('.modal-close'));
  const btn = [...acts.querySelectorAll('.btn')].filter(vis).map(n => { const r = R(n), lh = parseFloat(getComputedStyle(n).fontSize) * 1.6;
    const t = document.createRange(); t.selectNodeContents(n); const rects = [...t.getClientRects()].filter(q => q.width > 0); const tops = new Set(rects.map(q => Math.round(q.top)));
    return { cls: n.className, l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), oneLine: tops.size <= 2 && r.height < 60 }; });
  const money = [...m.querySelectorAll('.money')].map(n => { const r = R(n); return r.height < parseFloat(getComputedStyle(n).fontSize) * 1.7; });
  const scrollers = [...m.querySelectorAll('*')].filter(n => { const cs = getComputedStyle(n); return /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1; }).map(n => n.className);
  return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, w: Math.round(b.width), aBottom: Math.round(a.bottom), aTop: Math.round(a.top),
    xw: Math.round(x.width), xh: Math.round(x.height), xTop: Math.round(x.top), btn, money, scrollers, inner: Math.round(a.width),
    names: [...m.querySelectorAll('.vm-name')].map(n => n.textContent.trim()), dims: m.querySelectorAll('.vm-dims').length,
    amts: [...m.querySelectorAll('.vm-amt')].map(n => n.textContent.trim()), qp: [...m.querySelectorAll('.vm-qp')].map(n => n.textContent.replace(/\\s+/g, ' ').trim()),
    total: m.querySelector('.vm-total .money').textContent.trim(), ref: m.querySelector('#vmRef').textContent,
    ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()`;

module.exports = async (browser, A) => {
  A.suite('80 R2.5 Session B: the Saved View dialog');
  for (const w of [320, 375, 393, 402, 430]) for (const lang of ['en', 'zh']) for (const n of [1, 4, 30, 50]) {
    if (lang === 'en' && (n === 4 || n === 30) && w !== 393) continue;   /* keep the matrix lean: every width × 中文, EN on the ends */
    const p = await openCompanies(browser, { viewport: { width: w, height: 852 }, lang, api: api(n) });
    const writes = []; p.on('request', r => { if (/action=(save|delete|update)/.test(r.url())) writes.push(r.url()); });
    await p.evaluate(() => viewQuote(41)); await p.waitForTimeout(200);
    const r = await p.evaluate(PROBE), q = quote(n), tag = `${w} ${lang} ${n} item(s)`;
    A.ok(r.top >= 0 && r.bottom <= r.vh, `${tag}: the dialog fits the screen (${r.top}–${r.bottom}/${r.vh})`);
    A.ok(r.xw >= 44 && r.xh >= 44 && r.xTop >= 0, `${tag}: Close is a 44px target at the top`);
    A.ok(r.aTop >= r.top && r.aBottom <= r.bottom, `${tag}: the action bar stays in view after scrolling the items to the end`);
    A.ok(r.scrollers.length <= 1 && r.scrollers.every(c => /vm-body/.test(c)), `${tag}: one scrolling region (${r.scrollers.join('|') || 'none needed'})`);
    const load = r.btn.find(b => /vm-load/.test(b.cls)), dup = r.btn.find(b => /btn-ghost vm-more/.test(b.cls)), del = r.btn.find(b => /btn-danger/.test(b.cls));
    A.ok(load && Math.abs(load.w - (r.inner - 28)) <= 2, `${tag}: Load & Edit is full width`);
    A.ok(dup && del && dup.t === del.t && del.l > dup.l && dup.t > load.t, `${tag}: Duplicate and Delete side by side under it`);
    A.ok(r.btn.every(b => b.oneLine && b.h >= 44), `${tag}: every action label on one horizontal line, 44px`);
    A.ok(r.money.length >= n * 2 + 1 && r.money.every(Boolean), `${tag}: "RM" never splits from its amount`);
    A.eq([r.names.length, r.dims], [n, n], `${tag}: every item shows its name and dimensions`);
    A.ok(r.names.every(t => /SAG ROD|L BOLT/.test(t)), `${tag}: product names read as one heading`);
    A.eq(r.amts, q.items.map(i => 'RM ' + i.totalAmount.toFixed(2)), `${tag}: line amounts exactly as saved`);
    A.ok(r.qp.every((t, k) => t.endsWith('× RM ' + q.items[k].finalUnitPrice.toFixed(2))), `${tag}: unit prices exactly as saved`);
    A.eq(r.ref, 'Q-2026-0041', `${tag}: the quotation number in the header`);
    A.eq([r.ovf, writes.length], [0, 0], `${tag}: no sideways scroll; viewing writes nothing`);
    A.eq(p._dcErrors, [], `${tag}: no page errors`);
    await p.close();
  }
  /* a large total keeps its grouping and its RM */
  const big = await openCompanies(browser, { viewport: { width: 320, height: 700 }, api: api(50) });
  await big.evaluate(() => viewQuote(41)); await big.waitForTimeout(150);
  A.eq((await big.evaluate(PROBE)).total, 'RM 1,234,567.89', '320: a seven-figure total shows in full');
  await big.close();
  /* desktop */
  for (const [n, lo, hi] of [[1, 600, 660], [4, 800, 940], [50, 800, 940]]) {
    const p = await openCompanies(browser, { viewport: { width: 1280, height: 800 }, api: api(n) });
    await p.focus('.btn-view'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
    const r = await p.evaluate(PROBE);
    A.ok(r.w >= lo && r.w <= hi, `desktop ${n} item(s): dialog width ${r.w} within ${lo}–${hi}`);
    A.ok(r.top >= 0 && r.bottom <= r.vh && r.aBottom <= r.bottom, `desktop ${n}: fits the window, actions in view`);
    A.ok(!r.btn.some(b => /vm-more/.test(b.cls)) && r.btn.some(b => /vm-load/.test(b.cls)) && r.btn.some(b => /vm-close/.test(b.cls)), `desktop ${n}: Load & Edit and Close; Duplicate / Delete stay on the card`);
    await p.keyboard.press('Tab');
    A.ok(await p.evaluate(() => document.activeElement.classList.contains('modal-close')), `desktop ${n}: Tab reaches Close first`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(80);
    A.ok(await p.evaluate(() => !document.getElementById('viewModal').classList.contains('open') && document.activeElement.classList.contains('btn-view')), `desktop ${n}: Escape closes; focus back on View`);
    await p.close();
  }
};
