/* ── ONE archive for UI POLISH 2A ───────────────────────────────────────────
       /docs/control/  the four control files as they now stand
       /SOURCE/        the one application file this round changed, and the
                       tests and tools that prove it
       /REPORTS/       the round report, the measured results, the diff/scope
                       proof, and README-review.md
       /EVIDENCE/      the Evidence Contract — A, B and C — plus the recording
       /LOGS/          the runs, as they were produced, including the BASELINE
                       run at the accepted commit
       /MANIFEST/      inventory, full SHA-256, build metadata

   Deliberately this round and nothing else. Stage 0's and Stage 1's packages,
   the 96-frame audit pack and the earlier delivery dumps stay in the
   repository, which is where history belongs.

   Every source, report and evidence file is read with `git show HEAD:<path>`,
   so nothing uncommitted and nothing untracked can reach a reviewer.

       node tests/tools/build-ui-polish-2a-zip.js                             */
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

const NAME = 'QUOTATION-DNC-UI-POLISH-2A';
const HEAD = gitText('rev-parse', 'HEAD');
const APP_SHA = require('./authoritative').APP_SHA;      // the ACCEPTED commit

const tracked = new Set(gitText('ls-files').split('\n').filter(Boolean));
const need = p => {
  if (!tracked.has(p)) { console.error(`  MISSING (untracked or renamed): ${p}`); process.exit(1); }
  return p;
};

/* ── the gate ─────────────────────────────────────────────────────────────
   A package whose numbers disagree with each other is worse than no package,
   because it looks finished. */
