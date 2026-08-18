# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**STAGE 0 — FINAL ACCEPTED, CLOSED**

Two sub-stages, both accepted by Nicholas:

| | |
|---|---|
| **0A** | UI POLISH 2 accepted. Bookkeeping only — no application byte moved. |
| **0B** | **Accessory-inclusive final unit price.** An approved business-rule change, now accepted. |

## APPLICATION STATUS

| | |
|---|---|
| Accepted application commit | `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac` |
| Previous accepted commit | `33ae0da14a3bd3108e8b066d4796b1bcda2de428` — superseded by STAGE 0B |
| This round | **accepted**, no longer a candidate |
| Deploy | **NO** |

---

## THE CANDIDATE DECLARATION IS CLOSED

While STAGE 0B was under review this file declared `index.php`,
`companies.php`, `pricing_history.php` and `tests/php/pricing_history.test.php`
as candidate changes, so the report checker and the package verifier could tell
a **declared candidate** apart from an **unnoticed drift**. Nicholas accepted the
stage, so that declaration has done its job and is now closed:

```candidate-files
```

The block is empty on purpose. Empty means *nothing may differ from the accepted
commit* — the strictest state this control has — and any application PHP that now
differs from `98a31e3` fails loudly, exactly as an undeclared change always did.

Closing it is what makes acceptance real. Leaving those files named here after
the commit that carries them has been promoted would mean the checker
permanently excused the four files it exists to watch.

---

## WHAT WAS ACCEPTED, AND HOW IT WAS PROVEN

Acceptance is bookkeeping over a tree that did not move. Every claim below is
read out of Git, not out of a report:

```
git merge-base --is-ancestor 33ae0da 98a31e3    →  0   (33ae0da is an ancestor)
git log 33ae0da..HEAD -- '*.php'                →  98a31e3   (nothing else)
git diff --name-only 33ae0da..98a31e3 -- '*.php'
        →  index.php  companies.php  pricing_history.php
           tests/php/pricing_history.test.php
git diff --name-only 98a31e3..HEAD -- '*.php'   →  (empty)
git diff --name-only 98a31e3..HEAD -- tests/suites tests/lib   →  (empty)
```

`98a31e3` is therefore the exact and only STAGE 0B application-changing commit,
and no application byte and no test byte has changed between it and the package
HEAD. The 37 suites / 3,714 browser / **4,070** total matrix was measured on that
tree and is carried forward unchanged and **un-re-run** — rerunning a browser
regression against identical bytes would prove nothing it has not already proven.

**The accepted change is behaviour, not presentation.** That is what separates
this acceptance from UI POLISH 1's and UI POLISH 2's, and it is why the rule it
carries has been written into `PROJECT-GUARDRAILS.md` under *ACCESSORIES* rather
than left described only in a round report. From here it is protected.

---

## BOOKKEEPING PERFORMED

| | |
|---|---|
| `docs/control/CANONICAL-STATE.md` | accepted commit → `98a31e3`, round → STAGE 0B FINAL ACCEPTED; counts → 3,714 browser / 172 pricing-history / **4,070** total / **+1,260**; `33ae0da`, 3,958 and +1,148 added to SUPERSEDED VALUES |
| `docs/control/CANONICAL-STATE.json` | the same, plus a third `supersededApplicationCommits` entry recording `33ae0da → 98a31e3` and why |
| `docs/control/PROJECT-GUARDRAILS.md` | **the new accessory rule added** as an accepted, protected business rule, and named in PROTECTED / ACCEPTED AREAS |
| `tests/tools/authoritative.js` | `APP_SHA` → `98a31e3`; `BROWSER` 3,714, `TOTAL` 4,070, `DELTA` 1,260, pricing-history side suite 172 |
| `docs/control/ROUND-SCOPE.md` | this file — candidate declaration closed |
| `FULL-AUDIT/STAGE-0.md` | candidate wording replaced with accepted wording |
| `FULL-AUDIT/*.md`, `COMMIT-INFO.txt`, `regression-evidence/` | current SHA and counts moved to the accepted run; `33ae0da` kept only where the line labels it superseded |

Translation and finding counts are **unchanged**: 862 keys at 100%, 39 findings.
Nothing that produces them changed.

---

## NO OPEN ROUND

There is no candidate application change in flight under this file as written.
The next round must rewrite this file first, declare its own scope, and name its
own candidate files before any application byte is touched.

**A reminder for whoever opens that round:** accessory pricing is now protected.
Changing it again needs the same explicit approval that changed it this time, and
a `ROUND-SCOPE` that says so before the first edit.

## STOP CONDITION

Met. STAGE 0 is accepted and closed. **No deploy.**
