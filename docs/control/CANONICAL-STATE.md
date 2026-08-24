# QUOTATION.DNC — CANONICAL STATE

**IMPORTANT.** These values are authoritative for the current accepted
application and package state.

Reports must **not** derive expected values from other reports. Reports are
outputs being validated, not sources of truth. Checkers must read
`CANONICAL-STATE.json` as machine-readable truth.

> Why this file exists: the consistency checker false-greened four rounds
> running, and the root cause was always the same — it worked out what to
> expect from the same documents it was checking, so a number that was wrong
> everywhere agreed with itself and passed. Truth now lives outside the things
> being checked.

---

## APPLICATION

| | |
|---|---|
| Accepted application commit | `cf92f27feb629134a61801dc120eba79c54fb5f6` |
| Application status | **ACCEPTED** |
| Accepted round | UI POLISH 2A — Save Success Micro-Interaction, **FINAL ACCEPTED** |

The accepted commit moved because UI POLISH 2A was accepted, and for no other
reason. It is `cf92f27` because that is the last commit that changed an
application file — proven from the files, not from a branch tip:

```
git merge-base --is-ancestor 3e89713 cf92f27  →  0   (3e89713 is an ancestor)
git log -1 --format=%H 3e89713..HEAD -- index.php
        →  cf92f27   (derived from the file ROUND-SCOPE declared, not asserted)
git diff --name-only 3e89713..cf92f27 -- '*.php'
        →  index.php                (and nothing else)
git diff --name-only cf92f27..HEAD -- '*.php'                →  (empty)
git diff --name-only cf92f27..HEAD -- tests/suites tests/lib →  (empty)
```

`api.php`, `ai_extract.php`, `companies.php`, `pricing_history.php`, `auth.php`,
`login.php` and `logout.php` are byte-identical to the commit before it, and
were re-verified file by file at the acceptance. Every commit after `cf92f27`
carries reports, evidence, control files and packaging, and changes no
application or test byte.

**What it changed.** A save now answers. The button that submits — the one
inside the dialog, not the one that opens it — compresses while the request is
in flight, shows a check **only once the server has confirmed**, the real saved
values confirm themselves, the existing toast speaks, and a ~500ms confirmation
says what was written.

Two confirmation semantics, and they are not interchangeable: `save_quotation`
writes the WHOLE quotation, so the confirmation goes to the container holding
exactly the items that were written and **no item row is singled out**;
`save_default_price` writes ONE row, so there the confirmation goes to that row
and its neighbours stay clean.

It also closed a defect nobody had reported: `doSaveQuotation` had **no
in-flight guard**, so two clicks inside the request window issued two POSTs on a
save that allocates a quotation number. Four clicks now issue one.

**The save payload, pricing, numbering, `ref_no` allocation, the parser, the
database and the accepted STAGE 1 UI are unchanged**, asserted in the suite
rather than promised.

Acceptance was bookkeeping over a tree that did not move: no application or test
byte changed between the reviewed candidate and this promotion, so the
4,263-assertion matrix below stands exactly as measured on `cf92f27` and was not
re-run to promote it.

---

## TESTS

| | |
|---|---:|
| Baseline assertions | 2,810 |
| Current final assertions | **4,263** |
| Delta | **+1,453** |
| Failed | 0 |
| Skipped | 0 |
| Browser suites | 39 |
| Browser assertions | 3,907 |

Other accepted assertion groups:

| | |
|---|---:|
| Pricing / History | 172 |
| AI Extraction / Parser | 107 |
| Workbook | 62 |
| Translation | 15 |

**Arithmetic, which the checker performs itself rather than trusting:**

```
  3,907   browser
+   172   pricing / history
+   107   AI extraction / parser
+    62   workbook
+    15   translation
= 4,263   final

  4,263 - 2,810 = 1,453
```

The browser matrix grew by 91 in UI POLISH 2A, in one new suite and no other:
*save feedback — the button, the value, the region, and the row*, which measures
the success sequence, the in-flight guard, both confirmation semantics, the
failure path sampled every 12ms, reduced motion, and the save payload key for
key. The thirty-eight suites that existed before this round are unchanged,
assertion for assertion, and the four side groups did not move.

---

## TRANSLATION

| | |
|---|---:|
| Keys | **862** |
| Coverage | **100%** |
| Missing | 0 |
| Hard-coded | 0 |
| Unapplied | 0 |

---

## FINDINGS

| | |
|---|---:|
| P1 | **13** |
| P2 | **24** |
| P3 | **2** |
| **Total** | **39** |

All 39 finding entries are repaired / closed according to the current accepted
audit state.

**5 additional observations remain recorded but were not changed by design:**
N2, N3, N4, N5, N6.

**N1 is not included, because it was resolved by F7.** It describes behaviour
that F7 repaired, so counting it among the unrepaired would be counting a fixed
defect twice.

This must not be presented as *"39 repaired + 6 unresolved bugs."* The five are
observations with stated reasons — a parser scope decision, a duplicated
diameter table, two deliberate non-translations and a trade-vocabulary
boundary — not outstanding defects.

---

## DELIVERY

**ONE ZIP only:** `QUOTATION-DNC-REVIEW.zip`

Required top-level folders:

```
SOURCE/  EVIDENCE/  REPORTS/  LOGS/  MANIFEST/  docs/control/
```

Manifest path: `MANIFEST/MANIFEST.txt`

**Forbidden:** a separate `FULL-AUDIT.zip`, a separate
`quotation-dnc-final.zip`, nested delivery ZIPs, old delivery dump folders,
secrets, `db.php`, `ai_config.php`.

GitHub is source/history reference only. Deployment: **NO**, unless Nicholas
explicitly approves.

---

## SUPERSEDED VALUES

Recorded so a checker can recognise them as stale rather than re-deriving them.
**Never quote any of these as current.**

| | superseded |
|---|---|
| Assertion totals | 3,334 · 3,482 · 3,679 · 3,799 · 3,827 · 3,958 · 4,070 · 4,172 |
| Deltas | +734 · +869 · +989 · +1,017 · +1,148 · +1,260 · +1,362 |
| Translation keys | 512 · 658 · 756 · 843 · 853 |
| Finding totals | 29 · 33 |
| Suite counts | 34 · 36 · 37 · 38 |
| Manifest filename | `ZIP-MANIFEST.txt` |
| Application commit | `7f5bc977197a658d6d4db995ee2c9bb5e106e21b` — superseded by `e3d659b` when UI POLISH 1 was accepted |
| Application commit | `e3d659bba1636cd4cfc74cb89be1b52cf92aff67` — superseded by `33ae0da` when UI POLISH 2 was accepted |
| Application commit | `33ae0da14a3bd3108e8b066d4796b1bcda2de428` — superseded by `98a31e3` when STAGE 0B was accepted |
| Application commit | `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac` — superseded by `3e89713` when STAGE 1 was accepted |
| Application commit | `3e89713400b5bcfceca31d2c074de17411169d1b` — superseded by `cf92f27` when UI POLISH 2A was accepted |

2,810 is a superseded *total* but remains the current *baseline*, and is the
one number in that column that a current line may legitimately quote — always
as the baseline, never as the present figure.

---

## CHANGING THIS FILE

Change CANONICAL-STATE only when a newly accepted application state, test
result, finding set or package state supersedes the old one. When it changes:
update the `.md`, update the `.json`, validate that both agree, and record why.

**Do not casually mutate a canonical fact to make a checker pass.** That
inverts the whole arrangement.
