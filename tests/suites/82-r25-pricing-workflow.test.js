/* ── R2.5 Session D — pricing / workflow (#06 #07 #10 #11) ──────────────────
   #06 under Final Unit Price: the current inputs in small print — Cost, Add,
       Markup %, Price Mode (+ accessories) — read from the fields, empty
       fields left out, Manual Price naming only the mode; a suggestion that
       was not applied never appears; display only (the price is the price the
       calculation produced); follows the language.
   #07 phone: the Final Unit Price is one compact row; Step 4 actions are a
       2 × 2 under Save, every label on one line, 44px; the empty list is small.
   #10 phone: Quick Open is one row, Enter and Open still open.
   #11 Unit Convert: a small outlined control (44px target on the phone) that
       still opens the converter.                                          */
'use strict';
const { openApp } = require('../lib/harness');
const set = (p, vals) => p.evaluate(v => { for (const [i, x] of Object.entries(v)) { const e = document.getElementById(i); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } }, vals);
const ctx = p => p.evaluate(() => { const n = document.getElementById('cpCtx'); return n.hidden ? null : n.textContent.replace(/\s+/g, ' ').trim(); });

module.exports = async (browser, A) => {
  A.suite('82 R2.5 Session D: pricing / workflow');
  for (const w of [393, 1280]) {
    const p = await openApp(browser, { viewport: { width: w, height: 900 } });
    await p.evaluate(() => switchType('sagrod'));
    await set(p, { 'sagrod-costRate': '5.2', 'sagrod-addCost': '0.3', 'sagrod-markup': '10', 'sagrod-length': '1000', 'sagrod-threadLen': '100' }); await p.waitForTimeout(150);
    const c1 = await ctx(p), fin = await p.evaluate(() => [document.getElementById('cpFinal').textContent, 'RM ' + Number(priceCalcState.sagrod.finalUnitPrice).toFixed(2)]);
    A.eq(c1, 'Cost 5.20 · Add 0.30 · Markup 10% · Price Mode No Round', `${w}: the inputs behind the price, Sag Rod default No Round`);
    A.eq(fin[0], fin[1], `${w}: the Final Unit Price is the calculation's own figure (${fin[0]})`);
    await set(p, { 'sagrod-addCost': '' }); await p.waitForTimeout(100);
    A.ok(!/Add/.test(await ctx(p)), `${w}: an empty Additional Cost is left out, not shown as 0`);
    const rec = await p.evaluate(() => (document.getElementById('dpStatus') || {}).textContent || '');
    A.ok(!/2\.80/.test(await ctx(p)) && await p.evaluate(() => document.getElementById('sagrod-costRate').value) === '5.2', `${w}: the suggested price is not applied and not shown as an input (${/2\.80/.test(rec) ? 'suggestion 2.80 on screen' : 'no suggestion'})`);
    await p.evaluate(() => { const s = document.getElementById('sagrod-priceMode'); s.value = 'auto'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(100);
    A.ok(/Price Mode Auto Round$/.test(await ctx(p)), `${w}: Auto Round named`);
    await p.evaluate(() => { const s = document.getElementById('sagrod-priceMode'); s.value = 'manual'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(100);
    A.eq(await ctx(p), 'Price Mode Manual Price', `${w}: Manual Price names only the mode`);
    await p.evaluate(() => { const s = document.getElementById('sagrod-priceMode'); s.value = 'no_round'; s.dispatchEvent(new Event('change', { bubbles: true })); dcSetLang('zh'); }); await p.waitForTimeout(150);
    A.ok(/^成本 5.20 · Markup 10% · 价格模式 不进位$/.test(await ctx(p)), `${w}: 中文 follows the language (${await ctx(p)})`);
    await p.evaluate(() => { dcSetLang('en'); switchType('jbolt'); }); await p.waitForTimeout(100);
    A.ok(/Markup 0% · Price Mode Auto Round/.test(await ctx(p) || ''), `${w}: J Bolt: its own inputs (${await ctx(p)})`);
    A.eq(p._dcErrors, [], `${w}: no page errors`);
    await p.close();
  }
  /* #07 #10 #11 on the phone */
  for (const w of [320, 393, 430]) {
    const p = await openApp(browser, { viewport: { width: w, height: 852 } });
    const c = await p.evaluate(TYPE => {
      const R = n => n.getBoundingClientRect(), fin = document.querySelector('#step2Card .cp-final'), lab = fin.querySelector('label'), val = document.getElementById('cpFinal');
      const acts = [...document.querySelectorAll('#step4Actions .quote-actions .btn')].map(b => { const r = R(b); return { t: Math.round(r.top), h: Math.round(r.height), one: b.scrollHeight <= b.clientHeight + 1 && b.scrollWidth <= b.clientWidth + 1 && r.height < 52 }; });
      const qo = document.querySelector('.qo-card'), uc = document.querySelector('#form-sagrod .uc-open');
      return { finH: Math.round(R(fin).height), inline: Math.abs(R(lab).top + R(lab).height / 2 - (R(val).top + R(val).height / 2)) < 8,
        rows: [...new Set(acts.map(a => a.t))].length, actsOk: acts.every(a => a.h >= 44 && a.one), empty: Math.round(R(document.getElementById('quoteEmpty')).height),
        qoH: Math.round(R(qo).height), qoIn: Math.round(R(document.getElementById('qoInput')).height), qoLbl: document.getElementById('qoInput').labels.length,
        ucH: Math.round(R(uc).height), ucBg: getComputedStyle(uc).backgroundColor };
    });
    A.ok(c.finH <= 56 && c.inline, `${w}: Final Unit Price is one compact row (${c.finH}px)`);
    A.ok(c.rows === 2 && c.actsOk, `${w}: Step 4 — Save, then Print / WhatsApp / Copy / Copy + Weight on one row (R2.3), one-line 44px labels`);
    A.ok(c.empty <= 90, `${w}: the empty Quotation List is compact (${c.empty}px)`);
    A.ok(c.qoH <= 66 && c.qoIn >= 44 && c.qoLbl === 1, `${w}: Quick Open is one row (${c.qoH}px), 44px field, still labelled`);
    A.ok(c.ucH >= 44 && /rgba\(0, 0, 0, 0\)|transparent/.test(c.ucBg), `${w}: Unit Convert is an outline control, still a 44px target`);
    let opened = 0; await p.exposeFunction('__qo', () => { opened++; });
    await p.evaluate(() => { window.quickOpen = () => window.__qo(); });
    await p.fill('#qoInput', 'Q-2026-0001'); await p.press('#qoInput', 'Enter'); await p.click('#qoBtn'); await p.waitForTimeout(100);
    A.eq(opened, 2, `${w}: Enter and Open both still open`);
    await p.evaluate(() => document.querySelector('#form-sagrod .uc-open').click()); await p.waitForTimeout(120);
    A.ok(await p.evaluate(() => !document.getElementById('unitConvPanel').hidden), `${w}: Unit Convert still opens the converter`);
    A.eq(p._dcErrors, [], `${w}: no page errors`);
    await p.close();
  }
  const d = await openApp(browser, { viewport: { width: 1280, height: 900 } });
  const uc = await d.evaluate(() => { const b = document.querySelector('#form-sagrod .uc-open'), cs = getComputedStyle(b); return { h: Math.round(b.getBoundingClientRect().height), fs: parseFloat(cs.fontSize), txt: b.textContent.trim() }; });
  A.ok(uc.h <= 32 && uc.fs <= 12 && /Unit Convert/.test(uc.txt), `desktop: Unit Convert is small and secondary (${uc.h}px, ${uc.fs}px), label kept`);
  await d.close();
};
