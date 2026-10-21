/* ── CI gate for the legacy browser matrix ──────────────────────────────────
   node tests/tools/ci-browser-gate.js <DC_TEST_JSON file>

   The accepted matrix is not 0 failed, and CANONICAL-STATE forbids restating
   it as though it were. So this gate neither hides the known failures nor lets
   them turn CI permanently red:

     · a failure that matches a KNOWN, documented pre-existing entry is printed
       as KNOWN with its reference, and does not fail the job;
     · ANY other failure fails the job;
     · a known entry that did NOT fail is printed too, because a known failure
       that silently disappears is also a change worth seeing.

   The list mirrors docs/control/CANONICAL-STATE.md "THE EIGHT FAILURES" and
   "A NINTH FAILURE APPEARED ONCE" — it is not a place to park new failures. */
'use strict';
const fs = require('fs');

const KNOWN = [
  { suite: /38-mobile-ui|phone widths/i, msg: /close|modal|✕|desk/i, ref: 'CANONICAL-STATE: THE EIGHT FAILURES (38-mobile-ui font metrics)', max: 8 },
  { suite: /edit mode|35-edit-mode/i, msg: /clearing it back to the default lets the session close/i, ref: 'CANONICAL-STATE: load-sensitive 35-edit-mode flake', max: 1 },
];

const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error('usage: ci-browser-gate.js <DC_TEST_JSON>'); process.exit(2); }
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
const used = KNOWN.map(() => 0);
const unknown = [];
for (const f of r.detail || []) {
  const i = KNOWN.findIndex((k, j) => k.suite.test(f.suite) && k.msg.test(f.msg) && used[j] < k.max);
  if (i >= 0) { used[i]++; console.log(`  KNOWN  [${f.suite}] ${f.msg.split('\n')[0]}\n         ↳ ${KNOWN[i].ref}`); }
  else unknown.push(f);
}
KNOWN.forEach((k, i) => { if (!used[i]) console.log(`  NOTE   known entry did not fail this run: ${k.ref}`); });
console.log(`\n  browser: ${r.suites} suites, ${r.asserts} assertions, ${r.failures} failed (${r.failures - unknown.length} known, ${unknown.length} new)`);
if (unknown.length) {
  console.log('\n  NEW FAILURES:');
  unknown.forEach(f => console.log(`   - [${f.suite}] ${f.msg}`));
  process.exit(1);
}
