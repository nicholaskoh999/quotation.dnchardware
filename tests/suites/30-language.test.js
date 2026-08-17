/* ── Both languages, on the screens staff actually use ──────────────────────
   The dictionary being complete is not the same as the screen being
   translated. A string written straight into a showToast or a title attribute
   has no key, so it counts as 100% translated and still appears in English —
   which is exactly what was happening to every validation message in the app:
   a person working in 中文 was told "Enter Diameter" and "Cost Rate is blank.
   Enter price before adding."

   So this suite switches the language the way the button does and then reads
   the SCREEN. It asserts two things and no more:

     · the English wording is gone from the visible text
     · the trade's own vocabulary is still there — M12, 1/2", SS304, 4140 QT,
       PL, ZP, HDG, UNC, BSW, TL, RM. Those are the same words in either mode
       and translating them would be the worse bug.

   It deliberately does not judge the Chinese wording. Whether 螺纹参考 reads
   well is a person's call; that the box is not still saying "Thread Reference"
   is this file's.                                                           */
'use strict';
const { openApp, openCompanies, quickAddPaste } = require('../lib/harness');

/* Everything a person can read right now — the whole page, or one part of it.
   Scoping matters for the product forms: the Version Updates page keeps its
   release notes in the document, and those are a record of what shipped, in
   the language it was written in. They are deliberately not translated (see
   check-translations.js), so a whole-page scan would report the changelog
   rather than the form under test. */
const visibleText = (page, sel) => page.evaluate(root => {
  const seen = [];
  const walk = n => {
    if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) seen.push(t); return; }
    if (n.nodeType !== 1) return;
    const st = getComputedStyle(n);
    if (st.display === 'none' || st.visibility === 'hidden' || n.hidden) return;
    for (const a of ['title', 'placeholder', 'aria-label', 'alt']) {
      const v = n.getAttribute && n.getAttribute(a);
      if (v) seen.push(v);
    }
    if (n.tagName === 'INPUT' && n.value) seen.push(n.value);
    n.childNodes.forEach(walk);
  };
  walk((root && document.querySelector(root)) || document.body);
  return seen.join(' • ');
}, sel || null);

const setLang = async (page, l) => {
  await page.evaluate(x => dcSetLang(x), l);
  await page.waitForTimeout(300);
};

