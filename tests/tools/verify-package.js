/* ── Verify the ZIP that ships, not the tree it was built from ──────────────
   Every earlier round verified the working directory and then shipped an
   archive nobody had opened. The two were the same by construction — the
   builder reads `git show HEAD:<path>` — but "the same by construction" is a
   claim about a build script, and a reviewer receives bytes.

       node tests/tools/verify-package.js [QUOTATION-DNC-REVIEW.zip]

   Extracts into a fresh temporary directory, runs the canonical report
   checker against the EXTRACTED documents, recomputes every manifest digest
   from the extracted bytes, and checks the shipped application files against
   the accepted commit. Exit 1 on any finding.                              */
'use strict';
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const REPO = path.join(__dirname, '..', '..');
const ZIP = process.argv[2] || path.join(REPO, 'QUOTATION-DNC-REVIEW.zip');
const C = JSON.parse(fs.readFileSync(path.join(REPO, 'docs/control/CANONICAL-STATE.json'), 'utf8'));
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const git = (...a) => execFileSync('git', a, { cwd: REPO, maxBuffer: 1 << 28 });

const findings = [];
const ok = [];
const say = (good, msg) => { (good ? ok : findings).push((good ? 'ok   ' : 'FAIL ') + msg); return good; };

// ── read the archive ourselves ────────────────────────────────────────────
/* Unzipped by hand rather than by shelling out, so the bytes checked are the
   bytes in the file and not whatever a tool decided to write. */
function unzip(buf) {
  const out = new Map();
  let p = buf.length - 22;
  while (p >= 0 && buf.readUInt32LE(p) !== 0x06054b50) p--;
  if (p < 0) throw new Error('no end-of-central-directory record — not a ZIP');
  const count = buf.readUInt16LE(p + 10);
  let off = buf.readUInt32LE(p + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const usize = buf.readUInt32LE(off + 24);
    const nlen = buf.readUInt16LE(off + 28);
    const elen = buf.readUInt16LE(off + 30);
    const clen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen);
    const lnlen = buf.readUInt16LE(lho + 26), lelen = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lnlen + lelen;
    const raw = buf.subarray(start, start + csize);
    const data = method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
    if (data.length !== usize) throw new Error(`${name}: size mismatch`);
    out.set(name, data);
    off += 46 + nlen + elen + clen;
  }
  return out;
}

const buf = fs.readFileSync(ZIP);
const entries = unzip(buf);
const names = [...entries.keys()];
say(true, `read ${names.length} entries from ${path.basename(ZIP)} (${buf.length.toLocaleString('en-US')} bytes)`);

// ── extract into a fresh directory ────────────────────────────────────────
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dnc-verify-'));
for (const [n, d] of entries) {
  const p = path.join(DIR, n);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, d);
}
const ROOT = path.join(DIR, 'QUOTATION-DNC-REVIEW');
say(fs.existsSync(ROOT), `extracted to a fresh directory (${DIR})`);

// ── 1 · structure ─────────────────────────────────────────────────────────
const top = {};
names.forEach(n => { const k = n.split('/')[1]; top[k] = (top[k] || 0) + 1; });
const REQUIRED = ['SOURCE', 'EVIDENCE', 'REPORTS', 'LOGS', 'MANIFEST', 'docs'];
REQUIRED.forEach(d => say(top[d] > 0, `/${d}/ present (${top[d] || 0} files)`));

// ── 2 · forbidden content ─────────────────────────────────────────────────
say(!names.some(n => n.toLowerCase().endsWith('.zip')), 'no nested archives');
say(!names.some(n => /\/(db|ai_config)\.php$/.test(n)), 'no db.php or ai_config.php');
const dump = names.filter(n => n.includes('/SOURCE/quotation-dnc-final/') && !n.endsWith('.xlsx'));
say(dump.length === 0, `no historical delivery dump in SOURCE${dump.length ? ' — ' + dump.slice(0, 3).join(', ') : ''}`);
say(!names.some(n => /FULL-AUDIT\.zip|quotation-dnc-final\.zip/.test(n)), 'neither retired archive is inside');

