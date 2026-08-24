/* ── The save that says it saved ────────────────────────────────────────────
   UI POLISH 2A. A save used to answer with one toast and nothing else: the
   button did not move, the number that had just been written did not move, and
   nothing on the page said WHICH thing had reached the database. Worse, two
   clicks inside the request window issued two POSTs.

   The interaction this suite protects is small, and every part of it is gated on
   one fact — the server said ok. So most of what is asserted here is asserted
   TWICE: once that it happens on success, and once that it does NOT happen on
   failure. A success visual that also appears when the save failed is worse than
   no success visual, because a person would stop checking.

   TWO CONFIRMATION SEMANTICS, and they are not interchangeable. That distinction
   is the reason this suite exists in the shape it does, so it is measured rather
   than described:

     · save_quotation writes the WHOLE quotation. There is no single affected
       row, so this round invents none: the ~500ms confirmation goes to
       reviewListPanel, the container holding exactly the items that were
       written, and §2 below asserts that no individual item row is singled out.

     · save_default_price writes exactly ONE rule row. There the confirmation
       goes to that row, and §5 asserts its neighbours stay clean — which is the
       only way to prove the confirmation follows identity and not position.

   §5 proves the ROW semantics on the row-specific path. It proves nothing about
   the quotation path, and is not offered as if it did.                       */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');

const MSG = ['MS SAG ROD ZP UNDERSIZE',
             'M12 x 853 x 70/70 - 12pcs',
             'M16 x 1240 x 90/90 - 18pcs'].join('\n');

/* The accepted save payload, key for key. UI POLISH 2A is not allowed to touch
   it, and "we did not mean to" is not a proof. */
const PAYLOAD_NEW = ['company_id','ref_no','quote_date','valid_until','prepared_by',
                     'remarks','customer_name','customer_phone','items','total_amount'];
/* `id: editingQuoteId||undefined` — JSON.stringify drops an undefined value, so
   a CREATE posts the ten keys above and an UPDATE posts those plus `id`. That is
   the accepted shape and this round must not alter it either way. */
const PAYLOAD_UPDATE = PAYLOAD_NEW.concat('id');

/* Everything the interaction can put on the page. Read as one snapshot so the
   assertions below compare a single moment rather than three drifting ones. */
const shot = page => page.evaluate(() => {
  const btn   = document.getElementById('saveModalSubmitBtn');
  const panel = document.getElementById('reviewListPanel');
  const toast = document.getElementById('toast');
  const cs    = n => (n ? getComputedStyle(n) : null);
  const bs    = cs(btn);
  return {
    btnSaving : !!btn && btn.classList.contains('sv-saving'),
    btnOk     : !!btn && btn.classList.contains('sv-ok'),
    btnBusy   : !!btn && btn.getAttribute('aria-busy') === 'true',
    btnLabel  : btn ? btn.textContent.trim() : '',
    btnWidth  : btn ? btn.offsetWidth : 0,          /* LAYOUT width — a transform must not move it */
    btnPainted: btn ? +btn.getBoundingClientRect().width.toFixed(1) : 0,  /* painted box, which the compress DOES shrink */
    btnScale  : bs ? bs.transform : '',
    check     : !!document.querySelector('#saveModalSubmitBtn .sv-check'),
    region    : !!panel && panel.classList.contains('sv-confirm-region'),
    regionBg  : panel ? cs(panel).backgroundColor : '',
    rowsMarked: [...document.querySelectorAll('.qi-item')]
                  .filter(n => n.className.indexOf('sv-confirm') >= 0).length,
    valueMarked: ['quoteTotalAmt','qi-refno']
                  .filter(id => { const n = document.getElementById(id);
                                  return n && n.classList.contains('sv-value'); }),
    total     : (document.getElementById('quoteTotalAmt')||{}).textContent || '',
    refno     : (document.getElementById('qi-refno')||{}).value || '',
    toastOn   : !!toast && toast.classList.contains('show'),
    toastText : toast ? toast.textContent : '',
    modalOpen : !!document.getElementById('saveModal').classList.contains('open'),
  };
});

