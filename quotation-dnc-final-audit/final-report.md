# QUOTATION.DNC — final audit report

Two passes over the same chain: source → AI extraction → parser → canonical item
→ review UI → manual correction → Diameter Settings → unit weight → total weight
→ pricing → pricing history → save → reload → customer output.

The first pass audited and repaired that chain. The second pass — this one —
audited what the first pass changed, replaced Last Price with a full Pricing
History, made Diameter Settings the single source of truth for weight, gave the
company size-type rules one home, closed four ways Quick Add could quietly
mislead the person using it, and prepared (but did **not** activate) Pricing
Engine V2.

**Guiding principle, unchanged throughout:** a missing value with a visible
reason is acceptable. A silently wrong size, dimension, weight or price is not.

---

## Commits and deployment

| | |
|---|---|
| **Branch** | `claude/quotation-dnc-audit-repair-ashi82` |
| **Starting commit (pass 1)** | `b5493089057277c6f7742931da26bc6f35553abd` |
| **Delta baseline (pass 2)** | `744ad4084167bf3e0638535779b798b5023c0030` |
| **Ending commit** | `511a6973ee4c00e9c6c71f5efb4f1970ea16052d` (the commit to deploy; see `commit-info.txt`) |
| **Deployment status** | **NOT DEPLOYED** |

Nothing has been deployed. `.cpanel.yml` is a manual two-click deploy
(*Update from Remote*, then *Deploy HEAD Commit*) with an allowlist that
deliberately excludes `tests/` and this package folder, so nothing
in the evidence tree reaches the server even when the deploy is run. The exact
SHA to deploy is stamped in `commit-info.txt`.

I cannot press those buttons from here, and I will not describe an untested live
site as working. Section **Live AI verification** below is the one part of the
checklist that has to be done after deployment, by you.

### Application files changed

`index.php` · `api.php` · `companies.php` · `ai_extract.php` ·
`pricing_history.php` *(new)*

Everything else — `auth.php`, `login.php`, `logout.php`, `db.sample.php`,
`ai_config.sample.php`, `php.ini`, `.cpanel.yml`'s safety model — is untouched
except for one line adding `pricing_history.php` to the deploy allowlist. **No
schema change. No secret in the repository or in this package.**

---

## What was already passing

Stated first, because most of this application was already right and the audit's
job was to leave it that way.

* **Weight.** `d² × developed length × 0.0000061654` for every product, with the
  developed length computed per product (U bolt `⌈(d+ID)×1.57 + 2×IH − ID⌉`,
  square U bolt, L bolt `⌈L+W−1.5d⌉`, J bolt, plate `L×W×T×0.00000785`). No
  rounding of an intermediate. 39 assertions.
* **Metric and imperial in one document.** A metric row and an imperial row in
  the same table are each weighed in their own unit system; one row's unit
  system says nothing about the next. 66 + 170 assertions.
* **Dense tables.** 29 rows stay 29 rows; a merged thread-length cell reaches
  the rows it covers and stops where the next merge starts; one unreadable row
  costs one row, not the document.
* **Product classification and dimension ownership.** Geometry outranks wording,
  and a conflict is shown rather than resolved silently.
* **Accessories are never added automatically** from a drawing's wording.
* **Item isolation.** One form, many rows, no leakage between them.
* **Save → reload → edit → save** without value drift; internal cost rates never
  appear on a customer-facing page.
* **Manual entry always outranks automation.** A typed cost rate is not
  overwritten by any automatic source.

The regression suite that protects all of it did not exist before pass 1. It is
now 13 browser suites and three non-browser suites — **963 assertions, 0
failing** — every one of them running against the shipped code path, not against
a re-implementation of it.

---

## What failed, and what was fixed

### Pass 1 (`b549308` → `744ad40`) — 14 confirmed defects

Reported in full in the previous report, preserved in git history at
`9d70d60:audit-out/final-report.md`. In summary, the mechanisms were:

| Root cause | Effect |
|---|---|
| The imperial size was consumed by the thread reader | `1/2 x 100 x 100/100` lost its size |
| The size box and the row disagreed | The screen showed `23` while the row weighed `M27` |
| Labelled dimensions read backwards | `H 530` landed in the wrong field |
| Thread evidence outlived its section | A thread length reached rows it did not belong to |
| The 4096-token ceiling, not the table | A dense table failed as "could not analyze" |
| A default price outlived the item it was for | A stale rate on a changed item |
| Undersize fell through to the fullsize inch table | Wrong diameter, wrong weight |
| One form, many rows | Values leaked between rows |
| The guard was defeated three lines before it ran | A price survived losing its inputs |
| A size type we chose, presented as the customer's | A guess that looked like a statement |

