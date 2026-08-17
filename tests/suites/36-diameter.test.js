/* ── The diameter is the bar; the size is the thread ───────────────────────
   M12 fullsize is a 12.0mm bar. M12 undersize is a 10.6mm bar. Both are M12.
   Until this round Quick Add showed only the size, and the number the weight
   was actually made of was nowhere on the screen.

   The contract now is one sentence, and this suite exists to hold it:

       THE DIAMETER ON THE SCREEN IS THE DIAMETER THE WEIGHT WAS MADE OF.

   Every expected weight below is computed HERE, from the diameter the screen
   is showing, using π/4 · d² · L · ρ. Nothing is derived from the application's
   own answer — that would only prove it agrees with itself. The steel constant
   is π/4 × 7.85e-6 = 6.1654e-6 kg per mm³ ·, which is the figure the
   calculator's own table has always used and which suite 03 pins separately. */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* ── The constant, and why it is written twice ─────────────────────────────
   The formula is π/4 · d² · L · ρ with ρ = 7.85e-6 kg/mm³. The application
   carries it pre-multiplied, to five significant figures, as 0.0000061654 —
   which is how a shop floor writes it and what the shipped tables have always
   used.

   So this file states BOTH and checks one against the other. The expected
   weights below are computed from the shop-floor constant, because that is
   the arithmetic a person checking a quotation by hand would do; and the
   assertion right underneath proves that constant really is π/4 × 7.85e-6
   rather than a number somebody typed. Neither figure is read from the
   application. */
const RHO = 7.85e-6;
const K_EXACT = Math.PI / 4 * RHO;      // 6.16537…e-6
const K = 0.0000061654;                 // the same thing, to five figures
const weightOf = (diaMm, lenMm) => diaMm * diaMm * lenMm * K;

const rowDia = (page, i = 0) => page.evaluate(n => {
  const r = wqa.rows[n];
  const cell = document.querySelector(`[data-wqa-row="${n}"] .wqa-c-dia`);
  return {
    size: r.size,
    state: r.diaMm == null ? '' : String(r.diaMm),
    manual: !!r.diaManual,
    /* While an edit is open the cell IS an input, so the number on the screen
       is its value; otherwise it is the cell's text. Either way this reads
       what a person can see, which is the whole contract under test. */
    shown: cell ? (cell.querySelector('input')
                    ? cell.querySelector('input').value.trim()
                    : cell.textContent.replace(/Manual|手动/g, '').trim())
                : null,
    noDia: !!r.noDia,
    weight: r.calc ? r.calc.weight : null,
    price: r.calc ? r.calc.finalUnitPrice : null,
    missing: wqaRowMissing(r),
  };
}, i);

/* Is the DIA box wearing its "somebody chose this" mark? Read off the class
   the stylesheet actually paints, not off the row's state — the point of the
   assertion is that the screen and the state agree. */
const diaMark = (page, i = 0) => page.evaluate(n => {
  const inp = document.querySelector(`[data-wqa-row="${n}"] [data-ef="dia"]`);
  return inp ? String(inp.classList.contains('is-manual-dia')) : 'no-box';
}, i);

