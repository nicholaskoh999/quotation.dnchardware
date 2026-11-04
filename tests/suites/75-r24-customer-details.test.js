/* ── R2.4 Session B — Customer Details (Step 1) on the phone ────────────────
   Same seven fields, same ids, same handlers; the existing flow (Edit Details
   / Done, values saved as typed, Quotation No read-only, Date editable,
   Issued By the existing company-header list) is authoritative. Held at
   320 / 375 / 393 / 402 / 430 and tablet:
     - Customer and Contact full width; Quotation No + Date on one row;
       Prepared By and Issued By full width; inputs ≥44px; no sideways scroll;
     - Heroicons on the labels and the Quotation No / Date chips;
     - Remarks collapsed to an accurate one-line summary, opened on demand,
       never cleared by collapsing;
     - the header with Edit / Done stays in view while editing;
     - long names, a loaded saved quotation, existing validation.       */
'use strict';
const { openApp } = require('../lib/harness');
const IDS = ['qi-customer', 'qi-phone', 'qi-refno', 'qi-date', 'qi-prepby', 'qi-issued-by', 'qi-remarks'];
const LONG = 'ALPHA STEEL STRUCTURE ENGINEERING SDN BHD (KLANG BRANCH)';

const geo = page => page.evaluate(ids => {
  const R = id => { const n = document.getElementById(id); const r = n.getBoundingClientRect(); return { id, l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), vis: !!n.offsetParent }; };
  return { f: ids.map(R), ro: document.getElementById('qi-refno').readOnly, dateType: document.getElementById('qi-date').type,
           overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
}, IDS);

