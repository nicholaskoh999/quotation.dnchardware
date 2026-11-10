/* ── Pricing core, on its own ──────────────────────────────────────────────
   quo-pricing-core.js is loaded three ways: by index.php, by Node, and bundled
   into DNC Quick Quote. This file proves the last two: with NO document, NO
   window and NO network, the core prices every scenario in
   tests/fixtures/pricing-scenarios.json to exactly the figures production
   commit ca5f0a5 produced through the product forms before the extraction
   (tests/fixtures/pricing-baseline-ca5f0a5.json).

   Run:  node tests/core/pricing-core.test.js

   Every inquiry in the fixtures is made up. This repository is public; real
   customer messages do not belong in it.                                    */
'use strict';
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { loadCores, priceScenario, rowView, ROOT } = require('../lib/core-node');

const coreSrc  = fs.readFileSync(path.join(ROOT, 'quo-pricing-core.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8');
const scenarios = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/pricing-scenarios.json'), 'utf8'));
const baseline  = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/pricing-baseline-ca5f0a5.json'), 'utf8'));

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; } else { fail++; console.log('  FAIL  ' + name); } }
function eq(got, want, name) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.log('  FAIL  ' + name + '\n        got  ' + g + '\n        want ' + w); }
}

/* ── 1. Loads with nothing but the language ──────────────────────────────── */
const { api, sandbox } = loadCores();
ok(typeof api.quoPriceRow === 'function', 'core exports quoPriceRow');
ok(/^\d+\.\d+\.\d+$/.test(api.QUO_PRICING_CORE_VERSION), 'core carries a semantic version');
eq(api.QUO_PRICING_CORE_CONTRACT, 1, 'core contract number');
for (const g of ['document', 'window', 'navigator', 'localStorage', 'fetch', 'XMLHttpRequest']) {
  ok(!(g in sandbox), 'the cores did not need ' + g);
}

/* ── 2. Owner-locked rules, stated once each ─────────────────────────────── */
eq([api.dcDefaultPriceMode('sagrod'), api.dcDefaultPriceMode('lbolt'), api.dcDefaultPriceMode('jbolt'),
    api.dcDefaultPriceMode('stud'), api.dcDefaultPriceMode('anchorbolt')],
   ['no_round', 'auto', 'auto', 'auto', 'auto'], 'Sag Rod starts on No Round, every other product on Auto Round');
eq([api.round05(3.93), api.round05(3.92), api.round05(3.975)], [3.95, 3.9, 4], 'Sag Rod Auto Round: nearest RM0.05');
eq([api.roundCustom10(7.93), api.roundCustom10(7.94), api.roundCustom10(7.99), api.roundCustom10(10.04)],
   [7.9, 8, 8, 10.1], 'other products Auto Round: RM0.10 bands, x.x3 down and x.x4 up');
eq([api.dcAutoRound('sagrod', 3.93), api.dcAutoRound('lbolt', 3.93)], [3.95, 3.9], 'the rounding rule follows the product');
eq(api.dcBarWeight(10.6, 1200), 10.6 * 10.6 * 1200 * 0.0000061654, 'bar weight is diameter² x length x 0.0000061654');
eq([api.dcLBoltTotalLength(20, 600, 100), api.dcJBoltTotalLength(10.6, 300, 50, 60)], [670, 384],
   'L Bolt and J Bolt bar lengths, in whole millimetres');
{
  const p = api.wqaParseText('G8.8 L-BOLT FULLSIZE PLAIN\nM20 L600 W100 TL100 154PCS');
  const q = api.wqaParseText('GR8.8 L BOLT FULLSIZE PLAIN M20 L600 W100 TL100 - 4PCS');
  const h = api.wqaParseText('HT 8.8 ANCHOR BOLT FULLSIZE HDG M24 X 600 TL100 - 16pcs');
  eq([p.rows[0].material, q.rows[0].material, h.rows[0].material], ['4140', '4140', '4140'], 'G8.8 / GR8.8 / HT 8.8 are 4140 QT');
}

/* ── 3. A price is never assumed ─────────────────────────────────────────── */
{
  const { rows } = priceScenario(api, { text: 'MS SAG ROD UNDERSIZE ZP M12 TL70/70\n1200 - 40pcs' });
  eq([rows[0].calc.costRate, rows[0].calc.finalUnitPrice, api.wqaRowAccepted(rows[0])], ['', 0, false],
     'a row nobody has priced has no rate, no price and is not accepted');
  ok(rows[0].calc.weight > 0, 'its weight is known all the same');
}
eq([api.dcRateEntryProblem('3.80'), api.dcRateEntryProblem(''), api.dcRateEntryProblem('-3'), api.dcRateEntryProblem('abc'),
    api.dcRateEntryProblem('2,80'), api.dcRateEntryProblem('1,200'), api.dcRateEntryProblem('0')],
   ['', '', 'negative', 'unreadable', 'unreadable', '', ''], 'a negative or unreadable rate is named, not read as zero');

