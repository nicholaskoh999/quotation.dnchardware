/* ── A quantity is a count, and a count has to survive being written down ───
   Three separate ways a real message loses its quantity, all found in the same
   afternoon on the same live example:

     4140 sag rod, both thread 65mm, plain
     M24 x 300mm x tl 65/65
     qty - 15,000 pcs

   1 · The spec line states the thread in words. It carries no size and no
       count, so it is a header — but the material grade "4140" is a number
       standing on it, and the header reader counted it. Two numbers meant "not
       a thread line", so the header became an ITEM: a phantom rod 65mm long,
       beside the real one.

   2 · "15,000" is fifteen thousand. Every quantity reader in the parser asked
       for `\d+`, so it matched "15" and stopped. The order went out at 15
       pieces. The same comma in a DIMENSION was worse and quieter: "M24 x
       1,000" was read as a 1mm rod with a quantity of 0.

   3 · A quantity written on a line of its own has to reach the item above it.
       It did for "qty 15000" and stopped doing so the moment a comma or a
       "pcs" was written beside it.

   And the rule that decides what happens when there is no count at all: an
   ABSENT quantity is one piece, because that is what a customer who writes
   "M12 x 500" and nothing else is asking for. Quantity wording whose value
   cannot be read is NOT absent — the customer meant to state a number — so
   that row asks instead of quietly becoming one piece.                      */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* The live message, exactly as it was sent. */
const LIVE = '4140 sag rod, both thread 65mm, plain\nM24 x 300mm x tl 65/65\nqty - 15,000 pcs';

const parse = (page, text) => page.evaluate(t => {
  const p = wqaParseText(t);
  return p.rows.map(r => ({
    product: r.product, size: r.size, length: r.length, qty: r.qty,
    tl: (r.threadLen || '') + (r.threadLen2 ? '/' + r.threadLen2 : ''),
    material: r.material, finish: r.finish,
    confQty: (r.conf && r.conf.qty) || '', unreadable: !!r.qtyUnreadable,
  }));
}, text);