/* ── watching from inside the page ─────────────────────────────────────────
   The value pulse lasts 220ms. A snapshot taken from Node costs 30-60ms per
   round trip, so polling from out here samples roughly every 100ms and misses
   short-lived state — and a "never appeared" assertion built on that kind of
   poll is worth nothing, because it cannot distinguish "absent" from "not
   looked at". So the watching happens in the page, every 12ms, from before the
   click until after the interaction has settled. Every window this suite cares
   about is at least 190ms wide, so nothing can slip between two samples. */
const watch = page => page.evaluate(() => {
  window.__sv = { value: {}, region: 0, rows: 0, ok: 0, check: 0, saving: 0, samples: 0 };
  const seen = w => {
    ['quoteTotalAmt','qi-refno','waTemplateInput'].forEach(id => {
      const n = document.getElementById(id);
      if (n && n.classList.contains('sv-value')) w.value[id] = (w.value[id]||0)+1;
    });
    const p = document.getElementById('reviewListPanel');
    if (p && p.classList.contains('sv-confirm-region')) w.region++;
    w.rows = Math.max(w.rows, [...document.querySelectorAll('.qi-item')]
      .filter(n => n.className.indexOf('sv-confirm') >= 0).length);
    const b = document.getElementById('saveModalSubmitBtn');
    if (b && b.classList.contains('sv-ok')) w.ok++;
    if (b && b.classList.contains('sv-saving')) w.saving++;
    if (document.querySelector('#saveModalSubmitBtn .sv-check')) w.check++;
    w.samples++;
  };
  window.__svTick = setInterval(() => seen(window.__sv), 12);
  seen(window.__sv);
  return true;
});
const watched = page => page.evaluate(() => {
  clearInterval(window.__svTick);
  const w = window.__sv;
  return { value: Object.keys(w.value).sort(), region: w.region, rows: w.rows,
           ok: w.ok, check: w.check, saving: w.saving, samples: w.samples };
});

/* A real quotation, entered the way a person enters one, then the real Save
   dialog. Nothing here calls the save function directly — the point is the
   button. */
async function ready(browser, api, opts = {}) {
  const page = await openApp(browser, { api, viewport: { width: 1440, height: 1000 } });
  if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await quickAddPaste(page, MSG, { settle: 900 });
  await page.evaluate(() => wqaAddAll());
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    document.getElementById('qi-customer').value = 'ADVANCE ENGINEERING';
    syncQI();
  });
  await page.evaluate(() => openSaveModal());
  await page.waitForTimeout(450);
  return page;
}
const clickSave = page => page.evaluate(() =>
  document.getElementById('saveModalSubmitBtn').click());

