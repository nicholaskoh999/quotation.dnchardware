/* ── Recommendation and price source, core only (QQ R1 Loop #7) ──────────────
   No browser, no page. quoRecommend and quoPriceSource (quo-quote-core.js)
   must answer exactly what QUO's page answered BEFORE the extraction, for
   every scenario in tests/fixtures/recommend-scenarios.json:
     tests/fixtures/recommend-baseline-f4e233c.json was captured from the
     unmodified page functions dcRecommendFor / dcSuggestSource /
     wqaRowSuggestSource of f4e233c (tests/tools/capture-recommend-baseline.js).
   Also: the page (as it is now) still answers the same through its adapters,
   and readable spot checks of the rules the matrix covers.

   Run:  node tests/core/recommend-core.test.js                               */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadCores, ROOT } = require('../lib/core-node');
const cap = require('../tools/capture-recommend-baseline');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; if (fail < 40) console.log('  FAIL  ' + n); } };
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n + '\n        got  ' + JSON.stringify(a) + '\n        want ' + JSON.stringify(b));

const { api } = loadCores();
const { scenarios, rules } = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/recommend-scenarios.json'), 'utf8'));
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/recommend-baseline-f4e233c.json'), 'utf8'));
ok(base.from === 'f4e233c' && base.results.length === scenarios.length, 'baseline is the f4e233c capture of every scenario');

/* The core, called the way a host with no form calls it. `finish` is the
   checked finish; the page reads "nothing checked" as PL (getFinish). */
function coreAnswer(sc) {
  const f = sc.form, dp = sc.dp === 'custom' ? rules : [];
  const rec = api.quoRecommend({ type: sc.type, material: f.material, sizeType: f.sizeType, size: f.size,
    finish: f.finish === undefined ? 'PL' : f.finish, threadLen: f.threadLen, productName: f.productName, dpRules: dp });
  const groups = [];
  for (const setup of cap.setupsFor(rec)) for (const mode of cap.MODES) {
    const editorMode = ['auto', 'no_round', 'manual'].includes(mode) ? mode : 'auto';
    const editor = api.quoPriceSource({ priceMode: editorMode, setup, rec: editorMode === 'manual' ? null : rec });
    const qa = cap.QA_HISTORY.map(h => api.quoPriceSource({ priceMode: mode === 'bogus' ? undefined : mode, setup, rec, history: h }));
    groups.push([editor].concat(qa).map(v => cap.CODE[v] || '?').join(''));
  }
  return { rec, sources: groups.join(' ') };
}

let recDiff = 0, srcDiff = 0;
scenarios.forEach((sc, i) => {
  const got = coreAnswer(sc), want = base.results[i];
  if (JSON.stringify(got.rec) !== JSON.stringify(want.rec)) { recDiff++; eq(got.rec, want.rec, 'recommendation, scenario ' + i + ' ' + JSON.stringify(sc)); }
  if (got.sources !== want.sources) { srcDiff++; eq(got.sources, want.sources, 'sources, scenario ' + i + ' ' + JSON.stringify(sc)); }
});
ok(recDiff === 0 && srcDiff === 0, 'core = page baseline on all ' + scenarios.length + ' scenarios');

/* The page as it is now (adapters calling the core) = the baseline. */
const now = cap.capture(ROOT);
ok(now.every((r, i) => JSON.stringify(r) === JSON.stringify(base.results[i])), 'page now (lifted adapters + cores) = page before, all scenarios');

