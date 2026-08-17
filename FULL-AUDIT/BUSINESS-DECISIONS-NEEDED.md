# NEEDS BUSINESS DECISION

Final `3696f59d684392914f58e6ac2ad44422c1f3f3df` · not deployed.

Each of these would change price, quantity, size identity, quotation output or
what a customer receives. None was guessed at. Every one is a single question
with the options laid out and what the code does today.

---

## 1 · Should the printed quotation be translated?

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

## 2 · A conflicting quantity — ANSWERED, and implemented

`qty 100 / 200` on a line of its own.

This was an open question after the overnight round. It has since been answered
by instruction and implemented: **read neither number, no phantom row, mark the
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

**Still open, if you want it different:** whether a RANGE ("50 to 80") should
be treated as a range rather than as an unreadable count.

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

## 4 · A bare comma-separated list of numbers

**Today** `M24 x 1,000` is a metre-long rod (fixed this run — it used to be
1 mm). A line that is NOTHING BUT comma-separated numbers, such as `100,200,300`
on its own, is left as a LIST and not fused into one number.

That boundary is a judgement: `100,200,300` could be three lengths or one
absurd number, and leaving it as a list preserves what the app did before.

**Please confirm** the boundary is right, or say which way it should read.

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

## 6 · Thread Reference on customer output

**Today** Thread Reference is internal reference metadata. It does not reach the
printed quotation or the WhatsApp text, and the audit did not add it there —
the brief was explicit about that.

If it should appear on customer output, say where: beside the size, on its own
line, or only when it was actually stated.
