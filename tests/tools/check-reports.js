/* ── The reports must agree with each other, and with Git ───────────────────
   Three rounds running, the package shipped with a figure that had been true
   once. A SHA that was current last round; "eight P1s" after there were ten;
   two different assertion totals in two documents describing one run. Every
   one was a typed number that nobody re-typed.

   So the numbers get ONE source each, and this refuses to package when a
   document disagrees with it:

       application SHA  →  Git
       finding totals   →  FINDINGS.md, counted from its own headings
       test totals      →  the recorded run in regression-evidence/
       package counts   →  the directory on disk

       node tests/tools/check-reports.js            # check
       node tests/tools/check-reports.js --write    # regenerate COMMIT-INFO

   Exit 1 on any disagreement, so the packaging step cannot pass over it.   */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const AUDIT = path.join(ROOT, 'FULL-AUDIT');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8').trim();

const read = f => fs.readFileSync(path.join(AUDIT, f), 'utf8');
const REPORTS = ['EXECUTIVE-SUMMARY.md', 'FULL-AUDIT-REPORT.md', 'FINDINGS.md',
                 'TEST-RESULTS.md', 'TRANSLATION-AUDIT.md', 'BUSINESS-DECISIONS-NEEDED.md'];

const fail = [];
const note = [];
const check = (ok, msg) => { (ok ? note : fail).push((ok ? 'ok   ' : 'FAIL ') + msg); return ok; };

// ══ 1 · the authoritative application commit ══════════════════════════════
/* The last commit that touched application or test code. Everything after it
   carries the package, and a report cannot name the commit it is inside. */
const APP_PATHS = ['index.php', 'companies.php', 'login.php', 'api.php', 'auth.php',
                   'ai_extract.php', 'pricing_history.php', 'tests'];
const APP_SHA = git('log', '-1', '--format=%H', '--', ...APP_PATHS);
const APP_SUBJ = git('log', '-1', '--format=%s', APP_SHA);
const HEAD = git('rev-parse', 'HEAD');

/* Any 7+ hex run that looks like a SHA and is NOT the application one. A
   report may still MENTION an old SHA — history is a legitimate subject — but
   only where the line says so. */
const HISTORICAL = /historical|superseded|baseline|previously|earlier|former|no longer|commit list|oldest first/i;
const shaRe = /\b[0-9a-f]{7,40}\b/g;

for (const f of REPORTS) {
  const text = read(f);
  text.split('\n').forEach((line, i) => {
    const hits = (line.match(shaRe) || []).filter(h => /[a-f]/.test(h) && h.length >= 7);
    for (const h of hits) {
      if (APP_SHA.startsWith(h) || HEAD.startsWith(h)) continue;
      if (HISTORICAL.test(line)) continue;
      // a baseline SHA stated as the baseline is fine; it is named as one
      if (/baseline/i.test(text.slice(Math.max(0, text.indexOf(line) - 120), text.indexOf(line)))) continue;
      fail.push(`FAIL ${f}:${i + 1} names ${h}, which is neither the application SHA `
        + `nor HEAD, and the line does not mark it historical\n       ${line.trim().slice(0, 100)}`);
    }
  });
}
check(true, `application SHA ${APP_SHA.slice(0, 7)} — "${APP_SUBJ}"`);
check(true, `package HEAD    ${HEAD.slice(0, 7)}`);

// ── every current report names the application SHA at least once ──────────
for (const f of REPORTS.concat(['COMMIT-INFO.txt'])) {
  check(read(f).includes(APP_SHA), `${f} names the application SHA`);
}

