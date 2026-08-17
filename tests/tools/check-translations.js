/* ── Translation coverage, read off the shipped source ──────────────────────
   Four things can leave a screen in English while the app is in 中文, and all
   four are invisible until somebody switches the language and looks:

     1 · a key that exists in `en` and not in `zh`. dcT falls back to English
         rather than showing the key, which is right at runtime and means a
         missing translation looks exactly like a finished one.
     2 · a key the code asks for that neither dictionary defines. dcT then
         shows the key itself, or whatever fallback the caller passed.
     3 · a key translated to the same string in both. Correct for a code —
         M12, SS304, PL — and a missed translation for anything else.
     4 · a string built straight into markup, a toast or a title attribute
         that never reaches dcT at all. This is the one that does not show up
         in any dictionary count, because there is no key to count.

   It asserts nothing about WORDING: whether 螺纹参考 is the right phrase for
   Thread Reference is a translator's judgement, not a script's. It checks that
   every string a person can see has somewhere to be translated, and that the
   somewhere is filled in.

       node tests/tools/check-translations.js
       node tests/tools/check-translations.js --json out.json

   Trade vocabulary is deliberately NOT translated — M12, 1/2", SS304, 4140 QT,
   PL, ZP, HDG, UNC, BSW, TL, RM, kg — and the dictionary says so at its head.
   So an identical en/zh pair is reported only where the string is not built
   out of that vocabulary, and the hard-coded scan ignores the same words.   */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT  = path.resolve(__dirname, '..', '..');
const FILES = ['index.php', 'companies.php', 'login.php'];

/* Codes, units and trade vocabulary. A string built only out of these, plus
   digits and punctuation, reads the same in both languages by design. */
const CODE_WORDS = [
  'M\\s*\\d+(?:\\.\\d+)?', '\\d+\\s*/\\s*\\d+"?', '\\d+-\\d+/\\d+"?',
  'SS304', 'SS316', 'SUS304', 'SUS316', 'A2', 'A4', 'AISI',
  '4140', '4340', 'QT', 'S45C', 'MS', 'Y\\s*BAR', 'HT',
  'PL', 'ZP', 'HDG', 'GI', 'UNC', 'UNF', 'UNEF', 'BSW', 'BSF', 'BSP', 'NPT',
  'TL', 'TL1', 'TL2', 'ID', 'OD', 'OAL', 'RM', 'kg', 'mm', 'cm', 'pcs?', 'nos?',
  'DNC', 'PDF', 'CSV', 'PNG', 'JPG', 'WEBP', 'WhatsApp', 'EN', 'ZH', 'AI', 'URL', 'PDPA',
  /* the dimension letters a drawing uses */
  'H', 'W', 'S', 'R', 'L', 'P', 'A', 'B', 'C', 'T', 'X+',
  '\\d+(?:\\.\\d+)?P', 'G?\\d+\\.\\d+', 'DIN', 'ISO', 'ASTM',
  /* Product and part names. The trade calls a Base Plate a Base Plate in
     either language, exactly as it calls a Sag Rod a Sag Rod — so an en/zh
     pair that matches here is finished, not missed. */
  'Sag\\s*Rod', 'Stud', 'Anchor\\s*Bolt', 'U-?Bolt', 'SQ\\s*U-?Bolt',
  'L\\s*Bolt(?:\\s*45DEG)?', 'J\\s*Bolt', 'Base\\s*Plate', 'Triangle\\s*Plate',
  'Welding\\s*Anchor(?:\\s*Set)?', 'Plate', 'Nut', 'FW',
  /* Size-type vocabulary, same reasoning as the material codes. */
  'Fullsize', 'Undersize', 'Full\\s*size', 'Under\\s*size',
];
const CODE_RE = new RegExp(
  '^(?:' + CODE_WORDS.join('|') + '|[-+*/×·|,.:;()\\[\\]{}%#@&=<>~^"\'\\s\\d]+)+$', 'i');
const isCode = s => CODE_RE.test(String(s).trim());

/* A key whose NAME ends in Zh holds Chinese on purpose — a bilingual label
   that shows the Chinese wording in either mode. Identical by design. */
