# QUOTATION.DNC — final audit report

Three passes over the same chain: source → AI extraction → parser → canonical
item → review UI → manual correction → Diameter Settings → unit weight → total
weight → pricing → pricing history → save → reload → customer output.

**Pass 1** audited and repaired that chain. **Pass 2** audited what pass 1
changed, replaced Last Price with a full Pricing History, made Diameter Settings
the single source of truth for weight, gave the company size-type rules one
home, closed four ways Quick Add could quietly mislead the person using it, and
prepared (but did not activate) Pricing Engine V2. **Pass 3** is the mini-delta: a bolt's
unit price is now the bolt's and accessories are charged beside it, historical
records are ranked by how close their dimensions actually are, every record says
what it weighed and how it was priced, and the last capped history query is gone.
**Pass 4** repairs what live acceptance testing found: the review screen now
names every dimension the way the drawing does, and an overall dimension that
can only belong to one part is no longer left as a question. **Pass 5 — this
one — puts each Quick Add row's pricing history on the row itself**, and stops
looking up rows nobody asked about.

**Guiding principle, unchanged throughout:** a missing value with a visible
reason is acceptable. A silently wrong size, dimension, weight or price is not.

---

## Commits and deployment

| | |
|---|---|
| **Branch** | `claude/quotation-dnc-audit-repair-ashi82` |
| **Starting commit (pass 1)** | `b5493089057277c6f7742931da26bc6f35553abd` |
| **Delta baseline (pass 2)** | `744ad4084167bf3e0638535779b798b5023c0030` |
| **Mini-delta baseline (pass 3)** | `7d0981fdb0f83a0b76a4c3d6b8a3ad1a80e3f38a` |
| **Live-acceptance baseline (pass 4)** | `f250426346c1a256350fca2b12c54f1f5de034b4` |
| **Quick Add history baseline (pass 5)** | `8c43da75e2110772ad9a4d7d744c9491c0181c5e` |
| **Ending commit** | `8c43da75e2110772ad9a4d7d744c9491c0181c5e` (the commit to deploy; see `commit-info.txt`) |
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
now 16 browser suites and three non-browser suites — **1,227 assertions, 0
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

### Pass 3 (`7d0981f` → HEAD) — the mini-delta

**1. A bolt's unit price is the bolt's.**
Ticking two nuts turned a bolt quoted at RM12.00 into a bolt quoted at RM12.50.
The figure staff read as *what this bolt costs* therefore depended on what was
packed beside it; the pricing history built from those figures compared bolts
against bolts-plus-hardware; and nothing on the screen said which of the two a
given number was.

The accessory charge is now its own component. One place settles a line —

```js
function dcLineMoney(boltUnitPrice,acc,qty){
  const bolt=roundMoney2(Number(boltUnitPrice)||0);
  const accUnit=roundMoney2(accAddon(acc));
  return {finalUnitPrice:bolt, accessoryUnitPrice:accUnit,
          lineUnitPrice:roundMoney2(bolt+accUnit),
          accessoryTotal:roundMoney2(accUnit*n),
          totalAmount:roundMoney2((bolt+accUnit)*n),
          pricingModel:'bolt-separate'};
}
```

— and every product that reaches the quotation goes through it. What did **not**
change is the money: the line total is still `(bolt + accessories) × qty`, and a
separation that quietly stopped charging for nuts would have been the worse bug
of the two. Every assertion in the new suite checks both halves.

It is visible everywhere the price is:

* the calculation card shows the bolt price, the accessory charge, and what the
  line comes to per piece;
* the item card labels the item's own price *Bolt* and shows *Accessories*
  beside it;
* **the print sheet gives the accessories their own row**, with their own unit
  price and their own amount — so quantity × unit price reconciles on every
  printed row, which it could not while the two were one figure;
* the WhatsApp message names the accessories and prices them;
* the company screens say what is charged beside each unit price.

