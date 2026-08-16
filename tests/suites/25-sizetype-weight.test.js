/* ── An unknown size type is not a fullsize one ─────────────────────────────
   An undersize rod is a different bar, not a differently-spelled one: an
   undersized 1/2" measures 10.9mm where a fullsize one measures 12.7. Weigh
   the first as the second and it is 36% too heavy, and priced on it.

   The review screen said "Needs Size Type" and then weighed the row anyway —
   dcBuiltInDiameter reads anything that is not the literal string UNDERSIZE as
   fullsize, which is the right reading of an ANSWER and the wrong reading of a
   SILENCE. Live: 1/2 x L1020 with nothing said about the size type showed
   1.0143 kg/pc, which is the FULLSIZE figure.

   So: no size type, no diameter, no weight, no price — and the row asks, for
   that and for nothing else. The moment a person chooses, everything computes.

   What must NOT change: where the company HAS an established rule the row is
   answered and weighed exactly as before. MS at M12 and at the half inch is
   drawn undersize; the QT grades are fullsize away from M12. Those are answers,
   not guesses, and this suite pins them alongside the fix.                   */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const RHO = 0.0000061654;

module.exports = async (browser, A) => {
  const S = A.suite('size type — unknown is not fullsize');

  // ══ the live figure: 1/2 x L1020 with no material and no size type ════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    /* Nothing in the message says MS, so no company rule reaches it and the
       size type is genuinely unanswered. This is the row that showed 1.0143. */
    await quickAddPaste(page, 'SAG ROD ZP\n1/2 x 1020 x 100/100 - 20pcs',
      { expanded: true, settle: 1000 });

    const unknown = (await rowState(page))[0];
    A.eq(unknown.size, '1/2', 'a half-inch rod');
    A.eq(unknown.material, '', 'with no material stated');
    A.eq(unknown.sizeType, '', 'and no size type');
    A.ok(unknown.missing.includes('Size Type'), 'so the row asks for one');

    /* The number that used to appear, spelled out so it can never come back
       quietly: 12.7mm is the FULLSIZE half inch. */
    const fullsizeWeight = 12.7 * 12.7 * 1020 * RHO;
    A.ok(Math.abs(fullsizeWeight - 1.0143) < 0.001,
      `the fullsize weight for this rod is ${fullsizeWeight.toFixed(4)} kg/pc — the figure that used to show`);
    A.eq(String(unknown.weight == null ? '' : unknown.weight), '',
      'and the row now has no weight at all');
    A.eq(String(unknown.price == null ? '' : unknown.price), '', 'and no price');
    A.ok(!/\d/.test(String(unknown.shownUnitWeight || '')),
      `the screen shows no weight either (${JSON.stringify(unknown.shownUnitWeight)})`);
    A.ok(!/\d/.test(String(unknown.shownPrice || '').replace(/RM/g, '')),
      `nor a price (${JSON.stringify(unknown.shownPrice)})`);

    /* And it asks ONE thing. A rate that cannot be looked up without a
       diameter is not a second thing to fix. */
    A.ok(!unknown.missing.includes('Cost Rate'),
      'it does not also ask for a cost rate it could not have');
    A.ok(!unknown.missing.includes('Price'), 'nor for a price');
    A.ok(!unknown.missing.includes('Valid Size'),
      'nor call a known size invalid — the size is fine, the question is the size type');
    await page.close();
  }

  // ══ mild steel M16: the size type is open, so nothing is quoted ═══════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    /* MS is stated, but no company rule covers MS at M16, so the question is
       still open. Before the fix this row showed 1.6099 kg/pc AND RM 7.36. */
    await quickAddPaste(page, 'MS SAG ROD ZP\nM16 x 1020 x 100/100 - 20pcs',
      { expanded: true, settle: 1000 });

    const open = (await rowState(page))[0];
    A.eq(open.material, 'MS', 'mild steel');
    A.eq(open.sizeType, '', 'with no rule covering M16, the size type stays open');
    A.ok(open.missing.includes('Size Type'), 'so the row asks');
    A.eq(String(open.weight == null ? '' : open.weight), '',
      'and it is not weighed on the 16mm bar (1.6099 kg/pc, as it used to be)');
    A.eq(String(open.price == null ? '' : open.price), '',
      'and not priced at RM 7.36, as it used to be');

    // ── the person chooses Undersize, and everything computes ─────────────
    await page.evaluate(() => wqaEditRowSpec(0, 'sizeType', 'UNDERSIZE'));
    await page.waitForTimeout(1100);
    const under = (await rowState(page))[0];
    A.eq(under.sizeType, 'UNDERSIZE', 'the row is undersize now');
    A.ok(!under.missing.includes('Size Type'), 'and no longer asks');
    A.near(Number(under.weight), 14.5 * 14.5 * 1020 * RHO, 1e-6,
      `and weighs what an undersized M16 weighs (${under.weight})`);
    A.ok(Number(under.price) > 0, `with a price again (${under.price})`);

    // ── and Fullsize gives the other bar, on purpose this time ────────────
    await page.evaluate(() => wqaEditRowSpec(0, 'sizeType', 'FULLSIZE'));
    await page.waitForTimeout(1100);
    const full = (await rowState(page))[0];
    A.near(Number(full.weight), 16 * 16 * 1020 * RHO, 1e-6,
      'choosing Fullsize gives the fullsize weight — because it was chosen');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ══ an established company rule is an ANSWER, and still weighs ═══════════
  {
    /* DC_SIZE_TYPE_RULES. Nothing here may be quieted by the fix above. */
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    for (const [text, mat, st, dia, len, note] of [
      ['MS SAG ROD ZP\n1/2 x 1020 x 100/100 - 20pcs', 'MS', 'UNDERSIZE', 10.9, 1020,
        'mild steel at the half inch is drawn undersize'],
      ['MS SAG ROD ZP\nM12 x 1020 x 100/100 - 20pcs', 'MS', 'UNDERSIZE', 10.6, 1020,
        'and at M12'],
      ['4140 QT SAG ROD PL\nM20 x 1020 x 100/100 - 20pcs', '4140', 'FULLSIZE', 20, 1020,
        'the QT grades are fullsize away from M12'],
    ]) {
      await quickAddPaste(page, text, { expanded: false, settle: 900 });
      const r = (await rowState(page))[0];
      A.eq(r.material, mat, note);
      A.eq(r.sizeType, st, `${mat} ${r.size}: the rule answers ${st}`);
      A.ok(!r.missing.includes('Size Type'), `${mat} ${r.size}: so the row does not ask`);
      A.near(Number(r.weight), dia * dia * len * RHO, 1e-6,
        `${mat} ${r.size}: and is weighed on the ${dia}mm bar (${r.weight})`);
      /* Weighed is the assertion here. Whether it is also PRICED depends on
         whether the company has a rate for that specification — and where it
         has none the row asks for one rather than quoting a number from
         nowhere. Either way the size type question is answered and gone. */
      A.ok(Number(r.price) > 0 || r.missing.includes('Cost Rate'),
        `${mat} ${r.size}: and either priced or asking for its rate (${r.price})`);
      A.ok(!r.missing.includes('Size Type'),
        `${mat} ${r.size}: and never asked its size type again`);
    }
    /* The half inch, both ways, side by side — the whole point of the bug. */
    const half = await page.evaluate(() => ({
      under: String(dcEffectiveDiameter('sagrod', 'MS', 'UNDERSIZE', '1/2')),
      full:  String(dcEffectiveDiameter('sagrod', 'MS', 'FULLSIZE', '1/2')),
    }));
    A.eq(half.under, '10.9', 'an undersized half inch is 10.9mm');
    A.eq(half.full, '12.7', 'a fullsize one is 12.7mm');
    await page.close();
  }

  // ══ the same rule on every product that has a size type ══════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    for (const [text, type] of [
      ['MS ANCHOR BOLT ZP\nM20 x 450 x 150 - 10pcs',            'anchorbolt'],
      ['MS L BOLT ZP\nM20 x 950 x 400 x 150 - 10pcs',           'lbolt'],
      ['MS J BOLT ZP\nM20 x H 400 x ID 70 x S 80 x TL 100 - 10pcs', 'jbolt'],
    ]) {
      await quickAddPaste(page, text, { expanded: false, settle: 900 });
      const r = (await rowState(page))[0];
      A.eq(r.product, type, `${type}: read as a ${type}`);
      A.eq(r.sizeType, '', `${type}: no size type stated and no rule for MS at M20`);
      A.ok(r.missing.includes('Size Type'), `${type}: the row asks for one`);
      A.ok(!(Number(r.weight) > 0), `${type}: and is not weighed until it is answered`);
      A.ok(!(Number(r.price) > 0), `${type}: nor priced`);
      A.ok(!r.missing.includes('Cost Rate'), `${type}: and asks that one thing only`);
    }
    await page.close();
  }

  // ══ a Stud has no size type, and is unaffected ═══════════════════════════
  {
    /* DC_NO_SIZE_TYPE_PRODUCTS: a Stud always uses the undersize bar and is
       never asked which. Nothing here may change that. */
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS STUD PL\nM16 x 300 - 10pcs', { expanded: false, settle: 900 });
    const r = (await rowState(page))[0];
    A.eq(r.product, 'stud', 'a stud');
    A.eq(r.sizeType, '', 'carries no size type');
    A.ok(!r.missing.includes('Size Type'), 'and is never asked for one');
    A.ok(Number(r.weight) > 0, `and is still weighed (${r.weight})`);
    const dia = await page.evaluate(() => dcEffectiveDiameter('stud', 'MS', '', 'M16'));
    A.eq(String(dia), '14.5', 'on the undersize bar it has always used');
    A.near(Number(r.weight), Number(dia) * Number(dia) * 300 * RHO, 1e-6,
      'and the weight is that bar, not a fullsize one');
    await page.close();
  }

  // ══ the Calculator answers the same way ══════════════════════════════════
  {
    const page = await openApp(browser);
    const seen = await page.evaluate(() => {
      switchType('sagrod');
      setFieldValue('sagrod', 'material', 'MS'); setFinishValue('sagrod', 'ZP');
      setFieldValue('sagrod', 'size', '1/2');
      const st = el('sagrod-sizeType');
      st.selectedIndex = -1;                       // nothing chosen
      autoFillDiameter('sagrod');
      const none = fv('sagrod', 'diameter');
      setFieldValue('sagrod', 'sizeType', 'UNDERSIZE'); autoFillDiameter('sagrod');
      const under = fv('sagrod', 'diameter');
      setFieldValue('sagrod', 'sizeType', 'FULLSIZE'); autoFillDiameter('sagrod');
      const full = fv('sagrod', 'diameter');
      /* And a Stud, on the same page, through the same function. */
      switchType('stud');
      setFieldValue('stud', 'material', 'MS'); setFieldValue('stud', 'size', 'M16');
      autoFillDiameter('stud');
      return { none, under, full, stud: fv('stud', 'diameter') };
    });
    A.eq(seen.none, '', 'with no size type chosen the calculator has no diameter');
    A.eq(seen.under, '10.9', 'undersize is the 10.9 bar');
    A.eq(seen.full, '12.7', 'and fullsize the 12.7 one');
    A.eq(seen.stud, '14.5', 'and a Stud, which is never asked, still fills its own');
    await page.close();
  }

  return S;
};
