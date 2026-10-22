# QUOTATION NEXT — WAVE 2 · SESSION E — QUOTATION BUILDER

| | |
|---|---|
| Branch | `session/e-quotation-builder` |
| Base | W1 accepted `42824ab670538716777ac996ad37b57497ac44ec` (W1 CLOSED / OWNER VISUAL ACCEPTED) |
| Deployed | Preview only — owner-authorised standalone Session E preview for Owner Smoke #2 (exception to §32's E · F · G · H → integration order) |
| Production | untouched; no schema change; no write path |

## Architecture

```
resources/js/builder/            framework-free logic (no React)
  model.ts          ONE DraftItem / DraftQuotation model; emptyItem, duplicate, isMeaningful
  products.ts       per-product inputs in canonical DNC order (L / W / H / ID / IH / OH / S / TL …),
                    Quick Add product list, size suggestions from the built-in tables
  compute.ts        computeItem(): the domain engine wired to the typed values —
                    interpretSize → effectiveDiameter → computeGeometry → findDefaultPrice
                    (+ tlSurcharge) → priceItem → buildDimension; field-level errors / warnings
  quotation.ts      readQuotation(): every item computed once, summary, header validation
  quick-add-demo.ts fixed local demo extraction (NOT AI) for the Quick Add review preview
  dates.ts          day-first DD-MM-YYYY ⇄ ISO (never month-first)
  draft-storage.ts  local draft per named user: dnc-quo:builder-draft:v1:<user>:new
  use-builder.ts    reducer + autosave + explicit recovery + leave protection
resources/js/components/builder/  presentation
  combobox.tsx       searchable combobox (no native <datalist>), free text always allowed
  fields.tsx         compact field / select / segmented / headings
  item-fields.tsx    shared sections: identity · size & dimensions · accessories · pricing · preview
  item-editor.tsx    Manual Add / Edit (centred dialog; full screen on a phone); continuous entry
  batch-add.tsx      Batch Add (group first, rows second; 20–30 rows)
  quick-add.tsx      Quick Add (AI intake + review; analyzer = Session I; demo review fixture)
  task-dialog.tsx    shared centred task dialog / phone full-screen task
  customer-section.tsx  header: customer search / card, contact, phone, dates, Prepared By, remarks
  items-table.tsx    aligned item grid (same language as the W1 detail; .bd-* grid areas)
resources/js/pages/Quotations/Create.tsx   the Builder page (route quotations.create)
app/Http/Controllers/Builder/CustomerSearchController.php   GET /quotations/new/customers?q= (read only)
```

No business rule is re-implemented: diameter, developed length, weight, default
price, TL surcharge, price list, rounding, accessory-inclusive final price and
the manual / no-round modes all come from `@/domain`.

## Decisions (within locked rules)

- **One item model.** Quick Add and Manual Add both produce `DraftItem`; only
  `entryMode` differs (tested: a Quick Add row ≡ the Manual Add item, same price).
- **Quick Add (Session E)** = fast structured entry for known products
  (Sag Rod · Stud · Anchor Bolt · U-Bolt · SQ U-Bolt · L Bolt · J Bolt): the
  group fixes Product · Material · Harden/Class · Size Type · Finish ·
  accessories · pricing defaults; rows are Size · dimensions · Qty, each
  previewed live. The text / WhatsApp image / PDF analysis of handoff §25 is
  Wave 3 Session I.
- **Manual Add** covers every builder product incl. L Bolt 45° (manual
  developed length), J Hook (L + W offered as an editable suggestion, Apply),
  Eye Bolt (J Bolt geometry suggested when S is present; Weld/FW attribute),
  Plate (plate / triangle, holes) and Others (typed name, dimension text,
  optional unit weight).
- **Pricing suggestions follow the identity, typed values are never
  overwritten.** A blank Cost Rate / Additional Cost / Markup uses the built-in
  default (`findDefaultPrice`) — MS FULLSIZE Sag Rod PL 3.50 · ZP 5.00 · HDG 6.50
  (+1.60), MS UNDERSIZE legacy rates, 4140 QT table — with the Sag Rod TL
  Additional Cost (legacy rule: MS, not HDG). No default ⇒ the cost rate is
  required ("No default rate for this item"), never invented.
- **Price mode UI (§17):** "Calculated" by default; **Set manual price** is an
  explicit action that keeps the calculated reference visible; **No Round**
  only under Advanced. No mode dropdown.
