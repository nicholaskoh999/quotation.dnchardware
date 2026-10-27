/* ── The row's pricing summary ─────────────────────────────────────────────
   A read-only line on every row: the three pricing inputs (`.wqa-it-px`, or a
   series heading's `.wqa-ser-px` when the rows under it share them), where a
   reused price came from (`.wqa-prov`, under the row), and the Size 规格 (the
   shared pill, or the row's badge when it was defaulted). It exists so an
   operator can see what a row is priced ON without opening it.

   Until the 2026-10-23 AI review redesign this was a two-column `.wqa-meta`
   area under the compact row; the reader below follows the values to where
   they now stand, and asserts the same things about them.

   The whole risk in a summary like this is that it becomes a SECOND source of
   truth — a display formula that agrees with the real one until the day it
   doesn't. So this suite's job is not to check the wording. It is to check
   that every figure on the line is the row's own live state:

     · what the summary says equals what the item panel's inputs hold;
     · typing into those inputs moves the summary immediately, while the caret
       is still in the box;
     · applying a Previous Price moves it;
     · the price beside it does not change because the summary exists;
     · two rows priced differently show different summaries.               */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

/* One stored quotation line, in the shape pricing_history returns. */
const REC = {
  quotationId: 1, refNo: 'Q-2026-0430', date: '2026-01-25', customer: 'Alpha Steel Sdn Bhd',
  companyId: 7, own: true, productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE',
  finish: 'PL', cleanSize: 'M16', dimensionPreview: 'L 380 x W 70 x TL 130mm',
  exactDims: true, qty: 75, unitPrice: 8.7, boltUnitPrice: 8.7, accessoryCost: 0,
  accessorySummary: '', accessoryAmbiguous: false, priceMode: 'auto',
  priceModeLabel: 'Auto Round', costRate: 2.8, addCost: 0.6, markup: 4,
  weight: 0.6724, legacy: false,
};
const HISTORY_API = {
  get_pricing_history: () => ({ ok: true, data: {
    records: [REC], total: 1, ownTotal: 1, otherTotal: 0, offset: 0, limit: 20 } }),
};

/* What the row says without being opened. `px` is the pricing line the row
   shows — its own, or its series heading's when it shares it; `parts` is that
   line split into its three fields; `sub` is the line under the row
   (provenance, accessories, badges); `st` is the Size 规格 pill. */
const meta = (page, i = 0) => page.evaluate(n => {
  const card = document.querySelector(`[data-wqa-row="${n}"]`);
  if (!card) return null;
  const t = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
  const own = card.querySelector('.wqa-it-main .wqa-px-sum');
  const ser = card.closest('.wqa-ser');
  const px = own ? t(own) : t(ser && ser.querySelector('.wqa-ser-px'));
  const pill = document.getElementById('wqaSizeType');
  const sp = pill && pill.closest('.wqa-sp');
  return {
    px, parts: px.split(' · '), ownPx: !!own,
    prov: t(card.querySelector('.wqa-it-sub .wqa-prov')),
    sub: t(card.querySelector('.wqa-it-sub')),
    badges: t(card.querySelector('.wqa-it-sub .wqa-sum-badges')),
    spec: t(card.querySelector('.wqa-row-spec')),
    stLabel: t(sp && sp.querySelector('.wqa-sp-k')),
    stValue: pill ? (pill.options[pill.selectedIndex] || {}).text || '' : '',
    stDisabled: pill ? pill.disabled : null,
    inputs: [card.querySelector('.wqa-it-px'), card.querySelector('.wqa-it-sub')]
      .filter(Boolean).reduce((k, e) => k + e.querySelectorAll('input,select,textarea').length, 0),
  };
}, i);

/* The summary's three fields, as the row's own state would print them. */
const fx = v => { const s = String(v == null ? '' : v).trim(); return !s ? '—' : isFinite(Number(s)) ? Number(s).toFixed(2) : s; };
const pct = v => { const s = String(v == null ? '' : v).trim(); return !s ? '—' : isFinite(Number(s)) ? Number(s) + '%' : s; };

/* What the item panel's own boxes hold — the values the summary claims to be
   reporting. */
const priceInputs = (page, i = 0) => page.evaluate(n => {
  const g = document.querySelector(`[data-wqa-row="${n}"] .wqa-rv-detail .wqa-px-grid`);
  if (!g) return null;
  const v = k => { const x = g.querySelector(`[data-px="${k}"]`); return x ? x.value : null; };
  return { costRate: v('costRate'), addCost: v('addCost'), markup: v('markup') };
}, i);

