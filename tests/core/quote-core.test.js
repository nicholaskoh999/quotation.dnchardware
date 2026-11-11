/* ── Quote core, on its own ────────────────────────────────────────────────
   quo-quote-core.js builds the item Add to Quotation stores and the WhatsApp
   quotation text. This file proves that with NO document, NO window and NO
   network the core produces exactly what production commit ca5f0a5 produced
   through the real page (tests/fixtures/quote-baseline-ca5f0a5.json, captured
   with the drivers in tests/fixtures/quote-scenarios.js BEFORE the extraction):

     · every entry-form scenario: the stored item, field for field and in the
       same key order, or the same refusal;
     · every WhatsApp scenario: the copied text, byte for byte, with and
       without unit weight, merged and unmerged.

   One field is normalised, because it is the clock: priceAcceptance.at.

   Run:  node tests/core/quote-core.test.js

   Every customer and inquiry in the fixtures is made up.                  */
'use strict';
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { loadCores, ROOT } = require('../lib/core-node');
const S = require('../fixtures/quote-scenarios');

const coreSrc  = fs.readFileSync(path.join(ROOT, 'quo-quote-core.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8');
const cpanel   = fs.readFileSync(path.join(ROOT, '.cpanel.yml'), 'utf8');
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/quote-baseline-ca5f0a5.json'), 'utf8'));

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; } else { fail++; console.log('  FAIL  ' + name); } }
function eq(got, want, name) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.log('  FAIL  ' + name + '\n        got  ' + g + '\n        want ' + w); }
}

/* ── 1. Loads with nothing but the language ──────────────────────────────── */
const { api, sandbox } = loadCores();
for (const f of ['quoBuildItem', 'quoBuildItemFromRow', 'quoItemInputFromRow', 'quoQuoteText', 'quoWAItemsText', 'quoItemFormData', 'quoItemDesc'])
  ok(typeof api[f] === 'function', 'core exports ' + f);
ok(/^\d+\.\d+\.\d+$/.test(api.QUO_QUOTE_CORE_VERSION), 'core carries a semantic version');
eq(api.QUO_QUOTE_CORE_CONTRACT, 1, 'core contract number');
for (const g of ['document', 'window', 'navigator', 'localStorage', 'sessionStorage', 'fetch', 'XMLHttpRequest'])
  ok(!(g in sandbox), 'the cores did not need ' + g);
