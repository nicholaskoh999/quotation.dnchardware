/* ── The review screen, as a review screen ──────────────────────────────────
   Four bulk-edit forms standing open, each repeating the same scope selector,
   pushed the parsed items below the fold: the screen a person opened to CHECK
   what was read looked like a settings page. Since the 2026-10-23 redesign
   there is no standing form at all: Bulk Adjust is one button that opens its
   own sheet, every field at No change, with one scope for all of them, and
   tick boxes exist only in Selection mode.

   And the controls read as controls: the row's ▾ and History report their
   state, and where a price had come from is a pill of its own.

   Every assertion here is either "this is now reachable and legible" or "this
   still does exactly what it did".                                          */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const box = (page, sel) => page.evaluate(s => {
  const n = document.querySelector(s);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return { top: Math.round(r.top), h: Math.round(r.height), shown: r.height > 0 };
}, sel);

/* What the Bulk Adjust sheet is showing: every field's value, the scope, the
   sentence under it and whether Apply can be pressed. */
const sheet = page => page.evaluate(() => {
  const p = el('wqaBulkSheetPanel');
  const f = {};
  p.querySelectorAll('[data-bs]').forEach(n => { f[n.getAttribute('data-bs')] = n.value; });
  return {
    hidden: el('wqaBulkSheet').hidden,
    title: (p.querySelector('.wqa-bs-title') || {}).textContent || '',
    scopes: p.querySelectorAll('.wqa-bs-scope').length,
    scopeBtns: [...p.querySelectorAll('.wqa-bs-sc')].map(b => b.textContent.trim() + (b.classList.contains('is-on') ? '*' : '')),
    f,
    summary: (el('wqaBsSummary') || {}).textContent || '',
    applyDisabled: !!(el('wqaBsApply') || {}).disabled,
  };
});

/* Three rows: a series of two M12s and an M16 on its own. */
const ROWS3 = ['MS SAG ROD ZP UNDERSIZE',
  'M12 x 853 x 70/70 - 4pcs',
  'M12 x 943 x 70/70 - 6pcs',
  'M16 x 500 x 70/70 - 2pcs'].join('\n');

