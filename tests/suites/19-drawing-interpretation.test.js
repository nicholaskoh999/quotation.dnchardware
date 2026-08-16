/* ── Reading the engineering document, not the words printed on it ─────────
   Two live acceptance failures, both from documents rather than from typing.

   CASE A. A hook bolt drawing dimensioned D1 12, L 280, S 80, T 50, R 25 and
   titled ANCHOR BOLT came back as an Anchor Bolt with no height and no S. Two
   separate faults: the extraction schema had no J_BOLT in it at all, so the
   model could not have said "J Bolt" however clearly the hook was drawn; and
   our own geometry rule needed BOTH an inside diameter and a return height
   before it would call a row a hook, which a drawing dimensioned by radius
   never provides. The height then had nowhere to go, because a J Bolt is
   M · H · ID · S · TL and the drawing had written its height as L.

   CASE B. A six-row stud table, printed sideways, specified in two merged
   cells: a stainless block over the first rows and a DIN 975 Grade 8.8 / HDG
   block over the rest. The rows below the first of each block arrived with no
   specification at all, because nothing carried a merged cell down the rows it
   covers; and Grade 8.8 arrived as material 4140 QT, an alloy nobody wrote.

   What is asserted here is everything downstream of the model's answer. What
   the model is TOLD — hook geometry, rotated tables, whose part a spec cell
   describes, a strength class is not an alloy — is asserted in
   tests/php/ai_extract.test.php against the prompt itself.                   */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* One extraction item, all seventeen keys, so a fixture only states what it
   is actually about. */
const item = o => Object.assign({
  M: null, L: null, W: null, TL: null, qty: null, Bmid: null,
  material: null, finish: null, sizeType: null, unclear: null,
  product: null, threadEnds: null, bodyDia: null,
  H: null, ID: null, S: null, R: null,
}, o);
const doc = o => Object.assign({
  product: null, material: null, finish: null, sizeType: null,
  threadEnds: null, note: null, items: [],
}, o);

const apply = async (page, d) => {
  await page.evaluate(async x => { wqaOpen(); await wqaAiApply(x); }, d);
  await page.evaluate(() => wqaSetView('expanded'));
  await page.waitForTimeout(900);
  return rowState(page);
};

