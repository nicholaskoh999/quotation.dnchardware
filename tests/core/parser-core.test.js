/* ── Parser core, on its own ───────────────────────────────────────────────
   quo-parser-core.js is loaded three ways: by index.php, by Node, and bundled
   into DNC Quick Quote. The browser suites prove the first. This file proves
   the other two can work at all: the core runs with NO document, NO window and
   NO network, and it is wired into the page and the deploy list correctly.

   Run:  node tests/core/parser-core.test.js

   Every inquiry below is made up. This repository is public; real customer
   messages do not belong in it.                                             */
'use strict';
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const crypto = require('crypto');

const ROOT      = path.resolve(__dirname, '..', '..');
const CORE_PATH = path.join(ROOT, 'quo-parser-core.js');
const coreSrc   = fs.readFileSync(CORE_PATH, 'utf8');
const indexSrc  = fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL  ' + name); }
}
function eq(got, want, name) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.log('  FAIL  ' + name + '\n        got  ' + g + '\n        want ' + w); }
}

/* ── 1. Loads in a context that has nothing but the language ─────────────── */
const sandbox = { module: { exports: {} } };
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox, { filename: 'quo-parser-core.js' });
const core = sandbox.module.exports;
ok(typeof core.wqaParseText === 'function', 'core exports wqaParseText');
ok(typeof core.wqaRowMissing === 'function', 'core exports wqaRowMissing');
ok(/^\d+\.\d+\.\d+$/.test(core.QUO_PARSER_CORE_VERSION), 'core carries a semantic version');
eq(core.QUO_PARSER_CORE_CONTRACT, 1, 'core contract number');
for (const g of ['document', 'window', 'navigator', 'localStorage', 'fetch', 'XMLHttpRequest']) {
  ok(!(g in sandbox), 'the core did not need ' + g);
}

const plain = (v) => JSON.parse(JSON.stringify(v));
function parse(text) {
  const p = core.wqaParseText(text);
  return { p, rows: plain(p.rows), missing: p.rows.map((r) => plain(core.wqaRowMissing(r))) };
}
const pick = (r) => ({ product: r.product, material: r.material, finish: r.finish, sizeType: r.sizeType,
                       size: r.size, length: r.length, w: r.w, tl: core.wqaThreadValue(r), qty: r.qty });

/* ── 2. Heading → rows inheritance (sag rod) ─────────────────────────────── */
{
  const { rows, missing, p } = parse('MS SAG ROD UNDERSIZE (ZP)\nM12 X TL70/70\n1200 - 40pcs\n1500 - 12 pcs\n2350 - 6pcs');
  eq(rows.length, 3, 'sag rod: one row per length line');
  eq(rows.map(pick), [
    { product: 'sagrod', material: 'MS', finish: 'ZP', sizeType: 'UNDERSIZE', size: 'M12', length: '1200', w: '', tl: '70/70', qty: '40' },
    { product: 'sagrod', material: 'MS', finish: 'ZP', sizeType: 'UNDERSIZE', size: 'M12', length: '1500', w: '', tl: '70/70', qty: '12' },
    { product: 'sagrod', material: 'MS', finish: 'ZP', sizeType: 'UNDERSIZE', size: 'M12', length: '2350', w: '', tl: '70/70', qty: '6' },
  ], 'sag rod: heading values reach every row, lengths and quantities as written');
  eq(missing, [[], [], []], 'sag rod: nothing missing');
  eq(plain(core.wqaParseQuality(p, '')).ok, true, 'sag rod: parse quality ok');
}

/* ── 3. Missing thread length is named on every affected row ─────────────── */
{
  const { rows, missing, p } = parse('MS SAG ROD UNDERSIZE (ZP)\nM12\n1200 - 40pcs\n1500 - 12pcs');
  eq(rows.length, 2, 'missing TL: rows are still read');
  eq(missing, [['Thread'], ['Thread']], 'missing TL: each row asks for Thread');
  ok(p.rows.every((r) => core.wqaRowBlocked(r)), 'missing TL: each row is blocked');
}

/* ── 4. A row's own thread length beats the heading's ────────────────────── */
{
  const { rows } = parse('MS SAG ROD UNDERSIZE ZP M12 TL70/70\n1200 TL100/100 - 4pcs\n1500 - 12pcs');
  eq(rows.map((r) => core.wqaThreadValue(r)), ['100/100', '70/70'], 'row TL overrides heading TL; the other row inherits');
}

