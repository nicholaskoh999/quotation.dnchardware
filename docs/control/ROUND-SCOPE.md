# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**QUICK ADD TL OVERRIDE + HARDENING AUDIT**

A bounded round that picks up the deferrals the source-reconciliation close
left behind: one deterministic-parser limitation and four hardening items. One
parser fix, one hardening change, and two audits that change no
application byte.

| | |
|---|---|
| Canonical base | `main` `076e2aeb135c5bc8d232beae35210c4742d461a2` |
| Integration branch | `integration/quickadd-tl-hardening`, cut from the canonical base |
| Accepted application commit | `5f5b4a76bb704e8e3709bb2adad51babc06db322` (unchanged until integration is accepted) |
| Production application | `f7184f192cc087cfed734fc3df66a6afcf997d51` (unchanged) |
| Previous round | SOURCE RECONCILIATION / REVISION HISTORY DEPLOYMENT — FINAL ACCEPTED / CLOSED |
| Integration candidate | `c38896c` — C `c8d1895`, then A `9d6cb8f`, then B `858b1ab`, merged `--no-ff`, no conflicts |
| Round status | **CANDIDATE — INTEGRATED, READY FOR REVIEW** |
| DEPLOY = NO | nothing in this round is deployed until integration is accepted |
| STAGE 2 = NOT STARTED | the Stage 2 deferrals in PROJECT-GUARDRAILS stay deferred |
| Production DB change | **NO** |
| Production config change | **NO** — Session B proposes, the owner decides, nothing is applied |
| CANONICAL-STATE | **not edited by A / B / C**; updated at integration / close only |

---

## SESSIONS

Every session branches from `076e2aeb135c5bc8d232beae35210c4742d461a2` — not
from an older worktree, not from a `hotfix/*` branch. Nothing is recovered from
an old hotfix branch unless a comparison proves it is missing from `main`.

| Session | Branch | Worktree | Owns |
|---|---|---|---|
| A — Sag Rod TL override | `round/quo-a-sagrod-tl-override` | `Desktop\quotation-a-tl-override` | the Quick Add deterministic parser region of `index.php`; one new browser suite |
| B — upload capacity audit | `round/quo-b-upload-capacity-audit` | `Desktop\quotation-b-upload-audit` | `docs/audit/` only — AUDIT ONLY |
| C — error leakage, history escape, CSRF design | `round/quo-c-error-escape-csrf` | `Desktop\quotation-c-hardening` | `api.php` error paths; the History render region of `index.php`; tests; `docs/audit/` CSRF design |

A and C both touch `index.php`, in separate regions (A: Quick Add parser,
around `wqaSpecHeaderPlan` / `wqaAccScan`; C: `dcHistChange` and any client
error display). Neither reformats code it does not own.

---

## A — QUICK ADD SAG ROD TL OVERRIDE

Under a shared heading that says `THREAD LENGTH 70MM`, a row such as
`821mm - 4 pcs thread length 50mm` must come out TL 50/50. Its own TL wins over
the shared 70/70 for that row only; rows without one still inherit 70/70.

- Accepted forms on the row: `thread length 50mm`, `THREAD LENGTH 50MM`,
  `TL 50`, and the existing `x 50/50`.
- No phantom rows; accessory inheritance unchanged; the five-row WhatsApp
  fixture is still exactly five items.
- The deterministic parser architecture stays. No AI dependency.

## B — PRODUCTION UPLOAD CAPACITY AUDIT

Evidence-backed PASS / MARGINAL / FAIL for five images of up to 10 MB each:
`upload_max_filesize`, `post_max_size`, `memory_limit`, `max_file_uploads`,
`max_input_time`, `max_execution_time`, any LiteSpeed / Apache body limit;
multipart overhead, request parsing, base64 expansion in `ai_extract.php`,
and what happens when `post_max_size` is exceeded. A config proposal only.
Reading production is read-only; a temporary diagnostic needs explicit owner
approval first.

