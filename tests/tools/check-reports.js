/* ── The reports must agree with each other, with Git, and with the run ─────
   Four rounds running, the package shipped with a figure that had been true
   once: a SHA that was current last round, "the eight P1s" after there were
   thirteen, two different assertion totals for one run, a translation count
   from two rounds ago sitting in a JSON artifact nobody re-read.

   The previous version of this file passed while five of those were still on
   disk. It false-greened for reasons worth writing down, because each one is
   a way a checker can look thorough and check nothing:

     · it matched `\bP1\b`, which does not match "P1s";
     · it only questioned assertion counts of four figures or more, so an
       artifact saying 843 keys was never a candidate;
     · it never read translation counts at all;
     · it never opened the .json artifacts, only the prose;
     · and it DERIVED its expected values from the same documents it was
       checking, so a number that was wrong everywhere agreed with itself.

   The last of those is the important one. The authoritative values are now
   PINNED here, as constants, from the accepted round. A document is checked
   against a value it cannot influence.

       node tests/tools/check-reports.js            # check  (exit 1 on any drift)
       node tests/tools/check-reports.js --write    # regenerate COMMIT-INFO   */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const AUDIT = path.join(ROOT, 'FULL-AUDIT');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8').trim();

// ══ THE AUTHORITATIVE VALUES ══════════════════════════════════════════════
/* One file, shared with the package builder, so a figure cannot be right in
   one tool and wrong in the other. See tests/tools/authoritative.js for why
   they are pinned rather than derived. */
const AUTH = require('./authoritative');

/* Values and phrases that were true in an earlier round and must not appear
   as current claims anywhere. A line may still carry one when it says so —
   a report describing its own history is doing something useful. */
const STALE = [
  { re: /\bthe eight P1s?\b/i,           what: '"the eight P1s" — there are 13' },
  { re: /\beight\s+P1\b/i,               what: '"eight P1"' },
  { re: /\bnineteen\s+P2\b/i,            what: '"nineteen P2"' },
  { re: /\btwenty-one\s+P2\b/i,          what: '"twenty-one P2"' },
  { re: /\bten\s+P1\b/i,                 what: '"ten P1"' },
  { re: /\b29\s+(?:in all|total|findings)\b/i, what: '29 findings' },
  { re: /\b33\s+(?:in all|total|findings)\b/i, what: '33 findings' },
  { re: /\b3,?827\b/,                    what: '3,827 assertions' },
  { re: /\b3,?799\b/,                    what: '3,799 assertions' },
  { re: /\b3,?679\b/,                    what: '3,679 assertions' },
  { re: /\b3,?482\b/,                    what: '3,482 assertions' },
  { re: /\b843\b/,                       what: '843 translation keys' },
  { re: /\b853\b/,                       what: '853 translation keys' },
  { re: /\b36\s+suites\b/i,              what: '36 suites' },
  { re: /\b38\s+suites\b/i,              what: '38 suites' },
];
/* A line that plainly marks itself as history is allowed to name history. */
const HISTORICAL = /historical|superseded|baseline|previously|earlier|former|no longer|used to|were both|are all superseded|before this|at the time|round reported|and should not be quoted|oldest first|commit list/i;
/* A line stating a DIFFERENCE is not stating a current total. "1,148
   assertions larger than it was" and "up from 512 keys" are both true and
   both about growth, so the figure in them is deliberately not the current
   one — flagging those would push a report towards saying less.

   `\+\d` used to be in this list, and that was a hole: it exempted ANY line
   carrying a +number, which is exactly the shape a stale delta has. "+869
   this round" sailed through on the strength of its own plus sign. Deltas are
   checked explicitly below instead of being waved past here. */
const DELTA = /\blarger than\b|\bup from\b|\bgrew\b|\bmore than it was\b/i;

const REPORTS = ['EXECUTIVE-SUMMARY.md', 'FULL-AUDIT-REPORT.md', 'FINDINGS.md',
                 'TEST-RESULTS.md', 'TRANSLATION-AUDIT.md', 'BUSINESS-DECISIONS-NEEDED.md'];
const ALL_DOCS = REPORTS.concat(['COMMIT-INFO.txt']);
const ARTIFACTS = ['regression-evidence/translation-coverage.json',
                   'regression-evidence/browser-suite.json'];

