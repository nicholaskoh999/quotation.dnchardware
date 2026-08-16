/* ── Four materials, one vocabulary, one answer ─────────────────────────────
   The company's canonical mapping, as ruled:

       SS304 family  → SS304        SS316 family  → SS316
       8.8 family    → 4140 QT      10.9 family   → 4340 QT

   and it is the same mapping whatever the source. A grade written on an
   engineering drawing means what it means when a customer types it: an earlier
   round held a document's "DIN 975 Grade 8.8" open as a strength class with no
   material, and that is superseded — the company buys 4140 QT for 8.8 and the
   quotation says so, on every path.

   Three things this suite exists to keep apart.

   IDENTITY beats strength. "A2-70" is stainless with a property class; the 70
   is not a grade and must never reach the 8.8/10.9 family. Explicit stainless
   is never overwritten by an alloy.

   A GRADE is not a FINISH. "GRADE 8.8 ZINC" is 4140 QT plated zinc — two
   fields, read separately, neither taken for the other.

   And what is genuinely ambiguous stays unanswered. "STAINLESS STEEL" does not
   say 304 or 316; "HT" does not say 8.8 or 10.9. Those are Needs Material, not
   a guess. Stored codes are '4140' (shown as 4140 QT) and '4340' (4340 QT). */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* The one vocabulary, asked directly. Both the pasted-message parser and the
   extraction normaliser resolve a specification through this. */
const reads = (page, text) => page.evaluate(t => {
  const c = wqaDetectCommon(t);
  return { material: c.material,
           /* the canonical quotation finish — stainless carries none */
           finish: wqaFinishFor(c.material, c.finish),
           finishSeen: c.finish, grade: c.strengthGrade || '' };
}, text);

const SS304 = ['SS304', 'SS 304', 'S.S.304', 'S/S304', 'S/S 304', 'SUS304', 'SUS 304',
               'AISI 304', '304SS', '304 SS', '304 Stainless', '304 Stainless Steel',
               'Stainless 304', 'Stainless Steel 304', 'A2', 'A2-50', 'A2-70', 'A2-80'];
const SS316 = ['SS316', 'SS 316', 'S.S.316', 'S/S316', 'S/S 316', 'SUS316', 'SUS 316',
               'AISI 316', '316SS', '316 SS', '316 Stainless', '316 Stainless Steel',
               'Stainless 316', 'Stainless Steel 316', 'A4', 'A4-50', 'A4-70', 'A4-80'];
const G88 = ['8.8', 'G8.8', 'G 8.8', 'GR8.8', 'GR 8.8', 'GR.8.8', 'Gr 8.8', 'Grade 8.8',
             'Grade8.8', 'GRADE 8.8', 'Class 8.8', 'Class8.8', 'CL 8.8',
             'HT8.8', 'HT 8.8', 'H.T. 8.8', '8.8 HT', 'HT G8.8', 'HT GR8.8', 'HT Grade 8.8',
             'High Tensile 8.8', 'High Tensile Grade 8.8',
             'DIN 975 8.8', 'DIN975 8.8', 'DIN 975 G8.8', 'DIN 975 GR8.8', 'DIN 975 Grade 8.8',
             '4140', '4140 QT', '4140 Q&T', 'AISI 4140', 'AISI 4140 QT'];
const G109 = ['10.9', 'G10.9', 'G 10.9', 'GR10.9', 'GR 10.9', 'GR.10.9', 'Gr 10.9',
              'Grade 10.9', 'Grade10.9', 'GRADE 10.9', 'Class 10.9', 'Class10.9', 'CL 10.9',
              'HT10.9', 'HT 10.9', 'H.T. 10.9', '10.9 HT', 'HT G10.9', 'HT GR10.9',
              'HT Grade 10.9', 'High Tensile 10.9', 'High Tensile Grade 10.9',
              'DIN 975 10.9', 'DIN975 10.9', 'DIN 975 G10.9', 'DIN 975 GR10.9',
              'DIN 975 Grade 10.9',
              '4340', '4340 QT', '4340 Q&T', 'AISI 4340', 'AISI 4340 QT'];
