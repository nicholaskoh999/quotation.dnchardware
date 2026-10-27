/* ── Quick edit, strict alignment, accessory intelligence ───────────────────
   Owner smoke (2026-10-27): summary values are their own boxes (group and
   item), every row shares one set of column tracks, accessories are read as
   entities + counts and set for the group, accessory finish starts from the
   rod and is its own once chosen, and Accessory History is asked with — and
   labelled against — the ACCESSORY's finish.                             */
'use strict';
const H = require('../lib/harness');

const SMOKE = 'Morning CL, can you help me quote this price? Thank you.\nM/S SAGROD UNDERSIZE (ZP)\nM12 X TL70/70\n940 - 43pcs\n970 - 91pcs\n1050 - 8pcs\n1230 - 8 pcs\n1290 - 8pcs\n\ncw 4nuts & 4fw';
const NUT_HIST = [
  { type: 'Nut', size: 'M12', finish: 'ZP', unitPrice: 0.15, refNo: 'Q-2026-1057', date: '2026-10-02', customer: 'CH YODOFORM' },
  { type: 'Nut', size: 'M12', finish: 'ZP', unitPrice: 0.15, refNo: 'Q-2026-0586', date: '2026-08-18', customer: 'CH YODOFORM' },
  { type: 'Nut', size: 'M12', finish: 'PL', unitPrice: 0.15, refNo: 'Q-2026-0901', date: '2026-09-02', customer: 'ABC' },
  { type: 'Nut', size: 'M12', finish: '', unitPrice: 0.15, refNo: 'Q-2026-0700', date: '2026-08-02', customer: 'XYZ' },
  { type: 'Nut', size: 'M12', finish: 'ZP', unitPrice: 0.20, refNo: 'Q-2026-1365', date: '2026-10-26', customer: 'LEY' },
];

async function open(b, width, msg, asked) {
  const ctx = await b.newContext({ viewport: { width, height: 1000 } });
  const p = await H.openApp(b, { context: ctx, api: { get_accessory_history: url => {
    const q = Object.fromEntries(new URL(url).searchParams.entries()); if (asked) asked.push(q);
    return { ok: true, data: { total: NUT_HIST.length, records: q.type === 'nut' ? NUT_HIST : [] } };
  } } });
  p.on('dialog', d => d.accept().catch(() => {}));
  if (msg) await H.quickAddPaste(p, msg, { expanded: false, settle: 1100 });
  return { ctx, p };
}
const rows = p => p.evaluate(() => wqa.rows.filter(r => !r.removed).map(r => ({
  len: r.length, qty: String(r.qty), dia: String(r.diaMm), rate: String((r.calc || {}).costRate), add: String((r.calc || {}).addCost),
  mk: String((r.calc || {}).markup), w: (r.calc || {}).weight, px: (r.calc || {}).finalUnitPrice, bolt: (r.calc || {}).boltUnitPrice,
  open: !!r.open, finish: wqaRowSpec(r, 'finish'),
  nut: r.acc && r.acc.nut.enabled ? [String(r.acc.nut.qty), r.acc.nut.finish, Number(r.acc.nut.unitPrice)] : null,
  fw: r.acc && r.acc.fw.enabled ? [String(r.acc.fw.qty), r.acc.fw.finish, Number(r.acc.fw.unitPrice)] : null })));
async function quick(p, sel, f, v) {
  await p.click(sel + ` [data-gx="${f}"]`); await p.waitForTimeout(150);
  await p.fill(`#wqaRows [data-gx-in="${f}"]`, v); await p.press(`#wqaRows [data-gx-in="${f}"]`, 'Enter'); await p.waitForTimeout(800);
}

