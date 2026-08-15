# QUOTATION.DNC — full audit and repair

Whole-chain audit of WhatsApp Quick Add and quotation item handling: source →
extraction → parser → canonical item → UI → manual correction → Diameter
Settings → unit weight → total weight → pricing → previous price → save →
reload → customer output.

---

## A. Baseline

| | |
|---|---|
| Starting commit | `b5493089057277c6f7742931da26bc6f35553abd` |
| Branch | `claude/quotation-dnc-audit-repair-ashi82` |
| Ending commit | `744ad4084167bf3e0638535779b798b5023c0030` |
| Files changed | `index.php`, `ai_extract.php`, `companies.php`, plus a new `tests/` tree |
| Deployment status | **NOT DEPLOYED** — see section H |

Nothing was deployed. `.cpanel.yml` is a manual two-click deploy from cPanel and
its APPFILES allowlist does not include `tests/`, so the new test tree is not
shipped to the server even when the deploy is run.

### Method

There were no tests in the repository at the baseline — the "25 suites / 1819
assertions" of the previous report were run in-session and never committed. The
first thing this pass built was a harness that keeps them:

`tests/lib/harness.js` strips the single line of PHP from the top of
`index.php`, serves the rest over `http://` so `localStorage` behaves as it does
live, answers `api.php` from a table each test controls, and drives the page in
Chromium. Nothing is re-implemented or re-exported. That distinction is the
whole point of this audit: a parser test can prove the parser returns `M27`;
only a browser test can prove that typing `27` makes the row weigh what an M27
weighs.

A parallel read-only audit ran over five areas — weight, pricing, previous
price, save/reload/output, and the correction panels — and every claim it made
was then handed to an independent skeptic told to refute it. **56 claims were
verified; 42 were refuted** — stale line numbers, guards the auditor had
missed, branches that do not apply. The 14 that survived are the ones acted on
here, each reproduced in the browser before anything was touched. Nothing in
this report is a finding that was reported but not independently confirmed.

---

## B. Audit matrix

`PASS` = already correct at `b549308`, left alone. `FIXED` = reproduced as
broken, repaired, covered by a test. `DEFERRED` = real, deliberately not
changed, reason given.