/* Not enough to name one of the four. */
const UNRESOLVED = ['STAINLESS STEEL', 'STAINLESS', 'SS', 'S/S',
                    'HT', 'HIGH TENSILE', 'HIGH-TENSILE'];
const PAPER = ['A4 PAPER', 'SHEET SIZE A4', 'DRAWING SIZE A2', 'A2 SHEET', 'FORMAT A4'];

/* One extraction item, all seventeen keys. */
const item = o => Object.assign({
  M: null, L: null, W: null, TL: null, qty: null, Bmid: null,
  material: null, finish: null, sizeType: null, unclear: null,
  product: null, threadEnds: null, bodyDia: null, H: null, ID: null, S: null, R: null,
}, o);
const doc = o => Object.assign({
  product: null, material: null, finish: null, sizeType: null,
  threadEnds: null, note: null, items: [],
}, o);
const apply = async (page, d) => {
  await page.evaluate(async x => { wqaOpen(); await wqaAiApply(x); }, d);
  await page.waitForTimeout(800);
  return rowState(page);
};

module.exports = async (browser, A) => {
  const S = A.suite('materials — four identities, one vocabulary, one answer');

  // ══ the vocabulary, spelling by spelling ══════════════════════════════════
  {
    const page = await openApp(browser);
    for (const w of SS304) {
      const r = await reads(page, w);
      A.eq(r.material, 'SS304', `${w} → SS304`);
      A.eq(r.finish, '', `${w} → finish N/A`);
    }
    for (const w of SS316) {
      const r = await reads(page, w);
      A.eq(r.material, 'SS316', `${w} → SS316`);
    }
    for (const w of G88) A.eq((await reads(page, w)).material, '4140', `${w} → 4140 QT`);
    for (const w of G109) A.eq((await reads(page, w)).material, '4340', `${w} → 4340 QT`);

    /* And the four never merge. */
    A.eq((await reads(page, 'SS304')).material !== (await reads(page, 'SS316')).material,
      true, 'SS304 and SS316 are different materials');
    A.eq((await reads(page, 'Grade 8.8')).material !== (await reads(page, 'Grade 10.9')).material,
      true, 'and so are 4140 QT and 4340 QT');

    // ── what is not enough to name one of them ─────────────────────────────
    for (const w of UNRESOLVED)
      A.eq((await reads(page, w)).material, '',
        `${JSON.stringify(w)} does not say which — it stays unanswered`);
    for (const w of PAPER)
      A.eq((await reads(page, w)).material, '', `${JSON.stringify(w)} is the paper, not the steel`);

    // ── identity outranks the number beside it ─────────────────────────────
    A.eq((await reads(page, 'A2-70')).material, 'SS304',
      "A2-70's 70 is a property class, not grade 8.8 or 10.9");
    A.eq((await reads(page, 'A4-80')).material, 'SS316', 'and A4-80 is stainless too');
    A.eq((await reads(page, 'SUS304 GRADE 8.8')).material, 'SS304',
      'an explicit stainless is not overwritten by a grade written beside it');
    A.eq((await reads(page, 'A4-70 HDG')).material, 'SS316', 'nor by a finish');
    A.eq((await reads(page, 'A4-70 HDG')).finishSeen, 'HDG',
      'the HDG the document stated is still read, and kept as evidence');

    // ── a grade is not a finish, and a finish is not a material ────────────
    for (const [text, mat, fin] of [
      ['GRADE 8.8 ZINC', '4140', 'ZP'],
      ['HT8.8 ZINC PLATED', '4140', 'ZP'],
      ['G10.9 ELECTRO ZINC', '4340', 'ZP'],
      ['PLAIN G8.8', '4140', 'PL'],
      ['DIN 975 GRADE 8.8 HDG', '4140', 'HDG'],
      ['Grade 10.9 HOT DIP GALVANISED', '4340', 'HDG'],
      ['Grade 10.9 HOT-DIP GALVANIZED', '4340', 'HDG'],
      ['GRADE 8.8 SELF COLOUR', '4140', 'PL'],
      ['A4-70 HDG', 'SS316', ''],
      ['SS304 PLAIN', 'SS304', ''],
    ]) {
      const r = await reads(page, text);
      A.eq(r.material, mat, `${text} → material ${mat}`);
      A.eq(r.finish, fin, `${text} → finish ${fin || 'N/A'}`);
    }

    // ── a grade is still kept as the evidence it is ────────────────────────
    A.includes((await reads(page, 'DIN 975 GRADE 8.8')).grade.toLowerCase(), '8.8',
      'the wording that produced 4140 QT is remembered');
    A.includes((await reads(page, 'Grade 10.9')).grade, '10.9', 'and so is 10.9');

    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ══ a grade belongs to the part it describes ══════════════════════════════
  {
    const page = await openApp(browser);
    /* A nut's Grade 8 is not a grade in this vocabulary at all, and must not be
       read as one. */
    A.eq((await reads(page, 'HEX NUT GRADE 8')).material, '',
      "a hex nut's Grade 8 names no material");
    A.eq((await reads(page, 'HEX NUT DIN 934 GRADE 8')).material, '',
      'nor with its standard beside it');
    const r = await reads(page, 'STUD DIN 975 GRADE 8.8 / HEX NUT DIN 934 GRADE 8 / FLAT WASHER DIN 125');
    A.eq(r.material, '4140', "the stud's own Grade 8.8 is what the specification means");
    await page.close();
  }

  // ══ LIVE EXAMPLE A — HT8.8 two-end studs, zinc ════════════════════════════
  /* Photographed from a customer's order list. One heading, four rows under it.
     A Stud in this system is M · L with no thread at all, so a two-end thread
     resolves to the product that has one — see the report. What this asserts is
     the specification: the material, the finish, and every dimension. */
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, [
      'HT8.8 TWO END STUD M12 X 1582 ( 200/200 ) ZINC - 37pcs',
      'HT8.8 TWO END STUD M12 X 1406 ( 200/200 ) ZINC - 382pcs',
      'HT8.8 TWO END STUD M12 X 1104 ( 200/200 ) ZINC - 44pcs',
      'HT8.8 TWO END STUD M12 X 986 ( 200/200 ) ZINC - 28pcs',
    ].join('\n'), { expanded: false, settle: 1300 });

    const rows = await rowState(page);
    A.eq(rows.length, 4, 'four rows');
    A.eq(rows.map(r => `${r.size}/${r.length}/${r.qty}`).join(' · '),
      'M12/1582/37 · M12/1406/382 · M12/1104/44 · M12/986/28',
      'each with its own size, length and quantity');
    rows.forEach((r, i) => {
      A.eq(r.material, '4140', `row ${i + 1} is 4140 QT — HT8.8 is the company's 8.8 family`);
      A.eq(r.finish, 'ZP', `row ${i + 1} is zinc plated`);
      A.ok(!r.missing.includes('Material'), `row ${i + 1} does not ask for a material`);
      A.includes(r.matFrom.toLowerCase(), '8.8',
        `row ${i + 1} records the wording its material came from`);
      A.eq(r.matDefaulted, 'true',
        `row ${i + 1} says 4140 QT is the company's answer to that class, not the customer's word`);
    });
    /* The customer wrote "TWO END STUD" and a Stud in this system is M · L with
       no thread at all, so the wording and the geometry disagree. That is an
       approved behaviour and it is unchanged: the row says so, keeps the 200/200
       beside it rather than discarding it, and waits for a person to pick the
       product. See the report — nothing about the material depends on it. */
    A.includes(rows[0].badges, 'Conflicting product',
      'and the row says its wording and its thread disagree, rather than choosing');
    A.eq(await page.evaluate(() => wqa.rows[0].threadSeen), '200/200',
      'with the thread it read kept beside it, not thrown away');
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ══ and the same specification stated once, over a list ═══════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ['HT8.8 TWO END STUD ZINC',
                               'M12 X 1582 ( 200/200 ) - 37pcs',
                               'M12 X 1406 ( 200/200 ) - 382pcs',
                               'M12 X 1104 ( 200/200 ) - 44pcs',
                               'M12 X 986 ( 200/200 ) - 28pcs'].join('\n'),
                        { expanded: false, settle: 1300 });
    const rows = await rowState(page);
    A.eq(rows.length, 4, 'the heading is not an item, and the four rows are');
    A.ok(rows.every(r => r.material === '4140'), 'all four inherit 4140 QT from the heading');
    A.ok(rows.every(r => r.finish === 'ZP'), 'and all four are zinc plated');
    A.eq(rows.map(r => r.length).join(','), '1582,1406,1104,986', 'each keeping its own length');
    A.eq(rows.map(r => r.qty).join(','), '37,382,44,28', 'and its own quantity');
    await page.close();
  }

  // ══ LIVE EXAMPLE B — the engineering drawing, PLAIN G8.8 ══════════════════
  /* HAB-TA-01: five parts on one sheet, each captioned PLAIN G8.8 M30 x its own
     length. The dimensional ownership of 950 / 865 / 1000 / 1200 / 1285 is an
     earlier round's regression and must not move; what is new is that the
     caption names a material. */
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    const part = (L, extra) => item(Object.assign({
      M: 'M30', L, TL: '200/200', threadEnds: 2,
      material: 'PLAIN G8.8', finish: 'PLAIN', product: 'SAG_ROD' }, extra || {}));
    const rows = await apply(page, doc({
      items: [part(950, { TL: null, threadEnds: null }), part(865, { Bmid: 465 }),
              part(1000, { Bmid: 600 }), part(1200, { Bmid: 800 }), part(1285, { Bmid: 885 })],
    }));
    A.eq(rows.length, 5, 'five parts');
    A.eq(rows.map(r => r.length).join(','), '950,865,1000,1200,1285',
      'each with its own length, exactly as before');
    rows.forEach((r, i) => {
      A.eq(r.material, '4140', `part ${i + 1} is 4140 QT, from the caption's G8.8`);
      A.eq(r.finish, 'PL', `part ${i + 1} is plain`);
      A.ok(!r.missing.includes('Material'), `part ${i + 1} does not ask for a material`);
      A.excludes(r.badges, 'Needs Material', `nor does its badge say so`);
    });
    A.eq(rows[0].size, 'M30', 'and the size is M30');
    await page.close();
  }

  // ══ a document and a typed message answer alike ═══════════════════════════
  /* The point of the ruling: one mapping, not two. The same specification is
     put in through both doors and the answers are compared. */
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    for (const [wording, mat, fin] of [
      ['DIN 975 GRADE 8.8', '4140', 'HDG'],
      ['GRADE 10.9', '4340', 'ZP'],
      ['SUS304', 'SS304', ''],
      ['A4-70', 'SS316', ''],
    ]) {
      const finWord = fin === 'HDG' ? 'HDG' : (fin === 'ZP' ? 'ZINC' : 'PLAIN');
      await quickAddPaste(page, `${wording} SAG ROD ${finWord} FULLSIZE\nM16 x 300 x 50/50 - 10pcs`,
        { expanded: false, settle: 800 });
      const typed = (await rowState(page))[0];

      const extracted = (await apply(page, doc({ items: [item({
        M: 'M16', L: 300, TL: '50/50', qty: 10, product: 'SAG_ROD', threadEnds: 2,
        material: wording, finish: finWord, sizeType: 'FULLSIZE' })] })))[0];

      A.eq(typed.material, mat, `typed "${wording}" → ${mat}`);
      A.eq(extracted.material, mat, `extracted "${wording}" → ${mat}`);
      A.eq(typed.finish, fin, `typed "${wording} ${finWord}" → finish ${fin || 'N/A'}`);
      A.eq(extracted.finish, fin, `extracted the same`);
      A.eq(extracted.material, typed.material,
        `and a document is read exactly as a message is: ${wording}`);
    }
    await page.close();
  }

  return S;
};