module.exports = async (browser, A) => {
  A.suite('save feedback — the button, the value, the region, and the row');

  // ══ 1 · the sequence, on a save the server confirms ══════════════════════
  {
    let posts = 0, body = null, release;
    const held = new Promise(r => { release = r; });
    const page = await ready(browser, {
      save_quotation: (u, req) => { posts++; try { body = JSON.parse(req.postData()||'null'); } catch (e) {}
                                    return { ok: true, id: 41, ref_no: 'DC-TEST-001' }; },
    });

    const before = await shot(page);
    A.ok(!before.btnSaving && !before.btnOk, 'before the click the Save button carries no save state');
    A.ok(!before.check, 'and no check');
    A.ok(!before.region, 'and the quotation region is not confirmed');
    A.eq(before.rowsMarked, 0, 'and no item row is marked');
    A.eq(before.valueMarked.length, 0, 'and no value is pulsing');
    A.ok(before.modalOpen, 'the Save dialog is open, which is where the button that saves lives');
    const restWidth = before.btnWidth;

    /* The in-flight state, caught by holding the response open. Without the
       hold this window is a few milliseconds wide and the assertion becomes a
       race the suite would lose intermittently. */
    await page.route('**/api.php?action=save_quotation*', async route => {
      await held;
      posts++;
      try { body = JSON.parse(route.request().postData()||'null'); } catch (e) {}
      route.fulfill({ status: 200, contentType: 'application/json',
                      body: JSON.stringify({ ok: true, id: 41, ref_no: 'DC-TEST-001' }) });
    });
    posts = 0;
    await watch(page);
    await clickSave(page);
    await page.waitForTimeout(160);
    const flight = await shot(page);
    A.ok(flight.btnSaving, 'while the request is in flight the button is in its saving state');
    A.ok(flight.btnBusy, 'and reports aria-busy to anything reading the page aloud');
    A.ok(!flight.btnOk && !flight.check, 'and shows NO check — the server has not answered yet');
    A.ok(!flight.region, 'and the region is not confirmed yet');
    A.eq(flight.valueMarked.length, 0, 'and no value has pulsed yet');
    A.ok(/matrix|scale/.test(flight.btnScale) && flight.btnScale !== 'none',
      'the compress is a transform, so nothing around it can move');
    A.eq(flight.btnWidth, restWidth,
      'and its LAYOUT width is unchanged, so nothing around it can move — the compress is paint only');
    A.ok(flight.btnPainted < restWidth && flight.btnPainted > restWidth * 0.95,
      'while the painted box is a few per cent smaller, which is the compress being visible at all');

    /* Three more clicks, all inside the request window. */
    await clickSave(page); await clickSave(page); await clickSave(page);
    await page.waitForTimeout(120);
    release();
    await page.waitForTimeout(120);
    A.eq(posts, 1, 'four clicks inside one request window issue exactly ONE save');

    const ok = await shot(page);
    A.ok(ok.btnOk && ok.check, 'the check appears once the server has confirmed');
    A.eq(ok.btnLabel, '✓', 'and it is the only thing the button says while it is up');
    A.ok(ok.toastOn, 'the existing toast slides in');
    A.includes(ok.toastText, 'saved and locked', 'carrying the message the application already had');

    /* The dialog holds briefly so the check can be seen, then closes. */
    await page.waitForTimeout(320);
    const closed = await shot(page);
    A.ok(!closed.modalOpen, 'the dialog closes after the check has been seen, not before');

    /* Page-level feedback, once the scrim is out of the way. */
    await page.waitForTimeout(220);
    const settled = await shot(page);
    A.ok(settled.region, 'the quotation-level region carries the ~500ms confirmation');
    A.eq(settled.rowsMarked, 0,
      'and NO individual item row is singled out — the whole quotation was saved, so the region confirms and its children do not');
    const seen1 = await watched(page);
    A.eq(seen1.value.join(','), 'qi-refno,quoteTotalAmt',
      'both real saved values confirm themselves: the grand total, and the reference number the server may have reassigned');
    A.ok(seen1.saving > 0, 'the in-flight state was really on the button, not inferred');
    A.ok(seen1.check > 0, 'and so was the check');
    A.eq(seen1.rows, 0,
      'and across the WHOLE interaction, sampled every 12ms, no item row was ever marked');
    A.ok(/RM\s*[\d,]+\.\d\d/.test(settled.total), 'the total that pulsed is a real figure, not a placeholder');
    A.eq(settled.refno, 'DC-TEST-001', 'and the reference number is the one the server returned');

    /* And it all goes away. */
    await page.waitForTimeout(700);
    const rest = await shot(page);
    A.ok(!rest.region, 'the confirmation clears — no permanent class on the region');
    A.eq(rest.valueMarked.length, 0, 'no permanent class on the values');
    A.ok(!rest.check && !rest.btnOk && !rest.btnSaving, 'and none on the button');
    A.ok(!rest.btnBusy, 'aria-busy is gone');
    A.ok(rest.btnLabel.length > 1 && rest.btnLabel !== '✓',
      'the button has its own words back: "' + rest.btnLabel + '"');

    // ── the payload, which this round is not allowed to touch ──
    A.ok(!!body, 'the save posted a body');
    A.eq(Object.keys(body).sort().join(','), PAYLOAD_NEW.slice().sort().join(','),
      'the save payload carries exactly the accepted keys and no others');
    A.eq(body.ref_no, 'DC-TEST-001', 'ref_no unchanged');
    A.eq(body.customer_name, 'ADVANCE ENGINEERING', 'customer_name unchanged');
    A.eq(body.items.length, 2, 'both items posted');
    A.near(body.total_amount, body.items.reduce((s,i)=>s+i.totalAmount,0), 0.0001,
      'total_amount is still the sum of the items it posts');
    A.eq(body.items[0].pricingModel, 'accessory-inclusive',
      'and the accessory-inclusive model accepted in STAGE 0B is untouched by this round');
    await page.close();
  }

  // ══ 2 · the failure path shows nothing ══════════════════════════════════
  {
    const page = await ready(browser, {
      save_quotation: () => ({ ok: false, error: 'DB is down' }),
    });
    /* The failure is held open for 200ms. Not to make it fail differently — the
       answer is the same either way — but so the in-flight state is a real,
       observable window rather than a few microseconds, which is what lets this
       section prove the compress happens on the FAILURE path too and is then
       released. */
    await page.route('**/api.php?action=save_quotation*', async route => {
      await new Promise(r => setTimeout(r, 200));
      route.fulfill({ status: 200, contentType: 'application/json',
                      body: JSON.stringify({ ok: false, error: 'DB is down' }) });
    });
    /* Sampled every 12ms from before the click until well past the window a
       SUCCESS would have used, so a success visual that flickered for a single
       frame could not hide between two samples. */
    await watch(page);
    await clickSave(page);
    await page.waitForTimeout(1500);
    const seen = await watched(page);
    A.ok(seen.samples > 60, 'the page was sampled throughout — ' + seen.samples + ' samples');
    A.ok(seen.saving > 0, 'the button DID compress while the failing request was in flight');
    A.eq(seen.ok, 0, 'a failed save never enters the ok state');
    A.eq(seen.check, 0, 'a failed save never shows a check');
    A.eq(seen.region, 0, 'a failed save never confirms the quotation region');
    A.eq(seen.value.length, 0, 'a failed save never pulses a value');
    A.eq(seen.rows, 0, 'and never marks a row');

    const after = await shot(page);
    A.ok(!after.btnSaving, 'the button leaves its saving state');
    A.ok(after.btnLabel.length > 1 && after.btnLabel !== '✓',
      'and comes back with its own label: "' + after.btnLabel + '"');
    A.ok(after.modalOpen, 'the dialog stays open, because nothing was saved');
    A.ok(after.toastOn, 'the existing error feedback still speaks');
    A.includes(after.toastText, 'DB is down', 'and still carries the server\'s own reason');

    /* A failed save must not leave the guard held, or the retry would be
       silently refused and the user would think the button was dead. */
    let second = 0;
    await page.route('**/api.php?action=save_quotation*', route => {
      second++;
      route.fulfill({ status: 200, contentType: 'application/json',
                      body: JSON.stringify({ ok: true, id: 9, ref_no: 'DC-TEST-001' }) });
    });
    await clickSave(page);
    await page.waitForTimeout(500);
    A.eq(second, 1, 'and the retry after a failure is allowed through — the guard was released');
    const retried = await shot(page);
    A.ok(retried.btnOk || retried.check || retried.toastText.indexOf('saved') >= 0,
      'so the retry gets the success interaction it earned');
    await page.close();
  }

  // ══ 3 · a second legitimate save works exactly like the first ════════════
  {
    let posts = 0;
    const page = await ready(browser, {
      save_quotation:   () => { posts++; return { ok: true, id: 12, ref_no: 'DC-TEST-001' }; },
      update_quotation: () => { posts++; return { ok: true, id: 12 }; },
      get_quotation:    { ok: true, data: [] },
    });
    await clickSave(page);
    await page.waitForTimeout(1500);
    const first = await shot(page);
    A.ok(!first.region && !first.check, 'after the first save has settled the page is back to normal');

    /* Unlock, change something real, and save again through the same button. */
    await page.evaluate(() => { unlockSavedQuotation(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { quoteItems[0].qty = quoteItems[0].qty + 1;
                                quoteItems[0].totalAmount = quoteItems[0].finalUnitPrice * quoteItems[0].qty;
                                markQuotationDirty(); renderQuote(); });
    await page.evaluate(() => openSaveModal());
    await page.waitForTimeout(450);
    const reopened = await shot(page);
    A.ok(reopened.modalOpen, 'the dialog opens again');
    A.ok(!reopened.btnSaving && !reopened.btnOk && !reopened.check,
      'with a clean button — no state left over from the first save');

    /* dcToastCapture is a script-scoped `let` and unreachable from here, but
       `function showToast` is a global function declaration, so wrapping it
       counts the application's own calls rather than a copy of them. */
    await watch(page);
    const armed = await page.evaluate(() => {
      window.__svToasts = [];
      const orig = window.showToast;
      window.showToast = function (m) { window.__svToasts.push(String(m)); return orig.apply(this, arguments); };
      return typeof orig === 'function';
    });
    A.ok(armed, 'the application\'s own showToast is the one being counted');
    await clickSave(page);
    await page.waitForTimeout(300);
    const ok2 = await shot(page);
    A.ok(ok2.btnOk && ok2.check, 'the second save shows the check too');
    const seen2 = await watched(page);
    A.ok(seen2.region > 0, 'and confirms the region again');
    A.eq(seen2.rows, 0, 'still without singling out a row');
    A.eq(seen2.value.join(','), 'qi-refno,quoteTotalAmt',
      'and pulses the same two real values on the second save as on the first');
    const captured = await page.evaluate(() => (window.__svToasts||[]).slice());
    A.eq(captured.length, 1, 'one save produces exactly ONE toast, not two — got ' + JSON.stringify(captured));
    A.includes(captured[0] || '', 'updated and locked', 'and it is the update message the application already had');
    await page.waitForTimeout(800);
    const rest2 = await shot(page);
    A.ok(!rest2.region && !rest2.check && !rest2.btnOk,
      'and it clears completely — no stale class, no stale timer from either save');
    A.eq(posts, 2, 'two legitimate saves, two requests');
    await page.close();
  }

  // ══ 4 · ~500ms, measured ════════════════════════════════════════════════
  {
    const page = await ready(browser, {
      save_quotation: () => ({ ok: true, id: 5, ref_no: 'DC-TEST-001' }),
    });
    const life = await page.evaluate(async () => {
      const panel = document.getElementById('reviewListPanel');
      document.getElementById('saveModalSubmitBtn').click();
      let on = -1, off = -1;
      const t0 = performance.now();
      for (let i = 0; i < 400; i++) {
        const has = panel.classList.contains('sv-confirm-region');
        if (has && on < 0) on = performance.now() - t0;
        if (!has && on >= 0) { off = performance.now() - t0; break; }
        await new Promise(r => setTimeout(r, 10));
      }
      return { on: Math.round(on), off: Math.round(off) };
    });
    A.ok(life.on >= 0 && life.off > life.on, 'the confirmation goes on and comes off again');
    const held = life.off - life.on;
    A.ok(held >= 430 && held <= 640,
      'and it is held for about 500ms — measured ' + held + 'ms');
    A.ok(life.on <= 700, 'starting soon after the save, not after a pause — measured ' + life.on + 'ms');
    await page.close();
  }

  // ══ 5 · the row-specific save · EXACT ROW, and only that row ════════════
  /* This is the other semantics, and the only path where a single row genuinely
     IS what was written. It proves the row behaviour of save_default_price. It
     does not prove, and is not offered as proof of, the quotation path. */
  {
    const RULES = [
      { id: 101, product_type:'stud', material:'MS', size_type:'FULLSIZE', size:'M12',
        finish:'ZP', cost_rate:6.5, additional_cost:0.3, markup:20, is_active:1 },
      { id: 202, product_type:'stud', material:'MS', size_type:'FULLSIZE', size:'M16',
        finish:'ZP', cost_rate:6.9, additional_cost:0.3, markup:20, is_active:1 },
      { id: 303, product_type:'stud', material:'MS', size_type:'FULLSIZE', size:'M20',
        finish:'ZP', cost_rate:7.4, additional_cost:0.3, markup:20, is_active:1 },
    ];
    let saved = null;
    const page = await openApp(browser, {
      api: {
        get_default_prices: { ok: true, data: RULES },
        update_default_price: (u, req) => { try { saved = JSON.parse(req.postData()||'null'); } catch (e) {}
                                            return { ok: true, id: 202 }; },
      },
    });
    await page.evaluate(() => { openModal('dpModal'); renderDPList(); });
    await page.waitForTimeout(450);

    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('#dpListBody tr')].map(r => r.dataset.ruleId));
    A.eq(ids.join(','), '101,202,303', 'every rule row carries its own identity, not its position');

    await page.evaluate(() => { editDPRule('202'); });
    await page.waitForTimeout(250);
    await page.evaluate(() => { document.getElementById('dp-costRate').value = '7.10'; });
    await page.evaluate(() => { document.getElementById('dpSaveRuleBtn').click(); });
    await page.waitForTimeout(320);

    const marked = await page.evaluate(() =>
      [...document.querySelectorAll('#dpListBody tr')]
        .map(r => ({ id: r.dataset.ruleId, on: r.classList.contains('sv-confirm-row') })));
    const on = marked.filter(m => m.on).map(m => m.id);
    A.eq(on.join(','), '202', 'the row that was saved is confirmed');
    A.eq(marked.filter(m => !m.on).map(m => m.id).join(','), '101,303',
      'and its neighbours are not — the confirmation follows the identity the server wrote, not a position in a list');
    A.eq(marked.length, 3, 'all three rows are still there, only one of them marked');
    A.ok(!!saved && Number(saved.id) === 202, 'and it is the row the request actually named');
    A.near(Number(saved.costRate), 7.1, 0.0001, 'carrying the value that was typed');

    await page.waitForTimeout(700);
    const cleared = await page.evaluate(() =>
      [...document.querySelectorAll('#dpListBody tr')]
        .filter(r => r.classList.contains('sv-confirm-row')).length);
    A.eq(cleared, 0, 'the row confirmation clears too — no permanent class');
    await page.close();
  }

  // ══ 6 · a failed rule save marks no row ═════════════════════════════════
  {
    const page = await openApp(browser, {
      api: {
        get_default_prices: { ok: true, data: [
          { id: 101, product_type:'stud', material:'MS', size_type:'FULLSIZE', size:'M12',
            finish:'ZP', cost_rate:6.5, additional_cost:0.3, markup:20, is_active:1 }] },
        update_default_price: () => ({ ok: false, error: 'rule locked' }),
      },
    });
    await page.evaluate(() => { openModal('dpModal'); renderDPList(); editDPRule('101'); });
    await page.waitForTimeout(350);
    await page.evaluate(() => { document.getElementById('dp-costRate').value = '9.99'; });
    await page.evaluate(() => { document.getElementById('dpSaveRuleBtn').click(); });
    let anyRow = 0, anyCheck = 0;
    for (let i = 0; i < 14; i++) {
      const s = await page.evaluate(() => ({
        rows: document.querySelectorAll('#dpListBody tr.sv-confirm-row').length,
        check: document.querySelectorAll('#dpSaveRuleBtn .sv-check').length }));
      anyRow = Math.max(anyRow, s.rows); anyCheck = Math.max(anyCheck, s.check);
      await page.waitForTimeout(60);
    }
    A.eq(anyRow, 0, 'a failed rule save confirms no row');
    A.eq(anyCheck, 0, 'and shows no check');
    const btn = await page.evaluate(() => {
      const b = document.getElementById('dpSaveRuleBtn');
      return { label: b.textContent.trim(), saving: b.classList.contains('sv-saving') }; });
    A.ok(!btn.saving, 'the rule Save button leaves its saving state');
    A.ok(btn.label.length > 1, 'and comes back with its label: "' + btn.label + '"');
    await page.close();
  }

  // ══ 7 · reduced motion still says everything ════════════════════════════
  /* The page-wide reduced-motion rule collapses every animation to .001ms,
     which would make a 500ms confirmation invisible rather than calm. §11 wants
     the movement gone and the STATUS kept, so that is what is measured. */
  {
    const page = await ready(browser, {
      save_quotation: () => ({ ok: true, id: 77, ref_no: 'DC-TEST-001' }),
    }, { reducedMotion: true });

    const flat = await page.evaluate(() => {
      const b = document.getElementById('saveModalSubmitBtn');
      b.classList.add('sv-saving');
      const t = getComputedStyle(b).transform;
      b.classList.remove('sv-saving');
      return t;
    });
    A.ok(flat === 'none' || flat === 'matrix(1, 0, 0, 1, 0, 0)',
      'under reduced motion the compress does not move the button — ' + flat);

    await clickSave(page);
    await page.waitForTimeout(260);
    const okRM = await page.evaluate(() => {
      const c = document.querySelector('#saveModalSubmitBtn .sv-check');
      const cs = c ? getComputedStyle(c) : null;
      return { present: !!c, anim: cs ? cs.animationName : '', opacity: cs ? cs.opacity : '' };
    });
    A.ok(okRM.present, 'the check is still there under reduced motion — status is not movement');
    A.eq(okRM.anim, 'none', 'and it does not animate in');
    A.eq(okRM.opacity, '1', 'it is simply visible');

    /* Watched, not sampled: even a static confirmation only stands for 500ms. */
    let regRM = null;
    for (let i = 0; i < 30; i++) {
      const s = await page.evaluate(() => {
        const p = document.getElementById('reviewListPanel');
        const cs = getComputedStyle(p);
        return { on: p.classList.contains('sv-confirm-region'), anim: cs.animationName,
                 shadow: cs.boxShadow, toast: document.getElementById('toast').classList.contains('show') };
      });
      if (s.on) { regRM = s; break; }
      await page.waitForTimeout(40);
    }
    A.ok(!!regRM, 'the quotation region is still confirmed under reduced motion');
    A.eq(regRM.anim, 'none', 'without an animation');
    A.ok(/22,\s*163,\s*74/.test(regRM.shadow),
      'holding a static confirmation as an inset wash and edge — ' + regRM.shadow);
    A.ok(/inset/.test(regRM.shadow), 'inset, so it never replaces the panel\'s own background');
    A.ok(regRM.toast, 'and the toast still speaks');

    await page.waitForTimeout(900);
    const restRM = await page.evaluate(() => {
      const p = document.getElementById('reviewListPanel');
      return { on: p.classList.contains('sv-confirm-region'),
               shadow: getComputedStyle(p).boxShadow }; });
    A.ok(!restRM.on, 'and the static confirmation is removed on the same 500ms schedule');
    A.ok(!/22,\s*163,\s*74/.test(restRM.shadow), 'leaving the panel as it was — ' + restRM.shadow);
    await page.close();
  }
};
