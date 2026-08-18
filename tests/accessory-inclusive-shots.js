/* STAGE 0B — accessory-inclusive final unit price · evidence.

   Drives the shipped index.php through the project's own harness, on Nicholas's
   own case:

       MS UNDERSIZE SAG ROD HDG · M12 x L1000 x TL100/100
       rod          RM 5.76      (0.6927443kg × RM6.50 + RM0.30, +20%)
       2 HDG nuts   RM 2.00
       ─────────────────────────
       FINAL UNIT PRICE  RM 7.76

   A frame is evidence only if the thing it claims to prove is visible inside
   it, so every frame here ASSERTS its own figure before it is written and fails
   the run if it moves. A screenshot of a number nobody checked is a picture.

   Run:  node tests/accessory-inclusive-shots.js <outdir>                     */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { launch, openApp } = require(path.join(ROOT, 'tests/lib/harness'));

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node tests/accessory-inclusive-shots.js <outdir>'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const DESK = { width: 1600, height: 1000 };
const log = [];
const facts = {};

function must(cond, what) {
  if (!cond) { console.error('  ✗ ' + what); process.exitCode = 1; throw new Error('evidence claim failed: ' + what); }
  console.log('    · ' + what);
}
/* A frame must not carry a message from the step that set it up. Every add,
   save and reload here raises a toast, and a toast sitting over the Grand Total
   is exactly the kind of frame this project has had to reject before — so it is
   dismissed and the dismissal is verified, not assumed. */
const clearToast = async page => {
  await page.evaluate(() => {
    const t = document.getElementById('toast');
    if (t) { t.classList.remove('show'); t.textContent = ''; }
  });
  await page.waitForTimeout(120);
  const showing = await page.evaluate(() => {
    const t = document.getElementById('toast');
    return !!t && t.classList.contains('show');
  });
  must(!showing, 'no toast is left on the frame');
};
const shot = async (page, name, sel) => {
  await clearToast(page);
  const t = sel ? await page.$(sel) : null;
  await (t || page).screenshot({ path: path.join(OUT, name + '.png') });
  log.push(name); console.log('  ✓ ' + name);
};

/* The calculator, driven to Nicholas's specification. `nut` decides whether the
   two HDG nuts are on it. */
const drive = nut => `(() => {
  quoteItems.length = 0;
  switchType('sagrod');
  productEntryTouchedFields.clear();
  resetAccPanel('sagrod');
  document.getElementById('sagrod-material').value = 'MS';
  document.getElementById('sagrod-sizeType').value = 'UNDERSIZE';
  setFinishValue('sagrod', 'HDG');
  document.getElementById('sagrod-size').value = 'M12'; onSizeCommit('sagrod');
  document.getElementById('sagrod-length').value = '1000';
  document.getElementById('sagrod-threadLen').value = '100/100';
  document.getElementById('sagrod-qty').value = '10';
  document.getElementById('sagrod-costRate').value = '6.50';
  document.getElementById('sagrod-addCost').value = '0.30';
  document.getElementById('sagrod-markup').value = '20';
  calcSagRod();
  if (${nut ? 'true' : 'false'}) {
    document.getElementById('sagrod-nutEnabled').checked = true; onAccChange('sagrod');
    document.getElementById('sagrod-nutQty').value = '2';
    document.getElementById('sagrod-nutPrice').value = '1.00';
    document.getElementById('sagrod-nutFinish').value = 'HDG';
    onAccChange('sagrod');
  }
  const st = priceCalcState.sagrod || {};
  const note = document.getElementById('cpLine');
  return { bolt: st.boltUnitPrice, acc: st.accessoriesCost, final: st.finalUnitPrice,
           shownFinal: document.getElementById('cpFinal').textContent,
           shownAcc: document.getElementById('cpAcc').textContent,
           shownNote: note.textContent, noteHidden: !!note.hidden,
           headline: document.querySelector('.cp-final label').textContent };
})()`;

