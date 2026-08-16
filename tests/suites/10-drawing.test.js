/* ── Engineering drawings: each part owns its own dimensions ───────────────
   Requirements 7, 8.

   Reproduces HAB-TA-01: five Sag Rod parts on one sheet, four of them threaded
   200/200, with overall lengths 950, 865, 1000, 1200 and 1285. The reported
   failure was rows 3 and 5 coming back as "Check length 1000 or 865" and
   "Check length 1285 or 865" — the row ABOVE's dimension offered as a reading
   of this row's.

   Which dimension the model reads off a drawing is governed by ai_extract.php's
   instructions, and those are asserted in tests/php/ai_extract.test.php. What
   is asserted here is everything downstream of the answer: that the app takes
   the length each part states, that the segment arithmetic CONFIRMS it rather
   than contradicting it, that 200/200 is a thread and never a length, and that
   a doubt the extractor does report is shown as a doubt and never as a value. */
'use strict';
const { openApp, rowState } = require('../lib/harness');

const part = (L, extra = {}) => Object.assign({
  M: 'M30', L, W: null, TL: '200/200', qty: null, Bmid: null,
  material: null, finish: null, sizeType: null, unclear: null,
  product: null, threadEnds: 2, bodyDia: null, H: null, ID: null, S: null, R: null,
}, extra);

const SHEET = {
  product: 'SAG_ROD', material: 'MS', finish: 'HDG', sizeType: null,
  threadEnds: 2, note: null,
  items: [
    part(950,  { TL: null, threadEnds: null }),      // part 1: no thread stated
    part(865,  { Bmid: 465 }),                       // 200 + 465 + 200 = 865
    part(1000, { Bmid: 600 }),                       // 200 + 600 + 200 = 1000
    part(1200, { Bmid: 800 }),                       // 200 + 800 + 200 = 1200
    part(1285, { Bmid: 885 }),                       // 200 + 885 + 200 = 1285
  ],
};

module.exports = async (browser, A) => {
  const S = A.suite('engineering drawing — five parts, five lengths, no borrowed dimensions');
  const page = await openApp(browser);

  await page.evaluate(async d => { wqaOpen(); await wqaAiApply(d); }, SHEET);
  await page.evaluate(() => wqaSetView('expanded'));
  await page.waitForTimeout(1200);

  const rows = await rowState(page);
  A.eq(rows.length, 5, 'five drawing rows produce five items');

  [950, 865, 1000, 1200, 1285].forEach((len, i) => {
    A.eq(rows[i].length, String(len), `part ${i + 1} is L${len}`);
    A.eq(rows[i].size, 'M30', `part ${i + 1} is M30`);
  });

  // ── 200/200 is a thread. It is not a length and not half of one ──────────
  for (let i = 1; i < 5; i++) {
    A.eq(rows[i].thread, '200/200', `part ${i + 1} is threaded 200 at each end`);
    A.ok(rows[i].length !== '200' && rows[i].length !== '400',
      `part ${i + 1}'s length is its own, not its thread`);
  }
  A.eq(rows[0].thread, '', 'the part that states no thread is not given one');

  // ── no part's dimension is offered as a reading of another's ─────────────
  rows.forEach((r, i) => {
    A.eq(r.badges.includes('Check'), false, `part ${i + 1} carries no "Check length" doubt`);
    A.excludes(r.badges, '865', `part ${i + 1} is not offered part 2's 865`);
  });

  // ── the segment arithmetic confirms the length; it does not fight it ─────
  rows.slice(1).forEach((r, i) => {
    A.excludes(r.badges, 'segments vs length',
      `part ${i + 2}: 200 + centre + 200 adds up to its stated length, so nothing is flagged`);
  });

  // ── the sheet states no size type, so nothing is weighed yet ─────────────
  /* Neither the sheet nor any part says fullsize or undersize, and no company
     rule covers mild steel at M30. An unanswered size type is not a fullsize
     one: there is no diameter, so there is no weight and no price, and the row
     asks for the one thing it needs. */
  rows.forEach((r, i) => {
    A.eq(r.sizeType, '', `part ${i + 1}: the drawing states no size type`);
    A.ok(r.missing.includes('Size Type'), `part ${i + 1}: so the row asks for one`);
    A.ok(!(Number(r.weight) > 0), `part ${i + 1}: and is not weighed on a guess`);
    A.ok(!(Number(r.price) > 0), `part ${i + 1}: nor priced on one`);
  });

  // ── answered, every part is weighed on its OWN length ────────────────────
  const K = 0.0000061654;
  await page.evaluate(() => wqa.rows.forEach((r, i) => wqaEditRowSpec(i, 'sizeType', 'FULLSIZE')));
  await page.waitForTimeout(1400);
  const weighed = await rowState(page);
  [950, 865, 1000, 1200, 1285].forEach((len, i) => {
    A.eq(weighed[i].length, String(len), `part ${i + 1} still states L${len}`);
    A.near(weighed[i].weight, 30 * 30 * len * K, 1e-6, `part ${i + 1} weighs 30mm x ${len}mm of bar`);
  });
  A.ok(Number(weighed[2].weight) !== Number(weighed[1].weight),
    'part 3 does not weigh what part 2 weighs — which is what a borrowed 865 would have cost');

  // ── arithmetic that genuinely disagrees IS flagged ───────────────────────
  /* The A + B + C check itself runs server-side, in ai_sanitise_extraction —
     see tests/php/ai_extract.test.php. What is asserted here is what the review
     screen does with its answer. */
  const wrong = JSON.parse(JSON.stringify(SHEET));
  wrong.items = [part(1000, { Bmid: 999, Bbad: true })];   // 200 + 999 + 200 is not 1000
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, wrong);
  await page.waitForTimeout(900);
  const flagged = await rowState(page);
  A.includes(flagged[0].badges, 'segments vs length',
    'segments that do not add up to the stated length are surfaced for a person');
  A.eq(flagged[0].length, '1000', 'and the printed length is reported as printed, not adjusted to fit');

  // ── a doubt the extractor DOES report is a doubt, never a value ──────────
  const unsure = JSON.parse(JSON.stringify(SHEET));
  unsure.items = [part(null, { unclear: 'length unreadable' })];
  await page.evaluate(async d => { wqaHardClose(); wqaOpen(); await wqaAiApply(d); }, unsure);
  await page.waitForTimeout(900);
  const asked = await rowState(page);
  A.eq(asked[0].length, '', 'an unreadable length stays empty');
  A.includes(asked[0].badges, 'length unreadable', 'and the row says so');
  A.ok(asked[0].missing.includes('Length'), 'and asks for it');
  A.eq(asked[0].weight, 'null', 'nothing is weighed from a length nobody read');
  A.eq(asked[0].price, 'null', 'and nothing is priced');

  A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
