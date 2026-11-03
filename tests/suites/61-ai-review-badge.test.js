/* ── AI badge: "AI Parsed" or "Review Needed", never "AI Checked" ────────────
   One model reads each file, so nothing is ever presented as cross-checked.
   A clean read says AI Parsed; a backup reader, a cut-off answer, an unclear
   row or a missing dimension says Review Needed. Provider, latency, tokens and
   cost appear only when the server sends diagnostics (allowlisted users).   */
'use strict';
const { openApp } = require('../lib/harness');

const item = o => Object.assign({ M: null, L: null, W: null, TL: null, qty: null, Bmid: null, material: null, finish: null,
  sizeType: null, unclear: null, product: null, threadEnds: null, bodyDia: null, H: null, ID: null, S: null, R: null,
  Lref: null, Wref: null }, o);
const doc = items => ({ product: null, material: null, finish: null, sizeType: null, threadEnds: null, note: null, items });
const clean = doc([item({ M: 'M30', L: 300, TL: 80, qty: 6, material: 'MS', finish: 'HDG', sizeType: 'Fullsize', product: 'ANCHOR_BOLT' })]);

module.exports = async (browser, A) => {
  A.suite('AI badge — AI Parsed / Review Needed');
  const p = await openApp(browser);
  const badge = async (d, meta) => {
    await p.evaluate(async ([d, m]) => { wqaResetState(); await wqaAiApply(d, undefined, m); }, [d, meta]);
    await p.waitForTimeout(250);
    return p.evaluate(() => { const b = el('wqaAiBadge'); return { hidden: b.hidden, text: b.textContent, review: b.classList.contains('is-review'), title: b.title }; });
  };

  let b = await badge(clean, { truncated: false, review: false });
  A.eq(b.hidden, false, 'a used AI result shows the badge');
  A.ok(/AI Parsed/.test(b.text) && !b.review, 'clean Sonnet read: AI Parsed');
  A.eq(b.title, '', 'no diagnostics for an ordinary user');

  b = await badge(clean, { truncated: false, review: true });
  A.ok(/Review Needed/.test(b.text) && b.review, 'server review flag (backup reader / no rows): Review Needed');

  b = await badge(clean, { truncated: true, review: false });
  A.ok(/Review Needed/.test(b.text), 'cut-off answer: Review Needed');

  b = await badge(doc([item({ M: null, L: 300, TL: 80, qty: 6, product: 'ANCHOR_BOLT', unclear: 'size M20 or M30', material: 'MS', finish: 'HDG' })]),
                  { truncated: false, review: false });
  A.ok(/Review Needed/.test(b.text), 'a row the reader flagged unclear: Review Needed');

  b = await badge(doc([item({ M: 'M30', TL: 80, qty: 6, product: 'ANCHOR_BOLT', material: 'MS', finish: 'HDG' })]), { truncated: false, review: false });
  A.ok(/Review Needed/.test(b.text), 'a missing dimension: Review Needed');

  b = await badge(clean, { truncated: false, review: true,
    diag: { provider: 'openai', model: 'gpt-5.6-luna', fallback: 'timeout', ms: 9100, in: 9300, out: 279, est_usd: 0.0022 } });
  A.ok(/fallback: timeout/.test(b.title) && /gpt-5\.6-luna/.test(b.title), 'diagnostics users see provider, model and fallback reason');

  const html = await p.evaluate(() => document.documentElement.innerHTML);
  A.ok(!/AI Checked/i.test(html), 'no "AI Checked" state anywhere in the app');
  await p.evaluate(() => dcSetLang ? dcSetLang('zh') : null).catch(() => {});
  b = await badge(clean, { truncated: false, review: false });
  A.ok(b.text.length > 0, 'badge has text after a language switch');
  await p.close();
};
