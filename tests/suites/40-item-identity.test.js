/* ── Item identity, from the page's side ───────────────────────────────────
   The server owns item_uid. This suite measures the three things the BROWSER
   has to get right for that to mean anything:

     · it never mints one — a new row leaves with no identity, and asks;
     · it never loses one — editing a row through the real add/edit path
       replaces the object, and the identity has to survive that;
     · it adopts what the server answers, so a SECOND save from the same page
       is an edit and not three brand-new items.

   Everything below drives the shipped paths: Quick Add commits through
   wqaAddAll, an edit goes through editItem() and the real add function, and a
   save goes through openSaveModal() + doSaveQuotation(). The api.php answers
   are stubbed, so what is asserted is what the page WOULD send and what it
   does with the reply.                                                       */
'use strict';
const { openApp, quickAddPaste } = require('../lib/harness');

const U = n => 'itm_' + String(n).repeat(32).slice(0, 32);

module.exports = async (browser, A) => {
  A.suite('item identity — the page carries a uid it cannot mint');

  let savePayload = null, updatePayload = null;
  const page = await openApp(browser, {
    api: {
      save_quotation: (url, req) => {
        try { savePayload = JSON.parse(req.postData() || 'null'); } catch (e) { savePayload = null; }
        /* What api.php does: mint one per item, answer with the persisted array. */
        const items = (savePayload && savePayload.items || []).map((it, i) =>
          Object.assign({}, it, { item_uid: U(i + 1) }));
        return { ok: true, id: 77, ref_no: 'DC-TEST-001', items };
      },
      update_quotation: (url, req) => {
        try { updatePayload = JSON.parse(req.postData() || 'null'); } catch (e) { updatePayload = null; }
        const seen = [];
        const items = (updatePayload && updatePayload.items || []).map((it, i) => {
          const uid = (typeof it.item_uid === 'string' && it.item_uid) ? it.item_uid : U(9);
          seen.push(uid);
          return Object.assign({}, it, { item_uid: uid });
        });
        return { ok: true, items };
      },
    },
  });

  const uids = () => page.evaluate(() => quoteItems.map(i => i.item_uid === undefined ? null : i.item_uid));
  const descs = () => page.evaluate(() => quoteItems.map(i => i.desc));

  const save = async () => {
    await page.evaluate(async () => { await openSaveModal(); });
    await page.waitForTimeout(200);
    await page.evaluate(async () => { await doSaveQuotation(); });
    await page.waitForTimeout(900);
  };

  // ── two items, committed through the real Quick Add path ─────────────────
  await quickAddPaste(page, [
    'MS SAG ROD PL FULLSIZE',
    'M20 x 1000 x 100/100 - 4pcs',
    '',
    'MS ANCHOR BOLT HDG FULLSIZE',
    'M16 x 300 x 100 - 6pcs',
  ].join('\n'), { settle: 900 });
  await page.evaluate(() => { wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '5'); wqaEditPrice(i, 'addCost', '1'); }); });
  await page.waitForTimeout(700);
  await page.evaluate(() => wqaAddAll());
  await page.waitForTimeout(1000);

  A.eq((await descs()).length, 2, 'two items reached the quotation');
  A.eq(JSON.stringify(await uids()), JSON.stringify([null, null]),
    'a brand-new item leaves the page with NO identity — the browser does not mint one');

  // ── save: the server issues identity, and the page adopts it ─────────────
  await page.evaluate(() => { document.getElementById('qi-customer').value = 'Alpha Sdn Bhd'; syncQI(); });
  await save();

  A.ok(savePayload && Array.isArray(savePayload.items), 'the create payload carried the items');
  A.ok(savePayload.items.every(i => i.item_uid === undefined || i.item_uid === null || i.item_uid === ''),
    'and none of them claimed an identity');
  A.eq(JSON.stringify(await uids()), JSON.stringify([U(1), U(2)]),
    'after the answer, the page holds exactly the uids the server issued');

  // ── edit an item through the real edit path — identity survives ──────────
  const edited = await page.evaluate(() => {
    unlockSavedQuotation();
    editItem(0);
    const t = resolveItemType(quoteItems[0]);
    document.getElementById(t + '-qty').value = '9';
    ({ sagrod: addSagRod, stud: addStud, anchorbolt: addAnchorBolt, ubolt: addUBolt,
       squbolt: addSQUBolt, lbolt: addLBolt, jbolt: addJBolt })[t]();
    return { count: quoteItems.length, qty: quoteItems[0].qty };
  });
  await page.waitForTimeout(400);
  A.eq(edited.count, 2, 'editing an item did not add a second copy of it');
  A.eq(edited.qty, 9, 'the edit landed');
  A.eq(JSON.stringify(await uids()), JSON.stringify([U(1), U(2)]),
    'and the edited row kept its identity — a rebuilt object is still the same row');

  // ── add a third item: it has no identity until the server gives it one ───
  await quickAddPaste(page, ['MS STUD PL FULLSIZE', 'M12 x 200 - 2pcs'].join('\n'), { settle: 900 });
  await page.evaluate(() => { wqa.rows.forEach((r, i) => { wqaEditPrice(i, 'costRate', '5'); wqaEditPrice(i, 'addCost', '1'); }); });
  await page.waitForTimeout(700);
  await page.evaluate(() => wqaAddAll());
  await page.waitForTimeout(1000);
  const three = await uids();
  A.eq(three.length, 3, 'three items now');
  A.eq(JSON.stringify(three.slice(0, 2)), JSON.stringify([U(1), U(2)]), 'the two saved ones keep theirs');
  A.ok(three[2] === null || three[2] === undefined || three[2] === '', 'the new one has none');

  // ── reorder: identity travels with the item, not with the slot ───────────
  await page.evaluate(() => { const m = quoteItems.splice(0, 1)[0]; quoteItems.push(m); renderQuote(); });
  await page.waitForTimeout(300);
  const afterMove = await page.evaluate(() => quoteItems.map(i => ({ d: i.desc, u: i.item_uid || null })));
  A.eq(afterMove[2].u, U(1), 'the moved item took its uid to the end with it');
  A.eq(afterMove[0].u, U(2), 'and the one that moved up kept its own');

  // ── save again, WITHOUT reloading the page ───────────────────────────────
  await save();
  A.ok(updatePayload && Array.isArray(updatePayload.items), 'the second save went to update_quotation');
  const sent = updatePayload.items.map(i => (typeof i.item_uid === 'string' && i.item_uid) ? i.item_uid : null);
  A.eq(sent.length, 3, 'all three items were sent');
  A.eq(sent[0], U(2), 'the reordered items carried their identities in their new positions');
  A.eq(sent[2], U(1), 'both of them');
  A.ok(sent[1] === null, 'and the item added after the first save still asks for one');
  A.eq(new Set(sent.filter(Boolean)).size, 2, 'no uid was sent twice');

  // ── delete: the identity goes with the row ───────────────────────────────
  const doomed = (await uids())[0];
  await page.evaluate(() => { unlockSavedQuotation(); removeItem(0); });
  await page.waitForTimeout(300);
  await save();
  const afterDelete = updatePayload.items.map(i => i.item_uid || null);
  A.eq(afterDelete.length, 2, 'two items are sent after the delete');
  A.ok(!afterDelete.includes(doomed), 'the deleted row\'s uid is not in the payload at all');

  // ── the helpers themselves ───────────────────────────────────────────────
  const helpers = await page.evaluate(() => {
    const stripped = dcStripItemUid({ desc: 'X', item_uid: 'itm_00000000000000000000000000000000' });
    const carriedTo = dcCarryItemUid({ item_uid: 'itm_00000000000000000000000000000000' }, { desc: 'Y' });
    const carriedNone = dcCarryItemUid({}, { desc: 'Z' });
    const before = quoteItems.map(i => i.item_uid);
    const mismatch = dcAdoptServerItems([{ item_uid: 'itm_ffffffffffffffffffffffffffffffff' }]);
    const notArray = dcAdoptServerItems(undefined);
    const after = quoteItems.map(i => i.item_uid);
    return {
      stripHasUid: 'item_uid' in stripped, stripKeptDesc: stripped.desc,
      carried: carriedTo.item_uid, carriedNone: 'item_uid' in carriedNone,
      mismatch, notArray, unchanged: JSON.stringify(before) === JSON.stringify(after),
    };
  });
  A.ok(helpers.stripHasUid === false, 'dcStripItemUid removes the key outright — a copy is a different item');
  A.eq(helpers.stripKeptDesc, 'X', 'and changes nothing else');
  A.eq(helpers.carried, 'itm_00000000000000000000000000000000', 'dcCarryItemUid moves identity across a replacement');
  A.ok(helpers.carriedNone === false, 'and invents nothing when there was none');
  A.ok(helpers.mismatch === false, 'an answer of the wrong length is not adopted');
  A.ok(helpers.notArray === false, 'and neither is a missing one');
  A.ok(helpers.unchanged, 'a refused answer leaves every held identity alone');

  A.ok((page._dcErrors || []).length === 0,
    'no page error was thrown: ' + JSON.stringify((page._dcErrors || []).slice(0, 3)));
  await page.close();
};
