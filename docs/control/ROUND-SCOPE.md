# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**ACTOR IDENTITY FOUNDATION**

The smallest production-safe change that lets the server know WHICH INDIVIDUAL
authenticated person is making a request. No audit history, no revisions, no
item ids, no roles, no RBAC, no user-management UI, no password reset, no 2FA,
no deployment.

| | |
|---|---|
| Accepted application commit | `97a14cf56bad6414e382c6f49f40d13eabd97dc9` |
| main | `e7646c861976f3087f8f08f3dd653e3922fa4dd3` |
| Round status | **CANDIDATE — READY FOR REVIEW** |
| DEPLOY = NO | a candidate is not a deployed state |
| STAGE 2 = NOT STARTED | nothing in Stage 2 was begun, examined or implied |
| Production DB change | **NO** — the migration is prepared, NOT APPLIED |

---

## WHY THIS ROUND EXISTS

`auth.php` is one shared hard-coded account:

```php
const DC_AUTH_USER = 'admin';
$_SESSION['dc_user'] = DC_AUTH_USER;      // always the literal 'admin'
```

Three or four staff sign in as the same identity, so the server cannot tell
Nicholas from anyone else. The accepted Audit / Revision History architecture
needs to answer "WHO changed this quotation?", and no audit table can answer it
while every request is `admin`. This round supplies the missing half:

```
authenticated request  →  immutable numeric user_id + username + display_name
```

read from the SERVER session, never from the client.

---

## ALLOWED TO CHANGE

```candidate-files
auth.php
login.php
migrations/2026-08-26-create-app-users.sql
tests/php/auth_identity.test.php
```

Nothing else may differ from `97a14cf56bad6414e382c6f49f40d13eabd97dc9`.

`api.php`, `index.php`, `companies.php`, `pricing_history.php`,
`ai_extract.php`, `logout.php`, `db.sample.php` and every browser suite are
**out of scope and must not change**.

---

## DESIGN, DECIDED BEFORE IMPLEMENTATION

**`auth.php` keeps its zero-DB property.** It is required by `index.php`,
`companies.php`, `api.php`, `login.php` and `logout.php`; making it load the
database would put a connection behind every page. The credential lookup
therefore takes an **injected** handle:

```php
dc_login($db, $username, $password)
```

`login.php` is the only caller and the only file that loads `db.php` — lazily,
inside the POST branch, so a GET of the login page still opens no connection.
No circular require, no hidden global, and no `app_users` lookup on any normal
API request: after login the identity lives in the session.

**PHP 8.4.** `login.php` must call `mysqli_report(MYSQLI_REPORT_OFF)` before
requiring `db.php`, exactly as `api.php` does, or the accepted return-value
contract is lost and a DB fault becomes an uncaught `mysqli_sql_exception`.

**Fail closed.** Any DB fault — no handle, prepare fails, execute fails, no row,
`enabled = 0`, bad password — returns false and establishes NO session.

**Username normalisation:** `strtolower(trim($username))`, stored lowercase,
looked up lowercase, `UNIQUE`. `Nicholas`, `NICHOLAS` and `nicholas` are one
identity. `display_name` casing is never touched.

**No shared-admin fallback.** `DC_AUTH_USER` and `DC_AUTH_PASS_HASH` are
removed. Rollout is a clean cutover (application rollback restores the old
shared-login app); a fallback would be a permanent backdoor.

**Session contract** — all three identity fields come from the authenticated
DB row:

```php
$_SESSION['dc_auth']         = true;
$_SESSION['dc_user_id']      = (int) row id;
$_SESSION['dc_username']     = normalised username;
$_SESSION['dc_display_name'] = row display_name;
$_SESSION['dc_login_time']   = time();
$_SESSION['dc_user']         = username;   // compatibility alias only
```

`dc_current_user()` reads the session, validates it, and returns
`['id','username','display_name']` or `null`. Future audit code consumes that
helper, never `$_SESSION` internals and never `dc_user`.

**`dc_is_logged_in()` additionally requires a valid identity.** A session
carrying only the old `dc_auth` + `dc_user` shape is no longer authenticated.
That is deliberate: on cutover every existing shared-account session must stop
being trusted rather than silently become an unidentified actor.

---

## MUST NOT CHANGE — PROVEN, NOT ASSERTED

`ref_no` format · server-side allocation · `GET_LOCK` · `uq_quotations_ref`
· `NOT NULL ref_no` · the one-time 1062 retry · quotation create / update /
delete semantics · pricing · material mapping · Previous Price · Quick Add ·
the item JSON structure · the translation dictionary outside the login strings
this round touches · the PHP runtime target.

---

## ACCEPTANCE — WHAT MUST BE TRUE TO CLOSE

Targeted evidence, on the real PHP 8.4 runtime, against the real `auth.php`
with real PHP sessions:

- valid enabled user with the right password logs in, and the session carries
  `dc_auth`, the right `dc_user_id`, `dc_username`, `dc_display_name` and a
  positive `dc_login_time`
- wrong password, unknown username and `enabled = 0` each FAIL
- case normalisation behaves exactly as documented
- the session id CHANGES on successful login
- two sessions can hold two different users at once, with different ids
- logging one out leaves the other authenticated
- an expired `dc_login_time` is rejected
- the page guard redirects; the API guard returns JSON 401
- a DB failure fails closed, with no authenticated session and no uncaught
  `mysqli_sql_exception`
- a failed login leaves no authenticated state behind
- `password_verify` is used and no plaintext credential is committed
- the migration declares UNIQUE on username

Then the FULL regression: **39 suites, 3,907 browser assertions, 0 failed,
0 skipped**, translation **862 keys / 100%**, and `php -l` clean on 8.4.

Then STOP. **No deploy. No production DB change.** Candidate only.

---

## HUMAN REVIEW · PATCH ROUND (candidate `e396d60`)

Two code findings, both upheld. Recorded here because the round stays open.

**F1 — failed-login timing.** The first candidate only ran `password_verify()`
when a row supplied a non-empty hash, so an unknown username returned without
doing bcrypt work while a known one did. My report claimed the two were
indistinguishable by timing; **that claim was not justified and was wrong.**
`dc_login()` now falls back to `DC_AUTH_DUMMY_HASH` — a real bcrypt hash of a
random string that was generated once, never written down and discarded — so
`password_verify()` runs on every credential failure. It authenticates nothing:
it is only reached when no usable row was found, and the row check fails the
login regardless of what verification returned.

**What this does and does not claim.** An unknown username now pays the same
bcrypt verification cost as a known username, which reduces the
username-enumeration timing signal. It does **not** guarantee identical
end-to-end request timing: database and control-flow costs may still differ,
and nothing here measures them. The evidence supports the narrower claim only.

**F2 — `get_result()` removed.** It requires mysqlnd, a dependency the accepted
application never had. The lookup now uses the portable
`bind_param` → `execute` → `bind_result` → `fetch` pattern, bounded by
`LIMIT 1` and closed, with every step return-checked under the accepted
`MYSQLI_REPORT_OFF` contract. The test driver deliberately offers no
`get_result()` to fall back on.

**F3 — repository chain.** Reported, not acted on: rebasing would require a
force push, which this round's own rule forbids. See the report.

Status remains **CANDIDATE — READY FOR HUMAN REVIEW**.