### Pass 2 (`744ad40` → HEAD) — this pass

**1. Size type — a company rule is an answer, not a guess.**
The previous pass had read "never guess" as "never answer", so a mild-steel M12
that the business has always treated as undersize arrived at Review asking a
question nobody needed to be asked. The rules now live in one place:

```js
const DC_SIZE_TYPE_RULES=[
  {materials:['MS'], sizes:['M12','1/2','1/2"'], sizeType:'UNDERSIZE', why:'companyDefault'},
  {materials:['4140','4140_PLAIN','4340'], notSizes:['M12','1/2','1/2"'],
   sizeType:'FULLSIZE', why:'companyDefault'},
];
```

M12 in 4140/4340 is the stated exception: the rule declines the size, and the
answer is taken from Diameter Settings **only when the settings hold exactly one
size type for it**. Otherwise the row says *Needs Size Type* and no size type is
invented. Every applied default is badged on the row — *Size Type: company
default* or *Size Type: from Diameter Settings* — so a value that came from us is
never mistaken for one the customer stated.

**2. Diameter — one source, and the screen cannot disagree with it.**
There were two answers to "what bar is this cut from": the built-in tables the
calculator used, and a `dia` field inside the rate table that Diameter Settings
published as a *System Default*. They disagreed for undersize 4140 M12 —
**10.6mm** in force, **10.7mm** on the screen.

The rate table no longer carries a diameter at all. `dcEffectiveDiameter` is the
single resolver: a configured rule wins, otherwise the built-in table. The
settings screen is now rendered *from that same resolver*, so the number on the
screen is by construction the number the weight is calculated on. A test walks
every rule the settings screen displays, resolves each one through the
calculator, and asserts `drift.length === 0`.

**3. Pricing History replaces Last Price.**
Described in its own section below.

**4. Choosing a product no longer discards corrections.**
`wqaChangeProduct` re-read the original message and replaced every row, so a
corrected material, a retyped length, a manual price and two deleted rows
vanished silently — and it ignored the Selected-Items scope while doing it. It
now re-reads only when there is nothing to lose:

```js
const mayReparse = wqa.source!=='ai' && wqa.applyScope!=='selected'
                && !wqaAnyRowEdited() && String(wqa.raw||'').trim()!=='';
```

Otherwise the product is applied to the rows in scope, every other value stays,
and a toast says how many rows were changed. An untouched pasted list is still
re-read under the new product's vocabulary, which is the behaviour worth keeping.

Re-auditing that fix found the same defect surviving through a second door.
`wqaAnyRowEdited()` only knew about corrections typed on a row's own card, while
seven other paths write into rows — Correct Items, the Common Fields header, the
Pricing panel, Apply Manual Price, Apply Accessories, Clear Accessories, and the
per-row accessory editor. A correction made from a panel was still discarded, and
more quietly: filling only some rows leaves the header reading *Mixed*, so the
header — the one place a value could otherwise have survived a re-read — does not
carry it either. All seven now mark the rows they change. Proved the same way:
the marks were removed and the assertions failed (`expected "HDG,-", actual
"PL,-"`; a cost rate applied from the Pricing panel came back empty).

**5. The WhatsApp message now numbers items the way the quotation does.**
The message groups by material and finish, so its order is not the quotation's:
a customer saying "increase item 2" and the member of staff looking at item 2
were discussing different products. Each line now carries the quotation item's
own number, and where two identical items merge onto one line it carries both —
`1, 4. M20 x L 1000 - RM12.00` — because a gap in the numbering is not traceable
and a dropped number is worse.

**6. A partial extraction is no longer indistinguishable from a complete one.**
When the model's answer is cut off by the response limit, the rows that arrived
are whole (the row the cut landed in is discarded rather than half-read) but the
list may be short — and a list of 12 from a document of 30 looks exactly like a
list of 12 from a document of 12. It used to be one grey pill among several.

