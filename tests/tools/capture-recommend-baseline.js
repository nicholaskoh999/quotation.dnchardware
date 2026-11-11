/* ── Recommendation / price-source BASELINE from QUO's own page functions ─────
   No browser. Lifts the page's dcRecommendFor, dcSuggestSource and
   wqaRowSuggestSource, with every top-level declaration they reach (the
   closure computed with espree + eslint-scope; see docs/PRICING-CORE.md
   "Recommendation"), out of the index.php in <root>, loads the three shared
   cores from the SAME <root> into one scope, and stubs only what reads the
   form: el, fv, getFinish (and dpRulesCache, filled the way the page fills it
   from api.php?action=get_default_prices).

   Writes, for tests/fixtures/recommend-scenarios.json, what the page answered.
   The baseline committed with this tool was captured from f4e233c (production
   34ab583 + shared cores + service API), BEFORE the extraction:

     git archive f4e233c index.php quo-*.js | tar -x -C <dir>
     node tests/tools/capture-recommend-baseline.js <dir> tests/fixtures/recommend-baseline-f4e233c.json f4e233c

   With --scenarios it (re)writes the scenario file first (deterministic).   */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const SCEN = path.join(ROOT, 'tests/fixtures/recommend-scenarios.json');

/* The page declarations the three functions reach (closure, excluding the
   form readers el/fv/getFinish and the dpRulesCache variable, which are stubbed). */
const PAGE_DECLS = ['RATES', 'RATES_4140', 'ZP_SURCHARGE', 'get4140Rates', 'getAddCostFromTL', 'normalizeDPRule', 'loadDPRules',
  'dpKey', 'makeSystemDPRule', 'getSystemDPRules', 'getDPDisplayRules', 'findDPMatch', 'dcRecommendFor', 'dcRecSame',
  'buildDesc', 'getPriceMode', 'dcSuggestSource', 'wqaRowSuggestSource'];

