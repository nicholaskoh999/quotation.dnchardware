/* ── Phone widths, and the two things that were wrong at them ───────────────
   Stage 1. Suite 32 already proves the PAGE never scrolls sideways at the
   widths the brief names, and that no action falls off the bottom. This one is
   narrower and more specific: it protects the two defects Stage 1 repaired, and
   the one it deliberately did not.

   1 · APPLY TO stayed attached to the control it names.

       `.wqa-scope-lbl` carries `margin-left:auto`, which is right on a bar wide
       enough to hold everything on one line — the label sits hard right, its
       buttons beside it. Once the bar wraps, that same rule strands the label at
       the END of the first line while its buttons drop to the LEFT of the
       second, so "APPLY TO:" reads against the Bulk Edit button and All Items /
       Selected Items read as belonging to nothing.

       This is the SCOPE control. PROJECT-GUARDRAILS is explicit that Selected
       Items must never be mistaken for All Items, and a label that has drifted
       onto another row is that mistake waiting to happen. So the two are
       asserted as a PAIR at every width: beside each other while they fit,
       stacked and left-aligned once they do not, and never apart.

   2 · Companies controls a thumb can actually hit.

       Measured, not assumed: at 430px the language pair was 30.6 x 40 and
       39 x 40, and the × that closes every modal was 17 x 24 — under a fifth of
       the area a finger needs. The × matters most of the three: on a phone it is
       the only way out of a modal, and it sits in the corner where the hand is
       least steady.

   3 · And the desk is untouched.

       Every rule Stage 1 added lives inside a narrow-width or coarse-pointer
       query. That is easy to claim and easy to get wrong, so it is measured from
       the other side too: at desktop widths these controls must still be exactly
       the size UI POLISH 1 and UI POLISH 2 left them.                        */
'use strict';
const { openApp, openCompanies, quickAddPaste } = require('../lib/harness');

const LIST = ['MS SAG ROD ZP UNDERSIZE',
              'M12 x 853 x 70/70 - 12pcs', 'M12 x 943 x 70/70 - 8pcs',
              'M16 x 1240 x 90/90 - 18pcs', 'M20 x 1650 x 110/110 - 16pcs'].join('\n');

/* The phone widths this project is asked about, and the desk widths that must
   not have moved. 640 is the boundary itself and is checked on both sides. */
const PHONE = [430, 390, 360];
const DESK  = [1440, 1024, 820, 700, 641];

/* Where the label sits relative to the control it names. Centres, not tops:
   the bar is `align-items:center` and the two have different heights, so
   comparing tops reports a false split on a row that is perfectly fine. */
const scopePair = page => page.evaluate(() => {
  const l = document.querySelector('.wqa-scope-lbl').getBoundingClientRect();
  const s = document.querySelector('.wqa-scope').getBoundingClientRect();
  const cy = b => b.top + b.height / 2;
  const d = document.documentElement;
  return {
    sameRow: Math.abs(cy(l) - cy(s)) < 8,
    adjacent: (s.left - l.right) >= 0 && (s.left - l.right) < 40,
    stacked: Math.abs(l.left - s.left) < 2 && s.top >= l.bottom - 1,
    gapY: +(s.top - l.bottom).toFixed(1),
    pageOverflow: d.scrollWidth - d.clientWidth,
  };
});

const openBulk = async (page, width) => {
  const p = await openApp(page, { viewport: { width, height: 950 } });
  await quickAddPaste(p, LIST, { expanded: false, settle: 900 });
  await p.evaluate(() => { const t = document.querySelector('.wqa-bulk-btn'); if (t) t.click(); });
  await p.waitForTimeout(420);
  return p;
};

/* Every visible control on the Companies screens, with a modal open so the ×
   and the form fields are really on screen rather than measured while hidden —
   a hidden element reports a box, and measuring one is how a "fixed" tap target
   stays broken. */
const companyControls = page => page.evaluate(async () => {
  openModal('editCompanyModal');
  await new Promise(r => setTimeout(r, 350));
  const visible = n => {
    const s = getComputedStyle(n);
    return s.display !== 'none' && s.visibility !== 'hidden' && n.getBoundingClientRect().height > 0;
  };
  const box = (s, root) => { const n = (root || document).querySelector(s); const b = n.getBoundingClientRect();
                             return { h: +b.height.toFixed(1), w: +b.width.toFixed(1) }; };
  /* Scoped to the modal that is actually OPEN. Taking the first `.field input`
     in document order picks one inside a closed modal, which reports a zero box
     and would let a real 36px field pass as fixed. */
  const modal = document.getElementById('editCompanyModal');
  const named = { lang: box('.lang-btn'), close: box('.modal-close', modal),
                  field: box('.field input', modal) };
  const under = [...document.querySelectorAll('.lang-btn,.modal-close,.field input,.field select,.field textarea')]
    .filter(visible)
    .map(n => ({ cls: String(n.className) || n.tagName.toLowerCase(),
                 h: +n.getBoundingClientRect().height.toFixed(1),
                 w: +n.getBoundingClientRect().width.toFixed(1) }))
    .filter(x => x.h < 44 || x.w < 44);
  const d = document.documentElement;
  const pageOverflow = d.scrollWidth - d.clientWidth;
  closeModal('editCompanyModal');
  return { named, under, pageOverflow };
});