(async () => {
  const browser = await launch();
  let payload = null;

  // ── 01 / 02 · the calculator, before and after the nuts ───────────────────
  const page = await openApp(browser, {
    viewport: DESK,
    api: { save_quotation: (u, r) => { try { payload = JSON.parse(r.postData() || 'null'); } catch (e) {} return { ok: true, id: 21 }; } },
  });

  const bare = await page.evaluate(drive(false));
  must(bare.shownFinal.includes('5.76'), 'the rod alone shows RM 5.76 as its Final Unit Price');
  must(bare.noteHidden === true, 'and no "Includes accessories" line, because there is nothing to include');
  must(bare.headline === 'Final Unit Price', 'under a Final Unit Price headline');
  facts.bare = bare;
  await shot(page, '01-calculator-no-accessories', '.calc-preview');

  const withNut = await page.evaluate(drive(true));
  must(withNut.shownFinal.includes('7.76'), 'with two HDG nuts the headline is RM 7.76');
  must(withNut.shownNote === 'Includes accessories: RM 2.00', 'and the line under it reads "Includes accessories: RM 2.00"');
  must(withNut.noteHidden === false, 'visibly, not hidden');
  must(Math.abs(withNut.bolt - 5.76) < 0.001, 'while the rod component underneath is still RM5.76');
  must(Math.abs(withNut.acc - 2.00) < 0.001, 'and the accessory total is RM2.00');
  facts.withNut = withNut;
  await shot(page, '02-calculator-inclusive-7.76', '.calc-preview');
  await shot(page, '03-calculator-full-panel', '#calcPanel,.calc-panel,body');

  // ── 04 · 中文 ─────────────────────────────────────────────────────────────
  const zh = await page.evaluate(() => {
    dcSetLang('zh');
    return { note: document.getElementById('cpLine').textContent,
             headline: document.querySelector('.cp-final label').textContent,
             final: document.getElementById('cpFinal').textContent };
  });
  must(zh.headline === '最终单价', 'in 中文 the headline reads 最终单价');
  must(zh.final.includes('7.76'), 'over the same RM 7.76');
  must(zh.note === '已含配件：RM 2.00', 'and the note reads 已含配件：RM 2.00');
  facts.zh = zh;
  await shot(page, '04-calculator-chinese', '.calc-preview');
  await page.evaluate(() => dcSetLang('en'));

  // ── 05 · the quotation item card ──────────────────────────────────────────
  const item = await page.evaluate(() => {
    addSagRod();
    const it = quoteItems[0] || {};
    return { bolt: it.boltUnitPrice, acc: it.accessoryUnitPrice, final: it.finalUnitPrice,
             line: it.lineUnitPrice, accTotal: it.accessoryTotal, total: it.totalAmount,
             qty: it.qty, model: it.pricingModel,
             card: (document.querySelector('.qi-item') || {}).textContent || '' };
  });
  must(item.model === 'accessory-inclusive', 'the saved item records the accessory-inclusive model');
  must(Math.abs(item.final - 7.76) < 0.001, 'finalUnitPrice is RM7.76');
  must(Math.abs(item.bolt - 5.76) < 0.001, 'boltUnitPrice keeps the RM5.76 rod component');
  must(Math.abs(item.acc - 2.00) < 0.001, 'accessoryUnitPrice keeps the RM2.00');
  must(Math.abs(item.line - 7.76) < 0.001, 'lineUnitPrice is the same inclusive figure');
  must(Math.abs(item.total - 77.60) < 0.001, 'totalAmount is RM77.60 — RM7.76 × 10');
  must(item.card.includes('RM 7.76'), 'the card shows RM 7.76 as the unit price');
  must(item.card.includes('RM 5.76'), 'with the rod component visible as breakdown');
  must(item.card.includes('RM 2.00'), 'and the accessory component beside it');
  must(item.card.includes('RM 77.60'), 'over a RM 77.60 line total');
  facts.item = item;
  await shot(page, '05-quotation-item-card', '.qi-item');

  // ── 06 · the WhatsApp / copied text ───────────────────────────────────────
  const wa = await page.evaluate(() => {
    const text = buildWAItemsText('-');
    /* Shown on screen so the frame carries the words it claims, rather than a
       DOM assertion nobody can see in the picture. */
    const host = document.createElement('pre');
    host.id = 'evidenceWA';
    host.style.cssText = 'position:fixed;left:24px;top:24px;z-index:99999;background:#fff;'
      + 'color:#111;border:2px solid #2547d0;border-radius:10px;padding:18px 22px;'
      + 'font:14px/1.7 ui-monospace,Menlo,Consolas,monospace;white-space:pre;'
      + 'box-shadow:0 8px 30px rgba(0,0,0,.18);max-width:900px';
    host.textContent = 'WhatsApp / copied text\n──────────────────────\n' + text;
    document.body.appendChild(host);
    return text;
  });
  must(wa.includes('M12 x L 1000 x TL 100/100mm - RM7.76'), 'the message quotes the item at RM7.76');
  must(wa.includes('cw 2nut'), 'and names the nuts as "cw 2nut"');
  must(!/cw 2nut\s*-\s*RM/.test(wa), 'with NO separate accessory RM price beside them');
  must(!wa.includes('RM5.76'), 'the rod-only figure never reaches the customer');
  must(!wa.includes('RM2.00'), 'and neither does a standalone accessory price');
  facts.wa = wa;
  await shot(page, '06-whatsapp-copied-text', '#evidenceWA');
  await page.evaluate(() => { const n = document.getElementById('evidenceWA'); if (n) n.remove(); });

  // ── 07 · the print / PDF preview ──────────────────────────────────────────
  const printed = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    return { rows: Array.from(document.querySelectorAll('#printItemsBody tr'))
               .map(tr => Array.from(tr.children).map(td => td.textContent.trim())),
             grand: document.getElementById('printGrandTotal').textContent };
  });
  must(printed.rows.length === 1, 'the print sheet has ONE priced row for the item');
  must(printed.rows[0][4] === 'RM 7.76', 'its Unit Price column is the inclusive RM 7.76');
  must(printed.rows[0][5] === 'RM 77.60', 'its Amount is RM 77.60');
  must(printed.rows[0][2].includes('cw 2nut'), 'the accessories are plain wording in the description');
  must(!printed.rows[0][2].includes('RM'), 'with no money in that cell');
  must(printed.grand === 'RM 77.60', 'and the quotation total reconciles at RM 77.60');
  facts.printed = printed;
  await shot(page, '07-print-preview', '#printSummary');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  // ── 08 · saved, then reopened ─────────────────────────────────────────────
  await page.evaluate(async () => {
    await api('save_quotation', { ref_no: 'DC-STAGE0B-001', quote_date: '2026-08-18',
      customer_name: 'ADVANCE', items: quoteItems,
      total_amount: quoteItems.reduce((s, i) => s + i.totalAmount, 0) }, 'POST');
  });
  await page.close();

  const reopened = await openApp(browser, {
    viewport: DESK,
    handoff: { id: 21, ref_no: 'DC-STAGE0B-001', customer_name: 'ADVANCE', items: payload.items },
  });
  const back = await reopened.evaluate(() => {
    const it = quoteItems[0] || {};
    return { bolt: it.boltUnitPrice, acc: it.accessoryUnitPrice, final: it.finalUnitPrice,
             total: it.totalAmount, model: it.pricingModel,
             card: (document.querySelector('.qi-item') || {}).textContent || '' };
  });
  must(Math.abs(back.final - 7.76) < 0.001, 'reopened, the item still quotes RM7.76');
  must(Math.abs(back.bolt - 5.76) < 0.001, 'still records the RM5.76 rod component');
  must(Math.abs(back.total - 77.60) < 0.001, 'and still totals RM77.60 — nothing drifts across the round trip');
  must(back.card.includes('RM 7.76'), 'and the card says so');
  facts.reopened = back;
  await shot(reopened, '08-saved-reopened', '.qi-item');
  await reopened.close();

  // ── 09 · a quotation saved under the SUPERSEDED rule, reopened ────────────
  /* RM30.00 of rod + RM0.70 of nuts = RM307.00 for ten. That is the money the
     customer agreed to, and it is the money that must come back. */
  const SEPARATE = {
    itemType: 'sagrod', desc: 'MS FULLSIZE SAG ROD', productType: 'SAG ROD',
    material: 'MS', sizeType: 'FULLSIZE', finish: 'PL', cleanSize: 'M20', sizeCode: 'M20',
    size: 'M20 x L 1000 x TL 100/100mm', dimensionPreview: 'L 1000 x TL 100/100mm',
    qty: 10, markup: 0, weight: 2.4662,
    finalUnitPrice: 30.00, accessoryUnitPrice: 0.70, lineUnitPrice: 30.70,
    accessoryTotal: 7.00, totalAmount: 307.00, pricingModel: 'bolt-separate',
    priceMode: 'manual', manualUnitPrice: '30.00',
    accessories: { nut: { enabled: true, qty: 2, finish: 'PL', unitPrice: 0.3 },
                   fw: { enabled: true, qty: 1, finish: 'PL', unitPrice: 0.1 },
                   custom: { enabled: false, text: '', unitPrice: 0 } },
    formData: { costRate: '5.00', addCost: '1.00', markup: '0', priceMode: 'manual',
                manualUnitPrice: '30.00', qty: '10', size: 'M20', length: '1000', threadLen: '100/100' },
  };
  const old = await openApp(browser, {
    viewport: DESK,
    handoff: { id: 22, ref_no: 'DC-OLD-777', customer_name: 'ADVANCE', items: [SEPARATE] },
  });
  const migrated = await old.evaluate(() => {
    const it = quoteItems[0] || {};
    return { bolt: it.boltUnitPrice, acc: it.accessoryUnitPrice, final: it.finalUnitPrice,
             total: it.totalAmount, model: it.pricingModel, manual: it.manualUnitPrice,
             card: (document.querySelector('.qi-item') || {}).textContent || '' };
  });
  must(Math.abs(migrated.total - 307.00) < 0.001, 'a bolt-separate quotation reopens on the SAME RM307.00 total');
  must(Math.abs(migrated.final - 30.70) < 0.001, 'reading as the RM30.70 the customer was actually charged');
  must(Math.abs(migrated.bolt - 30.00) < 0.001, 'with the RM30.00 rod component kept');
  must(migrated.model === 'accessory-inclusive', 'read into the current model on the way in');
  must(migrated.manual === '30.70', 'its typed Manual Price folded up to the customer figure');
  must(migrated.card.includes('RM 30.70'), 'and the card shows RM 30.70');
  must(migrated.card.includes('RM 307.00'), 'over the unchanged RM 307.00 line total');
  facts.migrated = migrated;
  await shot(old, '09-bolt-separate-reopened', '.qi-item');

  const resaved = await old.evaluate(() => {
    unlockSavedQuotation();
    editItem(0);
    const box = document.getElementById('sagrod-manualUnitPrice');
    const boxValue = box ? box.value : '';
    addSagRod();
    const it = quoteItems[0] || {};
    return { boxValue, count: quoteItems.length, bolt: it.boltUnitPrice,
             acc: it.accessoryUnitPrice, final: it.finalUnitPrice, total: it.totalAmount,
             card: (document.querySelector('.qi-item') || {}).textContent || '' };
  });
  must(resaved.boxValue === '30.70', 'editing it opens the Manual Price box on RM30.70');
  must(resaved.count === 1, 're-saving replaces the item rather than adding a second');
  must(Math.abs(resaved.total - 307.00) < 0.001, 'and the line total is STILL RM307.00 — the accessories are not charged twice');
  must(Math.abs(resaved.bolt - 30.00) < 0.001, 'with the rod component still RM30.00');
  facts.resaved = resaved;
  await shot(old, '10-bolt-separate-resaved', '.qi-item');
  await old.close();

  await browser.close();

  fs.writeFileSync(path.join(OUT, 'FACTS.json'), JSON.stringify(facts, null, 2));
  fs.writeFileSync(path.join(OUT, 'INDEX.txt'),
    ['STAGE 0B — ACCESSORY-INCLUSIVE FINAL UNIT PRICE · EVIDENCE',
     '',
     'MS UNDERSIZE SAG ROD HDG · M12 x L1000 x TL100/100 · Qty 10',
     '  rod           RM  5.76',
     '  2 HDG nuts    RM  2.00',
     '  ------------------------',
     '  FINAL UNIT    RM  7.76      line total RM 77.60',
     '',
     'Every figure below was asserted by the capture script before its frame was',
     'written; the run fails if any of them moves.',
     ''].concat(log.map((n, i) => `  ${String(i + 1).padStart(2, '0')}  ${n}.png`)).join('\n') + '\n');

  console.log(`\n  ${log.length} frames + FACTS.json + INDEX.txt → ${OUT}\n`);
})().catch(e => { console.error(e); process.exit(1); });
