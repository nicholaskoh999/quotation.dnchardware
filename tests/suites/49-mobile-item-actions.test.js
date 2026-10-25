/* ── QUO mobile item actions — hotfix on R2A (2026-10-25) ────────────────────
   The phone's bottom bar must always carry the item action that matches what
   the person is doing:

     editing an item      → Update Item · Save · More   (never Print / WhatsApp)
     entering a new item  → Add Item · Save · More
     saved and unchanged  → Print · WhatsApp · More     (never Add / Update)

   Priority: editing > entering > saved-and-unchanged > in progress > browsing.
   The first button is the one existing #mbAddBtn -> addCurrentItem(), which
   updates when an item is being edited. Duplicate makes a NEW row with no
   identity, opens it through editItem(), and leaves the source untouched.    */
'use strict';
const { openApp, quickAddPaste, typeInto } = require('../lib/harness');

const COMPANY = { id: 7, name: 'ADVANCE ENGINEERING', short_code: 'ADV', phone: '012-3456789' };
const MSG = 'MS SAG ROD HDG UNDERSIZE\nM16 x 1200 x 30/30 - 5pcs';
const ENTRY = '.item-form.active input:not([type=hidden]):not([type=checkbox]):not([type=radio])';

const bar = page => page.evaluate(() => {
  const vis = n => {
    if (!n) return false;
    const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' && r.width > 0 && r.height > 0;
  };
  const q = s => document.querySelector(s);
  const label = q('#mbAddBtn .mb-add-ph');
  return {
    state: document.documentElement.getAttribute('data-rsp-bottom'),
    item: document.documentElement.getAttribute('data-rsp-item'),
    nav: vis(q('#rspNav')), bar: vis(q('.mobile-bar')),
    add: vis(q('#mbAddBtn')), addText: label ? label.textContent.trim() : '',
    save: vis(q('#mobileSaveBtn')), saveText: [...q('#mobileSaveBtn').children].filter(c => getComputedStyle(c).display !== 'none').map(c => c.textContent.trim()).join(''), totalClipped: q('#mbTotal').scrollWidth > q('#mbTotal').clientWidth + 1, barH: q('.mobile-bar').getBoundingClientRect().height, print: vis(q('#mbPrintBtn')), wa: vis(q('#mbWaBtn')), more: vis(q('#mbMoreBtn')),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    barOverflow: q('.mobile-bar').scrollWidth - q('.mobile-bar').clientWidth,
    onclick: q('#mbAddBtn').getAttribute('onclick'),
    items: quoteItems.map(i => ({ uid: i.item_uid || null, finish: i.finish, size: i.size, unit: i.finalUnitPrice, total: i.totalAmount, desc: i.desc })),
    rects: ['#mbAddBtn', '#mobileSaveBtn', '#mbPrintBtn', '#mbWaBtn', '#mbMoreBtn', '#mbTotal'].map(s => {
      const n = q(s); if (!vis(n)) return null; const r = n.getBoundingClientRect(); return { l: r.left, r: r.right };
    }),
  };
});
const settle = page => page.waitForTimeout(280);

