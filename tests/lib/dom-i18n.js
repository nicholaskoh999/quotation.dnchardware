/* ── Rendered-DOM i18n scanner ─────────────────────────────────────────────
   The source checker reads the file. This reads the SCREEN.

   Two rounds of "0 hard-coded strings, 100% of keys translated" were reported
   while real English prose was visible in 中文 mode. Both times the checker was
   right about the source it could see and wrong about the application, because
   a string only reaches a person after a renderer runs, a branch is taken and a
   panel is opened. Nothing that reads source can stand in for that.

   So this module takes the opposite approach. It switches the application to
   中文, walks the rendered DOM of whatever state the test has driven it into,
   and reports every visible run of text — and every visible placeholder, title,
   aria-label and alt — that still contains an English word.

   "English word" is decided by subtraction, not by pattern matching. Every
   token is looked up in ONE explicit table of trade vocabulary (below). What is
   not in that table is a leak. That is deliberately the harsh direction: adding
   a word to the table is a visible, reviewable edit to a short list, while a
   pattern like "allow anything capitalised" would silently swallow whole
   sentences. English function words — the, is, a, to, for, please, select,
   view, never, added, automatically — can never be in the table, so no real
   sentence can pass.                                                        */
'use strict';

/* ── The allowlist ─────────────────────────────────────────────────────────
   Narrow and explicit, by instruction. Every entry is a value a Malaysian
   fastener quotation carries in English in either language: a material code, a
   size, a finish, a product the trade names in English, a unit, a registered
   entity, or a column of a dimension schema. Nothing here is a phrase of UI
   prose, and nothing here is a verb.

   To stop allowing one of these, delete the line — the scanner starts
   reporting it again immediately.                                            */

/* Multi-word entries are removed from the text before tokenising, because
   their parts are not individually meaningful ("FLAT WASHER", "SDN. BHD."). */
const PHRASES = [
  /* registered entities and the postal address */
  'DER-CHENG FASTENER SDN. BHD.', 'DNC HARDWARE SDN. BHD.',
  'EVERTOP HARDWARE TRADING', 'Alpha Steel Sdn Bhd', 'SDN. BHD.', 'SDN BHD',
  'Jalan Perindustrian', 'Kawasan Perindustrian', 'Bandar Baru', 'Selangor Darul Ehsan',
  /* products the trade names in English */
  'Sag Rod', 'Anchor Bolt', 'L Bolt 45DEG', 'L Bolt', 'J Bolt', 'U-Bolt', 'SQ U-Bolt',
  'Welding Anchor Set', 'Base Plate', 'Triangle Plate', 'Special Bolt',
  'FLAT WASHER', 'Flat Washer', 'EYE BOLT', 'Eye Bolt',
  /* material / grade codes written as two tokens */
  '4140 QT', '4340 QT', '4140 QT + HARDEN', 'Y BAR',
];

/* Single tokens. Compared case-insensitively against a token stripped of
   surrounding punctuation. */
const WORDS = new Set([
  /* materials, grades, finishes */
  'ms', 'ss304', 'ss316', 'ss', 's45c', 'qt', 'harden', 'hardened',
  'pl', 'zp', 'hdg', 'n/a', 'na', 'g8.8', 'g10.9', 'bar',
  /* products and parts, where the trade uses one word */
  'sag', 'rod', 'stud', 'anchor', 'bolt', 'bolts', 'nut', 'nuts', 'washer', 'washers',
  'plate', 'fw', 'j', 'u', 'l', 'sq', 'deg', '45deg',
  /* thread and size vocabulary */
  'unc', 'unf', 'bsw', 'tl', 'fullsize', 'undersize', 'p',
  /* units and currency */
  'rm', 'kg', 'kgs', 'mm', 'pcs', 'pc', 'nos', 'no.', 'set', 'sets',
  /* dimension-schema column letters, as the forms print them */
  'h', 's', 'id', 'od', 'ih', 'oh', 'w', 't', 'd', 'a', 'b', 'c', 'r', 'e', 'x',
  /* the language buttons, the brand, and the file kinds a customer sends */
  'en', 'dnc', 'quotation.dnc', 'der-cheng', 'evertop', 'whatsapp', 'pdf', 'ai',
  /* keyboard keys are printed on the key in either language */
  'enter', 'esc', 'tab', 'shift', 'ctrl',
  /* third-party product names, which are not translated in Chinese either */
  'mysql', 'excel', 'csv', 'json',
]);

