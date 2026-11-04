/* ── R2.5.4 — Edit a locked saved quotation from Step 3 (phone) ──────────────
   Owner: on a long phone quotation, unlocking meant scrolling back to Step 1.
   - New draft: no Step 3 Edit.
   - Loaded + locked, phone 320–430 (EN / 中文): a 44px Edit beside Clear All;
     the Step 1 Edit Saved Quotation is still there; Update Quotation stays
     disabled; nothing in the bottom bar unlocks.
   - Tapping it runs the SAME unlockSavedQuotation(): one confirmation; decline
     keeps it locked; accept unlocks, Edit disappears, Update is enabled, and
     the items are exactly what they were.
   - Tablet (touch) and desktop: not shown — Step 1 is in view there.     */
'use strict';
const { openApp } = require('../lib/harness');
const LONG = 'ALPHA STEEL STRUCTURE ENGINEERING AND FABRICATION WORKS SDN BHD (KLANG)';
const quote = n => ({ id: 41, ref_no: 'Q-2026-0041', quote_date: '2026-02-14', created_at: '2026-02-14 09:15:00', customer_name: LONG, company_id: 7, company_name: LONG, prepared_by: 'Nicholas',
  total_amount: 1, items: Array.from({ length: n }, (_, k) => ({ itemType: 'sagrod', desc: 'MS FULLSIZE SAG ROD', size: 'M12 x L ' + (1000 + k * 50) + ' x TL 100/100mm', cleanSize: 'M12', material: 'MS',
    finish: 'HDG', sizeType: 'FULLSIZE', qty: 40 + k, finalUnitPrice: 7.9 + k / 10, totalAmount: (40 + k) * (7.9 + k / 10) })) });
const ST = `(() => { const b = document.getElementById('reviewUnlockBtn'), r = b.getBoundingClientRect(), cs = getComputedStyle(b);
  const step1 = document.querySelector('#lockedNoticePanel .btn-unlock-primary');
  return { shown: cs.display !== 'none' && r.height > 0, h: Math.round(r.height), text: b.textContent.trim(), locked: !!(loadedSavedQuote && quoteLocked),
    step1: !!step1 && document.getElementById('lockedNoticePanel').classList.contains('show'), save: document.getElementById('saveQuoteBtn').disabled, msave: document.getElementById('mobileSaveBtn').disabled,
    barUnlock: [...document.querySelectorAll('.mobile-bar [onclick]')].some(n => /unlockSavedQuotation/.test(n.getAttribute('onclick'))),
    items: JSON.stringify(quoteItems.map(i => [i.qty, i.finalUnitPrice, i.totalAmount, i.size])), ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()`;
const touch = async p => { const c = await p.context().newCDPSession(p); await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); };

module.exports = async (browser, A) => {
  A.suite('87 R2.5.4: Edit a locked saved quotation from Step 3');
  /* new draft */
  const d = await openApp(browser, { viewport: { width: 393, height: 852 } });
  A.ok(!(await d.evaluate(ST)).shown, 'new draft: no Step 3 Edit');
  await d.close();
  for (const w of [320, 375, 393, 430]) for (const lang of ['en', 'zh']) {
    const tag = `${w} ${lang}`, p = await openApp(browser, { viewport: { width: w, height: 852 }, handoff: quote(30) }); await touch(p);
    if (lang === 'zh') await p.evaluate(() => dcSetLang('zh'));
    await p.waitForTimeout(150);
    let s = await p.evaluate(ST); const items0 = s.items;
    A.ok(s.locked && s.shown && s.h >= 44 && s.text === (lang === 'zh' ? '编辑' : 'Edit'), `${tag}: locked — a 44px ${s.text} beside the Quotation List`);
    A.ok(s.step1 && s.save && s.msave && !s.barUnlock && s.ovf === 0, `${tag}: Step 1 Edit kept; Update disabled; nothing in the bottom bar unlocks; no sideways scroll`);
    /* decline: the same confirmation, still locked */
    let asked = 0; await p.evaluate(() => { window.__c = window.confirm; window.confirm = () => { window.__asked = (window.__asked || 0) + 1; return false; }; });
    await p.click('#reviewUnlockBtn'); asked = await p.evaluate(() => window.__asked || 0);
    s = await p.evaluate(ST);
    A.ok(asked === 1 && s.locked && s.shown && s.save, `${tag}: declining the confirmation keeps it locked`);
    /* accept */
    await p.evaluate(() => { window.__asked = 0; window.confirm = () => { window.__asked++; return true; }; });
    await p.click('#reviewUnlockBtn'); await p.waitForTimeout(150);
    s = await p.evaluate(ST); asked = await p.evaluate(() => window.__asked);
    A.ok(asked === 1 && !s.locked && !s.shown && !s.save && !s.msave, `${tag}: accepted — unlocked, Step 3 Edit gone, Update enabled`);
    A.eq(s.items, items0, `${tag}: the items are exactly as loaded`);
    A.eq(p._dcErrors, [], `${tag}: no page errors`);
    await p.close();
  }
  /* tablet (touch) and desktop: Step 1 is in view, no extra control */
  for (const [w, h, t] of [[768, 1024, 1], [1024, 768, 1], [1180, 820, 1], [1280, 900, 0], [1440, 900, 0]]) {
    const p = await openApp(browser, { viewport: { width: w, height: h }, handoff: quote(6) }); if (t) await touch(p); await p.waitForTimeout(150);
    const s = await p.evaluate(ST);
    A.ok(s.locked && !s.shown && s.step1 && s.save, `${w}×${h}: locked — no Step 3 Edit; Step 1 Edit Saved Quotation as before`);
    await p.close();
  }
};
