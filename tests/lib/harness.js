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
      weight: r.calc ? r.calc.weight : null,
      price: r.calc ? r.calc.finalUnitPrice : null,
      costRate: r.calc ? r.calc.costRate : null,
      addCost: r.calc ? r.calc.addCost : null,
      missing: wqaRowMissing(r),
      badges: (card && card.querySelector('.wqa-sum-badges') || {}).textContent || '',
      shownSize: q('.wqa-c-size'),
      shownSizeInput: q('.wqa-row-body input'),
      shownUnitWeight: q('.wqa-uw-full'),
      shownTotalWeight: q('.wqa-tw'),
      shownPrice: (card && card.querySelector('.wqa-fin') || {}).textContent || '',
      history: r.history === undefined ? 'pending' : (r.history ? r.history : null),
    };
  }));
}

/* Type into a Quick Add row's size box without leaving it: no Enter, no blur.
   This is the whole point of the P0 case — the value must be right while the
   caret is still in the field. */
async function typeRowSize(page, index, text, opts = {}) {
  const sel = `[data-wqa-row="${index}"] .wqa-row-body input`;
  await page.click(sel, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(sel, text, { delay: opts.delay === undefined ? 15 : opts.delay });
  await page.waitForTimeout(opts.settle || 600);
  if (opts.blur) { await page.$eval(sel, el => el.blur()); await page.waitForTimeout(400); }
}

module.exports = { launch, openApp, buildPage, typeInto, quickAddPaste, rowState, typeRowSize, ORIGIN, ROOT };
