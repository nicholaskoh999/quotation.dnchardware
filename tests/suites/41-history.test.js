/* ── Revision history, from the page's side ────────────────────────────────
   The server derives what changed; this suite measures what the BROWSER does
   with that answer, and the three things it must never do:

     · offer history for a quotation that has none — a draft has nothing
       recorded, so the control is not offered rather than offered and refused;
     · turn "we have no record of the state before this" into a diff;
     · report a reorder as a removal plus an addition.

   Everything below drives the shipped paths: the control is the one in the
   saved-quotation action area, opening it goes through openHistoryModal(), and
   the rendering is whatever the page makes of the stubbed answer. What is
   asserted is what a person would read.                                      */
'use strict';
const { openApp } = require('../lib/harness');

const U = n => 'itm_' + String(n).repeat(32).slice(0, 32);

const SAVED = {
  id: 42, ref_no: 'DC-TEST-001', quote_date: '2026-08-29',
  customer_name: 'Alpha Sdn Bhd',
  items: [{ itemType: 'bolt', desc: 'SAG ROD', size: 'M12 x 500', sizeCode: 'M12',
            cleanSize: 'M12', dimensionPreview: 'L 500', qty: 4, material: 'MS',
            finish: 'ZP', finalUnitPrice: 5.76, totalAmount: 23.04, item_uid: U(1) }],
};

const ACTOR = { user_id: 7, username: 'nicholas', display_name: 'Nicholas Koh' };

/* One revision, shaped exactly as api.php answers. */
const rev = (no, event, changes, actor) => ({
  revision_no: no, event_type: event, created_at: '2026-08-29 15:41:00',
  actor: actor === undefined ? ACTOR : actor,
  snapshot_schema_version: 1, changes,
});

const historyOf = revisions => ({ ok: true, quotation_id: 42, revisions });

/* What the panel is showing, read the way a person reads it. */
async function panel(page) {
  return page.evaluate(() => {
    const body = document.getElementById('historyBody');
    const open = document.getElementById('historyModal').classList.contains('open');
    return {
      open,
      text: body ? body.innerText.replace(/\s+/g, ' ').trim() : '',
      entries: body ? body.querySelectorAll('.hist-entry').length : 0,
      state: body && body.querySelector('[data-hist-state]')
             ? body.querySelector('[data-hist-state]').getAttribute('data-hist-state') : null,
    };
  });
}

async function openHistory(browser, revisions, extra, captureBefore) {
  const page = await openApp(browser, Object.assign({
    handoff: SAVED,
    api: { get_quotation_history: historyOf(revisions) },
  }, extra || {}));
  await page.waitForFunction(() => typeof editingQuoteId !== 'undefined' && editingQuoteId, null, { timeout: 15000 });
  if (captureBefore) {
    page._dcBefore = await page.evaluate(() => ({
      locked: quoteLocked, loaded: loadedSavedQuote,
      fieldDisabled: (document.getElementById('qi-customer') || {}).disabled,
      saveDisabled: (document.getElementById('saveQuoteBtn') || {}).disabled,
    }));
  }
  await page.click('#historyBtn');
  await page.waitForFunction(
    () => document.getElementById('historyModal').classList.contains('open')
       && !document.querySelector('[data-hist-state="histLoading"]'),
    null, { timeout: 15000 });
  return page;
}

