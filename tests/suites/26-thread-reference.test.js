/* ── A thread reference describes the thread, not the bar ───────────────────
   "M12 x 1.75P" is an M12. A 1/2" UNC and a 1/2" BSW are cut from the same
   12.7mm rod, weigh the same and cost the same. So a pitch and a thread series
   are carried beside the item as a note and read by nothing that computes —
   and the one thing that must never happen is either of them reaching the size
   box, because "M12 x 1.75P" is not a size the diameter table knows, so the row
   would have no diameter, no weight and no price.

   Every assertion here is one of two kinds: the note was read correctly, or
   something that must not have moved did not move.                          */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const RHO = 0.0000061654;
const HALF_UNDER = 10.9;                 // an undersized 1/2" rod, in mm

/* The empty box's own suggestion, read off the row that is actually on screen. */
const hintOf = (page, i) => page.evaluate(k => {
  const card = document.querySelector('[data-wqa-row="' + k + '"]');
  const box = card && card.querySelector('.wqa-tref-in');
  return box ? box.placeholder : null;
}, i);

module.exports = async (browser, A) => {
  const S = A.suite('thread reference — a note about the thread');

  // ══ THE SUGGESTION IN THE EMPTY BOX ══════════════════════════════════════
  /* A metric rod has a pitch. Only 1/2" carries the approved UNC/BSW
     distinction. Everything else has no suggestion to make, and says so —
     rather than offering an M12 a choice between two imperial thread series,
     which is what one fixed hint string on every row did. */
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });

    for (const [size, want, why] of [
      ['M12',   'e.g. 1.75P',         'a metric size is offered a pitch'],
      ['M24',   'e.g. 1.75P',         'and so is a bigger one'],
      ['1/2',   'UNC / BSW',          'the one imperial size with an approved series'],
      ['3/8',   'Optional reference', 'another imperial size is offered neither'],
      ['5/8',   'Optional reference', 'nor is this one'],
      ['3/4',   'Optional reference', 'nor this one'],
      ['1-1/4', 'Optional reference', 'nor this one'],
    ]) {
      await quickAddPaste(page, `MS SAG ROD PL FULLSIZE\n${size} x 300 x 70/70 - 4pcs`,
        { settle: 900 });
      A.eq(await hintOf(page, 0), want, `${why} (${size})`);
    }

    /* Never UNC or BSW on a metric row — the specific thing the brief forbids. */
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 300 x 70/70 - 4pcs', { settle: 900 });
    const metric = await hintOf(page, 0);
    A.excludes(metric, 'UNC', 'an M12 is never offered UNC');
    A.excludes(metric, 'BSW', 'and never offered BSW');

    /* And it follows the size when the size is corrected on the screen. */
    /* Correcting a size on the screen is done in the inline edit grid now,
       which is how a person does it: press Edit, type in the SIZE cell. */
    await page.evaluate(() => wqaEditStart(0, 'size'));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const card = document.querySelector('[data-wqa-row="0"]');
      const box = card.querySelector('[data-ef="size"]');
      box.value = '1/2';
      wqaEditSize(0, box, true);
    });
    await page.waitForTimeout(500);
    /* Thread Reference lives in Expanded's REFERENCE section — it is a note
       about the thread, not one of the numbers the weight is made of — so the
       edit is finished and the row reopened to read what it now suggests. */
    await page.evaluate(() => { wqaEditDone(); wqaSetView('expanded'); });
    await page.waitForTimeout(500);
    A.eq(await hintOf(page, 0), 'UNC / BSW',
      'retyping the size to 1/2" changes what the box suggests');

    /* 中文 keeps the codes and translates the words around them. */
    await page.evaluate(() => dcSetLang('zh'));
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 300 x 70/70 - 4pcs', { settle: 900 });
    const zhMetric = await hintOf(page, 0);
    A.includes(zhMetric, '1.75P', '中文: the pitch example is a code and stays');
    A.excludes(zhMetric, 'e.g.', '中文: and the wording around it is translated');
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\n1/2 x 300 x 70/70 - 4pcs', { settle: 900 });
    A.eq(await hintOf(page, 0), 'UNC / BSW', '中文: UNC and BSW are codes, not words to translate');
    await page.evaluate(() => dcSetLang('en'));

    await page.close();
  }

  // ══ METRIC PITCH ═════════════════════════════════════════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });

    /* 1-3 · the marked forms, and 2 · the unmarked one. */
    for (const [line, note] of [
      ['M12 x 1.75P x 853 x 70/70 - 4pcs',      'written 1.75P'],
      ['M12 x 1.75 P x 853 x 70/70 - 4pcs',     'written 1.75 P'],
      ['M12 x 1.75 pitch x 853 x 70/70 - 4pcs', 'written 1.75 pitch'],
      ['M12 x 1.75 PITCH x 853 x 70/70 - 4pcs', 'written 1.75 PITCH'],
      ['M12 x 1.75 x 853 x 70/70 - 4pcs',       'written with no marker at all'],
    ]) {
      await quickAddPaste(page, `MS SAG ROD ZP UNDERSIZE\n${line}`, { expanded: false, settle: 900 });
      const r = (await rowState(page))[0];
      const tr = await page.evaluate(() => wqa.rows[0].threadRef);
      A.eq(r.size, 'M12', `${note}: the size is M12, not "M12 x 1.75"`);
      A.eq(tr, '1.75P', `${note}: and the pitch is the note beside it`);
      A.eq(r.length, '853', `${note}: the length is the length`);
      A.eq(r.thread, '70/70', `${note}: and the thread pair is untouched`);
      A.eq(r.qty, '4', `${note}: and the quantity`);
    }

    /* 4 · a dimension is never swallowed. */
    for (const [line, len, note] of [
      ['M12 x 300 x 70/70 - 4pcs',       '300',  'a whole number after the size is a length'],
      ['M12 x 300 x 50 - 4pcs',          '300',  'and stays one beside a single thread'],
      ['M12 x 30.5 x 70/70 - 4pcs',      '30.5', 'a decimal too large to be a pitch is a length'],
    ]) {
      await quickAddPaste(page, `MS SAG ROD ZP UNDERSIZE\n${line}`, { expanded: false, settle: 900 });
      const r = (await rowState(page))[0];
      const tr = await page.evaluate(() => wqa.rows[0].threadRef);
      A.eq(r.length, len, `${note} (${line})`);
      A.eq(tr, '', 'and no pitch is invented');
    }

    /* 5 · both, on one line, each read as itself. */
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 1.75 x 300 x 70/70 - 4pcs',
      { expanded: false, settle: 900 });
    const both = (await rowState(page))[0];
    A.eq(both.size, 'M12', 'pitch and dimension together: the size is M12');
    A.eq(await page.evaluate(() => wqa.rows[0].threadRef), '1.75P', 'the pitch is kept');
    A.eq(both.length, '300', 'and the 300 is kept as the length it is');

    /* 6 · the weight is the bar's, and the bar has not changed. */
    A.near(Number(both.weight), 10.6 * 10.6 * 300 * RHO, 1e-6,
      `an undersized M12 at 300 weighs what it always did (${both.weight})`);
    await page.close();
  }

  // ══ the pitch changes NOTHING — same row, with and without ═══════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    const read = async line => {
      await quickAddPaste(page, `MS SAG ROD ZP UNDERSIZE\n${line}`, { expanded: false, settle: 900 });
      const r = (await rowState(page))[0];
      const spec = await page.evaluate(() => wqaHistSpec(wqa.rows[0]));
      const dia = await page.evaluate(() => fn('sagrod', 'diameter'));
      return { w: r.weight, p: r.price, rate: r.costRate, spec, dia };
    };
    const plain = await read('M12 x 853 x 70/70 - 4pcs');
    const with17 = await read('M12 x 1.75P x 853 x 70/70 - 4pcs');

    // 6 · weight
    A.eq(String(with17.w), String(plain.w), `the pitch does not change the weight (${plain.w})`);
    // 12 · price
    A.eq(String(with17.p), String(plain.p), `nor the price (${plain.p})`);
    A.eq(String(with17.rate), String(plain.rate), 'nor the cost rate the row is priced on');
    // 7 · previous-price identity
    A.eq(JSON.stringify(with17.spec), JSON.stringify(plain.spec),
      'nor one field of the identity a previous price is looked up by');
    A.eq(with17.spec.cleanSize, 'M12', 'which asks for M12, not for M12 x 1.75P');
    await page.close();
  }

  // ══ IMPERIAL — UNC and BSW, on the one size that has them ════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    const read = async line => {
      await quickAddPaste(page, `MS SAG ROD ZP UNDERSIZE\n${line}`, { expanded: false, settle: 900 });
      const r = (await rowState(page))[0];
      const x = await page.evaluate(() => ({ tr: wqa.rows[0].threadRef,
                                             spec: wqaHistSpec(wqa.rows[0]) }));
      return { size: r.size, len: r.length, tl: r.thread, w: r.weight, p: r.price, ...x };
    };
    /* 9, 10 · with the mark and without it — the same rod either way. */
    const unc  = await read('1/2 UNC x 1020 x 100/100 - 20pcs');
    const unc2 = await read('1/2" UNC x 1020 x 100/100 - 20pcs');
    const bsw  = await read('1/2 BSW x 1020 x 100/100 - 20pcs');
    const bare = await read('1/2 x 1020 x 100/100 - 20pcs');

    A.eq(unc.size, '1/2', 'a half inch written 1/2 UNC is a half inch');
    A.eq(unc.tr, 'UNC', 'with UNC as the note');
    A.eq(unc2.size, '1/2', 'and with its mark it is the same half inch');
    A.eq(unc2.tr, 'UNC', 'with the same note');
    A.eq(bsw.size, '1/2', 'so is 1/2 BSW');
    A.eq(bsw.tr, 'BSW', 'with BSW as the note');
    A.eq(bare.tr, '', 'and a plain 1/2 carries no note at all');

    /* The dimensions are not eaten by the series word — this is exactly what
       used to happen: the 1/2 was read as the thread pair 1 and 2 and the size
       box came back empty. */
    A.eq(unc.len + '/' + unc.tl, '1020/100/100', 'the length and thread are read as written');

    /* 11, 12 · UNC and BSW weigh and cost the same, because they are one bar. */
    const expect = HALF_UNDER * HALF_UNDER * 1020 * RHO;
    A.near(Number(unc.w), expect, 1e-6, `UNC weighs the undersized half inch (${unc.w})`);
    A.eq(String(bsw.w), String(unc.w), 'and BSW weighs exactly the same');
    A.eq(String(bare.w), String(unc.w), 'and so does the rod with nothing said about its thread');
    A.eq(String(bsw.p), String(unc.p), `and the price is the same too (${unc.p})`);

    /* 13 · one size identity, not three. */
    A.eq(unc.spec.cleanSize, '1/2', 'the lookup asks for 1/2');
    A.eq(bsw.spec.cleanSize, '1/2', 'from a BSW row as well');
    A.eq(JSON.stringify(bsw.spec), JSON.stringify(unc.spec),
      'and every other identity field is identical, so they share one history');

    /* 14 · nothing is inferred for the sizes the business has not approved. */
    for (const sz of ['3/8', '5/8', '3/4', '7/8']) {
      const other = await read(`${sz} UNC x 1020 x 100/100 - 20pcs`);
      A.eq(other.size, sz, `${sz} UNC is still a ${sz} rod`);
      A.eq(other.tr, '', `and carries no UNC note — only 1/2" has an approved one`);
    }

    /* 15 · and a half inch is still not an M12. */
    const half = await read('1/2 UNC x 1020 x 100/100 - 20pcs');
    const m12  = await read('M12 x 1020 x 100/100 - 20pcs');
    A.eq(half.spec.cleanSize, '1/2', 'a half-inch row asks for 1/2');
    A.eq(m12.spec.cleanSize, 'M12', 'an M12 row asks for M12');
    A.ok(Number(half.w) !== Number(m12.w),
      `and they are different bars, so they weigh differently (${half.w} vs ${m12.w})`);
    await page.close();
  }

  // ══ typed, cleared, and never touching the size ══════════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs',
      { expanded: true, settle: 1000 });

    const field = await page.evaluate(() => {
      const n = document.querySelector('[data-wqa-row="0"] .wqa-tref-in');
      return { there: !!n, value: n ? n.value : null };
    });
    A.eq(String(field.there), 'true', 'the expanded row offers a Thread Reference box');
    A.eq(field.value, '', 'empty, because nothing was stated — it is optional');

    const before = (await rowState(page))[0];
    await page.evaluate(() => {
      const n = document.querySelector('[data-wqa-row="0"] .wqa-tref-in');
      n.value = '1.75'; n.dispatchEvent(new Event('input', { bubbles: true }));
      wqaEditThreadRef(0, n);
    });
    await page.waitForTimeout(900);
    const typed = (await rowState(page))[0];
    A.eq(await page.evaluate(() => wqa.rows[0].threadRef), '1.75P',
      'a typed 1.75 is spelled the one way the read ones are');
    A.eq(typed.size, before.size, 'the size did not move');
    A.eq(String(typed.weight), String(before.weight), 'nor the weight');
    A.eq(String(typed.price), String(before.price), 'nor the price');

    /* Cleared, without touching the size. */
    await page.evaluate(() => {
      const n = document.querySelector('[data-wqa-row="0"] .wqa-tref-in');
      n.value = ''; wqaEditThreadRef(0, n);
    });
    await page.waitForTimeout(700);
    const cleared = (await rowState(page))[0];
    A.eq(await page.evaluate(() => wqa.rows[0].threadRef), '', 'and it can be cleared');
    A.eq(cleared.size, before.size, 'with the size still there');
    A.eq(String(cleared.weight), String(before.weight), 'and the weight unchanged');
    await page.close();
  }

  // ══ 8 · it survives being added, saved and reopened ══════════════════════
  {
    let payload = null;
    const page = await openApp(browser, {
      api: { save_quotation: (url, req) => {
        try { payload = JSON.parse(req.postData() || '{}'); } catch (e) {}
        return { ok: true, data: { id: 88, ref_no: 'DC-TEST-001' } };
      } },
    });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 1.75P x 853 x 70/70 - 4pcs',
      { expanded: false, settle: 1000 });
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1400);

    const added = await page.evaluate(() => quoteItems.map(i => ({
      threadRef: i.threadRef, cleanSize: i.cleanSize, size: i.size, weight: i.weight })));
    A.eq(added.length, 1, 'the item reached the quotation');
    A.eq(added[0].threadRef, '1.75P', 'carrying its thread reference');
    A.eq(added[0].cleanSize, 'M12', 'and the size it is calculated from is still M12');
    A.excludes(String(added[0].size), '1.75', 'the printed size line carries no pitch');
    A.near(Number(added[0].weight), 10.6 * 10.6 * 853 * RHO, 1e-4,
      'and the saved weight is the bar\'s');

    await page.evaluate(async () => {
      el('qi-customer').value = 'Alpha Sdn Bhd'; syncQI();
      await api('save_quotation', {
        ref_no: el('qi-refno').value, quote_date: el('qi-date').value,
        customer_name: 'Alpha Sdn Bhd', customer_phone: '', prepared_by: '',
        remarks: '', company_id: null, items: quoteItems,
        total_amount: quoteItems.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0),
      }, 'POST');
    });
    await page.waitForTimeout(700);
    A.eq(payload.items[0].threadRef, '1.75P', 'it is in what goes to the server');
    await page.close();

    /* Reopened, edited, and pushed back — still there, still not a size. */
    const again = await openApp(browser, {
      handoff: { id: 88, ref_no: 'DC-TEST-001', quote_date: '2026-03-06',
                 customer_name: 'Alpha Sdn Bhd', items: payload.items },
    });
    await again.evaluate(() => { unlockSavedQuotation(); editItem(0); });
    await again.waitForTimeout(900);
    A.eq(await again.evaluate(() => dcReadItemThreadRef()), '1.75P',
      'reopening the item brings the reference back');
    A.eq(await again.evaluate(() => fv('sagrod', 'size')), 'M12',
      'and the size box holds M12, as it always did');
    await again.evaluate(() => addSagRod());
    await again.waitForTimeout(800);
    A.eq(await again.evaluate(() => quoteItems[0].threadRef), '1.75P',
      'and saving the edit keeps it');
    A.eq(await again.evaluate(() => quoteItems[0].cleanSize), 'M12',
      'with the calculation size untouched');

    /* An item saved before the field existed simply has none. */
    A.eq(await again.evaluate(() => {
      const old = JSON.parse(JSON.stringify(quoteItems[0]));
      delete old.threadRef;
      dcSetItemThreadRef(old.threadRef);
      return dcReadItemThreadRef();
    }), '', 'an older quotation without the field restores as empty, not as undefined');
    A.ok(again._dcErrors.length === 0, 'no page errors: ' + again._dcErrors.join(' | '));
    await again.close();
  }

  return S;
};
