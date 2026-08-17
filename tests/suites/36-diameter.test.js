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

  return S;
};