// ── 3 · the manifest, recomputed from the extracted bytes ────────────────
const MAN = 'QUOTATION-DNC-REVIEW/' + C.package.manifestPath;
if (!entries.has(MAN)) say(false, `${C.package.manifestPath} is missing`);
else {
  const man = entries.get(MAN).toString('utf8');
  const rows = [...man.matchAll(/^  ([0-9a-f]{64})\s+(\d+)\s+(.+?)\s*$/gm)];
  say(rows.length > 0, `manifest lists ${rows.length} files with full 64-character digests`);
  let mism = 0, absent = 0;
  for (const [, digest, size, rel] of rows) {
    const key = 'QUOTATION-DNC-REVIEW/' + rel;
    if (!entries.has(key)) { absent++; continue; }
    const d = entries.get(key);
    if (sha256(d) !== digest || String(d.length) !== size) mism++;
  }
  say(absent === 0, `every manifest entry exists in the archive${absent ? ` — ${absent} missing` : ''}`);
  say(mism === 0, `every manifest digest recomputes from the extracted bytes${mism ? ` — ${mism} mismatched` : ''}`);
  /* the manifest covers everything except itself, which it cannot hash */
  const listed = new Set(rows.map(r => 'QUOTATION-DNC-REVIEW/' + r[3]));
  const unlisted = names.filter(n => !listed.has(n) && n !== MAN);
  say(unlisted.length === 0, `nothing in the archive is unlisted${unlisted.length ? ' — ' + unlisted.slice(0, 3).join(', ') : ''}`);
  say(man.includes(C.application.acceptedCommit), 'the manifest names the accepted application commit');
}

// ── 4 · the shipped application is the accepted application ──────────────
/* Or, where a round proposes a change to it, exactly and only the files that
   round declared — read from the SHIPPED ROUND-SCOPE, so the archive carries
   its own justification and a reviewer holding the ZIP can check the claim
   against the bytes beside it. An undeclared difference still fails. */
{
  const APP = C.application.acceptedCommit;
  const scopeEntry = entries.get('QUOTATION-DNC-REVIEW/docs/control/ROUND-SCOPE.md');
  const scopeText = scopeEntry ? scopeEntry.toString('utf8') : '';
  const block = /```candidate-files\r?\n([\s\S]*?)```/.exec(scopeText);
  const declared = new Set((block ? block[1] : '')
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean));
  const src = names.filter(n => n.startsWith('QUOTATION-DNC-REVIEW/SOURCE/'));
  const php = src.filter(n => n.endsWith('.php'));
  const differ = [];
  let gone = 0;
  for (const n of php) {
    const rel = n.slice('QUOTATION-DNC-REVIEW/SOURCE/'.length);
    let want;
    try { want = git('show', `${APP}:${rel}`); } catch (e) { gone++; continue; }
    if (!want.equals(entries.get(n))) differ.push(rel);
  }
  const undeclared = differ.filter(f => !declared.has(f));
  say(undeclared.length === 0,
    `all ${php.length} shipped PHP files match ${APP.slice(0, 7)} except where declared`
    + (undeclared.length ? ` — undeclared: ${undeclared.join(', ')}` : ''));
  if (differ.length) {
    say(true, `declared candidate, not yet accepted: ${differ.join(', ')}`
      + ` — the accepted commit is still ${APP.slice(0, 7)}`);
  }
  say(gone === 0, `and every one of them existed at that commit${gone ? ` — ${gone} did not` : ''}`);
}

// ── 5 · the canonical report checker, against the EXTRACTED documents ────
{
  let out = '', code = 0;
  try {
    out = execFileSync('node', [path.join(__dirname, 'check-reports.js'), '--root', ROOT],
      { cwd: REPO, maxBuffer: 1 << 26 }).toString('utf8');
  } catch (e) { out = (e.stdout || Buffer.alloc(0)).toString('utf8'); code = 1; }
  const m = out.match(/(\d+) checks, 0 disagreements/);
  say(code === 0 && !!m, `report checker over the extracted package: ${
    m ? m[1] + ' checks, 0 disagreements' : 'FAILED'}`);
  if (code !== 0) out.split('\n').filter(l => l.includes('FAIL')).forEach(l => findings.push('     ' + l.trim()));
}

