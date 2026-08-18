/* ── ONE archive, laid out for a reviewer ───────────────────────────────────
   Nicholas asked for a single direct download instead of two, organised so
   the thing he wants is where he would look for it:

       /SOURCE/     the application, exactly as committed
       /REPORTS/    the audit documents, and the current round's report
       /EVIDENCE/   the frames worth looking at, before and after
       /LOGS/       the authoritative run, and the checkers
       /MANIFEST/   inventory, full SHA-256, build metadata

       node tests/tools/build-review-zip.js

   Every file is read with `git show HEAD:<path>` rather than copied from the
   working directory, so nothing uncommitted and nothing untracked can reach a
   reviewer. The report-consistency checker runs first and this refuses to
   build if it fails — a package whose numbers disagree with each other is
   worse than no package, because it looks finished.                        */
'use strict';
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 28 });
const gitText = (...a) => git(...a).toString('utf8').trim();
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

// ── the gate ──────────────────────────────────────────────────────────────
try {
  execFileSync('node', [path.join(__dirname, 'check-reports.js')],
    { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('\n  Report consistency failed. The package is NOT built.\n');
  process.exit(1);
}

const HEAD = gitText('rev-parse', 'HEAD');
/* Pinned, and shared with the checker. Deriving it from `git log` moved it
   three times in one round: every commit touching tests/ shifted it out from
   under the reports that had just named it. */
const APP_SHA = require('./authoritative').APP_SHA;
const tracked = gitText('ls-files').split('\n').filter(Boolean);
const blob = p => git('show', 'HEAD:' + p);

// ── what goes where ───────────────────────────────────────────────────────
const REPORTS = ['EXECUTIVE-SUMMARY.md', 'FULL-AUDIT-REPORT.md', 'FINDINGS.md',
                 'TEST-RESULTS.md', 'TRANSLATION-AUDIT.md',
                 'BUSINESS-DECISIONS-NEEDED.md', 'COMMIT-INFO.txt',
                 /* A round that changes the application ships its own account
                    of what it changed, beside the audit that accepted the
                    state it started from. */
                 'UI-POLISH-1.md', 'UI-POLISH-2.md'];

/* The 25 proofs the brief names, mapped to the frames that carry them. Named
   explicitly rather than swept in by prefix, so a frame that stops existing
   is a build error rather than a silent omission — and so the archive holds
   the evidence a reviewer was promised instead of everything ever rendered. */
const KEY_EVIDENCE = [
  ['01 · compact, the ordinary review',        'R01-compact-twenty-items.png'],
  ['02 · expanded',                            'P06-expanded-item.png'],
  ['03 · Fast Edit over every row',            'R04-fast-edit-active.png'],
  ['04 · Fast Edit, controls locked',          'E08-edit-locks.png'],
  ['05 · DIA default',                         'E04-m12-fullsize-12.png'],
  ['06 · DIA manual',                          'E06-manual-dia-10_7.png'],
  ['07 · DIA undersize, the other M12',        'E05-m12-undersize-10_6.png'],
  ['08 · Esc restores value AND provenance',   'R17-esc-restores-provenance.png'],
  ['09 · Bulk Edit, common fields',            'R05-bulk-common-fields.png'],
  ['10 · Bulk Edit, pricing',                  'R06-bulk-pricing.png'],
  ['11 · Bulk Edit, accessories',              'R07-bulk-accessories.png'],
  ['12 · four selected',                       'R08-four-selected.png'],
  ['13 · pricing applied to those four alone', 'R09-selected-pricing-applied.png'],
  ['14 · the message names the four',          'C01-selected-apply-message.png'],
  ['15 · and says "all items" only when true', 'C02-all-items-apply-message.png'],
  ['16 · the same message in 中文',             'C03-selected-apply-message-chinese.png'],
  ['17 · zero selected, refused',              'R10-zero-selected-refused.png'],
  ['18 · accessories refuse a zero selection', 'C04-accessories-zero-selected.png'],
  ['19 · the same refusal in 中文',              'C04b-accessories-zero-selected-chinese.png'],
  ['20 · Details, one row',                    'R03-details-open.png'],
  ['21 · Expanded, no fake Close',             'R11-expanded-no-fake-close.png'],
  ['22 · History open',                        'R11-history-open.png'],
  ['23 · History, sticky header and count',    'R12-history-sticky-header.png'],
  ['24 · Previous Price identity invalidated', 'C06-previous-price-invalidated.png'],
  ['25 · Qty absent becomes 1',                '04-absent-qty-defaults-to-1.png'],
  ['26 · ambiguous Qty blocked, own line',     '33-ambiguous-qty-needs-qty.png'],
  ['27 · ambiguous Qty blocked, inline',       'C07-inline-ambiguous-qty.png'],
  ['28 · an item number is not a length',      'C08-item-number-not-a-length.png'],
  ['29 · an unknown size shows no bar',        'C09-unknown-size-no-bar.png'],
  ['30 · 中文 compact',                         'R13-chinese-compact.png'],
  ['31 · 中文 Bulk Edit',                       'R14-chinese-bulk-edit.png'],
  ['32 · 中文 Details',                         'R15-chinese-details.png'],
  ['33 · narrow desktop, 1366',                'R16-selection-1366.png'],
  ['34 · Companies',                           '22-company-list.png'],
  ['35 · parser · imperial UNC',               '06-half-inch-unc.png'],
  ['36 · parser · imperial BSW',               '07-half-inch-bsw.png'],
  ['37 · the verified M24 calculation',        'F-m24-pricing-verified.png'],
];

const LOGS = ['browser-suite.log', 'browser-suite.json', 'pricing-history-php.log',
              'ai-extract-php.log', 'pricing-workbook.log', 'translation-coverage.log',
              'translation-coverage.json', 'php-lint.log', 'responsive-matrix.log',
              'quantity-suite.log', 'language-suite.log', 'rendered-i18n-suite.log',
              'row-meta-suite.log', 'edit-mode-suite.log', 'diameter-suite.log',
              'roles-suite.log'];

const entries = [];
const add = (name, data) => entries.push([name, data]);
const missing = [];

// ── /SOURCE ───────────────────────────────────────────────────────────────
/* The application, its tests and the files needed to reproduce them — and
   nothing else. `quotation-dnc-final/` is a delivery folder from earlier
   rounds: 103 files of superseded reports, root-cause notes and screenshot
   packs, 7.3MB of history that a reviewer of THIS round has no use for. It is
   left in the repository, where history belongs, and kept out of the package.

   One file inside it is not history. pricing-engine-v2-input.xlsx is the
   workbook the pricing-workbook check actually validates, and TEST-RESULTS
   names the exact command that reads it — so the package would otherwise
   document a check it could not reproduce. It travels at its repository path
   so that command still works. */
const HISTORICAL_DELIVERY = 'quotation-dnc-final/';
const KEEP_ANYWAY = new Set(['quotation-dnc-final/pricing-engine-v2-input.xlsx']);
const dropped = [];
const srcFiles = tracked.filter(p => {
  if (p.startsWith('FULL-AUDIT/')) return false;
  if (p.startsWith(HISTORICAL_DELIVERY) && !KEEP_ANYWAY.has(p)) { dropped.push(p); return false; }
  return true;
});
srcFiles.forEach(p => add('QUOTATION-DNC-REVIEW/SOURCE/' + p, blob(p)));

// ── /REPORTS ──────────────────────────────────────────────────────────────
REPORTS.forEach(r => {
  const p = 'FULL-AUDIT/' + r;
  if (!tracked.includes(p)) return missing.push(p);
  add('QUOTATION-DNC-REVIEW/REPORTS/' + r, blob(p));
});

// ── /EVIDENCE ─────────────────────────────────────────────────────────────
/* Numbered by the proof, not by the file, so the directory reads in the order
   a reviewer would work through it. */
const evidenceIndex = [];
KEY_EVIDENCE.forEach(([label, file]) => {
  const tries = ['FULL-AUDIT/screenshots/' + file, 'FULL-AUDIT/after-fix/' + file];
  const hit = tries.find(t => tracked.includes(t));
  if (!hit) return missing.push(file);
  const n = label.slice(0, 2);
  add(`QUOTATION-DNC-REVIEW/EVIDENCE/${n}-${file}`, blob(hit));
  evidenceIndex.push(`  ${label}\n      ${n}-${file}`);
});
/* before/after pairs, kept whole because they are the argument */
tracked.filter(p => p.startsWith('FULL-AUDIT/before-fix/'))
  .forEach(p => add('QUOTATION-DNC-REVIEW/EVIDENCE/before-fix/' + path.basename(p), blob(p)));
/* UI POLISH 1 travels the same way, and for the same reason: a visual round is
   argued in pairs, so the two directories ship whole rather than as a chosen
   handful. Swept by prefix because the pair is the unit — a frame that stops
   existing simply stops shipping, and its absence is visible in the manifest
   count rather than hidden behind a name that no longer resolves. */
const polishFrames = tracked.filter(p => /^FULL-AUDIT\/ui-polish-[0-9]+\//.test(p));
polishFrames.forEach(p => add(
  'QUOTATION-DNC-REVIEW/EVIDENCE/' + p.slice('FULL-AUDIT/'.length), blob(p)));

// ── /docs/control ─────────────────────────────────────────────────────────
/* The control files travel WITH the package, not only in the repository. A
   reviewer holding the ZIP can then see what was protected, what this round
   was allowed to touch, and which numbers are authoritative — without taking
   any of that from the reports being reviewed. */
const CONTROL = ['PROJECT-GUARDRAILS.md', 'ROUND-SCOPE.md',
                 'CANONICAL-STATE.md', 'CANONICAL-STATE.json'];
CONTROL.forEach(f => {
  const p = 'docs/control/' + f;
  if (!tracked.includes(p)) return missing.push(p);
  add('QUOTATION-DNC-REVIEW/docs/control/' + f, blob(p));
});

// ── /LOGS ─────────────────────────────────────────────────────────────────
LOGS.forEach(l => {
  const p = 'FULL-AUDIT/regression-evidence/' + l;
  if (!tracked.includes(p)) return missing.push(p);
  add('QUOTATION-DNC-REVIEW/LOGS/' + l, blob(p));
});

if (missing.length) {
  console.error('\n  These were named for the package and are not in the repository:');
  missing.forEach(m => console.error('    ' + m));
  console.error('\n  The package is NOT built. A manifest must never claim a file '
    + 'the archive does not hold.\n');
  process.exit(1);
}

// ── /MANIFEST ─────────────────────────────────────────────────────────────
const runLog = fs.readFileSync(path.join(ROOT, 'FULL-AUDIT/regression-evidence/browser-suite.log'), 'utf8');
const runTail = (runLog.match(/^\s*\d+ suites, \d+ assertions, \d+ failed.*$/m) || [''])[0].trim();
const rule = c => c.repeat(76);
const pad = (s, n) => String(s).padEnd(n);

/* ── accepted, candidate, and the commit this archive was built from ───────
   Three different things, and the manifest used to name only one of them —
   calling the accepted commit "the last commit that changed application code"
   and crediting it with every figure in the package. While a round is under
   review neither is true: the last application-changing commit is the
   candidate, and that is the tree the tests actually ran against. Derived from
   the history of the files ROUND-SCOPE declares, so it cannot be asserted by
   hand and cannot be forgotten when a round closes. */
const scopeTxt = blob('docs/control/ROUND-SCOPE.md').toString('utf8');
const candDecl = /```candidate-files\r?\n([\s\S]*?)```/.exec(scopeTxt);
const candFiles = (candDecl ? candDecl[1] : '').split(/\r?\n/)
  .map(l => l.trim()).filter(Boolean);
const CAND = candFiles.length
  ? gitText('log', '-1', '--format=%H', APP_SHA + '..HEAD', '--', ...candFiles) : '';
const appLines = CAND ? [
  `ACCEPTED APPLICATION ${APP_SHA}`,
  `                     "${gitText('log', '-1', '--format=%s', APP_SHA)}"`,
  '                     The accepted application. docs/control/CANONICAL-STATE',
  '                     is the authority for it, and it has not moved.',
  `CANDIDATE APPLICATION ${CAND}`,
  `                     "${gitText('log', '-1', '--format=%s', CAND)}"`,
  `                     NOT YET ACCEPTED. This round proposes a change to`,
  `                     ${candFiles.join(', ')}, declared in ROUND-SCOPE.md.`,
  '                     Every test figure in this package was measured on THIS',
  '                     tree. The accepted commit above does not become this',
  '                     one until the round is accepted.',
] : [
  `APPLICATION COMMIT   ${APP_SHA}`,
  `                     "${gitText('log', '-1', '--format=%s', APP_SHA)}"`,
  '                     The last commit that changed application or test code.',
  '                     Every figure in every report was measured against it.',
];

const man = [
  'QUOTATION.DNC — REVIEW PACKAGE', rule('='), '',
  'One archive, laid out for a reviewer. GitHub carries the same commits as',
  'history; nothing here needs to be fetched from it.', '',
  ...appLines,
  `PACKAGE / HEAD       ${HEAD}`,
  `                     "${gitText('log', '-1', '--format=%s')}"`,
  '                     The commit this archive was built from. It may sit',
  '                     after the application commit above, carrying evidence,',
  '                     reports and packaging only.',
  `BRANCH               ${gitText('rev-parse', '--abbrev-ref', 'HEAD')}`,
  `BUILT                ${gitText('log', '-1', '--format=%cI')}`,
  '',
  'DEPLOY               NO. Nothing has been deployed.',
  '',
  'METHOD               every file read with git show HEAD:<path>, so nothing',
  '                     uncommitted and nothing untracked is in this archive.',
  '                     Built only after tests/tools/check-reports.js passed:',
  '                     the SHAs, the finding totals, the test totals and the',
  '                     evidence claims are checked against their one source',
  '                     each, and the build refuses if any disagree.',
  '',
  `TEST RUN             ${runTail}`,
  '',
  rule('-'), 'LAYOUT', rule('-'), '',
  `  /docs/control/ ${pad(CONTROL.length + ' files', 10)} what is protected, what this round could touch,`,
  '                 and the authoritative numbers everything is checked',
  '                 against. Read these before the reports.',
  `  /SOURCE/     ${pad(srcFiles.length + ' files', 12)} the application, its tests, and what they need`,
  '               db.php and ai_config.php are ABSENT — server-only secrets',
  `               ${dropped.length} files of earlier-round delivery history were left out;`,
  '               they remain in the repository, which is where history belongs.',
  '               pricing-engine-v2-input.xlsx is kept from that folder because',
  '               TEST-RESULTS names the command that reads it.',
  `  /REPORTS/    ${pad(REPORTS.length + ' files', 12)} the audit documents and this round's report`,
  `  /EVIDENCE/   ${pad(evidenceIndex.length + ' frames', 12)} the proofs, numbered in reading order`,
  `               ${pad(polishFrames.length + ' frames', 12)} ui-polish-N/, each round's before and after`,
  '               before-fix/  the defects as they were',
  `  /LOGS/       ${pad(LOGS.length + ' files', 12)} the authoritative run and the checkers`,
  '  /MANIFEST/   this file',
  '',
  rule('-'), 'EVIDENCE, IN READING ORDER', rule('-'), '',
].concat(evidenceIndex).concat([
  '', rule('-'), 'CONTENTS — full 64-character SHA-256', rule('-'), '',
  `  ${pad('SHA-256', 64)}  ${pad('BYTES', 10)}  PATH`, '',
]);
entries.forEach(([n, d]) => man.push(
  `  ${sha256(d)}  ${String(d.length).padStart(10)}  ${n.replace('QUOTATION-DNC-REVIEW/', '')}`));
man.push('', `  ${entries.length + 1} files in total (this manifest included).`, '', rule('-'), 'END');
const manBuf = Buffer.from(man.join('\n') + '\n', 'utf8');
add('QUOTATION-DNC-REVIEW/MANIFEST/MANIFEST.txt', manBuf);

// ── the archive ───────────────────────────────────────────────────────────
let TABLE = null;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let i = 0; i < 256; i++) { let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[i] = c; }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function zip(list) {
  const chunks = [], dir = [];
  let offset = 0;
  for (const [name, data] of list) {
    const nb = Buffer.from(name, 'utf8');
    const body = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nb.length, 26); local.writeUInt16LE(0, 28);
    chunks.push(local, nb, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0x21, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nb.length, 28); cen.writeUInt32LE(offset, 42);
    dir.push(Buffer.concat([cen, nb]));
    offset += local.length + nb.length + body.length;
  }
  const cd = Buffer.concat(dir);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(list.length, 8); end.writeUInt16LE(list.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, end]);
}

const out = zip(entries);
fs.writeFileSync(path.join(ROOT, 'QUOTATION-DNC-REVIEW.zip'), out);

console.log('\n  QUOTATION-DNC-REVIEW.zip');
console.log(`    SOURCE     ${srcFiles.length} files`);
console.log(`    REPORTS    ${REPORTS.length} files`);
console.log(`    EVIDENCE   ${evidenceIndex.length} frames + before-fix/`);
console.log(`    LOGS       ${LOGS.length} files`);
console.log(`    total      ${entries.length} files, ${out.length.toLocaleString('en-US')} bytes`);
console.log(`    sha256     ${sha256(out)}`);
console.log(`    APP        ${APP_SHA}`);
console.log(`    HEAD       ${HEAD}\n`);
