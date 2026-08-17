# QUOTATION.DNC — CURRENT ROUND SCOPE

## ROUND

**Final Package Consistency Loop**

## APPLICATION STATUS

**ACCEPTED.** This is not a development round.

---

## ALLOWED TO CHANGE

- `docs/control/*`
- `FULL-AUDIT/*.md`, `FULL-AUDIT/*.txt` (the reports)
- generated reporting metadata
- current logs / reporting artifacts
- manifest files
- the report consistency checker
- the package validation checker
- the package build scripts
- the evidence capture scripts
- current evidence screenshots
- the package inventory
- the final `QUOTATION-DNC-REVIEW.zip`

---

## NOT ALLOWED TO CHANGE

- application PHP behaviour
- parser
- extraction behaviour
- pricing engine
- Previous Price
- weight
- diameter behaviour
- Qty behaviour
- material mappings
- finish rules
- Size Type behaviour
- History behaviour
- Fast Edit
- Bulk Edit
- Details
- accepted UI layout
- database behaviour

---

## CURRENT OBJECTIVE

Resolve **only**:

- report contradictions
- stale current numbers
- stale internal references
- evidence framing / proof problems
- package consistency
- checker blind spots

If a real application defect is discovered: **do not fix it in this round.**
Record it as

> **NEW APPLICATION FINDING — BLOCKED BY ROUND SCOPE**

and stop application modification.

---

## CURRENT KNOWN FINAL ISSUES

Two report issues remain from the Nicholas / ChatGPT review.

**1 · The EXECUTIVE-SUMMARY severity table is stale.** It reads P1 = 8,
P2 = 19, P3 = 2 while the authoritative values are P1 = 13, P2 = 24, P3 = 2.

The checker missed it because it only ever read the prose form
`P0 n · P1 n · P2 n · P3 n`, and this is a markdown table:

```
| **P1** high | 8 | 8 |          ← must FAIL
| **P1** high | 13 | 13 |        ← must PASS
```

**2 · "Recorded, not repaired" still says 6.** N1 is already resolved by F7,
so the current set is N2, N3, N4, N5, N6 — **five**. Every current reference
must say five, and the wording must not read as *"39 repaired + 6 unresolved
bugs."*

---

## STOP CONDITION

Do **not** stop because "changes are done" or "the checker passed once".

Stop only after:

- the final ZIP is built
- the final ZIP is extracted into a fresh verification directory
- the **extracted** ZIP is checked independently — not the working tree
- zero report contradictions
- zero stale current values
- all prose matches canonical facts
- all markdown tables match canonical facts
- COMMIT-INFO matches canonical facts
- JSON / log current summaries match canonical facts
- the manifest validates 100%
- the evidence visually proves the required claims
- the application PHP files are byte-identical to the accepted application commit
- **two consecutive** full package verification passes return zero findings

**Maximum loop attempts: 3.** If inconsistencies remain after three, stop and
return `BLOCKED — CONSISTENCY PROCESS/CHECKER STILL HAS DEFECTS` with the exact
remaining contradictions. Do not patch indefinitely.

---

## AFTER THIS ROUND

Do not delete the control files. For future rounds, normally only this file
changes. `PROJECT-GUARDRAILS.md` changes only when Nicholas explicitly changes
a permanent accepted rule; `CANONICAL-STATE` changes only when a newly accepted
state supersedes the old one, and then both the `.md` and the `.json` are
updated together and the reason recorded.