const isDeliberateZh = k => /Zh$/.test(k);

/* The dictionary literal, lifted out and evaluated on its own. It is plain
   data — string keys to string values — so this is a parse of a literal, not
   an execution of application code. */
function dictOf(src, file) {
  const at = src.indexOf('const I18N={');
  if (at < 0) return null;
  const open = src.indexOf('{', at);
  let depth = 0, end = -1, inStr = null, esc = false, inLine = false, inBlock = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inLine)  { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) { end = i; break; } }
  }
  if (end < 0) throw new Error(`${file}: I18N literal is not balanced`);
  // eslint-disable-next-line no-new-func
  return new Function('return ' + src.slice(open, end + 1))();
}

/* Where the I18N literal sits in the file, so the markup scan can step over
   it: a dictionary value is a translation, not a string that needs one. */
function dictRangeOf(src) {
  const at = src.indexOf('const I18N={');
  if (at < 0) return null;
  const open = src.indexOf('{', at);
  let depth = 0, inStr = null, esc = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return [open, i]; }
  }
  return null;
}

/* Comments out, strings kept. The file documents its own conventions with
   example markup — `<span data-i18n="key">` sits inside a block comment above
   dcApplyLang — and a scan that reads documentation as code reports the
   example as a missing translation. Whole lines are blanked rather than
   deleted so every reported line number still points at the real line. */
function stripComments(src) {
  const out = src.split('');
  let inStr = null, esc = false, inLine = false, inBlock = false, inRe = false;
  let prev = '', prev2 = '';           // the last two significant characters
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === '\n') inLine = false; else out[i] = ' '; continue; }
    if (inBlock) {
      if (c === '*' && n === '/') { out[i] = ' '; out[i + 1] = ' '; i++; inBlock = false; }
      else if (c !== '\n') out[i] = ' ';
      continue;
    }
    /* A REGEX LITERAL is not a string, and it may contain quotes. Without this,
       `.replace(/"/g, '&quot;')` opened a string that never closed and every
       comment after it read as code — which is how a block comment three
       hundred lines further down was reported as untranslated markup. */
    if (inRe) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '[') inRe = 'class';
      else if (c === ']' && inRe === 'class') inRe = true;
      else if (c === '/' && inRe !== 'class') { inRe = false; prev2 = prev; prev = '/'; }
      continue;
    }
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { inLine = true; out[i] = ' '; continue; }
    if (c === '/' && n === '*') { inBlock = true; out[i] = ' '; continue; }
    if (c === '/') {
      /* Regex or division, decided by what came before it. After a value, `/`
         divides; after an operator, a comma, an opening bracket or nothing at
         all, it opens a pattern.

         `<` and a bare `>` are deliberately NOT openers, because this file is
         mostly markup: every `</p>` in a template literal would otherwise open
         a pattern that ran to the next slash, swallowing the block comments
         after it. An ARROW is an opener — `x => /re/.test(y)` is ordinary —
         so `>` counts only when an `=` is in front of it. */
      const arrow = prev === '>' && prev2 === '=';
      if (!prev || arrow || '(,=:[!&|?{};'.includes(prev)) { inRe = true; continue; }
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; prev2 = prev; prev = c; continue; }
    if (!/\s/.test(c)) { prev2 = prev; prev = c; }
  }
  return out.join('');
}

/* Keys named OUTRIGHT: dcT('x') and data-i18n="x". A key here that no
   dictionary defines is shown to a person as itself.

   The PREFIX of a computed name is not a key: dcT('field'+name) builds
   fieldQty, and 'field' on its own is never looked up. */
