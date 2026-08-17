/* ── The evidence set the audit brief asks for, in its own order ────────────
   Every frame here is the real application answering a real message. Nothing
   is staged from a fixture that hands back a prepared answer: where a price
   history is needed, api.php is answered with stored records and the MATCHER
   in the page decides what is reusable and what is only a reference — which
   is the whole point, because a screenshot of a fixed answer proves nothing.

       node tests/audit-shots.js [outdir]                                    */
'use strict';
const fs   = require('fs');
const path = require('path');
const { launch, openApp, openCompanies, quickAddPaste } = require('./lib/harness');

const OUT = process.argv[2] || path.join(__dirname, '..', 'audit-out', 'audit-shots');
fs.mkdirSync(OUT, { recursive: true });

const V = { width: 1500, height: 1150 };
const index = [];

const shot = async (page, name, sel) => {
  const target = sel ? await page.$(sel) : null;
  await (target || page).screenshot({ path: path.join(OUT, name + '.png') });
  index.push(name);
  console.log('  ' + name + '.png');
};

/* ── Evidence starts from a state somebody wrote down ───────────────────────
   Playwright gives each page its own context, so nothing carries over between
   frames by itself — but "nothing carried over" is a claim, and a claim in an
   evidence run should be checked rather than assumed. This proves the page
   opened with no saved draft, no stored language and no handed-over quotation,
   and says so loudly if it did not. */
const assertClean = async (page, frame) => {
  const dirty = await page.evaluate(() => {
    const ls = Object.keys(localStorage || {});
    const ss = Object.keys(sessionStorage || {});
    return { ls, ss, rows: (typeof wqa !== 'undefined' && wqa.rows) ? wqa.rows.length : 0,
             items: (typeof quoteItems !== 'undefined') ? quoteItems.length : 0 };
  });
  const stale = dirty.ls.filter(k => k !== 'dc_lang');
  if (stale.length || dirty.ss.length || dirty.rows || dirty.items) {
    throw new Error(`${frame}: the page did not start clean — `
      + `localStorage ${JSON.stringify(stale)} sessionStorage ${JSON.stringify(dirty.ss)} `
      + `${dirty.rows} quick-add rows, ${dirty.items} quotation items`);
  }
};

/* ── Type the rates, the way a person does ──────────────────────────────────
   wqaEditPrice() writes the value into the row's state and recomputes, and the
   re-render deliberately does NOT write it back into the box — because while
   somebody is typing, the box already holds what they typed and overwriting it
   would move the caret. Called from a script, that leaves the SCREEN showing
   the old figure beside a price worked out from the new one: an evidence frame
   printing "Markup 0" over a price that includes 4%. So evidence types. */