It is now a banner at the top of Review naming the number of rows recovered, and
**Add Items is disabled until somebody ticks an acknowledgement** saying they
have checked the source. Nothing recovered is discarded, the rows stay editable
and priced, and unticking the box takes the permission back. See
`screenshots/7-partial-extraction.png`.

**7. Legacy descriptions read as words on the company screens.**
The quotation screen already rewrote descriptions saved under the older material
vocabulary; the company/history screens — the ones staff open to answer *"what
did we quote them last time?"* — printed the stored value:
`4140_HARDEN_G10_9 FULLSIZE L BOLT`. They now use the same normalisation, from
the same rules, so one item cannot read two ways in two places. Display only;
nothing stored is rewritten, and `4140_PLAIN` and `Y_BAR` never gain a `QT` they
do not have. The item search now returns the material so that guard can be
applied there too.

---

## What was intentionally left alone

* **The pricing formula.** `weight × cost rate + additional cost`, then markup,
  then the rounding mode. Untouched.
* **Rounding.** `round05`, `roundMoney2`, Auto Round / No Round / Manual Price.
  Untouched — these are business conventions.
* **The AI prompt's dimension rules**, beyond what pass 1 fixed.
* **`.cpanel.yml`'s safety model** — allowlist, protected names, two-phase copy,
  post-copy verification. One line added, nothing relaxed.
* **Authentication and configuration.** Untouched.
* **Whether the quotation line should include accessories.** A decision about
  what customers see; see *Business input still needed*.
* **The 4140 QT description-keyed lookup.** Dead code, but repairing it would
  change how a material change treats a typed rate. See the same section.
* **Anything that was already passing.** Where a test was added to an
  already-correct behaviour, the behaviour was not touched.

---

## Root causes

Symptoms are cheap. These are the mechanisms behind pass 2's findings.

**R1 — Two sources for one physical fact.** The diameter existed in the rate
table *and* in the diameter tables, and the settings screen read one while the
calculator read the other. Any value with two homes will eventually disagree;
the repair was not to synchronise them but to delete one.

**R2 — "Do not guess" applied to facts the business had already decided.** A
company rule is an answer. The distinction that was missing is not
*guess vs. refuse* but *whose answer is it* — which is why every applied default
now carries a badge naming its source.

**R3 — A lookup keyed on a display string.** `RATES_4140` is keyed
`'4140 FULLSIZE SAG ROD'`; `buildDesc` emits `'4140 QT FULLSIZE SAG ROD'` once a
material gained a label. Keys built from text that exists to be read will break
when the text is improved. (Verified consequence: that one lookup is dead, while
the identity-keyed path still delivers the rates — see *Known limitations*.)

**R4 — Re-deriving state instead of amending it.** `wqaChangeProduct` rebuilt
every row from the source text because that was the simplest way to answer "what
would these rows look like as L Bolts?". Rebuilding discards everything a person
has done since. The repair is to track whether anything has been done —
`wqaMarkEdited` on every edit path — and only rebuild when the answer is no. The
trap in that repair is the phrase *every edit path*: the first version of it
covered the row cards and missed the seven panel paths that also write into rows,
so a guard that looked complete still let the original defect through. A flag
that means "somebody has worked on this" has to be set by everything that lets
somebody work on it, or it means nothing.

**R5 — A warning whose weight did not match its consequence.** The truncation
notice was rendered with the same styling as "3 lines were not read as items".
The severity of a warning has to be visible in its shape, not only in its words,
and where the consequence is a quotation that silently omits items, the interface
should require an action rather than a reading.

**R6 — A display rule implemented once, in one of the two screens that needed
it.** `displayItemDesc` existed in `index.php` only. A normalisation that is not
shared is a normalisation that will disagree with itself.

---

## All test results

Run from the repository root immediately before packaging.

```
  ok    size normalisation — model, screen and weight agree                 (42)
  ok    imperial — the first token of a run is the size                     (66)
  ok    weight — every product, every input that moves it                   (39)
  ok    pricing — nothing stale, nothing fabricated                         (41)
  ok    pricing history — the rows we sent, and why they differed           (79)
  ok    mixed documents — a heading speaks only for its own rows            (37)
  ok    save / reload / output — no value drift, no internal costs          (65)
  ok    common fields and Correct Items — a blank never clears an answer    (61)
  ok    dense table — 29 rows, merged cells, metric beside imperial        (170)
  ok    engineering drawing — five parts, five lengths, no borrowed dims    (48)
  ok    company rules — a size type with a reason, a diameter with one src  (44)
  ok    quick add safety — corrections, item numbers, partial extraction    (60)
  ok    company history — a legacy description reads as words              (35)

  13 suites, 787 assertions, 0 failed          91.1s

  ok    ai_extract — dense tables, truncation and error causes              (64)
  ok    pricing history — identity, accessories, ranking                    (50)
  ok    pricing workbook — structure present, no business values            (62)

  PHP lint: 10 files, no syntax errors
```

