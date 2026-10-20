# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**QUICK ADD TL OVERRIDE + HARDENING AUDIT**

A bounded round that picked up the deferrals the source-reconciliation close
left behind: one deterministic-parser limitation and four hardening items. One
parser fix, one hardening change, and two audits that changed no application
byte. Accepted, deployed, production-verified and closed.

| | |
|---|---|
| Canonical base | `main` `076e2aeb135c5bc8d232beae35210c4742d461a2` |
| Integration branch | `integration/quickadd-tl-hardening` |
| Accepted application commit | `c38896c91df5e9698f905b5b954cc8168a69a8df` — the C → A → B integration merge |
| Production | `32382327de3ecdd054707de6ceefaf7fbb1aad85` — deployed 2026-10-20, **VERIFIED**; application files identical to `c38896c` |
| Main | fast-forwarded `076e2ae` → `3238232`, then this closing docs commit |
| Active round | **NONE** |
| Round status | **FINAL ACCEPTED / CLOSED** |
| DEPLOY = NO | no further deploy: production already runs `3238232`, and the closing commit changes no deployable file |
| STAGE 2 = NOT STARTED | the Stage 2 deferrals in PROJECT-GUARDRAILS stay deferred |
| Production DB change | **NONE THIS ROUND** |
| Production config change | **NONE THIS ROUND** |
| CANONICAL-STATE | reconciled: accepted `c38896c`, deployed `3238232` |

---

## WHAT THE ROUND DID

| Session | Branch / SHA | Result |
|---|---|---|
| A — Sag Rod TL override | `round/quo-a-sagrod-tl-override` `9d6cb8f` | a row's own `thread length 50mm` / `THREAD LENGTH 50MM` / `TL 50` overrides the shared heading's TL for that row only; `x 50/50` unchanged; no phantom rows; accessory inheritance unchanged |
| B — upload capacity audit | `round/quo-b-upload-capacity-audit` `858b1ab` | `docs/audit/2026-10-20-upload-capacity.md`: FAIL at PHP defaults, production values UNVERIFIED; proposal only, nothing applied |
| C — error leakage, History escape, CSRF design | `round/quo-c-error-escape-csrf` `c8d1895` | `dc_db_fail()` keeps driver text out of every `api.php` response and logs it with a short ref; History `item_count` normalised and escaped; CSRF designed, not built |

Scope amendment, owner-approved before the files moved:
`tests/php/mysqli_compat.test.php` §3 and `tests/php/save_retry.test.php` §5
asserted the leaked driver text and were moved to the generic-error contract
(`mysqli_compat` 94 → 97, adding three checks that the driver text is absent;
`save_retry` 42 → 42).

---

## ALLOWED TO CHANGE

Empty: the round is closed and nothing may differ from the accepted `c38896c`.

```candidate-files
```

---

## MEASURED

Logs: `FULL-AUDIT/stage-tl-hardening/logs/`, promoted to
`FULL-AUDIT/regression-evidence/`.

| | |
|---|---|
| Browser | 43 suites, 4,202 assertions, 8 failed — the accepted eight 38-mobile-ui lines, line for line |
| PHP | 12 files, 1,825 assertions, 0 failed (PHP 8.4.12; MySQL 8.4.11) |
| Application total | 5,906 assertions; baseline 2,810; delta +3,096 |
| Pre-existing flake | 35-edit-mode "O: clearing it back to the default lets the session close" — the load-sensitive flake already recorded in CANONICAL-STATE; reproduced on base `076e2ae` 2 of 4; not candidate-caused |
| Translation | 953 keys, 100% |

---

## OUTCOME

| | |
|---|---|
| Full suite | PASS WITH 8 DOCUMENTED KNOWN FAILURES |
| Security | PASS FOR THIS ROUND |
| Production verify | PASS (owner accepted 2026-10-20) |
| Round result | PASS |
| Revision history | STILL DEPLOYED / VERIFIED |
| Upload capacity | UNVERIFIED — owner / cPanel check remains |

Production smoke on 2026-10-20: Quick Add TL (70/70, 50/50, next row 70/70,
`x 50/50`), manual Sag Rod, Unit Converter, Copy, Copy + Weight, History and
its item count, and a non-Sag-Rod parser spot check identical to the base on
eight inputs. Rollback: not required.

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
