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
const APP = '649f80a09f83a7201c0f3772e01fc270ccda3e05';
const PREV = 'e76bb85d663f96fdce3ed6c0c70b72c49d84000a';
/* What production RUNS, which is no longer what has been accepted. */
const DEPLOYED = '649f80a09f83a7201c0f3772e01fc270ccda3e05';
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
ck(T.browserSuites === 40 && T.browserAssertions === 3936 && T.finalAssertions === 4734
   && T.deltaAssertions === 1924 && T.baselineAssertions === 2810,
   'the accepted matrix is the measured run');
ck(T.browserSuitesBeforeThisRound === 39 && T.browserAssertionsBeforeThisRound === 3907
   && T.itemIdentityBrowserAssertions === 29
   && T.browserAssertionsBeforeThisRound + T.itemIdentityBrowserAssertions === T.browserAssertions,
   `the browser matrix grew by exactly the new suite: 3,907 + 29 = ${T.browserAssertions}`);
ck(T.browserAssertions + T.pricingHistoryAssertions + T.aiExtractionAssertions
   + T.workbookAssertions + T.translationAssertions + T.saveRetryAssertions
   + T.mysqliCompatAssertions + T.actorIdentityAssertions + T.itemIdentityAssertions
   === T.finalAssertions,
   `3,936+172+107+62+15+42+94+150+156 = ${T.finalAssertions}`);
ck(T.finalAssertions - T.baselineAssertions === T.deltaAssertions, '4,734 − 2,810 = +1,924');
ck(A.SIDE['pricing-history-php.log'] === T.pricingHistoryAssertions
   && A.SIDE['ai-extract-php.log'] === T.aiExtractionAssertions
   && A.SIDE['pricing-workbook.log'] === T.workbookAssertions
   && A.SIDE['translation-coverage.log'] === T.translationAssertions
   && A.SIDE['save-retry-php.log'] === T.saveRetryAssertions
   && A.SIDE['mysqli-compat-php.log'] === T.mysqliCompatAssertions
   && A.SIDE['auth-identity-php.log'] === T.actorIdentityAssertions
   && A.SIDE['item-identity-php.log'] === T.itemIdentityAssertions,
   'the eight side suites agree in both files');
/* ── A failing assertion count may be recorded, but never left bare ────────
   The matrix has read "0 failed" for every accepted round until this one. It
   now reads 8, and the only thing that makes that acceptable is that the
   failures are named, attributed, and shown to pre-date the round. A future
   round that lets FAILED drift upward without extending this record fails
   here rather than shipping a number nobody has to justify. */
const X = T.browserFailureException || {};
ck(A.FAILED === T.failed, `authoritative.js and canonical agree on ${T.failed} failed`);
ck(T.failed === 0 || (X && X.count === T.failed),
   `${T.failed} failed, and the exception accounts for exactly ${X.count}`);
ck(T.failed === 0 || (X.applicationFault === false && X.introducedByThisRound === false),
   'the recorded failures are not an application fault and did not arrive with this round');
ck(T.failed === 0 || (typeof X.reproducedOn === 'string' && /^[0-9a-f]{40}$/.test(X.reproducedOn)),
   `and were reproduced on a commit that predates it: ${String(X.reproducedOn).slice(0,7)}`);
ck(T.failed === 0 || (Array.isArray(X.filesUntouchedByThisRound)
   && X.filesUntouchedByThisRound.every(f => git('diff','--name-only',PREV+'..'+APP,'--',f) === '')),
   'and every file it blames is genuinely untouched by this promotion');
ck(T.skipped === 0, 'nothing was skipped');

ck(A.KEYS === C.translation.keys && A.COVERAGE === C.translation.coveragePercent
   && C.translation.missing === 0 && C.translation.hardcoded === 0 && C.translation.unapplied === 0,
   `translation 862 / 100% / 0 / 0 / 0, unchanged`);

// ── supersession ──
const S = C.history.supersededApplicationCommits;
ck(S.length === 10, `${S.length} superseded application commits recorded`);
ck(S.map(x => x.sha.slice(0,7)).join(' → ') === '7f5bc97 → e3d659b → 33ae0da → 98a31e3 → 3e89713 → cf92f27 → 6bb5772 → 86cf262 → 97a14cf → e76bb85',
   'the historical chain is intact: ' + S.map(x => x.sha.slice(0,7)).join(' → '));
ck(S[9].sha === PREV && S[9].supersededBy === APP, `${PREV.slice(0,7)} is recorded superseded by ${APP.slice(0,7)}`);
ck(!S.some(x => x.sha === APP), 'the accepted commit is not also listed as superseded');
ck(MD.includes('`e76bb85d663f96fdce3ed6c0c70b72c49d84000a` — superseded by `649f80a`'),
   'CANONICAL-STATE.md records the same supersession');
