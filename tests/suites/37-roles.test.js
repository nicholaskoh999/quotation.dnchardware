/* ── Three mechanisms, three jobs ──────────────────────────────────────────
   The Quick Add review screen can write to a row from three places, and the
   whole point of this round is that they do not overlap:

     FAST EDIT   many rows, DIFFERENT values   — a spreadsheet
     BULK EDIT   many rows, ONE SHARED value   — a stamp
     DETAILS     one row,  everything about it — a form

   Overlap is what made the screen confusing, and the overlap was literal: two
   controls both said "Edit", and two panels inside Bulk Edit had each other's
   names — the one called "Correct Items" held the shared identity fields, and
   the one called "Common Item Fields" bulk-edited geometry.

   So this suite asserts the boundaries rather than the appearances: what each
   mechanism is allowed to touch, that none of them can be open beside
   another, and that a selection is a set a person owns rather than a side
   effect of a mode.

   AI review redesign, 2026-10-23. The three jobs are unchanged; their
   surfaces are new. FAST EDIT is a value pressed where it stands
   (`.wqa-tok` → one `input.wqa-ix`); BULK EDIT is the Bulk Adjust sheet
   (#wqaBulkSheet, every field at No change); DETAILS is the item's own panel
   (`.wqa-rv-detail`), opened by pressing the item. Tick boxes exist only in
   Selection mode (wqaSelEnter / wqaSelExit).  */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const FOUR = [
  'MS SAG ROD ZP UNDERSIZE',
  'M12 x 853 x 70/70 - 4pcs',
  'M12 x 943 x 70/70 - 6pcs',
  'M16 x 500 x 70/70 - 2pcs',
  'M20 x 620 x 70/70 - 3pcs',
].join('\n');

/* A shorthand document: lengths and quantities, and neither a size nor a
   thread anywhere in it. This is the one case the geometry bulk-fill exists
   for, and the only case it is allowed to appear in. */
const SHORTHAND = 'MS SAG ROD ZP UNDERSIZE\n1068 - 38pcs\n1430 - 148pcs\n1295 - 34pcs';

const REC = {
  quotationId: 1, refNo: 'Q-2026-0430', date: '2026-01-25', customer: 'Alpha Steel Sdn Bhd',
  companyId: 7, own: true, productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE',
  finish: 'ZP', cleanSize: 'M12', dimensionPreview: 'L 853 x TL 70/70mm',
  exactDims: true, qty: 4, unitPrice: 9.9, boltUnitPrice: 9.9, accessoryCost: 0,
  accessorySummary: '', accessoryAmbiguous: false, priceMode: 'auto',
  priceModeLabel: 'Auto Round', costRate: 2.8, addCost: 0.6, markup: 4,
  weight: 0.6927, legacy: false,
};
const HISTORY_API = { get_pricing_history: () => ({ ok: true, data: {
  records: [REC], total: 1, ownTotal: 1, otherTotal: 0, offset: 0, limit: 20 } }) };

const look = page => page.evaluate(() => {
  const q = s => document.querySelector(s);
  return {
    editing: !!wqa.edit,
    ix: document.querySelectorAll('#wqaRows .wqa-ix').length,
    sheetOpen: !!q('#wqaBulkSheet') && !q('#wqaBulkSheet').hidden,
    detailsOpen: wqa.rows.filter(r => wqaRowIsOpen(r)).length,
    panels: document.querySelectorAll('#wqaRows .wqa-rv-detail').length,
    sel: wqaSelCount(),
    selMode: !!wqa.selMode,
    view: wqa.view,
    picks: document.querySelectorAll('#wqaRows .wqa-it .wqa-pick').length,
    selBarHidden: !!(q('#wqaSelBar') || {}).hidden,
    selBarN: ((q('#wqaSelBar .wqa-selbar-n') || {}).textContent || '').trim(),
  };
});

/* Bulk Adjust, as it stands: its fields, what Apply would do, and whether it may. */
const sheet = page => page.evaluate(() => {
  const p = document.getElementById('wqaBulkSheetPanel');
  if (!p || !p.innerHTML.trim()) return null;
  return {
    fields: [...p.querySelectorAll('.wqa-bs-grid > .wqa-bs-f .wqa-bs-k')].map(n => n.textContent.trim()),
    untouched: [...p.querySelectorAll('select[data-bs]')].every(s => s.value === WQA_KEEP)
            && [...p.querySelectorAll('input[data-bs]')].every(n => n.value === ''),
    scopeOn: ((p.querySelector('.wqa-bs-sc.is-on') || {}).textContent || '').trim(),
    selDisabled: !!(p.querySelectorAll('.wqa-bs-sc')[1] || {}).disabled,
    lines: [...p.querySelectorAll('#wqaBsSummary li')].map(n => n.textContent.trim()),
    why: ((p.querySelector('#wqaBsSummary .wqa-bs-n') || {}).textContent || '').trim(),
    applyOff: !!(p.querySelector('#wqaBsApply') || {}).disabled,
  };
});

