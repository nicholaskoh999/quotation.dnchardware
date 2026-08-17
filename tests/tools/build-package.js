/* ── The two archives, built from the committed tree ────────────────────────
   Nicholas gets both by hand, not from a repository page, so they are built
   here rather than by whatever a person happens to zip. Every file in either
   archive is read with `git show HEAD:<path>` — not copied from the working
   directory — so no uncommitted edit and no untracked file can reach a
   reviewer by accident.

       node tests/tools/build-package.js

   Writes, beside the repository root:

       quotation-dnc-final.zip   the application source at HEAD
       FULL-AUDIT.zip            the evidence package
       ZIP-MANIFEST.txt          the source archive's manifest

   Digests are the FULL 64 hexadecimal characters of SHA-256. An earlier
   manifest printed the first sixteen under a column headed "sha256", which is
   a prefix wearing the name of the whole thing — a reviewer cannot check a
   file against it, and a truncated digest is not the digest.               */
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
const HEAD = gitText('rev-parse', 'HEAD');
const tracked = gitText('ls-files').split('\n').filter(Boolean);

/* ── A ZIP, written by hand ────────────────────────────────────────────────
   Small and deliberate: the alternative is shelling out to a zip tool and
   hoping it took its bytes from the same place. These bytes come from Git. */
function zip(entries) {
  const chunks = [], dir = [];
  let offset = 0;
  const DOS_TIME = 0, DOS_DATE = 0x21;      // a fixed stamp: same input, same archive
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const body = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);                       // names are UTF-8
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12); central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(0, 42);                          // patched below
    central.writeUInt32LE(offset, 42);
    dir.push(Buffer.concat([central, nameBuf]));
    offset += local.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(dir);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, centralBuf, end]);
}

let TABLE = null;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[i] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const pad = (s, n) => String(s).padEnd(n);
const rule = c => c.repeat(78);

function contents(rows) {
  /* Full digests, and a heading that says so. */
  return [rule('-'), 'CONTENTS', rule('-'), '',
    `  ${pad('SHA-256 (full, 64 hex)', 64)}  ${pad('BYTES', 10)}  PATH`, '']
    .concat(rows.map(([n, d]) => `  ${sha256(d)}  ${String(d.length).padStart(10)}  ${n}`));
}

// ══ 1 · the source archive ═════════════════════════════════════════════════
const srcEntries = tracked.map(p => ['quotation-dnc-final/' + p, git('show', 'HEAD:' + p)]);
const srcZip = zip(srcEntries);
fs.writeFileSync(path.join(ROOT, 'quotation-dnc-final.zip'), srcZip);

const appSha = gitText('rev-parse', process.env.DC_APP_SHA || 'HEAD');
const man = [
  'QUOTATION.DNC — RELEASE ARCHIVE MANIFEST', rule('='), '',
  'Generated when the archive is built, because it records the commit the',
  'archive was built FROM — the one thing a committed file cannot state about',
  'itself. Not in Git.', '',
  `ARCHIVE       quotation-dnc-final.zip`,
  `BUILT FROM    ${HEAD}`,
  `              ${gitText('log', '-1', '--format=%s')}`,
  `              ${gitText('log', '-1', '--format=%cI')}`,
  `APPLICATION   ${appSha}`,
  '              The last commit that changed application or test code.',
  '              Every figure in FULL-AUDIT is the figure it produced.',
  'METHOD        every entry read with git show HEAD:<path>, so nothing',
  '              uncommitted and nothing untracked can reach this archive.',
  'DEPLOY        NO. For review. Nothing has been deployed.', '',
  rule('-'), 'VERIFICATION', rule('-'), '',
  `  entries in archive          ${srcEntries.length}`,
  `  files in git ls-files       ${tracked.length}`,
  `  set-identical               ${srcEntries.length === tracked.length ? 'YES' : 'NO'}`,
  '  db.php / ai_config.php      ABSENT — server-only secrets, gitignored',
  `  archive size                ${srcZip.length.toLocaleString('en-US')} bytes`,
  `  archive sha256              ${sha256(srcZip)}`, '',
].concat(contents(srcEntries.map(([n, d]) => [n.replace('quotation-dnc-final/', ''), d])))
 .concat(['', rule('-'), 'END OF MANIFEST']);