| § | Requirement | Before | Outcome |
|---|---|---|---|
| 3 | Size normalisation triggers live weight recalculation | **PARTIAL** | **FIXED** — the recalculation chain already worked; the size box did not show the value the row held |
| 4 | Metric M-prefix is mandatory in the model *and* on screen | **FAIL** | **FIXED** |
| 5 | Imperial positional parsing `[SIZE] x [LENGTH] x [THREAD]` | **FAIL** | **FIXED** |
| 6 | Imperial thread standards (UNC/UNF/BSW) do not steal the diameter | PASS | PASS + tests |
| 7 | Engineering-drawing dimension ownership | **FAIL** (prompt) | **FIXED** (prompt + tests) |
| 8 | Drawing region isolation | **FAIL** (prompt) | **FIXED** (prompt + tests) |
| 9 | Dense table / merged cells — "Could not analyze this file" | **FAIL** | **FIXED** |
| 10 | Dense-table resilience, one bad row | PASS | PASS + tests |
| 11 | Table columns outrank the description | NOT COVERED | **FIXED** (prompt + tests) |
| 12 | Size Type is never guessed; scoped notes stay scoped | PASS | PASS + tests |
| 13 | Unknown metric sizes preserved, warned, never weighed | PASS | PASS + tests |
| 14 | Weight audit — every path that determines weight | **PARTIAL** | **FIXED** (5 defects) |
| 15 | Total weight = unit weight × qty, no stale weight | **PARTIAL** | **FIXED** |
| 16 | No diameter → no weight → no price → no bare Additional Cost | **PARTIAL** | **FIXED** (3 further holes closed) |
| 17 | Pricing stale-state protection | **FAIL** | **FIXED** (6 defects) |
| 18 | Wrong price is worse than missing price | **PARTIAL** | **FIXED** |
| 19 | "Previous / Last Price", not "Suggest Price" | PASS | PASS — no "suggest" wording exists anywhere |
| 20 | Same customer + exact specification first | PASS | PASS + tests |
| 21 | Exact means exact — no nearby size | PASS | PASS + tests |
| 22 | Qty never part of matching | PASS | PASS + tests |
| 23 | Exact-spec fields | **PARTIAL** | **FIXED** — an unstated finish/size type meant "any" to the server |
| 24 | Customer fallback to another customer's exact spec | **FAIL** (absent) | **FIXED** |
| 25 | Customers' pricing structures are never merged | PASS | PASS + tests |
| 26 | No match → "No previous price found" | **PARTIAL** | **FIXED** — wording, and a failed lookup no longer reads as "none", in Quick Add *and* in the Check Previous Prices panel |
| 27 | Historical auditability | **PARTIAL** | **FIXED** — the other-customer case names the customer |
| 28 | A manual price is not overwritten by history | PASS | PASS + tests |
| 29 | Common Fields — a blank never clears a row value | **PARTIAL** | **FIXED** (accessories, price mode) |
| 30 | Correct Items panel behaviours preserved | PASS | PASS + tests |
| 31 | Item isolation | **FAIL** | **FIXED** (4 leaks) |
| 32 | Product classification, five-product enum | PASS | PASS + tests |
| 33 | Bend/H/W/S/TL ownership | **FAIL** | **FIXED** — labelled dimensions were reading backwards |
| 34 | Additional Info override precedence | PASS | PASS (unchanged) |
| 35 | Accessories never added automatically | PASS | PASS — and now charged where they are promised |
| 36 | Warning lifecycle | **FAIL** | **FIXED** (5 stale warnings, plus a size type we chose that never said so) |
| 37 | Compact vs Expanded consistency | **FAIL** | **FIXED** |
| 38 | Manual-edit event audit — no reliance on Enter | **PARTIAL** | **FIXED** |
| 39 | Canonical model consistency | **FAIL** | **FIXED** |
| 40 | Save / reload / edit / save without drift | **PARTIAL** | **FIXED** (3 defects) |
| 41 | Copy quotation | **FAIL** | **FIXED** — a duplicate carried the original's date |
| 42 | Customer-facing output | **PARTIAL** | **FIXED** (3 defects) |
| 43 | Image/PDF failure causes distinguishable | **FAIL** | **FIXED** |
| 44 | Large-response resilience | **FAIL** | **FIXED** |
| 45 | Metric + imperial in one document | PASS | PASS + tests |
| 46 | Mixed products in one document | PASS | PASS + tests |
| 47 | Regression preservation from the previous commits | — | verified, 37 assertions |
| 48 | Tests must test user-visible reality | — | 10 browser suites, 617 assertions |
| 49 | Mandatory regression cases | — | all present |
| 50 | Full pricing audit | — | done, section C |
| 51 | Previous Price naming / UI | **PARTIAL** | **FIXED** |
| 52 | Performance | **PARTIAL** | **FIXED** — history lookups are cached per specification |
| 53 | Database safety | — | **no schema change** |
| 54 | Security / configuration | — | untouched; no secret is in the repository or this package |
| 55 | Deployment verification | — | **NOT DEPLOYED**, section H |
| 4140 rates | 4140 QT rate/diameter table unreachable | **FAIL** | **DEFERRED** — section G, needs a business decision |

---

## C. Root causes

Symptoms are cheap; these are the mechanisms.

### C1. The imperial size was consumed by the thread reader (§5)

`wqaInchScan` requires an inch mark, so `1/2 x 100 x 100/100` produced no inch
token at all. The line then reached the two-end thread reader — whose pattern is
literally *number slash number* — and `1/2` matched it. Size came back blank,
Thread came back as `1` and `2`, and `1 x 100 x 100` shifted every field left
until Length held `1`.

