/* ── Price source for a service create (QQ R1 Loop #7, docs/SERVICE-API.md §4.8.1)
   No browser. Lifts QUO's OWN page functions out of index.php by name and runs
   them with the page state they read stubbed, to prove:

     1  the editor's dcSuggestSource() and Quick Add's wqaRowSuggestSource()
        answer 'manual' for Manual Price WITHOUT consulting any recommendation
        (the stub for dcRecommendFor throws if it is called);
     2  for any other price mode the answer depends on dcRecommendFor() /
        r.rec, i.e. on RATES, RATES_4140, getSystemDPRules, findDPMatch,
        get4140Rates, getAddCostFromTL and the Default Price rules — page-only
        data, defined in index.php and in NO shared core file;
     3  an item the service stores with source 'manual' is reopened by the
        editor (dcFormPaFromSaved, called from the checkHandoff load path) with
        source 'manual' kept, not rewritten to 'legacy_saved';
     4  quoBuildItem (the shared core QQ builds with) records exactly
        {state:'accepted', value:<final>, source:'manual'} for a Manual Price
        item — what dcPaCommit records through dcPaMeta for the same setup.

   Run:  node tests/php/quotation_create/price-source.test.js           */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '../../..');
const index = fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8');
const { loadCores } = require('../../lib/core-node');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.log('  FAIL  ' + n); } };
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n + '\n        got  ' + JSON.stringify(a) + '\n        want ' + JSON.stringify(b));

/** One top-level `function name(...){...}` from index.php, by brace matching. */
function lift(name) {
  const at = index.indexOf('\nfunction ' + name + '(');
  if (at < 0) throw new Error('not found: ' + name);
  let i = index.indexOf('{', at), depth = 0;
  for (; i < index.length; i++) { if (index[i] === '{') depth++; else if (index[i] === '}' && --depth === 0) break; }
  return index.slice(at + 1, i + 1);
}

// 1 + 2: the editor form
const src = lift('dcSuggestSource') + '\n' + lift('dcRecSame') + '\n' + lift('wqaRowSuggestSource');
function run(mode, rec, boxes) {
  const ctx = { getPriceMode: () => mode, fv: (t, f) => boxes[f],
    dcRecommendFor: () => { if (rec === 'THROW') throw new Error('recommendation consulted'); return rec; } };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return ctx;
}
const boxes = { costRate: '4.20', addCost: '0.60', markup: '0' };
eq(run('manual', 'THROW', boxes).dcSuggestSource('sagrod'), 'manual', '1: editor, Manual Price → manual, recommendation never consulted');
eq(run('auto', null, boxes).dcSuggestSource('sagrod'), 'manual_recipe', '2: editor, auto, no recommendation → manual_recipe');
eq(run('auto', { costRate: '4.20', addCost: '0.60', markup: '0', src: 'built_in' }, boxes).dcSuggestSource('sagrod'), 'built_in',
   '2: editor, auto, typed numbers EQUAL the built-in recommendation → built_in (QQ cannot know this)');
eq(run('auto', { costRate: '4.20', addCost: '0.60', markup: '0', src: 'default_rule' }, boxes).dcSuggestSource('sagrod'), 'default_rule',
   '2: editor, auto, equal to a Default Price rule → default_rule (server data)');
eq(run('no_round', { costRate: '4.20', addCost: '1.00', markup: '0', src: 'built_in' }, boxes).dcSuggestSource('sagrod'), 'manual_recipe', '2: editor, different numbers → manual_recipe');
const q = run('auto', null, boxes);
eq(q.wqaRowSuggestSource({ priceMode: 'manual', rec: { src: 'built_in' } }), 'manual', '1: Quick Add, Manual Price, no history → manual');
eq(q.wqaRowSuggestSource({ priceMode: 'manual', usedHistoryRef: 'q:1' }), 'history_manual', '1: Quick Add, Manual Price FROM HISTORY → history_manual (QQ has no history)');
eq(q.wqaRowSuggestSource({ priceMode: 'auto', rec: { costRate: 4.2, addCost: 0.6, markup: 0, src: 'built_in' }, calc: { costRate: '4.2', addCost: '0.6', markup: '0' } }), 'built_in',
   '2: Quick Add, auto, equal to the recommendation → built_in');

// 2: the recommendation inputs are page-only
const cores = ['quo-parser-core.js', 'quo-pricing-core.js', 'quo-quote-core.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
for (const n of ['RATES', 'RATES_4140', 'getSystemDPRules', 'findDPMatch', 'get4140Rates', 'getAddCostFromTL', 'dcRecommendFor', 'loadDPRules']) {
  const re = new RegExp('(function\\s+' + n + '\\s*\\(|const\\s+' + n + '\\s*=)');
  ok(re.test(index), '2: ' + n + ' is defined in index.php');
  ok(!re.test(cores), '2: ' + n + ' is NOT in any shared core (so neither QQ nor the service can compute a recommendation without copying it)');
}

// 3: reopen keeps 'manual'
const reopen = lift('dcFormPaFromSaved');
const ctx3 = { DC_PRICE_SOURCES: loadCores().api.DC_PRICE_SOURCES, dcItemFinalUnit: i => i.finalUnitPrice, dcFormPaSig: () => 'sig', dcRenderFormPa: () => {}, dcFormPa: {} };
vm.createContext(ctx3); vm.runInContext(reopen + '\nthis.go=dcFormPaFromSaved;', ctx3);
ctx3.go('sagrod', { finalUnitPrice: 3.68, priceAcceptance: { state: 'accepted', value: 3.68, source: 'manual' } });
eq([ctx3.dcFormPa.sagrod.src, ctx3.dcFormPa.sagrod.v, ctx3.dcFormPa.sagrod.saved], ['manual', 3.68, true], '3: reopened in the editor: source manual kept, saved price stands');
ok(/function checkHandoff\(\)[\s\S]*?quoteItems=\(payload\.items\|\|\[\]\)/.test(index), '3: checkHandoff loads payload.items (the companies.php Load path) as quoteItems');

// 4: the shared core records what dcPaCommit/dcPaMeta records
const { api } = loadCores();
const res = api.quoBuildItem({ type: 'sagrod', finish: 'ZP', accessories: api.quoNoAccessories(), acceptance: { source: 'manual', at: 'T' },
  fields: { material: 'MS', sizeType: 'UNDERSIZE', size: 'M12', diameter: '10.9', length: '1000', threadLen: '70/70', costRate: '', addCost: '', markup: '', qty: '10', priceMode: 'manual', manualUnitPrice: '3.68' } });
eq(res.ok && res.item.priceAcceptance, { state: 'accepted', value: 3.68, source: 'manual', at: 'T' }, '4: quoBuildItem records {accepted, 3.68, manual}');
const meta = api.dcPaMeta('manual', '', 3.68); delete meta.at;
eq(meta, { state: 'accepted', value: 3.68, source: 'manual' }, '4: …the same as dcPaMeta(\'manual\', \'\', final), which dcPaCommit uses on the page');

console.log((fail ? '\n  FAIL' : '\n  ok  ') + '  price source for a service create  (' + pass + ' passed, ' + fail + ' failed)\n');
process.exit(fail ? 1 : 0);
