/* ── Company rules, and the one diameter ───────────────────────────────────
   Phases 2 and 3.

   Two business rules that the previous pass had backwards, both because it
   read "never guess" as "never answer":

     A company rule IS an answer. Anything else is a guess.
     The diameter Diameter Settings shows IS the diameter weight uses.       */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const K = 0.0000061654;
const DS_UNDER_4140_M12 = [
  { id: '1', type: 'sagrod', material: '4140', sizeType: 'UNDERSIZE', size: 'M12', diameter: 10.7 },
];
const DS_MS_M20_CUSTOM = [
  { id: '2', type: 'sagrod', material: 'MS', sizeType: 'FULLSIZE', size: 'M20', diameter: 19.4 },
];

module.exports = async (browser, A) => {
  const S = A.suite('company rules — a size type with a reason, a diameter with one source');
  const page = await openApp(browser);

  // ── PHASE 2: the rules, stated once, in one place ────────────────────────
  const rules = await page.evaluate(() => {
    const q = (p, m, s) => dcCompanySizeType(p, m, s);
    return {
      msM12:      q('sagrod', 'MS', 'M12'),
      msHalfInch: q('sagrod', 'MS', '1/2'),
      msM20:      q('sagrod', 'MS', 'M20'),
      msM30:      q('sagrod', 'MS', 'M30'),
      qtM20:      q('sagrod', '4140', 'M20'),
      qtM30:      q('sagrod', '4340', 'M30'),
      qtPlainM24: q('sagrod', '4140_PLAIN', 'M24'),
      qtM12:      q('sagrod', '4140', 'M12'),
      qt4340M12:  q('sagrod', '4340', 'M12'),
      ssM20:      q('sagrod', 'SS304', 'M20'),
      s45cM20:    q('sagrod', 'S45C', 'M20'),
    };
  });
  A.eq(rules.msM12.sizeType, 'UNDERSIZE', 'MS at M12 is undersize — a company rule');
  A.eq(rules.msM12.why, 'companyDefault', 'and it says the rule is the company\'s');
  A.eq(rules.msHalfInch.sizeType, 'UNDERSIZE', 'and the half inch with it');
  A.eq(rules.msM20.sizeType, '', 'MS at M20 has no company rule — the row asks');
  A.eq(rules.msM30.sizeType, '', 'nor M30');
  A.eq(rules.qtM20.sizeType, 'FULLSIZE', '4140 QT away from M12 is fullsize — a company rule');
  A.eq(rules.qtM30.sizeType, 'FULLSIZE', '4340 likewise');
  A.eq(rules.qtPlainM24.sizeType, 'FULLSIZE', 'and plain 4140');
  A.eq(rules.ssM20.sizeType, '', 'stainless has no rule — the row asks');
  A.eq(rules.s45cM20.sizeType, '', 'nor S45C');

  // M12 is the exception: the blanket rule declines and the settings answer.
  A.eq(rules.qtM12.why, 'configured',
    '4140 QT at M12 is NOT answered by the blanket rule — it is answered by what is configured');
  A.eq(rules.qtM12.sizeType, 'FULLSIZE',
    'and with only a fullsize M12 configured, that is the established rule');
  A.eq(rules.qt4340M12.why, 'configured', '4340 at M12 the same way');

  // ── and when the company configures both, there is no established rule ───
  {
    const both = await openApp(browser, { api: { get_diameter_settings: { ok: true, data: DS_UNDER_4140_M12 } } });
    const r = await both.evaluate(() => ({
      qtM12: dcCompanySizeType('sagrod', '4140', 'M12'),
      types: dcConfiguredSizeTypes('sagrod', '4140', 'M12').sort(),
    }));
    A.eq(r.types.join(','), 'FULLSIZE,UNDERSIZE',
      'the company now stocks 4140 M12 in both size types');
    A.eq(r.qtM12.sizeType, '',
      'so there is no established rule and nothing is guessed — the row asks');
    await both.close();
  }

  // ── the rule reaches a real row, and says where it came from ─────────────
  await quickAddPaste(page, 'MS SAG ROD PL\nM12 x 1000 x 75/75 - 50pcs', { settle: 900 });
  let rows = await rowState(page);
  A.eq(rows[0].sizeType, 'UNDERSIZE', 'a mild-steel M12 row takes the company rule');
  A.includes(rows[0].badges, 'company default', 'and the row says the customer did not state it');
  A.near(rows[0].weight, 10.6 * 10.6 * 1000 * K, 1e-9, 'and is weighed on the undersize bar');

  await quickAddPaste(page, 'MS SAG ROD PL\nM20 x 1000 x 75/75 - 50pcs', { settle: 900 });
  rows = await rowState(page);
  A.eq(rows[0].sizeType, '', 'a mild-steel M20 row has no rule to take');
  A.ok(rows[0].missing.includes('Size Type'), 'so it asks for one');
  A.excludes(rows[0].badges, 'company default', 'and claims no rule it did not use');

  // ── PHASE 3: one diameter, and the settings screen shows it ─────────────
  const builtIn = await page.evaluate(() => {
    const rows = getDSDisplayRules().filter(r => r.type === 'sagrod');
    const say = (mat, st, size) => {
      const hit = rows.find(r => r.material === mat && r.sizeType === st
        && String(r.size).toUpperCase() === size.toUpperCase());
      return hit ? String(hit.diameter) : '(not shown)';
    };
    return {
      shownMsUnder12:  say('MS', 'UNDERSIZE', 'M12'),
      shownMsFull12:   say('MS', 'FULLSIZE', 'M12'),
      shown4140Full12: say('4140', 'FULLSIZE', 'M12'),
      shown4140Under12: say('4140', 'UNDERSIZE', 'M12'),
      usedMsUnder12:   String(dcEffectiveDiameter('sagrod', 'MS', 'UNDERSIZE', 'M12')),
      usedMsFull12:    String(dcEffectiveDiameter('sagrod', 'MS', 'FULLSIZE', 'M12')),
      used4140Full12:  String(dcEffectiveDiameter('sagrod', '4140', 'FULLSIZE', 'M12')),
      used4140Under12: String(dcEffectiveDiameter('sagrod', '4140', 'UNDERSIZE', 'M12')),
    };
  });
  A.eq(builtIn.shownMsUnder12, builtIn.usedMsUnder12, 'MS undersize M12: shown is used');
  A.eq(builtIn.shownMsFull12, builtIn.usedMsFull12, 'MS fullsize M12: shown is used');
  A.eq(builtIn.shown4140Full12, builtIn.used4140Full12, '4140 fullsize M12: shown is used');
  A.eq(builtIn.shown4140Full12, '13', 'and 4140 fullsize M12 really is the 13mm bar');
  A.eq(builtIn.shown4140Under12, '(not shown)',
    'no undersize 4140 M12 is advertised, because none is used — this screen used to say 10.7 and weigh 10.6');

  /* Every row the settings screen prints is the answer the calculator gives. */
  const drift = await page.evaluate(() => getDSDisplayRules()
    .filter(r => r.source === 'system')
    .filter(r => String(r.diameter) !== String(dcBuiltInDiameter(r.type, r.material, r.sizeType, r.size)))
    .map(r => [r.type, r.material, r.sizeType, r.size, r.diameter].join('/')));
  A.eq(drift.length, '0', 'no system default disagrees with the calculator: ' + drift.slice(0, 5).join(' | '));

  // ── change the setting, change the weight ───────────────────────────────
  {
    const configured = await openApp(browser, { api: { get_diameter_settings: { ok: true, data: DS_MS_M20_CUSTOM } } });
    const used = await configured.evaluate(() => ({
      effective: String(dcEffectiveDiameter('sagrod', 'MS', 'FULLSIZE', 'M20')),
      shown: (getDSDisplayRules().find(r => r.type === 'sagrod' && r.material === 'MS'
        && r.sizeType === 'FULLSIZE' && String(r.size).toUpperCase() === 'M20') || {}).diameter,
    }));
    A.eq(used.effective, '19.4', 'the configured 19.4mm is the effective diameter, not the built-in 20');
    A.eq(String(used.shown), '19.4', 'and the settings screen shows the same number');

    await quickAddPaste(configured, 'MS SAG ROD PL FULLSIZE\nM20 x 1000 x 100/100 - 4pcs', { settle: 900 });
    const r = (await rowState(configured))[0];
    A.near(r.weight, 19.4 * 19.4 * 1000 * K, 1e-9,
      'and a Quick Add row is weighed on the configured bar, not on the nominal 20mm');
    A.includes(r.shownTotalWeight, (19.4 * 19.4 * 1000 * K * 4).toFixed(4), 'total weight follows it');

    /* The manual entry form reads the same source. */
    const form = await configured.evaluate(() => {
      switchType('sagrod');
      document.getElementById('sagrod-material').value = 'MS';
      document.getElementById('sagrod-sizeType').value = 'FULLSIZE';
      document.getElementById('sagrod-size').value = 'M20'; onSizeCommit('sagrod');
      return fv('sagrod', 'diameter');
    });
    A.eq(form, '19.4', 'the manual form resolves the same configured diameter');
    await configured.close();
  }

  /* ── M12 and 1/2" share a rule; they are not the same size ───────────────
     The confirmed business rule, case by case. M12 and 1/2" belong to the same
     size-type group in every material — but they remain two different sizes,
     each weighed on its own diameter, and neither is ever written as the
     other. */
  const sizeTypeTable = await page.evaluate(() => {
    const ask = (material, size) => {
      const r = dcCompanySizeType('sagrod', material, size);
      return (r.sizeType || 'NEEDS SIZE TYPE') + (r.why === 'companyDefault' ? ' (company default)'
                                                : r.why === 'configured' ? ' (from settings)' : '');
    };
    return {
      msM12:      ask('MS', 'M12'),
      msHalf:     ask('MS', '1/2'),
      msHalfMark: ask('MS', '1/2"'),
      msM20:      ask('MS', 'M20'),
      qtM12:      ask('4140', 'M12'),
      qtHalf:     ask('4140', '1/2'),
      qtM20:      ask('4140', 'M20'),
      qtHalfInch: ask('4140', '3/4'),
      s4340M12:   ask('4340', 'M12'),
      s4340Half:  ask('4340', '1/2'),
      s4340M20:   ask('4340', 'M20'),
      plainM12:   ask('4140_PLAIN', 'M12'),
      plainHalf:  ask('4140_PLAIN', '1/2'),
      plainM20:   ask('4140_PLAIN', 'M20'),
      unknown:    ask('SS304', 'M20'),
      /* Two different sizes, whatever rule they share. */
      normM12: normalizeSizeValue('M12'),
      normHalf: normalizeSizeValue('1/2'),
      diaM12: dcEffectiveDiameter('sagrod', 'MS', 'UNDERSIZE', 'M12'),
      diaHalf: dcEffectiveDiameter('sagrod', 'MS', 'UNDERSIZE', '1/2'),
    };
  });

  A.eq(sizeTypeTable.msM12, 'UNDERSIZE (company default)', 'MS + M12 is undersize by company rule');
  A.eq(sizeTypeTable.msHalf, 'UNDERSIZE (company default)', 'MS + 1/2" too — the same rule covers both');
  A.eq(sizeTypeTable.msHalfMark, 'UNDERSIZE (company default)', 'written with its inch mark or without it');
  A.eq(sizeTypeTable.msM20, 'NEEDS SIZE TYPE', 'while an MS M20 is asked for, not guessed');
  /* The exception group behaves as one: in 4140 QT, 4340 QT and plain 4140 the
     blanket fullsize rule DECLINES both M12 and 1/2", and the answer then comes
     from what the company has actually configured — or the row asks. What is
     configured differs between the two sizes, which is the rule working rather
     than an inconsistency: a fullsize M12 is stocked, a 1/2" is not. */
  A.eq(sizeTypeTable.qtM12, 'FULLSIZE (from settings)',
    '4140 QT + M12 declines the blanket rule and takes the one size type configured for it');
  A.eq(sizeTypeTable.qtHalf, 'NEEDS SIZE TYPE',
    'and 4140 QT + 1/2" declines it the same way — with nothing configured, the row asks');
  A.eq(sizeTypeTable.qtM20, 'FULLSIZE (company default)', 'every other 4140 QT size defaults to fullsize');
  A.eq(sizeTypeTable.qtHalfInch, 'FULLSIZE (company default)', 'including an inch size that is not 1/2"');
  A.eq(sizeTypeTable.s4340M12, 'FULLSIZE (from settings)', '4340 QT + M12 is in the same exception group');
  A.eq(sizeTypeTable.s4340Half, 'NEEDS SIZE TYPE', 'and 4340 QT + 1/2" with it');
  A.eq(sizeTypeTable.s4340M20, 'FULLSIZE (company default)', 'with 4340 QT defaulting to fullsize elsewhere');
  A.eq(sizeTypeTable.plainM12, 'NEEDS SIZE TYPE',
    'plain 4140 is its own material: nothing is configured for its M12, so nothing is invented');
  A.eq(sizeTypeTable.plainHalf, 'NEEDS SIZE TYPE', 'and nothing for its 1/2" either');
  A.eq(sizeTypeTable.plainM20, 'FULLSIZE (company default)', 'while its other sizes take the default');
  A.eq(sizeTypeTable.unknown, 'NEEDS SIZE TYPE',
    'a material the business has stated no rule for is never given one');
  A.eq(sizeTypeTable.normM12, 'M12', 'M12 stays M12');
  A.eq(sizeTypeTable.normHalf, '1/2', 'and 1/2" stays 1/2" — one rule, two sizes');
  A.eq(sizeTypeTable.diaM12, '10.6', 'an undersize M12 is cut from 10.6mm');
  A.eq(sizeTypeTable.diaHalf, '10.9', 'and an undersize 1/2" from 10.9mm — never the same bar');

  /* ── Changing the configured diameter changes the weight ─────────────────
     The rule stated plainly: 10.6 becomes 10.7 in Diameter Settings, and the
     next weight is calculated on 10.7. */
  {
    const cfg = await openApp(browser, {
      api: { get_diameter_settings: { ok: true, data: [
        { id: '9', type: 'sagrod', material: 'MS', sizeType: 'UNDERSIZE', size: 'M12', diameter: 10.7 },
      ] } },
    });
    const changed = await cfg.evaluate(() => {
      switchType('sagrod');
      document.getElementById('sagrod-material').value = 'MS';
      document.getElementById('sagrod-sizeType').value = 'UNDERSIZE';
      document.getElementById('sagrod-size').value = 'M12'; onSizeCommit('sagrod');
      document.getElementById('sagrod-length').value = '1000';
      document.getElementById('sagrod-threadLen').value = '100';
      document.getElementById('sagrod-qty').value = '1';
      document.getElementById('sagrod-costRate').value = '5';
      calcSagRod();
      return { builtIn: dcBuiltInDiameter('sagrod', 'MS', 'UNDERSIZE', 'M12'),
               effective: dcEffectiveDiameter('sagrod', 'MS', 'UNDERSIZE', 'M12'),
               formDia: fv('sagrod', 'diameter'),
               weight: (priceCalcState.sagrod || {}).weight };
    });
    A.eq(changed.builtIn, '10.6', 'the built-in table still says 10.6');
    A.eq(changed.effective, '10.7', 'but the configured 10.7 is the effective diameter');
    A.eq(changed.formDia, '10.7', 'the form resolves 10.7');
    A.near(changed.weight, 10.7 * 10.7 * 1000 * K, 1e-9,
      'and the weight is calculated on 10.7 — no hidden table overrides what was configured');
    A.ok(Math.abs(Number(changed.weight) - 10.6 * 10.6 * 1000 * K) > 1e-6,
      'which is not the weight 10.6 would have produced');
    await cfg.close();
  }

  /* ── The 4140 QT rate table, and which route it travels ──────────────────
     RATES_4140 is read twice: once by get4140Rates(), keyed on the built
     description, and once by getSystemDPRules(), keyed on the item's identity.
     The description gained its label ("4140 QT ...") while the table's keys did
     not, so the first route has been returning null; the rates still reach the
     boxes through the second. Pinned here because it is the numbers that
     matter, not the route — and because a later tidy-up of either route must
     not change what a 4140 QT sag rod costs. */
  const rates4140 = await page.evaluate(() => {
    const set = (mat, st, size, finish) => {
      switchType('sagrod');
      const cr = document.getElementById('sagrod-costRate'), ac = document.getElementById('sagrod-addCost');
      cr.value = ''; ac.value = '';
      document.getElementById('sagrod-material').value = mat;
      document.getElementById('sagrod-sizeType').value = st;
      document.getElementById('sagrod-size').value = size;
      /* The finish is a radio group, chosen the way the pill does it. */
      const radio = document.querySelector(`input[name="sagrod-finish"][value="${finish}"]`);
      radio.checked = true; onFinishChange('sagrod');
      cr.value = ''; ac.value = '';
      onMaterialSizeChange('sagrod', false, 'material');
      return { rate: cr.value, add: ac.value };
    };
    return {
      full16PL:  set('4140', 'FULLSIZE',  'M16', 'PL'),
      full12PL:  set('4140', 'FULLSIZE',  'M12', 'PL'),
      under12PL: set('4140', 'UNDERSIZE', 'M12', 'PL'),
      under16ZP: set('4140', 'UNDERSIZE', 'M16', 'ZP'),
      full16HDG: set('4140', 'FULLSIZE',  'M16', 'HDG'),
      noRule:    set('4140', 'FULLSIZE',  'M30', 'PL'),
      /* The description-keyed lookup, asked directly. */
      viaDesc:   get4140Rates(buildDesc('sagrod'), 'M16', 'PL'),
      keys:      Object.keys(RATES_4140).join(' | '),
      desc:      buildDesc('sagrod'),
    };
  });
  A.eq(rates4140.full16PL.rate, '6.50', 'a fullsize 4140 QT M16 is rated at 6.50');
  A.eq(rates4140.full16PL.add,  '3.50', 'with 3.50 additional');
  A.eq(rates4140.full12PL.rate, '8.50', 'a fullsize M12 at 8.50');
  A.eq(rates4140.under12PL.rate, '9.50', 'an undersize M12 at 9.50 — the size type changes the rate');
  A.eq(rates4140.under16ZP.rate, '9.50', 'zinc plating adds its 1.50 to the undersize M16 rate of 8.00');
  A.eq(rates4140.full16HDG.rate, '9.70', 'and galvanising adds 3.20');
  A.eq(rates4140.full16HDG.add,  '4.50', 'with 1.00 of thread brushing on the additional cost');
  A.eq(rates4140.noRule.rate, '', 'a size the table does not hold gets no rate — nothing is interpolated');
  A.eq(rates4140.viaDesc, 'null',
    'the description-keyed lookup finds nothing, because the label and the keys disagree');
  A.eq(rates4140.desc, '4140 QT FULLSIZE SAG ROD', 'the description carries the material label');
  A.eq(rates4140.keys, '4140 FULLSIZE SAG ROD | 4140 UNDERSIZE SAG ROD', 'while the keys carry the code');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