The fix is positional, not a list of fractions: in a dimension run with no
metric size stated, the token at the head of the run is a candidate **Size**
before it is anything else. A fraction there is always a size, because a thread
is a length in millimetres and nothing is threaded "1/2". A whole number is
genuinely ambiguous (`1000 x 100` is a length and a thread), so it is read as
inches only for a size the diameter table holds and only when two more numbers
follow. An unrecognised fraction — `9/16` — is still read as the Size and
flagged `Needs Valid Size`, because a size we cannot weigh is a visible question
and a mis-assigned thread is a silent wrong answer.

### C2. The size box and the row disagreed (§3, §4, §37, §39)

`wqaEdit` normalised into the model on every keystroke, so the row genuinely
held `M27` and the weight, total weight and price all recalculated live — that
part was already right. What never happened was writing the value back into the
box: the compact line read `M27` while the field under it still read `27`, for
the rest of the session.

Writing it back on every keystroke breaks imperial entry (`1` becomes `M1`, then
`M1/2`), which is exactly what the main entry form did and why a half-inch rod
could not be typed into it at all. So the M is written when the text can no
longer become anything else — an M and digits, or two or more digits, since no
inch size is written `27` — and anything shorter is normalised when the box is
committed. Committed means blur, Enter, or moving to another field; not Enter
alone.

### C3. Labelled dimensions read backwards (§33)

`ID`, `S`, `H` each matched *label-then-number* **or** *number-then-label* in one
alternation, and a regex alternation takes whichever starts further left. On
`M20 OVERALL LENGTH 480 ID 100 BEND HIGH 120`, `ID` matched "480 ID" — a number
already claimed by OVERALL LENGTH — and everything shifted: ID took 480, the
hook height took the 100 meant for ID, and the overall height took the 120 meant
for the hook. Three wrong dimensions, a wrong developed length, a wrong weight
and a wrong price, from a line that said exactly what it meant. A label now
reaches forward first and only looks back when nothing follows it.

### C4. Thread evidence outlived its section (§46, §47)

A product heading closed the section above it for the purposes of row lookback,
but the running thread-end evidence was not part of that. "BOTH END THREAD 75"
under a Sag Rod heading was still in force three headings later, stamping
`threadEnds: 2` onto every Stud — each one then flagged as contradicting itself
and blocked from the quotation. A heading now closes its section's thread as
well as its rows.

### C5. The 4096-token ceiling, not the table (§9, §43, §44)

`max_output_tokens` was 4096 and the model is a reasoning model, so that ceiling
covers the reasoning as well as the answer. The strict schema requires all
seventeen keys on every item — roughly 80 tokens a row — and on a dense
merged-cell table the reasoning alone can spend the whole budget. The response
came back `status: incomplete` with the JSON cut off mid-row, `json_decode`
returned null, and the endpoint reported it as though the document were
unreadable. Three separate causes — a refusal, a cut-off answer, and genuinely
malformed output — all arrived as one sentence.

### C6. A default price outlived the item it was for (§17)

`applyDefaultPrice` refilled a rate only when the box was **empty**, so a rate
the rules themselves had written a keystroke earlier blocked the rule for the
new size. An M16 stud at 5.00 stayed at 5.00 when it became an M20 the rules
price at 7.50 — with the green "Default price applied" badge lit over it. Two
kinds of value were being treated as one. A value the person typed is theirs
(`isUserPriced`) and is never touched; a value the rules wrote is ours and does
not outlive the identity it was written for.

### C7. Undersize fell through to the fullsize inch table (§14, §16)

`autoFillDiameter` looked up `DIA_UNDERSIZE_INCH[size]`, and where that missed it
fell through to `wqaImperialDia` — which is the **fullsize** inch table. An
undersized `1/2"` rod came back at 12.7mm instead of 10.9mm: 36% too heavy, and
priced on it. Undersize is a different bar, not a differently-spelled one.

### C8. One form, many rows (§31)

Quick Add prices every row by writing it into the real product form and reading
the real calculator back — deliberately, so there is no second pricing engine.
The consequence is that anything the previous row left in a box is the next
row's starting point. The cost rate and additional cost were re-derived per row;
the **markup** was not, so typing 15 into row 2 priced rows 3, 4 and 5 at 15%
they were never given. The same mechanism left a stranger's size and rate in the
entry form after Quick Add closed, one Enter away from being added.

