# Error leakage audit — 2026-10-20

Round **QUICK ADD TL OVERRIDE + HARDENING AUDIT**, session C.
Branch `round/quo-c-error-escape-csrf`, base `main` `076e2ae`.

**Question:** can a raw `$db->error`, `$stmt->error`, `connect_error`,
exception message or other driver / SQL detail reach the browser?

**Answer before this branch:** yes. Every database failure in `api.php` sent the
driver text to the browser inside `error`. **After this branch:** not from
`api.php`. Two sites outside the round's file list are still open (§3).

## 1. The fix

There is one new helper in `api.php`, `dc_db_fail($label, $handle)`:

- the browser gets `{"ok":false,"error":"<label> (ref 1a2b3c4d)"}`. The shape is
  unchanged and the label is the one the call site already used, so every
  message that used to start with "Quotation save failed" still starts with it.
- `error_log` gets
  `[api] ref=1a2b3c4d action=<action> <label> errno=<n>: <driver text>`.
- The ref is 8 hex characters from `random_bytes(4)`. It is not derived from
  anything, so it gives nothing away. It exists so a screenshot of the toast is
  enough to find the matching log line.
- The PHP 8.4 `mysqli_report(MYSQLI_REPORT_OFF)` contract is unchanged. The
  helpers still check return values, and nothing is thrown or caught. Only the
  header comment's sentence about where the driver text goes was updated.
- On the client, every place that shows `error` uses `textContent`: index.php
  `showToast` (9854), companies.php `showToast` (1122) and Quick Add `wqaMsg`.
  So the client display needed no change.

## 2. Leak sites in `api.php` — all fixed

| # | Site (line at base `076e2ae`) | What leaked | Status |
|---|---|---|---|
| 1 | `query_or_fail` (163) | `$db->error`, used by ~25 call sites | **fixed** |
| 2 | `prepare_or_fail` (169) | `$db->error`, used by ~45 call sites | **fixed** |
| 3 | `execute_or_fail` (174) | `$stmt->error`, used by ~35 call sites | **fixed** |
| 4 | `require_table` (185) | table name in the message | **fixed**: the table name now goes to the log only; the client still gets the "Import database-safe-patch.sql" instruction |
| 5 | `dc_write_revision` (826) | `$stmt->error` from the revision INSERT | **fixed** |
| 6 | `save_quotation` BEGIN (1396) | `$db->error` | **fixed** |
| 7 | `save_quotation` INSERT (1412) | `$stmt->error`, which can include "Duplicate entry … for key …" and "Data too long for column …" | **fixed** |
| 8 | `save_quotation` COMMIT (1425) | `$db->error` | **fixed** |
| 9 | `update_quotation` BEGIN (1462) | `$db->error` | **fixed** |
| 10 | `update_quotation` COMMIT (1510) | `$db->error` | **fixed** |

`tests/php/error_leakage.test.php` covers every row above (§4).

## 3. Other files audited

| File | Finding | Status |
|---|---|---|
| `db.php` → `getDB()` | Server-only and not in Git. If production follows `db.sample.php`, a failed connection answers `{"error":"DB connection failed: <connect_error>"}`. That text usually includes the DB **username and host**, e.g. "Access denied for user 'x'@'localhost'". It is reachable from api.php after login, and from **login.php POST with no login at all**: dc_login_db() calls getDB(), whose `die()` prints the JSON instead of the sign-in page. | **NOT FIXED — out of scope.** `db.php` cannot be changed from Git, and `db.sample.php` is not in the round's file list. Recommendation: the owner changes `getDB()` on the server (and the sample in a later round) to `error_log('[db] connect failed: ' . $conn->connect_error); die(json_encode(['ok'=>false,'error'=>'Database unavailable']));`. |
| `login.php` | Shows only "Wrong username or password." / "Please enter both …". `dc_login()` fails closed and never echoes driver text. | clean, apart from the getDB() row above |
| `auth.php` | The only JSON it sends is the static `Not signed in` (401). | clean |
| `companies.php` | Has no server code apart from the login guard. Its JS shows api.php's `error` via `textContent`, so it is covered by §2. | clean |
| `pricing_history.php` | A library with no queries and no output. | clean |
| `ai_extract.php` | `ai_map_error()` maps curl/HTTP failures to fixed messages. `error_log` records only http code, mime, size, ms and model. The raw upstream body, `curl_error` text and key never reach the client. | clean |
| `index.php` client | The History panel shows dictionary text on failure (`histError`). Toasts and Quick Add messages use `textContent`. | clean |

### Lower-severity residuals (not driver text; recorded, not changed)

- **Uncaught fatals.** A few api.php paths call methods on a result without
  checking it first, e.g. `ref_no_in_use()` calls `$stmt->get_result()->fetch_assoc()`.
  If `get_result()` returned false, PHP would fatal. With `display_errors=On`,
  the browser would get an HTML error carrying the server file path. Production
  should run `display_errors=Off`. That is a php.ini question for Session B /
  the owner and was not verified here.
- **`Unknown action: <action>`** echoes the requested action name back as JSON.
  That is input reflection, not server detail, and the client never renders it
  as HTML. Left as is.
- **`dc_db_fail` after `release_ref_lock`.** When BEGIN fails on save, the
  existing code releases the named lock before reporting. That `RELEASE_LOCK`
  query can overwrite `$db->error`, so the *log* line may show the release
  result rather than the BEGIN error. The client is unaffected. Fixing it means
  reading the error before the release, which is a small follow-up.

## 4. Evidence

`php tests/php/error_leakage.test.php`: **410 assertions, 0 failed**. Against
the base `api.php` the same test reports **102 failed**.

- §1 lifts the shipped helpers into a child process and drives them with
  hostile driver text: a table name, an SQL syntax error with the SQL in it,
  and an errno. The test checks that the body has no SQL, table, column, key or
  driver words and no errno. It checks that the error matches
  `<label> (ref xxxxxxxx)`. It checks that the `error_log` file the child wrote
  (`ini_set('error_log', tmp)`) holds the same ref, the errno and the full
  driver text. Two failures get two different refs.
- §2 serves a **byte-identical copy of the shipped api.php** with PHP's
  built-in server. The stub db.php returns a **scripted fake driver**, so no
  database connection of any kind is made and the test cannot be pointed at
  production. Each of the ten sites in §2 is reached by a real HTTP request.
  The response shape is still exactly `{ok, error}`, there is no PHP warning in
  the body, and the server's error_log has the same ref, errno, action and
  driver text. A healthy request still succeeds.
- §3 scans the comment-blanked source. `->error` / `->connect_error` are read
  only inside `dc_db_fail()`. No `fail_json` or `json_encode` is given driver
  text and nothing echoes `getMessage()`. `MYSQLI_REPORT_OFF` still runs before
  `db.php`, and the helpers still branch on return values.

### Existing tests that encoded the leak

Two existing assertions checked the leaking text itself, so they fail once the
leak is fixed. Both files are outside the round's candidate list. They were
raised as a scope conflict rather than edited:

- `tests/php/mysqli_compat.test.php` §3 lifts `query_or_fail`, `prepare_or_fail`
  and `execute_or_fail` without the new `dc_db_fail`, then expects
  `"Lookup failed: Table missing"`. **12 assertions** fail.
- `tests/php/save_retry.test.php` §5 searches the source for the string
  `fail_json('Quotation save failed: ' . $stmt->error)`. **1 assertion** fails.

Tests that check only a message *prefix* still pass:
`transaction_foundation` "Quotation save failed", and `revision_writer` /
`noop_suppression` "Revision".
