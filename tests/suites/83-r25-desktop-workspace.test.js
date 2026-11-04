/* ── R2.5 Session E — desktop workspace width (#14) ─────────────────────────
   1280 / 1366 / 1440 / 1920 (+1536 ≈ 1920 at 125% zoom): no sideways scroll;
   from 1440 Item Entry ~56% / Review ~44% (Review ≥420px); at 1920 the work
   area uses the screen (≥1500px) instead of 1376px; fields stay a
   comfortable width; Quick Open stays a short field; below 1440 unchanged;
   Tab order and Enter-to-Add unchanged.                                   */
'use strict';
const { openApp } = require('../lib/harness');
module.exports = async (browser, A) => {
  A.suite('83 R2.5 Session E: desktop workspace width');
  for (const [w, share] of [[1280, null], [1366, null], [1440, [0.54, 0.6]], [1536, [0.54, 0.6]], [1920, [0.54, 0.6]]]) {
    const p = await openApp(browser, { viewport: { width: w, height: 900 } });
    const r = await p.evaluate(() => { const R = s => document.querySelector(s).getBoundingClientRect();
      const e = R('#step2Card'), v = R('#step3Card'), m = R('.main');
      return { e: e.width, v: v.width, m: m.width, side: Math.abs(e.top - v.top) < 2, input: R('#sagrod-costRate').width, qo: R('#qoInput').width,
        ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    A.eq(r.ovf, 0, `${w}: no sideways scroll`);
    A.ok(r.side, `${w}: Item Entry and Review side by side`);
    if (share) { const s = r.e / (r.e + r.v); A.ok(s >= share[0] && s <= share[1] && r.v >= 420, `${w}: Entry ${Math.round(s * 100)}% / Review ${Math.round(r.v)}px`); }
    else A.ok(r.e / (r.e + r.v) < 0.54, `${w}: the R2.4 split is kept below 1440`);
    if (w === 1920) A.ok(r.m >= 1500, `1920: the work area uses the screen (${Math.round(r.m)}px, was 1376)`);
    A.ok(r.input <= 300, `${w}: a pricing field stays a comfortable width (${Math.round(r.input)}px)`);
    A.ok(r.qo <= 480, `${w}: Quick Open is a short field (${Math.round(r.qo)}px)`);
    /* Enter-to-Add */
    const n = await p.evaluate(async () => { switchType('sagrod'); const s = (i, v) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
      s('sagrod-costRate', '5'); s('sagrod-threadLen', '100'); s('sagrod-length', '1000'); await new Promise(x => setTimeout(x, 100)); return document.getElementById('quoteCount').textContent; });
    await p.focus('#sagrod-length'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    A.ok(Number(await p.evaluate(() => document.getElementById('quoteCount').textContent)) === Number(n) + 1, `${w}: Enter in Length still adds the item`);
    const tab = await p.evaluate(() => { const order = ['sagrod-diameter', 'sagrod-threadLen', 'sagrod-length']; const all = [...document.querySelectorAll('#form-sagrod input,#form-sagrod select')];
      const idx = order.map(id => all.indexOf(document.getElementById(id))); return idx.every((x, k) => k === 0 || x > idx[k - 1]); });
    A.ok(tab, `${w}: Diameter → Thread Length → Length keeps its Tab order`);
    A.eq(p._dcErrors, [], `${w}: no page errors`);
    await p.close();
  }
};
