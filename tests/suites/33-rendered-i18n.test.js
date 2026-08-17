/* ── The screen, in 中文, in every state a person can reach ─────────────────
   Two rounds of tooling reported "100% of keys translated, 0 hard-coded
   strings" while real English prose was on the screen in 中文 mode. Both times
   the tooling was right about the source it could see and wrong about the
   application, because a string only reaches a person after a renderer has run,
   a branch has been taken and a panel has been opened. Nothing that reads
   source can stand in for that, so this suite reads the DOM.

   How it decides: `tests/lib/dom-i18n.js` collects every visible run of text —
   and every visible placeholder, title, aria-label and alt — subtracts ONE
   explicit table of trade vocabulary, and reports what is left. The table holds
   material codes, sizes, finishes, product names, units and registered
   entities. It holds no verbs and no prose, so no English sentence can pass it:
   "the", "is", "to", "please", "select", "never", "automatically" are not in it
   and never will be.

   What that caught the first time it was run, on a screen the previous round
   had signed off as fully translated:

     · Companies, in 中文: "Select a company on the left to view all saved
       quotations for that company." — a data-i18n applied by an attribute scan
       that had already finished running before the markup existed;
     · the accessory warning, in full: "Document mentions: 3 NUTS + 2 FLAT
       WASHER — accessories are never added automatically…";
     · the saved quotation's own item card: Qty, Unit;
     · the Others form, top to bottom, every label and both placeholders;
     · and one that is not about language at all — see §2.                    */
'use strict';
const { openApp, openCompanies, quickAddPaste, rowState } = require('../lib/harness');
const { scanRendered, describe, setLang } = require('../lib/dom-i18n');

/* Values that belong to the FIXTURE, not to the application: a company name, a
   short code, the person who prepared a quotation. Declared by the test that
   invents them rather than added to the library's trade table, so inventing a
   customer called "Acme" in some future test cannot quietly widen what the
   whole suite accepts. */
const FIXTURE = { words: ['alpha', 'nicholas', 'steel'] };

async function clean(page, where, A, opts) {
  const leaks = await scanRendered(page, Object.assign({}, FIXTURE, opts || {}));
  A.ok(leaks.length === 0, `中文 · ${where}: no English prose on screen — ${describe(leaks)}`);
  return leaks;
}

/* One extraction in the shape ai_extract.php returns, carrying the accessory
   note that produced the warning the review named. */
const IMAGE_EXTRACTION = {
  product: 'ANCHOR_BOLT', material: 'MS', finish: 'HDG', sizeType: 'Fullsize',
  threadEnds: 1, note: '3 NUTS + 2 FLAT WASHER',
  items: [
    { M: 'M20', L: 600, W: null, TL: 60, qty: 10, Bmid: null, material: null, finish: null,
      sizeType: null, unclear: null, product: null, threadEnds: null, bodyDia: null,
      H: null, ID: null, S: null, R: null },
    { M: 'M24', L: 1000, W: null, TL: 80, qty: 25, Bmid: null, material: null, finish: null,
      sizeType: null, unclear: null, product: null, threadEnds: null, bodyDia: null,
      H: null, ID: null, S: null, R: null },
  ],
};

/* A complete saved quotation. Every field the item carries on screen is present
   — including totalAmount, whose absence in an earlier fixture printed
   "RM NaN" on a screenshot and looked like an application defect. An evidence
   run starts from a state somebody wrote down on purpose. */
const SAVED = {
  ref_no: 'Q-2026-0041', quote_date: '2026-02-14', customer_name: 'Alpha Steel Sdn Bhd',
  prepared_by: 'Nicholas', company_id: 7, remarks: '',
  items: [{
    itemType: 'sagrod', description: 'MS FULLSIZE SAG ROD', productType: 'Sag Rod',
    size: 'M12', cleanSize: 'M12', material: 'MS', finish: 'ZP', sizeType: 'FULLSIZE',
    dimensions: 'M12 x L 1000 x TL 100/100mm', qty: 40,
    finalUnitPrice: 7.9, totalAmount: 316, weight: 0.8878,
    costRate: 2.8, addCost: 0.6, markup: 4, priceMode: 'auto', accessories: [],
  }],
};