try {
  execFileSync('node', [path.join(__dirname, 'check-reports.js')], { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('\n  Report consistency failed. The package is NOT built.\n');
  process.exit(1);
}

/* ── the candidate, DERIVED rather than asserted ──────────────────────────
   From the files ROUND-SCOPE declared, exactly as every round before it. */
const scopeTxt = blob('docs/control/ROUND-SCOPE.md').toString('utf8');
const candDecl = /```candidate-files\r?\n([\s\S]*?)```/.exec(scopeTxt);
const candFiles = (candDecl ? candDecl[1] : '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
if (!candFiles.length) { console.error('\n  ROUND-SCOPE declares no candidate files.\n'); process.exit(1); }
const CAND = gitText('log', '-1', '--format=%H', APP_SHA + '..HEAD', '--', ...candFiles);
if (!CAND) { console.error('\n  No commit touches the declared candidate files.\n'); process.exit(1); }

/* Undeclared application drift fails the build, not just the checker. */
const drift = gitText('diff', '--name-only', APP_SHA + '..HEAD', '--', '*.php')
  .split('\n').filter(Boolean).filter(f => !candFiles.includes(f));
if (drift.length) { console.error(`\n  UNDECLARED application change: ${drift.join(', ')}\n`); process.exit(1); }

const CONTROL = ['PROJECT-GUARDRAILS.md', 'CANONICAL-STATE.md', 'CANONICAL-STATE.json',
                 'ROUND-SCOPE.md'].map(f => 'docs/control/' + f);

/* db.php and ai_config.php do not exist in the repository at all — only their
   .sample.php forms — so no secret can be here. */
const SOURCE = [
  'index.php',
  'tests/lib/harness.js', 'tests/lib/assert.js', 'tests/run.js',
  'tests/suites/39-save-feedback.test.js',
  'tests/ui-polish-2a-shots.js',
  'tests/tools/authoritative.js',
  'tests/tools/check-reports.js',
  'tests/tools/build-ui-polish-2a-zip.js',
];

const REPORTS = [
  ['FULL-AUDIT/UI-POLISH-2A.md',            'UI-POLISH-2A.md'],
  ['FULL-AUDIT/UI-POLISH-2A-TEST-RESULTS.md','TEST-RESULTS.md'],
  ['FULL-AUDIT/UI-POLISH-2A-DIFF-PROOF.txt','DIFF-PROOF.txt'],
  ['FULL-AUDIT/UI-POLISH-2A-README-REVIEW.md','README-review.md'],
];

const EVIDENCE_DIR = 'FULL-AUDIT/ui-polish-2a/evidence';
const evidence = [...tracked].filter(p => p.startsWith(EVIDENCE_DIR + '/')).sort();

const LOG_DIR = 'FULL-AUDIT/ui-polish-2a/logs';
const LOGS = [...tracked].filter(p => p.startsWith(LOG_DIR + '/')).sort();

// ── assemble ──────────────────────────────────────────────────────────────
const entries = [];
const add = (name, data) => entries.push([name, data]);

CONTROL.forEach(p => add(`${NAME}/docs/control/${path.basename(p)}`, blob(need(p))));
SOURCE.forEach(p => add(`${NAME}/SOURCE/${p}`, blob(need(p))));
REPORTS.forEach(([src, n]) => add(`${NAME}/REPORTS/${n}`, blob(need(src))));
/* README-review.md at the archive root too, because that is where a reviewer
   opening the zip will look for it. */
add(`${NAME}/README-review.md`, blob(need('FULL-AUDIT/UI-POLISH-2A-README-REVIEW.md')));
evidence.forEach(p => add(`${NAME}/EVIDENCE/${path.basename(p)}`, blob(p)));
LOGS.forEach(p => add(`${NAME}/LOGS/${path.basename(p)}`, blob(p)));

const FORBIDDEN = [/(^|\/)db\.php$/, /(^|\/)ai_config\.php$/, /\.zip$/i];
for (const [n] of entries)
  for (const re of FORBIDDEN)
    if (re.test(n)) { console.error(`  FORBIDDEN ENTRY: ${n}`); process.exit(1); }

// ── /MANIFEST ─────────────────────────────────────────────────────────────
const runLog = blob(`${LOG_DIR}/browser-suite.log`).toString('utf8');
const runTail = (runLog.match(/^\s*\d+ suites, \d+ assertions, \d+ failed.*$/m) || [''])[0].trim();
const baseLog = blob(`${LOG_DIR}/baseline-3e89713-run.log`).toString('utf8');
const baseTail = (baseLog.match(/^\s*\d+ suites, \d+ assertions, \d+ failed.*$/m) || [''])[0].trim();
const rule = c => c.repeat(76);
const pad = (s, n) => String(s).padEnd(n);

const man = [
  'QUOTATION.DNC — UI POLISH 2A · SAVE SUCCESS MICRO-INTERACTION', rule('='), '',
  'ONE archive, covering UI POLISH 2A and nothing else.', '',
  '  WHAT IT DOES  A save now answers. The submitting button compresses while',
  '                the request is in flight, shows a check once the SERVER has',
  '                confirmed, the real saved values confirm themselves, the',
  '                existing toast speaks, and a ~500ms confirmation says what',
  '                was written. Then everything goes back to normal.', '',
  '  TWO CONFIRMATION SEMANTICS, and they are not interchangeable:',
  '    save_quotation writes the WHOLE quotation, so there is no single',
  '    affected row and this round invents none — the confirmation goes to',
  '    reviewListPanel, the container holding exactly the items that were',
  '    written, and no item row is singled out.',
  '    save_default_price writes ONE row, so there the confirmation goes to',
  '    that row and its neighbours stay clean.',
  '    EVIDENCE/06 proves the ROW semantics on the row-specific path. It does',
  '    not prove, and is not offered as proof of, the quotation path.', '',
  '  ALSO FIXED    Save Quotation had no in-flight guard: two clicks inside the',
  '                request window issued two POSTs. Four clicks now issue one.',
  '                Declared in ROUND-SCOPE as this round\'s one behaviour change.', '',
  '  UNCHANGED     the save payload, pricing, weight, DIA, Previous Price, the',
  '                parser, material rules, quotation numbering and ref_no',
  '                allocation, the database, auth, accessories carry-over,',
  '                numbering consistency, print/WhatsApp. Asserted, not asserted',
  '                to have been intended — see REPORTS/DIFF-PROOF.txt.', '',
  '  A CANDIDATE. Not accepted, not canonical, not deployed.', '',
  `ACCEPTED APPLICATION ${APP_SHA}`,
  `                     "${gitText('log', '-1', '--format=%s', APP_SHA)}"`,
  '                     The ACCEPTED application — STAGE 1, the final UI',
  '                     cleanup. docs/control/CANONICAL-STATE is the authority',
  '                     for it and it has NOT moved: this round is a candidate.',
  `CANDIDATE APPLICATION ${CAND}`,
  `                     "${gitText('log', '-1', '--format=%s', CAND)}"`,
  '                     NOT YET ACCEPTED. UI POLISH 2A proposes a change to',
  `                     ${candFiles.join(', ')}, declared by name in`,
  '                     docs/control/ROUND-SCOPE.md and DERIVED from that',
  '                     declaration rather than asserted. Every test figure in',
  '                     this package was measured on THIS tree.',
  `PACKAGE / HEAD       ${HEAD}`,
  `                     "${gitText('log', '-1', '--format=%s')}"`,
  `BRANCH               ${gitText('rev-parse', '--abbrev-ref', 'HEAD')}`,
  `BUILT                ${gitText('log', '-1', '--format=%cI')}`,
  '',
  'DEPLOY               NO. A candidate is not accepted, and accepted is not',
  '                     deployed. Only Nicholas may approve that.',
  '',
  'METHOD               every source, report, evidence file and log read with',
  '                     git show HEAD:<path>, so nothing uncommitted and',
  '                     nothing untracked is in this archive. Built only after',
  '                     tests/tools/check-reports.js passed.',
  '',
  'ABSENT ON PURPOSE    db.php and ai_config.php — they do not exist in the',
  '                     repository at all, only their .sample.php forms.',
  '                     No nested ZIP. No Stage 0 or Stage 1 packages, no',
  '                     96-frame audit pack, no superseded delivery dumps.',
  '',
  `TEST RUN             ${runTail}`,
  `BASELINE RUN         ${baseTail}   (at ${APP_SHA.slice(0, 7)}, for comparison)`,
  '',
  rule('-'), 'LAYOUT', rule('-'), '',
  `  /docs/control/ ${pad(CONTROL.length + ' files', 10)} what is protected, what this round may touch, and`,
  '                 the authoritative numbers. Read these first.',
  `  /SOURCE/       ${pad(SOURCE.length + ' files', 10)} the one application file this round changed, and`,
  '                 the tests and tools that prove it',
  `  /REPORTS/      ${pad(REPORTS.length + ' files', 10)} the round report, the measured results, the`,
  '                 diff/scope proof, and README-review.md',
  `  /EVIDENCE/     ${pad(evidence.length + ' files', 10)} Contract A (the quotation save, with a recording),`,
  '                 B (the exact-row save) and C (the gates)',
  `  /LOGS/         ${pad(LOGS.length + ' files', 10)} the runs, as they were produced`,
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
console.log(`    REPORTS    ${REPORTS.length} files (+ README-review.md at the root)`);
console.log(`    EVIDENCE   ${evidence.length} files`);
console.log(`    LOGS       ${LOGS.length} files`);
console.log(`    total      ${entries.length} files, ${out.length.toLocaleString('en-US')} bytes`);
console.log(`    sha256     ${sha256(out)}`);
console.log(`    ACCEPTED   ${APP_SHA}`);
console.log(`    CANDIDATE  ${CAND}`);
console.log(`    HEAD       ${HEAD}\n`);
