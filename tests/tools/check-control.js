/* ── CONTROL CONSISTENCY — the three authorities, checked against each other
   and against Git ──────────────────────────────────────────────────────────

   check-reports.js validates the REPORTS against CANONICAL-STATE. This one
   validates the control layer itself, which nothing else does:

     · CANONICAL-STATE.json, CANONICAL-STATE.md and tests/tools/authoritative.js
       name ONE accepted commit and ONE matrix, and that matrix adds up;
     · the supersession chain is intact, the newly retired figures are recorded
       as retired, and the current ones are NOT;
     · Git agrees — the accepted commit is an ancestor of HEAD, the candidate
       SHA DERIVED from the files ROUND-SCOPE declared is the accepted commit,
       and no application or browser-test byte differs from it;
     · ROUND-SCOPE's ```candidate-files``` block is empty, and the round is
       closed with DEPLOY = NO and STAGE 2 = NOT STARTED;
     · PROJECT-GUARDRAILS carries the accepted outcomes, and carries the two
       deferrals AS deferrals rather than as accepted behaviour;
     · the accepted logs are the accepted run, and the per-suite lines sum.

   Written for the STAGE 1 final acceptance and pinned to it deliberately: an
   acceptance check that derives what to expect from the files it is checking
   would agree with itself while being wrong, which is the failure this whole
   control layer exists to prevent.

       node tests/tools/check-control.js                                    */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: REPO, maxBuffer: 1 << 28 }).toString().trim();