module.exports = async (browser, A) => {
  A.suite('mobile item actions — Update Item / Add Item / Duplicate on the phone bar');

  for (const { w, h, langs } of [{ w: 390, h: 844, langs: ['en', 'zh'] }, { w: 430, h: 932, langs: ['en'] }]) {
    for (const lang of langs) {
      const zh = lang === 'zh', t = `${w} ${lang}`;
      const page = await openApp(browser, { api: { get_companies: { ok: true, data: [COMPANY] } }, viewport: { width: w, height: h } });
      await page.evaluate(l => dcSetLang(l), lang);
      await page.evaluate(c => { document.getElementById('qi-customer').value = c.name; selectedCompanyId = c.id; syncQI(); }, COMPANY);
      await quickAddPaste(page, MSG, { settle: 900 });
      await page.evaluate(() => wqaAddAll());
      await page.waitForTimeout(1100);
      let s = await bar(page);
      A.eq(s.items.length, 1, `${t}: one item to start from`);
      A.eq(s.items[0].finish, 'HDG', `${t}: the source item is HDG`);
      const source = JSON.stringify(s.items[0]);

      // CASE 1 · saved -> OUTPUT
      await page.evaluate(() => openSaveModal());
      await page.waitForTimeout(450);
      await page.evaluate(() => document.getElementById('saveModalSubmitBtn').click());
      await page.waitForTimeout(1600);
      await page.evaluate(() => closeModal('saveModal'));
      await settle(page);
      s = await bar(page);
      A.ok(s.state === 'output' && s.print && s.wa && s.more && !s.add && !s.save && !s.nav, `${t}: saved -> OUTPUT: Print / WhatsApp / More, no Add, no Update`);

      // CASE 2 · unlock, Edit the item -> EDIT ITEM
      await page.evaluate(() => unlockSavedQuotation());
      await settle(page);
      await page.click('.qi-edit-btn');
      await settle(page);
      s = await bar(page);
      A.eq(s.item, 'edit', `${t}: editing an item -> item state edit`);
      A.ok(s.bar && !s.nav && s.add && s.save && s.more && !s.print && !s.wa, `${t}: EDIT shows Update Item / Save / More, and Print / WhatsApp are gone`);
      A.eq(s.addText, zh ? '更新项目' : 'Update Item', `${t}: the first button reads ${zh ? '更新项目' : 'Update Item'}`);
      A.eq(s.onclick, 'addCurrentItem()', `${t}: it is the existing item handler (addCurrentItem updates while editing)`);
      A.eq(s.saveText, zh ? '更新报价' : 'Update Quotation', `${t}: the quotation-level button reads ${zh ? '更新报价' : 'Update Quotation'}, not a bare Update`);
      A.ok(!s.totalClipped && s.barH <= 76, `${t}: the total is not clipped and the bar stays compact (${s.barH.toFixed(0)}px)`);
      A.ok(s.overflow === 0 && s.barOverflow === 0 && s.rects.filter(Boolean).every(r => r.l >= 0 && r.r <= w + 0.5), `${t}: the edit bar fits`);

      // CASE 3 · HDG -> PL, tap Update Item
      await page.evaluate(() => document.getElementById('sagrod-pill-PL').scrollIntoView({ block: 'center' }));
      await page.click('#sagrod-pill-PL');
      await settle(page);
      await page.evaluate(() => document.getElementById('mbAddBtn').click());
      await settle(page);
      s = await bar(page);
      A.eq(s.items.length, 1, `${t}: updating keeps one item`);
      A.eq(s.items[0].finish, 'PL', `${t}: the edited item is now PL`);
      A.eq(s.items[0].uid, JSON.parse(source).uid, `${t}: and it is the same row (identity carried)`);
      A.ok(s.items[0].unit > 0 && s.items[0].total > 0, `${t}: priced by the normal recalculation (${s.items[0].unit})`);
      A.ok(s.item !== 'edit' && s.state === 'work', `${t}: after Update the bar leaves edit state`);

      // CASE 4 · Duplicate (give the source its identity first, as a save would)
      await page.evaluate(() => { quoteItems[0].item_uid = 'uid-source'; quoteItems[0].finish = 'HDG'; renderQuote(); });
      const before = JSON.stringify((await bar(page)).items[0]);
      const dupLabel = await page.evaluate(() => document.querySelector('.qi-dup-btn').textContent.trim());
      A.eq(dupLabel, zh ? '复制' : 'Duplicate', `${t}: the item card has ${zh ? '复制' : 'Duplicate'}`);
      await page.click('.qi-dup-btn');
      await settle(page);
      s = await bar(page);
      A.eq(s.items.length, 2, `${t}: Duplicate creates a second item`);
      A.eq(s.items[1].uid, null, `${t}: the copy has no identity of its own (fresh on save)`);
      A.ok(s.items[0].uid === 'uid-source' && JSON.stringify(s.items[0]) === before, `${t}: the source is unchanged`);
      A.eq(s.items[1].size, s.items[0].size, `${t}: the copy carries the same specification`);
      A.eq(s.item, 'edit', `${t}: the copy opens in edit, bar shows Update Item`);
      A.ok(s.add && !s.print && !s.wa && s.addText === (zh ? '更新项目' : 'Update Item'), `${t}: Update Item is reachable for the copy`);

      // HDG -> PL on the copy
      await page.evaluate(() => document.getElementById('sagrod-pill-PL').scrollIntoView({ block: 'center' }));
      await page.click('#sagrod-pill-PL');
      await settle(page);
      await page.evaluate(() => document.getElementById('mbAddBtn').click());
      await settle(page);
      s = await bar(page);
      A.eq(s.items.length, 2, `${t}: still two items after Update`);
      A.eq(s.items[0].finish, 'HDG', `${t}: item 1 is still HDG`);
      A.eq(s.items[1].finish, 'PL', `${t}: item 2 is PL`);
      A.eq(JSON.stringify(s.items[0]), before, `${t}: the HDG source is byte-for-byte unchanged by editing the copy`);
      A.eq(s.items[1].uid, null, `${t}: the PL item still has no copied identity`);

      // duplicate refuses while another item is open for edit
      await page.click('.qi-edit-btn');
      await settle(page);
      await page.evaluate(() => duplicateItem(0));
      s = await bar(page);
      A.eq(s.items.length, 2, `${t}: Duplicate does nothing while an item is being edited`);
      await page.evaluate(() => cancelItemEdit());

      // CASE 5 · a brand-new item -> NEW ITEM (Add Item)
      await page.evaluate(() => { startNewQuotation(); });
      await page.waitForTimeout(300);
      await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); });
      await page.type(ENTRY, '16');
      await page.$eval(ENTRY, e => e.blur());
      await settle(page);
      s = await bar(page);
      A.eq(s.item, 'new', `${t}: composing a new item -> item state new`);
      A.ok(s.bar && !s.nav && s.add && s.save && s.more && !s.print && !s.wa, `${t}: NEW shows Add Item / Save / More`);
      A.eq(s.addText, zh ? '＋ 添加项目' : '＋ Add Item', `${t}: the first button reads ${zh ? '添加项目' : 'Add Item'}`);
      A.eq(s.saveText, zh ? '保存报价' : 'Save Quotation', `${t}: a new quotation's button reads ${zh ? '保存报价' : 'Save Quotation'}`);
      A.ok(!s.totalClipped && s.overflow === 0 && s.barOverflow === 0, `${t}: new-item bar fits, nothing clipped`);
      A.eq(s.onclick, 'addCurrentItem()', `${t}: the existing item handler`);

      // CASE 6 · save again -> OUTPUT (rebuild a saved quotation)
      await page.evaluate(c => { document.getElementById('qi-customer').value = c.name; selectedCompanyId = c.id; syncQI(); }, COMPANY);
      await quickAddPaste(page, MSG, { settle: 900 });
      await page.evaluate(() => wqaAddAll());
      await page.waitForTimeout(1100);
      await page.evaluate(() => openSaveModal());
      await page.waitForTimeout(450);
      await page.evaluate(() => document.getElementById('saveModalSubmitBtn').click());
      await page.waitForTimeout(1600);
      await page.evaluate(() => closeModal('saveModal'));
      await settle(page);
      s = await bar(page);
      A.eq(s.state, 'output', `${t}: saved and unchanged -> OUTPUT again`);
      A.ok(s.print && s.wa && !s.add && !s.save, `${t}: Print / WhatsApp, no Add`);
      A.eq(page._dcErrors.length, 0, `${t}: no script errors (${page._dcErrors.join(' | ')})`);
      await page.close();
    }
  }

  // The owner's own flow: type an item into the form, tap Add Item on the bar, Save, and
  // the bar must reach OUTPUT (an Add must consume the entry; the touched set alone never empties).
  {
    const page = await openApp(browser, { api: { get_companies: { ok: true, data: [COMPANY] } }, viewport: { width: 390, height: 844 } });
    await page.evaluate(c => { document.getElementById('qi-customer').value = c.name; selectedCompanyId = c.id; syncQI(); }, COMPANY);
    for (const [id, v] of [['sagrod-size', 'M16'], ['sagrod-length', '1200'], ['sagrod-threadLen', '30'], ['sagrod-qty', '5']]) {
      await page.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
      await typeInto(page, '#' + id, v);
    }
    await settle(page);
    let s = await bar(page);
    A.eq(s.item, 'new', 'form flow: typing the item -> item state new');
    A.ok(s.add && s.addText === '＋ Add Item' && !s.print, 'form flow: the bar offers Add Item');
    await page.evaluate(() => document.getElementById('mbAddBtn').click());
    await settle(page);
    s = await bar(page);
    A.eq(s.items.length, 1, 'form flow: Add Item added the item through the existing handler');
    A.eq(s.item, 'none', 'form flow: the Add consumed the entry');
    await page.evaluate(() => openSaveModal());
    await page.waitForTimeout(450);
    await page.evaluate(() => document.getElementById('saveModalSubmitBtn').click());
    await page.waitForTimeout(1600);
    await page.evaluate(() => closeModal('saveModal'));
    await settle(page);
    s = await bar(page);
    A.eq(s.state, 'output', 'form flow: after the form Add and a Save the bar reaches OUTPUT');
    A.ok(s.print && s.wa && !s.add && !s.save, 'form flow: Print / WhatsApp, no Add');
    await page.close();
  }

  // Tablet and desktop: the Duplicate action shares the card; the bar is R1's
  for (const w of [820, 1024]) {
    const page = await openApp(browser, { viewport: { width: w, height: 900 } });
    await quickAddPaste(page, MSG, { settle: 900 });
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1100);
    const r = await page.evaluate(() => {
      const b = document.querySelector('.mobile-bar'), cs = getComputedStyle(b);
      return { dup: !!document.querySelector('.qi-dup-btn'), display: cs.display, grid: cs.gridTemplateColumns,
        more: getComputedStyle(document.getElementById('mbMoreBtn')).display,
        ph: getComputedStyle(document.querySelector('.mb-add-ph')).display,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    A.ok(r.dup, `${w}: the item card has Duplicate`);
    A.eq(r.more, 'none', `${w}: no More button`);
    A.eq(r.ph, 'none', `${w}: the phone-only Add Item label stays off`);
    A.eq(w < 1024 ? r.display + '/' + r.grid : r.display, w < 1024 ? 'flex/none' : 'none', `${w}: the sticky bar is as R1`);
    A.ok(r.overflow <= 0, `${w}: no sideways scroll`);
    await page.close();
  }
};
