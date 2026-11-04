/* ── R2.2 Session B — Smart Pull-to-Refresh ─────────────────────────────────
   The installed app gets a pull-to-refresh that never loses work:
     clean page          → fresh data, no app reload, Updated
     unsaved quotation   → blocked, inputs kept         (any dirty signal)
     Quick Add open      → blocked     AI reading → blocked
     edit to a saved one → blocked     a window open → blocked
     refresh error       → page unchanged, Retry
     two pulls at once   → one refresh
     not at the top / sideways / short / two fingers / inside a modal, table,
     scroll box or field → not a pull at all (normal gestures untouched)
     guard missing or throwing → blocked (fail closed)
     browser tab (not installed) → off, the browser's own refresh stays.
   Touches are dispatched to the page's own listeners (Chromium here has no
   iOS standalone); dcPtr.state.force stands in for display-mode standalone. */
'use strict';
const { openApp, openCompanies } = require('../lib/harness');

const PHONE = { width: 390, height: 844 };

/* one gesture through the real touch listeners; returns whether the page took it */
const PULL = `window.__pull = function(sel, dy, dx, opts){
  opts = opts || {};
  const target = typeof sel === 'string' ? document.querySelector(sel) : sel;
  const fire = (type, x, y, n) => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    const t = []; for (let i = 0; i < (n || 1); i++) t.push({ clientX: x + i * 30, clientY: y, target });
    Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : t });
    target.dispatchEvent(e); return e;
  };
  fire('touchstart', 150, 150, opts.fingers);
  let prevented = false;
  for (let i = 1; i <= 12; i++) { const e = fire('touchmove', 150 + (dx || 0) * i / 12, 150 + dy * i / 12, opts.fingers); prevented = prevented || e.defaultPrevented; }
  fire('touchend', 150 + (dx || 0), 150 + dy);
  return prevented;
};`;

function counter(page) {
  const seen = [];
  page.on('request', r => { const m = /[?&]action=([a-z_]+)/.exec(r.url()); if (m) seen.push(m[1]); });
  return seen;
}
const ptrText = page => page.evaluate(() => { const n = document.getElementById('dcPtr'); return n && n.classList.contains('is-on') ? n.querySelector('.dc-ptr-msg').textContent : ''; });
const settle = page => page.waitForTimeout(350);

