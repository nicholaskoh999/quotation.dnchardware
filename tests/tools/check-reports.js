/* ── The reports are checked against a truth they cannot influence ──────────
   Four rounds running, the package shipped with a figure that had been true
   once. Every version of this checker that passed while a stale number sat on
   disk failed for the same underlying reason, in different clothes:

     · it matched `\bP1\b`, which does not match "P1s";
     · it only questioned four-figure assertion counts, so "843 keys" was
       never a candidate;
     · it exempted any line carrying a `+number` as "that's a delta", which is
       exactly the shape a stale delta has — "+869 this round" walked through
       on the strength of its own plus sign;
     · it read prose and never markdown TABLE CELLS, so
       `| **P1** high | 8 | 8 |` was invisible to it;
     · it never counted the recorded-not-repaired observations at all;
     · and, underneath all of it, it DERIVED what to expect from the same
       documents it was checking. A number that was wrong everywhere agreed
       with itself.

   So the structure changed rather than the patterns. The single source of
   expected values is docs/control/CANONICAL-STATE.json — outside the reports,
   outside this file, versioned, and changed only when a new state is accepted.
   Everything below reads it and asserts against it.

       node tests/tools/check-reports.js              # check the repository
       node tests/tools/check-reports.js --write      # regenerate COMMIT-INFO
       node tests/tools/check-reports.js --root DIR   # check an EXTRACTED package
       node tests/tools/check-reports.js --self-test  # prove the checker catches
                                                      # the fixtures it once missed
   Exit 1 on any disagreement, so packaging cannot proceed over it.         */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').trim();

// ══ CANONICAL TRUTH ═══════════════════════════════════════════════════════
const CANON_PATH = path.join(REPO, 'docs/control/CANONICAL-STATE.json');
const C = JSON.parse(fs.readFileSync(CANON_PATH, 'utf8'));

const fail = [], note = [];
const check = (ok, msg) => { (ok ? note : fail).push((ok ? 'ok   ' : 'FAIL ') + msg); return ok; };
const fmt = n => n.toLocaleString('en-US');
const bad = (where, msg) => fail.push(`FAIL ${where} ${msg}`);

// ══ 0 · the canonical file's own arithmetic ═══════════════════════════════
/* Checked FIRST, because everything else trusts it. A canonical file that does
   not add up is worse than none: it lends its authority to a wrong number. */
{
  const t = C.tests, f = C.findings;
  const sum = t.browserAssertions + t.pricingHistoryAssertions
            + t.aiExtractionAssertions + t.workbookAssertions + t.translationAssertions;
  check(sum === t.finalAssertions,
    `canonical: ${fmt(t.browserAssertions)}+${t.pricingHistoryAssertions}+${t.aiExtractionAssertions}`
    + `+${t.workbookAssertions}+${t.translationAssertions} = ${fmt(sum)} = finalAssertions`);
  check(t.finalAssertions - t.baselineAssertions === t.deltaAssertions,
    `canonical: ${fmt(t.finalAssertions)} − ${fmt(t.baselineAssertions)} = ${fmt(t.deltaAssertions)} = delta`);
  check(f.p0 + f.p1 + f.p2 + f.p3 === f.total,
    `canonical: ${f.p0}+${f.p1}+${f.p2}+${f.p3} = ${f.total} = total findings`);
  check(f.recordedUnrepairedIds.length === f.recordedUnrepaired,
    `canonical: ${f.recordedUnrepairedIds.length} recorded-not-repaired ids = ${f.recordedUnrepaired}`);
  check(C.schemaVersion === 1, `canonical schemaVersion ${C.schemaVersion}`);
}

// ══ where the documents are ═══════════════════════════════════════════════
/* Two layouts: the repository (FULL-AUDIT/…) and an EXTRACTED package
   (REPORTS/…, LOGS/…). The same checks run over either, because verifying the
   working tree and shipping a different ZIP is a gap this round exists to
   close. */
const rootArg = process.argv.indexOf('--root');
const EXTRACTED = rootArg > 0 ? process.argv[rootArg + 1] : null;

function layout() {
  if (!EXTRACTED) {
    const A = path.join(REPO, 'FULL-AUDIT');
    return { label: 'repository', docs: A, logs: path.join(A, 'regression-evidence'),
             shots: path.join(A, 'screenshots'), control: path.join(REPO, 'docs/control') };
  }
  const R = path.resolve(EXTRACTED);
  const inner = fs.existsSync(path.join(R, 'REPORTS')) ? R : path.join(R, 'QUOTATION-DNC-REVIEW');
  return { label: 'extracted package', docs: path.join(inner, 'REPORTS'),
           logs: path.join(inner, 'LOGS'), shots: path.join(inner, 'EVIDENCE'),
           control: path.join(inner, 'docs/control'), root: inner };
}
const L = layout();
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const has = (dir, f) => fs.existsSync(path.join(dir, f));

