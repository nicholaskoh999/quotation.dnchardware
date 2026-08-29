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
const APP = '631cb8945406a934b351e476ec71330ed23a2d27';
const PREV = '1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a';
/* What production RUNS, which is no longer what has been accepted. */
const DEPLOYED = '649f80a09f83a7201c0f3772e01fc270ccda3e05';
const out = []; let bad = 0;
const ck = (ok, m) => { out.push((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) bad++; };
const fmtN = n => Number(n).toLocaleString('en-US');

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
ck(T.browserSuites === 40 && T.browserAssertions === 3936 && T.finalAssertions === 4930
   && T.deltaAssertions === 2120 && T.baselineAssertions === 2810,
   'the accepted matrix is the measured run');
/* HISTORICAL, and now named as such. These two fields read
   "BeforeThisRound" while Item Identity WAS this round; it is two rounds back,
   and a field whose name silently re-points at whoever reads it last is the
   drift this layer exists to stop. They are renamed for the round they
   actually describe, and the arithmetic they record is unchanged. The browser
   matrix has not moved since. */
ck(T.browserSuitesBeforeItemIdentity === 39 && T.browserAssertionsBeforeItemIdentity === 3907
   && T.itemIdentityBrowserAssertions === 29
   && T.browserAssertionsBeforeItemIdentity + T.itemIdentityBrowserAssertions === T.browserAssertions,
   `the browser matrix last grew at Item Identity: 3,907 + 29 = ${T.browserAssertions}, and has not moved since`);
ck(T.browserSuitesBeforeThisRound === undefined && T.browserAssertionsBeforeThisRound === undefined,
   'and the fields no longer claim to describe "this round", whichever round is reading them');
ck(T.browserAssertions + T.pricingHistoryAssertions + T.aiExtractionAssertions
   + T.workbookAssertions + T.translationAssertions + T.saveRetryAssertions
   + T.mysqliCompatAssertions + T.actorIdentityAssertions + T.itemIdentityAssertions
   + T.transactionFoundationAssertions + T.revisionWriterAssertions === T.finalAssertions,
   `3,936+172+107+62+15+42+94+150+159+92+101 = ${T.finalAssertions}`);
ck(T.finalAssertions - T.baselineAssertions === T.deltaAssertions, '4,930 − 2,810 = +2,120');
ck(A.SIDE['pricing-history-php.log'] === T.pricingHistoryAssertions
   && A.SIDE['ai-extract-php.log'] === T.aiExtractionAssertions
   && A.SIDE['pricing-workbook.log'] === T.workbookAssertions
   && A.SIDE['translation-coverage.log'] === T.translationAssertions
   && A.SIDE['save-retry-php.log'] === T.saveRetryAssertions
   && A.SIDE['mysqli-compat-php.log'] === T.mysqliCompatAssertions
   && A.SIDE['auth-identity-php.log'] === T.actorIdentityAssertions
   && A.SIDE['item-identity-php.log'] === T.itemIdentityAssertions
   && A.SIDE['transaction-foundation-php.log'] === T.transactionFoundationAssertions
   && A.SIDE['revision-writer-php.log'] === T.revisionWriterAssertions,
   'the ten side suites agree in both files');
/* Transaction foundation moved 85 -> 92 in this promotion, and a moved figure
   is exactly what a checker should be able to state rather than absorb. */
ck(T.transactionFoundationAssertions === 92 && T.revisionWriterAssertions === 101,
   'transaction foundation is 92, up from 85, and the writer is a tenth group of 101');
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
ck(S.length === 12, `${S.length} superseded application commits recorded`);
ck(S.map(x => x.sha.slice(0,7)).join(' → ') === '7f5bc97 → e3d659b → 33ae0da → 98a31e3 → 3e89713 → cf92f27 → 6bb5772 → 86cf262 → 97a14cf → e76bb85 → 649f80a → 1ca6554',
   'the historical chain is intact: ' + S.map(x => x.sha.slice(0,7)).join(' → '));
ck(S[11].sha === PREV && S[11].supersededBy === APP, `${PREV.slice(0,7)} is recorded superseded by ${APP.slice(0,7)}`);
ck(!S.some(x => x.sha === APP), 'the accepted commit is not also listed as superseded');
ck(MD.includes('`1ca65543cacb2d2fe3ef84522deb01d1bfce2a7a` — superseded by `631cb89`'),
   'CANONICAL-STATE.md records the same supersession');
const H = C.history;
ck(H.supersededAssertionTotals.includes(4822) && !H.supersededAssertionTotals.includes(4930),
   '4,822 retired, 4,930 is not retired');
ck(H.supersededDeltas.includes(2012) && !H.supersededDeltas.includes(2120),
   '+2,012 retired, +2,120 is not retired');
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
/* This is DEPLOYMENT history, not the acceptance chain, and the two have
   parted again: PREV is the previously ACCEPTED commit, which happens to be
   what production runs today. What must hold is that the field names a real
   commit that production actually ran before the current one. */
{ const was = String(C.production.previouslyDeployedApplicationCommit || '');
  let realWas = true; try { git('cat-file','-t',was); } catch { realWas = false; }
  ck(realWas && was !== DEPLOYED,
     `canonical records a previously deployed build ${was.slice(0,7)}, distinct from the live ${DEPLOYED.slice(0,7)}`);
  let order = true; try { git('merge-base','--is-ancestor',was,DEPLOYED); } catch { order = false; }
  ck(order, 'and it precedes the live one in history'); }
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
ck(git('diff','--name-only',PREV+'..'+APP,'--','*.php',':(exclude)tests/**') === 'api.php',
   'the promotion carries exactly api.php');
ck(git('diff','--name-only',PREV+'..'+APP,'--','tests/suites','tests/lib','tests/php').split('\n').sort().join(',')
   === 'tests/php/revision_storage.test.php,tests/php/revision_writer.test.php,'
     + 'tests/php/transaction_foundation.test.php',
   'and exactly three PHP suites — its own new one, and the two whose '
   + '"no writer exists" guards this round was authorised to replace');
ck(git('diff','--name-only','--diff-filter=MD',PREV+'..'+APP,'--','tests/suites') === '',
   'not one of the forty accepted browser suites was modified or deleted');
/* '*.php' matches tests/php/*.test.php too. Revision Storage added
   tests/php/revision_storage.test.php AFTER the accepted commit without
   touching the application, which is legitimate and which this assertion
   could not previously express. The application half is asked for on its own;
   the test half is asked for separately below. */
ck(git('diff','--name-only',APP+'..HEAD','--','*.php',':(exclude)tests/**') === '',
   'no application PHP differs from the accepted commit');
ck(git('diff','--name-only','--diff-filter=MD',APP+'..HEAD','--','tests/php') === '',
   'and no accepted PHP suite was modified or deleted after it — only added to');
ck(git('diff','--name-only',APP+'..HEAD','--','tests/suites','tests/lib') === '',
   'no browser-test byte differs from the accepted commit');
ck(git('log','-1','--format=%H',PREV+'..HEAD','--','api.php',
       'tests/php/revision_writer.test.php','tests/php/transaction_foundation.test.php',
       'tests/php/revision_storage.test.php') === APP,
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

// ── Revision Storage: accepted, and accepted is not applied ──
{ const R = C.revisionStorage || {};
  ck(R.status === 'FINAL ACCEPTED / CLOSED', `revision storage: ${R.status}`);
  ck(git('cat-file','-t',String(R.acceptedCandidate)) === 'commit',
     `its accepted candidate ${String(R.acceptedCandidate).slice(0,7)} exists`);
  let inMain = true; try { git('merge-base','--is-ancestor',R.acceptedCandidate,'HEAD'); } catch { inMain = false; }
  ck(inMain, 'and is an ancestor of HEAD');
  ck(R.applicationCommitMoved === false && A.APP_SHA === APP,
     'it moved no application commit — the accepted application is still ' + APP.slice(0,7));
  ck(/^NOT APPLIED/.test(R.migrationApplied || ''), 'its migration is NOT APPLIED to production');
  /* This read /^NOT STARTED/ for two rounds and was correct both times. The
     writer has now been accepted, so the assertion becomes the contract that
     replaces the absence — which is stricter than what it replaced, because
     "nothing writes to it" was only ever true until something did. */
  ck(/^STARTED AND ACCEPTED/.test(R.revisionWriter || ''),
     'the revision writer has STARTED and is accepted');
  ck(A.REVISION_STORAGE.assertions === R.assertions && A.REVISION_STORAGE.failed === R.failed,
     `authoritative.js and canonical agree: ${R.assertions} assertions, ${R.failed} failed`);
  const eng = Object.keys(R.verifiedOn || {});
  ck(eng.length === 2 && eng.some(e => /8\.0\./.test(e)),
     `verified on ${eng.join(' and ')} — including a production-version engine`);
  ck(Object.values(R.verifiedOn || {}).every(v => v.assertions === R.assertions && v.failed === 0),
     'both engines returned the same count with no failures');
  /* The figure stays OUT of the application total, on purpose. The sum
     assertion above already proves finalAssertions is exactly the eight
     application side groups plus the browser matrix; this states the
     consequence so a future round cannot quietly add a ninth. */
  ck(T.revisionStorageAssertions === undefined,
     'and it is NOT folded into the application assertion total, which stays '
     + fmtN(T.finalAssertions));
  (R.artefacts || []).forEach(f => {
    let there = true; try { git('cat-file','-e','HEAD:'+f); } catch { there = false; }
    ck(there, `artefact present: ${f}`); });
  /* Was written for the Revision Storage window and named the wrong file.
     What matters now is the same invariant the PHP check makes: nothing has
     changed since the accepted commit. */
  ck(git('diff','--name-only',APP+'..HEAD','--','*.sql') === '',
     'no SQL differs from the accepted commit'); }

// ── Snapshot Revision Writer: accepted, append-only, and still not deployable ──
{ const W = C.revisionWriter || {};
  ck(W.status === 'FINAL ACCEPTED / CLOSED', `revision writer: ${W.status}`);
  ck(W.acceptedCandidate === APP, `its accepted candidate IS the accepted application ${APP.slice(0,7)}`);
  ck(W.applicationCommitMoved === true
     && JSON.stringify(W.applicationFilesChanged) === JSON.stringify(['api.php']),
     'it moved the application commit, and api.php is the only application file it carries');
  ck(A.SIDE['revision-writer-php.log'] === W.assertions && W.failed === 0,
     `authoritative.js and canonical agree: ${W.assertions} assertions, ${W.failed} failed`);
  { const eng = Object.keys(W.verifiedOn || {});
    ck(eng.length === 2 && eng.some(e => /8\.0\./.test(e)),
       `verified on ${eng.join(' and ')} — including a production-version engine`);
    ck(Object.values(W.verifiedOn || {}).every(v => v.assertions === W.assertions && v.failed === 0),
       'both engines returned the same count with no failures'); }
  /* APPEND-ONLY IS ENFORCED BY CODE, because the storage round deliberately
     declined to add a trigger. So the code is what gets asked. */
  const api = R('api.php');
  ck((api.match(/INSERT INTO quotation_revisions/g) || []).length === 1,
     'exactly one INSERT INTO quotation_revisions in the whole application');
  ck(!/(UPDATE|DELETE\s+FROM|TRUNCATE)\s+quotation_revisions/.test(api),
     'and no UPDATE, DELETE or TRUNCATE against it anywhere');
  { const others = git('ls-files','*.php').split('\n')
      .filter(f => f && f !== 'api.php' && !f.startsWith('tests/'));
    const guilty = others.filter(f => /quotation_revisions/.test(R(f)));
    ck(guilty.length === 0,
       `no other application file mentions the table (checked ${others.length})`); }
  /* THE ISOLATION IS SCOPED TO ONE TRANSACTION. Neither the session nor the
     server may be changed — that would silently re-tune every other query. */
  ck((api.match(/SET TRANSACTION ISOLATION LEVEL READ COMMITTED/g) || []).length === 1
     && !/SET\s+(SESSION|GLOBAL)\s+TRANSACTION\s+ISOLATION/.test(api),
     'READ COMMITTED is set once, for the next transaction only — no SESSION or GLOBAL form');
  /* And the retry contract the fix exists to restore is still ONE attempt. */
  ck((api.match(/1062/g) || []).length >= 1 && !/while\s*\(.*1062/.test(api),
     'the 1062 retry is still a single attempt, not a loop');
  ck(/MUST be APPLIED to production BEFORE/.test(W.deploymentDependency || ''),
     'canonical records the deployment ORDER: the migration first, then the application');
  ck(/^ABSENT/.test(C.production.quotationRevisionsTable || ''),
     'and records that production still has no quotation_revisions table');
  ck(C.production.deployedApplicationCommit !== APP,
     `so the accepted application ${APP.slice(0,7)} is NOT deployed, and cannot be until it is`); }

// ── the investigated browser flake, recorded rather than absorbed ──
{ const F = T.browserFlakeInvestigated || {};
  ck(/FLAKE/.test(F.classification || ''), `the ninth browser failure is recorded as: ${F.classification}`);
  ck(Array.isArray(F.evidence) && F.evidence.length >= 4,
     `with ${(F.evidence||[]).length} pieces of evidence rather than an assertion that it was fine`);
  ck(F.fixed === false && typeof F.whyNotFixed === 'string' && F.whyNotFixed.length > 0,
     'and is recorded as NOT fixed, with the reason — not quietly repaired out of scope');
  ck(git('diff','--name-only',PREV+'..'+APP,'--','tests/suites','tests/lib','index.php') === '',
     'which the tree confirms: no browser suite, no harness and no index.php byte moved'); }

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