module.exports = async (browser, A) => {
  A.suite('quick edit · alignment · accessory intelligence');

  // ── E · H — entity + quantity reading ────────────────────────────────────
  let { ctx, p } = await open(browser, 1440);
  const forms = ['c/w 4 nuts & 4 fw', 'cw 4nuts 4washers', 'complete with 4N + 4FW', '4 nuts + 4 flat washers', 'Nut x4, Washer x4',
                 'NUT 4PCS / FW 4PCS', '4pcs Nut + 4pcs FW', '4N 4FW', 'nuts 4, washers 4', 'C/W 4 NUTS & 4 F/W', 'with 4 nut and 4 F.W.'];
  const read = await p.evaluate(fs => fs.map(f => { const a = wqaAccScan(f); return a ? a.nut + '/' + a.fw + '/' + (a.rest || '') : 'null'; }), forms);
  forms.forEach((f, k) => A.eq(read[k], '4/4/', `E: "${f}" → Nut 4 · Flat Washer 4`));
  const odd = await p.evaluate(() => ({
    miss: wqaAccScan('with nuts and washers'), spring: wqaAccScan('Spring Washer 4pcs'), total: wqaAccScan('Nut 100pcs'),
    lock: wqaAccScan('c/w 2 lock nuts & 2 FW'), plain: wqaAccScan('M16 x 300 - 35pcs') }));
  A.eq(odd.miss.need.join(','), 'nut,fw', 'G: "with nuts and washers" — both detected, quantity asked for');
  A.eq(JSON.stringify(odd.spring.custom) + '/' + odd.spring.fw, '{"text":"Spring Washer","qty":4}/null', 'H: Spring Washer 4pcs → Custom, not Flat Washer');
  A.eq(odd.total.need.join(',') + '/' + odd.total.nut, 'nut/null', 'a lone "Nut 100pcs" is detected, but its total is never made a per-item count');
  A.eq(odd.lock.custom.text + '/' + odd.lock.fw, 'Lock Nuts/2', 'a lock nut is Custom beside the plain FW');
  A.eq(odd.plain, null, 'a rod line with no accessory word reads nothing');
  const o452 = await p.evaluate(() => { setFieldValue('lbolt', 'priceMode', 'auto');
    const f = resolvePriceMode('lbolt', 3.43, 0, accAddon({ nut: { enabled: true, qty: 4, unitPrice: 0.18 }, fw: { enabled: true, qty: 4, unitPrice: 0.10 } }));
    return priceCalcState.lbolt.boltUnitPrice.toFixed(2) + ' + ' + priceCalcState.lbolt.accessoriesCost.toFixed(2) + ' = ' + f.toFixed(2); });
  A.eq(o452, '3.40 + 1.12 = 4.52', 'O: RM3.40 + 4 × RM0.18 + 4 × RM0.10 = RM4.52, not re-rounded');
  await ctx.close();

  // ── F — the rod's qty is not the accessory's ─────────────────────────────
  ({ ctx, p } = await open(browser, 1440, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x 70/70 - 20pcs c/w 4 nuts & 4fw'));
  let r = await rows(p);
  A.eq(r.map(x => x.qty + '|' + x.nut + '|' + x.fw).join(), '20|4,PL,0|4,PL,0', 'F: main Qty 20, Nut 4 / item, FW 4 / item');
  await ctx.close();

  // ── G — missing count: detected and asked for ────────────────────────────
  ({ ctx, p } = await open(browser, 1440, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x 70/70 - 20pcs\nwith nuts and washers'));
  const g = await p.evaluate(() => ({ miss: wqaRowMissing(wqa.rows[0]).join(','), text: document.querySelector('#wqaRows').textContent,
    ph: (document.querySelector('[data-gacc="nut"] [data-gacc-f="qty"]') || {}).placeholder }));
  A.includes(g.miss, 'Accessory Qty', 'G: the item needs attention until the count is confirmed');
  A.eq(g.ph, 'Qty needs confirmation', 'G: the Qty / item box says so');
  await p.fill('[data-gacc="nut"] [data-gacc-f="qty"]', '2'); await p.press('[data-gacc="nut"] [data-gacc-f="qty"]', 'Tab'); await p.waitForTimeout(600);
  await p.fill('[data-gacc="fw"] [data-gacc-f="qty"]', '2'); await p.press('[data-gacc="fw"] [data-gacc-f="qty"]', 'Tab'); await p.waitForTimeout(600);
  A.eq(await p.evaluate(() => wqaRowMissing(wqa.rows[0]).indexOf('Accessory Qty')), -1, 'G: confirming both counts clears it');
  await ctx.close();

  // ── I · J · C · L · M · N · P · O — the smoke case, group by group ───────
  const asked = [];
  ({ ctx, p } = await open(browser, 1440, SMOKE, asked));
  r = await rows(p);
  A.eq(r.length, 5, 'I: five rows read');
  A.eq(r.map(x => x.nut[0] + '/' + x.fw[0]).join(), '4/4,4/4,4/4,4/4,4/4', 'I: every row of the group carries Nut ×4 and FW ×4 — no row opened');
  A.eq(r.map(x => x.nut[1] + x.fw[1]).join(), 'ZPZP,ZPZP,ZPZP,ZPZP,ZPZP', 'J: accessory finish starts from the rod: ZP');
  A.eq(await p.evaluate(() => !!document.querySelector('.wqa-ser .wqa-gacc [data-gacc="nut"]') && !!document.querySelector('.wqa-ser .wqa-gacc [data-gacc="fw"]')), 'true',
    'the group heading carries the accessory editor');

  // C — group direct edit of Ø / Cost / Add. Cost / Markup, without the panel
  const w0 = r.map(x => x.w);
  await quick(p, '.wqa-ser .wqa-ser-head', 'dia', '10.5');
  r = await rows(p);
  A.eq(r.map(x => x.dia).join(), '10.5,10.5,10.5,10.5,10.5', 'C: Ø10.5 on the heading → every row of the group');
  A.ok(r.every((x, k) => x.w < w0[k]), 'C: every weight recalculates from Ø10.5');
  A.eq(r.some(x => x.open), false, 'C: no row panel was opened');
  await quick(p, '.wqa-ser .wqa-ser-head', 'costRate', '4.50');
  await quick(p, '.wqa-ser .wqa-ser-head', 'addCost', '0.80');
  await quick(p, '.wqa-ser .wqa-ser-head', 'markup', '10');
  r = await rows(p);
  A.eq(r.map(x => x.rate + '/' + x.add + '/' + x.mk).join(), Array(5).fill('4.50/0.80/10').join(), 'C: Cost, Add. Cost and Markup from the heading');

  // L · M — history asked with the ACCESSORY's finish; same vs different
  await p.click('[data-gacc="nut"] .wqa-gacc-hist'); await p.waitForTimeout(700);
  const nutAsk = asked.filter(q => q.type === 'nut').pop();
  A.eq(nutAsk.finish + '/' + nutAsk.cleanSize + '/' + nutAsk.all, 'ZP/M12/1', 'L: Nut · M12 · ZP — the accessory\'s finish, every finish asked for');
  const hp = await p.evaluate(() => [...document.querySelectorAll('[data-gacc="nut"] .acc-hist-group')].map(n => ({
    fin: n.dataset.accFinish, price: n.querySelector('.ph-rec-unit').textContent, cls: n.querySelector('.acc-hist-cls').textContent,
    refs: n.querySelectorAll('.acc-hist-refs li').length, weak: n.querySelector('.ph-rec-use').classList.contains('ph-use-weak') })));
  A.eq(hp.map(x => x.price + ' ' + x.fin + ' ' + x.cls + ' ' + x.refs).join(' | '),
    'RM 0.15 ZP Same finish 2 | RM 0.20 ZP Same finish 1 | RM 0.15 PL Different finish 1 | RM 0.15 N/A Different finish 1',
    'M: RM0.15 ZP / PL / N/A are three groups; the same finish first, events kept');
  A.eq(hp.map(x => x.weak).join(), 'false,false,true,true', 'I (appendix): a different finish is the weaker action');
  A.eq(JSON.stringify((await rows(p)).map(x => x.nut)), JSON.stringify(r.map(x => x.nut)), 'opening Accessory History changed nothing');

  // N · appendix D/E/F — a PL price: unit price only
  await p.click('[data-gacc="nut"] [data-acc-finish="PL"] .ph-rec-use'); await p.waitForTimeout(800);
  r = await rows(p);
  A.eq(r.map(x => x.nut.join('/')).join(), Array(5).fill('4/ZP/0.15').join(), 'N: the PL record set RM0.15 — Qty 4 and Finish ZP unchanged');
  A.eq(r.map(x => x.fw[2]).join(), '0,0,0,0,0', 'and the Flat Washer is untouched');

  // P — a row's own count, then a group price: the row keeps its count
  await p.evaluate(() => wqaEditAcc(2, 'nut', 'qty', '6')); await p.waitForTimeout(500);
  await p.fill('[data-gacc="nut"] [data-gacc-f="unitPrice"]', '0.18'); await p.press('[data-gacc="nut"] [data-gacc-f="unitPrice"]', 'Tab'); await p.waitForTimeout(700);
  await p.fill('[data-gacc="fw"] [data-gacc-f="unitPrice"]', '0.10'); await p.press('[data-gacc="fw"] [data-gacc-f="unitPrice"]', 'Tab'); await p.waitForTimeout(700);
  r = await rows(p);
  A.eq(r.map(x => x.nut[0]).join(), '4,4,6,4,4', 'P: row 3 keeps Nut ×6; the others stay ×4');
  A.eq(r.map(x => x.nut[2]).join(), '0.18,0.18,0.18,0.18,0.18', 'G (appendix): the group price reaches every row that inherits it');
  await p.evaluate(() => wqaEditAcc(1, 'nut', 'unitPrice', '0.30')); await p.waitForTimeout(500);
  await p.fill('[data-gacc="nut"] [data-gacc-f="unitPrice"]', '0.20'); await p.press('[data-gacc="nut"] [data-gacc-f="unitPrice"]', 'Tab'); await p.waitForTimeout(700);
  r = await rows(p);
  A.eq(r.map(x => x.nut[2]).join(), '0.2,0.3,0.2,0.2,0.2', 'H (appendix): a row\'s own price is untouched by the group default');
  A.eq(await p.evaluate(() => wqa.rows[0].acc !== wqa.rows[1].acc && wqa.rows[0].acc.nut !== wqa.rows[3].acc.nut), 'true', 'no two rows share an accessory object');
  // O — accessories after the rod's rounding, never re-rounded
  r = await rows(p);
  A.ok(r.every(x => Math.round(x.bolt * 100) % 5 === 0), `O: each Sag Rod is rounded to RM0.05 first (${r.map(x => x.bolt).join(', ')})`);
  A.ok(r.every((x, k) => Math.abs(x.px - Math.round((x.bolt + (k === 1 ? 0.30 : 0.20) * Number(x.nut[0]) + 0.10 * 4) * 100) / 100) < 1e-9),
    `O: then the accessories are added and the total is not rounded again (${r.map(x => x.bolt + '→' + x.px).join(', ')})`);
  A.ok(r.some(x => Math.round(x.px * 100) % 10 !== 0), 'O: so a final like RM x.x2 stays as it is');

  // K — accessory finish chosen by hand stays; one still following moves
  await p.selectOption('[data-gacc="nut"] [data-gacc-f="finish"]', ''); await p.waitForTimeout(600);
  await p.evaluate(() => wqaSetCommon('finish', 'HDG')); await p.waitForTimeout(900);
  r = await rows(p);
  A.eq(r.map(x => x.finish).join(), 'HDG,HDG,HDG,HDG,HDG', 'K: the rod is now HDG');
  A.eq(r.map(x => x.nut[1] === '' ? 'N/A' : x.nut[1]).join(), 'N/A,N/A,N/A,N/A,N/A', 'K: the Nut set to N/A by hand stays N/A');
  A.eq(r.map(x => x.fw[1]).join(), 'HDG,HDG,HDG,HDG,HDG', 'and the FW still following the rod becomes HDG');
  // C (appendix) — the history context follows the accessory's finish
  await p.evaluate(() => { wqa.accH = null; wqaRenderRows(true); });
  await p.click('[data-gacc="nut"] .wqa-gacc-hist'); await p.waitForTimeout(700);
  A.eq(asked.filter(q => q.type === 'nut').pop().finish, '', 'C (appendix): Nut finish N/A → history asked for N/A');
  await ctx.close();

  // ── D — single-row quick edit ────────────────────────────────────────────
  ({ ctx, p } = await open(browser, 1440, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x 70/70 - 20pcs\n\nMS STUD PL\nM16 x 300 - 5pcs'));
  const one = async (f, v) => quick(p, '[data-wqa-row="1"] .wqa-it-main', f, v);
  await one('dia', '15.5'); await one('costRate', '6.10'); await one('addCost', '0.70'); await one('markup', '12');
  r = await rows(p);
  A.eq([r[1].dia, r[1].rate, r[1].add, r[1].mk, r[1].open].join('/'), '15.5/6.10/0.70/12/false', 'D: the Stud row edited from its summary, panel shut');
  A.eq([r[0].rate, r[0].add, r[0].mk].join('/'), '2.80/0.60/0', 'D: the Sag Rod row beside it is untouched');
  // B — unequal thread wording
  await H.quickAddPaste(p, 'MS SAG ROD PL FULLSIZE\nM12 x 1000 x 70/200 - 2pcs\nM12 x 1000 x 70/70 - 2pcs', { expanded: false, settle: 900 });
  const badge = () => p.evaluate(() => [0, 1].map(i => document.querySelector(`[data-wqa-row="${i}"] .wqa-it-sub`).textContent));
  let bt = await badge();
  A.includes(bt[0], 'Unequal Thread', 'B: TL70/200 → Unequal Thread');
  A.ok(!/Unequal|Asymmetric/.test(bt[1]), 'B: TL70/70 → no badge');
  await p.evaluate(() => dcSetLang('zh')); await p.waitForTimeout(300);
  bt = await badge();
  A.includes(bt[0], '两端牙长不同', 'B: 两端牙长不同');
  A.eq(await p.evaluate(() => [wqaIsAsymmetric({ threadLen: '70', threadLen2: '70.0' }), wqaIsAsymmetric({ threadLen: '50', threadLen2: '110' })].join()), 'false,true',
    'B: 70 and 70.0 are one length; 50/110 differ');
  await ctx.close();

  // ── A — the history icon (record + clock), everywhere it is used ──────────
  for (const [w, lang] of [[1440, 'en'], [390, 'zh']]) {
    ({ ctx, p } = await open(browser, w, SMOKE));
    if (lang === 'zh') { await p.evaluate(() => dcSetLang('zh')); await p.waitForTimeout(300); }
    const ic = await p.evaluate(() => ['.wqa-row-hist', '.wqa-gacc-hist'].map(sel => { const b = document.querySelector('#wqaRows ' + sel);
      const s = b && b.querySelector('svg.dc-hist-ico'); const r1 = s && s.getBoundingClientRect(), r2 = b && b.getBoundingClientRect();
      return { icon: !!(s && s.querySelector('circle[cx="8"][cy="16"]')), mid: s ? Math.abs((r1.top + r1.height / 2) - (r2.top + r2.height / 2)) < 2 : false,
               text: b ? b.textContent.trim() : '' }; }));
    A.eq(ic.map(x => x.icon + '/' + x.mid).join(), 'true/true,true/true', `A ${w} ${lang}: record-clock icon, vertically centred, on Pricing History and Accessory History`);
    if (lang === 'zh') A.includes(ic[0].text, '客户历史报价', 'A 中文: 客户历史报价');
    await ctx.close();
  }

  // ── Q — alignment at every width; Chinese; appendix J · K ─────────────────
  for (const [w, lang] of [[1440, 'en'], [820, 'en'], [390, 'en'], [1440, 'zh'], [390, 'zh']]) {
    ({ ctx, p } = await open(browser, w, SMOKE));
    if (lang === 'zh') { await p.evaluate(() => dcSetLang('zh')); await p.waitForTimeout(400); }
    await p.click('[data-gacc="nut"] .wqa-gacc-hist'); await p.waitForTimeout(700);
    const q = await p.evaluate(() => {
      const sc = document.querySelector('#wqaModal .wqa-scroll');
      const cards = [...document.querySelectorAll('#wqaRows .wqa-ser-rows .wqa-it')];
      const xs = sel => new Set(cards.map(c => { const n = c.querySelector(sel); return n ? Math.round(n.getBoundingClientRect()[sel === '.wqa-fig-price' || sel === '.wqa-fig-w' ? 'right' : 'left']) : 'x'; })).size;
      const foot = [...document.querySelectorAll('.wqa-sticky-actions .btn')].map(b => Math.round(b.getBoundingClientRect().height));
      const pills = [...document.querySelectorAll('#wqaCommon .wqa-rv-pills .wqa-sp')].map(n => Math.round(n.getBoundingClientRect().height));
      return { over: Math.max(sc.scrollWidth - sc.clientWidth, document.documentElement.scrollWidth - window.innerWidth),
               len: xs('.wqa-it-toks'), qty: xs('.wqa-fig-qty'), price: xs('.wqa-fig-price'), wt: xs('.wqa-fig-w'), hist: xs('.wqa-row-hist'), del: xs('.wqa-row-del'),
               foot: new Set(foot).size, pills: new Set(pills).size,
               zh: document.querySelector('.wqa-gacc').textContent,
               gh: (b => b ? [b.getAttribute('aria-label'), b.title, b.textContent.trim(), !!b.querySelector('svg.dc-hist-ico')].join('|') : '')(document.querySelector('.wqa-gacc .wqa-gacc-hist')) };
    });
    const at = `Q ${w} ${lang}`;
    A.ok(q.over <= 0, `${at}: no horizontal overflow, history open (${q.over}px)`);
    A.eq([q.len, q.qty, q.price, q.wt, q.hist, q.del].join(), '1,1,1,1,1,1', `${at}: length, Qty, price, weight, History and remove line up on every row`);
    A.eq(q.foot + '/' + q.pills, '1/1', `${at}: footer buttons one height; the four top controls one height`);
    if (lang === 'zh') {
      ['每件数量', '表面处理', '单价', '相同表面处理', '不同表面处理', 'Nut', 'Flat Washer'].forEach(t =>
        A.includes(q.zh, t, `${at}: ${t}`));
      /* Icon-only History: named by aria-label and tooltip, no visible text. */
      A.eq(q.gh, '历史价格|历史价格||true', `${at}: accessory History is the icon alone, aria-label and tooltip 历史价格`);
    }
    await ctx.close();
  }
};