module.exports = async (browser, A) => {
  const S = A.suite('rendered 中文 — the DOM, not the dictionary');

  /* ── 1 · The main page, every product form ───────────────────────────── */
  {
    const page = await openApp(browser);
    await setLang(page, 'zh');
    await clean(page, 'main page, Sag Rod', A);

    for (const t of ['stud', 'anchorbolt', 'ubolt', 'squbolt', 'lbolt', 'lbolt45',
                     'jbolt', 'plate', 'was', 'others']) {
      const exists = await page.evaluate(ty => !!document.querySelector(`.type-btn[data-type="${ty}"]`), t);
      A.ok(exists, `the ${t} form has a button to reach it`);
      if (!exists) continue;
      await page.evaluate(ty => switchType(ty), t);
      await page.waitForTimeout(160);
      await clean(page, `main page, ${t} form`, A);
    }
    await page.close();
  }

  /* ── 2 · A control that disappeared, which is not a wording problem ────
     ensurePriceModeControls found the form's pricing heading by looking for
     the English word "Pricing" in its text. Opened in 中文 that heading reads
     价格资料, the lookup returned nothing, and ten of the eleven product forms
     were built with no Price Mode select at all — No Round and Manual Price
     unreachable, with nothing on the screen to say why. Pricing itself was
     never touched: the default is Auto Round and the arithmetic is identical.
     What was lost was the operator's ability to choose.                    */
  {
    for (const lang of ['en', 'zh']) {
      const page = await openApp(browser);
      await setLang(page, lang);
      /* built at boot, so re-open the page in the language under test */
      await page.close();
    }
    const zh = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await zh.addInitScript(() => { try { localStorage.setItem('dc_lang', 'zh'); } catch (e) {} });
    await zh.close();

    const en = await openApp(browser);
    const enCount = await en.evaluate(() => document.querySelectorAll('[id$="-priceMode"]').length);
    await en.close();

    const page = await openApp(browser, { lang: 'zh' });
    await setLang(page, 'zh');
    const zhCount = await page.evaluate(() => document.querySelectorAll('[id$="-priceMode"]').length);
    A.eq(zhCount, enCount, 'every form that has a Price Mode control in English has one in 中文');
    A.eq(zhCount, 11, 'all eleven product forms carry a Price Mode control');
    const modes = await page.evaluate(() =>
      [...document.querySelectorAll('#sagrod-priceMode option')].map(o => o.value));
    A.eq(modes.join(','), 'auto,no_round,manual', 'and all three modes are selectable in 中文');
    await page.close();
  }

  /* ── 3 · The modals ──────────────────────────────────────────────────── */
  {
    const page = await openApp(browser);
    await setLang(page, 'zh');
    for (const [name, fn] of [
      ['Default Prices',     () => openDPModal()],
      ['Diameter Settings',  () => openDSModal()],
      ['Pricing Guide',      () => openRefModal()],
      ['Save',               () => openModal('saveModal')],
      ['WhatsApp template',  () => openModal('waTemplateModal')],
    ]) {
      await page.evaluate(fn);
      await page.waitForTimeout(420);
      await clean(page, name, A);
      await page.evaluate(() => document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')));
    }
    /* Every tab of the Pricing Guide, not just the one it opens on. */
    await page.evaluate(() => openRefModal());
    for (const tab of ['cost', 'addcost', 'pricemode', 'examples']) {
      await page.evaluate(t => switchRefTab(t), tab);
      await page.waitForTimeout(220);
      await clean(page, `Pricing Guide · ${tab}`, A);
    }
    await page.close();
  }

  /* ── 4 · Quick Add, from pasted customer text ─────────────────────────── */
  {
    const page = await openApp(browser);
    await setLang(page, 'zh');
    await page.evaluate(() => wqaOpen());
    await page.waitForTimeout(320);
    await clean(page, 'Quick Add, before anything is pasted', A);

    await quickAddPaste(page, 'M16 x 800 TL 80/80 qty 5\nM20 x 900 TL 90/90 qty 8');
    await clean(page, 'Quick Add review, expanded', A);

    await page.evaluate(() => wqaSetView('compact'));
    await page.waitForTimeout(300);
    await clean(page, 'Quick Add review, compact', A);
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(300);

    /* the history panel, which fetches and then draws its own card */
    await page.evaluate(() => { const b = document.querySelector('.wqa-row-hist'); if (b) b.click(); });
    await page.waitForTimeout(600);
    await clean(page, 'Quick Add, Previous Price panel open', A);

    /* the accessory panel on a row */
    await page.evaluate(() => { const b = document.querySelector('.wqa-acc-bar'); if (b) b.click(); });
    await page.waitForTimeout(320);
    await clean(page, 'Quick Add, row accessories open', A);

    /* Bulk Edit, and both apply scopes */
    await page.evaluate(() => wqaOpenBulkFor());
    await page.waitForTimeout(320);
    await clean(page, 'Quick Add, Bulk Edit', A);
    for (const scope of ['selected', 'all']) {
      await page.evaluate(s => { try { wqaSetApplyScope(s); } catch (e) {} }, scope);
      await page.waitForTimeout(240);
      await clean(page, `Quick Add, apply scope ${scope}`, A);
    }
    await page.close();
  }

  /* ── 5 · Quick Add, from an image — warnings, and the accessory note ──── */
  {
    const page = await openApp(browser);
    await setLang(page, 'zh');
    await page.evaluate(async d => { wqaOpen(); await wqaAiApply(d); }, IMAGE_EXTRACTION);
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(900);

    const flags = await page.evaluate(() =>
      [...document.querySelectorAll('.wqa-flag')].map(n => n.textContent.trim()));
    A.ok(flags.length > 0, 'the accessory mention is reported on screen');
    const acc = flags.join(' | ');
    A.excludes(acc, 'accessories are never added automatically',
      '中文: the accessory warning is not the English sentence');
    A.excludes(acc, 'Document mentions', '中文: nor its English opening');
    A.includes(acc, '3 NUTS + 2 FLAT WASHER',
      'the customer\'s own wording survives inside it, untranslated');
    A.ok(/[一-鿿]/.test(acc), 'and the sentence around it is Chinese');
    await clean(page, 'Quick Add from an image, with an accessory warning', A);

    /* the same warning, in English, says the English sentence */
    await setLang(page, 'en');
    await page.waitForTimeout(320);
    const enFlags = await page.evaluate(() =>
      [...document.querySelectorAll('.wqa-flag')].map(n => n.textContent.trim()).join(' | '));
    A.includes(enFlags, 'accessories are never added automatically',
      'English: the same warning reads in English');
    A.excludes(enFlags, '配件不会自动加入', 'English: and not also in Chinese');
    await page.close();
  }

  /* ── 6 · Quick Add, everything a row can be short of ──────────────────── */
  {
    const page = await openApp(browser);
    await setLang(page, 'zh');
    await quickAddPaste(page, [
      'Anchor bolt M20 x 600 TL 60/60 qty 10',
      'L BOLT 45DEG M16 x 500',
      'qty 100 / 200',
      'M24 x 1000',
      'M99 x 300 qty 4',
    ].join('\n'));
    await clean(page, 'Quick Add with Needs Qty, an unknown size and an unsupported product', A);

    /* the refusals themselves, read off the row rather than off the source */
    const badges = await page.evaluate(() =>
      [...document.querySelectorAll('.wqa-sum-badges')].map(n => n.textContent).join(' '));
    A.ok(/[一-鿿]/.test(badges), 'the row badges are in Chinese');
    A.excludes(badges, 'Needs ', '中文: no row asks for something in English');
    await page.close();
  }

  /* ── 7 · Companies, list, detail, empty and failed ────────────────────── */
  {
    const page = await openCompanies(browser, { lang: 'zh' });
    await clean(page, 'Companies list', A);
    const helper = await page.evaluate(() =>
      [...document.querySelectorAll('.q-helper')].map(n => n.textContent.trim()).join(' | '));
    A.excludes(helper, 'Select a company on the left',
      '中文 Companies: the helper line named in the review is translated');
    A.ok(/[一-鿿]/.test(helper), 'and reads as Chinese');

    await page.evaluate(() => { const c = document.querySelector('.company-card,.company-card-compact'); if (c) c.click(); });
    await page.waitForTimeout(800);
    await clean(page, 'Companies, a company selected', A);
    const detail = await page.evaluate(() =>
      [...document.querySelectorAll('.q-helper')].map(n => n.textContent.trim()).join(' | '));
    A.excludes(detail, 'Grand total is for quotation reference only',
      '中文 Companies: and so is the grand-total note');
    A.ok(!page._dcErrors.length, 'no script error on Companies: ' + page._dcErrors.join(' | '));
    await page.close();

    const empty = await openCompanies(browser, { lang: 'zh', api: { get_companies: { ok: true, data: [] } } });
    await clean(empty, 'Companies, nothing saved yet', A);
    await empty.close();

    const failed = await openCompanies(browser, {
      lang: 'zh', api: { get_companies: { ok: false, error: 'db down' }, get_quotations: { ok: false, error: 'db down' } } });
    await clean(failed, 'Companies, the endpoint failed', A);
    await failed.close();
  }

  /* ── 8 · A saved quotation, reopened ──────────────────────────────────── */
  {
    const page = await openApp(browser, { handoff: SAVED });
    await page.waitForTimeout(800);
    await setLang(page, 'zh');
    await page.waitForTimeout(320);
    await clean(page, 'a reopened saved quotation', A);

    const card = await page.evaluate(() => (document.querySelector('.qi-item') || {}).textContent || '');
    A.excludes(card, 'Qty ', '中文: the item card does not say Qty');
    A.excludes(card, 'Edit / 编辑', '中文: nor both languages at once');
    A.ok(/[一-鿿]/.test(card), 'the item card is in Chinese');
    const total = await page.evaluate(() => (document.getElementById('quoteTotalAmt') || {}).textContent || '');
    A.excludes(total, 'NaN', 'the quotation total is a number, not NaN');

    /* and the same quotation in English is English only */
    await setLang(page, 'en');
    await page.waitForTimeout(320);
    const enCard = await page.evaluate(() => (document.querySelector('.qi-item') || {}).textContent || '');
    A.ok(!/[一-鿿]/.test(enCard), 'English: the item card carries no Chinese — ' + enCard.slice(0, 120));
    A.includes(enCard, 'Qty', 'English: and does say Qty');
    await page.close();
  }

  /* ── 9 · The rest of the screen: empty states, Quick Open, the changelog ─
     The Version Updates list itself is deliberately NOT translated — it is a
     record of what shipped and when, written at the time — but the modal's own
     heading and close button are chrome and are scanned like anything else. */
  {
    const page = await openApp(browser);
    await setLang(page, 'zh');
    await clean(page, 'an empty quotation, nothing added yet', A);

    await page.evaluate(() => openModal('versionUpdatesModal'));
    await page.waitForTimeout(360);
    await clean(page, 'Version Updates, chrome only', A);
    const head = await page.evaluate(() =>
      (document.querySelector('#versionUpdatesModal .modal-title') || {}).textContent || '');
    A.ok(/[一-鿿]/.test(head), 'the Version Updates heading is translated even though its notes are not');
    await page.evaluate(() => closeModal('versionUpdatesModal'));

    /* Quick Open: found, and not found */
    await page.evaluate(() => { document.getElementById('qoInput').value = 'Q-NOPE-001'; quickOpen(); });
    await page.waitForTimeout(700);
    await clean(page, 'Quick Open, no such quotation', A);

    /* A refusal the operator will actually meet: adding with no rate. */
    await page.evaluate(() => { try { addSagRod(); } catch (e) {} });
    await page.waitForTimeout(400);
    const toast = await page.evaluate(() =>
      [...document.querySelectorAll('.toast,#toast,.toast-msg')].map(n => n.textContent.trim()).join(' | '));
    if (toast) A.ok(/[一-鿿]/.test(toast), `中文: the refusal is in Chinese — ${toast}`);
    await clean(page, 'after a refused Add', A);
    await page.close();
  }

  /* ── 10 · A drawing, which reaches Review by the same funnel ──────────── */
  {
    const page = await openApp(browser);
    await setLang(page, 'zh');
    await page.evaluate(async d => { wqaOpen(); await wqaAiApply(d); }, {
      product: 'L_BOLT', material: null, finish: null, sizeType: null, threadEnds: 1,
      note: null,
      items: [{ M: 'M16', L: 500, W: 120, TL: 100, qty: null, Bmid: null, material: null,
                finish: null, sizeType: null, unclear: 'quantity not shown on the drawing',
                product: null, threadEnds: null, bodyDia: null, H: null, ID: null, S: null, R: null }],
    });
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(900);
    await clean(page, 'a drawing extraction with an unreadable quantity', A);
    await page.close();
  }

  /* ── 11 · The counts and the state survive four switches ───────────────
     A switch re-labels; it must not re-render a value. dcApplyLang writes a
     dictionary CONSTANT into every element carrying a data-i18n, and on an
     element whose text is computed that constant is a lie — "0 项" on a footer
     with four rows under it.                                               */
  {
    const page = await openApp(browser);
    for (const n of [0, 1, 2, 4]) {
      const msg = Array.from({ length: n }, (_, i) =>
        `M${12 + i * 4} x ${500 + i * 100} TL 60/60 qty ${3 + i}`).join('\n');
      await page.evaluate(() => { try { wqaHardClose(); } catch (e) {} });
      if (n) await quickAddPaste(page, msg);
      else { await page.evaluate(() => wqaOpen()); await page.waitForTimeout(300); }

      /* The page's script is a classic one, so `wqa` is a module-level binding
         and never reaches window — it has to be read by name, not off window. */
      const read = () => page.evaluate(() => {
        const rows = (typeof wqa !== 'undefined' && wqa.rows) ? wqa.rows.filter(r => !r.removed) : [];
        return {
          rows: rows.length,
          add: (document.getElementById('wqaAddBtn') || {}).textContent || '',
          view: (typeof wqa !== 'undefined' ? wqa.view : '') || '',
          qty: rows.map(r => r.qty).join(','),
          price: rows.map(r => (r.calc ? r.calc.finalUnitPrice : '')).join(','),
        };
      });
      const before = await read();
      A.eq(before.rows, n, `${n} pasted items make ${n} rows`);

      for (const lang of ['zh', 'en', 'zh']) { await setLang(page, lang); }
      const after = await read();
      A.eq(after.rows, before.rows, `${n} items: EN→中文→EN→中文 keeps every row`);
      A.eq(after.qty, before.qty, `${n} items: and every quantity`);
      A.eq(after.price, before.price, `${n} items: and every price`);
      A.eq(after.view, before.view, `${n} items: and the expanded/compact choice`);
      if (n) {
        A.includes(after.add, String(n), `${n} items: the Add button still counts ${n}`);
        A.ok(/[一-鿿]/.test(after.add), `${n} items: and says so in Chinese — ${after.add}`);
      }
      /* the same button pressed twice, which is what wiped the count before */
      await setLang(page, 'zh');
      const twice = await read();
      A.eq(twice.rows, n, `${n} items: pressing 中文 while already in 中文 keeps the rows`);
      A.eq(twice.add, after.add, `${n} items: and the Add button's count`);
      await setLang(page, 'en');
    }
    A.ok(!page._dcErrors.length, 'no script error across the switches: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  return S;
};
