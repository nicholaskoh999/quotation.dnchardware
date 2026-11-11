/* ── Quote core parity: the saved item ─────────────────────────────────────
   Every entry-form scenario in tests/fixtures/quote-scenarios.js is pushed
   through the REAL Add to Quotation path of this page (form boxes, finish
   radios, accessory panel, addCurrentItem), and what lands in the quotation —
   and every toast on the way — must equal what production commit ca5f0a5
   stored for the same scenario (tests/fixtures/quote-baseline-ca5f0a5.json).

   The same is done for Quick Add (paste, price, Add All), and each review row
   is also built with quoBuildItemFromRow alone, which must give the same item.

   One field is normalised, because it is the clock: priceAcceptance.at.
   Every inquiry in the fixtures is made up.                                */
'use strict';
const fs   = require('fs');
const path = require('path');
const { openApp, quickAddPaste } = require('../lib/harness');
const S = require('../fixtures/quote-scenarios');

const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'quote-baseline-ca5f0a5.json'), 'utf8'));

module.exports = async (browser, A) => {
  A.suite('quote core — the item Add to Quotation stores equals production');
  const pages = {};
  const pageFor = async (ds) => {
    const key = ds ? JSON.stringify(ds) : '';
    if (!pages[key]) pages[key] = await openApp(browser, ds ? { api: { get_diameter_settings: { ok: true, data: ds } } } : {});
    return pages[key];
  };

  /* The entry forms still have exactly the boxes the core expects. */
  {
    const page = await pageFor(null);
    const got = await page.evaluate(() => {
      const out = {};
      Object.keys(QUO_ITEM_FORM_FIELDS).forEach(t => {
        out[t] = QUO_FORM_CAPTURE_FIELDS.filter(f => document.getElementById(t + '-' + f)).join(',') === QUO_ITEM_FORM_FIELDS[t].join(',');
      });
      return out;
    });
    Object.keys(got).forEach(t => A.ok(got[t], t + ': the form has exactly the boxes QUO_ITEM_FORM_FIELDS lists'));
  }

  let compared = 0;
  for (const sc of S.editorScenarios()) {
    const page = await pageFor(sc.ds);
    /* Record what the form handed the core, so the hand-over is checked too. */
    await page.evaluate(() => {
      if (!window.__quoBuildOrig) window.__quoBuildOrig = window.quoBuildItem;
      window.__quoInputs = [];
      window.quoBuildItem = (inp) => { window.__quoInputs.push({ type: inp.type, fields: Object.assign({}, inp.fields), finish: inp.finish,
        accessories: JSON.parse(JSON.stringify(inp.accessories)) }); return window.__quoBuildOrig(inp); };
    });
    const got = await page.evaluate(S.pageDriveEditor, sc);
    const inputs = await page.evaluate(() => { const x = window.__quoInputs; window.quoBuildItem = window.__quoBuildOrig; return x; });
    const want = BASE.editor[sc.id];
    A.eq(JSON.stringify(got.items.map(S.normaliseItem)), JSON.stringify(want.items), sc.id + ': the stored item(s)');
    A.eq(JSON.stringify(got.toasts), JSON.stringify(want.toasts), sc.id + ': what the person was told');
    if (inputs.length) {
      const first = inputs[0];
      A.eq(JSON.stringify([first.fields, first.finish, first.accessories]), JSON.stringify([sc.fields, sc.finish, sc.accessories]),
           sc.id + ': the form handed the core the boxes, finish and accessories as typed');
    }
    compared++;
  }
  A.ok(compared >= 100, 'coverage: ' + compared + ' entry-form scenarios compared');

  A.suite('quote core — Quick Add rows: Add All and quoBuildItemFromRow equal production');
  for (const sc of S.QUICK_ADD) {
    const page = await openApp(browser);
    await quickAddPaste(page, sc.text, { settle: 300 });
    const got = await page.evaluate(S.pageDriveQuickAdd, sc);
    const want = BASE.quickAdd[sc.id];
    A.eq(JSON.stringify(got.items.map(S.normaliseItem)), JSON.stringify(want.items), sc.id + ': Add All stores what production stored');
    const fromRows = await page.evaluate(({ rows, common }) => rows.map(r => {
      const res = quoBuildItemFromRow(r, common, { at: '<at>' });
      return res.ok ? res.item : { refused: res.code, field: res.field };
    }), got);
    A.eq(JSON.stringify(fromRows.map(S.normaliseItem)), JSON.stringify(want.items), sc.id + ': quoBuildItemFromRow builds the same items');
    A.eq((page._dcErrors || []).length, 0, sc.id + ': no page errors');
    await page.close();
  }

  const errs = Object.values(pages).flatMap(p => p._dcErrors || []);
  A.eq(errs.length, 0, 'no page errors while adding' + (errs.length ? ': ' + errs[0] : ''));
  for (const p of Object.values(pages)) await p.close();
};