const PX = { 1: 'costRate', 2: 'addCost', 3: 'markup' };
async function typePrice(page, row, nth, value) {
  /* The pricing boxes live in the item's panel, so a shut row is opened
     first — which is the same thing a person does. */
  const open = await page.evaluate(n => {
    if (wqa.rows[n].open) return true;
    wqaToggleRow(n); return false;
  }, row);
  if (!open) await page.waitForTimeout(450);
  const sel = `[data-wqa-row="${row}"] .wqa-rv-detail [data-px="${PX[nth]}"]`;
  await page.click(sel, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(sel, String(value), { delay: 15 });
  await page.waitForTimeout(650);
}

module.exports = async (browser, A) => {
  const S = A.suite('compact row — the pricing summary, from the row\'s own state');

  // ── 1 · It is there, without opening the row, and it is read-only ──────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM16 x 380 x tl 130/130 - 75pcs',
      { expanded: false, settle: 900 });

    const m = await meta(page);
    A.ok(!!m && m.ownPx, 'a shut row carries its pricing line without being opened');
    A.eq(await page.evaluate(() => document.querySelectorAll('.wqa-rv-detail').length), 0,
      'and it is not open');
    A.eq(m.inputs, 0, 'and it is read-only — no input, select or textarea in it');
    /* Retired 2026-10-23 (AI review redesign): the "PRICING" heading on the
       line — the three field names are the whole line now. */
    A.eq(m.parts.length, 3, 'the line is three fields');
    A.ok(m.parts[0].startsWith('Cost '), 'naming Cost');
    A.ok(m.parts[1].startsWith('Add. Cost '), 'Additional Cost');
    A.ok(m.parts[2].startsWith('Markup '), 'and Markup');
    A.excludes(m.px, 'Qty', 'the quantity is NOT part of the summary');
    A.excludes(m.sub, 'Qty', 'nor of the line under the row');

    /* The row stays compact: a title line over its values, never a form. */
    const rowH = await page.evaluate(() =>
      Math.round(document.querySelector('[data-wqa-row="0"] .wqa-it-main').getBoundingClientRect().height));
    A.ok(rowH <= 90, `the shut row itself stays compact (${rowH}px)`);   // 2026-10-27: fixed-column grid
    await page.close();
  }

  // ── 2 · Every figure equals the row's own pricing state ────────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM16 x 380 x tl 130/130 - 75pcs', { settle: 900 });

    const check = async (where) => {
      const m = await meta(page);
      const inp = await priceInputs(page);
      const st = await page.evaluate(() => {
        const c = wqa.rows[0].calc || {};
        return { costRate: c.costRate, addCost: c.addCost, markup: c.markup };
      });
      /* The summary, the boxes and the state are one value seen three ways. */
      A.eq(m.parts[0], 'Cost ' + fx(st.costRate), `${where}: the summary's Cost Rate is the row's own`);
      A.eq(m.parts[1], 'Add. Cost ' + fx(st.addCost), `${where}: and its Additional Cost`);
      A.eq(m.parts[2], 'Markup ' + pct(st.markup), `${where}: and its Markup, as a percentage`);
      A.eq(inp.costRate, String(st.costRate), `${where}: the panel's box agrees with the state`);
      A.eq(inp.addCost, String(st.addCost), `${where}: for Additional Cost too`);
      A.eq(inp.markup, String(st.markup), `${where}: and Markup`);
    };
    await check('as parsed');

    // ── 3 · Typing moves it, immediately, with the caret still in the box ─
    const priceBefore = (await rowState(page))[0].price;
    await typePrice(page, 0, 1, '7.35');
    await typePrice(page, 0, 2, '3.25');
    await typePrice(page, 0, 3, '12');
    const stillTyping = await page.evaluate(() =>
      !!(document.activeElement && document.activeElement.closest('.wqa-px-grid')));
    A.ok(stillTyping, 'the caret is still in the pricing box');
    const m2 = await meta(page);
    A.eq(m2.parts[0], 'Cost 7.35', 'a typed Cost Rate reaches the summary without leaving the box');
    A.eq(m2.parts[1], 'Add. Cost 3.25', 'so does a typed Additional Cost');
    A.eq(m2.parts[2], 'Markup 12%', 'and a typed Markup');
    await check('after typing');

    /* The summary is a reader. Editing the rates SHOULD move the price — that
       is the calculator doing its job — but the summary must not be the
       reason, and it must not compute a price of its own. */
    const priceAfter = (await rowState(page))[0].price;
    A.ok(Number(priceAfter) !== Number(priceBefore),
      'the row re-prices from the new rates, as it always did');
    const summaryHasPrice = (await meta(page)).px;
    A.excludes(summaryHasPrice, String(priceAfter),
      'and the summary does not restate the price — it reports the inputs');
    A.excludes(summaryHasPrice, 'RM', 'not even as money');
    await page.close();
  }

  // ── 4 · Applying a Previous Price moves it, and names the record ───────
  {
    const page = await openApp(browser, { api: HISTORY_API });
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM16 x 380 x tl 130/130 - 75pcs',
      { expanded: false, settle: 900 });
    const before = await meta(page);
    A.eq(before.prov, '', 'before applying, no record is named');
    A.excludes(before.sub, 'Q-2026-0430', 'anywhere under the row');

    await page.click('[data-wqa-row="0"] .wqa-it-acts .wqa-row-hist');
    await page.waitForTimeout(900);
    const applied = await page.evaluate(() => {
      const b = document.querySelector('[data-wqa-row="0"] .ph-rec-use'); if (!b) return false; b.click(); return true;
    });
    A.ok(applied, 'the record offers a Use control');
    await page.waitForTimeout(900);

    const after = await meta(page);
    A.includes(after.prov, 'Previous Price', 'the line under the row says a previous price was used');
    A.includes(after.prov, 'Q-2026-0430', 'and names the record it came from');
    A.eq(after.parts[0], 'Cost 2.80', 'the summary now shows the record\'s Cost Rate');
    A.eq(after.parts[1], 'Add. Cost 0.60', 'its Additional Cost');
    A.eq(after.parts[2], 'Markup 4%', 'and its Markup');
    /* The row holds these as the strings its inputs carry, so they are
       compared as numbers rather than by spelling. */
    const st = await page.evaluate(() => {
      const c = wqa.rows[0].calc || {};
      return [c.costRate, c.addCost, c.markup].map(Number).join('|');
    });
    A.eq(st, '2.8|0.6|4', 'which is what the row itself now holds');
    /* The control that names the record is still the one that opens it. */
    A.eq(await page.evaluate(() => (document.querySelector('[data-wqa-row="0"] .wqa-prov') || {}).tagName), 'BUTTON',
      'and it is still a button');
    await page.evaluate(() => { if (wqa.rows[0].histOpen) wqaHistToggle(0); });
    await page.waitForTimeout(400);
    await page.click('[data-wqa-row="0"] .wqa-prov');
    await page.waitForTimeout(700);
    A.eq(await page.evaluate(() => wqa.rows[0].histOpen &&
      !!document.querySelector('[data-wqa-row="0"] .wqa-hist-panel')), true,
      'that opens the history it names');

    /* The pill follows the row's own provenance, and goes when it does. */
    await typePrice(page, 0, 1, '5.55');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(500);
    const typed = await meta(page);
    A.eq(typed.parts[0], 'Cost 5.55', 'a typed rate reaches the line');
    const ref = await page.evaluate(() => String(wqa.rows[0].usedHistoryRef || ''));
    A.eq(typed.prov.includes('Q-2026-0430'), ref === 'Q-2026-0430',
      'and the pill names a record exactly when the row still holds it');
    await page.selectOption('[data-wqa-row="0"] .wqa-rv-detail select[data-px="priceMode"]', 'manual');
    await page.waitForTimeout(700);
    await page.click('[data-wqa-row="0"] .wqa-rv-detail [data-px="manualPrice"]');
    await page.keyboard.type('12', { delay: 15 });
    await page.waitForTimeout(700);
    const manual = await meta(page);
    A.eq(await page.evaluate(() => String(wqa.rows[0].usedHistoryRef || '')), '',
      'a Manual Price typed by hand drops the reused record');
    A.eq(manual.prov, '', 'and the pill goes with it');
    A.eq(manual.px, 'Manual Price RM12.00', 'and the line says what the row is priced at now');
    await page.close();
  }

  // ── 5 · Two rows, priced differently, say different things ─────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM16 x 380 x tl 130/130 - 75pcs\nM20 x 500 x tl 100/100 - 20pcs',
      { settle: 900 });
    await typePrice(page, 0, 1, '5.10');
    await typePrice(page, 1, 1, '9.90');
    const a = await meta(page, 0), b = await meta(page, 1);
    A.eq(a.parts[0], 'Cost 5.10', 'row 1 shows its own Cost Rate');
    A.eq(b.parts[0], 'Cost 9.90', 'row 2 shows its own');
    A.ok(a.px !== b.px, 'two rows priced differently do not share a summary');
    await page.close();
  }

  // ── 5b · In a series, the heading speaks for the rows that agree ───────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, ['MS SAG ROD PL FULLSIZE',
      'M16 x 380 x tl 130/130 - 75pcs', 'M16 x 420 x tl 130/130 - 10pcs', 'M16 x 460 x tl 130/130 - 5pcs'].join('\n'),
      { expanded: false, settle: 900 });
    await page.evaluate(() => wqaEditPrice(2, 'costRate', '6.60'));
    await page.waitForTimeout(900);
    await page.evaluate(() => wqaRenderRows(true));
    const st = await page.evaluate(() => wqa.rows.map(r => String(r.calc.costRate)));
    const ser = await page.evaluate(() => (document.querySelector('.wqa-ser .wqa-ser-px') || {}).textContent || '');
    const rows = [await meta(page, 0), await meta(page, 1), await meta(page, 2)];
    A.eq(await page.evaluate(() => document.querySelectorAll('.wqa-ser .wqa-it').length), 3, 'the three rows are one series');
    A.ok(ser.startsWith('Cost ' + fx(st[0]) + ' · '), `the heading states the pricing the series shares (${ser})`);
    A.eq(rows.map(r => r.ownPx).join(','), 'false,false,true',
      'only the row that differs carries a pricing line of its own');
    A.eq(rows[2].parts[0], 'Cost 6.60', 'saying its own rate');
    A.eq(rows[0].parts[0], 'Cost ' + fx(st[0]), 'while the others read the heading, which is their own rate');
    await page.close();
  }

  // ── 6 · Both languages, and the values survive the switch ──────────────
  {
    const page = await openApp(browser, { api: HISTORY_API });
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM16 x 380 x tl 130/130 - 75pcs',
      { expanded: false, settle: 900 });
    await typePrice(page, 0, 1, '2.80');
    await typePrice(page, 0, 2, '0.60');
    await typePrice(page, 0, 3, '4');
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); wqaToggleRow(0); });
    await page.waitForTimeout(400);

    const en = await meta(page);
    A.eq(en.px, 'Cost 2.80 · Add. Cost 0.60 · Markup 4%', 'English: the line reads Cost · Add. Cost · Markup');
    A.eq(en.stLabel.replace(/\s*\*$/, ''), 'Size Type', 'English: and the Size Type is named');
    A.eq(en.stValue, 'Fullsize', 'with the value the message stated');

    await page.evaluate(() => dcSetLang('zh'));
    await page.waitForTimeout(350);
    const zh = await meta(page);
    A.eq(zh.parts[0], '成本 2.80', '中文: 成本');
    A.eq(zh.parts[1], '加工费 0.60', '中文: 加工费');
    A.eq(zh.parts[2], 'Markup 4%', '中文: Markup stays English');
    A.includes(zh.stLabel, 'Size 规格', '中文: Size 规格');
    A.excludes(zh.px, 'Cost', '中文: with no English label left beside it');
    A.excludes(zh.px, 'Pricing', '中文: nor the English heading');
    /* Retired 2026-10-23 (AI review redesign): the long labels 定价参数 /
       每公斤成本 / 额外加工费 on the compact line — the line uses the short
       成本 / 加工费 (the item panel keeps the long ones). */

    /* The switch re-labels. It must not re-price. */
    A.eq(await page.evaluate(() => [wqa.rows[0].calc.costRate, wqa.rows[0].calc.addCost, wqa.rows[0].calc.markup].map(Number).join('|')),
      '2.8|0.6|4', '中文: the values survive the switch');

    await page.evaluate(() => dcSetLang('en'));
    await page.waitForTimeout(350);
    const back = await meta(page);
    A.eq(back.px, en.px, 'and back to English gives exactly the line it started with');
    A.ok(!page._dcErrors.length, 'no script error: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ── 6b · A size type nobody stated says where it came from ─────────────
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD PL\nM12 x 853 x 70/70 - 4pcs', { expanded: false, settle: 900 });
    const st = await page.evaluate(() => ({ st: wqa.rows[0].sizeType, d: !!wqa.rows[0].stDefaulted }));
    const m = await meta(page);
    /* MS M12 for this company: Undersize, by the company rule (suite 16 §6). */
    A.eq(st.st + '/' + st.d, 'UNDERSIZE/true', 'the size type was defaulted, not read');
    A.eq(m.badges, 'Size Type: Undersize · company default',
      'and the row names it and where it came from');
    await page.evaluate(() => dcSetLang('zh'));
    await page.waitForTimeout(350);
    A.includes((await meta(page)).badges, 'Size 规格', '中文: the same badge, as Size 规格');
    A.includes((await meta(page)).badges, '公司默认', '中文: with its source');
    await page.evaluate(() => dcSetLang('en'));
    await page.close();
  }

  // ── 7 · A product with no size type is not asked about one ─────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'J BOLT MS PL\nM16 H 530 ID 125 S 180 TL 200 - 10pcs', { expanded: false, settle: 900 });
    const m = await meta(page);
    if (m) {
      const st = await page.evaluate(() => dcProductHasSizeType(wqaRowProduct(wqa.rows[0])));
      if (!st) {
        A.excludes(m.sub + ' ' + m.spec, 'Size Type',
          'a product that has no size type is not given an empty line about one');
        A.eq(m.stValue + '/' + m.stDisabled, 'N/A/true', 'and the shared Size Type says N/A and cannot be set');
      } else A.ok(true, 'this product does carry a size type, so the line belongs');
    } else {
      A.ok(false, 'the row is still drawn');
    }
    await page.close();
  }

  return S;
};
