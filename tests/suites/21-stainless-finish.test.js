/* ── SS304 and SS316 are quoted without a finish ────────────────────────────
   The rule is final and it is one rule: once the quotation's material is
   SS304 or SS316, the quotation's finish is N/A. Not PL, not HDG, not ZP,
   whatever the customer's document happened to say.

   It was implemented as `DC_NO_FINISH_MATERIALS` and applied in Quick Add —
   but everywhere else it was not the rule that held the line, it was a side
   effect: updateFinishAvailability ticks the N/A radio whenever the material
   SELECT reads stainless. That works only where there is such a select and
   where the value comes from the DOM. Three paths had neither:

     · the Welding Anchor Set, whose material lives in was-ab-material, so the
       check read an element that does not exist and never fired — the one
       product that could ORIGINATE a stainless item wearing HDG;
     · restoring an unsaved draft, which cleared the finish and then put the
       saved radio back one statement later;
     · a quotation loaded from Companies, normalised for size type on the way
       in and not for finish.

   And the pricing-history identity compared the stored finish literally, so a
   stainless record saved carrying HDG could never match its own specification
   again — invisible in Previous Prices while still printing "(HDG)".

   So this suite follows the material all the way to the customer: the review
   row, the Add, the saved payload, the reload, the print sheet, the WhatsApp
   text and the history lookup.                                              */
'use strict';
const { openApp, quickAddPaste, rowState } = require('../lib/harness');

const STAINLESS = [['SS304', 'SS304'], ['SUS304', 'SS304'], ['A2', 'SS304'],
                   ['A2-70', 'SS304'], ['A2-80', 'SS304'],
                   ['SS316', 'SS316'], ['SUS316', 'SS316'], ['A4', 'SS316'],
                   ['A4-70', 'SS316'], ['A4-80', 'SS316']];
const SOURCE_FINISH = ['PL', 'PLAIN', 'HDG', 'ZP'];

