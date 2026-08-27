# EXECUTIVE SUMMARY

**Full-system audit · morning repair · closing repair · UI/UX polish · workflow polish · QUOTATION.DNC**
Baseline `f96714e33795e80b581b1d03deb9d04db1d94b8d`
Final application SHA `e76bb85d663f96fdce3ed6c0c70b72c49d84000a` · **NOT DEPLOYED.**

> **On SHAs.** `e76bb85d663f96fdce3ed6c0c70b72c49d84000a` is the last commit that changed the
> application, and no test suite has moved since it — it is the ONE SHA every
> number in this package was measured against, and it is the only current
> application SHA any of these documents names. It became the accepted commit
> when ACTOR IDENTITY FOUNDATION was accepted. Nine application
> SHAs are superseded by it and must never be quoted as current:
> superseded — `97a14cf56bad6414e382c6f49f40d13eabd97dc9`, accepted for PHP 8.1+ MYSQLI EXCEPTION COMPATIBILITY;
> superseded — `86cf2629a66434bf3bdffe2efc0acbe527c358ac`, accepted for API 1062 DUPLICATE RETRY HARDENING;
> superseded — `6bb5772475e06925f6c2ac8237099fcf0c61c3b7`, accepted for QUICK ADD STABILITY;
> superseded — `cf92f27feb629134a61801dc120eba79c54fb5f6`, accepted for UI POLISH 2A;
> superseded — `3e89713400b5bcfceca31d2c074de17411169d1b`, accepted for STAGE 1;
> superseded — `98a31e32c0636cb4b3ca13c0ec376d1cc36db9ac`, accepted for STAGE 0B;
> superseded — `33ae0da14a3bd3108e8b066d4796b1bcda2de428`, accepted for UI POLISH 2;
> superseded — `e3d659bba1636cd4cfc74cb89be1b52cf92aff67`, accepted for UI POLISH 1;
> superseded — `7f5bc977197a658d6d4db995ee2c9bb5e106e21b`, accepted before that round.
> The commits after the
> application one write this package, and a report cannot name the commit it is
> inside without changing it; the exact HEAD the archive was built from is
> recorded in `MANIFEST/MANIFEST.txt`, which is generated at build time and is
> not committed.

---

## The short version

**Thirteen P1 findings, twenty-four P2, two P3, no P0 — 39 in all.**
The audit and repair commits are listed, one by one, in `COMMIT-INFO.txt`.
Every one was reproduced, given a failing regression, repaired, and re-proved.
The full test matrix is green and 1,362 assertions larger than it was.

The last round separated the three ways a Quick Add row can be written to,
which had genuinely overlapped: two controls both said "Edit", and the two
panels inside Bulk Edit had each other's names — the one called "Correct
Items" held the shared identity fields, and the one called "Common Item
Fields" bulk-edited geometry. Fast Edit is now the spreadsheet (many rows,
different values), Bulk Edit the stamp (many rows, one shared value), and
Details the form (one row, everything about it). Four defects came out of that
work: a diameter whose Escape restored its value but not its provenance
(reported by external review), a Previous Price card that went on crediting a
record after the row had been bulk-changed off the identity it described, two
Details forms that could stack, and a refusal that one path forgot to
refresh.

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
| **P1** high | 13 | 13 |
| **P2** medium | 24 | 24 |
| **P3** low | 2 | 2 |
| Recorded, not repaired (with reasons) | 5 | — |
| Needs a business decision | **2** | — |

**39 application findings were repaired and closed.** Five further observations
remain recorded but were not changed by design — N2, N3, N4, N5 and N6 — each
with its reason written out in `FINDINGS.md`: a parser-scope decision, a
duplicated diameter table, two deliberate non-translations and the
trade-vocabulary boundary. They are observations, not outstanding defects, and
this is not "39 repaired plus 6 unresolved bugs".

N1 is **not** among them. It described behaviour that F7 repaired, so counting
it would count one defect twice — once as fixed and once as open.

Four of what were once counted as six open questions are now decided and are no
longer counted: the printed quotation stays English for now, Thread Reference
stays internal, the ambiguous-quantity rule is settled and shipped, and a bare
`100,200,300` must not fuse into one number. What is left open is whether Quick
Add should learn the other six products (§3) and whether the missing M6/M14
fullsize bars are intentional (§5).

### The P1s

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
8. **Opening the application in 中文 removed the Price Mode control from ten of
   the eleven product forms.** The injector found each form's pricing heading by
   looking for the English word "Pricing"; in 中文 that heading reads 价格资料,
   so the select was never built. No Round and Manual Price were unreachable,
   with nothing on the screen to say why. Pricing itself was untouched — the
   default is Auto Round and the arithmetic is identical — but the operator's
   ability to choose was gone. *(final closing repair)*

### The translation work

The dictionary already read **100% translated** at baseline. That number was
true and it was not the whole picture: a string with no key is not a missing
translation, it is not a translation at all — and **129 of those were on
screen**. Almost every validation message in the application, the entire Pricing
Guide page, both the Plate and Welding Anchor Set forms (still using the
pre-switch "Material 材料" style the language switch replaced), every empty
state, and a guide box that was Chinese only, so an English reader was handed a
paragraph they could not read.

**862 keys, 100% translated, nothing bypassing the translator, and no element
relying on a hook that nothing applies.** Proved by reading the rendered screen,
not the dictionary.

That figure is from the closing round, and it is larger than the two before it
for a reason worth stating plainly: **the checker was false-green twice.** It
reported zero hard-coded strings while the Quick Add column headers, its row
buttons, its panel labels and almost the whole Companies page were still
English in 中文. It refused to look at any run containing `$` or `{`, so every
label with an interpolation beside its English was invisible to it — which is
most dynamic markup. The checker was hardened, and reported green again — while the Companies
helper line, the accessory warning and the saved quotation's own Qty and Unit
were still English on the screen.

The second blind spot was one rule, and it explains both rounds. `dcApplyLang`
is an attribute scan over the document as it stands: it runs, it finishes, and
it does not come back. Markup a renderer builds AFTERWARDS keeps whatever the
template wrote into it, in whatever language the template wrote it — so a
`data-i18n` on generated markup is a hook nobody will ever apply. Sixty-three
elements were built that way.

The lesson is that no source check can stand in for the screen. There is now a
**rendered-DOM scan**: it switches to 中文, walks eleven reachable states, reads
every visible run of text and every visible placeholder, title, aria-label and
alt, subtracts one explicit table of trade vocabulary, and reports what is left.
The table holds material codes, sizes, finishes, product names, units and
registered entities; it holds no verbs and no prose, so no English sentence can
pass it. Its first run found thirty-eight leaks on a screen the previous round
had signed off.

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
* **Two of the three rounds were driven by external review, not by the audit's
  own checks.** The translation tooling passed twice while real leaks were on
  screen; that is recorded as F22 and F26 rather than glossed, and the answer
  to it is a check that reads the rendered DOM instead of the source.
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
strings need a native speaker, and two questions still need a business answer —
whether Quick Add should learn the other six products, and whether the diameter
tables' missing M6/M14 fullsize bars are intentional. Four earlier questions
have since been answered and are no longer counted as open.

A quantity RANGE — "50 to 80" — reads today as an unreadable count, and the row
says Needs Qty. That is the shipped behaviour and it is deliberate; whether a
range should one day be read AS a range is a possible enhancement, not one of
the two questions holding this back, and it is not counted as one.

**ROUND STATUS: WAITING FOR NICHOLAS / CHATGPT REVIEW — NOT DEPLOYED**
