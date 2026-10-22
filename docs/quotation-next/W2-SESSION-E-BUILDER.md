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
  dates.ts          day-first DD-MM-YYYY ⇄ ISO (never month-first)
  draft-storage.ts  local draft per named user: dnc-quo:builder-draft:v1:<user>:new
  use-builder.ts    reducer + autosave + explicit recovery + leave protection
resources/js/components/builder/  presentation
  combobox.tsx       searchable combobox (no native <datalist>), free text always allowed
  fields.tsx         compact field / select / segmented / headings
  item-fields.tsx    shared sections: identity · size & dimensions · accessories · pricing · preview
  item-editor.tsx    Manual Add / Edit (side sheet; full screen on a phone)
  quick-add.tsx      Quick Add (group first, rows second)
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
