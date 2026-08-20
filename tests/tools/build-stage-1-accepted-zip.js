/* ── ONE archive for the STAGE 1 FINAL ACCEPTANCE ───────────────────────────
   Stage 1 was reviewed and accepted. This archive carries the acceptance, and
   only the acceptance:

       /docs/control/  the four control files as they now stand, with the
                       promotion in them
       /SOURCE/        the two application files the stage changed, and the
                       tests and tools that prove them
       /REPORTS/       the accepted Stage 1 report, the accepted test results,
                       the generated commit facts, and the consistency results
       /EVIDENCE/      only the already-reviewed frames needed to prove the four
                       things this stage claims
       /LOGS/          the accepted run
       /MANIFEST/      inventory, full SHA-256, build metadata

   NOT an accumulation. The candidate package
   QUOTATION-DNC-STAGE-1-UI-FINAL.zip is superseded by this one and is not
   carried inside it; the Stage 0 accessory frames, the 96-frame audit pack and
   the earlier delivery dumps stay in the repository, which is where history
   belongs. Two print PDFs from the candidate pack are deliberately left out —
   the superseded BEFORE sheet and the long multi-page sheet, both of which ship
   here as whole-page rasters instead. Nothing else was dropped.

   `docs/control/` rather than `CONTROL/` because that is the path
   tests/tools/check-reports.js --root reads, so an extracted copy of this
   archive can be re-verified by the same checker that gated it.

   Every source, report and evidence file is read with `git show HEAD:<path>`,
   so nothing uncommitted and nothing untracked can reach a reviewer, and the
   extracted bytes are the committed bytes by construction.

       node tests/tools/build-stage-1-accepted-zip.js                        */
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
const blob = p => git('show', 'HEAD:' + p);

const NAME = 'QUOTATION-DNC-STAGE-1-UI-FINAL-ACCEPTED';
const HEAD = gitText('rev-parse', 'HEAD');
const APP_SHA = require('./authoritative').APP_SHA;      // now the STAGE 1 commit
const PREV_SHA = '98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac';

const tracked = new Set(gitText('ls-files').split('\n').filter(Boolean));
const need = p => {
  if (!tracked.has(p)) { console.error(`  MISSING (untracked or renamed): ${p}`); process.exit(1); }
  return p;
};

// ── the gates ─────────────────────────────────────────────────────────────
/* A package whose numbers disagree with each other is worse than no package,
   because it looks finished. Both checks run before a byte is written. */
