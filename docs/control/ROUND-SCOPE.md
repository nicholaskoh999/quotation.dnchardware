# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**SOURCE RECONCILIATION / REVISION HISTORY DEPLOYMENT**

One source line again. `main` carries four accepted rounds that production has
never run; production runs a hotfix chain that `main` has never carried. This
round builds the one application that contains both, proves it, and only then
moves production and `main` to it.

| | |
|---|---|
| Integration branch | `integration/source-reconciliation`, cut from `main` `f57b195a15e55c59d1fae2bc1bec368e7b7d21d9` |
| Merged in | `hotfix/quickadd-integration` `091ac77abe0577240dd816eb845d293bccb101c1` (application `91f0c0b905ef402378aaeef896c80a4e6229c442`, plus closing tests / docs) |
| Accepted application commit | `5f5b4a76bb704e8e3709bb2adad51babc06db322` — the merge; supersedes `5595395` |
| Production application | `f7184f192cc087cfed734fc3df66a6afcf997d51` — deployed and VERIFIED 2026-10-19 (previously `91f0c0b`) |
| Main | fast-forwarded `f57b195` → `f7184f1`, then this closing docs commit |
| Active round | **NONE** |
| Round status | **FINAL ACCEPTED / CLOSED** |
| DEPLOY = NO | no further deploy: production already runs `f7184f1`, and the closing commit changes docs only |
| STAGE 2 = NOT STARTED | the Stage 2 deferrals in PROJECT-GUARDRAILS stay deferred |
| Production DB change | **YES** — `quotation_revisions` APPLIED 2026-10-19, Section 4 MATCH / CONFORMS, after an owner-confirmed backup |
| CANONICAL-STATE | reconciled: accepted `5f5b4a7`, deployed `f7184f1` |

---

## THE TWO LINES

**Main — accepted, never deployed.** All four depend on
`migrations/2026-08-28-create-quotation-revisions.sql`; with the table absent a
save fails and rolls back, deliberately.

| Round | Commit | What | Files |
|---|---|---|---|
| Revision Storage (schema only) | `b1fd1de` (`44f9afc`, `af9b1dd`) | the `quotation_revisions` table and its conformance gate; nothing writes to it | migration, `tests/php/revision_storage.test.php` |
| Read-before-write / Transaction Foundation | `1ca6554` | one transaction around every mutation, the read moved inside it | `api.php`, `tests/php/transaction_foundation.test.php` |
| Snapshot Revision Writer | `7de7bb6`, `631cb89` | every save writes the snapshot it stored, or does not save; the 1062 retry sees what it collided with | `api.php`, `tests/php/revision_writer.test.php` |
| No-op Suppression | `5729ad5` | an update that changes nothing records nothing | `api.php`, `tests/php/noop_suppression.test.php` |
| History Read / UI | `5595395` | read-only History panel, changes derived at read time | `api.php`, `index.php`, `tests/lib/harness.js`, `tests/php/history_read.test.php`, `tests/suites/41-history.test.js` |

**Production — deployed, never on main.** `hotfix/*` from `9970143` to
`91f0c0b`: WhatsApp copy order and `1)` numbering, quotation card UX, single
language toggle, responsive mobile / tablet / keyboard, Copy + Weight, Sag Rod
input order, U-Bolt max TL helper and pipe-size presets, L-Bolt TOP / CENTER /
END, Unit Converter (direct fill, inline panel, Auto / INCH / FT / mm), Quick
Add multi-image / Ctrl+V / max 5 / one request, shared heading inheritance, Sag
Rod TL normalization, Nut / FW extraction, phantom-row fix, staff multi-image
guidance. Application files: `index.php`, `ai_extract.php`, `companies.php`.
`main`'s four `sync` commits (`fec3e43`, `3d09fda`, `ad4a20e`, `f57b195`) had
already re-ported the 10-02 part of it.

---

## HOW THE CONFLICTS WERE RESOLVED

`git merge --no-ff` of `091ac77` into `f57b195`. Two files conflicted.

**`index.php`, 4 hunks — production side in every one, because in every one it
is a strict superset of main's text:**

| Hunk | Main | Production | Combined | Why |
|---|---|---|---|---|
| CSS after the responsive block | nothing | Copy + Weight button, U-Bolt TL helper, pipe-size preset tag, Unit Converter CSS | production | main's side is empty; nothing of main's is in the hunk |
| `buildWAItemsText` signature | `(emptyText, mergeIdentical)` | `+ includeUnitWeight=false` | production | Copy + Weight; the default keeps every main caller identical |
| WhatsApp line | `${no}) size - price` | `${no}) size[ - unit weight] - price` | production | same `1)` line; the weight appears only when asked for |
| Copy call | `buildWAItemsText('-', false)` | `+ includeUnitWeight` | production | passes the Copy + Weight choice through |