module.exports = async (browser, A) => {
  A.suite('revision history — what was recorded, and nothing more');

  // ── the control follows the saved state ─────────────────────────────────
  {
    const fresh = await openApp(browser);
    const draft = await fresh.evaluate(() => {
      const b = document.getElementById('historyBtn');
      return { exists: !!b, shown: !!b && b.style.display !== 'none',
               id: typeof editingQuoteId === 'undefined' ? null : editingQuoteId };
    });
    A.ok(draft.exists, 'the History control is in the page');
    A.eq(draft.id, 'null', 'a new quotation has no saved id');
    A.ok(!draft.shown, 'and the History control is NOT offered for it');

    /* Not merely hidden — asking it to open does nothing, so there is no way
       to reach a history that cannot exist. */
    await fresh.evaluate(() => openHistoryModal());
    const after = await panel(fresh);
    A.ok(!after.open, 'and calling it directly still opens nothing');
    A.ok(fresh._dcErrors.length === 0, 'no page errors: ' + fresh._dcErrors.join(' | '));
    await fresh.close();
  }

  {
    const saved = await openApp(browser, { handoff: SAVED });
    await saved.waitForFunction(() => typeof editingQuoteId !== 'undefined' && editingQuoteId, null, { timeout: 15000 });
    const shown = await saved.evaluate(() => {
      const b = document.getElementById('historyBtn');
      return { shown: b.style.display !== 'none', label: b.textContent.trim() };
    });
    A.ok(shown.shown, 'a SAVED quotation offers the History control');
    A.eq(shown.label, 'History', 'labelled from the dictionary');
    await saved.close();
  }

  // ── a create renders as a creation, with no invented before ─────────────
  {
    const page = await openHistory(browser, [
      rev(1, 'create', [{ kind: 'created', item_count: 3, total_amount: '1240.00',
                          company: 'Alpha Engineering Sdn Bhd' }]),
    ]);
    const p = await panel(page);
    A.ok(p.open, 'the History panel opens');
    A.eq(p.entries, 1, 'one entry');
    A.includes(p.text, '#1', 'carrying the revision number');
    A.includes(p.text, 'CREATED', 'and the event, as the badge renders it');
    A.includes(p.text, '2026', 'and when it happened');
    A.includes(p.text, 'Nicholas Koh', 'and who did it');
    A.includes(p.text, 'Quotation created', 'the creation is stated plainly');
    A.includes(p.text, '3 items', 'with the item count');
    A.includes(p.text, 'RM 1240.00', 'the total, formatted as money');
    A.includes(p.text, 'Alpha Engineering', 'and the frozen company');
    A.excludes(p.text, '→', 'and NO before/after arrow — a creation has no before');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ── a scalar change renders old → new ───────────────────────────────────
  {
    const page = await openHistory(browser, [
      rev(2, 'update', [
        { kind: 'field', field: 'valid_until', from: '2026-08-30', to: '2026-09-15' },
        { kind: 'field', field: 'total_amount', from: '1200.00', to: '1450.00' },
      ]),
      rev(1, 'create', [{ kind: 'created', item_count: 1, total_amount: '1200.00', company: null }]),
    ]);
    const p = await panel(page);
    A.eq(p.entries, 2, 'both revisions render');
    A.includes(p.text, 'Valid Until', 'the field is named from the dictionary');
    A.includes(p.text, '→', 'with an arrow between the two values');
    A.includes(p.text, 'Total', 'and the total is named');
    A.includes(p.text, 'RM 1200.00', 'its old value as money');
    A.includes(p.text, 'RM 1450.00', 'and its new one');
    A.excludes(p.text, 'total_amount', 'never showing the raw column name');
    A.excludes(p.text, 'valid_until', 'nor the raw field key');

    /* Newest first, as the server ordered it. */
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.hist-entry')].map(e => e.getAttribute('data-hist-rev')));
    A.eq(order.join(','), '2,1', 'newest first');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ── an item edit is one item, with its fields grouped under it ──────────
  {
    const page = await openHistory(browser, [
      rev(3, 'update', [{ kind: 'item_changed', item: 'M12 · L 500',
                          fields: [{ field: 'qty', from: '5', to: '10' },
                                   { field: 'finalUnitPrice', from: '3.50', to: '3.80' }],
                          other: 0 }]),
    ]);
    const p = await panel(page);
    A.includes(p.text, 'Item changed', 'the item is reported as changed');
    A.includes(p.text, 'M12', 'named by what the item carries');
    A.includes(p.text, 'Qty', 'with the quantity field named');
    A.includes(p.text, 'Unit Price', 'and the price field');
    A.includes(p.text, 'RM 3.50', 'the old price as money');
    A.includes(p.text, 'RM 3.80', 'and the new one');
    A.eq(await page.evaluate(() => document.querySelectorAll('.hist-change').length), 1,
         'and BOTH fields sit under ONE item, not two unrelated changes');
    A.excludes(p.text, 'itm_', 'the item_uid is never shown to a normal reader');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ── added, removed, reordered ───────────────────────────────────────────
  {
    const page = await openHistory(browser, [
      rev(6, 'update', [{ kind: 'items_reordered' }]),
      rev(5, 'update', [{ kind: 'item_removed', item: 'M16 · L 250', qty: '2' }]),
      rev(4, 'update', [{ kind: 'item_added', item: 'M20 · L 500', qty: '4' }]),
    ]);
    const p = await panel(page);
    A.eq(p.entries, 3, 'three entries');
    A.includes(p.text, 'Item added', 'an addition says so');
    A.includes(p.text, 'M20', 'naming the item that arrived');
    A.includes(p.text, 'Item removed', 'a removal says so');
    A.includes(p.text, 'M16', 'naming the item that left');
    A.includes(p.text, 'Items reordered', 'and a reorder says so');

    /* THE ONE THING A REORDER MUST NEVER LOOK LIKE. */
    const reorderEntry = await page.evaluate(() => {
      const e = [...document.querySelectorAll('.hist-entry')]
        .find(x => x.getAttribute('data-hist-rev') === '6');
      return e ? e.innerText.replace(/\s+/g, ' ').trim() : '';
    });
    A.includes(reorderEntry, 'Items reordered', 'the reorder entry states the reorder');
    A.excludes(reorderEntry, 'Item added', 'and reports NO addition');
    A.excludes(reorderEntry, 'Item removed', 'and NO removal');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ── the first recorded revision being an UPDATE is said, not guessed ────
  {
    const page = await openHistory(browser, [
      rev(1, 'update', [{ kind: 'no_previous' }], { user_id: null, username: null, display_name: null }),
    ]);
    const p = await panel(page);
    A.eq(p.entries, 1, 'the legacy revision renders');
    A.includes(p.text, 'First recorded revision', 'and says it is the first recorded one');
    A.includes(p.text, 'Previous state is not available', 'and that there is nothing to compare it to');
    A.includes(p.text, 'UPDATED', 'it is still shown as the update it is');
    A.excludes(p.text, 'Quotation created', 'never quietly turned into a creation');
    A.excludes(p.text, '→', 'and no before/after values are invented');
    /* An actor the record does not name is unnamed, not filled in. */
    A.includes(p.text, 'Legacy / Unknown', 'a nameless actor is labelled as unknown');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ── a snapshot format this viewer does not know ─────────────────────────
  {
    const page = await openHistory(browser, [
      Object.assign(rev(9, 'update', [{ kind: 'unsupported_version', version: 9 }]),
                    { snapshot_schema_version: 9 }),
    ]);
    const p = await panel(page);
    A.includes(p.text, 'not supported by this viewer', 'an unknown format says so');
    A.excludes(p.text, '→', 'and nothing about its contents is guessed at');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ── empty, failed, and closing ──────────────────────────────────────────
  {
    const page = await openHistory(browser, [], null, true);
    const before = page._dcBefore;
    const p = await panel(page);
    A.eq(p.state, 'histEmpty', 'an empty history renders the empty state');
    A.includes(p.text, 'No revision history recorded yet', 'and says so in words');
    A.eq(p.entries, 0, 'with no entries');

    await page.evaluate(() => closeModal('historyModal'));
    const closed = await panel(page);
    A.ok(!closed.open, 'the panel closes');

    /* HISTORY IS A VIEWER, NOT A MODE THE PAGE GETS STUCK IN. A quotation
       handed over from companies.php arrives LOCKED — that is the app's own
       behaviour and not something this round changed — so what must hold is
       that opening and closing history leaves that state exactly as it was,
       and that unlocking still works afterwards. */
    const after = await page.evaluate(() => ({
      locked: quoteLocked, loaded: loadedSavedQuote,
      fieldDisabled: (document.getElementById('qi-customer') || {}).disabled,
      saveDisabled: (document.getElementById('saveQuoteBtn') || {}).disabled,
    }));
    A.eq(String(after.locked), String(before.locked), 'the lock state is exactly what it was before history opened');
    A.eq(String(after.fieldDisabled), String(before.fieldDisabled), 'and so is the customer field');
    A.eq(String(after.saveDisabled), String(before.saveDisabled), 'and the save button');

    await page.evaluate(() => unlockSavedQuotation());
    await page.evaluate(() => { const e = document.getElementById('qi-customer'); if (e) e.value = 'After History Sdn Bhd'; });
    const unlocked = await page.evaluate(() => {
      const e = document.getElementById('qi-customer');
      return { value: e ? e.value : null, disabled: e ? e.disabled : true,
               saveDisabled: (document.getElementById('saveQuoteBtn') || {}).disabled };
    });
    A.ok(!unlocked.disabled, 'the quotation still unlocks for editing after history');
    A.eq(unlocked.value, 'After History Sdn Bhd', 'and takes an edit');
    A.ok(!unlocked.saveDisabled, 'with saving available again');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  {
    /* A FAILED READ IS NOT AN EMPTY HISTORY. One says nothing was recorded,
       the other says nothing could be read, and showing the first for the
       second would quietly hide a broken deployment. */
    const page = await openApp(browser, {
      handoff: SAVED,
      api: { get_quotation_history: { ok: false, error: 'Table does not exist' } },
    });
    await page.waitForFunction(() => typeof editingQuoteId !== 'undefined' && editingQuoteId, null, { timeout: 15000 });
    await page.click('#historyBtn');
    await page.waitForFunction(
      () => !document.querySelector('[data-hist-state="histLoading"]'), null, { timeout: 15000 });
    const p = await panel(page);
    A.eq(p.state, 'histError', 'a refused read renders the error state');
    A.includes(p.text, 'could not be loaded', 'and says the history could not be read');
    A.excludes(p.text, 'No revision history recorded yet', 'NOT the empty state');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  return A;
};
