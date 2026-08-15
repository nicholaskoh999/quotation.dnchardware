/* ── Mixed documents ───────────────────────────────────────────────────────
   Requirements 12, 31, 32, 33, 45, 46, 47.

   Everything the previous two commits fixed is re-run here, because the point
   of this pass is to add without breaking: a heading speaks for the rows under
   it and only for them, and one row's material, finish, size type, thread or
   bend never reaches an unrelated row.                                       */
'use strict';
const { openApp } = require('../lib/harness');

module.exports = async (browser, A) => {
  const S = A.suite('mixed documents — a heading speaks only for its own rows');
  const page = await openApp(browser);

  const parse = text => page.evaluate(t => wqaParseText(t).rows.map(r => ({
    size: r.size, product: r.product, material: r.material, finish: r.finish,
    sizeType: r.sizeType, length: r.length, w: r.w, h: r.h, id: r.id, s: r.s,
    radius: r.radius, thread: wqaThreadValue(r), qty: r.qty,
    conflict: r.productConflict ? r.productConflict.said + '/' + r.productConflict.saw : '',
    raw: r.raw,
  })), text);

  // ── a size type written against named sizes is scoped to them ────────────
  let rows = await parse(`MS ANCHOR BOLT HDG
M20 / M24 UNDER SIZE
M20 x 500 x 100 - 10pcs
M24 x 600 x 100 - 8pcs
M30 x 700 x 100 - 6pcs`);
  A.eq(rows.length, 3, 'three rows');
  A.eq(rows[0].sizeType, 'UNDERSIZE', 'M20 is undersize, as the note says');
  A.eq(rows[1].sizeType, 'UNDERSIZE', 'and M24');
  A.excludes(rows[2].sizeType, 'UNDERSIZE', 'but M30 is a size the note did not name — it is not undersized by it');

  // ── an unqualified note still heads its whole block ──────────────────────
  rows = await parse(`MS ANCHOR BOLT HDG UNDER SIZE
M20 x 500 x 100 - 10pcs
M30 x 700 x 100 - 6pcs`);
  A.eq(rows[0].sizeType, 'UNDERSIZE', 'an unqualified UNDER SIZE covers the first row');
  A.eq(rows[1].sizeType, 'UNDERSIZE', 'and the rest of its block');

  // ── a bend radius is not a hook height ───────────────────────────────────
  rows = await parse(`J BOLT MS HDG
M20 OVERALL LENGTH 480 ID 100 BEND HIGH 120 R25 BEND
THREAD 150
10 PCS`);
  A.eq(rows[0].product, 'jbolt', 'read as a J Bolt');
  A.eq(rows[0].radius, '25', 'R25 is kept as a bend radius, as evidence');
  A.eq(rows[0].s, '120', 'and the hook height is the 120 that was written as one');
  A.ok(rows[0].s !== '25', 'the radius did not become the hook height');

  // ── a Stud is not judged by a Sag Rod heading three sections earlier ─────
  rows = await parse(`1. SAG ROD MS PL
BOTH END THREAD 75
M12 x 1000 - 10pcs

2. STUD MS PL
M16 x 300 - 20pcs
M20 x 400 - 15pcs`);
  const studs = rows.filter(r => r.product === 'stud');
  A.ok(studs.length >= 2, 'the Stud section produced its rows');
  studs.forEach((r, i) => A.eq(r.conflict, '', `stud ${i + 1} is not flagged as contradicting itself`));
  A.eq(rows[0].product, 'sagrod', 'and the Sag Rod section is still a Sag Rod');

  // ── thread evidence outranks the heading's product word ──────────────────
  rows = await parse(`SAG ROD ONE END THREAD MS HDG
M20 x 500 x 100 - 10pcs
M24 x 600 x 100 - 8pcs`);
  A.eq(rows[0].product, 'anchorbolt', 'a one-end thread under a Sag Rod heading is an Anchor Bolt');
  A.eq(rows[1].product, 'anchorbolt', 'for every row under it');

  // ── every row carries its own material and finish ────────────────────────
  rows = await parse(`ANCHOR BOLT
GRADE 8.8 HDG
M20 x 500 x 100 - 10pcs
M24 x 600 x 100 - 8pcs
SS304
M30 x 700 x 100 - 6pcs`);
  A.eq(rows[0].finish, 'HDG', 'the galvanised rows are galvanised');
  A.eq(rows[2].material, 'SS304', 'the stainless row is stainless');
  A.eq(rows[2].finish, '', 'and stainless has no finish — HDG did not carry down to it');

  // ── one message, five products, each read as itself ──────────────────────
  rows = await parse(`ENQUIRY

1. SAG ROD MS PL
M12 x 1000 x 75/75 - 10pcs

2. STUD MS PL
M16 x 300 - 20pcs

3. ANCHOR BOLT MS HDG
M20 x 500 x 100 - 8pcs

4. L BOLT MS HDG
M20 x 500 x 100 x 100 - 6pcs

5. J BOLT MS HDG
M24 OVERALL LENGTH 600 ID 100 BEND HIGH 120 THREAD 150 - 4pcs`);
  const byProduct = rows.reduce((m, r) => { (m[r.product] = m[r.product] || []).push(r); return m; }, {});
  A.ok(byProduct.sagrod && byProduct.sagrod.length >= 1, 'the Sag Rod section produced a Sag Rod');
  A.ok(byProduct.stud && byProduct.stud.length >= 1, 'the Stud section a Stud');
  A.ok(byProduct.anchorbolt && byProduct.anchorbolt.length >= 1, 'the Anchor Bolt section an Anchor Bolt');
  A.ok(byProduct.lbolt && byProduct.lbolt.length >= 1, 'the L Bolt section an L Bolt');
  A.ok(byProduct.jbolt && byProduct.jbolt.length >= 1, 'the J Bolt section a J Bolt');
  A.eq(byProduct.sagrod[0].thread, '75/75', 'the Sag Rod kept its pair');
  A.eq(byProduct.stud[0].thread, '', 'the Stud has no thread and was not given one');
  A.eq(byProduct.lbolt[0].w, '100', 'the L Bolt kept its short leg');
  A.eq(byProduct.jbolt[0].id, '100', 'the J Bolt kept its inside diameter');
  A.eq(byProduct.sagrod[0].finish, 'PL', 'and each section kept its own finish');
  A.eq(byProduct.anchorbolt[0].finish, 'HDG', 'the galvanised ones galvanised');

  // ── metric and imperial in one message, per section ──────────────────────
  rows = await parse(`1. ANCHOR BOLT MS HDG
M20 x 300 x 100 - 5pcs
M24 x 400 x 120 - 4pcs

2. ANCHOR BOLT MS HDG
7/8 x 400 x 120 - 6pcs
1 x 500 x 150 - 3pcs`);
  A.eq(rows[0].size, 'M20', 'the metric section stays metric');
  A.eq(rows[2].size, '7/8', 'the imperial section stays imperial');
  A.eq(rows[3].size, '1"', 'including the whole inch');
  A.eq(rows[2].length, '400', 'with its own dimensions');
  A.eq(rows[3].length, '500', 'row by row');

  // ── the Quick Add product enum has not grown ─────────────────────────────
  const enumTypes = await page.evaluate(() => WQA_PRODUCTS.map(p => p.type).sort().join(','));
  A.eq(enumTypes, 'anchorbolt,jbolt,lbolt,sagrod,stud', 'Quick Add still reads exactly five products, and the same five');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