// ── 6 · an independent contradiction scan over the extracted text ────────
/* Written separately from the checker on purpose. If both were the same code
   they would share the same blind spot, and sharing a blind spot is how this
   package shipped a stale number five times. */
{
  const T = C.tests, F = C.findings, TR = C.translation;
  const HIST = /historical|superseded|baseline|previously|earlier|no longer|used to|before this|resolved by|up from|larger than|and should not be quoted|oldest first|\| *baseline *\||overnight *\| *morning/i;
  let hits = 0;
  /* CANONICAL-STATE.json is the registry of retired values — naming them is
     its entire purpose, and it holds no prose a reader could mistake for a
     current claim. Its arithmetic, and its agreement with the .md, are checked
     separately; its history block is not scanned for the very figures it
     exists to record. */
  const docs = names.filter(n => /\/(REPORTS|docs)\//.test(n) && /\.(md|txt|json)$/.test(n)
    && !n.endsWith('CANONICAL-STATE.json'));
  for (const n of docs) {
    const text = entries.get(n).toString('utf8');
    /* Header-declared history tables and self-declared historical SECTIONS —
       the same two allowances the checker makes, written separately here so a
       mistake in one does not silently excuse the other.

       The section rule earned itself immediately: without it, the file whose
       job is to LIST retired figures was told not to name them. A registry
       failing its own rule is a scanner problem, not a document problem. */
    const lines = text.split('\n');
    let inHist = false, sectionDepth = 0, inFence = false;
    lines.forEach((line, i) => {
      const h = line.match(/^(#{1,6})\s/);
      if (h) {
        const d = h[1].length;
        if (/^#{1,6}\s+.*\b(superseded|historical|history|previous|earlier|retired|no longer current)\b/i.test(line)) {
          sectionDepth = d; return;
        }
        if (sectionDepth && d <= sectionDepth) sectionDepth = 0;
      }
      if (sectionDepth) return;
      /* A fence is quoted material. ROUND-SCOPE documents the exact stale row
         the checker must reject — reading that illustration as a claim would
         make it impossible to write down what is being guarded against. */
      if (/^\s*```/.test(line)) { inFence = !inFence; return; }
      if (inFence) return;
      const isRow = /^\s*\|/.test(line);
      if (!isRow) inHist = false;
      else if (!inHist && /\|\s*(?:baseline|overnight|morning|before|previous|old|was|then)\s*\|/i.test(line)) { inHist = true; return; }
      if (inHist || HIST.test(line)) return;
      const complain = w => { findings.push(`FAIL ${n.split('/').pop()}:${i + 1} ${w}\n       ${line.trim().slice(0, 90)}`); hits++; };
      (C.history.supersededAssertionTotals || []).forEach(v => {
        if (new RegExp(`\\b${v.toLocaleString('en-US').replace(',', ',?')}\\b`).test(line)) complain(`names the superseded total ${v}`); });
      (C.history.supersededTranslationKeys || []).forEach(v => {
        if (new RegExp(`\\b${v}\\b`).test(line)) complain(`names the superseded key count ${v}`); });
      (C.history.supersededDeltas || []).forEach(v => {
        if (new RegExp(`\\+\\s?${v.toLocaleString('en-US').replace(',', ',?')}\\b`).test(line)) complain(`names the superseded delta +${v}`); });
      if (/\bthe eight P1s?\b/i.test(line)) complain('says "the eight P1s"');
      if (C.history.retiredManifestName && line.includes(C.history.retiredManifestName))
        complain(`points at ${C.history.retiredManifestName}`);
      /* markdown severity cells, scanned independently of the checker */
      if (/^\s*\|/.test(line)) {
        const cells = line.split('|').slice(1, -1).map(c => c.trim().replace(/\*\*/g, ''));
        const label = (cells[0] || '').replace(/\s*\(.*\)\s*/, '').trim();
        const want = /^P0/i.test(label) ? F.p0 : /^P1/i.test(label) ? F.p1
                   : /^P2/i.test(label) ? F.p2 : /^P3/i.test(label) ? F.p3
                   : /recorded,?\s*not\s*repaired/i.test(label) ? F.recordedUnrepaired : null;
        if (want !== null) cells.slice(1).forEach(c => {
          const v = c.match(/^(\d+)$/); if (v && Number(v[1]) !== want) complain(`table cell ${label} = ${v[1]}, canonical ${want}`);
        });
      }
    });
  }
  say(hits === 0, `independent contradiction scan over ${docs.length} extracted documents`);

  /* and the canonical arithmetic, recomputed here rather than trusted */
  say(T.browserAssertions + T.pricingHistoryAssertions + T.aiExtractionAssertions
      + T.workbookAssertions + T.translationAssertions === T.finalAssertions,
    'canonical arithmetic: the five groups sum to the final total');
  say(T.finalAssertions - T.baselineAssertions === T.deltaAssertions,
    'canonical arithmetic: final − baseline = delta');
  say(F.p0 + F.p1 + F.p2 + F.p3 === F.total, 'canonical arithmetic: severities sum to the total');
  say(F.recordedUnrepairedIds.length === F.recordedUnrepaired,
    'canonical arithmetic: the recorded-not-repaired ids match their count');
  say(TR.missing === 0 && TR.hardcoded === 0 && TR.unapplied === 0,
    'canonical translation: nothing missing, hard-coded or unapplied');
}

// ── 7 · the evidence the round turns on ──────────────────────────────────
['C04-accessories-zero-selected', 'C04b-accessories-zero-selected-chinese']
  .forEach(n => say(names.some(x => x.includes(n)), `evidence in the archive: ${n}`));

// ── report ────────────────────────────────────────────────────────────────
console.log(`\n  PACKAGE VERIFICATION — extracted archive`);
console.log('  ' + '─'.repeat(74));
ok.forEach(l => console.log('  ' + l));
fs.rmSync(DIR, { recursive: true, force: true });
if (findings.length) {
  console.log('\n  ' + '─'.repeat(74));
  findings.forEach(l => console.log('  ' + l));
  console.log(`\n  ${findings.length} finding(s).\n`);
  process.exit(1);
}
console.log(`\n  ${ok.length} checks, 0 findings.`);
console.log(`  sha256 ${sha256(buf)}\n`);
