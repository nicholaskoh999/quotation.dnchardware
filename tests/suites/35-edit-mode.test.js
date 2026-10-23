/* ── Editing a value where it stands ───────────────────────────────────────
   The review step no longer has a Fast Edit session. There is no Edit button
   that turns every row into a grid of inputs: a value on the row line is a
   button, and pressing it puts ONE box where that value was. Every keystroke
   writes live through the same mutators the grid used (wqaEditSize for the
   size, wqaEditCell for the rest), so the row, its weight and its price follow
   the caret. Enter commits, Tab commits and moves on, Escape puts back what the
   box opened with, and leaving the box commits it — or puts the old value back
   if what it holds is something nobody could mean. The diameter is a property
   of the bar and lives in the row's own panel, which writes the same way.

   So this suite is about the two ways out of a box being genuinely different:
   commit keeps, Escape restores — the value AND where it came from — and about
   an edit to one value touching that value only. The letters against each
   block are the original brief's checklist, kept where the idea survived.  */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const MSG = 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x tl 100/100 - 10pcs\nM16 x 800 x tl 80/80 - 5pcs';
/* Same size and thread on both lines, so the two rows are drawn as one series
   and each row line carries only its own L and Qty. */
const SERIES = 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x tl 100/100 - 10pcs\nM12 x 800 x tl 100/100 - 5pcs';
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

/* What the screen is doing: how many boxes are open, which value the one box
   holds, and where the caret is. */
const state = page => page.evaluate(() => {
  const boxes = document.querySelectorAll('#wqaRows .wqa-ix');
  const b = boxes[0];
  const a = document.activeElement;
  const aRow = a && a.closest ? a.closest('[data-wqa-row]') : null;
  return {
    boxes: boxes.length,
    field: b ? b.dataset.ef : '',
    boxRow: b ? b.closest('[data-wqa-row]').dataset.wqaRow : '',
    bad: b ? b.classList.contains('is-bad') : false,
    value: b ? b.value : null,
    focus: (a && a.dataset) ? (a.dataset.ef || '') : '',
    focusRow: aRow ? aRow.dataset.wqaRow : '',
    focusIsBox: !!(a && a.classList && a.classList.contains('wqa-ix')),
    editing: wqaEditing(),
    session: !!wqa.edit,
    gridCells: document.querySelectorAll('#wqaRows .wqa-ei').length,
    view: wqa.view,
    quoted: quoteItems.length,
  };
});

/* One row as the application holds it — the business half of every check. */
const row = (page, i) => page.evaluate(k => {
  const r = wqa.rows[k];
  return {
    size: r.size, length: r.length, h: r.h, id: r.id, s: r.s,
    thread: wqaThreadValue(r), qty: r.qty,
    dia: r.diaMm, manual: !!r.diaManual,
    w: r.calc ? r.calc.weight : null, p: r.calc ? r.calc.finalUnitPrice : null,
  };
}, i);

/* A value button, pressed the way a person presses it. */
async function openTok(page, r, field) {
  await page.click(`[data-wqa-row="${r}"] button[data-tok="${field}"]`);
  await page.waitForTimeout(300);
}

/* Type into whatever box has the caret, replacing what it holds, and stay in
   it: no Enter, no blur. */
async function typeHere(page, value) {
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  if (String(value).length) await page.keyboard.type(String(value), { delay: 12 });
  await page.waitForTimeout(600);
}
async function press(page, key, settle) {
  await page.keyboard.press(key);
  await page.waitForTimeout(settle || 500);
}