function keysNamed(code) {
  const out = new Set();
  let m;
  const re1 = /\bdcT\(\s*'([A-Za-z0-9_]+)'\s*(?![+)]?\s*\+)/g;
  while ((m = re1.exec(code)) !== null) out.add(m[1]);
  const re2 = /\bdata-i18n(?:-ph|-aria|-title|-alt)?=["']([A-Za-z0-9_]+)["']/g;
  while ((m = re2.exec(code)) !== null) out.add(m[1]);
  return out;
}

/* Keys reached ANY way at all, including computed ones — dcT('field'+name),
   dcT(dcThreadRefHintKey(size)). Used only to decide what is dead, so a quoted
   occurrence anywhere in the file counts. */
function keysReferenced(src, allKeys) {
  const out = new Set();
  for (const k of allKeys) {
    if (src.includes(`'${k}'`) || src.includes(`"${k}"`)) { out.add(k); continue; }
    /* dcT('field'+X) builds fieldQty, fieldSize … from a prefix. */
    for (let i = 4; i < k.length; i++) {
      const pre = k.slice(0, i);
      if (src.includes(`'${pre}'+`) || src.includes(`'${pre}' +`)) { out.add(k); break; }
    }
  }
  return out;
}

/* ── 4 · strings that never reach dcT ──────────────────────────────────────
   Only the places a person actually reads: a toast, a title attribute, a
   placeholder, an aria-label, and text sitting between tags in generated
   markup. A literal with ${…} in it is a template the renderer built, so it is
   inspected for the English AROUND the interpolation. */
const ENGLISH_RE = /[A-Za-z]{3,}/;
/* Words that are trade vocabulary or a machine value, not prose. */
const SKIP_TEXT = [
  /^[\s\d.,:;·|/×-]*$/, /^https?:/i, /^data:/i, /^#[0-9a-f]{3,8}$/i,
  /^[A-Z_]{3,}$/,                                   // CONSTANT_NAMES
  /^\$\{[^}]*\}$/,                                  // a bare interpolation
  /* The example WhatsApp message in the paste box. It is the trade's own
     shorthand — "ms hdg sag rod / m12 x 1000 x 100" — and shows the FORMAT a
     customer writes in. Translating it would show a format nobody sends. */
  /^ms hdg sag rod/i,
  /* Product names are the trade's vocabulary in either language, exactly as
     the dictionary's own header says. */
  /^(?:L Bolt(?: 45DEG)?|J Bolt|U-Bolt|SQ U-Bolt|Sag Rod|Stud|Anchor Bolt|Plate|Welding Anchor(?: Set)?)$/i,
  /^(?:Sag Rod|Stud|Anchor Bolt|U-Bolt|SQ U-Bolt|L Bolt|J Bolt)(?:\s*\/\s*(?:Sag Rod|Stud|Anchor Bolt|U-Bolt|SQ U-Bolt|L Bolt|J Bolt))+$/i,

  /* ── Deliberately out of scope, and here so it stays visible ─────────────
     Three kinds of text are NOT translated, on purpose:

     · The registered company names and the postal address on the letterhead.
       A legal entity is not a phrase, and an address that is translated is an
       address the post office cannot read.
     · The Version Updates page. It is a record of what shipped and when,
       written at the time; rewriting it in another language would be
       rewriting history rather than translating an interface.
     · The page <title>, which carries the brand.

     Each is a decision, not an oversight. If any of them should be
     translated, the rule to delete is this one. */
  /^(?:DER-CHENG|DNC)\b.*\b(?:SDN\.?\s*BHD\.?)$/i,
  /^EVERTOP HARDWARE TRADING$/i,
  /* Material names. The brief names these outright as values never to be
     machine-translated, and this is the longest of them. */
  /^(?:4140 QT \+ HARDEN = G10\.9|S45C \+ HARDEN = G8\.8|Others \/ Special Bolt)$/i,
  /* ── The printed quotation ───────────────────────────────────────────────
     Quotation No., Prepared By, Size / Dimension, Unit Price, Grand Total and
     the letterhead are the customer's document, not the operator's screen.
     Which language a CUSTOMER receives is a business decision and not one to
     take inside an audit, so the print template is left exactly as it is and
     the question is recorded instead. See BUSINESS-DECISIONS-NEEDED.md. */
  /^(?:Quotation No\.|Prepared By|Size \/ Dimension|Unit Price|Grand Total|Description|Qty|Amount)$/i,
  /^(?:NO\.?\s*\d|\d+\s+LOT\b|LOT\s|OFF\s+JALAN|JALAN\s|TAMAN\s|\d{5}\s)/i,
  /^This is a computer-generated quotation/i,
  /^-\s/,                                        // a changelog bullet
  /^v\d+\.\d+/,                                  // a changelog version heading
  /* The page <title>s carry the brand and the version. */
  /^Sign In\s*·/i,
  /^Der-Cheng Quotation\b/i,
  /* Version Updates: a heading, a bullet, or one of the section labels the
     page groups its entries under. */
  /^(?:Changed|Fixed|Added|Improved|New|Removed):$/i,
  /* The printed quotation — see BUSINESS-DECISIONS-NEEDED.md §1. Its own
     labels, its letterhead, its address and its contact lines. */
  /^(?:Total|Date|Customer|No\.)$/,
  /^(?:Email|Tel|Fax):/i,
];
/* An attribute written as a literal is fine when the SAME element also carries
   the matching data-i18n-* hook: the literal is the English default that ships
   in the markup, and dcApplyLang overwrites it on every switch. It is a defect
   only when there is no hook, because then nothing ever rewrites it. */