/* ── 5. One heading TL on a two-end product becomes a pair ───────────────── */
{
  const { rows } = parse('MS SAG ROD UNDERSIZE ZP M12 TL70\n1200 - 40pcs');
  eq(core.wqaThreadValue(rows[0]), '70/70', 'single TL on a sag rod is paired');
}

/* ── 6. Material wording → stocked material ──────────────────────────────── */
{
  const a = parse('G8.8 L-BOLT FULLSIZE (PLAIN)\nM20 X L600 X W100 X TL100 - 10PCS\nM20 X L1000 X W100 X TL100 - 20PCS');
  eq(a.rows.map(pick), [
    { product: 'lbolt', material: '4140', finish: 'PL', sizeType: 'FULLSIZE', size: 'M20', length: '600', w: '100', tl: '100', qty: '10' },
    { product: 'lbolt', material: '4140', finish: 'PL', sizeType: 'FULLSIZE', size: 'M20', length: '1000', w: '100', tl: '100', qty: '20' },
  ], 'L-bolt: G8.8 reads as 4140, with L, W and TL per row');
  eq(a.rows.map((r) => r.matFrom), ['G8.8', 'G8.8'], 'L-bolt: the customer wording is kept');
  eq(a.missing, [[], []], 'L-bolt: nothing missing when L, W and TL are given');

  eq(parse('GR 8.8 ANCHOR BOLT M24 X 600 TL100 - 16pcs HDG').rows[0].material, '4140', 'GR 8.8 reads as 4140');
  eq(parse('HT 8.8 ANCHOR BOLT M24 X 600 TL100 - 16pcs HDG').rows[0].material, '4140', 'HT 8.8 reads as 4140');
  eq(parse('GRADE 10.9 STUD M20 X 300 - 8 pcs').rows[0].material, '4340', '10.9 reads as 4340');
  eq(parse('MS ANCHOR BOLT HDG M16 x 400 TL80 - 20').rows[0].material, 'MS', 'MS stays MS');
}

/* ── 7. L-bolt without W or TL says so ───────────────────────────────────── */
{
  const { missing } = parse('G8.8 L-BOLT FULLSIZE PLAIN\nM20 L600 - 10PCS');
  eq(missing, [['W', 'Thread']], 'L-bolt: W and Thread are asked for by name');
}

/* ── 8. Finishes ─────────────────────────────────────────────────────────── */
eq(['PL', 'ZP', 'HDG'].map((f) => parse('MS SAG ROD UNDERSIZE ' + f + ' M12 TL70/70\n1200 - 4pcs').rows[0].finish),
   ['PL', 'ZP', 'HDG'], 'PL / ZP / HDG are each recognised');

/* ── 9. Custom Diameter Settings can be handed in ────────────────────────── */
ok(typeof core.quoParserCoreSetDiameterRules === 'function', 'host can supply diameter rules');
core.quoParserCoreSetDiameterRules([]);
eq(parse('MS SAG ROD UNDERSIZE ZP M12 TL70/70\n1200 - 4pcs').rows.length, 1, 'still parses after rules are set');

/* ── 10. Wired into the page exactly once, with the right fingerprint ────── */
{
  const sha = crypto.createHash('sha256').update(coreSrc, 'utf8').digest('hex');
  const tags = indexSrc.match(/<script src="quo-parser-core\.js\?v=([0-9a-f]{12})"><\/script>/g) || [];
  eq(tags.length, 1, 'index.php loads the core with one <script src>');
  ok(indexSrc.includes('quo-parser-core.js?v=' + sha.slice(0, 12)),
     'the ?v= value is the first 12 hex of the core\'s SHA-256 (' + sha.slice(0, 12) + ') — update it when the core changes');
  ok(indexSrc.indexOf('quo-parser-core.js') < indexSrc.lastIndexOf('<script>'), 'the core loads before the page script');
  for (const name of Object.keys(core)) {
    if (/^QUO_PARSER_CORE_|^quoParserCore/.test(name)) continue;
    const re = new RegExp('(?:^|\\n)\\s*(?:function\\s+' + name + '\\s*\\(|(?:const|let|var)\\s+' + name + '\\s*=)');
    ok(!re.test(indexSrc), 'index.php no longer declares ' + name);
  }
}

/* ── 11. On the deploy allowlist ─────────────────────────────────────────── */
{
  const yml = fs.readFileSync(path.join(ROOT, '.cpanel.yml'), 'utf8');
  const m = /export APPFILES="([^"]+)"/.exec(yml);
  ok(m && m[1].split(/\s+/).includes('quo-parser-core.js'), '.cpanel.yml APPFILES deploys quo-parser-core.js');
}