function lift(src, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let m = new RegExp('\\n(async )?function ' + esc + '\\(').exec(src);
  if (m) {
    const at = m.index + 1; let i, p = 0, d = 0;
    for (i = src.indexOf('(', at); i < src.length; i++) { if (src[i] === '(') p++; else if (src[i] === ')' && --p === 0) break; }
    for (i = src.indexOf('{', i); i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
    return src.slice(at, i + 1);
  }
  m = new RegExp('\\n(const|let|var) ([^;=\\n]*[ ,])?' + esc + '\\s*=').exec(src);
  if (m) {
    const at = m.index + 1; let d = 0, i;
    for (i = at; i < src.length; i++) { const c = src[i]; if ('{(['.includes(c)) d++; else if ('})]'.includes(c)) d--; else if (c === ';' && d === 0) break; }
    return src.slice(at, i + 1);
  }
  return null;
}

/* The page, in a box: cores + the lifted declarations + form stubs. */
function pageBox(root) {
  const idx = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  for (const f of ['quo-parser-core.js', 'quo-pricing-core.js', 'quo-quote-core.js']) {
    ctx.module = { exports: {} };
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  delete ctx.module;
  /* After the extraction most of these live in quo-quote-core.js; a name the
     page no longer declares must then be one the cores define. */
  const code = PAGE_DECLS.map(n => {
    const c = lift(idx, n); if (c) return c;
    if (vm.runInContext('typeof ' + n, ctx) === 'undefined') throw new Error('declared nowhere: ' + n);
    return '';
  }).join('\n');
  vm.runInContext(`
    let dpRulesCache=[]; let FORM={};
    function el(id){ return (FORM.__type && id===FORM.__type+'-costRate') ? {} : null; }
    function fv(type,field){ const v=FORM[field]; return v==null?'':String(v); }
    function getFinish(type){ return FORM.finish===undefined ? 'PL' : FORM.finish; }
    ${code}
    this.__set=(type,form,dp)=>{ FORM=Object.assign({__type:type},form||{}); dpRulesCache=(dp||[]).map(normalizeDPRule); };
    this.__api={ dcRecommendFor, dcSuggestSource, wqaRowSuggestSource };`, ctx, { filename: 'index.php (lifted)' });
  return ctx;
}

/* Synthetic Default Price rules, in api.php get_default_prices' row shape. */
function dpRow(id, type, material, sizeType, size, finish, cost, add, markup, active) {
  return { id, type, product_type: type, material, sizeType: sizeType || '', size_type: sizeType || '', size, finish: finish || '',
           costRate: cost, cost_rate: cost, addCost: add, additional_cost: add, markup, active: String(active), is_active: active };
}
const RULES = [
  dpRow(1, 'sagrod', 'MS', 'UNDERSIZE', 'M12', 'ZP', 5.1, 0.8, 5, 1),
  dpRow(2, 'ubolt', 'MS', 'FULLSIZE', 'M12', '', 3.3, 0.5, 10, 1),
  dpRow(3, 'stud', 'MS', 'FULLSIZE', 'M16', 'HDG', 7.25, 0, 0, 1),
  dpRow(4, 'anchorbolt', 'MS', 'FULLSIZE', 'M20', 'PL', 9.9, 1.1, 0, 0),
  dpRow(5, 'lbolt', 'SS304', 'FULLSIZE', 'M10', 'ZP', 21, 2, 15, 1),
  dpRow(6, 'sagrod', '4140', 'FULLSIZE', 'M12', 'PL', 8.8, 2.6, 0, 1),
  dpRow(7, 'jbolt', 'MS', 'UNDERSIZE', '', 'PL', 4.05, 0.35, 0, 1),
  dpRow(8, 'squbolt', 'MS', 'FULLSIZE', 'm16', 'HDG', 6.6, 1.6, 2.5, 1),
  dpRow(9, 'lbolt45', 'MS', 'FULLSIZE', 'M12', 'ZP', 4.4, 0.4, 0, 1),
];

function buildScenarios() {
  const out = [];
  const add = (type, form) => { out.push({ type, form, dp: 'none' }); out.push({ type, form, dp: 'custom' }); };
  for (const finish of ['PL', 'ZP', 'HDG', '', undefined])
    for (const sizeType of ['FULLSIZE', 'UNDERSIZE', ''])
      for (const size of ['M12', 'm16', '1/2', 'M120'])
        for (const threadLen of ['', '70/70', '30', '29', '120', '120.5', '150/80', '200', '201', 'abc', ' 60 / 130 '])
          add('sagrod', { material: 'MS', sizeType, size, threadLen, finish });
  for (const material of ['4140', '4140_PLAIN'])
    for (const sizeType of ['FULLSIZE', 'UNDERSIZE'])
      for (const size of ['M12', 'M16', 'M120', 'M1', 'M20', 'm12'])
        for (const finish of ['PL', 'ZP', 'HDG'])
          add('sagrod', { material, sizeType, size, threadLen: '70', finish });
  for (const material of ['SS304', 'S45C_HARDEN_G8_8', 'Y_BAR'])
    add('sagrod', { material, sizeType: 'FULLSIZE', size: 'M12', threadLen: '70', finish: 'ZP' });
  for (const type of ['stud', 'anchorbolt', 'ubolt', 'squbolt', 'lbolt', 'lbolt45', 'jbolt'])
    for (const material of ['MS', 'SS304'])
      for (const sizeType of ['FULLSIZE', 'UNDERSIZE'])
        for (const size of ['M10', 'M12', 'M16', 'M20', ' m12 '])
          for (const finish of ['PL', 'ZP', 'HDG'])
            add(type, { material, sizeType, size, threadLen: '50', finish });
  add('others', { material: 'MS', sizeType: 'FULLSIZE', size: 'M12', finish: 'PL' });
  add('', { material: 'MS' });
  return out;
}

/* Setups to name a source for, given the recommendation. */
function setupsFor(rec) {
  const s = [{ costRate: '', addCost: '', markup: '' }, { costRate: '0', addCost: '0', markup: '0' }, { costRate: '4.2', addCost: '0.6', markup: '0' }];
  if (rec) {
    s.push({ costRate: rec.costRate, addCost: rec.addCost, markup: rec.markup });
    s.push({ costRate: String(Number(rec.costRate)), addCost: String(Number(rec.addCost)), markup: rec.markup === '0' ? '' : rec.markup });
    s.push({ costRate: rec.costRate, addCost: (Number(rec.addCost) + 0.01).toFixed(2), markup: rec.markup });
    s.push({ costRate: rec.costRate, addCost: rec.addCost, markup: String(Number(rec.markup) + 1) });
  }
  return s;
}
/* One letter per source, so the baseline stays small. Order of the letters in
   a group: editor, then Quick Add with each QA_HISTORY entry. Groups: setups
   (setupsFor) x modes (MODES), in that order. */
const CODE = { built_in: 'b', default_rule: 'd', manual_recipe: 'r', history_recipe: 'R', history_manual: 'H', manual: 'm', legacy_saved: 'l' };
const MODES = ['auto', 'no_round', 'manual', 'bogus'];
const QA_HISTORY = [{}, { usedHistoryRef: 'q:7' }, { usedHistoryRef: 'q:7', usedHistoryRecipe: true }, { histApplied: ['costRate'] }];

function capture(root) {
  const box = pageBox(root);
  const { scenarios, rules } = JSON.parse(fs.readFileSync(SCEN, 'utf8'));
  return scenarios.map(sc => {
    const dp = sc.dp === 'custom' ? rules : [];
    box.__set(sc.type, sc.form, dp);
    const rec = box.__api.dcRecommendFor(sc.type);
    const sources = [];
    for (const setup of setupsFor(rec)) for (const mode of MODES) {
      box.__set(sc.type, Object.assign({}, sc.form, setup, { priceMode: mode }), dp);
      const editor = box.__api.dcSuggestSource(sc.type);
      const qa = QA_HISTORY.map(h => box.__api.wqaRowSuggestSource(Object.assign({ priceMode: mode === 'bogus' ? undefined : mode, rec, calc: setup }, h), sc.type));
      sources.push([editor].concat(qa).map(v => CODE[v] || '?').join(''));
    }
    return { rec, sources: sources.join(' ') };
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--scenarios') {
    fs.writeFileSync(SCEN, JSON.stringify({ note: 'Synthetic. Recommendation / price-source matrix; see tests/tools/capture-recommend-baseline.js', rules: RULES, scenarios: buildScenarios() }));
    console.log('wrote ' + SCEN + ' (' + buildScenarios().length + ' scenarios)');
    args.shift();
  }
  if (args.length >= 2) {
    const res = capture(path.resolve(args[0]));
    fs.writeFileSync(args[1], JSON.stringify({ from: args[2] || path.basename(path.resolve(args[0])), results: res }));
    console.log('wrote ' + args[1] + ' (' + res.length + ' results)');
  }
}
module.exports = { RULES, setupsFor, QA_HISTORY, MODES, CODE, pageBox, capture };