/* ── 4. Every scenario equals production, field for field ────────────────── */
ok(scenarios.length >= 200, 'the scenario list is there (' + scenarios.length + ')');
eq(baseline.commit, 'ca5f0a5692adc8614017ec8054f9bd9fbe337d20', 'the baseline names the production commit it came from');
{
  let rowsSeen = 0, priced = 0, accepted = 0;
  const norm = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x === undefined ? null : x)).replace(/"__undefined__"/g, 'null'));
  for (const sc of scenarios) {
    const want = (baseline.results[sc.id] || {}).rows;
    if (!want) { ok(false, sc.id + ': in the baseline'); continue; }
    const { rows, detail } = priceScenario(api, sc);
    if (rows.length !== want.length) { eq(rows.length, want.length, sc.id + ': row count'); continue; }
    rows.forEach((r, i) => {
      rowsSeen++;
      const w = norm(want[i]); const form = w.form; delete w.form; delete w.pa;
      eq(norm(rowView(api, r)), w, sc.id + ' row ' + (i + 1) + ': the row as production left it');
      if (w.accepted) accepted++;
      if (!form) { ok(detail[i] === null, sc.id + ' row ' + (i + 1) + ': not priced, as in production'); return; }
      priced++;
      const d = detail[i];
      if (!d) { ok(false, sc.id + ' row ' + (i + 1) + ': priced in production, not by the core'); return; }
      eq({ diameter: d.diameter, weight: d.weight, base: 'RM ' + d.base.toFixed(2), rawUnitPrice: d.rawUnitPrice,
           roundedUnitPrice: d.state.roundedUnitPrice, autoFinalUnitPrice: d.state.autoFinalUnitPrice,
           boltUnitPrice: d.state.boltUnitPrice, finalUnitPrice: d.state.finalUnitPrice,
           accessoriesCost: d.state.accessoriesCost, priceMode: d.state.priceMode },
         { diameter: form.diameter, weight: form.weight, base: form.baseText, rawUnitPrice: form.rawUnitPrice,
           roundedUnitPrice: form.roundedUnitPrice, autoFinalUnitPrice: form.autoFinalUnitPrice,
           boltUnitPrice: form.boltUnitPrice, finalUnitPrice: form.finalUnitPrice,
           accessoriesCost: form.accessoriesCost, priceMode: form.priceMode },
         sc.id + ' row ' + (i + 1) + ': diameter, weight, base, raw, rounding and final price');
      if (form.totalLength !== '') eq(d.totalLength, parseFloat(form.totalLength), sc.id + ' row ' + (i + 1) + ': bar length');
    });
  }
  ok(rowsSeen >= 500 && priced >= 400 && accepted >= 300, 'coverage: ' + rowsSeen + ' rows, ' + priced + ' priced, ' + accepted + ' accepted');
}

/* ── 5. Custom Diameter Settings decide the bar, and can be withdrawn ────── */
{
  const text = 'MS SAG ROD UNDERSIZE ZP M12 TL70/70\n1200 - 40pcs';
  const price = { costRate: '3.80', addCost: '0.60', markup: '15' };
  const withRule = priceScenario(api, { text, price, ds: [{ id: '1', product_type: 'sagrod', material: 'MS', size_type: 'UNDERSIZE', size: 'M12', diameter: '10.9' }] });
  const builtIn = priceScenario(api, { text, price });
  eq([withRule.rows[0].diaMm, builtIn.rows[0].diaMm], ['10.9', '10.6'], 'a rule outranks the built-in table; without it the table answers');
  ok(withRule.rows[0].calc.finalUnitPrice > builtIn.rows[0].calc.finalUnitPrice, 'and the price follows the bar');
}

/* ── 6. Wired into the page exactly once, after the parser core ──────────── */
{
  const sha = crypto.createHash('sha256').update(coreSrc, 'utf8').digest('hex');
  const tags = indexSrc.match(/<script src="quo-pricing-core\.js\?v=([0-9a-f]{12})"><\/script>/g) || [];
  eq(tags.length, 1, 'index.php loads the pricing core with one <script src>');
  ok(indexSrc.includes('quo-pricing-core.js?v=' + sha.slice(0, 12)),
     'the ?v= value is the first 12 hex of the core\'s SHA-256 (' + sha.slice(0, 12) + ') — update it when the core changes');
  ok(indexSrc.indexOf('quo-parser-core.js') < indexSrc.indexOf('quo-pricing-core.js'), 'the parser core loads first');
  ok(indexSrc.indexOf('quo-pricing-core.js') < indexSrc.lastIndexOf('<script>'), 'the pricing core loads before the page script');
  for (const name of Object.keys(api)) {
    if (!new RegExp('(?:function\\s+' + name + '\\s*\\(|const\\s+' + name + '\\s*=)').test(coreSrc)) continue;   // the parser core's
    const re = new RegExp('(?:^|\\n)\\s*(?:function\\s+' + name + '\\s*\\(|(?:const|let|var)\\s+' + name + '\\s*=)');
    ok(!re.test(indexSrc), 'index.php no longer declares ' + name);
  }
}

/* ── 7. The bar calculators in the page hold no arithmetic of their own ──── */
{
  const a = indexSrc.indexOf('function calcSagRod(){'), b = indexSrc.indexOf('function fieldExists(type,field){');
  ok(a > 0 && b > a, 'the calculators are where this test expects them');
  const region = indexSrc.slice(a, b);
  ok(!/0\.0000061654/.test(region), 'no steel constant left in the bar calculators');
  ok(!/\(1\+markup\/100\)/.test(region), 'no inline markup formula left in the bar calculators');
  ok(!/weight\*costRate\+addCost/.test(region), 'no inline base-price formula left in the bar calculators');
  ok(/function resolvePriceMode[\s\S]{0,700}dcResolvePrice\(/.test(indexSrc), 'resolvePriceMode asks the core');
}

/* ── 8. On the deploy allowlist, version.php still last ──────────────────── */
{
  const yml = fs.readFileSync(path.join(ROOT, '.cpanel.yml'), 'utf8');
  const files = (/export APPFILES="([^"]+)"/.exec(yml) || [, ''])[1].split(/\s+/);
  ok(files.includes('quo-pricing-core.js'), '.cpanel.yml APPFILES deploys quo-pricing-core.js');
  eq(files[files.length - 1], 'version.php', 'version.php is still the last file deployed');
}

console.log('\n  pricing core: ' + (pass + fail) + ' assertions, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
