/* ── Price source for a service create (QQ R1 Loop #7, docs/SERVICE-API.md §4.8.1)
   No browser. Proves, from QUO's OWN code:

     1  the editor's dcSuggestSource() and Quick Add's wqaRowSuggestSource()
        are now thin adapters over the SHARED quoPriceSource()
        (quo-quote-core.js): Manual Price → 'manual' WITHOUT consulting any
        recommendation (the stub for dcRecommendFor throws if called); other
        modes → the recommendation's src when the typed setup equals it, else
        manual_recipe; history sources only with history provenance;
     2  the recommendation inputs (RATES, RATES_4140, get4140Rates,
        getAddCostFromTL, getSystemDPRules, findDPMatch → quoFindDPMatch,
        dcRecommendFor → quoRecommend) are in the shared quote core, and
        index.php no longer declares them; the Default Price rules are the
        only server data and are handed in (dpRules);
     3  an item the service stores with source manual / manual_recipe /
        built_in / default_rule is reopened by the editor (dcFormPaFromSaved,
        the checkHandoff load path) with that source kept;
     4  quoBuildItem records exactly {state:'accepted', value:<final>, source}
        for the source quoPriceSource computes — what dcPaCommit records
        through dcPaMeta for the same setup;
     5  without history, quoPriceSource can only answer the four sources the
        service accepts (DC_SERVICE_CREATE_RECIPE_SOURCES + 'manual'), and the
        service refuses the others.
   Exhaustive equality with the pre-extraction page: tests/core/recommend-core.test.js.

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

// 1: the page adapters, run against the shared core
const adapters = lift('dcSuggestSource') + '\n' + lift('wqaRowSuggestSource');
function run(mode, rec, boxes) {
  const { sandbox } = loadCores();
  sandbox.getPriceMode = () => mode; sandbox.fv = (t, f) => boxes[f];
  sandbox.dcRecommendFor = () => { if (rec === 'THROW') throw new Error('recommendation consulted'); return rec; };
  vm.runInContext(adapters + '\nthis.dcSuggestSource=dcSuggestSource; this.wqaRowSuggestSource=wqaRowSuggestSource;', sandbox);
  return sandbox;
}
const boxes = { costRate: '4.20', addCost: '0.60', markup: '0' };
eq(run('manual', 'THROW', boxes).dcSuggestSource('sagrod'), 'manual', '1: editor, Manual Price → manual, recommendation never consulted');
eq(run('auto', null, boxes).dcSuggestSource('sagrod'), 'manual_recipe', '1: editor, auto, no recommendation → manual_recipe');
eq(run('auto', { costRate: '4.20', addCost: '0.60', markup: '0', src: 'built_in' }, boxes).dcSuggestSource('sagrod'), 'built_in',
   '1: editor, auto, typed numbers EQUAL the built-in recommendation → built_in');
eq(run('auto', { costRate: '4.20', addCost: '0.60', markup: '0', src: 'default_rule' }, boxes).dcSuggestSource('sagrod'), 'default_rule',
   '1: editor, auto, equal to a Default Price rule → default_rule');
eq(run('no_round', { costRate: '4.20', addCost: '1.00', markup: '0', src: 'built_in' }, boxes).dcSuggestSource('sagrod'), 'manual_recipe', '1: editor, different numbers → manual_recipe');
const q = run('auto', null, boxes);
eq(q.wqaRowSuggestSource({ priceMode: 'manual', rec: { src: 'built_in' } }), 'manual', '1: Quick Add, Manual Price, no history → manual');
eq(q.wqaRowSuggestSource({ priceMode: 'manual', usedHistoryRef: 'q:1' }), 'history_manual', '1: Quick Add, Manual Price FROM HISTORY → history_manual (QQ has no history)');
eq(q.wqaRowSuggestSource({ priceMode: 'auto', histApplied: ['costRate'] }), 'history_recipe', '1: Quick Add, history recipe applied → history_recipe (QQ has no history)');
eq(q.wqaRowSuggestSource({ priceMode: 'auto', rec: { costRate: 4.2, addCost: 0.6, markup: 0, src: 'built_in' }, calc: { costRate: '4.2', addCost: '0.6', markup: '0' } }), 'built_in',
   '1: Quick Add, auto, equal to the recommendation → built_in');
ok(/quoPriceSource\(/.test(lift('dcSuggestSource')) && /quoPriceSource\(/.test(lift('wqaRowSuggestSource')), '1: both page functions call the shared quoPriceSource');

// 2: the recommendation inputs are in the shared quote core, not in the page
const coreSrc = fs.readFileSync(path.join(ROOT, 'quo-quote-core.js'), 'utf8');
for (const n of ['RATES', 'RATES_4140', 'getSystemDPRules', 'get4140Rates', 'getAddCostFromTL', 'quoFindDPMatch', 'quoDPDisplayRules', 'quoRecommend', 'quoPriceSource', 'dcRecSame', 'normalizeDPRule']) {
  const re = new RegExp('\\n(function\\s+' + n + '\\s*\\(|const\\s+' + n + '\\s*=)');
  ok(re.test(coreSrc), '2: ' + n + ' is defined in quo-quote-core.js');
  ok(!re.test(index), '2: ' + n + ' is NOT declared in index.php');
}
ok(/return quoRecommend\(\{[\s\S]*?dpRules:loadDPRules\(\)\}\);/.test(lift('dcRecommendFor')), '2: dcRecommendFor hands the page\'s Default Price rules (loadDPRules) to quoRecommend');
ok(/api\('get_default_prices'\)/.test(index) && /dpRulesCache=\(res\.ok\?\(res\.data\|\|\[\]\):\[\]\)\.map\(normalizeDPRule\)/.test(index),
   '2: the page still loads the rules from api.php?action=get_default_prices into dpRulesCache');

// 3: reopen keeps the source
const reopen = lift('dcFormPaFromSaved');
const { api } = loadCores();
for (const src of ['manual', 'manual_recipe', 'built_in', 'default_rule']) {
  const ctx3 = { DC_PRICE_SOURCES: api.DC_PRICE_SOURCES, dcItemFinalUnit: i => i.finalUnitPrice, dcFormPaSig: () => 'sig', dcRenderFormPa: () => {}, dcFormPa: {} };
  vm.createContext(ctx3); vm.runInContext(reopen + '\nthis.go=dcFormPaFromSaved;', ctx3);
  ctx3.go('sagrod', { finalUnitPrice: 3.68, priceAcceptance: { state: 'accepted', value: 3.68, source: src } });
  eq([ctx3.dcFormPa.sagrod.src, ctx3.dcFormPa.sagrod.v, ctx3.dcFormPa.sagrod.saved], [src, 3.68, true], '3: reopened in the editor: source ' + src + ' kept, saved price stands');
}
ok(/function checkHandoff\(\)[\s\S]*?quoteItems=\(payload\.items\|\|\[\]\)/.test(index), '3: checkHandoff loads payload.items (the companies.php Load path) as quoteItems');

// 4: the shared core records what dcPaCommit/dcPaMeta records
const res = api.quoBuildItem({ type: 'sagrod', finish: 'ZP', accessories: api.quoNoAccessories(), acceptance: { source: 'manual', at: 'T' },
  fields: { material: 'MS', sizeType: 'UNDERSIZE', size: 'M12', diameter: '10.9', length: '1000', threadLen: '70/70', costRate: '', addCost: '', markup: '', qty: '10', priceMode: 'manual', manualUnitPrice: '3.68' } });
eq(res.ok && res.item.priceAcceptance, { state: 'accepted', value: 3.68, source: 'manual', at: 'T' }, '4: quoBuildItem records {accepted, 3.68, manual}');
const meta = api.dcPaMeta('manual', '', 3.68); delete meta.at;
eq(meta, { state: 'accepted', value: 3.68, source: 'manual' }, '4: …the same as dcPaMeta(\'manual\', \'\', final), which dcPaCommit uses on the page');
const fields = { material: 'MS', sizeType: 'UNDERSIZE', size: 'M12', diameter: '10.9', length: '1000', threadLen: '70/70', costRate: '4.20', addCost: '0.60', markup: '0', qty: '10', priceMode: 'auto', manualUnitPrice: '' };
const rec = api.quoRecommend({ type: 'sagrod', material: 'MS', sizeType: 'UNDERSIZE', size: 'M12', finish: 'ZP', threadLen: '70/70', dpRules: [] });
const src = api.quoPriceSource({ priceMode: 'auto', setup: fields, rec });
eq(src, 'built_in', '4: typed 4.20 / 0.60 / 0 on MS ZP Sag Rod, TL 70/70 → built_in');
const res2 = api.quoBuildItem({ type: 'sagrod', finish: 'ZP', accessories: api.quoNoAccessories(), acceptance: { source: src, at: 'T' }, fields });
const meta2 = api.dcPaMeta('built_in', '', res2.item.finalUnitPrice); meta2.at = 'T';
eq(res2.ok && res2.item.priceAcceptance, meta2, '4: quoBuildItem records {accepted, final, built_in} = dcPaMeta(\'built_in\', \'\', final)');

// 5: without history, only the four sources the service accepts
const svc = fs.readFileSync(path.join(ROOT, 'service_quotations.php'), 'utf8');
const m = /const DC_SERVICE_CREATE_RECIPE_SOURCES = \[([^\]]*)\];/.exec(svc);
const accepted = m ? m[1].match(/'([a-z_]+)'/g).map(s => s.slice(1, -1)) : [];
eq(accepted, ['manual_recipe', 'built_in', 'default_rule'], '5: the service accepts these recipe sources (plus manual for Manual Price)');
const seen = new Set();
for (const mode of ['auto', 'no_round', 'manual', undefined]) for (const r of [null, rec, Object.assign({}, rec, { src: 'default_rule' })])
  for (const setup of [{}, fields, { costRate: '9', addCost: '0', markup: '0' }]) seen.add((mode === 'manual' ? 'M:' : 'R:') + api.quoPriceSource({ priceMode: mode, setup, rec: r }));
eq([...seen].sort(), ['M:manual', 'R:built_in', 'R:default_rule', 'R:manual_recipe'], '5: with no history the shared function answers only manual (Manual Price) or a recipe source the service accepts');

console.log((fail ? '\n  FAIL' : '\n  ok  ') + '  price source for a service create  (' + pass + ' passed, ' + fail + ' failed)\n');
process.exit(fail ? 1 : 0);