module.exports = async (browser, A) => {
  const S = A.suite('English / 中文 — the screen, not the dictionary');

  const page = await openApp(browser);
  await page.evaluate(() => { selectedCompanyId = 7; });

  // ══ 1 · THE MAIN SCREEN SWITCHES, AND SWITCHES BACK ════════════════════
  {
    await setLang(page, 'en');
    const en = await visibleText(page);
    A.includes(en, 'Quotation List', 'English: the quotation list is named in English');
    A.includes(en, 'Customer', 'English: and the customer step');

    await setLang(page, 'zh');
    const zh = await visibleText(page);
    A.includes(zh, '报价清单', '中文: the quotation list is named in Chinese');
    A.excludes(zh, 'Quotation List', '中文: and not also in English');
    A.excludes(zh, 'Quick Menu', '中文: the sidebar is translated');
    A.excludes(zh, 'Default Prices', '中文: including every menu entry');
    A.excludes(zh, 'Diameter Settings', '中文: including Diameter Settings');
    A.excludes(zh, 'Version Updates', '中文: including Version Updates');
    A.excludes(zh, 'Pricing Guide', '中文: including Pricing Guide');

    /* The trade's vocabulary is NOT translated, in either mode. */
    A.includes(zh, 'RM', '中文: RM is still RM');

    await setLang(page, 'en');
    const back = await visibleText(page);
    A.includes(back, 'Quotation List', 'switching back restores English');
  }

  // ══ 2 · VALIDATION MESSAGES ════════════════════════════════════════════
  /* The largest group of leaks: ~120 strings written straight into showToast.
     Each of these is a real refusal path — the toast a person gets when they
     press Add with something missing. */
  {
    const toastAfter = async fn => {
      await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.textContent = ''; });
      await page.evaluate(fn);
      await page.waitForTimeout(250);
      return page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
    };

    await setLang(page, 'zh');
    for (const [fn, forbidden, why] of [
      [() => { switchType('sagrod'); document.getElementById('sagrod-size').value = ''; addSagRod(); },
       'Enter Size', 'a missing size'],
      [() => { showToast(dcT('tRateBlank')); }, 'Cost Rate is blank', 'a blank cost rate'],
      [() => { showToast(dcT('tAddItemsFirst')); }, 'Add items first', 'an empty quotation'],
      [() => { showToast(dcT('tCustomerRequired')); }, 'Customer is required', 'a missing customer'],
      [() => { showToast(dcT('tClickEditFirst')); }, 'Click Edit Saved Quotation', 'a locked quotation'],
      [() => { showToast(dcT('tNoRefNo')); }, 'Unable to get quotation number', 'a failed reference lookup'],
      [() => { showToast(dcT('tLen0LW')); }, 'Total Length is 0', 'a zero total length'],
      [() => { showToast(dcT('tEnterHoles')); }, 'Enter Hole Dia', 'a plate with no holes stated'],
    ]) {
      const said = await toastAfter(fn);
      A.ok(said.length > 0, `中文: ${why} still says something`);
      A.excludes(said, forbidden, `中文: ${why} is not answered in English`);
      A.ok(/[一-鿿]/.test(said), `中文: ${why} is answered in Chinese`);
    }
    await setLang(page, 'en');
    const enSaid = await toastAfter(() => { showToast(dcT('tRateBlank')); });
    A.includes(enSaid, 'Cost Rate is blank', 'English: the same message reads in English');
  }

  // ══ 3 · QUICK ADD REVIEW ═══════════════════════════════════════════════
  {
    await quickAddPaste(page, 'MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 4pcs\nM16 x 800 x 100/100 - 2pcs',
      { settle: 900 });
    await setLang(page, 'zh');
    await page.waitForTimeout(400);
    const zh = await visibleText(page);

    A.excludes(zh, 'Thread Reference', '中文: the Thread Reference box is translated');
    A.excludes(zh, 'Bulk Edit', '中文: Bulk Edit is translated');
    A.excludes(zh, 'Add to Quotation', '中文: the add button is translated');
    A.excludes(zh, 'reference only', '中文: the note under the box is translated');
    A.excludes(zh, 'Pricing history for this item', '中文: the history button tooltip is translated');
    A.excludes(zh, 'Remove item', '中文: the remove control is translated');

    /* And the values on those rows are untouched by any of it. */
    A.includes(zh, 'M12', '中文: M12 is still M12');
    A.includes(zh, 'M16', '中文: and M16');
    A.includes(zh, 'ZP', '中文: ZP is still ZP');

    await setLang(page, 'en');
  }

  // ══ 4 · STAINLESS AND GRADE VOCABULARY SURVIVE THE SWITCH ══════════════
  {
    await quickAddPaste(page, 'SS304 SAG ROD FULLSIZE\nM12 x 1000 x 100/100 - 4pcs', { settle: 900 });
    await setLang(page, 'zh');
    await page.waitForTimeout(400);
    const zh = await visibleText(page);
    A.includes(zh, 'SS304', '中文: SS304 is a material code, not a word to translate');

    await quickAddPaste(page, 'GRADE 8.8 SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 4pcs', { settle: 900 });
    await page.waitForTimeout(400);
    const zh2 = await visibleText(page);
    A.includes(zh2, '4140', '中文: 4140 QT is a material code too');
    await setLang(page, 'en');
  }

  // ══ 5 · THE SCREENS THAT WERE NEVER SWITCHED AT ALL ════════════════════
  /* Three of them, each in its own way:

       · the Pricing Guide, written entirely in English in the markup, so it
         was the one page that did not change when the language did;
       · Plate and Welding Anchor Set, written before the switch existed and
         still carrying the old side-by-side style — "Material 材料", both at
         once, in either mode;
       · the Welding Anchor Set guide box, which held Chinese and only
         Chinese, so an English reader was handed a paragraph they could not
         read. */
  {
    /* Pricing Guide — opened the way the sidebar entry opens it. */
    await page.evaluate(() => openRefModal());
    await page.waitForTimeout(400);
    await setLang(page, 'en');
    const guideEn = await visibleText(page, '#refModal');
    A.includes(guideEn, 'Cost Rate', 'English: the Pricing Guide explains the Cost Rate');
    await setLang(page, 'zh');
    const guideZh = await visibleText(page, '#refModal');
    A.excludes(guideZh, 'Cost Rate = material cost per kg', '中文: the Pricing Guide is translated');
    A.excludes(guideZh, 'Staff enters the final customer selling price', '中文: including the price modes');
    A.excludes(guideZh, 'Used for extra work', '中文: and the Additional Cost explanation');
    A.includes(guideZh, 'RM', '中文: and the worked examples keep their RM figures');

    await page.evaluate(() => { const m = document.getElementById('refModal'); if (m) m.classList.remove('open'); });
    await page.waitForTimeout(200);

    /* Plate and Welding Anchor Set. */
    for (const [type, why] of [['plate', 'Plate'], ['was', 'Welding Anchor Set']]) {
      await page.evaluate(t => switchType(t), type);
      await page.waitForTimeout(300);
      await setLang(page, 'zh');
      const zh = await visibleText(page, '#form-' + type);
      A.excludes(zh, 'Cut Length', `中文: ${why} — the dimension labels are translated`);
      A.excludes(zh, 'Additional Cost', `中文: ${why} — and the pricing labels`);
      await setLang(page, 'en');
      const en = await visibleText(page, '#form-' + type);
      A.includes(en, 'Additional Cost', `English: ${why} — and they read English in English`);
      A.excludes(en, '额外加工费', `English: ${why} — with no Chinese beside them`);
    }

    /* The guide box: readable in BOTH, which it was not. */
    await page.evaluate(() => switchType('was'));
    await page.waitForTimeout(300);
    await setLang(page, 'en');
    const wasEn = await visibleText(page, '#form-was');
    A.includes(wasEn, 'welded into one set', 'English: the Welding Anchor Set guide is in English');
    await setLang(page, 'zh');
    const wasZh = await visibleText(page, '#form-was');
    A.includes(wasZh, '焊接成一套', '中文: and in Chinese');
    A.excludes(wasZh, 'welded into one set', '中文: and not both at once');
    await setLang(page, 'en');
    await page.evaluate(() => switchType('sagrod'));
    await page.waitForTimeout(300);
  }

  // ══ 6 · NOTHING LEAKS A KEY NAME ═══════════════════════════════════════
  /* dcT falls back to the key itself when nothing defines it, so a key name on
     screen is a missing dictionary entry showing through. */
  {
    for (const lang of ['en', 'zh']) {
      await setLang(page, lang);
      const txt = await visibleText(page);
      for (const key of ['wqaThreadRef', 'tEnterSize', 'tRateBlank', 'ariaHome',
                         'btnEdit', 'lblCurrent', 'tAdding', 'undefined', '[object Object]']) {
        A.excludes(txt, key, `${lang}: "${key}" is never shown raw`);
      }
    }
    await setLang(page, 'en');
  }


  // ══ 7 · THE ITEM COUNT SURVIVES THE SWITCH ═════════════════════════════
  /* dcApplyLang writes every data-i18n element's text from the dictionary. On
     a COUNTER that constant is a lie — "0 items" on a review holding two — and
     dcRelabel is what puts the real number back. dcSetLang used to skip
     dcRelabel when the chosen language was the one already in force, which is
     exactly what pressing the active EN or 中文 button does: the footer went to
     "0 项" with two rows on the screen, and the Add button lost its count. */
  {
    const counts = () => page.evaluate(() => ({
      foot: (document.getElementById('wqaFootTotal') || {}).textContent || '',
      head: (document.getElementById('wqaRowsCount') || {}).textContent || '',
      add:  (document.getElementById('wqaAddBtn') || {}).textContent || '',
      rows: wqa.rows.filter(r => !r.removed).length,
      cards: document.querySelectorAll('[data-wqa-row]').length,
      view: wqa.view || '',
    }));

    for (const [msg, n] of [
      ['MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 40pcs', 1],
      ['MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 40pcs\nM16 x 850 x 100/100 - 20pcs', 2],
      ['MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 40pcs\nM16 x 850 x 100/100 - 20pcs'
       + '\nM20 x 3000 x 150/150 - 8pcs\nM24 x 500 x 100/100 - 4pcs', 4],
    ]) {
      await setLang(page, 'en');
      await quickAddPaste(page, msg, { expanded: false, settle: 900 });
      const en = await counts();
      A.eq(en.rows, n, `English: ${n} row(s) parsed`);
      A.includes(en.foot, String(n), `English: the footer counts ${n}`);
      A.includes(en.add, String(n), `English: the Add button counts ${n}`);

      await setLang(page, 'zh');
      const zh = await counts();
      A.eq(zh.rows, n, `中文: the rows are still there (${n})`);
      A.eq(zh.cards, n, `中文: and so are their cards`);
      A.eq(zh.view, en.view, '中文: compact/expanded is unchanged');
      A.includes(zh.foot, String(n), `中文: the footer still counts ${n}, not 0`);
      A.includes(zh.foot, '项', '中文: and counts it in Chinese');
      A.includes(zh.add, String(n), `中文: the Add button keeps its count`);
      A.excludes(zh.add, 'Add', '中文: and is translated');

      /* Pressing the button for the language ALREADY in force. This is the
         path that used to wipe the count, because nothing re-rendered. */
      await setLang(page, 'zh');
      const again = await counts();
      A.includes(again.foot, String(n), `中文 pressed twice: the footer still counts ${n}`);
      A.includes(again.add, String(n), `中文 pressed twice: and so does the Add button`);
      A.eq(again.rows, n, '中文 pressed twice: the rows are untouched');

      await setLang(page, 'en');
      const back = await counts();
      A.includes(back.foot, String(n), `back to English: the footer counts ${n}`);
      A.includes(back.add, String(n), 'back to English: and the Add button');
      A.eq(back.rows, n, 'back to English: rows intact');
    }

    /* And an EMPTY review says zero in the language it is in. */
    await page.evaluate(() => wqaHardClose());
    await page.waitForTimeout(300);
    await setLang(page, 'zh');
    await page.evaluate(() => wqaOpen());
    await page.waitForTimeout(400);
    const empty = await counts();
    A.eq(empty.rows, 0, 'an empty review holds no rows');
    A.includes(empty.foot, '项', '中文: and says so in Chinese');
    A.excludes(empty.foot, 'items', '中文: not in English');
    await page.evaluate(() => wqaHardClose());
    await setLang(page, 'en');
  }

  // ══ 8 · THE SAVED QUOTATION'S OWN CONTROLS ═════════════════════════════
  /* One language at a time. These two buttons read "Edit / 编辑" and
     "Delete / 删除" — both languages at once, in either mode. */
  {
    await quickAddPaste(page, 'MS SAG ROD ZP FULLSIZE\nM12 x 1000 x 100/100 - 40pcs', { settle: 900 });
    await page.evaluate(() => { wqaEditPrice(0, 'costRate', '6.20'); wqaEditPrice(0, 'addCost', '2.40'); });
    await page.waitForTimeout(700);
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1200);

    await setLang(page, 'en');
    const en = await visibleText(page, '#quoteItemList');
    A.includes(en, 'Edit', 'English: the item card offers Edit');
    A.excludes(en, '编辑', 'English: and not 编辑 beside it');
    A.excludes(en, '删除', 'English: nor 删除');

    await setLang(page, 'zh');
    const zh = await visibleText(page, '#quoteItemList');
    A.includes(zh, '编辑', '中文: the item card offers 编辑');
    A.includes(zh, '删除', '中文: and 删除');
    A.excludes(zh, 'Edit /', '中文: never "Edit / 编辑"');
    A.excludes(zh, 'Delete /', '中文: never "Delete / 删除"');
    A.excludes(zh, 'Unit Weight', '中文: the weight pill is translated');
    A.excludes(zh, 'Accessories', '中文: and the accessories pill');
    await setLang(page, 'en');
  }


  // ══ 9 · THE COMPANIES PAGE ═════════════════════════════════════════════
  /* Almost all of this page is drawn from data, so almost none of it reached
     the attribute scan: the loading line, the status badges, the buttons under
     every quotation, the card meta, the detail panel. */
  {
    const cp = await openCompanies(browser, { lang: 'zh' });
    await cp.waitForTimeout(700);
    const zh = await visibleText(cp);

    for (const gone of [
      'Loading recent quotations', 'Active', 'No Quotes', 'Has Remarks',
      'Saved quotes:', 'Latest:', 'Reference Total', 'View Quotation',
      'Load More Quotations', 'No more quotations', 'Last Updated',
      'Latest Product', 'Contact', 'No phone on file', 'Saved Quotations',
    ]) {
      A.excludes(zh, gone, `中文 Companies: "${gone}" is translated`);
    }
    A.excludes(zh, '📂 Load', '中文 Companies: the Load button is translated');
    A.excludes(zh, '📄 Duplicate', '中文 Companies: and Duplicate');
    A.excludes(zh, '🗑️ Delete', '中文 Companies: and Delete');
    A.ok(/[一-鿿]/.test(zh), '中文 Companies: the page is in Chinese');
    A.ok(!cp._dcErrors.length, 'no script error on the Companies page: ' + cp._dcErrors.join(' | '));
    await cp.close();

    /* And the same page in English still reads English. */
    const cpEn = await openCompanies(browser, { lang: 'en' });
    await cpEn.waitForTimeout(700);
    const en = await visibleText(cpEn);
    A.includes(en, 'Total Companies', 'English Companies: the cards are named in English');
    A.includes(en, 'Reference Total', 'English Companies: and so is the quotation total');
    A.excludes(en, '参考总额', 'English Companies: and not also in Chinese');
    await cpEn.close();
  }

  A.ok(!page._dcErrors.length, 'no script error while switching language: ' + page._dcErrors.join(' | '));
  await page.close();
  return S;
};