module.exports = async (browser, A) => {
  const S = A.suite('engineering documents — geometry, merged cells and specification scope');

  // ══ CASE A ══ the hook bolt titled "Anchor Bolt" ═════════════════════════
  {
    const page = await openApp(browser);

    /* Exactly the live shape: the model followed the title block, wrote the
       overall height under the letter the drawing used, and reported the
       radius because that is what was dimensioned. */
    const asDrawn = doc({
      product: 'ANCHOR_BOLT',
      items: [item({ M: 'M12', L: 280, S: 80, TL: 50, R: 25, qty: 40 })],
    });
    let r = (await apply(page, asDrawn))[0];

    A.eq(r.product, 'jbolt', 'a stated return height makes it a J Bolt, whatever the title block said');
    A.eq(r.size, 'M12', 'the rod diameter is M12');
    A.eq(r.h, '280', 'the drawing\'s overall dimension is the J Bolt\'s height');
    A.eq(r.length, '', 'and it is not also left sitting in a length the schema has no room for');
    A.eq(r.hFromL, 'true', 'the reading is recorded, so the row can say where the height came from');
    A.eq(r.s, '80', 'the return height is kept');
    A.eq(r.thread, '50', 'the thread callout is the thread length');

    /* The whole point of the case. */
    A.eq(r.id, '', 'the inside diameter stays empty: the drawing states a radius, not an inside width');
    A.eq(r.radius, '25', 'the radius is kept as the evidence it is');
    A.ok(r.missing.includes('ID'), 'and the row asks a person for the ID rather than answering itself');
    A.excludes(r.badges, 'ID 50', 'nothing anywhere doubles the radius into an inside diameter');
    A.excludes(r.badges, 'ID 25', 'nor copies it across unchanged');
    A.includes(r.badges, '280', 'the row says the drawing\'s L was read as the height');
    A.includes(r.badges, '25', 'and that the 25 is a bend radius');

    // ── the same drawing when the model does classify it ────────────────────
    r = (await apply(page, doc({
      product: 'J_BOLT',
      items: [item({ M: 'M12', H: 280, S: 80, TL: 50, R: 25, qty: 40 })],
    })))[0];
    A.eq(r.product, 'jbolt', 'a document that says J Bolt is a J Bolt');
    A.eq(r.h, '280', 'with its height where the extractor put it');
    A.eq(r.hFromL, 'false', 'and no reading to explain, because none was needed');
    A.eq(r.id, '', 'the ID is still not invented');

    // ── the same drawing WITH an inside width written on it ────────────────
    r = (await apply(page, doc({
      product: 'ANCHOR_BOLT',
      items: [item({ M: 'M12', L: 280, ID: 50, S: 80, TL: 50, R: 25, qty: 40 })],
    })))[0];
    A.eq(r.product, 'jbolt', 'an inside width and a return height together are a hook too');
    A.eq(r.id, '50', 'an ID the drawing actually states IS used');
    A.eq(r.h, '280', 'and the height still comes from the overall dimension');
    A.eq(r.radius, '25', 'with the radius still beside it as evidence');
    A.ok(!r.missing.includes('ID'), 'a stated ID leaves nothing to ask for');

    // ── a height the drawing states outright is not overwritten ────────────
    r = (await apply(page, doc({
      product: 'J_BOLT',
      items: [item({ M: 'M12', H: 280, L: 260, S: 80, TL: 50, qty: 40 })],
    })))[0];
    A.eq(r.h, '280', 'where a drawing gives both, the stated height is the height');
    A.eq(r.hFromL, 'false', 'nothing was mapped');

    // ── and L stays L on every other product ───────────────────────────────
    const others = await apply(page, doc({
      items: [
        item({ product: 'SAG_ROD',     M: 'M16', L: 300, TL: '50/50', qty: 10 }),
        item({ product: 'ANCHOR_BOLT', M: 'M16', L: 300, TL: 100,     qty: 10 }),
        item({ product: 'STUD',        M: 'M16', L: 300,              qty: 10 }),
        item({ product: 'L_BOLT',      M: 'M20', L: 950, W: 400, TL: 150, qty: 10 }),
      ],
    }));
    [['sagrod', '300'], ['anchorbolt', '300'], ['stud', '300'], ['lbolt', '950']]
      .forEach(([p, len], i) => {
        A.eq(others[i].product, p, `a ${p} is still a ${p}`);
        A.eq(others[i].length, len, `${p} keeps its length`);
        A.eq(others[i].h, '', `${p}'s length was not turned into a height`);
        A.eq(others[i].hFromL, 'false', `and nothing was mapped on a ${p}`);
      });
    A.eq(others[3].w, '400', 'and its short leg as a width');

    // ── a radius on its own says nothing about the product ─────────────────
    r = (await apply(page, doc({
      product: 'ANCHOR_BOLT',
      items: [item({ M: 'M16', L: 400, TL: 100, R: 25, qty: 10 })],
    })))[0];
    A.eq(r.product, 'anchorbolt', 'a bend radius alone does not make a row a J Bolt');
    A.eq(r.length, '400', 'its length is a length');
    A.eq(r.id, '', 'and the radius still becomes no ID');
    A.eq(r.radius, '25', 'though it is still shown');

    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ══ CASE B ══ the sideways stud table, specified in two merged cells ═════
  {
    const page = await openApp(browser);

    /* The reported table: six stud rows, a stainless specification merged over
       the first block and DIN 975 Grade 8.8 / HDG merged over the second. The
       extractor reports each merged cell on the FIRST row it covers and leaves
       the rest of that block null — that is what the cell looks like — so the
       rows below carry nothing of their own.

       The six rows are the values quoted in the acceptance report. Four of
       them state nothing of their own, which is the point: they are the rows
       the merged cells cover. */
    const table = doc({
      /* Sheet-wide remark, and nothing else document-level: the blocks differ,
         so the document names no material of its own. */
      items: [
        item({ M: 'M12', L: 145, qty: 9,  product: 'STUD',
               material: 'A2-70 SUS304', finish: 'PLAIN' }),
        item({ M: 'M20', L: 240, qty: 5,  product: 'STUD' }),
        item({ M: 'M10', L: 120, qty: 27, product: 'STUD',
               material: 'STUD DIN 975 GRADE 8.8', finish: 'HDG' }),
        item({ M: 'M10', L: 125, qty: 21, product: 'STUD' }),
        item({ M: 'M10', L: 130, qty: 21, product: 'STUD' }),
        item({ M: 'M16', L: 170, qty: 9,  product: 'STUD' }),
      ],
    });
    const rows = await apply(page, table);

    // ── every row survives, with its own numbers ───────────────────────────
    A.eq(rows.length, 6, 'six rows of a six-row table arrive as six items');
    A.eq(rows.map(r => `${r.size}/${r.length}/${r.qty}`).join(' · '),
      'M12/145/9 · M20/240/5 · M10/120/27 · M10/125/21 · M10/130/21 · M16/170/9',
      'each with the size, length and quantity written against it');
    A.ok(rows.every(r => r.product === 'stud'), 'and each read as a Stud');

    // ── the first block: stainless, and only over its own rows ─────────────
    A.eq(rows[0].material, 'SS304', 'A2-70 / SUS304 is the 304 stainless class');
    A.eq(rows[1].material, 'SS304', 'and the merged cell reaches the second row it covers');
    A.eq(rows[0].finishSeen, 'PL', 'Plain was read as PL');
    A.eq(rows[1].finishSeen, 'PL', 'on both rows of the block');

    // ── the second block: the company's answer to Grade 8.8 ────────────────
    /* Superseded ruling: the company buys 4140 QT for 8.8, on a drawing exactly
       as in a typed message. The class stays beside it as the evidence it came
       from, and the row is priceable rather than held open. */
    for (let i = 2; i < 6; i++) {
      A.eq(rows[i].material, '4140', `row ${i + 1} is 4140 QT — the company's 8.8 material`);
      A.eq(rows[i].finish, 'HDG', `row ${i + 1} carries the block's finish`);
      A.includes(rows[i].grade.toLowerCase(), '8.8', `row ${i + 1} keeps the grade as evidence`);
      A.includes(rows[i].matFrom.toLowerCase(), '8.8',
        `and records that its material came from that class`);
      A.ok(!rows[i].missing.includes('Material'), `row ${i + 1} does not ask for a material`);
    }
    /* And 4340 is a different material, which nothing here is. */
    A.excludes(rows.map(r => r.material).join(' '), '4340',
      'no row was answered with 4340, which is the 10.9 material');

    // ── a block stops where the merge stops ────────────────────────────────
    A.excludes(rows[0].finish + rows[1].finish, 'HDG',
      'the HDG merged over the lower block never reaches the stainless rows above it');
    A.excludes(rows[2].material + rows[3].material + rows[4].material + rows[5].material,
      'SS304', 'and the stainless merged over the upper block never reaches the rows below it');

    // ── HDG is a finish ────────────────────────────────────────────────────
    A.ok(rows.every(r => r.material !== 'HDG'), 'HDG is never a material');

    // ── the words that were read, beside the values they became ────────────
    A.eq(rows[0].specRaw.material, 'A2-70 SUS304', 'row 1 keeps the wording it was read from');
    A.eq(rows[1].specRaw.material, 'A2-70 SUS304', 'and the rows the cell covers keep it too');
    A.eq(rows[2].specRaw.finish, 'HDG', 'the lower block keeps its own wording');
    A.eq(rows[5].specRaw.finish, 'HDG', 'down to the last row it covers');
    A.includes(rows[3].specRaw.material, 'DIN 975', 'including the standard the grade was written under');

    // ── nothing invented a size type off the look of the document ──────────
    A.ok(rows.every(r => r.sizeType === ''), 'a Stud is given no size type, as it never is');

    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ══ a specification cell describes the rod, not its nuts and washers ═════
  {
    const page = await openApp(browser);
    const rows = await apply(page, doc({
      items: [
        /* One merged cell specifying a whole assembly, as they are written. */
        item({ M: 'M10', L: 120, qty: 27, product: 'STUD',
               material: 'STUD DIN 975 GRADE 8.8 / HEX NUT DIN 934 GRADE 8 / FLAT WASHER DIN 125',
               finish: 'HDG' }),
        item({ M: 'M10', L: 125, qty: 21, product: 'STUD' }),
      ],
    }));
    A.includes(rows[0].grade, '8.8', "the stud's own grade is the one the row carries");
    A.excludes(rows[0].grade.replace(/8\.8/g, ''), 'GRADE 8',
      "and the hex nut's Grade 8 is not read as the stud's");
    A.eq(rows[0].material, '4140',
      "so the stud is 4140 QT — the company's material for ITS grade, not the nut's");
    A.eq(rows[0].finish, 'HDG', 'the assembly finish applies to the rod');
    A.eq(rows[1].grade, rows[0].grade, 'and the whole reading carries down the block');
    A.eq(rows[1].material, '4140', 'and the row the cell also covers is the same');
    await page.close();
  }

  // ══ a row's own specification beats the sheet's general remark ═══════════
  {
    const page = await openApp(browser);
    const rows = await apply(page, doc({
      /* "ALL BOLTS TO ISO 898 CLASS 5.8" printed in the title block. */
      material: 'ISO 898 CLASS 5.8',
      items: [
        item({ M: 'M10', L: 120, qty: 27, product: 'STUD',
               material: 'DIN 975 GRADE 8.8', finish: 'HDG' }),
        item({ M: 'M10', L: 125, qty: 21, product: 'STUD' }),
      ],
    }));
    A.includes(rows[0].grade.toLowerCase(), '8.8',
      'the block\'s own Grade 8.8 is what the row carries');
    A.excludes(rows[0].grade, '5.8', 'not the sheet-wide Class 5.8');
    A.includes(rows[1].grade.toLowerCase(), '8.8', 'and it carries down the rows the cell covers');
    A.eq(rows[0].material, '4140', 'so the row is 4140 QT, the material for 8.8');
    A.eq(rows[1].material, '4140', 'on both rows');
    A.excludes(rows.map(r => r.material).join(' '), '4340',
      'and the sheet-wide 5.8 named no material of its own');
    await page.close();
  }

  // ══ the vocabulary, one case at a time ═══════════════════════════════════
  {
    const page = await openApp(browser);
    const readsAs = async (wording, field) => {
      const r = (await apply(page, doc({
        items: [item({ M: 'M16', L: 300, qty: 10, product: 'STUD', material: wording })],
      })))[0];
      return field === 'grade' ? r.grade : r[field];
    };

    // ── stainless classes ────────────────────────────────────────────────
    for (const w of ['A2', 'A2-70', 'A2-80', 'SUS304', 'SS304', 'S/S 304'])
      A.eq(await readsAs(w, 'material'), 'SS304', `${w} is 304 stainless`);
    for (const w of ['A4', 'A4-70', 'A4-80', 'SUS316', 'SS316', 'S/S 316'])
      A.eq(await readsAs(w, 'material'), 'SS316', `${w} is 316 stainless`);

    // ── which are NOT strength grades, and not paper ─────────────────────
    A.eq(await readsAs('A2', 'grade'), '', 'A2 is not read as a strength class');
    A.eq(await readsAs('A4', 'grade'), '', 'nor is A4');
    for (const w of ['SHEET SIZE A4', 'DRAWING SIZE A2', 'A4 PAPER',
                      'FORMAT A4', 'A2 SHEET', 'PRINTED ON A4', 'SCALE A2'])
      A.eq(await readsAs(w, 'material'), '', `${JSON.stringify(w)} is the paper, not the steel`);

    // ── a strength class is answered by the company's own material ───────
    for (const w of ['GRADE 8.8', 'CLASS 8.8', 'GR8.8', 'DIN 975 GRADE 8.8']) {
      A.eq(await readsAs(w, 'material'), '4140', `${w} → 4140 QT`);
      A.includes((await readsAs(w, 'grade')).toLowerCase(), '8.8', `${w} is kept as the class it is`);
    }
    A.eq(await readsAs('GRADE 10.9', 'material'), '4340', 'Grade 10.9 → 4340 QT');
    A.includes(await readsAs('GRADE 10.9', 'grade'), '10.9', 'and is kept as a class');
    A.eq(await readsAs('CLASS 5.8', 'material'), '',
      'Class 5.8 has no company material, so it stays unanswered');

    // ── a steel that IS named is used ────────────────────────────────────
    /* The stored value is the code; "4140 QT" is what the screen prints for it. */
    A.eq(await readsAs('4140 QT', 'material'), '4140', 'a steel the document names is the material');
    A.eq(await readsAs('MS', 'material'), 'MS', 'and so is mild steel');
    A.eq(await readsAs('SS304', 'grade'), '', 'a material is not also reported as a class');
    A.eq(await readsAs('HT', 'material'), '',
      'and a bare HT still names neither of the two high-tensile materials');

    // ── finishes are finishes ────────────────────────────────────────────
    for (const w of ['HDG', 'HOT DIP GALVANISED', 'ZP', 'PLAIN']) {
      const r = (await apply(page, doc({
        items: [item({ M: 'M16', L: 300, qty: 10, product: 'STUD', finish: w })],
      })))[0];
      A.eq(r.material, '', `${w} is not a material`);
      A.ok(r.finish !== '', `${w} is a finish (${r.finish})`);
    }

    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ══ what a document does NOT say is still not filled in ══════════════════
  {
    const page = await openApp(browser);
    const rows = await apply(page, doc({
      items: [
        item({ M: 'M16', L: 300, qty: 10, product: 'STUD', material: 'GRADE 8.8' }),
        item({ M: 'M16', L: 350, qty: 10, product: 'STUD' }),
      ],
    }));
    A.eq(rows[0].material, '4140', 'a row specified by Grade 8.8 is 4140 QT');
    A.ok(!rows[0].missing.includes('Material'), 'and is not asked for a material');
    A.eq(rows[1].material, '4140', 'the row below it inherits the same answer');
    A.includes(rows[1].matFrom.toLowerCase(), '8.8', 'along with where it came from');

    await page.close();
  }

  // ══ a document and a message reach the same answer ═══════════════════════
  {
    /* One mapping, not two. A grade a customer types and a grade printed on a
       drawing are the same specification and get the same material. */
    const page = await openApp(browser);
    await quickAddPaste(page, '4140 QT STUD PL\nM16 x 300 - 10pcs', { settle: 700 });
    A.eq((await rowState(page))[0].material, '4140', 'a typed 4140 QT is still 4140 QT');
    await quickAddPaste(page, 'G8.8 STUD PL\nM16 x 300 - 10pcs', { settle: 700 });
    const g = (await rowState(page))[0];
    A.eq(g.material, '4140', 'and a typed G8.8 still follows the company rule it always has');
    await page.close();
  }

  return S;
};
