/* ── This row's history, on this row ───────────────────────────────────────
   Live acceptance finding: Quick Add could look up a row's pricing history,
   but only from inside that row's editor. A ten-item enquiry is ten different
   specifications, and reaching the evidence for one of them meant opening its
   editor first — so in Compact view, the view people actually review in, the
   history was not there at all. It also looked up EVERY row the moment the
   modal opened, and again after every recompute.

   What is asserted here is the row-level behaviour: the action, the per-row
   panel, one lookup per specification and none until asked, staleness when a
   row changes, and that none of it touches the row's price.

   The matching itself is not re-asserted here — it is the same code the entry
   form's panel runs (phFetch, phDimDistance, phSortRecords, phRecordHtml over
   pricing_history.php's rules) and it is asserted in suite 05 and in
   tests/php/pricing_history.test.php. What IS asserted is that the two screens
   answer identically for one item.                                          */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const ALPHA = 7;

/* Records for one specification. The size is echoed back so a test can tell
   which row's lookup produced which page. */
const rec = o => Object.assign({
  quotationId: 1, refNo: 'Q1', date: '2026-01-05', customer: 'ADVANCE', companyId: ALPHA,
  own: true, productType: 'SAG ROD', material: 'MS', sizeType: 'FULLSIZE', finish: 'PL',
  cleanSize: 'M20', dimensionPreview: 'L 1000 x TL 100/100mm', exactDims: true,
  qty: 10, unitPrice: 12.00, boltUnitPrice: 12.00, accessoryCost: 0, accessorySummary: '',
  accessoryAmbiguous: false, priceMode: 'auto', priceModeLabel: 'Auto Round',
  costRate: 2.80, addCost: 0.60, markup: 8, weight: 2.4662, legacy: false,
}, o);

/* Three lengths of the same specification, plus one record that cannot be
   separated from its accessories and one that never recorded anything. */
function pageFor(size) {
  return [
    rec({ cleanSize: size, refNo: size + '-500', dimensionPreview: 'L 500 x TL 100/100mm' }),
    rec({ cleanSize: size, refNo: size + '-1000', dimensionPreview: 'L 1000 x TL 100/100mm' }),
    rec({ cleanSize: size, refNo: size + '-1200', dimensionPreview: 'L 1200 x TL 100/100mm' }),
    rec({ cleanSize: size, refNo: size + '-ACC', dimensionPreview: 'L 1000 x TL 100/100mm',
          unitPrice: 12.70, boltUnitPrice: 12.00, accessoryCost: 0.70,
          accessorySummary: '2 Nut PL + 1 FW PL' }),
    rec({ cleanSize: size, refNo: size + '-OLD', dimensionPreview: 'L 1000 x TL 100/100mm',
          boltUnitPrice: null, accessoryCost: 0.70, accessorySummary: '2 Nut PL',
          accessoryAmbiguous: true, priceMode: '', priceModeLabel: 'Legacy / Unknown',
          costRate: null, addCost: null, markup: null, weight: null, legacy: true }),
  ];
}

/* The endpoint sorts before it answers — dc_history_sort puts this customer
   first, then the nearest rod. The stand-in does the same, so what is compared
   below is what the two screens DO with a correctly ordered page, not who
   happened to sort it. */
function serverPage(url, log) {
  const p = new URL(url).searchParams;
  const size = String(p.get('cleanSize') || '');
  const wantDims = String(p.get('dimensionPreview') || '');
  if (log) log.push({ size, product: String(p.get('productType') || ''),
                      material: String(p.get('material') || ''), dims: wantDims });
  const nums = t => { const o = {}; const re = /\b(TL|L|W|H|S|ID)\s*([0-9.]+)(?:\s*\/\s*([0-9.]+))?/gi;
                      let m; while ((m = re.exec(String(t || '')))) {
                        if (o[m[1].toUpperCase()] === undefined) o[m[1].toUpperCase()] = parseFloat(m[2]);
                        if (m[3] !== undefined && o[m[1].toUpperCase() + '2'] === undefined) o[m[1].toUpperCase() + '2'] = parseFloat(m[3]); }
                      return o; };
  const dist = (a, b) => { const x = nums(a), y = nums(b);
    const keys = new Set(Object.keys(x).concat(Object.keys(y)));
    let t = 0; keys.forEach(k => { t += Math.abs((x[k] || 0) - (y[k] || 0)); }); return t; };
  const rows = pageFor(size).slice()
    .sort((a, b) => (a.own ? 0 : 1) - (b.own ? 0 : 1)
                 || dist(wantDims, a.dimensionPreview) - dist(wantDims, b.dimensionPreview));
  return { ok: true, data: { records: rows, total: rows.length,
    ownTotal: rows.filter(r => r.own).length, otherTotal: rows.filter(r => !r.own).length,
    offset: 0, limit: 20 } };
}

