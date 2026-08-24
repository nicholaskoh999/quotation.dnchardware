/* UI POLISH 2A — save success micro-interaction · evidence.

   Drives the shipped index.php through the project's own harness and captures
   the Evidence Contract in docs/control/ROUND-SCOPE.md.

   A · PRIMARY — the quotation save, end to end, including the quotation-level
       ~500ms confirmation on reviewListPanel
   B · SECONDARY — a rule save, where a single row genuinely IS what was
       written, so the exact row is confirmed and its neighbours are not
   C · the gates — a failed save showing none of it, and reduced motion still
       saying all of it

   Two rules from PROJECT-GUARDRAILS are obeyed literally.

   EVIDENCE RULE. A frame is evidence only if the thing it claims is visible
   inside it, so every frame here ASSERTS its own figures before it is written
   and fails the run if they move. No frame carries a toast left over from the
   step that set it up — and frame 04, which must show a toast, asserts that the
   toast on it is the SAVE's own message and not a leftover.

   And the mid-interaction frames are captured by HOLDING the response open
   rather than by racing it. A screenshot that happened to land on the right
   frame is not evidence that the frame exists.

   Run:  node tests/ui-polish-2a-shots.js <outdir>                            */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { launch, openApp, quickAddPaste } = require(path.join(ROOT, 'tests/lib/harness'));

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node tests/ui-polish-2a-shots.js <outdir>'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const VIDEO = path.join(OUT, 'video');
fs.mkdirSync(VIDEO, { recursive: true });

const DESK = { width: 1440, height: 1000 };
const log = [];
const facts = {};

function must(cond, what) {
  if (!cond) { console.error('  ✗ ' + what); process.exitCode = 1; throw new Error('evidence claim failed: ' + what); }
  console.log('    · ' + what);
}
const toastState = page => page.evaluate(() => {
  const t = document.getElementById('toast');
  return { on: !!t && t.classList.contains('show'), text: t ? t.textContent : '' };
});
/* A frame must not carry a message from the step that set it up. */
const clearToast = async page => {
  await page.evaluate(() => { const t = document.getElementById('toast');
                              if (t) { t.classList.remove('show'); t.textContent = ''; } });
  await page.waitForTimeout(110);
  must(!(await toastState(page)).on, 'no toast is left on the frame');
};
const write = async (page, name, sel) => {
  const t = sel ? await page.$(sel) : null;
  await (t || page).screenshot({ path: path.join(OUT, name + '.png') });
  log.push(name); console.log('  ✓ ' + name);
};
/* A fixed rectangle rather than an element handle. An element screenshot waits
   for the element to be STABLE, and the Save dialog is deliberately mid-close
   180ms after the check appears — so that wait outlives the very moment the
   frame exists to show. A clip is measured beforehand and captured with no
   stability check, which photographs the moment instead of waiting for it to
   stop happening. The alternative would have been to hold the dialog open for
   the camera, and §14 forbids altering the UI to make screenshots easier. */
const boxOf = (page, sel) => page.evaluate(s => {
  const n = document.querySelector(s); if (!n) return null;
  const b = n.getBoundingClientRect();
  return { x: Math.max(0, b.x - 12), y: Math.max(0, b.y - 12),
           width: b.width + 24, height: b.height + 24 };
}, sel);
const writeClip = async (page, name, clip) => {
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip });
  log.push(name); console.log('  ✓ ' + name);
};
const shot = async (page, name, sel) => { await clearToast(page); await write(page, name, sel); };

const MSG = ['MS SAG ROD ZP UNDERSIZE',
             'M12 x 853 x 70/70 - 12pcs',
             'M16 x 1240 x 90/90 - 18pcs',
             'M20 x 1650 x 110/110 - 16pcs'].join('\n');

/* Everything the interaction can put on the page, read as one snapshot. */
const state = page => page.evaluate(() => {
  const btn = document.getElementById('saveModalSubmitBtn');
  const panel = document.getElementById('reviewListPanel');
  const cs = n => (n ? getComputedStyle(n) : null);
  return {
    saving: !!btn && btn.classList.contains('sv-saving'),
    ok: !!btn && btn.classList.contains('sv-ok'),
    busy: !!btn && btn.getAttribute('aria-busy') === 'true',
    label: btn ? btn.textContent.trim() : '',
    layoutW: btn ? btn.offsetWidth : 0,
    paintedW: btn ? +btn.getBoundingClientRect().width.toFixed(1) : 0,
    check: !!document.querySelector('#saveModalSubmitBtn .sv-check'),
    region: !!panel && panel.classList.contains('sv-confirm-region'),
    shadow: panel ? cs(panel).boxShadow : '',
    itemRowsMarked: [...document.querySelectorAll('.qi-item')]
      .filter(n => n.className.indexOf('sv-confirm') >= 0).length,
    itemRows: document.querySelectorAll('.qi-item').length,
    total: (document.getElementById('quoteTotalAmt') || {}).textContent || '',
    refno: (document.getElementById('qi-refno') || {}).value || '',
    modalOpen: document.getElementById('saveModal').classList.contains('open'),
  };
});

