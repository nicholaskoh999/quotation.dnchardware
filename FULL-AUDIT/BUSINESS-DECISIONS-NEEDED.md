# NEEDS BUSINESS DECISION

Final application SHA `7f5bc977197a658d6d4db995ee2c9bb5e106e21b` · not deployed.

**Two questions are open. Four are decided and are recorded below as decided,
not as open** — they were being counted as unanswered in earlier drafts of this
package and are not any more.

| | |
|---|---|
| §1 The printed quotation's language | **DECIDED — stays English for now** |
| §2 A conflicting quantity | **DECIDED — refuse both, mark Needs Qty** |
| §3 Should Quick Add learn the other six products? | **OPEN** |
| §4 A bare comma-separated list of numbers | **DECIDED — stays a list** |
| §5 Sizes with no fullsize bar | **OPEN** — a yes/no confirmation |
| §6 Thread Reference on customer output | **DECIDED — stays internal** |

The two open ones would change price, quantity, size identity, quotation output
or what a customer receives. Neither was guessed at. Each is a single question
with the options laid out and what the code does today. The four decided ones
are kept here so each decision has somewhere to live, and so nobody re-opens one
by finding an old draft.

> **On SHAs.** `7f5bc977197a658d6d4db995ee2c9bb5e106e21b` is the last commit that changed the
> application or its tests — it is the ONE SHA every number in this package was
> measured against, and it is the only application SHA any of these documents
> names. The commits after it write this package, and a report cannot name the
> commit it is inside without changing it; the exact HEAD the archive was built
> from is recorded in `MANIFEST/MANIFEST.txt`, which is generated at build time and
> is not committed.

---

## 1 · Should the printed quotation be translated? — **DECIDED: stays English for now**

Recorded as answered. The audit does not change it, and the closing round's
translation work stops at the operator's screen: `formatPrintDate` and the whole
print template are untouched, and the screen's own date formatter was separated
from the document's rather than merged with it.

Kept below because the OPTIONS still stand if it is ever revisited.

**Today** the operator's SCREEN switches between English and 中文 completely.
The printed quotation and the WhatsApp text do not: the column headings
(Quotation No., Prepared By, Description, Size / Dimension, Qty, Unit Price,
Amount, Grand Total), the letterhead and the "This is a computer-generated
quotation" line are English in both modes.

**Why it was left alone.** Which language a CUSTOMER receives is not the same
question as which language the operator works in, and it is not one to settle
inside an audit. A 中文-speaking clerk may well send an English quotation to an
English-speaking customer.

**Options**
* (a) leave as is — the document is always English;
* (b) follow the operator's language;
* (c) a per-customer setting on the company record;
* (d) always print both.

Registered company names and the postal address stay as they are under every
option.

---

## 2 · A conflicting quantity — **DECIDED, and implemented**

`qty 100 / 200` on a line of its own.

This was an open question after the overnight round. It has since been answered
by instruction and implemented. FINDINGS.md **N1** described the old behaviour
and is now marked RESOLVED BY F7; it is not an open question and is not counted
as one: **read neither number, no phantom row, mark the
item Needs Qty.** That is option (a) as it was put.

Recorded here rather than deleted so the decision has somewhere to live. What
ships today:

* neither 100 nor 200 is taken;
* the second number produces no row of its own;
* the item's quantity is blank and the row says "Needs Qty";
* Add All and a partial add both refuse it;
* correcting the quantity by hand lets the row in normally.

Also covered: `qty 100/200`, `qty: 100 / 200`, `qty 100 or 200`,
`qty 100 - 200`, `quantity 50 to 80`. A thread pair — `M24 x 300 x 100/200` —
is untouched, because the ambiguity is in the QUANTITY wording and nowhere
else.

**A possible enhancement, not an open blocker:** whether a RANGE ("50 to 80")
should one day be read AS a range rather than as an unreadable count. Today it
reads as unreadable and the row says Needs Qty, which is deliberate and shipped.
It is not one of the two questions holding deployment, and is not counted as
one — reopen it explicitly if you want it decided.

---

## 3 · Should Quick Add learn the other six products?

**Today** Quick Add reads Sag Rod, Stud, Anchor Bolt, L Bolt and J Bolt. A
message naming U-Bolt, SQ U-Bolt, L Bolt 45DEG, Plate, Welding Anchor Set or
Others reaches Review unread — it is not read as something else, which is the
safe behaviour and is now pinned by a test.

Before this audit, two of those six WERE read as something else: L Bolt 45DEG
and Others / Special Bolt both became plain L Bolts, with an L Bolt's geometry
and an L Bolt's price. That is fixed.

**The question** is whether the six should be added to the parser. Each has its
own dimension schema, so this is real work and not a switch: U-Bolt and SQ
U-Bolt have their own geometry, Plate has length/width/thickness and holes,
Welding Anchor Set is three parts with three cost rates.

---

## 4 · A bare comma-separated list of numbers — **DECIDED: stays a list**

**Today** `M24 x 1,000` is a metre-long rod (fixed this run — it used to be
1 mm). A line that is NOTHING BUT comma-separated numbers, such as `100,200,300`
on its own, is left as a LIST and not fused into one number.

That boundary is a judgement: `100,200,300` could be three lengths or one
absurd number, and leaving it as a list preserves what the app did before.

Confirmed by instruction: a standalone `100,200,300` must NOT fuse into
`100200300`. Pinned by suite 29.

---

## 5 · Sizes with no fullsize bar

The diameter tables have UNDERSIZE entries for M6 and M14 and no FULLSIZE ones.
A fullsize M6 or M14 therefore has no diameter, no weight and no price, and the
row says so.

This is almost certainly correct — the company does not stock them — but it is
worth a yes, because it is the difference between "we do not sell that" and "a
row is missing from a table".

Similarly: the metric table holds M13, M25, M32, M38, M40, M50, M55, M60 and
M65, which are not ISO preferred sizes. They are presumably real stock. No
change made.

---

## 6 · Thread Reference on customer output — **DECIDED: stays internal**

**Today** Thread Reference is internal reference metadata. It does not reach the
printed quotation or the WhatsApp text, and the audit did not add it there —
the brief was explicit about that.

Recorded as answered: Thread Reference is internal reference metadata and does
not reach the printed quotation or the WhatsApp text. The options below stand if
it is ever revisited — beside the size, on its own line, or only when it was
actually stated.
