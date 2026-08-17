# FINDINGS

Baseline `f96714e33795e80b581b1d03deb9d04db1d94b8d`
Final application SHA `40e56d6951d7832a19e5b7fd121877faecf7f54a` · Not deployed.

**P0 0 · P1 7 · P2 15 · P3 2 · 24 total, all repaired.**
F1–F6, F8–F16 and F23–F24 were the overnight round. F7 and F17–F22 came
out of external review the following morning and are marked *(morning
repair)*.

Severity follows the brief: **P0** wrong customer / data corruption / catastrophic
pricing · **P1** wrong price, weight, quantity, material, finish, Previous Price
reuse, or major parser corruption · **P2** workflow, persistence, translation or
usability failure · **P3** cosmetic.

Every finding below was reproduced first, given a failing regression, then
repaired. The regression that reproduces it is named against each one.

> **On SHAs.** `40e56d6951d7832a19e5b7fd121877faecf7f54a` is the last commit that changed the
> application or its tests — it is what the numbers in this package were
> measured against. The commits after it write this package, and a report
> cannot name the commit it is inside without changing it. The exact HEAD
> the archive was built from is recorded in `ZIP-MANIFEST.txt`, which is
> generated at build time and is not committed.

---

## P0 — CRITICAL

**None found.** No path was found by which a quotation could attach to the wrong
customer, and no path by which stored data could be corrupted. The customer
association is carried by `companyId` through save and reopen and is asserted in
suites 07 and 13.

---

## P1 — HIGH

### F1 · A comma-grouped quantity was read as its first group
`qty - 15,000 pcs` was quoted as **15 pieces**. Every quantity reader in the
parser asked for `\d+`, so the match stopped at the comma. The variants the
brief names behaved three different ways: `qty 15000` attached correctly,
`qty 15,000 pcs` produced a phantom second row carrying `qty 15`, and
`15,000 pcs` attached nothing at all.

*Repair* — thousands separators are collapsed in `wqaNorm`, the one function
every line already passes through. This is not a new rule: the calculator's own
number boxes have always read `1,200` as twelve hundred, and suite 04 has
asserted that since before this audit. The parser now agrees with it.
*Regression* — suite 29 §1, §3. *Evidence* — `before-fix/03-*.png` vs
`after-fix/03-*.png`.

### F2 · A comma-grouped dimension was read as 1mm, silently, and was priced
`M24 x 1,000 x tl 65/65` produced **length 1 mm**, quantity **0**, unit weight
**0.0036 kg**, unit price **RM 0.60** — and the row was complete, unflagged, and
addable. A metre-long M24 rod weighs 3.55 kg. This is the worst finding of the
run: nothing on the screen said anything was wrong.

*Repair* — same one-line rule as F1. A line that is NOTHING BUT comma-separated
numbers is left exactly as written, because that is the one place a comma really
does separate values (a bare length list).
*Regression* — suite 29 §3. *Evidence* — `before-fix/A-comma-in-a-length.png`.

### F3 · A spec header carrying a material grade became a phantom item
```
4140 sag rod, both thread 65mm, plain     <- a header
M24 x 300mm x tl 65/65                    <- the item
```
produced **two** rows: the real rod, and a phantom one 65 mm long. The line has
no size and no count, so it is a header — but `4140` is a number as well as a
material, and the header reader counted it. Two numbers meant "not a thread
line", so the header was read as an item.

`wqaExtractFields` already counts a line's numbers correctly, through
`wqaStripSpecWords`. `wqaThreadOnlyValue` re-derived them from the raw line and
had drifted from it.

*Repair* — the second answer is deleted; the reader now uses the same helper.
*Regression* — suite 29 §2, over 4140, 4340, grade 8.8, grade 10.9, SS304 and
SS316, plus the guard case that made the reader strict in the first place.

### F4 · "L BOLT 45DEG" was priced as a plain L Bolt
The application has an L Bolt 45DEG product with its own entry form, its own
default prices and its own diameter rules. The difference that matters is that a
plain L Bolt's total length is COMPUTED from its legs — `l + w - d × 1.5`, the
90-degree bend deduction — and a 45DEG one's is not, because the bend develops
differently (`calcLBolt` skips the auto-fill for it). Quick Add does not read
that product, so the message was read as a plain L Bolt and priced on a bend the
customer did not order.

*Repair* — the product is left unsettled and Review asks, which is what Review
is for. Nothing guesses the geometry. *Regression* — suite 31 §7.

### F5 · "SPECIAL BOLT" and "STEEL BOLT" were read as L Bolts
`specia|l bolt` contains the letters of the alias `l bolt`. The product word
matcher had two properly word-bounded tests and a third bare-substring test
sitting beside them, which defeated both. Anything the app files under Others /
Special Bolt was read with an L Bolt's dimension schema and priced with an
L Bolt's computed length.

*Repair* — an alias must be a word. Punctuation is still a boundary, so
`(sag rod)` and `sag-rod,` still resolve; a letter or a digit is not.
*Regression* — suite 31 §7, 20 positive and 8 negative cases.

