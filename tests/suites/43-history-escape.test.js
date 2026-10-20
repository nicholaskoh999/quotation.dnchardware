/* ── Revision history: the created summary is inert markup ────────────────
   dcHistChange() formats a 'created' change's item_count straight into the
   panel's innerHTML. api.php casts it to an int, but the page must not depend
   on that: whatever arrives is normalised to a non-negative integer and the
   whole summary is escaped at render.

   Asserted is what a person would read and what the DOM holds — no element
   from the response survives, no handler runs, and an ordinary count still
   reads as before.                                                          */
'use strict';
const { openApp } = require('../lib/harness');

const U = n => 'itm_' + String(n).repeat(32).slice(0, 32);

const SAVED = {
  id: 43, ref_no: 'DC-TEST-043', quote_date: '2026-10-20',
  customer_name: 'Alpha Sdn Bhd',
  items: [{ itemType: 'bolt', desc: 'SAG ROD', size: 'M12 x 500', sizeCode: 'M12',
            cleanSize: 'M12', dimensionPreview: 'L 500', qty: 4, material: 'MS',
            finish: 'ZP', finalUnitPrice: 5.76, totalAmount: 23.04, item_uid: U(1) }],
};

const created = change => ({
  ok: true, quotation_id: 43, revisions: [{
    revision_no: 1, event_type: 'create', created_at: '2026-10-20 10:00:00',
    actor: { user_id: 7, username: 'nicholas', display_name: 'Nicholas Koh' },
    snapshot_schema_version: 1,
    changes: [Object.assign({ kind: 'created', total_amount: '100.00', company: null }, change)],
  }],
});

async function render(browser, change) {
  const page = await openApp(browser, {
    handoff: SAVED,
    api: { get_quotation_history: created(change) },
  });
  await page.waitForFunction(() => typeof editingQuoteId !== 'undefined' && editingQuoteId, null, { timeout: 15000 });
  await page.click('#historyBtn');
  await page.waitForFunction(
    () => document.getElementById('historyModal').classList.contains('open')
       && !document.querySelector('[data-hist-state="histLoading"]'),
    null, { timeout: 15000 });
  /* Long enough for an injected <img onerror> to have fired if it were live. */
  await new Promise(r => setTimeout(r, 300));
  const out = await page.evaluate(() => {
    const body = document.getElementById('historyBody');
    const sub = body.querySelector('.hist-entry .hist-change .hist-sub');
    return {
      text: body.innerText.replace(/\s+/g, ' ').trim(),
      sub: sub ? sub.textContent.trim() : null,
      subChildren: sub ? sub.children.length : -1,
      imgs: body.querySelectorAll('img').length,
      injected: body.querySelectorAll('#histPwn, script, svg, iframe').length,
      fired: window.__dcHistXss === 1,
    };
  });
  out.errors = page._dcErrors.slice();
  await page.close();
  return out;
}

module.exports = async (browser, A) => {
  A.suite('revision history — created summary is escaped and normalised');

  // ── a hostile item_count string renders inert ───────────────────────────
  {
    const r = await render(browser, {
      item_count: '<img src="x" onerror="window.__dcHistXss=1"><b id="histPwn">9</b>',
    });
    A.eq(r.imgs, 0, 'no <img> from item_count reaches the DOM');
    A.eq(r.injected, 0, 'nor any other injected element');
    A.ok(!r.fired, 'and no injected handler ran');
    A.eq(r.subChildren, 0, 'the summary line holds text only');
    A.includes(r.sub, '0 items', 'a non-numeric count is shown as 0');
    A.excludes(r.text, 'onerror', 'and its markup is not echoed as text either');
    A.includes(r.text, 'RM 100.00', 'the total still renders');
    A.ok(r.errors.length === 0, 'no page errors: ' + r.errors.join(' | '));
  }

  // ── a hostile company is still escaped alongside it ─────────────────────
  {
    const r = await render(browser, {
      item_count: 2, company: '<img src="x" onerror="window.__dcHistXss=1">',
    });
    A.eq(r.imgs, 0, 'a hostile company renders no element');
    A.ok(!r.fired, 'and runs nothing');
    A.includes(r.sub, '2 items', 'beside a normal count');
    A.includes(r.sub, '<img', 'the company is shown as the literal text it is');
  }

  // ── ordinary and edge numbers ───────────────────────────────────────────
  {
    const r = await render(browser, { item_count: 3 });
    A.includes(r.sub, '3 items', 'a normal number still shows');
    A.includes(r.sub, 'RM 100.00', 'with the total');
  }
  {
    const r = await render(browser, { item_count: '7' });
    A.includes(r.sub, '7 items', 'a numeric string is read as its number');
  }
  {
    const r = await render(browser, { item_count: -4 });
    A.includes(r.sub, '0 items', 'a negative count is shown as 0');
    A.excludes(r.sub, '-4', 'never as a negative');
  }
  {
    const r = await render(browser, { item_count: 4.9 });
    A.includes(r.sub, '4 items', 'a fractional count is truncated to an integer');
  }
  {
    const r = await render(browser, { item_count: null });
    A.includes(r.sub, '0 items', 'a missing count is shown as 0');
  }
};
