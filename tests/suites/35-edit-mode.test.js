/* ── Fast Edit ─────────────────────────────────────────────────────────────
   Edit is an operation over every visible row at once. It has one state, three
   doors into it, and a list of things it closes off while it is open — and the
   list is the point. Each of those controls either writes the same rows from
   somewhere else, rebuilds them from scratch, or commits them; each one, run
   mid-edit, produces a quotation nobody quite chose.

   So this suite is mostly about what CANNOT happen while an edit is open, and
   about the two ways out being genuinely different: Done keeps, Cancel
   restores. The letters against each block are the brief's own checklist.  */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const MSG = 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x tl 100/100 - 10pcs\nM16 x 800 x tl 80/80 - 5pcs';
const JBOLT = 'J BOLT MS PL\nM16 H 530 ID 125 S 180 TL 200 - 10pcs';

const REC = {
  quotationId: 1, refNo: 'Q-2026-0430', date: '2026-01-25', customer: 'Alpha Steel Sdn Bhd',
  companyId: 7, own: true, productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE',
  finish: 'PL', cleanSize: 'M12', dimensionPreview: 'L 1000 x TL 100/100mm',
  exactDims: true, qty: 10, unitPrice: 8.7, boltUnitPrice: 8.7, accessoryCost: 0,
  accessorySummary: '', accessoryAmbiguous: false, priceMode: 'auto',
  priceModeLabel: 'Auto Round', costRate: 2.8, addCost: 0.6, markup: 4,
  weight: 0.8878, legacy: false,
};
const HISTORY_API = { get_pricing_history: () => ({ ok: true, data: {
  records: [REC], total: 1, ownTotal: 1, otherTotal: 0, offset: 0, limit: 20 } }) };

const state = page => page.evaluate(() => {
  const q = s => document.querySelector(s);
  const dis = s => { const n = q(s); return n ? !!n.disabled : null; };
  return {
    editing: !!wqa.edit,
    inputs: document.querySelectorAll('#wqaRows .wqa-ei').length,
    view: wqa.view,
    editBtnHidden: !!(q('#wqaEditBtn') || {}).hidden,
    doneShown: !(q('#wqaEditDoneBtn') || {}).hidden,
    cancelShown: !(q('#wqaEditCancelBtn') || {}).hidden,
    addOff: dis('#wqaAddBtn'),
    expandedOff: dis('#wqaViewExpanded'),
    deleteOff: dis('.wqa-row-del'),
    historyOff: dis('.wqa-row-hist'),
    bulkOff: dis('#wqaBulkHead button'),
    commonOff: dis('#wqaCommon select'),
    backOff: dis('#wqaBackBtn'),
    parseOff: dis('#wqaParseBtn'),
    note: (q('#wqaEditNote') || {}).textContent || '',
    focus: (document.activeElement && document.activeElement.dataset)
             ? (document.activeElement.dataset.ef || '') : '',
  };
});

const cellValue = (page, row, field) => page.evaluate(([r, f]) => {
  const n = document.querySelector(`[data-wqa-row="${r}"] [data-ef="${f}"]`);
  return n ? n.value : null;
}, [row, field]);

