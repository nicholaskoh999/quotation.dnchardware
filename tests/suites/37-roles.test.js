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
   effect of a mode.  */
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
    bulkOpen: !!wqa.bulkOpen,
    detailsOpen: wqa.rows.filter(r => wqaRowIsOpen(r)).length,
    sel: wqaSelCount(),
    scope: wqa.applyScope,
    view: wqa.view,
    picks: document.querySelectorAll('#wqaRows .wqa-pick').length,
    headPick: !!q('#wqaListHead .wqa-pick-all'),
    selBarHidden: !!(q('#wqaSelBar') || {}).hidden,
    sections: [...document.querySelectorAll('#wqaBulkBody .wqa-panel-title')]
                .map(n => n.textContent.trim()),
    openSections: [...document.querySelectorAll('#wqaBulkBody .wqa-panel-body')].length,
    countBadge: ((q('#wqaBulkSelN') || {}).hidden ? '' : (q('#wqaBulkSelN') || {}).textContent || '').trim(),
  };
});

module.exports = async (browser, A) => {
  const S = A.suite('roles — Fast Edit, Bulk Edit and Details do not overlap');

  // ══ §39 · the row action is Details, and the toolbar action is Edit ══════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });

    const words = await page.evaluate(() => ({
      row: document.querySelector('[data-wqa-row="0"] .wqa-row-details').textContent.trim(),
      toolbar: document.querySelector('#wqaEditBtn').textContent.trim(),
      /* Edit must not read as a third view tab: it lives in its own group,
         outside the Compact/Expanded control. */
      editInToggle: !!document.querySelector('.wqa-view-toggle #wqaEditBtn'),
      viewBtns: [...document.querySelectorAll('.wqa-rows-head .wqa-view-toggle .wqa-view-btn')]
                  .map(n => n.textContent.trim()),
    }));
    A.eq(words.row, 'Details', 'the row action is Details');
    A.eq(words.toolbar, 'Edit', 'and the toolbar action is Edit — one word each');
    A.eq(String(words.editInToggle), 'false', 'Edit is NOT inside the view control');
    A.eq(words.viewBtns.join('|'), 'Compact|Expanded', 'which holds exactly the two views');

    /* Open it: the label becomes Close, because that is what pressing it does. */
    await page.evaluate(() => wqaToggleRow(0));
    await page.waitForTimeout(500);
    A.eq(await page.evaluate(() =>
      document.querySelector('[data-wqa-row="0"] .wqa-row-details').textContent.trim()),
      'Close', 'and says Close while it is open');
    await page.close();
  }

  // ══ §43 · Details is ONE row, and holds no geometry ══════════════════════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });
    await page.evaluate(() => wqaToggleRow(0));
    await page.waitForTimeout(600);

    const d = await page.evaluate(() => {
      const card = document.querySelector('[data-wqa-row="0"]');
      const body = card.querySelector('.wqa-row-body');
      return {
        openRows: wqa.rows.filter(r => wqaRowIsOpen(r)).length,
        row1Open: !!document.querySelector('[data-wqa-row="1"] .wqa-row-body'),
        sections: [...body.querySelectorAll('.wqa-sec-lbl')].map(n => n.textContent.trim()),
        /* Geometry belongs to Fast Edit. If Details grew a Size, DIA, L or Qty
           box back, this is the assertion that would catch it. */
        geomBoxes: [...body.querySelectorAll('input,select')]
          .filter(n => /size|dia|length|width|height|qty|quantity/i.test(
            (n.id || '') + ' ' + (n.getAttribute('placeholder') || '')))
          .map(n => n.id || n.getAttribute('placeholder')),
      };
    });
    A.eq(d.openRows, 1, 'Details opens exactly one row');
    A.eq(String(d.row1Open), 'false', 'and the row beside it stays shut');
    A.eq(d.sections.join(' · '), 'Reference · Specification · Pricing · Calculation',
      'holding reference, specification, pricing and calculation');
    A.eq(d.geomBoxes.join(','), '', 'and no duplicate geometry inputs of any kind');

    /* One at a time: opening row 2's Details closes row 1's. */
    await page.evaluate(() => wqaToggleRow(1));
    await page.waitForTimeout(600);
    const two = await page.evaluate(() => wqa.rows.map(r => !!wqaRowIsOpen(r)));
    A.eq(two.filter(Boolean).length, 1, 'opening another row leaves only one open');
    A.eq(String(two[1]), 'true', 'and it is the one that was asked for');
    await page.close();
  }

  // ══ §9/§10/§11 · Bulk Edit is shared values, in three sections ═══════════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });
    await page.evaluate(() => { wqa.bulkOpen = true; wqaRenderBulk(); });
    await page.waitForTimeout(500);

    const b = await look(page);
    A.eq(b.sections.join(' · '), 'Common Item Fields · Pricing Entry · Accessories',
      'Bulk Edit is exactly the three shared-value sections');

    /* The fields inside Common Item Fields are the shared-identity ones. This
       is the panel that used to be called "Correct Items" — the name and the
       contents now agree. */
    await page.evaluate(() => wqaTogglePanel('fix'));
    await page.waitForTimeout(500);
    const fields = await page.evaluate(() =>
      [...document.querySelectorAll('#wqaCommonFix .field label')].map(n => n.textContent.trim()));
    A.eq(fields.join(' · '), 'Product · Material · Finish · Size Type',
      'holding product, material, finish and size type — one value, many rows');

    // §11 · accordion: opening one closes the rest.
    A.eq((await look(page)).openSections, 1, 'opening a section opens exactly one');
    await page.evaluate(() => wqaTogglePanel('price'));
    await page.waitForTimeout(500);
    const acc = await page.evaluate(() => ({
      open: WQA_BULK_PANELS.filter(k => wqa.panels[k]),
      bodies: document.querySelectorAll('#wqaBulkBody .wqa-panel-body').length,
    }));
    A.eq(acc.open.join(','), 'price', 'opening Pricing closes Common Item Fields');
    A.eq(acc.bodies, 1, 'so Bulk Edit is never more than one section tall');
    await page.evaluate(() => wqaTogglePanel('acc'));
    await page.waitForTimeout(500);
    A.eq((await page.evaluate(() => WQA_BULK_PANELS.filter(k => wqa.panels[k]))).join(','),
      'acc', 'and Accessories closes Pricing');
    await page.close();
  }

  // ══ §10 · the geometry exception appears only in the case that needs it ══
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });
    await page.evaluate(() => { wqa.bulkOpen = true; wqaRenderBulk(); });
    await page.waitForTimeout(500);
    A.eq((await look(page)).sections.length, 3,
      'rows that already state a size and a thread get no geometry section at all');
    A.eq(await page.evaluate(() => el('wqaCommonItem').innerHTML.trim()), '',
      'it is absent, not merely collapsed — no second place to bulk-edit geometry');
    await page.close();
  }
  {
    /* And the documented exception: a shorthand document states lengths and
       quantities and never states the size or the thread. The extractor is
       forbidden from inventing either, so every row arrives with the same two
       blanks and typing M12 down thirty rows is not a workflow. */
    const page = await openApp(browser);
    await quickAddPaste(page, SHORTHAND, { expanded: false, settle: 1400 });
    await page.evaluate(() => { wqa.bulkOpen = true; wqaRenderBulk(); });
    await page.waitForTimeout(600);
    const sec = (await look(page)).sections;
    A.includes(sec.join(' · '), 'Fill Missing Size / TL',
      'a document that states neither size nor thread DOES get the fill-once section');
    A.eq(sec.length, 4, 'as a fourth section, named for the job rather than claiming the generic title');

    await page.evaluate(() => wqaTogglePanel('item'));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      wqaEditCommonItem('size', 'M12'); wqaEditCommonItem('thread', '75/75');
      wqaApplyItemToAll();
    });
    await page.waitForTimeout(1600);
    const filled = await rowState(page);
    A.eq(filled.map(r => r.size).join(','), 'M12,M12,M12',
      'and filling it once answers every row');
    A.eq(filled.map(r => r.thread).join(','), '75/75,75/75,75/75',
      'thread included — the two the document never stated');
    /* Having done its job it gets out of the way by itself. */
    await page.waitForTimeout(400);
    A.eq(await page.evaluate(() => el('wqaCommonItem').innerHTML.trim()), '',
      'after which the section is gone again — nothing is missing any more');
    await page.close();
  }

  // ══ §12/§14/§15 · selection is a set a person owns ══════════════════════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });

    const start = await look(page);
    A.eq(start.picks, 4, 'every compact row carries a tick box from the start');
    A.eq(String(start.headPick), 'true', 'with a select-all in the header');
    A.eq(start.sel, 0, 'nothing selected yet');
    A.eq(String(start.selBarHidden), 'true', 'and no selection bar until there is one');

    await page.evaluate(() => { wqaToggleRowSel(1); wqaToggleRowSel(3); });
    await page.waitForTimeout(500);
    const two = await look(page);
    A.eq(two.sel, 2, 'two rows can be ticked');
    A.eq(String(two.selBarHidden), 'false', 'which brings the selection bar');
    A.includes(two.countBadge, '2', 'and the Bulk Edit heading says how many');

    // §14 · select all, then release.
    await page.evaluate(() => wqaToggleSelAll());
    await page.waitForTimeout(500);
    A.eq((await look(page)).sel, 4, 'the header box takes the whole list');
    await page.evaluate(() => wqaToggleSelAll());
    await page.waitForTimeout(500);
    A.eq((await look(page)).sel, 0, 'and a second press gives it back');

    // §15 · a selection survives a re-render, in either direction.
    await page.evaluate(() => { wqaToggleRowSel(0); wqaToggleRowSel(2); });
    await page.waitForTimeout(400);
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(700);
    A.eq(await page.evaluate(() => wqaSelCount()), 2, 'it survives Compact → Expanded');
    await page.evaluate(() => wqaSetView('compact'));
    await page.waitForTimeout(700);
    const back = await look(page);
    A.eq(back.sel, 2, 'and Expanded → Compact');
    A.eq(await page.evaluate(() => wqa.rows.map(r => r.sel ? '1' : '0').join('')), '1010',
      'and it is the SAME two rows, not merely the same count');

    await page.evaluate(() => dcSetLang('zh'));
    await page.waitForTimeout(800);
    A.eq(await page.evaluate(() => wqaSelCount()), 2, 'it survives EN → 中文');
    A.includes(await page.evaluate(() => (el('wqaBulkSelN') || {}).textContent || ''), '2',
      'and the count is re-labelled rather than lost');
    await page.evaluate(() => dcSetLang('en'));
    await page.waitForTimeout(800);
    A.eq(await page.evaluate(() => wqa.rows.map(r => r.sel ? '1' : '0').join('')), '1010',
      'and 中文 → EN returns the same two rows');
    await page.close();
  }

  // ══ §13 · Selected with nothing selected REFUSES ════════════════════════
  {
    const page = await openApp(browser);
    await quickAddPaste(page, FOUR, { expanded: false, settle: 1200 });
    const before = (await rowState(page)).map(r => r.finish).join(',');

    await page.evaluate(() => {
      wqa.bulkOpen = true; wqaRenderBulk(); wqaTogglePanel('fix');
      wqaSetApplyScope('selected');
    });
    await page.waitForTimeout(700);
    const blocked = await page.evaluate(() => {
      const btn = document.querySelector('#wqaCommonFix [data-wqa-apply]');
      const msg = document.querySelector('#wqaCommonFix .wqa-none-sel');
      return { disabled: !!btn.disabled, title: btn.title || '',
               msgShown: !!msg && !msg.hidden, msg: msg ? msg.textContent.trim() : '' };
    });
    A.eq(String(blocked.disabled), 'true',
      'Selected Items with nothing selected disables Apply');
    A.eq(blocked.msg, 'Select at least one item.', 'and says exactly why');
    A.eq(String(blocked.msgShown), 'true', 'where the Apply it refuses is');

    /* The failure mode this exists to prevent: silently widening to every row. */
    await page.evaluate(() => { wqaEditFix('finish', 'HDG'); wqaApplyFixToAll(); });
    await page.waitForTimeout(1200);
    A.eq((await rowState(page)).map(r => r.finish).join(','), before,
      'and it does NOT quietly fall back to All Items — no row moved');

    await page.evaluate(() => wqaToggleRowSel(1));
    await page.waitForTimeout(600);
    A.eq(await page.evaluate(() =>
      !!document.querySelector('#wqaCommonFix [data-wqa-apply]').disabled), false,
      'ticking one row restores the Apply');
    await page.evaluate(() => wqaApplyFixToAll());
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
      wqaToggleRowSel(1); wqaToggleRowSel(3);
      wqa.bulkOpen = true; wqaRenderBulk(); wqaTogglePanel('price');
      wqaSetApplyScope('selected');
    });
    await page.waitForTimeout(800);

    /* §27 · scope, field, value and count are all readable BEFORE Apply. */
    const intent = await page.evaluate(() => {
      const btn = document.querySelector('#wqaCommonPrice [data-wqa-apply]');
      return { label: btn.textContent.trim(),
               scopeOn: [...document.querySelectorAll('.wqa-scope .wqa-view-btn')]
                          .filter(n => n.classList.contains('is-on'))
                          .map(n => n.textContent.trim()).join('') };
    });
    A.includes(intent.label, '2', 'the Apply button states how many items it will touch');
    A.eq(intent.scopeOn, 'Selected Items', 'and the scope is on the screen beside it');

    await page.evaluate(() => { wqaEditCommonPrice('markup', '5'); wqaApplyPriceToAll(); });
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

    /* §29 · and the compact summary under each affected row says so, without
       anybody opening Details. */
    const shown = await page.evaluate(() => wqa.rows.map((r, i) => {
      const meta = document.querySelector(`[data-wqa-row="${i}"] .wqa-meta`);
      return meta ? meta.textContent.replace(/\s+/g, ' ').trim() : '';
    }));
    A.includes(shown[1], '5%', 'row 2\'s pricing summary shows the new markup at once');
    A.includes(shown[3], '5%', 'and so does row 4\'s');
    A.excludes(shown[0], 'Markup 5%', 'while row 1\'s still shows its own');
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
    }));
    A.eq(used.ref, 'Q-2026-0430', 'a row can be priced from a historical record');

    /* The record was found for an UNDERSIZE M12. Move the row to FULLSIZE and
       it is no longer the thing that record describes. */
    await page.evaluate(() => {
      wqa.bulkOpen = true; wqaRenderBulk(); wqaTogglePanel('fix');
      wqaEditFix('sizeType', 'FULLSIZE'); wqaApplyFixToAll();
    });
    await page.waitForTimeout(1600);

    const after = await page.evaluate(() => ({
      ref: wqa.rows[0].usedHistoryRef,
      recipe: !!wqa.rows[0].usedHistoryRecipe,
      st: wqa.rows[0].sizeType,
      price: wqa.rows[0].calc && wqa.rows[0].calc.finalUnitPrice,
      card: (document.querySelector('[data-wqa-row="0"] .wqa-meta') || {}).textContent || '',
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

    // Details open, then Bulk Edit: Details closes.
    await page.evaluate(() => wqaToggleRow(0));
    await page.waitForTimeout(500);
    A.eq((await look(page)).detailsOpen, 1, 'Details is open');
    await page.evaluate(() => wqaToggleBulk());
    await page.waitForTimeout(600);
    let s = await look(page);
    A.eq(String(s.bulkOpen), 'true', 'opening Bulk Edit');
    A.eq(s.detailsOpen, 0, 'closes Details — two large editors never stack');

    // Bulk Edit open, then Details: Bulk Edit closes.
    await page.evaluate(() => wqaToggleRow(2));
    await page.waitForTimeout(600);
    s = await look(page);
    A.eq(s.detailsOpen, 1, 'opening Details');
    A.eq(String(s.bulkOpen), 'false', 'closes Bulk Edit — and the other way round');

    // Fast Edit outranks both.
    await page.evaluate(() => { wqaToggleBulk(); });
    await page.waitForTimeout(600);
    await page.evaluate(() => wqaEditStart());
    await page.waitForTimeout(800);
    s = await look(page);
    A.eq(String(s.editing), 'true', 'entering Fast Edit');
    A.eq(String(s.bulkOpen), 'false', 'collapses Bulk Edit');
    A.eq(s.detailsOpen, 0, 'and closes any Details');
    A.eq(s.view, 'compact', 'and forces Compact, because the grid is every row at once');

    const locked = await page.evaluate(() => ({
      bulkHead: [...document.querySelectorAll('#wqaBulkHead button')].every(b => b.disabled),
      details: [...document.querySelectorAll('#wqaRows .wqa-row-details')].every(b => b.disabled),
      picks: [...document.querySelectorAll('#wqaRows .wqa-pick')].every(b => b.disabled),
      headPick: !!(document.querySelector('#wqaListHead .wqa-pick-all') || {}).disabled,
    }));
    A.eq(String(locked.bulkHead), 'true', 'Bulk Edit cannot be reopened while the grid is open');
    A.eq(String(locked.details), 'true', 'nor Details');
    A.eq(String(locked.picks), 'true', 'and the ticks are frozen — the selection decides where a BULK apply lands');
    A.eq(String(locked.headPick), 'true', 'select-all included');

    await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(900);
    const freed = await page.evaluate(() => ({
      details: [...document.querySelectorAll('#wqaRows .wqa-row-details')].some(b => b.disabled),
      picks: [...document.querySelectorAll('#wqaRows .wqa-pick')].some(b => b.disabled),
    }));
    A.eq(String(freed.details), 'false', 'Done gives Details back');
    A.eq(String(freed.picks), 'false', 'and the ticks with it');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  return S;
};
