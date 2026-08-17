/* ── The compact row's pricing summary ─────────────────────────────────────
   A read-only two-column line under every compact row: where the size type
   came from and which record a reused price came from on the left, the three
   pricing inputs on the right. It exists so an operator can see what a row is
   priced ON without opening it.

   The whole risk in a summary like this is that it becomes a SECOND source of
   truth — a display formula that agrees with the real one until the day it
   doesn't. So this suite's job is not to check the wording. It is to check
   that every figure on the line is the row's own live state:

     · what the summary says equals what the expanded form's inputs hold;
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

const meta = (page, i = 0) => page.evaluate(n => {
  const m = document.querySelector(`[data-wqa-row="${n}"] .wqa-meta`);
  if (!m) return null;
  const t = s => { const e = m.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
  return { left: t('.wqa-meta-l'), right: t('.wqa-meta-r'),
           inputs: m.querySelectorAll('input,select,textarea').length };
}, i);

/* What the expanded form's own boxes hold — the values the summary claims to
   be reporting. */
const priceInputs = (page, i = 0) => page.evaluate(n => {
  const g = document.querySelector(`[data-wqa-row="${n}"] .wqa-price-grid`);
  if (!g) return null;
  const v = k => { const e = g.querySelectorAll('.field')[k]; const x = e && e.querySelector('input'); return x ? x.value : null; };
  return { costRate: v(0), addCost: v(1), markup: v(2) };
}, i);