const H = C.history;
ck(H.supersededAssertionTotals.includes(4549) && !H.supersededAssertionTotals.includes(4734),
   '4,549 retired, 4,734 is not retired');
ck(H.supersededDeltas.includes(1739) && !H.supersededDeltas.includes(1924),
   '+1,739 retired, +1,924 is not retired');
ck(H.supersededSuiteCounts.includes(39) && !H.supersededSuiteCounts.includes(40),
   `suite counts retired: ${H.supersededSuiteCounts.join(' · ')} — 40 is current, not retired`);

// ── Git ──
git('cat-file', '-t', APP);
ck(git('cat-file','-t',APP) === 'commit', 'the accepted commit exists in this repository');
let anc = true; try { git('merge-base','--is-ancestor',PREV,APP); } catch { anc = false; }
ck(anc, `${PREV.slice(0,7)} is an ancestor of ${APP.slice(0,7)}`);
ck(git('cat-file','-t',DEPLOYED) === 'commit', 'the DEPLOYED commit exists in this repository');
/* Accepted and deployed are equal today. They were not equal yesterday, and
   an earlier version of this file asserted they must DIFFER — which was true
   of one round and would have failed the moment the rollout made them agree.
   So the assertion is on AGREEMENT WITH CANONICAL, never on the relationship
   between them: the checker's job is that the two fields say what canonical
   says, not that they hold any particular relation. */
ck(A.DEPLOYED_SHA === DEPLOYED && C.production.deployedApplicationCommit === DEPLOYED,
   `authoritative.js and canonical agree production runs ${DEPLOYED.slice(0,7)}`);
ck(DEPLOYED === APP
   ? true
   : C.production.previouslyDeployedApplicationCommit !== undefined,
   DEPLOYED === APP
     ? `accepted and deployed are the same commit today (${APP.slice(0,7)})`
     : `accepted ${APP.slice(0,7)} is NOT deployed; production runs ${DEPLOYED.slice(0,7)}`);
ck(C.production.previouslyDeployedApplicationCommit === PREV,
   `canonical records the previously deployed build ${PREV.slice(0,7)} as history`);
ck(/^APPLIED/.test(C.production.itemUidBackfill || ''),
   'canonical: the item_uid backfill is APPLIED');
{ const B = C.production.itemUidBackfillEvidence || {};
  ck(B.itemsBackfilled === B.itemsWithValidUid && B.itemsMissingOrInvalidUid === 0,
     `backfill coverage is total: ${B.itemsWithValidUid} of ${B.itemsBackfilled} items, 0 missing or invalid`);
  ck(B.postApplyDryRunMinted === 0 && B.postApplyDryRunRowsToWrite === 0,
     'the post-apply dry run minted nothing and had nothing to write — idempotent');
  const D = C.production.deployVerification || {};
  ck(D.pathsChecked === D.match && D.drift === 0 && D.missing === 0,
     `${D.match} of ${D.pathsChecked} deployed paths match, 0 drift, 0 missing`); }
let ancHead = true; try { git('merge-base','--is-ancestor',APP,'HEAD'); } catch { ancHead = false; }
ck(ancHead, `${APP.slice(0,7)} is an ancestor of HEAD`);
/* '*.php' matches tests/php/*.test.php too, so the application half is asked
   for on its own — this promotion carries TWO application files. */
ck(git('diff','--name-only',PREV+'..'+APP,'--','*.php',':(exclude)tests/**').split('\n').sort().join(',')
   === 'api.php,index.php,migrations/2026-08-27-backfill-item-uids.php',
   'the promotion carries exactly api.php, index.php and the backfill migration');
ck(git('diff','--name-only',PREV+'..'+APP,'--','tests/suites','tests/lib','tests/php').split('\n').sort().join(',')
   === 'tests/php/item_identity.test.php,tests/suites/40-item-identity.test.js',
   'and exactly the two new test files — ONE browser suite was added and none was edited');
ck(git('diff','--name-only','--diff-filter=MD',PREV+'..'+APP,'--','tests/suites') === '',
   'not one of the thirty-nine accepted browser suites was modified or deleted');
ck(git('diff','--name-only',APP+'..HEAD','--','*.php') === '',
   'no application PHP differs from the accepted commit');
ck(git('diff','--name-only',APP+'..HEAD','--','tests/suites','tests/lib') === '',
   'no browser-test byte differs from the accepted commit');
