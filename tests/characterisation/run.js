/* ── R0b behavioural oracle — legacy characterisation runner ────────────────
   node tests/characterisation/run.js            regenerate fixtures/golden/*.json
   node tests/characterisation/run.js --check    regenerate in memory and FAIL if
                                                 any committed golden differs

   Every `legacy` value is produced here, by the shipped index.php running in
   Chromium (through the same harness the browser suites use — the real HTML,
   the real script, api.php answered from a stub table) or by the shipped
   pricing_history.php running in PHP. Nothing is computed by a second copy of
   a formula. The `expected` value is the legacy value unless cases.js marks the
   case B (owner-approved replacement) or C (owner gate).

   --check is the CI guard: if the legacy application's behaviour moves, the
   oracle the rewrite is measured against has moved with it, and that must be a
   visible decision rather than a silent drift.                               */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch, openApp } = require('../lib/harness');
const C = require('./cases');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'fixtures', 'golden');
const CHECK = process.argv.includes('--check');
const SOURCE = 'index.php @ legacy oracle (harness: tests/lib/harness.js)';

function sameIdentity(a, b) { return Object.keys(a).every(k => a[k] === b[k]); }
function classify(base, overrides, legacyValue, expectedFrom) {
  const o = overrides.find(x => sameIdentity(x.match, base));
  if (!o) return { cls: 'A', expected: legacyValue };
  const out = { cls: o.cls, ref: o.ref };
  if (o.gate) out.gate = o.gate;
  if (o.note) out.note = o.note;
  out.expected = expectedFrom(o);
  return out;
}

