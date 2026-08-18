# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**UI POLISH 2 — Interaction / Micro UX Polish — FINAL ACCEPTED, CLOSED**

## APPLICATION STATUS

| | |
|---|---|
| Accepted application commit | `33ae0da14a3bd3108e8b066d4796b1bcda2de428` |
| Previous accepted commit | `e3d659bba1636cd4cfc74cb89be1b52cf92aff67` — superseded by UI POLISH 2 |
| This round | **accepted**, no longer a candidate |
| Deploy | **NO** |

---

## THE CANDIDATE DECLARATION IS CLOSED

While UI POLISH 2 was under review, this file declared `index.php` as a
candidate change so the report checker and the package verifier could tell a
**declared candidate** apart from an **unnoticed drift**. Nicholas accepted the
round, so that declaration has done its job and is now closed:

```candidate-files
```

The block is empty on purpose. Empty means *nothing may differ from the
accepted commit* — the strictest state this control has — and any application
PHP that now differs from `33ae0da` fails loudly, exactly as an undeclared
change always did.

Closing it is what makes acceptance real. Leaving the file named here after the
commit that carries it has been promoted would mean the checker permanently
excused the one file it exists to watch.

---

## WHAT WAS ACCEPTED, AND HOW IT WAS PROVEN

Acceptance is bookkeeping over a tree that did not move, not a new measurement.
Every claim below is read out of Git, not out of a report:

```
git merge-base --is-ancestor e3d659b 33ae0da   →  0   (e3d659b is an ancestor)
git log e3d659b..HEAD -- '*.php'               →  33ae0da   (nothing else)
git show --stat 33ae0da -- '*.php'             →  index.php | 156 +++ (1 file)
git rev-parse 33ae0da:index.php                →  5d764b57353650853a7c14dfc807c55730cb8db4
git rev-parse HEAD:index.php                   →  5d764b57353650853a7c14dfc807c55730cb8db4
git diff --name-only 33ae0da..HEAD -- '*.php'  →  (empty)
git diff --name-only 33ae0da..HEAD -- tests/suites tests/lib   →  (empty)
```

`33ae0da` is therefore the exact and only UI POLISH 2 application-changing
commit, and no application byte and no test byte has changed between it and the
package HEAD. The 37 suites / 3,613 browser / **3,958** total matrix was
measured on that tree and is carried forward unchanged and unre-run — rerunning
a browser regression against identical bytes would prove nothing it has not
already proven.

The accepted change is presentation only: 156 lines added, 0 removed, one block
that ends immediately before `</style>`.

---

## BOOKKEEPING PERFORMED

| | |
|---|---|
| `docs/control/CANONICAL-STATE.md` | accepted commit → `33ae0da`, round → UI POLISH 2 FINAL ACCEPTED, `e3d659b` added to SUPERSEDED VALUES |
| `docs/control/CANONICAL-STATE.json` | same, plus a second `supersededApplicationCommits` entry recording `e3d659b → 33ae0da` and why |
| `tests/tools/authoritative.js` | `APP_SHA` → `33ae0da` |
| `docs/control/ROUND-SCOPE.md` | this file — candidate declaration closed |
| `FULL-AUDIT/UI-POLISH-2.md` | candidate wording replaced with accepted wording |
| `FULL-AUDIT/*.md`, `COMMIT-INFO.txt` | current application SHA moved; `e3d659b` retained only where the line labels it superseded |

Test counts, translation counts and finding counts are **unchanged** by this
step, because nothing that produces them changed.

---

## NO OPEN ROUND

There is no candidate application change in flight under this file as written.
The next round must rewrite this file first, declare its own scope, and name its
own candidate files before any application byte is touched.

## STOP CONDITION

Met. UI POLISH 2 is accepted and closed. No deploy.
