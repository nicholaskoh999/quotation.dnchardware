# FINDINGS

Baseline `f96714e33795e80b581b1d03deb9d04db1d94b8d`
Final application SHA `e3d659bba1636cd4cfc74cb89be1b52cf92aff67` · Not deployed.

**P0 0 · P1 13 · P2 24 · P3 2 · 39 total, all repaired.**
F1–F6, F8–F16 and F23–F24 were the overnight round. F7 and F17–F22 came out of
external review the following morning and are marked *(morning repair)*.
F25–F29 came out of the review after that and are marked *(final closing
repair)*; every one of them was found by reading the RENDERED SCREEN in 中文
rather than by reading source, which is the point of them. F30–F33 came out of
the workflow polish round and are marked *(workflow polish round)*: F30 was
reported by external review, F31 and F32 were found while separating the three
editing mechanisms, and F33 was found by the rendered-DOM 中文 suite.

F34–F36 are the *(closing repair)*, all three reported by external review and
all three the same fault in different clothes: the screen saying something that
was not true. F37–F39 came out of the *(overnight audit)* that followed, and
were found by reproducing named weak spots rather than by reading code — two of
them put a wrong number into a quotation with no warning at all.

Severity follows the brief: **P0** wrong customer / data corruption / catastrophic
pricing · **P1** wrong price, weight, quantity, material, finish, Previous Price
reuse, or major parser corruption · **P2** workflow, persistence, translation or
usability failure · **P3** cosmetic.

Every finding below was reproduced first, given a failing regression, then
repaired. The regression that reproduces it is named against each one.

> **On SHAs.** `e3d659bba1636cd4cfc74cb89be1b52cf92aff67` is the last commit that changed the
> application or its tests — it is the ONE SHA every number in this package was
> measured against, and it is the only current application SHA any of these
> documents names. It became the accepted commit when UI POLISH 1 was accepted;
> the superseded one, `7f5bc977197a658d6d4db995ee2c9bb5e106e21b`, was accepted before that round and
> must not be quoted as current. The commits after the application one write
> this package, and a report cannot name the commit it is inside without
> changing it; the exact HEAD the archive was built from is recorded in
> `MANIFEST/MANIFEST.txt`, which is generated at build time and is not
> committed.

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

---

## P1 — HIGH *(final closing repair)*

### F25 · Opening the application in 中文 removed the Price Mode control from ten of the eleven product forms
`ensurePriceModeControls()` finds each form's pricing heading and inserts the
Price Mode select after it. It found that heading by looking for the English
word **"Pricing"** in its text:

```js
const pricingLabel = [...form.querySelectorAll('.group-label')]
  .find(node => node.textContent.includes('Pricing'));
if (!pricingLabel) return;
```

Opened in 中文 that heading reads 价格资料. The lookup returned nothing, the
function returned early, and the control was never built. Counted on a real
page: **English 11 selects, 中文 1.** No Round and Manual Price were
unreachable, and nothing on the screen said why — the field simply was not
there.

Pricing itself was never touched by this. The default mode is Auto Round and
the arithmetic is identical; what was lost was the operator's ability to
choose. It is graded P1 because the choice is a priced one: Manual Price is how
a quoted figure is entered by hand.

*Repair* — the heading is found by its translation key, which does not change
when the language does. Both `pricingEntry` and `pricing` are accepted, because
the Welding Anchor Set form names it the shorter way and would otherwise have
been the one form left out.
*Regression* — suite 33 §2 counts the selects in both languages and asserts
they match, that the count is eleven, and that all three modes are selectable
in 中文. *Found by* — the rendered-DOM scan, not by reading source.

---

## P2 — MEDIUM *(final closing repair)*

### F26 · A `data-i18n` inside generated markup is a hook nothing ever applies
This is the single defect behind both false-green rounds, and it is worth
stating precisely because every earlier check got it wrong the same way.

`dcApplyLang()` is an attribute scan over the document as it stands. It runs,
it finishes, and it does not come back. Markup a renderer builds AFTERWARDS
keeps whatever the template wrote into it — in whatever language the template
wrote it — for as long as the element lives:

```js
panel.innerHTML = `
  <div class="q-helper" data-i18n="cpSelectCompany">
    ℹ️ Select a company on the left to view all saved quotations for that company.
  </div>`;
```