**963 assertions, 0 failed.** Raw output in `test-results/`.

Three of pass 2's fixes were verified the only way that means anything: the fix
was reverted, the suite was run, and the assertions failed for the right reason —
`the retyped length survives the product being chosen: expected "1100", actual
"1000"`; `every number on the message is a quotation item number: expected
"1, 4 / 2 / 3", actual "1 / 1 / 2"`; `Add Items is disabled until it is ticked:
expected "true", actual "false"`. Then the fix was restored and the suite went
green again.

### Mandatory cases from the brief

| Case | Result |
|---|---|
| `27` typed into the size box → `M27` → weight follows | PASS (42 assertions) |
| `1/2 x 100 x 100/100` imperial positional parse | PASS (66 assertions) |
| Engineering drawing, 5 parts: 950 / 865 / 1000 / 1200 / 1285 | PASS (48 assertions, simulated extraction) |
| 29-row anchor-bolt table, metric beside imperial | PASS (170 assertions, simulated extraction) |
| Pricing history: same customer, different dimensions, other customer, pagination | PASS (79 + 50 assertions) |
| Accessories separate from the bolt price | PASS |
| Save → reopen → edit → save | PASS (65 assertions) |
| WhatsApp / print output | PASS (65 + 60 assertions) |

### Screenshots

Six categories, not one per assertion:

| File | Shows |
|---|---|
| `1-metric-manual-size-edit.png` | `23` corrected to `27` mid-typing; size, weight and price agree while the caret is still in the box |
| `2-imperial-parsing.png` | `1/2`, `5/16`, `3/8`, `7/8`, `1"` and `M20` in one message, each read as itself |
| `3-engineering-drawing.png` | Five parts, five lengths, no borrowed dimensions |
| `4-dense-table.png` | 29 rows with merged thread lengths, metric beside imperial |
| `5-pricing-history.png` | Records with cost rate, additional cost, markup and bolt unit price; accessories reported separately; this customer's rows above another customer's |
| `6-save-reload-output.png` | A saved quotation reopened, beside the WhatsApp text and printed dimensions it produces |
| `7-partial-extraction.png` | A cut-off analysis: the banner, the recovered count, the acknowledgement, and Add Items disabled |

---

## Pricing history design

Last Price was replaced, not renamed. The feature is a **lookup, not a
recommendation**: nothing averages, interpolates, reaches for a nearby size, or
produces a price of its own, and every number it shows was read off a quotation
somebody actually sent.

**Where the rules live.** `pricing_history.php` — no database, session or HTTP
dependency. `api.php` reads the rows and hands each stored item to these
functions; the test suite hands them the same items without a database. One set
of rules, one place, 50 assertions directly on it.

**Identity is exact.** Product, material, finish, size type and size must match
exactly: M20 is not M18 and not M22, fullsize is not undersize, PL is not ZP, an
L Bolt is not a Sag Rod. **Quantity is not identity** — a past quantity of 1 says
nothing about what an item costs to make — and it is reported as context instead.

**Dimensions rank, they do not hide.** A 500mm rod and a 1500mm rod of the same
specification are both shown, precisely because they explain why the two prices
differed. Each record is marked *Same dimensions* or *Different dimensions*.

**Reading order:**

```
  this customer, same dimensions      newest first
  this customer, different dimensions newest first
  another customer, same dimensions   newest first
  another customer, different dims    newest first
```

Every foreign record is labelled *Other customer reference* and names the
customer. Nothing is merged across customers and nothing is averaged: two
customers' prices for one specification are two facts about two customers.

**Per record:** reference number, customer, date, specification, dimensions,
quantity, **cost rate · additional cost · markup · bolt unit price**, and the
accessory cost stated separately. *Use this price* fills the manual price and
records which record it came from.