**Items priced before the separation existed** are read exactly as they were
written and marked legacy — no separation is invented for them. The one case
that needs care is a *Manual Price*, which used to be the whole line: opening
such an item for editing moves the accessory charge out of the typed figure and
charges it beside the item, so the line total is unchanged and a message says
what happened. Auto Round and No Round need no adjustment, because their bolt
price is recomputed from the rates saved with them. Asserted end to end: a
legacy line of RM307.00 for ten comes back as RM30.00 + RM0.70, total RM307.00.

**2. History is ranked by how close the rod actually is.**
"Different dimensions" was a yes/no. It is now a distance, computed the same way
on the server and in the browser, from the labels the quotation itself writes:

```
distance = Σ |current(d) − record(d)|   over every labelled dimension in either
```

Nothing weighted, nothing learned — 100mm of length and 100mm of thread count
the same, because no business rule says otherwise and inventing one would make
the order unexplainable. A thread written as a pair is read as both of its ends.
Where either side has no readable dimension the distance is *null* — unknown,
not zero — and those records sort last within their group.

```
current   M20 × L600
records   M20 × L500  → 100      ranked first
          M20 × L1000 → 400      then this
          M20 × L1200 → 600      then this
```

An M24 at exactly L600 is not in the list at all: **core identity is a hard
boundary, and closeness is only asked about afterwards.**

**3. Customer grouping, stated as an order.**

```
THIS CUSTOMER      exact dimensions → nearest → further
OTHER CUSTOMERS    exact dimensions → nearest → further
```

The customer comes first and the geometry second, never the other way round, so
a stranger's exact match can never bury the history of the person being quoted.

**4. Every record now explains its own price.** Reference, date, customer,
specification, dimensions and *how far they differ*, quantity, **unit weight**,
cost rate, additional cost, markup, **price mode** and the bolt unit price, with
the accessories stated separately. A value the record never carried says
*Not recorded* or *Legacy / Unknown* — it is never filled in.

**5. The last capped history query is gone.** `get_pricing_history` already
searched the whole database; the retired `get_price_history` read the newest 300
quotations and filtered them in PHP. Nothing had called it since pass 2, and it
now answers with a plain "replaced by get_pricing_history" instead of running.
The surviving query also narrows harder in the database: a modern quotation must
contain both the size and the material as json_encode wrote them, and a
pre-normalisation quotation must contain the size text. Both branches only ever
narrow — every surviving row is still compared field by field.

**6. The size-type rule, case by case.** MS + M12 and MS + 1/2" both default to
undersize by company rule. In 4140 QT, 4340 QT and plain 4140 the blanket
fullsize rule declines *both* M12 and 1/2" — the same exception group — and the
answer then comes from what the company has configured, or the row asks. M12 and
1/2" remain two different sizes: an undersize M12 is cut from 10.6mm and an
undersize 1/2" from 10.9mm, and neither is ever written as the other. Fifteen
assertions, one per case.

**7. Diameter Settings, restated.** Configuring an undersize M12 at 10.7mm makes
the next weight `10.7² × developed length × 0.0000061654` — asserted against the
built-in 10.6mm, which stays in the table and stays overridden.

### Pass 4 (`f250426` → HEAD) — what live acceptance testing found

**1. The review screen named the same field two ways.**
A thread length was *TL* on an L Bolt and *Thread* on a Sag Rod; a length had no
label at all. So a row read `M30 · 950 · W 400 · TL 150` and the 950 was a number
the reader had to identify by its position. One vocabulary now, the drawing's
own, for every product that has the dimension:

```
  STUD          M · L
  SAG ROD       M · L · TL
  ANCHOR BOLT   M · L · TL
  L BOLT        M · L · W · TL
  J BOLT        M · H · ID · S · TL
```

Every value carries its own label with a space between them — `L 950`, never
`L950` and never a naked `950` — in the row summary, in the column headers, in
the per-value labels a narrow screen adds, in the expanded row's field labels
and in the shared *Apply to All* panel. Asserted for all five products, with an
explicit assertion against both `L950` and a naked value.

