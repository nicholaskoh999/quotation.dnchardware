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
| Round status | **OPEN — SESSIONS A / B / C IN PROGRESS** |
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

## DEFERRED — NOT THIS ROUND

- CSRF token implementation (designed here, built in a later round).
- Any production `php.ini` / LiteSpeed change (proposed here, applied by the
  owner later).
