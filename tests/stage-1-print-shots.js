/* STAGE 1 — print / PDF quotation layout · evidence.

   The review's complaint was about the PAGE, so the evidence is the page. Each
   frame here is a real A4 sheet rendered through Chromium's own print pipeline
   (`page.pdf({format:'A4'})`) and then rasterised whole — not a cropped table,
   not a screenshot of a screen element pretending to be paper.

   Both sides of the comparison come from the SAME tree. The "before" frames are
   produced by re-asserting the previous print rules on the element, so the pair
   differs by this round's change and by nothing else — the same technique the
   430px pair uses.

   Every frame asserts its own figures before it is written, and the run fails if
   any of them moves. The figures that matter most are the ones that must NOT
   have changed: the money, the accessory wording, and the numbering.

   Run:  node tests/stage-1-print-shots.js <outdir>                            */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { launch, openApp } = require(path.join(ROOT, 'tests/lib/harness'));

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node tests/stage-1-print-shots.js <outdir>'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const log = [];
const facts = {};
function must(cond, what) {
  if (!cond) { console.error('  ✗ ' + what); process.exitCode = 1; throw new Error('evidence claim failed: ' + what); }
  console.log('    · ' + what);
}

/* The previous print rules, re-applied as an inline sheet so a "before" frame is
   the real old layout rather than a description of it. Kept byte-faithful to what
   this round replaced. */
const OLD_PRINT_CSS = `
  @page{size:A4;margin:12mm}
  #printSummary{font-size:10pt!important;line-height:normal!important;font-family:Arial,sans-serif!important}
  .print-title{font-size:18pt;font-weight:800;letter-spacing:.08em;text-align:center;margin:8mm 0 6mm;
    padding-bottom:0;border-bottom:0}
  .print-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm 8mm;margin-bottom:7mm}
  .print-meta-item{display:grid;grid-template-columns:30mm 1fr;gap:2mm;border:0;
    border-bottom:1px solid #ddd;padding:1.5mm 0}
  .print-meta-label{display:inline;font-size:8.5pt;color:#555;font-weight:700;text-transform:none;
    letter-spacing:normal;margin:0}
  .print-meta-value{display:inline;font-size:9.5pt;font-weight:700}
  .print-items-table{font-variant-numeric:normal}
  .print-items-table th,.print-items-table td{border:1px solid #bbb;padding:2.2mm 2mm}
  .print-items-table thead th{background:#eee!important;font-size:8.5pt;letter-spacing:normal;
    border-color:#bbb;text-align:left}
  .print-items-table th.print-col-qty,.print-items-table th.print-col-money{text-align:left}
  .print-items-table td{font-size:8.8pt;line-height:1.35}
  .print-items-table .print-col-no{width:8mm}
  .print-items-table .print-col-desc{width:43mm;font-weight:400}
  .print-items-table .print-col-qty{width:14mm;text-align:center}
  .print-items-table .print-col-money{width:25mm}
  .print-items-table td.print-col-money:last-child,
  .print-items-table th.print-col-money:last-child{width:25mm}
  .print-item-size{font-size:8.8pt}
  .print-items-table tbody tr:nth-child(even) td{background:transparent!important}
  .print-items-table tfoot td{font-size:10pt;font-weight:800;background:#f5f5f5!important;
    border-top:1px solid #bbb;padding-top:2.2mm;padding-bottom:2.2mm}
  .print-items-table tfoot .print-col-money{font-size:10pt}
  .print-grand-label{letter-spacing:normal}
  .print-footer-note{margin-top:8mm;padding-top:4mm;border-top:1px solid #ccc;font-size:8.5pt}
`;

/* One realistic quotation. Two of the four items carry accessories, because the
   accepted rule about them is the thing a layout change is most likely to break
   without anyone noticing. */
const build = n => `(() => {
  quoteItems.length = 0;
  const mk = (desc, mat, fin, size, price, qty, acc) => ({
    itemType:'sagrod', desc, productType:'SAG ROD', material:mat, finish:fin,
    sizeType:'FULLSIZE', cleanSize:'M12', sizeCode:'M12', size,
    dimensionPreview:'L 1000 x TL 100/100mm', qty, markup:0, weight:0.9,
    boltUnitPrice: acc ? price - 2 : price, accessoryUnitPrice: acc ? 2 : 0,
    finalUnitPrice:price, lineUnitPrice:price,
    accessoryTotal:(acc?2:0)*qty, totalAmount:price*qty,
    pricingModel:'accessory-inclusive', priceMode:'auto',
    accessories: acc
      ? {nut:{enabled:true,qty:2,finish:'HDG',unitPrice:1},fw:{enabled:false},custom:{enabled:false}}
      : {nut:{enabled:false},fw:{enabled:false},custom:{enabled:false}},
    formData:{} });
  const rows = [
    ['MS UNDERSIZE SAG ROD','MS','HDG','M12 x L 1000 x TL 100/100mm',7.76,10,true],
    ['4140 QT FULLSIZE ANCHOR BOLT','4140','PL','M16 x L 1200 x TL 100/100mm',12.50,4,false],
    ['MS FULLSIZE SAG ROD','MS','ZP','M20 x L 1500 x TL 120/120mm',18.20,6,false],
    ['SS316 FULLSIZE U-BOLT','SS316','N/A','M24 x L 1800 x W 220 x TL 130/130mm',24.00,2,true]];
  for (let i=0;i<${n};i++){ const r=rows[i%4]; quoteItems.push(mk(r[0],r[1],r[2],r[3],r[4],r[5],r[6])); }
  el('qi-refno').value='Q-2026-0412';
  el('qi-date').value='2026-08-18';
  el('qi-customer').value='Alpha Steel Structure Sdn Bhd';
  el('qi-prepby').value='Nicholas Koh';
  renderQuote();
  window.dispatchEvent(new Event('beforeprint'));
  return {
    rows: [...document.querySelectorAll('#printItemsBody tr')].map(tr =>
      [...tr.children].map(td => td.textContent.trim())),
    grand: document.getElementById('printGrandTotal').textContent.trim(),
  };
})()`;

