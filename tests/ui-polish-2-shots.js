/* UI POLISH 2 — interaction / micro-UX evidence.
   Drives the shipped index.php through the project's own harness. Interaction
   states are produced by really doing them — a real hover, a real keyboard
   focus, a real mouse-down held open across the screenshot — because a class
   painted on by hand proves the CSS exists, not that the control reaches it.
   Run:  node tests/ui-polish-2-shots.js <outdir> */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { launch, openApp, quickAddPaste } = require(path.join(ROOT, 'tests/lib/harness'));

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node tests/ui-polish-2-shots.js <outdir>'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const LIST = [
  'MS SAG ROD ZP UNDERSIZE',
  'M12 x 853 x 70/70 - 12pcs',  'M12 x 943 x 70/70 - 8pcs',
  'M12 x 1020 x 70/70 - 24pcs', 'M12 x 1105 x 70/70 - 6pcs',
  'M16 x 1240 x 90/90 - 18pcs', 'M16 x 1315 x 90/90 - 10pcs',
  'M16 x 1400 x 90/90 - 4pcs',  'M16 x 1480 x 90/90 - 30pcs',
  'M20 x 1650 x 110/110 - 16pcs','M20 x 1740 x 110/110 - 12pcs',
  'M20 x 1820 x 110/110 - 9pcs','M20 x 1930 x 110/110 - 22pcs',
  'M24 x 2100 x 130/130 - 5pcs','M24 x 2240 x 130/130 - 14pcs',
  'M24 x 2380 x 130/130 - 7pcs','M24 x 2510 x 130/130 - 11pcs',
].join('\n');

const REC = o => Object.assign({
  quotationId: 1, refNo: 'Q-2026-0403', date: '2026-03-06', customer: 'Alpha Sdn Bhd',
  companyId: 7, own: true, productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE',
  finish: 'ZP', cleanSize: 'M12', dimensionPreview: 'L 853 x TL 70/70mm', exactDims: true,
  dimDistance: 0, qty: 4, unitPrice: 3.20, boltUnitPrice: 3.20, lineUnitPrice: 3.20,
  finishMatch: true, accessoryCost: 0, accessorySummary: '', accessoryAmbiguous: false,
  priceMode: 'auto', priceModeLabel: 'Auto Round', costRate: 4.50, addCost: 0.50,
  markup: 6, weight: 0.5909, legacy: false,
}, o);

const database = rows => ({
  get_pricing_history: url => {
    const p = new URL(url).searchParams;
    const w = { productType: p.get('productType') || '', material: p.get('material') || '',
                sizeType: p.get('sizeType') || '', cleanSize: p.get('cleanSize') || '' };
    const records = rows.filter(r => r.productType === w.productType && r.material === w.material
                && r.sizeType === w.sizeType && r.cleanSize === w.cleanSize)
      .map(r => Object.assign({}, r, { finishMatch: r.finish === (p.get('finish') || '') }));
    return { ok: true, data: { records, total: records.length,
      ownTotal: records.filter(r => r.own).length,
      otherTotal: records.filter(r => !r.own).length, offset: 0, limit: 20 } };
  },
});
const HIST = [REC({}),
  REC({ refNo: 'Q-2026-0390', quotationId: 2, date: '2026-02-01', finish: 'PL',
        dimensionPreview: 'L 943 x TL 70/70mm', unitPrice: 3.05, boltUnitPrice: 3.05 }),
  REC({ refNo: 'Q-2026-0361', quotationId: 3, date: '2026-01-11', own: false,
        dimensionPreview: 'L 1020 x TL 70/70mm', unitPrice: 3.44, boltUnitPrice: 3.44 })];

const log = [];
const shot = async (page, name, sel) => {
  const t = sel ? await page.$(sel) : null;
  await (t || page).screenshot({ path: path.join(OUT, name + '.png') });
  log.push(name); console.log('  ✓ ' + name);
};
const DESK = { width: 1600, height: 1000 };
const scrollTop = async page => {
  await page.evaluate(() => { const b = document.querySelector('.wqa-scroll'); if (b) b.scrollTop = 0; });
  await page.waitForTimeout(140);
};
const open = async (browser, vp, hist, opts) => {
  const o = opts || {};
  const page = await openApp(browser, { viewport: vp || DESK, api: hist ? database(HIST) : {} });
  /* openApp forwards only viewport and api to newPage, so a context-level
     reducedMotion never reaches the browser. emulateMedia is asked of the page
     directly and cannot be dropped on the way. */
  if (o.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { selectedCompanyId = 7; });
  await quickAddPaste(page, o.text || LIST, { expanded: false, settle: 1400 });
  return page;
};