module.exports = async (browser, A) => {
  const S = A.suite('inline edit — one value at a time, and Escape means it');

  // ── A · there is no session; a call into the edit lands on one value ──
  {
    const page = await openApp(browser);
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    const before = await state(page);
    A.eq(before.editing, 'false', 'the screen does not start in an edit');
    A.eq(before.boxes, 0, 'and carries no value boxes');
    A.eq(before.gridCells, 0, 'and none of the old grid inputs');

    /* wqaEditStart() with no row and no field is what the Edit button used to
       call. It now lands on the first value of the first row, and only there. */
    await page.evaluate(() => wqaEditStart());
    await page.waitForTimeout(450);
    const on = await state(page);
    A.eq(on.boxes, 1, 'A: a call into the edit opens exactly one box');
    A.eq(on.boxRow + ':' + on.field, '0:size', 'A: on the first value of the first row');
    A.ok(on.focusIsBox && on.focus === 'size', 'A: with the caret already in it');
    A.eq(on.session, 'false', 'A: and no grid session is opened behind it');
    A.eq(on.view, 'compact', 'A: the view is left as it was');
    /* Retired 2026-10-23 (AI review redesign): "every editable cell of both rows is an input already" (10 inputs) and "it forces Compact" — the grid of all rows is gone by design; one value is edited where it stands. */
    /* Retired 2026-10-23 (AI review redesign): Edit / Done / Cancel button visibility — #wqaEditBtn, #wqaEditDoneBtn and #wqaEditCancelBtn no longer exist; the box itself is the edit (Enter / Escape). */
    /* Retired 2026-10-23 (AI review redesign): D-K locks while editing (Expanded, Add, History / Previous Price apply, Bulk Edit, Common Fields, re-parse, Delete), the "history will refresh" note, and Expanded / Bulk Edit being refused when called directly — they guarded a multi-row transaction that no longer exists. A box writes one value live, so nothing is held open across rows; wqa.edit is never set and wqaEditing() is always false. The guarantee they protected — nothing reaches the quotation mid-edit — is asserted below instead. */
    A.eq(on.quoted, 0, 'E: nothing has reached the quotation while the box is open');

    // ── L · Done is Enter on the open box ────────────────────────────────
    const done = await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(600);
    const off = await state(page);
    A.eq(done, 'true', 'L: wqaEditDone() commits the open box');
    A.eq(off.boxes, 0, 'L: and the box goes with it');
    A.eq((await row(page, 0)).size, 'M12', 'L: leaving the size exactly as it was');
    A.eq(off.quoted, 0, 'L: and still nothing has been added to the quotation');
    A.ok(!page._dcErrors.length, 'no script error: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ── B · a value is a door into that value, and only that one ──────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    await openTok(page, 1, 'qty');
    let s = await state(page);
    A.eq(s.boxes, 1, 'B: pressing a value opens one box');
    A.eq(s.boxRow + ':' + s.field, '1:qty', 'B: in the row and on the value that was pressed');
    A.ok(s.focusIsBox && s.focus === 'qty' && s.focusRow === '1', 'B: focused on it');
    A.eq(s.value, '5', 'B: holding the value it replaced');
    /* Converted: "it is the SAME state — every row is editable" is now its
       opposite by design: the other row has no box at all. */
    A.eq(await page.evaluate(() =>
      document.querySelectorAll('[data-wqa-row="0"] .wqa-ix, [data-wqa-row="0"] .wqa-ei').length), 0,
      'B: and the other row is untouched — still values, not boxes');

    /* One box at a time: pressing another value commits this one and moves. */
    await typeHere(page, '7');
    await openTok(page, 0, 'length');
    s = await state(page);
    A.eq(s.boxes, 1, 'B: pressing a second value still leaves exactly one box');
    A.eq(s.boxRow + ':' + s.field, '0:length', 'B: the new one');
    A.eq((await row(page, 1)).qty, '7', 'B: and the value left behind was committed, not dropped');

    await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(400);
    A.eq((await state(page)).boxes, 0, 'B: and one Done closes it');
    await page.close();
  }

  // ── C · a "Needs X" tag is a door into the field it names ─────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, JBOLT.replace(' ID 125', ''), { expanded: false, settle: 1000 });
    const tag = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.wqa-pill-go')]
        .find(x => /\bID\b/.test(x.textContent));
      if (!b) return null;
      const t = b.textContent.trim(); b.click(); return t;
    });
    A.ok(!!tag, 'C: a missing field is offered as a button');
    await page.waitForTimeout(500);
    const s = await state(page);
    A.eq(s.boxes, 1, `C: pressing "${tag}" opens a box`);
    A.ok(s.focusIsBox && s.focus === 'id', `C: on exactly the field it names (${s.focus})`);
    await page.close();
  }

  // ── M · Escape restores the value, and where it came from ─────────────
  /* Converted: the grid's Cancel restored the whole session at once. Each box
     now restores itself, so each value is taken out and brought back on its
     own — and the row next to it must not move at all. */
  {
    const page = await openApp(browser);
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    const before = await row(page, 0);
    const other = await row(page, 1);
    const shownW = () => page.evaluate(() =>
      (document.querySelector('[data-wqa-row="0"] .wqa-uw-full') || {}).textContent || '');

    // length
    await openTok(page, 0, 'length');
    await typeHere(page, '1500');
    let during = await row(page, 0);
    A.eq(during.length, '1500', 'M: the length lands while the box is still open');
    A.ok(Number(during.w) !== Number(before.w), 'M: and the weight follows it');
    A.includes(await shownW(), Number(during.w).toFixed(4), 'M: on the screen as well as in the state');
    A.ok(Number(during.p) !== Number(before.p), 'M: and so does the price');
    await press(page, 'Escape', 700);
    let after = await row(page, 0);
    A.eq((await state(page)).boxes, 0, 'M: Escape closes the box');
    A.eq(after.length, before.length, 'M: and restores the length');
    A.near(after.w, before.w, 1e-9, 'M: so the weight is the one it started with');
    A.near(after.p, before.p, 1e-9, 'M: and so is the price');
    A.includes(await shownW(), Number(before.w).toFixed(4), 'M: and the screen says so');
    A.eq(await page.evaluate(() => document.getElementById('wqaModal').classList.contains('open')), 'true',
      'M: Escape in a box is the box\'s — it does not close Quick Add');

    // quantity
    await openTok(page, 0, 'qty');
    await typeHere(page, '99');
    A.eq((await row(page, 0)).qty, '99', 'M: the quantity lands live too');
    await press(page, 'Escape', 600);
    A.eq((await row(page, 0)).qty, before.qty, 'M: and Escape restores it');

    // diameter — two facts, the number and whether a person chose it
    await page.evaluate(() => wqaEditStart(0, 'dia'));
    await page.waitForTimeout(450);
    A.eq((await state(page)).focus, 'dia', 'M: the diameter opens in the row\'s own panel, focused');
    await typeHere(page, '10.7');
    during = await row(page, 0);
    A.eq(during.dia, '10.7', 'M: the typed diameter lands');
    A.eq(during.manual, 'true', 'M: marked as the person\'s own');
    A.eq(await page.evaluate(() =>
      document.querySelector('[data-wqa-row="0"] [data-ef="dia"]').classList.contains('is-manual-dia')), 'true',
      'M: on the box that holds it');
    A.ok(Number(during.w) !== Number(before.w), 'M: and the weight follows the bar');
    await press(page, 'Escape', 700);
    after = await row(page, 0);
    A.eq(after.dia, before.dia, 'M: Escape restores the diameter');
    A.eq(after.manual, 'false', 'M: and the fact that nobody had overridden it');
    A.eq(await page.evaluate(() =>
      document.querySelector('[data-wqa-row="0"] [data-ef="dia"]').classList.contains('is-manual-dia')), 'false',
      'M: so the box no longer wears the Manual mark');
    A.near(after.w, before.w, 1e-9, 'M: the weight is the one it started with');
    A.near(after.p, before.p, 1e-9, 'M: and so is the price');
    /* With the panel open, a value on the row line is edited in the panel's
       own box — and Escape there restores what that box opened with. */
    await openTok(page, 0, 'length');
    let s = await state(page);
    A.ok(s.focus === 'length' && !s.focusIsBox && s.boxes === 0,
      'M: with the panel open, pressing L goes to the panel\'s length box');
    await typeHere(page, '1234');
    A.eq((await row(page, 0)).length, '1234', 'M: which writes live as well');
    await press(page, 'Escape', 600);
    A.eq((await row(page, 0)).length, before.length, 'M: and Escape in it restores the length');
    A.near((await row(page, 0)).w, before.w, 1e-9, 'M: and the weight');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(300);
    await page.click('[data-wqa-row="0"] .wqa-rv-more');
    await page.waitForTimeout(400);
    A.eq(await page.evaluate(() => !!document.querySelector('[data-wqa-row="0"] .wqa-rv-detail')), 'false',
      'the panel closes again');

    // wqaEditCancel is Escape
    await openTok(page, 0, 'length');
    await typeHere(page, '1234');
    await page.evaluate(() => wqaEditCancel());
    await page.waitForTimeout(600);
    A.eq((await row(page, 0)).length, before.length, 'M: wqaEditCancel() restores exactly as Escape does');
    A.eq((await state(page)).boxes, 0, 'M: and closes the box');

    // Enter commits, and Escape afterwards is not an undo
    await openTok(page, 0, 'length');
    await typeHere(page, '1500');
    await press(page, 'Enter', 700);
    A.eq((await state(page)).boxes, 0, 'Enter commits and closes the box');
    A.eq((await row(page, 0)).length, '1500', 'and the length is kept');
    A.eq(await page.evaluate(() =>
      document.querySelector('[data-wqa-row="0"] button[data-tok="length"] .wqa-tok-v').textContent.trim()),
      '1500', 'on the row line as well');
    await page.evaluate(() => wqaEditCancel());
    await page.waitForTimeout(400);
    A.eq((await row(page, 0)).length, '1500', 'a later Cancel with no box open undoes nothing');

    const otherAfter = await row(page, 1);
    A.eq(JSON.stringify(otherAfter), JSON.stringify(other), 'one row edited: the other row did not move at all');
    A.eq((await state(page)).quoted, 0, 'and none of it reached the quotation');
    A.ok(!page._dcErrors.length, 'no script error: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ── N · missing may leave; O · invalid may not ─────────────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, JBOLT, { expanded: false, settle: 1000 });

    /* N — a customer who did not state ID leaves it blank, and being unable to
       leave the box until it is invented would be worse than the gap. */
    await openTok(page, 0, 'id');
    await typeHere(page, '');
    const leftMissing = await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(600);
    A.eq(leftMissing, 'true', 'N: a blank required dimension does not trap you in the box');
    A.eq((await state(page)).boxes, 0, 'N: the box closes');
    const r0 = (await rowState(page))[0];
    A.eq(r0.id, '', 'N: holding the blank, not the old value');
    A.ok(r0.missing.includes('ID'), 'N: and the row still says what it needs');
    A.includes(r0.badges, 'Needs', 'N: on the row, in words');
    A.eq(await page.evaluate(() => !!document.getElementById('wqaAddBtn').disabled), 'true',
      'N: and Add stays blocked, which is the point of letting you out');

    /* O — letters where millimetres go is a different thing entirely. */
    await openTok(page, 0, 'h');
    await typeHere(page, 'abc');
    const blocked = await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(400);
    let s = await state(page);
    A.eq(blocked, 'false', 'O: an invalid value is refused');
    A.eq(s.boxes, 1, 'O: the box stays open');
    A.ok(s.bad && s.focus === 'h' && s.focusIsBox, 'O: marked wrong, with the caret still in it');
    await press(page, 'Enter', 400);
    s = await state(page);
    A.ok(s.boxes === 1 && s.bad, 'O: Enter is refused the same way');
    await press(page, 'Escape', 600);
    A.eq((await row(page, 0)).h, '530', 'O: and Escape gives the old H back');

    /* Leaving a box that holds nonsense puts the old value back rather than
       keeping something nobody could mean. */
    await openTok(page, 0, 'h');
    await typeHere(page, 'xyz');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(600);
    A.eq((await state(page)).boxes, 0, 'O: leaving it closes the box');
    A.eq((await row(page, 0)).h, '530', 'O: and restores H rather than keeping the letters');

    /* Arithmetic is settled on commit, exactly as the grid did. */
    await openTok(page, 0, 'h');
    await typeHere(page, '500+30');
    await press(page, 'Enter', 600);
    A.eq((await row(page, 0)).h, '530', 'O: 500+30 commits as 530');

    await openTok(page, 0, 'qty');
    await typeHere(page, '-2');
    A.eq(await page.evaluate(() => wqaEditDone()), 'false', 'O: so is a negative quantity');
    await page.waitForTimeout(300);
    await press(page, 'Escape', 500);
    A.eq((await row(page, 0)).qty, '10', 'O: which Escape puts back to 10');

    await page.close();
  }

  /* O, the bar — on a row that is otherwise complete, so Add being blocked
     (or not) is about the diameter alone. The grid refused Done on a bar of
     zero and held Add locked until it was fixed or cancelled; the panel box is
     now the only place the bar is typed, so the same refusal belongs there. */
  {
    const page = await openApp(browser);
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    A.eq(await page.evaluate(() => !!document.getElementById('wqaAddBtn').disabled), 'false',
      'O: (a complete Sag Rod list can be added)');
    await page.evaluate(() => wqaEditStart(0, 'dia'));
    await page.waitForTimeout(450);
    await typeHere(page, '0');
    const zero = await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(600);
    const zr = await row(page, 0);
    A.ok(zero === false || String(zr.dia) !== '0',
      `O: and a bar of zero diameter is refused, not left on the row (done=${zero}, diaMm=${zr.dia})`);
    A.eq(await page.evaluate(() => !!document.getElementById('wqaAddBtn').disabled
                                   || String(wqa.rows[0].diaMm) !== '0'), 'true',
      'O: so a row holding it cannot be added to the quotation');
    await page.evaluate(() => wqaEditStart(0, 'dia'));
    await page.waitForTimeout(450);
    await typeHere(page, '');
    A.eq(await page.evaluate(() => wqaEditDone()), 'true',
      'O: clearing it back to the default lets you leave');
    await page.waitForTimeout(500);
    const cleared = await row(page, 0);
    A.eq(cleared.manual, 'false', 'O: and the bar is the table\'s again');
    A.eq(cleared.dia, '12', 'O: the M12 bar');
    A.eq(await page.evaluate(() => !!document.getElementById('wqaAddBtn').disabled), 'false',
      'O: and Add is available again');
    A.eq((await state(page)).quoted, 0, 'O: nothing was added along the way');
    await page.close();
  }

  // ── P · Tab walks the values in the order the row shows them ──────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    await page.evaluate(() => wqaEditStart(0, 'size'));
    await page.waitForTimeout(500);
    const where = async () => { const s = await state(page); return s.focusRow + ':' + s.focus; };

    /* The size box normalises as it is typed, and Escape puts the size — and
       the bar that came with it — back. */
    await typeHere(page, '16');
    A.eq((await row(page, 0)).size, 'M16', 'P: 16 typed in the size box is M16 while the caret is still there');
    A.eq((await row(page, 0)).dia, '16', 'P: and the bar follows the size');
    await press(page, 'Escape', 600);
    A.eq((await row(page, 0)).size, 'M12', 'P: Escape restores the size');
    A.eq((await row(page, 0)).dia, '12', 'P: and the bar that came with it');
    await page.evaluate(() => wqaEditStart(0, 'size'));
    await page.waitForTimeout(400);

    const seen = [await where()];
    for (let k = 0; k < 4; k++) {
      await press(page, 'Tab', 250);
      seen.push(await where());
    }
    /* Converted: the grid's order was size,dia,length,threadLen,qty. The
       diameter is in the row's panel now, so the row line is the order. */
    A.eq(seen.slice(0, 4).join(','), '0:size,0:length,0:threadLen,0:qty',
      'P: Tab walks the row in the order the eye reads it');
    A.eq(seen[4], '1:size', 'P: and carries on into the next row');
    A.eq((await state(page)).boxes, 1, 'P: one box all the way');

    await press(page, 'Shift+Tab', 250);
    A.eq(await where(), '0:qty', 'P: Shift+Tab goes back the way it came, across the row boundary');
    await press(page, 'Shift+Tab', 250);
    A.eq(await where(), '0:threadLen', 'P: and on back through the row it came from');

    /* Tab commits what it leaves. */
    await press(page, 'Shift+Tab', 250);
    A.eq(await where(), '0:length', 'P: back to the length');
    await typeHere(page, '1200');
    await press(page, 'Tab', 400);
    A.eq((await row(page, 0)).length, '1200', 'P: Tab commits the value it leaves');
    A.eq(await where(), '0:threadLen', 'P: and opens the next one');
    await press(page, 'Escape', 400);
    A.eq((await row(page, 0)).length, '1200', 'P: Escape on the next box does not reach back to the last');
    await page.close();
  }

  // ── P′ · in a series, Tab visits only what the row line shows ─────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, SERIES, { expanded: false, settle: 900 });
    A.eq(await page.evaluate(() => document.querySelectorAll('#wqaRows .wqa-ser').length), 1,
      'two lines that share size and thread are drawn as one series');
    await openTok(page, 0, 'length');
    const seen = [];
    for (let k = 0; k < 3; k++) {
      const s = await state(page); seen.push(s.focusRow + ':' + s.focus);
      await press(page, 'Tab', 250);
    }
    A.eq(seen.join(','), '0:length,0:qty,1:length',
      'P: a series row skips the size and TL its heading states');
    await press(page, 'Escape', 300);
    await page.close();
  }

  // ── Q · a language switch is a re-label, not a reset ──────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, JBOLT, { expanded: false, settle: 1000 });
    await openTok(page, 0, 'h');  await typeHere(page, '500'); await press(page, 'Enter', 400);
    await openTok(page, 0, 'id'); await typeHere(page, '30');  await press(page, 'Enter', 400);
    await page.evaluate(() => wqaEditStart(0, 'dia'));
    await page.waitForTimeout(450);
    await typeHere(page, '14.2');
    await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(500);
    /* …and one value still in an open box when the language changes. */
    await openTok(page, 0, 'qty'); await typeHere(page, '42');
    const before = await page.evaluate(() => ({
      h: wqa.rows[0].h, id: wqa.rows[0].id, dia: wqa.rows[0].diaMm,
      manual: !!wqa.rows[0].diaManual, qty: wqa.rows[0].qty,
      rows: wqa.rows.filter(r => !r.removed).length, view: wqa.view,
      w: wqa.rows[0].calc && wqa.rows[0].calc.weight,
    }));
    A.eq(before.qty, '42', 'Q: the open box has already written its value');

    for (const l of ['zh', 'en', 'zh']) {
      await page.evaluate(x => dcSetLang(x), l);
      await page.waitForTimeout(400);
    }
    const after = await page.evaluate(() => ({
      h: wqa.rows[0].h, id: wqa.rows[0].id, dia: wqa.rows[0].diaMm,
      manual: !!wqa.rows[0].diaManual, qty: wqa.rows[0].qty,
      rows: wqa.rows.filter(r => !r.removed).length, view: wqa.view,
      w: wqa.rows[0].calc && wqa.rows[0].calc.weight,
    }));
    /* Retired 2026-10-23 (AI review redesign): "EN→中文→EN→中文 leaves the edit open, with its cells still cells" — there is no session to keep open; the redraw may close an open box, and what matters is that its value survives, asserted next. */
    A.eq(after.h, before.h, 'Q: H survives');
    A.eq(after.id, before.id, 'Q: ID survives');
    A.eq(after.dia, before.dia, 'Q: the typed diameter survives');
    A.eq(after.manual, 'true', 'Q: and is still marked as the person\'s own');
    A.eq(after.qty, before.qty, 'Q: the quantity typed in the open box survives');
    A.eq(after.rows, before.rows, 'Q: no row is lost');
    A.eq(after.view, before.view, 'Q: Compact is still Compact');
    A.near(after.w, before.w, 1e-9, 'Q: and the weight has not moved');

    /* the screen, not just the state behind it */
    const shown = await page.evaluate(() => {
      const c = document.querySelector('[data-wqa-row="0"]');
      const tok = f => { const ix = c.querySelector(`.wqa-ix[data-ef="${f}"]`); if (ix) return ix.value;
        const b = c.querySelector(`button[data-tok="${f}"] .wqa-tok-v`); return b ? b.textContent.trim() : null; };
      const d = c.querySelector('[data-ef="dia"]');
      return { h: tok('h'), qty: tok('qty'), dia: d ? d.value : (c.querySelector('.wqa-c-dia') || {}).textContent };
    });
    A.eq(shown.h, String(before.h), 'Q: the row still shows the H that was typed');
    A.eq(shown.qty, String(before.qty), 'Q: and the quantity');
    A.eq(String(shown.dia).trim(), String(before.dia), 'Q: and the diameter');
    await page.evaluate(() => dcSetLang('en'));
    await page.close();
  }

  // ── R · closing with unfinished work asks first ───────────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    /* Retired 2026-10-23 (AI review redesign): wqaEditDirty() "an edit that has changed nothing is not dirty" / "one typed value makes it dirty" — it measured the grid session's snapshot, which is never taken now. Every keystroke is already on the row, so the review's own dirty check (wqaIsDirty) is what guards the close; asserted below. */
    await openTok(page, 0, 'qty');
    await typeHere(page, '42');
    await page.evaluate(() => wqaRequestClose());
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({
      asked: !document.getElementById('wqaConfirm').hidden,
      open: document.getElementById('wqaModal').classList.contains('open'),
      qty: wqa.rows[0] && wqa.rows[0].qty,
    }));
    A.eq(r.asked, 'true', 'R: closing Quick Add mid-edit asks before discarding');
    A.eq(r.open, 'true', 'R: and has not closed yet');
    A.eq(r.qty, '42', 'R: with the typed value still on the row');
    await page.evaluate(() => wqaCancelClose());
    await page.waitForTimeout(200);
    A.eq((await row(page, 0)).qty, '42', 'R: Keep editing keeps it');
    await page.close();
  }

  // ── G · history and an edit side by side ──────────────────────────────
  {
    const page = await openApp(browser, { api: HISTORY_API });
    await quickAddPaste(page, MSG, { expanded: false, settle: 900 });
    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(900);
    A.ok(await page.evaluate(() => !!document.querySelector('.ph-rec-use')),
      'a record offers its Use control before any value is edited');
    A.eq(await page.evaluate(() => !!(wqa.rows[0].hist.records[0] || {}).exactDims), 'true',
      'and it matches the row on its exact dimensions');

    /* Retired 2026-10-23 (AI review redesign): "G: Use is disabled while the edit is open / the panel is muted / it comes back when the edit ends" — that lock held the history still across a multi-row session. A box writes one value and commits on Enter, so there is no session for the history to wait out. */
    await openTok(page, 0, 'length');
    await typeHere(page, '1500');
    await press(page, 'Enter', 900);
    /* What the lock protected: a record matched on what the row USED to be.
       The commit re-runs the matcher against the new state. */
    A.eq(await page.evaluate(() => !!(wqa.rows[0].hist.records[0] || {}).exactDims), 'false',
      'G: after L1000 becomes L1500 the record is no longer an exact-dimension match');
    A.eq(await page.evaluate(() => {
      const b = document.querySelector('.ph-rec-use'); return b ? !!b.disabled : 'gone';
    }), 'false', 'G: and its Use control is there to be chosen deliberately');
    A.eq(await page.evaluate(() => wqa.rows[0].usedHistoryRef || ''), '',
      'G: nothing was applied from history by the edit itself');
    await page.close();
  }

  return S;
};