/* ── 12. Nothing here prices or formats ──────────────────────────────────── */
for (const name of ['calcSagRod', 'round05', 'roundCustom10', 'resolvePriceMode', 'buildQuoteText', 'buildWAItemsText']) {
  ok(!new RegExp('function\\s+' + name + '\\s*\\(').test(coreSrc), 'the core does not contain ' + name);
}

/* ── 13. 1.2.0: a shared heading is context, not an omitted item ───────────
   "M12 x TL70/70" over a list of lengths gives every row its size and thread.
   Since 34ab583 it was reported as a line that never became a row, holding Add.
   Synthetic inquiries only. */
{
  const om = (t) => core.wqaParseText(t).omitted;
  const rows = (t) => core.wqaParseText(t).rows.map((r) => [r.size, r.threadLen, r.threadLen2, r.length, r.qty].join('|'));
  const LIST = ['910 - 12pcs', '1180 - 30pcs', '1475 - 6 pcs', '2260 - 4pcs'];

  const a = ['M/S SAG ROD UNDERSIZE (HDG)', 'M12 X TL70/70'].concat(LIST).join('\n');
  eq(om(a), [], 'heading supplying size + TL to every row is not reported');
  eq(rows(a), ['M12|70|70|910|12', 'M12|70|70|1180|30', 'M12|70|70|1475|6', 'M12|70|70|2260|4'], 'heading rows unchanged');

  /* Two headings, each with its own rows. */
  const two = ['SAG ROD (ZP)', 'M12 X TL70/70', '910 - 12pcs', '', 'SAG ROD (HDG)', 'M16 x TL100/100', '1300 - 6pcs', '1420 - 2pcs'].join('\n');
  eq(om(two), [], 'two headings, both inherited: nothing reported');
  eq(rows(two), ['M12|70|70|910|12', 'M16|100|100|1300|6', 'M16|100|100|1420|2'], 'each block takes its own heading');

  /* Mixed: heading, inheriting rows, and rows that state their own size. */
  const mixed = ['SAG ROD', 'M12 X TL70/70', '910 - 12pcs', 'M16 x 1000 x TL100/100 - 5pcs'].join('\n');
  eq(om(mixed), [], 'mixed heading + own-size rows: heading consumed by the first row');
  eq(rows(mixed), ['M12|70|70|910|12', 'M16|100|100|1000|5'], 'mixed rows unchanged');

  /* Still reported. */
  const orphan = ['SAG ROD (ZP)', 'M12 X TL70/70', '', 'SAG ROD (HDG)', 'M16 x TL100/100', '1300 - 6pcs'].join('\n');
  eq(om(orphan), ['M12 X TL70/70'], 'a heading no row inherits from is still reported');
  eq(om(['SAG ROD', '910 - 12pcs', 'M12 X TL70/70'].join('\n')), ['M12 X TL70/70'],
     'a heading after the rows (no following row) is still reported');
  eq(om(['SAG ROD', 'M12 X TL70/70', 'M16 x 910 - 4pcs'].join('\n')), ['M12 X TL70/70'],
     'a heading whose size every following row overrode is still reported');
  eq(om(['SAG ROD', 'M12 X TL70/70', '910 x TL50/50 - 4pcs'].join('\n')), ['M12 X TL70/70'],
     'a heading whose thread every following row overrode is still reported');
  eq(om(['STUD', 'M12 X TL70/70', '910 - 4pcs'].join('\n')), ['M12 X TL70/70'],
     'a thread a Stud row cannot take leaves the heading reported');

  /* The completeness check itself still names an item line that made no row. */
  const fake = [{ t: 'M20 x 1500 x 10pcs', src: 'M20 x 1500 x 10pcs', f: { hadX: true, nums: [1500, 10], size: 'M20', threadLen: null, threadLen2: null } }];
  eq(sandbox.wqaTextOmitted(fake, [], new Set(), true, new Set()), ['M20 x 1500 x 10pcs'], 'an item line with no row is still reported');
  eq(sandbox.wqaTextOmitted(fake, [], new Set(), true, new Set([0])), [], 'only a line marked as consumed heading is skipped');

  /* 34ab583's multi-line L Bolt enquiry (suite 88 notation) is unaffected. */
  const lb = core.wqaParseText(['4140 full size L bolt pl', '42 x 964 x 210w x 214t', '39 x 1683 x 195w x 183t'].join('\n'));
  eq(lb.rows.length, 2, 'L Bolt multi-line: 2 rows');
  eq(lb.omitted, [], 'L Bolt multi-line: nothing omitted');
}

console.log('\n  parser core: ' + (pass + fail) + ' assertions, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