async function typePrice(page, row, nth, value) {
  /* The pricing boxes live in the expanded body, so a compact row is opened
     first — which is the same thing a person does. */
  const open = await page.evaluate(n => {
    if (wqa.rows[n].open) return true;
    wqaToggleRow(n); return false;
  }, row);
  if (!open) await page.waitForTimeout(450);
  const sel = `[data-wqa-row="${row}"] .wqa-price-grid .field:nth-child(${nth}) input`;
  await page.click(sel, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(sel, String(value), { delay: 15 });
  await page.waitForTimeout(650);
}

module.exports = async (browser, A) => {
  const S = A.suite('compact row — the pricing summary, from the row\'s own state');

  // ── 1 · It is there, without pressing Edit, and it is read-only ────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM16 x 380 x tl 130/130 - 75pcs',
      { expanded: false, settle: 900 });

    const m = await meta(page);
    A.ok(!!m, 'a compact row carries a metadata line without being opened');
    A.eq(m.inputs, 0, 'and it is read-only — no input, select or textarea in it');
    A.includes(m.right, 'Pricing', 'the right column is labelled Pricing');
    A.includes(m.right, 'Cost Rate', 'and names Cost Rate');
    A.includes(m.right, 'Additional Cost', 'Additional Cost');
    A.includes(m.right, 'Markup', 'and Markup');
    A.excludes(m.right, 'Qty', 'the quantity is NOT part of the summary');
    A.excludes(m.left, 'Qty', 'on either side');

    /* The row above it is untouched: same one line, same cells. */
    const rowH = await page.evaluate(() =>
      Math.round(document.querySelector('[data-wqa-row="0"] .wqa-sum').getBoundingClientRect().height));
    A.ok(rowH <= 46, `the compact row itself stays compact (${rowH}px)`);
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
      A.includes(m.right, 'RM' + Number(st.costRate).toFixed(2),
        `${where}: the summary's Cost Rate is the row's own`);
      A.includes(m.right, 'RM' + Number(st.addCost).toFixed(2),
        `${where}: and its Additional Cost`);
      A.includes(m.right, Number(st.markup) + '%',
        `${where}: and its Markup, as a percentage`);
      A.eq(inp.costRate, String(st.costRate), `${where}: the expanded box agrees with the state`);
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
      !!(document.activeElement && document.activeElement.closest('.wqa-price-grid')));
    A.ok(stillTyping, 'the caret is still in the pricing box');
    const m2 = await meta(page);
    A.includes(m2.right, 'RM7.35', 'a typed Cost Rate reaches the summary without leaving the box');
    A.includes(m2.right, 'RM3.25', 'so does a typed Additional Cost');
    A.includes(m2.right, '12%', 'and a typed Markup');
    await check('after typing');

    /* The summary is a reader. Editing the rates SHOULD move the price — that
       is the calculator doing its job — but the summary must not be the
       reason, and it must not compute a price of its own. */
    const priceAfter = (await rowState(page))[0].price;
    A.ok(Number(priceAfter) !== Number(priceBefore),
      'the row re-prices from the new rates, as it always did');
    const summaryHasPrice = (await meta(page)).right;
    A.excludes(summaryHasPrice, String(priceAfter),
      'and the summary does not restate the price — it reports the inputs');
    await page.close();
  }

  // ── 4 · Applying a Previous Price moves it, and names the record ───────
  {
    const page = await openApp(browser, { api: HISTORY_API });
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM16 x 380 x tl 130/130 - 75pcs',
      { expanded: false, settle: 900 });
    const before = await meta(page);
    A.excludes(before.left, 'Q-2026-0430', 'before applying, no record is named');

    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(900);
    const applied = await page.evaluate(() => {
      const b = document.querySelector('.ph-rec-use'); if (!b) return false; b.click(); return true;
    });
    A.ok(applied, 'the record offers a Use control');
    await page.waitForTimeout(900);

    const after = await meta(page);
    A.includes(after.left, 'Previous Price', 'the left column says a previous price was used');
    A.includes(after.left, 'Q-2026-0430', 'and names the record it came from');
    A.includes(after.right, 'RM2.80', 'the summary now shows the record\'s Cost Rate');
    A.includes(after.right, 'RM0.60', 'its Additional Cost');
    A.includes(after.right, '4%', 'and its Markup');
    /* The row holds these as the strings its inputs carry, so they are
       compared as numbers rather than by spelling. */
    const st = await page.evaluate(() => {
      const c = wqa.rows[0].calc || {};
      return [c.costRate, c.addCost, c.markup].map(Number).join('|');
    });
    A.eq(st, '2.8|0.6|4', 'which is what the row itself now holds');
    /* The control that names the record is still the one that opens it. */
    A.ok(await page.evaluate(() => !!document.querySelector('[data-wqa-row="0"] .wqa-prov')),
      'and it is still a button that opens the history it names');
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
    A.includes(a.right, 'RM5.10', 'row 1 shows its own Cost Rate');
    A.includes(b.right, 'RM9.90', 'row 2 shows its own');
    A.ok(a.right !== b.right, 'two rows priced differently do not share a summary');
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

    const en = await meta(page);
    A.includes(en.right, 'Pricing', 'English: the label is Pricing');
    A.includes(en.left, 'Size Type', 'English: and the left column names the Size Type');

    await page.evaluate(() => dcSetLang('zh'));
    await page.waitForTimeout(350);
    const zh = await meta(page);
    A.includes(zh.right, '价格参数', '中文: 价格参数');
    A.includes(zh.right, '成本率', '中文: 成本率');
    A.includes(zh.right, '附加成本', '中文: 附加成本');
    A.includes(zh.right, '加成', '中文: 加成');
    A.includes(zh.left, '尺寸类型', '中文: 尺寸类型');
    A.excludes(zh.right, 'Cost Rate', '中文: with no English label left beside it');
    A.excludes(zh.right, 'Pricing', '中文: nor the English heading');

    /* The switch re-labels. It must not re-price. */
    A.includes(zh.right, 'RM2.80', '中文: the Cost Rate survives the switch');
    A.includes(zh.right, 'RM0.60', '中文: and the Additional Cost');
    A.includes(zh.right, '4%', '中文: and the Markup');

    await page.evaluate(() => dcSetLang('en'));
    await page.waitForTimeout(350);
    const back = await meta(page);
    A.eq(back.right, en.right, 'and back to English gives exactly the line it started with');
    A.ok(!page._dcErrors.length, 'no script error: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ── 7 · A product with no size type is not asked about one ─────────────
  {
    const page = await openApp(browser);
    await quickAddPaste(page, 'J BOLT MS PL\nM16 H 530 ID 125 S 180 TL 200 - 10pcs', { expanded: false, settle: 900 });
    const m = await meta(page);
    if (m) {
      const st = await page.evaluate(() => dcProductHasSizeType(wqaRowProduct(wqa.rows[0])));
      if (!st) A.excludes(m.left, 'Size Type',
        'a product that has no size type is not given an empty line about one');
      else A.ok(true, 'this product does carry a size type, so the line belongs');
    } else {
      A.ok(false, 'the row still carries a metadata line');
    }
    await page.close();
  }

  return S;
};