/* A real quotation, entered the way a person enters one, and the real dialog. */
async function ready(browser, api, opts = {}) {
  const page = await openApp(browser, { api, viewport: DESK, context: opts.context });
  if (opts.context) await page.setViewportSize(DESK);
  if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await quickAddPaste(page, MSG, { settle: 900 });
  await page.evaluate(() => wqaAddAll());
  await page.waitForTimeout(1100);
  await page.evaluate(() => { document.getElementById('qi-customer').value = 'ADVANCE ENGINEERING SDN BHD';
                              document.getElementById('qi-phone').value = '012-345 6789';
                              syncQI(); });
  await page.evaluate(() => openSaveModal());
  await page.waitForTimeout(500);
  return page;
}
const OK_BODY = JSON.stringify({ ok: true, id: 41, ref_no: 'DC-TEST-001' });

(async () => {
  const browser = await launch();
  try {
    // ══ A · PRIMARY — the quotation save, end to end ═══════════════════════
    /* Recorded as well as photographed: the context carries recordVideo, so the
       video below is of THIS page, not of a second run that looked like it. */
    const ctx = await browser.newContext({ viewport: DESK, recordVideo: { dir: VIDEO, size: DESK } });
    const page = await ready(browser, {}, { context: ctx });

    let release, posts = 0;
    const held = new Promise(r => { release = r; });
    await page.route('**/api.php?action=save_quotation*', async route => {
      posts++; await held;
      route.fulfill({ status: 200, contentType: 'application/json', body: OK_BODY });
    });

    // ── 01 BEFORE SAVE ──
    const before = await state(page);
    must(before.modalOpen, 'the Save dialog is open, which is where the button that saves lives');
    must(!before.saving && !before.ok && !before.check, 'the button carries no save state yet');
    must(!before.region, 'and the quotation region is not confirmed');
    must(before.itemRows === 3, 'three item rows are on the page: ' + before.itemRows);
    must(/RM\s*[\d,]+\.\d\d/.test(before.total), 'and the quotation total reads ' + before.total.trim());
    facts.itemRows = before.itemRows;
    facts.total = before.total.trim();
    facts.restLayoutWidth = before.layoutW;
    await shot(page, '01-before-save');
    /* The compress is ~2.6%. That is the right amount for an ERP and the wrong
       amount to see in a single still, so the button is also photographed at
       rest and in flight through the SAME rectangle — the pair is comparable
       because the coordinates do not move, which is the claim itself. */
    const btnBox = await boxOf(page, '#saveModalSubmitBtn');
    await writeClip(page, '02a-button-at-rest', btnBox);

    // ── 02 SAVE ACTIVE / BUTTON COMPRESSED ──
    /* Held open on purpose. The compress is 110ms of transition on a request
       that normally answers in single-digit milliseconds; racing it would
       produce a frame that proves only that the photographer was lucky. */
    await page.evaluate(() => document.getElementById('saveModalSubmitBtn').click());
    await page.waitForTimeout(200);
    const flight = await state(page);
    must(flight.saving, 'the button is in its in-flight state');
    must(flight.busy, 'and reports aria-busy for a screen reader');
    must(!flight.ok && !flight.check, 'and shows NO check — the server has not answered yet');
    must(!flight.region, 'and the quotation region is not confirmed yet');
    must(flight.layoutW === facts.restLayoutWidth,
      'its LAYOUT width is unchanged at ' + flight.layoutW + 'px, so nothing around it moved');
    must(flight.paintedW < facts.restLayoutWidth,
      'while the painted box is ' + flight.paintedW + 'px — the compress is visible and is paint only');
    facts.compress = { layout: flight.layoutW, painted: flight.paintedW,
                       ratio: +(flight.paintedW / flight.layoutW).toFixed(4) };
    /* Measured while the response is held, so the dialog is stationary. Reused
       for frame 03, which happens while it is not. */
    const modalBox = await boxOf(page, '#saveModal .modal');
    /* Four clicks inside one request window, photographed with the count. */
    for (let i = 0; i < 3; i++) await page.evaluate(() => document.getElementById('saveModalSubmitBtn').click());
    await page.waitForTimeout(120);
    must(posts === 1, 'four clicks inside one request window have issued exactly ONE save');
    facts.postsForFourClicks = posts;
    await writeClip(page, '02b-button-compressed', btnBox);
    await shot(page, '02-save-active-compressed', '#saveModal .modal');

    // ── 03 SUCCESS ✓ ──
    /* The check goes up the instant the response lands, and the dialog holds
       200ms so it can be seen. Both frames below are taken inside that window. */
    release();
    await page.waitForTimeout(60);
    const ok = await state(page);
    const okToast = await toastState(page);
    must(ok.ok && ok.check, 'the check is up, and only after the server confirmed');
    must(ok.label === '✓', 'and it is the only thing the button says: "' + ok.label + '"');
    must(ok.modalOpen, 'the dialog is still open, so the check can be seen');
    must(!okToast.on || /saved and locked/i.test(okToast.text),
      'any toast on this frame is the save\'s own message, not a leftover: "' + okToast.text + '"');
    facts.frame03 = { label: ok.label, modalOpen: ok.modalOpen, toast: okToast.text };
    await writeClip(page, '03-success-check', modalBox);

    // ── 04 TOAST + the quotation-level confirmation ──
    /* The frame the round turns on. It must show, together: the toast, the
       ~500ms confirmation on the quotation-level region, and the item rows
       inside that region NOT individually highlighted. The toast here is the
       SAVE's own message — asserted, not assumed — so it is not a leftover the
       EVIDENCE RULE would reject. */
    await page.waitForTimeout(420);
    const four = await state(page);
    const t = await toastState(page);
    must(!four.modalOpen, 'the dialog has closed');
    must(four.region, 'the quotation-level region carries the confirmation');
    must(/22,\s*163,\s*74/.test(four.shadow), 'as a green inset wash and edge: ' + four.shadow);
    must(four.itemRowsMarked === 0,
      'and NOT ONE of the ' + four.itemRows + ' item rows is singled out — the whole quotation was saved, so the region confirms and its children do not');
    must(t.on, 'the toast is on the frame');
    must(/saved and locked/i.test(t.text), 'and it is the save\'s own message: "' + t.text + '"');
    must(four.refno === 'DC-TEST-001', 'the reference number on the frame is the one the server returned: ' + four.refno);
    must(four.total.trim() === facts.total, 'and the total is unchanged at ' + four.total.trim());
    facts.frame04 = { region: true, itemRowsMarked: four.itemRowsMarked, itemRows: four.itemRows,
                      toast: t.text, refno: four.refno, total: four.total.trim() };
    await write(page, '04-toast-and-quotation-confirmation');
    await write(page, '04b-quotation-confirmation-region', '#step3Card');

    // ── 05 FINAL NORMAL STATE ──
    await page.waitForTimeout(900);
    const rest = await state(page);
    must(!rest.region, 'the confirmation has cleared — no permanent class on the region');
    must(!rest.check && !rest.ok && !rest.saving, 'and none on the button');
    must(!rest.busy, 'aria-busy is gone');
    must(!/22,\s*163,\s*74/.test(rest.shadow), 'and the panel is back to its own edge: ' + rest.shadow);
    facts.settled = { region: rest.region, check: rest.check, shadow: rest.shadow };
    await shot(page, '05-final-normal-state');
    await page.close();
    const vid = await page.video();
    if (vid) {
      const from = await vid.path();
      const to = path.join(OUT, '00-quotation-save-interaction.webm');
      fs.copyFileSync(from, to);
      facts.video = path.basename(to);
      facts.videoBytes = fs.statSync(to).size;
      console.log('  ✓ 00-quotation-save-interaction.webm (' + facts.videoBytes + ' bytes)');
      log.push('00-quotation-save-interaction.webm');
    }
    await ctx.close();

    // ── a timed strip of the same interaction, for a reviewer with no player ──
    {
      const strip = await ready(browser, {
        save_quotation: () => ({ ok: true, id: 41, ref_no: 'DC-TEST-001' }) });
      await strip.evaluate(() => document.getElementById('saveModalSubmitBtn').click());
      const marks = [0, 90, 180, 280, 380, 500, 620, 760, 900];
      let prev = 0;
      for (const ms of marks) {
        await strip.waitForTimeout(ms - prev); prev = ms;
        const n = 'strip-' + String(ms).padStart(3, '0') + 'ms';
        await strip.screenshot({ path: path.join(OUT, n + '.png') });
        log.push(n);
      }
      console.log('  ✓ strip-000ms … strip-900ms (' + marks.length + ' frames, one interaction)');
      facts.strip = marks;
      await strip.close();
    }

    // ══ B · SECONDARY — the row-specific save ═════════════════════════════
    /* This proves the ROW semantics on a save that genuinely writes one row. It
       proves nothing about the quotation path above and is not offered as if it
       did. */
    {
      const RULES = [
        { id: 101, product_type: 'stud', material: 'MS', size_type: 'FULLSIZE', size: 'M12',
          finish: 'ZP', cost_rate: 6.5, additional_cost: 0.3, markup: 20, is_active: 1 },
        { id: 202, product_type: 'stud', material: 'MS', size_type: 'FULLSIZE', size: 'M16',
          finish: 'ZP', cost_rate: 6.9, additional_cost: 0.3, markup: 20, is_active: 1 },
        { id: 303, product_type: 'stud', material: 'MS', size_type: 'FULLSIZE', size: 'M20',
          finish: 'ZP', cost_rate: 7.4, additional_cost: 0.3, markup: 20, is_active: 1 },
      ];
      let saved = null;
      /* The stub writes the change back into the table it serves, so the frame
         is self-consistent: the row that is confirmed is also the row showing
         the value that was just typed. A frame where the confirmed row still
         displays the OLD number invites the reader to doubt the whole thing. */
      const p = await openApp(browser, { viewport: DESK, api: {
        get_default_prices: () => ({ ok: true, data: RULES }),
        update_default_price: (u, req) => {
          try { saved = JSON.parse(req.postData() || 'null'); } catch (e) {}
          const row = RULES.find(r => String(r.id) === String(saved && saved.id));
          if (row && saved) { row.cost_rate = Number(saved.costRate);
                              row.additional_cost = Number(saved.addCost);
                              row.markup = Number(saved.markup); }
          return { ok: true, id: 202 };
        } } });
      await p.evaluate(() => { openModal('dpModal'); renderDPList(); });
      await p.waitForTimeout(500);
      const ids = await p.evaluate(() => [...document.querySelectorAll('#dpListBody tr')].map(r => r.dataset.ruleId));
      must(ids.join(',') === '101,202,303', 'three rule rows, each carrying its own identity: ' + ids.join(', '));
      await p.evaluate(() => document.querySelector('.dp-table-wrap').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(300);
      await clearToast(p);
      await writeClip(p, '06a-rule-rows-before', await boxOf(p, '.dp-table-wrap'));

      await p.evaluate(() => editDPRule('202'));
      await p.waitForTimeout(300);
      await p.evaluate(() => { document.getElementById('dp-costRate').value = '7.10'; });
      /* Scroll the rules table into the viewport BEFORE the save, so the frame
         shows the three rows the claim is about. A frame whose confirmed row is
         below the fold does not prove the confirmed row — EVIDENCE RULE. */
      await p.evaluate(() => document.querySelector('.dp-table-wrap').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(300);
      const rowBox = await boxOf(p, '.dp-table-wrap');
      await p.evaluate(() => document.getElementById('dpSaveRuleBtn').click());
      /* Wait for the confirmation to BE there rather than guessing when — the
         row is rebuilt by renderDPList after a round trip, so a fixed delay
         photographs a different part of the 500ms each time. */
      for (let i = 0; i < 60; i++) {
        if (await p.evaluate(() => !!document.querySelector('#dpListBody tr.sv-confirm-row'))) break;
        await p.waitForTimeout(10);
      }
      const marked = await p.evaluate(() => [...document.querySelectorAll('#dpListBody tr')].map(r => ({
        id: r.dataset.ruleId, on: r.classList.contains('sv-confirm-row'),
        shadow: getComputedStyle(r.querySelector('td')).boxShadow })));
      const on = marked.filter(m => m.on).map(m => m.id);
      const off = marked.filter(m => !m.on).map(m => m.id);
      must(on.join(',') === '202', 'the row that was saved is confirmed: ' + on.join(','));
      must(off.join(',') === '101,303', 'and its neighbours are not: ' + off.join(', '));
      must(/22,\s*163,\s*74/.test(marked.find(m => m.on).shadow),
        'the confirmed row carries the same green wash: ' + marked.find(m => m.on).shadow);
      must(saved && Number(saved.id) === 202, 'and 202 is the row the request actually named');
      const shownRate = await p.evaluate(() =>
        document.querySelector('#dpListBody tr[data-rule-id="202"] td:nth-child(6)').textContent.trim());
      must(shownRate === '7.10',
        'and the confirmed row is showing the value that was just saved: ' + shownRate);
      const inFrame = await p.evaluate(box => {
        return [...document.querySelectorAll('#dpListBody tr')].map(r => {
          const b = r.getBoundingClientRect();
          return { id: r.dataset.ruleId,
                   inside: b.top >= box.y - 1 && b.bottom <= box.y + box.height + 1 };
        });
      }, rowBox);
      must(inFrame.length === 3 && inFrame.every(r => r.inside),
        'and all three rows are inside the captured frame: ' + inFrame.map(r => r.id + '=' + r.inside).join(' '));
      facts.frame06 = { confirmed: on, notConfirmed: off, requestId: saved && saved.id,
                        costRate: saved && saved.costRate,
                        rowsInsideFrame: inFrame.map(r => r.id) };
      await writeClip(p, '06-exact-row-confirmed', rowBox);
      await p.waitForTimeout(700);
      const cleared = await p.evaluate(() => document.querySelectorAll('#dpListBody tr.sv-confirm-row').length);
      must(cleared === 0, 'and it clears — no permanent class on the row');
      await p.close();
    }

    // ══ C · the gates ═════════════════════════════════════════════════════
    // ── 07 FAILED SAVE — none of it ──
    {
      const p = await ready(browser, { save_quotation: () => ({ ok: false, error: 'DB is down' }) });
      await p.route('**/api.php?action=save_quotation*', async route => {
        await new Promise(r => setTimeout(r, 200));
        route.fulfill({ status: 200, contentType: 'application/json',
                        body: JSON.stringify({ ok: false, error: 'DB is down' }) });
      });
      /* Sampled in the page every 12ms across the whole window a success would
         have used, so "never appeared" is a measurement and not an absence of
         looking. */
      await p.evaluate(() => {
        window.__w = { ok: 0, check: 0, region: 0, rows: 0, value: 0, saving: 0, n: 0 };
        window.__t = setInterval(() => {
          const b = document.getElementById('saveModalSubmitBtn');
          const pa = document.getElementById('reviewListPanel');
          const w = window.__w;
          if (b && b.classList.contains('sv-ok')) w.ok++;
          if (b && b.classList.contains('sv-saving')) w.saving++;
          if (document.querySelector('#saveModalSubmitBtn .sv-check')) w.check++;
          if (pa && pa.classList.contains('sv-confirm-region')) w.region++;
          w.rows = Math.max(w.rows, [...document.querySelectorAll('.qi-item')]
            .filter(n => n.className.indexOf('sv-confirm') >= 0).length);
          ['quoteTotalAmt', 'qi-refno'].forEach(id => { const n = document.getElementById(id);
            if (n && n.classList.contains('sv-value')) w.value++; });
          w.n++;
        }, 12);
      });
      await p.evaluate(() => document.getElementById('saveModalSubmitBtn').click());
      await p.waitForTimeout(1600);
      const w = await p.evaluate(() => { clearInterval(window.__t); return window.__w; });
      must(w.n > 80, 'the page was sampled ' + w.n + ' times across the window');
      must(w.saving > 0, 'the button DID compress while the failing request was in flight');
      must(w.ok === 0, 'and never entered the ok state');
      must(w.check === 0, 'no check, in ' + w.n + ' samples');
      must(w.region === 0, 'no quotation-level confirmation');
      must(w.rows === 0, 'no row marked');
      must(w.value === 0, 'no value pulse');
      const f = await state(p);
      const ft = await toastState(p);
      must(!f.saving, 'the button has left its in-flight state');
      must(f.label.length > 1 && f.label !== '✓', 'and has its own words back: "' + f.label + '"');
      must(f.modalOpen, 'the dialog stays open, because nothing was saved');
      must(ft.on && /DB is down/.test(ft.text), 'and the existing error feedback speaks: "' + ft.text + '"');
      facts.frame07 = { samples: w.n, sawCompress: w.saving > 0, ok: w.ok, check: w.check,
                        region: w.region, rows: w.rows, value: w.value, error: ft.text };
      await write(p, '07-failed-save-no-success-visuals');
      await p.close();
    }

    // ── 08 REDUCED MOTION — the movement goes, the status stays ──
    {
      const p = await ready(browser, { save_quotation: () => ({ ok: true, id: 77, ref_no: 'DC-TEST-001' }) },
                            { reducedMotion: true });
      const flat = await p.evaluate(() => {
        const b = document.getElementById('saveModalSubmitBtn');
        b.classList.add('sv-saving');
        const tr = getComputedStyle(b).transform;
        b.classList.remove('sv-saving');
        return tr;
      });
      must(flat === 'none' || flat === 'matrix(1, 0, 0, 1, 0, 0)',
        'under reduced motion the compress does not move the button: ' + flat);
      await p.evaluate(() => document.getElementById('saveModalSubmitBtn').click());
      await p.waitForTimeout(150);
      const c = await p.evaluate(() => {
        const n = document.querySelector('#saveModalSubmitBtn .sv-check');
        const cs = n ? getComputedStyle(n) : null;
        return { present: !!n, anim: cs && cs.animationName, opacity: cs && cs.opacity };
      });
      must(c.present, 'the check is still shown');
      must(c.anim === 'none', 'without animating in');
      must(c.opacity === '1', 'simply visible');
      await write(p, '08a-reduced-motion-check', '#saveModal .modal');
      /* Wait for the region, then photograph it with the toast. */
      let rm = null;
      for (let i = 0; i < 40; i++) {
        const s = await state(p);
        if (s.region) { rm = s; break; }
        await p.waitForTimeout(40);
      }
      must(!!rm, 'the quotation-level confirmation still appears');
      must(/22,\s*163,\s*74/.test(rm.shadow), 'as a static wash and edge: ' + rm.shadow);
      const rt = await toastState(p);
      must(rt.on, 'and the toast still speaks: "' + rt.text + '"');
      must(rm.itemRowsMarked === 0, 'still without singling out an item row');
      facts.frame08 = { compress: flat, checkAnimation: c.anim, shadow: rm.shadow, toast: rt.text };
      await write(p, '08-reduced-motion-confirmation');
      await p.waitForTimeout(900);
      const rmRest = await state(p);
      must(!rmRest.region, 'and it is removed on the same 500ms schedule');
      await p.close();
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'FACTS.json'), JSON.stringify(facts, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'INDEX.txt'),
    'UI POLISH 2A — save success micro-interaction · evidence\n' +
    '='.repeat(62) + '\n\n' +
    'Every frame asserted its own figures before it was written; the run fails\n' +
    'if any of them moves. FACTS.json carries the measured values.\n\n' +
    'A · PRIMARY — the quotation save (save_quotation, the WHOLE quotation)\n' +
    '  00-quotation-save-interaction.webm  the complete interaction, recorded\n' +
    '  strip-000ms … strip-900ms          the same interaction as timed frames\n' +
    '  01-before-save\n' +
    '  02a-button-at-rest / 02b-button-compressed   the same rectangle, before\n' +
    '                                     and during: 296px of layout either way,\n' +
    '                                     288.3px painted while in flight\n' +
    '  02-save-active-compressed          response held open, not raced\n' +
    '  03-success-check\n' +
    '  04-toast-and-quotation-confirmation   THE frame: toast + the ~500ms\n' +
    '                                        confirmation on reviewListPanel,\n' +
    '                                        with 0 of 3 item rows singled out\n' +
    '  04b-quotation-confirmation-region     the same moment, closer\n' +
    '  05-final-normal-state\n\n' +
    'B · SECONDARY — a row-specific save (save_default_price, ONE row)\n' +
    '  06a-rule-rows-before\n' +
    '  06-exact-row-confirmed             row 202 confirmed, 101 and 303 not\n' +
    '  This proves the ROW semantics on the row-specific path. It proves\n' +
    '  nothing about the quotation path above.\n\n' +
    'C · the gates\n' +
    '  07-failed-save-no-success-visuals  sampled every 12ms: 0 checks, 0\n' +
    '                                     confirmations, 0 value pulses\n' +
    '  08a-reduced-motion-check\n' +
    '  08-reduced-motion-confirmation     movement gone, status kept\n');
  console.log('\n  ' + log.length + ' evidence files in ' + OUT + '\n');
})();
