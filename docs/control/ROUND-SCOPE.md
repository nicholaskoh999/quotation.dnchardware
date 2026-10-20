# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**DNC WORKSPACE V1 — SESSION C: QUOTATION HANDOFF**

Seamless sign-in from DNC Workspace (`portal.dnchardware.com`) into Quotation,
implementing the accepted DNC Handoff Contract v2 as a **target** with audience
`quotation`, plus a "DNC Workspace" link back. Auth integration and navigation
only: no business-logic change.

| | |
|---|---|
| Canonical base | `main` `664c0d845c09a635d792009e5cc08349279e6633` |
| Round branch | `round/r5-c-portal-handoff`, cut from the canonical base |
| Contract | `nicholaskoh999/dnc-portal` `round/a-portal-foundation` `bab1b67e8e52bc8ce63d6e196281f4f82acdd55d` `docs/HANDOFF-CONTRACT.md` |
| Accepted application commit | `c38896c91df5e9698f905b5b954cc8168a69a8df` (unchanged until this round is accepted) |
| Production application | `32382327de3ecdd054707de6ceefaf7fbb1aad85` (unchanged) |
| Previous round | QUICK ADD TL OVERRIDE + HARDENING AUDIT — FINAL ACCEPTED / CLOSED |
| Active round | **DNC WORKSPACE V1 — SESSION C** |
| Round status | **OPEN — CANDIDATE ON round/r5-c-portal-handoff** |
| DEPLOY = NO | nothing is deployed until the owner accepts; the handoff ships with `DNC_HANDOFF_ENABLED=false` |
| STAGE 2 = NOT STARTED | the Stage 2 deferrals in PROJECT-GUARDRAILS stay deferred |
| Production DB change | **PROPOSED, NOT APPLIED** — `migrations/2026-10-20-create-handoff-tables.sql` (two new tables in Quotation's DB) and a SELECT-only grant on the canonical `users` table |
| Production config change | **PROPOSED, NOT APPLIED** — `dnc_config.php` / env, two `.htaccess` rewrite lines, cookie renamed to `__Host-DCQUOSESS` (one-time sign-out) |
| CANONICAL-STATE | **not edited**; updated at acceptance / close only |
| Portal / Internal PO repositories | **untouched** |

Setup, configuration and the production facts still needed:
`docs/handoff/QUOTATION-HANDOFF.md`.

---

## OWNER DECISIONS (2026-10-20, before code)

1. **History attribution.** A DNC session records `actor_user_id` **NULL**,
   `actor_username` = canonical username, `actor_display_name` = canonical
   `users.name` (else the username). The canonical id is never stored in
   `actor_user_id`; the revisions schema is not altered. `dc_current_user()`
   reports `source = 'dnc'`. A later round may add `actor_source` /
   `canonical_user_id`.
2. **Password login (`app_users`) unchanged** — with the handoff on or off. The
   per-request canonical recheck applies to DNC sessions only.
3. **Rate limit** per contract §6.1/§6.3 via a DB-backed limiter
   (`handoff_rate_limits`), 30/min per IP per endpoint.

---

## ALLOWED TO CHANGE

```candidate-files
app/Handoff/Contract/HandoffToken.php
app/Handoff/Contract/InvalidHandoffToken.php
dnc_handoff.php
handoff.php
dnc_config.sample.php
auth.php
login.php
index.php
companies.php
.cpanel.yml
.gitignore
migrations/2026-10-20-create-handoff-tables.sql
tests/php/handoff/
tests/php/handoff_contract.test.php
tests/php/handoff_flow.test.php
tests/php/auth_identity.test.php
tests/suites/44-dnc-workspace-link.test.js
docs/handoff/
docs/control/ROUND-SCOPE.md
docs/control/PROJECT-GUARDRAILS.md
```

`index.php` and `companies.php`: the one navigation link and its two
dictionary entries only. `api.php`, `ai_extract.php`, `pricing_history.php`,
every existing migration, pricing, numbering, revisions, customers, print,
Quick Add, Sag Rod TL and upload behaviour are **out of scope**.

**Scope amendment (owner-approved via the round brief):**
`tests/php/auth_identity.test.php` §S pinned `session_name('DCQUOSESS')` and
"auth.php requires nothing". The brief requires a `__Host-` production cookie
and a per-request canonical recheck. Both pins are narrowed, not removed: the
name is `DCQUOSESS` (`__Host-` on HTTPS) and host-only; the only require is
`dnc_handoff.php`, inside the DNC-session branch, so an app_users request still
loads no database. 150 → 152 assertions.

---

## EXPECTED WHILE OPEN

`node tests/tools/check-control.js` is pinned to the CLOSED state of the
previous round and reports, by design, that application bytes differ from
`c38896c`, that the candidate block is not empty and that the status is not
FINAL ACCEPTED / CLOSED; `check-control-assertions.test.js` §6 likewise
reports that the Round status field is not FINAL ACCEPTED / CLOSED. Those
disagreements clear at acceptance, when CANONICAL-STATE and the checker are
moved to the accepted commit. `check-reports.js` already reported its
COMMIT-INFO.txt packaging blocks stale on the untouched base `664c0d8`;
packaging is not part of this round.

---

## DEFERRED — NOT THIS ROUND

HIGH PRIORITY
- Production `db.php` connection-error leak: manual server-side hardening
  required; potentially reachable before login if production `db.php` matches
  `db.sample.php` behaviour (`docs/audit/2026-10-20-error-leakage.md` §3).

VERIFY
- Production `display_errors` is Off.
- Production `upload_max_filesize`, `post_max_size`, `memory_limit`.
- `max_file_uploads` and related request limits
  (`docs/audit/2026-10-20-upload-capacity.md` §7).

LATER ROUND
- CSRF implementation using the layered design (`docs/audit/2026-10-20-csrf-design.md`).
- Remove / tighten `Access-Control-Allow-Origin: *`.
- Misleading Quick Add error when PHP upload / request limits are exceeded.
- Save-start log ordering (`release_ref_lock` can overwrite the BEGIN error in the log line).