/* Readable spot checks */
const R = o => api.quoRecommend(Object.assign({ dpRules: [] }, o));
const ms = (finish, tl) => R({ type: 'sagrod', material: 'MS', sizeType: 'UNDERSIZE', size: 'M12', finish, threadLen: tl });
eq(ms('PL', '70/70'), { costRate: '2.80', addCost: '0.60', markup: '0', src: 'built_in' }, 'Sag Rod MS PL, TL 70/70 → 2.80 + 0.60');
eq(ms('ZP', '150/80').addCost, '1.00', 'Sag Rod MS ZP, TL max 150 → +1.00');
eq(ms('ZP', '120.5').addCost, '1.00', 'Sag Rod MS ZP, TL 120.5 → +1.00 (bands meet)');
eq(ms('ZP', '29').addCost, '0.00', 'Sag Rod MS ZP, TL 29 → +0.00');
eq(ms('ZP', '201').addCost, '0.00', 'Sag Rod MS ZP, TL 201 → +0.00');
eq(ms('HDG', '150').addCost, '1.60', 'Sag Rod MS HDG → fixed +1.60 whatever the TL');
eq(R({ type: 'sagrod', material: '4140', sizeType: 'FULLSIZE', size: 'M12', finish: 'HDG' }), { costRate: '11.70', addCost: '3.50', markup: '0', src: 'built_in' }, 'Sag Rod 4140 FULLSIZE M12 HDG → 8.50+3.20 / 2.50+1.00');
eq(R({ type: 'sagrod', material: '4140', sizeType: 'FULLSIZE', size: 'M120', finish: 'PL' }), null, 'Sag Rod 4140 M120 does not prefix-match M12');
eq(R({ type: 'ubolt', material: 'MS', sizeType: 'FULLSIZE', size: 'M12', finish: 'ZP' }), null, 'U Bolt, no rule → no recommendation');
const custom = o => api.quoRecommend(Object.assign({ dpRules: rules }, o));
eq(custom({ type: 'ubolt', material: 'MS', sizeType: 'FULLSIZE', size: 'M12', finish: 'ZP' }), { costRate: '3.30', addCost: '0.50', markup: '10', src: 'default_rule' }, 'U Bolt, custom rule with no finish matches any finish');
eq(custom({ type: 'sagrod', material: 'MS', sizeType: 'UNDERSIZE', size: 'M12', finish: 'ZP', threadLen: '150' }).src, 'default_rule', 'a custom rule leads the built-in Sag Rod rate');
eq(custom({ type: 'anchorbolt', material: 'MS', sizeType: 'FULLSIZE', size: 'M20', finish: 'PL' }), null, 'an inactive rule recommends nothing');
eq(custom({ type: 'stud', material: 'MS', sizeType: 'UNDERSIZE', size: 'M16', finish: 'HDG' }).src, 'default_rule', 'Stud ignores Size Type when matching');
eq(custom({ type: 'lbolt', material: 'SS304', sizeType: 'FULLSIZE', size: 'M10', finish: 'HDG' }).src, 'default_rule', 'stainless ignores the finish when matching');
eq(custom({ type: 'squbolt', material: 'MS', sizeType: 'FULLSIZE', size: 'M16', finish: 'HDG' }).src, 'default_rule', 'a rule saved in lower case (m16) matches M16, as normalizeDPRule upper-cases it');
const rec = ms('ZP', '70');
const S = (priceMode, setup, r, history) => api.quoPriceSource({ priceMode, setup, rec: r === undefined ? rec : r, history });
eq(S('auto', { costRate: '4.20', addCost: '0.60', markup: '0' }), 'built_in', 'typed setup equal to the built-in recommendation → built_in');
eq(S('no_round', { costRate: '4.2', addCost: '.6', markup: '' }), 'built_in', '…equal as numbers (blank markup = 0) → built_in');
eq(S('auto', { costRate: '5.10', addCost: '0.80', markup: '5' }, { costRate: '5.10', addCost: '0.80', markup: '5', src: 'default_rule' }), 'default_rule', 'typed setup equal to a Default Price rule → default_rule');
eq(S('auto', { costRate: '4.20', addCost: '0.61', markup: '0' }), 'manual_recipe', 'typed setup different → manual_recipe');
eq(S('auto', { costRate: '', addCost: '', markup: '' }), 'manual_recipe', 'blank setup → manual_recipe');
eq(S('auto', { costRate: '0', addCost: '0', markup: '0' }, null), 'manual_recipe', 'rate 0, no recommendation → manual_recipe');
eq(S('manual', { costRate: '4.20', addCost: '0.60', markup: '0' }), 'manual', 'Manual Price → manual, even with the recommendation typed');
eq(S('manual', {}, undefined, { usedHistoryRef: 'q:1' }), 'history_manual', 'Manual Price from history → history_manual (QQ has no history)');
eq(S('auto', {}, undefined, { histApplied: ['costRate'] }), 'history_recipe', 'history recipe applied → history_recipe (QQ has no history)');
ok(api.DC_PRICE_SOURCES.includes(S('auto', {})), 'every answer is one of DC_PRICE_SOURCES');

/* The page no longer declares what moved; the adapters call the core. */
const idx = fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8');
for (const n of ['RATES', 'RATES_4140', 'ZP_SURCHARGE', 'get4140Rates', 'getAddCostFromTL', 'normalizeDPRule', 'dpKey', 'makeSystemDPRule', 'getSystemDPRules', 'dcRecSame'])
  ok(!new RegExp('\\n(function\\s+' + n + '\\s*\\(|const\\s+' + n + '\\s*=)').test(idx), n + ' is no longer declared in index.php');
ok(/function dcRecommendFor\(type\)\{\n  if\(!type \|\| type==='others' \|\| !el\(type\+'-costRate'\)\) return null;\n  return quoRecommend\(/.test(idx), 'dcRecommendFor reads the form and calls quoRecommend');
ok(/function dcSuggestSource\(type\)\{[^}]*quoPriceSource\(/.test(idx), 'dcSuggestSource calls quoPriceSource');
ok(/function wqaRowSuggestSource\(r,t\)\{\n  return quoPriceSource\(/.test(idx), 'wqaRowSuggestSource calls quoPriceSource');
ok(/function getDPDisplayRules\(\)\{ return quoDPDisplayRules\(loadDPRules\(\)\); \}/.test(idx), 'getDPDisplayRules hands the page cache to quoDPDisplayRules');
ok(/function findDPMatch\(type,material,sizeType,size,finish\)\{ return quoFindDPMatch\(loadDPRules\(\),/.test(idx), 'findDPMatch hands the page cache to quoFindDPMatch');

console.log((fail ? '\n  FAIL' : '\n  ok  ') + '  recommendation + price source core  (' + pass + ' passed, ' + fail + ' failed)\n');
process.exit(fail ? 1 : 0);