/* Whole tokens that are codes rather than words: sizes, grades, references,
   and a number welded to its unit or currency. Each is anchored, so none of
   them can match a word. */
const CODE_RE = [
  /^m\d+(\.\d+)?$/i,             // M12, M24, M8.8
  /^\d+(\.\d+)?["”″']$/,         // 1", 1.5"
  /^\d+\/\d+["”″']?$/,           // 1/2", 3/4
  /^g\d+(\.\d+)?$/i,             // G8.8, G10.9
  /^\d{4}$/,                     // 4140, 4340
  /^v?\d+(\.\d+){1,3}$/i,        // v2.24.0 version numbers
  /^[a-z]{1,5}-[a-z0-9-]*\d[a-z0-9-]*$/i,  // DC-TEST-001, Q-2026-0041 references
  /^\d+(\.\d+)?p$/i,             // 1.75P thread pitch
  /^[a-z]$/i,                    // any single letter: a dimension label
  /^rm[\d.,]+(\/(pc|pcs|set|kg))?$/i,           // RM10.97, RM0.00/set
  /^[\d.,]+(kg|kgs|mm|pcs?|nos?|sets?)$/i,      // 3.5513kg, 1000mm, 40pcs
  /^rm\/(kg|pc|pcs|set)$/i,                     // RM/kg
  /^[\d.,]+kg\/(pc|pcs|set)$/i,                 // 3.5513kg/pc
  /^(kg|mm)\/(pc|pcs|set)$/i,                   // the unit on its own: kg/pc
];

/* Regions of the page that are deliberately English in both languages, each
   with the decision that put it there. A test may pass more via opts.skip. */
const SKIP_SELECTORS = [
  /* The customer's document, not the operator's screen. Open question §1 of
     BUSINESS-DECISIONS-NEEDED.md; explicitly out of scope for this round. */
  '#printArea', '#waPreview', '#waText', '.print-only',
  /* A record of what shipped and when, written at the time. Rewriting it in
     another language rewrites history — the modal's own chrome (its heading and
     its close button) is NOT excluded and is scanned like everything else. */
  '.version-updates-list',
  /* Trade shorthand showing the FORMAT a customer writes in. Translating the
     sample would show a format nobody sends. */
  '#wqaInput', '#wqaSample', '.wqa-sample',
  /* The customer's own message, echoed back so the operator can check the
     reading against what was actually sent. Translating it would falsify the
     evidence the panel exists to show. */
  '.wqa-source-text', '.wqa-row-raw-full', '.wqa-row-raw',
  /* The masthead carries the brand, on the same reasoning as the page title. */
  '.hdr-brand', '.brand-link',
  /* A <code> run is a literal token the operator types or pastes —
     {customer}, {quotationNo} — not a word to be translated. */
  'code', 'kbd', 'samp',
  /* Values the operator typed or the database returned: customer names,
     references, remarks, descriptions of saved rows. */
  '[data-i18n-skip]',
];

function scanScript() {
  /* Serialised into the page; everything it needs is passed in. */
  return function (cfg) {
    const phrases = cfg.phrases, words = new Set(cfg.words),
          codes = cfg.codes.map(s => new RegExp(s.source, s.flags)),
          skips = cfg.skips;

    function visible(el) {
      if (!el || !el.getClientRects || !el.getClientRects().length) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return false;
      if (parseFloat(cs.opacity || '1') === 0) return false;
      return true;
    }
    function skipped(el) {
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        for (let i = 0; i < skips.length; i++) { try { if (n.matches(skips[i])) return true; } catch (e) {} }
      }
      return false;
    }
    function where(el) {
      const bits = [];
      for (let n = el; n && n.nodeType === 1 && bits.length < 4; n = n.parentElement) {
        let s = n.tagName.toLowerCase();
        if (n.id) { bits.unshift(s + '#' + n.id); break; }
        if (n.className && typeof n.className === 'string') {
          const c = n.className.trim().split(/\s+/)[0];
          if (c) s += '.' + c;
        }
        bits.unshift(s);
      }
      return bits.join('>');
    }

    /* The heart of it: what English survives subtraction of the allowlist. */
    function english(raw) {
      let t = ' ' + String(raw).replace(/\s+/g, ' ') + ' ';
      for (let i = 0; i < phrases.length; i++) {
        const p = phrases[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        t = t.replace(new RegExp('(^|[^A-Za-z0-9])' + p + '(?![A-Za-z0-9])', 'gi'), '$1 ');
      }
      const out = [];
      const toks = t.split(/[^A-Za-z0-9.\/"”″'’%+-]+/);
      for (let i = 0; i < toks.length; i++) {
        let w = toks[i].replace(/^[.'’"”″%+-]+/, '').replace(/[.,;:!?'’"”″%+-]+$/, '');
        if (!w || !/[A-Za-z]/.test(w)) continue;
        if (words.has(w.toLowerCase())) continue;
        let isCode = false;
        for (let c = 0; c < codes.length; c++) if (codes[c].test(w)) { isCode = true; break; }
        if (isCode) continue;
        out.push(w);
      }
      return out;
    }

    const found = [];
    function note(kind, el, text) {
      const words = english(text);
      if (!words.length) return;
      found.push({ kind: kind, where: where(el), text: String(text).replace(/\s+/g, ' ').trim().slice(0, 200), words: words });
    }

    const all = document.querySelectorAll('body *');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'template' || tag === 'noscript') continue;
      if (skipped(el)) continue;
      const vis = visible(el);

      /* own text only, so a leak is reported on the element that holds it */
      if (vis) {
        let own = '';
        for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) own += n.nodeValue;
        if (own.trim()) note('text', el, own);
      }
      /* an <option> has a box only when its <select> is open, but its text is
         on screen as the select's current value and in the dropdown */
      if (tag === 'option' && el.parentElement && visible(el.parentElement)) {
        if (el.textContent.trim()) note('option', el, el.textContent);
      }
      if (!vis && tag !== 'option') continue;

      const ph = el.getAttribute && el.getAttribute('placeholder');
      if (ph && ph.trim()) note('placeholder', el, ph);
      const ti = el.getAttribute && el.getAttribute('title');
      if (ti && ti.trim()) note('title', el, ti);
      const ar = el.getAttribute && el.getAttribute('aria-label');
      if (ar && ar.trim()) note('aria-label', el, ar);
      const al = el.getAttribute && el.getAttribute('alt');
      if (al && al.trim()) note('alt', el, al);
      if ((tag === 'input' || tag === 'button') && /^(button|submit|reset)$/i.test(el.type || '')) {
        const v = el.value; if (v && String(v).trim()) note('value', el, v);
      }
    }
    return found;
  };
}

/* Scan the page as it stands. Returns an array of leaks; empty means clean. */
async function scanRendered(page, opts = {}) {
  const cfg = {
    phrases: PHRASES.concat(opts.phrases || []),
    words: Array.from(WORDS).concat(opts.words || []),
    codes: CODE_RE.map(r => ({ source: r.source, flags: r.flags })),
    skips: SKIP_SELECTORS.concat(opts.skip || []),
  };
  return page.evaluate(scanScript(), cfg);
}

/* A one-line rendering of a leak list, for an assertion message. */
function describe(leaks, limit = 6) {
  return leaks.slice(0, limit)
    .map(l => `[${l.kind} ${l.where}] "${l.text}" <${l.words.join(' ')}>`)
    .join(' | ') + (leaks.length > limit ? ` (+${leaks.length - limit} more)` : '');
}

/* Put the application into a language the way the button does. */
async function setLang(page, lang) {
  await page.evaluate(l => dcSetLang(l), lang);
  await page.waitForTimeout(220);
}

module.exports = { scanRendered, describe, setLang, PHRASES, WORDS, CODE_RE, SKIP_SELECTORS };
