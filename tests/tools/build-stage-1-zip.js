/* ── ONE archive for Stage 1, and nothing that is not Stage 1 ───────────────
   A single package covering this stage only:

       /docs/control/  the four control files, as they now stand
       /SOURCE/        the application files this stage changed, and the tests
                       that prove them
       /REPORTS/       the Stage 1 report, and the test results the logs
                       reconcile to
       /EVIDENCE/      the Stage 1 frames, and the facts each one asserts
       /LOGS/          the runs, as they were produced
       /MANIFEST/      inventory, full SHA-256, build metadata

   Deliberately NOT the whole review package, and deliberately not Stage 0's
   either. The 96-frame audit pack, the earlier rounds' before/after sets, the
   Stage 0 accessory frames and the quotation-dnc-final delivery dump are all
   still in the repository, and none of them is Stage 1 — carrying them would
   make this archive look like a re-delivery of work already accepted.

   Every file is read with `git show HEAD:<path>` rather than copied from the
   working directory, so nothing uncommitted and nothing untracked can reach a
   reviewer.

       node tests/tools/build-stage-1-zip.js                                 */
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

const NAME = 'QUOTATION-DNC-STAGE-1-UI-FINAL';
const HEAD = gitText('rev-parse', 'HEAD');
const APP_SHA = require('./authoritative').APP_SHA;      // the ACCEPTED commit

const tracked = new Set(gitText('ls-files').split('\n').filter(Boolean));
const need = p => {
  if (!tracked.has(p)) { console.error(`  MISSING (untracked or renamed): ${p}`); process.exit(1); }
  return p;
};

// ── the gate ──────────────────────────────────────────────────────────────
/* A package whose numbers disagree with each other is worse than no package,
   because it looks finished. */