const toast = page => page.evaluate(() => {
  const t = document.querySelector('.toast, #toast, .dc-toast');
  return t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
});

/* A press on an item, where a person presses it — not on one of its values. */
const pressItem = (page, i) => page.evaluate(k =>
  document.querySelector(`[data-wqa-row="${k}"] .wqa-it-main`).click(), i);

module.exports = async (browser, A) => {
  const S = A.suite('roles — Fast Edit, Bulk Edit and Details do not overlap');

  // ══ §39 · the heading's actions, and the row's ═══════════════════════════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });

    const words = await page.evaluate(() => ({
      head: [...document.querySelectorAll('#wqaRvActs button')].map(n => n.textContent.trim()),
      row: [...document.querySelectorAll('[data-wqa-row="2"] .wqa-it-acts button')]
             .map(n => n.getAttribute('aria-label') || n.textContent.trim()),
      more: document.querySelector('[data-wqa-row="2"] .wqa-rv-more').getAttribute('aria-expanded'),
      /* the removed controls, by every name they had */
      gone: ['#wqaEditBtn', '#wqaViewCompact', '#wqaViewExpanded', '.wqa-view-toggle', '.wqa-row-details',
             '#wqaListHead', '#wqaBulkHead', '#wqaBulkBody', '#wqaCommonFix', '#wqaCommonItem',
             '#wqaCommonPrice', '#wqaCommonAcc'].filter(s => document.querySelector(s)),
    }));
    /* Retired 2026-10-23 (AI review redesign): "the row action is Details",
       "the toolbar action is Edit", "Edit is not inside the view control" and
       "the view control holds Compact|Expanded" — none of the four controls
       exists. What took their place is asserted instead: one word each, and
       the old ones are really gone rather than hidden. */
    A.eq(words.head.join('|'), 'Select|Bulk Adjust', 'the heading offers Select and Bulk Adjust — one word each');
    A.eq(words.row.join('|'), 'Pricing History|Remove item 3|More',
      'and an item offers its history, remove, and More');
    A.eq(words.gone.join(','), '', 'no Edit, view toggle, Details, list header or standing Bulk Edit is left in the page');
    A.eq(words.more, 'false', 'More starts closed');

    /* Open it: the label becomes Less, because that is what pressing it does. */
    await page.evaluate(() => document.querySelector('[data-wqa-row="2"] .wqa-rv-more').click());
    await page.waitForTimeout(500);
    const open = await page.evaluate(() => {
      const b = document.querySelector('[data-wqa-row="2"] .wqa-rv-more');
      return { lbl: b.getAttribute('aria-label'), exp: b.getAttribute('aria-expanded') };
    });
    A.eq(open.lbl, 'Less', 'and says Less while it is open');
    A.eq(open.exp, 'true', 'with aria-expanded saying the same');
    await page.close();
  }

  // ══ §43 · Details is ONE row ═════════════════════════════════════════════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });
    await pressItem(page, 2);
    await page.waitForTimeout(600);

    const d = await page.evaluate(() => {
      const card = document.querySelector('[data-wqa-row="2"]');
      const body = card.querySelector('.wqa-rv-detail');
      return {
        openRows: wqa.rows.filter(r => wqaRowIsOpen(r)).length,
        row1Open: !!document.querySelector('[data-wqa-row="1"] .wqa-rv-detail'),
        sections: [...body.querySelectorAll('.wqa-dt-sec')].map(n => n.textContent.trim()),
        fields: [...body.querySelectorAll('[data-ef]')].map(n => n.dataset.ef),
        ix: document.querySelectorAll('#wqaRows .wqa-ix').length,
      };
    });
    A.eq(d.openRows, 1, 'Details opens exactly one row');
    A.eq(String(d.row1Open), 'false', 'and the row beside it stays shut');
    A.eq(d.sections.join(' · '), 'Specification · Pricing',
      'holding the item\'s specification and its pricing');
    /* Retired 2026-10-23 (AI review redesign): "no duplicate geometry inputs of
       any kind" in Details — by design the panel now holds every value of the
       item (a phone edits them only there), and the row line holds them as
       pressable values. The boundary that keeps that from being two places at
       once is asserted instead: the panel's values are the item's own, once
       each, and an open panel and an inline box never coexist. */
    A.eq(d.fields.join(','), 'product,material,finish,sizeType,size,dia,length,threadLen,qty',
      'one box per value the item has, each exactly once');
    A.eq(d.ix, 0, 'and no inline value box is open beside the panel');

    /* Pressing one of the open item's values goes to ITS box in the panel,
       not to a second, inline copy of it. */
    await page.evaluate(() => document.querySelector('[data-wqa-row="2"] .wqa-it-main [data-tok="length"]').click());
    await page.waitForTimeout(400);
    const into = await page.evaluate(() => ({
      ix: document.querySelectorAll('#wqaRows .wqa-ix').length,
      focus: document.activeElement && document.activeElement.closest('.wqa-rv-detail') ? document.activeElement.getAttribute('data-ef') : '',
    }));
    A.eq(into.ix, 0, 'pressing a value of an open item opens no second box');
    A.eq(into.focus, 'length', 'it focuses that value in the panel instead');

    /* One at a time: opening row 4's Details closes row 3's. */
    await pressItem(page, 3);
    await page.waitForTimeout(600);
    const two = await page.evaluate(() => wqa.rows.map(r => !!wqaRowIsOpen(r)));
    A.eq(two.filter(Boolean).length, 1, 'opening another row leaves only one open');
    A.eq(String(two[3]), 'true', 'and it is the one that was asked for');
    await page.close();
  }

  // ══ §9/§10/§11 · Bulk Adjust is shared values, all at No change ══════════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });
    await page.evaluate(() => document.querySelector('#wqaRvActs .wqa-rv-bulkbtn').click());
    await page.waitForTimeout(500);

    const b = await sheet(page);
    /* Retired 2026-10-23 (AI review redesign): "exactly the three shared-value
       sections" and the §11 accordion (one section open at a time) — Bulk
       Adjust is one sheet of fields, with no sections to open. Its fields and
       its No-change rule are asserted instead. */
    A.eq(b.fields.join(' · '),
      'Product · Material · Finish · Size Type · Size · TL · Cost Rate · Additional Cost · Markup (%) · Price Mode · Accessories',
      'Bulk Adjust holds the shared identity, geometry, pricing and accessory fields');
    A.eq(String(b.untouched), 'true', 'every one of them starts at No change');
    A.eq(b.lines.length, 0, 'so Apply has nothing to say it will do');
    A.eq(b.why, 'Choose at least one field to change.', 'and says so');
    A.eq(String(b.applyOff), 'true', 'with Apply disabled until a field is changed');
    A.eq(b.scopeOn, 'All items (4)', 'scope All items, by default');

    /* A field changed says exactly what it will do, and only that. */
    await page.evaluate(() => wqaBsSet('finish', 'HDG'));
    await page.waitForTimeout(300);
    const one = await sheet(page);
    A.eq(one.lines.join(' | '), 'Set Finish to HDG', 'one field changed is one line of intent');
    A.eq(one.why, 'Applies to 4 items', 'with its count');
    A.eq(String(one.applyOff), 'false', 'and Apply available');
    await page.evaluate(() => wqaBulkApply());
    await page.waitForTimeout(1200);
    const after = await rowState(page);
    A.eq(after.map(r => r.finish).join(','), 'HDG,HDG,HDG,HDG', 'Apply writes that field to every item');
    A.eq(after.map(r => r.size).join(','), 'M12,M12,M16,M20', 'and nothing left at No change moved');
    A.eq(String(await page.evaluate(() => el('wqaBulkSheet').hidden)), 'true', 'and the sheet closes');
    await page.close();
  }

  // ══ §10 · the geometry exception is announced only when it is needed ═════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });
    /* Retired 2026-10-23 (AI review redesign): "no geometry section at all"
       and "#wqaCommonItem is absent, not collapsed" when every row already
       has a size and a thread — the dedicated fill-once panel was removed by
       design, and Size / TL are now two ordinary No-change fields of Bulk
       Adjust. What is still conditional is the prompt that sends a person
       there, so that is what is asserted. */
    A.eq(String(await page.evaluate(() => el('wqaRvNeed').hidden)), 'true',
      'rows that already state a size and a thread get no "missing size" prompt');
    await page.close();
  }
  {
    /* And the documented exception: a shorthand document states lengths and
       quantities and never states the size or the thread. The extractor is
       forbidden from inventing either, so every row arrives with the same two
       blanks and typing M12 down thirty rows is not a workflow. */
    const page = await openApp(browser);
    await quickAddPaste(page, SHORTHAND, { expanded: false, settle: 1400 });
    const need = await page.evaluate(() => ({
      hidden: el('wqaRvNeed').hidden, text: el('wqaRvNeed').textContent.replace(/\s+/g, ' ').trim() }));
    A.eq(String(need.hidden), 'false', 'a document that states neither size nor thread DOES get the prompt');
    A.includes(need.text, '3 items need a Thread Size or TL', 'naming the job and how many rows it is for');

    await page.evaluate(() => document.querySelector('#wqaRvNeed .btn').click());
    await page.waitForTimeout(500);
    A.eq(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-bs')), 'size',
      'its button opens Bulk Adjust on the Size field');
    await page.evaluate(() => { wqaBsSet('size', 'M12'); wqaBsSet('thread', '75/75'); wqaBulkApply(); });
    await page.waitForTimeout(1600);
    const filled = await rowState(page);
    A.eq(filled.map(r => r.size).join(','), 'M12,M12,M12',
      'and filling it once answers every row');
    A.eq(filled.map(r => r.thread).join(','), '75/75,75/75,75/75',
      'thread included — the two the document never stated');
    /* Having done its job it gets out of the way by itself. */
    await page.waitForTimeout(400);
    A.eq(String(await page.evaluate(() => el('wqaRvNeed').hidden)), 'true',
      'after which the prompt is gone again — nothing is missing any more');
    await page.close();
  }

  // ══ §12/§14/§15 · selection is a set a person owns ══════════════════════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });

    const start = await look(page);
    /* Retired 2026-10-23 (AI review redesign): "every compact row carries a
       tick box from the start" and "a select-all in the header" — ticks exist
       only in Selection mode now, so the opposite is asserted. */
    A.eq(start.picks, 0, 'no item carries a tick box until Selection mode is asked for');
    A.eq(start.sel, 0, 'nothing selected yet');
    A.eq(String(start.selBarHidden), 'true', 'and no selection bar');

    await page.evaluate(() => document.querySelector('#wqaRvActs .wqa-rv-selbtn').click());
    await page.waitForTimeout(400);
    const mode = await look(page);
    A.eq(mode.picks, 4, 'Select gives every item a tick box');
    A.eq(String(mode.selBarHidden), 'false', 'and the selection bar');
    A.eq(mode.selBarN, '0 selected', 'which starts at none');

    /* In Selection mode a press on an item ticks it; it never opens an editor. */
    await pressItem(page, 1);
    await page.evaluate(() => document.querySelector('[data-wqa-row="3"] [data-tok="length"]').click());
    await page.waitForTimeout(500);
    const two = await look(page);
    A.eq(two.sel, 2, 'two rows can be ticked — by the item, or by any value on it');
    A.eq(two.ix + two.panels, 0, 'and neither press opened a box or a panel');
    A.includes(two.selBarN, '2', 'the bar says how many');

    // §14 · select all, then release.
    await page.evaluate(() => wqaRvSelAll());
    await page.waitForTimeout(500);
    A.eq((await look(page)).sel, 4, 'select all takes the whole list');
    await page.evaluate(() => wqaRvSelAll());
    await page.waitForTimeout(500);
    A.eq((await look(page)).sel, 0, 'and a second press gives it back');

    // §15 · a selection survives a re-render, in either direction.
    await page.evaluate(() => { wqaRvToggleSel(0); wqaRvToggleSel(2); });
    await page.waitForTimeout(400);
    /* Retired 2026-10-23 (AI review redesign): "survives Compact → Expanded /
       Expanded → Compact" — there is no view to switch; it is asserted across
       a full redraw and across Bulk Adjust opening and closing instead. */
    await page.evaluate(() => wqaRenderRows(true));
    await page.waitForTimeout(400);
    A.eq(await page.evaluate(() => wqaSelCount()), 2, 'it survives a redraw of the list');
    await page.evaluate(() => { wqaBulkSheetOpen('selected'); });
    await page.waitForTimeout(400);
    A.eq((await sheet(page)).scopeOn, 'Selected items (2)', 'Bulk Adjust opened from it takes it as its scope');
    await page.evaluate(() => wqaBulkSheetClose());
    await page.waitForTimeout(400);
    A.eq(await page.evaluate(() => wqa.rows.map(r => r.sel ? '1' : '0').join('')), '1010',
      'and closing the sheet leaves the SAME two rows, not merely the same count');

    await page.evaluate(() => dcSetLang('zh'));
    await page.waitForTimeout(800);
    A.eq(await page.evaluate(() => wqaSelCount()), 2, 'it survives EN → 中文');
    A.includes(await page.evaluate(() => (document.querySelector('#wqaSelBar .wqa-selbar-n') || {}).textContent || ''), '2',
      'and the count is re-labelled rather than lost');
    await page.evaluate(() => dcSetLang('en'));
    await page.waitForTimeout(800);
    A.eq(await page.evaluate(() => wqa.rows.map(r => r.sel ? '1' : '0').join('')), '1010',
      'and 中文 → EN returns the same two rows');

    /* Leaving Selection mode leaves nothing behind. */
    await page.evaluate(() => wqaSelExit());
    await page.waitForTimeout(400);
    const out = await look(page);
    A.eq(out.picks + out.sel, 0, 'Done takes the ticks away and the selection with them');
    A.eq(String(out.selBarHidden), 'true', 'and the bar');
    await page.close();
  }

  // ══ §13 · Selected with nothing selected REFUSES ════════════════════════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });
    const before = (await rowState(page)).map(r => r.finish).join(',');

    await page.evaluate(() => { wqaBulkSheetOpen('all'); wqaBsScope('selected'); wqaBsSet('finish', 'HDG'); });
    await page.waitForTimeout(700);
    const blocked = await sheet(page);
    A.eq(String(blocked.selDisabled), 'true', 'with nothing selected, the Selected items scope is not offered');
    A.eq(String(blocked.applyOff), 'true',
      'and forced onto it anyway, Apply is disabled');
    A.eq(blocked.why, 'No items selected yet.', 'and says exactly why');

    /* The failure mode this exists to prevent: silently widening to every row. */
    await page.evaluate(() => wqaBulkApply());
    await page.waitForTimeout(1200);
    A.eq((await rowState(page)).map(r => r.finish).join(','), before,
      'and it does NOT quietly fall back to All Items — no row moved');
    A.includes(await toast(page), 'No items selected yet', 'the message is the refusal');

    /* Choosing items is Selection mode; its bar brings the sheet back. */
    await page.evaluate(() => wqaBsPick());
    await page.waitForTimeout(500);
    A.eq((await look(page)).selMode + '/' + (await look(page)).sheetOpen, 'true/false',
      'Choose items… steps the sheet aside for Selection mode');
    await page.evaluate(() => wqaRvToggleSel(1));
    await page.waitForTimeout(400);
    await page.evaluate(() => [...document.querySelectorAll('#wqaSelBar .btn')].find(b => b.textContent.trim() === 'Bulk Adjust').click());
    await page.waitForTimeout(500);
    await page.evaluate(() => wqaBsSet('finish', 'HDG'));
    await page.waitForTimeout(300);
    const ok = await sheet(page);
    A.eq(ok.scopeOn, 'Selected items (1)', 'the selection bar\'s Bulk Adjust opens on the selection');
    A.eq(String(ok.applyOff), false + '', 'ticking one row restores the Apply');
    await page.evaluate(() => wqaBulkApply());
    await page.waitForTimeout(1400);
    A.eq(await page.evaluate(() => wqa.rows.map(r => r.finish).join(',')),
      'ZP,HDG,ZP,ZP', 'and it lands on that row alone');
    await page.close();
  }

  // ══ §41 · bulk pricing hits the selection, and only the selection ═══════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });
    const before = await rowState(page);

    await page.evaluate(() => {
      wqaSelEnter(); wqaRvToggleSel(1); wqaRvToggleSel(3);
      wqaBulkSheetOpen('selected'); wqaBsSet('markup', '5');
    });
    await page.waitForTimeout(800);

    /* §27 · scope, field, value and count are all readable BEFORE Apply. */
    const intent = await sheet(page);
    A.eq(intent.why, 'Applies to 2 items', 'the sheet states how many items Apply will touch');
    A.eq(intent.lines.join(' | '), 'Set Markup to 5%', 'which field, and to what');
    A.eq(intent.scopeOn, 'Selected items (2)', 'and the scope is on the screen beside it');

    await page.evaluate(() => wqaBulkApply());
    await page.waitForTimeout(1600);

    const after = await page.evaluate(() => wqa.rows.map(r => ({
      markup: String((r.priceOverride || {}).markup == null ? '' : r.priceOverride.markup),
      price: r.calc ? r.calc.finalUnitPrice : null,
    })));
    A.eq(after.map(r => r.markup).join('|'), '|5||5',
      'markup 5% lands on rows 2 and 4, and on no others');
    A.eq(String(after[0].price), String(before[0].price), 'row 1 is untouched');
    A.eq(String(after[2].price), String(before[2].price), 'row 3 is untouched');
    A.ok(after[1].price !== before[1].price, 'row 2 re-priced');
    A.ok(after[3].price !== before[3].price, 'row 4 re-priced');

    /* §29 · and the pricing line each affected row is read by says so, without
       anybody opening Details. A row inside a series that shares its heading's
       pricing shows none of its own, so the heading's is the one it is read by. */
    const shown = await page.evaluate(() => wqa.rows.map((r, i) => {
      const card = document.querySelector(`[data-wqa-row="${i}"]`);
      const own = card.querySelector('.wqa-px-sum');
      const ser = card.closest('.wqa-ser');
      const head = ser && ser.querySelector('.wqa-ser-px');
      return (own ? own.textContent : head ? head.textContent : '').replace(/\s+/g, ' ').trim();
    }));
    A.includes(shown[1], 'Markup 5%', 'row 2\'s pricing line shows the new markup at once');
    A.includes(shown[3], 'Markup 5%', 'and so does row 4\'s');
    A.excludes(shown[0], 'Markup 5%', 'while row 1\'s still shows its own');
    A.excludes(shown[2], 'Markup 5%', 'and so does row 3\'s');
    await page.close();
  }

  // ══ §28 · a bulk identity change drops a Previous Price that stops fitting
  {
    const page = await openApp(browser, { api: HISTORY_API });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1300 });
    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(1100);
    await page.evaluate(() => wqaHistUse(0, 0));
    await page.waitForTimeout(1100);

    const used = await page.evaluate(() => ({
      ref: wqa.rows[0].usedHistoryRef,
      price: wqa.rows[0].calc && wqa.rows[0].calc.finalUnitPrice,
      card: (document.querySelector('[data-wqa-row="0"] .wqa-it-sub') || {}).textContent || '',
    }));
    A.eq(used.ref, 'Q-2026-0430', 'a row can be priced from a historical record');
    A.includes(used.card, 'Q-2026-0430', 'and the row says so under itself');

    /* The record was found for an UNDERSIZE M12. Move the row to FULLSIZE and
       it is no longer the thing that record describes. */
    await page.evaluate(() => { wqaHistToggle(0); wqaBulkSheetOpen('all'); wqaBsSet('sizeType', 'FULLSIZE'); wqaBulkApply(); });
    await page.waitForTimeout(1600);

    const after = await page.evaluate(() => ({
      ref: wqa.rows[0].usedHistoryRef,
      recipe: !!wqa.rows[0].usedHistoryRecipe,
      st: wqa.rows[0].sizeType,
      price: wqa.rows[0].calc && wqa.rows[0].calc.finalUnitPrice,
      card: ['.wqa-it-main', '.wqa-it-sub'].map(s => (document.querySelector(`[data-wqa-row="0"] ${s}`) || {}).textContent || '').join(' '),
    }));
    A.eq(after.st, 'FULLSIZE', 'the bulk change lands');
    A.eq(after.ref, '', 'and the Previous Price reference is dropped — it described the old identity');
    A.eq(String(after.recipe), 'false', 'along with the claim that the price came from a record');
    A.excludes(after.card, 'Q-2026-0430', 'so no stale reference is left on the row');
    /* The rates the record contributed stay: they are the row's own pricing
       entry now, and the price recomputes on the new bar rather than jumping
       twice for a reason nobody asked for. */
    A.ok(after.price > 0, 'the row still has a price');
    A.ok(after.price !== used.price, 'recomputed on the identity it actually has now');
    await page.close();
  }

  // ══ §16/§17/§18 · no two write surfaces at once ═════════════════════════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });

    // Details open, then Bulk Adjust: the sheet takes the screen.
    await pressItem(page, 2);
    await page.waitForTimeout(500);
    A.eq((await look(page)).detailsOpen, 1, 'Details is open');
    await page.evaluate(() => document.querySelector('#wqaRvActs .wqa-rv-bulkbtn').click());
    await page.waitForTimeout(600);
    let s = await look(page);
    A.eq(String(s.sheetOpen), 'true', 'opening Bulk Adjust');
    /* Retired 2026-10-23 (AI review redesign): "opening Bulk Edit closes
       Details" — Bulk Adjust is a sheet over the review, not a panel beside
       the rows, so the panel under it is left as it was. What made two editors
       a hazard was being able to type into both; that is asserted instead. */
    const covered = await page.evaluate(() => {
      const n = document.querySelector('[data-wqa-row="2"] .wqa-rv-detail [data-ef="qty"]');
      const r = n.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && !!hit.closest('#wqaBulkSheet');
    });
    A.eq(String(covered), 'true', 'and the open panel under it cannot be reached — the sheet covers it');
    A.eq(s.ix, 0, 'with no inline box open either');

    // Bulk Adjust closed, then a value: one box, and no panel beside it.
    await page.evaluate(() => { wqaBulkSheetClose(); wqaToggleRow(2); });
    await page.waitForTimeout(500);
    /* A series row's size lives in its heading, so it is edited in the row's
       panel — never as a box on a line that does not show it. */
    await page.evaluate(() => wqaEditStart(0, 'size'));
    await page.waitForTimeout(400);
    s = await look(page);
    A.eq(`${s.ix}/${s.detailsOpen}`, '0/1', 'a series row\'s size opens its panel, not an inline box');
    await page.evaluate(() => wqaToggleRow(0));
    await page.waitForTimeout(400);
    /* Row 3 stands alone, so its length is a box in place. */
    await page.evaluate(() => wqaEditStart(2, 'length'));
    await page.waitForTimeout(500);
    s = await look(page);
    /* Retired 2026-10-23 (AI review redesign): Fast Edit "forces Compact" and
       the locks on #wqaBulkHead, .wqa-row-details, the header select-all and
       the ticks while the grid is open — there is no grid, view or standing
       Bulk Edit to lock. The rules that still hold are asserted. */
    A.eq(String(s.editing), 'false', 'Fast Edit is a value edited where it stands — no grid-wide session opens');
    A.eq(s.ix, 1, 'one box, on one value');
    A.eq(s.detailsOpen, 0, 'and no Details beside it');

    // A value open, then an item: the box is committed and the panel opens.
    await pressItem(page, 3);
    await page.waitForTimeout(500);
    s = await look(page);
    A.eq(s.ix, 0, 'pressing an item closes the open box');
    A.eq(s.detailsOpen, 1, 'and opens that item');

    // A value open, then Selection mode: ticks only, nothing editable.
    await page.evaluate(() => { wqaToggleRow(3); wqaEditStart(2, 'length'); });
    await page.waitForTimeout(400);
    await page.evaluate(() => wqaSelEnter());
    await page.waitForTimeout(400);
    s = await look(page);
    A.eq(s.ix + s.panels, 0, 'entering Selection mode closes every editor');
    await page.evaluate(() => wqaSelExit());
    await page.waitForTimeout(300);
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  /* ── CR-01 · a message that knows which rows it was about ────────────────
     The data was always right — Selected Items really did write only to the
     ticked rows. What was wrong was the sentence afterwards, which said "all
     items" whatever the scope had been. A person who reads the toast and not
     the rows was told something false about their own quotation.

     Both scopes, both languages. Bulk Adjust has one apply path and one
     sentence ("Adjusted N items"), so the count is what must be true. */
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1300 });

    for (const lang of ['en', 'zh']) {
      await page.evaluate(l => dcSetLang(l), lang);
      await page.waitForTimeout(500);

      // ── All items: the sentence states every item.
      await page.evaluate(() => { wqaBulkSheetOpen('all'); wqaBsSet('markup', '3'); wqaBulkApply(); });
      await page.waitForTimeout(900);
      const all = await toast(page);
      A.ok(all.length > 0, `${lang} · All items: a message appears`);
      /* Retired 2026-10-23 (AI review redesign): All Items "says all items" /
         "says 全部项目" — the Bulk Adjust sentence states the count in both
         scopes, never the word "all". */
      A.includes(all, lang === 'en' ? 'Adjusted 4 items' : '已调整 4 个项目', `${lang} · All items states all four`);

      // ── Selected items: it must name the count and never say "all".
      await page.evaluate(() => {
        wqaSelEnter(); [1, 3].forEach(i => wqaRvToggleSel(i));
        wqaBulkSheetOpen('selected'); wqaBsSet('markup', '7'); wqaBulkApply();
      });
      await page.waitForTimeout(900);
      const sel = await toast(page);
      A.includes(sel, lang === 'en' ? 'Adjusted 2 items' : '已调整 2 个项目', `${lang} · Selected: the message states the count`);
      if (lang === 'en') A.excludes(sel, 'all items', 'EN · and never claims all items');
      else A.excludes(sel, '全部项目', '中文 · and never claims 全部项目');

      /* and the data really did stay inside the selection */
      const marks = await page.evaluate(() =>
        wqa.rows.map(r => String((r.priceOverride || {}).markup == null ? '' : r.priceOverride.markup)));
      A.eq(marks.join('|'), '3|7|3|7', `${lang} · the rows agree with the message`);
      A.eq(String(await page.evaluate(() => wqa.selMode || wqaSelCount() > 0)), 'false',
        `${lang} · and a selection that has been used is released`);
    }
    await page.evaluate(() => dcSetLang('en'));
    await page.close();
  }

  /* ── CR-02 · no Close that cannot close ──────────────────────────────────
     A control that cannot do what it says is worse than no control: it
     teaches a person that the screen does not respond. */
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1300 });

    /* Retired 2026-10-23 (AI review redesign): the global-Expanded half —
       "Expanded renders no row action that cannot close the row", every form
       open by the view — there is no Expanded view on the screen any more. */
    const exp = await page.evaluate(() => ({
      more: document.querySelectorAll('#wqaRows .wqa-rv-more').length,
      hist: document.querySelectorAll('#wqaRows .wqa-it-acts .wqa-row-hist').length,
      del: document.querySelectorAll('#wqaRows .wqa-it-acts .wqa-row-del').length,
    }));
    A.eq(exp.more, 4, 'every row offers More');
    A.eq(exp.hist, 4, 'History is offered on every row');
    A.eq(exp.del, 4, 'and remove');

    await page.evaluate(() => document.querySelector('[data-wqa-row="0"] .wqa-rv-more').click());
    await page.waitForTimeout(600);
    A.eq(await page.evaluate(() =>
      document.querySelector('[data-wqa-row="0"] .wqa-rv-more').getAttribute('aria-label')),
      'Less', 'the open row offers Less');
    await page.evaluate(() =>
      document.querySelector('[data-wqa-row="0"] .wqa-rv-more').click());
    await page.waitForTimeout(700);
    A.eq(await page.evaluate(() => wqa.rows.filter(r => wqaRowIsOpen(r)).length), 0,
      'and pressing it actually closes the row');
    /* The panel's own Done, and the item itself, close it too. */
    await pressItem(page, 0);
    await page.waitForTimeout(500);
    await page.evaluate(() => [...document.querySelectorAll('[data-wqa-row="0"] .wqa-dt-foot .btn')].find(b => b.textContent.trim() === 'Done').click());
    await page.waitForTimeout(500);
    A.eq(await page.evaluate(() => wqa.rows.filter(r => wqaRowIsOpen(r)).length), 0, 'Done in the panel closes it');
    await pressItem(page, 0);
    await page.waitForTimeout(400);
    await pressItem(page, 0);
    await page.waitForTimeout(400);
    A.eq(await page.evaluate(() => wqa.rows.filter(r => wqaRowIsOpen(r)).length), 0, 'and so does pressing the item again');
    await page.close();
  }

  /* ── CR-03 · a clear that refuses an empty selection ─────────────────────
     Clear All Accessories carries the panel's scope, so with "Selected" and
     nothing ticked it had nothing to clear — and said "Accessories cleared"
     anyway. A destructive action reporting success over an empty set is the
     worst of the three: it reads as "done" and invites nobody to check.     */
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1300 });

    /* give the rows something to lose */
    await page.evaluate(() => {
      wqaBulkSheetOpen('all'); wqaBsSet('acc', 'set');
      wqaBsEditAcc('nut', 'enabled', true);
      wqaBsEditAcc('nut', 'qty', 2);
      wqaBulkApply();
    });
    await page.waitForTimeout(1400);
    const withAcc = await page.evaluate(() => wqa.rows.filter(r => wqaAccHas(r.acc)).length);
    A.eq(withAcc, 4, 'all four rows carry an accessory');

    await page.evaluate(() => { wqaBulkSheetOpen('all'); wqaBsScope('selected'); wqaBsSet('acc', 'clear'); });
    await page.waitForTimeout(800);
    const guard = await sheet(page);
    A.eq(guard.lines.join(' | '), 'Remove accessories', 'the sheet says it would remove accessories');
    A.eq(String(guard.applyOff), 'true', 'but with nothing selected Apply is disabled');
    A.eq(guard.why, 'No items selected yet.', 'with the same refusal wording as everywhere else in the sheet');

    /* and if it is called anyway, it changes nothing and says so */
    await page.evaluate(() => wqaBulkApply());
    await page.waitForTimeout(900);
    A.eq(await page.evaluate(() => wqa.rows.filter(r => wqaAccHas(r.acc)).length), 4,
      'calling it directly clears nothing — Selected never becomes All');
    A.includes(await toast(page), 'No items selected yet', 'and the message is the refusal, not a success');

    /* tick two and it works, on those two, and says which */
    await page.evaluate(() => {
      wqaBulkSheetClose(); wqaSelEnter(); wqaRvToggleSel(0); wqaRvToggleSel(2);
      wqaBulkSheetOpen('selected'); wqaBsSet('acc', 'clear'); wqaBulkApply();
    });
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => ({
      has: wqa.rows.map(r => wqaAccHas(r.acc) ? '1' : '0').join(''),
      toast: (document.querySelector('.toast, #toast, .dc-toast') || {}).textContent || '',
    }));
    A.eq(after.has, '0101', 'ticking two clears exactly those two');
    A.includes(after.toast, '2', 'and the message states how many');
    A.excludes(after.toast, 'all items', 'never claiming all items');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  return S;
};