const R = f => fs.readFileSync(path.join(REPO, f), 'utf8');
const C = JSON.parse(R('docs/control/CANONICAL-STATE.json'));
const A = require(path.join(REPO, 'tests/tools/authoritative.js'));
const MD = R('docs/control/CANONICAL-STATE.md');
const GR = R('docs/control/PROJECT-GUARDRAILS.md');
const RS = R('docs/control/ROUND-SCOPE.md');
const APP = '3e89713400b5bcfceca31d2c074de17411169d1b';
const PREV = '98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac';
const out = []; let bad = 0;
const ck = (ok, m) => { out.push((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) bad++; };

// ── the three authorities name one commit ──
ck(C.application.acceptedCommit === APP, `CANONICAL-STATE.json accepted commit is ${APP.slice(0,7)}`);
ck(A.APP_SHA === APP, `authoritative.js APP_SHA is ${APP.slice(0,7)}`);
ck(MD.includes(APP), 'CANONICAL-STATE.md names it');
ck(C.application.status === 'accepted' && /FINAL ACCEPTED/.test(C.application.acceptedRound),
   `status accepted, round "${C.application.acceptedRound.slice(0,40)}…"`);

// ── and one matrix ──
const T = C.tests;
ck(A.SUITES === T.browserSuites && A.BROWSER === T.browserAssertions
   && A.TOTAL === T.finalAssertions && A.BASELINE === T.baselineAssertions
   && A.DELTA === T.deltaAssertions && A.FAILED === T.failed && A.SKIPPED === T.skipped,
   `authoritative.js and canonical agree: ${A.SUITES} / ${A.BROWSER} / ${A.TOTAL} / +${A.DELTA} / ${A.FAILED} failed`);
ck(T.browserSuites === 38 && T.browserAssertions === 3816 && T.finalAssertions === 4172
   && T.deltaAssertions === 1362 && T.baselineAssertions === 2810,
   'the accepted matrix is the measured Stage 1 run');
ck(T.browserAssertions + T.pricingHistoryAssertions + T.aiExtractionAssertions
   + T.workbookAssertions + T.translationAssertions === T.finalAssertions,
   `3,816+172+107+62+15 = ${T.finalAssertions}`);
ck(T.finalAssertions - T.baselineAssertions === T.deltaAssertions, '4,172 − 2,810 = +1,362');
ck(A.SIDE['pricing-history-php.log'] === T.pricingHistoryAssertions
   && A.SIDE['ai-extract-php.log'] === T.aiExtractionAssertions
   && A.SIDE['pricing-workbook.log'] === T.workbookAssertions
   && A.SIDE['translation-coverage.log'] === T.translationAssertions,
   'the four side suites agree in both files and did not move');
ck(A.KEYS === C.translation.keys && A.COVERAGE === C.translation.coveragePercent
   && C.translation.missing === 0 && C.translation.hardcoded === 0 && C.translation.unapplied === 0,
   `translation 862 / 100% / 0 / 0 / 0, unchanged`);

// ── supersession ──
const S = C.history.supersededApplicationCommits;
ck(S.length === 4, `${S.length} superseded application commits recorded`);
ck(S.map(x => x.sha.slice(0,7)).join(' → ') === '7f5bc97 → e3d659b → 33ae0da → 98a31e3',
   'the historical chain is intact: ' + S.map(x => x.sha.slice(0,7)).join(' → '));
ck(S[3].sha === PREV && S[3].supersededBy === APP, `98a31e3 is recorded superseded by ${APP.slice(0,7)}`);
ck(!S.some(x => x.sha === APP), 'the accepted commit is not also listed as superseded');
ck(MD.includes('`98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac` — superseded by `3e89713`'),
   'CANONICAL-STATE.md records the same supersession');
const H = C.history;
ck(H.supersededAssertionTotals.includes(4070) && !H.supersededAssertionTotals.includes(4172),
   '4,070 retired, 4,172 is not retired');
ck(H.supersededDeltas.includes(1260) && !H.supersededDeltas.includes(1362),
   '+1,260 retired, +1,362 is not retired');
ck(H.supersededSuiteCounts.includes(37) && !H.supersededSuiteCounts.includes(38),
   `suite counts retired: ${H.supersededSuiteCounts.join(' · ')} — 38 is current, not retired`);

// ── Git ──
git('cat-file', '-t', APP);
ck(git('cat-file','-t',APP) === 'commit', 'the accepted commit exists in this repository');
let anc = true; try { git('merge-base','--is-ancestor',PREV,APP); } catch { anc = false; }
ck(anc, '98a31e3 is an ancestor of 3e89713');
let ancHead = true; try { git('merge-base','--is-ancestor',APP,'HEAD'); } catch { ancHead = false; }
ck(ancHead, '3e89713 is an ancestor of HEAD');
ck(git('diff','--name-only',PREV+'..'+APP,'--','*.php') === 'index.php\ncompanies.php'
   || git('diff','--name-only',PREV+'..'+APP,'--','*.php').split('\n').sort().join(',') === 'companies.php,index.php',
   'the promotion carries exactly index.php and companies.php');
ck(git('diff','--name-only',APP+'..HEAD','--','*.php') === '',
   'no application PHP differs from the accepted commit');
ck(git('diff','--name-only',APP+'..HEAD','--','tests/suites','tests/lib') === '',
   'no browser-test byte differs from the accepted commit');
ck(git('log','-1','--format=%H',PREV+'..HEAD','--','index.php','companies.php') === APP,
   'the candidate SHA derived from the declared files IS the accepted commit');
ck(git('status','--porcelain') === '', 'working tree clean');

// ── the candidate block is empty, and means it ──
const m = /```candidate-files\r?\n([\s\S]*?)```/.exec(RS);
ck(!!m, 'ROUND-SCOPE carries a candidate-files block');
ck(m && m[1].trim() === '', 'the candidate-files block is EMPTY — nothing may differ from the accepted commit');
ck(/FINAL ACCEPTED \/ CLOSED/.test(RS), 'ROUND-SCOPE is marked FINAL ACCEPTED / CLOSED');
ck(/DEPLOY = NO/.test(RS), 'ROUND-SCOPE records DEPLOY = NO');
ck(/STAGE 2 = NOT STARTED/.test(RS), 'ROUND-SCOPE records STAGE 2 = NOT STARTED');
ck(C.package.deploymentApproved === false, 'canonical: deployment not approved');

// ── guardrails carry the accepted outcomes, and only those ──
[['STAGE 1 UI — ACCEPTED', 'the Stage 1 UI section exists'],
 ['the APPLY TO label and the scope buttons it names stay\ntogether', 'the scope control is protected'],
 ['at least 44 × 44', 'the Companies tap targets are protected'],
 ['The desk sizes are equally protected', 'and so are the accepted desk sizes'],
 ['Grand Total a reader finds at once', 'the printed A4 quotation is protected'],
 ['No separately priced accessory row may return', 'the accessory rule survives into print'],
 ['Item 3 is item 3 on Screen, on Print and in WhatsApp', 'numbering identity is protected'],
 ['DEFERRED TO STAGE 2 — NOT ACCEPTED BEHAVIOUR', 'the deferrals are recorded as deferrals'],
].forEach(([needle, what]) => ck(GR.includes(needle), what));
ck(/Dark mode\.\*\* There is no dark mode/.test(GR) && /Numbering ORDER\*\* on any surface/.test(GR),
   'dark mode and numbering ORDER are deferred, not converted into accepted behaviour');
ck(GR.includes('accessories are inside the parent item’s final customer'.replace('’',"'"))
   || GR.includes('accessories are inside the parent item'),
   'the STAGE 0B accessory rule is still protected, untouched by this round');

// ── the accepted logs are the accepted run ──
const LOG = R('FULL-AUDIT/regression-evidence/browser-suite.log');
ck(/38 suites, 3816 assertions, 0 failed/.test(LOG), 'regression-evidence/browser-suite.log is the 38 / 3,816 run');
const BJ = JSON.parse(R('FULL-AUDIT/regression-evidence/browser-suite.json'));
ck(BJ.suites === 38 && BJ.asserts === 3816 && BJ.failures === 0, 'browser-suite.json agrees');
const per = [...LOG.matchAll(/\((\d+) assertions/g)].reduce((a,x)=>a+Number(x[1]),0);
ck(per === 3816, `the 38 per-suite lines sum to ${per}`);
ck(!fs.existsSync(path.join(REPO,'FULL-AUDIT/STAGE-1-TEST-RESULTS.md')),
   'the candidate-only STAGE-1-TEST-RESULTS.md is gone, not left to drift');

console.log('\n  CONTROL CONSISTENCY — Stage 1 final acceptance');
console.log('  ' + '─'.repeat(74));
out.forEach(l => console.log('  ' + l));
console.log(bad ? `\n  ${bad} disagreement(s).\n` : `\n  ${out.length} checks, 0 disagreements.\n`);
process.exit(bad ? 1 : 0);
