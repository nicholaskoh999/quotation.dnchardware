/* ── R2.4 Session A — one Product Grid (desktop / tablet) ───────────────────
   Owner: the product boxes look uneven (Sag Rod, L Bolt, L Bolt 45DEG,
   Welding Anchor Set, Others / Special Bolt). Held at 600 / 820 / 1024 /
   1280 / 1440px: equal columns from the card's own width, every button the
   same width AND height, equal gaps, the selection dot centred vertically,
   the name centred and never clipped or broken mid-word, the last row
   left-aligned and not stretched, all 11 products selectable by mouse and
   keyboard, no sideways scroll. Phones keep the Product select.        */
'use strict';
const { openApp } = require('../lib/harness');

module.exports = async (browser, A) => {
  A.suite('73 R2.4 Session A: desktop / tablet product grid');
  for (const w of [600, 820, 1024, 1280, 1440]) {
    const page = await openApp(browser, { viewport: { width: w, height: 900 } });
    const g = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#typePicker .type-btn')];
      const R = n => n.getBoundingClientRect();
      const rects = btns.map(b => { const r = R(b), t = b.querySelector('.t-name'), tr = R(t), dot = getComputedStyle(b, '::before');
        return { type: b.dataset.type, l: r.left, t: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2,
                 tcx: tr.left + tr.width / 2, tcy: tr.top + tr.height / 2, clipX: t.scrollWidth > t.clientWidth + 1, overflowY: tr.bottom > r.bottom + 0.5 || tr.top < r.top - 0.5,
                 dotTop: parseFloat(dot.top), dotMt: parseFloat(dot.marginTop), dotH: parseFloat(dot.height), text: t.textContent.replace(/\s+/g, ' ').trim() }; });
      const cols = [...new Set(rects.map(r => Math.round(r.l)))].sort((a, b) => a - b);
      const rows = [...new Set(rects.map(r => Math.round(r.t)))].sort((a, b) => a - b);
      return { rects, cols, rows, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    const r = g.rects;
    A.eq(r.length, 11, `${w}: eleven products`);
    const spread = k => Math.max(...r.map(x => x[k])) - Math.min(...r.map(x => x[k]));
    A.ok(spread('w') <= 1, `${w}: every button the same width (spread ${spread('w').toFixed(1)}px)`);
    A.ok(spread('h') <= 1, `${w}: every button the same height (spread ${spread('h').toFixed(1)}px, ${Math.round(r[0].h)}px)`);
    A.ok(r[0].h >= 44, `${w}: buttons ≥44px tall`);
    A.ok(g.cols.length >= 3 && g.cols.length <= 4, `${w}: ${g.cols.length} equal columns`);
    const colGaps = g.cols.slice(1).map((c, i) => c - g.cols[i]), rowGaps = g.rows.slice(1).map((c, i) => c - g.rows[i]);
    A.ok(Math.max(...colGaps) - Math.min(...colGaps) <= 1 && Math.max(...rowGaps) - Math.min(...rowGaps) <= 1, `${w}: equal column and row steps`);
    const last = r.filter(x => Math.round(x.t) === g.rows[g.rows.length - 1]);
    A.ok(Math.round(last[0].l) === g.cols[0] && last.every(x => Math.abs(x.w - r[0].w) <= 1), `${w}: the last row starts at column 1 and is not stretched (${last.length} item(s))`);
    A.eq(r.filter(x => x.clipX || x.overflowY).map(x => x.type), [], `${w}: no name clipped or spilling out of its box`);
    A.ok(r.every(x => Math.abs(x.tcx - x.cx) <= 2 && Math.abs(x.tcy - x.cy) <= 2), `${w}: every name centred in its box`);
    A.ok(r.every(x => Math.abs((x.dotTop + x.dotMt + x.dotH / 2) - x.h / 2) <= 1.5), `${w}: every selection dot vertically centred`);
    A.eq(g.overflow, 0, `${w}: no sideways scroll`);
    const words = await page.evaluate(() => [...document.querySelectorAll('#typePicker .t-name')].map(t => {
      const range = document.createRange(); const out = []; const walk = document.createTreeWalker(t, NodeFilter.SHOW_TEXT); let n;
      while ((n = walk.nextNode())) { const s = n.textContent; for (let i = 1; i < s.length; i++) { if (s[i - 1] === ' ' || s[i] === ' ') continue;
        range.setStart(n, i - 1); range.setEnd(n, i); const a = range.getBoundingClientRect(); range.setStart(n, i); range.setEnd(n, i + 1); const b = range.getBoundingClientRect();
        if (b.top > a.top + 2) out.push(s.slice(Math.max(0, i - 4), i + 4)); } }
      return out; }).flat());
    A.eq(words, [], `${w}: no word broken across lines`);
    /* every product selectable: mouse and keyboard */
    const sel = await page.evaluate(async () => { const out = [];
      for (const b of document.querySelectorAll('#typePicker .type-btn')) { b.click(); out.push(currentType === b.dataset.type && b.classList.contains('active')); }
      const j = document.querySelector('#typePicker .type-btn[data-type="jbolt"]'); j.focus();
      const focused = document.activeElement === j; j.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); j.click();
      return { all: out.every(Boolean), focused, now: currentType, outline: getComputedStyle(j).outlineStyle }; });
    A.ok(sel.all, `${w}: all 11 products selectable`);
    A.ok(sel.focused && sel.now === 'jbolt', `${w}: a product button takes keyboard focus and selects`);
    await page.close();
  }
  const m = await openApp(browser, { viewport: { width: 402, height: 874 } });
  A.eq(await m.evaluate(() => [getComputedStyle(document.getElementById('typePicker')).display, getComputedStyle(document.querySelector('.ptype-m')).display]), ['none', 'flex'], 'phone: the Product select stays (R2.3)');
  await m.close();
};
