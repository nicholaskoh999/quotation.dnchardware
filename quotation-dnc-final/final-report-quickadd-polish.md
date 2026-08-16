# QUOTATION.DNC — Quick Add polish + Thread Reference

Baseline `9483a3d` (round 7, live-failure repair). One application file changed:
`index.php`. No schema change, no server change, no pricing rule changed.

---

## 1. Implementation summary

Three pieces of work, and two defects found on the way.

**Thread Reference** — a pitch (`1.75P`) and, for 1/2" only, a thread series
(`UNC` / `BSW`) are read out of the customer's wording, kept beside the item as
a note, shown under the size, editable, clearable, and carried through save and
reopen. The parser already read both as evidence; that reading is now surfaced
rather than a second one being invented. **It reaches nothing that computes.**

**Previous Price, applied to more than one item** — a reusable record now
offers `Use on this item ▾`, and behind the caret *Apply to compatible items*
and *Select items…*. Compatibility is decided by **one function**,
`wqaHistCompat`, asked with `wqaHistSpec` — the identity the lookup itself was
made with. There is no second matcher.

**The review screen** — the four bulk-edit forms are one collapsed group with
one scope; the row's actions are real 32px buttons with hover, pressed, focus
and open states; where a price came from is its own control; the history panel
separates what can be reused from what can only be read.

**Two defects found while building it, both pre-existing, both fixed:**

- A row inherited the previous row's **cost rate and surcharge** whenever its
  own specification had no Default Price rule to overwrite them — so a 4140 QT
  row sat quoting a mild steel row's rate. Reproduced at `9483a3d` before
  fixing (below).
- The item table's column tracks were composed **once at render** and never
  recomputed, so a window dragged narrower kept desktop widths and the table
  scrolled sideways between roughly 600 and 780px.

---

## 2. UI/UX changes

| | Before | Now |
|---|---|---|
| **Bulk edit** | four panels, four headings, each repeating "— Apply to All" and its own scope selector | one `▸ Bulk Edit` group, shut by default, **one** scope selector, four plain titles inside |
| **Height to the first item** | four bars ≈ 200px before the list | the list is the next thing after the specification |
| **Group opens by itself** | — | only when rows are actually incomplete (`wqaItemNeedCount`) |
| **Selection** | tick boxes only under "Selected Items" | same, plus a bar: *N selected · Bulk Edit · Apply Previous Price · Clear Selection* |
| **Edit** | a bare `<span>` — no border, no focus, no keyboard | a 32px button, with `aria-expanded`, that says *Close* when the row is open |
| **History** | a small pill with no open state | a 32px button carrying the **record count** and a `▲` when open |
| **Remove** | a 26px `✕` | 32px, with an `aria-label` naming the item |
| **Provenance** | *"Reusing Q-2026-0403"*, one grey pill among several | `↳ Previous Price · Q-2026-0403` on its own line — **press it and the record opens** |
| **History panel** | one list | **Reusable** *n* / **References** *n*, each headed and counted |
| **Motion** | none | accordions 170ms, rows 180ms, and a **0.9s highlight on a price that changed** |
| **Reduced motion** | — | `prefers-reduced-motion` removes every animation and transition |
| **Sideways scrolling** | 600–780px overflowed | zero at 390, 480, 560, 600, 620, 640, 700, 720, 760, 820, 900, 1100, 1440 |

The DNC blue/white language, the control heights, the type scale and the
existing panel component are all unchanged — the group head is the same
`.wqa-panel-head` the four panels use.

---

## 3. Previous Price bulk-apply rules

**Compatible** requires all five to be identical:

```
Product · Material · Finish · Size Type · Size
```

**Geometry may differ** — length, thread length, quantity — and that is the
point: each row is then repriced from **its own weight**.

```
CURRENT ITEM WEIGHT  ×  REUSED RECIPE  =  CURRENT ITEM PRICE
```

