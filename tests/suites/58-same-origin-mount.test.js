/* ── Same-origin Portal mount — the page at /quo/ ───────────────────────────
   QUO SAME-ORIGIN PILOT. The same index.php is served at
   https://quo.dnchardware.com/ and at https://portal.dnchardware.com/quo/.
   Served here from /quo/index.php, every request the page makes must stay
   under /quo/ — api.php, the icons, the save — and every write must carry the
   session's CSRF token (X-DC-CSRF). Then the same at the root, unchanged.
   Sign Out posts the token to logout.php instead of navigating to it.   */
'use strict';
const { openApp } = require('../lib/harness');

const TOKEN = 'a'.repeat(64);   // the harness's fixed dc_page_head_meta() token

async function run(browser, A, path) {
  const base = path.slice(0, path.lastIndexOf('/'));          // '' or '/quo'
  const seen = [];
  const page = await openApp(browser, {
    path,
    api: { save_quotation: (url, req) => { seen.push({ url, method: req.method(), csrf: req.headers()['x-dc-csrf'] || null });
                                           return { ok: true, data: { id: 1, ref_no: 'DC-TEST-001' } }; } },
  });
  const requests = [];
  page.on('request', r => requests.push(new URL(r.url()).pathname));
  const label = base || '(root)';

  /* boot already fetched api.php; the icons are in the head */
  const iconHrefs = await page.evaluate(() => [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], img.dnc-mark')]
    .map(n => new URL(n.getAttribute('href') || n.getAttribute('src'), location.href).pathname));
  A.ok(iconHrefs.length >= 3 && iconHrefs.every(p => p.startsWith(base + '/assets/icons/')),
       `${label}: icons resolve under ${base}/assets/icons/ (${iconHrefs.join(', ')})`);
  A.eq(await page.evaluate(() => dcCsrf()), TOKEN, `${label}: the page reads the session token from <meta name="dc-csrf">`);

  /* Save straight through the page's own api(): the same helper every write uses. */
  const res = await page.evaluate(() => api('save_quotation', { items: [] }, 'POST'));
  A.ok(res && res.ok === true, `${label}: a save through api() succeeds`);
  A.eq(seen.length, 1, `${label}: exactly one save POST`);
  A.eq(seen[0] && new URL(seen[0].url).pathname, base + '/api.php', `${label}: the save goes to ${base}/api.php`);
  A.eq(seen[0] && seen[0].csrf, TOKEN, `${label}: and carries X-DC-CSRF`);
  const reads = await page.evaluate(() => fetch('api.php?action=get_companies').then(r => new URL(r.url).pathname));
  A.eq(reads, base + '/api.php', `${label}: a relative read resolves to ${base}/api.php`);
  A.ok(requests.filter(p => p.endsWith('.php')).every(p => p.startsWith(base + '/')), `${label}: no request leaves ${base || '/'}`);

  /* A stale page: the server answers csrf → the user is told to reload, nothing else. */
  await page.unroute('**/*').catch(() => {});
  await page.route('**/api.php*', route => route.fulfill({ status: 403, contentType: 'application/json',
                                                            body: JSON.stringify({ ok: false, error: 'csrf', auth: true }) }));
  const stale = await page.evaluate(() => api('delete_default_price', { id: 1 }, 'POST'));
  A.ok(stale && stale.ok === false && /reload/i.test(stale.error), `${label}: a csrf refusal reads "reload" (${stale && stale.error})`);

  /* Sign Out: one click posts the token to logout.php under the same base. */
  let posted = null;
  await page.route('**/logout.php', route => { const r = route.request(); posted = { method: r.method(), body: r.postData(), path: new URL(r.url()).pathname };
                                               return route.fulfill({ status: 200, contentType: 'text/html', body: 'bye' }); });
  await page.evaluate(() => { const a = document.querySelector('a[href="logout.php"]'); a && a.click(); });
  await page.waitForTimeout(400);
  A.ok(posted && posted.method === 'POST' && posted.path === base + '/logout.php' && posted.body === 'csrf=' + TOKEN,
       `${label}: Sign Out posts the token to ${base}/logout.php (${JSON.stringify(posted)})`);
  A.eq(page._dcErrors, [], `${label}: no page errors`);
  await page.close();
}

module.exports = async (browser, A) => {
  A.suite('same-origin mount — /quo/ requests, token on every write, Sign Out posts');
  await run(browser, A, '/quo/index.php');
  await run(browser, A, '/index.php');
};