## C — ERROR LEAKAGE + HISTORY ESCAPE + CSRF DESIGN

1. No raw `$db->error` / `$stmt->error` / driver or SQL detail reaches the
   browser. A generic user error stays; the detail goes to `error_log`, with an
   optional short reference id logged with it.
2. History `item_count` is normalised and escaped at render time; the server
   int cast stays.
3. CSRF: DESIGN / AUDIT ONLY. Endpoint inventory, current protection, a
   recommended approach and migration plan. No tokens this round.

---

## ALLOWED TO CHANGE

```candidate-files
index.php
api.php
tests/suites/42-quickadd-tl-override.test.js
tests/php/error_leakage.test.php
tests/php/mysqli_compat.test.php
tests/php/save_retry.test.php
tests/suites/43-history-escape.test.js
docs/audit/
```

Amended 2026-10-20 for Session C: `tests/php/mysqli_compat.test.php` §3 and
`tests/php/save_retry.test.php` §5 asserted the leaked driver text
(`Lookup failed: Table missing`, `fail_json('Quotation save failed: ' .
$stmt->error)`). They are updated to the generic-error contract; their JSON,
no-fatal and return-value checks are unchanged.

A session that needs a file not listed here stops and asks; the list is amended
in this document before the file changes. `ai_extract.php`, `auth.php`,
`login.php`, `companies.php`, `pricing_history.php`, `.cpanel.yml`, `php.ini`
and every migration are out of scope unless the scope is amended first.

---

## RETURN AT INTEGRATION

Each session returns: branch, head SHA, files changed, tests added and their
counts, full-suite result against the known 38-mobile-ui eight, and anything
left open. Integration merges A, B and C into `integration/quickadd-tl-hardening`,
runs the full suite, then updates CANONICAL-STATE and closes the round.

---

## MEASURED ON THE INTEGRATION CANDIDATE `c38896c`

Logs: `FULL-AUDIT/stage-tl-hardening/logs/`.

| | |
|---|---|
| Merge | C → A → B, no conflicts. `index.php` is CRLF throughout (18,401 CRLF, 0 LF-only); its 67 bare CRs are already on the base, byte for byte. The `index.php` diff from base is exactly A + C: 33 insertions, 2 deletions |
| Session A targeted | `42-quickadd-tl-override` 173 / 0 |
| Session C targeted | `43-history-escape` 19 / 0, `41-history` 74 / 0, `error_leakage` 410 / 0 |
| PHP, all suites | 12 files, 1,825 assertions, 0 failed (PHP 8.4.12; MySQL 8.4.11 for the DB suites). `mysqli_compat` 94 → 97, `save_retry` 42 → 42, as amended above |
| Browser, full | 43 suites, 4,202 assertions, 8 failed = 4,010 + 173 + 19 |
| Known failures | the accepted eight 38-mobile-ui lines, compared line for line with `FULL-AUDIT/stage-reconciliation/logs/browser-combined.log`: identical |
| Pre-existing flake | `35-edit-mode` "O: clearing it back to the default lets the session close". Intermittent: base `076e2ae` 2 of 4 isolated runs, C 2 of 3, integration 2 of 3; it passed inside the full run. Accepted by the owner as pre-existing. Not counted among the eight |
| Translation | 953 keys, 100%, unchanged |
| New regression | **none** |
| Production | not touched: no deploy, no DB change, no config change |

---

## DEFERRED — NOT THIS ROUND

- CSRF token implementation (designed here, built in a later round).
- Any production `php.ini` / LiteSpeed change (proposed here, applied by the
  owner later).
- Production upload limits are unverified; the owner retrieves them (upload audit §7).
- The upload audit's code follow-up: a clear message when `post_max_size` or `memory_limit` is exceeded (`ai_extract.php`).
- Server `db.php` `getDB()` may echo `connect_error`, reachable signed out via `login.php` (error-leakage audit §3).
- Confirm `display_errors=Off` in production.
- The `35-edit-mode` intermittent assertion (pre-existing).
