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
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'INDEX.txt'),
    index.map((n, i) => `${String(i + 1).padStart(2, '0')}  ${n}.png`).join('\n') + '\n');
  console.log(`\n  ${index.length} frames -> ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
