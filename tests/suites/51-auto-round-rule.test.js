/* ── Auto Round — owner-locked band rules ──────────────────────────────────
   Non-Sag products round in RM0.10 bands: x.x0–x.x3 down, x.x4–x.x9 up.
   Sag Rod stays nearest RM0.05. No Round is currency only, Manual Price is
   what was typed, and accessories are added AFTER the bolt is rounded — the
   combined final is never rounded again.                                   */
'use strict';
const { openApp } = require('../lib/harness');

const NON_SAG = [
  ['10.00', '10.00'], ['10.01', '10.00'], ['10.02', '10.00'], ['10.03', '10.00'],
  ['10.04', '10.10'], ['10.05', '10.10'], ['10.09', '10.10'],
  ['10.10', '10.10'], ['10.11', '10.10'], ['10.13', '10.10'], ['10.14', '10.20'], ['10.19', '10.20'],
  ['10.23', '10.20'], ['10.24', '10.30'], ['10.98', '11.00'],
  ['6.40', '6.40'], ['6.43', '6.40'], ['6.44', '6.50'],
];
const SAG = [['4.32', '4.30'], ['4.34', '4.35'], ['4.57', '4.55'], ['5.59', '5.60']];
const FAMILIES = ['stud', 'anchorbolt', 'ubolt', 'squbolt', 'lbolt', 'lbolt45', 'jbolt', 'plate', 'was', 'others'];

module.exports = async (browser, A) => {
  A.suite('auto round — RM0.10 bands for non-Sag, RM0.05 for Sag Rod');
  const page = await openApp(browser);

  const r = await page.evaluate(([NON_SAG, SAG, FAMILIES]) => {
    const run = (type, mode, raw, acc = 0, manual = '') => {
      setFieldValue(type, 'priceMode', mode);
      setFieldValue(type, 'manualUnitPrice', manual);
      const final = resolvePriceMode(type, Number(raw), 0, acc);
      const st = priceCalcState[type];
      setFieldValue(type, 'priceMode', 'auto'); setFieldValue(type, 'manualUnitPrice', '');
      return { final: final.toFixed(2), bolt: st.boltUnitPrice.toFixed(2), rounded: st.roundedUnitPrice.toFixed(2) };
    };
    return {
      helper: NON_SAG.map(([raw]) => roundCustom10(Number(raw)).toFixed(2)),
      families: FAMILIES.map(t => NON_SAG.map(([raw]) => run(t, 'auto', raw).final)),
      sag: SAG.map(([raw]) => run('sagrod', 'auto', raw).final),
      sagNotBand: run('sagrod', 'auto', '6.44').final,
      noRound: ['stud', 'sagrod', 'lbolt'].map(t => run(t, 'no_round', '6.43').final),
      manual: ['stud', 'sagrod', 'lbolt'].map(t => run(t, 'manual', '6.43', 0, '7.20').final),
      accAuto: run('lbolt', 'auto', '6.43', 0.65),
      accSag: run('sagrod', 'auto', '4.32', 0.33),
      accManual: run('lbolt', 'manual', '6.43', 0.65, '7.20'),
      floatSafe: [0.1 + 0.2 + 10, 10.035, 6.4 + 0.04].map(v => roundCustom10(v).toFixed(2)),
    };
  }, [NON_SAG, SAG, FAMILIES]);

  NON_SAG.forEach(([raw, want], i) => A.eq(r.helper[i], want, `non-Sag ${raw} → ${want}`));
  FAMILIES.forEach((t, fi) => {
    const bad = NON_SAG.filter(([, want], i) => r.families[fi][i] !== want).map(([raw]) => raw);
    A.eq(bad.join(','), '', `${t}: every boundary case follows the RM0.10 band rule`);
  });
  SAG.forEach(([raw, want], i) => A.eq(r.sag[i], want, `Sag Rod ${raw} → ${want} (nearest RM0.05, unchanged)`));
  A.eq(r.sagNotBand, '6.45', 'Sag Rod does not use the non-Sag band rule (6.44 → 6.45, not 6.50)');
  A.eq(r.noRound.join(','), '6.43,6.43,6.43', 'No Round keeps 6.43 exactly, every family');
  A.eq(r.manual.join(','), '7.20,7.20,7.20', 'Manual Price is the typed price, every family');
  A.eq(r.accAuto.bolt, '6.40', 'with accessories: the bolt is rounded first (6.43 → 6.40)');
  A.eq(r.accAuto.final, '7.05', 'then RM0.65 of accessories is added — 7.05 is not re-rounded to 7.10');
  A.eq(r.accSag.final, '4.63', 'Sag Rod: 4.30 + 0.33 = 4.63, not re-rounded to 4.65');
  A.eq(r.accManual.final, '7.20', 'Manual Price with accessories still quotes the typed final');
  A.eq(r.accManual.rounded, '6.40', 'and the Auto Round reference is still recorded beside it');
  A.eq(r.floatSafe.join(','), '10.30,10.10,6.50', 'float noise does not move a band boundary');

  // ── Quick Add variants round independently ───────────────────────────────
  const v = await page.evaluate(() => {
    switchType('lbolt');
    const out = [];
    [['6.43', '6.40'], ['6.44', '6.50'], ['10.24', '10.30']].forEach(([raw]) => {
      setFieldValue('lbolt', 'priceMode', 'auto');
      out.push(resolvePriceMode('lbolt', Number(raw), 0, 0).toFixed(2));
    });
    return out;
  });
  A.eq(v.join(','), '6.40,6.50,10.30', 'three different raws on the same product each round on their own');

  // ── a NEW Manual Price item keeps what explains it (no schema change) ────
  const m = await page.evaluate(() => {
    switchType('anchorbolt');
    productEntryTouchedFields.clear();
    document.getElementById('anchorbolt-material').value = 'MS';
    document.getElementById('anchorbolt-sizeType').value = 'FULLSIZE';
    document.getElementById('anchorbolt-size').value = 'M16'; onSizeCommit('anchorbolt');
    document.getElementById('anchorbolt-l').value = '300';
    document.getElementById('anchorbolt-costRate').value = '6.50';
    document.getElementById('anchorbolt-addCost').value = '0.60';
    document.getElementById('anchorbolt-markup').value = '0';
    document.getElementById('anchorbolt-qty').value = '2';
    setFieldValue('anchorbolt', 'priceMode', 'manual'); setFieldValue('anchorbolt', 'manualUnitPrice', '9.00');
    onPriceModeChange('anchorbolt');
    const n = quoteItems.length; addAnchorBolt();
    const it = quoteItems[quoteItems.length - 1], fd = (it && it.formData) || {};
    return { added: quoteItems.length - n, final: it.finalUnitPrice, mode: it.priceMode || fd.priceMode,
             raw: Number(it.rawUnitPrice ?? fd.rawUnitPrice), ar: Number(it.roundedUnitPrice ?? fd.roundedUnitPrice) };
  });
  A.eq(m.added + '/' + m.final + '/' + m.mode, '1/9/manual', 'a Manual Price item is added at the typed price');
  A.ok(m.raw > 0, `and its calculated pre-round price is saved with it (${m.raw})`);
  A.eq(m.ar.toFixed(2), (await page.evaluate(v => roundCustom10(v).toFixed(2), m.raw)), 'and its Auto Round reference, by the new RM0.10 rule');
  await page.close();
};