module.exports = async (browser, A) => {
  const S = A.suite('quantity — fifteen thousand, one, and the ones we must not guess');

  const page = await openApp(browser);
  await page.evaluate(() => { selectedCompanyId = 7; });

  // ══ 1 · THE LIVE MESSAGE ═══════════════════════════════════════════════
  {
    const rows = await parse(page, LIVE);
    A.eq(rows.length, 1, 'the live message is ONE item, not two');
    const r = rows[0] || {};
    A.eq(r.product, 'sagrod', 'Product   Sag Rod');
    A.eq(r.material, '4140', 'Material  4140 QT');
    A.eq(r.finish, 'PL', 'Finish    PL');
    A.eq(r.size, 'M24', 'Size      M24');
    A.eq(r.length, '300', 'Length    300');
    A.eq(r.tl, '65/65', 'TL        65/65');
    A.eq(r.qty, '15000', 'Qty       15000 — fifteen thousand, not fifteen');
  }

  // ══ 2 · THE SPEC HEADER IS NOT AN ITEM ═════════════════════════════════
  /* The grade on the header is a material, and it was already read as one. It
     must not also be counted as a stray number, whichever grade it is. */
  {
    for (const [head, mat] of [
      ['4140 sag rod, both thread 65mm, plain', '4140'],
      ['4340 sag rod, both thread 65mm, plain', '4340'],
      ['grade 8.8 sag rod, both thread 65mm, plain', '4140'],
      ['grade 10.9 sag rod, both thread 65mm, plain', '4340'],
      ['ss304 sag rod, both thread 50mm', 'SS304'],
      ['ss316 sag rod, both thread 50mm', 'SS316'],
    ]) {
      const rows = await parse(page, `${head}\nM24 x 300mm x tl 65/65\nqty 20`);
      A.eq(rows.length, 1, `"${head}" is a header, not a rod`);
      A.eq((rows[0] || {}).material, mat, `and its grade is the material (${mat})`);
    }
    /* The guard that made this reader strict in the first place still holds: a
       line that states its own thread AND its own dimensions is an item. */
    const item = await parse(page, 'sag rod\nM10 X 40mm X 2end 20/12mm Thread');
    A.eq(item.length, 1, 'a full dimension line stays an item');
    A.eq((item[0] || {}).length, '40', 'with its length intact');
    A.eq((item[0] || {}).tl, '20/12', 'and its thread pair');
  }

  // ══ 3 · THOUSANDS SEPARATORS ═══════════════════════════════════════════
  {
    /* The forms the brief names, each attaching to the item above it. */
    for (const line of ['qty 15000', 'qty - 15000', 'qty: 15000', 'qty = 15000',
                        'qty 15,000 pcs', 'qty - 15,000 pcs', '15,000 pcs', '15000 pcs']) {
      const rows = await parse(page, `sag rod\nM24 x 300 x tl 65/65\n${line}`);
      A.eq(rows.length, 1, `"${line}" attaches to the item above it`);
      A.eq((rows[0] || {}).qty, '15000', `"${line}" is fifteen thousand`);
    }
    /* A comma inside a DIMENSION is a thousands separator too. This is the
       quiet one: the rod went out at 1mm. */
    const len = await parse(page, 'sag rod\nM24 x 1,000 x tl 65/65\nqty 20');
    A.eq(len.length, 1, 'a comma in a length does not split the row');
    A.eq((len[0] || {}).length, '1000', 'M24 x 1,000 is a metre-long rod');
    A.eq((len[0] || {}).qty, '20', 'and the quantity is the one that was stated');

    const both = await parse(page, 'sag rod\nM24 x 1,000 x tl 65/65 qty 2,500');
    A.eq((both[0] || {}).length, '1000', 'length and quantity, both with separators: the length');
    A.eq((both[0] || {}).qty, '2500', 'and the quantity');

    /* A line that is NOTHING BUT comma-separated numbers is the one place the
       comma really does separate values, and it is left alone. */
    const list = await parse(page, 'sag rod\nM24 x tl 65/65\n100,200,300');
    A.ok(!list.some(r => String(r.length) === '100200300'),
      'a bare comma-separated list of numbers is not fused into one number');
  }

  // ══ 4 · A BARE NUMBER IS NOT A QUANTITY ════════════════════════════════
  {
    const rows = await parse(page, 'sag rod\nM24 x 300 x tl 65/65\n15000');
    A.eq(rows.length, 1, 'a standalone bare number adds no row');
    A.ok((rows[0] || {}).qty !== '15000', 'and is not taken as the quantity of the row above');
  }

  // ══ 5 · ABSENT QUANTITY IS ONE PIECE ═══════════════════════════════════
  {
    const one = await parse(page, 'sag rod\nM12 x 500');
    A.eq(one.length, 1, 'a message with no count at all still has its item');
    A.eq((one[0] || {}).qty, '1', 'and the item is one piece');
    A.eq((one[0] || {}).confQty, 'defaulted', 'shown as a default, not as something read');

    const three = await parse(page, 'sag rod\nM12 x 500\nM16 x 800\nM20 x 1000');
    A.eq(three.length, 3, 'three independent items');
    A.eq(three.map(r => r.qty).join(','), '1,1,1', 'each gets one piece of its own');
    A.eq(three.map(r => r.length).join(','), '500,800,1000', 'and keeps its own length');

    /* An explicit quantity always wins over the default. */
    const mixed = await parse(page, 'sag rod\nM12 x 500 - 40pcs\nM16 x 800');
    A.eq(mixed.map(r => r.qty).join(','), '40,1', 'a stated quantity is never replaced by the default');
  }

  // ══ 6 · WORDING WITH NO READABLE VALUE IS NOT ABSENT ═══════════════════
  {
    for (const line of ['qty ?', 'qty tbc', 'qty:', 'quantity to be advised']) {
      const rows = await parse(page, `sag rod\nM24 x 300 x tl 65/65\n${line}`);
      const r = rows[0] || {};
      A.eq(r.qty, '', `"${line}": the quantity is not guessed at`);
      A.ok(r.unreadable, `"${line}": and the row is marked as needing one`);
    }
    /* Zero and a negative are STATED values, and neither is one piece. */
    const zero = await parse(page, 'sag rod\nM24 x 300 x tl 65/65\nqty 0');
    A.eq((zero[0] || {}).qty, '0', 'a stated zero stays zero — it is not absent');
  }

  // ══ 7 · IT REACHES THE SCREEN, AND THE QUOTATION ═══════════════════════
  {
    await quickAddPaste(page, LIVE, { expanded: false, settle: 900 });
    const rs = await rowState(page);
    A.eq(rs.filter(r => !r.removed).length, 1, 'the review screen shows one row for the live message');
    A.eq(rs[0].qty, '15000', 'and it is holding fifteen thousand');
    A.eq(rs[0].size, 'M24', 'M24');
    A.eq(rs[0].length, '300', '300 long');
    A.eq(rs[0].thread, '65/65', 'threaded 65/65');

    /* The number the screen shows is the number in the box. Compact is a
       summary and holds no inputs, so this is the expanded card. */
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(400);
    const shown = await page.evaluate(() => {
      const card = document.querySelector('[data-wqa-row="0"]');
      const box = card && card.querySelector('input[oninput*="\'qty\'"]');
      return box ? box.value : null;
    });
    A.eq(shown, '15000', 'the quantity box on the card reads 15000');
  }

  // ══ 8 · A DEFAULTED ONE IS ADDABLE; AN UNREADABLE ONE IS NOT ═══════════
  {
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 500 x 50/50', { expanded: false, settle: 900 });
    const before = await page.evaluate(() => wqa.rows.map(r => r.qty));
    A.eq(before.join(','), '1', 'a row with no stated count carries one piece into review');
    const missing = await page.evaluate(() => wqaRowMissing(wqa.rows[0]));
    A.ok(!missing.includes('Qty'), 'and is not asked for a quantity it already has');

    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 500 x 50/50\nqty tbc',
      { expanded: false, settle: 900 });
    const un = await page.evaluate(() => ({
      qty: wqa.rows[0].qty, miss: wqaRowMissing(wqa.rows[0]),
    }));
    A.eq(un.qty, '', 'an unreadable count is left blank');
    A.ok(un.miss.includes('Qty'), 'and the row asks for it by name');
  }

  // ══ 9 · EVERY SOURCE, NOT JUST A PASTED MESSAGE ════════════════════════
  /* A photograph, a PDF and a drawing all come back through the SAME
     normaliser a pasted message does, so the rule is proved there once rather
     than trusted three times. These are extraction rows in the shape
     ai_extract.php returns. */
  {
    const aiItem = (M, L, TL, qty, extra = {}) => Object.assign({
      M, L, W: null, TL, qty, Bmid: null, material: null, finish: null, sizeType: null,
      unclear: null, product: null, threadEnds: null, bodyDia: null,
      H: null, ID: null, S: null, R: null,
    }, extra);

    const norm = await page.evaluate(items => {
      const n = wqaNormalizeExtraction(
        { product: 'SAG_ROD', threadEnds: 2, items },
        { wording: 'MS SAG ROD PL FULLSIZE' });
      return n.rows.map(r => ({ qty: r.qty, conf: (r.conf && r.conf.qty) || '',
                                unreadable: !!r.qtyUnreadable }));
    }, [
      aiItem('M20', 300, '150/150', 4),                                 // stated
      aiItem('M24', 400, '150/150', null),                              // absent
      aiItem('M16', 250, '100/100', null, { unclear: 'qty unreadable' }), // wording, no value
      aiItem('M12', 200, '75/75',  null, { unclear: 'size M20 or M30' }), // unclear elsewhere
    ]);

    A.eq(norm[0].qty, '4', 'an extracted quantity is used as extracted');
    A.eq(norm[0].conf, 'detected', 'and reported as read');
    A.eq(norm[1].qty, '1', 'an extraction with no count at all is one piece');
    A.eq(norm[1].conf, 'defaulted', 'and reported as a default');
    A.eq(norm[2].qty, '', 'an extraction that could not read the count does NOT become one piece');
    A.ok(norm[2].unreadable, 'and is marked as needing one');
    A.eq(norm[3].qty, '1', 'a row unclear about its SIZE still has an absent count, so one piece');
    A.ok(!norm[3].unreadable, 'and is not asked for a quantity it never mentioned');
  }

  await page.close();
  return S;
};