module.exports = async function (browser, A) {
  A.suite('64 R2.2 Session B: smart pull-to-refresh');

  /* ── Quotation page ── */
  let companies = [{ id: 1, name: 'Alpha Steel' }];
  let dpOk = true;
  const api = {
    get_companies: () => ({ ok: true, data: companies }),
    get_default_prices: () => dpOk ? { ok: true, data: [] } : { ok: false, error: 'db down' },
  };
  let page = await openApp(browser, { viewport: PHONE, api });
  await page.evaluate(PULL);
  await page.evaluate(() => { window.__noReload = 'still-here'; });
  let seen = counter(page);

  /* browser tab: off */
  A.eq(await page.evaluate(() => dcPtr.enabled()), false, 'browser tab (not installed): pull-to-refresh is off');
  await page.evaluate(() => __pull('#stepper', 300));
  await settle(page);
  A.eq(seen.length, 0, 'browser tab: a pull fetches nothing (the browser keeps its own refresh)');

  await page.evaluate(() => { dcPtr.state.force = true; });
  A.eq(await page.evaluate(() => window.dcPtrGuard()), '', 'clean page: guard allows');

  /* clean page: one refresh, the three reference reads, no reload */
  companies = [{ id: 1, name: 'Alpha Steel' }, { id: 2, name: 'Beta Metal' }];
  const took = await page.evaluate(() => __pull('#stepper', 300));
  A.ok(took, 'clean page: the pull is taken (default prevented, no rubber band)');
  await settle(page);
  A.eq(seen.slice().sort(), ['get_companies', 'get_default_prices', 'get_diameter_settings'], `clean page: refresh reads companies, Default Prices, Diameter Settings once each (${seen.join(',')})`);
  A.eq(await page.evaluate(() => companiesCache.map(c => c.name)), ['Alpha Steel', 'Beta Metal'], 'clean page: new company is there for the customer box');
  A.eq(await page.evaluate(() => window.__noReload), 'still-here', 'clean page: the app was not reloaded');
  A.includes(await ptrText(page), 'Up to date', 'clean page: shows Up to date');

  /* not a pull: short, sideways, two fingers, scrolled, inside things */
  const none = async (label, fn) => {
    seen.length = 0;
    await page.evaluate(fn);
    await settle(page);
    A.eq(seen.length, 0, label);
  };
  await none('a short pull does not refresh', () => __pull('#stepper', 60));
  await none('a sideways drag does not refresh', () => __pull('#stepper', 40, 260));
  await none('two fingers do not refresh', () => __pull('#stepper', 300, 0, { fingers: 2 }));
  await none('an upward swipe does not refresh', () => __pull('#stepper', -300));
  await none('a pull starting in a field does not refresh', () => __pull('#qi-customer', 300));
  await none('a pull starting in the bottom bar does not refresh', () => __pull('#rspNav', 300));
  await none('a pull inside a table does not refresh', () => {
    const t = document.createElement('table'); t.innerHTML = '<tr><td id="__td">x</td></tr>'; document.querySelector('main').prepend(t);
    __pull('#__td', 300); t.remove();
  });
  await none('a pull inside a scroll box does not refresh', () => {
    const b = document.createElement('div'); b.style.cssText = 'height:60px;overflow-y:auto'; b.innerHTML = '<div id="__in" style="height:400px">x</div>';
    document.querySelector('main').prepend(b); __pull('#__in', 300); b.remove();
  });
  await none('a pull in the middle of the page does not refresh', () => { window.scrollTo({ top: 600, behavior: 'instant' }); __pull('#stepper', 300); });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await none('a pull inside a modal does not refresh', () => { openModal('dpModal'); __pull(document.querySelector('#dpModal .modal') || '#dpModal', 300); closeModal('dpModal'); });

  /* blocked states: nothing fetched, state kept, message says why */
  /* the pull itself (where one can start) and the release check (dcPtr.run,
     what a completed pull calls) both refuse; nothing is fetched */
  const blocked = async (label, setup, expect, undo) => {
    seen.length = 0;
    await page.evaluate(() => dcPtr.hide());
    const why = await page.evaluate(setup);
    await page.evaluate(() => __pull('#stepper', 300));
    const r = await page.evaluate(() => dcPtr.run());
    await settle(page);
    A.eq(seen.length, 0, `${label}: nothing fetched`);
    A.ok(r !== 'ok', `${label}: refresh refused (${r})`);
    A.includes(await ptrText(page), expect, `${label}: says "${expect}"`);
    if (undo) await page.evaluate(undo);
    return why;
  };
  await blocked('Quick Add open', () => { wqaOpen(); }, 'Quick Add is open', () => { closeModal('wqaModal'); });
  await blocked('AI reading', () => { wqa.aiBusy = true; }, 'AI is still reading', () => { wqa.aiBusy = false; });
  await blocked('edit to a saved quotation', () => { savedQuoteDirty = true; }, 'unsaved changes', () => { savedQuoteDirty = false; });
  await blocked('item in the quotation list, not saved', () => { quoteItems.push({ itemType: 'sagrod', qty: 1, totalAmount: 1 }); }, 'unsaved changes', () => { quoteItems.length = 0; });
  await blocked('a window open', () => { openModal('dsModal'); }, 'close the open window', () => { closeModal('dsModal'); });
  await blocked('guard missing', () => { window.__g = window.dcPtrGuard; delete window.dcPtrGuard; }, 'could not be checked', () => { window.dcPtrGuard = window.__g; });
  await blocked('guard throwing', () => { window.__g = window.dcPtrGuard; window.dcPtrGuard = () => { throw new Error('x'); }; }, 'could not be checked', () => { window.dcPtrGuard = window.__g; });

  /* typing in the item form: blocked and the value is kept */
  {
    seen.length = 0;
    const id = await page.evaluate(() => {
      const f = document.querySelector('.item-form[data-type="' + currentType + '"] input[type="number"], .item-form[data-type="' + currentType + '"] input:not([type])');
      f.value = '1234'; f.dispatchEvent(new Event('input', { bubbles: true })); f.blur(); return f.id;
    });
    await page.evaluate(() => __pull('#stepper', 300));
    await settle(page);
    A.eq(seen.length, 0, `entry form typed in (#${id}): nothing fetched`);
    A.includes(await ptrText(page), 'unsaved changes', 'entry form typed in: blocked');
    A.eq(await page.evaluate(i => document.getElementById(i).value, id), '1234', 'entry form typed in: the typed value is kept');
  }
  await page.close();

  /* refresh error → unchanged + Retry; Retry works; one at a time */
  companies = [{ id: 1, name: 'Alpha Steel' }];
  page = await openApp(browser, { viewport: PHONE, api });
  await page.evaluate(PULL);
  await page.evaluate(() => { dcPtr.state.force = true; });
  seen = counter(page);
  dpOk = false;
  companies = [{ id: 1, name: 'Alpha Steel' }, { id: 9, name: 'Should Not Appear' }];
  await page.evaluate(() => __pull('#stepper', 300));
  await settle(page);
  A.eq(await page.evaluate(() => companiesCache.map(c => c.name)), ['Alpha Steel'], 'refresh error: companies on the page unchanged (nothing half-applied)');
  A.includes(await ptrText(page), 'Couldn’t refresh', 'refresh error: says it could not refresh');
  A.ok(await page.evaluate(() => !!document.querySelector('#dcPtr .dc-ptr-retry')), 'refresh error: Retry offered');
  dpOk = true;
  await page.evaluate(() => document.querySelector('#dcPtr .dc-ptr-retry').click());
  await settle(page);
  A.eq(await page.evaluate(() => companiesCache.length), 2, 'Retry: refresh succeeds and applies');
  A.includes(await ptrText(page), 'Up to date', 'Retry: Up to date');

  /* network failure (fetch rejects) → unchanged */
  await page.route('**/api.php?action=get_diameter_settings*', r => r.abort());
  companies = [{ id: 1, name: 'Alpha Steel' }];
  await page.evaluate(() => __pull('#stepper', 300));
  await settle(page);
  A.eq(await page.evaluate(() => companiesCache.length), 2, 'network failure: page data unchanged');
  A.includes(await ptrText(page), 'Couldn’t refresh', 'network failure: says so');
  await page.unroute('**/api.php?action=get_diameter_settings*');

  /* two pulls while one is running → one refresh */
  await page.route('**/api.php?action=get_companies*', async r => { await new Promise(x => setTimeout(x, 500)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: companies }) }); });
  seen.length = 0;
  const res = await page.evaluate(async () => { const a = dcPtr.run(); const b = await dcPtr.run(); __pull('#stepper', 300); return [await a, b]; });
  await page.waitForTimeout(700);
  A.eq(res, ['ok', 'busy'], 'two at once: the second is refused while the first runs');
  A.eq(seen.filter(s => s === 'get_companies').length, 1, 'two at once: companies read once');
  A.eq(page._dcErrors, [], 'Quotation page: no page errors');
  await page.close();

  /* ── Saved page ── */
  {
    let cos = null; let qOk = true;
    const base = { id: 7, name: 'Alpha Steel Sdn Bhd', short_code: 'ALPHA', quotation_count: 2 };
    const p = await openCompanies(browser, { viewport: PHONE, api: {
      get_companies: () => ({ ok: true, data: cos || [base] }),
      get_quotations: () => qOk ? { ok: true, data: [], total: 0 } : { ok: false, error: 'x' },
    } });
    await p.evaluate(PULL);
    const s2 = counter(p);
    A.eq(await p.evaluate(() => dcPtr.enabled()), false, 'Saved, browser tab: off');
    await p.evaluate(() => { dcPtr.state.force = true; window.__noReload = 1; });
    cos = [base, { id: 8, name: 'Gamma Works', short_code: 'GAM', quotation_count: 0 }];
    const plain = await p.evaluate(() => { const n = document.querySelector('.wrap .card') || document.querySelector('.wrap'); n.id = n.id || '__plain'; return '#' + n.id; });
    await p.evaluate(sel => __pull(sel, 300), plain);
    await settle(p);
    A.eq(s2.slice().sort(), ['get_companies', 'get_quotations'], `Saved clean: companies + quotations read (${s2.join(',')})`);
    A.includes(await p.evaluate(() => document.getElementById('companyList').innerText), 'Gamma Works', 'Saved clean: the new company is listed');
    A.eq(await p.evaluate(() => window.__noReload), 1, 'Saved clean: no reload');

    qOk = false; cos = [base];
    await p.evaluate(sel => __pull(sel, 300), plain);
    await settle(p);
    A.includes(await p.evaluate(() => document.getElementById('companyList').innerText), 'Gamma Works', 'Saved error: the list on screen is kept');
    A.includes(await ptrText(p), 'Couldn’t refresh', 'Saved error: Retry state');
    qOk = true;

    s2.length = 0;
    const typedId = await p.evaluate(() => { const i = [...document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])')].find(n => n.offsetParent !== null);
      i.value = 'alp'; i.blur(); return i.id || i.className; });
    A.ok(!!typedId, `Saved: typed into a visible field (${typedId})`);
    await p.evaluate(sel => __pull(sel, 300), plain);
    await settle(p);
    A.eq(s2.length, 0, 'Saved with typed text: nothing fetched');
    A.includes(await ptrText(p), 'finish or clear', 'Saved with typed text: blocked');
    await p.evaluate(() => { document.querySelectorAll('input').forEach(i => { if (i.type !== 'checkbox') i.value = ''; }); });

    s2.length = 0;
    await p.evaluate(() => openModal('editCompanyModal'));
    await p.evaluate(sel => __pull(sel, 300), plain);
    await settle(p);
    A.eq(s2.length, 0, 'Saved with a window open: nothing fetched');
    await p.evaluate(() => closeModal('editCompanyModal'));
    A.eq(p._dcErrors, [], 'Saved page: no page errors');
    await p.close();
  }

  /* ZH wording */
  {
    const p = await openApp(browser, { viewport: PHONE });
    await p.evaluate(() => dcSetLang('zh'));
    await p.evaluate(PULL);
    await p.evaluate(() => { dcPtr.state.force = true; savedQuoteDirty = true; });
    await p.evaluate(() => __pull('#stepper', 300));
    await settle(p);
    A.includes(await ptrText(p), '未保存', '中文: blocked message is Chinese');
    await p.close();
  }
};