const REPORTS = ['EXECUTIVE-SUMMARY.md', 'FULL-AUDIT-REPORT.md', 'FINDINGS.md',
                 'TEST-RESULTS.md', 'TRANSLATION-AUDIT.md', 'BUSINESS-DECISIONS-NEEDED.md'];
const ALL_DOCS = REPORTS.concat(['COMMIT-INFO.txt']);
const JSON_ARTIFACTS = ['translation-coverage.json', 'browser-suite.json'];

const doc = f => read(L.docs, f);

// ══ what a line is allowed to say ═════════════════════════════════════════
/* A report describing its own history is doing something useful, so a line
   that plainly labels itself may name a superseded figure. The labels are
   explicit and narrow — "superseded", "baseline", "historical", "up from" —
   because a generous exemption is how the last three holes were opened. */
const HISTORICAL = /historical|superseded|baseline|previously|earlier|former|no longer|used to|before this|at the time|and should not be quoted|oldest first|commit list|resolved by|round reported|were both/i;
const DELTA_PHRASE = /\blarger than\b|\bup from\b|\bgrew\b|\bmore than it was\b/i;

/* ── A table whose HEADER declares history ────────────────────────────────
   A progression table states its columns once, at the top:

       | | baseline | overnight | morning | final |
       | dictionary keys | 512 | 658 | 756 | **862** |

   The data rows carry no label of their own, so a line-by-line rule reads
   them as five current claims and rejects four true ones. Rather than
   relabelling every row — which would push the reports towards saying less,
   and this table is genuinely useful — the header is read once and its rows
   inherit it, until the table ends.

   Deliberately narrow: only a header naming a historical COLUMN counts, and
   only rows of that same table are covered. */
const HIST_COLUMN = /\|\s*(?:baseline|overnight|morning|before|previous|old|was|then)\s*\|/i;
function historicalTableLines(text) {
  const out = new Set();
  const lines = text.split('\n');
  let inHistTable = false;
  lines.forEach((line, i) => {
    const isRow = /^\s*\|/.test(line);
    if (!isRow) { inHistTable = false; return; }
    if (!inHistTable && HIST_COLUMN.test(line)) { inHistTable = true; out.add(i); return; }
    if (inHistTable) out.add(i);
  });
  return out;
}

/* ── A section that declares itself historical ────────────────────────────
   A line-level rule cannot see a heading. `## SUPERSEDED VALUES` is a promise
   about everything under it, and the file whose job is to LIST retired
   figures was being told not to name them — the registry failing its own
   rule. Headings are read, and their scope runs to the next heading of the
   same or higher level. Narrow on purpose: the heading itself must say so. */