const HOOK_FOR = { title: 'data-i18n-title', placeholder: 'data-i18n-ph',
                   'aria-label': 'data-i18n-aria', alt: 'data-i18n-alt' };
const lineAt = (src, index) => src.slice(0, index).split('\n').length;

/* Does every occurrence of this text sit inside an element that already
   carries a data-i18n hook? Read off the source itself. */
function isHooked(code, text) {
  let at = code.indexOf(text), seen = 0;
  while (at >= 0) {
    seen++;
    const open = code.lastIndexOf('<', at);
    const tag = open >= 0 ? code.slice(open, code.indexOf('>', open) + 1) : '';
    if (!/\bdata-i18n\b/.test(tag)) return false;
    at = code.indexOf(text, at + 1);
  }
  return seen > 0;
}

function hardCoded(src, code, dictRange) {
  const hits = [];
  /* An interpolation is not text a person reads; the English AROUND it is. */
  const stripInterp = t => String(t)
    /* `${…}` in a template literal … */
    .replace(/\$\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, ' ')
    /* … and the older `' + expr + '` concatenation, which is the same thing
       written the other way. Without this, half an expression reads as a
       label: `'Formerly '+qoEsc(h.previous_ref_no)+'` reported "Formerly"
       AND the variable name beside it. */
    .replace(/'\s*\+[^+]*\+\s*'/g, ' ')
    .replace(/`\s*\+[^+]*\+\s*`/g, ' ');
  const push = (line, kind, text) => {
    const t = String(text).trim();
    if (!t || !ENGLISH_RE.test(t)) return;
    if (SKIP_TEXT.some(r => r.test(t))) return;
    if (isCode(t)) return;
    if (/\bdcT\(/.test(t)) return;                  // it is translated
    hits.push({ line, kind, text: t.slice(0, 90) });
  };

  /* ── attributes, per element ─────────────────────────────────────────── */
  const tagRe = /<[a-zA-Z][^<>]*>/g;
  let tag;
  while ((tag = tagRe.exec(code)) !== null) {
    const t = tag[0];
    const line = lineAt(src, tag.index);
    for (const [attr, hook] of Object.entries(HOOK_FOR)) {
      if (t.includes(hook)) continue;               // the switch rewrites it
      /* Each quote style on its own: an attribute value may legitimately
         contain the OTHER quote inside an interpolation, and a pattern that
         stops at either one reports half an expression as a label. */
      const m = new RegExp('\\b' + attr + '="([^"]*)"').exec(t)
             || new RegExp("\\b" + attr + "='([^']*)'").exec(t);
      if (m) push(line, attr, stripInterp(m[1]));
    }
  }

  /* ── toasts and text nodes written from script ───────────────────────── */
  code.split('\n').forEach((ln, i) => {
    let m;
    const reToast = /\bshowToast\(\s*['"`]([^'"`]+)['"`]/g;
    while ((m = reToast.exec(ln)) !== null) push(i + 1, 'showToast', m[1]);
    const reText = /\.textContent\s*=\s*['"]([^'"]+)['"]/g;
    while ((m = reText.exec(ln)) !== null) push(i + 1, 'textContent', m[1]);
  });

  /* ── prose sitting BETWEEN tags in generated markup ──────────────────────
     The attribute scan above cannot see this, and neither can a dictionary
     count: a sentence written straight into a template literal has no key, so
     nothing reports it missing. It is where the longest strings live — the
     warning under Manual Price, the empty-state messages, the count lines.

     Only real sentences are reported. Four or more words of English between a
     > and a <, with no interpolation of its own, is prose somebody wrote;
     anything shorter is a label, a code or a unit and is left to the eye. */
  /* The OPENING tag is captured with the text, because an element carrying
     data-i18n has its textContent replaced on every switch — the literal in
     the markup is the English default, not a leak. Same rule as the attribute
     scan above. */
  /* ── Text between tags, with the interpolations taken out ────────────────
     This is where the checker was blind, and the blindness had a shape: the
     old scan refused any run containing `$` or `{`, so every label that had
     an interpolation NEXT TO its English was invisible.

         <label>Product${req ? ' *' : ''}</label>
         <span class="wqa-h wqa-h-size">Size</span>
         >${open ? 'Close' : 'Edit'}<

     The first two are hard-coded English on the Quick Add review; the third
     is two of them. All three read as "no match" and the file reported zero.

     So the interpolations are STRIPPED and what is left is the literal a
     person actually reads. A label built entirely from `${dcT(...)}` strips
     to nothing and is correctly silent; a label with one English word left
     standing is reported, however short it is — "Size", "Qty", "Price",
     "Edit", "History" are exactly the ones that were missed.

     One word is the threshold everywhere now. That is only workable because
     isCode() already knows the trade's vocabulary: M12, PL, SS304, 4140 QT,
     Sag Rod and the rest are not reported, because they are not words to
     translate. */
  const between = /<([a-zA-Z][\w-]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>([^<>]{2,})</g;
  let t;
  while ((t = between.exec(code)) !== null) {
    const attrs = t[2] || '';
    if (/\bdata-i18n\b/.test(attrs)) continue;          // the switch rewrites it
    const text = stripInterp(t[3]).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    /* Statements and arrow functions also sit between a > and a <. */
    if (/[;{}]|=>|\(\)|\|\||&&/.test(text)) continue;
    if (!text.split(' ').some(x => /[A-Za-z]{2,}/.test(x))) continue;
    push(lineAt(code, t.index), 'label', text);
  }

  /* ── Markup built inside a STRING, not written as markup ─────────────────
     `Saved quotes: <b>${n}</b> · Latest: …` is assigned to a variable and put
     into innerHTML later, so the tag scan above never sees it as an element —
     the English sits before and after a tag rather than between two of them.
     Any literal that contains an HTML tag is markup, so the tags and the
     interpolations come out and whatever English is left is a label. */
  const litRe = /`(?:[^`\\]|\\.)*`|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;
  let lit;
  while ((lit = litRe.exec(code)) !== null) {
    /* The dictionary is data, not markup: its values ARE the translations. */
    if (dictRange && lit.index >= dictRange[0] && lit.index <= dictRange[1]) continue;
    const body = lit[0].slice(1, -1);
    if (!/<[a-zA-Z/]/.test(body)) continue;             // not markup
    /* A template literal may contain another one inside an interpolation, and
       this tokenizer cannot see that nesting: the inner backtick closes the
       outer literal early and the body that comes out starts mid-expression.
       An unclosed `${` is the tell, and a body the tokenizer could not read
       is one it must not report on. */
    if (/\$\{/.test(stripInterp(body))) continue;
    const cleaned = stripInterp(body)
      /* An element inside the string that carries the hook is already
         translated; take the whole element out before the rest is read. */
      .replace(/<([a-zA-Z][\w-]*)[^<>]*\bdata-i18n\b[^<>]*>[^<>]*<\/\1>/g, '<>')
      .replace(/<[^<>]*\bdata-i18n\b[^<>]*>/g, '<>')
      .replace(/<[^<>]*$/, '<>');                       // a tag split across strings
    /* Each run BETWEEN tags is its own label. Joining them would hand isCode
       one long string — "MS S45C 4140 QT SS304 …" — that is nothing but trade
       vocabulary and would still read as prose. */
    for (const run of cleaned.split(/<[^<>]*>/)) {
      const text = run.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      if (/[;{}]|=>|\|\||&&/.test(text)) continue;
      if (!text.split(' ').some(x => /[A-Za-z]{2,}/.test(x))) continue;
      /* Checked against the SOURCE, not against this pass's own tokenizing.
         A template literal may nest another one inside an interpolation, and
         the tokenizer above cannot see that — so before reporting, look the
         text up where it really sits and see whether the element holding it
         carries the hook after all. */
      if (isHooked(code, text)) continue;
      push(lineAt(code, lit.index), 'markup in string', text);
    }
  }

  return hits;
}

const report = { files: {}, totals: {} };
let asserts = 0; const failures = [];
const ok = (cond, msg) => { asserts++; if (!cond) failures.push(msg); };

for (const file of FILES) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const dict = dictOf(src, file);
  if (!dict) { report.files[file] = { note: 'no I18N dictionary' }; continue; }

  const en = dict.en || {}, zh = dict.zh || {};
  const enKeys = Object.keys(en);
  const code = stripComments(src);
  const named = keysNamed(code);
  const referenced = keysReferenced(src, enKeys);

  const missingZh  = enKeys.filter(k => zh[k] === undefined);
  const missingKey = [...named].filter(k => en[k] === undefined && zh[k] === undefined);
  const identical  = enKeys.filter(k =>
    zh[k] !== undefined && String(zh[k]) === String(en[k])
    && !isCode(en[k]) && !isDeliberateZh(k));
  const unused     = enKeys.filter(k => !referenced.has(k));
  const raw        = hardCoded(src, code, dictRangeOf(src));

  report.files[file] = {
    enKeys: enKeys.length, zhKeys: Object.keys(zh).length,
    coverage: enKeys.length
      ? +(100 * (enKeys.length - missingZh.length) / enKeys.length).toFixed(1) : 100,
    missingZh, missingKey, identical, unused, hardCoded: raw,
  };

  ok(!missingZh.length,
    `${file}: every English string has a Chinese one — ${missingZh.length} missing: ${missingZh.slice(0, 12).join(', ')}`);
  ok(!missingKey.length,
    `${file}: every key the code names is defined — ${missingKey.length} undefined: ${missingKey.slice(0, 12).join(', ')}`);
  ok(!identical.length,
    `${file}: no non-code string is left in English in 中文 — ${identical.length}: ${identical.slice(0, 12).join(', ')}`);
  ok(!raw.length,
    `${file}: no user-visible string bypasses dcT — ${raw.length}: `
    + raw.slice(0, 6).map(h => `L${h.line} ${h.kind} ${JSON.stringify(h.text)}`).join(' · '));
}

const lines = [];
let tKeys = 0, tMissing = 0, tRaw = 0;
for (const [file, r] of Object.entries(report.files)) {
  if (r.note) { lines.push(`  ${file}: ${r.note}`); continue; }
  tKeys += r.enKeys; tMissing += r.missingZh.length; tRaw += r.hardCoded.length;
  lines.push(`  ${file.padEnd(15)} ${String(r.enKeys).padStart(4)} keys · ${String(r.coverage).padStart(5)}% translated`
    + ` · ${r.missingZh.length} missing zh · ${r.missingKey.length} undefined`
    + ` · ${r.identical.length} identical · ${r.hardCoded.length} hard-coded · ${r.unused.length} unused`);
}
report.totals = { keys: tKeys, missingZh: tMissing, hardCoded: tRaw };
console.log(lines.join('\n'));
console.log('');
console.log(`  ${failures.length ? 'FAIL' : 'ok  '}  translation coverage — ${tKeys} keys, both languages  (${asserts} assertions${failures.length ? ', ' + failures.length + ' failed' : ''})`);
if (failures.length) { console.log(''); failures.forEach(f => console.log('   - ' + f)); }

const jsonAt = process.argv.indexOf('--json');
if (jsonAt > 0 && process.argv[jsonAt + 1]) {
  fs.writeFileSync(process.argv[jsonAt + 1], JSON.stringify(report, null, 2));
}
process.exit(failures.length ? 1 : 0);