The key existed. The Chinese existed. Nothing ever asked for it. That exact
line was on screen in English, in 中文 mode, and was named in review.

**63 elements** were built this way — 54 in `index.php`, 9 in `companies.php`.
Between them they covered the Companies helper lines and its Load More buttons,
its two loading panels and both empty ones, the whole Others form, the Price
Mode and Manual Price fields injected into every product form, the
pricing-history record card, and the Quick Add row's own labels.

*Repair* — generated markup resolves its own text through `dcT()` at the moment
it is built. Markup that is built ONCE and then lives on keeps the `data-i18n`
as well, because that is what re-labels it on a later switch; markup that is
re-rendered by a `dcOnRelabel` hook does not need it. Text that is COMPUTED —
a counter, a price, a mode name read off live state — gets neither: it keeps
its figures on the node and a hook rewrites the sentence around them, because
a `data-i18n` on computed text writes a constant over a real value.
*Regression* — `check-translations.js` now reports an `unapplied hook` for any
`data-i18n` inside a `<script>` whose element does not also resolve through
`dcT`, and suite 33 reads the rendered DOM in eleven states.

### F27 · Thirty-six more strings that never reached the translator
Found by reading whole STATEMENTS rather than one literal after an `=`. Every
one of them put its English somewhere the old patterns did not look:

* **seven `confirm()` dialogs** — the only places this application asks before
  doing something it cannot undo. "Delete all custom diameter rules?",
  "Clear all items in this quotation?", "Start a new quotation? Current unsaved
  draft will be cleared.", "Delete this default price rule?" and three more,
  English in both modes;
* **ternaries**, where the English sits past the `?`: `editingQuoteId ? 'Update
  Quotation' : 'Save Quotation'`, `ok ? 'WhatsApp text copied.' : 'Copy failed…'`,
  `rule.source === 'system' ? 'Override System Default' : 'Edit Rule'`;
* **side-by-side pairs**, both languages at once, which is the pattern the
  language switch was introduced to replace: `'Locked / 已锁定'`,
  `'Editing / 正在编辑'`, `'Update / 更新'`, `'Save / 保存'`, and three
  validation messages built as `label + ' cannot be negative / ' + label + ' 不能为负数'`;
* **an object literal holding labels** — `{v:'auto', label:'Auto Round'}` — which
  is how the Quick Add row's three price modes stayed English;
* **a function returning bare English** — `getPriceModeLabel()`, which fed the
  pricing preview.

*Repair* — all thirty-six now resolve through `dcT`, and the mode table holds a
translation KEY beside each mode CODE so the code never moves.
*Regression* — `check-translations.js` reads `.textContent=`, `.innerHTML=`,
`.placeholder=`, `.title=`, `.value=`, `setAttribute`, `showToast`, `confirm`,
`alert`, `prompt`, label-ish object properties and ternary returns as whole
statements, and collects every literal in each.

### F28 · The screen's dates stayed English in 中文
`14 Feb 2026` on the Companies cards, the summary tiles, the detail panel and
the pricing-history record card. The PRINTED quotation's date is deliberately
left alone — which language a customer's document is written in is the open
question in BUSINESS-DECISIONS-NEEDED.md §1 — so the two formatters were
separated rather than merged: `formatPrintDate` is untouched, and the screen's
`fmtDateShort` / `fmtDate` answer `2026年2月14日` in 中文.
*Regression* — suite 33 §7 scans the Companies page and its detail panel.

### F29 · `dcSetLang` on companies.php still skipped the re-render
The morning round fixed this in `index.php` — pressing the button for the
language already in force must still re-render, because `dcApplyLang` writes a
dictionary CONSTANT over every computed value it can reach — and left
`companies.php` with the old `if (before !== l)` guard. Its relabel hook also
called `dcApplyLang()` a second time AFTER re-rendering, which is the same
constant-over-a-value mistake one layer up. Both corrected; the detail panel is
now re-labelled too, by re-selecting the company that is already selected.

---

### F30 · Escape restored a diameter's VALUE but not where it came from — *(workflow polish round)*
**P1.** A diameter is two facts: the number, and whether a person chose it.
Escape in a Fast Edit cell restored the first by handing the snapshot's value
to `wqaEditDia`, whose entire job is to record that somebody typed this. So
pressing Escape over a default 10.6 returned 10.6 and announced it as an
override.