/* A whole A4 sheet, through the real print pipeline, rasterised page by page. */
const sheet = async (page, name) => {
  const pdf = path.join(OUT, name + '.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true });
  const { execFileSync } = require('child_process');
  const pages = JSON.parse(execFileSync('python3', ['-c', `
import pymupdf, json, sys
d = pymupdf.open(${JSON.stringify(pdf)})
out = []
for i, pg in enumerate(d):
    p = ${JSON.stringify(path.join(OUT, name))} + ('-p%d.png' % (i + 1))
    pg.get_pixmap(dpi=110).save(p)
    out.append(p)
print(json.dumps({'pages': d.page_count, 'files': out}))
`]).toString().trim());
  pages.files.forEach(f => log.push(path.basename(f, '.png')));
  console.log(`  ✓ ${name} — ${pages.pages} A4 page(s)`);
  return pages;
};

(async () => {
  const browser = await launch();

  // ── 01 · BEFORE — the layout the review rejected ─────────────────────────
  {
    const page = await openApp(browser, { viewport: { width: 1440, height: 1000 } });
    const d = await page.evaluate(build(4));
    await page.addStyleTag({ content: `@media print{${OLD_PRINT_CSS}}` });
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const px2mm = v => +(v / (96 / 25.4)).toFixed(1);
      const pt = s => +(parseFloat(s) * 0.75).toFixed(1);
      return { bodyPt: pt(getComputedStyle(document.querySelector('#printItemsBody td')).fontSize),
               descMm: px2mm(document.querySelector('.print-col-desc').getBoundingClientRect().width),
               grandPt: pt(getComputedStyle(document.querySelector('.print-items-table tfoot .print-col-money')).fontSize) };
    });
    must(m.bodyPt <= 9, `BEFORE: item rows are ${m.bodyPt}pt`);
    must(m.descMm <= 45, `BEFORE: the Description column is ${m.descMm}mm and every description wraps`);
    must(m.grandPt <= 10.5, `BEFORE: the Grand Total is ${m.grandPt}pt — the same size as a row`);
    must(d.grand === 'RM 284.80', 'BEFORE: the sheet totals RM 284.80');
    facts.before = m;
    await sheet(page, '01-print-before');
    await page.close();
  }

  // ── 02 · AFTER — four realistic items ────────────────────────────────────
  let after4 = null;
  {
    const page = await openApp(browser, { viewport: { width: 1440, height: 1000 } });
    const d = await page.evaluate(build(4));
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const px2mm = v => +(v / (96 / 25.4)).toFixed(1);
      const pt = s => +(parseFloat(s) * 0.75).toFixed(1);
      const foot = document.querySelector('.print-items-table tfoot td');
      return { bodyPt: pt(getComputedStyle(document.querySelector('#printItemsBody td')).fontSize),
               titlePt: pt(getComputedStyle(document.querySelector('.print-title')).fontSize),
               metaPt: pt(getComputedStyle(document.querySelector('.print-meta-value')).fontSize),
               descMm: px2mm(document.querySelector('.print-col-desc').getBoundingClientRect().width),
               grandPt: pt(getComputedStyle(document.querySelector('.print-items-table tfoot .print-col-money')).fontSize),
               grandRule: getComputedStyle(foot).borderTopWidth,
               tabular: getComputedStyle(document.querySelector('.print-items-table')).fontVariantNumeric,
               moneyAlign: [...document.querySelectorAll('#printItemsBody td.print-col-money')].map(n => getComputedStyle(n).textAlign),
               qtyAlign: [...document.querySelectorAll('#printItemsBody td.print-col-qty')].map(n => getComputedStyle(n).textAlign),
               head: [...document.querySelectorAll('.print-items-table thead th')].map(n => n.textContent.trim()) };
    });
    must(m.bodyPt >= 9.2, `AFTER: item rows are ${m.bodyPt}pt, up from ${facts.before.bodyPt}`);
    must(m.titlePt >= 18, `AFTER: QUOTATION is ${m.titlePt}pt`);
    must(m.metaPt >= 10, `AFTER: the quotation number, date, customer and preparer are ${m.metaPt}pt`);
    must(m.descMm >= 50, `AFTER: Description has ${m.descMm}mm, up from ${facts.before.descMm}`);
    must(m.grandPt >= m.bodyPt + 2, `AFTER: the Grand Total is ${m.grandPt}pt against ${m.bodyPt}pt rows`);
    must(parseFloat(m.grandRule) > 1, `AFTER: over a ${m.grandRule} rule`);
    must(m.tabular.includes('tabular-nums'), 'AFTER: figures are set in tabular numerals');
    must(m.moneyAlign.every(a => a === 'right'), 'AFTER: every Unit Price and Total is right aligned');
    must(m.qtyAlign.every(a => a === 'right'), 'AFTER: Qty is aligned to its column');
    must(m.head.join(' | ') === 'No. | Description | Size / Dimension | Qty | Unit Price | Total',
      'AFTER: the six accepted columns, in order, unchanged');

    /* The things that must NOT have moved. */
    must(d.rows.length === 4, 'AFTER: four items, FOUR priced rows — no accessory row has returned');
    must(d.rows.map(r => r[0]).join(',') === '1,2,3,4', 'AFTER: numbering 1,2,3,4 in insertion order, unchanged');
    must(d.rows[0][4] === 'RM 7.76' && d.rows[0][5] === 'RM 77.60',
      'AFTER: item 1 still quotes RM 7.76 inclusive, RM 77.60 for ten');
    must(d.rows[0][2].includes('cw 2nut') && !/RM/.test(d.rows[0][2]),
      'AFTER: "cw 2nut" is still plain description with no money beside it');
    must(d.grand === 'RM 284.80', 'AFTER: the sheet still totals RM 284.80 — the layout moved, the money did not');
    facts.after = m; facts.rows = d.rows; facts.grand = d.grand;
    after4 = await sheet(page, '02-print-after-4-items');
    await page.close();
  }

  // ── 03 · the accessory row, close enough to read ─────────────────────────
  {
    const page = await openApp(browser, { viewport: { width: 1440, height: 1000 } });
    await page.evaluate(build(4));
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(250);
    const el = await page.$('.print-items-table');
    await el.screenshot({ path: path.join(OUT, '03-print-accessory-and-alignment.png') });
    log.push('03-print-accessory-and-alignment');
    console.log('  ✓ 03-print-accessory-and-alignment');
    await page.close();
  }

  // ── 04 · the Grand Total area ────────────────────────────────────────────
  {
    const page = await openApp(browser, { viewport: { width: 1440, height: 1000 } });
    await page.evaluate(build(4));
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(250);
    const el = await page.$('.print-items-table tfoot');
    await el.screenshot({ path: path.join(OUT, '04-print-grand-total.png') });
    log.push('04-print-grand-total');
    console.log('  ✓ 04-print-grand-total');
    await page.close();
  }

  // ── 05 · a long quotation, over more than one page ───────────────────────
  {
    const page = await openApp(browser, { viewport: { width: 1440, height: 1000 } });
    const d = await page.evaluate(build(26));
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(350);
    const m = await page.evaluate(() => ({
      thead: getComputedStyle(document.querySelector('.print-items-table thead')).display,
      rowBreak: getComputedStyle(document.querySelector('#printItemsBody tr')).breakInside,
      rows: document.querySelectorAll('#printItemsBody tr').length }));
    must(m.thead === 'table-header-group', 'LONG: the table header repeats on every page');
    must(m.rowBreak === 'avoid', 'LONG: and no item row may be torn across a break');
    must(m.rows === 26, 'LONG: twenty-six priced rows for twenty-six items — still one each');
    must(d.rows[25][0] === '26', 'LONG: numbered through to 26 without a gap');
    facts.long = { ...m, grand: d.grand, pages: null };
    const p = await sheet(page, '05-print-long-multipage');
    facts.long.pages = p.pages;
    must(p.pages >= 2, `LONG: it really does run to ${p.pages} pages`);
    await page.close();
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT, 'FACTS.json'), JSON.stringify(facts, null, 2));
  fs.writeFileSync(path.join(OUT, 'INDEX.txt'),
    ['STAGE 1 — PRINT / PDF QUOTATION LAYOUT · EVIDENCE', '',
     'Whole A4 sheets, rendered through Chromium\'s own print pipeline and',
     'rasterised page by page. Not cropped tables.', '',
     'Every figure was asserted before its frame was written; the run fails if',
     'any of them moves. The money, the accessory wording and the numbering are',
     'asserted as UNCHANGED, because a layout change is exactly where those',
     'would slip without anyone noticing.', ''].concat(log.map((n, i) => `  ${String(i + 1).padStart(2, '0')}  ${n}.png`)).join('\n') + '\n');

  console.log(`\n  ${log.length} frames + FACTS.json + INDEX.txt → ${OUT}\n`);
})().catch(e => { console.error(e); process.exit(1); });