for (const gate of ['check-reports.js', 'check-control.js']) {
  try {
    execFileSync('node', [path.join(__dirname, gate)], { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error(`\n  ${gate} failed. The package is NOT built.\n`);
    process.exit(1);
  }
}

/* The candidate block must be EMPTY now, and the build refuses if it is not:
   an accepted package that still declares a candidate is a contradiction. */
const scopeTxt = blob('docs/control/ROUND-SCOPE.md').toString('utf8');
const candDecl = /```candidate-files\r?\n([\s\S]*?)```/.exec(scopeTxt);
const candFiles = (candDecl ? candDecl[1] : '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
if (candFiles.length) {
  console.error(`\n  ROUND-SCOPE still declares a candidate: ${candFiles.join(', ')}`);
  console.error('  An ACCEPTED package may not be built over an open candidate.\n');
  process.exit(1);
}
const drift = gitText('diff', '--name-only', APP_SHA + '..HEAD', '--', '*.php');
if (drift) { console.error(`\n  application PHP differs from the accepted commit: ${drift}\n`); process.exit(1); }

// ── what goes in ──────────────────────────────────────────────────────────
const CONTROL = ['PROJECT-GUARDRAILS.md', 'CANONICAL-STATE.md', 'CANONICAL-STATE.json',
                 'ROUND-SCOPE.md'].map(f => 'docs/control/' + f);

/* db.php and ai_config.php do not exist in the repository at all — only their
   .sample.php forms — so no secret can be here. */
const SOURCE = [
  'index.php', 'companies.php',
  'tests/lib/harness.js', 'tests/lib/assert.js', 'tests/run.js',
  'tests/suites/38-mobile-ui.test.js',
  'tests/suites/32-responsive.test.js',
  'tests/stage-1-shots.js',
  'tests/stage-1-print-shots.js',
  'tests/tools/authoritative.js',
  'tests/tools/check-reports.js',
  'tests/tools/check-control.js',
  'tests/tools/check-translations.js',
  'tests/tools/build-stage-1-accepted-zip.js',
];

const REPORTS = [
  ['FULL-AUDIT/STAGE-1.md',              'STAGE-1.md'],
  ['FULL-AUDIT/TEST-RESULTS.md',         'TEST-RESULTS.md'],
  ['FULL-AUDIT/COMMIT-INFO.txt',         'COMMIT-INFO.txt'],
  ['FULL-AUDIT/STAGE-1-CONSISTENCY.txt', 'CONSISTENCY.txt'],
];

/* Only the frames a reviewer needs to judge the four claims, kept in the two
   subdirectories they were captured in so FACTS.json from one cannot overwrite
   FACTS.json from the other. Each name is listed rather than globbed, so a file
   cannot join this archive by being written into a directory. */
const EVIDENCE = [
  ['ui', '01a-430-apply-to-before.png'], ['ui', '01b-430-apply-to-after.png'],
  ['ui', '02-430-review-no-overflow.png'], ['ui', '03-desk-1440-unchanged.png'],
  ['ui', '04-companies-430-header.png'], ['ui', '05-companies-430-page.png'],
  ['ui', '06-companies-430-modal-actions.png'], ['ui', '07-companies-desk-unchanged.png'],
  ['ui', '08-numbering-screen.png'], ['ui', '09-numbering-whatsapp.png'],
  ['ui', '10-numbering-print.png'], ['ui', 'FACTS.json'], ['ui', 'INDEX.txt'],
  ['print', '01-print-before-p1.png'],
  ['print', '02-print-after-4-items-p1.png'], ['print', '02-print-after-4-items.pdf'],
  ['print', '03-print-accessory-and-alignment.png'], ['print', '04-print-grand-total.png'],
  ['print', '05-print-long-multipage-p1.png'], ['print', '05-print-long-multipage-p2.png'],
  ['print', 'FACTS.json'], ['print', 'INDEX.txt'],
].map(([sub, f]) => [sub, `FULL-AUDIT/stage-1/${sub === 'ui' ? 'evidence' : 'print-evidence'}/${f}`]);
const EVIDENCE_INDEX = 'FULL-AUDIT/stage-1/INDEX.md';

/* The ACCEPTED logs, which are now committed under regression-evidence/ —
   the same run, promoted with the matrix it produced. */
const LOG_DIR = 'FULL-AUDIT/regression-evidence';
const LOGS = ['browser-suite.log', 'browser-suite.json', 'pricing-history-php.log',
              'ai-extract-php.log', 'pricing-workbook.log', 'translation-coverage.log',
              'translation-coverage.json', 'php-lint.log'];

// ── assemble ──────────────────────────────────────────────────────────────
const entries = [];
const add = (name, data) => entries.push([name, data]);

CONTROL.forEach(p => add(`${NAME}/docs/control/${path.basename(p)}`, blob(need(p))));
SOURCE.forEach(p => add(`${NAME}/SOURCE/${p}`, blob(need(p))));
REPORTS.forEach(([src, name]) => add(`${NAME}/REPORTS/${name}`, blob(need(src))));
add(`${NAME}/EVIDENCE/INDEX.md`, blob(need(EVIDENCE_INDEX)));
EVIDENCE.forEach(([sub, p]) => add(`${NAME}/EVIDENCE/${sub}/${path.basename(p)}`, blob(need(p))));
LOGS.forEach(f => add(`${NAME}/LOGS/${f}`, blob(need(`${LOG_DIR}/${f}`))));

/* Nothing forbidden, checked rather than assumed. */
const FORBIDDEN = [/(^|\/)db\.php$/, /(^|\/)ai_config\.php$/, /\.zip$/i];
for (const [n] of entries)
  for (const re of FORBIDDEN)
    if (re.test(n)) { console.error(`  FORBIDDEN ENTRY: ${n}`); process.exit(1); }

// ── /MANIFEST ─────────────────────────────────────────────────────────────
const runLog = blob(`${LOG_DIR}/browser-suite.log`).toString('utf8');
const runTail = (runLog.match(/^\s*\d+ suites, \d+ assertions, \d+ failed.*$/m) || [''])[0].trim();
const rule = c => c.repeat(76);
const pad = (s, n) => String(s).padEnd(n);

const man = [
  'QUOTATION.DNC — STAGE 1 · FINAL UI CLEANUP · FINAL ACCEPTED', rule('='), '',
  'ONE archive, covering the Stage 1 acceptance and nothing else.', '',
  '  ACCEPTED   430px APPLY TO — the label was stranded on a different row',
  '             from the buttons it names. It is now directly above them,',
  '             and nothing above 640px changed.',
  '  ACCEPTED   Companies mobile tap targets — the language pair and the',
  '             modal close reach 44x44 on a phone. The close was 17x24,',
  '             and on a phone it is the only way out of a modal. The desk',
  '             sizes are asserted unchanged in the same suite.',
  '  ACCEPTED   Print / PDF A4 quotation layout — added when the round was',
  '             reopened on review. 9.6pt rows, a 52mm Description, money in',
  '             tabular numerals, a 13pt Grand Total over a 2pt rule, and',
  '             multi-page made explicit. Every figure unchanged: four items',
  '             still print four priced rows, cw 2nut still carries no money,',
  '             and the sheet still totals RM 284.80.',
  '  VERIFIED   Numbering identity — the same item carries the same number on',
  '             screen, on paper and in the message. Only the ORDER differs.',
  '  DEFERRED   Dark mode (there is none to polish) and numbering ORDER',
  '             (a data-generation change). Both to Stage 2, and neither was',
  '             converted into an accepted behaviour change.', '',
  '  FINAL ACCEPTED / CLOSED. Canonical. NOT DEPLOYED.', '',
  `ACCEPTED APPLICATION ${APP_SHA}`,
  `                     "${gitText('log', '-1', '--format=%s', APP_SHA)}"`,
  '                     The ACCEPTED application, promoted when Stage 1 was',
  '                     accepted. docs/control/CANONICAL-STATE is the authority',
  '                     for it and now reads this commit. Derived, not asserted:',
  '                     it is the last commit touching index.php and',
  '                     companies.php, the two files ROUND-SCOPE declared.',
  `PREVIOUS ACCEPTED    ${PREV_SHA}`,
  `                     "${gitText('log', '-1', '--format=%s', PREV_SHA)}"`,
  '                     SUPERSEDED by the commit above. STAGE 0B, the',
  '                     accessory-inclusive final unit price — that rule is',
  '                     untouched by Stage 1 and is still protected. This SHA',
  '                     must never be quoted as the current one.',
  'CANDIDATE APPLICATION none. The candidate-files block in ROUND-SCOPE.md is',
  '                     empty, which is the strictest state that control has:',
  '                     nothing may differ from the accepted commit, and any',
  '                     drift fails by name. This build refuses to run over a',
  '                     block that is not empty.',
  `PACKAGE / HEAD       ${HEAD}`,
  `                     "${gitText('log', '-1', '--format=%s')}"`,
  '                     The commit this archive was built from. It carries',
  '                     reports, control files and packaging only — no',
  '                     application or browser-test byte differs from the',
  '                     accepted commit above.',
  `BRANCH               ${gitText('rev-parse', '--abbrev-ref', 'HEAD')}`,
  `BUILT                ${gitText('log', '-1', '--format=%cI')}`,
  '',
  'REGRESSION           NOT re-run for this acceptance, deliberately. No',
  '                     application byte and no browser-test byte moved between',
  '                     the reviewed candidate run and this promotion, proven',
  '                     by two empty diffs recorded in REPORTS/STAGE-1.md.',
  '                     The matrix below was promoted as measured.',
  '',
  'DEPLOY               NO. Accepted is not deployed. Nothing has been',
  '                     deployed, and only Nicholas may approve that.',
  'STAGE 2              NOT STARTED.',
  '',
  'METHOD               every source, report, evidence file and log read with',
  '                     git show HEAD:<path>, so nothing uncommitted and',
  '                     nothing untracked is in this archive and the extracted',
  '                     bytes ARE the committed bytes. Built only after',
  '                     check-reports.js and check-control.js both passed.',
  '',
  'ABSENT ON PURPOSE    db.php and ai_config.php — they do not exist in the',
  '                     repository at all, only their .sample.php forms.',
  '                     No nested ZIP. The superseded candidate package is not',
  '                     carried inside this one. No Stage 0 accessory frames,',
  '                     no 96-frame audit pack, no superseded delivery dumps:',
  '                     they remain in the repository, which is where history',
  '                     belongs, and none of them is Stage 1.',
  '',
  `TEST RUN             ${runTail}`,
  '',
  rule('-'), 'LAYOUT', rule('-'), '',
  `  /docs/control/ ${pad(CONTROL.length + ' files', 10)} what is protected, the closed round scope, and the`,
  '                 authoritative numbers. Read these first.',
  `  /SOURCE/       ${pad(SOURCE.length + ' files', 10)} the two application files this stage changed, and`,
  '                 the tests and tools that prove them',
  `  /REPORTS/      ${pad(REPORTS.length + ' files', 10)} the accepted Stage 1 report, the accepted test`,
  '                 results the LOGS reconcile to, the generated commit facts,',
  '                 and the consistency results',
  `  /EVIDENCE/     ${pad((EVIDENCE.length + 1) + ' files', 10)} ui/ and print/ — the already-reviewed frames that`,
  '                 prove the 430px scope control, the Companies mobile',
  '                 targets, the A4 sheet and numbering identity',
  `  /LOGS/         ${pad(LOGS.length + ' files', 10)} the accepted run, as it was produced`,
  '  /MANIFEST/     this file',
  '',
  rule('-'), 'CONTENTS — full 64-character SHA-256', rule('-'), '',
  `  ${pad('SHA-256', 64)}  ${pad('BYTES', 10)}  PATH`, '',
];
entries.forEach(([n, d]) => man.push(
  `  ${sha256(d)}  ${String(d.length).padStart(10)}  ${n.replace(NAME + '/', '')}`));
man.push('', `  ${entries.length + 1} files in total (this manifest included).`, '', rule('-'), 'END');
add(`${NAME}/MANIFEST/MANIFEST.txt`, Buffer.from(man.join('\n') + '\n', 'utf8'));

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
fs.writeFileSync(path.join(ROOT, NAME + '.zip'), out);

console.log(`\n  ${NAME}.zip`);
console.log(`    control    ${CONTROL.length} files`);
console.log(`    SOURCE     ${SOURCE.length} files`);
console.log(`    REPORTS    ${REPORTS.length} files`);
console.log(`    EVIDENCE   ${EVIDENCE.length + 1} files`);
console.log(`    LOGS       ${LOGS.length} files`);
console.log(`    total      ${entries.length} files, ${out.length.toLocaleString('en-US')} bytes`);
console.log(`    sha256     ${sha256(out)}`);
console.log(`    ACCEPTED   ${APP_SHA}`);
console.log(`    SUPERSEDED ${PREV_SHA}`);
console.log(`    HEAD       ${HEAD}\n`);
