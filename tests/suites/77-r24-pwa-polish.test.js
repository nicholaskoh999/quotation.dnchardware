/* ── R2.4 Session D — PWA responsive / final polish ─────────────────────────
   One coherent app at 320 / 375 / 393 / 402 / 430 / 600 / 820 / 1024 / 1280 /
   1440 on Quotation and Saved:
     - no sideways scroll anywhere;
     - phones: every visible control a ≥44px target;
     - one input height per width band;
     - a dialog never taller than the screen; Close ≥44px on the phone and
       still in view after scrolling the dialog to its end;
     - the Tools and Account sheets fit; their rows are 48px;
     - the keyboard state hides the bottom navigation on both pages.
   (Chromium emulation — not a claim about the installed iOS app.)      */
'use strict';
const { openApp, openCompanies } = require('../lib/harness');

const AUD = `(() => {
  const W = document.documentElement.clientWidth, out = { overflow: document.documentElement.scrollWidth - W };
  const vis = n => { if (!n.offsetParent && getComputedStyle(n).position !== 'fixed') return false; const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  out.small = []; document.querySelectorAll('button,a[href],select,input:not([type=hidden]):not([type=checkbox]):not([type=radio]),[role=button]').forEach(n => { if (!vis(n)) return;
    if (n.closest('#printSummary,.modal-overlay:not(.open),.rsp-sheet:not(.is-open),#dncShell:not(.is-open)')) return; const r = n.getBoundingClientRect(); if (W < 600 && r.height < 43.5) out.small.push((n.id || String(n.className).split(' ')[0] || n.tagName) + ':' + Math.round(r.height)); });
  out.inputH = [...new Set([...document.querySelectorAll('.field input:not([type=hidden]):not([type=checkbox]):not([type=radio]),.field select')].filter(vis).map(n => Math.round(n.getBoundingClientRect().height)))];
  return out; })()`;

module.exports = async (browser, A) => {
  A.suite('77 R2.4 Session D: PWA responsive / final polish');
  for (const w of [320, 375, 393, 402, 430, 600, 820, 1024, 1280, 1440]) {
    for (const [name, open] of [['Quotation', openApp], ['Saved', openCompanies]]) {
      const p = await open(browser, { viewport: { width: w, height: w < 600 ? 852 : 900 } });
      await p.waitForTimeout(250);
      const r = await p.evaluate(AUD);
      A.eq(r.overflow, 0, `${w} ${name}: no sideways scroll`);
      if (w < 600) A.eq(r.small, [], `${w} ${name}: every control ≥44px`);
      if (r.inputH.length) A.eq(r.inputH.length, 1, `${w} ${name}: one input height (${r.inputH.join('/')})`);
      A.eq(p._dcErrors || [], [], `${w} ${name}: no page errors`);
      await p.close();
    }
  }
  /* dialogs and sheets on the phone */
  for (const w of [320, 402]) {
    const p = await openApp(browser, { viewport: { width: w, height: 740 } });
    for (const [id, open] of [['dpModal', 'openDPModal()'], ['dsModal', 'openDSModal()'], ['refModal', 'openRefModal()'], ['versionUpdatesModal', "openModal('versionUpdatesModal')"], ['wqaModal', 'wqaOpen()'], ['waTemplateModal', "openModal('waTemplateModal')"]]) {
      const r = await p.evaluate(async ([id, open]) => { eval(open); await new Promise(x => setTimeout(x, 200));
        const m = document.getElementById(id), box = m.querySelector('.modal,.wqa-modal') || m, close = m.querySelector('.modal-close');
        box.scrollTop = box.scrollHeight; await new Promise(x => requestAnimationFrame(() => requestAnimationFrame(x)));
        const b = box.getBoundingClientRect(), c = close.getBoundingClientRect();
        const out = { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, cw: Math.round(c.width), ch: Math.round(c.height), cTop: Math.round(c.top), cBottom: Math.round(c.bottom),
          ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        try { closeModal(id); } catch (e) {} m.classList.remove('open'); return out; }, [id, open]);
      A.ok(r.top >= 0 && r.bottom <= r.vh, `${w} ${id}: inside the screen (${r.top}–${r.bottom} of ${r.vh})`);
      A.ok(r.cw >= 44 && r.ch >= 44, `${w} ${id}: Close is a 44px target`);
      A.ok(r.cTop >= 0 && r.cBottom <= r.vh, `${w} ${id}: Close still in view after scrolling to the end`);
      A.eq(r.ovf, 0, `${w} ${id}: no sideways scroll`);
    }
    for (const s of ['tools', 'account']) {
      const r = await p.evaluate(async s => { rspOpen(s); await new Promise(x => setTimeout(x, 260)); const sh = document.querySelector('.rsp-sheet.is-open'); const b = sh.getBoundingClientRect();
        const rows = [...sh.querySelectorAll('.rsp-row')].filter(x => x.offsetParent).map(x => Math.round(x.getBoundingClientRect().height)); rspClose(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, rows }; }, s);
      A.ok(r.top >= 0 && r.bottom <= r.vh + 1 && r.rows.every(h => h >= 44), `${w} ${s} sheet fits, rows ≥44 (${r.rows.join(',')})`);
    }
    await p.close();
  }
  /* the keyboard hides the bottom navigation on both pages */
  for (const [name, open] of [['Quotation', openApp], ['Saved', openCompanies]]) {
    const p = await open(browser, { viewport: { width: 402, height: 874 } });
    const r = await p.evaluate(async () => { document.documentElement.classList.add('kb-open'); await new Promise(x => setTimeout(x, 250));
      const n = document.getElementById('rspNav'), cs = getComputedStyle(n); const o = { pe: cs.pointerEvents, moved: n.getBoundingClientRect().top >= innerHeight - 1 };
      document.documentElement.classList.remove('kb-open'); return o; });
    A.ok(r.pe === 'none' && r.moved, `${name}: with the keyboard up the bottom navigation steps aside`);
    await p.close();
  }
};