### C9. The guard was defeated three lines before it ran

Reopening a U-Bolt for edit re-derived its Total Length over the hand-measured
one: a rod entered at 250mm came back as the auto-derived 168, re-saved 28%
lighter and cheaper. The obvious fix — pass `skipAuto` on the restore path — was
not enough, because `onPriceModeChange` and `applyDefaultPrice` each call
`recalcCurrent()` on their own account and both run *before* the guarded call.
The hand-entered value was already gone by the time the guard executed. It is a
flag held for the whole restore now, so no route on that path can re-derive.

### C10. A size type we chose, presented as the customer's

`wqaDefaultSizeType` applies Undersize to a mild-steel M12 the customer never
mentioned. That moves the diameter from 12mm to 10.6mm — about 22% of the
weight and the price. The row recorded that the value was ours (`stDefaulted`)
and the code comment reads "Ours, not the customer's — and said so"; nothing
anywhere read the flag, so the select simply said "Undersize" with nothing to
question. It says so now, and stops saying so once a person chooses.

---

## D. Changes made

### `index.php`

| Area | Change |
|---|---|
| `wqaExtractFields` | Head-of-run imperial size reader (C1) |
| `wqaEditSize`, `WQA_SIZE_SETTLED_RE`, `wqaSizeWriteBack` | Size box shows what the row holds (C2) |
| `onSizeInput` / `onSizeCommit` / `onStudSizeInput` / `onStudSizeCommit` | Same rule on the entry forms; a typed `1/2` is no longer mangled into `M1/2` |
| `normalizeSizeValue` | `1/2"` and `1/2` are one canonical size |
| `wqaInchKey` / `wqaImperialDia` | One inch reader for every table (mark or thread standard tolerated) |
| `autoFillDiameter` | Undersize never borrows the fullsize inch diameter (C7); a size with no diameter clears the box |
| `sizeDisplay` / `formatSizeLabel` | An imperial size carries its inch mark on the customer's page, as a length carries `mm` |
| `WQA_DIM_RE`, `WQA_TL_DIM_RE`, `wqaDimLabelled` | Labels reach forward before backward (C3) |
| `wqaParseText` heading branch | A heading closes its section's thread evidence (C4) |
| `wqaNormM` | Extracted sizes canonicalise through the same normaliser as typed ones |
| `applyDefaultPrice`, `dpAutoFilled`, `dpIdentityKey` | Rates follow the item's identity (C6); the badge tells the truth |
| `onMaterialSizeChange` | A material change clears the previous material's rate for every product, not only Sag Rod |
| `addSagRod` / `addStud` / `addAnchorBolt` | A blank Cost Rate is refused; the Additional Cost can no longer stand alone |
| `calcSagRod` / `addSagRod` | The fixed price-list entry survives a change of rounding mode |
| `calcOthers` / `addOthers` | Two decimals, so printed unit × qty equals the printed total |
| `calcPlate` / `addPlate` | Plate accessories are charged, not only printed |
| `getAddCostFromTL` | The 120/121 interval hole closed |
| `evalExpr`, `isReadableAmount`, `validatePriceMode` | `1,200` is twelve hundred; `2,80` is refused rather than read as 2 |
| `get4140Rates` | Table keys match a whole size, not a prefix of one |
| `calcUBolt/SQUBolt/LBolt/JBolt` | The preview weighs the length the Add will weigh |
| `recalcCurrent(skipAuto)`, `fillItemFormFromItem`, `restoreProductEntryDraft` | Reopening an item no longer overwrites its stored Total Length |
| `onWASAnchorSpecChange` / `onWASAnchorSizeInput` | The Welding Anchor Set's anchor diameter follows its size |
| `addWAS` | Dimensions validated; a negative thickness can no longer reduce the price |
| `resetPriceModeAfterAdd` / `resetAllPriceModes` | A manual price belongs to the item it was typed for |
| `wqaSnapshotForms` / `wqaRestoreForms` | Quick Add borrows the entry forms and puts them back (C8) |
| `wqaApplyRowToForm` | Markup no longer travels between rows (C8) |
| `wqaRecomputeAll` | No product, no dimension, no zero-length row is ever priced |
| `wqaRowMissing` | A dimension must be present **and** positive |
| `updatePreview` | No weight, no price on the calculation card either |
| `wqaHistSpec` / `wqaHistFetch` / `wqaLoadHistory` | Customer-first lookup with an exact-spec fallback, cached per specification; an incomplete specification is not looked up; a failed lookup is not "none" |
| Row history block | "Last Price" vs "Reference Price", the source named, "No previous price found" |
| `computeStats` | One rule for Last, Low, High and Avg |
| `checkPreviousPrice`, `resetPriceHistoryPanel` callers | The panel belongs to one specification and is cleared when it changes |
| `wqaApplyAccToAll` / `wqaClearAllAcc` / `wqaApplyPriceToAll` / `wqaSetCommon` | Scope-correct; an untouched panel changes nothing |
| `wqaRowSpecText` / `wqaPatchRows` | The row's spec line is refreshed with the row |
| `wqaEdit` / `wqaEditSize` / `wqaEditRowProduct` / `wqaApplyFixToAll` | A warning goes when the thing it named is answered |
| `wqaClearCommonPanels` | A queued correction belongs to the message it was queued for, including Back → Parse |
| `formRestoreInProgress`, `fillItemFormFromItem`, `restoreProductEntryDraft` | No route on the restore path re-derives over a stored Total Length (C9) |
| `onStudSizeInput` / `onStudSizeCommit` | The Stud size box clears the previous-price panel, as every other product's does |
| `fetchPriceHistory` / `checkPreviousPrice` | A lookup that could not run says so instead of "no matching saved quotations" |
| `wqaRowBadges`, `wqaEditRowSpec` | A size type applied by our own rule says it was ours (C10) |
| `wqaDropNoteCredit` | "From your note: TL" stops being claimed once that value has been retyped |
| `wqaAddAll` | Quick Add appends; it no longer replaces the item under edit |
| `buildUnsavedDraft` / `restoreUnsavedDraft` | A recovered draft remembers it was editing an item |
| `buildWAItemsText` | Two rods that differ only by a custom dimension are two lines, and the annotation is shown |
| Item card | "Unit Weight … kg/pc" plus a line total, instead of an ambiguous "Weight" |

