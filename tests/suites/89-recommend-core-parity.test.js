/* ── Recommendation / price-source parity (QQ R1 Loop #7) ──────────────────
   In the REAL page: for every scenario in tests/fixtures/recommend-scenarios.json
   it writes the scenario into the product form (material, size type, size,
   thread length, finish radio, Cost Rate / Add Cost / Markup, Price Mode),
   hands the page its Default Price rules (dpRulesCache, as refreshDPRules
   fills it from get_default_prices) and asks the page itself:
     dcRecommendFor(type), dcSuggestSource(type), and wqaRowSuggestSource(row)
     for Quick Add rows with each history provenance.

   (b) BASELINE: where the form holds exactly the scenario's values, the
       page's answers must equal tests/fixtures/recommend-baseline-f4e233c.json
       — the pre-extraction page functions, captured without a browser. Run
       this file inside a `git archive f4e233c` export too: page-before =
       baseline = page-after.
   (a) CORE IN PAGE (only where the page has quo-quote-core 1.1.0+): the page
       answers equal quoRecommend / quoPriceSource called with the values the
       form actually holds.

   All data is synthetic.                                                    */
'use strict';
const fs   = require('fs');
const path = require('path');
const { openApp } = require('../lib/harness');

const FIX  = path.join(__dirname, '..', 'fixtures');
const { scenarios, rules } = JSON.parse(fs.readFileSync(path.join(FIX, 'recommend-scenarios.json'), 'utf8'));
const BASE = JSON.parse(fs.readFileSync(path.join(FIX, 'recommend-baseline-f4e233c.json'), 'utf8')).results;
/* The same setups / modes / history as the capture tool (inlined: an export
   of f4e233c has no tests/tools/capture-recommend-baseline.js). */
const CODE = { built_in: 'b', default_rule: 'd', manual_recipe: 'r', history_recipe: 'R', history_manual: 'H', manual: 'm', legacy_saved: 'l' };
const MODES = ['auto', 'no_round', 'manual', 'bogus'];
const QA_HISTORY = [{}, { usedHistoryRef: 'q:7' }, { usedHistoryRef: 'q:7', usedHistoryRecipe: true }, { histApplied: ['costRate'] }];
const SETUPS_SRC = `(function setupsFor(rec) {
  const s = [{ costRate: '', addCost: '', markup: '' }, { costRate: '0', addCost: '0', markup: '0' }, { costRate: '4.2', addCost: '0.6', markup: '0' }];
  if (rec) {
    s.push({ costRate: rec.costRate, addCost: rec.addCost, markup: rec.markup });
    s.push({ costRate: String(Number(rec.costRate)), addCost: String(Number(rec.addCost)), markup: rec.markup === '0' ? '' : rec.markup });
    s.push({ costRate: rec.costRate, addCost: (Number(rec.addCost) + 0.01).toFixed(2), markup: rec.markup });
    s.push({ costRate: rec.costRate, addCost: rec.addCost, markup: String(Number(rec.markup) + 1) });
  }
  return s;
})`;

