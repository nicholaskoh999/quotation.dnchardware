# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**API — 1062 DUPLICATE RETRY HARDENING**

One statement, one retry, one error number. No schema, no index, no ref_no
format, no allocation algorithm, no UI, no pricing, no JSON shape.

**FINAL ACCEPTED / CLOSED.**

| | |
|---|---|
| Accepted application commit | `86cf2629a66434bf3bdffe2efc0acbe527c358ac` |
| Superseded application commit | `6bb5772475e06925f6c2ac8237099fcf0c61c3b7` |
| Round status | **FINAL ACCEPTED / CLOSED** |
| DEPLOY = NO | the accepted state is not a deployed state |
| STAGE 2 = NOT STARTED | nothing in Stage 2 was begun, examined or implied |

---

## WHY THIS ROUND EXISTS

`UNIQUE(ref_no)` is now live in production — `quotations.ref_no varchar(100)`,
index `uq_quotations_ref`, duplicate audit 0, null audit 0. That is the right
protection and it changes what a collision *looks like*.

Before the index, two racing saves could both insert and the duplicate survived
silently. Now the second one is refused by the database with **MySQL error
1062**, and `execute_or_fail()` turns any failure into

```
Quotation save failed: Duplicate entry 'Q-2026-0431' for key 'uq_quotations_ref'
```

which is a correct refusal and a poor answer: the number is allocated by the
server, the person did not choose it, and the machine already knows what the
next free one is. A collision here is recoverable **by the application**, and
only this one is.

**The lock is not redundant and is not being touched.** `GET_LOCK` prevents the
race between two PHP requests; 1062 catches what the lock cannot see — a second
application, an import, a manual insert, or a request that died between
allocating and inserting. This round handles the leftover, it does not replace
the guard.

---

## WHAT THE SOURCE SAYS

Established read-only, on `6bb5772`:

- **exactly one statement writes `ref_no`** — the `INSERT` at api.php:587.
  `update_quotation` deliberately excludes the column and says so in a comment
- allocation is `next_free_ref_no($db)` under `GET_LOCK('dc_quotation_ref_alloc', 10)`
- `execute_or_fail($stmt, $label)` calls `fail_json($label . ': ' . $stmt->error)`
  on **any** failure and exits — it cannot distinguish 1062 from a dead
  connection, and this round does not change it for anyone else
- `grep` for `1062` / `Duplicate entry` / `errno` across api.php returns nothing:
  there is no duplicate-key handling anywhere today

---

## ALLOWED TO CHANGE

```candidate-files
```

The block is **EMPTY**. This round is closed: `api.php` and
`tests/php/save_retry.test.php` were reviewed and accepted into `86cf262`, so
nothing may now differ from the accepted commit.

**One new function, and one call site — the INSERT in `save_quotation` only.**

```php
function dc_save_quotation_insert($stmt, &$ref_no, callable $reallocate)
```

- executes the prepared statement; returns true on success
- on failure, reads `$stmt->errno`. **Anything other than 1062 returns false
  immediately** and the caller fails exactly as it does today, with the same
  message from the same `fail_json` — non-1062 errors are not caught, not
  retried, and not reworded
- on 1062 it calls `$reallocate()` — which at the call site is
  `next_free_ref_no($db)`, **the existing allocation logic, unchanged** — and
  executes **once** more. Maximum retry = 1, enforced by there being no loop
- `$ref_no` is taken **by reference** because `mysqli::bind_param` binds by
  reference: re-assigning it is the whole of the retry. No re-bind, no second
  prepare, no rebuilt payload — the statement sends the new number and every
  other column is byte-identical to the first attempt

The allocator is passed in rather than called directly so the function has no
hidden dependency on `$db` and can be driven by a test without a database.

**Tests**

- `tests/php/save_retry.test.php` — extracts the shipped function from api.php
  by name and drives it against a fake statement, the way the browser harness
  serves the real `index.php` rather than a copy: normal save, a 1062 that
  succeeds on retry, a 1062 that fails again, a non-1062 error, retry count, and
  that the reallocation is what the second attempt actually sends

---

## NOT ALLOWED TO CHANGE

The database schema · the `UNIQUE` index · the `ref_no` format · `next_free_ref_no`
and the allocation algorithm · `GET_LOCK` / `acquire_ref_lock` / `release_ref_lock` ·
`ref_no_in_use` · the requested-ref branch that honours a still-free previewed
number · `execute_or_fail` for every other caller · the quotation JSON structure ·
`update_quotation` · the UI · pricing · parsing · translations.

**No other SQL error is caught.** A prepare failure, a lost connection, a
constraint that is not 1062 — all still reach `fail_json` unchanged. Widening
this to a general retry is precisely the thing that turns a hard failure into a
silent double-write, and it is out of scope in both directions.

---

## STOP CONDITION

- a normal save behaves exactly as it does today, one INSERT, one `ok:true`
- a simulated 1062 re-allocates once and succeeds, and the response carries the
  NEW number with `reassigned` true — which the UI already speaks (`tSavedAsTaken`)
- a second 1062 fails, with the same error shape as today
- a non-1062 failure is **not** retried and fails with the same message as today
- exactly **one** retry, asserted by counting executions
- the full browser regression re-run — application bytes change — every side
  suite, and the translation audit at **862 keys / 100%**
- **zero failures, zero skips**

Then STOP. **No deploy.** Candidate only.

---

## OUTCOME — FINAL ACCEPTED / CLOSED

Every stop condition above was met and the candidate was promoted.

| | |
|---|---:|
| Accepted application commit | `86cf2629a66434bf3bdffe2efc0acbe527c358ac` |
| Browser suites | 39 |
| Browser assertions | 3,907 |
| Failed | 0 |
| Skipped | 0 |
| Side suites | 172 · 107 · 62 · 15 · **42** |
| Total assertions | **4,305** (+1,495 on the 2,810 baseline) |
| Translation | 862 keys, 100% |

`main` was fast-forwarded to the accepted commit — no merge commit, no rebase,
no force push. **DEPLOY = NO.** **STAGE 2 = NOT STARTED.** The migration
`migrations/2026-08-24-add-unique-ref-no.sql` is unchanged and remains
**NOT APPLIED** by this round; the UNIQUE index it describes was already live in
production before the round began, which is why the round existed.