Not cosmetic. Provenance decides whether the diameter table may answer again
for the next size, so the row was left in a state it had never occupied: the
following size change would have dropped an override nobody ever made.

Reported by external review, reproduced first as a failing assertion, then
repaired. Both fields are restored together now, and the mark is made visible
on the box while an edit is open — previously the one mode where provenance
could change was the one place you could not see it. The diameter calculator
is untouched.
*Regression: suite 36 §Escape — default 10.6 → 10.7 → Esc ⇒ 10.6 AND Default;
manual 10.7 → 11.0 → Esc ⇒ 10.7 AND Manual; the weight recomputed from the
restored bar in both directions and the price following it.*

### F31 · A bulk identity change left a Previous Price card crediting a record that no longer described the row — *(workflow polish round)*
**P1.** A row priced from a historical MS / UNDERSIZE / ZP record, then
bulk-changed to FULLSIZE, re-priced correctly to RM3.20 — and went on
displaying `← Previous Price · Q-2026-0430`, an Undersize quotation. The
matching itself was already right (`wqaHistFor` re-keys on product, material,
size type, finish, size and dimensions, and `wqaHistStale` reloads); what
survived was the CLAIM.

Present in the single-row path as well as the bulk one, so both go through one
guard, keyed on the same identity function the matcher uses — the card is
dropped exactly when the match would stop returning that record, and never
because something unrelated was edited.

Only the reference goes. The rates the record contributed stay: they are the
row's own pricing entry by then, and dropping them would move the price a
second time for a reason nobody asked for.
*Regression: suite 37 §28 — apply a record, bulk-change the size type, assert
the reference is empty, the card carries no Q-number, and the row still prices
on the identity it actually has.*

### F32 · Two Details forms could stand open at once — *(workflow polish round)*
**P2.** A row's form is tall. Two of them stacked pushed the list they describe
off the screen — the same objection that keeps Bulk Edit and Details apart,
applied to Details against itself. Opening one now closes the other.
*Regression: suite 37 §43.*

### F33 · Clearing a selection left an impossible Apply enabled — *(workflow polish round)*
**P2.** "Selected Items" with nothing selected must refuse rather than widen to
every row. The refusal was wired to the tick handler but not to Clear Selection
— so the one path that takes a scope from one item to none left an enabled
Apply behind it. Every path that redraws a panel now re-reads the refusal.

Found by the rendered-DOM 中文 suite rather than by source reading, which also
caught a mixed-language leak beside it: the pricing note told a Chinese reader
that "Auto Round 与 No Round" items recompute, naming two controls by names
they do not have on that screen — the buttons two lines below say 自动进位 and
不进位.
*Regression: suite 33 §13 and suite 37 §13.*

---

### F34 · A bulk apply that touched four rows said it touched all of them — *(closing repair)*
**P2.** Scope Selected Items, four rows ticked, Apply Pricing — the data was
right, and only those four moved. The message afterwards said *Pricing entry
applied to all items* / *价格设置已应用到全部项目*, because there was only one
sentence and it was written for the common case.

A person who reads the toast and not the list was told something false about
their own quotation. Every apply path now chooses a whole sentence by scope,
so "all items" can only be said when the scope really was all items.

Two whole sentences per action rather than a verb concatenated with a scope
clause: Chinese and English put the pieces in different places, and a
translator handed half a sentence cannot do anything useful with it.

The Size / TL panel was worse than the rest — it built its sentence by English
string concatenation, so 中文 read *"Size M12 applied to 3 items"*.
*Regression: suite 37 §CR-01 — both scopes × both languages, asserting the
count is named, that "all items" never appears under a selection, and that the
rows agree with the message.*

### F35 · Expanded rendered a Close that could not close — *(closing repair)*
**P2.** `wqaRowIsOpen` returns true from `wqa.view === 'expanded'` alone, so in
global Expanded the row-level Close set `r.open = false` and the row stayed
open. The action was inert in the only mode it appeared to be needed.

A control that cannot do what it says is worse than no control: it teaches a
person that the screen does not respond, and that lesson carries to the
controls that do work. Expanded no longer renders it; Compact keeps
Details / Close, which closes.
*Regression: suite 37 §CR-02 and suite 17 — Expanded asserts the action is
ABSENT while History and remove stay reachable, and Compact asserts that
pressing Close actually closes the row.*