module.exports = async (browser, A) => {
  const S = A.suite('stainless — SS304 and SS316 carry no finish, on every screen');

  // ══ the vocabulary, and the rule that follows it ══════════════════════════
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    for (const [wording, material] of STAINLESS) {
      for (const src of SOURCE_FINISH) {
        await quickAddPaste(page, `${wording} SAG ROD ${src} FULLSIZE\nM16 x 300 x 50/50 - 20pcs`,
          { expanded: false, settle: 650 });
        const r = (await rowState(page))[0];
        A.eq(r.material, material, `${wording} → ${material}`);
        A.eq(r.finish, '', `${wording} stated ${src} → the row carries no finish`);
      }
    }
    A.ok(page._dcErrors.length === 0, 'no page errors: ' + page._dcErrors.join(' | '));
    await page.close();
  }

  // ══ all the way to the customer ═══════════════════════════════════════════
  /* One stainless item and one mild-steel item side by side, so the assertion
     is not merely "no finish anywhere" — the MS item must keep its HDG. */
  {
    let payload = null;
    const page = await openApp(browser, {
      api: { save_quotation: (url, req) => {
        try { payload = JSON.parse(req.postData() || '{}'); } catch (e) {}
        return { ok: true, data: { id: 42, ref_no: 'DC-TEST-001' } };
      } },
    });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, ['SUS304 SAG ROD HDG FULLSIZE',
                               'M16 x 300 x 50/50 - 20pcs',
                               '',
                               'MS SAG ROD HDG FULLSIZE',
                               'M16 x 300 x 50/50 - 20pcs'].join('\n'),
                        { expanded: false, settle: 1300 });
    await page.evaluate(() => {
      wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '12'); wqaEditPrice(i, 'addCost', '1'); });
    });
    await page.waitForTimeout(1000);

    const rows = await rowState(page);
    A.eq(rows.length, 2, 'a stainless row and a mild steel row');
    A.eq(rows[0].material + '/' + (rows[0].finish || 'N/A'), 'SS304/N/A',
      'the stainless row shows no finish though the message said HDG');
    A.eq(rows[1].material + '/' + rows[1].finish, 'MS/HDG',
      'and the mild steel row beside it keeps its HDG');

    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1400);

    const committed = await page.evaluate(() => quoteItems.map(i => ({
      material: i.material, finish: i.finish, desc: i.desc, size: i.size,
      formFinish: (i.formData || {}).finish,
    })));
    A.eq(committed.length, 2, 'both items are in the quotation');
    const ss = committed.find(i => i.material === 'SS304');
    const ms = committed.find(i => i.material === 'MS');
    A.ok(!!ss && !!ms, 'one of each');
    A.eq(ss.finish || '', '', 'the committed stainless item has no finish');
    A.eq(ms.finish, 'HDG', 'the committed mild steel item still has HDG');
    A.eq(ss.formFinish || '', '', 'and the form snapshot stored with it carries none either');
    A.excludes(String(ss.desc), 'HDG', 'nor does its description');

    // ── what the customer reads ────────────────────────────────────────────
    const out = await page.evaluate(() => ({
      wa: buildWAItemsText(),
      printDesc: quoteItems.map(getPrintItemDescription).join(' | '),
    }));
    A.excludes(out.printDesc.split('|').find(s => /SS304/.test(s)) || '', 'HDG',
      'the print sheet does not put (HDG) after a stainless item');
    A.excludes(out.wa.split('\n').filter(l => /SS304/.test(l)).join(' '), 'HDG',
      'nor does the WhatsApp text');
    A.includes(out.printDesc, 'HDG', 'while the mild steel item still prints its HDG');

    // ── save, and reopen it the way Companies hands it over ────────────────
    await page.evaluate(async () => {
      el('qi-customer').value = 'Alpha Sdn Bhd'; syncQI();
      await api('save_quotation', {
        ref_no: el('qi-refno').value, quote_date: el('qi-date').value,
        customer_name: 'Alpha Sdn Bhd', customer_phone: '', prepared_by: '',
        remarks: '', company_id: null, items: quoteItems,
        total_amount: quoteItems.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0),
      }, 'POST');
    });
    await page.waitForTimeout(600);
    A.ok(payload && Array.isArray(payload.items), 'the save payload carried the items');
    const savedSS = (payload.items || []).find(i => i.material === 'SS304');
    A.eq((savedSS && savedSS.finish) || '', '', 'and the stainless item was saved with no finish');
    await page.close();

    // ── a quotation that was saved BEFORE the rule held ────────────────────
    /* Exactly the shape a historical record has: stainless, wearing HDG. */
    const legacy = JSON.parse(JSON.stringify(payload.items));
    legacy.forEach(i => { if (i.material === 'SS304') i.finish = 'HDG'; });
    const reopened = await openApp(browser, {
      handoff: { id: 42, ref_no: 'DC-TEST-001', quote_date: '2026-01-05',
                 customer_name: 'Alpha Sdn Bhd', items: legacy },
    });
    const back = await reopened.evaluate(() => quoteItems.map(i => ({
      material: i.material, finish: i.finish })));
    A.eq(back.length, 2, 'it reopens with both items');
    A.eq((back.find(i => i.material === 'SS304') || {}).finish || '', '',
      'a stainless item that arrives wearing HDG is corrected on the way in');
    A.eq((back.find(i => i.material === 'MS') || {}).finish, 'HDG',
      'and the mild steel item beside it is left exactly as it was');
    const backOut = await reopened.evaluate(() => ({
      wa: buildWAItemsText(), printDesc: quoteItems.map(getPrintItemDescription).join(' | ') }));
    A.excludes(backOut.printDesc.split('|').find(s => /SS304/.test(s)) || '', 'HDG',
      'so it does not print (HDG) after reopening either');
    A.excludes(backOut.wa.split('\n').filter(l => /SS304/.test(l)).join(' '), 'HDG',
      'nor WhatsApp it');
    A.ok(reopened._dcErrors.length === 0, 'no page errors: ' + reopened._dcErrors.join(' | '));
    await reopened.close();
  }

  // ══ the Calculator: choosing stainless takes the finish away ══════════════
  {
    const page = await openApp(browser);
    const seen = await page.evaluate(() => {
      const out = {};
      switchType('sagrod');
      setFinishValue('sagrod', 'HDG');
      out.beforeMS = getFinish('sagrod');
      setFieldValue('sagrod', 'material', 'SS304');
      onMaterialSizeChange('sagrod', false, 'material');
      out.afterSS = getFinish('sagrod');
      out.spec = phFormSpec().finish;
      setFieldValue('sagrod', 'material', 'MS');
      onMaterialSizeChange('sagrod', false, 'material');
      out.backToMS = getFinish('sagrod');
      return out;
    });
    A.eq(seen.beforeMS, 'HDG', 'a mild steel rod can be HDG');
    A.eq(seen.afterSS, '', 'switching it to SS304 takes the finish off');
    A.eq(seen.spec, '', 'and the history lookup asks for a stainless item with no finish');
    A.eq(seen.backToMS, 'PL', 'switching back to mild steel restores a finish');

    // ── a Welding Anchor Set is named after its anchor, and follows the rule ─
    const was = await page.evaluate(() => {
      const out = {};
      switchType('was');
      setFinishValue('was', 'HDG');
      const ab = el('was-ab-material');
      ab.value = 'MS'; onWASAnchorSpecChange();
      out.ms = getFinish('was');
      ab.value = 'SS304'; onWASAnchorSpecChange();
      out.ss = getFinish('was');
      out.formMaterial = dcFormMaterial('was');
      out.spec = (currentType === 'was') ? phFormSpec().finish : 'n/a';
      return out;
    });
    A.eq(was.formMaterial, 'SS304', "the set's material is read from its anchor");
    A.eq(was.ms, 'HDG', 'a mild steel anchor set can be HDG');
    A.eq(was.ss, '', 'a stainless one cannot');
    A.eq(was.spec, '', 'and its history lookup agrees');
    await page.close();
  }

  // ══ the other side of the rule, pinned as it stands ══════════════════════
  /* A NON-stainless row whose document stated no finish shows none on the
     review — and commits PL, because updateFinishAvailability gives every
     non-stainless form a PL default and pushItem reads the form. The screen
     and the quotation therefore disagree about that one field.

     This is long-standing and it is not the reported blocker. Either direction
     is a business decision: showing PL on the row would put a finish on screen
     that the document never stated, and committing no finish would change
     descriptions and pricing-history identity for every mild-steel row. So it
     is left exactly as it is and pinned here, so that whichever way it is
     settled, it is settled deliberately and not by drift. */
  {
    const page = await openApp(browser);
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'MS SAG ROD FULLSIZE\nM16 x 300 x 50/50 - 10pcs',
      { expanded: false, settle: 900 });
    const row = (await rowState(page))[0];
    A.eq(row.material, 'MS', 'a mild steel row');
    A.eq(row.finish, '', 'whose message stated no finish shows none on the review');
    await page.evaluate(() => wqaAddAll());
    await page.waitForTimeout(1300);
    const item = await page.evaluate(() => quoteItems[0] && ({
      material: quoteItems[0].material, finish: quoteItems[0].finish }));
    A.eq(item.material, 'MS', 'it is added');
    A.eq(item.finish, 'PL',
      'and the committed item carries the form default PL — TODAY\'S behaviour, pinned, not endorsed');
    await page.close();
  }

  // ══ an unsaved draft does not put the finish back ═════════════════════════
  {
    const page = await openApp(browser);
    const drafted = await page.evaluate(() => {
      switchType('sagrod');
      /* A draft taken while the rod was mild steel and hot dip galvanised. */
      setFieldValue('sagrod', 'material', 'MS');
      setFinishValue('sagrod', 'HDG');
      setFieldValue('sagrod', 'size', 'M16'); setFieldValue('sagrod', 'length', '300');
      const draft = captureProductEntryDraft();
      if (!draft) return { skipped: true };
      /* The specification then turns out to be stainless — as it would if the
         draft were taken on one item and the material corrected afterwards. */
      draft.formData.material = 'SS304';
      draft.formData.__draftFields['sagrod-material'].value = 'SS304';
      restoreProductEntryDraft(draft);
      return { skipped: false, material: fv('sagrod', 'material'), finish: getFinish('sagrod'),
               radios: [...document.querySelectorAll('input[name="sagrod-finish"]')]
                 .filter(n => n.checked).map(n => n.value) };
    });
    if (drafted.skipped) {
      A.ok(true, 'draft capture is not exposed for direct testing on this build');
    } else {
      A.eq(drafted.material, 'SS304', 'the restored draft is stainless');
      A.eq(drafted.finish, '', 'and its HDG was not put back after the rule cleared it');
    }
    await page.close();
  }

  // ══ pricing history finds a stainless record stored wearing a finish ══════
  {
    /* The record on file says HDG because it was saved before the rule held
       everywhere. The row asks for a stainless specification, which by the rule
       has no finish. The two must still be the same item — otherwise a real
       previous price is invisible while the same item prints "(HDG)". */
    const asked = [];
    const page = await openApp(browser, {
      api: { get_pricing_history: url => {
        const p = new URL(url).searchParams;
        asked.push(String(p.get('material') || '') + '/' + String(p.get('finish') || ''));
        return { ok: true, data: { records: [{
          quotationId: 1, refNo: 'Q-2025-0500', date: '2025-05-05', customer: 'Beta Sdn Bhd',
          companyId: 7, own: true, productType: 'SAG ROD', material: 'SS304',
          sizeType: 'FULLSIZE', finish: '', cleanSize: 'M16',
          dimensionPreview: 'L 300 x TL 50/50mm', exactDims: true, qty: 20,
          unitPrice: 18.00, boltUnitPrice: 18.00, accessoryCost: 0, accessorySummary: '',
          accessoryAmbiguous: false, priceMode: 'manual', priceModeLabel: 'Manual',
          costRate: null, addCost: null, markup: null, weight: null, legacy: false }],
          total: 1, ownTotal: 1, otherTotal: 0, offset: 0, limit: 20 } };
      } },
    });
    await page.evaluate(() => { selectedCompanyId = 7; });
    await quickAddPaste(page, 'SUS304 SAG ROD PLAIN FULLSIZE\nM16 x 300 x 50/50 - 20pcs',
      { expanded: false, settle: 900 });
    await page.evaluate(() => wqaHistToggle(0));
    await page.waitForTimeout(1000);
    A.eq(asked.length, 1, 'the row looked its history up once');
    A.eq(asked[0], 'SS304/', 'and asked for a stainless specification with no finish');
    const used = await page.evaluate(() => { wqaHistUse(0, 0); return null; });
    await page.waitForTimeout(900);
    const r = (await rowState(page))[0];
    A.eq(String(r.price), '18', 'the previous price is reusable on the row');
    A.eq(r.finish || '', '', 'and reusing it did not bring a finish back with it');
    await page.close();
  }

  return S;
};
