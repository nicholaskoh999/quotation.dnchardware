/* ── Browser test harness ──────────────────────────────────────────────────
   The application is one PHP file whose only PHP is a single require on line 1.
   Everything after that is the real HTML, the real CSS and the real 8,500-line
   script that runs in front of staff. So the harness does not re-implement or
   re-export anything: it strips that one line, serves the file over http:// so
   localStorage behaves as it does live, answers api.php from a table the test
   controls, and drives the page in Chromium.

   That matters for this audit specifically. A parser test can prove the parser
   returns M27; only a browser test can prove that typing 27 into the size box
   makes the row weigh what an M27 weighs. Every assertion here runs against the
   shipped code path.                                                        */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..', '..');
const INDEX_PHP = path.join(ROOT, 'index.php');
const ORIGIN    = 'http://quotation.test';

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join('/opt/node22/lib/node_modules', 'playwright')));
}

/* index.php verbatim, minus the auth require and the Google Fonts link. The
   font link is the only outbound request the page makes, and this sandbox has
   no route to it — leaving it in costs every page load a DNS timeout and
   changes nothing that is under test. */
function buildPage() {
  let html = fs.readFileSync(INDEX_PHP, 'utf8');
  html = html.replace(/^<\?php[\s\S]*?\?>\s*/, '');
  html = html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g, '');
  return html;
}

/* Default api.php answers: an empty, working install. A test that needs price
   history or custom diameter rules overrides one key and leaves the rest. */
function defaultApi() {
  return {
    get_companies:          { ok: true, data: [] },
    get_default_prices:     { ok: true, data: [] },
    get_diameter_settings:  { ok: true, data: [] },
    get_whatsapp_template:  { ok: true, data: {} },
    get_next_ref:           { ok: true, data: { ref_no: 'DC-TEST-001' } },
    get_price_history:      { ok: true, data: [] },
    save_quotation:         { ok: true, data: { id: 1, ref_no: 'DC-TEST-001' } },
  };
}

async function launch() {
  return chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
}

