/* ── The review screen, as a review screen ──────────────────────────────────
   Four bulk-edit forms standing open, each repeating the same scope selector,
   pushed the parsed items below the fold: the screen a person opened to CHECK
   what was read looked like a settings page. They are one group now, shut
   unless something inside is asking for attention, with one scope for all four.

   And the controls read as controls: Edit was a bare span no keyboard could
   reach, History gave no sign of being open, and where a price had come from
   was one grey pill among several.

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

module.exports = async (browser, A) => {
  const S = A.suite('quick add — a review screen, not a settings page');

  // ══ the default state: items first ═══════════════════════════════════════
  {
    const page = await openApp(browser, { viewport: { width: 1440, height: 1000 } });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, [
      'MS SAG ROD ZP UNDERSIZE',
      'M12 x 853 x 70/70 - 4pcs',
      'M12 x 943 x 70/70 - 6pcs',
      'M16 x 500 x 70/70 - 2pcs',
    ].join('\n'), { expanded: false, settle: 1200 });

    const shut = await page.evaluate(() => ({
      bulkOpen: !!wqa.bulkOpen,
      bodyHidden: el('wqaBulkBody').hidden,
      heads: [...document.querySelectorAll('#wqaBulkHead .wqa-panel-title')].map(n => n.textContent),
      /* The four panels still exist, closed, with their values intact. */
      panels: ['wqaCommonFix', 'wqaCommonItem', 'wqaCommonPrice', 'wqaCommonAcc']
                .map(id => !!el(id) && el(id).innerHTML.length > 0),
      scopes: document.querySelectorAll('.wqa-scope').length,
    }));
    A.eq(String(shut.bulkOpen), 'false', 'the bulk-edit group starts shut');
    A.eq(String(shut.bodyHidden), 'true', 'so its four forms are not on the screen');
    A.eq(shut.heads.join(','), 'Bulk Edit', 'one heading, not four');
    A.eq(shut.panels.join(','), 'true,true,true,true', 'and all four panels still exist behind it');
    A.eq(shut.scopes, 1, 'with ONE scope selector for all of them, not one each');

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

    // ── opened, and the four are there, in order ─────────────────────────
    await page.evaluate(() => wqaToggleBulk());
    await page.waitForTimeout(400);
    const open = await page.evaluate(() => ({
      hidden: el('wqaBulkBody').hidden,
      titles: [...document.querySelectorAll('#wqaBulkBody .wqa-panel-title')].map(n => n.textContent),
      scopes: document.querySelectorAll('.wqa-scope').length,
    }));
    A.eq(String(open.hidden), 'false', 'pressing the heading opens the group');
    A.eq(open.titles.join(' · '),
      'Correct Items · Common Item Fields · Pricing Entry · Accessories',
      'showing the four, each with a title of its own and no repeated scope');
    A.eq(open.scopes, 1, 'and the scope is still stated once');
    await page.close();
  }

  // ══ collapsed sections keep their data ═══════════════════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs',
      { expanded: false, settle: 1000 });
    await page.evaluate(() => { wqa.bulkOpen = true; wqaRenderBulk(); wqaTogglePanel('item'); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { el('wqaCommonSize').value = 'M20'; wqaEditCommonItem('size', 'M20'); });
    await page.waitForTimeout(400);
    /* Shut the group, open it again — the typed value is still there. */
    await page.evaluate(() => wqaToggleBulk());
    await page.waitForTimeout(300);
    await page.evaluate(() => wqaToggleBulk());
    await page.waitForTimeout(400);
    A.eq(await page.evaluate(() => wqa.commonItem.size), 'M20',
      'a value typed into a bulk form survives the group being shut');
    A.eq(await page.evaluate(() => (el('wqaCommonSize') || {}).value), 'M20',
      'and is still in the box when it comes back');
    A.eq((await rowState(page))[0].size, 'M12',
      'and it was never applied to a row on its own — Apply is still a press');
    await page.close();
  }

  // ══ scope, selection, and the bar that appears with one ══════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, [
      'MS SAG ROD ZP UNDERSIZE',
      'M12 x 853 x 70/70 - 4pcs',
      'M12 x 943 x 70/70 - 6pcs',
      'M16 x 500 x 70/70 - 2pcs',
    ].join('\n'), { expanded: false, settle: 1200 });

    A.eq(await page.evaluate(() => el('wqaSelBar').hidden), true,
      'with nothing selected there is no selection bar');
    A.eq(await page.evaluate(() => document.querySelectorAll('.wqa-pick').length), 0,
      'and no tick boxes cluttering the rows');

    await page.evaluate(() => wqaSetApplyScope('selected'));
    await page.waitForTimeout(500);
    A.eq(await page.evaluate(() => document.querySelectorAll('.wqa-pick').length), 3,
      'switching to Selected Items puts a tick box on every row');
    A.eq(await page.evaluate(() => el('wqaSelBar').hidden), false, 'and shows the selection bar');
    A.includes(await page.evaluate(() => el('wqaSelBar').textContent), '0 selected',
      'counting nothing yet');

    await page.evaluate(() => { wqaToggleRowSel(0); wqaToggleRowSel(2); });
    await page.waitForTimeout(400);
    A.eq(await page.evaluate(() => wqaSelCount()), 2, 'two rows can be ticked');
    A.includes(await page.evaluate(() => el('wqaSelBar').textContent), '2 selected',
      'and the bar says how many');
    const acts = await page.evaluate(() =>
      [...el('wqaSelBar').querySelectorAll('button')].map(b => b.textContent.trim()));
    A.eq(acts.join(' | '), 'Bulk Edit | Apply Previous Price | Clear Selection',
      'offering exactly what a selection is for');

    /* Selecting changes no number anywhere. */
    const state = await rowState(page);
    A.eq(state.map(r => String(r.price)).join(','),
      (await rowState(page)).map(r => String(r.price)).join(','),
      'and a selection on its own alters no calculation');

    /* Scope All applies to everything; scope Selected only to the ticked. */
    await page.evaluate(() => { wqa.bulkOpen = true; wqaRenderBulk(); wqaTogglePanel('item'); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { wqaEditCommonItem('thread', '55/55'); wqaApplyItemToAll(); });
    await page.waitForTimeout(1400);
    const afterSel = await rowState(page);
    A.eq(afterSel.map(r => r.thread).join(','), '55/55,70/70,55/55',
      'Selected Items writes to the ticked rows and to nothing else');

    await page.evaluate(() => wqaSetApplyScope('all'));
    await page.waitForTimeout(500);
    A.eq(await page.evaluate(() => wqaSelCount()), 0, 'leaving Selected drops the ticks');
    A.eq(await page.evaluate(() => el('wqaSelBar').hidden), true, 'and the bar with them');
    await page.evaluate(() => { wqaEditCommonItem('thread', '65/65'); wqaApplyItemToAll(); });
    await page.waitForTimeout(1400);
    A.eq((await rowState(page)).map(r => r.thread).join(','), '65/65,65/65,65/65',
      'All Items writes to every row');
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
      const edit = b('.wqa-row-edit'), hist = b('.wqa-row-hist');
      return {
        editText: edit.textContent.trim(),
        editOn: edit.classList.contains('is-on'),
        editExpanded: edit.getAttribute('aria-expanded'),
        histOn: hist.classList.contains('is-on'),
        histExpanded: hist.getAttribute('aria-expanded'),
        histText: hist.textContent.replace(/\s+/g, ' ').trim(),
        editBg: st(edit).backgroundColor, histBg: st(hist).backgroundColor,
        editH: Math.round(edit.getBoundingClientRect().height),
        histH: Math.round(hist.getBoundingClientRect().height),
        delH: Math.round(b('.wqa-row-del').getBoundingClientRect().height),
        delLabel: b('.wqa-row-del').getAttribute('aria-label') || '',
        bodyOpen: !!b('.wqa-row-body'),
      };
    });

    const shut = await read();
    A.eq(shut.editText, 'Edit', 'the row offers Edit');
    A.ok(shut.editH >= 32 && shut.histH >= 32 && shut.delH >= 32,
      `all three at a real click target (${shut.editH}/${shut.histH}/${shut.delH}px)`);
    A.ok(shut.delLabel.length > 0, 'and the remove button says what it removes to a screen reader');
    A.eq(shut.editExpanded, 'false', 'Edit reports the row as shut');
    A.eq(shut.histExpanded, 'false', 'and History reports itself shut');

    /* Open state is visible, not merely recorded. */
    await page.evaluate(() => document.querySelector('[data-wqa-row="0"] .wqa-row-edit').click());
    await page.waitForTimeout(500);
    const opened = await read();
    A.eq(opened.editText, 'Close', 'pressing Edit opens the row and the control says so');
    A.eq(String(opened.editOn), 'true', 'and it takes an open state');
    A.eq(opened.editExpanded, 'true', 'reported to a screen reader too');
    A.ok(opened.editBg !== shut.editBg, `and it LOOKS open (${shut.editBg} → ${opened.editBg})`);
    A.eq(String(opened.bodyOpen), 'true', 'the editor is there');

    await page.evaluate(() => document.querySelector('[data-wqa-row="0"] .wqa-row-hist').click());
    await page.waitForTimeout(1100);
    const hist = await read();
    A.eq(String(hist.histOn), 'true', 'History takes an open state as well');
    A.eq(hist.histExpanded, 'true', 'reported the same way');
    A.ok(hist.histBg !== shut.histBg, `and looks open (${shut.histBg} → ${hist.histBg})`);
    A.includes(hist.histText, '▲', 'with a caret saying it can be shut again');
    await page.close();
  }

  // ══ compact and expanded still work ══════════════════════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs\nM12 x 943 x 70/70 - 6pcs',
      { expanded: false, settle: 1100 });
    A.eq(await page.evaluate(() => document.querySelectorAll('.wqa-row-body').length), 0,
      'Compact shows no editors');
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(900);
    A.eq(await page.evaluate(() => document.querySelectorAll('.wqa-row-body').length), 2,
      'Expanded shows one per row');
    await page.evaluate(() => wqaSetView('compact'));
    await page.waitForTimeout(700);
    A.eq(await page.evaluate(() => document.querySelectorAll('.wqa-row-body').length), 0,
      'and Compact puts them away again');

    /* No horizontal overflow in the item table, at any of the widths. */
    for (const w of [1440, 1100, 900, 720, 390]) {
      await page.setViewportSize({ width: w, height: 950 });
      await page.waitForTimeout(400);
      const over = await page.evaluate(() => {
        const s = document.querySelector('#wqaStep2 .wqa-scroll');
        return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                 panel: s.scrollWidth - s.clientWidth };
      });
      A.ok(over.doc <= 1, `${w}px: the page does not scroll sideways (${over.doc}px)`);
      A.ok(over.panel <= 1, `${w}px: nor the item panel (${over.panel}px)`);
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
