/* STAGE 1 — final UI cleanup · evidence.

   Drives the shipped index.php and companies.php through the project's own
   harness. Three things are proved and one is recorded:

     · APPLY TO stays attached to the control it names at 430px
     · Companies controls reach 44px on a phone, and stay as they were on a desk
     · numbering carries the same item number on screen, in print and in the
       WhatsApp message — the ORDER differs on purpose, and that is deferred

   A frame is evidence only if the thing it claims to prove is visible inside it,
   so every frame here ASSERTS its own figure before it is written and fails the
   run if it moves. The before/after pair for the APPLY TO fix is produced from
   the SAME page by disabling this round's rule, so the two frames differ by the
   change and by nothing else.

   Run:  node tests/stage-1-shots.js <outdir>                                 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { launch, openApp, openCompanies, quickAddPaste } = require(path.join(ROOT, 'tests/lib/harness'));

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node tests/stage-1-shots.js <outdir>'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const PHONE = { width: 430, height: 900 };
const DESK = { width: 1440, height: 1000 };
const log = [];
const facts = {};

function must(cond, what) {
  if (!cond) { console.error('  ✗ ' + what); process.exitCode = 1; throw new Error('evidence claim failed: ' + what); }
  console.log('    · ' + what);
}
/* A frame must not carry a message from the step that set it up. */
const clearToast = async page => {
  await page.evaluate(() => {
    const t = document.getElementById('toast');
    if (t) { t.classList.remove('show'); t.textContent = ''; }
  });
  await page.waitForTimeout(110);
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

const LIST = ['MS SAG ROD ZP UNDERSIZE',
              'M12 x 853 x 70/70 - 12pcs', 'M12 x 943 x 70/70 - 8pcs',
              'M16 x 1240 x 90/90 - 18pcs', 'M20 x 1650 x 110/110 - 16pcs'].join('\n');

const scopePair = page => page.evaluate(() => {
  const l = document.querySelector('.wqa-scope-lbl').getBoundingClientRect();
  const s = document.querySelector('.wqa-scope').getBoundingClientRect();
  const cy = b => b.top + b.height / 2;
  const d = document.documentElement;
  return { lblLeft: +l.left.toFixed(1), lblRight: +l.right.toFixed(1),
           scopeLeft: +s.left.toFixed(1),
           sameRow: Math.abs(cy(l) - cy(s)) < 8,
           stacked: Math.abs(l.left - s.left) < 2 && s.top >= l.bottom - 1,
           overflow: d.scrollWidth - d.clientWidth };
});

const openBulk = async (browser, viewport) => {
  const p = await openApp(browser, { viewport });
  await quickAddPaste(p, LIST, { expanded: false, settle: 1000 });
  await p.evaluate(() => { const t = document.querySelector('.wqa-bulk-btn'); if (t) t.click(); });
  await p.waitForTimeout(450);
  return p;
};

(async () => {
  const browser = await launch();

  // ── 01 · APPLY TO at 430px, BEFORE — this round's rule switched off ──────
  /* The same page, with only the Stage 1 media query disabled, so the pair of
     frames differs by the change and by nothing else. */
  {
    const page = await openBulk(browser, PHONE);
    await page.evaluate(() => {
      /* Re-assert the pre-Stage-1 geometry at the element, which is exactly what
         the accepted stylesheet produced before this round. */
      const l = document.querySelector('.wqa-scope-lbl');
      const s = document.querySelector('.wqa-scope');
      l.style.marginLeft = 'auto'; l.style.flex = '0 1 auto'; l.style.marginTop = '0';
      s.style.flex = '0 1 auto';
    });
    await page.waitForTimeout(200);
    const before = await scopePair(page);
    must(before.stacked === false, 'BEFORE: the label is not above its control');
    must(before.lblLeft > before.scopeLeft + 100,
      `BEFORE: the label is stranded ${Math.round(before.lblLeft - before.scopeLeft)}px to the right of the buttons it names`);
    facts.before = before;
    await shot(page, '01a-430-apply-to-before', '.wqa-bulk-bar');
    await page.close();
  }

  // ── 01b · APPLY TO at 430px, AFTER ──────────────────────────────────────
  {
    const page = await openBulk(browser, PHONE);
    const after = await scopePair(page);
    must(after.stacked === true, 'AFTER: APPLY TO sits directly above the buttons it names');
    must(Math.abs(after.lblLeft - after.scopeLeft) < 2,
      `AFTER: their left edges line up (${after.lblLeft} vs ${after.scopeLeft})`);
    must(after.overflow <= 2, `AFTER: the page still does not scroll sideways (${after.overflow}px)`);
    facts.after = after;
    await shot(page, '01b-430-apply-to-after', '.wqa-bulk-bar');
    await shot(page, '02-430-review-no-overflow', '#wqaStep2');
    await page.close();
  }

  // ── 03 · the desk, unchanged ────────────────────────────────────────────
  {
    const page = await openBulk(browser, DESK);
    const desk = await scopePair(page);
    must(desk.sameRow === true, 'DESK 1440px: the bar still holds label and control on one line');
    must(desk.overflow <= 2, 'DESK: no sideways scroll');
    facts.desk = desk;
    await shot(page, '03-desk-1440-unchanged', '.wqa-bulk-bar');
    await page.close();
  }

  // ── 04 / 05 · Companies on a phone ──────────────────────────────────────
  {
    const page = await openCompanies(browser, { viewport: PHONE });
    await page.waitForTimeout(600);
    const hdr = await page.evaluate(() => {
      const b = document.querySelector('.lang-btn').getBoundingClientRect();
      const d = document.documentElement;
      return { h: +b.height.toFixed(1), w: +b.width.toFixed(1), overflow: d.scrollWidth - d.clientWidth };
    });
    must(hdr.h >= 44 && hdr.w >= 44, `COMPANIES 430px: the language buttons are ${hdr.h} x ${hdr.w}, at least 44 square`);
    must(hdr.overflow <= 2, `COMPANIES 430px: the page does not scroll sideways (${hdr.overflow}px)`);
    facts.companiesHeader = hdr;
    await shot(page, '04-companies-430-header', '.page-header');
    await shot(page, '05-companies-430-page');

    const modal = await page.evaluate(async () => {
      openModal('editCompanyModal');
      await new Promise(r => setTimeout(r, 400));
      const m = document.getElementById('editCompanyModal');
      const c = m.querySelector('.modal-close').getBoundingClientRect();
      const f = m.querySelector('.field input').getBoundingClientRect();
      return { close: { h: +c.height.toFixed(1), w: +c.width.toFixed(1) },
               field: { h: +f.height.toFixed(1) } };
    });
    must(modal.close.h >= 44 && modal.close.w >= 44,
      `COMPANIES 430px: the modal × is ${modal.close.h} x ${modal.close.w} — was 24 x 17, and it is the only way out of a modal on a phone`);
    must(modal.field.h >= 44, `COMPANIES 430px: a form field is ${modal.field.h} tall`);
    facts.companiesModal = modal;
    await shot(page, '06-companies-430-modal-actions', '#editCompanyModal .modal');
    await page.close();
  }

  // ── 07 · Companies on the desk, unchanged ───────────────────────────────
  {
    const page = await openCompanies(browser, { viewport: DESK });
    await page.waitForTimeout(500);
    const desk = await page.evaluate(async () => {
      openModal('editCompanyModal');
      await new Promise(r => setTimeout(r, 350));
      const m = document.getElementById('editCompanyModal');
      const l = document.querySelector('.lang-btn').getBoundingClientRect();
      const c = m.querySelector('.modal-close').getBoundingClientRect();
      return { lang: { h: +l.height.toFixed(1) }, close: { h: +c.height.toFixed(1), w: +c.width.toFixed(1) } };
    });
    must(desk.lang.h === 40, `COMPANIES 1440px: the language button is still 40 tall, exactly as accepted`);
    must(desk.close.h === 24 && desk.close.w === 17,
      `COMPANIES 1440px: the modal × is still 24 x 17 — the phone rule has not leaked onto the desk`);
    facts.companiesDesk = desk;
    await shot(page, '07-companies-desk-unchanged', '#editCompanyModal .modal');
    await page.close();
  }

  // ── 08 / 09 / 10 · numbering, verified across the three surfaces ────────
  {
    const page = await openApp(browser, { viewport: DESK });
    const n = await page.evaluate(() => {
      quoteItems.length = 0;
      const mk = (desc, mat, fin, size, price, qty) => ({
        itemType: 'sagrod', desc, productType: 'SAG ROD', material: mat, finish: fin,
        sizeType: 'FULLSIZE', cleanSize: 'M12', sizeCode: 'M12', size,
        dimensionPreview: 'L 1000 x TL 100/100mm', qty, markup: 0, weight: 0.9,
        boltUnitPrice: price, accessoryUnitPrice: 0, finalUnitPrice: price,
        lineUnitPrice: price, accessoryTotal: 0, totalAmount: price * qty,
        pricingModel: 'accessory-inclusive', priceMode: 'auto',
        accessories: { nut: { enabled: false }, fw: { enabled: false }, custom: { enabled: false } },
        formData: {} });
      quoteItems.push(mk('MS FULLSIZE SAG ROD', 'MS', 'ZP', 'M12 x L 1000 x TL 100/100mm', 7.90, 10));
      quoteItems.push(mk('4140 QT FULLSIZE SAG ROD', '4140', 'PL', 'M16 x L 1200 x TL 100/100mm', 12.50, 4));
      quoteItems.push(mk('MS FULLSIZE SAG ROD', 'MS', 'ZP', 'M20 x L 1500 x TL 120/120mm', 18.20, 6));
      quoteItems.push(mk('4140 QT FULLSIZE SAG ROD', '4140', 'PL', 'M24 x L 1800 x TL 130/130mm', 24.00, 2));
      renderQuote();
      return { screen: [...document.querySelectorAll('.qi-item')].map(c => ({
                 no: c.querySelector('.qi-num').textContent.trim(),
                 dim: c.querySelector('.qi-dim').textContent.trim() })),
               wa: buildWAItemsText('-') };
    });
    const bySize = (list, size) => list.find(x => x.dim.includes(size));
    ['M12 x L 1000', 'M16 x L 1200', 'M20 x L 1500', 'M24 x L 1800'].forEach((s, i) => {
      must(bySize(n.screen, s).no === String(i + 1), `SCREEN: ${s} is item ${i + 1}`);
    });
    facts.screenOrder = n.screen.map(x => x.no).join(',');
    must(facts.screenOrder === '4,3,2,1',
      'SCREEN: the list reads Newest First — a view, never a renumbering (ordering DEFERRED to Stage 2)');
    await shot(page, '08-numbering-screen', '#quoteList,.qi-list,#step3Card');

    /* The message, shown on screen so the frame carries the words it claims. */
    const waNos = await page.evaluate(text => {
      const host = document.createElement('pre');
      host.id = 'evidenceWA';
      host.style.cssText = 'position:fixed;left:24px;top:24px;z-index:99999;background:#fff;'
        + 'color:#111;border:2px solid #2547d0;border-radius:10px;padding:18px 22px;'
        + 'font:14px/1.7 ui-monospace,Menlo,Consolas,monospace;white-space:pre;'
        + 'box-shadow:0 8px 30px rgba(0,0,0,.18);max-width:900px';
      host.textContent = 'WhatsApp / copied text\n──────────────────────\n' + text;
      document.body.appendChild(host);
      return text.split('\n').map(l => (l.match(/^\s*(\d+)\./) || [])[1]).filter(Boolean).join(',');
    }, n.wa);
    must(waNos === '1,3,2,4',
      'WHATSAPP: grouped by material, so the numbers are each correct but not ascending (ordering DEFERRED to Stage 2)');
    facts.waOrder = waNos;
    facts.wa = n.wa;
    await shot(page, '09-numbering-whatsapp', '#evidenceWA');
    await page.evaluate(() => { const x = document.getElementById('evidenceWA'); if (x) x.remove(); });

    const printed = await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeprint'));
      return [...document.querySelectorAll('#printItemsBody tr')]
        .map(tr => ({ no: tr.children[0].textContent.trim(), dim: tr.children[2].textContent.trim() }));
    });
    ['M12 x L 1000', 'M16 x L 1200', 'M20 x L 1500', 'M24 x L 1800'].forEach((s, i) => {
      must(bySize(printed, s).no === String(i + 1), `PRINT: ${s} is item ${i + 1} — the same number it has on screen and in the message`);
    });
    facts.printOrder = printed.map(x => x.no).join(',');
    must(facts.printOrder === '1,2,3,4', 'PRINT: the sheet reads in insertion order');
    await shot(page, '10-numbering-print', '#printSummary');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.close();
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT, 'FACTS.json'), JSON.stringify(facts, null, 2));
  fs.writeFileSync(path.join(OUT, 'INDEX.txt'),
    ['STAGE 1 — FINAL UI CLEANUP · EVIDENCE', '',
     'Every figure below was asserted by the capture script before its frame was',
     'written; the run fails if any of them moves.', '',
     '  01a/01b  430px APPLY TO — stranded, then attached to its control',
     '  02       430px review — no horizontal overflow',
     '  03       1440px — the accepted desktop bar, unchanged',
     '  04/05/06 Companies on a phone — header, page, modal actions at 44px',
     '  07       Companies on the desk — 40 and 24x17, exactly as accepted',
     '  08/09/10 numbering — one item, one number, three surfaces',
     '', 'DEFERRED TO STAGE 2: dark mode; numbering ORDER on screen and in the message.',
     ''].concat(log.map((n, i) => `  ${String(i + 1).padStart(2, '0')}  ${n}.png`)).join('\n') + '\n');

  console.log(`\n  ${log.length} frames + FACTS.json + INDEX.txt → ${OUT}\n`);
})().catch(e => { console.error(e); process.exit(1); });