ok(!/\b(document|window|localStorage|sessionStorage|fetch|XMLHttpRequest|navigator)\s*[.(]/.test(coreSrc.replace(/\/\*[\s\S]*?\*\//g, '')),
   'the quote core names no DOM, storage or network object');
eq(baseline.commit, 'ca5f0a5692adc8614017ec8054f9bd9fbe337d20', 'the baseline names the production commit it came from');

/* ── 2. The stored item, for every entry-form scenario ───────────────────── */
const inputFor = (sc, acceptance) => ({
  type: sc.type, fields: Object.assign({}, sc.fields), finish: sc.finish,
  accessories: JSON.parse(JSON.stringify(sc.accessories)), totalLengthSrc: sc.lengthSrc,
  customDimensions: [], threadRef: sc.threadRef ? sandbox.dcNormThreadRef(sc.threadRef) : '', acceptance,
});
{
  let built = 0, refused = 0;
  for (const sc of S.editorScenarios()) {
    if (sc.edit) continue;                                   // edits of a saved item: browser suite 80
    const want = baseline.editor[sc.id];
    if (!want) { ok(false, sc.id + ': in the baseline'); continue; }
    const wantItem = want.items[0];
    const acceptance = wantItem
      ? { source: wantItem.priceAcceptance.source, historyRef: wantItem.priceAcceptance.historyRef, at: '<at>' }
      : { at: '<at>' };
    const input = inputFor(sc, acceptance);
    const before = JSON.stringify(input);
    const res = api.quoBuildItem(input);
    ok(JSON.stringify(input) === before, sc.id + ': the input is left as it was');
    if (sc.expect === 'ok') {
      ok(res.ok, sc.id + ': builds' + (res.ok ? '' : ' (refused ' + res.code + ')'));
      if (!res.ok) continue;
      built++;
      eq(S.normaliseItem(res.item), wantItem, sc.id + ': the item production stored');
      eq(JSON.stringify(S.normaliseItem(api.quoBuildItem(inputFor(sc, acceptance)).item)), JSON.stringify(wantItem),
         sc.id + ': the same input builds the same item again');
    } else {
      refused++;
      eq(want.items.length, 0, sc.id + ': production refused it too');
      eq(res.ok ? 'ok' : res.code, sc.expect, sc.id + ': refused as ' + sc.expect);
    }
  }
  ok(built >= 65 && refused >= 30, 'coverage: ' + built + ' items built, ' + refused + ' refusals');
}
{
  /* Both rates wrong: the form names both, in order. */
  const sc = S.editorScenarios().find(s => s.id === 'sagrod-refuse-7');
  const res = api.quoBuildItem(inputFor(sc, {}));
  eq([res.code, res.field, res.more], ['rate_unreadable', 'Cost Rate', [{ code: 'rate_negative', field: 'Additional Cost' }]],
     'two rate refusals come back in the order the form says them');
}
{
  /* Annotations ride along exactly as the form keeps them. */
  const sc = S.editorScenarios().find(s => s.id === 'lbolt-combo-1');
  const res = api.quoBuildItem(Object.assign(inputFor(sc, { at: '<at>' }),
    { customDimensions: [{ label: ' H2 ', value: '530' }, { label: '', value: '' }], threadRef: '1.75P' }));
  eq([res.item.customDimensions, res.item.threadRef], [[{ label: 'H2', value: '530' }], '1.75P'], 'custom dimensions are trimmed and emptied rows dropped');
  eq(api.quoBuildItem({ type: 'plate', fields: {} }).code, 'unsupported_type', 'Plate, Welding Anchor Set and Others are not built here');
  eq(api.quoBuildItem(Object.assign(inputFor(sc, {}), { locked: true })).code, 'locked', 'a locked quotation takes no items');
  eq(api.quoBuildItem(Object.assign(inputFor(sc, { grant: { v: 1.23, src: 'built_in' } }))).code, 'price_changed',
     'a Quick Add price that no longer matches is refused');
}

/* ── 3. The WhatsApp text, byte for byte ─────────────────────────────────── */
{
  let n = 0;
  for (const sc of S.waScenarios(baseline.editor)) {
    const want = baseline.wa[sc.id];
    if (!want) { ok(false, sc.id + ': in the baseline'); continue; }
    const before = JSON.stringify(sc.items);
    const q = w => api.quoQuoteText({ items: sc.items, header: sc.header, template: sc.template, revision: sc.revision, includeUnitWeight: w });
    const got = {
      copy: q(false), copyWeight: q(true),
      merged: api.quoWAItemsText(sc.items, { emptyText: '-', mergeIdentical: true }),
      mergedWeight: api.quoWAItemsText(sc.items, { emptyText: '-', mergeIdentical: true, includeUnitWeight: true }),
      unmerged: api.quoWAItemsText(sc.items, { emptyText: '-', mergeIdentical: false }),
      previewItems: api.quoWAItemsText(sc.items, { emptyText: '(No items yet)' }),
    };
    for (const k of Object.keys(want)) { eq(got[k], want[k], sc.id + ': ' + k); n++; }
    ok(JSON.stringify(sc.items) === before, sc.id + ': the items are left as they were');
  }
  ok(n >= 70, 'coverage: ' + n + ' texts compared');
  /* The page hands in its UI language's two labels; a host that does not gets English. */
  const items = [{ itemType: 'sagrod', material: 'MS', sizeType: 'FULLSIZE', productType: 'SAG ROD', finish: 'PL', size: 'M12 x L 1000',
                   finalUnitPrice: 5, totalAmount: 5, customDimensions: [{ label: 'H2', value: '530' }] }];
  ok(api.quoWAItemsText(items).includes('\n   Custom: H2 530'), 'custom dimensions are prefixed in English by default');
  ok(api.quoWAItemsText(items, { customPrefix: '自定义：' }).includes('\n   自定义： H2 530'), 'or with the prefix the host hands in');
  eq(api.quoFillRefPlaceholders('{quotationNo}', 'Q-TEST-0001', 1), 'REVISED QUOTATION\nQ-TEST-0001-R1', 'a revised quotation heads its number');
}

/* ── 4. Wired into the page exactly once, after the two other cores ──────── */
{
  const sha = crypto.createHash('sha256').update(coreSrc, 'utf8').digest('hex');
  const tags = indexSrc.match(/<script src="quo-quote-core\.js\?v=([0-9a-f]{12})"><\/script>/g) || [];
  eq(tags.length, 1, 'index.php loads the quote core with one <script src>');
  ok(indexSrc.includes('quo-quote-core.js?v=' + sha.slice(0, 12)),
     'the ?v= value is the first 12 hex of the core\'s SHA-256 (' + sha.slice(0, 12) + ') — update it when the core changes');
  ok(indexSrc.indexOf('quo-pricing-core.js?v=') < indexSrc.indexOf('quo-quote-core.js?v='), 'the pricing core loads first');
  ok(indexSrc.indexOf('quo-quote-core.js?v=') < indexSrc.lastIndexOf('<script>'), 'the quote core loads before the page script');
  for (const name of Object.keys(api)) {
    if (!new RegExp('(?:function\\s+' + name + '\\s*\\(|const\\s+' + name + '\\s*=)').test(coreSrc)) continue;
    const re = new RegExp('(?:^|\\n)\\s*(?:function\\s+' + name + '\\s*\\(|(?:const|let|var)\\s+' + name + '\\s*=)');
    ok(!re.test(indexSrc), 'index.php no longer declares ' + name);
  }
  ok(/function dcAddFromForm[\s\S]{0,200}quoBuildItem\(/.test(indexSrc), 'the add path builds through the core');
  ok(/function buildQuoteText[\s\S]{0,120}quoQuoteText\(/.test(indexSrc), 'the copy button formats through the core');
  const m = /export APPFILES="([^"]*)"/.exec(cpanel);
  const files = m ? m[1].split(/\s+/) : [];
  ok(files.indexOf('quo-quote-core.js') >= 0, '.cpanel.yml deploys quo-quote-core.js');
  ok(files.indexOf('quo-quote-core.js') < files.indexOf('version.php'), '... before version.php');
}

console.log(`\n  quote core: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