module.exports = async (browser, A) => {
  const S = A.suite('quick add — a review screen, not a settings page');

  // ══ the default state: items first ═══════════════════════════════════════
  {
    const page = await openApp(browser, { viewport: { width: 1440, height: 1000 } });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ROWS3, { expanded: false, settle: 1200 });

    const shut = await page.evaluate(() => {
      const head = document.querySelector('#wqaSource .wqa-panel-head');
      return {
        sheetHidden: el('wqaBulkSheet').hidden,
        /* No bulk form of any kind stands on the review itself. */
        standing: ['wqaBulkHead', 'wqaBulkBody', 'wqaCommonFix', 'wqaCommonItem', 'wqaCommonPrice', 'wqaCommonAcc']
                    .filter(id => !!el(id)).join(','),
        inlineBs: document.querySelectorAll('#wqaStep2 .wqa-scroll [data-bs], #wqaStep2 .wqa-scope').length,
        acts: [...el('wqaRvActs').querySelectorAll('button')].map(b => b.textContent.trim()),
        /* The size/TL prompt renders only when rows are actually missing a
           size or a thread, and these three have both. */
        needHidden: el('wqaRvNeed').hidden,
        count: el('wqaRowsCount').textContent.trim(),
        srcOpen: !!document.querySelector('#wqaSource .wqa-source-text'),
        srcExpanded: head ? head.getAttribute('aria-expanded') : null,
      };
    });
    A.eq(String(shut.sheetHidden), 'true', 'the Bulk Adjust sheet starts shut');
    A.eq(shut.standing, '', 'and no bulk-edit form stands on the review screen');
    A.eq(shut.inlineBs, 0, 'not a field, not a scope selector');
    A.eq(shut.acts.join(' | '), 'Select | Bulk Adjust',
      'the heading offers exactly Select and Bulk Adjust');
    A.eq(String(shut.needHidden), 'true',
      'while the size/TL prompt is absent entirely — every row already has a size and a thread');
    A.eq(shut.count, 'Detected 3 items', 'and the heading counts what was read');
    /* The original message is a collapsed one-line panel at every width now
       (it used to open on desktop). */
    A.eq(String(shut.srcOpen), 'false', 'the original message is one closed line, not a block of text');
    A.eq(shut.srcExpanded, 'false', 'and says so to a screen reader');
    await page.click('#wqaSource .wqa-panel-head');
    await page.waitForTimeout(300);
    A.includes(await page.evaluate(() => (document.querySelector('#wqaSource .wqa-source-text') || {}).textContent || ''),
      'M12 x 943 x 70/70', 'pressing it shows the message, verbatim');
    await page.click('#wqaSource .wqa-panel-head');
    await page.waitForTimeout(300);

    /* The items are visible without scrolling past a form. */
    const rows = await box(page, '#wqaRows');
    const scroll = await page.evaluate(() => {
      const s = document.querySelector('#wqaStep2 .wqa-scroll');
      return { top: Math.round(s.getBoundingClientRect().top), h: Math.round(s.clientHeight) };
    });
    A.ok(rows.top - scroll.top < scroll.h,
      `the items are on screen without scrolling (${rows.top - scroll.top}px into a ${scroll.h}px panel)`);
    A.ok(rows.shown, 'and they have height');

    /* The bottom bar is reachable, which is what the height was costing. */
    const add = await box(page, '#wqaAddBtn');
    A.ok(add.shown, 'the Add button is on screen');
    A.ok(add.h >= 32, `at a size that can be pressed (${add.h}px)`);

    // ── opened: one sheet, one scope, every field at No change ────────────
    await page.click('#wqaRvActs .wqa-rv-bulkbtn');
    await page.waitForTimeout(400);
    const open = await sheet(page);
    A.eq(String(open.hidden), 'false', 'pressing Bulk Adjust opens the sheet');
    A.eq(open.title, 'Bulk Adjust', 'under its own title');
    A.eq(open.scopes, 1, 'with the scope stated once, for every field');
    A.eq(open.scopeBtns.join(' | '), 'All items (3)* | Selected items (0)',
      'All by default, and Selected says it has nothing in it');
    A.eq(['product', 'material', 'finish', 'sizeType', 'priceMode', 'acc'].map(k => open.f[k]).join(','),
      Array(6).fill('__KEEP__').join(','), 'every choice starts at No change');
    A.eq(['size', 'thread', 'costRate', 'addCost', 'markup'].map(k => open.f[k]).join(','), ',,,,',
      'and every box starts empty');
    A.includes(open.summary, 'Choose at least one field to change', 'the summary says nothing will happen yet');
    A.eq(String(open.applyDisabled), 'true', 'so Apply cannot be pressed');
    await page.close();
  }

  // ══ nothing is written until Apply ═══════════════════════════════════════
  {
    /* Retired 2026-10-23 (AI review redesign): "a typed bulk value survives the
       group being shut" — the sheet is one action now; Cancel discards and
       reopening starts at No change, which is asserted instead. */
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs',
      { expanded: false, settle: 1000 });
    const before = await rowState(page);
    await page.click('#wqaRvActs .wqa-rv-bulkbtn');
    await page.waitForTimeout(400);
    await page.click('#wqaBulkSheetPanel input[data-bs="markup"]');
    await page.keyboard.type('9', { delay: 15 });
    await page.waitForTimeout(300);
    const typed = await sheet(page);
    A.eq(typed.f.markup, '9', 'a typed markup is in the box');
    A.includes(typed.summary, 'Set Markup to 9%', 'and the summary says exactly what Apply would do');
    A.includes(typed.summary, 'Applies to 1 items', 'and to how many');
    A.eq(String(typed.applyDisabled), 'false', 'so Apply is now available');
    A.eq(await page.evaluate(() => String(wqa.rows[0].priceOverride.markup || '')), '',
      'but it was never applied to a row on its own — Apply is still a press');
    A.eq(String((await rowState(page))[0].price), String(before[0].price), 'and the price has not moved');

    await page.click('#wqaBulkSheetPanel .wqa-bs-foot .btn-ghost');   // Cancel
    await page.waitForTimeout(300);
    A.eq(await page.evaluate(() => el('wqaBulkSheet').hidden), true, 'Cancel shuts the sheet');
    A.eq(await page.evaluate(() => String(wqa.rows[0].priceOverride.markup || '')), '',
      'and writes nothing');
    await page.click('#wqaRvActs .wqa-rv-bulkbtn');
    await page.waitForTimeout(400);
    A.eq((await sheet(page)).f.markup, '', 'opened again, the sheet is back at No change');

    await page.click('#wqaBulkSheetPanel input[data-bs="markup"]');
    await page.keyboard.type('9', { delay: 15 });
    await page.waitForTimeout(200);
    await page.click('#wqaBsApply');
    await page.waitForTimeout(900);
    const after = (await rowState(page))[0];
    A.eq(await page.evaluate(() => String(wqa.rows[0].calc.markup)), '9', 'Apply writes the markup');
    A.eq(after.costRate + '|' + after.addCost, before[0].costRate + '|' + before[0].addCost,
      'and only the markup — the rates beside it were left at No change');
    A.eq(await page.evaluate(() => el('wqaBulkSheet').hidden), true, 'and the sheet closes behind it');
    await page.close();
  }

  // ══ scope, selection, and the bar that appears with one ══════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ROWS3, { expanded: false, settle: 1200 });
    const priceBefore = (await rowState(page)).map(r => String(r.price)).join(',');
    const specOf = () => page.evaluate(() => wqa.rows.map(r =>
      [r.product, r.material, r.sizeType, r.size, r.length, wqaThreadValue(r), r.qty].join('/')).join(' ; '));
    const specBefore = await specOf();
    const selBarBtn = label => page.evaluate(l => [...el('wqaSelBar').querySelectorAll('button')]
      .find(b => b.textContent.trim() === l).click(), label);

    A.eq(await page.evaluate(() => el('wqaSelBar').hidden), true,
      'with nothing selected there is no selection bar');
    /* Retired 2026-10-23 (AI review redesign): "every row carries a tick box,
       unasked" — ticks belong to Selection mode now. */
    A.eq(await page.evaluate(() => document.querySelectorAll('#wqaRows .wqa-pick').length), 0,
      'and no tick box stands on a row outside Selection mode');

    await page.click('#wqaRvActs .wqa-rv-selbtn');
    await page.waitForTimeout(500);
    A.eq(await page.evaluate(() => el('wqaSelBar').hidden), false,
      'pressing Select shows the selection bar');
    A.includes(await page.evaluate(() => el('wqaSelBar').textContent), '0 selected',
      'counting nothing yet');
    A.eq(await page.evaluate(() => document.querySelectorAll('#wqaRows .wqa-it .wqa-pick').length), 3,
      'every row now carries a tick');
    A.eq(await page.evaluate(() => document.querySelectorAll('#wqaRows .wqa-ser-head .wqa-pick').length), 1,
      'and so does the series heading');

    /* Pressing the row itself ticks it in this mode — it does not open it. */
    await page.click('[data-wqa-row="0"] .wqa-it-no');
    await page.waitForTimeout(300);
    await page.click('[data-wqa-row="2"] .wqa-pick');
    await page.waitForTimeout(400);
    A.eq(await page.evaluate(() => wqaSelCount()), 2, 'two rows can be ticked');
    A.eq(await page.evaluate(() => wqa.rows.map(r => !!r.sel).join(',')), 'true,false,true',
      'the two that were pressed');
    A.eq(await page.evaluate(() => document.querySelectorAll('.wqa-rv-detail').length), 0,
      'and pressing a row in Selection mode opened nothing');
    A.includes(await page.evaluate(() => el('wqaSelBar').textContent), '2 selected',
      'and the bar says how many');
    const acts = await page.evaluate(() =>
      [...el('wqaSelBar').querySelectorAll('button')].map(b => b.textContent.trim()));
    A.eq(acts.join(' | '), 'Select all | Bulk Adjust | Remove selected | Done',
      'offering exactly what a selection is for');

    /* Selecting changes no number anywhere. */
    A.eq((await rowState(page)).map(r => String(r.price)).join(','), priceBefore,
      'and a selection on its own alters no calculation');

    /* Scope All applies to everything; scope Selected only to the ticked.
       Proved on a SHARED field — finish — because that is what Bulk Adjust is
       for. Geometry differs per row and belongs to the row itself. */
    await selBarBtn('Bulk Adjust');
    await page.waitForTimeout(400);
    let sh = await sheet(page);
    A.eq(sh.scopeBtns.join(' | '), 'All items (3) | Selected items (2)*',
      'the bar\'s Bulk Adjust opens on the selection');

    /* The ticks SURVIVE the scope switch. They used to be wiped by it, which
       made comparing "all" against "these two" quietly destructive. */
    await page.selectOption('#wqaBulkSheetPanel select[data-bs="finish"]', 'HDG');
    await page.waitForTimeout(300);
    await page.click('#wqaBulkSheetPanel .wqa-bs-sc:nth-child(1)');
    await page.waitForTimeout(300);
    sh = await sheet(page);
    A.includes(sh.summary, 'Applies to 3 items', 'switching to All counts every row');
    A.eq(sh.f.finish, 'HDG', 'without losing the value already chosen');
    A.eq(await page.evaluate(() => wqaSelCount()), 2,
      'and keeps the ticks — a selection is a set a person built, not a mode');
    await page.click('#wqaBulkSheetPanel .wqa-bs-sc:nth-child(2)');
    await page.waitForTimeout(300);
    sh = await sheet(page);
    A.includes(sh.summary, 'Set Finish to HDG', 'the summary names the field and the value');
    A.includes(sh.summary, 'Applies to 2 items', 'and the two rows it lands on');
    await page.click('#wqaBsApply');
    await page.waitForTimeout(1400);
    A.eq(await page.evaluate(() => wqa.rows.map(r => r.finish).join(',')), 'HDG,ZP,HDG',
      'Selected items writes to the ticked rows and to nothing else');
    A.eq(await specOf(), specBefore, 'and writes no field it was not given');
    A.eq(await page.evaluate(() => wqa.selMode + ',' + wqaSelCount()), 'false,0',
      'an adjustment made on a selection ends Selection mode, leaving no ticks behind');

    await page.click('#wqaRvActs .wqa-rv-bulkbtn');
    await page.waitForTimeout(400);
    A.eq((await sheet(page)).scopeBtns.join(' | '), 'All items (3)* | Selected items (0)',
      'opened from the heading, the sheet is on All');
    await page.selectOption('#wqaBulkSheetPanel select[data-bs="finish"]', 'PL');
    await page.waitForTimeout(300);
    await page.click('#wqaBsApply');
    await page.waitForTimeout(1400);
    A.eq(await page.evaluate(() => wqa.rows.map(r => r.finish).join(',')), 'PL,PL,PL',
      'All items writes to every row');
    A.eq(await specOf(), specBefore, 'again without touching any other field');

    // ── Selected, with nothing selected, refuses ──────────────────────────
    const finBefore = await page.evaluate(() => wqa.rows.map(r => r.finish).join(','));
    await page.evaluate(() => { wqaBulkSheetOpen('selected'); wqaBsSet('finish', 'ZP'); });
    await page.waitForTimeout(300);
    sh = await sheet(page);
    A.includes(sh.summary, 'No items selected yet', 'Selected with nothing ticked says so');
    A.eq(String(sh.applyDisabled), 'true', 'and Apply cannot be pressed');
    await page.evaluate(() => wqaBulkApply());
    await page.waitForTimeout(600);
    A.eq(await page.evaluate(() => wqa.rows.map(r => r.finish).join(',')), finBefore,
      'and calling it anyway writes nothing — never a fallback to every row');
    await page.evaluate(() => wqaBulkSheetClose());

    /* The original writers are what the sheet hands to, and they still obey
       the scope on their own. */
    await page.evaluate(() => { wqa.rows[1].sel = true; wqaSetApplyScope('selected');
                                wqaEditFix('finish', 'HDG'); wqaApplyFixToAll(); });
    await page.waitForTimeout(1200);
    A.eq(await page.evaluate(() => wqa.rows.map(r => r.finish).join(',')), 'PL,HDG,PL',
      'wqaApplyFixToAll under Selected writes the ticked row only');
    await page.evaluate(() => { wqa.rows.forEach(r => { r.sel = false; }); wqaEditFix('finish', 'ZP'); wqaApplyFixToAll(); });
    await page.waitForTimeout(800);
    A.eq(await page.evaluate(() => wqa.rows.map(r => r.finish).join(',')), 'PL,HDG,PL',
      'and under Selected with nothing ticked it writes nothing');
    await page.evaluate(() => wqaSetApplyScope('all'));
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ══ the row's own controls ═══════════════════════════════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs',
      { expanded: false, settle: 1000 });

    const read = () => page.evaluate(() => {
      const card = document.querySelector('[data-wqa-row="0"]');
      const b = s => card.querySelector(s);
      const st = n => n ? getComputedStyle(n) : null;
      const more = b('.wqa-rv-more'), hist = b('.wqa-it-acts .wqa-row-hist');
      return {
        moreText: more.textContent.trim(),
        moreLabel: more.getAttribute('aria-label') || '',
        moreOn: more.classList.contains('is-on'),
        moreExpanded: more.getAttribute('aria-expanded'),
        histOn: hist.classList.contains('is-on'),
        histExpanded: hist.getAttribute('aria-expanded'),
        moreBg: st(more).backgroundColor, histBg: st(hist).backgroundColor,
        delLabel: b('.wqa-row-del').getAttribute('aria-label') || '',
        tags: [...card.querySelectorAll('.wqa-it-acts > *')].map(n => n.tagName).join(' '),
        bodyOpen: !!b('.wqa-rv-detail'),
      };
    });

    const shut = await read();
    /* Retired 2026-10-23 (AI review redesign): the "Details"/"Close" button —
       the row opens by pressing the row itself or its ▾. */
    A.eq(shut.moreText, '▾', 'the row offers ▾ to open it');
    A.eq(shut.moreLabel, 'More', 'named for a screen reader');
    A.eq(shut.tags, 'BUTTON BUTTON BUTTON', 'History, remove and ▾ are all buttons');
    A.ok(shut.delLabel.length > 0, 'and the remove button says what it removes to a screen reader');
    A.eq(shut.moreExpanded, 'false', '▾ reports the row as shut');
    A.eq(shut.histExpanded, 'false', 'and History reports itself shut');

    /* Mouse-sized on a desktop; a finger's size at tablet width. */
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.waitForTimeout(400);
    const tall = await page.evaluate(() => [...document.querySelectorAll('[data-wqa-row="0"] .wqa-it-acts button')]
      .map(n => Math.round(n.getBoundingClientRect().height)));
    A.ok(tall.length === 3 && tall.every(h => h >= 32),
      `at tablet width all three are a real touch target (${tall.join('/')}px)`);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(400);

    /* Open state is visible, not merely recorded. */
    await page.click('[data-wqa-row="0"] .wqa-rv-more');
    await page.waitForTimeout(500);
    const opened = await read();
    A.eq(opened.moreText, '▴', 'pressing ▾ opens the row and the control turns over');
    A.eq(opened.moreLabel, 'Less', 'and is renamed');
    A.eq(String(opened.moreOn), 'true', 'and it takes an open state');
    A.eq(opened.moreExpanded, 'true', 'reported to a screen reader too');
    A.ok(opened.moreBg !== shut.moreBg, `and it LOOKS open (${shut.moreBg} → ${opened.moreBg})`);
    A.eq(String(opened.bodyOpen), 'true', 'the item panel is there');
    await page.click('[data-wqa-row="0"] .wqa-rv-more');
    await page.waitForTimeout(400);
    A.eq(String((await read()).bodyOpen), 'false', 'and ▴ puts it away');

    /* The row itself is the other way in. */
    await page.click('[data-wqa-row="0"] .wqa-it-no');
    await page.waitForTimeout(400);
    A.eq(String((await read()).bodyOpen), 'true', 'pressing the row opens its panel');
    await page.click('[data-wqa-row="0"] .wqa-it-no');
    await page.waitForTimeout(400);
    A.eq(String((await read()).bodyOpen), 'false', 'and pressing it again shuts it');

    await page.click('[data-wqa-row="0"] .wqa-it-acts .wqa-row-hist');
    await page.waitForTimeout(1100);
    const hist = await read();
    A.eq(String(hist.histOn), 'true', 'History takes an open state as well');
    A.eq(hist.histExpanded, 'true', 'reported the same way');
    A.ok(hist.histBg !== shut.histBg, `and looks open (${shut.histBg} → ${hist.histBg})`);
    A.eq(String(hist.bodyOpen), 'false', 'without opening the item panel');
    /* Retired 2026-10-23 (AI review redesign): the ▲ caret inside the History
       label — the control is a toggle reporting is-on/aria-expanded instead. */
    await page.click('[data-wqa-row="0"] .wqa-it-acts .wqa-row-hist');
    await page.waitForTimeout(500);
    A.eq((await read()).histExpanded + ',' + await page.evaluate(() => wqa.rows[0].histOpen), 'false,false',
      'and pressing it again shuts it');
    await page.close();
  }

  // ══ shut and opened rows still work ══════════════════════════════════════
  {
    /* Retired 2026-10-23 (AI review redesign): the Compact/Expanded toggle
       buttons — wqaSetView survives as the legacy "open every panel". */
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs\nM12 x 943 x 70/70 - 6pcs',
      { expanded: false, settle: 1100 });
    const n = () => page.evaluate(() => document.querySelectorAll('.wqa-rv-detail').length);
    A.eq(await n(), 0, 'the review opens with no panels open');
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(900);
    A.eq(await n(), 2, 'wqaSetView("expanded") opens one per row');
    await page.evaluate(() => wqaSetView('compact'));
    await page.waitForTimeout(700);
    A.eq(await n(), 0, 'and "compact" puts them away again');
    await page.click('[data-wqa-row="0"] .wqa-rv-more');
    await page.waitForTimeout(400);
    await page.click('[data-wqa-row="1"] .wqa-rv-more');
    await page.waitForTimeout(400);
    A.eq(await page.evaluate(() => [...document.querySelectorAll('.wqa-rv-detail')]
      .map(d => d.closest('[data-wqa-row]').getAttribute('data-wqa-row')).join(',')), '1',
      'pressed one after another, one panel is open at a time — the last one pressed');

    /* No horizontal overflow in the item list, at any of the widths — with a
       panel open, and shut. */
    for (const w of [1440, 1100, 900, 720, 390]) {
      await page.setViewportSize({ width: w, height: 950 });
      await page.waitForTimeout(400);
      for (const state of ['open', 'shut']) {
        await page.evaluate(s => {
          if (s === 'open') { if (!wqa.rows[1].open) wqaToggleRow(1); }
          else { wqaCloseAllDetails(); wqaRenderRows(true); }
        }, state);
        await page.waitForTimeout(250);
        const over = await page.evaluate(() => {
          const s = document.querySelector('#wqaStep2 .wqa-scroll');
          return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                   panel: s.scrollWidth - s.clientWidth };
        });
        A.ok(over.doc <= 1, `${w}px ${state}: the page does not scroll sideways (${over.doc}px)`);
        A.ok(over.panel <= 1, `${w}px ${state}: nor the item panel (${over.panel}px)`);
      }
    }
    await page.close();
  }

  // ══ a price that changed says so, without changing ═══════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs',
      { expanded: false, settle: 1100 });
    const before = (await rowState(page))[0];
    A.eq(await page.evaluate(() => document.querySelectorAll('.wqa-flash').length), 0,
      'nothing is highlighted on a first parse — every row would be');

    await page.evaluate(() => wqaEditPrice(0, 'costRate', '9.99'));
    await page.waitForTimeout(900);
    const flashed = await page.evaluate(() => {
      const n = document.querySelector('[data-wqa-row="0"] .wqa-fin');
      return { on: n.classList.contains('wqa-flash'), text: n.textContent };
    });
    const after = (await rowState(page))[0];
    A.eq(String(flashed.on), 'true', 'a price that moved is highlighted');
    A.ok(Number(after.price) !== Number(before.price),
      `because it really did move (${before.price} → ${after.price})`);
    A.includes(flashed.text, String(after.price.toFixed ? after.price.toFixed(2) : after.price),
      'and the highlight did not change the figure');

    /* And it goes away — a permanent colour is not a signal. */
    await page.waitForTimeout(1300);
    A.eq(await page.evaluate(() =>
      document.querySelector('[data-wqa-row="0"] .wqa-fin').classList.contains('wqa-flash')), false,
      'and it is ordinary again a second later');
    A.eq(String((await rowState(page))[0].price), String(after.price),
      'with the price still exactly what it was');
    await page.close();
  }

  // ══ a row is priced on its OWN rate, never the row above it ══════════════
  {
    /* Found while building the bulk apply, and present long before it: every
       row is priced through the ONE form for its product, and a Sag Rod row
       whose specification has no Default Price rule kept whatever the row
       above it left in the boxes — and showed that rate, and that price, as
       its own. */
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs\nM12 x 853 x 70/70 - 2pcs',
      { expanded: false, settle: 1200 });
    await page.evaluate(() => { wqaEditPrice(0, 'costRate', '7.25'); wqaEditPrice(0, 'addCost', '1.75'); });
    await page.waitForTimeout(1200);
    await page.evaluate(() => wqaEditRowSpec(1, 'material', '4140'));
    await page.waitForTimeout(1600);
    const rows = await rowState(page);
    A.eq(rows[0].costRate, '7.25', 'the row that was given a rate keeps it');
    A.ok(rows[1].costRate !== '7.25',
      `and the row beside it does not inherit it (${rows[1].costRate})`);
    A.ok(rows[1].addCost !== '1.75',
      `nor the surcharge (${rows[1].addCost})`);
    A.ok(Number(rows[1].price) !== Number(rows[0].price),
      `so the two are not quoted at one price (${rows[0].price} vs ${rows[1].price})`);
    await page.close();
  }

  return S;
};