Asserted directly: three rows at L853, L943 and L700 on one recipe come out at
three different prices, none of them the record's own RM 3.20.

What comes across is the recipe and nothing else: cost rate, additional cost,
markup, price mode. A record without all four is not a recipe and is applied as
the stated figure it is, exactly as `Use on this item` already did.

**Refused, with the reason shown on the row:**

| | |
|---|---|
| `M16` against an `M12` record | different size |
| `PL` against a `ZP` record | different finish |
| `4140 QT` against an `MS` record | different material |
| `FULLSIZE` against an `UNDERSIZE` record | different size type |
| an Anchor Bolt against a Sag Rod record | different product |

**A reference-only record offers none of it.** A different-finish record, or one
whose accessories cannot be separated from its bolt, has no *Use on this item*,
**no caret, no menu, no picker** — and if the functions are called on one
directly they return an empty set and change nothing. Asserted from both sides.

**Stale records cannot be applied.** Every path — the button, apply-to-compatible,
the picker — re-checks at the moment of use with the same rule, so changing a
row's material and applying inside the debounce window applies nothing.

A row disabled in the picker is disabled **in the model**: forcing
`wqaHistPickToggle` on it does nothing.

---

## 4. Thread Reference parsing rules

**Metric pitch** — read, and the number taken out of the line so no dimension
reader sees it:

| Written | Size | Thread Reference |
|---|---|---|
| `M12 x 1.75P` · `M12 x 1.75 P` | `M12` | `1.75P` |
| `M12 x 1.75 pitch` · `M12 x 1.75 PITCH` | `M12` | `1.75P` |
| `M12 x 1.75` | `M12` | `1.75P` |
| `M12 x 300` | `M12` | — *(a length)* |
| `M12 x 30.5` | `M12` | — *(too large to be a pitch)* |
| `M12 x 1.75 x 300` | `M12`, L `300` | `1.75P` |

The unmarked form is read **only** in the one shape that cannot be anything
else: directly after a metric size, written as a fraction of a millimetre, no
larger than 6 — the coarsest metric pitch there is. A length is written in whole
millimetres and is two or three digits. The two shapes do not overlap, and that
is the only reason it is safe.

**Imperial series** — `1/2` only:

| Written | Size | Thread Reference |
|---|---|---|
| `1/2 UNC` · `1/2" UNC` | `1/2` | `UNC` |
| `1/2 BSW` · `1/2" BSW` | `1/2` | `BSW` |
| `3/8 UNC` · `5/8 UNC` · `3/4 UNC` · `7/8 UNC` | unchanged | **—** |

Nothing is inferred for the sizes the business has not approved. A person may
still **type** one, because typing is not inferring.

`1/2 UNC x 1020` also fixes a real parsing failure: the series word stood
between the fraction and its `x`, so the unmarked-inch reader could not fire and
`1/2` was read as the thread pair *1 and 2* — with the size box left empty. The
series word is now removed from the line once it has been read, exactly as the
pitch already was.

**Typed values** are spelled the one way: `1.75`, `1.75P` and `P1.75` all become
`1.75P`. It is optional, and clearing it does not touch the size.

---

## 5. Thread Reference affects NO calculation — explicitly

`threadRef` is set in exactly two places (the parser's output, and the row's own
box) and read in exactly two (what is drawn on screen, and what is written onto
the saved item). **No pricing, weight, identity or matching code reads it.**

Asserted, not asserted-by-inspection — the same row read twice, with and without
a pitch:

| | with `1.75P` | plain |
|---|---|---|
| weight | 0.5909109254 | 0.5909109254 |
| price | identical | identical |
| cost rate | identical | identical |
| `wqaHistSpec` (the previous-price identity) | **byte-identical JSON** | |
| `cleanSize` | `M12` | `M12` |