### `ai_extract.php`

* `AI_MAX_OUTPUT_TOKENS = 32000` — room for `AI_MAX_ITEMS` rows plus the
  reasoning that reads them (C5). A ceiling, not a spend.
* `ai_salvage_extraction` — recovers the whole item objects from a cut-off
  answer; the row the cut landed in is discarded, never half-read.
* `ai_incomplete_reason`, `ai_output_refusal`, `ai_sanitise_data` — the three
  model-side failures are told apart and reported by name, and a timeout is
  distinguished from an unreachable host.
* `truncated` flag returned to the browser and shown above the rows.
* Instructions: **EACH DRAWING OWNS ITS OWN DIMENSIONS**, **WHICH DIMENSION IS
  THE OVERALL LENGTH** (spanning dimension first, then segment arithmetic;
  `200/200` is a thread and never a length), **A SHARED VALUE REACHES ONLY THE
  ROWS IT COVERS**, **STRUCTURED COLUMNS OUTRANK THE DESCRIPTION**, and an
  explicit rule that `unclear` is only for something illegible inside this
  part's own region — never for a choice between this part's dimension and a
  neighbour's.

### `companies.php`

* A duplicated quotation is dated today and its validity window is not
  inherited.

### `tests/` (new, not deployed)

`tests/run.js`, `tests/lib/{harness,assert}.js`, ten browser suites, one PHP
suite, and `tests/screenshots.js`.

---

## E. Regression test results

