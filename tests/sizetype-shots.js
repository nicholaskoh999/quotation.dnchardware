/* ── An unanswered size type, on screen ─────────────────────────────────────
   The live report: a half-inch rod showing 1.0143 kg/pc — the FULLSIZE figure —
   on a row that said "Needs Size Type" in the same breath. These frames are the
   row before and after the question is answered.
   Run:  node tests/sizetype-shots.js [outdir]                                */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openApp, quickAddPaste } = require('./lib/harness');

const OUT = process.argv[2] || path.join(__dirname, '..', 'audit-out', 'sizetype');
fs.mkdirSync(OUT, { recursive: true });

/* The row's Size Type select, changed as a person changes it. */
const choose = async (page, value) => {
  await page.selectOption('[data-wqa-row="0"] select[onchange*="sizeType"]', value);
  await page.waitForTimeout(1300);
};

const shot = async (page, name, sel) => {
  const t = sel ? await page.$(sel) : null;
  await (t || page).screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  ' + name + '.png');
};

(async () => {
  const browser = await launch();

  // ── 1/2 x L1020, with nothing said about the size type ──────────────────
  {
    const page = await openApp(browser, { viewport: { width: 1500, height: 1200 } });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'SAG ROD ZP\n1/2 x 1020 x 100/100 - 20pcs',
      { expanded: true, settle: 1200 });
    await shot(page, '1-half-inch-no-size-type', '#wqaStep2');
    await page.close();
  }

  // ── mild steel M16: stated material, still no rule, still no weight ─────
  {
    const page = await openApp(browser, { viewport: { width: 1500, height: 1200 } });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP\nM16 x 1020 x 100/100 - 20pcs',
      { expanded: true, settle: 1200 });
    await shot(page, '2-M16-no-size-type', '#wqaStep2');

    /* Chosen from the row's own select, the way a person chooses it, so the
       frame shows the screen they would be looking at. */
    await choose(page, 'UNDERSIZE');
    await shot(page, '3-M16-undersize-chosen', '#wqaStep2');

    await choose(page, 'FULLSIZE');
    await shot(page, '4-M16-fullsize-chosen', '#wqaStep2');
    await page.close();
  }

  // ── the company's own rule is an ANSWER, and still weighs ───────────────
  {
    const page = await openApp(browser, { viewport: { width: 1500, height: 1200 } });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD ZP\n1/2 x 1020 x 100/100 - 20pcs',
      { expanded: true, settle: 1200 });
    await shot(page, '5-half-inch-company-rule-undersize', '#wqaStep2');
    await page.close();
  }

  await browser.close();
  console.log('\n  size type frames in ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
