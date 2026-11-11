/* ── Quote core parity: the WhatsApp quotation text ────────────────────────
   For every WhatsApp scenario in tests/fixtures/quote-scenarios.js — items as
   production stored them, older vintages, plate, Welding Anchor Set, custom
   dimensions, a custom template, a missing customer, a revised quotation —
   the page's own copy paths (buildQuoteText with and without unit weight,
   buildWAItemsText merged and unmerged, the template preview's item list)
   must produce exactly the text production commit ca5f0a5 produced, byte for
   byte, and quoQuoteText called directly in the page must agree with them.

   The reference Q-TEST-0001 and every customer here are made up.          */
'use strict';
const fs   = require('fs');
const path = require('path');
const { openApp } = require('../lib/harness');
const S = require('../fixtures/quote-scenarios');

const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'quote-baseline-ca5f0a5.json'), 'utf8'));

module.exports = async (browser, A) => {
  A.suite('quote core — the WhatsApp text equals production');
  const page = await openApp(browser);
  let n = 0;
  for (const sc of S.waScenarios(BASE.editor)) {
    const got = await page.evaluate(S.pageDriveWA, sc);
    const want = BASE.wa[sc.id];
    for (const k of Object.keys(want)) { A.eq(got[k], want[k], sc.id + ': ' + k); n++; }
    const direct = await page.evaluate(sc => quoQuoteText({ items: sc.items, header: sc.header, template: sc.template,
      revision: sc.revision, includeUnitWeight: false }), sc);
    A.eq(direct, want.copy, sc.id + ': quoQuoteText called directly');
  }
  A.ok(n >= 70, 'coverage: ' + n + ' texts compared');
  A.eq((page._dcErrors || []).length, 0, 'no page errors');
  await page.close();
};