```
  ok    size normalisation — model, screen and weight agree            (42)
  ok    imperial — the first token of a run is the size                (66)
  ok    weight — every product, every input that moves it              (39)
  ok    pricing — nothing stale, nothing fabricated                    (41)
  ok    previous price — this customer first, then a reference         (50)
  ok    mixed documents — a heading speaks only for its own rows       (37)
  ok    save / reload / output — no value drift, no internal costs     (65)
  ok    common fields and Correct Items — a blank never clears         (61)
  ok    dense table — 29 rows, merged cells, metric beside imperial   (168)
  ok    engineering drawing — five parts, five lengths                 (48)

  10 suites, 617 assertions, 0 failed

  ok    ai_extract — dense tables, truncation and error causes         (64)
```

**681 assertions, 0 failed.** Raw output in `test-results/`.

Weight was audited rather than inspected: every expected value in
`03-weight.test.js` is computed in the test from π/4 · d² · L · 7.85e-6 with the
developed length worked out by hand per geometry, and the shared constant
`0.0000061654` is itself asserted to be π/4 · 7.85e-6. The formulas were not
changed. Neither were the developed-length geometries, special pricing, the
extraction schema, quotation numbering, authentication or the deploy
configuration.

The previous commits' behaviours are re-asserted in `06-mixed-documents.test.js`
(37 assertions): scoped `M20 / M24 UNDER SIZE`, `R25 BEND` as a radius,
`SAG ROD ONE END THREAD` resolving on thread evidence, Studs not judged by a Sag
Rod heading, per-row material and finish, the five-product enum. No corpus drift.

---

## F. Manual browser verification

Six screenshots, one per category, in `screenshots/`. Several cases share a
frame where they can be read together.

| Screenshot | What it shows |
|---|---|
| `1-metric-manual-size-edit` | Message says M23. `27` typed into the size box, no Enter, no blur: box **M27**, compact line **M27**, Unit Weight **4.4946 kg/pc**, Total Weight **4.4946 × 5 = 22.4729 kg**, price RM 13.18 |
| `2-imperial-parsing` | `1/2`, `5/16`, `3/8`, `7/8`, `1"` and `M20` from one message — each with its own Length 100, Thread 100/100 or 100, and a weight on its own diameter (0.0994 / 0.0388 / 0.0559 / 0.3045 kg/pc) |
| `3-engineering-drawing` | Five M30 parts at L950, L865, L1000, L1200, L1285, all threaded 200/200, no "Check length" on any of them |
| `4-dense-table` | 29 anchor-bolt rows, metric and imperial, TL 150 on rows 1–18 and TL 300 from row 19 |
| `5-previous-price` | M20: "Same customer · exact specification — Last Price RM 12.50" beside M24: "Other customer · exact specification — Reference Price RM 21.00 · Gamma Steel" |
| `6-save-reload-output` | A saved quotation reopened, with its WhatsApp text, printed dimensions and unit weights: `M20 x L 1000` and `1/2" x L 300` |

Also exercised interactively while building the suites: metric WhatsApp text,
imperial WhatsApp text, mixed metric/imperial, an invalid M size corrected by
hand, the no-previous-price case, and save → reopen → edit → save.

---

## G. Remaining known limitations

1. **4140 QT rates and diameters are unreachable, and Diameter Settings
   advertises them anyway. DEFERRED — this needs your decision, not mine.**
   `RATES_4140` is keyed `'4140 UNDERSIZE SAG ROD'` while `buildDesc` now emits
   `'4140 QT UNDERSIZE SAG ROD'`, so `get4140Rates` has returned `null` for some
   time. Two consequences: a 4140 sag rod gets no automatic cost rate, and
   Diameter Settings → System Defaults lists **4140 / UNDERSIZE / M12 / 10.7mm**
   while the calculator uses `DIA_UNDERSIZE.M12` = **10.6mm**. The screen states
   a diameter that is not in force.
   The fix is one line (match on the material code rather than its label), but
   it *changes prices*: undersize 4140 M12 would weigh 1.9% more, and cost rates
   of 8.50/6.50 (fullsize) and 9.50/8.00 (undersize) would begin auto-filling
   where staff currently type their own. I have not made a pricing change on my
   own inference of intent. Tell me which is authoritative — the table or the
   current behaviour — and it is a small change either way.

