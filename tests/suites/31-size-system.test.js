/* ── One rod, one diameter, whichever way it was written ────────────────────
   Weight is diameter SQUARED, so the size box is the most expensive field in
   the application: get the bar wrong and every number after it is wrong, and
   nothing on screen says so. This suite holds the three ways that can happen.

   1 · A SPELLING that resolves to two different answers. 1/2 and 1/2" have
       always been one size; 1", 1 IN and 1 INCH had not. The inch reader
       understood all three, isKnownSize understood only the one with a mark,
       and the undersize table was keyed on it — so a 1 INCH rod was worth
       25.4mm fullsize and NOTHING undersize, while the same rod written 1"
       was worth 25.4 and 23. One rod, three spellings, three answers.

   2 · TWO TABLES holding the same size. Seven inch sizes sit in both the
       general fullsize table and the imperial one. They agree today. Nothing
       makes them agree tomorrow except a test that reads both.

   3 · IMPERIAL AND METRIC CROSSING. 1/2" is 12.7mm and M12 is 12.0mm: a 4%
       difference in diameter, 8% in weight, and they are not the same item to
       a previous price. They must never resolve to each other.

   Every weight here is computed in this file from the diameter the app says
   it is using — pi/4 x d^2 x L x 7.85e-6 — and compared to what the app
   produced.                                                                 */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const K = Math.PI / 4 * 7.85e-6;
const w = (d, L) => d * d * L * K;

/* The tables and the readers, asked directly. */
const dia = (page, sizeType, size, type = 'sagrod', material = 'MS') =>
  page.evaluate(([t, m, st, s]) => {
    const v = dcEffectiveDiameter(t, m, st, normalizeSizeValue(s));
    return v === '' || v == null ? null : Number(v);
  }, [type, material, sizeType, size]);

