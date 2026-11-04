/* ── R2.5 Session A — form controls (#01 #02 #08 #09) ───────────────────────
   #01 the Date input stays inside its column on every phone, EN and 中文,
       and stays editable; Quotation No unchanged.
   #02 no native select cuts its text: touch-emulated (the iPhone's coarse
       pointer adds 12px padding), every visible select on all 11 products,
       Customer Details and Saved keeps a content box ≥ its line — and its
       height (44px on the phone) is unchanged.
   #08 while Customer Details is open the Quotation No / Date chips are not
       repeated above the fields; closed, they are back.
   #09 中文 labels: one pattern (中文 + DNC code where the field IS that
       dimension); no English-only dimension label left; Markup reads "%".
   (Chromium emulation — the installed iOS app is Owner Smoke.)          */
'use strict';
const { openApp, openCompanies } = require('../lib/harness');
const TYPES = ['sagrod', 'stud', 'anchorbolt', 'ubolt', 'squbolt', 'lbolt', 'lbolt45', 'jbolt', 'plate', 'was', 'others'];
const touch = async p => { const c = await p.context().newCDPSession(p); await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await p.waitForTimeout(80); };
const SEL = `(() => [...document.querySelectorAll('select')].filter(s => s.offsetParent).map(s => { const cs = getComputedStyle(s), fs = parseFloat(cs.fontSize);
  return { id: s.id || String(s.className), h: s.offsetHeight, content: s.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), fs }; }))()`;

module.exports = async (browser, A) => {
  A.suite('79 R2.5 Session A: form controls');
  for (const w of [320, 375, 393, 402, 430]) for (const lang of ['en', 'zh']) {
    const p = await openApp(browser, { viewport: { width: w, height: 852 } }); await touch(p);
    const r = await p.evaluate(async lang => { dcSetLang(lang); const ref0 = document.getElementById('qi-refno').value;
      const metaVis = () => getComputedStyle(document.querySelector('#step1Card .summary-meta')).display !== 'none';
      const closedVis = metaVis(); toggleQIEdit(); await new Promise(x => setTimeout(x, 120));
      const d = document.getElementById('qi-date'), f = d.closest('.field'), card = document.getElementById('step1Card');
      const dr = d.getBoundingClientRect(), fr = f.getBoundingClientRect(), cr = card.getBoundingClientRect();
      d.value = '2026-12-31'; d.dispatchEvent(new Event('input', { bubbles: true }));
      const out = { inField: dr.right <= fr.right + 0.5 && dr.left >= fr.left - 0.5, inCard: dr.right <= cr.right, h: Math.round(dr.height),
        val: d.value, ref: document.getElementById('qi-refno').value === ref0, closedVis, openVis: metaVis(),
        ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      toggleQIEdit(); await new Promise(x => setTimeout(x, 80)); out.reVis = metaVis(); return out; }, lang);
    A.ok(r.inField && r.inCard, `${w} ${lang}: the Date input stays inside its column`);
    A.ok(r.h >= 44, `${w} ${lang}: the Date input is a 44px target (${r.h})`);
    A.eq([r.val, r.ref], ['2026-12-31', true], `${w} ${lang}: the date stays editable; Quotation No unchanged`);
    A.eq(r.ovf, 0, `${w} ${lang}: no sideways scroll`);
    A.eq([r.closedVis, r.openVis, r.reVis], [true, false, true], `${w} ${lang}: No / Date chips shown closed, not repeated while editing`);
    /* #02 every select on every product */
    const clip = [], hts = new Set();
    for (const t of TYPES) { await p.evaluate(t => switchType(t), t);
      for (const s of await p.evaluate(SEL)) { if (s.content < s.fs * 1.2) clip.push(t + ':' + s.id + ':' + s.content); if (/-(material|sizeType|priceMode)$/.test(s.id) && !/^d[ps]-/.test(s.id)) hts.add(s.h); } }
    await p.evaluate(() => toggleQIEdit()); for (const s of await p.evaluate(SEL)) if (s.content < s.fs * 1.2) clip.push('qi:' + s.id + ':' + s.content);
    A.eq(clip, [], `${w} ${lang}: no select cuts its text (11 products + Customer Details)`);
    A.eq([...hts], [44], `${w} ${lang}: product selects keep their 44px height`);
    A.eq(p._dcErrors, [], `${w} ${lang}: no page errors`);
    await p.close();
  }
  /* Saved page selects */
  const c = await openCompanies(browser, { viewport: { width: 393, height: 852 } }); await touch(c);
  A.eq((await c.evaluate(SEL)).filter(s => s.content < s.fs * 1.2).map(s => s.id), [], 'Saved: no select cuts its text');
  await c.close();
  /* #09 labels across all 11 products */
  const p = await openApp(browser, { viewport: { width: 1280, height: 900 } });
  const L = await p.evaluate(async () => { const out = { zh: [], en: [] };
    for (const lang of ['zh', 'en']) { dcSetLang(lang);
      for (const t of ['sagrod', 'stud', 'anchorbolt', 'ubolt', 'squbolt', 'lbolt', 'lbolt45', 'jbolt', 'plate', 'was', 'others']) { switchType(t); await new Promise(x => setTimeout(x, 30));
        document.querySelectorAll('.item-form.active .field > label').forEach(l => { if (l.offsetParent) out[lang].push(t + ':' + l.textContent.replace(/\s+/g, ' ').trim()); }); } }
    return out; });
  const englishOnly = L.zh.filter(s => /:(Diameter|Thread Length|Length|Total Length|Width|Height|Thickness|Hole Dia)\b/i.test(s));
  A.eq(englishOnly, [], '中文: no English-only dimension label on any product');
  A.ok(L.zh.some(s => s === 'sagrod:Ø 直径') && L.zh.some(s => s === 'sagrod:TL 牙长') && L.zh.some(s => s === 'sagrod:L 长度 (mm)'), '中文 Sag Rod: Ø 直径 / TL 牙长 / L 长度 (mm)');
  A.ok(L.zh.some(s => s === 'jbolt:H') && L.zh.some(s => /^jbolt:ID/.test(s)) && L.zh.some(s => s === 'jbolt:S') && L.zh.some(s => s === 'jbolt:总长度'), '中文 J Bolt keeps H / ID / S and the calculated total length');
  /* Size Type / Size keep the owner-approved Size 规格 / 螺纹 Size (shared with Quick Add; 规格类型 is banned wording) */
  A.ok(L.zh.some(s => s === 'sagrod:Size 规格') && L.zh.some(s => s === 'sagrod:螺纹 Size') && !L.zh.some(s => /规格类型/.test(s)), '中文: Size Type / Size keep Size 规格 / 螺纹 Size')
  A.ok(L.zh.filter(s => /:Markup %$/.test(s)).length >= 9 && L.en.filter(s => /:Markup %$/.test(s)).length >= 9, 'Markup reads "Markup %" in both languages');
  A.ok(L.en.some(s => s === 'sagrod:Diameter') && L.en.some(s => s === 'sagrod:Thread Length'), 'English labels unchanged');
  A.eq(p._dcErrors, [], 'labels: no page errors');
  await p.close();
};