const read = f => fs.readFileSync(path.join(AUDIT, f), 'utf8');
const fail = [], note = [];
const check = (ok, msg) => { (ok ? note : fail).push((ok ? 'ok   ' : 'FAIL ') + msg); return ok; };
const fmt = n => n.toLocaleString('en-US');

// ══ 1 · the application commit ════════════════════════════════════════════
check(git('cat-file', '-t', AUTH.APP_SHA) === 'commit',
  `application commit ${AUTH.APP_SHA.slice(0, 7)} exists in this repository`);
ALL_DOCS.forEach(f => check(read(f).includes(AUTH.APP_SHA),
  `${f} names the application commit`));

/* Any other 7+ hex SHA presented as current. */
const shaRe = /\b[0-9a-f]{7,40}\b/g;
for (const f of REPORTS) {
  read(f).split('\n').forEach((line, i) => {
    if (HISTORICAL.test(line)) return;
    for (const h of (line.match(shaRe) || [])) {
      if (!/[a-f]/.test(h)) continue;
      if (AUTH.APP_SHA.startsWith(h) || AUTH.BASELINE_SHA.startsWith(h)) continue;
      fail.push(`FAIL ${f}:${i + 1} presents ${h} as current\n       ${line.trim().slice(0, 96)}`);
    }
  });
}

// ══ 2 · stale phrases and figures, in EVERY current artifact ══════════════
/* Prose, tables, headings, COMMIT-INFO and the JSON — the previous version
   read only the first of those. */
for (const f of ALL_DOCS.concat(ARTIFACTS)) {
  const text = read(f);
  text.split('\n').forEach((line, i) => {
    if (HISTORICAL.test(line)) return;
    for (const s of STALE) {
      if (s.re.test(line)) {
        fail.push(`FAIL ${f}:${i + 1} still claims ${s.what}\n       ${line.trim().slice(0, 96)}`);
      }
    }
  });
}
check(true, `${STALE.length} stale patterns swept across ${ALL_DOCS.length + ARTIFACTS.length} artifacts`);

/* The package's manifest lives at MANIFEST/MANIFEST.txt. It was called
   ZIP-MANIFEST.txt when there were two archives, and the reports went on
   pointing a reviewer at a filename the package no longer contains. */
for (const f of ALL_DOCS) {
  read(f).split('\n').forEach((line, i) => {
    if (/ZIP-MANIFEST\.txt/.test(line))
      fail.push(`FAIL ${f}:${i + 1} points at ZIP-MANIFEST.txt — the package has MANIFEST/MANIFEST.txt`);
  });
}
check(true, 'no report points at the retired ZIP-MANIFEST.txt');