const manBuf = Buffer.from(man.join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(ROOT, 'ZIP-MANIFEST.txt'), manBuf);

// ══ 2 · the evidence archive ═══════════════════════════════════════════════
const auditFiles = tracked.filter(p => p.startsWith('FULL-AUDIT/'));
const auditRows = auditFiles.map(p => [p.replace('FULL-AUDIT/', ''), git('show', 'HEAD:' + p)]);

const aMan = [
  'QUOTATION.DNC — FULL AUDIT PACKAGE MANIFEST', rule('='), '',
  'The audit evidence, handed over directly. Not the application: the source',
  'ships separately as quotation-dnc-final.zip. They are two downloads, not a',
  'nested pair.', '',
  `BUILT FROM    ${HEAD}   (${gitText('log', '-1', '--format=%cI')})`,
  `APPLICATION   ${appSha}`,
  'DEPLOY        NO. Nothing has been deployed.',
  'SOURCE        every file read with git show HEAD:<path>, so the evidence',
  '              in this archive is the evidence in the repository.', '',
  rule('-'), 'WHAT IS INSIDE', rule('-'), '',
  '  REPORTS',
  '    EXECUTIVE-SUMMARY.md         the round in one read',
  '    FULL-AUDIT-REPORT.md         every audit section, in full',
  '    FINDINGS.md                  every defect, with its fix and its proof',
  '    TEST-RESULTS.md              the full matrix, suite by suite',
  '    TRANSLATION-AUDIT.md         EN/中文 coverage, source and rendered DOM',
  '    BUSINESS-DECISIONS-NEEDED.md the open decisions for Nicholas',
  '    COMMIT-INFO.txt              every commit, and what it changed', '',
  '  EVIDENCE',
  '    screenshots/                 the numbered evidence set + INDEX.txt',
  '    before-fix/                  the defect as it was',
  '    after-fix/                   the same state after the fix',
  '    regression-evidence/         raw run logs and machine-readable results', '',
  '  MANIFESTS',
  '    FULL-AUDIT-ZIP-MANIFEST.txt  this file',
  "    ZIP-MANIFEST.txt             the SOURCE archive's manifest, included",
  '                                 here because the reports reference it', '',
  rule('-'), 'THE SOURCE ARCHIVE, FOR CROSS-CHECKING', rule('-'), '',
  `  size    ${srcZip.length.toLocaleString('en-US')} bytes`,
  `  sha256  ${sha256(srcZip)}`, '',
].concat(contents(auditRows.concat([['ZIP-MANIFEST.txt', manBuf]])))
 .concat(['', rule('-'), 'END OF MANIFEST']);
const aManBuf = Buffer.from(aMan.join('\n') + '\n', 'utf8');

const auditZip = zip(
  [['FULL-AUDIT/FULL-AUDIT-ZIP-MANIFEST.txt', aManBuf],
   ['FULL-AUDIT/ZIP-MANIFEST.txt', manBuf]]
  .concat(auditRows.map(([n, d]) => ['FULL-AUDIT/' + n, d])));
fs.writeFileSync(path.join(ROOT, 'FULL-AUDIT.zip'), auditZip);

console.log(`  quotation-dnc-final.zip   ${srcEntries.length} files   `
  + `${srcZip.length.toLocaleString('en-US')} bytes`);
console.log(`  FULL-AUDIT.zip            ${auditRows.length + 2} files   `
  + `${auditZip.length.toLocaleString('en-US')} bytes`);
console.log(`  ZIP-MANIFEST.txt          full 64-hex SHA-256 per file`);
console.log(`  HEAD                      ${HEAD}`);
console.log(`  APPLICATION               ${appSha}`);