module.exports = async (browser, A) => {
  const S = A.suite('quick add — each row\'s own pricing history, on the row');

  const asked = [];
  const api = { get_pricing_history: url => serverPage(url, asked) };
  const page = await openApp(browser, { viewport: { width: 1500, height: 1100 }, api });
  await page.evaluate(id => { selectedCompanyId = id; }, ALPHA);

  /* Two rows, two specifications, reviewed in Compact view. */
  await quickAddPaste(page, ['MS SAG ROD PL FULLSIZE',
                             'M20 x 1000 x 100/100 - 4pcs',
                             'M24 x 800 x 100/100 - 2pcs'].join('\n'),
                      { expanded: false, settle: 1000 });

  // ── 1 · the action is on the row ─────────────────────────────────────────
  const actions = await page.evaluate(() => {
    const card = document.querySelector('[data-wqa-row="0"]');
    const btns = [...card.querySelectorAll('.wqa-sum-actions .wqa-row-act')];
    return { labels: btns.map(n => n.textContent.replace(/\s+/g, ' ').trim().replace(/\d+$/, '')),
             tags: btns.map(n => n.tagName),
             tall: btns.map(n => Math.round(n.getBoundingClientRect().height)),
             collapsed: !card.classList.contains('is-open'),
             editorOpen: !!card.querySelector('.wqa-row-body') };
  });
  /* Details, not Edit. Two controls said "Edit" and meant different things:
     this one opens ONE row's form, while the toolbar's opens a grid over
     every row. The row action was never an editor of that kind. */
  A.eq(actions.labels.join(' | '), 'Details | History | ✕',
       'the row offers Details, History and remove — and never a second "Edit"');
  /* Controls that look and behave like controls: it was a bare span, which
     no keyboard could reach and no finger could aim at. */
  A.eq(actions.tags.join(' '), 'BUTTON BUTTON BUTTON', 'and all three are buttons');
  A.ok(actions.tall.every(h => h >= 32),
    `each with a real click target (${actions.tall.join('/')}px)`);
  A.eq(actions.collapsed, 'true', 'while the row is collapsed');
  A.eq(actions.editorOpen, 'false', 'and its editor is not open');

  // ── 2 · nothing is looked up until it is asked for ───────────────────────
  A.eq(asked.length, 0, 'opening the modal looks nothing up at all');
  const before = await page.evaluate(() => ({
    price: (wqa.rows[0].calc || {}).finalUnitPrice,
    costRate: (wqa.rows[0].calc || {}).costRate,
    addCost: (wqa.rows[0].calc || {}).addCost,
    markup: (wqa.rows[0].calc || {}).markup,
    mode: wqa.rows[0].priceMode, manual: wqa.rows[0].manualPrice,
    acc: JSON.stringify(wqa.rows[0].acc), size: wqa.rows[0].size,
    material: wqa.rows[0].material, product: wqa.rows[0].product,
  }));

  await page.click('[data-wqa-row="0"] .wqa-row-hist');
  await page.waitForTimeout(700);
  A.eq(asked.length, 1, 'clicking History on row 1 asks once');
  A.eq(asked[0].size, 'M20', 'for row 1\'s own size');
  A.eq(asked[0].product, 'SAG ROD', 'and its own product');

  // ── 3 · it is that row's panel, and only that row's ──────────────────────
  let panels = await page.evaluate(() => [0, 1].map(i => {
    const card = document.querySelector(`[data-wqa-row="${i}"]`);
    return { open: !!card.querySelector('.wqa-hist-panel'),
             refs: [...card.querySelectorAll('.ph-rec-ref')].map(n => n.textContent) };
  }));
  A.eq(panels[0].open, 'true', 'row 1 shows its history');
  A.eq(panels[1].open, 'false', 'row 2 shows nothing — it was not asked');
  A.ok(panels[0].refs.every(x => x.startsWith('M20-')), 'and every record shown is row 1\'s own');

  await page.click('[data-wqa-row="1"] .wqa-row-hist');
  await page.waitForTimeout(700);
  A.eq(asked.length, 2, 'row 2 asks for itself when it is asked');
  A.eq(asked[1].size, 'M24', 'with its own size');
  panels = await page.evaluate(() => [0, 1].map(i => {
    const card = document.querySelector(`[data-wqa-row="${i}"]`);
    return { open: !!card.querySelector('.wqa-hist-panel'),
             refs: [...card.querySelectorAll('.ph-rec-ref')].map(n => n.textContent) };
  }));
  A.eq(panels[0].open + '/' + panels[1].open, 'true/true', 'both rows can be open at once');
  A.ok(panels[1].refs.every(x => x.startsWith('M24-')), 'each showing its own records');
  A.eq(panels[0].refs.some(x => x.startsWith('M24-')), 'false', 'and never the other row\'s');

  // ── 4 · core identity never crosses ──────────────────────────────────────
  A.eq(asked.some(q => /M18|M22|M24/.test(q.size) && q.size !== 'M24'), 'false',
    'no lookup asks for a neighbouring size');
  A.eq(asked.filter(q => q.size === 'M20').length, 1, 'row 1 asked for M20 and nothing else');
  A.ok(asked.every(q => q.material === 'MS'), 'and every lookup carries the row\'s own material');

  // ── 5 · closest dimensions first, the same way the entry form ranks ──────
  const ranked = await page.evaluate(() => wqa.rows[0].hist.records.map(r => r.refNo + ':' + r.dimDistance));
  A.eq(ranked.slice(0, 3).join(' '), 'M20-1000:0 M20-ACC:0 M20-OLD:0',
    'the rods at this row\'s own length rank first');
  A.includes(ranked.join(' '), 'M20-500:500', 'then the 500 shorter one');
  A.includes(ranked.join(' '), 'M20-1200:200', 'and the 1200 is 200 away');
  /* On screen the records are filed under what can be DONE with them —
     Reusable, then References — and ranked as above inside each. */
  const shown = await page.evaluate(() => {
    const root = document.querySelector('[data-wqa-row="0"] .ph-scroll');
    const out = []; let sect = '';
    [...root.children].forEach(n => {
      if (n.classList.contains('ph-sect')) { sect = (n.querySelector('.ph-sect-lbl') || {}).textContent || ''; return; }
      const ref = (n.querySelector('.ph-rec-ref') || {}).textContent || '';
      out.push({ sect, ref, canUse: !!n.querySelector('.ph-rec-use') });
    });
    return out;
  });
  const reusable = shown.filter(x => x.sect === 'Reusable').map(x => x.ref);
  A.ok(reusable.length > 0, 'the reusable records are under a heading of their own');
  A.eq(reusable[reusable.length - 1], 'M20-500',
    'and the furthest rod is last among them');
  A.ok(shown.filter(x => x.sect === 'Reusable').every(x => x.canUse),
    'every record filed as reusable offers to be reused');
  A.ok(shown.filter(x => x.sect === 'References').every(x => !x.canUse),
    'and no record filed as a reference does');

  // ── 7 · the bolt price, and the accessories on the same line ─────────────
  /* Stage 0B: what a reused record reproduces is the BOLT, so that is the figure
     the panel leads with — but the accessories are no longer a separate charge
     to the customer, and the wording no longer says they were. */
  const panelText = await page.evaluate(() =>
    (document.querySelector('[data-wqa-row="0"] .ph-scroll') || {}).textContent || '');
  A.includes(panelText, 'Bolt Unit Price', 'the panel reports a bolt price');
  A.includes(panelText, 'Accessories on that line', 'and names the accessories that were on the same line');
  A.excludes(panelText, 'Accessories, separately', 'rather than calling them a separate charge');
  A.includes(panelText, 'RM 0.70', 'and what they came to');
  A.includes(panelText, 'quotation line was RM 12.70', 'beside the line the customer received');
  A.includes(panelText, 'Accessories not separable',
    'and a record that cannot prove the split says so instead of inventing one');

  // ── the fields that explain a price ──────────────────────────────────────
  ['Unit Weight', 'Cost Rate', 'Add Cost', 'Markup', 'Price Mode']
    .forEach(f => A.includes(panelText, f, `the panel shows ${f}`));
  A.includes(panelText, 'Auto Round', 'named for a record that recorded it');

  // ── 8 · what was never recorded is never guessed ─────────────────────────
  A.includes(panelText, 'Not recorded', 'a weight the record never carried says so');
  A.includes(panelText, 'Legacy / Unknown', 'and a price mode it never carried says so');
  A.includes(panelText, 'Legacy record', 'the record is labelled as legacy');
  const dashes = await page.evaluate(() => {
    const old = [...document.querySelectorAll('[data-wqa-row="0"] .ph-rec')]
      .find(n => (n.textContent || '').includes('M20-OLD'));
    return (old.textContent || '').replace(/\s+/g, ' ');
  });
  A.includes(dashes, '—', 'and a cost rate it never carried is a dash, not a number');

  // ── 10 · looking is not touching ─────────────────────────────────────────
  const after = await page.evaluate(() => ({
    price: (wqa.rows[0].calc || {}).finalUnitPrice,
    costRate: (wqa.rows[0].calc || {}).costRate,
    addCost: (wqa.rows[0].calc || {}).addCost,
    markup: (wqa.rows[0].calc || {}).markup,
    mode: wqa.rows[0].priceMode, manual: wqa.rows[0].manualPrice,
    acc: JSON.stringify(wqa.rows[0].acc), size: wqa.rows[0].size,
    material: wqa.rows[0].material, product: wqa.rows[0].product,
  }));
  Object.keys(before).forEach(k => A.eq(String(after[k]), String(before[k]),
    `opening history left the row's ${k} exactly as it was`));

  /* The one thing that DOES copy is the one a person presses. What copies is
     the record's PRICING — its rate, its surcharge, its markup and the mode it
     was rounded in — and the row then prices itself from them. It used to copy
     the historical final figure into Manual Price instead; see suite 23. */
  await page.evaluate(() => {
    const i = wqa.rows[0].hist.records.findIndex(r => r.refNo === 'M20-1000');
    wqaHistUse(0, i);
  });
  await page.waitForTimeout(900);
  const used = (await rowState(page))[0];
  const usedCalc = await page.evaluate(() => ({
    rate: String(wqa.rows[0].calc.costRate), add: String(wqa.rows[0].calc.addCost),
    mk: String(wqa.rows[0].calc.markup), price: wqa.rows[0].calc.finalUnitPrice,
    weight: wqa.rows[0].calc.weight }));
  A.eq(used.priceMode, 'auto', 'Use this price restores the mode the record was priced in');
  A.eq(usedCalc.rate, '2.80', 'with its cost rate');
  A.eq(usedCalc.add, '0.60', 'its additional cost');
  A.eq(usedCalc.mk, '8', 'and its markup');
  A.eq(used.manualPrice, '', 'and no manual price is set');
  A.eq(used.usedHistoryRef, 'M20-1000', 'and records which one it came from');
  /* Worked out on THIS row, from those rates — not the record's own 12.00. */
  A.eq(String(usedCalc.price),
    String(await page.evaluate(() => round05((wqa.rows[0].calc.weight * 2.8 + 0.6) * 1.08))),
    'and the price is this row calculated on that basis');

  // ── 9 · a row that changes is not shown its old answer ───────────────────
  const askedBefore = asked.length;
  await page.evaluate(() => wqaEdit(0, 'length', '1900'));
  await page.waitForTimeout(1000);
  const reranked = await page.evaluate(() => ({
    order: [...document.querySelectorAll('[data-wqa-row="0"] .ph-rec-ref')].map(n => n.textContent),
    dist: wqa.rows[0].hist.records.map(r => r.refNo + ':' + r.dimDistance),
  }));
  A.eq(reranked.order[0], 'M20-1200',
    'a corrected length re-ranks the open panel — the 1200 is now the closest rod');
  A.includes(reranked.dist.join(' '), 'M20-1200:700', 'measured against the new length');
  A.eq(asked.length, askedBefore,
    'and costs no new lookup: the specification did not change, only the geometry');

  await page.evaluate(() => wqaEditSize(0, { value: 'M22' }, true));
  await page.waitForTimeout(1200);
  A.eq(asked.length, askedBefore + 1, 'changing the SIZE is a different item, so it is looked up again');
  A.eq(asked[asked.length - 1].size, 'M22', 'for the size the row now is');
  const afterSize = await page.evaluate(() =>
    [...document.querySelectorAll('[data-wqa-row="0"] .ph-rec-ref')].map(n => n.textContent));
  A.ok(afterSize.every(x => x.startsWith('M22-')), 'and nothing of the old size is left on screen');

  // ── 11 · each row's panel is its own ─────────────────────────────────────
  await page.click('[data-wqa-row="0"] .wqa-row-hist');
  await page.waitForTimeout(500);
  const oneClosed = await page.evaluate(() => [0, 1].map(i =>
    !!document.querySelector(`[data-wqa-row="${i}"] .wqa-hist-panel`)));
  A.eq(oneClosed.join(','), 'false,true', 'closing row 1 leaves row 2 open');
  A.eq(await page.evaluate(() => wqa.rows[0].histOpen + ',' + wqa.rows[1].histOpen), 'false,true',
    'and the state is per row, not per modal');

  // ── 6 · the size-type rules are untouched by any of this ─────────────────
  const sizeRules = await page.evaluate(() => {
    const ask = (m, sz) => { const r = dcCompanySizeType('sagrod', m, sz);
                             return (r.sizeType || 'NEEDS') + '/' + (r.why || '-'); };
    return { msM12: ask('MS', 'M12'), msHalf: ask('MS', '1/2'),
             qtM12: ask('4140', 'M12'), qtHalf: ask('4140', '1/2'),
             normM12: normalizeSizeValue('M12'), normHalf: normalizeSizeValue('1/2') };
  });
  A.eq(sizeRules.msM12, 'UNDERSIZE/companyDefault', 'MS M12 still takes the company rule');
  A.eq(sizeRules.msHalf, 'UNDERSIZE/companyDefault', 'and MS 1/2" with it');
  A.eq(sizeRules.qtM12, 'FULLSIZE/configured', '4140 QT M12 still defers to what is configured');
  A.eq(sizeRules.qtHalf, 'NEEDS/-', 'and 4140 QT 1/2" still asks');
  A.eq(sizeRules.normM12 + '|' + sizeRules.normHalf, 'M12|1/2', 'M12 and 1/2" are still two sizes');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();

  // ── 12 · the entry form's own panel is unchanged, and agrees ─────────────
  const formAsked = [];
  const form = await openApp(browser, {
    api: { get_pricing_history: url => serverPage(url, formAsked) },
  });
  await form.evaluate(id => { selectedCompanyId = id; }, ALPHA);
  const formPanel = await form.evaluate(async () => {
    switchType('sagrod');
    document.getElementById('sagrod-material').value = 'MS';
    document.getElementById('sagrod-sizeType').value = 'FULLSIZE';
    document.getElementById('sagrod-size').value = 'M20'; onSizeCommit('sagrod');
    document.getElementById('sagrod-length').value = '1000';
    document.getElementById('sagrod-threadLen').value = '100/100';
    setFinishValue('sagrod', 'PL');
    await checkPreviousPrice();
    return { refs: [...document.querySelectorAll('#phList .ph-rec-ref')].map(n => n.textContent),
             text: (document.getElementById('phList') || {}).textContent || '',
             shown: document.getElementById('phResults').style.display };
  });
  A.eq(formPanel.shown, 'block', 'the entry form panel still opens on its own button');
  A.eq(formAsked.map(q => q.size).join(','), 'M20', 'asking for the item on the form');
  A.includes(formPanel.text, 'Bolt Unit Price', 'and rendering the same fields');
  A.includes(formPanel.text, 'Not recorded', 'with the same wording for what was never recorded');
  A.includes(formPanel.text, 'Legacy / Unknown', 'and the same wording for an unrecorded price mode');
  A.includes(formPanel.text, 'Accessories on that line', 'and the same accessory wording here too');

  /* Same item, same identity, same records — one lookup, one set of matching
     rules, two screens. */
  A.eq(formPanel.refs.slice().sort().join(','),
       ['M20-1000', 'M20-ACC', 'M20-OLD', 'M20-1200', 'M20-500'].sort().join(','),
       'and the same set of records as the Quick Add row for the same item');
  A.eq(formAsked[0].material, 'MS', 'matched on the same material');
  A.eq(formAsked[0].product, 'SAG ROD', 'and the same product');

  /* One difference, and it is the entry form's, not a second algorithm: the
     form sends no dimensionPreview (phFormSpec leaves it empty), so nothing
     tells the server or the screen which rod is nearest and its list stays in
     the order the server returned. A Quick Add row knows its own geometry and
     ranks by it. Asserted rather than hidden, so the day the form learns its
     dimensions this test says what changes. */
  const formDims = await form.evaluate(() => phFormSpec().dimensionPreview);
  A.eq(formDims, '', 'the entry form still sends no dimensions of its own');
  A.eq(formPanel.refs[0] === 'M20-1000', 'false',
    'so its list is not ranked by closeness, and the Quick Add row is the screen that ranks');
  A.ok(form._dcErrors.length === 0, 'no page errors on the form: ' + form._dcErrors.join(' | '));
  await form.close();

  return S;
};