async function typeCell(page, row, field, value) {
  const sel = `[data-wqa-row="${row}"] [data-ef="${field}"]`;
  await page.click(sel, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  if (String(value).length) await page.type(sel, String(value), { delay: 12 });
  await page.waitForTimeout(600);
}

module.exports = async (browser, A) => {
  const S = A.suite('fast edit — one state, and everything it holds still');

  // ── A · the button edits every row at once ─────────────────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    const before = await state(page);
    A.eq(before.editing, 'false', 'the screen does not start in Edit');
    A.eq(before.inputs, 0, 'and carries no dimension inputs');

    await page.evaluate(() => wqaEditStart());
    await page.waitForTimeout(450);
    const on = await state(page);
    A.eq(on.editing, 'true', 'A: pressing Edit opens the edit');
    /* Two Sag Rod rows: size, dia, length, thread, qty. Every cell of every
       row, ready at once — nobody clicks a field to wake it up. */
    A.eq(on.inputs, 10, 'A: every editable cell of both rows is an input already');
    A.eq(on.view, 'compact', 'A: and it forces Compact, because it is a grid of all rows');
    A.eq(on.editBtnHidden, 'true', 'the Edit button gives way to…');
    A.eq(on.doneShown, 'true', '…Done…');
    A.eq(on.cancelShown, 'true', '…and Cancel');

    // ── D-K · what it holds still ────────────────────────────────────────
    A.eq(on.expandedOff, 'true', 'D: Expanded is locked while editing');
    A.eq(on.addOff, 'true', 'E: Add to Quotation is locked');
    A.eq(on.historyOff, 'true', 'F/G: History and Previous Price apply are locked');
    A.eq(on.bulkOff, 'true', 'H: Bulk Edit is locked');
    A.eq(on.commonOff, 'true', 'I: the Common Fields are locked');
    A.eq(on.parseOff, 'true', 'J: re-parsing the source is locked');
    A.eq(on.deleteOff, 'true', 'K: Delete is locked');
    A.includes(on.note, 'Previous Price', 'and the screen says history will refresh after');

    /* Calling the function directly is refused too — a disabled button is a
       courtesy, not the rule. */
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(300);
    A.eq((await state(page)).view, 'compact', 'D: and Expanded is refused even when called directly');
    await page.evaluate(() => wqaOpenBulkFor());
    await page.waitForTimeout(250);
    A.eq(await page.evaluate(() => !!wqa.bulkOpen), 'false', 'H: so is opening Bulk Edit');

    // ── L · Done exits, and everything is released ───────────────────────
    await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(600);
    const off = await state(page);
    A.eq(off.editing, 'false', 'L: Done leaves Edit');
    A.eq(off.inputs, 0, 'L: and the inputs go with it');
    A.eq(off.expandedOff, 'false', 'L: Expanded is available again');
    A.eq(off.addOff, 'false', 'L: and so is Add');
    A.eq(off.deleteOff, 'false', 'L: and Delete');
    A.ok(!page._dcErrors.length, 'no script error: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ── B · a cell is a door into the same state ───────────────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    await page.evaluate(() => document.querySelector('[data-wqa-row="1"] .wqa-c-qty').click());
    await page.waitForTimeout(450);
    const s = await state(page);
    A.eq(s.editing, 'true', 'B: clicking a value opens the edit');
    A.eq(s.focus, 'qty', 'B: focused on the exact cell that was clicked');
    A.eq(s.inputs, 10, 'B: and it is the SAME state — every row is editable, not just that one');

    /* One state, not two: leaving it leaves all of it. */
    await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(400);
    A.eq((await state(page)).editing, 'false', 'B: and one Done closes it');
    await page.close();
  }

  // ── C · a "Needs X" tag is a door into the field it names ─────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, JBOLT.replace(' ID 125', ''), { expanded: false, settle: 1000 });
    const tag = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.wqa-pill-go')]
        .find(x => /ID|Diameter|Qty|H\b|S\b/.test(x.textContent));
      if (!b) return null;
      const t = b.textContent.trim(); b.click(); return t;
    });
    A.ok(!!tag, 'C: a missing field is offered as a button');
    await page.waitForTimeout(500);
    const s = await state(page);
    A.eq(s.editing, 'true', `C: pressing "${tag}" opens the edit`);
    A.ok(!!s.focus, `C: with a field focused (${s.focus})`);
    await page.close();
  }

  // ── M · Cancel restores the whole session ──────────────────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    const before = await page.evaluate(() => ({
      size: wqa.rows[0].size, len: wqa.rows[0].length, qty: wqa.rows[0].qty,
      dia: wqa.rows[0].diaMm, manual: !!wqa.rows[0].diaManual,
      w: wqa.rows[0].calc && wqa.rows[0].calc.weight,
      p: wqa.rows[0].calc && wqa.rows[0].calc.finalUnitPrice,
    }));
    await page.evaluate(() => wqaEditStart());
    await page.waitForTimeout(400);
    await typeCell(page, 0, 'dia', '10.7');
    await typeCell(page, 0, 'length', '1500');
    await typeCell(page, 0, 'qty', '99');
    const during = await page.evaluate(() => ({
      len: wqa.rows[0].length, qty: wqa.rows[0].qty, dia: wqa.rows[0].diaMm,
      manual: !!wqa.rows[0].diaManual, w: wqa.rows[0].calc && wqa.rows[0].calc.weight,
    }));
    A.eq(during.len, '1500', 'the edits land while the session is open');
    A.eq(during.qty, '99', 'all of them');
    A.eq(during.dia, '10.7', 'including the diameter');
    A.eq(during.manual, 'true', 'which is marked as the person\'s own');
    A.ok(Number(during.w) !== Number(before.w), 'and the weight follows them');

    await page.evaluate(() => wqaEditCancel());
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({
      size: wqa.rows[0].size, len: wqa.rows[0].length, qty: wqa.rows[0].qty,
      dia: wqa.rows[0].diaMm, manual: !!wqa.rows[0].diaManual,
      w: wqa.rows[0].calc && wqa.rows[0].calc.weight,
      p: wqa.rows[0].calc && wqa.rows[0].calc.finalUnitPrice,
      editing: !!wqa.edit,
    }));
    A.eq(after.editing, 'false', 'M: Cancel leaves the edit');
    A.eq(after.len, before.len, 'M: and restores the length');
    A.eq(after.qty, before.qty, 'M: the quantity');
    A.eq(after.dia, before.dia, 'M: the diameter');
    A.eq(after.manual, 'false', 'M: and the fact that nobody had overridden it');
    A.near(after.w, before.w, 1e-9, 'M: so the weight is the one it started with');
    A.near(after.p, before.p, 1e-9, 'M: and so is the price');
    await page.close();
  }

  // ── N · missing may leave; O · invalid may not ─────────────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, JBOLT, { expanded: false, settle: 1000 });
    await page.evaluate(() => wqaEditStart());
    await page.waitForTimeout(450);

    /* N — a customer who did not state ID leaves it blank, and being unable to
       leave the edit until it is invented would be worse than the gap. */
    await typeCell(page, 0, 'id', '');
    const leftMissing = await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(600);
    A.eq(leftMissing, 'true', 'N: a blank required dimension does not trap you in Edit');
    A.eq((await state(page)).editing, 'false', 'N: the session ends');
    const row = (await rowState(page))[0];
    A.ok(row.missing.includes('ID'), 'N: and the row still says what it needs');
    const badges = await page.evaluate(() =>
      (document.querySelector('.wqa-sum-badges') || {}).textContent || '');
    A.includes(badges, 'Needs', 'N: on the row, in words');
    A.eq(await page.evaluate(() => !!document.getElementById('wqaAddBtn').disabled), 'true',
      'N: and Add stays blocked, which is the point of letting you out');

    /* O — letters where millimetres go is a different thing entirely. */
    await page.evaluate(() => wqaEditStart());
    await page.waitForTimeout(450);
    await typeCell(page, 0, 'h', 'abc');
    const blocked = await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(400);
    A.eq(blocked, 'false', 'O: an invalid value blocks Done');
    A.eq((await state(page)).editing, 'true', 'O: the session stays open');
    A.eq((await state(page)).focus, 'h', 'O: focused on the cell that is wrong');

    await typeCell(page, 0, 'h', '530');
    await typeCell(page, 0, 'qty', '-2');
    A.eq(await page.evaluate(() => wqaEditDone()), 'false', 'O: so does a negative quantity');
    await typeCell(page, 0, 'qty', '10');
    await typeCell(page, 0, 'dia', '0');
    A.eq(await page.evaluate(() => wqaEditDone()), 'false', 'O: and a bar of zero diameter');
    await typeCell(page, 0, 'dia', '');
    A.eq(await page.evaluate(() => wqaEditDone()), 'true',
      'O: clearing it back to the default lets the session close');
    await page.close();
  }

  // ── P · Tab and Shift+Tab walk the cells in visual order ──────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    await page.evaluate(() => wqaEditStart(0, 'size'));
    await page.waitForTimeout(500);
    const seen = [];
    for (let k = 0; k < 6; k++) {
      seen.push(await page.evaluate(() => (document.activeElement.dataset || {}).ef || ''));
      await page.keyboard.press('Tab');
      await page.waitForTimeout(90);
    }
    A.eq(seen.slice(0, 5).join(','), 'size,dia,length,threadLen,qty',
      'P: Tab walks the row in the order the eye reads it');
    A.eq(seen[5], 'size', 'P: and carries on into the next row');
    /* The loop pressed Tab after recording, so focus is now on row 1's dia —
       one past the last thing it wrote down. Two steps back is row 1's size
       and then row 0's qty, which is the same path in reverse. */
    for (let k = 0; k < 2; k++) { await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(90); }
    A.eq(await page.evaluate(() => (document.activeElement.dataset || {}).ef || ''), 'qty',
      'P: Shift+Tab goes back the way it came, across the row boundary');
    await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(90);
    A.eq(await page.evaluate(() => (document.activeElement.dataset || {}).ef || ''), 'threadLen',
      'P: and on back through the row it came from');
    await page.close();
  }

  // ── Q · a language switch is a re-label, not a reset ──────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, JBOLT, { expanded: false, settle: 1000 });
    await page.evaluate(() => wqaEditStart());
    await page.waitForTimeout(450);
    await typeCell(page, 0, 'h', '500');
    await typeCell(page, 0, 'id', '30');
    await typeCell(page, 0, 'dia', '14.2');
    const before = await page.evaluate(() => ({
      h: wqa.rows[0].h, id: wqa.rows[0].id, dia: wqa.rows[0].diaMm,
      manual: !!wqa.rows[0].diaManual, qty: wqa.rows[0].qty,
      rows: wqa.rows.filter(r => !r.removed).length, view: wqa.view,
      w: wqa.rows[0].calc && wqa.rows[0].calc.weight,
    }));

    for (const l of ['zh', 'en', 'zh']) {
      await page.evaluate(x => dcSetLang(x), l);
      await page.waitForTimeout(400);
    }
    const after = await page.evaluate(() => ({
      h: wqa.rows[0].h, id: wqa.rows[0].id, dia: wqa.rows[0].diaMm,
      manual: !!wqa.rows[0].diaManual, qty: wqa.rows[0].qty,
      rows: wqa.rows.filter(r => !r.removed).length, view: wqa.view,
      w: wqa.rows[0].calc && wqa.rows[0].calc.weight,
      editing: !!wqa.edit,
      inputs: document.querySelectorAll('#wqaRows .wqa-ei').length,
    }));
    A.eq(after.editing, 'true', 'Q: EN→中文→EN→中文 leaves the edit open');
    A.ok(after.inputs > 0, 'Q: with its cells still cells');
    A.eq(after.h, before.h, 'Q: H survives');
    A.eq(after.id, before.id, 'Q: ID survives');
    A.eq(after.dia, before.dia, 'Q: the typed diameter survives');
    A.eq(after.manual, 'true', 'Q: and is still marked as the person\'s own');
    A.eq(after.qty, before.qty, 'Q: the quantity survives');
    A.eq(after.rows, before.rows, 'Q: no row is lost');
    A.eq(after.view, before.view, 'Q: Compact is still Compact');
    A.near(after.w, before.w, 1e-9, 'Q: and the weight has not moved');

    /* the boxes on the screen, not just the state behind them */
    A.eq(await cellValue(page, 0, 'h'), String(before.h), 'Q: the H box still shows what was typed');
    A.eq(await cellValue(page, 0, 'dia'), String(before.dia), 'Q: and the diameter box');
    await page.evaluate(() => dcSetLang('en'));
    await page.close();
  }

  // ── R · closing with unfinished work asks first ───────────────────────
  {
    const page = await openApp(browser);
    /* The harness accepts every dialog, so the question itself is what is
       asserted: it was asked, and the close went through because it was
       answered yes. */
    const asked = [];
    page.on('dialog', d => { asked.push(d.message()); });
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    await page.evaluate(() => wqaEditStart());
    await page.waitForTimeout(400);

    A.eq(await page.evaluate(() => wqaEditDirty()), 'false',
      'an edit that has changed nothing is not dirty');
    await typeCell(page, 0, 'qty', '42');
    A.eq(await page.evaluate(() => wqaEditDirty()), 'true', 'R: one typed value makes it dirty');

    await page.evaluate(() => wqaRequestClose());
    await page.waitForTimeout(400);
    A.ok(asked.some(m => /unfinished|未完成/.test(m)),
      'R: closing Quick Add mid-edit asks before discarding — ' + JSON.stringify(asked));
    await page.close();
  }

  // ── History apply is unreachable mid-edit, and refreshes after ────────
  {
    const page = await openApp(browser, { api: HISTORY_API });
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(900);
    A.ok(await page.evaluate(() => !!document.querySelector('.ph-rec-use')),
      'a record offers its Use control before the edit opens');

    await page.evaluate(() => wqaEditStart());
    await page.waitForTimeout(450);
    A.eq(await page.evaluate(() => {
      const b = document.querySelector('.ph-rec-use'); return b ? !!b.disabled : 'gone';
    }), 'true', 'G: and it is disabled while the edit is open');
    A.eq(await page.evaluate(() => {
      const p = document.querySelector('.wqa-hist-panel');
      return p ? p.classList.contains('is-muted') : false;
    }), 'true', 'G: the panel stays readable but muted');
    await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(700);
    A.eq(await page.evaluate(() => {
      const b = document.querySelector('.ph-rec-use'); return b ? !!b.disabled : 'gone';
    }), 'false', 'G: and it comes back when the edit ends');
    await page.close();
  }

  return S;
};