module.exports = async (browser, A) => {
  const S = A.suite('phone widths — the scope label, the tap targets, and the desk left alone');

  // ══ 1 · APPLY TO and its control, at phone widths ════════════════════════
  for (const w of PHONE) {
    const page = await openBulk(browser, w);
    const r = await scopePair(page);
    A.eq(r.pageOverflow <= 2, true, `${w}px: the page does not scroll sideways (${r.pageOverflow}px)`);
    A.eq(r.sameRow, false, `${w}px: the bar has wrapped, which is what makes this width the interesting one`);
    A.eq(r.stacked, true,
      `${w}px: APPLY TO sits directly above the buttons it names, left edges aligned — not stranded at the far right of the line above`);
    A.ok(r.gapY >= 0 && r.gapY < 24,
      `${w}px: and close enough to read as one control (${r.gapY}px between them)`);
    await page.close();
  }

  // ══ 2 · and at desk widths, where nothing was allowed to move ════════════
  for (const w of DESK) {
    const page = await openBulk(browser, w);
    const r = await scopePair(page);
    A.eq(r.pageOverflow <= 2, true, `${w}px: the page does not scroll sideways (${r.pageOverflow}px)`);
    A.eq(r.sameRow, true, `${w}px: the bar still fits on one line, as UI POLISH 1 and 2 left it`);
    A.eq(r.adjacent, true, `${w}px: with APPLY TO beside its control, not pushed away from it`);
    await page.close();
  }

  /* 641 and 640 are the two sides of the boundary. Naming them together is the
     point: one pixel apart, and the pair must be correct in BOTH arrangements
     rather than correct in one and accidental in the other. */
  {
    const wide = await openBulk(browser, 641);
    const narrow = await openBulk(browser, 640);
    const a = await scopePair(wide), b = await scopePair(narrow);
    A.eq(a.sameRow && a.adjacent, true, '641px: one pixel above the boundary, the pair is side by side');
    A.eq(b.stacked, true, '640px: one pixel below it, the pair is stacked and still a pair');
    await wide.close(); await narrow.close();
  }

  // ══ 3 · Companies, thumb-sized at phone widths ═══════════════════════════
  for (const w of PHONE) {
    const page = await openCompanies(browser, { viewport: { width: w, height: 900 } });
    await page.waitForTimeout(500);
    const r = await companyControls(page);
    A.eq(r.pageOverflow <= 2, true, `companies ${w}px: the page does not scroll sideways (${r.pageOverflow}px)`);
    A.ok(r.named.lang.h >= 44 && r.named.lang.w >= 44,
      `companies ${w}px: the language buttons are at least 44x44 (${r.named.lang.h}x${r.named.lang.w})`);
    A.ok(r.named.close.h >= 44 && r.named.close.w >= 44,
      `companies ${w}px: the modal × is at least 44x44 (${r.named.close.h}x${r.named.close.w}) — the only way out of a modal on a phone`);
    A.ok(r.named.field.h >= 44,
      `companies ${w}px: a form field is at least 44 tall (${r.named.field.h})`);
    A.eq(r.under.length, 0,
      `companies ${w}px: nothing in that set is under 44 — ${JSON.stringify(r.under)}`);
    await page.close();
  }

  // ══ 4 · and Companies on the desk, unchanged ═════════════════════════════
  /* The accepted desktop sizes, stated as the exact numbers rather than as
     "not bigger". A rule that leaked out of its media query would move these,
     and "still under 44" would not notice a 43. */
  for (const w of [1440, 980, 700, 600]) {
    const page = await openCompanies(browser, { viewport: { width: w, height: 1000 } });
    await page.waitForTimeout(400);
    const r = await companyControls(page);
    A.eq(r.named.lang.h, 40, `companies ${w}px: the language button is still 40 tall, as accepted`);
    A.eq(r.named.close.h, 24, `companies ${w}px: the modal × is still 24 tall, as accepted`);
    A.eq(r.named.close.w, 17, `companies ${w}px: and still 17 wide — the phone rule has not leaked onto the desk`);
    await page.close();
  }

  // ══ 5 · reduced motion still switches the motion off ═════════════════════
  /* Asked of the page with the media actually emulated. A context-level option
     is silently dropped by the harness's newPage call, and a frame that claims
     reduced motion while reporting 180ms is worse than no frame at all. */
  {
    const page = await openApp(browser, { viewport: { width: 430, height: 900 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await quickAddPaste(page, LIST, { expanded: false, settle: 700 });
    const durations = await page.evaluate(() => {
      const sel = ['.wqa-bulk-btn', '.wqa-view-btn', '.wqa-row-act'];
      return sel.map(s => { const n = document.querySelector(s);
        return n ? getComputedStyle(n).transitionDuration : null; }).filter(Boolean);
    });
    A.ok(durations.length > 0, 'the reduced-motion sample found controls to measure');
    A.ok(durations.every(d => parseFloat(d) <= 0.0001),
      `every sampled control reports no transition under reduced motion (${durations.join(', ')})`);
    await page.close();
  }

  {
    const page = await openCompanies(browser, { viewport: { width: 430, height: 900 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(300);
    const d = await page.evaluate(() => getComputedStyle(document.querySelector('.lang-btn')).transitionDuration);
    A.ok(parseFloat(d) <= 0.0001, `companies: the enlarged language button still has no motion under reduced motion (${d})`);
    await page.close();
  }

  // ══ 6 · numbering — VERIFIED, not changed ════════════════════════════════
  /* Stage 1 was told to verify this and to defer it if a fix would need a
     data-generation change. It would, so this records the state rather than
     moving it: the same item carries the same NUMBER on all three surfaces,
     and the three surfaces order those numbers differently on purpose.

     Written as a test so the identity half cannot regress quietly while the
     ordering half waits for Stage 2. */
  {
    const page = await openApp(browser, { viewport: { width: 1440, height: 1000 } });
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
      /* Interleaved materials on purpose: this is the arrangement in which the
         message's grouping and the sheet's insertion order disagree. */
      quoteItems.push(mk('MS FULLSIZE SAG ROD', 'MS', 'ZP', 'M12 x L 1000 x TL 100/100mm', 7.90, 10));
      quoteItems.push(mk('4140 QT FULLSIZE SAG ROD', '4140', 'PL', 'M16 x L 1200 x TL 100/100mm', 12.50, 4));
      quoteItems.push(mk('MS FULLSIZE SAG ROD', 'MS', 'ZP', 'M20 x L 1500 x TL 120/120mm', 18.20, 6));
      quoteItems.push(mk('4140 QT FULLSIZE SAG ROD', '4140', 'PL', 'M24 x L 1800 x TL 130/130mm', 24.00, 2));
      renderQuote();
      const screen = [...document.querySelectorAll('.qi-item')].map(c => ({
        no: c.querySelector('.qi-num').textContent.trim(),
        dim: c.querySelector('.qi-dim').textContent.trim() }));
      const wa = buildWAItemsText('-');
      window.dispatchEvent(new Event('beforeprint'));
      const print = [...document.querySelectorAll('#printItemsBody tr')]
        .map(tr => ({ no: tr.children[0].textContent.trim(),
                      dim: tr.children[2].textContent.trim() }));
      window.dispatchEvent(new Event('afterprint'));
      return { screen, print, wa };
    });

    /* The one thing that must be true: a given rod carries a given number
       everywhere it appears. Checked by matching on the SIZE, which is the
       thing a person reads the number against. */
    const sizes = ['M12 x L 1000', 'M16 x L 1200', 'M20 x L 1500', 'M24 x L 1800'];
    sizes.forEach((size, i) => {
      const want = String(i + 1);
      const onScreen = n.screen.find(x => x.dim.includes(size));
      const onPrint = n.print.find(x => x.dim.includes(size));
      const waLine = n.wa.split('\n').find(l => l.includes(size));
      A.eq(onScreen && onScreen.no, want, `${size} is item ${want} on screen`);
      A.eq(onPrint && onPrint.no, want, `${size} is item ${want} on the printed sheet`);
      A.ok(waLine && waLine.trim().startsWith(want + '.'),
        `${size} is item ${want} in the WhatsApp message too — one item, one number, three surfaces`);
    });

    /* And the ordering difference, recorded as the deliberate thing it is.
       If a later round ever makes these agree, this is the assertion that will
       say so out loud rather than letting it happen unnoticed. */
    A.eq(n.print.map(x => x.no).join(','), '1,2,3,4',
      'the printed sheet reads in insertion order');
    A.eq(n.screen.map(x => x.no).join(','), '4,3,2,1',
      'the screen list reads Newest First, which is a view and never a renumbering — DEFERRED to Stage 2');
    const waNos = n.wa.split('\n').map(l => (l.match(/^\s*(\d+)\./) || [])[1]).filter(Boolean);
    A.eq(waNos.join(','), '1,3,2,4',
      'and the message groups by material, so its numbers are correct but not ascending — DEFERRED to Stage 2');

    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  return S;
};
