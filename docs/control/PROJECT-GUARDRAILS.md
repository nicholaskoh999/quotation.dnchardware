# PROJECT GUARDRAILS

Protected accepted behaviour for **quotation.dnchardware**.

> **Status of this file.** `docs/control/` did not exist in the repository when
> UI POLISH 1 began. This file was written during that round from the round
> brief and from the application source as it actually stands, so that later
> rounds have something authoritative to read. It describes the application
> that is in Git — not a target design.

Anything listed here is accepted and may not be changed by a UI or polish
round. A change to any of it needs its own round, its own scope entry and its
own sign-off.

---

## 1. Calculation and pricing

Protected in full. No polish round may touch:

- the WhatsApp Quick Add text parser (`wqaParseText`, `wqaParseLine`,
  `wqaExtractFields`, `wqaResolveLine`, `wqaPlaceProductDims`)
- AI extraction and its shared schema (`ai_extract.php`, `WQA_PRODUCTS` tokens)
- weight formulas and diameter tables (`DIA_FULLSIZE`, `wqaImperialDia`)
- price computation, Price Mode (`auto` / `no_round` / `manual`) and rounding
- Size Type rules (`dcProductHasSizeType`, `wqaDefaultSizeType`)
- material and finish mapping (`WQA_MATERIALS`, `WQA_FINISHES`,
  `dcMaterialHasFinish`, `dcFinishFor`)
- quantity rules
- previous-price matching and the identity a match is made on
  (`wqaExpectedDimPreview`, `get_price_history`, same-customer scoping)
- the add-to-quotation path (`wqaAddAll` → `switchType` → `addCurrentItem`)
- everything in `api.php`, `auth.php` and the database layer

## 2. Quick Add workflow

- Step 1 offers **Paste WhatsApp Text** or **Upload Photo / PDF**; the modal
  opens on paste.
- Step 2 is the review. It is reached only through `wqaParseAndReview` or
  `wqaAiExtract`, and every row keeps the raw line it came from.
- **Apply scope** is one shared setting (`wqa.applyScope`) with two values,
  `all` and `selected`. Every copy-once panel writes through it.
- Selecting rows is explicit: tick boxes appear only while the scope is
  `Selected Items`, and leaving that scope clears the ticks rather than keeping
  a hidden selection.
- An Apply with zero rows selected is **refused** with a toast; it never
  silently falls back to All.
- The copy-once panels copy **once**. Nothing is linked: after an Apply, every
  row stays independently editable, and editing a panel again does nothing
  until Apply is pressed again.
- A blank field in a copy-once panel is not an instruction to clear.
- Bulk correction starts every field at *Keep existing*; a field left there is
  not read. *Fill blanks only* fills empty values and never replaces one.
- Compact / Expanded is a **view**, not a mode: Expanded opens every row,
  Compact closes them, and no data changes either way.
- The customer's own message is shown beside the parsed rows for a pasted
  source, and never for a file source (a filename is not a transcript).
- `Add N Items to Quotation` is disabled while any row is blocked.

## 3. Products

Sag Rod, Stud, Anchor Bolt, U-Bolt, Square U-Bolt, L Bolt, J Bolt, Plate,
Washer and Others keep their own dimensions, their own calculator and their own
thread-end count. Quick Add reads a row and hands it to the calculator that
owns it. There is no second pricing engine.

## 4. Language

EN / 中文 is a runtime switch (`dcSetLang`, `dcT`, `data-i18n`). The switch
labels themselves are never translated. No round may remove a translated string
or leave a key without a value in either language.

## 5. Security and delivery

- `db.php` and `ai_config.php` are server-only and never enter Git, a patch or
  a delivery archive.
- No round deploys. Delivery is a review archive only.