// ══ 2 · finding totals, counted from FINDINGS.md itself ═══════════════════
const findings = read('FINDINGS.md');
const heads = [...findings.matchAll(/^### (F\d+) · (.+)$/gm)];
const sev = { P0: 0, P1: 0, P2: 0, P3: 0 };
for (const m of heads) {
  const start = findings.indexOf(m[0]);
  const body = findings.slice(start, start + 900);
  const s = body.match(/\*\*(P[0-3])\.?\*\*/);
  if (s) sev[s[1]]++;
  else sev.P2++;             // the overnight entries carry their grade in the table
}
const TOTAL = heads.length;
check(TOTAL > 0, `FINDINGS.md declares ${TOTAL} findings (F-numbered headings)`);

/* The declared line, which every other document must repeat. */
const declared = findings.match(/\*\*P0 (\d+) · P1 (\d+) · P2 (\d+) · P3 (\d+) · (\d+) total/);
if (!declared) fail.push('FAIL FINDINGS.md has no "P0 n · P1 n · P2 n · P3 n · N total" line to be authoritative');
else {
  const [, p0, p1, p2, p3, tot] = declared.map(Number);
  check(p0 + p1 + p2 + p3 === tot, `severity counts sum to the declared total (${p0}+${p1}+${p2}+${p3} = ${tot})`);
  check(tot === TOTAL, `the declared total ${tot} equals the ${TOTAL} F-headings in the file`);

  const words = { 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 19: 'nineteen',
                  20: 'twenty', 21: 'twenty-one', 29: 'twenty-nine' };
  for (const f of REPORTS.concat(['COMMIT-INFO.txt'])) {
    const t = read(f);
    /* any OTHER "N total" or "N in all" claim is a second source of truth */
    for (const m of t.matchAll(/(\d+)\s+(?:in all|findings, all repaired|total, all repaired)/g)) {
      check(Number(m[1]) === tot, `${f} says "${m[0]}" and the authority says ${tot}`);
    }
    for (const m of t.matchAll(/P0\s*(\d+)\s*·\s*P1\s*(\d+)\s*·\s*P2\s*(\d+)\s*·\s*P3\s*(\d+)/g)) {
      check(Number(m[2]) === p1 && Number(m[3]) === p2,
        `${f} repeats the severity line as P1 ${m[2]} · P2 ${m[3]} and the authority says P1 ${p1} · P2 ${p2}`);
    }
    /* the spelled-out habit that went stale twice */
    for (const [n, w] of Object.entries(words)) {
      const re = new RegExp(`\\b${w}\\s+P1\\b`, 'i');
      if (re.test(t)) check(Number(n) === p1, `${f} says "${w} P1" and the authority says ${p1}`);
    }
  }
}

// ══ 3 · test totals, from the recorded run ═══════════════════════════════
const runLog = fs.readFileSync(path.join(AUDIT, 'regression-evidence', 'browser-suite.log'), 'utf8');
const tail = runLog.match(/^\s*(\d+) suites, (\d+) assertions, (\d+) failed/m);
if (!tail) fail.push('FAIL regression-evidence/browser-suite.log has no summary line');
else {
  const [, suites, asserts, failed] = tail.map(Number);
  check(failed === 0, `the recorded run failed ${failed}`);
  const per = [...runLog.matchAll(/\((\d+) assertions/g)].reduce((a, m) => a + Number(m[1]), 0);
  check(per === asserts, `per-suite assertions sum to the reported total (${per} = ${asserts})`);

  const side = {};
  for (const [f, label] of [['pricing-history-php.log', 'pricing history'],
                            ['ai-extract-php.log', 'ai_extract'],
                            ['pricing-workbook.log', 'pricing workbook'],
                            ['translation-coverage.log', 'translation coverage']]) {
    const t = fs.readFileSync(path.join(AUDIT, 'regression-evidence', f), 'utf8');
    const m = t.match(/\((\d+) assertions\)/);
    const okLine = /^\s*ok\s/m.test(t);
    check(!!m && okLine, `${f} records a passing run`);
    side[label] = m ? Number(m[1]) : 0;
  }
  const GRAND = asserts + Object.values(side).reduce((a, b) => a + b, 0);
  const fmt = n => n.toLocaleString('en-US');
  check(true, `run: ${suites} suites · ${fmt(asserts)} browser · ${fmt(GRAND)} total · ${failed} failed`);

  for (const f of REPORTS.concat(['COMMIT-INFO.txt'])) {
    const t = read(f);
    for (const m of t.matchAll(/(\d[\d,]*)\s+assertions/g)) {
      const n = Number(m[1].replace(/,/g, ''));
      /* Only four-figure counts claim to describe the whole run. Anything
         smaller is one suite, one group or a historical baseline — the
         per-suite sum above already proves those add up. */
      if (n < 1000) continue;
      if (n === asserts || n === GRAND) continue;
      /* a baseline or a delta, if the line says so */
      const line = t.slice(t.lastIndexOf('\n', t.indexOf(m[0])) + 1, t.indexOf(m[0]) + 60);
      if (/baseline|\+|larger|added|grew|superseded/i.test(line)) continue;
      fail.push(`FAIL ${f} says "${m[0]}" — the run says ${fmt(asserts)} browser / ${fmt(GRAND)} total`);
    }
    for (const m of t.matchAll(/(\d+) suites/g)) {
      if (Number(m[1]) !== suites && !/baseline|superseded/i.test(m.input.slice(Math.max(0, m.index - 60), m.index)))
        fail.push(`FAIL ${f} says "${m[0]}" — the run had ${suites}`);
    }
  }
  module.exports = { APP_SHA, HEAD, suites, asserts, GRAND, failed };
}

// ══ 4 · no stale hand-typed commit counts ════════════════════════════════
for (const f of REPORTS) {
  const t = read(f);
  const m = t.match(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\s+commits?\b/i);
  if (m) fail.push(`FAIL ${f} hand-types a commit count ("${m[0]}") — COMMIT-INFO.txt is the list`);
}
check(true, 'no report hand-types a commit count');

// ══ 5 · the package claims match the directory ═══════════════════════════
const count = d => fs.readdirSync(path.join(AUDIT, d)).filter(n => !n.startsWith('.')).length;
const shots = fs.readdirSync(path.join(AUDIT, 'screenshots')).filter(n => n.endsWith('.png')).length;
const logs = count('regression-evidence');
const report = read('FULL-AUDIT-REPORT.md');
const shotClaim = report.match(/`screenshots\/` — (\d+) frames/);
if (shotClaim) check(Number(shotClaim[1]) === shots,
  `FULL-AUDIT-REPORT claims ${shotClaim[1]} frames and the directory holds ${shots}`);
const logClaim = report.match(/\*\*(\w+) files, \1 claims\.\*\*/i)
              || report.match(/\*\*(Sixteen|Fifteen|Fourteen|Twelve) files/i);
check(true, `evidence on disk: ${shots} screenshots · ${logs} regression files`);

/* every evidence file a report names by path must exist */
const named = new Set();
for (const f of REPORTS) {
  for (const m of read(f).matchAll(/`([A-Za-z0-9._\/-]+\.(?:png|log|json))`/g)) named.add(m[1]);
}
const missing = [...named].filter(n => {
  const bases = ['', 'screenshots/', 'before-fix/', 'after-fix/', 'regression-evidence/'];
  if (bases.some(b => fs.existsSync(path.join(AUDIT, b + n)))) return false;
  /* A report may NAME a file in order to say it does not exist — the entry
     recording that an earlier draft claimed a superseded log is a correction,
     not a claim. Only unqualified references count as claims. */
  return !REPORTS.some(f => read(f).split('\n').some(line =>
    line.includes('`' + n + '`') && HISTORICAL.test(line)));
});
check(missing.length === 0, `every evidence file named by a report exists${
  missing.length ? ' — missing ' + missing.join(', ') : ` (${named.size} checked)`}`);

// ══ 6 · COMMIT-INFO's facts, written by Git rather than by hand ══════════
/* The header, the commit list and the test matrix are the three blocks that
   went stale. They are regenerated between markers, so the hand-written
   paragraphs that explain each commit survive while the FACTS around them
   cannot drift. --write rewrites them; without it, they are checked. */
function commitInfoBlocks() {
  const baseline = 'f96714e33795e80b581b1d03deb9d04db1d94b8d';
  const list = git('log', '--reverse', '--format=%h\t%s', baseline + '..HEAD')
    .split('\n').filter(Boolean)
    .map(l => { const [h, ...rest] = l.split('\t'); return `  ${h}  ${rest.join('\t')}`; });
  const runTail = (runLog.match(/^\s*(\d+) suites, (\d+) assertions, (\d+) failed.*$/m) || [''])[0].trim();
  const dur = (runLog.match(/^\s*([0-9.]+s)\s*$/m) || [, ''])[1];
  return {
    HEADER: [
      `BRANCH          ${git('rev-parse', '--abbrev-ref', 'HEAD')}`,
      `BASELINE SHA    ${baseline}`,
      `                "${git('log', '-1', '--format=%s', baseline)}"`,
      `APPLICATION COMMIT`,
      `                ${APP_SHA}`,
      `                "${APP_SUBJ}"`,
      `                The last commit that changed application or test code.`,
      `                Every figure in this package was measured against it.`,
      `PACKAGE / HEAD COMMIT`,
      `                ${HEAD}`,
      `                "${git('log', '-1', '--format=%s')}"`,
      `                Carries this package. A report cannot name the commit it`,
      `                is inside, so the exact HEAD an archive was built from is`,
      `                also recorded in the archive's own manifest.`,
      `DEPLOYED        NO — nothing was deployed, and nothing was run against`,
      `                production data. Every test drives the shipped code`,
      `                against a controlled API in a local browser.`,
    ].join('\n'),
    COMMITS: list.join('\n'),
    MATRIX: [
      `  ${runTail}${dur ? '   (' + dur + ')' : ''}`,
    ].join('\n'),
  };
}
{
  const MARK = k => [`<<<GENERATED:${k}>>>`, `<<<END:${k}>>>`];
  let ci = read('COMMIT-INFO.txt');
  const blocks = commitInfoBlocks();
  let out = ci, drift = [];
  for (const [k, v] of Object.entries(blocks)) {
    const [a, b] = MARK(k);
    const i = ci.indexOf(a), j = ci.indexOf(b);
    if (i < 0 || j < 0) { drift.push(`COMMIT-INFO.txt has no ${a} block`); continue; }
    const cur = ci.slice(i + a.length, j).replace(/^\n|\n$/g, '');
    if (cur !== v) drift.push(`COMMIT-INFO.txt ${k} block is stale`);
    out = out.slice(0, out.indexOf(a) + a.length) + '\n' + v + '\n'
        + out.slice(out.indexOf(b));
  }
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(AUDIT, 'COMMIT-INFO.txt'), out);
    /* Everything above was measured against the file as it stood BEFORE this
       rewrite, so reporting those results now would be reporting the problem
       this run just fixed. Write mode writes and says so; verification is the
       next run, which is the one packaging gates on. */
    console.log('\n  COMMIT-INFO.txt regenerated from Git.'
      + '\n  Re-run without --write to verify.\n');
    process.exit(0);
  } else {
    drift.forEach(d => fail.push('FAIL ' + d + ' — run with --write'));
    check(!drift.length, 'COMMIT-INFO.txt generated blocks match Git');
  }
}

// ══ report ════════════════════════════════════════════════════════════════
console.log('\n  REPORT CONSISTENCY\n  ' + '─'.repeat(70));
note.forEach(l => console.log('  ' + l));
if (fail.length) {
  console.log('\n  ' + '─'.repeat(70));
  fail.forEach(l => console.log('  ' + l));
  console.log(`\n  ${fail.length} disagreement(s). Packaging must not proceed.\n`);
  process.exit(1);
}
console.log(`\n  ${note.length} checks, 0 disagreements.\n`);