### F36 · Clear All Accessories reported success over an empty selection — *(closing repair)*
**P1.** With scope Selected Items and nothing ticked, Clear All Accessories was
pressable, cleared nothing, and said *Accessories cleared on all items*.

A destructive action reporting success over an empty set is the worst of the
three messages in this group: it reads as "done" and invites nobody to check.
Graded P1 rather than P2 because the sentence it printed described a
destructive operation across every row.

It now refuses with the same wording every other refusal uses, cannot be
pressed in the first place, and — when it does run — names the rows it
actually cleared.
*Regression: suite 37 §CR-03 — disabled, explained, changes nothing when
called directly, then clears exactly the two ticked rows and says so.*

### F37 · An ambiguous quantity written INLINE was silently resolved — *(overnight audit)*
**P1.** `qty 100 / 200` on a line of its own is correctly refused. The identical
statement on the item's own line —

> `M24 x 300 x tl 65/65 qty 100 / 200`

— quoted **100 pieces**, with no warning. Every spelling behaved the same way:
`100/200`, `100 or 200`, `100 - 200`, `50 to 80`.

The original repair anchored its rule to the whole line, deliberately: a slash
between two numbers is a THREAD PAIR everywhere else in this trade, and
`M24 x 300 x 100/200` must never be read as a count. That anchoring stays. What
makes the inline form safe to detect is the same thing that made the own-line
form safe — the WORD. The marker must sit immediately in front of the two
numbers, so a thread pair, a length range and a dimension chain are all
untouched because none of them is preceded by "qty".

The difference is what happens next: the own-line form is emptied, because the
line was nothing but the unreadable count; the inline form loses only the
phrase, so the item keeps its size, length and thread and asks for its
quantity instead of inventing one.

A rule that holds in one position and not the other is not a rule; it is a
place the customer happened not to press.
*Regression: suite 29 — all six spellings inline, each asserting the geometry
survives, plus the three false positives that must not appear (a thread pair
beside a count, a single inline count, an ordinary trailing count).*

### F38 · An item number written as a word became the length — *(overnight audit)*
**P1.** `3.` and `3)` were recognised as list numbering and dropped. `NO3`,
`NO.3`, `NO 3` and `#3` were not, so the number stayed on the line for the
dimension readers:

> `NO3 M12 L=1000 TL 70/70 - 3pcs`  →  **length 3**

A metre-long rod quoted at three millimetres, silently. Named in the brief as a
known weak spot and reproduced on every spelling.

The repair is deliberately narrow: the marker word must be present — a bare
leading number keeps the existing rule and its existing guards — and something
must follow it, so a line that is nothing but `NO. 3` is left alone rather than
emptied.
*Regression: suite 12 — eight spellings, plus a line with no numbering and an
imperial `1/2` that must not be read as one.*

### F39 · An unrecognised size kept the previous size's diameter on screen — *(overnight audit)*
**P2.** Typing `M23` over an `M27` left the DIA column showing **27**. No price
was produced — the row is blocked by the Valid Size rule — but the column's
entire contract is that the number on the screen is the bar the weight was made
of, and here it was a bar belonging to a size that was gone, beside no weight
at all.

The recompute returns early for an unknown size, before the read-back that
keeps the column honest, and the calculator still held the last size it was
given. The row now shows no diameter; it still asks for a valid SIZE, which is
the actual problem, rather than for a diameter nobody could supply until the
size is right. A diameter a person typed is theirs and follows the existing
identity rule instead.
*Regression: suite 36 — M27 → M23 → M20, asserting the bar disappears and
returns, and that a manual diameter is dropped by an unrecognised size exactly
as it is by a recognised one.*

---

## Found, examined, NOT repaired

These are recorded rather than changed, with the reason.

### N1 · A conflicting quantity produces a spurious row — **RESOLVED BY F7**
This described the behaviour before the morning repair: `qty 100 / 200` read as
quantity 100 with 200 left over, and the leftover became a second row.

It is no longer open, and it is no longer a business question — the rule was
decided and implemented. Neither number is taken, no second row is produced,
and the item says Needs Qty. See **F7**, and BUSINESS-DECISIONS-NEEDED.md §2
for the decision itself.

Kept here rather than deleted so the finding number still resolves for anyone
reading an earlier draft.

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