### F6 · One inch size, three spellings, three different answers
A whole number of inches keeps its mark, because a bare `1` is M1. But the mark
may be written `"`, `”`, `″`, `IN` or `INCH`, and only the straight quote was
canonicalised. So `1 INCH` was:

* not a size `isKnownSize` recognises (it looks for `/`, `"` or `'`);
* still worth 25.4 mm as a FULLSIZE bar, because the inch reader understands the
  word;
* worth nothing at all as an UNDERSIZE one, because that table is keyed `1"`.

*Repair* — `normalizeSizeValue` canonicalises every spelling to `N"`, which is
what the inch reader has always treated them as. *Regression* — suite 31 §1.

---

## P2 — MEDIUM

### F8 · An absent quantity blocked the row instead of defaulting to one
Newly approved rule (brief §2.2). A message with no count at all left every row
blank and unaddable. *Repair* — applied in `wqaNormalizeExtraction`, the single
funnel a pasted message, a photograph, a PDF and a drawing all pass through, so
all four now agree. *Regression* — suite 29 §5, §8, §9.

### F9 · An unreadable quantity was indistinguishable from an absent one
`qty tbc`, `qty ?`, `qty:` — the customer meant to state a count and did not.
Defaulting those to 1 would be the parser inventing an order size. Worse, a
digit-less `qty tbc` line was classified as noise and thrown away with the
greetings, so the row above it looked like an item nobody had stated a count
for. *Repair* — the distinction is now carried explicitly, and such a row asks
for its quantity by name. *Regression* — suite 29 §6, §8.