// ══ 3 · findings ══════════════════════════════════════════════════════════
const findings = read('FINDINGS.md');
const heads = [...findings.matchAll(/^### (F\d+) · /gm)].length;
check(heads === AUTH.FINDINGS,
  `FINDINGS.md carries ${heads} F-headings and the authority says ${AUTH.FINDINGS}`);
for (const f of ALL_DOCS) {
  const t = read(f);
  for (const m of t.matchAll(/P0\s*(\d+)\s*·\s*P1\s*(\d+)\s*·\s*P2\s*(\d+)\s*·\s*P3\s*(\d+)/g)) {
    check(Number(m[1]) === AUTH.P0 && Number(m[2]) === AUTH.P1
       && Number(m[3]) === AUTH.P2 && Number(m[4]) === AUTH.P3,
      `${f} severity line reads P0 ${m[1]} · P1 ${m[2]} · P2 ${m[3]} · P3 ${m[4]}`);
  }
  for (const m of t.matchAll(/(\d+)\s+(?:in all|total, all repaired|findings, all repaired)/g)) {
    check(Number(m[1]) === AUTH.FINDINGS, `${f} says "${m[0]}"`);
  }
  /* COMMIT-INFO's own tally block, which the previous version never read. */
  for (const m of t.matchAll(/^\s*(\d+) total, \d+ repaired/gm)) {
    check(Number(m[1]) === AUTH.FINDINGS, `${f} tallies "${m[0].trim()}"`);
  }
}

// ══ 4 · the test run ══════════════════════════════════════════════════════
const runLog = fs.readFileSync(path.join(AUDIT, 'regression-evidence/browser-suite.log'), 'utf8');
const tail = runLog.match(/^\s*(\d+) suites, (\d+) assertions, (\d+) failed/m);
if (!tail) fail.push('FAIL browser-suite.log has no summary line');
else {
  check(Number(tail[1]) === AUTH.SUITES, `the recorded run has ${tail[1]} suites`);
  check(Number(tail[2]) === AUTH.BROWSER, `the recorded run has ${tail[2]} browser assertions`);
  check(Number(tail[3]) === AUTH.FAILED, `the recorded run failed ${tail[3]}`);
  const per = [...runLog.matchAll(/\((\d+) assertions/g)].reduce((a, m) => a + Number(m[1]), 0);
  check(per === AUTH.BROWSER, `per-suite assertions sum to ${per}`);
}
const bj = JSON.parse(read('regression-evidence/browser-suite.json'));
check(bj.suites === AUTH.SUITES && bj.asserts === AUTH.BROWSER && bj.failures === AUTH.FAILED,
  `browser-suite.json says ${bj.suites} suites / ${fmt(bj.asserts)} assertions / ${bj.failures} failed`);

let side = 0;
for (const [f, want] of Object.entries(AUTH.SIDE)) {
  const t = fs.readFileSync(path.join(AUDIT, 'regression-evidence', f), 'utf8');
  const m = t.match(/\((\d+) assertions\)/);
  const got = m ? Number(m[1]) : -1;
  check(got === want && /^\s*ok\s/m.test(t), `${f} records a passing ${want}-assertion run`);
  side += want;
}
check(AUTH.BROWSER + side === AUTH.TOTAL,
  `${fmt(AUTH.BROWSER)} browser + ${side} side = ${fmt(AUTH.TOTAL)} total`);

/* Every four-figure assertion claim in every document must be the total. */
for (const f of ALL_DOCS) {
  const t = read(f);
  t.split('\n').forEach((line, i) => {
    if (HISTORICAL.test(line) || DELTA.test(line)) return;
    /* A figure preceded by "+" is a DELTA and is checked as one, against the
       arithmetic, a few lines below. Reading it here as a total would flag
       the correct "+1,148 assertions" for not being a grand total. */
    for (const m of line.matchAll(/(?<![+\d,])(\d[\d,]{3,})\s+assertions/g)) {
      const n = Number(m[1].replace(/,/g, ''));
      if (n !== AUTH.BROWSER && n !== AUTH.TOTAL)
        fail.push(`FAIL ${f}:${i + 1} says "${m[0]}" — the run is ${fmt(AUTH.BROWSER)} / ${fmt(AUTH.TOTAL)}`);
    }
    for (const m of line.matchAll(/(\d+) suites/g)) {
      if (Number(m[1]) !== AUTH.SUITES)
        fail.push(`FAIL ${f}:${i + 1} says "${m[0]}" — the run had ${AUTH.SUITES}`);
    }
  });
}

// ══ 4b · the delta, and the arithmetic that has to hold ══════════════════
/* Three numbers that must reconcile: where the matrix started, where it is,
   and the distance between. Checked as arithmetic rather than as three
   independent claims, because the way this went wrong was a delta drifting
   away from totals that were themselves correct. */
check(AUTH.BASELINE + AUTH.DELTA === AUTH.TOTAL,
  `${fmt(AUTH.BASELINE)} baseline + ${fmt(AUTH.DELTA)} delta = ${fmt(AUTH.TOTAL)} final`);

for (const f of ALL_DOCS) {
  read(f).split('\n').forEach((line, i) => {
    /* every "+N assertions" claim, and every "+N this round" */
    for (const m of line.matchAll(/\+\s?(\d[\d,]*)\s*(?:assertions|this round)/gi)) {
      const n = Number(m[1].replace(/,/g, ''));
      if (n !== AUTH.DELTA)
        fail.push(`FAIL ${f}:${i + 1} claims a delta of ${m[0]} — it is +${fmt(AUTH.DELTA)}`
          + `\n       ${line.trim().slice(0, 96)}`);
    }
    /* and every baseline figure quoted as the comparison point */
    for (const m of line.matchAll(/[Bb]aseline[^.]{0,40}?(\d[\d,]{3,})\s+assertions/g)) {
      const n = Number(m[1].replace(/,/g, ''));
      if (n !== AUTH.BASELINE)
        fail.push(`FAIL ${f}:${i + 1} quotes a baseline of ${m[1]} — it is ${fmt(AUTH.BASELINE)}`);
    }
  });
}

// ══ 5 · translation ═══════════════════════════════════════════════════════
const tj = JSON.parse(read('regression-evidence/translation-coverage.json'));
const files = tj.files || {};
const keys = Object.values(files).reduce((a, v) => a + (v.enKeys || 0), 0);
check(keys === AUTH.KEYS, `translation-coverage.json totals ${keys} keys`);
check(Object.values(files).every(v => v.coverage === AUTH.COVERAGE),
  `every file is at ${AUTH.COVERAGE}% coverage`);
const zero = ['missingZh', 'missingKey', 'identical'];
check(Object.values(files).every(v => zero.every(k => (v[k] || []).length === 0)),
  'nothing missing, undefined or untranslated-identical');
check(Object.values(files).every(v => (v.hardCoded || []).length === 0
                                   && (v.unapplied || []).length === 0),
  'nothing bypassing dcT and no unapplied hook');
const tLog = read('regression-evidence/translation-coverage.log');
check(tLog.includes(`${AUTH.KEYS} keys`), `translation-coverage.log names ${AUTH.KEYS} keys`);

/* And every document that quotes a key count must quote this one. */
for (const f of ALL_DOCS) {
  read(f).split('\n').forEach((line, i) => {
    if (HISTORICAL.test(line) || DELTA.test(line)) return;
    for (const m of line.matchAll(/(\d{3,4})\s+keys/g)) {
      if (Number(m[1]) !== AUTH.KEYS)
        fail.push(`FAIL ${f}:${i + 1} says "${m[0]}" — the checker reports ${AUTH.KEYS}`);
    }
  });
}

// ══ 6 · the evidence the reports claim ════════════════════════════════════
const shots = fs.readdirSync(path.join(AUDIT, 'screenshots')).filter(n => n.endsWith('.png')).length;
const claim = read('FULL-AUDIT-REPORT.md').match(/`screenshots\/` — (\d+) frames/);
if (claim) check(Number(claim[1]) === shots,
  `FULL-AUDIT-REPORT claims ${claim[1]} frames and the directory holds ${shots}`);

const named = new Set();
for (const f of REPORTS) for (const m of read(f).matchAll(/`([A-Za-z0-9._\/-]+\.(?:png|log|json))`/g)) named.add(m[1]);
const bases = ['', 'screenshots/', 'before-fix/', 'after-fix/', 'regression-evidence/'];
const missing = [...named].filter(n => {
  if (bases.some(b => fs.existsSync(path.join(AUDIT, b + n)))) return false;
  /* A report may NAME a file in order to say it does NOT exist. */
  return !REPORTS.some(f => read(f).split('\n')
    .some(l => l.includes('`' + n + '`') && HISTORICAL.test(l)));
});
check(missing.length === 0, `every evidence file a report names exists${
  missing.length ? ' — missing ' + missing.join(', ') : ` (${named.size} checked)`}`);

// ══ 7 · COMMIT-INFO's facts, written by Git ═══════════════════════════════
/* Ranged to the APPLICATION commit, not to HEAD: ranging to HEAD made this
   document stale in the instant it was committed, because the commit that
   wrote the list became a member of the list. */
const dirCount = d => fs.readdirSync(path.join(AUDIT, d)).filter(n => !n.startsWith('.')).length;
function blocks() {
  const list = git('log', '--reverse', '--format=%h\t%s', AUTH.BASELINE_SHA + '..' + AUTH.APP_SHA)
    .split('\n').filter(Boolean)
    .map(l => { const [h, ...r] = l.split('\t'); return `  ${h}  ${r.join('\t')}`; });
  return {
    HEADER: [
      `BRANCH          ${git('rev-parse', '--abbrev-ref', 'HEAD')}`,
      `BASELINE SHA    ${AUTH.BASELINE_SHA}`,
      `                "${git('log', '-1', '--format=%s', AUTH.BASELINE_SHA)}"`,
      `APPLICATION COMMIT`,
      `                ${AUTH.APP_SHA}`,
      `                "${git('log', '-1', '--format=%s', AUTH.APP_SHA)}"`,
      `                The commit the accepted implementation and its test`,
      `                matrix were measured at. Every figure in this package`,
      `                was produced by this tree.`,
      `                Application SOURCE last changed one commit earlier, at`,
      `                ${git('log', '-1', '--format=%h', AUTH.APP_SHA + '~1')} — "${git('log', '-1', '--format=%s', AUTH.APP_SHA + '~1')}".`,
      `                Everything after it is evidence tooling and reports,`,
      `                and no application behaviour has moved since.`,
      `PACKAGE / HEAD COMMIT`,
      `                Not named here, and deliberately. The commits after the`,
      `                application one carry this package, and a document`,
      `                cannot name the commit it is inside without changing`,
      `                it. The exact HEAD an archive was built from is recorded`,
      `                in that archive's own MANIFEST/MANIFEST.txt, generated`,
      `                at build time and never committed — the one place that`,
      `                can honestly state it.`,
      `DEPLOYED        NO — nothing was deployed, and nothing was run against`,
      `                production data. Every test drives the shipped code`,
      `                against a controlled API in a local browser.`,
    ].join('\n'),
    COMMITS: list.join('\n'),
    FINDINGS: [
      `  P0  ${AUTH.P0}`,
      `  P1  ${AUTH.P1}  all repaired`,
      `  P2  ${AUTH.P2}  all repaired`,
      `  P3  ${AUTH.P3}   all repaired`,
      `  ---------------------`,
      `  ${AUTH.FINDINGS} total, ${AUTH.FINDINGS} repaired.  6 recorded-not-repaired with reasons.`,
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
      `  Browser suites            ${AUTH.SUITES} suites, ${fmt(AUTH.BROWSER)} assertions, 0 failed`,
      `  Pricing-history PHP                    161 assertions, 0 failed`,
      `  AI extraction PHP                      107 assertions, 0 failed`,
      `  Pricing workbook                        62 assertions, 0 failed`,
      `  Translation coverage                    15 assertions, 0 failed`,
      `  ----------------------------------------------------------------`,
      `  TOTAL ASSERTIONS                     ${fmt(AUTH.TOTAL).padStart(6)}`,
      `  TOTAL FAILED                              ${AUTH.FAILED}`,
      `  SKIPPED / ENVIRONMENT-LIMITED             ${AUTH.SKIPPED}`,
      ``,
      `  Baseline:  ${fmt(AUTH.BASELINE).padStart(6)} assertions`,
      `  Final:     ${fmt(AUTH.TOTAL).padStart(6)} assertions`,
      `  Delta:     ${('+' + fmt(AUTH.DELTA)).padStart(6)} assertions`,
    ].join('\n'),
  };
}
{
  let ci = read('COMMIT-INFO.txt'), out = ci;
  const drift = [];
  for (const [k, v] of Object.entries(blocks())) {
    const a = `<<<GENERATED:${k}>>>`, b = `<<<END:${k}>>>`;
    const i = ci.indexOf(a), j = ci.indexOf(b);
    if (i < 0 || j < 0) { drift.push(`COMMIT-INFO.txt has no ${a} block`); continue; }
    if (ci.slice(i + a.length, j).replace(/^\n|\n$/g, '') !== v)
      drift.push(`COMMIT-INFO.txt ${k} block is stale`);
    out = out.slice(0, out.indexOf(a) + a.length) + '\n' + v + '\n' + out.slice(out.indexOf(b));
  }
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(AUDIT, 'COMMIT-INFO.txt'), out);
    console.log('\n  COMMIT-INFO.txt regenerated from Git.\n  Re-run without --write to verify.\n');
    process.exit(0);
  }
  drift.forEach(d => fail.push('FAIL ' + d + ' — run with --write'));
  check(!drift.length, 'COMMIT-INFO.txt generated blocks match Git');
}

// ══ report ════════════════════════════════════════════════════════════════
console.log('\n  REPORT CONSISTENCY — checked against pinned authoritative values');
console.log('  ' + '─'.repeat(72));
console.log(`  application ${AUTH.APP_SHA.slice(0, 7)} · ${AUTH.SUITES} suites · `
  + `${fmt(AUTH.TOTAL)} assertions · ${AUTH.KEYS} keys · `
  + `P1 ${AUTH.P1} / P2 ${AUTH.P2} / P3 ${AUTH.P3} / ${AUTH.FINDINGS} findings`);
console.log('  ' + '─'.repeat(72));
note.forEach(l => console.log('  ' + l));
if (fail.length) {
  console.log('\n  ' + '─'.repeat(72));
  fail.forEach(l => console.log('  ' + l));
  console.log(`\n  ${fail.length} disagreement(s). Packaging must not proceed.\n`);
  process.exit(1);
}
console.log(`\n  ${note.length} checks, 0 disagreements.\n`);
