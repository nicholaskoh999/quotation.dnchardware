/* ── R2.5 Session F — tablet adaptive (#17 #18 #19 #22) ─────────────────────
   600–1279px: Item Entry gets the full width; Quotation List (count · total)
   is one tap away on a switch that only shows / hides the two cards — typed
   values, items and drafts survive every switch and every rotation; Step
   links / Load / Edit move it; ←/→ keys work. ≥1280 desktop side by side.
   1180 / 1200 no longer scroll sideways (they did: two columns didn't fit).
   #18 product picker four to a row, 11 products, 44px.
   #19 Customer Details in three rows of fields.
   #22 a field scrolled into view clears the switch and the bottom bar; the
       page ends above the bar.
   (Chromium emulation, not a real iPad.)                                  */
'use strict';
const { openApp } = require('../lib/harness');
const set = (p, vals) => p.evaluate(v => { for (const [i, x] of Object.entries(v)) { const e = document.getElementById(i); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } }, vals);
const state = p => p.evaluate(() => { const vis = id => { const n = document.getElementById(id); return !!n && getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().height > 0; };
  return { sw: vis('erSwitch'), entry: vis('step2Card'), review: vis('step3Card'), len: document.getElementById('sagrod-length').value, rate: document.getElementById('sagrod-costRate').value,
    count: document.getElementById('erCount').textContent, total: document.getElementById('erTotal').textContent, items: quoteItems.length,
    ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });

module.exports = async (browser, A) => {
  A.suite('84 R2.5 Session F: tablet adaptive');
  for (const [w, h] of [[600, 960], [768, 1024], [820, 1180], [1024, 768], [1180, 820], [1200, 900]]) {
    const tag = `${w}×${h}`, p = await openApp(browser, { viewport: { width: w, height: h } });
    await p.evaluate(() => switchType('sagrod'));
    await set(p, { 'sagrod-costRate': '5', 'sagrod-threadLen': '100', 'sagrod-length': '1000' });
    let s = await state(p);
    A.ok(s.sw && s.entry && !s.review, `${tag}: Item Entry, with the switch`);
    A.eq(s.ovf, 0, `${tag}: no sideways scroll`);
    const ew = await p.evaluate(() => document.getElementById('step2Card').getBoundingClientRect().width);
    A.ok(ew >= 560, `${tag}: Item Entry has the width (${Math.round(ew)}px)`);
    await p.evaluate(() => addCurrentItem()); await p.waitForTimeout(250);
    s = await state(p);
    A.ok(s.entry && !s.review && s.count === '1' && /^RM \d/.test(s.total), `${tag}: Add keeps you on Entry; the switch shows 1 · ${s.total}`);
    await set(p, { 'sagrod-length': '1200' });
    await p.click('#erTabReview'); await p.waitForTimeout(100);
    s = await state(p);
    A.ok(!s.entry && s.review && s.items === 1, `${tag}: Quotation List on one tap, the item there`);
    await p.click('#erTabEntry'); await p.waitForTimeout(100);
    s = await state(p);
    A.eq([s.entry, s.len, s.rate, s.items], [true, '1200', '5', 1], `${tag}: back to Entry — the half-typed item is intact`);
    await p.evaluate(() => goToStep(3)); A.ok((await state(p)).review, `${tag}: Step 3 opens the Quotation List`);
    await p.evaluate(() => editItem(0)); await p.waitForTimeout(150); A.ok((await state(p)).entry, `${tag}: Edit on an item opens Item Entry`);
    await p.evaluate(() => cancelItemEdit && cancelItemEdit());
    await p.focus('#erTabEntry'); await p.keyboard.press('ArrowRight');
    A.ok(await p.evaluate(() => document.activeElement.id === 'erTabReview' && document.getElementById('erTabReview').getAttribute('aria-selected') === 'true'), `${tag}: → moves to the Quotation List tab`);
    await p.keyboard.press('ArrowLeft');
    /* #18 */
    const g = await p.evaluate(() => { const b = [...document.querySelectorAll('#typePicker .type-btn')].filter(x => x.offsetParent); const r = b.map(x => x.getBoundingClientRect());
      return { n: b.length, cols: new Set(r.map(x => Math.round(x.left))).size, minH: Math.min(...r.map(x => x.height)) }; });
    const cols = ew >= 600 ? 4 : 3;   /* the R2.4 grid: 4 once the card is ≥560px inside, else 3 */
    A.ok(g.n === 11 && g.cols === cols && g.minH >= 44, `${tag}: product picker — 11 products, ${cols} to a row, ≥44px`);
    /* #19 */
    const c = await p.evaluate(async () => { if (!document.getElementById('qiEdit').classList.contains('open')) toggleQIEdit(); await new Promise(x => setTimeout(x, 100));
      const f = [...document.querySelectorAll('#qiEdit > .field')].filter(x => x.offsetParent); const rows = new Set(f.map(x => Math.round(x.getBoundingClientRect().top)));
      const d = document.getElementById('qi-date'); d.value = '2026-12-01'; d.dispatchEvent(new Event('input', { bubbles: true }));
      return { rows: rows.size, fields: f.length, date: d.value, inside: f.every(x => x.getBoundingClientRect().right <= document.getElementById('step1Card').getBoundingClientRect().right + 0.5) }; });
    A.ok(c.rows === 3 && c.fields === 7 && c.date === '2026-12-01' && c.inside, `${tag}: Customer Details — 7 fields in ${c.rows} rows, date editable`);
    await p.evaluate(() => toggleQIEdit());
    /* #22 */
    const k = await p.evaluate(async () => { const sw = document.getElementById('erSwitch'), bar = document.querySelector('.mobile-bar'), barOn = bar && getComputedStyle(bar).display !== 'none';
      const f = document.getElementById('sagrod-costRate'); f.scrollIntoView({ block: 'start', behavior: 'instant' }); await new Promise(x => setTimeout(x, 60));
      const top = f.getBoundingClientRect().top >= sw.getBoundingClientRect().bottom - 1;
      f.scrollIntoView({ block: 'end', behavior: 'instant' }); await new Promise(x => setTimeout(x, 60));
      const bottom = !barOn || f.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top + 1;
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); await new Promise(x => setTimeout(x, 60));
      const last = [...document.querySelectorAll('#step2Card *')].filter(n => n.offsetParent && n.getBoundingClientRect().height > 0).pop();
      const end = !barOn || document.getElementById('step2Card').getBoundingClientRect().bottom <= bar.getBoundingClientRect().top + 1;
      return { top, bottom, end, barOn }; });
    A.ok(k.top && k.bottom && k.end, `${tag}: a field clears the switch${k.barOn ? ' and the bottom bar; the page ends above the bar' : ''}`);
    A.eq(p._dcErrors, [], `${tag}: no page errors`);
    await p.close();
  }
  /* rotation keeps everything */
  const p = await openApp(browser, { viewport: { width: 768, height: 1024 } });
  await p.evaluate(() => switchType('sagrod')); await set(p, { 'sagrod-costRate': '5', 'sagrod-threadLen': '100', 'sagrod-length': '1000' });
  await p.evaluate(() => addCurrentItem()); await set(p, { 'sagrod-length': '1500' }); await p.click('#erTabReview');
  for (const [w, h] of [[1024, 768], [768, 1024], [1280, 900], [768, 1024]]) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(200);
    const s = await state(p);
    A.eq([s.items, s.len, s.rate, s.ovf], [1, '1500', '5', 0], `rotate to ${w}×${h}: item, half-typed entry and values kept`);
    if (w === 1280) A.ok(!s.sw && s.entry && s.review, '1280: desktop — both panels side by side, no switch');
  }
  A.eq(p._dcErrors, [], 'rotation: no page errors');
  await p.close();
};
