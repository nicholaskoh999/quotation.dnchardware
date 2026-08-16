# Remaining business decisions

Each item below is a question I could not answer from the code, because the code
does not contain the answer — it contains a *choice somebody made*, and changing
it changes what a customer is charged or what a document says. None of them is
guessed. Each states what happens today, what the alternatives are, and what
changes if you pick each one.

Marked **BLOCKED — BUSINESS INPUT REQUIRED** where nothing further can be done
until you decide.

---

## 1. The 4140 QT rate table has one live route and one dead one
**BLOCKED — BUSINESS INPUT REQUIRED**

**What happens today, verified in the browser:** a 4140 QT sag rod *does* get its
automatic rate. Fullsize M16 PL is rated 6.50 with 3.50 additional; fullsize M12
is 8.50; undersize M12 is 9.50; ZP adds 1.50; HDG adds 3.20 to the rate and 1.00
of thread brushing to the additional cost. Sizes the table does not hold (M30,
say) get no rate at all, and the item cannot be added until somebody types one —
which is correct.

Those numbers arrive through the **Default Price rules** path, which reads
`RATES_4140` by item identity. There is a *second* reader, `get4140Rates()`,
which looks the table up by the built description — and it has been returning
nothing for some time, because the description says `4140 QT FULLSIZE SAG ROD`
while the table's keys say `4140 FULLSIZE SAG ROD`. Both facts are now pinned by
assertions in `tests/suites/11-business-rules.test.js`.

**Why I did not "fix" the dead lookup.** It is not a missing price — the price
arrives. But the two routes behave differently in one case: when somebody
**changes the material** on an item where they had typed their own rate, the
live route leaves the typed rate alone, while the dead route (if repaired) would
force-overwrite it, because that is what the mild-steel branch does. So repairing
it would change pricing behaviour in a case where staff have deliberately typed a
number.

**Your options**

| | What changes |
|---|---|
| **A. Leave it** (today) | Nothing. One dead code path stays until Pricing Engine V2 deletes it |
| **B. Delete the dead lookup** | Nothing at all changes in behaviour — proven by the assertions above. Tidier code |
| **C. Repair the key so both routes work** | Switching an item's material to 4140 QT would then overwrite a cost rate somebody typed, the way switching to MS already does. Consistent, but it overwrites staff input |

My recommendation is **B**, and to make material-change behaviour consistent
across materials as part of V2 rather than as a one-line change now.

---

## 2. Should the printed quotation line include accessories?
**BLOCKED — BUSINESS INPUT REQUIRED**

Today, in Auto Round and No Round, the accessory cost is added to the bolt's
computed price and the sum becomes the unit price on the quotation. In Manual
Price, the typed price is the whole line and nothing is added.

Pricing History now separates them: it reports the bolt's own price and the
accessory cost beside it, and where a saved row cannot prove how it was priced it
says "Accessories not separable" instead of inventing a separation.

The question is whether the *quotation itself* should keep folding accessories
into one unit price, or show them as their own line. That is a decision about
what your customers should see, and it changes every quotation, so I have not
touched it.

---

## 3. Supplier cost rate vs internal quoting rate

Today one number does both jobs: the Cost Rate per kg is what the quotation
calculates with, and there is nowhere to record what the steel actually cost.
Until both exist, true margin cannot be reported.

`MATERIAL_RATES` in the workbook has a column for each. If they are the same
number for a material, say so in the Remark rather than leaving one blank — a
blank cannot be told apart from "nobody filled this in".

---

## 4. Does any customer have a different *cost*, or only a different *markup*?

The V2 design assumes cost is global and margin is per customer: `CUSTOMER_MARKUP`
changes the markup, nothing else. That keeps the margin visible, which is the
number a business manages.

If a customer genuinely has a different cost — a supplier arrangement tied to one
contract — name them, and it gets its own table with its own effective dates, so
it can never be mistaken for the general rate.

---

## 5. Bands, and where they meet

Every banded rule in the workbook (thread length, quantity, size range) needs its
edges decided. The live thread-length table had a real hole: 30–120 charged 0.60
and 121–200 charged 1.00, so a TL of 120.5 fell through to zero. That was closed
in the previous pass by making the bands meet.

When you fill in `PROCESS_COST_RULES` and `LABOUR_QTY_RULES`, write bands that
meet at their edges and cover the whole range, including quantity 1. Anything not
covered has to refuse to price rather than quietly charge nothing.

---

## 6. Live AI verification has not been performed
**BLOCKED — no OpenAI key in this environment**

`ai_extract.php` was exercised with its own unit tests (64 assertions, including
the truncation-recovery path) and the browser suites drive `wqaAiApply` with the
exact JSON shape the endpoint returns. That proves everything *after* the model
answers.

It does not prove the model's answer itself. HAB-TA-01.pdf and the 29-row anchor
bolt screenshot were tested through simulated extraction, not through a live API
call, because this environment has no key. The lengths 950 / 865 / 1000 / 1200 /
1285 and the 29 rows are asserted against the extraction shape, not against what
GPT returns for those files today.

After deployment, please run both files through the live Analyze path once and
compare. That is the only step of the checklist I cannot perform for you.

---

## 7. Per-person attribution

`auth.php` is a single shared account — no user table, no roles. So an audit
trail can record *what changed and when*, but not *who changed it*. If rate
changes need to be attributable to a person, that means individual logins, which
is a change to how everybody signs in and belongs to you, not to the pricing
engine.

---

## 8. Every value in the pricing workbook

`pricing-engine-v2-input.xlsx` is deliberately empty. No raw material rate,
process charge, labour tier, markup or supplier accessory cost has been invented,
and the example rows carry zeroes and are marked `EXAMPLE — DELETE`. A checker
(`tests/tools/check-pricing-workbook.py`, 62 assertions) asserts that the
workbook holds no business number, so it cannot quietly acquire one.

The numbers that *are* in the code today are listed in the README sheet, for
reference while filling it in. They are stated, not copied into the sheets: a
transcribed number with no owner is how they became invisible in the first place.