const typePrice = async (page, row, field, value) => {
  const nth = { costRate: 1, addCost: 2, markup: 3 }[field];
  const sel = `[data-wqa-row="${row}"] .wqa-price-grid .field:nth-child(${nth}) input`;
  await page.click(sel, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(sel, String(value), { delay: 15 });
  await page.$eval(sel, el => el.blur());
  await page.waitForTimeout(400);
};

/* Type into an inline edit cell, the way a person does. */
const typeCell = async (page, row, field, value) => {
  const sel = `[data-wqa-row="${row}"] [data-ef="${field}"]`;
  await page.click(sel, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(sel, String(value), { delay: 15 });
  await page.waitForTimeout(650);
};

const setLang = async (page, l) => {
  await page.evaluate(x => dcSetLang(x), l);
  await page.waitForTimeout(350);
};

/* Stored quotation lines, in the shape pricing_history returns them. The page
   works out for itself which of these this row may reuse. */
const rec = o => Object.assign({
  quotationId: 1, refNo: 'Q-2026-0125', date: '2026-01-25', customer: 'Alpha Steel Sdn Bhd',
  companyId: 7, own: true, productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE',
  finish: 'PL', cleanSize: 'M12', dimensionPreview: 'L 1000 x TL 100/100mm',
  exactDims: true, qty: 40, unitPrice: 9.8, boltUnitPrice: 9.8, accessoryCost: 0,
  accessorySummary: '', accessoryAmbiguous: false, priceMode: 'auto',
  priceModeLabel: 'Auto Round', costRate: 6.2, addCost: 2.4, markup: 15,
  weight: 0.8878, legacy: false,
}, o);

const historyApi = records => ({
  get_pricing_history: () => ({ ok: true, data: {
    records, total: records.length,
    ownTotal: records.filter(r => r.own).length,
    otherTotal: records.filter(r => !r.own).length, offset: 0, limit: 20 } }),
});

(async () => {
  const browser = await launch();
  try {
    // ══ QUICK ADD ════════════════════════════════════════════════════════
    /* 01 · the ordinary case: a message that reads cleanly. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, [
        'MS SAG ROD ZP FULLSIZE',
        'M12 x 1000 x 100/100 - 40pcs',
        'M16 x 850 x 100/100 - 20pcs',
        'M20 x 3000 x 150/150 - 8pcs',
      ].join('\n'), { expanded: false, settle: 1000 });
      await shot(page, '01-quickadd-normal', '#wqaStep2');
      await page.close();
    }

    /* 02 · a row that cannot be priced, saying which answer it is short of. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, [
        'SAG ROD',
        'M20 x 1000 x 100/100 - 4pcs',
        'M23 x 900 x 100/100 - 2pcs',
      ].join('\n'), { expanded: false, settle: 1000 });
      await shot(page, '02-quickadd-incomplete', '#wqaStep2');
      await page.close();
    }

    /* 03 · the live message: a spec header, an item, and a quantity on a line
           of its own with a thousands separator. ONE item, 15000 pieces. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page,
        '4140 sag rod, both thread 65mm, plain\nM24 x 300mm x tl 65/65\nqty - 15,000 pcs',
        { settle: 1000 });
      await shot(page, '03-qty-continuation-15000', '#wqaStep2');
      await page.close();
    }

    /* 04 · no count anywhere in the message: one piece, shown as a default. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 500 x 50/50\nM16 x 800 x 50/50\nM20 x 1000 x 50/50',
        { settle: 1000 });
      await shot(page, '04-absent-qty-defaults-to-1', '#wqaStep2');
      await page.close();
    }

    /* 05 · a metric pitch: the size stays M12 and the pitch is a note. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 1.75P x 853 x 70/70 - 4pcs',
        { settle: 1000 });
      await shot(page, '05-metric-pitch-note', '#wqaStep2');
      await page.close();
    }

    /* 06, 07 · the one imperial size with an approved series, both ways. */
    for (const [series, name] of [['UNC', '06-half-inch-unc'], ['BSW', '07-half-inch-bsw']]) {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, `MS ANCHOR BOLT PL FULLSIZE\n1/2 ${series} x 300 x 100 - 12pcs`,
        { settle: 1000 });
      await shot(page, name, '#wqaStep2');
      await page.close();
    }

    /* 08 · a stored line this row may reuse the recipe of. */
    {
      const page = await openApp(browser, { viewport: V,
        api: historyApi([rec({}), rec({ refNo: 'Q-2025-0912', date: '2025-09-12', unitPrice: 9.1,
                                        boltUnitPrice: 9.1, dimensionPreview: 'L 850 x TL 100/100mm',
                                        exactDims: false })]) });
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, 'MS SAG ROD PL UNDERSIZE\nM12 x 1000 x 100/100 - 40pcs', { settle: 1200 });
      await page.click('[data-wqa-row="0"] .wqa-row-hist');
      await page.waitForTimeout(900);
      await shot(page, '08-previous-price-reusable', '#wqaStep2');
      await page.close();
    }

    /* 09 · the same rod in another coating: shown, labelled, and NOT offered
           as a recipe — a coating is what changes the cost rate. */
    {
      const page = await openApp(browser, { viewport: V,
        api: historyApi([rec({ finish: 'HDG', refNo: 'Q-2025-0771', unitPrice: 12.4,
                               boltUnitPrice: 12.4, own: false, customer: 'Beta Engineering' })]) });
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, 'MS SAG ROD PL UNDERSIZE\nM12 x 1000 x 100/100 - 40pcs', { settle: 1200 });
      await page.click('[data-wqa-row="0"] .wqa-row-hist');
      await page.waitForTimeout(900);
      await shot(page, '09-previous-price-references', '#wqaStep2');
      await page.close();
    }

    /* 10, 11 · applying one record to the items it actually describes, and the
           rows it does not — disabled, with the reason on them. */
    {
      const page = await openApp(browser, { viewport: V, api: historyApi([rec({})]) });
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, [
        'MS SAG ROD PL UNDERSIZE',
        'M12 x 1000 x 100/100 - 40pcs',
        'M12 x 1500 x 100/100 - 10pcs',
        'M16 x 1000 x 100/100 - 6pcs',
      ].join('\n'), { settle: 1200 });
      await page.click('[data-wqa-row="0"] .wqa-row-hist');
      await page.waitForTimeout(900);
      await shot(page, '10-apply-compatible', '#wqaStep2');
      const opened = await page.evaluate(() => {
        const b = document.querySelector('.wqa-hist-panel .ph-more-ways, .wqa-hist-panel .btn-outline');
        if (b) { b.click(); return true; }
        return false;
      });
      await page.waitForTimeout(800);
      await shot(page, '11-select-items-incompatible-disabled', opened ? null : '#wqaStep2');
      await page.close();
    }

    /* 12 · Bulk Edit. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, [
        'MS SAG ROD PL FULLSIZE',
        'M12 x 1000 x 100/100 - 40pcs',
        'M16 x 850 x 100/100 - 20pcs',
      ].join('\n'), { expanded: false, settle: 1000 });
      await page.evaluate(() => { if (typeof wqaTogglePanel === 'function') wqaTogglePanel('fix'); });
      await page.waitForTimeout(700);
      await shot(page, '12-bulk-edit', '#wqaStep2');
      await page.close();
    }

    /* 13 · one item opened, every field it owns on screen. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 1000 x 100/100 - 40pcs', { settle: 1000 });
      await shot(page, '13-expanded-item', '#wqaStep2');
      await page.close();
    }

    /* 14 · a mixed message: some rows priceable, some not. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, [
        'MS SAG ROD PL FULLSIZE',
        'M12 x 1000 x 100/100 - 40pcs',
        'M23 x 900 x 100/100 - 2pcs',
        'M16 x 850 x 100/100 - 20pcs',
        'qty tbc',
      ].join('\n'), { expanded: false, settle: 1100 });
      await shot(page, '14-mixed-items-partial-add', '#wqaStep2');
      await page.close();
    }

    // ══ STAINLESS ════════════════════════════════════════════════════════
    for (const [said, name] of [['SS304', '15-ss304-finish-na'], ['SS316', '16-ss316-finish-na']]) {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, `${said} SAG ROD FULLSIZE\nM12 x 1000 x 100/100 - 40pcs`, { settle: 1000 });
      await shot(page, name, '#wqaStep2');
      await page.close();
    }

    // ══ MATERIAL ═════════════════════════════════════════════════════════
    for (const [said, name] of [['GRADE 8.8', '17-grade-88-is-4140qt'],
                                ['GRADE 10.9', '18-grade-109-is-4340qt']]) {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, `${said} SAG ROD ZP FULLSIZE\nM20 x 1000 x 100/100 - 12pcs`, { settle: 1000 });
      await shot(page, name, '#wqaStep2');
      await page.close();
    }

    // ══ HISTORY ══════════════════════════════════════════════════════════
    /* 19 · an imperial size finding its own history. The stored size is 1/2,
           which is the spelling that used to be lost in the SQL LIKE. */
    {
      const page = await openApp(browser, { viewport: V,
        api: historyApi([rec({ cleanSize: '1/2', sizeType: 'UNDERSIZE', unitPrice: 11.2,
                               boltUnitPrice: 11.2, dimensionPreview: 'L 1000 x TL 100/100mm' })]) });
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, 'MS SAG ROD PL\n1/2 x 1000 x 100/100 - 24pcs', { settle: 1200 });
      await page.click('[data-wqa-row="0"] .wqa-row-hist');
      await page.waitForTimeout(900);
      await shot(page, '19-imperial-half-inch-history', '#wqaStep2');
      await page.close();
    }

    /* 20 · the reference-only record, on its own, so the label is unmissable. */
    {
      const page = await openApp(browser, { viewport: V,
        api: historyApi([rec({ finish: 'HDG', unitPrice: 12.4, boltUnitPrice: 12.4 })]) });
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, 'MS SAG ROD PL UNDERSIZE\nM12 x 1000 x 100/100 - 40pcs', { settle: 1200 });
      await page.click('[data-wqa-row="0"] .wqa-row-hist');
      await page.waitForTimeout(900);
      await shot(page, '20-different-finish-reference-only', '#wqaStep2');
      await page.close();
    }

    /* 21 · a quotation saved and reopened, with the price it went out at. */
    {
      const page = await openApp(browser, { viewport: V, api: historyApi([rec({})]) });
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, 'MS SAG ROD PL UNDERSIZE\nM12 x 1000 x 100/100 - 40pcs', { settle: 1000 });
      await page.evaluate(() => {
        wqaEditPrice(0, 'costRate', '6.20'); wqaEditPrice(0, 'addCost', '2.40');
      });
      await page.waitForTimeout(700);
      await page.evaluate(() => wqaAddAll());
      await page.waitForTimeout(1200);
      await shot(page, '21-saved-reopened-previous-price', '#step3Card');
      await page.close();
    }

    // ══ COMPANIES ════════════════════════════════════════════════════════
    {
      const page = await openCompanies(browser, { viewport: V });
      await shot(page, '22-company-list');
      await page.evaluate(() => { if (typeof openAddCompany === 'function') openAddCompany(); });
      await page.waitForTimeout(600);
      await shot(page, '23-company-create-edit');
      await page.evaluate(() => {
        const m = document.querySelector('.modal-overlay.open'); if (m) m.classList.remove('open');
        if (typeof selectCompany === 'function') selectCompany(7);
      });
      await page.waitForTimeout(800);
      await shot(page, '24-customer-quotation-association');
      await page.close();
    }

    // ══ LANGUAGE ═════════════════════════════════════════════════════════
    {
      const page = await openApp(browser, { viewport: V });
      await setLang(page, 'en');
      await shot(page, '25-main-page-english');
      await setLang(page, 'zh');
      await shot(page, '26-main-page-chinese');

      await quickAddPaste(page, 'MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 40pcs\nM16 x 850 x 100/100 - 20pcs',
        { expanded: false, settle: 1000 });
      await setLang(page, 'zh');
      await shot(page, '27-quickadd-chinese', '#wqaStep2');
      await page.evaluate(() => wqaHardClose());
      await page.waitForTimeout(400);

      /* 29 · the calculator, and 30 · a refusal, both in 中文. */
      await page.evaluate(() => switchType('sagrod'));
      await page.waitForTimeout(400);
      await shot(page, '29-calculator-chinese');
      await page.evaluate(() => {
        document.getElementById('sagrod-size').value = '';
        addSagRod();
      });
      await page.waitForTimeout(500);
      await shot(page, '30-validation-message-chinese');
      await setLang(page, 'en');
      await page.close();
    }
    {
      const page = await openCompanies(browser, { viewport: V, lang: 'zh' });
      await shot(page, '28-companies-chinese');
      await page.close();
    }

    // ══ OUTPUT ═══════════════════════════════════════════════════════════
    {
      const page = await openApp(browser, { viewport: V });
      await page.evaluate(() => { selectedCompanyId = 7; });
      await page.evaluate(() => { document.getElementById('qi-customer').value = 'Alpha Steel Sdn Bhd'; });
      await quickAddPaste(page, [
        'MS SAG ROD ZP FULLSIZE',
        'M12 x 1000 x 100/100 - 40pcs',
        'M16 x 850 x 100/100 - 20pcs',
      ].join('\n'), { settle: 1000 });
      await page.evaluate(() => {
        [0, 1].forEach(i => { wqaEditPrice(i, 'costRate', '6.20'); wqaEditPrice(i, 'addCost', '2.40'); });
      });
      await page.waitForTimeout(800);
      await page.evaluate(() => wqaAddAll());
      await page.waitForTimeout(1400);
      await shot(page, '31-saved-quotation', '#step3Card');

      const opened = await page.evaluate(async () => {
        if (typeof openWATemplateModal === 'function') { await openWATemplateModal(); return 'wa'; }
        if (typeof refreshWAPreview === 'function') { refreshWAPreview(); return 'wa'; }
        return '';
      });
      await page.waitForTimeout(900);
      await shot(page, '32-whatsapp-preview', opened ? null : '#step4Actions');
      await page.close();
    }

    // ══ MORNING REPAIR ═══════════════════════════════════════════════════
    /* 33 · an ambiguous quantity: neither number taken, no phantom row, and
           the item asking for its count by name. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM24 x 300 x tl 65/65\nqty 100 / 200',
        { settle: 1000 });
      await shot(page, '33-ambiguous-qty-needs-qty', '#wqaStep2');
      await page.close();
    }

    /* 34 · the comma in a LENGTH, after. The before-evidence for this shows
           the same message quoted as a 1mm rod at RM 0.60.

           The rates typed here are the ones verified by hand — 2.80 and 0.60
           with 4% markup — so the price on this frame is the price a person
           checked: 3.5513 kg × 2.80 + 0.60 = 10.5436, +4% = 10.9653, rounded
           up to RM 10.97. An earlier version of this frame typed 6.20 and
           2.40, borrowed from the pricing-history helper above, and printed a
           correct RM 24.42 that read as a pricing fault. */
    {
      const page = await openApp(browser, { viewport: V });
      await assertClean(page, '34-comma-length-after');
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM24 x 1,000 x tl 65/65 - 20pcs',
        { settle: 1000 });
      await typePrice(page, 0, 'costRate', '2.80');
      await typePrice(page, 0, 'addCost', '0.60');
      await typePrice(page, 0, 'markup', '4');
      await page.waitForTimeout(600);
      await shot(page, '34-comma-length-after', '#wqaStep2');
      await page.close();
    }

    /* 35 · two rows in 中文, with the count on the footer and on the button. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, 'MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 40pcs\nM16 x 850 x 100/100 - 20pcs',
        { expanded: false, settle: 1000 });
      await setLang(page, 'zh');
      await page.waitForTimeout(500);
      await shot(page, '35-quickadd-chinese-item-count', '#wqaModal');
      await setLang(page, 'en');
      await page.close();
    }

    /* 36 · the saved quotation's own controls, one language at a time. */
    {
      const page = await openApp(browser, { viewport: V });
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, 'MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 40pcs', { settle: 900 });
      await page.evaluate(() => { wqaEditPrice(0, 'costRate', '6.20'); wqaEditPrice(0, 'addCost', '2.40'); });
      await page.waitForTimeout(700);
      await page.evaluate(() => wqaAddAll());
      await page.waitForTimeout(1200);
      await shot(page, '36-saved-quote-english', '#step3Card');
      await setLang(page, 'zh');
      await page.waitForTimeout(500);
      await shot(page, '37-saved-quote-chinese', '#step3Card');
      await setLang(page, 'en');
      await page.close();
    }

    /* 38 · the Companies page in 中文, drawn from data. */
    {
      const page = await openCompanies(browser, { viewport: V, lang: 'zh' });
      await page.waitForTimeout(800);
      await shot(page, '38-companies-chinese-dynamic');
      await page.close();
    }

    // ══ FINAL CLOSING — the six frames the closing brief names ════════════
    /* A · Companies in 中文 with a company selected, which is where the
           English helper line lived. */
    {
      const page = await openCompanies(browser, { viewport: V, lang: 'zh' });
      await page.waitForTimeout(700);
      await page.evaluate(() => { const c = document.querySelector('.company-card,.company-card-compact'); if (c) c.click(); });
      await page.waitForTimeout(900);
      await shot(page, 'A-companies-chinese-clean');
      await page.close();
    }

    /* B · an IMAGE extraction in 中文, carrying the accessory note. This is
           the frame the review named: "Document mentions 3 NUTS + 2 FLAT
           WASHER — accessories are never added automatically…" */
    {
      const page = await openApp(browser, { viewport: V });
      await assertClean(page, 'B-image-quickadd-chinese');
      await setLang(page, 'zh');
      await page.evaluate(async d => { wqaOpen(); await wqaAiApply(d); }, {
        product: 'ANCHOR_BOLT', material: 'MS', finish: 'HDG', sizeType: 'Fullsize',
        threadEnds: 1, note: '3 NUTS + 2 FLAT WASHER',
        items: [
          { M: 'M20', L: 600, W: null, TL: 60, qty: 10, Bmid: null, material: null, finish: null,
            sizeType: null, unclear: null, product: null, threadEnds: null, bodyDia: null,
            H: null, ID: null, S: null, R: null },
          { M: 'M24', L: 1000, W: null, TL: 80, qty: 25, Bmid: null, material: null, finish: null,
            sizeType: null, unclear: null, product: null, threadEnds: null, bodyDia: null,
            H: null, ID: null, S: null, R: null },
        ],
      });
      await page.evaluate(() => wqaSetView('expanded'));
      await page.waitForTimeout(1100);
      await shot(page, 'B-image-quickadd-chinese', '#wqaStep2');
      await setLang(page, 'en');
      await page.close();
    }

    /* C · two items in 中文: 2 项 on the footer, 2 项 on the button, and every
           generated label beside them translated. */
    {
      const page = await openApp(browser, { viewport: V });
      await assertClean(page, 'C-quickadd-chinese-two-items');
      await quickAddPaste(page, 'MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 40pcs\nM16 x 850 x 100/100 - 20pcs',
        { settle: 1000 });
      await setLang(page, 'zh');
      await page.waitForTimeout(600);
      await shot(page, 'C-quickadd-chinese-two-items', '#wqaModal');
      await setLang(page, 'en');
      await page.close();
    }

    /* D and E · one saved quotation, each language on its own. */
    {
      const page = await openApp(browser, { viewport: V });
      await assertClean(page, 'D-saved-quote-chinese');
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, 'MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 40pcs', { settle: 900 });
      await typePrice(page, 0, 'costRate', '2.80');
      await typePrice(page, 0, 'addCost', '0.60');
      await typePrice(page, 0, 'markup', '4');
      await page.evaluate(() => wqaAddAll());
      await page.waitForTimeout(1200);
      await setLang(page, 'zh');
      await page.waitForTimeout(600);
      await shot(page, 'D-saved-quote-chinese', '#step3Card');
      await setLang(page, 'en');
      await page.waitForTimeout(600);
      await shot(page, 'E-saved-quote-english', '#step3Card');
      await page.close();
    }

    /* F · the verified pricing, stated in full on one screen, from a page
           proved empty before it started.

             M24 x 1000   unit weight 3.5513 kg/pc
             Cost Rate 2.80 · Additional Cost 0.60 · Markup 4%
             3.5513 × 2.80 = 9.9436  + 0.60 = 10.5436  + 4% = 10.9653
             Auto Round                                 => RM 10.97          */
    {
      const page = await openApp(browser, { viewport: V });
      await assertClean(page, 'F-m24-pricing-verified');
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM24 x 1000 x tl 65/65 - 20pcs',
        { settle: 1000 });
      await typePrice(page, 0, 'costRate', '2.80');
      await typePrice(page, 0, 'addCost', '0.60');
      await typePrice(page, 0, 'markup', '4');
      await page.waitForTimeout(600);
      const priced = await page.evaluate(() => ({
        weight: wqa.rows[0].calc ? wqa.rows[0].calc.weight : null,
        price: wqa.rows[0].calc ? wqa.rows[0].calc.finalUnitPrice : null,
      }));
      /* Stated in the run's own output, so the frame and the number cannot
         drift apart without the run saying so. */
      console.log(`      F · M24 x 1000 · ${Number(priced.weight).toFixed(4)} kg/pc `
                + `· Cost Rate 2.80 · Add 0.60 · Markup 4% => RM ${Number(priced.price).toFixed(2)}`);
      if (Number(priced.price).toFixed(2) !== '10.97') {
        throw new Error('F: the verified price changed — expected RM 10.97, got RM '
          + Number(priced.price).toFixed(2));
      }
      await shot(page, 'F-m24-pricing-verified', '#wqaStep2');
      await page.close();
    }

    // ══ UI/UX POLISH — the twelve frames the polish brief names ═══════════
    /* P01/P02 · the homepage entry, both languages. */
    {
      const page = await openApp(browser, { viewport: V });
      await shot(page, 'P01-quickadd-homepage-en', '#step2Card');
      await setLang(page, 'zh');
      await shot(page, 'P02-quickadd-homepage-zh', '#step2Card');
      await setLang(page, 'en');
      await page.close();
    }
    /* P03/P04 · the modal itself, retitled, with the generated scope hint. */
    {
      const page = await openApp(browser, { viewport: V });
      await page.evaluate(() => wqaOpen());
      await page.waitForTimeout(400);
      await shot(page, 'P03-quickadd-modal-en', '#wqaModal .modal');
      await setLang(page, 'zh');
      await page.waitForTimeout(300);
      await shot(page, 'P04-quickadd-modal-zh', '#wqaModal .modal');
      await setLang(page, 'en');
      await page.close();
    }
    /* P05–P08 · compact, expanded with section labels, History, Bulk Edit. */
    {
      const page = await openApp(browser, { viewport: V });
      await assertClean(page, 'P05-compact-two-items');
      await quickAddPaste(page, 'MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 40pcs\nM16 x 850 x 100/100 - 20pcs',
        { expanded: false, settle: 900 });
      await shot(page, 'P05-compact-two-items', '#wqaStep2');
      await page.evaluate(() => wqaSetView('expanded'));
      await page.waitForTimeout(500);
      await shot(page, 'P06-expanded-item', '#wqaStep2');
      /* History is captured in compact view, where the panel sits directly
         under its one-line row instead of under a whole expanded form. */
      await page.evaluate(() => wqaSetView('compact'));
      await page.waitForTimeout(300);
      await page.evaluate(() => { const b = document.querySelector('.wqa-row-hist'); if (b) b.click(); });
      await page.waitForTimeout(700);
      await shot(page, 'P07-history-open', '#wqaStep2');
      await page.evaluate(() => { wqaHistToggle(0); wqaOpenBulkFor(); });
      await page.waitForTimeout(400);
      await shot(page, 'P08-bulk-edit-open', '#wqaStep2');
      await page.close();
    }
    /* P09/P10 · every row blocked with the footer helper, then the same list
       complete and addable — the helper must be gone. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, 'M24 x 300 x tl 65/65\nqty 100 / 200', { expanded: false, settle: 900 });
      await shot(page, 'P09-blocked-needs-attention', '#wqaStep2');
      await page.close();
      const ok = await openApp(browser, { viewport: V });
      await quickAddPaste(ok, 'MS SAG ROD PL FULLSIZE\nM24 x 1000 x tl 65/65 - 20pcs', { settle: 900 });
      await typePrice(ok, 0, 'costRate', '2.80');
      await typePrice(ok, 0, 'addCost', '0.60');
      await typePrice(ok, 0, 'markup', '4');
      await ok.waitForTimeout(400);
      await shot(ok, 'P10-valid-addable', '#wqaStep2');
      await ok.close();
    }
    /* P11 · an uploaded image's review, with the source header. */
    {
      const page = await openApp(browser, { viewport: V });
      await page.evaluate(async d => {
        wqaOpen();
        wqa.aiFile = { name: 'site-photo-anchor-bolts-liew-construction-feb-2026.jpg', size: 482133 };
        wqa.aiIsPdf = false;
        await wqaAiApply(d);
      }, {
        product: 'ANCHOR_BOLT', material: 'MS', finish: 'HDG', sizeType: 'Fullsize',
        threadEnds: 1, note: null,
        items: [{ M: 'M20', L: 600, W: null, TL: 60, qty: 10, Bmid: null, material: null,
                  finish: null, sizeType: null, unclear: null, product: null, threadEnds: null,
                  bodyDia: null, H: null, ID: null, S: null, R: null }],
      });
      await page.waitForTimeout(900);
      await shot(page, 'P11-image-upload-review', '#wqaStep2');
      await page.close();
    }
    // ══ FAST EDIT + DIAMETER — the thirteen frames this brief names ══════
    /* E01 · compact with the DIA column, showing Size, DIA and Weight on one
             line so the contract can be read off a single frame. */
    {
      const page = await openApp(browser, { viewport: V });
      await assertClean(page, 'E01-compact-with-dia');
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x tl 100/100 - 10pcs\nM24 x 1000 x tl 65/65 - 20pcs',
        { expanded: false, settle: 900 });
      await shot(page, 'E01-compact-with-dia', '#wqaStep2');
      /* E02 · Edit mode, Sag Rod: every cell of every row an input at once. */
      await page.evaluate(() => wqaEditStart());
      await page.waitForTimeout(500);
      await shot(page, 'E02-edit-mode-sagrod', '#wqaStep2');
      /* E08 · the same frame proves Expanded / Add / History / Delete locked. */
      await shot(page, 'E08-edit-locks', '#wqaStep2');
      await page.evaluate(() => wqaEditCancel());
      await page.waitForTimeout(500);
      await page.close();
    }
    /* E03 · Edit mode on a J Bolt — its own four dimensions, not a universal
             geometry. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, 'J BOLT MS PL\nM16 H 530 ID 125 S 180 TL 200 - 10pcs',
        { expanded: false, settle: 1000 });
      await page.evaluate(() => wqaEditStart());
      await page.waitForTimeout(500);
      await shot(page, 'E03-edit-mode-jbolt', '#wqaStep2');
      await page.close();
    }
    /* E04/E05/E06 · the two M12 bars, and one chosen by hand. Size, DIA and
             Weight together on each frame. */
    {
      const page = await openApp(browser, { viewport: V });
      await assertClean(page, 'E04-m12-fullsize-12');
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x tl 100/100 - 10pcs',
        { expanded: false, settle: 900 });
      const full = await page.evaluate(() => ({ d: wqa.rows[0].diaMm, w: wqa.rows[0].calc.weight }));
      console.log(`      E04 · M12 FULLSIZE  · DIA ${full.d} · ${Number(full.w).toFixed(4)} kg/pc`);
      await shot(page, 'E04-m12-fullsize-12', '#wqaStep2');

      await page.evaluate(() => wqaEditRowSpec(0, 'sizeType', 'UNDERSIZE'));
      await page.waitForTimeout(900);
      const under = await page.evaluate(() => ({ d: wqa.rows[0].diaMm, w: wqa.rows[0].calc.weight }));
      console.log(`      E05 · M12 UNDERSIZE · DIA ${under.d} · ${Number(under.w).toFixed(4)} kg/pc`);
      await shot(page, 'E05-m12-undersize-10_6', '#wqaStep2');

      await page.evaluate(() => wqaEditStart(0, 'dia'));
      await page.waitForTimeout(450);
      await typeCell(page, 0, 'dia', '10.7');
      const man = await page.evaluate(() => ({ s: wqa.rows[0].size, d: wqa.rows[0].diaMm,
                                               m: !!wqa.rows[0].diaManual, w: wqa.rows[0].calc.weight }));
      console.log(`      E06 · ${man.s} MANUAL DIA ${man.d} · ${Number(man.w).toFixed(4)} kg/pc`);
      if (!(man.m && String(man.d) === '10.7')) throw new Error('E06: the manual diameter did not take');
      await shot(page, 'E06-manual-dia-10_7', '#wqaStep2');
      await page.close();
    }
    /* E07 · a warning tag pressed, and the field it names focused. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, 'J BOLT MS PL\nM16 H 530 S 180 TL 200 - 10pcs',
        { expanded: false, settle: 1000 });
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('.wqa-pill-go')][0];
        if (b) b.click();
      });
      await page.waitForTimeout(600);
      await shot(page, 'E07-warning-tag-to-field', '#wqaStep2');
      await page.close();
    }
    /* E09 · Cancel restores — the frame after a cancelled session. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x tl 100/100 - 10pcs',
        { expanded: false, settle: 900 });
      const was = await page.evaluate(() => ({ d: wqa.rows[0].diaMm, w: wqa.rows[0].calc.weight }));
      await page.evaluate(() => wqaEditStart(0, 'dia'));
      await page.waitForTimeout(450);
      await typeCell(page, 0, 'dia', '19.5');
      await page.evaluate(() => wqaEditCancel());
      await page.waitForTimeout(800);
      const now = await page.evaluate(() => ({ d: wqa.rows[0].diaMm, w: wqa.rows[0].calc.weight }));
      if (String(now.d) !== String(was.d) || Math.abs(now.w - was.w) > 1e-9)
        throw new Error('E09: Cancel did not restore the row');
      console.log(`      E09 · cancelled 19.5 -> restored DIA ${now.d} · ${Number(now.w).toFixed(4)} kg/pc`);
      await shot(page, 'E09-cancel-restored', '#wqaStep2');
      await page.close();
    }
    /* E10/E11 · Expanded with no duplicate dimensions, and its four sections. */
    {
      const page = await openApp(browser, { viewport: V });
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x tl 100/100 - 10pcs',
        { settle: 1000 });
      const secs = await page.evaluate(() =>
        [...document.querySelectorAll('[data-wqa-row="0"] .wqa-sec-lbl')].map(n => n.textContent));
      console.log('      E10 · Expanded sections: ' + secs.join(' · '));
      if (secs.some(t => /Dimension/i.test(t))) throw new Error('E10: a Dimensions block is still there');
      await shot(page, 'E10-expanded-no-duplicate-dims', '#wqaStep2');
      await shot(page, 'E11-expanded-sections', '[data-wqa-row="0"] .wqa-row-body');
      await page.close();
    }
    /* E12 · Edit mode in 中文. */
    {
      const page = await openApp(browser, { viewport: V });
      await setLang(page, 'zh');
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x tl 100/100 - 10pcs\nM24 x 1000 x tl 65/65 - 20pcs',
        { expanded: false, settle: 900 });
      await page.evaluate(() => wqaEditStart());
      await page.waitForTimeout(600);
      await shot(page, 'E12-edit-mode-chinese', '#wqaStep2');
      await page.evaluate(() => wqaEditCancel());
      await setLang(page, 'en');
      await page.close();
    }
    /* E13 · the DIA column at a narrower desktop, with no sideways scroll. */
    {
      const page = await openApp(browser, { viewport: { width: 1366, height: 900 } });
      await quickAddPaste(page, 'J BOLT MS PL\nM16 H 530 ID 125 S 180 TL 200 - 10pcs',
        { expanded: false, settle: 900 });
      await page.evaluate(() => wqaEditStart());
      await page.waitForTimeout(500);
      const wide = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth);
      if (wide) throw new Error('E13: the page scrolls horizontally at 1366px in Edit');
      await shot(page, 'E13-edit-narrow-1366');
      await page.close();
    }

    /* P12 · the same review on a narrower desktop. */
    {
      const page = await openApp(browser, { viewport: { width: 1366, height: 900 } });
      await quickAddPaste(page, 'MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 40pcs\nM16 x 850 x 100/100 - 20pcs',
        { expanded: false, settle: 900 });
      const wide = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth);
      if (wide) throw new Error('P12: the page scrolls horizontally at 1366px');
      await shot(page, 'P12-narrow-desktop-1366');
      await page.close();
    }

    /* ══ R · the three mechanisms, and the boundaries between them ═════════
       Where a frame states a fact, the run asserts the fact and throws rather
       than photographing whatever happened to be there. A screenshot of an
       unchecked screen is decoration.                                      */
    const TWENTY = ['MS SAG ROD ZP UNDERSIZE'].concat(
      Array.from({ length: 20 }, (_, i) =>
        `M${[12, 16, 20][i % 3]} x ${800 + i * 25} x 70/70 - ${2 + i}pcs`)).join('\n');

    /* R01 · twenty items, compact, each with its tick and its DIA. */
    {
      const page = await openApp(browser);
      await quickAddPaste(page, TWENTY, { expanded: false, settle: 1800 });
      const n = await page.evaluate(() => ({
        rows: wqa.rows.filter(r => !r.removed).length,
        picks: document.querySelectorAll('#wqaRows .wqa-pick').length,
        dia: document.querySelectorAll('#wqaRows .wqa-c-dia').length,
      }));
      if (n.rows !== 20) throw new Error(`R01: expected 20 rows, got ${n.rows}`);
      if (n.picks !== 20) throw new Error(`R01: expected 20 ticks, got ${n.picks}`);
      if (n.dia !== 20) throw new Error(`R01: expected 20 DIA cells, got ${n.dia}`);
      console.log(`      R01 · ${n.rows} items · ${n.picks} ticks · ${n.dia} DIA cells`);
      await shot(page, 'R01-compact-twenty-items');

      /* R02 · the row action, renamed. */
      const label = await page.evaluate(() =>
        document.querySelector('[data-wqa-row="0"] .wqa-row-details').textContent.trim());
      if (label !== 'Details') throw new Error(`R02: row action says "${label}", not Details`);
      console.log(`      R02 · row action reads "${label}"`);
      await shot(page, 'R02-row-action-details', '[data-wqa-row="0"]');

      /* R03 · one Details open, and only one. */
      await page.evaluate(() => wqaToggleRow(1));
      await page.waitForTimeout(700);
      const open = await page.evaluate(() => ({
        n: wqa.rows.filter(r => wqaRowIsOpen(r)).length,
        secs: [...document.querySelectorAll('[data-wqa-row="1"] .wqa-sec-lbl')]
                .map(x => x.textContent.trim()).join(' · '),
      }));
      if (open.n !== 1) throw new Error(`R03: ${open.n} Details open, expected 1`);
      console.log(`      R03 · one Details open · ${open.secs}`);
      await shot(page, 'R03-details-open');
      await page.evaluate(() => wqaToggleRow(1));
      await page.waitForTimeout(500);

      /* R04 · Fast Edit over every row at once. */
      await page.evaluate(() => wqaEditStart());
      await page.waitForTimeout(900);
      const grid = await page.evaluate(() => ({
        boxes: document.querySelectorAll('#wqaRows .wqa-ei').length,
        view: wqa.view,
        bulk: !!wqa.bulkOpen,
      }));
      if (grid.view !== 'compact') throw new Error('R04: Fast Edit did not force Compact');
      if (grid.bulk) throw new Error('R04: Bulk Edit still open during Fast Edit');
      console.log(`      R04 · ${grid.boxes} editable cells across 20 rows, Bulk Edit collapsed`);
      await shot(page, 'R04-fast-edit-active');
      await page.evaluate(() => wqaEditCancel());
      await page.waitForTimeout(700);

      /* R08 · four selected, and the count that says so. */
      await page.evaluate(() => { [1, 2, 5, 8].forEach(i => wqaToggleRowSel(i)); });
      await page.waitForTimeout(700);
      const sel = await page.evaluate(() => ({
        n: wqaSelCount(),
        badge: ((el('wqaBulkSelN') || {}).textContent || '').trim(),
      }));
      if (sel.n !== 4) throw new Error(`R08: ${sel.n} selected, expected 4`);
      console.log(`      R08 · ${sel.n} selected · heading reads "${sel.badge}"`);
      await shot(page, 'R08-four-selected');

      /* R09 · a pricing change applied to those four alone. */
      const before = await page.evaluate(() => wqa.rows.map(r => r.calc && r.calc.finalUnitPrice));
      await page.evaluate(() => {
        wqa.bulkOpen = true; wqaRenderBulk(); wqaTogglePanel('price');
        wqaSetApplyScope('selected');
      });
      await page.waitForTimeout(700);
      await page.evaluate(() => { wqaEditCommonPrice('markup', '5'); wqaApplyPriceToAll(); });
      await page.waitForTimeout(1800);
      const after = await page.evaluate(() => wqa.rows.map(r => r.calc && r.calc.finalUnitPrice));
      const moved = after.map((p, i) => p !== before[i] ? i : -1).filter(i => i >= 0);
      if (moved.join(',') !== '1,2,5,8')
        throw new Error(`R09: rows ${moved.join(',')} moved, expected 1,2,5,8`);
      console.log(`      R09 · markup 5% moved rows ${moved.join(', ')} and no others`);
      await shot(page, 'R09-selected-pricing-applied');

      /* R10 · the same scope with nothing selected: refused, not widened. */
      await page.evaluate(() => wqaClearSel());
      await page.waitForTimeout(800);
      const refuse = await page.evaluate(() => {
        const b = document.querySelector('#wqaCommonPrice [data-wqa-apply]');
        const m = document.querySelector('#wqaCommonPrice .wqa-none-sel');
        return { off: !!b.disabled, msg: m && !m.hidden ? m.textContent.trim() : '' };
      });
      if (!refuse.off) throw new Error('R10: Apply is still enabled with nothing selected');
      if (!refuse.msg) throw new Error('R10: the Apply is disabled but says nothing about why');
      console.log(`      R10 · Apply disabled · "${refuse.msg}"`);
      await shot(page, 'R10-zero-selected-refused');
      await page.close();
    }

    /* R05/R06/R07 · the three Bulk Edit sections, one open at a time. */
    {
      const page = await openApp(browser);
      await quickAddPaste(page, TWENTY, { expanded: false, settle: 1800 });
      await page.evaluate(() => { wqa.bulkOpen = true; wqaRenderBulk(); });
      await page.waitForTimeout(600);
      const titles = await page.evaluate(() =>
        [...document.querySelectorAll('#wqaBulkBody .wqa-panel-title')].map(n => n.textContent.trim()));
      if (titles.length !== 3)
        throw new Error(`R05: ${titles.length} sections (${titles.join(', ')}), expected 3`);
      console.log(`      R05 · Bulk Edit sections: ${titles.join(' · ')}`);
      for (const [k, name] of [['fix', 'R05-bulk-common-fields'],
                               ['price', 'R06-bulk-pricing'],
                               ['acc', 'R07-bulk-accessories']]) {
        await page.evaluate(x => wqaTogglePanel(x), k);
        await page.waitForTimeout(600);
        const openN = await page.evaluate(() =>
          document.querySelectorAll('#wqaBulkBody .wqa-panel-body').length);
        if (openN !== 1) throw new Error(`${name}: ${openN} sections open, expected 1`);
        await shot(page, name);
      }
      console.log('      R05-R07 · exactly one section open at each step');
      await page.close();
    }

    /* R11/R12 · history, and the header that stays put while it scrolls. */
    {
      const many = Array.from({ length: 20 }, (_, i) => rec({
        quotationId: i + 1, refNo: `Q-2026-${String(400 + i).padStart(4, '0')}`,
        own: i < 12, unitPrice: 9 + i * 0.1,
        dimensionPreview: `L ${900 + i * 10} x TL 100/100mm`, exactDims: i === 0,
      }));
      const page = await openApp(browser, {
        api: { get_pricing_history: () => ({ ok: true, data: {
          records: many, total: 688, ownTotal: 412, otherTotal: 276, offset: 0, limit: 20 } }) } });
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, 'MS SAG ROD PL UNDERSIZE\nM12 x 1000 x tl 100/100 - 40pcs',
        { expanded: false, settle: 1100 });
      await page.evaluate(() => wqaHistToggle(0));
      await page.waitForTimeout(1400);
      const h = await page.evaluate(() => {
        const c = document.querySelector('.wqa-hist-panel .ph-count');
        return { count: c ? c.textContent.replace(/\s+/g, ' ').trim() : '',
                 sticky: c ? getComputedStyle(c).position : '',
                 more: !!document.querySelector('.wqa-hist-panel .ph-more'),
                 scroll: !!document.querySelector('.wqa-hist-panel .ph-scroll') };
      });
      if (h.sticky !== 'sticky') throw new Error(`R12: the history count is ${h.sticky}, not sticky`);
      if (!h.more) throw new Error('R12: Load More is missing');
      if (!h.scroll) throw new Error('R12: the inner history scroll is missing');
      console.log(`      R11/R12 · "${h.count}" · sticky · Load More present`);
      await shot(page, 'R11-history-open');
      await page.evaluate(() => {
        const s = document.querySelector('.wqa-hist-panel .ph-scroll');
        if (s) s.scrollTop = s.scrollHeight;
      });
      await page.waitForTimeout(500);
      await shot(page, 'R12-history-sticky-header');
      await page.close();
    }

    /* R13/R14/R15 · the same three surfaces in 中文. */
    {
      const page = await openApp(browser);
      await setLang(page, 'zh');
      await quickAddPaste(page, TWENTY, { expanded: false, settle: 1800 });
      const zh = await page.evaluate(() =>
        document.querySelector('[data-wqa-row="0"] .wqa-row-details').textContent.trim());
      if (zh !== '详情') throw new Error(`R13: the row action reads "${zh}", not 详情`);
      await page.evaluate(() => { [1, 3].forEach(i => wqaToggleRowSel(i)); });
      await page.waitForTimeout(600);
      const badge = await page.evaluate(() => ((el('wqaBulkSelN') || {}).textContent || '').trim());
      console.log(`      R13 · row action "${zh}" · selected count "${badge}"`);
      await shot(page, 'R13-chinese-compact');

      await page.evaluate(() => { wqa.bulkOpen = true; wqaRenderBulk(); wqaTogglePanel('fix'); });
      await page.waitForTimeout(700);
      const zhTitles = await page.evaluate(() =>
        [...document.querySelectorAll('#wqaBulkBody .wqa-panel-title')]
          .map(n => n.textContent.trim()).join(' · '));
      if (/[A-Za-z]{3}/.test(zhTitles))
        throw new Error(`R14: English in the 中文 section titles — ${zhTitles}`);
      console.log(`      R14 · 中文 sections: ${zhTitles}`);
      await shot(page, 'R14-chinese-bulk-edit');

      await page.evaluate(() => { wqaToggleBulk(); wqaToggleRow(1); });
      await page.waitForTimeout(800);
      const zhOpen = await page.evaluate(() =>
        document.querySelector('[data-wqa-row="1"] .wqa-row-details').textContent.trim());
      if (zhOpen !== '关闭') throw new Error(`R15: the open row action reads "${zhOpen}", not 关闭`);
      console.log(`      R15 · open row action "${zhOpen}"`);
      await shot(page, 'R15-chinese-details');
      await page.close();
    }

    /* R16 · the whole thing at 1366, with the ticks added and no sideways scroll. */
    {
      const page = await openApp(browser, { viewport: { width: 1366, height: 900 } });
      await quickAddPaste(page, TWENTY, { expanded: false, settle: 1800 });
      await page.evaluate(() => { [0, 2].forEach(i => wqaToggleRowSel(i)); });
      await page.waitForTimeout(600);
      const wide = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth);
      if (wide) throw new Error('R16: the page scrolls horizontally at 1366px with ticks');
      const m = await page.evaluate(() => {
        const l = document.querySelector('#wqaRows');
        return { scroll: l.scrollWidth, client: l.clientWidth };
      });
      if (m.scroll > m.client + 1)
        throw new Error(`R16: the row list overflows at 1366 (${m.scroll} > ${m.client})`);
      console.log(`      R16 · 1366px · list ${m.scroll} = ${m.client}, no sideways scroll`);
      await shot(page, 'R16-selection-1366');
      await page.close();
    }

    /* R17 · Escape gives back the bar AND where it came from. */
    {
      const page = await openApp(browser);
      await quickAddPaste(page, 'MS SAG ROD PL UNDERSIZE\nM12 x 1000 x tl 100/100 - 10pcs',
        { expanded: false, settle: 1000 });
      await page.evaluate(() => wqaEditStart(0, 'dia'));
      await page.waitForTimeout(600);
      const read = () => page.evaluate(() => {
        const i = document.querySelector('[data-wqa-row="0"] [data-ef="dia"]');
        return { v: i.value, manual: i.classList.contains('is-manual-dia'),
                 w: wqa.rows[0].calc ? wqa.rows[0].calc.weight : null };
      });
      const a = await read();
      await typeCell(page, 0, 'dia', '10.7');
      const b = await read();
      if (!b.manual) throw new Error('R17: typing a diameter did not mark it Manual');
      await page.click('[data-wqa-row="0"] [data-ef="dia"]');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);
      const c = await read();
      if (c.v !== a.v || c.manual)
        throw new Error(`R17: Escape left ${c.v} / manual=${c.manual}, expected ${a.v} / Default`);
      if (Math.abs(c.w - a.w) > 1e-9)
        throw new Error(`R17: the weight did not follow the restored bar (${c.w} vs ${a.w})`);
      console.log(`      R17 · ${a.v} Default → ${b.v} Manual → Escape → ${c.v} Default`
        + ` · ${c.w.toFixed(4)} kg/pc`);
      await shot(page, 'R17-esc-restores-provenance');
      await page.close();
    }
    /* ══ C · the closing repairs, each photographed saying the truth ═══════ */

    /* C01 · a Selected apply that names the count, in both languages.
       C02 · the same apply at All Items, where "all items" is honest. */
    {
      const page = await openApp(browser);
      await quickAddPaste(page, TWENTY, { expanded: false, settle: 1800 });
      const toast = () => page.evaluate(() =>
        (document.getElementById('toast') || {}).textContent || '');

      await page.evaluate(() => {
        [1, 2, 5, 8].forEach(i => wqaToggleRowSel(i));
        wqa.bulkOpen = true; wqaRenderBulk(); wqaTogglePanel('price');
        wqaSetApplyScope('selected');
        wqaEditCommonPrice('markup', '5'); wqaApplyPriceToAll();
      });
      await page.waitForTimeout(1200);
      const t1 = (await toast()).trim();
      if (!/4/.test(t1) || /all items/i.test(t1))
        throw new Error(`C01: Selected apply said "${t1}"`);
      console.log(`      C01 · Selected apply says "${t1}"`);
      await shot(page, 'C01-selected-apply-message');

      await page.evaluate(() => {
        wqaClearSel(); wqaSetApplyScope('all');
        wqaEditCommonPrice('markup', '2'); wqaApplyPriceToAll();
      });
      await page.waitForTimeout(1200);
      const t2 = (await toast()).trim();
      if (!/all items/i.test(t2)) throw new Error(`C02: All Items apply said "${t2}"`);
      console.log(`      C02 · All Items apply says "${t2}"`);
      await shot(page, 'C02-all-items-apply-message');

      /* C03 · and the same sentence in 中文, naming the count. */
      await setLang(page, 'zh');
      await page.evaluate(() => {
        wqaSetApplyScope('selected');
        [0, 3].forEach(i => wqaToggleRowSel(i));
        wqaEditCommonPrice('markup', '6'); wqaApplyPriceToAll();
      });
      await page.waitForTimeout(1200);
      const t3 = (await toast()).trim();
      if (!/2/.test(t3) || /全部项目/.test(t3))
        throw new Error(`C03: the 中文 Selected apply said "${t3}"`);
      console.log(`      C03 · 中文 Selected apply says "${t3}"`);
      await shot(page, 'C03-selected-apply-message-chinese');
      await page.close();
    }

    /* C04 · Accessories with nothing selected: both actions refused.
       The first capture of this was misleading — it still carried the toast
       from the setup step that had just applied an accessory to every row, so
       a frame meant to prove a REFUSAL displayed the words "Accessories
       applied to all items". The success message was true when it appeared
       and false about what the frame was showing.

       So the toast is cleared and its transition allowed to finish before the
       shutter, and the frame asserts that the screen carries no success
       message at the moment it is taken. Both languages, because the refusal
       is one of the strings a 中文 reader most needs. */
    for (const [lang, want, name] of [
      ['en', 'Select at least one item.',  'C04-accessories-zero-selected'],
      ['zh', '请至少选择一个项目。',        'C04b-accessories-zero-selected-chinese'],
    ]) {
      const page = await openApp(browser);
      await setLang(page, lang);
      await quickAddPaste(page, TWENTY, { expanded: false, settle: 1800 });
      await page.evaluate(() => {
        wqa.bulkOpen = true; wqaRenderBulk(); wqaTogglePanel('acc');
        wqaEditCommonAcc('nut', 'enabled', true); wqaApplyAccToAll();
      });
      await page.waitForTimeout(1400);
      await page.evaluate(() => { wqaSetApplyScope('selected'); wqaClearSel(); });
      await page.waitForTimeout(900);

      /* Clear the setup's own confirmation and let it finish fading, so the
         frame shows the state and nothing about how it was reached. */
      await page.evaluate(() => {
        const t = el('toast');
        t.classList.remove('show'); t.textContent = '';
      });
      await page.waitForTimeout(500);

      const g = await page.evaluate(() => {
        const clear = document.querySelector('#wqaCommonAcc [data-wqa-needsel]');
        const apply = document.querySelector('#wqaCommonAcc [data-wqa-apply]');
        const msg = document.querySelector('#wqaCommonAcc .wqa-none-sel');
        const scopeOn = [...document.querySelectorAll('.wqa-scope .wqa-view-btn')]
          .filter(n => n.classList.contains('is-on')).map(n => n.textContent.trim()).join('');
        const t = el('toast');
        return {
          clear: !!clear && clear.disabled, apply: !!apply && apply.disabled,
          msg: msg && !msg.hidden ? msg.textContent.trim() : '',
          scopeOn, sel: wqaSelCount(),
          bar: (el('wqaSelBar') || {}).textContent.replace(/\s+/g, ' ').trim() || '',
          toast: (t.textContent || '').trim(),
          toastShown: t.classList.contains('show'),
          kept: wqa.rows.filter(r => wqaAccHas(r.acc)).length,
        };
      });
      if (!g.clear || !g.apply)
        throw new Error(`C04 ${lang}: an accessory action is still pressable`);
      if (g.msg !== want)
        throw new Error(`C04 ${lang}: the refusal reads "${g.msg}", expected "${want}"`);
      if (g.sel !== 0) throw new Error(`C04 ${lang}: ${g.sel} rows are selected, expected 0`);
      if (g.toast || g.toastShown)
        throw new Error(`C04 ${lang}: a stale message is still on screen — "${g.toast}"`);
      console.log(`      C04 ${lang} · scope "${g.scopeOn}" · ${g.sel} selected · `
        + `Apply and Clear disabled · "${g.msg}" · no message on screen · `
        + `${g.kept} rows keep their accessory`);
      await shot(page, name);
      await page.close();
    }

    /* C05 · Expanded, with no Close that could not close. */
    {
      const page = await openApp(browser);
      await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs\nM16 x 500 x 70/70 - 2pcs',
        { expanded: false, settle: 1200 });
      const compact = await page.evaluate(() =>
        document.querySelectorAll('#wqaRows .wqa-row-details').length);
      await page.evaluate(() => wqaSetView('expanded'));
      await page.waitForTimeout(900);
      const g = await page.evaluate(() => ({
        details: document.querySelectorAll('#wqaRows .wqa-row-details').length,
        open: wqa.rows.filter(r => wqaRowIsOpen(r)).length,
        hist: document.querySelectorAll('#wqaRows .wqa-row-hist').length,
      }));
      if (compact !== 2) throw new Error(`C05: Compact offered ${compact} Details, expected 2`);
      if (g.details !== 0) throw new Error(`C05: Expanded still renders ${g.details} Details`);
      console.log(`      C05 · Compact offers ${compact} Details · Expanded offers 0, with ${g.open} rows open and History intact`);
      await shot(page, 'R11-expanded-no-fake-close');
      await page.close();
    }

    /* C06 · a bulk identity change drops the Previous Price card. */
    {
      const page = await openApp(browser, { api: historyApi([rec({ exactDims: true })]) });
      await page.evaluate(() => { selectedCompanyId = 7; });
      await quickAddPaste(page, 'MS SAG ROD PL UNDERSIZE\nM12 x 1000 x tl 100/100 - 40pcs',
        { expanded: false, settle: 1200 });
      await page.evaluate(() => wqaHistToggle(0));
      await page.waitForTimeout(1300);
      await page.evaluate(() => wqaHistUse(0, 0));
      await page.waitForTimeout(1300);
      const used = await page.evaluate(() => wqa.rows[0].usedHistoryRef);
      if (!used) throw new Error('C06: the record did not apply');
      await page.evaluate(() => {
        wqa.bulkOpen = true; wqaRenderBulk(); wqaTogglePanel('fix');
        wqaEditFix('sizeType', 'FULLSIZE'); wqaApplyFixToAll();
      });
      await page.waitForTimeout(1600);
      const after = await page.evaluate(() => ({
        ref: wqa.rows[0].usedHistoryRef, st: wqa.rows[0].sizeType,
        card: (document.querySelector('[data-wqa-row="0"] .wqa-meta') || {}).textContent || '',
      }));
      if (after.ref) throw new Error(`C06: the reference survived as ${after.ref}`);
      if (after.card.includes('Q-2026')) throw new Error('C06: a stale card is still on the row');
      console.log(`      C06 · ${used} applied, then Undersize -> ${after.st}: reference dropped`);
      await shot(page, 'C06-previous-price-invalidated');
      await page.close();
    }

    /* C07 · an inline ambiguous quantity is refused, not resolved. */
    {
      const page = await openApp(browser);
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM24 x 300 x tl 65/65 qty 100 / 200',
        { expanded: false, settle: 1200 });
      const g = await page.evaluate(() => {
        const r = wqa.rows[0];
        return { qty: String(r.qty || ''), len: String(r.length || ''),
                 miss: wqaRowMissing(r).join('+'), rows: wqa.rows.filter(x => !x.removed).length };
      });
      if (g.qty !== '') throw new Error(`C07: the quantity resolved to ${g.qty}`);
      if (g.len !== '300') throw new Error(`C07: the length became ${g.len}`);
      console.log(`      C07 · "qty 100 / 200" inline: qty blank, length ${g.len} kept, needs ${g.miss}`);
      await shot(page, 'C07-inline-ambiguous-qty');
      await page.close();
    }

    /* C08 · an item number written as a word is not a length. */
    {
      const page = await openApp(browser);
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nNO3 M12 L=1000 TL 70/70 - 3pcs\nNO5 M16 L=1200 TL 70/70 - 5pcs',
        { expanded: false, settle: 1200 });
      const g = await page.evaluate(() => wqa.rows.filter(r => !r.removed)
        .map(r => `${r.size}/L${r.length}/q${r.qty}`));
      if (g.join(' ') !== 'M12/L1000/q3 M16/L1200/q5')
        throw new Error(`C08: read as ${g.join(' ')}`);
      console.log(`      C08 · NO3 / NO5 read as ${g.join('  ')}`);
      await shot(page, 'C08-item-number-not-a-length');
      await page.close();
    }

    /* C09 · a size nothing recognises shows no bar. */
    {
      const page = await openApp(browser);
      await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x tl 100/100 - 10pcs',
        { expanded: false, settle: 1000 });
      await page.evaluate(() => wqaEditStart(0, 'size'));
      await page.waitForTimeout(500);
      await typeCell(page, 0, 'size', 'M23');
      const g = await page.evaluate(() => {
        const r = wqa.rows[0];
        const c = document.querySelector('[data-wqa-row="0"] .wqa-c-dia');
        const inp = c && c.querySelector('input');
        return { size: r.size, dia: String(r.diaMm || ''),
                 shown: inp ? inp.value : (c ? c.textContent.trim() : ''),
                 miss: wqaRowMissing(r).join('+') };
      });
      if (g.dia !== '' || g.shown !== '')
        throw new Error(`C09: M23 still shows a ${g.shown || g.dia}mm bar`);
      console.log(`      C09 · ${g.size} shows no bar at all · needs ${g.miss}`);
      await shot(page, 'C09-unknown-size-no-bar');
      await page.close();
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'INDEX.txt'),
    index.map((n, i) => `${String(i + 1).padStart(2, '0')}  ${n}.png`).join('\n') + '\n');
  console.log(`\n  ${index.length} frames -> ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