Proof that nothing was dropped or duplicated: the combined `index.php` differs
from production's `91f0c0b` by **218 inserted lines and 0 deleted**, and those
218 lines are **byte-identical** to the lines `5595395` (History Read / UI)
added to `index.php`.

**Every other application file is one side's, verbatim:** `api.php` is
`5595395`'s (production never changed it after `649f80a`, so main's four rounds
are its entire delta); `ai_extract.php` is production's (main never changed it
after `649f80a`); `companies.php`, `auth.php`, `login.php`, `logout.php`,
`pricing_history.php` and `manifest.webmanifest` are identical on both sides.

**`docs/control/ROUND-SCOPE.md`** is a per-round document; this file replaces
both sides' versions.

---

## ALLOWED TO CHANGE

Empty: the round is closed and nothing may differ from the accepted `5f5b4a7`.

```candidate-files
```

`companies.php` came to `main` with `ad4a20e` and is unchanged by this merge.

---

## MEASURED ON THIS CANDIDATE

Logs: `FULL-AUDIT/stage-reconciliation/logs/`.

| | |
|---|---|
| Browser | **41 suites · 4,010 assertions · 8 failed**: exactly the eight `38-mobile-ui` Windows Chromium font-metric failures recorded on `main` |
| PHP, 11 suites | **1,412 assertions, 0 failed** on PHP 8.4.12 and MySQL 8.4.3. Revision storage 198 · transaction 92 · writer 101 · no-op 171 · history 126 · item identity 159 · actor 150 · mysqli 94 · save retry 42 · pricing history 172 · AI extract 107 |
| Translation | 15 / 15, 953 keys |
| Pricing workbook | 62 / 62 |
| Recent production features | 65 / 66, identical to `91f0c0b`; the one miss is the deferred "thread length 50mm" probe |
| Migration, shipped file | sections 2 + 3 run twice on a legacy-collation copy: `quotations` / `companies` / `app_users` checksums unchanged, 3 rows kept, 0 revisions written, section 4 gate **MATCH** |
| MySQL 8.0.46 | not re-run here; the migration file and `api.php` are byte-identical to what `main` verified on 8.0.46 (`b1fd1de`, `5595395`) |

Security re-check: no BLOCKER / HIGH / MEDIUM. History read and the revision
INSERT are prepared statements with bound parameters. The actor comes from the
server session, and every history value but one goes through `dcHistEsc`. The one exception
is `item_count`, which the server casts to `(int)` (INFO). History is readable by
any signed-in user for any quotation, the same as the quotation itself (INFO).

---

## DEPLOYMENT ORDER — MIGRATION FIRST

The live application (`91f0c0b`) never reads or writes `quotation_revisions`,
so creating the table first changes nothing for it. The combined application
REQUIRES the table: deployed first, every save would fail and roll back. So:

1. **Backup** — cPanel → phpMyAdmin → the quotation database → Export (Quick, SQL).
   Keep the file and note its size.
2. **Migrate** — phpMyAdmin SQL tab, `migrations/2026-08-28-create-quotation-revisions.sql`:
   run SECTION 1 and read it; run SECTION 2; run the SECTION 3 generator and then
   the one `ALTER` it prints; run SECTION 4 — it must say **MATCH** and **CONFORMS**.
3. **Deploy code** — cPanel → Git Version Control → Manage → check out
   `integration/source-reconciliation` → Update from Remote → Deploy HEAD Commit.
4. **Smoke** — sign in; open a quotation; save an edit (a revision row appears);
   save again unchanged (no new row); open History; Quick Add, Unit Converter,
   Copy and Copy + Weight as before.
5. **Rollback** — redeploy `hotfix/quickadd-integration`. The table can stay:
   the old application ignores it.

No maintenance mode exists. Run steps 2–3 when no-one is saving.

---

## OUTCOME

| | |
|---|---|
| Full suite | PASS WITH 8 DOCUMENTED KNOWN FAILURES |
| Security | PASS |
| Production verify | PASS (owner smoke accepted) |
| Source reconciliation | PASS |
| Revision history | DEPLOYED |
| `quotation_revisions` | APPLIED / MATCH / CONFORMS |

Live schema differs from what the migration was written against, accepted by the
owner before Section 2: `quotations.id` is signed INT (ids 1–1,278, none ≤ 0) and
the database default is utf8mb3 / utf8mb3_unicode_ci.

---

## DEFERRED — NOT THIS ROUND

- Parser: a row phrase written as "thread length 50mm" does not override the
  shared Sag Rod TL (pre-existing; `x 50/50` does).
- Upload memory / `post_max_size` verification on the server for five 10 MB images.
- CSRF token hardening (today: SameSite=Lax cookie and JSON bodies).
- DB error text in `fail_json` responses.
- History `item_count` is not escaped in `dcHistChange` (the server casts it to int): defense in depth, INFO.
