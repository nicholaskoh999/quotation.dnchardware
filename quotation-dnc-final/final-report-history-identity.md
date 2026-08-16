# QUOTATION.DNC — round 7, part 5: history identity acceptance check

Baseline `2345502ed5d324ca97ed3a6fe71353ff097b1085` (round 7 part 4). The
accepted Previous Price recipe behaviour is unchanged — suite 23's 68
assertions still pass exactly as written.

---

## 1. Why the evidence showed MS with a 4140 QT history card

**The evidence generator, not the application.** `tests/history-shots.js`
stubbed the endpoint with a fixed answer:

```js
get_pricing_history: url => {
  const size = …;                       // the size echoed back
  const rows = records.map(…);          // …and every record returned, always
  return { ok:true, data:{ records: rows, … } };
}
```

It never looked at `productType`, `material`, `sizeType` or `finish`. The row
in those frames was `MS SAG ROD PL FULLSIZE`, so the panel dutifully rendered
the 4140 QT record it had been handed. **Those frames did not exercise
matching at all** — they were a picture of the stub, not of the application.

The same fault was in two suite fixtures (`20`, `23`), and the new use-time
guard caught both immediately: suite 20's J Bolt record carried the material
*label* `'4140 QT'` instead of the code `'4140'`, and suite 23's row was `MS`
under 4140 QT records. Both are now correct, and both stubs apply the server's
rules so they cannot drift again.

## 2. Was production matching affected?

**No — and this is proved through the real path, not asserted.** New suite 24
replaces the fixed-answer stub with one that applies the same five identity
fields `dc_history_record` compares, then drives the actual UI:

| Asserted | Result |
|---|---|
| the lookup an MS row sends | carries `material=MS` |
| a 4140 QT record offered to that MS row | **not offered** — zero cards |
| what the panel says instead | *No pricing history for this exact specification* |
| any other material printed anywhere | none |
| the same row once it really is 4140 QT | its record appears, reusable |

Every one of those passed **before** any change in this part. The server side
was already proved in `pricing_history.test.php`: thirteen material pairs that
must never match, plus product, size type and size.

## 3. Was stale-cache reuse possible?

**Not through the panel — but yes, through a narrow race, and that was real.**

`wqaLoadHistory()` runs after every recompute and reloads any open row whose
identity moved; `wqaLoadRowHistory` sets `r.hist=undefined` **before** it
awaits, so the old cards leave the DOM immediately, and a late reply is
discarded by `if(r.histFor!==wqaHistFor(r)) return`. All five material
transitions were asserted and all five passed unchanged:

```
4140 QT → MS · MS → 4140 QT · 4140 QT → 4340 QT · 4140 QT → SS304 · SS304 → SS316
```

The gap is the **debounce**. `wqaEditRowSpec` schedules the recompute 250 ms
later, and a card is clickable for as long as it is on screen. Changing the
material and pressing *Use* inside that window applied a 4140 QT recipe to a
mild steel row — asserted failing, then fixed.

## 4. Was a use-time identity guard needed?

**Yes.** `wqaHistUse` trusted whatever record object it was handed.

```js
function wqaHistMatches(r,rec){
  const spec=wqaHistSpec(r);
  if(!spec||!rec) return false;
  const same=(a,b)=>String(a||'').trim().toUpperCase()===String(b||'').trim().toUpperCase();
  return same(spec.productType,rec.productType) && same(spec.material,rec.material)
      && same(spec.sizeType,rec.sizeType)       && same(spec.cleanSize,rec.cleanSize);
}
```

It asks with `wqaHistSpec` — **the same identity the lookup itself was made
with**, so there is one set of rules and no second matcher to drift. A refused
record changes nothing at all and says *"This item has changed — that record no
longer describes it."*

Geometry is deliberately not part of it: reusing a recipe across lengths is the
whole point of the feature and stays exactly as approved. Finish is not part of
it either, because a different-coating record has no reuse button to press.

## 5. The reported half-inch case — Q-2026-0470

A `1/2" MS UNDERSIZE` sag rod quoted at **L980** and **L1080**, asked for today
at **L1020** in ZP rather than PL, was reported as having no previous price.
Cause: `finish` was an exact identity field, so both records were discarded
before ranking ever saw them.

A coating is now the one identity field that admits a **reference**:

* the record is kept and flagged `finishMatch:false`;
* it ranks below every exact match — `own → exact finish → nearest length → date`,
  mirrored in `dc_history_sort` and `phSortRecords`;
