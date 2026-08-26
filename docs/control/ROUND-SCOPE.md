# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**PHP 8.1+ MYSQLI EXCEPTION COMPATIBILITY**

One initialisation call, three explicit CSV arguments. No schema, no index, no
ref_no format, no allocation algorithm, no retry count, no UI, no parser, no
pricing, no translation, no deployment, no production PHP switch.

| | |
|---|---|
| Accepted application commit | `86cf2629a66434bf3bdffe2efc0acbe527c358ac` |
| main | `30f6fc654a5b55e9743c0c87d675b298372fd95f` |
| This round | a **candidate**, not an accepted state |
| Deploy | **NO** |
| Production PHP switch | **NO** — quo.dnchardware.com stays on 8.0 |

---

## WHY THIS ROUND EXISTS

The PHP 8.4 audit ran on a real PHP 8.4.19 runtime and returned READY WITH
REQUIRED FIXES on two findings. This round fixes those two and nothing else.

**F1 — mysqli throws instead of returning false.** PHP **8.1** changed the
default `mysqli_report` mode from `MYSQLI_REPORT_OFF` to
`MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT`. Every error path in this
application is return-value-based —

```
getDB()            checks  $conn->connect_error
query_or_fail()    checks  !$res
prepare_or_fail()  checks  !$stmt
execute_or_fail()  checks  !$stmt->execute()
dc_save_quotation_insert()  checks  !$stmt->execute()  then  $stmt->errno
```

— and the application contains **no `try`/`catch` and no exception handler in
any PHP file**. On 8.4 every one of those checks is dead code: an uncaught
`mysqli_sql_exception` ends the request before any JSON is written, and the
accepted 1062 retry never runs. Proven against the shipped function:

```
(a) PHP 8.0 — execute() returns false
    returned: true | executes: 2 | reallocations: 1 | ref_no now: Q-2026-0432
(b) PHP 8.1+/8.4 default — execute() throws
    UNCAUGHT mysqli_sql_exception | executes: 1 | reallocations: 0
```

**F2 — CSV `$escape` deprecation.** PHP 8.4 emits *"the $escape parameter must
be provided as its default value will change"* for `str_getcsv()`, `fputcsv()`
and `fgetcsv()`. `api.php` calls the first two, inside loops, so the notice
fires **once per row**. Values are unchanged on 8.4; the default changes in
PHP 9.

---

## WHERE THE FIX GOES, AND WHY THERE

Established from the source before writing this scope, not assumed:

- `api.php` is the **only** file that `require`s `db.php` and calls `getDB()`.
- The **only** `new mysqli(...)` in the repository is inside `getDB()`
  (server-only `db.php`; `db.sample.php` mirrors it).
- `auth.php` never touches the database — session only.
- `ai_extract.php` never touches the database.
- `pricing_history.php` constructs nothing; it receives `$db` as a parameter.
- Nothing in `api.php` before line 13 touches mysqli: three `header()` calls,
  `require auth.php`, `dc_require_api_login()`.

So the earliest correct point is **`api.php`, immediately before
`require_once 'db.php'`**. Placing it there means the fix does not depend on
the content of the server-only `db.php`, which this round cannot see or change.

---

## ALLOWED TO CHANGE

```candidate-files
api.php
tests/php/mysqli_compat.test.php
tests/php/save_retry.test.php
```

**Amended mid-round, and why.** `save_retry.test.php` §6 asserts that the name
`dc_save_quotation_insert` appears in `api.php` exactly twice — once defined,
once called. The comment this round adds above `mysqli_report()` explains which
checks the 8.1 default breaks, and names that function as one of them, so the
count is now three. The application is correct; the test counts occurrences in
raw bytes and cannot tell code from prose.

The fix is to count in a **comment-blanked copy** of the source, which is what
the assertion always meant. That is not weakening the check — it makes it
measure the program instead of the commentary, and the new suite uses the same
technique for the same reason. The alternative, rewording the application's
comment so a test's counting method stays happy, would be contorting the
program to fit its measurement.

Nothing else may differ from `86cf2629a66434bf3bdffe2efc0acbe527c358ac`.

**One `mysqli_report()` call, and three explicit `$escape` arguments.**

`db.sample.php` is deliberately NOT touched: the live `db.php` is authoritative
and cannot be reached from here, so a fix that relied on the sample would be a
fix that does not run in production.

---

## THE STRATEGY, AND WHY IT IS SAFE ON BOTH VERSIONS

```php
mysqli_report(MYSQLI_REPORT_OFF);
```

- `mysqli_report()` and `MYSQLI_REPORT_OFF` (value `0`) exist in **every**
  PHP 8.x. Verified on 8.4.19: the call returns `true` and emits no
  deprecation.
- On **PHP 8.0** the default is already `MYSQLI_REPORT_OFF`, so the call is a
  no-op and behaviour is bit-for-bit what production runs today.
- On **PHP 8.4** it restores exactly the 8.0 contract. Verified: a failed
  connection returns a `mysqli` object with `connect_errno=2002` instead of
  throwing, so `getDB()`'s `if ($conn->connect_error)` check runs again.
- It is a global, process-wide setting, so one call covers every later
  `query` / `prepare` / `execute` in the request.

This is the smallest change that satisfies the requirement. The DB layer is
**not** redesigned into exception-based architecture, and no `try`/`catch` is
introduced.

Accepted cost, stated rather than hidden: `MYSQLI_REPORT_OFF` also suppresses
mysqli warnings. That is precisely the PHP 8.0 behaviour production runs today,
and the application already surfaces `$db->error` / `$stmt->error` in its own
JSON error messages, so no diagnostic the application relies on is lost.

---

## ACCEPTANCE — WHAT MUST BE TRUE TO CLOSE

Under the real PHP 8.4.19 runtime, `error_reporting = E_ALL`:

- a failed connection does **not** throw, and reaches `getDB()`'s existing check
- `query_or_fail` / `prepare_or_fail` / `execute_or_fail` still fail through the
  existing JSON contract, with no uncaught exception
- `dc_save_quotation_insert()` still sees `$stmt->errno === 1062` — **the most
  important point of this round** — and still performs exactly **2 executes,
  1 reallocation**, with the new ref_no actually sent
- a second 1062 stops and returns failure, with no loop
- errnos 2006 / 1146 / 1452 / 1406 are **not** retried
- CSV: single row, multiple rows, quoted commas, quoted double-quotes, empty
  field and UTF-8 all round-trip unchanged, with **0 deprecation notices**
- `php -l` clean on every application PHP file, on 8.4
- full regression: **39 suites, 3,907 browser assertions, 0 failed, 0 skipped**;
  existing canonical suites unchanged; translation **862 keys / 100%**

Then STOP. **No deploy. No production PHP switch.** Candidate only.
