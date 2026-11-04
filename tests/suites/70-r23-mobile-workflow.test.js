/* ── R2.3 Session C — the phone quotation workflow (Steps 1–4) ──────────────
   Same elements, ids and handlers; a phone layout: Quick Open on one row,
   a compact customer summary that keeps the unsaved status and Edit Details,
   no repeated step sub-captions, a one-line empty list that says what to do,
   Save on its own row with Print / WhatsApp / Copy / Copy + Weight beside one
   another, Quick Add still one press away. Desktop unchanged.            */
'use strict';
const { openApp } = require('../lib/harness');

const box = (page, sel) => page.evaluate(s => { const n = document.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(); const cs = getComputedStyle(n);
  return { top: Math.round(r.top + scrollY), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 0 }; }, sel);

module.exports = async (browser, A) => {
  A.suite('70 R2.3 Session C: phone quotation workflow');
  for (const w of [402, 375]) {
    const page = await openApp(browser, { viewport: { width: w, height: 874 } });
    const qi = await box(page, '#qoInput'), qb = await box(page, '#qoBtn');
    A.ok(qi && qb && Math.abs(qi.top - qb.top) < 2 && qb.left > qi.right, `${w}: Quick Open on one row (input then Open)`);
    A.ok(qi.h >= 44 && qb.h >= 44, `${w}: Quick Open targets ≥44px`);
    const s1 = await box(page, '#step1Card');
    A.ok(s1.h <= 240, `${w}: Step 1 customer summary compact (${s1.h}px, was ~320)`);
    A.ok(!(await box(page, '#step1Card .summary-ava')).shown, `${w}: no large avatar on the phone`);
    const status = await box(page, '#step1Card .quote-status-row');
    A.ok(status && status.shown, `${w}: the quotation status (draft / unsaved) is still shown`);
    const edit = await box(page, '#qiToggleBtn');
    A.ok(edit.shown && edit.h >= 44 && edit.right <= w, `${w}: Edit Details reachable, ≥44px, inside the screen`);
    A.eq(await page.evaluate(() => [...document.querySelectorAll('.step-caption-sub')].filter(n => n.offsetParent).length), 0, `${w}: repeated step sub-captions hidden`);
    const empty = await box(page, '#reviewListPanel');
    A.ok(empty.h <= 130, `${w}: empty Quotation List is compact (${empty.h}px)`);
    A.includes(await page.evaluate(() => document.getElementById('quoteEmpty').innerText), 'Quick Add', `${w}: the empty list says what to do`);
    const save = await box(page, '#saveQuoteBtn');
    const acts = await page.evaluate(() => [...document.querySelectorAll('#step4Actions .quote-actions .btn-sm')].map(b => { const r = b.getBoundingClientRect(); return { t: Math.round(r.top), h: Math.round(r.height), r: Math.round(r.right) }; }));
    A.ok(save.shown && save.h >= 44, `${w}: Save Quotation on its own row`);
    A.ok(acts.length === 4 && acts.every(a => a.t === acts[0].t && a.h >= 44 && a.r <= w), `${w}: Print / WhatsApp / Copy / Copy + Weight on one row, ≥44px, on screen`);
    A.eq(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${w}: no sideways scroll`);
    /* Quick Add still one press away and working */
    const qa = await page.evaluate(() => { const b = document.querySelector('#step2Card .wqa-open-btn'); b.click(); const open = document.getElementById('wqaModal').classList.contains('open'); closeModal('wqaModal'); return { open, h: b.getBoundingClientRect().height }; });
    A.ok(qa.open && qa.h >= 44, `${w}: Quick Add opens from Step 2`);
    /* add two items, edit one: same flow */
    const flow = await page.evaluate(() => { const s = (i, v) => document.getElementById(i).value = v; switchType('sagrod');
      s('sagrod-size', 'M12'); onSizeCommit('sagrod'); s('sagrod-diameter', '12'); s('sagrod-length', '1300'); s('sagrod-threadLen', '100/100'); s('sagrod-qty', '30');
      s('sagrod-costRate', '5'); s('sagrod-addCost', '0.3'); s('sagrod-markup', '20'); calcSagRod(); addSagRod(); s('sagrod-length', '1175'); s('sagrod-qty', '5'); calcSagRod(); addSagRod();
      const n = quoteItems.length; const emptyShown = getComputedStyle(document.getElementById('quoteEmpty')).display !== 'none';
      const btn = document.querySelector('#quoteItemsWrap button[onclick^="editItem"]'); btn && btn.click();
      return { n, emptyShown, editing: editingItemIndex, bottom: document.documentElement.getAttribute('data-rsp-bottom'), total: document.getElementById('quoteTotalAmt').textContent }; });
    A.eq(flow.n, 2, `${w}: items add as before`);
    A.ok(!flow.emptyShown, `${w}: the empty hint goes once there are items`);
    A.ok(flow.editing !== null, `${w}: Edit opens the item for editing (index ${flow.editing})`);
    A.eq(flow.bottom, 'work', `${w}: the quotation bar (Update / Save) is the bottom layer while working`);
    const tb = await box(page, '#quoteTotalBar');
    A.ok(tb.shown && tb.h <= 70, `${w}: Quotation Total is one slim line (${tb.h}px) — the bar carries it too`);
    A.eq(page._dcErrors, [], `${w}: no page errors`);
    await page.close();
  }
  const d = await openApp(browser, { viewport: { width: 1280, height: 900 } });
  const dd = await d.evaluate(() => ({ sub: [...document.querySelectorAll('.step-caption-sub')].filter(n => n.offsetParent).length, ava: getComputedStyle(document.querySelector('#step1Card .summary-ava')).display, hint: getComputedStyle(document.querySelector('#quoteEmpty .qlist-hint')).display }));
  A.ok(dd.sub > 0 && dd.ava !== 'none' && dd.hint === 'none', 'desktop: step sub-captions, avatar and the plain empty state unchanged');
  await d.close();
};