async function typeCell(page, row, field, value) {
  const sel = `[data-wqa-row="${row}"] [data-ef="${field}"]`;
  await page.click(sel, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  if (String(value).length) await page.type(sel, String(value), { delay: 12 });
  await page.waitForTimeout(650);
}

const REC = {
  quotationId: 1, refNo: 'Q-2026-0430', date: '2026-01-25', customer: 'Alpha Steel Sdn Bhd',
  companyId: 7, own: true, productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE',
  finish: 'ZP', cleanSize: 'M12', dimensionPreview: 'L 1000 x TL 100/100mm',
  exactDims: true, qty: 10, unitPrice: 9.9, boltUnitPrice: 9.9, accessoryCost: 0,
  accessorySummary: '', accessoryAmbiguous: false, priceMode: 'auto',
  priceModeLabel: 'Auto Round', costRate: 2.8, addCost: 0.6, markup: 4,
  weight: 0.6927, legacy: false,
};
const HISTORY_API = { get_pricing_history: () => ({ ok: true, data: {
  records: [REC], total: 1, ownTotal: 1, otherTotal: 0, offset: 0, limit: 20 } }) };

module.exports = async (browser, A) => {
  const S = A.suite('diameter — the bar the weight is made of');

  /* The constant this suite computes with is the formula the brief names. */
  A.near(K, K_EXACT, 5e-11,
    'the shop-floor constant 0.0000061654 IS π/4 × 7.85e-6, to five figures');

  // ── The two M12s ───────────────────────────────────────────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x tl 100/100 - 10pcs',
      { expanded: false, settle: 900 });

    const full = await rowDia(page);
    A.eq(full.size, 'M12', 'the size is M12');
    A.eq(full.shown, '12', 'M12 FULLSIZE: the screen says the bar is 12.0mm');
    A.eq(full.state, '12', 'and the row holds the same number');
    A.near(full.weight, weightOf(12, 1000), 1e-9,
      'and the weight is π/4·12²·1000·ρ, computed here and not asked for');

    await page.evaluate(() => wqaEditRowSpec(0, 'sizeType', 'UNDERSIZE'));
    await page.waitForTimeout(800);
    const under = await rowDia(page);
    A.eq(under.size, 'M12', 'M12 UNDERSIZE: still M12 — the size did not move');
    A.eq(under.shown, '10.6', 'but the bar is 10.6mm');
    A.near(under.weight, weightOf(10.6, 1000), 1e-9,
      'and the weight is made of 10.6, not of 12');
    A.ok(Math.abs(under.weight - full.weight) > 0.1,
      'which is a different weight, by more than a rounding');

    /* The one thing the brief is most explicit about: there is no second,
       hidden diameter anywhere. What the screen shows is what was used. */
    A.near(under.weight, weightOf(Number(under.shown), 1000), 1e-9,
      'the weight recomputes exactly from the number ON THE SCREEN');
    await page.close();
  }

  // ── A manual override, and what it does and does not move ─────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'MS SAG ROD PL UNDERSIZE\nM12 x 1000 x tl 100/100 - 10pcs',
      { expanded: false, settle: 900 });
    const before = await rowDia(page);
    A.eq(before.shown, '10.6', 'the default undersize M12 bar is 10.6mm');
    A.eq(before.manual, 'false', 'and nobody has overridden it');

    await page.evaluate(() => wqaEditStart(0, 'dia'));
    await page.waitForTimeout(450);
    await typeCell(page, 0, 'dia', '10.7');

    const after = await rowDia(page);
    A.eq(after.size, 'M12', 'MANUAL: the size is still M12 — a bar is not a thread');
    A.eq(after.shown, '10.7', 'MANUAL: the screen shows 10.7');
    A.eq(after.manual, 'true', 'MANUAL: marked as the person\'s own');
    A.near(after.weight, weightOf(10.7, 1000), 1e-9,
      'MANUAL: and the weight is π/4·10.7²·1000·ρ');
    A.ok(Math.abs(after.weight - weightOf(10.6, 1000)) > 1e-6,
      'MANUAL: with no 10.6 left anywhere in the calculation');
    A.ok(Number(after.price) > 0, 'MANUAL: and the price recomputes from that weight');

    /* Size identity is untouched, which is what Previous Price matches on. */
    A.excludes(after.size, '10.7', 'the size was not turned into the diameter');
    A.eq(after.size, 'M12', 'M12 remains M12');
    await page.close();
  }

  // ── A manual diameter belongs to ONE identity ─────────────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'MS SAG ROD PL UNDERSIZE\nM12 x 1000 x tl 100/100 - 10pcs',
      { expanded: false, settle: 900 });
    await page.evaluate(() => wqaEditStart(0, 'dia'));
    await page.waitForTimeout(450);
    await typeCell(page, 0, 'dia', '10.7');
    A.eq((await rowDia(page)).manual, 'true', 'a manual diameter is set');

    /* SIZE CHANGE — the new size resolves its own default, and 10.7 does not
       travel with it. */
    await typeCell(page, 0, 'size', 'M20');
    await page.waitForTimeout(400);
    const moved = await rowDia(page);
    A.eq(moved.size, 'M20', 'the size changed to M20');
    A.eq(moved.manual, 'false', 'SIZE CHANGE: the override is dropped, not carried');
    A.eq(moved.shown, '18', 'SIZE CHANGE: and the undersize M20 bar resolves at 18mm');
    A.near(moved.weight, weightOf(18, 1000), 1e-9, 'SIZE CHANGE: weighed on 18, not on 10.7');
    await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(600);

    /* SIZE TYPE CHANGE — same rule from the other direction. */
    await page.evaluate(() => wqaEditRowSpec(0, 'sizeType', 'FULLSIZE'));
    await page.waitForTimeout(800);
    const st = await rowDia(page);
    A.eq(st.shown, '20', 'SIZE TYPE CHANGE: fullsize M20 is a 20mm bar');
    A.near(st.weight, weightOf(20, 1000), 1e-9, 'and the weight follows it');
    A.eq(st.manual, 'false', 'with no override surviving the change');
    await page.close();
  }

  // ── No bar, no number, and no guess ───────────────────────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM14 x 1000 x tl 100/100 - 10pcs',
      { expanded: false, settle: 900 });
    const none = await rowDia(page);
    A.eq(none.size, 'M14', 'M14 is a size the tables recognise');
    A.eq(none.shown, '—', 'NO DIA: but there is no fullsize M14 bar, so the column says so');
    A.eq(none.state, '', 'NO DIA: and nothing is invented behind it');
    A.eq(none.weight, 'null', 'NO DIA: no weight');
    A.eq(none.price, 'null', 'NO DIA: no price');
    A.ok(none.missing.includes('Diameter'),
      'NO DIA: the row asks for a Diameter — the size was never the problem');
    A.ok(!none.missing.includes('Valid Size'), 'NO DIA: and does not blame the size');
    A.eq(await page.evaluate(() => !!document.getElementById('wqaAddBtn').disabled), 'true',
      'NO DIA: Add is blocked, as the business rules require');

    /* M6 and M14 fullsize are an OPEN business decision, and the honest
       behaviour is exactly this: say there is no bar. Nothing here decides it. */
    await page.close();
  }

  // ── A reused Previous Price recalculates on the CURRENT weight ────────
  /* Deliberately ZINC PLATED, not plain. An MS / UNDERSIZE / PL Sag Rod at
     these dimensions has a PRICE-LIST entry — getMSUndersizeSagRodPLSpecialPrice
     — and a list entry is a price, not a rounding of one: it is the answer
     whatever the bar weighs, in both rounding modes. That is correct existing
     behaviour and is not what this block is about. To watch a reused RECIPE
     follow the current weight, the row has to be one the recipe actually
     prices, so it is ZP. */
  {
    const page = await openApp(browser, { api: HISTORY_API });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 1000 x tl 100/100 - 10pcs',
      { expanded: false, settle: 900 });
    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(1000);
    const used = await page.evaluate(() => {
      const b = document.querySelector('.ph-rec-use'); if (!b) return false; b.click(); return true;
    });
    A.ok(used, 'the stored M12 record is offered and reused');
    await page.waitForTimeout(900);
    const reused = await rowDia(page);
    A.includes(await page.evaluate(() => wqa.rows[0].usedHistoryRef || ''), 'Q-2026-0430',
      'the row records which quotation the price came from');
    const priceOnDefault = Number(reused.price);
    A.ok(priceOnDefault > 0, 'and it has a price');
    A.near(reused.weight, weightOf(10.6, 1000), 1e-9, 'weighed on the default 10.6 bar');

    /* Now change the bar by hand. The identity is still M12 — the record is
       still the right record — but the price must be recomputed on the weight
       this row has NOW, never on the weight the record was written with. */
    await page.evaluate(() => wqaEditStart(0, 'dia'));
    await page.waitForTimeout(450);
    await typeCell(page, 0, 'dia', '11.4');
    await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(900);

    const heavier = await rowDia(page);
    A.eq(heavier.size, 'M12', 'the size identity is unchanged, so the match still stands');
    A.near(heavier.weight, weightOf(11.4, 1000), 1e-9,
      'the row is weighed on the bar a person chose');
    A.ok(Number(heavier.price) !== priceOnDefault,
      'and the reused recipe re-prices on THAT weight, not on the record\'s');
    A.ok(Number(heavier.price) > priceOnDefault,
      'a heavier bar costs more, which is the direction a recipe must move in');
    await page.close();
  }

  // ── Every metric size the table holds, weighed on what it shows ───────
  {
    const page = await openApp(browser);
    const sizes = ['M12', 'M16', 'M20', 'M24', 'M30'];
    for (const size of sizes) {
      await page.evaluate(() => { try { wqaHardClose(); } catch (e) {} });
      await quickAddPaste(page, `MS SAG ROD PL FULLSIZE\n${size} x 1000 x tl 100/100 - 10pcs`,
        { expanded: false, settle: 800 });
      const r = await rowDia(page);
      A.ok(Number(r.shown) > 0, `${size}: the screen states a bar (${r.shown}mm)`);
      A.near(r.weight, weightOf(Number(r.shown), 1000), 1e-9,
        `${size}: and weighs exactly π/4·${r.shown}²·1000·ρ`);
    }

    /* The verified case, stated whole: M24 x 1000 on a 24mm bar. Captured on
       its own rather than read off whatever the loop happened to end on. */
    await page.evaluate(() => { try { wqaHardClose(); } catch (e) {} });
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM24 x 1000 x tl 100/100 - 10pcs',
      { expanded: false, settle: 800 });
    const m24 = await rowDia(page);
    A.eq(m24.shown, '24', 'M24 fullsize is a 24mm bar');
    A.near(m24.weight, 3.5513, 5e-4, 'weighing 3.5513 kg/pc, which is the manually verified figure');
    A.near(m24.weight, weightOf(24, 1000), 1e-9, 'and that figure is π/4·24²·1000·ρ');
    await page.close();
  }

  /* ── Escape restores the bar AND where it came from ──────────────────────
     A diameter is two facts, not one: the number, and whether a person chose
     it. Escape used to give back only the number — 10.6 returned, but the row
     went on believing somebody had typed it, and the cell went on wearing the
     Manual mark for a value nobody had touched. The next size change would
     then have dropped an "override" that never existed.

     Provenance is not cosmetic. It decides whether the table is allowed to
     answer again, so restoring the digits and not the source leaves the row
     in a state it was never in. */
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'MS SAG ROD PL UNDERSIZE\nM12 x 1000 x tl 100/100 - 10pcs',
      { expanded: false, settle: 900 });
    await page.evaluate(() => wqaEditStart(0, 'dia'));
    await page.waitForTimeout(400);

    // A. Default 10.6 → edit 10.7 → Esc ⇒ 10.6, and Default again.
    const a0 = await rowDia(page);
    A.eq(a0.shown, '10.6', 'A: the row starts on the table\'s 10.6mm bar');
    A.eq(a0.manual, 'false', 'A: with nobody having overridden it');

    await typeCell(page, 0, 'dia', '10.7');
    const a1 = await rowDia(page);
    A.eq(a1.shown, '10.7', 'A: typing 10.7 puts 10.7 on the screen');
    A.eq(a1.manual, 'true', 'A: and marks the diameter as chosen by a person');

    /* Provenance has to be visible, or "Escape restored it" is a claim about
       state that nobody at the screen can check. */
    A.eq(await diaMark(page), 'true', 'A: and the box is visibly marked as chosen');

    await page.click('[data-wqa-row="0"] [data-ef="dia"]');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    const a2 = await rowDia(page);
    A.eq(await diaMark(page), 'false', 'A: Escape clears the mark, so the restore is visible');
    A.eq(a2.shown, '10.6', 'A: Escape puts 10.6 back on the screen');
    A.eq(a2.manual, 'false', 'A: AND gives the table its authority back — Default, not Manual');
    A.near(a2.weight, weightOf(10.6, 1000), 1e-9,
      'C: the weight after Escape is π/4·10.6²·1000·ρ — made of the restored bar');
    A.eq(a2.weight, a0.weight, 'C: which is bit-for-bit the weight before the edit');
    A.eq(a2.price, a0.price, 'D: and the price is the one that weight had');

    // B. Manual 10.7 → edit 11.0 → Esc ⇒ 10.7, and still Manual.
    await typeCell(page, 0, 'dia', '10.7');
    await page.evaluate(() => { wqaEditDone(); });
    await page.waitForTimeout(700);
    await page.evaluate(() => wqaEditStart(0, 'dia'));
    await page.waitForTimeout(400);
    const b0 = await rowDia(page);
    A.eq(b0.shown, '10.7', 'B: a session that OPENS on a manual 10.7');
    A.eq(b0.manual, 'true', 'B: with the override already in place');

    await typeCell(page, 0, 'dia', '11');
    const b1 = await rowDia(page);
    A.eq(b1.shown, '11', 'B: editing it to 11.0');
    A.eq(b1.manual, 'true', 'B: which is still a person\'s choice');

    await page.click('[data-wqa-row="0"] [data-ef="dia"]');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    const b2 = await rowDia(page);
    A.eq(b2.shown, '10.7', 'B: Escape returns the 10.7 the session opened on');
    A.eq(b2.manual, 'true', 'B: and it is STILL Manual — the override was never surrendered');
    A.near(b2.weight, weightOf(10.7, 1000), 1e-9,
      'C: weighing π/4·10.7²·1000·ρ, on the restored override');
    A.ok(Math.abs(b2.weight - weightOf(10.6, 1000)) > 1e-6,
      'C: and demonstrably NOT the table\'s 10.6 — Escape did not overshoot');

    /* The proof that provenance was really restored and not merely displayed:
       a size-type change is only allowed to drop an override that exists. */
    await page.evaluate(() => { wqaEditDone(); });
    await page.waitForTimeout(600);
    await page.evaluate(() => wqaEditRowSpec(0, 'sizeType', 'FULLSIZE'));
    await page.waitForTimeout(800);
    const b3 = await rowDia(page);
    A.eq(b3.shown, '12', 'B: changing to Fullsize drops the restored override, as an override should be dropped');
    A.eq(b3.manual, 'false', 'B: leaving the table to answer for the new identity');
    await page.close();
  }

  /* ── F35 · a size nothing recognises has no bar ──────────────────────────
     The column's whole contract is that the number on the screen is the bar
     the weight was made of. An unknown size produces no weight — the row is
     blocked by the Valid Size rule — but the DIA cell went on showing the
     PREVIOUS size's diameter, because the recompute returns early for an
     unknown size and the calculator still held the last one it was given.

     So an M23 typed over an M27 sat beside a 27mm bar: a diameter belonging
     to a size that was gone, next to no weight at all.                      */
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x tl 100/100 - 10pcs',
      { expanded: false, settle: 900 });
    await page.evaluate(() => wqaEditStart(0, 'size'));
    await page.waitForTimeout(400);

    await typeCell(page, 0, 'size', '27');
    const known = await rowDia(page);
    A.eq(known.size, 'M27', 'a bare 27 becomes M27');
    A.eq(known.shown, '27', 'on a 27mm bar');
    A.near(known.weight, weightOf(27, 1000), 1e-9, 'weighing what a 27mm bar weighs');

    await typeCell(page, 0, 'size', 'M23');
    const unknown = await rowDia(page);
    A.eq(unknown.size, 'M23', 'M23 is kept as typed — it is not silently mapped to anything');
    A.eq(unknown.shown, '', 'and shows NO diameter, rather than the M27 bar it replaced');
    A.eq(unknown.state, '', 'the row holds none either');
    A.eq(unknown.weight, null, 'there is no weight');
    A.includes(unknown.missing.join(','), 'Valid Size',
      'and the row asks for a valid size, which is the actual problem');
    A.excludes(unknown.missing.join(','), 'Diameter',
      'not for a diameter, which nobody could supply until the size is right');

    /* And a recognised size gets its bar straight back. */
    await typeCell(page, 0, 'size', 'M20');
    const back = await rowDia(page);
    A.eq(back.shown, '20', 'a recognised size restores the bar at once');
    A.near(back.weight, weightOf(20, 1000), 1e-9, 'and the weight follows it');

    /* And a manual diameter follows the SAME rule an unknown size follows as
       any other size change: it belongs to the identity it was typed for, so
       moving to a different one drops it and lets the table answer again.
       Checked here rather than assumed, because the two mechanisms — clearing
       a stale table diameter, and clearing a stale override — are separate
       pieces of code that happen to agree. */
    await page.evaluate(() => { wqaEditDia(0, '19.5'); });
    await page.waitForTimeout(800);
    const typed = await rowDia(page);
    A.eq(typed.manual, 'true', 'a diameter typed against M20 is marked as the person\'s');
    A.eq(typed.state, '19.5', 'and holds their number');

    await typeCell(page, 0, 'size', 'M23');
    const moved = await rowDia(page);
    A.eq(moved.manual, 'false',
      'moving to an unrecognised size drops it, exactly as moving to a recognised one does');
    A.eq(moved.state, '', 'leaving no diameter at all rather than one belonging to M20');
    A.eq(moved.weight, null, 'and no weight');
    await page.close();
  }

  return S;
};
