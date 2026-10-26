/* Quick Add multi-variant expansion — owner-review screenshots.
   Run:  node tests/variants-shots.js [outdir]                                */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp } = require('./lib/harness');

const OUT = process.argv[2] || path.join(__dirname, '..', 'variants-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const dp = (id, type, material, sizeType, finish, costRate) =>
  ({ id, type, material, sizeType, size: '', finish, costRate, addCost: 1, markup: 0, active: '1' });
const DP = []; let n = 1;
['lbolt', 'sagrod'].forEach((t, ti) => [['MS', 5], ['4140', 9]].forEach(([m, base]) => ['FULLSIZE', 'UNDERSIZE'].forEach((st, si) =>
  ['PL', 'HDG'].forEach((f, fi) => DP.push(dp(n++, t, m, st, f, base - ti * 1.5 + si * 0.5 + fi * 1.5))))));
const it = (extra = {}) => Object.assign({ M: 'M20', L: 600, W: 150, TL: '100', qty: 1, Bmid: null, material: null, finish: null, sizeType: null,
  unclear: null, product: 'L_BOLT', threadEnds: 1, bodyDia: null, H: null, ID: null, S: null, R: null }, extra);
const LB = { product: 'L_BOLT', material: '4140', finish: 'PL', sizeType: 'FULLSIZE', threadEnds: 1, note: null, items: [it()] };
const SAG = { product: 'SAG_ROD', material: null, finish: null, sizeType: null, threadEnds: 2, note: null,
  items: [it({ W: null, TL: '100/100', product: 'SAG_ROD', threadEnds: 2 })] };

const shot = async (page, name, sel) => {
  await page.waitForTimeout(2600);   // let the toast go
  const t = sel ? await page.$(sel) : null;
  await (t || page).screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  ' + name + '.png');
};
const fresh = async (page, d, note) => {
  await page.evaluate(async ([d, note]) => { wqaHardClose(); wqaOpen(); wqa.aiNote = note || ''; await wqaAiApply(d); }, [d, note || '']);
  await page.waitForTimeout(1000);
};
const multi = async (page, k, values) => {
  await page.click(`#wqaCommon [data-mv="${k}"]`);
  await page.evaluate(vs => document.querySelectorAll('#wqaCommon .wqa-mv input').forEach(i => { i.checked = vs.indexOf(i.value) >= 0; }), values);
  await page.click('#wqaCommon .wqa-mv .btn-primary');
  await page.waitForTimeout(900);
};
const open = async (browser, vp, mobile) => {
  const ctx = await browser.newContext(mobile ? { viewport: vp, isMobile: true, hasTouch: true } : { viewport: vp });
  return openApp(browser, { context: ctx, api: { get_default_prices: { ok: true, data: DP } } });
};

(async () => {
  const browser = await launch();
  const page = await open(browser, { width: 1100, height: 1000 });
  const M = '#wqaModal .wqa-modal';
  const toggle = async pg => { await pg.click('#wqaVarBar .wqa-var-toggle'); await pg.waitForTimeout(300); };

  /* 1. Combination mode — 8 variants */
  await fresh(page, SAG, 'MS 4140 Fullsize Undersize PL HDG');
  await toggle(page);
  await shot(page, '1-combination-mode-8-variants', M);

  /* 2. Exact variants — exactly 2 */
  await fresh(page, SAG, 'Item 1: 4140 Fullsize Sag Rod PL Item 2: MS Undersize Sag Rod HDG');
  await toggle(page);
  await shot(page, '2-exact-variants-2', M);

  /* 3. Unsafe product — 1 ready, 1 needs attention, Add 1 Item */
  await fresh(page, LB); await multi(page, 'product', ['lbolt', 'jbolt']);
  await toggle(page);
  await shot(page, '3-unsafe-product-1-ready-1-needs-attention', M);

  /* 4. Product x Material — 4 variants */
  await fresh(page, LB); await multi(page, 'product', ['lbolt', 'sagrod']); await multi(page, 'material', ['MS', '4140']);
  await toggle(page);
  await shot(page, '4-product-x-material-4-variants', M);

  /* 5. Mobile 390 exact variants */
  const mp = await open(browser, { width: 390, height: 844 }, true);
  await fresh(mp, SAG, 'Item 1: 4140 Fullsize Sag Rod PL Item 2: MS Undersize Sag Rod HDG');
  await toggle(mp);
  await shot(mp, '5-mobile-390-exact-variants');

  /* 6. OWNER BUSINESS SEMANTIC CHECK — L Bolt TL100 -> Sag Rod thread */
  await fresh(page, LB);
  await page.evaluate(() => wqaEditRowProduct(0, 'sagrod'));
  await page.waitForTimeout(600);
  const manual = await page.evaluate(() => { const r = wqa.rows[0]; return r.threadLen + (r.threadLen2 ? '/' + r.threadLen2 : ''); });
  await fresh(page, LB); await multi(page, 'product', ['lbolt', 'sagrod']); await toggle(page);
  const ev = await page.evaluate(() => {
    const L = wqa.rows.find(r => r.product === 'lbolt'), S = wqa.rows.find(r => r.product === 'sagrod');
    return { l: L.threadLen + (L.threadLen2 ? '/' + L.threadLen2 : ''), s: S.threadLen + (S.threadLen2 ? '/' + S.threadLen2 : '') };
  });
  await page.evaluate(([ev, manual]) => {
    const d = document.createElement('div');
    d.style.cssText = 'margin:8px 0;padding:10px 12px;border:2px solid #b45309;border-radius:10px;background:#fffbeb;font:13px/1.45 system-ui;color:#451a03';
    d.innerHTML = '<b>OWNER RULE — Sag Rod thread</b><br>Source L Bolt thread length: <b>' + ev.l + '</b><br>'
      + 'Sag Rod variant (variant expansion): <b>' + ev.s + '</b> &nbsp;·&nbsp; Sag Rod via the existing manual product switch: <b>' + manual + '</b><br>'
      + 'OWNER RULE (locked): a single thread on a Sag Rod is both ends — TL100 becomes TL100/100, in variant expansion and in the manual Product switch.';
    document.getElementById('wqaVarBar').after(d);
  }, [ev, manual]);
  await shot(page, '6-owner-rule-lbolt-tl100-to-sagrod-thread', M);

  await browser.close();
})();