module.exports = async (browser, A) => {
  const S = A.suite('size system — one rod, one diameter, whichever way it was written');

  const page = await openApp(browser);
  await page.evaluate(() => { selectedCompanyId = 7; });

  // ══ 1 · EVERY SPELLING OF ONE INCH SIZE ════════════════════════════════
  {
    /* The canonical form first, then everything that means the same thing. */
    for (const [size, canon] of [
      ['1"', '1"'], ['1 inch', '1"'], ['1in', '1"'], ['1 IN', '1"'],
      ['1 INCHES', '1"'], ['1”', '1"'], ['1″', '1"'],
      ['1/2', '1/2'], ['1/2"', '1/2'], ['1/2 IN', '1/2'], ['1/2 inch', '1/2'],
      ['1-1/4', '1-1/4'], ['1-1/4"', '1-1/4'], ['1 1/4', '1-1/4'],
    ]) {
      const got = await page.evaluate(s => normalizeSizeValue(s), size);
      A.eq(got, canon, `"${size}" is the size ${canon}`);
    }

    /* And the spelling changes neither bar it is cut from. */
    for (const spelling of ['1"', '1 inch', '1in', '1 IN']) {
      A.eq(await dia(page, 'FULLSIZE', spelling), 25.4,
        `"${spelling}" fullsize is the 25.4mm bar`);
      A.eq(await dia(page, 'UNDERSIZE', spelling), 23,
        `"${spelling}" undersize is the 23mm bar`);
    }

    /* A bare 1 is still M1 and still not a size we stock — the mark is what
       makes it an inch, and guessing there would put 25.4mm behind a size
       nobody wrote. */
    A.eq(await page.evaluate(() => normalizeSizeValue('1')), 'M1', 'a bare 1 is M1, not one inch');
    A.eq(await dia(page, 'FULLSIZE', '1'), null, 'and M1 has no diameter');

    /* An inch size we do not stock is not quietly replaced by one we do. */
    for (const s of ['2"', '9/16', '11/16', '1-3/4"']) {
      A.eq(await dia(page, 'FULLSIZE', s), null, `${s} is not stocked, and no diameter is invented for it`);
      A.eq(await page.evaluate(x => isKnownSize(normalizeSizeValue(x)), s), false,
        `${s} is reported as a size we do not recognise`);
    }
  }

  // ══ 2 · THE TWO FULLSIZE TABLES AGREE ══════════════════════════════════
  {
    const cross = await page.evaluate(() => {
      const out = [];
      for (const k of Object.keys(WQA_INCH_DIA)) {
        const alt = DIA_FULLSIZE[k] !== undefined ? DIA_FULLSIZE[k]
                  : DIA_FULLSIZE[k + '"'] !== undefined ? DIA_FULLSIZE[k + '"'] : null;
        if (alt !== null) out.push({ k, a: Number(alt), b: Number(WQA_INCH_DIA[k]) });
      }
      return out;
    });
    A.ok(cross.length >= 7, `the two fullsize tables share ${cross.length} inch sizes`);
    cross.forEach(({ k, a, b }) =>
      A.eq(a, b, `${k} is the same diameter in both fullsize tables`));
  }

  // ══ 3 · 1/2" IS NOT M12 ════════════════════════════════════════════════
  {
    const half = await dia(page, 'FULLSIZE', '1/2');
    const m12  = await dia(page, 'FULLSIZE', 'M12');
    A.eq(half, 12.7, 'a fullsize 1/2" rod is cut from 12.7mm');
    A.eq(m12, 12, 'a fullsize M12 rod is cut from 12mm');
    A.ok(half !== m12, 'and they are not the same bar');

    /* Which means they are not the same weight, and the app agrees. */
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\n1/2 x 1000 x 100/100 - 4pcs\nM12 x 1000 x 100/100 - 4pcs',
      { settle: 900 });
    const rows = await rowState(page);
    A.eq(rows.length, 2, 'an inch rod and a metric rod, side by side');
    A.eq(rows[0].size, '1/2', 'the first row is the 1/2" rod');
    A.eq(rows[1].size, 'M12', 'the second is the M12');
    const calc = await page.evaluate(() => wqa.rows.map(r => (r.calc || {}).weight));
    A.near(calc[0], w(12.7, 1000), 0.001, '1/2" x 1000 weighs what a 12.7mm bar weighs');
    A.near(calc[1], w(12, 1000), 0.001, 'M12 x 1000 weighs what a 12mm bar weighs');
    A.ok(Math.abs(calc[0] - calc[1]) > 0.05, 'and the two differ by more than rounding');

    /* And they are not the same item to a previous price. */
    const spec = await page.evaluate(() => wqa.rows.map(r => {
      const s = wqaHistSpec(r); return s ? s.cleanSize : null;
    }));
    A.eq(spec[0], '1/2', 'the history identity of the inch rod is the inch size');
    A.eq(spec[1], 'M12', 'and of the metric rod, the metric size');
    A.ok(spec[0] !== spec[1], 'so one can never find the other\'s price');
  }

  // ══ 4 · WEIGHT FOLLOWS THE DIAMETER THE APP SAYS IT IS USING ═══════════
  /* Across the range, both size types, computed here and compared there. */
  {
    const cases = [
      ['M12', 'FULLSIZE', 1000], ['M12', 'UNDERSIZE', 1000],
      ['M16', 'FULLSIZE', 850],  ['M16', 'UNDERSIZE', 850],
      ['M20', 'FULLSIZE', 3000], ['M20', 'UNDERSIZE', 3000],
      ['M24', 'FULLSIZE', 300],  ['M30', 'FULLSIZE', 1200],
      ['M36', 'FULLSIZE', 2000], ['M48', 'FULLSIZE', 500],
      ['1/2', 'FULLSIZE', 1000], ['1/2', 'UNDERSIZE', 1000],
      ['3/4', 'FULLSIZE', 1500], ['3/4', 'UNDERSIZE', 1500],
      ['1"',  'FULLSIZE', 900],  ['1"',  'UNDERSIZE', 900],
      ['3/8', 'FULLSIZE', 600],  ['5/16', 'FULLSIZE', 400],
    ];
    for (const [size, st, len] of cases) {
      const d = await dia(page, st, size);
      A.ok(d && d > 0, `${size} ${st} has a diameter (${d})`);
      if (!d) continue;
      await quickAddPaste(page, `MS SAG ROD PL ${st === 'FULLSIZE' ? 'FULLSIZE' : 'UNDERSIZE'}\n${size} x ${len} x 100/100 - 1pcs`,
        { expanded: false, settle: 700 });
      const got = await page.evaluate(() => (wqa.rows[0].calc || {}).weight);
      A.near(got, w(d, len), 0.002,
        `${size} ${st} x ${len} weighs pi/4 x ${d}^2 x ${len} x 7.85e-6`);
    }
  }

  // ══ 5 · THE COMPANY'S OWN RULE, WHERE IT HAS ONE ═══════════════════════
  /* Mild steel is drawn undersize at M12 and at the half inch, and that is a
     company rule, not a guess. It is deliberately different from what a
     general engineering table would say, and it stays. */
  {
    for (const [size, bar] of [['M12', 10.6], ['1/2', 10.9]]) {
      await quickAddPaste(page, `MS SAG ROD PL\n${size} x 1000 x 100/100 - 4pcs`, { settle: 900 });
      const r = await page.evaluate(() => ({
        st: wqaRowSpec(wqa.rows[0], 'sizeType') || '',
        weight: (wqa.rows[0].calc || {}).weight,
        why: wqa.rows[0].stWhy || '',
      }));
      A.eq(r.st, 'UNDERSIZE', `mild steel at ${size} is the company's undersize bar`);
      A.eq(r.why, 'companyDefault', 'and the row says the company answered, not the customer');
      A.near(r.weight, w(bar, 1000), 0.002, `so it weighs what a ${bar}mm bar weighs`);
    }
  }

  // ══ 6 · WHERE THE COMPANY HAS NO RULE, THE ROW ASKS ════════════════════
  /* No size type means no bar, so no weight and no price — and the moment
     somebody answers, all three arrive. */
  {
    await quickAddPaste(page, 'MS SAG ROD PL\nM20 x 1000 x 100/100 - 4pcs', { settle: 900 });
    const open = await page.evaluate(() => ({
      st: wqaRowSpec(wqa.rows[0], 'sizeType') || '',
      weight: (wqa.rows[0].calc || {}).weight,
      price: (wqa.rows[0].calc || {}).finalUnitPrice,
      miss: wqaRowMissing(wqa.rows[0]),
    }));
    A.eq(open.st, '', 'nothing has said which bar an MS M20 is cut from');
    A.ok(!(open.weight > 0), 'so the row has no weight');
    A.ok(!(open.price > 0), 'and no price');
    A.ok(open.miss.includes('Size Type'), 'and it asks which bar, by name');

    await page.evaluate(() => { wqaEditRowSpec(0, 'sizeType', 'UNDERSIZE'); });
    await page.waitForTimeout(700);
    const under = await page.evaluate(() => (wqa.rows[0].calc || {}).weight);
    A.near(under, w(18, 1000), 0.002, 'answering UNDERSIZE weighs it on the 18mm bar at once');

    await page.evaluate(() => { wqaEditRowSpec(0, 'sizeType', 'FULLSIZE'); });
    await page.waitForTimeout(700);
    const full = await page.evaluate(() => (wqa.rows[0].calc || {}).weight);
    A.near(full, w(20, 1000), 0.002, 'and changing it to FULLSIZE reweighs it on 20mm');
    A.ok(Math.abs(full - under) > 0.1, 'the two answers are genuinely different rods');
  }

  // ══ 7 · A PRODUCT WORD IS A WORD ═══════════════════════════════════════
  /* The size is only half of what decides the weight; the PRODUCT decides how
     the dimensions are developed into a length. Two ways it was being decided
     wrongly, both silently:

       · "SPECIAL BOLT" contains the letters of "l bolt" — specia|l bolt — and
         was read as an L Bolt. So was "STEEL BOLT".
       · "L BOLT 45DEG" is a product this app HAS, with its own form: a plain
         L Bolt's total length is computed as l + w - d x 1.5, and a 45DEG
         one's is not, because the bend develops differently. It was read as a
         plain L Bolt and priced on the 90-degree deduction. */
  {
    const detect = t => page.evaluate(x => {
      const d = wqaDetectCommon(x);
      return { product: d.product || '', unsupported: d.productUnsupported || '' };
    }, t);

    /* The words that DO name a product, including the punctuated forms the
       bare substring test was there to catch. */
    for (const [text, want] of [
      ['sag rod', 'sagrod'], ['(sag rod)', 'sagrod'], ['sag-rod', 'sagrod'],
      ['SAG RODS', 'sagrod'], ['sagrod', 'sagrod'],
      ['l bolt', 'lbolt'], ['L-BOLT', 'lbolt'], ['(l bolt)', 'lbolt'], ['hook bolt', 'lbolt'],
      ['j bolt', 'jbolt'], ['J-BOLT', 'jbolt'],
      ['anchor bolt', 'anchorbolt'], ['ANCHOR-BOLT', 'anchorbolt'],
      ['stud', 'stud'], ['stud bolt', 'stud'], ['STUDS', 'stud'],
    ]) {
      A.eq((await detect(text)).product, want, `"${text}" names the ${want}`);
    }

    /* And the words that do not. */
    for (const text of ['special bolt', 'steel bolt', 'full bolt', 'special-bolt']) {
      A.eq((await detect(text)).product, '', `"${text}" is not an L Bolt`);
    }
    for (const text of ['l bolt 45deg', 'L BOLT 45 DEG', 'L-BOLT 45°', '45 degree l bolt']) {
      const d = await detect(text);
      A.eq(d.product, '', `"${text}" is not a plain L Bolt`);
      A.eq(d.unsupported, 'lbolt45', `"${text}" is recorded as the 45DEG product Quick Add does not read`);
    }

    /* End to end: the message produces no priced L Bolt row. */
    await quickAddPaste(page, 'MS ZP L BOLT 45DEG\nM12 x 300 x 100 - 4pcs', { settle: 900 });
    const rows = await page.evaluate(() => wqa.rows.filter(r => !r.removed)
      .map(r => ({ product: wqaRowProduct(r) || '', price: (r.calc || {}).finalUnitPrice })));
    A.ok(!rows.some(r => r.product === 'lbolt' && r.price > 0),
      'a 45DEG message never produces a priced plain L Bolt row');
  }

  A.ok(!page._dcErrors.length, 'no script error: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
