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

  /* ── 2b · The Quick Add entry, and where the product scope is stated ────
     The homepage button used to be called "WhatsApp Quick Add" and to name
     three products under it — Sag Rod / Stud / Anchor Bolt — while the parser
     reads five. Two things were wrong with that: the name said WhatsApp when a
     photograph or a PDF goes through the same door, and the scope was both
     incomplete and in the wrong place, on a button rather than beside the box
     it describes.

     So the button names no product at all, and the scope lives once, inside
     the modal, next to the paste box. This asserts both halves in both
     languages — and asserts the list against the PARSER's own table rather
     than against a copy of it, so adding a product to WQA_PRODUCTS and not to
     the hint fails here.                                                    */
  {
    const page = await openApp(browser);

    const readEntry = () => page.evaluate(() => {
      const btn = document.querySelector('.wqa-open-btn');
      const sub = btn && btn.querySelector('.wqa-open-sub');
      return {
        all: btn ? btn.textContent.replace(/\s+/g, ' ').trim() : '',
        sub: sub ? sub.textContent.replace(/\s+/g, ' ').trim() : '',
      };
    });

    const en = await readEntry();
    A.includes(en.all, 'Quick Add', 'English: the homepage entry is called Quick Add');
    A.excludes(en.all, 'WhatsApp Quick Add', 'English: and not WhatsApp Quick Add');
    A.eq(en.sub, 'Paste customer text or upload image / PDF',
      'English: the entry says what goes in, text or a file');

    await setLang(page, 'zh');
    const zh = await readEntry();
    A.includes(zh.all, 'AI 智能识别', '中文: the homepage entry is AI 智能识别');
    A.excludes(zh.all, 'Quick Add', '中文: with no English name beside it');
    A.eq(zh.sub, '粘贴客户文字或上传图片 / PDF', '中文: and the same subtitle, translated');

    /* No product is named on the homepage, in either language. */
    for (const [lang, e] of [['English', en], ['中文', zh]]) {
      for (const p of ['Sag Rod', 'Stud', 'Anchor Bolt', 'L Bolt', 'J Bolt']) {
        A.excludes(e.all, p, `${lang}: the homepage entry does not name ${p}`);
      }
    }

    /* Inside the modal, the scope is stated once — and completely. */
    const PARSED = await page.evaluate(() =>
      WQA_PRODUCTS.filter(p => p && p.type).map(p => p.label));
    A.eq(PARSED.slice().sort().join(','), 'Anchor Bolt,J Bolt,L Bolt,Sag Rod,Stud',
      'the parser reads exactly these five products');

    for (const lang of ['zh', 'en']) {
      await setLang(page, lang);
      await page.evaluate(() => { try { wqaHardClose(); } catch (e) {} wqaOpen(); });
      await page.waitForTimeout(350);
      /* By its id — the modal has several hints and the first one asks how
         the customer sent the request. */
      const hint = await page.evaluate(() =>
        (document.getElementById('wqaPasteHintLine') || {}).textContent || '');
      for (const p of PARSED) {
        A.includes(hint, p, `${lang}: the modal's scope names ${p}, which the parser reads`);
      }
      if (lang === 'zh') A.ok(/[一-鿿]/.test(hint), '中文: and the sentence around them is Chinese');
      /* the modal's own title matches the button that opened it */
      const title = await page.evaluate(() =>
        (document.querySelector('#wqaModal .modal-title') || {}).textContent || '');
      A.includes(title, lang === 'zh' ? 'AI 智能识别' : 'Quick Add',
        `${lang}: the modal is titled Quick Add`);
      A.excludes(title, 'WhatsApp', `${lang}: with no WhatsApp in the name`);
      await page.evaluate(() => { try { wqaHardClose(); } catch (e) {} });
      await page.waitForTimeout(200);
    }

    /* The hint is GENERATED from WQA_PRODUCTS, not copied from it. Proved by
       teaching the live table a product that does not exist and watching the
       sentence grow — in the page only, nothing on disk. A future sixth
       product therefore cannot leave the helper stale: there is no second
       list to forget. */
    const grown = await page.evaluate(() => {
      WQA_PRODUCTS.push({ type: 'zzztest', token: 'ZZZ', label: 'Zzz Bolt',
                          aliases: [], dims: ['size', 'length'], map: {},
                          threadEnds: 0, needSizeType: false });
      wqaWritePasteHint();
      const t = (document.getElementById('wqaPasteHintLine') || {}).textContent || '';
      WQA_PRODUCTS.pop();
      wqaWritePasteHint();
      return t;
    });
    A.includes(grown, 'Zzz Bolt',
      'a product added to WQA_PRODUCTS appears in the hint with no other edit');

    await setLang(page, 'zh');
    await page.evaluate(() => wqaOpen());
    await page.waitForTimeout(350);
    await clean(page, 'Quick Add entry and paste-box scope', A);
    A.ok(!page._dcErrors.length, 'no script error on the Quick Add entry: ' + page._dcErrors.join(' | '));
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

    await quickAddPaste(page, 'M16 x 800 TL 80/80 qty 5\nM20 x 900 TL 90/90 qty 8', { expanded: false });
    await clean(page, 'Quick Add review, as it opens', A);

    /* Every panel open at once — the legacy wqaSetView('expanded') call. Not
       on the screen any more, but still the widest single state there is. */
    await page.evaluate(() => wqaSetView('expanded'));
    await page.waitForTimeout(300);
    await clean(page, 'Quick Add review, every item panel open', A);
    /* Retired 2026-10-23 (AI review redesign): the "compact" state — the
       Compact/Expanded toggle is gone; "as it opens" above is that state. */
    await page.evaluate(() => wqaSetView('compact'));
    await page.waitForTimeout(300);

    /* the history panel, which fetches and then draws its own card */
    await page.evaluate(() => { const b = document.querySelector('.wqa-row-hist'); if (b) b.click(); });
    await page.waitForTimeout(600);
    await clean(page, 'Quick Add, Pricing History panel open (no records)', A);
    await page.evaluate(() => { const b = document.querySelector('.wqa-row-hist'); if (b) b.click(); });
    await page.waitForTimeout(300);

    /* the accessory panel on a row, inside that row's own panel */
    await page.evaluate(() => { wqaToggleRow(0); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const b = document.querySelector('[data-wqa-row="0"] .wqa-acc-bar'); if (b) b.click(); });
    await page.waitForTimeout(320);
    await clean(page, 'Quick Add, row accessories open', A);

    /* Bulk Adjust, and both apply scopes */
    await page.evaluate(() => { wqaToggleRow(0); wqaBulkSheetOpen(); });
    await page.waitForTimeout(320);
    await clean(page, 'Quick Add, Bulk Adjust', A);
    for (const scope of ['selected', 'all']) {
      await page.evaluate(s => wqaBsScope(s), scope);
      await page.waitForTimeout(240);
      await clean(page, `Quick Add, apply scope ${scope}`, A);
    }
    await page.evaluate(() => wqaBulkSheetClose());
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
      const msg = 'MS SAG ROD PL FULLSIZE\n' + Array.from({ length: n }, (_, i) =>
        `M${12 + i * 4} x ${500 + i * 100} TL 60/60 qty ${3 + i}`).join('\n');
      await page.evaluate(() => { try { wqaHardClose(); } catch (e) {} });
      if (n) {
        await quickAddPaste(page, msg);
        /* The Add button counts the rows that are ready to add, so these rows
           are given the rates that make them so — the test is about the count
           surviving a language switch, not about rows with no price. */
        await page.evaluate(() => { wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '5'); wqaEditPrice(i, 'addCost', '1'); }); });
        await page.waitForTimeout(900);
      }
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


  /* ── 13 · the AI 智能识别 review, state by state ────────────────────────
     Redesigned 2026-10-23. Every surface below is markup generated after
     dcApplyLang has already run — the shape that produced every false-green
     this suite exists to catch — so each is driven into being in 中文 and
     scanned as it stands: the review as it opens, the customer's message,
     an item's panel, a value being edited, the pricing strip, the history
     records, Selection mode, Bulk Adjust in each of its states, the "needs a
     size" prompt, a long series, and the same at phone width.

     Retired 2026-10-23 (AI review redesign), each with no equivalent left:
       · the row action reading 详情 / 关闭 — the Details button is gone; the
         row itself opens its panel, and its ▾ control is checked as 更多 / 收起;
       · #wqaListHead's 全选项目 box and the #wqaBulkSelN badge — ticks exist
         only in Selection mode, whose bar is checked instead;
       · Bulk Edit's three section titles and its accordion — Bulk Adjust is
         one sheet with one title;
       · Fast Edit's Done / Cancel and the 视图 label — the grid-wide edit and
         the view toggle are gone; a value is edited where it stands. */
  const REVIEW = 'MS SAG ROD ZP UNDERSIZE\nM12 x 853 x 70/70 - 4pcs\nM12 x 943 x 70/70 - 6pcs\nM16 x 500 x 70/70 - 2pcs';
  const REC = {
    quotationId: 1, refNo: 'Q-2026-0430', date: '2026-01-25', customer: 'Alpha Steel Sdn Bhd',
    companyId: 7, own: true, productType: 'SAG ROD', material: 'MS', sizeType: 'UNDERSIZE',
    finish: 'ZP', cleanSize: 'M12', dimensionPreview: 'L 853 x TL 70/70mm',
    exactDims: true, qty: 4, unitPrice: 9.9, boltUnitPrice: 9.9, accessoryCost: 0,
    accessorySummary: '', accessoryAmbiguous: false, priceMode: 'auto',
    priceModeLabel: 'Auto Round', costRate: 2.8, addCost: 0.6, markup: 4, weight: 0.6927, legacy: false,
  };
  const HISTORY_API = { get_pricing_history: () => ({ ok: true, data: {
    records: [REC], total: 1, ownTotal: 1, otherTotal: 0, offset: 0, limit: 20 } }) };
  /* The record's own stored dimension text, as the fixture above writes it —
     data the record carries, not a word of the interface. */
  const REC_DATA = { words: ['70/70mm'] };

  /* English mode: no Chinese anywhere in the review. The customer's message
     and the line an item was read from are the customer's, and skipped. */
  const noChinese = async (page, where) => {
    const hits = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#wqaModal *').forEach(e => {
        if (e.closest('.wqa-source-text,.wqa-row-raw-full,#wqaInput,script,style')) return;
        /* an <option> has no box of its own; it is on screen when its select is */
        const host = e.tagName === 'OPTION' ? e.closest('select') : e;
        if (!host || !host.getClientRects().length || getComputedStyle(host).visibility === 'hidden') return;
        let own = '';
        for (let n = e.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) own += n.nodeValue;
        ['placeholder', 'title', 'aria-label'].forEach(a => { const v = e.getAttribute(a); if (v) own += ' ' + v; });
        if (/[一-鿿]/.test(own)) out.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}: ${own.trim().slice(0, 80)}`);
      });
      return out;
    });
    A.eq(hits.length, 0, `English · ${where}: no Chinese in the review — ${hits.slice(0, 6).join(' | ')}`);
  };
  const txt = (page, s) => page.evaluate(q => {
    const n = document.querySelector(q); return n ? n.textContent.replace(/\s+/g, ' ').trim() : null; }, s);
  const all = (page, s) => page.evaluate(q =>
    [...document.querySelectorAll(q)].map(n => n.textContent.replace(/\s+/g, ' ').trim()), s);
  /* What the review heading, footer and rows say, read off the screen. */
  const words = page => page.evaluate(() => {
    const t = s => { const n = document.querySelector(s); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; };
    return {
      title: t('#wqaModal .modal-title [data-i18n="wqaTitle"]'),
      count: t('#wqaRowsCount'), add: t('#wqaAddBtn'),
      sel: t('#wqaRvActs .wqa-rv-selbtn'), bulk: t('#wqaRvActs .wqa-rv-bulkbtn'),
      source: t('#wqaSource .wqa-panel-title'),
      hist: [...document.querySelectorAll('#wqaRows .wqa-it-acts .wqa-row-hist')].map(n => n.textContent.trim()),
      px: t('[data-wqa-row="2"] .wqa-px-sum'), serPx: t('.wqa-ser-px'),
      pills: [...document.querySelectorAll('#wqaCommon .wqa-sp-k')].map(n => n.textContent.replace('*', '').trim()),
      more: (document.querySelector('[data-wqa-row="2"] .wqa-rv-more') || {}).getAttribute
              ? document.querySelector('[data-wqa-row="2"] .wqa-rv-more').getAttribute('aria-label') : '',
    };
  });

  {
    const page = await openApp(browser, { api: HISTORY_API });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await setLang(page, 'zh');
    await quickAddPaste(page, REVIEW, { expanded: false, settle: 900 });

    /* ── the review as it opens ── */
    await clean(page, 'review, as it opens', A);
    const zh = await words(page);
    A.eq(zh.title, 'AI 智能识别', '中文: the review is titled AI 智能识别');
    A.eq(zh.count, '已识别 3 个项目', '中文: the count reads 已识别 N 个项目');
    A.eq(zh.add, '加入 3 个项目到报价', '中文: Add reads 加入 N 个项目到报价');
    A.eq(zh.sel, '选择', '中文: the Selection-mode button is 选择');
    A.eq(zh.bulk, '批量调整', '中文: Bulk Adjust is 批量调整');
    A.eq(zh.source, '原始内容', '中文: the customer\'s message is 原始内容');
    A.ok(zh.hist.length === 3 && zh.hist.every(h => h.startsWith('客户历史报价')),
      `中文: every item's history action is 客户历史报价 — ${zh.hist.join(' | ')}`);
    A.eq(zh.px, '成本 4.20 · 加工费 0.60 · Markup 0%', '中文: an item\'s pricing line reads 成本 · 加工费 · Markup');
    A.eq(zh.serPx, '成本 4.20 · 加工费 0.60 · Markup 0%', '中文: and so does the series heading\'s');
    A.eq(zh.pills.join(' · '), '产品 · 材料 · 表面处理 · Size 规格', '中文: the shared values are 产品 · 材料 · 表面处理 · Size 规格');
    A.eq(zh.more, '更多', '中文: an item\'s ▾ control is 更多');
    A.eq(await txt(page, '[data-wqa-row="2"] [data-tok="qty"] .wqa-tok-k'), '数量', '中文: a quantity is 数量');

    /* ── the customer's message, opened ── */
    await page.evaluate(() => document.querySelector('#wqaSource .wqa-panel-head').click());
    await page.waitForTimeout(400);
    await clean(page, 'review, 原始内容 open', A);
    A.eq(await txt(page, '#wqaSource .wqa-panel-title'), '原始内容', '中文: and is still 原始内容 open');
    await page.evaluate(() => document.querySelector('#wqaSource .wqa-panel-head').click());
    await page.waitForTimeout(300);

    /* ── an item's own panel, opened by pressing the item ── */
    await page.evaluate(() => document.querySelector('[data-wqa-row="2"] .wqa-it-main').click());
    await page.waitForTimeout(450);
    A.eq(await page.evaluate(() => document.querySelectorAll('.wqa-rv-detail').length), 1,
      'pressing an item opens its panel');
    await clean(page, 'review, an item panel open', A);
    const lbl = await page.evaluate(() => {
      const of = f => { const n = document.querySelector(`[data-wqa-row="2"] .wqa-rv-detail [data-ef="${f}"]`);
                        return n ? n.closest('label').querySelector('span').textContent.trim() : null; };
      return { size: of('size'), st: of('sizeType'), more: document.querySelector('[data-wqa-row="2"] .wqa-rv-more').getAttribute('aria-label') };
    });
    A.eq(lbl.size, '螺纹 Size', '中文: the thread size is labelled 螺纹 Size');
    A.eq(lbl.st, 'Size 规格', '中文: and the size type Size 规格');
    A.eq(lbl.more, '收起', '中文: and the ▾ control says 收起 while it is open');

    /* ── its accessories ── */
    await page.evaluate(() => document.querySelector('[data-wqa-row="2"] .wqa-acc-bar').click());
    await page.waitForTimeout(350);
    await clean(page, 'review, item accessories open', A);
    await page.evaluate(() => wqaToggleRow(2));
    await page.waitForTimeout(300);

    /* ── a value being edited where it stands ── */
    await page.evaluate(() => document.querySelector('[data-wqa-row="2"] [data-tok="length"]').click());
    await page.waitForTimeout(350);
    A.eq(await page.evaluate(() => document.querySelectorAll('#wqaRows .wqa-ix').length), 1,
      'pressing a value opens one box in its place');
    await clean(page, 'review, a value being edited', A);
    await page.evaluate(() => wqaEditDone());
    await page.waitForTimeout(350);

    /* ── the pricing strip ── */
    await page.evaluate(() => wqaPxToggle(2));
    await page.waitForTimeout(350);
    A.eq(await page.evaluate(() => document.querySelectorAll('#wqaRows .wqa-px').length), 1, 'the pricing strip opens');
    await clean(page, 'review, pricing strip open', A);
    await page.evaluate(() => wqaPxToggle(2));
    await page.waitForTimeout(300);

    /* ── the history records ── */
    await page.evaluate(() => wqaHistToggle(2));
    await page.waitForTimeout(1000);
    A.eq(await page.evaluate(() => document.querySelectorAll('.wqa-hist-panel .ph-rec').length), 1,
      'the history panel draws its record');
    await clean(page, 'review, 客户历史报价 records open', A, REC_DATA);
    A.eq(await txt(page, '.wqa-hist-panel .wqa-hist-lbl'), '客户历史报价', '中文: headed 客户历史报价');
    await page.evaluate(() => wqaHistToggle(2));
    await page.waitForTimeout(300);

    /* ── Selection mode: empty, then two picked ── */
    await page.evaluate(() => wqaSelEnter());
    await page.waitForTimeout(350);
    await clean(page, 'review, Selection mode, nothing picked', A);
    A.eq(await txt(page, '#wqaSelBar .wqa-selbar-n'), '已选择 0 个项目', '中文: the bar counts 已选择 N 个项目');
    A.eq(await page.evaluate(() => document.querySelector('[data-wqa-row="0"] .wqa-pick').getAttribute('aria-label')),
      '选择第 1 项', '中文: each tick box names its item');
    await page.evaluate(() => { wqaRvToggleSel(0); wqaRvToggleSel(2); });
    await page.waitForTimeout(350);
    await clean(page, 'review, two items picked', A);
    A.eq(await txt(page, '#wqaSelBar .wqa-selbar-n'), '已选择 2 个项目', '中文: and follows the ticks');

    /* ── Bulk Adjust, from the selection ── */
    await page.evaluate(() => wqaBulkSheetOpen('selected'));
    await page.waitForTimeout(350);
    await clean(page, 'Bulk Adjust, scope 已选择项目', A);
    const bs = await page.evaluate(() => {
      const p = document.getElementById('wqaBulkSheetPanel');
      return {
        title: p.querySelector('.wqa-bs-title').textContent.trim(),
        scope: [...p.querySelectorAll('.wqa-bs-sc')].map(n => n.textContent.trim()),
        on: (p.querySelector('.wqa-bs-sc.is-on') || {}).textContent || '',
        keep: [...p.querySelectorAll('select[data-bs]')].map(s => s.options[s.selectedIndex].textContent.trim()),
        ph: [...p.querySelectorAll('input[data-bs]')].map(n => n.placeholder),
        apply: p.querySelector('#wqaBsApply').textContent.trim(),
        size: p.querySelector('[data-bs="size"]').closest('label').querySelector('.wqa-bs-k').textContent.trim(),
      };
    });
    A.eq(bs.title, '批量调整', '中文: the sheet is 批量调整');
    A.eq(bs.scope.join(' / '), '全部项目（3） / 已选择项目（2）', '中文: its scope is 全部项目 / 已选择项目');
    A.eq(bs.on.trim(), '已选择项目（2）', 'and it opened on the selection');
    A.ok(bs.keep.length >= 5 && bs.keep.every(k => k === '不修改'), `中文: every field starts at 不修改 — ${bs.keep.join(',')}`);
    A.ok(bs.ph.length >= 4 && bs.ph.every(k => k === '不修改'), '中文: and every box says 不修改 until typed in');
    A.eq(bs.apply, '应用调整', '中文: and Apply is 应用调整');
    A.eq(bs.size, '螺纹 Size', '中文: its size field is 螺纹 Size');

    /* every kind of change it can describe, described */
    await page.evaluate(() => {
      wqaBsSet('finish', 'HDG'); wqaBsSet('markup', '5'); wqaBsSet('priceMode', 'manual');
      wqaBsSet('acc', 'set'); wqaBsEditAcc('nut', 'enabled', true);
    });
    await page.waitForTimeout(400);
    await clean(page, 'Bulk Adjust with fields set, Manual Price and accessories', A);
    const lines = await all(page, '#wqaBsSummary li');
    A.ok(lines.length >= 4 && lines.every(l => /[一-鿿]/.test(l)), `中文: what Apply will do is said in Chinese — ${lines.join(' | ')}`);
    await page.evaluate(() => wqaBsSet('acc', 'clear'));
    await page.waitForTimeout(300);
    await clean(page, 'Bulk Adjust clearing accessories', A);

    /* the refusal, which only exists in one state and is easy to miss */
    await page.evaluate(() => { wqaBulkSheetClose(); wqaSelExit(); wqaBulkSheetOpen('all'); wqaBsScope('selected'); });
    await page.waitForTimeout(400);
    const refuse = await page.evaluate(() => ({
      text: (document.querySelector('#wqaBsSummary .wqa-bs-n.is-why') || {}).textContent || '',
      off: !!el('wqaBsApply').disabled }));
    A.eq(refuse.text.trim(), '尚未选择项目。', '已选择项目 with nothing picked refuses, in Chinese, word for word');
    A.eq(String(refuse.off), 'true', 'with Apply disabled');
    await clean(page, 'Bulk Adjust refusing an empty selection', A);
    await page.evaluate(() => wqaBsScope('all'));
    await page.waitForTimeout(250);
    A.eq((await txt(page, '#wqaBsSummary .wqa-bs-n')), '请至少选择一个要修改的字段。',
      'and with nothing changed, it says so');
    await page.evaluate(() => wqaBulkSheetClose());
    await page.waitForTimeout(250);

    /* ── English: the same states, English only, in the approved words ── */
    await setLang(page, 'en');
    const en = await words(page);
    A.eq(en.title, 'Quick Add', 'English: the review is titled Quick Add');
    A.eq(en.count, 'Detected 3 items', 'English: Detected N items');
    A.eq(en.add, 'Add 3 Items to Quotation', 'English: Add N Items to Quotation');
    A.eq(en.sel + ' / ' + en.bulk, 'Select / Bulk Adjust', 'English: Select / Bulk Adjust');
    A.eq(en.source, 'Original Content', 'English: Original Content');
    A.ok(en.hist.every(h => h.startsWith('Pricing History')), `English: Pricing History — ${en.hist.join(' | ')}`);
    A.eq(en.px, 'Cost 4.20 · Add. Cost 0.60 · Markup 0%', 'English: Cost · Add. Cost · Markup');
    A.eq(en.pills.join(' · '), 'Product · Material · Finish · Size Type', 'English: the shared values');
    await noChinese(page, 'review, as it opens');
    await page.evaluate(() => { wqaToggleRow(2); });
    await page.waitForTimeout(350);
    A.eq(await page.evaluate(() => document.querySelector('[data-wqa-row="2"] .wqa-rv-detail [data-ef="size"]').closest('label').querySelector('span').textContent.trim()),
      'Size', 'English: the thread size is Size');
    await page.evaluate(() => document.querySelector('[data-wqa-row="2"] .wqa-acc-bar').click());
    await page.waitForTimeout(300);
    await noChinese(page, 'an item panel with accessories open');
    await page.evaluate(() => { wqaToggleRow(2); wqaPxToggle(2); });
    await page.waitForTimeout(300);
    await noChinese(page, 'pricing strip open');
    await page.evaluate(() => { wqaPxToggle(2); wqaHistToggle(2); });
    await page.waitForTimeout(900);
    await noChinese(page, 'Pricing History records open');
    await page.evaluate(() => { wqaHistToggle(2); wqaSelEnter(); wqaRvToggleSel(1); });
    await page.waitForTimeout(350);
    await noChinese(page, 'Selection mode');
    await page.evaluate(() => { wqaBulkSheetOpen('selected'); wqaBsSet('priceMode', 'manual'); wqaBsSet('acc', 'set'); });
    await page.waitForTimeout(350);
    const enBs = await page.evaluate(() => {
      const p = document.getElementById('wqaBulkSheetPanel');
      return { keep: [...p.querySelectorAll('select[data-bs]')].map(s => s.options[0].textContent.trim()),
               scope: [...p.querySelectorAll('.wqa-bs-sc')].map(n => n.textContent.trim()).join(' / '),
               apply: p.querySelector('#wqaBsApply').textContent.trim(),
               title: p.querySelector('.wqa-bs-title').textContent.trim() };
    });
    A.ok(enBs.keep.every(k => k === 'No change'), `English: every field offers No change — ${enBs.keep.join(',')}`);
    A.eq(enBs.scope, 'All items (3) / Selected items (1)', 'English: All items / Selected items');
    A.eq(enBs.title + ' · ' + enBs.apply, 'Bulk Adjust · Apply Adjustment', 'English: Bulk Adjust · Apply Adjustment');
    await noChinese(page, 'Bulk Adjust with Manual Price and accessories');
    await page.evaluate(() => { wqaBulkSheetClose(); wqaSelExit(); });

    /* ── and back, four times, because a re-render is where a label goes missing ── */
    for (const lang of ['zh', 'en', 'zh', 'en', 'zh']) { await setLang(page, lang); }
    await page.waitForTimeout(300);
    const again = await words(page);
    A.eq(again.count + ' · ' + again.add, '已识别 3 个项目 · 加入 3 个项目到报价',
      'the count and Add survive EN→中文 four times');
    A.eq(again.more + ' · ' + again.bulk, '更多 · 批量调整', 'and so do the item and heading controls');
    await clean(page, 'review, after five language switches', A);
    A.ok(!page._dcErrors.length, 'no script error: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  /* ── 14 · a shorthand list that never states the size, and a long series ─
     Two more states: the prompt that asks for the missing thread size, and
     thirty consecutive rows drawn as one series under one heading. */
  {
    const page = await openApp(browser);
    await setLang(page, 'zh');
    await quickAddPaste(page, 'MS SAG ROD ZP UNDERSIZE\n1068 - 38pcs\n1430 - 148pcs\n1295 - 34pcs', { expanded: false, settle: 1000 });
    const need = await txt(page, '#wqaRvNeed');
    A.ok(!!need && need.includes('3 个项目缺少螺纹 Size 或 TL'), `中文: the prompt reads N 个项目缺少螺纹 Size 或 TL — ${need}`);
    await clean(page, 'review, items missing their thread size', A);
    await page.evaluate(() => document.querySelector('#wqaRvNeed .btn').click());
    await page.waitForTimeout(400);
    await clean(page, 'Bulk Adjust opened from the missing-size prompt', A);
    await page.evaluate(() => wqaBulkSheetClose());

    const lines = ['MS SAG ROD ZP UNDERSIZE'];
    for (let i = 0; i < 30; i++) lines.push(`M12 x ${800 + i * 10} x 70/70 - ${i + 1}pcs`);
    lines.push('M16 x 1240 x 90/90 - 18pcs');
    await quickAddPaste(page, lines.join('\n'), { expanded: false, settle: 1400 });
    const ser = await page.evaluate(() => ({
      series: document.querySelectorAll('#wqaRows .wqa-ser').length,
      inSeries: document.querySelectorAll('#wqaRows .wqa-ser .wqa-it').length,
      n: (document.querySelector('.wqa-ser-n') || {}).textContent || '' }));
    A.eq(ser.inSeries, 30, 'thirty agreeing rows are drawn as one series');
    A.eq(ser.n.trim(), '30 个项目', '中文: whose heading counts 30 个项目');
    await clean(page, 'review, a series of thirty rows', A);
    await page.evaluate(() => wqaToggleRow(5));
    await page.waitForTimeout(400);
    await clean(page, 'review, a series row\'s panel open', A);
    await setLang(page, 'en');
    await noChinese(page, 'a series of thirty rows');
    await page.close();
  }

  /* ── 15 · the same review on a phone ─────────────────────────────────── */
  {
    const page = await openApp(browser, { viewport: { width: 390, height: 844 } });
    await setLang(page, 'zh');
    await quickAddPaste(page, REVIEW, { expanded: false, settle: 900 });
    await clean(page, 'phone · review, as it opens', A);
    /* a tap on the row, which is what a phone has */
    const at = await page.$eval('[data-wqa-row="2"] .wqa-it-main', n => {
      n.scrollIntoView({ block: 'center' }); const b = n.getBoundingClientRect();
      return [b.left + b.width / 2, b.top + b.height / 2]; });
    await page.mouse.click(at[0], at[1]);
    await page.waitForTimeout(450);
    await clean(page, 'phone · an item tapped open', A);
    await page.evaluate(() => { wqaToggleRow(2); wqaSelEnter(); wqaRvToggleSel(0); });
    await page.waitForTimeout(350);
    await clean(page, 'phone · Selection mode', A);
    await page.evaluate(() => wqaBulkSheetOpen('selected'));
    await page.waitForTimeout(350);
    await clean(page, 'phone · Bulk Adjust', A);
    await setLang(page, 'en');
    await noChinese(page, 'phone · Bulk Adjust');
    await page.evaluate(() => { wqaBulkSheetClose(); wqaSelExit(); });
    await page.waitForTimeout(300);
    await noChinese(page, 'phone · review');
    A.ok(!page._dcErrors.length, 'no script error at phone width: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  return S;
};