try {
  execFileSync('node', [path.join(__dirname, 'check-reports.js')], { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('\n  Report consistency failed. The package is NOT built.\n');
  process.exit(1);
}

// ── the candidate, derived rather than asserted ───────────────────────────
const scopeTxt = blob('docs/control/ROUND-SCOPE.md').toString('utf8');
const candDecl = /```candidate-files\r?\n([\s\S]*?)```/.exec(scopeTxt);
const candFiles = (candDecl ? candDecl[1] : '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
const CAND = candFiles.length
  ? gitText('log', '-1', '--format=%H', APP_SHA + '..HEAD', '--', ...candFiles) : '';

// ── what goes in ──────────────────────────────────────────────────────────
const CONTROL = ['PROJECT-GUARDRAILS.md', 'CANONICAL-STATE.md', 'CANONICAL-STATE.json',
                 'ROUND-SCOPE.md'].map(f => 'docs/control/' + f);

/* The application files Stage 0B changed, and the ones a reviewer needs beside
   them to read the change. db.php and ai_config.php do not exist in the
   repository at all — only their .sample.php forms — so no secret can be here. */
const SOURCE = [
  /* The two files this round changed, and nothing else from the application:
     both diffs are additive stylesheet rules inside media queries. */
  'index.php', 'companies.php',
  'tests/lib/harness.js', 'tests/lib/assert.js', 'tests/run.js',
  /* The suite that protects this round's two repairs and its two deferrals. */
  'tests/suites/38-mobile-ui.test.js',
  /* The accepted responsive suite it sits beside, so a reviewer can see the
     division of labour rather than guess at it. */
  'tests/suites/32-responsive.test.js',
  'tests/stage-1-shots.js',
  'tests/stage-1-print-shots.js',
  'tests/tools/authoritative.js',
  'tests/tools/check-reports.js',
  'tests/tools/check-translations.js',
  'tests/tools/build-stage-1-zip.js',
];

/* ── REPORTS, and one deliberate substitution ──────────────────────────────
   `[source, name-in-the-archive]`. Every pair but one is the identity.

   REPORTS/TEST-RESULTS.md is sourced from STAGE-1-TEST-RESULTS.md, not from
   FULL-AUDIT/TEST-RESULTS.md. The latter records the ACCEPTED state and is
   validated against CANONICAL-STATE, which still reads 37 suites and 4,070
   assertions for 98a31e3 — correct, and deliberately untouched, because Stage 1
   has passed review but has NOT been promoted. Shipping it inside a candidate
   package made it read as stale when it was simply describing a different tree.

   So the candidate package carries the CANDIDATE's measured run under that name,
   and that document says so in its own first lines. The accepted document stays
   accepted, and nothing was promoted to make a number agree. */
const REPORTS = [
  ['FULL-AUDIT/STAGE-1.md',              'STAGE-1.md'],
  ['FULL-AUDIT/STAGE-1-TEST-RESULTS.md', 'TEST-RESULTS.md'],
  ['FULL-AUDIT/COMMIT-INFO.txt',         'COMMIT-INFO.txt'],
];

/* Two sets, kept apart in the archive so a reviewer knows which is which and
   FACTS.json from one cannot overwrite FACTS.json from the other:

     EVIDENCE/ui/     the 430px scope control, the Companies tap targets,
                      the numbering across three surfaces
     EVIDENCE/print/  whole A4 sheets, before and after, plus the long one

   Both are regenerated by their scripts each time this round is re-run, so the
   archive carries THIS candidate's evidence and not an accumulation of every
   candidate that came before it. */
const EVIDENCE_SETS = [
  ['ui',    'FULL-AUDIT/stage-1/evidence'],
  ['print', 'FULL-AUDIT/stage-1/print-evidence'],
];
const evidence = EVIDENCE_SETS.flatMap(([sub, dir]) =>
  [...tracked].filter(p => p.startsWith(dir + '/')).sort().map(p => [sub, p]));
const EVIDENCE_INDEX = 'FULL-AUDIT/stage-1/INDEX.md';

/* The logs are produced by the run, not committed — a log is only honest if it
   is the output of the run that just happened. Read from disk, from the
   directory this build is pointed at. */
const LOG_DIR = process.env.DC_STAGE1_LOGS
  || path.join(ROOT, 'FULL-AUDIT/stage-1/logs');
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
evidence.forEach(([sub, p]) => add(`${NAME}/EVIDENCE/${sub}/${path.basename(p)}`, blob(p)));

const logsPresent = [];
LOGS.forEach(f => {
  const p = path.join(LOG_DIR, f);
  if (!fs.existsSync(p)) { console.error(`  MISSING LOG: ${p}`); process.exit(1); }
  logsPresent.push(f);
  add(`${NAME}/LOGS/${f}`, fs.readFileSync(p));
});

/* Nothing forbidden, checked rather than assumed. */
const FORBIDDEN = [/(^|\/)db\.php$/, /(^|\/)ai_config\.php$/, /\.zip$/i];
for (const [n] of entries) {
  for (const re of FORBIDDEN) {
    if (re.test(n)) { console.error(`  FORBIDDEN ENTRY: ${n}`); process.exit(1); }
  }
}

// ── /MANIFEST ─────────────────────────────────────────────────────────────
const runLog = fs.readFileSync(path.join(LOG_DIR, 'browser-suite.log'), 'utf8');
const runTail = (runLog.match(/^\s*\d+ suites, \d+ assertions, \d+ failed.*$/m) || [''])[0].trim();
const rule = c => c.repeat(76);
const pad = (s, n) => String(s).padEnd(n);

const man = [
  'QUOTATION.DNC — STAGE 1 PACKAGE · FINAL UI CLEANUP', rule('='), '',
  'ONE archive, covering Stage 1 and nothing else.', '',
  '  REPAIRED   430px APPLY TO — the label was stranded 318px from the',
  '             buttons it names, on a different row. It is now directly',
  '             above them. Nothing above 640px changed.',
  '  REPAIRED   Companies mobile tap targets — the language pair and the',
  '             modal close reach 44x44 on a phone. The close was 17x24,',
  '             and on a phone it is the only way out of a modal.',
  '  REPAIRED   Print / PDF A4 quotation layout — added when the round was',
  '             reopened on review. 9.6pt rows, a 52mm Description, money in',
  '             tabular numerals, a 13pt Grand Total over a 2pt rule, and',
  '             multi-page made explicit. Every figure unchanged: four items',
  '             still print four priced rows, cw 2nut still carries no money,',
  '             and the sheet still totals RM 284.80.',
  '  VERIFIED   Numbering — the same item carries the same number on screen,',
  '             on paper and in the message. Only the ORDER differs.',
  '  DEFERRED   Dark mode (there is none to polish) and numbering ORDER',
  '             (a data-generation change). Both to Stage 2.', '',
  '  A CANDIDATE. Not accepted, not canonical, not deployed.', '',
  `ACCEPTED APPLICATION ${APP_SHA}`,
  `                     "${gitText('log', '-1', '--format=%s', APP_SHA)}"`,
  '                     The ACCEPTED application — STAGE 0B, the',
  '                     accessory-inclusive final unit price. docs/control/',
  '                     CANONICAL-STATE is the authority for it, and it has',
  '                     NOT moved: Stage 1 is a candidate.',
  ...(CAND ? [
  `CANDIDATE APPLICATION ${CAND}`,
  `                     "${gitText('log', '-1', '--format=%s', CAND)}"`,
  '                     NOT YET ACCEPTED. Stage 1 proposes a change to',
  `                     ${candFiles.join(', ')},`,
  '                     declared by name in docs/control/ROUND-SCOPE.md. Every',
  '                     test figure in this package was measured on THIS tree.',
  '                     The accepted commit above does not become this one',
  '                     until Nicholas accepts the stage.',
  ] : [
  'CANDIDATE APPLICATION none declared. The candidate-files block in',
  '                     ROUND-SCOPE.md is empty, which is the strictest state',
  '                     that control has: nothing may differ from the accepted',
  '                     commit, and any drift fails.',
  ]),
  `PACKAGE / HEAD       ${HEAD}`,
  `                     "${gitText('log', '-1', '--format=%s')}"`,
  '                     The commit this archive was built from.',
  `BRANCH               ${gitText('rev-parse', '--abbrev-ref', 'HEAD')}`,
  `BUILT                ${gitText('log', '-1', '--format=%cI')}`,
  '',
  'DEPLOY               NO. Accepted is not deployed. Nothing has been',
  '                     deployed, and only Nicholas may approve that.',
  '',
  'METHOD               every source, report and evidence file read with',
  '                     git show HEAD:<path>, so nothing uncommitted and',
  '                     nothing untracked is in this archive. The logs are read',
  '                     from the run that produced them. Built only after',
  '                     tests/tools/check-reports.js passed.',
  '',
  'ABSENT ON PURPOSE    db.php and ai_config.php — they do not exist in the',
  '                     repository at all, only their .sample.php forms.',
  '                     No nested ZIP. No Stage 0 accessory frames, no',
  '                     96-frame audit pack, no superseded delivery dumps:',
  '                     they remain in the repository, which is where history',
  '                     belongs, and none of them is Stage 1.',
  '',
  `TEST RUN             ${runTail}`,
  '',
  rule('-'), 'LAYOUT', rule('-'), '',
  `  /docs/control/ ${pad(CONTROL.length + ' files', 10)} what is protected, what Stage 0B was allowed to`,
  '                 touch, and the authoritative numbers. Read these first.',
  `  /SOURCE/       ${pad(SOURCE.length + ' files', 10)} the two application files this stage changed,`,
  '                 and the tests and tools that prove them',
  `  /REPORTS/      ${pad(REPORTS.length + ' files', 10)} the Stage 1 report, the CANDIDATE's measured test`,
  '                 results (which the LOGS reconcile to, and which are NOT',
  '                 canonical), and the generated commit facts',
  `  /EVIDENCE/     ${pad((evidence.length + 1) + ' files', 10)} ui/ and print/ — this round's frames and the facts`,
  '                 each one asserts. Regenerated per candidate, not',
  '                 accumulated across them.',
  `  /LOGS/         ${pad(logsPresent.length + ' files', 10)} the runs, as they were produced`,
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
console.log(`    EVIDENCE   ${evidence.length + 1} files`);
console.log(`    LOGS       ${logsPresent.length} files`);
console.log(`    total      ${entries.length} files, ${out.length.toLocaleString('en-US')} bytes`);
console.log(`    sha256     ${sha256(out)}`);
console.log(`    ACCEPTED   ${APP_SHA}`);
console.log(`    CANDIDATE  ${CAND || '(none declared)'}`);
console.log(`    HEAD       ${HEAD}\n`);