* the card says **“Different finish — quoted PL · reference only”**;
* it offers **no reuse button**, because a coating is precisely what changes
  the cost rate, and importing a PL recipe onto a ZP rod would quote the wrong
  rate with nothing on screen to say so.

For an L1020 the nearer length still ranks first: **L980 (40 mm) before L1080
(60 mm)**. Nothing else was relaxed — material, product, size type and
diameter stay exact, asserted from both sides.

**Not done, and needing your decision:** the brief says *“1/2 and M12 **may**
belong to the same approved diameter family.”* An earlier accepted round states
the opposite as a rule — *“M12 and 1/2\" share the size-type rule but
M12 ≠ 1/2\"”* — and merging them would show M12 prices for a half-inch enquiry.
I have not merged them, and I have pinned the current behaviour: a half-inch
record is offered to neither an M16 nor an M12. Say the word and it is a small,
well-tested change; it is not something to infer from *may*.

## 6. Tests added

**Suite 24 — pricing history, whose price is this (45).** The faithful stub;
the MS-row-with-a-4140-record case; the same row once it is 4140 QT; all five
material transitions with the panel read from the DOM after each; the
same-tick race, forced deliberately; the half-inch reference case including
ranking, labelling and the absence of a reuse button; a size change proving an
M16 is shown nothing of a half-inch rod's; and an exact-coating record proving
the reference path did not weaken the ordinary one.

**`pricing_history.test.php` (+13, now 139).** The finish assertions moved from
"never matched" to "kept as a reference and flagged" — stronger, not weaker.
The half-inch case end to end: both records returned, `dimDistance` 40 and 60,
`finishMatch` false on the PL pair and true on the ZP one, and
`dc_history_sort` ordering them exact-first-then-nearest. Plus five boundary
assertions: a half-inch record is never offered to an M16, an M12, another
material, another size type or another product.

**Fixtures corrected** in suites 20 and 23, and in `history-shots.js` — all
three now apply the server's identity rules.

### Before-fix evidence

`test-results/history-identity-BEFORE-fix.txt` — suite 24 at `2345502`:
**45 assertions, 5 failed**. The five are the race (3) and the half-inch
reference (2). **The forty that passed are the proof that production matching
was already correct.**

Reverted individually afterwards: removing the use-time guard fails its 3;
restoring the exact-finish rejection fails 9 in the PHP suite.

## 7. Assertion total

| | Part 4 | Now |
|---|---|---|
| Browser suites | 23 / 2,076 | **24 / 2,121** |
| `pricing_history` (PHP) | 120 | **139** |
| `ai_extract` (PHP) | 107 | 107 |
| Pricing workbook (Python) | 62 | 62 |
| **Total** | **2,365** | **2,429** |
| **Failures** | 0 | **0** |

PHP lint: 10 files, no syntax errors. No page errors in any browser suite.

## 8. Corrected screenshots

`history/` — regenerated through the faithful stub:

| | File | Row | Card |
|---|---|---|---|
| A | `1-Q0366-card-before-use.png` | **4140 QT** · PL · Fullsize · M16 | `4140 QT FULLSIZE SAG ROD (PL)` — rate 6.50, add 3.50, 4%, Auto Round, RM 6.84 |
| B | `2-Q0366-after-use.png` | 6.50 · 3.50 · 4 · Auto Round, RM 6.84 | — |
| C | `3-Q0357-replaces-recipe.png` | 6.50 · **4.00** · 4 · Auto Round, RM 7.36 | — |
| D | `4-different-geometry-recalculated.png` | **4140 QT** M20 × 1000, same recipe, **RM 20.30** | — |
| E | `5-manual-history-stays-manual.png` | Manual stays Manual | — |
| H | `6-added-to-quotation.png`, `7-reopened-recipe-survived.png` | the recipe through save and reopen | — |
| **new** | `8-half-inch-other-finish-reference.png` | 1/2" MS UNDERSIZE **ZP** L1020 | **2 records**, Q-2026-0470 (L980) first, labelled *Different finish* |

The row and the card now name the same material in every frame.

## 9. Final application commit

```
0f4f184b8487e73803e0506b475ba2465c711a9d
```

Branch `claude/quotation-dnc-audit-repair-ashi82`. Application code did change
— the use-time guard and the finish reference — so this supersedes
`2345502` as the commit to deploy.

## 10. Deployment status

**NOT DEPLOYED.** `.cpanel.yml` is a manual two-click deploy. I have not run
it, and nothing here describes the live site as verified.

## 11. Updated ZIP

`quotation-dnc-final.zip`, rebuilt from the committed folder.

---

*Round 7 is not declared accepted here. These artifacts are for your review.*