**Removed on purpose:** Last / Low / High / Average. An average of four
quotations to three customers over three years is a number that describes
nothing, and it invites a person to treat it as guidance. A test asserts the
words *average*, *avg*, *lowest* and *highest* appear nowhere on the screen.

**The whole database, not the newest 300.** `get_pricing_history` scans all
quotations with a SQL `LIKE` prefilter on the size, ordered newest first, and
pages 20 records at a time with *Show more*. The panel says *Showing 5 of 5
matching records · 3 this customer, 2 other*, so a partial view can never read as
a complete one.

**A manual price is never overwritten.** History arriving after somebody typed a
price does not touch it, and *Use this price* is an action a person takes.

---

## Diameter source-of-truth result

**PASS.** The diameter currently configured by the user is the diameter used for
the weight calculation, everywhere.

* `dcEffectiveDiameter(type, material, sizeType, size)` is the only resolver: a
  configured rule in Diameter Settings wins; otherwise the built-in table
  (`DIA_FULLSIZE`, `DIA_UNDERSIZE`, `DIA_UNDERSIZE_INCH`, plus the
  fullsize-M12→13 special).
* The rate table's competing `dia` field is **deleted**. `get4140Rates` returns
  rates only.
* Diameter Settings' *System Defaults* are generated from the same resolver, so
  the screen cannot state a diameter that is not in force.
* One configured rule was verified end to end: a custom MS FULLSIZE M20 at
  **19.4mm** is the effective diameter, is what the settings screen shows, is
  what a Quick Add row is weighed on, is what the total weight uses, and is what
  the manual entry form resolves — all asserted, with `drift.length === 0` across
  every displayed rule.

---

## Size type business default result

**PASS, with the exception stated rather than guessed.**

| Case | Result | How it is shown |
|---|---|---|
| MS + M12 (and `1/2`) | UNDERSIZE | badge: *Size Type: company default* |
| 4140 QT / 4140 / 4340 QT, any size except M12 / `1/2` | FULLSIZE | badge: *Size Type: company default* |
| 4140 QT / 4340 QT + M12 | taken from Diameter Settings **only if** exactly one size type is configured there | badge: *Size Type: from Diameter Settings* |
| 4140 QT / 4340 QT + M12, nothing configured | **blank** — the row asks | *Needs Size Type*, and the item cannot be added |
| Stud, any material | no size type at all | the field is disabled, marked N/A |

One central rule source (`DC_SIZE_TYPE_RULES`), consulted by Quick Add, the
review panel and the manual form alike. No size type is ever inferred from a
finish, a customer's history, or a product's popularity.

---

## Accessory separation result

**PASS.**

* An accessory has its own quantity, unit price and finish, and its cost is
  computed by `accAddon` — never folded into a cost rate or a weight.
* In Auto Round and No Round the accessory cost is added on top of the computed
  bolt price. In Manual Price the typed price is the whole line and nothing is
  added. Pricing History relies on exactly this distinction to separate a past
  bolt price from its accessories.
* **Where a saved record cannot prove how it was priced, no separation is
  invented.** The record is shown as it stands, marked *Accessories not
  separable*, and its bolt price is reported as unknown rather than guessed:

```php
$ambiguous = $hasAcc && $mode === '';
if      (!$hasAcc)           $bolt = $unit;
elseif  ($mode === 'manual') $bolt = $unit;
elseif  ($mode !== '')       $bolt = round($unit - $aCost, 4);
else                         $bolt = null;
```

* *Use this price* refuses to act on a record whose bolt price could not be
  separated — there is nothing to copy.
* Accessories are never enabled automatically from a drawing's wording; the
  wording is reported and nothing is ticked.

---

## Live AI verification status

**NOT PERFORMED — no OpenAI key in this environment.**

What *is* proven: `ai_extract.php`'s own behaviour, including the truncation
recovery path, under 64 assertions; and everything downstream of the model's
answer, because the browser suites drive `wqaAiApply` with the exact JSON shape
the endpoint returns — 170 assertions on the 29-row table, 48 on the five-part
drawing.

What is **not** proven: what the model returns for those two files today.
HAB-TA-01.pdf (950 / 865 / 1000 / 1200 / 1285) and the 29-row anchor-bolt
screenshot were exercised through simulated extraction only. The parsing,
merging, weighing and pricing of that answer are verified; the answer itself is
not.

