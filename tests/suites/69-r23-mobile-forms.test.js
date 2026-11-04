/* ── R2.3 Session B — product-aware compact phone entry ─────────────────────
   Held at the iPhone 16 Pro width (402 CSS px) and at 375 / 430:
     - one Product select (all eleven products, same switchType) replaces the
       large button grid; the grid is untouched at ≥600px;
     - every form pairs its fields two to a row, a field left on its own spans
       the row; long selects / choices are full width;
       J Bolt  Ø+H · ID+S · Thread Length+Total Length
       Sag Rod Ø+Thread Length · Length
     - no input narrower than 140px, every input ≥44px tall, labels ≥11px,
       no sideways scroll;
     - Total Length keeps its existing behaviour (auto, overridable) — no
       dimension semantics change;
     - Final Unit Price shown, breakdown on demand; Accessories collapsed.   */
'use strict';
const { openApp } = require('../lib/harness');

const row = (page, ids) => page.evaluate(ids => ids.map(id => { const n = document.getElementById(id); const r = n.getBoundingClientRect(); return { id, top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width) }; }), ids);

module.exports = async (browser, A) => {
  A.suite('69 R2.3 Session B: product-aware phone entry');
  for (const w of [402, 375, 430]) {
    const page = await openApp(browser, { viewport: { width: w, height: 874 } });
    const sel = await page.evaluate(() => { const s = document.getElementById('typeSelect');
      return { shown: getComputedStyle(s.closest('.ptype-m')).display !== 'none', grid: getComputedStyle(document.getElementById('typePicker')).display,
               opts: [...s.options].map(o => o.value), labels: [...s.options].map(o => o.textContent), h: s.getBoundingClientRect().height }; });
    A.ok(sel.shown && sel.grid === 'none', `${w}: a Product select instead of the button grid`);
    A.eq(sel.opts.length, 11, `${w}: all eleven products in it (${sel.labels.join(', ')})`);
    A.ok(sel.h >= 44, `${w}: the select is a ≥44px target`);
    for (const t of sel.opts) {
      const r = await page.evaluate(async t => {
        const s = document.getElementById('typeSelect'); s.value = t; s.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(x => requestAnimationFrame(() => requestAnimationFrame(x)));
        const f = document.getElementById('form-' + t);
        const ins = [...f.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([type=hidden]),select')].filter(n => n.offsetParent && !n.closest('.acc-panel'));
        const labels = [...f.querySelectorAll('.field > label')].filter(n => n.offsetParent).map(n => parseFloat(getComputedStyle(n).fontSize));
        return { active: currentType, narrow: ins.filter(n => n.getBoundingClientRect().width < 140).map(n => n.id), short: ins.filter(n => n.getBoundingClientRect().height < 43.5).map(n => n.id),
                 minLabel: Math.min(...labels), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                 accCollapsed: !!f.querySelector('.acc-panel.acc-collapsed') };
      }, t);
      A.eq(r.active, t, `${w} ${t}: the select switches the product`);
      A.eq(r.narrow, [], `${w} ${t}: no input narrower than 140px`);
      A.eq(r.short, [], `${w} ${t}: every input ≥44px tall`);
      A.ok(r.minLabel >= 11, `${w} ${t}: labels ≥11px (${r.minLabel})`);
      A.eq(r.overflow, 0, `${w} ${t}: no sideways scroll`);
      A.ok(r.accCollapsed, `${w} ${t}: Accessories collapsed in Pricing Entry`);
    }
    /* J Bolt and Sag Rod — the owner's layouts */
    await page.evaluate(() => switchType('jbolt')); await page.waitForTimeout(80);
    const j = await row(page, ['jbolt-diameter', 'jbolt-h', 'jbolt-id', 'jbolt-s', 'jbolt-threadLen', 'jbolt-length']);
    const same = (a, b) => a.top === b.top && a.left < b.left;
    A.ok(same(j[0], j[1]) && same(j[2], j[3]) && same(j[4], j[5]) && j[2].top > j[0].top && j[4].top > j[2].top,
      `${w} J Bolt: Ø+H · ID+S · Thread Length+Total Length (${j.map(x => x.id.replace('jbolt-', '') + '@' + x.top).join(' ')})`);
    const jl = await page.evaluate(() => { const n = document.getElementById('jbolt-length'); return { ro: n.readOnly, ph: n.placeholder, oninput: n.getAttribute('oninput') }; });
    A.eq([jl.ro, jl.oninput], [false, "calcJBolt('jbolt',true)"], `${w} J Bolt: Total Length keeps its existing auto + override behaviour (unchanged)`);
    await page.evaluate(() => switchType('sagrod')); await page.waitForTimeout(80);
    const s = await row(page, ['sagrod-diameter', 'sagrod-threadLen', 'sagrod-length']);
    A.ok(same(s[0], s[1]) && s[2].top > s[0].top && s[2].w > s[0].w * 1.8, `${w} Sag Rod: Ø+Thread Length · Length (full row)`);
    /* price: Final Unit Price first, breakdown on demand */
    const p = await page.evaluate(() => { const vis = id => { const n = document.getElementById(id); return !!n && getComputedStyle(n).display !== 'none' && n.offsetParent !== null; };
      const a = { final: vis('cpFinal'), weight: vis('cpWeight'), mode: vis('priceModePreview'), btn: document.getElementById('cpBreakBtn').getAttribute('aria-expanded') };
      dcCpBreakToggle();
      const b = { weight: vis('cpWeight'), mode: vis('priceModePreview'), btn: document.getElementById('cpBreakBtn').getAttribute('aria-expanded') };
      dcCpBreakToggle(); return { a, b }; });
    A.ok(p.a.final && !p.a.weight && !p.a.mode && p.a.btn === 'false', `${w}: Final Unit Price shown, breakdown hidden`);
    A.ok(p.b.weight && p.b.mode && p.b.btn === 'true', `${w}: Price breakdown opens weight / base / accessories / raw / mode`);
    A.eq(page._dcErrors, [], `${w}: no page errors`);
    await page.close();
  }
  /* desktop untouched: grid, no select, no breakdown button */
  const d = await openApp(browser, { viewport: { width: 1280, height: 900 } });
  const dd = await d.evaluate(() => ({ grid: getComputedStyle(document.getElementById('typePicker')).display, sel: getComputedStyle(document.querySelector('.ptype-m')).display,
    br: getComputedStyle(document.getElementById('cpBreakBtn')).display, weight: getComputedStyle(document.getElementById('cpWeight').closest('.cp-item')).display }));
  A.eq([dd.grid !== 'none', dd.sel, dd.br, dd.weight !== 'none'], [true, 'none', 'none', true], 'desktop: product buttons, no select, full price cards');
  await d.close();
};