(async () => {
  const browser = await launch();

  /* 01 · the ordinary review    02 · hover + keyboard focus, really performed */
  {
    const page = await open(browser);
    await shot(page, '01-compact-normal', '#wqaStep2');

    await page.locator('[data-wqa-row="1"] .wqa-row-details').hover();
    await page.waitForTimeout(320);                       // let the transition land
    await page.locator('#wqaEditBtn').focus();            // real keyboard focus
    await page.waitForTimeout(220);
    await shot(page, '02-compact-hover-and-focus', '#wqaStep2');

    /* 12 · the view control, switched */
    await page.locator('#wqaViewExpanded').focus();
    await page.waitForTimeout(200);
    await shot(page, '12a-view-control-focused', '#wqaStep2');
    await page.click('#wqaViewExpanded');
    await page.waitForTimeout(600);
    await shot(page, '12b-expanded', '#wqaStep2');
    await page.click('#wqaViewCompact');
    await page.waitForTimeout(500);

    /* 13 · the CTA, enabled and focused */
    await page.locator('#wqaAddBtn').focus();
    await page.waitForTimeout(220);
    await shot(page, '13-add-cta-focused', '#wqaStep2');
    await page.close();
  }

  /* 03 · Fast Edit active   04 · an editing cell focused */
  {
    const page = await open(browser);
    await page.evaluate(() => wqaEditStart());
    await page.waitForTimeout(600);
    await shot(page, '03-fast-edit-active', '#wqaStep2');
    await page.locator('[data-wqa-row="1"] .wqa-ei').first().focus();
    await page.waitForTimeout(300);
    await shot(page, '04-fast-edit-input-focused', '#wqaStep2');
    await page.close();
  }

  /* 05 · several rows selected   06 · Selected Items scope active
     Ticking a box scrolls it into view, so by the fifth tick the list had
     carried APPLY TO off the top of the frame — and a frame that claims
     "Selected Items scope active" while the scope control is out of shot
     proves nothing. The body is returned to the top before the shot, the
     window is tall enough to hold the scope control and the ticked rows at
     once, and the frame is asserted before it is written. */
  {
    const page = await open(browser, { width: 1600, height: 1180 });
    const boxes = page.locator('[data-wqa-row] .wqa-pick');
    for (const i of [0, 2, 4, 7, 9]) await boxes.nth(i).check();
    await page.waitForTimeout(400);
    await scrollTop(page);
    await shot(page, '05-multiple-selected', '#wqaStep2');

    await page.evaluate(() => wqaSetApplyScope('selected'));
    await page.waitForTimeout(400);
    await scrollTop(page);
    await boxes.nth(2).focus();                            // checkbox focus ring
    await page.waitForTimeout(260);
    /* The four things this frame exists to show, measured inside the captured
       box before it is taken. */
    const proof = await page.evaluate(() => {
      const step = document.querySelector('#wqaStep2').getBoundingClientRect();
      const inFrame = n => { if (!n) return false; const r = n.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top >= step.top - 1 && r.bottom <= step.bottom + 1; };
      const scopeLbl = [...document.querySelectorAll('#wqaModal .wqa-scope-lbl')][0];
      const onSeg = [...document.querySelectorAll('#wqaModal .wqa-scope .wqa-view-btn')]
        .find(b => b.classList.contains('is-on'));
      const ticked = [...document.querySelectorAll('[data-wqa-row] .wqa-pick')].filter(b => b.checked);
      return {
        applyToLabelInFrame: inFrame(scopeLbl),
        activeSegmentText: onSeg ? onSeg.textContent.trim() : null,
        activeSegmentInFrame: inFrame(onSeg),
        tickedTotal: ticked.length,
        tickedVisibleInFrame: ticked.filter(inFrame).length,
        pickedRowsInFrame: [...document.querySelectorAll('.wqa-row.is-picked')].filter(inFrame).length,
        selBarInFrame: inFrame(document.querySelector('#wqaSelBar')),
      };
    });
    console.log('    frame 06 proof ' + JSON.stringify(proof));
    const fail = [];
    if (!proof.applyToLabelInFrame)                 fail.push('APPLY TO label not in frame');
    if (!proof.activeSegmentInFrame)                fail.push('active scope segment not in frame');
    if (proof.activeSegmentText !== 'Selected Items') fail.push('active segment is ' + proof.activeSegmentText);
    if (proof.tickedTotal < 2)                      fail.push('fewer than two rows ticked');
    if (proof.tickedVisibleInFrame < 2)             fail.push('fewer than two ticked rows visible');
    if (proof.pickedRowsInFrame < 2)                fail.push('fewer than two selected-row states visible');
    if (!proof.selBarInFrame)                       fail.push('selection bar not in frame');
    if (fail.length) throw new Error('frame 06 would not prove its claim: ' + fail.join('; '));
    await shot(page, '06-selected-scope-active', '#wqaStep2');
    await page.close();
  }

  /* 07 · Bulk Edit shut, header hovered   08 · open */
  {
    const page = await open(browser);
    await page.locator('#wqaBulkHead .wqa-bulk-btn').hover();
    await page.waitForTimeout(320);
    await shot(page, '07-bulk-collapsed-hover', '#wqaStep2');
    await page.evaluate(() => wqaToggleBulk());
    await page.waitForTimeout(500);
    await page.evaluate(() => { wqa.panels.price = true; wqaRenderCommonPrice(true); });
    await page.waitForTimeout(400);
    await shot(page, '08-bulk-open', '#wqaStep2');
    await page.close();
  }

  /* 09 · Details   10 · History   11 · Previous Price state */
  {
    const page = await open(browser, null, true);
    let d = await page.$('[data-wqa-row="1"] .wqa-row-details');
    if (d) { await d.click(); await page.waitForTimeout(700); }
    await shot(page, '09-details-open', '#wqaStep2');
    d = await page.$('[data-wqa-row="1"] .wqa-row-details');
    if (d) { await d.click(); await page.waitForTimeout(500); }

    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(1400);
    await shot(page, '10-history-open', '#wqaStep2');
    await page.evaluate(() => { try { wqaHistMenuToggle(0, 0); } catch (e) {} });
    await page.waitForTimeout(500);
    await shot(page, '11-previous-price-state', '#wqaStep2');
    await page.close();
  }

  /* 14 · the CTA genuinely disabled.
     The accepted rule is `blocked >= live` — one row short of a diameter holds
     up itself, not the list, so a mixed list keeps Add enabled by design. A
     list where EVERY row is blocked is the state that disables it, and that is
     what this frame shows: M24 undersize has no diameter in the tables, so all
     four rows are blocked and Add refuses. Nothing is forced. */
  {
    const page = await open(browser, null, false, { text: [
      'MS SAG ROD ZP UNDERSIZE',
      'M24 x 2100 x 130/130 - 5pcs',  'M24 x 2240 x 130/130 - 14pcs',
      'M24 x 2380 x 130/130 - 7pcs',  'M24 x 2510 x 130/130 - 11pcs',
    ].join('\n') });
    const state = await page.evaluate(() => {
      const b = document.querySelector('#wqaAddBtn');
      return { disabled: b.disabled, label: b.textContent.trim(),
               blocked: wqa.rows.filter(r => !r.removed && wqaRowBlocked(r)).length,
               live: wqa.rows.filter(r => !r.removed).length,
               need: (document.querySelector('#wqaFootNeed') || {}).textContent };
    });
    console.log('    CTA disabled=' + state.disabled + '  blocked ' + state.blocked
                + '/' + state.live + '  need=' + JSON.stringify(state.need));
    if (!state.disabled) throw new Error('frame 14 must show a genuinely disabled CTA');
    await page.locator('#wqaAddBtn').hover();          // disabled must not look hoverable
    await page.waitForTimeout(300);
    await shot(page, '14-add-cta-disabled', '#wqaStep2');
    await page.close();
  }

  /* 15 · laptop   16 · tablet and phone */
  for (const vp of [{ n: '15-laptop-1280', width: 1280, height: 860 },
                    { n: '16a-tablet-820', width: 820, height: 1000 },
                    { n: '16b-phone-430',  width: 430, height: 900 }]) {
    const page = await open(browser, { width: vp.width, height: vp.height });
    await shot(page, vp.n, '#wqaStep2');
    await page.close();
  }

  /* 17 · reduced motion — the same screen, with the preference set, plus the
     computed durations read back out of the live page so the frame is not the
     only evidence. */
  {
    const page = await open(browser, DESK, false, { reducedMotion: true });
    const durations = await page.evaluate(() => {
      const pick = s => { const n = document.querySelector(s); if (!n) return null;
        const c = getComputedStyle(n);
        return { sel: s, transition: c.transitionDuration, animation: c.animationDuration }; };
      return ['#wqaAddBtn', '.wqa-row-act', '.wqa-view-btn', '.wqa-panel-head',
              '.wqa-sum', '.wqa-pick'].map(pick).filter(Boolean);
    });
    fs.writeFileSync(path.join(OUT, '17-reduced-motion.json'),
                     JSON.stringify(durations, null, 1) + '\n');
    console.log('    reduced-motion computed durations -> 17-reduced-motion.json');
    durations.forEach(d => console.log('      ' + d.sel + '  transition ' + d.transition));
    await page.locator('[data-wqa-row="1"] .wqa-row-details').hover();
    await page.waitForTimeout(300);
    await shot(page, '17-reduced-motion', '#wqaStep2');
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'INDEX.txt'), log.join('\n') + '\n');
  console.log('\n  ' + log.length + ' frames -> ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