async function characterise(page) {
  const g = {};

  /* ── rounding ── */
  g.rounding = await page.evaluate(cases => cases.map(c => ({
    fn: c.fn, input: c.v, legacy: window[c.fn](c.v),
  })), C.rounding);
  g.rounding.forEach(r => { r.cls = 'A'; r.expected = r.legacy; });

  /* ── size ── */
  g.size = await page.evaluate(cases => cases.map(c => {
    const n = normalizeSizeValue(c.raw);
    return { input: c.raw, legacy: {
      normalised: n, known: isKnownSize(n), display: sizeDisplay(n),
      inchKey: wqaInchKey(n), nominalDiameter: getNominalDiameter(n),
    } };
  }), C.size);
  g.size.forEach((r, i) => {
    const c = C.size[i];
    r.cls = c.cls || 'A';
    if (c.ref) r.ref = c.ref;
    if (c.note) r.note = c.note;
    r.expected = c.expected || {
      normalised: r.legacy.normalised,
      system: /^M\d/.test(r.legacy.normalised) ? 'metric' : (r.legacy.inchKey ? 'imperial' : 'unknown'),
      needsReview: !r.legacy.known,
    };
  });

  /* ── diameter (built-in tables only: no Diameter Settings rows) ── */
  const dia = await page.evaluate(cases => cases.map(c => ({
    ...c, legacy: dcBuiltInDiameter(c.type, c.material, c.sizeType, c.size),
  })), C.diameter);
  g.diameter = dia.map(d => {
    const legacy = d.legacy === '' ? null : Number(d.legacy);
    const base = { type: d.type, material: d.material, sizeType: d.sizeType, size: d.size };
    const k = classify(base, C.diameterOverrides, legacy, o => (o.expected !== undefined ? o.expected : legacy));
    return { input: base, legacy, ...k };
  });

  /* ── a real entry form, driven the way the browser suites drive it ── */
  const runForm = (c) => page.evaluate((c) => {
    const t = c.type;
    switchType(t);
    document.querySelectorAll(`[id^="${t}-"]`).forEach(e => {
      if (e.tagName === 'INPUT' && (e.type === 'text' || e.type === 'number')) e.value = '';
    });
    if (typeof resetAccPanel === 'function') resetAccPanel(t);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
    if (document.getElementById(t + '-material') && document.getElementById(t + '-material').tagName === 'SELECT')
      set(t + '-material', c.material || 'MS');
    if (document.getElementById(t + '-sizeType')) set(t + '-sizeType', c.sizeType || 'FULLSIZE');
    const fin = document.querySelector(`input[name="${t}-finish"][value="${c.finish === undefined ? 'PL' : c.finish}"]`);
    if (fin) fin.checked = true;
    if (t === 'plate') {
      const r = document.querySelector(`input[name="plate-plateType"][value="${c.plateType || 'ms_plate'}"]`);
      if (r) r.checked = true;
    }
    if (t === 'others') set('others-weightMode', 'length');
    set(t + '-priceMode', c.priceMode || 'auto');
    Object.keys(c.f).forEach(k => set(t + '-' + k, c.f[k]));
    const acc = c.acc || {};
    ['nut', 'fw', 'custom'].forEach(k => {
      if (!acc[k]) return;
      const en = document.getElementById(t + '-' + k + 'Enabled'); if (en) en.checked = true;
      if (acc[k].qty !== undefined) set(t + '-' + k + 'Qty', acc[k].qty);
      if (acc[k].price !== undefined) set(t + '-' + k + 'Price', acc[k].price);
      if (acc[k].text !== undefined) set(t + '-' + k + 'Text', acc[k].text);
    });
    const fns = { sagrod: () => calcSagRod(), stud: () => calcStud(), anchorbolt: () => calcAnchorBolt(),
      ubolt: () => calcUBolt(t, !!c.skipAuto), squbolt: () => calcSQUBolt(t, !!c.skipAuto),
      lbolt: () => calcLBolt(t, !!c.skipAuto), lbolt45: () => calcLBolt(t, !!c.skipAuto),
      jbolt: () => calcJBolt(t, !!c.skipAuto), plate: () => calcPlate(), others: () => calcOthers() };
    fns[t]();
    const s = priceCalcState[t] || {};
    const tl = document.getElementById(t + '-length');
    const r6 = v => (typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : v);
    return {
      developedLength: (t === 'plate' || t === 'sagrod' || t === 'stud' || t === 'anchorbolt' || t === 'others')
        ? null : (tl ? (tl.value === '' ? null : Number(tl.value)) : null),
      weight: r6(s.weight),
      rawUnitPrice: r6(s.rawUnitPrice), roundedUnitPrice: r6(s.roundedUnitPrice),
      accessoriesCost: s.accessoriesCost, boltUnitPrice: s.boltUnitPrice, finalUnitPrice: s.finalUnitPrice,
      priceMode: s.priceMode,
    };
  }, c);

  g.weight = [];
  for (const c of C.weight) {
    const r = await runForm({ ...c, f: { costRate: '0', addCost: '0', markup: '0', ...c.f } });
    const legacy = { developedLength: r.developedLength, weight: r.weight };
    g.weight.push({ input: { type: c.type, ...c.f, ...(c.plateType ? { plateType: c.plateType } : {}), ...(c.skipAuto ? { manualDevelopedLength: true } : {}) },
      legacy, cls: 'A', expected: legacy, ...(c.note ? { note: c.note } : {}) });
  }

  g.pricing = [];
  for (const c of C.pricing) {
    const r = await runForm(c);
    const legacy = { weight: r.weight, rawUnitPrice: r.rawUnitPrice, roundedUnitPrice: r.roundedUnitPrice,
      accessoriesCost: r.accessoriesCost, boltUnitPrice: r.boltUnitPrice, finalUnitPrice: r.finalUnitPrice };
    g.pricing.push({ input: { type: c.type, priceMode: c.priceMode || 'auto', material: c.material || 'MS',
      sizeType: c.sizeType || 'FULLSIZE', finish: c.finish === undefined ? 'PL' : c.finish, ...c.f,
      ...(c.plateType ? { plateType: c.plateType } : {}), ...(c.acc ? { accessories: c.acc } : {}) },
      legacy, cls: 'A', expected: legacy, ...(c.note ? { note: c.note } : {}) });
  }

  /* ── WAS ── */
  g.was = [];
  for (const c of C.was) {
    const r = await page.evaluate((c) => {
      switchType('was');
      document.querySelectorAll('[id^="was-"]').forEach(e => {
        if (e.tagName === 'INPUT' && (e.type === 'text' || e.type === 'number')) e.value = '';
      });
      resetAccPanel('was');
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
      set('was-priceMode', 'auto');
      Object.keys(c.f).forEach(k => set('was-' + k, c.f[k]));
      const acc = c.acc || {};
      ['nut', 'fw', 'custom'].forEach(k => {
        if (!acc[k]) return;
        document.getElementById('was-' + k + 'Enabled').checked = true;
        if (acc[k].qty !== undefined) set('was-' + k + 'Qty', acc[k].qty);
        if (acc[k].price !== undefined) set('was-' + k + 'Price', acc[k].price);
      });
      const x = getWASCalc();
      const r6 = v => Math.round(v * 1e9) / 1e9;
      return { setWeight: r6(x.weights.setWeight), anchorWeight: r6(x.weights.anchorWeight),
        basePlateWeight: r6(x.weights.basePlateWeight), trianglePlateWeight: r6(x.weights.trianglePlateWeight),
        basePrice: r6(x.basePrice), accessories: r6(x.accessories), rawUnitPrice: r6(x.rawUnitPrice),
        roundedUnitPrice: x.roundedUnitPrice, finalUnitPrice: x.finalUnitPrice };
    }, c);
    g.was.push({ input: { ...c.f, ...(c.acc ? { accessories: c.acc } : {}) }, legacy: r, cls: 'A', expected: r,
      ...(c.note ? { note: c.note } : {}) });
  }

  /* ── accessories ── */
  g.accessories = [];
  for (const c of C.accessories) {
    const r = await page.evaluate((c) => {
      switchType('sagrod');
      resetAccPanel('sagrod');
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
      ['nut', 'fw', 'custom'].forEach(k => {
        if (!c.acc[k]) return;
        document.getElementById('sagrod-' + k + 'Enabled').checked = true;
        if (c.acc[k].qty !== undefined) set('sagrod-' + k + 'Qty', c.acc[k].qty);
        if (c.acc[k].price !== undefined) set('sagrod-' + k + 'Price', c.acc[k].price);
        if (c.acc[k].text !== undefined) set('sagrod-' + k + 'Text', c.acc[k].text);
      });
      const a = getAccessories('sagrod');
      return { nutQty: a.nut.enabled ? a.nut.qty : null, fwQty: a.fw.enabled ? a.fw.qty : null,
        accessoryUnitTotal: Math.round(accAddon(a) * 1e9) / 1e9, cwLabel: accCWLabel(a) };
    }, c);
    const row = { input: c.acc, legacy: r, cls: c.cls || 'A', expected: r };
    if (c.cls === 'B') {
      const nutQty = c.expectedQty.nut !== undefined ? c.expectedQty.nut : r.nutQty;
      const fwQty = c.expectedQty.fw !== undefined ? c.expectedQty.fw : r.fwQty;
      const price = k => Number((c.acc[k] || {}).price || 0);
      row.expected = { nutQty, fwQty,
        accessoryUnitTotal: Math.round(((nutQty || 0) * price('nut') + (fwQty || 0) * price('fw')) * 1e9) / 1e9,
        cwLabel: null };
      row.ref = c.ref;
      row.note = c.note + ' Customer wording for a zero-quantity accessory is not decided by the handoff; expected.cwLabel is left null (no "cw 0nut" is invented).';
    } else if (c.note) row.note = c.note;
    g.accessories.push(row);
  }

  /* ── default price (code built-ins) + TL surcharge + price list ── */
  const dp = await page.evaluate(cases => cases.map(c => {
    const m = findDPMatch(c.type, c.material, c.sizeType, c.size, c.finish);
    return { ...c, legacy: m ? { costRate: m.costRate, addCost: m.addCost, markup: m.markup, source: m.source } : null };
  }), C.defaultPrice);
  g.defaultPrice = dp.map(d => {
    const base = { type: d.type, material: d.material, sizeType: d.sizeType, size: d.size, finish: d.finish };
    const k = classify(base, C.defaultPriceOverrides, d.legacy,
      o => (d.legacy ? { ...d.legacy, costRate: o.expectedCostRate } : { costRate: o.expectedCostRate }));
    return { input: base, legacy: d.legacy, ...k };
  });
  g.tlSurcharge = await page.evaluate(cases => cases.map(tl => ({ input: tl, legacy: getAddCostFromTL(tl) })), C.tlSurcharge);
  g.tlSurcharge.forEach(r => { r.cls = 'A'; r.expected = r.legacy; });

  /* ── Sag Rod TL through the real add path ── */
  g.sagrodTL = [];
  for (const c of C.sagrodTL) {
    const r = await page.evaluate((c) => {
      switchType('sagrod');
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
      set('sagrod-material', 'MS'); set('sagrod-sizeType', 'UNDERSIZE'); set('sagrod-size', 'M12');
      set('sagrod-diameter', '10.6'); set('sagrod-length', '1000'); set('sagrod-threadLen', c.threadLen);
      set('sagrod-costRate', '2.80'); set('sagrod-addCost', '0.60'); set('sagrod-markup', '0'); set('sagrod-qty', '1');
      set('sagrod-priceMode', 'auto');
      const before = quoteItems.length;
      addSagRod();
      const it = quoteItems[quoteItems.length - 1];
      const out = quoteItems.length > before ? { size: it.size, threadLen: (it.formData || {}).threadLen } : { error: 'not added' };
      quoteItems = []; if (typeof renderQuote === 'function') renderQuote();
      return out;
    }, c);
    const row = { input: { threadLen: c.threadLen }, legacy: r, cls: c.cls || 'A', expected: r };
    if (c.cls === 'B') {
      row.ref = c.ref; if (c.note) row.note = c.note;
      row.expected = { threadLen: c.expectedTL, size: r.size.replace(/TL [^ ]+$/, 'TL ' + c.expectedTL + 'mm') };
    }
    g.sagrodTL.push(row);
  }

  /* ── material ── */
  g.material = await page.evaluate(cases => cases.map(m => ({
    input: m, legacy: { label: materialLabel(m), hasFinish: dcMaterialHasFinish(m),
      descSample: displayItemDesc({ material: m, desc: materialLabel(m) + ' STUD' }) },
  })), C.material);
  const STRUCT = {
    MS: ['MS', null, null], S45C: ['S45C', null, null], S45C_HARDEN_G8_8: ['S45C', 'HARDEN', '8.8'],
    '4140': ['4140 QT', null, null], '4140_HARDEN_G10_9': ['4140 QT', 'HARDEN', '10.9'],
    '4140_PLAIN': ['4140', null, null], '4340': ['4340 QT', null, null], SS304: ['SS304', null, null],
    SS316: ['SS316', null, null], Y_BAR: ['Y BAR', null, null],
  };
  g.material.forEach(r => {
    const [mat, treat, pc] = STRUCT[r.input];
    const structured = { material: mat, treatment: treat, propertyClass: pc };
    if (treat) {
      r.cls = 'B'; r.ref = '§13 / §14 / §34 C-7';
      r.note = 'legacy combined value stays READABLE; the new model is Material · Treatment · Property Class, and customer wording is "<MAT> <PRODUCT> · HARDENED TO G<PC> (<FINISH>)".';
      r.expected = { ...structured, hasFinish: r.legacy.hasFinish,
        customerWordingSample: `${mat} STUD · HARDENED TO G${pc} (PL)` };
    } else {
      r.cls = 'A';
      r.expected = { ...structured, hasFinish: r.legacy.hasFinish };
    }
  });
  g.material.push({ input: '4140 QT + HARDEN + 12.9', legacy: null, cls: 'B', ref: '§13 (12.9 owner-approved new option)',
    note: 'No legacy material value exists for 12.9 (historically unobserved). Absence is not prohibition: the new model accepts it.',
    expected: { material: '4140 QT', treatment: 'HARDEN', propertyClass: '12.9', hasFinish: true,
      customerWordingSample: '4140 QT STUD · HARDENED TO G12.9 (PL)' } });

  /* ── output ── */
  g.output = await page.evaluate(([items, meta]) => {
    quoteItems = items.map(i => JSON.parse(JSON.stringify(i)));
    waTemplateCache = null;
    const setv = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    setv('qi-customer', meta.customer); setv('qi-refno', meta.refno); setv('qi-date', meta.date); setv('qi-prepby', meta.prepby);
    const out = {
      perItem: quoteItems.map((it, i) => ({ no: i + 1, waGroupTitle: getWAGroupTitle(it),
        printDescription: getPrintItemDescription(it), printDimension: getPrintItemDimension(it),
        customerUnitPrice: dcItemFinalUnit(it) })),
      whatsappPreviewItems: buildWAItemsText('(No items yet)'),
      whatsappSentText: buildQuoteText(),
      whatsappCopyWithWeight: buildQuoteText(true),
      grandTotal: quoteItems.reduce((s, i) => s + i.totalAmount, 0),
      defaultTemplate: WA_DEFAULT_TPL,
    };
    quoteItems = [];
    return out;
  }, [C.outputQuote, C.outputMeta]);
  const leak = /cost\s*rate|add(?:itional)?\s*cost|markup/i;
  g.output = {
    input: { items: C.outputQuote, meta: C.outputMeta },
    legacy: g.output,
    checks: {
      noCostAddMarkupLeak: !leak.test(g.output.whatsappSentText) && g.output.perItem.every(p => !leak.test(p.printDescription + p.printDimension)),
      previewEqualsSent: g.output.whatsappSentText.includes(g.output.whatsappPreviewItems),
    },
    divergences: [
      { cls: 'B', ref: '§26', topic: 'WhatsApp preview must equal the sent / copied content',
        note: 'legacy preview (buildWAItemsText mergeIdentical=true) merges identical rows ("1, 3)") and groups by title across the quotation; the sent text (buildQuoteText → mergeIdentical=false) keeps one line per item and starts a new heading whenever the title changes. See checks.previewEqualsSent.' },
      { cls: 'B', ref: '§14', topic: 'hardened customer wording',
        note: 'legacy prints "S45C + HARDEN = G8.8 STUD (PL)"; owner wording is "S45C STUD · HARDENED TO G8.8 (PL)".' },
      { cls: 'A', ref: '§26 / §34 C-4', topic: 'insertion-order numbering and WhatsApp material/finish grouping are kept' },
      { cls: 'A', ref: 'PROJECT-GUARDRAILS ACCESSORIES', topic: 'one inclusive customer price; accessories are wording only (cw 2nut & 1fw)' },
    ],
  };

  /* ── Quick Add (deterministic parser) ── */
  g.quickAdd = await page.evaluate(texts => texts.map(text => {
    let p;
    try { p = wqaParseText(text); } catch (e) { return { input: text, legacy: { error: String(e.message || e) } }; }
    return { input: text, legacy: {
      product: p.common && p.common.product || '',
      rows: p.rows.map(r => ({ product: r.product || '', material: r.material || '', finish: r.finish || '',
        sizeType: r.sizeType || '', size: r.size || '', length: r.length || '', w: r.w || '', h: r.h || '',
        id: r.id || '', s: r.s || '', threadLen: r.threadLen || '', threadLen2: r.threadLen2 || '',
        thread: typeof wqaThreadValue === 'function' ? wqaThreadValue(r) : '', qty: r.qty || '',
        grade: r.grade || '', unsupported: r.unsupported || '', missing: wqaRowMissing(r) })),
      skipped: (p.skipped || []).length, risky: !!p.risky,
    } };
  }), C.quickAdd);
  g.quickAdd.forEach(r => {
    r.cls = 'A'; r.expected = r.legacy;
    if (/sagrod M12 1000 TL 100 qty/.test(r.input)) {
      r.ref = '§21'; r.note = 'already consistent with §21: Quick Add reads a single Sag Rod TL 100 as 100/100.';
    }
    const KNOWN_FAIL = {
      'U bolt 1/2 ID 64 IH 85 HDG 20 pcs': 'known failure: read as a Sag Rod with no size, length 64, TL 1/2 — the U-bolt word and the inch size are lost.',
      'U-bolt M12 for 2" pipe qty 10': 'known failure: nothing is read (no rows); pipe-size wording is not understood.',
      'sagrod 6 x 300 qty 10': 'known failure: bare 6 is read as the LENGTH and 300 as TL 300/300 — the §12 "bare 6 → M6" rule concerns stored historical sizes, and the parser does not apply it.',
    };
    if (KNOWN_FAIL[r.input]) {
      r.knownFailure = true;
      r.note = KNOWN_FAIL[r.input] + ' Recorded so the Wave 3 Quick Add rewrite can improve on it knowingly; a rewrite must not regress the successful patterns in this file.';
    }
    if (/^J hook|^eye bolt/.test(r.input)) {
      r.cls = 'B'; r.ref = /^J/.test(r.input) ? '§19' : '§20';
      r.note = 'J Hook / Eye Bolt become official products; the legacy parser has no such product. expected is the canonical structured target, legacy is kept as evidence of what is parsed today.';
      r.expected = /^J/.test(r.input)
        ? { product: 'J HOOK', size: 'M10', L: 150, W: 50, TL: 50, qty: 30, suggestedDevelopedLength: 200 }
        : { product: 'EYE BOLT', size: 'M12', L: 150, ID: 40, TL: 60, qty: 6, S: null, developedLength: 'manual' };
    }
    if (/^72 x/.test(r.input)) {
      r.knownFailure = true; r.ref = '§12';
      r.note = 'known failure: 72 is read as the LENGTH and 1000 as TL 1000/1000. §12 requires a bare 72 to surface as Needs Review, never as a silent value.';
    }
  });

  return g;
}