- **Markup** shown internally (`⭐ +5%`, or `Manual`); never customer output.
- **Accessories (§18):** "No accessories" + Nut / Flat washer / Custom; Qty per
  item blank ⇒ default (2 / 1), explicit 0 stays 0 (engine `readAccessoryQty`).
- **Unknown sizes are not guessed:** a size the tables do not know (or a bare
  `72`) asks for review and a typed bar diameter; with a typed diameter it is
  priced and flagged "needs review".
- **Customer:** search of the existing read-only directory (name / phone /
  hidden legacy alias; the alias itself is never returned); a typed customer
  name is allowed (directory registration of a *new* company is Session F / G).
- **Dates:** DD-MM-YYYY (DD/MM/YYYY accepted). Valid Until is optional (the
  legacy app has no default to preserve).
- **Prepared By:** read-only preview of the signed-in named user; captured at
  first formal save (Session G).
- **Local draft (§7):** autosaved ~0.6 s after a meaningful edit, per named
  user, status "Kept on this device · HH:MM" (never "Saved"). A stored draft is
  **offered** on load (Continue draft / Discard, discard confirmed) and autosave
  is paused until the person chooses, so a recovered draft is never
  overwritten. Discard draft (confirmed) clears it.
- **Leave protection:** with meaningful entries, in-app navigation asks first
  and refresh / close gets the browser warning; nothing entered ⇒ no warning.
- **Saved-vs-unsaved lock:** Save quotation, Print, WhatsApp, Copy and Copy +
  Weight are visible but disabled ("After save"); "Check quotation" runs the
  full validation and says what blocks it.

## Deferred (not Session E)

| item | where |
|---|---|
| Formal save, Q-number allocation, Prepared By capture, revisions, saved-quotation working copy, conflict detection | Session G (write path) |
| Print / WhatsApp / Copy / Copy + Weight | Session H (output) |
| Smart Search, Price Lookup, previous / suggested pricing (§24, Apply), recent customers, New Company | Session F |
| Quick Add text / image / PDF analysis (§25) | Wave 3 Session I |
| Welding Anchor Set entry form (WAS label builder + priceWAS form) | not ported in Session E — existing WAS items stay readable in W1 detail; needs its own form (Session G/I scope decision) |
| Issued By issuer profile | Session G / H |
| Open engine gates unchanged: OG-1 (M12 UNDERSIZE 10.6), OG-B1 (J Hook / Eye Bolt rounding money2), OG-B2, DG-1, OG-2 | owner |
| Formal UOM field | Wave 2 data model / Builder follow-up (no UOM shown — `Qty 30`) |

## Owner Smoke #2 · Loop #1 — entry-mode semantics + pricing inputs (BLOCKER fixes)

Locked definitions (owner), now implemented:

| mode | what it is | Session E state |
|---|---|---|
| **Quick Add** | AI-assisted extraction from customer input: pasted / WhatsApp text, image / photo / screenshot, PDF → Analyze → review extracted items → fix uncertain fields → price → add confirmed items | intake (Paste Text · Upload Image / PDF), review architecture (`QuickAddAnalyzer`, `ExtractedItem` with `uncertain` fields, confirm / fix with the shared field sections). **The analyzer is Session I** — `quickAddAnalyzer = null`, Analyze is shown unavailable, nothing is analysed, parsed or sent; no fake results |
| **Manual Add** | one item keyed by hand: Product → Material → Treatment → Size Type → Finish → Size → Bar Ø → dimensions → Qty → Accessories → Pricing | unchanged flow, now a centred dialog |
| **Batch Add** | common fields once, several similar rows | the former grouped row form, renamed everywhere (was wrongly called Quick Add); `entryMode 'batch'` |

All three emit the same `DraftItem`. Entry: `?mode=quick|manual|batch`;
`?product=<key>` (frequent products) opens Manual Add on that product.

- **Presentation:** Quick / Manual / Batch / Edit open as a centred large
  dialog on desktop and tablet (≈ 880 px Manual, 1040 px Quick / Batch, ≤ 85vh,
  sticky header + footer, scrolling body); full-screen task with Back on phones.
  No right-side drawer.
- **Bar Ø:** always visible and editable. Blank = AUTO (the diameter master's
  suggestion, refreshed when Size / Material / Size Type change); typed =
  CUSTOM (decimals such as 10.7 allowed), drives weight / geometry / price,
  never overwritten; "Use suggested Ø…" shown when the suggestion differs.
