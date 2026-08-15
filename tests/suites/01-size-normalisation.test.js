/* ── The size box says what the row IS ─────────────────────────────────────
   Requirements 3, 4, 13, 37, 38, 39, 49.

   Every assertion here runs against the shipped page. The point of doing it in
   a browser rather than against the parser is that a parser returning "M27" is
   not the feature: the feature is that typing 27 makes the row weigh what an
   M27 weighs, on the keystroke, with the caret still in the box.            */
'use strict';
const { openApp, quickAddPaste, rowState, typeRowSize } = require('../lib/harness');

const MSG = 'MS SAG ROD PL FULLSIZE\nM23 x 1000 x 100/100 - 5pcs';
/* The calculators multiply d^2 x L by this constant. It is asserted below to
   BE pi/4 x 7.85e-6 — steel at 7.85 g/cm3 through a circular section — so the
   expected weights here are worked out independently of the app and the one
   number they share is checked rather than assumed. */
const RHO_K = 0.0000061654;
const rodWeight = (d, L) => d * d * L * RHO_K;

module.exports = async (browser, A) => {
  const S = A.suite('size normalisation — model, screen and weight agree');
  const page = await openApp(browser);

  A.near(RHO_K, Math.PI / 4 * 7.85e-6, 1e-10,
    'the weight constant is pi/4 x 7.85e-6 (circular section, steel), to the last digit it carries');

  // ── the size a document states, which we do not stock ────────────────────
  await quickAddPaste(page, MSG);
  let rows = await rowState(page);
  A.eq(rows.length, 1, 'M23 message produces one row');
  A.eq(rows[0].size, 'M23', 'an unrecognised size is kept exactly as written');
  A.eq(rows[0].shownSizeInput, 'M23', 'and the size box shows it');
  A.eq(rows[0].weight, 'null', 'an unrecognised size is never weighed');
  A.eq(rows[0].shownUnitWeight, '—', 'the unit weight reads as absent, not as zero');
  A.ok(rows[0].missing.includes('Valid Size'), 'the row asks for a valid size');
  A.includes(rows[0].badges, 'Diameter Settings', 'and says why: not in Diameter Settings');
  A.ok(!/\d/.test(String(rows[0].shownTotalWeight)), 'no total weight is shown either');

  // ── 23 corrected to 22, without Enter and without leaving the box ────────
  await typeRowSize(page, 0, '22');
  rows = await rowState(page);
  A.eq(rows[0].size, 'M22', 'typing 22 makes the canonical size M22');
  A.eq(rows[0].shownSizeInput, 'M22', 'the box itself shows M22 — the M is part of the size');
  A.eq(rows[0].shownSize, 'M22', 'and the compact line agrees with the box');
  A.near(rows[0].weight, rodWeight(22, 1000), 1e-6, 'M22 x 1000 weighs pi/4 d^2 L rho');
  A.includes(rows[0].shownUnitWeight, rodWeight(22, 1000).toFixed(4), 'the screen shows that weight');
  A.includes(rows[0].shownTotalWeight, (rodWeight(22, 1000) * 5).toFixed(4), 'total weight is unit weight x qty');
  A.eq(rows[0].badges.trim(), '', 'the warnings went with the problem');
  A.ok(Number(rows[0].price) > 0, 'and the row can now be priced');

  // ── and to 27 ─────────────────────────────────────────────────────────────
  await typeRowSize(page, 0, '27');
  rows = await rowState(page);
  A.eq(rows[0].size, 'M27', '27 normalises to M27');
  A.eq(rows[0].shownSizeInput, 'M27', 'in the box');
  A.near(rows[0].weight, rodWeight(27, 1000), 1e-6, 'and the weight follows the new size');
  A.includes(rows[0].shownTotalWeight, (rodWeight(27, 1000) * 5).toFixed(4), 'total weight follows too');

  // ── m27 and M27 are the same size ────────────────────────────────────────
  await typeRowSize(page, 0, 'm27');
  rows = await rowState(page);
  A.eq(rows[0].size, 'M27', 'm27 is M27');
  A.eq(rows[0].shownSizeInput, 'M27', 'shown with a capital M');

  await typeRowSize(page, 0, 'M27');
  rows = await rowState(page);
  A.eq(rows[0].size, 'M27', 'M27 is left alone');
  A.eq(rows[0].shownSizeInput, 'M27', 'and not doubled');

  // ── a size we do not stock, typed by hand, stays as typed ────────────────
  await typeRowSize(page, 0, '23');
  rows = await rowState(page);
  A.eq(rows[0].size, 'M23', '23 is M23 and is not corrected to a size we do stock');
  A.eq(rows[0].weight, 'null', 'and it is not weighed');
  A.includes(rows[0].badges, 'Diameter Settings', 'the reason is named again');

  // ── stale weight: a size change must never leave the old number behind ───
  await typeRowSize(page, 0, '30');
  rows = await rowState(page);
  A.eq(rows[0].size, 'M30', 'M23 -> M30');
  A.near(rows[0].weight, rodWeight(30, 1000), 1e-6, 'weight is M30s, not M23s and not M27s');
  const m30price = Number(rows[0].price);
  await typeRowSize(page, 0, '20');
  rows = await rowState(page);
  A.near(rows[0].weight, rodWeight(20, 1000), 1e-6, 'and M30 -> M20 reweighs again');
  A.ok(Number(rows[0].price) !== m30price, 'the price moved with the weight, it did not stay at M30s');

  // ── an inch size typed into the same box is not turned into a metric one ─
  await typeRowSize(page, 0, '1/2', { blur: true });
  rows = await rowState(page);
  A.eq(rows[0].size, '1/2', 'typing 1/2 gives the inch size 1/2, never M1 or M1/2');
  A.eq(rows[0].shownSizeInput, '1/2', 'and the box holds it as typed');
  A.near(rows[0].weight, rodWeight(12.7, 1000), 1e-6, 'weighed on 12.7mm — the half inch, fullsize');

  await typeRowSize(page, 0, '3/4', { blur: true });
  rows = await rowState(page);
  A.eq(rows[0].size, '3/4', '3/4 likewise');
  A.near(rows[0].weight, rodWeight(19.05, 1000), 1e-6, 'weighed on 19.05mm');

  // ── the two views show the same value ────────────────────────────────────
  await typeRowSize(page, 0, '24', { blur: true });
  await page.evaluate(() => wqaSetView('compact'));
  await page.waitForTimeout(300);
  const compact = await page.evaluate(() => ({
    model: wqa.rows[0].size,
    cell: document.querySelector('[data-wqa-row="0"] .wqa-c-size').textContent,
  }));
  A.eq(compact.model, 'M24', 'switching to compact does not change the value');
  A.eq(compact.cell, 'M24', 'and compact shows what the model holds');
  await page.evaluate(() => wqaSetView('expanded'));
  await page.waitForTimeout(300);
  const expanded = await page.evaluate(() => ({
    model: wqa.rows[0].size,
    box: document.querySelector('[data-wqa-row="0"] .wqa-row-body input').value,
  }));
  A.eq(expanded.model, 'M24', 'switching back does not change it either');
  A.eq(expanded.box, 'M24', 'and expanded shows the same thing compact did');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