module.exports = async (browser, A) => {
  A.suite('75 R2.4 Session B: Customer Details on the phone');
  for (const w of [320, 375, 393, 402, 430]) {
    const page = await openApp(browser, { viewport: { width: w, height: 800 } });
    await page.evaluate(() => toggleQIEdit());
    let g = await geo(page);
    const F = Object.fromEntries(g.f.map(x => [x.id, x]));
    A.ok(F['qi-refno'].t === F['qi-date'].t && F['qi-date'].l > F['qi-refno'].l, `${w}: Quotation No + Date on one row`);
    A.ok(['qi-customer', 'qi-phone', 'qi-prepby', 'qi-issued-by'].every(id => F[id].w > w * 0.7), `${w}: Customer, Contact, Prepared By, Issued By full width`);
    A.ok(['qi-customer', 'qi-phone', 'qi-refno', 'qi-date', 'qi-prepby', 'qi-issued-by'].every(id => F[id].h >= 44), `${w}: inputs ≥44px`);
    A.ok(g.ro && g.dateType === 'date', `${w}: Quotation No stays read-only, Date stays an editable date`);
    A.eq(g.overflow, 0, `${w}: no sideways scroll`);
    const icons = await page.evaluate(() => [...document.querySelectorAll('#qiEdit label[data-ic]')].map(l => getComputedStyle(l, '::before').maskImage || getComputedStyle(l, '::before').webkitMaskImage).filter(m => /svg/.test(m)).length);
    A.eq(icons, 7, `${w}: a Heroicon on each of the seven labels`);
    /* Remarks: summary, open, type, collapse — never cleared */
    const rm = await page.evaluate(async () => {
      const b = document.querySelector('.qi-rm-sum'), inp = document.getElementById('qi-remarks'), out = {};
      out.empty = b.innerText.replace(/\s+/g, ' '); out.inputShown = !!inp.offsetParent; out.exp0 = b.getAttribute('aria-expanded');
      b.click(); out.inputShownOpen = !!inp.offsetParent; out.focused = document.activeElement === inp;
      inp.value = 'Price valid 14 days, delivery ex-works Klang'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      b.click(); out.after = b.innerText.replace(/\s+/g, ' '); out.kept = inp.value; return out; });
    A.ok(/None/.test(rm.empty) && !rm.inputShown && rm.exp0 === 'false', `${w}: Remarks collapsed, the summary says None`);
    A.ok(rm.inputShownOpen && rm.focused, `${w}: one press opens Remarks with the box focused`);
    A.includes(rm.after, 'Price valid 14 days', `${w}: collapsed again, the summary shows what was typed`);
    A.eq(rm.kept, 'Price valid 14 days, delivery ex-works Klang', `${w}: collapsing never clears it`);
    /* long name; Done pinned while editing */
    const pin = await page.evaluate(async (L) => {
      const c = document.getElementById('qi-customer'); c.value = L; syncQI();
      document.getElementById('qi-issued-by').scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const d = document.getElementById('qiToggleBtn').getBoundingClientRect();
      return { name: document.getElementById('qiName').textContent, input: c.value, doneTop: Math.round(d.top), doneBottom: Math.round(d.bottom), vh: innerHeight,
               nameOv: document.getElementById('qiName').getBoundingClientRect().right <= document.getElementById('step1Card').getBoundingClientRect().right,
               doneIn: d.right <= document.documentElement.clientWidth };
    }, LONG);
    A.ok(pin.doneTop >= 0 && pin.doneBottom <= pin.vh, `${w}: Done stays in view while editing lower fields (${pin.doneTop})`);
    A.ok(pin.doneIn && pin.nameOv, `${w}: a long customer name stays inside the card, Done inside the screen`);
    A.eq([pin.name, pin.input], [LONG, LONG], `${w}: the long name is stored and shown in full (the header may ellipsis it)`);
    const done = await page.evaluate(() => { toggleQIEdit(); return { open: document.getElementById('qiEdit').classList.contains('open'), label: document.getElementById('qiToggleBtn').textContent.trim(),
      v: ['qi-customer', 'qi-remarks'].map(i => document.getElementById(i).value) }; });
    A.ok(!done.open && /Edit Details/.test(done.label), `${w}: Done closes the form (Edit Details again)`);
    A.eq(done.v, [LONG, 'Price valid 14 days, delivery ex-works Klang'], `${w}: nothing lost on Done`);
    A.eq(page._dcErrors, [], `${w}: no page errors`);
    await page.close();
  }
  /* a saved quotation loaded: values in place, remarks summary accurate */
  const saved = await openApp(browser, { viewport: { width: 402, height: 874 }, handoff: { id: 9, ref_no: 'Q-2026-0099', customer_name: 'BETA METAL WORKS', phone: '012-345 6789',
    prepared_by: 'Nicholas', issued_by: 'DNC HARDWARE SDN. BHD.', remarks: 'Saved remark', quote_date: '2026-10-01', items: [] } });
  const sv = await saved.evaluate(() => { toggleQIEdit(); return { c: document.getElementById('qi-customer').value, r: document.getElementById('qi-remarks').value,
    sum: document.querySelector('.qi-rm-sum .qi-rm-v').textContent, issued: document.getElementById('qi-issued-by').value }; });
  A.eq(sv.c, 'BETA METAL WORKS', 'saved quotation: customer in place');
  A.eq([sv.r, sv.sum], ['Saved remark', 'Saved remark'], 'saved quotation: Remarks summary is the saved text');
  /* Loading a saved quotation does not restore Issued By (existing behaviour, unchanged); nothing is invented. */
  A.ok(sv.issued === '' || sv.issued === 'DNC HARDWARE SDN. BHD.', `saved quotation: Issued By not invented (${JSON.stringify(sv.issued)})`);
  await saved.close();
  /* existing validation unchanged */
  const v = await openApp(browser, { viewport: { width: 402, height: 874 } });
  const val = await v.evaluate(async () => { openSaveModal(); await new Promise(r => setTimeout(r, 150)); const t = document.querySelector('.toast'); return t ? t.textContent : ''; });
  A.includes(val, 'Add items first', 'validation: saving an empty quotation is refused as before');
  await v.close();
  /* tablet: the remarks box is simply there */
  for (const vp of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    const t = await openApp(browser, { viewport: vp });
    const r = await t.evaluate(() => { toggleQIEdit(); return { sum: getComputedStyle(document.querySelector('.qi-rm-sum')).display, inp: !!document.getElementById('qi-remarks').offsetParent,
      ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    A.ok(r.sum === 'none' && r.inp && r.ov === 0, `${vp.width}x${vp.height}: tablet shows the Remarks box directly, no sideways scroll`);
    await t.close();
  }
};
