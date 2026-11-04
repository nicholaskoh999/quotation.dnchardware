/* ── R2.3 Session A — compact, keyboard-first entry (desktop / tablet) ──────
   Owner: staff Tab through Accessories and View History on the way to the
   price, and the screen is too tall. Now, for EVERY product form, as read
   from the live DOM (not inferred from names):
     specification → [Unit Convert] → the product's own editable dimensions in
     their existing order → Cost Rate, Additional Cost, Markup, Qty, Price Mode
     → Accessories (one summary button, collapsed) → View History.
   Never a hidden, disabled or read-only control in the sequence. Accessories
   show what is on the item while collapsed; opening them is one press.     */
'use strict';
const { openApp } = require('../lib/harness');

const WIDTHS = [1440, 1024, 820];
const PRICE = ['costRate', 'addCost', 'markup', 'qty', 'priceMode'];
const WAS_PRICE = ['anchorCostRate', 'basePlateCostRate', 'trianglePlateCostRate', 'addCost', 'markup', 'qty', 'priceMode'];

const seq = (page, type) => page.evaluate(t => {
  switchType(t);
  const f = document.getElementById('form-' + t);
  const vis = n => { const cs = getComputedStyle(n); const r = n.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const all = [...f.querySelectorAll('input,select,textarea,button,a[href]')].filter(n => vis(n) && !n.disabled && n.tabIndex >= 0 && !(n.type === 'radio' && !n.checked));
  return all.map(n => ({ id: n.id || '', cls: String(n.className || '').split(' ')[0], ro: !!n.readOnly, hidden: n.type === 'hidden', inPe: !!n.closest('.pe-extras'), radio: n.type === 'radio' }));
}, type);

module.exports = async (browser, A) => {
  A.suite('68 R2.3 Session A: keyboard-first entry, every product, desktop + tablet');
  for (const w of WIDTHS) {
    const page = await openApp(browser, { viewport: { width: w, height: 900 } });
    const types = await page.evaluate(() => [...document.querySelectorAll('.item-form')].map(f => f.dataset.type));
    A.eq(types.length, 11, `${w}: eleven product forms`);
    for (const t of types) {
      const s = await seq(page, t);
      const ids = s.map(x => x.id ? x.id.replace(t + '-', '') : x.cls);
      const price = t === 'was' ? WAS_PRICE : PRICE;
      const pIdx = price.map(k => ids.indexOf(k));
      A.ok(pIdx.every(i => i >= 0), `${w} ${t}: every price input is reachable (${price.join(', ')})`);
      A.ok(pIdx.every((v, i) => !i || v === pIdx[i - 1] + 1), `${w} ${t}: the price inputs follow one another`);
      const first = pIdx[0];
      const before = s.slice(0, first);
      A.ok(!before.some(x => x.inPe || /acc-|ph/.test(x.cls)), `${w} ${t}: no accessory or history control before Cost Rate (${ids.slice(0, first).join(' > ')})`);
      const after = ids.slice(pIdx[pIdx.length - 1] + 1);
      A.eq(after.filter(x => x !== 'manualUnitPrice'), ['acc-sum', 'phViewBtn'], `${w} ${t}: after Price Mode only Accessories, then View History`);
      A.ok(!s.some(x => x.ro || x.hidden), `${w} ${t}: no read-only or hidden control in the sequence`);
      const dims = await page.evaluate(t => { const f = document.getElementById('form-' + t);
        const lbl = f.querySelector(':scope > .group-label .uc-open') ? [...f.querySelectorAll(':scope > .group-label')].find(g => g.querySelector('.uc-open')) : null;
        if (!lbl) return null;
        const out = []; let n = lbl.nextElementSibling;
        while (n && !(n.classList.contains('group-label'))) { n.querySelectorAll && n.querySelectorAll('input[id],select[id]').forEach(i => { if (i.type !== 'radio' && getComputedStyle(i).display !== 'none' && i.offsetParent) out.push(i.id.replace(t + '-', '')); }); n = n.nextElementSibling; }
        return out; }, t);
      if (dims && dims.length) {
        const di = dims.map(d => ids.indexOf(d));
        A.ok(di.every(i => i >= 0) && di.every((v, i) => !i || v > di[i - 1]) && di[di.length - 1] < first,
          `${w} ${t}: dimensions in their existing order, then the price (${dims.join(' > ')})`);
      }
    }
    await page.close();
  }

  /* ── accessories: collapsed to a summary, one press to open ── */
  const page = await openApp(browser, { viewport: { width: 1440, height: 900 } });
  const a = await page.evaluate(() => {
    switchType('jbolt');
    const p = document.getElementById('jbolt-accPanel'), sum = p.querySelector('.acc-sum');
    const vis = n => !!n && getComputedStyle(n).display !== 'none' && n.offsetParent !== null;
    const out = { collapsed: p.classList.contains('acc-collapsed'), exp: sum.getAttribute('aria-expanded'), addVisible: vis(p.querySelector('.acc-add-btn')),
                  text: sum.innerText.replace(/\s+/g, ' ').trim(), inPricing: !!p.closest('.pe-extras') };
    sum.click();
    out.open = { collapsed: p.classList.contains('acc-collapsed'), exp: sum.getAttribute('aria-expanded'), addVisible: vis(p.querySelector('.acc-add-btn')) };
    p.querySelector('.acc-add-btn[data-acc="nut"]').click();
    document.getElementById('jbolt-nutQty').value = '2'; document.getElementById('jbolt-nutPrice').value = '0.20'; onAccChange('jbolt');
    p.querySelector('.acc-add-btn[data-acc="fw"]').click();
    document.getElementById('jbolt-fwQty').value = '1'; document.getElementById('jbolt-fwPrice').value = '0.25'; onAccChange('jbolt');
    sum.click();
    out.withAcc = { collapsed: p.classList.contains('acc-collapsed'), text: sum.innerText.replace(/\s+/g, ' ').trim(), nutHidden: !vis(document.getElementById('jbolt-nutQty')) };
    resetAccPanel('jbolt');
    out.reset = { collapsed: p.classList.contains('acc-collapsed'), text: sum.innerText.replace(/\s+/g, ' ').trim() };
    return out;
  });
  A.ok(a.inPricing, 'Accessories sit inside Pricing Entry');
  A.ok(a.collapsed && a.exp === 'false' && !a.addVisible, 'collapsed by default: + Nut / + FW / + Custom not shown, aria-expanded false');
  A.includes(a.text, 'No accessories', 'collapsed with none: "Accessories · No accessories"');
  A.ok(!a.open.collapsed && a.open.exp === 'true' && a.open.addVisible, 'one press opens it (aria-expanded true)');
  A.ok(a.withAcc.collapsed && a.withAcc.nutHidden, 'closed again with accessories on: fields hidden');
  A.includes(a.withAcc.text, '2 Nut + 1 FW · +RM 0.65', 'and the summary says what is on the item: 2 Nut + 1 FW · +RM 0.65');
  A.ok(a.reset.collapsed && /No accessories/.test(a.reset.text), 'a reset form is collapsed and empty again');

  /* the keyboard still adds: Enter on Cost Rate evaluates; the form adds through the same button */
  const k = await page.evaluate(() => {
    switchType('stud'); const s = (id, v) => { document.getElementById(id).value = v; };
    s('stud-size', 'M12'); onStudSizeCommit(); s('stud-diameter', '12'); s('stud-l', '300'); s('stud-costRate', '2*3'); s('stud-addCost', '1');
    const cr = document.getElementById('stud-costRate'); cr.focus();
    cr.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    const evald = cr.value; quoteItems.length = 0; addStud(); return { evald, n: quoteItems.length };
  });
  A.eq(Number(k.evald), 6, 'Enter on Cost Rate still evaluates "2*3" → 6');
  A.eq(k.n, 1, 'and the item adds as before');
  A.eq(page._dcErrors, [], 'no page errors');
  await page.close();
};
