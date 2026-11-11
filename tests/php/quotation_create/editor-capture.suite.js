/* ── PREPARED, NOT RUN (Loop #7) ─────────────────────────────────────────────
   In-page capture for docs/SERVICE-API.md §4.8.1: what the REAL entry form
   records as priceAcceptance for the same Manual Price setups that
   tests/php/quotation_create/build-items.js builds through quo-quote-core.js,
   and that an item saved through the service reopens in the editor with its
   source kept.

   Deliberately NOT under tests/suites/, so the full browser suite never picks
   it up. To run it (only when no other browser job is running):
       copy this file to tests/suites/96-service-price-source-capture.test.js
       node tests/run.js 96-service-price-source
   and delete the copy afterwards.

   Uses only the harness the other suites use (tests/lib/harness.js). All data
   is synthetic.                                                            */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const { openApp } = require('../lib/harness');
const ROOT = path.resolve(__dirname, '..', '..');

module.exports = async (browser, A) => {
  A.suite('service create — the editor records and reopens the same priceAcceptance');
  const built = JSON.parse(execFileSync('node', [path.join(ROOT, 'tests/php/quotation_create/build-items.js')], { encoding: 'utf8' }));
  const page = await openApp(browser, {});

  const setups = [
    { type: 'sagrod', f: { material: 'MS', sizeType: 'UNDERSIZE', size: 'M12', diameter: '10.9', length: '1000', threadLen: '70/70', qty: '10', priceMode: 'manual', manualUnitPrice: '3.68' }, finish: 'ZP' },
    { type: 'stud',   f: { material: 'MS', size: 'M16', diameter: '16', l: '300', qty: '24', priceMode: 'manual', manualUnitPrice: '2.15' }, finish: 'ZP' },
  ];
  for (let i = 0; i < setups.length; i++) {
    const s = setups[i];
    const pa = await page.evaluate(async (s) => {
      quoteItems = []; editingItemIndex = null;
      if (typeof switchType === 'function') switchType(s.type);
      for (const [k, v] of Object.entries(s.f)) { const e = document.getElementById(s.type + '-' + k); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } }
      const r = document.querySelector(`input[name="${s.type}-finish"][value="${s.finish}"]`); if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      if (typeof calcPreview === 'function') calcPreview(s.type);
      await addCurrentItem();
      const it = quoteItems[0] || null;
      return it && { state: it.priceAcceptance.state, value: it.priceAcceptance.value, source: it.priceAcceptance.source, final: it.finalUnitPrice, total: it.totalAmount };
    }, s);
    const want = built[i].priceAcceptance;
    A.eq(pa && { state: pa.state, value: pa.value, source: pa.source }, { state: want.state, value: want.value, source: want.source },
         s.type + ': the entry form records the same {state, value, source} as quoBuildItem for the service');
    A.eq(pa && [pa.final, pa.total], [built[i].finalUnitPrice, built[i].totalAmount], s.type + ': same unit price and line total');
  }

  /* Reopen: an item as the service stores it (with a server item_uid), through the
     companies.php Load path (sessionStorage loadQuote → checkHandoff). */
  const reopened = await page.evaluate((items) => {
    const stored = items.map((it, n) => Object.assign({}, it, { item_uid: 'itm_' + String(n + 1).padStart(32, '0') }));
    sessionStorage.setItem('loadQuote', JSON.stringify({ id: 1601, ref_no: 'Q-TEST-0001', customer_name: 'Example Trading Sdn Bhd', company_id: 901, items: stored }));
    checkHandoff();
    return quoteItems.map(i => [i.item_uid, i.priceAcceptance && i.priceAcceptance.source, i.finalUnitPrice]);
  }, built);
  A.eq(reopened, built.map((it, n) => ['itm_' + String(n + 1).padStart(32, '0'), 'manual', it.finalUnitPrice]),
       'reopened in the editor: item_uid, source manual and price kept');
};