**2. Two rows of HAB-TA-01 asked for a length they could not have had.**
The extraction offered *"check length 865 or 1000"* for row 3 and *"865 or
1285"* for row 5 — where 865 was already row 2's length. An overall dimension
line belongs to one part, so each of those questions had exactly one possible
answer, and the rows sat unpriced over it.

Fixed at both ends. The prompt now decides *which part a dimension belongs to*
by position before it decides anything else — reading order down the sheet,
the part's own band, the extension lines, and N dimensions for N stacked parts
in the same order. And the review closes a forced choice by **elimination**,
which needs no model at all:

> the row has no length of its own · the extractor named two or more candidates
> · every candidate but one is already another row's length · no other
> ambiguous row wants that same remaining value.

Nothing is inferred from proximity, from row order, or from what a length
usually is, and nothing is chained: a worked-out length is never used to work
out another. Where two candidates are still free, or two rows want the same one,
**both rows go on asking** — the uncertainty rule is untouched. A row resolved
this way says so on its face (*"L 1000 — the only length not already another
item's"*), so a value that came from reasoning is never mistaken for one that
was measured.

HAB-TA-01 now reads 950 / 865 / 1000 / 1200 / 1285 across rows 1–5, with the
L Bolt's W 400 and the four Sag Rods' TL 200/200, and no row asking for a
length. The fixture is in the suite; the five values are not in the code.

### Pass 5 (`8c43da7` → HEAD) — a row's history, on the row

Quick Add could already look up a row's pricing history, using the same
functions the entry form's panel uses. But the panel lived **inside the row's
editor**, so in Compact view — the view a multi-item enquiry is actually
reviewed in — there was no way to reach it without opening the editor first.
And it looked up **every** row the moment the modal opened, and again after
every recompute.

**The action is on the row.** `Edit | History | ✕`, with its own grid track at
each breakpoint and its own order on a phone, so it never overlaps Edit or the
delete. Clicking it expands that row's history directly beneath it, in Compact
or Expanded view alike; clicking again collapses it. Each row keeps its own
open/closed state, and one row's panel shows only that row's records.

**Nothing is looked up until it is asked for.** A ten-item enquiry now opens
with zero requests. A row's lookup fires on its first History click, and two
rows of the same specification still share one request through a session cache
— the efficiency the old sweep had, without the sweep.

**Nothing shown is ever stale.** Each loaded panel records the identity *and*
the geometry it was loaded for. Change the size, material, finish, size type,
product or any dimension and an open panel reloads; a closed one forgets, so
the next click fetches fresh. A change of geometry alone (L 1000 → L 1900)
re-ranks the records already held rather than asking again — the specification
did not change, only which rod is nearest.

**One implementation, two screens.** No matching, ranking, identity, accessory
or legacy rule was added or copied. The row calls the same `phFetch`,
`phDimDistance`, `phSortRecords` and `phRecordHtml` the entry form calls, over
the same `pricing_history.php` rules; only the per-row state and the button are
new. Asserted: for one item both screens return the same set of records, the
same fields and the same wording for what was never recorded.

**Looking is not touching.** Opening a panel leaves the row's price, cost rate,
additional cost, markup, price mode, manual price, accessories, size, material
and product exactly as they were — asserted field by field. The only thing that
copies anything is *Use this price*, the same explicit action the entry form
offers, and it still refuses a record whose bolt price cannot be separated from
its accessories.

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
  ok    pricing — nothing stale, nothing fabricated                         (47)
  ok    pricing history — the rows we sent, and why they differed           (97)
  ok    mixed documents — a heading speaks only for its own rows            (37)
  ok    save / reload / output — no value drift, no internal costs          (65)
  ok    common fields and Correct Items — a blank never clears an answer    (61)
  ok    dense table — 29 rows, merged cells, metric beside imperial        (170)
  ok    engineering drawing — five parts, five lengths, no borrowed dims    (48)
  ok    company rules — a size type with a reason, a diameter with one src  (68)
  ok    quick add safety — corrections, item numbers, partial extraction    (60)
  ok    company history — a legacy description reads as words               (40)
  ok    accessories — charged beside the bolt, never inside it              (41)
  ok    dimension schema and drawing association                            (71)
  ok    quick add — each row's own pricing history, on the row               (76)

  16 suites, 1029 assertions, 0 failed        110.1s

  ok    ai_extract — dense tables, truncation and error causes              (64)
  ok    pricing history — identity, accessories, ranking                    (72)
  ok    pricing workbook — structure present, no business values            (62)

  PHP lint: 10 files, no syntax errors
```

**1,227 assertions, 0 failed.** Raw output in `test-results/`.

Fixes were verified the only way that means anything: the fix was reverted, the
suite was run, and the assertions failed for the right reason. Pass 2 —
`the retyped length survives the product being chosen: expected "1100", actual
"1000"`; `every number on the message is a quotation item number: expected
"1, 4 / 2 / 3", actual "1 / 1 / 2"`; `Add Items is disabled until it is ticked:
expected "true", actual "false"`; and for the panel paths found by re-auditing,
`expected "HDG,-", actual "PL,-"`. Then each fix was restored and the suite went
green again.

The closeness score is verified twice over: the same table of ten cases is run
through `dc_dim_distance` in PHP and `phDimDistance` in the browser, so the
server's ranking and the browser's re-ranking cannot drift apart without one of
the two suites failing.

### Mandatory cases from the brief

| Case | Result |
|---|---|
| `27` typed into the size box → `M27` → weight follows | PASS (42 assertions) |
| `1/2 x 100 x 100/100` imperial positional parse | PASS (66 assertions) |
| Engineering drawing, 5 parts: 950 / 865 / 1000 / 1200 / 1285 | PASS (48 assertions, simulated extraction) |
| HAB-TA-01 as production returned it: rows 3 and 5 resolve to 1000 and 1285 | PASS (71 assertions, no manual confirmation) |
| Product dimension schema and label spacing, all five products | PASS |
| Quick Add: per-row History action, lazy lookup, independent state | PASS (76 assertions) |
| 29-row anchor-bolt table, metric beside imperial | PASS (170 assertions, simulated extraction) |
| Pricing history: same customer, different dimensions, other customer, pagination | PASS (97 + 72 assertions) |
| Core identity never crosses: M20 never uses M18 / M22 / M24 history | PASS |
| Dimension-closeness ranking, and customer grouping above it | PASS (both implementations, one table) |
| Accessories separate from the bolt price | PASS (41 assertions, end to end) |
| M12 and 1/2" share the size-type rule but are different sizes | PASS (15 cases) |
| Configured diameter 10.6 → 10.7 changes the weight | PASS |
| Save → reopen → edit → save | PASS (65 assertions) |
| WhatsApp / print output | PASS (65 + 60 + 41 assertions) |

### Screenshots

Eight categories, not one per assertion:

| File | Shows |
|---|---|
| `1-metric-manual-size-edit.png` | `23` corrected to `27` mid-typing; size, weight and price agree while the caret is still in the box |
| `2-imperial-parsing.png` | `1/2`, `5/16`, `3/8`, `7/8`, `1"` and `M20` in one message, each read as itself |
| `3-engineering-drawing.png` | Five parts, five lengths, no borrowed dimensions |
| `4-dense-table.png` | 29 rows with merged thread lengths, metric beside imperial |
| `5-pricing-history.png` | Records with cost rate, additional cost, markup and bolt unit price; accessories reported separately; this customer's rows above another customer's |
| `6-save-reload-output.png` | A saved quotation reopened, beside the WhatsApp text and printed dimensions it produces |
| `7-partial-extraction.png` | A cut-off analysis: the banner, the recovered count, the acknowledgement, and Add Items disabled |
| `8-accessory-separation.png` | A bolt at RM13.33 with RM0.70 of nuts beside it — the two printed rows, the WhatsApp lines, and the saved item's own figures |
| `9-quickadd-row-history.png` | A Quick Add row's own history, opened from the row in Compact view, with the row beneath it untouched |

---

## Pricing history design

Last Price was replaced, not renamed. The feature is a **lookup, not a
recommendation**: nothing averages, interpolates, reaches for a nearby size, or
produces a price of its own, and every number it shows was read off a quotation
somebody actually sent.

**Where the rules live.** `pricing_history.php` — no database, session or HTTP
dependency. `api.php` reads the rows and hands each stored item to these
functions; the test suite hands them the same items without a database. One set
of rules, one place, 72 assertions directly on it.

**Identity is exact.** Product, material, finish, size type and size must match
exactly: M20 is not M18 and not M22, fullsize is not undersize, PL is not ZP, an
L Bolt is not a Sag Rod. **Quantity is not identity** — a past quantity of 1 says
nothing about what an item costs to make — and it is reported as context instead.

**Dimensions rank, they do not hide.** A 500mm rod and a 1500mm rod of the same
specification are both shown, precisely because they explain why the two prices
differed. Each record is marked *Same dimensions* or *Differs by 400mm*.

**How close is measured.** The dimensions are read out of the labels the
quotation itself writes — L, W, H, S, T, ID, IH, OH, TL, CL, CH — and a thread
written as a pair is read as both of its ends. The score is the plain sum of the
differences in millimetres:

```
  distance = Σ |current(d) − record(d)|   over every labelled dimension in either
```

Nothing is weighted, scaled or learned, because no business rule says one
dimension matters more than another and inventing one would make the order
unexplainable. A distance of 0 is an exact match; a record with no readable
dimension has a distance of *null* — unknown, not close — and sorts last within
its group. The same table of cases is run through the PHP implementation and the
browser one, so the server's ranking and the browser's re-ranking cannot drift.

**Reading order:**

```
  THIS CUSTOMER        exact dimensions
                       nearest dimensions
                       further dimensions
  OTHER CUSTOMERS      exact dimensions
                       nearest dimensions
                       further dimensions
```

The customer comes first and the geometry second, never the other way round: a
stranger's exact match can never bury the history of the person being quoted.
And an M24 is not in the list at all, however close its length — core identity
is a hard boundary, and closeness is only asked about afterwards.

Every foreign record is labelled *Other customer reference* and names the
customer. Nothing is merged across customers and nothing is averaged: two
customers' prices for one specification are two facts about two customers.

**Per record, so a price difference can be explained:** reference number,
customer, date, specification, dimensions and how far they differ, quantity,
**unit weight · cost rate · additional cost · markup · price mode · bolt unit
price**, and the accessory cost stated separately. Where the record never
carried one of those values it says *Not recorded* or *Legacy / Unknown* — it is
never filled in. *Use this price* fills the manual price and records which
record it came from.

**Removed on purpose:** Last / Low / High / Average. An average of four
quotations to three customers over three years is a number that describes
nothing, and it invites a person to treat it as guidance. A test asserts the
words *average*, *avg*, *lowest* and *highest* appear nowhere on the screen.

**The whole database, not the newest 300.** `get_pricing_history` scans all
quotations, ordered newest first, and pages 20 records at a time with *Show
more*. The panel says *Showing 5 of 5 matching records · 3 this customer, 2
other*, so a partial view can never read as a complete one. The database does
the narrowing: a modern quotation must contain both the size and the material as
`json_encode` wrote them, and a pre-normalisation quotation must contain the size
text. Both branches only ever narrow — every surviving row is still compared
field by field, so no legacy record is lost to an optimisation. The old
300-quotation endpoint has been retired.

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

**PASS — and the rule changed in this pass.** A bolt's unit price is the bolt's.

* Choosing two nuts and a washer does not move the bolt's price by a cent. The
  item stores `finalUnitPrice` (the bolt), `accessoryUnitPrice` (the
  accessories), `lineUnitPrice`, `accessoryTotal` and `pricingModel:
  bolt-separate`.
* **The money is unchanged.** The line total is `(bolt + accessories) × qty`,
  asserted at every stage — calculator, saved item, print row, save → reload. A
  separation that quietly stopped charging for accessories would be a worse
  defect than the one it fixed.
* One function settles a line — `dcLineMoney` — and every product that reaches
  the quotation goes through it, so the entry form, Quick Add and the plate path
  cannot come to disagree about what a line costs.
* The print sheet gives accessories their own row with their own unit price and
  amount, so **quantity × unit price reconciles on every printed row**. The
  WhatsApp message names them and prices them. The company screens say what is
  charged beside each unit price.
* Accessory pricing keeps its own inputs — quantity, unit price and finish per
  accessory — and Pricing Engine V2 will give it a supplier cost and its own
  markup. The two calculation paths never meet before the line.
* **Items priced before the separation existed are read as they were written.**
  Their one figure had the accessory charge inside it and that cannot be undone
  safely, so no separation is invented: Pricing History marks such a record
  *Accessories not separable* and reports its bolt price as unknown —

```php
$separated = ($item['pricingModel'] ?? '') === 'bolt-separate';
if ($separated) { $bolt = $unit; $aCost = $item['accessoryUnitPrice']; }
else {
    $ambiguous = $hasAcc && $mode === '';
    if      (!$hasAcc)           $bolt = $unit;
    elseif  ($mode === 'manual') $bolt = $unit;
    elseif  ($mode !== '')       $bolt = round($unit - $aCost, 4);
    else                         $bolt = null;
}
```

* The one legacy case that needs handling is a *Manual Price*, which used to be
  the whole line. Opening such an item for editing moves the accessory charge
  out of the typed figure, charges it beside the item, leaves the line total
  exactly as it was, and says so on screen. Asserted end to end: RM307.00 for
  ten comes back as RM30.00 + RM0.70 = RM307.00.
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

0. **The entry form's own history panel is not ranked by dimension.** It sends
   no `dimensionPreview` (`phFormSpec` leaves it empty), so neither the server
   nor the screen can tell which historical rod is nearest, and its list stays
   in the order the server returned — this customer first, newest first. A Quick
   Add row knows its own geometry and ranks by it. Both screens match on the
   same identity and return the same records; only the ordering differs. Left
   alone deliberately in this pass, because changing it changes what the
   Calculator shows, and the brief asked for the Calculator to be unchanged. It
   is asserted, so the day the form learns its dimensions the test says so.


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

3. **An item priced manually before this pass, with accessories.** Its typed
   figure was the whole line. It is shown exactly as saved, and it is only when
   somebody opens it for editing that the accessory charge is moved out of the
   manual price — line total unchanged, with a message saying so. Worth opening
   one such item on the live system after deployment to confirm.

4. **Line endings.** `index.php` and `api.php` were converted from CRLF to LF
   during pass 2 and converted back in a commit of their own, so the files match
   the repository's original convention. That restoring commit touches every line
   of both files and changes nothing else — review the commit before it for
   content.

5. **The test tree is not deployed and must not be.** `tests/` and
   `quotation-dnc-final/` are outside `.cpanel.yml`'s allowlist by construction.

6. **`auth.php` is one shared account.** An audit trail can record what changed
   and when, but not who.

---

## Business input still needed

Set out in full, with options and consequences, in
**`remaining-business-decisions.md`**. In brief:

1. **The 4140 QT dead lookup** — leave it, delete it, or repair it (and accept
   that a material change would then overwrite a typed rate). *BLOCKED.*
2. ~~Should the printed quotation line include accessories?~~ **Answered by you,
   and done in this pass** — the item's price is the item's, accessories are
   charged beside it, the line total is unchanged.
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
quotation-dnc-final/
├─ final-report.md                  this file
├─ pricing-engine-v2-plan.md        the V2 design, ten sections
├─ pricing-engine-v2-input.xlsx     the blank workbook for the business
├─ remaining-business-decisions.md  what only you can decide
├─ changed-files-summary.txt        every file changed, and why
├─ commit-info.txt                  branch, SHAs, deployment status
├─ test-results/                    raw suite output and PHP lint
└─ screenshots/                     eight frames, one per category
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