- **Developed length (formula products):** the calculated value is in the
  field (AUTO, recalculated); a typed value is CUSTOM and drives weight / price,
  with "Calculated: 1063 mm · Use calculated". J Hook / Eye Bolt keep the
  editable suggestion with Apply (§19 / §20 — no hard formula); L Bolt 45° stays
  manual.
- **Qty defaults to 1** for every new item / Batch row (a default, not the
  customer's word); duplicate copies Qty; product changes keep it.
- **Pricing ladder:** Calculated unit (always computed and shown, also under
  an override) · Override unit (explicit "Override unit price") · Final unit.
  "Use calculated price" clears the override. No Round (Advanced) applies to
  the calculated price. Historical / customer price suggestions are Session F.
- **Local drafts** saved before this loop (v1) are carried forward (manual →
  override, quick rows → batch), never dropped.

## Owner Smoke #2 · Loop #2 — continuous entry, Batch efficiency, Quick Add demo review

Loop #1 semantics unchanged (Quick = AI extraction · Manual = one item ·
Batch = similar rows). No engine, schema, auth or write-path change.

- **Manual Add continuous entry.** Footer `Cancel · Add & another (primary) ·
  Add item`; Edit keeps `Cancel · Save item`. *Add & another* appends the item
  (always at the end, in entry order), keeps the dialog open on the next
  number and starts from `nextItemFrom(prev)`: keeps Product · Material ·
  Treatment · Property class · Size Type · Finish · plate type and the typed
  Cost rate / Additional cost / Markup; resets Size, Bar Ø custom, dimensions,
  developed-length custom, Qty → 1, override, No Round, accessories (none —
  conservative) and errors. Focus returns to Size on desktop / tablet (phone:
  scrolls there, no keyboard pop-up). Footer context `N items · RM x`.
- **Keyboard.** Enter = Add & another (Save on Edit) · Ctrl/⌘+Enter = Add
  and close · Esc = Cancel. Ignored: held (repeat) Enter, IME composition,
  Enter that picks a combobox option or lands on an open suggestion list
  (it only closes the list), selects, buttons, checkboxes, textareas. An
  invalid item runs normal validation and adds nothing. Muted `<kbd>` hints
  on ≥ 640 px only (⌘ on Mac); none on phones.
- **Toast.** `Item #7 added to quotation` / `M12 × L1070 × TL100/100 · Qty 1
  · RM 2.78`, 3 s, one id (rapid adds replace instead of stacking). Phone
  toasts clear the task footer (TaskDialog publishes `--task-footer-h`).
- **Batch Add (20–30 rows).** Rows scroll inside the dialog; each row shows
  weight · unit · line total. Enter moves to the next cell (Qty → next row's
  Size, a new row after the last) and never submits; Ctrl/⌘+Enter adds all.
  `+ Row` keeps focus on itself (so repeated clicks are never covered by the
  new row's size list). Footer `20 valid rows · Total RM…` / `Add 20 items`;
  with a problem `19 ready · 1 needs attention` and the add is blocked
  (`aria-disabled`; a click only reveals the cells to fix). Blank rows ignored.
- **Pricing de-duplication.** The ladder (Calculated / Override / Final +
  Override / Use calculated) is the only place prices appear; the preview now
  shows supporting values only — Dimension, Bar Ø, Developed length (when
  any), Weight, Accessories / pc (when > 0), Line total. On a phone the ladder
  is a compact label-left / value-right list; Advanced stays collapsed.
- **Quick Add demo review.** The real **Analyze** stays disabled
  (`quickAddAnalyzer = null`). A separate **View demo analysis** opens the
  review on `demoExtraction()` — fixed, local, input ignored, no network /
  upload / storage — under a persistent banner *Demo extracted items — not
  real AI output*. Item A (MS UNDERSIZE ZP Sag Rod M12 · Bar Ø 10.7 · L1245
  · TL100 · Qty 30) is **Ready**; item B (4140 QT FULLSIZE PL L Bolt M16 ·
  Bar Ø 17 · L900 · W70 · TL150 · Qty 20, uncertain finish + cost rate) is
  **Needs review**. Each row: number, identity, Size, Bar Ø, Dims, Qty, total,
  status. **Edit / Fix** opens the shared `ItemEditor`; saving clears the
  uncertainty. Summary `2 items · 1 needs review`; `Add confirmed items` is
  blocked until nothing needs review. Added items are normal `DraftItem`s
  (`entryMode 'quick'`). The same review UI serves the Session I analyzer.