module.exports = async (browser, A) => {
  A.suite('recommendation + price source — page before / after / core');
  const page = await openApp(browser);
  const out = await page.evaluate(({ scenarios, rules, CODE, MODES, QA_HISTORY, SETUPS_SRC }) => {
    const setupsFor = (0, eval)(SETUPS_SRC);
    const hasCore = typeof quoRecommend === 'function' && typeof quoPriceSource === 'function';
    const norm = rules.map(normalizeDPRule);
    const setVal = (t, f, v) => { const e = el(t + '-' + f); if (e) e.value = v == null ? '' : String(v); };
    const setFinish = (t, v) => document.querySelectorAll(`input[name="${t}-finish"]`).forEach(r => { r.checked = (v !== undefined && r.value === v); });
    const write = (t, f, setup, mode) => {
      ['material', 'sizeType', 'size', 'threadLen'].forEach(k => setVal(t, k, f[k]));
      setFinish(t, f.finish);
      ['costRate', 'addCost', 'markup'].forEach(k => setVal(t, k, setup ? setup[k] : ''));
      setVal(t, 'priceMode', mode || 'auto');
    };
    /* Does the form hold what the scenario says, in the fields the recommendation reads? */
    const holds = (t, f) => {
      if (!el(t + '-costRate')) return false;
      if (fv(t, 'material') !== String(f.material == null ? '' : f.material)) return false;
      if (fv(t, 'size') !== String(f.size == null ? '' : f.size)) return false;
      if (t !== 'stud' && fv(t, 'sizeType') !== String(f.sizeType == null ? '' : f.sizeType)) return false;
      if (t === 'sagrod' && fv(t, 'threadLen') !== String(f.threadLen == null ? '' : f.threadLen)) return false;
      return getFinish(t) === (f.finish === undefined ? 'PL' : f.finish);
    };
    const res = [];
    scenarios.forEach(sc => {
      dpRulesCache = sc.dp === 'custom' ? norm.slice() : [];
      const t = sc.type, f = sc.form;
      if (!t || t === 'others' || !el(t + '-costRate')) { res.push({ skip: 'no form', rec: dcRecommendFor(t) }); return; }
      write(t, f, null, 'auto');
      const exact = holds(t, f);
      const rec = dcRecommendFor(t);
      const coreRec = hasCore ? quoRecommend({ type: t, material: fv(t, 'material'), sizeType: fv(t, 'sizeType'), size: fv(t, 'size'),
        finish: getFinish(t), threadLen: fv(t, 'threadLen'), productName: fv(t, 'productName'), dpRules: dpRulesCache }) : null;
      const groups = [], coreGroups = [];
      for (const setup of setupsFor(rec)) for (const mode of MODES) {
        write(t, f, setup, mode);
        const editor = dcSuggestSource(t);
        const qa = QA_HISTORY.map(h => wqaRowSuggestSource(Object.assign({ priceMode: mode === 'bogus' ? undefined : mode, rec, calc: setup }, h), t));
        groups.push([editor].concat(qa).map(v => CODE[v] || '?').join(''));
        if (hasCore) {
          const pm = getPriceMode(t);
          const ce = quoPriceSource({ priceMode: pm, setup: { costRate: fv(t, 'costRate'), addCost: fv(t, 'addCost'), markup: fv(t, 'markup') }, rec: pm === 'manual' ? null : coreRec });
          const cq = QA_HISTORY.map(h => quoPriceSource({ priceMode: mode === 'bogus' ? undefined : mode, setup, rec: coreRec, history: h }));
          coreGroups.push([ce].concat(cq).map(v => CODE[v] || '?').join(''));
        }
      }
      res.push({ exact, rec, sources: groups.join(' '), coreRec, coreSources: hasCore ? coreGroups.join(' ') : null });
    });
    return { hasCore, version: typeof QUO_QUOTE_CORE_VERSION === 'string' ? QUO_QUOTE_CORE_VERSION : null, res };
  }, { scenarios, rules, CODE, MODES, QA_HISTORY, SETUPS_SRC });

  let exact = 0, baseDiff = 0, coreDiff = 0, noForm = 0;
  out.res.forEach((r, i) => {
    if (r.skip) { noForm++; return; }
    if (r.exact) {
      exact++;
      const want = BASE[i];
      if (JSON.stringify(r.rec) !== JSON.stringify(want.rec) || r.sources !== want.sources) {
        baseDiff++; if (baseDiff <= 10) A.eq({ rec: r.rec, sources: r.sources }, want, 'scenario ' + i + ' = baseline: ' + JSON.stringify(scenarios[i]));
      }
    }
    if (out.hasCore && (JSON.stringify(r.rec) !== JSON.stringify(r.coreRec) || r.sources !== r.coreSources)) {
      coreDiff++; if (coreDiff <= 10) A.eq({ rec: r.coreRec, sources: r.coreSources }, { rec: r.rec, sources: r.sources }, 'scenario ' + i + ' core = page: ' + JSON.stringify(scenarios[i]));
    }
  });
  A.eq(baseDiff, 0, `page (quote core ${out.version || 'none'}) = pre-extraction baseline on all ${exact} scenarios the form can hold exactly`);
  A.ok(exact >= 1500, 'coverage: ' + exact + ' of ' + scenarios.length + ' scenarios held exactly by the form (' + noForm + ' with no product form)');
  if (out.hasCore) A.eq(coreDiff, 0, 'quoRecommend / quoPriceSource in the page = the page adapters, all ' + (scenarios.length - noForm) + ' scenarios');
  if (process.env.DC_REC_CAPTURE) fs.writeFileSync(process.env.DC_REC_CAPTURE, JSON.stringify(out));
  const errs = page._dcErrors || [];
  A.eq(errs.length, 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await page.close();
};