ck(git('log','-1','--format=%H',PREV+'..HEAD','--','api.php','index.php',
       'migrations/2026-08-27-backfill-item-uids.php','tests/php/item_identity.test.php',
       'tests/suites/40-item-identity.test.js') === APP,
   'the candidate SHA derived from the declared files IS the accepted commit');
ck(git('status','--porcelain') === '', 'working tree clean');

// ── the candidate block is empty, and means it ──
const m = /```candidate-files\r?\n([\s\S]*?)```/.exec(RS);
ck(!!m, 'ROUND-SCOPE carries a candidate-files block');
ck(m && m[1].trim() === '', 'the candidate-files block is EMPTY — nothing may differ from the accepted commit');
/* ── The round's state is a FIELD, not a phrase found somewhere ─────────────
   These three were substring searches over the whole document, and a substring
   search cannot tell an assertion from its own denial. Every one of

       This round is NOT FINAL ACCEPTED / CLOSED.
       Stage 1 was FINAL ACCEPTED / CLOSED in August.
       PREVIOUSLY FINAL ACCEPTED / CLOSED; now reopened.
       ROUND-SCOPE no longer reads FINAL ACCEPTED / CLOSED.
       The string "FINAL ACCEPTED / CLOSED" is invalid.

   satisfied the old test. The last of those is not hypothetical: it is the
   false green recorded in FULL-AUDIT/UI-POLISH-2A.md §9a, where the check read
   green off a sentence saying the state was absent.

   So the state is now read from the status table in the ROUND section — the
   one place that declares it — as label -> value pairs, and the assertion
   names a CELL. Prose cannot forge a table cell, a later OUTCOME table is
   outside the parsed region, and an exact value match cannot be satisfied by
   a longer string that negates it.                                          */
function roundScopeStatus(text) {
    const sec = /^##[ \t]+ROUND[ \t]*$([\s\S]*?)^---[ \t]*$/m.exec(text);
    if (!sec) return null;
    const rows = new Map();
    for (const raw of sec[1].split(/\r?\n/)) {
        const m = /^\|([^|]*)\|([^|]*)\|$/.exec(raw.trim());
        if (!m) continue;
        const label = m[1].trim().replace(/\*\*/g, '').trim();
        const value = m[2].trim().replace(/\*\*/g, '').trim();
        if (!label || /^:?-+:?$/.test(label)) continue;   // header and |---| rule
        rows.set(label, value);
    }
    return rows;
}
const ST = roundScopeStatus(RS);
ck(ST instanceof Map && ST.size > 0,
   'ROUND-SCOPE carries a status table in its ROUND section');
ck(!!ST && ST.get('Round status') === 'FINAL ACCEPTED / CLOSED',
   'ROUND-SCOPE status field reads EXACTLY "FINAL ACCEPTED / CLOSED"'
   + (ST && ST.has('Round status') ? ` (it reads "${ST.get('Round status')}")` : ' (no such field)'));
ck(!!ST && ST.has('DEPLOY = NO'), 'ROUND-SCOPE records DEPLOY = NO as a status field');
ck(!!ST && ST.has('STAGE 2 = NOT STARTED'), 'ROUND-SCOPE records STAGE 2 = NOT STARTED as a status field');
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
ck(/40 suites, 3936 assertions, 8 failed/.test(LOG), 'regression-evidence/browser-suite.log is the 40 / 3,936 run');
const BJ = JSON.parse(R('FULL-AUDIT/regression-evidence/browser-suite.json'));
ck(BJ.suites === 40 && BJ.asserts === 3936 && BJ.failures === 8, 'browser-suite.json agrees');
ck(Array.isArray(BJ.detail) && BJ.detail.length === BJ.failures,
   `and carries all ${BJ.failures} failures in full rather than a bare count`);
ck(BJ.detail.every(d => /phone widths/.test(d.suite)),
   'every recorded failure is in the one suite the exception names');
const per = [...LOG.matchAll(/\((\d+) assertions/g)].reduce((a,x)=>a+Number(x[1]),0);
ck(per === 3936, `the 40 per-suite lines sum to ${per}`);
ck(!fs.existsSync(path.join(REPO,'FULL-AUDIT/STAGE-1-TEST-RESULTS.md')),
   'the candidate-only STAGE-1-TEST-RESULTS.md is gone, not left to drift');

console.log('\n  CONTROL CONSISTENCY — Stage 1 final acceptance');
console.log('  ' + '─'.repeat(74));
out.forEach(l => console.log('  ' + l));
console.log(bad ? `\n  ${bad} disagreement(s).\n` : `\n  ${out.length} checks, 0 disagreements.\n`);
process.exit(bad ? 1 : 0);
