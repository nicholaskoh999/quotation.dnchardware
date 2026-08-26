'use strict';
/* ── The validator's own state assertion, tested ────────────────────────────
 *
 * Run:  node tests/tools/check-control-assertions.test.js
 *
 * check-control.js decides whether a round is closed. It used to decide that
 * by searching the whole of ROUND-SCOPE for the substring "FINAL ACCEPTED /
 * CLOSED", which a sentence DENYING the state satisfies just as well as one
 * asserting it. That is the false green recorded in
 * FULL-AUDIT/UI-POLISH-2A.md §9a.
 *
 * The parser is EXTRACTED FROM THE SHIPPED check-control.js by brace matching
 * and evaluated — the same principle save_retry.test.php and
 * mysqli_compat.test.php use. check-control.js cannot simply be required: it
 * runs its whole battery at load and calls process.exit(). Extracting means
 * this test measures the validator that actually ships; if it is rewritten,
 * this test runs the rewrite.
 */

const fs = require('fs');
const path = require('path');

let asserts = 0; const failures = [];
const ok = (cond, msg) => { asserts++; if (!cond) failures.push(msg); };
const eq = (actual, expected, msg) => ok(
    actual === expected,
    `${msg}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);

const SRC = fs.readFileSync(path.join(__dirname, 'check-control.js'), 'utf8');

/* ── lift roundScopeStatus() out of the shipped validator ─────────────────── */
function lift(src, name) {
    const at = src.indexOf(`function ${name}(`);
    if (at < 0) return null;
    let depth = 0, i = src.indexOf('{', at);
    for (const n = src.length; i < n; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(at, i + 1);
}

const lifted = lift(SRC, 'roundScopeStatus');
ok(lifted !== null, 'roundScopeStatus() is present in the shipped check-control.js');
// eslint-disable-next-line no-eval
const roundScopeStatus = eval(`(${lifted})`);
ok(typeof roundScopeStatus === 'function', 'and it evaluates into this scope');

/* A ROUND-SCOPE document with the given status-table rows, plus whatever prose
   the case wants to try to fool the check with. */
const doc = (rows, prose = '') => `# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**SOME ROUND**

${prose}

| | |
|---|---|
| Accepted application commit | \`97a14cf\` |
${rows}

---

## WHY THIS ROUND EXISTS

Body text.

## OUTCOME — FINAL ACCEPTED / CLOSED

| | |
|---|---:|
| Round status | **FINAL ACCEPTED / CLOSED** |
`;

/* The assertion under test, exactly as check-control.js applies it. */
const closed = text => {
    const ST = roundScopeStatus(text);
    return ST instanceof Map && ST.get('Round status') === 'FINAL ACCEPTED / CLOSED';
};
const deployNo = text => {
    const ST = roundScopeStatus(text);
    return ST instanceof Map && ST.has('DEPLOY = NO');
};

// ══ 1 · the accepted state passes ════════════════════════════════════════════
{
    ok(closed(doc('| Round status | **FINAL ACCEPTED / CLOSED** |')),
       '1: an exact status field of FINAL ACCEPTED / CLOSED passes');
    ok(closed(doc('| Round status | FINAL ACCEPTED / CLOSED |')),
       '1: with or without markdown emphasis');
    ok(deployNo(doc('| Round status | **FINAL ACCEPTED / CLOSED** |\n| DEPLOY = NO | no deployment |')),
       '1: DEPLOY = NO is found as a status field');
}

// ══ 2 · the denial FAILS — the whole point of the round ══════════════════════
{
    ok(!closed(doc('| Round status | **NOT FINAL ACCEPTED / CLOSED** |')),
       '2: a status field of NOT FINAL ACCEPTED / CLOSED FAILS');
    ok(!closed(doc('| Round status | OPEN CANDIDATE |',
        'This round is NOT FINAL ACCEPTED / CLOSED.')),
       '2: a denial in prose cannot close an open round');
    ok(!closed(doc('| Round status | OPEN CANDIDATE |',
        'ROUND-SCOPE no longer reads FINAL ACCEPTED / CLOSED.')),
       '2: the exact §9a false-green sentence no longer passes');
    ok(!closed(doc('| Round status | **PREVIOUSLY FINAL ACCEPTED / CLOSED** |')),
       '2: PREVIOUSLY FINAL ACCEPTED / CLOSED FAILS');
    ok(!closed(doc('| Round status | **FINAL ACCEPTED / CLOSED — superseded** |')),
       '2: a longer value that qualifies the state FAILS');
}

// ══ 3 · historical and prose mentions FAIL ═══════════════════════════════════
{
    ok(!closed(doc('| Round status | OPEN CANDIDATE |',
        'Stage 1 was FINAL ACCEPTED / CLOSED in August.')),
       '3: a historical mention cannot close the current round');
    ok(!closed(doc('| Round status | OPEN CANDIDATE |',
        'The string "FINAL ACCEPTED / CLOSED" is invalid.')),
       '3: prose ABOUT the string cannot close the round');
    ok(!closed(doc('| Round status | OPEN CANDIDATE |',
        '```\nFINAL ACCEPTED / CLOSED\n```')),
       '3: the phrase inside a code fence cannot close the round');
    ok(!closed(doc('| Round status | OPEN CANDIDATE |',
        '| Previous round | FINAL ACCEPTED / CLOSED |')),
       '3: a DIFFERENTLY-LABELLED cell carrying the phrase cannot close the round');
}

// ══ 4 · the OUTCOME table at the foot cannot close the round ════════════════
{
    /* Every doc() above ends with an OUTCOME table whose Round status reads
       FINAL ACCEPTED / CLOSED. Case 2 and 3 pass only because the parser is
       anchored to the ROUND section, so this is already proven — asserted here
       explicitly so the anchoring cannot be removed unnoticed. */
    const d = doc('| Round status | OPEN CANDIDATE |');
    ok(d.includes('## OUTCOME — FINAL ACCEPTED / CLOSED'),
       '4: the fixture really does carry a closed-looking OUTCOME section');
    ok(d.lastIndexOf('| Round status | **FINAL ACCEPTED / CLOSED** |') > d.indexOf('---'),
       '4: and a closed-looking status row AFTER the ROUND section');
    ok(!closed(d), '4: neither can close a round the ROUND section says is open');
}

// ══ 5 · structural failures are failures, not silent passes ═════════════════
{
    eq(roundScopeStatus('no round section here at all'), null,
       '5: a document with no ROUND section yields null, not a false pass');
    ok(!closed('no round section here at all'), '5: and does not pass the assertion');
    ok(!closed(doc('| Something else | value |')),
       '5: a status table with no Round status field FAILS');
    ok(!deployNo(doc('| Round status | **FINAL ACCEPTED / CLOSED** |')),
       '5: DEPLOY = NO is not assumed when the field is absent');
}

// ══ 6 · the real, current ROUND-SCOPE ═══════════════════════════════════════
{
    const RS = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'control', 'ROUND-SCOPE.md'), 'utf8');
    const ST = roundScopeStatus(RS);
    ok(ST instanceof Map, '6: the real ROUND-SCOPE parses into a status table');
    ok(ST && ST.size >= 3, `6: with several fields (found ${ST ? ST.size : 0})`);
    eq(ST && ST.get('Round status'), 'FINAL ACCEPTED / CLOSED',
       '6: and its Round status field reads exactly FINAL ACCEPTED / CLOSED');
    ok(ST && ST.has('DEPLOY = NO'), '6: DEPLOY = NO is a real field in it');
    ok(ST && ST.has('STAGE 2 = NOT STARTED'), '6: STAGE 2 = NOT STARTED is a real field in it');
}

// ══ 7 · the shipped validator no longer searches the document for the state ══
{
    ok(!/\/FINAL ACCEPTED \\\/ CLOSED\/\.test\(RS\)/.test(SRC),
       '7: the loose substring test on the whole document is gone');
    ok(!/\/DEPLOY = NO\/\.test\(RS\)/.test(SRC),
       '7: and so is the loose DEPLOY = NO test');
    ok(!/\/STAGE 2 = NOT STARTED\/\.test\(RS\)/.test(SRC),
       '7: and the loose STAGE 2 test');
    ok(SRC.includes("ST.get('Round status') === 'FINAL ACCEPTED / CLOSED'"),
       '7: the state is asserted by exact field value');
}

// ── report ───────────────────────────────────────────────────────────────────
const name = 'control validator — the round state is a field, not a phrase';
if (failures.length) {
    console.log(`\n  FAIL  ${name}  (${asserts} assertions, ${failures.length} failed)\n`);
    failures.forEach(f => console.log(`   - ${f}`));
    console.log('');
    process.exit(1);
}
console.log(`\n  ok    ${name}  (${asserts} assertions)\n`);