2. **WhatsApp row numbers do not match the on-screen item numbers.** The message
   groups items by material/finish/product, so item 2 on screen can be row 3 in
   the message. No value is wrong; a customer saying "increase item 2" and a
   staff member reading item 2 may be discussing different products. Left as-is:
   changing it changes every customer message.

3. **`wqaChangeProduct` re-parses and discards row edits.** Changing the product
   in the Quick Add header re-reads the original text and replaces every row,
   losing corrections made since. It also ignores the Selected-Items scope. A
   confirmation before discarding would be the right fix; it needs a UI decision.

4. **A row with no Size Type is weighed provisionally as Fullsize** while
   showing "Needs Size Type". The row cannot be added, so nothing reaches a
   customer, but the number beside the question is a provisional answer to it
   and does not say so. Where the size type was applied by *our* rule rather
   than left blank, the row now says so — that half is fixed.

5. **`get_price_history` reads the newest 300 quotations** and filters in PHP. An
   item last quoted beyond that window reports "No previous price found". Server
   change, no schema change; not attempted here.

6. **Accessories are not part of the previous-price match.** A record whose price
   included two nuts and a washer is offered as the exact previous price for a
   bare rod. The provenance line shows the reference and date, but not the
   accessories.

7. **`companies.php` renders `item.desc` raw**, so a legacy item can show
   `4140_HARDEN_G10_9` in the staff Quotation Detail modal where the printed
   quotation reads `4140 QT + HARDEN = G10.9`. Staff-facing only.

8. **The "Previous Quoted Prices" panel mixes every dimension** for the matched
   specification and shows an average (Last / Low / High / Avg / Records). A
   750mm rod at RM 9.80 and a 3000mm rod at RM 39.00 are reported together
   while quoting a 500mm rod, with nothing on the panel naming the lengths. It
   is an explicitly-invoked statistics view, not the Last Price feature — the
   Quick Add row *does* separate exact dimensions from "same specification,
   different dimensions" — but §19 and §26 read strictly would remove the Avg
   tile and label the spread. Say the word.

9. **The drawing-region and merged-cell rules are prompt-level.** Their presence
   is asserted; how well a given model follows them on a given sheet can only be
   confirmed against the live service, which this environment has no key for.
   Everything downstream of the model's answer *is* asserted end to end.

10. **Imperial canonical form.** `1/2"` normalises to `1/2` and `1"` stays `1"` —
    the vocabulary the diameter tables, Diameter Settings rules and saved
    quotations already use. Changing the stored form would silently break
    exact previous-price matching against existing history. The inch mark is
    added at the display layer, exactly as `mm` is added to a length, so the
    customer reads `1/2"` while the app matches on `1/2`.

---

## H. Deployment

**NOT DEPLOYED.**

Deployment is manual: cPanel → Git Version Control → *Update from Remote*, then
*Deploy HEAD Commit*. Nothing in this environment can press those buttons, and
no post-receive hook exists.

**Deploy `744ad4084167bf3e0638535779b798b5023c0030`** on branch
`claude/quotation-dnc-audit-repair-ashi82`.

The `.cpanel.yml` allowlist copies only `index.php api.php companies.php
ai_extract.php auth.php login.php logout.php manifest.webmanifest
ai_config.sample.php db.sample.php` and `assets/icons/`. Of those, this pass
changed **`index.php`, `ai_extract.php` and `companies.php`**. The new `tests/`
tree and this `audit-out/` package are not in the allowlist and are not
deployed. `ai_config.php` and `db.php` remain server-only and untouched.

After deploying, the live version can be confirmed against
`git rev-parse --short HEAD` in the cPanel deployment log.

Until that is done, the live site is still running `b549308` and every defect in
section C is still in front of staff.
