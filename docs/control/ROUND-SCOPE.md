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
| Accepted application commit | `5595395fefb49adcb1140a3c9b2a1c36dc7a2186` — unchanged until this round is accepted |
| Production application | `91f0c0b905ef402378aaeef896c80a4e6229c442` — production has not moved |
| Round status | **CANDIDATE — VERIFICATION IN PROGRESS** |
| DEPLOY = NO | not deployed; the combined build needs `quotation_revisions` applied first |
| STAGE 2 = NOT STARTED | the Stage 2 deferrals in PROJECT-GUARDRAILS stay deferred |
| Production DB change | **NO** — `quotation_revisions` is still NOT APPLIED to production |
| CANONICAL-STATE | records the last ACCEPTED state; production / main reconciliation is recorded here until the round is accepted |

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

Relative to the accepted `5595395`:

```candidate-files
ai_extract.php
companies.php
index.php
tests/lib/dom-i18n.js
tests/suites/12-quick-add-safety.test.js
tests/suites/38-mobile-ui.test.js
tests/tools/check-translations.js
```

`companies.php` came to `main` with `ad4a20e` and is unchanged by this merge.

---

## DEFERRED — NOT THIS ROUND

- Parser: a row phrase written as "thread length 50mm" does not override the
  shared Sag Rod TL (pre-existing; `x 50/50` does).
- Upload memory / `post_max_size` verification on the server for five 10 MB images.
- CSRF token hardening (today: SameSite=Lax cookie and JSON bodies).
- DB error text in `fail_json` responses.