const HIST_HEADING = /^#{1,6}\s+.*\b(superseded|historical|history|previous|earlier|retired|no longer current)\b/i;
function historicalSections(text) {
  const out = new Set();
  let depth = 0;
  text.split('\n').forEach((line, i) => {
    const h = line.match(/^(#{1,6})\s/);
    if (h) {
      const d = h[1].length;
      if (HIST_HEADING.test(line)) { depth = d; out.add(i); return; }
      if (depth && d <= depth) depth = 0;      // the section ended
    }
    if (depth) out.add(i);
  });
  return out;
}
const HIST_LINES = new Map();
const histLines = (f, text) => {
  if (!HIST_LINES.has(f)) {
    const set = historicalTableLines(text);
    historicalSections(text).forEach(i => set.add(i));
    HIST_LINES.set(f, set);
  }
  return HIST_LINES.get(f);
};
const exempt = (line, f, i, text) =>
  HISTORICAL.test(line) || DELTA_PHRASE.test(line)
  || (f !== undefined && text !== undefined && histLines(f, text).has(i));

// ══ 1 · the application commit ════════════════════════════════════════════
const APP = C.application.acceptedCommit;
/* Read once, here, so the drift check and the COMMIT-INFO header cannot
   disagree about what this round declared. */
const scopeText = fs.existsSync(path.join(L.control, 'ROUND-SCOPE.md'))
  ? read(L.control, 'ROUND-SCOPE.md') : '';
const candBlock = /```candidate-files\r?\n([\s\S]*?)```/.exec(scopeText);
const declared = new Set((candBlock ? candBlock[1] : '')
  .split(/\r?\n/).map(l => l.trim()).filter(Boolean));
if (!EXTRACTED) {
  check(git('cat-file', '-t', APP) === 'commit',
    `application commit ${APP.slice(0, 7)} exists in this repository`);
  /* The accepted PHP must still BE what was accepted — unless the round says
     otherwise, in its own control file, by name.

     A round that proposes a change to the application is a normal thing; a
     change nobody declared is not, and that is the one this check exists to
     stop. So the list of files allowed to differ is read from ROUND-SCOPE's
     ```candidate-files``` block. Anything on it is reported as a declared
     candidate and named in the output every time. Anything NOT on it fails
     exactly as it always did, and an empty block means nothing may differ.

     Deliberately read from ROUND-SCOPE and nowhere else: it is the file that
     changes every round, it is the file a reviewer reads to learn what this round
     was allowed to touch, and it cannot quietly grant itself permission —
     the declaration is prose a person can see. CANONICAL-STATE stays the
     authority on what has been ACCEPTED, and is not consulted here. */
  const changed = git('diff', '--name-only', APP + '..HEAD', '--', '*.php');
  const changedList = changed ? changed.split('\n').filter(Boolean) : [];
  const undeclared = changedList.filter(f => !declared.has(f));
  check(undeclared.length === 0,
    `application PHP differs from ${APP.slice(0, 7)} only where this round declared it`
    + (undeclared.length ? ` — undeclared: ${undeclared.join(', ')}` : ''));
  if (changedList.length) {
    check(true, `declared candidate change, not yet accepted: ${changedList.join(', ')}`
      + ` (accepted commit stays ${APP.slice(0, 7)})`);
  }
}
ALL_DOCS.forEach(f => check(doc(f).includes(APP), `${f} names the accepted application commit`));

for (const f of REPORTS) {
  doc(f).split('\n').forEach((line, i) => {
    if (exempt(line, f, i, doc(f))) return;
    for (const h of (line.match(/\b[0-9a-f]{7,40}\b/g) || [])) {
      if (!/[a-f]/.test(h)) continue;
      if (APP.startsWith(h)) continue;
      if (String(C.history?.baselineCommit || 'f96714e33795e80b581b1d03deb9d04db1d94b8d').startsWith(h)) continue;
      bad(`${f}:${i + 1}`, `presents ${h} as current\n       ${line.trim().slice(0, 92)}`);
    }
  });
}

// ══ 2 · superseded values, everywhere they could hide ═════════════════════
/* Prose, headings, markdown tables, fenced blocks, COMMIT-INFO and the JSON.
   Built from the canonical history list rather than hand-maintained here, so
   retiring a figure is one edit in one file. */
const H = C.history || {};
const STALE = [];
const push = (re, what) => STALE.push({ re, what });
(H.supersededAssertionTotals || []).forEach(n =>
  push(new RegExp(`\\b${n.toLocaleString('en-US').replace(',', ',?')}\\b`), `${fmt(n)} assertions`));
(H.supersededTranslationKeys || []).forEach(n => push(new RegExp(`\\b${n}\\b`), `${n} translation keys`));
(H.supersededFindingTotals || []).forEach(n =>
  push(new RegExp(`\\b${n}\\s+(?:in all|total|findings)\\b`, 'i'), `${n} findings`));
(H.supersededDeltas || []).forEach(n =>
  push(new RegExp(`\\+\\s?${n.toLocaleString('en-US').replace(',', ',?')}\\b`), `a delta of +${fmt(n)}`));
(H.supersededSuiteCounts || []).forEach(n => push(new RegExp(`\\b${n}\\s+suites\\b`, 'i'), `${n} suites`));
/* the spelled-out habit that went stale twice, and its "P1s" plural */
push(/\bthe eight P1s?\b/i, '"the eight P1s"');
[['eight', 'P1'], ['ten', 'P1'], ['nineteen', 'P2'], ['twenty-one', 'P2']].forEach(([w, p]) =>
  push(new RegExp(`\\b${w}\\s+${p}s?\\b`, 'i'), `"${w} ${p}"`));

const scanTargets = ALL_DOCS.map(f => [f, doc(f)])
  .concat(JSON_ARTIFACTS.filter(f => has(L.logs, f)).map(f => [f, read(L.logs, f)]));
for (const [f, text] of scanTargets) {
  text.split('\n').forEach((line, i) => {
    if (exempt(line, f, i, text)) return;
    for (const s of STALE) if (s.re.test(line))
      bad(`${f}:${i + 1}`, `still claims ${s.what}\n       ${line.trim().slice(0, 92)}`);
  });
}
check(true, `${STALE.length} superseded values swept across ${scanTargets.length} artifacts`);

/* the manifest's retired name */
if (H.retiredManifestName) {
  for (const f of ALL_DOCS) doc(f).split('\n').forEach((line, i) => {
    if (exempt(line, f, i, doc(f))) return;
    if (line.includes(H.retiredManifestName))
      bad(`${f}:${i + 1}`, `points at ${H.retiredManifestName} — the package has ${C.package.manifestPath}`);
  });
  check(true, `no report points at the retired ${H.retiredManifestName}`);
}

// ══ 3 · markdown tables, cell by cell ═════════════════════════════════════
/* The blind spot that let `| **P1** high | 8 | 8 |` ship. Every table row is
   split into cells and any cell that names a severity, a total, a key count or
   the recorded-not-repaired count is read as a claim. */
const CELL_RULES = [
  { label: /^\**P0\**\s*(critical)?$/i,  want: C.findings.p0, what: 'P0' },
  { label: /^\**P1\**\s*(high)?$/i,      want: C.findings.p1, what: 'P1' },
  { label: /^\**P2\**\s*(medium)?$/i,    want: C.findings.p2, what: 'P2' },
  { label: /^\**P3\**\s*(low)?$/i,       want: C.findings.p3, what: 'P3' },
  { label: /recorded,?\s*not\s*repaired/i, want: C.findings.recordedUnrepaired,
    what: 'recorded-not-repaired' },
];
/* Returns one complaint per offending cell. Extracted so the self-test can
   drive it with the exact rows that shipped, rather than trusting a comment
   that says it would have caught them. */
function scanTable(text) {
  const out = [];
  let inFence = false;
  text.split('\n').forEach((line, i) => {
    /* A fence is quoted material, not a rendered table. ROUND-SCOPE writes
       down the exact stale row this must reject; reading that illustration as
       a claim would make the guard impossible to document. */
    if (/^\s*```/.test(line)) { inFence = !inFence; return; }
    if (inFence) return;
    if (!/^\s*\|/.test(line)) return;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (!cells.length) return;
    const label = cells[0].replace(/\*\*/g, '').replace(/\s*\(.*\)\s*/, '').trim();
    for (const r of CELL_RULES) {
      if (!r.label.test(label)) continue;
      out.rows = (out.rows || 0) + 1;
      for (const cell of cells.slice(1)) {
        const m = cell.replace(/\*\*/g, '').trim().match(/^(\d[\d,]*)$/);
        if (!m) continue;                       // "—" and prose cells are fine
        const n = Number(m[1].replace(/,/g, ''));
        if (n !== r.want)
          out.push({ line: i + 1, what: r.what, got: n, want: r.want, text: line.trim() });
      }
    }
  });
  return out;
}

// ══ 3a · the self-test: the fixtures this checker once missed ═════════════
/* The brief asks for the exact false-green to become a failing fixture, and
   that is a fair demand: a checker that has passed over a defect five times
   should be made to demonstrate it no longer does, rather than asserting it. */
if (process.argv.includes('--self-test')) {
  const SHIPPED_STALE = [
    '| | Count | Repaired |', '|---|---:|---:|',
    '| **P0** critical | 0 | — |',
    '| **P1** high | 8 | 8 |',
    '| **P2** medium | 19 | 19 |',
    '| **P3** low | 2 | 2 |',
    '| Recorded, not repaired (with reasons) | 6 | — |',
  ].join('\n');
  const CORRECT = SHIPPED_STALE
    .replace('| **P1** high | 8 | 8 |', '| **P1** high | 13 | 13 |')
    .replace('| **P2** medium | 19 | 19 |', '| **P2** medium | 24 | 24 |')
    .replace('| Recorded, not repaired (with reasons) | 6 | — |',
             '| Recorded, not repaired (with reasons) | 5 | — |');

  const stale = scanTable(SHIPPED_STALE);
  const clean = scanTable(CORRECT);
  const caught = new Set(stale.map(x => x.what));
  const results = [
    [stale.length >= 5, `the shipped stale table is rejected (${stale.length} bad cells)`],
    [caught.has('P1'), 'P1 = 8 is caught'],
    [caught.has('P2'), 'P2 = 19 is caught'],
    [caught.has('recorded-not-repaired'), 'recorded-not-repaired = 6 is caught'],
    [!caught.has('P3'), 'P3 = 2 is NOT flagged — it was always correct'],
    [clean.length === 0, `the corrected table passes (${clean.length} complaints)`],
  ];
  console.log('\n  CHECKER SELF-TEST — the fixtures this checker once missed');
  console.log('  ' + '─'.repeat(74));
  results.forEach(([ok, m]) => console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`));
  const bad2 = results.filter(([ok]) => !ok).length;
  console.log(bad2 ? `\n  ${bad2} self-test failure(s).\n` : '\n  self-test clean.\n');
  process.exit(bad2 ? 1 : 0);
}

let tableCells = 0;
for (const f of ALL_DOCS) {
  const hits = scanTable(doc(f));
  tableCells += hits.rows || 0;
  hits.forEach(h => bad(`${f}:${h.line}`,
    `table cell says ${h.what} = ${h.got}, canonical is ${h.want}\n       ${h.text.slice(0, 92)}`));
}
check(true, `${tableCells} severity/observation table rows read cell by cell`);

// ══ 4 · findings, in prose and in the tally blocks ════════════════════════
{
  const t = doc('FINDINGS.md');
  const heads = [...t.matchAll(/^### (F\d+) · /gm)].length;
  check(heads === C.findings.total,
    `FINDINGS.md carries ${heads} F-headings, canonical says ${C.findings.total}`);

  const nHeads = [...t.matchAll(/^### (N\d+) · (.*)$/gm)];
  const unresolved = nHeads.filter(m => !/resolved by/i.test(m[2])).map(m => m[1]);
  check(unresolved.join(',') === C.findings.recordedUnrepairedIds.join(','),
    `FINDINGS.md records ${unresolved.join(', ') || 'none'} as not repaired`
    + ` (canonical: ${C.findings.recordedUnrepairedIds.join(', ')})`);
  const resolvedNote = nHeads.find(m => /resolved by/i.test(m[2]));
  check(!!resolvedNote, `and marks ${C.history?.resolvedObservation?.id || 'N1'} as resolved, so it is not counted`);
}
for (const f of ALL_DOCS) {
  const t = doc(f);
  for (const m of t.matchAll(/P0\s*(\d+)\s*·\s*P1\s*(\d+)\s*·\s*P2\s*(\d+)\s*·\s*P3\s*(\d+)/g))
    check(Number(m[1]) === C.findings.p0 && Number(m[2]) === C.findings.p1
       && Number(m[3]) === C.findings.p2 && Number(m[4]) === C.findings.p3,
      `${f} severity line reads P0 ${m[1]} · P1 ${m[2]} · P2 ${m[3]} · P3 ${m[4]}`);
  for (const m of t.matchAll(/(\d+)\s+(?:in all|total, all repaired|findings, all repaired)/g))
    check(Number(m[1]) === C.findings.total, `${f} says "${m[0]}"`);
  for (const m of t.matchAll(/^\s*(\d+) total, \d+ repaired/gm))
    check(Number(m[1]) === C.findings.total, `${f} tallies "${m[0].trim()}"`);
  /* the recorded-not-repaired count, in every phrasing it has worn */
  t.split('\n').forEach((line, i) => {
    if (exempt(line, f, i, t)) return;
    for (const m of line.matchAll(/(\d+)\s+recorded[- ]not[- ]repaired|recorded[- ]not[- ]repaired[^.\d]{0,20}(\d+)|(\d+)\s+additional observations/gi)) {
      const n = Number(m[1] || m[2] || m[3]);
      if (Number.isFinite(n) && n !== C.findings.recordedUnrepaired)
        bad(`${f}:${i + 1}`, `says ${n} recorded-not-repaired, canonical is ${C.findings.recordedUnrepaired}`
          + `\n       ${line.trim().slice(0, 92)}`);
    }
  });
}

// ══ 5 · the test run ══════════════════════════════════════════════════════
const T = C.tests;
if (has(L.logs, 'browser-suite.log')) {
  const runLog = read(L.logs, 'browser-suite.log');
  const tail = runLog.match(/^\s*(\d+) suites, (\d+) assertions, (\d+) failed/m);
  if (!tail) bad('browser-suite.log', 'has no summary line');
  else {
    check(Number(tail[1]) === T.browserSuites, `the recorded run has ${tail[1]} suites`);
    check(Number(tail[2]) === T.browserAssertions, `the recorded run has ${tail[2]} browser assertions`);
    check(Number(tail[3]) === T.failed, `the recorded run failed ${tail[3]}`);
    const per = [...runLog.matchAll(/\((\d+) assertions/g)].reduce((a, m) => a + Number(m[1]), 0);
    check(per === T.browserAssertions, `per-suite assertions sum to ${per}`);
  }
}
if (has(L.logs, 'browser-suite.json')) {
  const b = JSON.parse(read(L.logs, 'browser-suite.json'));
  check(b.suites === T.browserSuites && b.asserts === T.browserAssertions && b.failures === T.failed,
    `browser-suite.json: ${b.suites} suites / ${fmt(b.asserts)} assertions / ${b.failures} failed`);
}
for (const [f, want] of [['pricing-history-php.log', T.pricingHistoryAssertions],
                         ['ai-extract-php.log', T.aiExtractionAssertions],
                         ['pricing-workbook.log', T.workbookAssertions],
                         ['translation-coverage.log', T.translationAssertions]]) {
  if (!has(L.logs, f)) { bad(f, 'is missing'); continue; }
  const t = read(L.logs, f);
  const m = t.match(/\((\d+) assertions\)/);
  check(!!m && Number(m[1]) === want && /^\s*ok\s/m.test(t),
    `${f} records a passing ${want}-assertion run`);
}

/* Every four-figure assertion claim, and every delta, in every document. */
for (const f of ALL_DOCS) {
  doc(f).split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/\+\s?(\d[\d,]*)\s*(?:assertions|this round)/gi)) {
      const n = Number(m[1].replace(/,/g, ''));
      if (n !== T.deltaAssertions)
        bad(`${f}:${i + 1}`, `claims a delta of ${m[0]}, canonical is +${fmt(T.deltaAssertions)}`
          + `\n       ${line.trim().slice(0, 92)}`);
    }
    if (exempt(line, f, i, doc(f))) return;
    for (const m of line.matchAll(/(?<![+\d,])(\d[\d,]{3,})\s+assertions/g)) {
      const n = Number(m[1].replace(/,/g, ''));
      if (n !== T.browserAssertions && n !== T.finalAssertions)
        bad(`${f}:${i + 1}`, `says "${m[0]}", the run is ${fmt(T.browserAssertions)} / ${fmt(T.finalAssertions)}`);
    }
    for (const m of line.matchAll(/(\d+) suites/g))
      if (Number(m[1]) !== T.browserSuites)
        bad(`${f}:${i + 1}`, `says "${m[0]}", the run had ${T.browserSuites}`);
  });
}

// ══ 6 · translation ═══════════════════════════════════════════════════════
const TR = C.translation;
if (has(L.logs, 'translation-coverage.json')) {
  const tj = JSON.parse(read(L.logs, 'translation-coverage.json'));
  const files = tj.files || {};
  const keys = Object.values(files).reduce((a, v) => a + (v.enKeys || 0), 0);
  check(keys === TR.keys, `translation-coverage.json totals ${keys} keys`);
  check(Object.values(files).every(v => v.coverage === TR.coveragePercent),
    `every file at ${TR.coveragePercent}% coverage`);
  check(Object.values(files).every(v =>
    ['missingZh', 'missingKey', 'identical'].every(k => (v[k] || []).length === TR.missing)),
    'nothing missing, undefined or untranslated-identical');
  check(Object.values(files).every(v =>
    (v.hardCoded || []).length === TR.hardcoded && (v.unapplied || []).length === TR.unapplied),
    'nothing bypassing dcT and no unapplied hook');
}
if (has(L.logs, 'translation-coverage.log'))
  check(read(L.logs, 'translation-coverage.log').includes(`${TR.keys} keys`),
    `translation-coverage.log names ${TR.keys} keys`);
for (const f of ALL_DOCS) {
  doc(f).split('\n').forEach((line, i) => {
    if (exempt(line, f, i, doc(f))) return;
    for (const m of line.matchAll(/(\d{3,4})\s+keys/g))
      if (Number(m[1]) !== TR.keys)
        bad(`${f}:${i + 1}`, `says "${m[0]}", canonical is ${TR.keys}`);
  });
}

// ══ 7 · evidence the reports name ═════════════════════════════════════════
if (fs.existsSync(L.shots)) {
  const shots = fs.readdirSync(L.shots).filter(n => n.endsWith('.png')).length;
  if (!EXTRACTED) {
    const claim = doc('FULL-AUDIT-REPORT.md').match(/`screenshots\/` — (\d+) frames/);
    if (claim) check(Number(claim[1]) === shots,
      `FULL-AUDIT-REPORT claims ${claim[1]} frames, the directory holds ${shots}`);
  }
  /* the two the round turns on, by content not by count */
  const names = fs.readdirSync(L.shots);
  ['C04-accessories-zero-selected', 'C04b-accessories-zero-selected-chinese']
    .forEach(n => check(names.some(x => x.includes(n)), `evidence present: ${n}`));
}
if (!EXTRACTED) {
  const named = new Set();
  for (const f of REPORTS) for (const m of doc(f).matchAll(/`([A-Za-z0-9._\/-]+\.(?:png|log|json))`/g)) named.add(m[1]);
  const A = path.join(REPO, 'FULL-AUDIT');
  const bases = ['', 'screenshots/', 'before-fix/', 'after-fix/', 'regression-evidence/'];
  const missing = [...named].filter(n => {
    if (bases.some(b => fs.existsSync(path.join(A, b + n)))) return false;
    return !REPORTS.some(f => doc(f).split('\n').some((l, i) => l.includes('`' + n + '`') && exempt(l, f, i, doc(f))));
  });
  check(missing.length === 0, `every evidence file a report names exists${
    missing.length ? ' — missing ' + missing.join(', ') : ` (${named.size} checked)`}`);
}

// ══ 8 · the control files travel with the package ═════════════════════════
for (const f of ['PROJECT-GUARDRAILS.md', 'ROUND-SCOPE.md', 'CANONICAL-STATE.md', 'CANONICAL-STATE.json'])
  check(has(L.control, f), `docs/control/${f} present`);
if (has(L.control, 'CANONICAL-STATE.json')) {
  const shipped = JSON.parse(read(L.control, 'CANONICAL-STATE.json'));
  check(JSON.stringify(shipped) === JSON.stringify(C),
    'the shipped CANONICAL-STATE.json is the one this check ran against');
}
/* the human copy must agree with the machine copy */
if (has(L.control, 'CANONICAL-STATE.md')) {
  const md = read(L.control, 'CANONICAL-STATE.md');
  const pairs = [[APP, 'application commit'], [fmt(T.finalAssertions), 'final assertions'],
                 [fmt(T.baselineAssertions), 'baseline'], [`+${fmt(T.deltaAssertions)}`, 'delta'],
                 [String(TR.keys), 'translation keys'], [String(C.findings.total), 'total findings'],
                 [String(C.findings.recordedUnrepaired), 'recorded-not-repaired']];
  pairs.forEach(([v, what]) => check(md.includes(v), `CANONICAL-STATE.md states the ${what} (${v})`));
}

// ══ 9 · COMMIT-INFO's generated facts ═════════════════════════════════════
if (!EXTRACTED) {
  const AUDIT = path.join(REPO, 'FULL-AUDIT');
  const dirCount = d => fs.readdirSync(path.join(AUDIT, d)).filter(n => !n.startsWith('.')).length;
  const shots = fs.readdirSync(path.join(AUDIT, 'screenshots')).filter(n => n.endsWith('.png')).length;
  const BASE = 'f96714e33795e80b581b1d03deb9d04db1d94b8d';
  /* The commit that actually carries a declared candidate, derived from the
     history of the declared files rather than assumed to be HEAD. While a
     round is under review this is NOT the accepted commit, and the figures in
     this package were measured on ITS tree — saying otherwise would credit the
     accepted baseline with a run it never had. Empty when nothing is declared,
     and the header then reads exactly as it did before. */
  const candidateFiles = [...declared];
  const CAND = candidateFiles.length
    ? git('log', '-1', '--format=%H', APP + '..HEAD', '--', ...candidateFiles) : '';
  const acceptedLines = [
      `                The commit the accepted implementation and its test`,
      `                matrix were measured at. Every figure in this package`,
      `                was produced by this tree, and docs/control/`,
      `                CANONICAL-STATE.json is the authority for all of them.`,
  ];
  const candidateLines = [
      `                The ACCEPTED application. docs/control/`,
      `                CANONICAL-STATE.json is the authority for it.`,
      `CANDIDATE APPLICATION COMMIT`,
      `                ${CAND}`,
      `                "${CAND ? git('log', '-1', '--format=%s', CAND) : ''}"`,
      `                NOT YET ACCEPTED. A round under review proposes a`,
      `                change to ${candidateFiles.join(', ')}, declared by name in`,
      `                docs/control/ROUND-SCOPE.md. The test figures in this`,
      `                package were measured on THIS tree, not on the accepted`,
      `                one — the accepted commit above has not changed and does`,
      `                not become this one until the round is accepted.`,
  ];
  const blocks = () => ({
    HEADER: [
      `BRANCH          ${git('rev-parse', '--abbrev-ref', 'HEAD')}`,
      `BASELINE SHA    ${BASE}`,
      `                "${git('log', '-1', '--format=%s', BASE)}"`,
      `ACCEPTED APPLICATION COMMIT`,
      `                ${APP}`,
      `                "${git('log', '-1', '--format=%s', APP)}"`,
      ...(CAND ? candidateLines : acceptedLines),
      `PACKAGE / HEAD COMMIT`,
      `                Not named here, and deliberately. The commits after the`,
      `                application one carry this package, and a document`,
      `                cannot name the commit it is inside without changing`,
      `                it. The exact HEAD an archive was built from is recorded`,
      `                in that archive's own MANIFEST/MANIFEST.txt, generated`,
      `                at build time and never committed — the one place that`,
      `                can honestly state it. It may sit after the`,
      `                application commit above, carrying evidence, reports`,
      `                and packaging only.`,
      `DEPLOYED        NO — nothing was deployed, and nothing was run against`,
      `                production data. Every test drives the shipped code`,
      `                against a controlled API in a local browser.`,
    ].join('\n'),
    COMMITS: git('log', '--reverse', '--format=%h\t%s', BASE + '..' + (CAND || APP))
      .split('\n').filter(Boolean)
      .map(l => { const [h, ...r] = l.split('\t'); return `  ${h}  ${r.join('\t')}`; }).join('\n'),
    FINDINGS: [
      `  P0  ${C.findings.p0}`,
      `  P1  ${C.findings.p1}  all repaired`,
      `  P2  ${C.findings.p2}  all repaired`,
      `  P3  ${C.findings.p3}   all repaired`,
      `  ---------------------`,
      `  ${C.findings.total} total, ${C.findings.total} repaired.`,
      ``,
      `  ${C.findings.recordedUnrepaired} further observations are recorded and were not changed by`,
      `  design: ${C.findings.recordedUnrepairedIds.join(', ')}. N1 is NOT among them — it was`,
      `  resolved by F7, and counting it would count a repaired defect twice.`,
      `  These are observations with stated reasons, not outstanding defects.`,
      ``,
      `  2 questions still need a business answer; 4 earlier ones are now decided`,
      `  and are recorded as decided rather than counted as open.`,
    ].join('\n'),
    EVIDENCE: [
      `  screenshots/          ${shots} frames + INDEX.txt`,
      `  before-fix/           ${dirCount('before-fix')} frames from the baseline commit, same inputs`,
      `  after-fix/            ${dirCount('after-fix')} frames, the matching after`,
      `  regression-evidence/  ${dirCount('regression-evidence')} files — every log the reports claim,`,
      `                        checked against the directory rather than written`,
      `                        from memory`,
    ].join('\n'),
    MATRIX: [
      `  Browser suites            ${T.browserSuites} suites, ${fmt(T.browserAssertions)} assertions, 0 failed`,
      `  Pricing-history PHP                    ${T.pricingHistoryAssertions} assertions, 0 failed`,
      `  AI extraction PHP                      ${T.aiExtractionAssertions} assertions, 0 failed`,
      `  Pricing workbook                        ${T.workbookAssertions} assertions, 0 failed`,
      `  Translation coverage                    ${T.translationAssertions} assertions, 0 failed`,
      `  ----------------------------------------------------------------`,
      `  TOTAL ASSERTIONS                     ${fmt(T.finalAssertions).padStart(6)}`,
      `  TOTAL FAILED                              ${T.failed}`,
      `  SKIPPED / ENVIRONMENT-LIMITED             ${T.skipped}`,
      ``,
      `  Baseline:  ${fmt(T.baselineAssertions).padStart(6)} assertions`,
      `  Final:     ${fmt(T.finalAssertions).padStart(6)} assertions`,
      `  Delta:     ${('+' + fmt(T.deltaAssertions)).padStart(6)} assertions`,
    ].join('\n'),
  });

  let ci = doc('COMMIT-INFO.txt'), out = ci;
  const drift = [];
  for (const [k, v] of Object.entries(blocks())) {
    const a = `<<<GENERATED:${k}>>>`, b = `<<<END:${k}>>>`;
    const i = ci.indexOf(a), j = ci.indexOf(b);
    if (i < 0 || j < 0) { drift.push(`COMMIT-INFO.txt has no ${a} block`); continue; }
    if (ci.slice(i + a.length, j).replace(/^\n|\n$/g, '') !== v) drift.push(`COMMIT-INFO.txt ${k} block is stale`);
    out = out.slice(0, out.indexOf(a) + a.length) + '\n' + v + '\n' + out.slice(out.indexOf(b));
  }
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(AUDIT, 'COMMIT-INFO.txt'), out);
    console.log('\n  COMMIT-INFO.txt regenerated from Git and CANONICAL-STATE.\n'
      + '  Re-run without --write to verify.\n');
    process.exit(0);
  }
  drift.forEach(d => fail.push('FAIL ' + d + ' — run with --write'));
  check(!drift.length, 'COMMIT-INFO.txt generated blocks match Git and canonical state');
}

// ══ report ════════════════════════════════════════════════════════════════
console.log(`\n  REPORT CONSISTENCY — ${L.label}, against docs/control/CANONICAL-STATE.json`);
console.log('  ' + '─'.repeat(74));
console.log(`  application ${APP.slice(0, 7)} · ${T.browserSuites} suites · ${fmt(T.finalAssertions)} assertions`
  + ` · baseline ${fmt(T.baselineAssertions)} · delta +${fmt(T.deltaAssertions)}`);
console.log(`  ${TR.keys} keys at ${TR.coveragePercent}% · P1 ${C.findings.p1} / P2 ${C.findings.p2}`
  + ` / P3 ${C.findings.p3} / ${C.findings.total} findings · ${C.findings.recordedUnrepaired} recorded-not-repaired`);
console.log('  ' + '─'.repeat(74));
note.forEach(l => console.log('  ' + l));
if (fail.length) {
  console.log('\n  ' + '─'.repeat(74));
  fail.forEach(l => console.log('  ' + l));
  console.log(`\n  ${fail.length} disagreement(s). Packaging must not proceed.\n`);
  process.exit(1);
}
console.log(`\n  ${note.length} checks, 0 disagreements.\n`);
