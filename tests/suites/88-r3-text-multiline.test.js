/* ── R3 FAST SOS — a multi-line pasted enquiry is every one of its rows ──────
   The Owner pasted an L Bolt enquiry: one shared heading ("4140 full size L
   bolt pl") and size lines under it written "42 x 964 x 210w x 214t" — size,
   L, W and thread, the size without its M. Quick Add returned ONE item reading
   "Size ? x L42 x W210", quantity 1.

   Root cause (deterministic parser, no AI involved): the bare 42 was never read
   as the size, so the line had no size; the NEXT line, also size-less, was then
   folded into the row above as a "continuation", which kept only empty slots
   and dropped everything else. The 964, the 214t and the whole second row
   vanished with nothing on screen to say so.

   The two size lines below are the ones quoted in the Owner's report; the
   remaining rows of the 9-line message were not available as text, so the
   longer lists here are synthetic and say so. Every assertion runs the shipped
   wqaParseText / Quick Add Review path.                                      */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');

const HEAD = '4140 full size L bolt pl';
const OWNER = [HEAD, '42 x 964 x 210w x 214t', '39 x 1683 x 195w x 183t'];

module.exports = async (browser, A) => {
  A.suite('R3 SOS — multi-line pasted L Bolt enquiry extracts every row');
  const page = await openApp(browser);

  const parse = text => page.evaluate(t => {
    const p = wqaParseText(t);
    return {
      ok: wqaParseQuality(p, t).ok, omitted: p.omitted,
      rows: p.rows.map(r => ({ product: r.product, size: r.size, L: r.length, W: r.w, TL: r.threadLen,
        qty: r.qty, qtyDefaulted: !!(r.conf && r.conf.qty === WQA_CONF.DEFAULTED),
        material: r.material, finish: r.finish, sizeType: r.sizeType, raw: r.raw })),
    };
  }, text);
  const dims = r => [r.size, r.L, r.W, r.TL].join(' / ');

  /* A, B, C — the Owner's own lines. */
  {
    const p = await parse(OWNER.join('\n'));
    A.eq(p.rows.length, 2, 'A: heading + 2 size lines -> 2 items (was 1)');
    A.eq(dims(p.rows[0]), 'M42 / 964 / 210 / 214', 'B: 42 x 964 x 210w x 214t -> M42 L964 W210 TL214');
    A.eq(dims(p.rows[1]), 'M39 / 1683 / 195 / 183', 'B: 39 x 1683 x 195w x 183t -> M39 L1683 W195 TL183');
    p.rows.forEach((r, k) => {
      A.eq([r.product, r.material, r.finish, r.sizeType].join('|'), 'lbolt|4140|PL|FULLSIZE',
        'B: row ' + (k + 1) + ' inherits L Bolt / 4140 / PL / Fullsize from the heading');
    });
    A.ok(!p.rows.some(r => /full size L bolt/i.test(r.raw || '')), 'C: the heading is not counted as an item');
    A.ok(p.ok, 'parser handles it on its own (no AI call)');
    A.eq(p.omitted.length, 0, 'D: no specification line left unaccounted');
  }

  /* D — a longer list (synthetic rows, same notation): one item per line. */
  {
    const rows = ['42 x 964 x 210w x 214t', '39 x 1683 x 195w x 183t', '36 x 1200 x 180w x 150t',
                  '30 x 900 x 150w x 120t', '27 x 800 x 140w x 100t', '24 x 750 x 120w x 100t'];
    const p = await parse([HEAD].concat(rows).join('\n'));
    A.eq(p.rows.length, rows.length, 'D: 6 size lines -> 6 items, none merged');
    A.eq(p.rows.map(r => r.size).join(','), 'M42,M39,M36,M30,M27,M24', 'D: each row keeps its own size');
    A.eq(p.omitted.length, 0, 'D: completeness check is quiet when every line became a row');
  }

  /* E — the same size written twice is two rows. */
  {
    const p = await parse([HEAD, '42 x 964 x 210w x 214t', '42 x 964 x 210w x 214t'].join('\n'));
    A.eq(p.rows.length, 2, 'E: repeated identical lines stay two separate rows');
  }

  /* F — a later heading changes the spec for the rows below it only. */
  {
    const p = await parse([HEAD, '42 x 964 x 210w x 214t', '', 'MS L bolt hdg undersize', '24 x 600 x 100w x 80t'].join('\n'));
    A.eq(p.rows.length, 2, 'F: two groups -> two rows');
    A.eq([p.rows[0].material, p.rows[0].finish, p.rows[0].sizeType].join('|'), '4140|PL|FULLSIZE', 'F: first group keeps its heading');
    A.eq([p.rows[1].material, p.rows[1].finish, p.rows[1].sizeType].join('|'), 'MS|HDG|UNDERSIZE', 'F: second heading applies to the rows below it');
    A.eq(dims(p.rows[1]), 'M24 / 600 / 100 / 80', 'F: second group row read correctly');
  }

  /* G — no quantity written: the established absent-quantity default (1,
     marked as defaulted), never a stated count. A stated count is kept. */
  {
    const p = await parse(OWNER.join('\n'));
    A.ok(p.rows.every(r => r.qty === '1' && r.qtyDefaulted), 'G: absent qty follows existing rule (1, flagged DEFAULTED)');
    const q = await parse([HEAD, '42 x 964 x 210w x 214t - 12pcs'].join('\n'));
    A.eq(q.rows[0].qty, '12', 'G: a stated quantity is read');
    A.ok(!q.rows[0].qtyDefaulted, 'G: a stated quantity is not marked defaulted');
  }

  /* H — nothing invented: a missing thread stays missing; a two-number line
     whose first number cannot be told apart is not given a size. */
  {
    const p = await parse([HEAD, '42 x 964 x 210w'].join('\n'));
    A.eq(dims(p.rows[0]), 'M42 / 964 / 210 / ', 'H: no TL written -> no TL invented');
    const q = await parse([HEAD, '42 x 964'].join('\n'));
    A.ok(!q.rows[0] || !q.rows[0].size, 'H: "42 x 964" (only one number after) is not promoted to M42');
    const r = await parse([HEAD, '300 x 964 x 210'].join('\n'));
    A.ok(!r.rows[0] || r.rows[0].size !== 'M300', 'H: a non-nominal head number is never a size');
  }

  /* J — a single-row enquiry and the existing M-prefixed formats. */
  {
    const p = await parse([HEAD, 'M42 x 964 x 210w x 214t'].join('\n'));
    A.eq(p.rows.length, 1, 'J: single row still one item');
    A.eq(dims(p.rows[0]), 'M42 / 964 / 210 / 214', 'J: M-prefixed single row unchanged');
    const k = await parse(['4140 QT L BOLT PL FULLSIZE', 'M20 x 950 x 400 x 150 - 90pcs', 'M24 x 1100 x 450 x 150 - 30pcs'].join('\n'));
    A.eq(k.rows.map(dims).join(' ; '), 'M20 / 950 / 400 / 150 ; M24 / 1100 / 450 / 150', 'K: existing compact L Bolt shorthand unchanged');
    const sr = await parse(['MS SAG ROD PL FULLSIZE', 'M16 x 300 x 50/50 - 35pcs', 'M20 x 1000 x 100/100 - 250pcs'].join('\n'));
    A.eq(sr.rows.length, 2, 'K: Sag Rod WhatsApp list unchanged');
    A.eq(sr.omitted.length, 0, 'K: no false omission warning on a normal list');
    /* A genuine labelled continuation (J Bolt second line) is still folded in. */
    const jb = await parse(['4140 J BOLT PL FULLSIZE', 'M20 x H 400', 'ID 70 x S 80 x TL 100 - 28pcs'].join('\n'));
    A.eq(jb.rows.length, 1, 'K: a labelled continuation line is still part of the row above');
    A.eq(jb.omitted.length, 0, 'K: a continuation line is not reported missing');
  }

  /* I — line-vs-row check for rows that did not come from the parser (AI text
     fallback): an unmatched specification line is named. */
  {
    const miss = await page.evaluate(t => wqaTextCoverage(t, [{ M: 'M42', L: 964, W: 210 }]), OWNER.join('\n'));
    A.eq(miss.join('|'), '39 x 1683 x 195w x 183t', 'I: AI rows short by one -> the unmatched line is named');
    const none = await page.evaluate(t => wqaTextCoverage(t, [{ M: 'M42', L: 964 }, { M: 'M39', L: 1683 }]), OWNER.join('\n'));
    A.eq(none.length, 0, 'I: full AI coverage -> nothing named; heading never counted');
    const dup = await page.evaluate(t => wqaTextCoverage(t, [{ M: 'M42', L: 964 }]),
      [HEAD, '42 x 964 x 210w x 214t', '42 x 964 x 210w x 214t'].join('\n'));
    A.eq(dup.length, 1, 'I: one row cannot account for two repeated lines');
  }

  /* I, M, N — the Review banner: shown, named, bilingual, and Add waits. */
  {
    await page.evaluate(() => {
      window.__realParse = window.__realParse || wqaParseText;
      /* Simulate a parse that lost a line, to drive the real Review path. */
      wqaParseText = function (t, fp) { const p = window.__realParse(t, fp); if (!fp) p.omitted = ['39 x 1683 x 195w x 183t']; return p; };
    });
    await quickAddPaste(page, OWNER.join('\n'));
    const st = await page.evaluate(() => ({
      hidden: el('wqaPartial').hidden, text: el('wqaPartial').textContent,
      needAck: wqaNeedsSourceAck(), add: el('wqaAddBtn').disabled, kind: wqa.covKind,
    }));
    A.ok(!st.hidden, 'I: partial-extraction banner shown for pasted text');
    A.includes(st.text, '39 x 1683 x 195w x 183t', 'I: the omitted line is named in the customer\'s words');
    A.includes(st.text, 'pasted message', 'M: EN wording is the text wording, not the drawing wording');
    A.ok(st.needAck && st.add, 'N: Add is held until the Owner confirms');
    await page.evaluate(() => { dcSetLang('zh'); wqaUpdateAddButton(); });
    const zh = await page.evaluate(() => el('wqaPartial').textContent);
    A.includes(zh, '粘贴的信息', 'M: 中文 wording shown after switching language');
    await page.evaluate(() => { dcSetLang('en'); wqaAckPartial(true); });
    A.ok(!(await page.evaluate(() => wqaNeedsSourceAck())), 'N: the explicit tick releases the hold');
    await page.evaluate(() => { wqaParseText = window.__realParse; });
    /* And the real parse of the same message raises no banner. */
    await quickAddPaste(page, OWNER.join('\n'));
    const clean = await page.evaluate(() => ({ hidden: el('wqaPartial').hidden, n: wqa.rows.length }));
    A.ok(clean.hidden && clean.n === 2, 'Review: real parse -> 2 rows, no banner');
  }

  /* N — an incomplete row is still blocked by the existing rules. */
  {
    await quickAddPaste(page, [HEAD, '42 x 964'].join('\n'));
    const b = await page.evaluate(() => wqa.rows.filter(r => !r.removed).some(wqaRowBlocked));
    A.ok(b, 'N: a row without a size is still blocked from Add');
  }

  /* O — parser core 1.2.0: a shared heading ("M12 x TL70/70" over a list of
     lengths) is context, so the real Review path raises no banner and Add is
     not held. A heading no row inherits from is still named. Synthetic. */
  {
    const list = ['M/S SAG ROD UNDERSIZE (HDG)', 'M12 X TL70/70', '910 - 12pcs', '1180 - 30pcs', '1475 - 6 pcs'].join('\n');
    await quickAddPaste(page, list);
    const st = await page.evaluate(() => ({ hidden: el('wqaPartial').hidden, needAck: wqaNeedsSourceAck(),
      rows: wqa.rows.filter(r => !r.removed).map(r => [r.size, r.threadLen, r.length].join('/')) }));
    A.eq(st.rows.join(' ; '), 'M12/70/910 ; M12/70/1180 ; M12/70/1475', 'O: every row inherits the heading size and thread');
    A.ok(st.hidden && !st.needAck, 'O: shared heading -> no partial banner, Add not held');
    const orphan = await parse(['SAG ROD (ZP)', 'M12 X TL70/70', '', 'SAG ROD (HDG)', 'M16 x TL100/100', '1300 - 6pcs'].join('\n'));
    A.eq(orphan.omitted.join('|'), 'M12 X TL70/70', 'O: a heading no row inherits from is still named');
  }

  await page.close();
};
