/* Test runner. `node tests/run.js` runs every suite; `node tests/run.js size`
   runs the suites whose filename contains "size". One browser is launched and
   shared, because launching Chromium costs more than every assertion here put
   together. */
'use strict';
const fs   = require('fs');
const path = require('path');
const { launch } = require('./lib/harness');
const A = require('./lib/assert');

const dir  = path.join(__dirname, 'suites');
const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js'))
  .filter(f => !only.length || only.some(o => f.includes(o)))
  .sort();

(async () => {
  const browser = await launch();
  const t0 = Date.now();
  try {
    for (const f of files) {
      const mod = require(path.join(dir, f));
      try {
        await mod(browser, A);
      } catch (e) {
        A.suite(f + ' (crashed)');
        A.ok(false, 'suite threw: ' + (e && e.stack || e));
      }
    }
  } finally {
    await browser.close();
  }
  const r = A.report();
  console.log(r.text);
  console.log(`\n  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (process.env.DC_TEST_JSON) {
    fs.writeFileSync(process.env.DC_TEST_JSON, JSON.stringify({
      suites: r.suites, asserts: r.asserts, failures: r.failures, detail: r.detail,
    }, null, 2));
  }
  process.exit(r.failures ? 1 : 0);
})();