/* One page, booted and idle, with the api table it was given. */
async function openApp(browser, opts = {}) {
  const api  = Object.assign(defaultApi(), opts.api || {});
  const page = await browser.newPage({ viewport: opts.viewport || { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  /* A person clicking OK. Without this every confirm() resolves false and a
     saved quotation could never be unlocked for editing in a test. */
  page.on('dialog', d => d.accept().catch(() => {}));

  /* A saved quotation is opened by handing it over in sessionStorage, exactly
     as companies.php does — so "reload the saved quotation" in a test is the
     same code path staff use, not a re-implementation of it. */
  if (opts.handoff) {
    await page.addInitScript(p => {
      try { sessionStorage.setItem('loadQuote', JSON.stringify(p)); } catch (e) {}
    }, opts.handoff);
  }

  const html = buildPage();
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('api.php')) {
      const m  = /[?&]action=([a-z_]+)/.exec(url);
      const act = m ? m[1] : '';
      let body = api[act];
      if (typeof body === 'function') body = body(url, route.request());
      if (body === undefined) body = { ok: true, data: [] };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (/\/app\.html$/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    }
    /* icons, manifest, anything else the page reaches for */
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  });

  await page.goto(ORIGIN + '/app.html', { waitUntil: 'domcontentloaded' });
  /* The script is a classic one, so its function declarations reach window but
     its `let` state does not. Boot is complete when init() has filled the
     reference number it fetches last. */
  await page.waitForFunction(
    () => typeof window.wqaParseText === 'function'
       && (document.getElementById('qi-refno') || {}).value,
    null, { timeout: 20000 });
  await page.waitForTimeout(150);
  page._dcErrors = errors;
  return page;
}

/* Type into a real input the way a person does: focus, keystrokes, and the
   input event the page listens to. No value assignment, because assigning a
   value fires nothing and would prove nothing about the live behaviour. */
async function typeInto(page, selector, text, opts = {}) {
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(selector, text, { delay: opts.delay === undefined ? 12 : opts.delay });
  if (opts.blur !== false) await page.$eval(selector, el => el.blur());
}

/* ── Quick Add ─────────────────────────────────────────────────────────────
   Paste a message and go through the real Parse -> Review path, exactly as the
   button does. Returns nothing: read the state off the page afterwards. */
async function quickAddPaste(page, text, opts = {}) {
  await page.evaluate(t => {
    if (typeof wqaHardClose === 'function' && document.getElementById('wqaModal').classList.contains('open')) wqaHardClose();
    wqaOpen();
    document.getElementById('wqaInput').value = t;
  }, text);
  await page.evaluate(() => wqaParseAndReview());
  await page.waitForFunction(() => !document.getElementById('wqaStep2').hidden, null, { timeout: 10000 })
    .catch(() => {});
  if (opts.expanded !== false) await page.evaluate(() => wqaSetView('expanded'));
  await page.waitForTimeout(opts.settle || 500);
}

/* The rows as the application holds them, plus what the screen is showing for
   each — so a test can assert that the two agree. */
async function rowState(page) {
  return page.evaluate(() => wqa.rows.map((r, i) => {
    const card = document.querySelector('[data-wqa-row="' + i + '"]');
    const q = s => { const n = card && card.querySelector(s); return n ? (n.value !== undefined ? n.value : n.textContent) : null; };
    return {
      i, removed: r.removed,
      size: r.size, length: r.length, w: r.w, h: r.h, id: r.id, s: r.s,
      threadLen: r.threadLen, threadLen2: r.threadLen2,
      thread: typeof wqaThreadValue === 'function' ? wqaThreadValue(r) : '',
      qty: r.qty, product: r.product, material: r.material, finish: r.finish,
      sizeType: r.sizeType, noDia: r.noDia,
      grade: r.grade || '', radius: r.radius || '',
      matFrom: r.matFrom || '', matDefaulted: !!r.matDefaulted,
      hFromL: !!r.hFromL, finishSeen: r.finishSeen || '',
      unsupported: r.unsupported || '',
      specRaw: r.specRaw || { material: '', finish: '', sizeType: '' },
      weight: r.calc ? r.calc.weight : null,
      price: r.calc ? r.calc.finalUnitPrice : null,
      costRate: r.calc ? r.calc.costRate : null,
      addCost: r.calc ? r.calc.addCost : null,
      missing: wqaRowMissing(r),
      badges: (card && card.querySelector('.wqa-sum-badges') || {}).textContent || '',
      shownSize: q('.wqa-c-size'),
      /* The size box is the inline edit grid's; when no edit is open there is
         no box, and the compact cell is what a person reads. */
      shownSizeInput: (card && card.querySelector('[data-ef="size"]'))
                        ? card.querySelector('[data-ef="size"]').value
                        : ((card && card.querySelector('.wqa-c-size'))
                            ? card.querySelector('.wqa-c-size').childNodes[0].textContent.trim()
                            : null),
      shownUnitWeight: q('.wqa-uw-full'),
      shownTotalWeight: q('.wqa-tw'),
      shownPrice: (card && card.querySelector('.wqa-fin') || {}).textContent || '',
      hist: r.hist === undefined ? 'pending' : (r.hist ? r.hist : null),
      histOpen: !!r.histOpen,
      priceMode: r.priceMode || 'auto',
      manualPrice: r.manualPrice || '',
      usedHistoryRef: r.usedHistoryRef || '',
    };
  }));
}

/* Type into a Quick Add row's size box without leaving it: no Enter, no blur.
   This is the whole point of the P0 case — the value must be right while the
   caret is still in the field.

   The size box is the inline edit grid's now: Expanded no longer carries a
   second copy of the dimensions, because the same field editable in two places
   is one place too many. So this opens the edit the way a person does and
   types in the SIZE cell, which is the same live path it always exercised. */
async function typeRowSize(page, index, text, opts = {}) {
  await page.evaluate(i => { if (!wqa.edit) wqaEditStart(i, 'size'); }, index);
  await page.waitForTimeout(350);
  const sel = `[data-wqa-row="${index}"] [data-ef="size"]`;
  await page.click(sel, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(sel, text, { delay: opts.delay === undefined ? 15 : opts.delay });
  await page.waitForTimeout(opts.settle || 600);
  /* The row's own state is already updated — that is the P0 case, and it is
     true while the caret is still in the box. What happens next is only about
     what the SCREEN is showing: an open edit turns the row into a grid of
     inputs, so the expanded weight line and the read-only cells are not there
     to be read. Callers that want to read them get the edit finished, which is
     what a person does; pass keepEdit to stay in it. */
  /* The blur is allowed to finish before anything re-renders: closing the
     edit from inside a blur handler replaces the node the browser is still
     working on. */
  if (opts.blur) { await page.$eval(sel, el => el.blur()); await page.waitForTimeout(200); }
  if (!opts.keepEdit) {
    await page.evaluate(() => { try { wqaEditDone(); } catch (e) {} });
    await page.waitForTimeout(500);
  }
}

/* ── The Companies page, served the same way ────────────────────────────────
   companies.php has the same shape as index.php — one auth require on line 1
   and then the real page — so it is served by the same rule, from the same
   origin, so the language choice stored in localStorage by one is already in
   force when the other paints. That is the behaviour under test. */
const COMPANIES_PHP = path.join(ROOT, 'companies.php');

function buildCompaniesPage() {
  let html = fs.readFileSync(COMPANIES_PHP, 'utf8');
  html = html.replace(/^<\?php[\s\S]*?\?>\s*/, '');
  html = html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g, '');
  return html;
}

/* Companies answers its own small set of actions. Defaults are one company
   with one saved quotation, which is enough for the page to have something to
   draw; a test that wants more overrides the key it cares about. */
function defaultCompaniesApi() {
  const company = { id: 7, name: 'Alpha Steel Sdn Bhd', short_code: 'ALPHA',
                    phone: '03-1234 5678', address: '12 Jalan Perindustrian, Klang',
                    quotation_count: 2, latest_quotation_date: '2026-02-14',
                    latest_quotation_created_at: '2026-02-14 09:15:00' };
  const quote = { id: 41, ref_no: 'Q-2026-0041', previous_ref_no: null,
                  quote_date: '2026-02-14', created_at: '2026-02-14 09:15:00',
                  customer_name: 'Alpha Steel Sdn Bhd', company_id: 7,
                  company_name: 'Alpha Steel Sdn Bhd', prepared_by: 'Nicholas',
                  total_amount: 18450.75, remarks: '',
                  /* An array, as the endpoint returns it: the page maps over
                     these to build each card's preview line. */
                  items: [{ itemType: 'sagrod', description: 'MS FULLSIZE SAG ROD',
                            size: 'M12', cleanSize: 'M12', material: 'MS', finish: 'ZP',
                            sizeType: 'FULLSIZE', dimensions: 'M12 x L 1000 x TL 100/100mm',
                            qty: 40, finalUnitPrice: 7.9, weight: 0.8878 }] };
  return {
    get_companies:   { ok: true, data: [company] },
    get_quotations:  { ok: true, data: [quote] },
    get_quotation:   { ok: true, data: quote },
    search_items:    { ok: true, data: [] },
  };
}

async function openCompanies(browser, opts = {}) {
  const api = Object.assign(defaultCompaniesApi(), opts.api || {});
  const page = await browser.newPage({ viewport: opts.viewport || { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('dialog', d => d.accept().catch(() => {}));
  if (opts.lang) {
    await page.addInitScript(l => { try { localStorage.setItem('dc_lang', l); } catch (e) {} }, opts.lang);
  }
  const html = buildCompaniesPage();
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('api.php')) {
      const m = /[?&]action=([a-z_]+)/.exec(url);
      let body = api[m ? m[1] : ''];
      if (typeof body === 'function') body = body(url, route.request());
      if (body === undefined) body = { ok: true, data: [] };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (/\/companies\.html$/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    }
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  });
  await page.goto(ORIGIN + '/companies.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  page._dcErrors = errors;
  return page;
}

module.exports = { launch, openApp, buildPage, typeInto, quickAddPaste, rowState, typeRowSize,
                   openCompanies, buildCompaniesPage, ORIGIN, ROOT };