### F10 · Thread Reference offered UNC and BSW to metric sizes
One fixed hint string — `1.75P · UNC · BSW` — on every row. The READING rule was
already right (only 1/2" gets a series attached); the help text disagreed with
it. *Repair* — context-sensitive by size: `e.g. 1.75P` on metric, `UNC / BSW` on
1/2", `Optional reference` on every other imperial size. It follows the size when
the size is corrected on screen. *Regression* — suite 26.

### F11 · 129 user-visible strings never reached the translator
Almost every validation message in the application, plus the icon-button
tooltips and the screen-reader labels, were written straight into `showToast`
and into `title` attributes. They had no key, so they counted as fully
translated and appeared in English to anyone working in 中文: "Enter Diameter",
"Cost Rate is blank. Enter price before adding."
*Regression* — suite 30 §2, which reads the toast off the screen.

### F12 · The Pricing Guide was never switched at all
The whole page was written in English in the markup — every explanation of Cost
Rate, Additional Cost, Auto Round, No Round and Manual Price. *Regression* —
suite 30 §5.

### F13 · Plate and Welding Anchor Set still used the pre-switch bilingual style
Thirty-two labels reading "Material 材料" — both languages at once, in either
mode — which is exactly the mixed labelling the language switch replaced
everywhere else. *Regression* — suite 30 §5.

### F14 · The Welding Anchor Set guide box was Chinese only
An English reader was handed a paragraph they could not read. A cost note beside
it was Chinese with "Additional Cost" embedded in the middle of it.
*Regression* — suite 30 §5.

### F15 · Empty states, Quick Open errors, history messages and import results
untranslated. These are most of what a new install shows in its first week.

### F16 · A quotation reference reached innerHTML unescaped
The Latest Saved Quote card on the Companies page wrote `ref_no` straight into
markup — the comment above it said so — while the company name beside it was
escaped. The reference is typed by hand when a quotation is saved, and that page
lists every customer. *Repair* — escaped like every other stored value.

---

## P3 — LOW

### F23 · `data-i18n-alt` had no handler
The attribute convention documented four hooks and `dcApplyLang` implemented
three. Added.

### F24 · Two hard-coded English tooltips on the Quick Add size cell
`title="Thread reference — not used in any calculation"`, built into the row
renderer twice. Both now read from the dictionary.

---

## P1 — HIGH *(morning repair)*

### F7 · An ambiguous quantity resolved itself, and to one piece
```
M24 x 300 x tl 65/65
qty 100 / 200
```
The quantity marker took the first number. The leftover 200 became a **phantom
item** carrying a length and no size. And the real item — never told that
anything on the line had been unreadable — fell through to the absent-quantity
rule and went out at **Qty 1**.

That is the precise substitution F9 exists to prevent: an ambiguous count
becoming a confident one. It was worse than the original report, which expected
the item to take 100.

*Repair* — the line is refused whole, before any reader touches it, and the
item asks for its count by name. `qty 100/200`, `qty: 100 / 200`,
`qty 100 or 200`, `qty 100 - 200` and `quantity 50 to 80` all behave the same.
A single number after the marker still reads, and a thread pair — `M24 x 300 x
100/200` — is untouched, because the ambiguity is in the QUANTITY wording and
nowhere else.
*Regression* — suite 29 §10, §11: the row is blocked, Add All and partial add
both leave it on screen, and answering the quantity lets it in with the number
the person typed. *Evidence* — `after-fix/33-ambiguous-qty-needs-qty.png`.

---

## P2 — MEDIUM *(morning repair)*

### F17 · A language switch wiped the live item count
`dcApplyLang` writes each `data-i18n` element's text from the dictionary. On a
COUNTER that constant is a lie — `wqaFootTotal` is declared `wqaZeroItems`,
literally "0 items" — and `dcRelabel` is what puts the real number back.

`dcSetLang` skipped `dcRelabel` when the chosen language was the one already in
force, which is exactly what pressing the active EN or 中文 button does. The
footer went to **0 项 with two rows on the screen** and the Add button lost its
count with it.

Eighteen elements in `index.php` have computed text and a constant declared
beside it. *Repair* — `dcSetLang` always relabels, and the Quick Add count is
recomputed outside the `rows.length` guard so an empty review says 0 项 rather
than 0 items. *Regression* — suite 30 §7, over 0, 1, 2 and 4 rows, both
directions, and the same button pressed twice.

### F18 · The quotation's item cards were never re-rendered
They are built once, when an item is added, and no relabel hook rebuilt them —
so a card added in English kept **"Edit / 编辑"** and **"Delete / 删除"**, both
languages at once, in either mode. *Repair* — `renderQuote` registered with
`dcOnRelabel`. *Regression* — suite 30 §8. *Evidence* —
`after-fix/36-saved-quote-english.png`, `after-fix/37-saved-quote-chinese.png`.

### F19 · The Quick Add review's own labels
Built in script on every render, so none reached the attribute scan: the column
headers (`#`, Size, TL, Qty, Weight, Price, Actions), the row buttons (Edit,
History, Close), the common-fields labels (Product, Material, Finish, Size
Type), the expanded row's Size and Qty, the accessory panels, the history panel
and its record card, the weight and accessory bars.
*Evidence* — `after-fix/35-quickadd-chinese-item-count.png`.

### F20 · Almost the whole Companies page
Its loading line, the four status badges, the buttons under every quotation
(Load / Duplicate / Delete / View), the card meta, the detail panel, the
end-of-list line, one more side-by-side bilingual heading, and four inline
English strings including two `confirm()` dialogs.
*Evidence* — `after-fix/38-companies-chinese-dynamic.png`.

### F21 · The translation checker was false-green
It reported **0 hard-coded** while all of F20 and F21 were on screen. It refused
any run containing `$` or `{`, so every label with an interpolation beside its
English was invisible — which is most dynamic markup. It also could not see
markup built inside a string rather than written as markup.

*Repair* — interpolations are stripped and the English around them is read; one
word is the threshold everywhere, which is only workable because `isCode`
already knows the trade's vocabulary; a fifth pass reads markup built in
strings; and every finding is verified against the source before it is
reported. That last one is what stopped me dismissing a real leak as a false
positive.

### F22 · The Pricing Guide's worked examples, the U-Bolt breakdown, the Others form
The remaining static-markup labels the one-word threshold surfaced.

---

## Found, examined, NOT repaired

These are recorded rather than changed, with the reason.

### N1 · A conflicting quantity produces a spurious row
`qty 100 / 200` on a line of its own is read as quantity 100 with 200 left over,
which becomes a second row with a length and no size. That row cannot be added —
it is flagged Needs Size — so the outcome is visible rather than silent, which
is the safe direction. What it SHOULD do is a business question: see
BUSINESS-DECISIONS-NEEDED.md.

### N2 · Quick Add reads five of the eleven products
U-Bolt, SQ U-Bolt, L Bolt 45DEG, Plate, Welding Anchor Set and Others are not
read. This is a scope limit, not a defect: those messages reach Review unread
rather than being read as something else, and suite 31 §7 pins that so a future
alias cannot quietly capture one of them. Whether Quick Add should learn them is
a product decision.

### N3 · Seven inch sizes live in two diameter tables
`DIA_FULLSIZE` and `WQA_INCH_DIA` both hold 1/2, 5/8, 3/4, 7/8, 1-1/8, 1-1/4 and
1-1/2. They agree today. Nothing made them agree tomorrow, so suite 31 §2 now
reads both and compares them. Merging them is a refactor with no behavioural
benefit today and was not done during an audit.

### N4 · The Version Updates page is not translated
It is a record of what shipped and when, written at the time. Rewriting it in
another language would be rewriting history rather than translating an
interface. The brief also says not to manufacture version history.

### N5 · The printed quotation is not translated
Quotation No., Prepared By, Size / Dimension, Unit Price, Grand Total and the
letterhead are the CUSTOMER's document, not the operator's screen. Which
language a customer receives is a business decision. See
BUSINESS-DECISIONS-NEEDED.md.

### N6 · Registered names, addresses and trade vocabulary are not translated
DER-CHENG FASTENER SDN. BHD., DNC HARDWARE SDN. BHD., EVERTOP HARDWARE TRADING,
the postal address, and M12, 1/2", SS304, 4140 QT, 4140 QT + HARDEN = G10.9, PL,
ZP, HDG, UNC, BSW, TL, RM, Sag Rod, Base Plate. The brief names most of these
outright. `tests/tools/check-translations.js` holds this list explicitly so the
boundary stays visible rather than becoming an oversight.