**After deployment, please run both files through the live Analyze path once**
and compare against those numbers. That is the only item on the post-deploy
checklist I cannot do for you.

---

## Known limitations

1. **`get4140Rates` is dead code — but the rates still arrive.** Verified in the
   browser: a 4140 QT fullsize M16 PL sag rod is rated 6.50 with 3.50 additional,
   fullsize M12 8.50, undersize M12 9.50, ZP +1.50, HDG +3.20 with 1.00 of thread
   brushing. Those come through the Default Price path, which reads the same
   table by identity. The description-keyed lookup returns nothing because the
   description gained a label the keys never got. **This is not a wrong price**,
   and repairing it would change how a *material change* treats a rate somebody
   typed — so it is a business decision, not a tidy-up. Both facts are pinned by
   assertions.

2. **A row with no size type is weighed provisionally as fullsize** while showing
   *Needs Size Type*. The row cannot be added, so nothing reaches a customer, but
   the number beside the question is a provisional answer that does not say so.

3. **The old `get_price_history` endpoint still reads the newest 300 quotations.**
   The new `get_pricing_history` scans the whole database with pagination; the
   older endpoint remains for the *Check Previous Prices* panel's legacy path and
   keeps its cap.

4. **Line endings.** `index.php` and `api.php` were converted from CRLF to LF
   during this work and have been converted back in the final commit, so the
   files match the repository's original convention. That restoring commit
   touches every line of those two files and changes nothing else — review the
   commit before it for content.

5. **The test tree is not deployed and must not be.** `tests/`,
   `quotation-dnc-final-audit/` and `audit-out/` are outside `.cpanel.yml`'s
   allowlist by construction.

6. **`auth.php` is one shared account.** An audit trail can record what changed
   and when, but not who.

---

## Business input still needed

Set out in full, with options and consequences, in
**`remaining-business-decisions.md`**. In brief:

1. **The 4140 QT dead lookup** — leave it, delete it, or repair it (and accept
   that a material change would then overwrite a typed rate). *BLOCKED.*
2. **Should the printed quotation line include accessories,** or show them
   separately? Changes every quotation. *BLOCKED.*
3. **Supplier cost rate vs internal quoting rate** — today one number does both
   jobs, so true margin cannot be reported.
4. **Does any customer have a different cost, or only a different markup?**
5. **Where banded rules meet** — thread length, quantity, size range.
6. **Live AI verification** after deployment. *BLOCKED on deployment.*
7. **Per-person attribution** on rate changes, if it is wanted.
8. **Every value in the pricing workbook.** Nothing was invented; a checker
   asserts the workbook holds no business number.

---

## Pricing Engine V2

Prepared, documented, **not activated**. See `pricing-engine-v2-plan.md` for the
architecture, what can be reused, what should eventually be replaced, the
calculation dependency flow, overrides, audit history, effective dates,
customer-specific rules and the phased rollout; and
`pricing-engine-v2-input.xlsx` for the data the business needs to supply.

No raw material rate, process charge, labour tier, markup or supplier accessory
cost has been invented. No guessed value has been turned into production pricing.
The migration's acceptance test is stated in the plan and is deliberately strict:
with today's numbers transcribed into the rule tables, **V2 must reproduce
today's unit price to the cent on every item in the regression suite** before any
real rule is allowed to change a price.

---

## Package contents

```
quotation-dnc-final-audit/
├─ final-report.md                  this file
├─ pricing-engine-v2-plan.md        the V2 design, ten sections
├─ pricing-engine-v2-input.xlsx     the blank workbook for the business
├─ remaining-business-decisions.md  what only you can decide
├─ changed-files-summary.txt        every file changed, and why
├─ commit-info.txt                  branch, SHAs, deployment status
├─ test-results/                    raw suite output and PHP lint
└─ screenshots/                     seven frames, one per category
```

---

**DO NOT OPTIMIZE FOR MAKING THE TEST GREEN. OPTIMIZE FOR: THE FACTORY USER CAN
TRUST THE QUOTATION.**

A visible missing value is safer than a silently wrong one. A historical price is
evidence, not a prediction. A pricing rule determines today's calculation.
Accessories are independent components. Diameter Settings determines the
effective diameter used for weight. Company size-type defaults are allowed only
where the business has an established rule — and where one is applied, the row
says so.
