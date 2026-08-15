/* Minimal assertion + suite bookkeeping. Every assertion is counted, every
   failure carries the suite, the case and both values, and nothing is reported
   as passing that did not run. */
'use strict';

const state = { suites: [], current: null, asserts: 0, failures: [] };

function suite(name) {
  state.current = { name, asserts: 0, failures: 0, cases: [] };
  state.suites.push(state.current);
  return state.current;
}

function fail(msg) {
  state.current.failures++;
  state.failures.push({ suite: state.current.name, msg });
  process.exitCode = 1;
}

function ok(cond, msg) {
  state.asserts++; state.current.asserts++;
  if (!cond) fail(msg);
  return !!cond;
}

function eq(actual, expected, msg) {
  const a = String(actual), e = String(expected);
  return ok(a === e, `${msg}\n      expected: ${JSON.stringify(e)}\n      actual:   ${JSON.stringify(a)}`);
}

function near(actual, expected, tol, msg) {
  const a = Number(actual), e = Number(expected);
  const good = isFinite(a) && Math.abs(a - e) <= tol;
  return ok(good, `${msg}\n      expected: ${e} ±${tol}\n      actual:   ${a}`);
}

function includes(hay, needle, msg) {
  return ok(String(hay).includes(needle),
    `${msg}\n      expected to contain: ${JSON.stringify(needle)}\n      actual: ${JSON.stringify(String(hay).slice(0, 400))}`);
}

function excludes(hay, needle, msg) {
  return ok(!String(hay).includes(needle),
    `${msg}\n      expected NOT to contain: ${JSON.stringify(needle)}\n      actual: ${JSON.stringify(String(hay).slice(0, 400))}`);
}

function report() {
  const lines = [];
  let totalA = 0, totalF = 0;
  for (const s of state.suites) {
    totalA += s.asserts; totalF += s.failures;
    lines.push(`  ${s.failures ? 'FAIL' : 'ok  '}  ${s.name}  (${s.asserts} assertions${s.failures ? ', ' + s.failures + ' failed' : ''})`);
  }
  lines.push('');
  lines.push(`  ${state.suites.length} suites, ${totalA} assertions, ${totalF} failed`);
  if (state.failures.length) {
    lines.push('');
    lines.push('  FAILURES');
    for (const f of state.failures) lines.push(`   - [${f.suite}] ${f.msg}`);
  }
  return { text: lines.join('\n'), suites: state.suites.length, asserts: totalA, failures: totalF, detail: state.failures };
}

module.exports = { suite, ok, eq, near, includes, excludes, report, state };