function historyGolden() {
  const out = execFileSync('php', [path.join(__dirname, 'history.php')], { encoding: 'utf8' });
  return JSON.parse(out);
}

function stable(o) { return JSON.stringify(o, null, 2) + '\n'; }

(async () => {
  const browser = await launch();
  let g;
  try {
    const page = await openApp(browser);
    g = await characterise(page);
    if (page._dcErrors.length) throw new Error('page errors during characterisation: ' + page._dcErrors.join(' | '));
  } finally { await browser.close(); }
  g.history = historyGolden();

  const files = {};
  for (const [k, v] of Object.entries(g)) {
    files[k + '.json'] = stable({ _meta: { family: k, source: k === 'history' ? 'pricing_history.php (DB-free)' : SOURCE,
      generator: 'tests/characterisation/run.js', classes: 'A preserve · B owner-approved replacement · C owner gate' }, cases: v });
  }
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  let drift = 0;
  for (const [name, body] of Object.entries(files)) {
    const p = path.join(OUT, name);
    if (CHECK) {
      const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
      if (cur !== body) { drift++; console.log('  DRIFT  ' + name); } else console.log('  ok     ' + name);
    } else {
      fs.writeFileSync(p, body);
      console.log('  wrote  ' + path.relative(ROOT, p));
    }
  }
  const counts = {};
  for (const [k, v] of Object.entries(g)) {
    const arr = Array.isArray(v) ? v : (v.cases || [v]);
    counts[k] = arr.length;
  }
  console.log('\n  families: ' + JSON.stringify(counts));
  if (CHECK && drift) { console.log(`\n  FAIL — ${drift} golden file(s) differ from the shipped legacy behaviour.`); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
