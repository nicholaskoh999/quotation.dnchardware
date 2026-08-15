/* Six screenshots, one per category of the audit — not one per case. Several
   related cases share a frame wherever they can be read together.
   Run:  node tests/screenshots.js [outdir]                                   */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp, quickAddPaste, typeRowSize } = require('./lib/harness');

const OUT = process.argv[2] || path.join(__dirname, '..', 'audit-out', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const shot = async (page, name, sel) => {
  const target = sel ? await page.$(sel) : null;
  await (target || page).screenshot({ path: path.join(OUT, name + '.png'), ...(target ? {} : { fullPage: false }) });
  console.log('  ' + name + '.png');
};

const item = (M, L, TL, qty, extra = {}) => Object.assign({
  M, L, W: null, TL, qty, Bmid: null, material: null, finish: null, sizeType: null,
  unclear: null, product: null, threadEnds: null, bodyDia: null,
  H: null, ID: null, S: null, R: null,
}, extra);

(async () => {
  const browser = await launch();
  const V = { width: 1500, height: 1150 };

  // ── 1. metric size corrected by hand, weight and price follow ───────────
  {
    const page = await openApp(browser, { viewport: V });
    await quickAddPaste(page, 'MS SAG ROD PL FULLSIZE\nM23 x 1000 x 100/100 - 5pcs', { settle: 900 });
    await typeRowSize(page, 0, '27');
    await shot(page, '1-metric-manual-size-edit', '#wqaStep2');
    await page.close();
  }

  // ── 2. imperial, unmarked and marked, beside metric ─────────────────────
  {
    const page = await openApp(browser, { viewport: V });
    await quickAddPaste(page, [
      'MS ANCHOR BOLT PL FULLSIZE',
      '1/2 x 100 x 100/100',
      '5/16 x 100 x 100',
      '3/8 x 100 x 100',
      '7/8 x 100 x 100',
      '1 x 100 x 100',
      'M20 x 300 x 100',
    ].join('\n'), { expanded: false, settle: 1000 });
    await shot(page, '2-imperial-parsing', '#wqaStep2');
    await page.close();
  }

  // ── 3. the five-part drawing sheet ──────────────────────────────────────
  {
    const page = await openApp(browser, { viewport: V });
    const part = (L, Bmid, extra = {}) => item('M30', L, '200/200', null,
      Object.assign({ Bmid, threadEnds: 2 }, extra));
    await page.evaluate(async d => { wqaOpen(); await wqaAiApply(d); }, {
      product: 'SAG_ROD', material: 'MS', finish: 'HDG', sizeType: 'Fullsize', threadEnds: 2, note: null,
      items: [part(950, null, { TL: null, threadEnds: null }), part(865, 465),
              part(1000, 600), part(1200, 800), part(1285, 885)],
    });
    await page.waitForTimeout(1200);
    await shot(page, '3-engineering-drawing', '#wqaStep2');
    await page.close();
  }

  // ── 4. the dense anchor-bolt table ──────────────────────────────────────
  {
    const page = await openApp(browser, { viewport: { width: 1500, height: 1400 } });
    const sizes = ['3/8"', 'M8', 'M12', 'M16', '3/4"', 'M18', 'M20', '7/8"', 'M22', 'M24', '1"', 'M27', 'M30'];
    const items = [];
    for (let i = 0; i < 29; i++) {
      items.push(item(sizes[i % sizes.length], 250 + i * 10,
        i === 0 ? 150 : (i === 18 ? 300 : null), 4 + i));
    }
    await page.evaluate(async d => { wqaOpen(); await wqaAiApply(d); }, {
      product: 'ANCHOR_BOLT', material: 'MS', finish: 'HDG', sizeType: 'Fullsize',
      threadEnds: 1, note: null, items,
    });
    await page.waitForTimeout(1500);
    await shot(page, '4-dense-table', '#wqaStep2');
    await page.close();
  }

  // ── 5. previous price: this customer, and another customer's reference ──
  {
    const HIST = [
      { productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M20',
        dimensionPreview: 'L 1000 x TL 100/100mm', qty: 1, unitPrice: 12.5, date: '2026-05-01',
        customer: 'Alpha Sdn Bhd', refNo: 'DC-A-100' },
      { productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M24',
        dimensionPreview: 'L 1000 x TL 100/100mm', qty: 3, unitPrice: 21.0, date: '2026-06-14',
        customer: 'Gamma Steel', refNo: 'DC-G-400' },
    ];
    const page = await openApp(browser, {
      viewport: V,
      api: {
        get_price_history: url => {
          const p = new URL(url).searchParams;
          const cid = p.get('company_id');
          const eq = (a, b) => String(a || '').toUpperCase() === String(b || '').toUpperCase();
          return { ok: true, data: HIST.filter(h =>
            eq(h.cleanSize, p.get('cleanSize')) && eq(h.finish, p.get('finish'))
            && eq(h.sizeType, p.get('sizeType')) && eq(h.material, p.get('material'))
            && (cid == null || h.customer === 'Alpha Sdn Bhd')) };
        },
      },
    });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, [
      'MS SAG ROD PL FULLSIZE',
      'M20 x 1000 x 100/100 - 250pcs',
      'M24 x 1000 x 100/100 - 10pcs',
    ].join('\n'), { settle: 1200 });
    await page.waitForTimeout(1200);
    await shot(page, '5-previous-price', '#wqaStep2');
    await page.close();
  }

  // ── 6. the quotation as the customer receives it ────────────────────────
  {
    let payload = null;
    const page = await openApp(browser, {
      viewport: V,
      api: { save_quotation: (u, r) => { try { payload = JSON.parse(r.postData() || 'null'); } catch (e) {} return { ok: true, id: 42 }; } },
    });
    await quickAddPaste(page, [
      'MS SAG ROD PL FULLSIZE',
      'M20 x 1000 x 100/100 - 4pcs',
      '',
      'MS ANCHOR BOLT HDG FULLSIZE',
      '1/2 x 300 x 100 - 6pcs',
    ].join('\n'), { settle: 1000 });
    await page.evaluate(() => wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '5'); wqaEditPrice(i, 'addCost', '1'); }));
    await page.waitForTimeout(900);
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1200);
    await page.evaluate(async () => {
      document.getElementById('qi-customer').value = 'Alpha Sdn Bhd'; syncQI();
      await api('save_quotation', { ref_no: el('qi-refno').value, quote_date: el('qi-date').value,
        customer_name: 'Alpha Sdn Bhd', items: quoteItems,
        total_amount: quoteItems.reduce((s, i) => s + i.totalAmount, 0) }, 'POST');
    });
    const reopened = await openApp(browser, {
      viewport: V,
      handoff: { id: 42, ref_no: 'DC-TEST-001', customer_name: 'Alpha Sdn Bhd', items: payload.items },
    });
    /* Put the customer-facing text on screen beside the reloaded items, so one
       frame shows the round trip and the output it produces. */
    await reopened.evaluate(() => {
      const box = document.createElement('pre');
      box.style.cssText = 'position:fixed;right:16px;top:16px;width:520px;max-height:92vh;overflow:auto;'
        + 'background:#fff;color:#111;border:2px solid #5b7af5;border-radius:10px;padding:14px;'
        + 'font:12px/1.5 monospace;white-space:pre-wrap;z-index:99999';
      box.textContent = 'REOPENED SAVED QUOTATION → WHATSAPP OUTPUT\n\n' + buildWAItemsText()
        + '\n\n— printed dimension —\n' + quoteItems.map(getPrintItemDimension).join('\n')
        + '\n\n— unit weight kg/pc —\n' + quoteItems.map(i => i.sizeCode + ': ' + i.weight.toFixed(4)).join('\n');
      document.body.appendChild(box);
      goToStep(3);
    });
    await reopened.waitForTimeout(600);
    await shot(reopened, '6-save-reload-output');
    await reopened.close();
    await page.close();
  }

  await browser.close();
  console.log('\n  screenshots in ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
