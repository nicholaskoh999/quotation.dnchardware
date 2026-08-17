# EXECUTIVE SUMMARY

**Overnight full-system audit + morning repair · QUOTATION.DNC**
Baseline `f96714e33795e80b581b1d03deb9d04db1d94b8d`
Final application SHA `40e56d6951d7832a19e5b7fd121877faecf7f54a` · **NOT DEPLOYED.**

> **On SHAs.** `40e56d6951d7832a19e5b7fd121877faecf7f54a` is the last commit that changed the
> application or its tests — it is what the numbers in this package were
> measured against. The commits after it write this package, and a report
> cannot name the commit it is inside without changing it. The exact HEAD
> the archive was built from is recorded in `ZIP-MANIFEST.txt`, which is
> generated at build time and is not committed.

---

## The short version

Six commits. **Seven P1 findings, fifteen P2, two P3, no P0 — 24 in all.**
Every one was reproduced, given a failing regression, repaired, and re-proved.
The full test matrix is green and 528 assertions larger than it was.

The two that matter most were both **silent** — the screen showed a complete,
ordinary-looking, priceable row and the number in it was wrong:

**A comma in a dimension.** `M24 x 1,000` was read as a rod **1 mm long**, with
a quantity of 0, a unit weight of 0.0036 kg and a price of **RM 0.60**. The row
was complete, unflagged, and the button said "Add 1 Items to Quotation". A
metre-long M24 rod weighs 3.55 kg. Nothing anywhere said anything was wrong.

**A comma in a quantity.** `qty - 15,000 pcs` was quoted as **15 pieces** — a
thousand-fold error on the order size, on the exact message that prompted this
audit.

Both came from the same missing rule, and it was not a new one: the calculator's
own number boxes have always read `1,200` as twelve hundred, and a test has
asserted that since before this audit began. The message parser simply disagreed
with the calculator. It now agrees.

---

## What was found

| | Count | Repaired |
|---|---:|---:|
| **P0** critical | 0 | — |
| **P1** high | 7 | 7 |
| **P2** medium | 15 | 15 |
| **P3** low | 2 | 2 |
| Recorded, not repaired (with reasons) | 6 | — |
| Needs a business decision | 6 | — |

### The seven P1s

1. A comma-grouped **quantity** read as its first group — 15,000 → 15.
2. A comma-grouped **dimension** read as its first group — 1,000 mm → 1 mm,
   priced, and addable.
3. A **spec header carrying a material grade** became a phantom second item —
   the `4140` was counted as a stray number by a reader that had drifted from
   the one that gets it right.
4. **"L BOLT 45DEG" priced as a plain L Bolt.** The two products differ in
   exactly the way that matters: a plain L Bolt's total length is computed from
   its legs with a 90-degree bend deduction, and a 45DEG one's is not.
5. **"SPECIAL BOLT" read as an L Bolt** — `specia|l bolt` contains the alias.
   So did "STEEL BOLT".
6. **One inch size, three spellings, three answers.** `1"` was worth 25.4 mm
   fullsize and 23 mm undersize; `1 INCH` was worth 25.4 mm fullsize and
   *nothing* undersize.
7. **An ambiguous quantity resolved itself — to one piece.** `qty 100 / 200`
   handed the first number to a phantom row and left the real item to fall
   through to the absent-quantity default. The count nobody could read became
   a confident 1. *(morning repair)*

### The translation work

The dictionary already read **100% translated** at baseline. That number was
true and it was not the whole picture: a string with no key is not a missing
translation, it is not a translation at all — and **129 of those were on
screen**. Almost every validation message in the application, the entire Pricing
Guide page, both the Plate and Welding Anchor Set forms (still using the
pre-switch "Material 材料" style the language switch replaced), every empty
state, and a guide box that was Chinese only, so an English reader was handed a
paragraph they could not read.

**756 keys, 100% translated, nothing bypassing the translator.** Proved by
reading the rendered screen, not the dictionary.

That figure is from the morning, and it is larger than the overnight one for a
reason worth stating plainly: **the overnight checker was false-green.** It
reported zero hard-coded strings while the Quick Add column headers, its row
buttons, its panel labels and almost the whole Companies page were still
English in 中文. It refused to look at any run containing `$` or `{`, so every
label with an interpolation beside its English was invisible to it — which is
most dynamic markup. The checker now strips interpolations, holds every label
to one word, reads markup built inside strings, and verifies each finding
against the source before reporting it.

Two more of the same shape came with it: pressing the language button for the
language already in force wiped the Quick Add item count to **0 项 with two rows
on screen**, and the quotation's own item cards were never re-rendered on a
switch, so they read **"Edit / 编辑"** — both languages at once.

The new Chinese strings are first-pass and should be read by a native speaker
before release. That is a smaller claim than "translated", and it is the honest
one.

### One data-safety finding

The Companies page wrote a quotation reference straight into markup unescaped —
the comment above the line said so — while the company name beside it was
escaped. References are typed by hand, and that page lists every customer. Now
escaped like everything else.

---

## What this audit did NOT establish

* **The Chinese wording has not been reviewed by a native speaker.**
* **Nothing was tested against production data.** Every test runs the shipped
  code against a controlled API, which is how the suite has always worked. No
  live database was read or written.
* **The morning round was driven by external review, not by the overnight
  audit's own checks.** The overnight translation tooling passed while real
  leaks were on screen; that is recorded as F22 rather than glossed.
* **Sections 9–19 were audited through the existing suites and targeted probes,
  not re-derived from scratch.** Bulk apply, the pricing engine, accessories,
  the quotation flow, companies, default prices, diameter settings and the
  calculator are covered by 1,300+ existing assertions which all pass; this run
  added breadth where it found gaps, not a second implementation of them.
* **Six of the eleven products are not read by Quick Add.** That is a scope
  limit, now pinned by a test so a future alias cannot quietly capture one.

---

## Recommendation

**READY FOR REVIEW — NOT READY TO DEPLOY.**

Ready for review because every finding is reproduced, repaired and re-proved,
the working tree is clean, and the evidence is complete.

Not ready to deploy because two things need a person first: the new Chinese
strings need a native speaker, and six questions need a business answer — chief
among them whether the printed quotation a CUSTOMER receives should follow the
operator's language. That one was deliberately not decided inside an audit.

**ROUND STATUS: WAITING FOR NICHOLAS / CHATGPT REVIEW — NOT DEPLOYED**