And `1/2 UNC`, `1/2 BSW` and a plain `1/2` all weigh **0.7472 kg/pc**, price the
same, and produce the **same** five-field identity — so they share one history
rather than splitting into three. A half inch is still not an M12, asserted
alongside.

Nothing is written into `size`, `cleanSize`, `sizeCode` or `dimensionPreview`;
the printed size line on a saved item carries no pitch; and no Diameter Settings
identity is created.

---

## 6. Files changed

**Application (deployed):**

```
index.php     the only one
```

**Tests and evidence (never deployed — outside .cpanel.yml's allowlist):**

```
tests/suites/26-thread-reference.test.js       new
tests/suites/27-bulk-previous-price.test.js    new
tests/suites/28-quickadd-ui.test.js            new
tests/polish-shots.js                          new
tests/suites/05,16,17,18,23,25                 updated to the new markup/contract
```

No change to `api.php`, `companies.php`, `ai_extract.php`, `pricing_history.php`,
`auth.php` or any config. No secrets, no credentials, no deployment
configuration touched.

---

## 7. Tests added / changed

| Suite | Was | Now |
|---|---|---|
| **26 — thread reference** | — | **87** (new) |
| **27 — bulk previous price** | — | **79** (new) |
| **28 — quick add UI** | — | **66** (new) |
| 05 — pricing history | 102 | 105 |
| 16 — row history | 80 | 85 |
| 18 — twenty items | 28 | 30 |
| 23 — previous price recipe | 68 | 73 |
| 25 — size type | 68 | 71 |

**Suite 26** covers Z 1-15 exactly: the five metric spellings; three ways a
dimension must not be swallowed; pitch and dimension on one line; the weight,
price and identity unchanged with and without a pitch; UNC and BSW with and
without the inch mark; both weighing and pricing the same; one shared identity;
four unsupported imperial sizes getting no note; 1/2 not crossing to M12; typed
and cleared; and the whole add → save → reopen → re-add round trip including an
older item that has no such field.

**Suite 27** covers AA 1-12: the three compatible shapes and the five refusals
with their reasons; each row's price checked against `weight × 7.25 + 1.75, +9%`
through a second statement of the rounding rule; the reference-only record from
both sides; the stale-record guard on all three paths; and the picker's ticks,
disabled rows, model-level refusal and partial apply.

**Suite 28** covers AB: the group shut by default with its four panels intact
behind it and one scope selector; data surviving a collapse; both scopes
writing to the right rows; the three controls as buttons at ≥32px with visible
open states; Compact/Expanded; no sideways scrolling at five widths; the price
highlight appearing, not changing the figure, and going away; and the rate-leak
regression.

Suites 05, 16, 17, 18 and 23 were updated where they read markup that has
changed — in every case with **more** assertions than before, not fewer. Suite
18's row-height ceiling moved from 68px to 72px, which is the direct cost of the
brief's 32px click target; the shape it protects is unchanged and the suite now
also asserts the control heights explicitly.

---

## 8. Assertion count

| | Before | Now |
|---|---|---|
| Browser suites | 25 / 2,230 | **28 / 2,480** |
| `pricing_history` (PHP) | 161 | 161 |
| `ai_extract` (PHP) | 107 | 107 |
| Pricing workbook (Python) | 62 | 62 |
| **Total** | **2,560** | **2,810** |
| **Failures** | 0 | **0** |

PHP lint: 10 files, no syntax errors. No page errors in any browser suite.
No assertion was removed to make the suite pass.

### Before-fix proof for the two defects

**The rate leak, at `9483a3d`** — two identical rows, a rate typed on the first,
the second changed to 4140 QT:

```
HEAD:  [{"mat":"MS","rate":"7.25","add":"1.75","price":6.03},
        {"mat":"4140","rate":"7.25","add":"1.75","price":6.03}]

now:   [{"mat":"MS","rate":"7.25","add":"1.75","price":6.03},
        {"mat":"4140","rate":"11.00","add":"2.00","price":8.50}]
```

**The sideways scroll, at `9483a3d`** — the item panel's overflow, in pixels:

```
        1440  1100   900   820   780   760   740   720   700   640   560   390
HEAD:      0     0     0     0     0    19    39    58    77   123     0     0
now:       0     0     0     0     0     0     0     0     0     0     0     0
```

---

## 9. Before / after screenshots

`polish/` — twelve frames for AC 1-12, plus `polish/before/` for the pairs.

| | File | What changed |
|---|---|---|
| 1 | `1-default-bulk-collapsed.png` ↔ `before/1-default-BEFORE.png` | four "Apply to All" bars → one `▸ Bulk Edit`; the items are the next thing on screen |
| 2 | `2-bulk-edit-expanded.png` | the four inside, one scope above them |
| 3 | `3-selected-scope.png` | tick boxes and *3 selected · Bulk Edit · Apply Previous Price · Clear Selection* |
| 4 | `4-row-controls.png` ↔ `before/4-row-controls-BEFORE.png` | `Edit` as a bare word → three buttons; the open row says `Close` |
| 5 | `5-previous-price-provenance.png` | `↳ Previous Price · Q-2026-0403` under three rows — and not under the M16 |
| 6 | `6-history-reusable-and-references.png` | **REUSABLE 1** / **REFERENCES 2** |
| 7 | `7-apply-to-compatible-menu.png` | *Apply to compatible items (3)…* · *Select items…* |
| 8 | `8-incompatible-items-disabled.png` | `M16 · L500` greyed, **DIFFERENT SIZE** |
| 9 | `9-metric-pitch-reference.png` ↔ `before/9-metric-pitch-BEFORE.png` | `M12` with `1.75P` under it |
| 9b | `9b-metric-pitch-editable.png` | the Thread Reference box, beside Size |
| 10 | `10-imperial-unc-reference.png` ↔ `before/10-imperial-unc-BEFORE.png` | `1/2` with `UNC` under it — **and a size box that is no longer empty** |
| 11 | `11-imperial-bsw-reference.png` | `1/2` · `BSW`, weighing 0.7472, the same as UNC |
| 12 | `12-price-recalculated-highlight.png` | the three prices that moved, highlighted |

Every frame comes through a stub that applies the server's own five identity
fields, so no frame shows something the application would not do.

---

## 10. Known limitations

1. **A thread reference is not printed on the quotation.** It survives save and
   reopen and is on the item, but the description, the print sheet and the
   WhatsApp text are unchanged. Putting it in front of a customer changes what
   the document says, and that is a business decision, not a polish one. Say the
   word and it is a small change.
2. **Only 1/2" gets a UNC/BSW reading**, as instructed. The other imperial sizes
   keep their existing behaviour and are pinned by tests so extending it later
   is a deliberate act.
3. **"Apply Previous Price" on the selection bar opens a record** rather than
   applying one — a previous price is still chosen from a specific quotation,
   and picking that for someone would be guessing which.
4. **The bulk-edit group opens itself only for incomplete rows.** It does not
   yet open itself for, say, a missing cost rate; that count is not one the
   panels currently produce.
5. **The picker lists every live row**, not a filtered view. On a twenty-row
   list that is a twenty-row list, inside its own scroll.
6. `1/2" ≠ M12` remains, and the question of whether they belong to one approved
   diameter family is still open from the previous round.

---

## 11. Application commit

```
7932c2c    A review screen, a thread that is not a size, and one price on many rows
```

Branch `claude/quotation-dnc-audit-repair-ashi82`.

---

## 12. Deployment status

**NOT DEPLOYED.** `.cpanel.yml` is a manual two-click deploy. I have not run it,
and nothing here describes the live site as verified.

---

## 13. Updated ZIP

`quotation-dnc-final.zip`, rebuilt from the committed folder.

---

*Not declared accepted here. These artifacts are for your review.*
