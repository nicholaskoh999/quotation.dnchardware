# QUOTATION NEXT — OWNER-APPROVED REWRITE HANDOFF (R0 FINAL)

| | |
|---|---|
| Status | **AUTHORITATIVE — current owner authority for QUOTATION NEXT** |
| Round | R0 FINAL — documentation / governance only |
| Repository | `nicholaskoh999/quotation.dnchardware` |
| Canonical baseline | `origin/main` `664c0d845c09a635d792009e5cc08349279e6633` |
| Branch | `round/r0-owner-handoff` |
| Date | 2026-10-21 |
| Owner | Nicholas (DNC) |
| Next round | **R0b — Characterisation / golden fixtures / CI baseline** |

---

## 0. HOW TO READ THIS DOCUMENT

**Precedence.** For QUOTATION NEXT, this document supersedes earlier UI
concepts and planning notes wherever they conflict with the owner-approved
decisions below.

**What it does not supersede.**

- The **existing production application** (`quo.dnchardware.com`, PHP) remains
  the **legacy oracle** until parity / cutover. Its accepted behaviour, recorded
  in `docs/control/PROJECT-GUARDRAILS.md` and `docs/control/CANONICAL-STATE.*`,
  stays protected for the legacy application. This handoff governs the new
  application; it is not an instruction to change the legacy one.
- **Historical evidence is preserved, not rewritten.** Old reports, audits and
  round records stay exactly as written. Where they disagree with this handoff,
  the disagreement is recorded in §34 (Contradiction Register) rather than
  "fixed" in the old document.

**LOCKED** means the owner has decided. Future rounds implement it; they do
not re-ask it (§31). Where a locked decision and legacy behaviour differ, the
difference is a known, intended divergence and must be recorded as such in the
R0b golden fixtures, never silently treated as a parity failure or a bug in
either direction.

**Do not invent owner decisions. Do not silently reinterpret accepted business
rules.** Anything not covered here, or covered ambiguously, follows §31.

---

## 1. TARGET ARCHITECTURE — LOCKED

Target stack:

- Laravel
- React
- TypeScript
- Inertia
- Vite
- Tailwind
- shadcn/ui / Radix
- Lucide React
- MySQL
- Pest
- Vitest
- Playwright

Architecture rules:

- **One application deployment**, not a separately hosted SPA/API.
- Business logic lives **outside React components**, in framework-free
  TypeScript modules.
- Blade / server-rendered HTML is preferred for customer-facing **A4 print**.
- Keep the existing production DB/schema **compatible** during the initial
  parallel migration.
- **Do not normalise the production schema before cutover.**
- New UI is a **full redesign**. Do not reproduce the legacy visual layout.
- The new application must feel like part of the **DNC Workspace / Internal PO
  suite**.

---

## 2. DEPLOYMENT / OWNER REVIEW POLICY — HARD LOCK

Development **MUST NOT** be deployed directly to `quo.dnchardware.com`.
Use preview / staging first.

Expected workflow:

```
INTEGRATE
→ FAST PRE-DEPLOY SANITY
→ PREVIEW DEPLOY
→ OWNER SMOKE
→ QUO LOOP / targeted fixes
→ PREVIEW REDEPLOY as needed
→ OWNER FUNCTION ACCEPTED
→ FULL SUITE
→ SECURITY CHECK
→ FINAL VERIFY
→ CLOSE
```

- Do **not** require the full suite / security pass before the owner gets an
  early preview.
- **Production deployment is forbidden** unless the instruction explicitly
  contains: **`PRODUCTION APPROVED BY OWNER`**.

Preview development data, in order:

1. copied / test DB
2. later, production **read-only**
3. controlled compatible production writes **only after write-path proof**

**Rollback must remain possible throughout the parallel migration.**

---

## 3. GLOBAL UX PRINCIPLES — LOCKED

The new UI is an **enterprise application**, not a reskinned legacy form.

Visual direction:

- neutral surfaces
- restrained DNC accent
- breathing room
- thin borders
- small / subtle shadows
- semantic colour only when useful
- do not make every control blue
- Lucide icons
- **no emoji UI icons**

Colour semantics:

| Colour | Meaning |
|---|---|
| DNC blue / accent | primary actions, selected / navigation state, links |
| green | success / saved / healthy |
| amber / orange | draft, unsaved, needs review, historical suggestion |
| red | errors, validation failures, destructive actions |
| purple / subtle special accent | AI / cross-system / special workflow where useful |
| neutral grey | metadata, disabled, secondary information |

**Never rely on colour alone.** Use icon / text / status as well.

### Global interaction rule

**No meaningful action may be silent.** Every meaningful operation visibly
communicates one or more of: loading / in progress, success, failure,
validation, result.

Use: button loading states · inline validation · toast notifications · retry
where appropriate · **Undo** for reversible deletion where practical.

Examples: Quotation saved · Item added · Item duplicated · Item removed + Undo ·
Pricing applied · Copied to clipboard · Draft recovered · Draft discarded ·
Company updated · PO draft created · AI analysing · Uploading · Preview
generating.

Avoid toast spam for ordinary typing, tab changes, sort, simple selection, etc.

- Desktop toast: **top-right**.
- Mobile toast: **above bottom navigation / sticky action bar**.

---

## 4. GLOBAL NAVIGATION — LOCKED

Permanent desktop navigation, approximately:

```
Overview / Home

QUOTATIONS
  Quotations
  New Quotation

CUSTOMERS
  Companies
  Price Lookup

TOOLS
  Calculator

SYSTEM
  System Health
  Settings

Back to DNC Workspace
```

Removed from normal navigation: Default Prices · Diameter Settings · Pricing
Guide · Version Updates.

The **DNC Quotation logo / app identity (upper-left) is always clickable and
returns to QUO Home.** This is distinct from Back:

| Control | Goes to |
|---|---|
| Logo | Home |
| Back | previous / navigation parent |
| DNC Workspace | explicit cross-app navigation |

---

## 5. AUTH / USER IDENTITY / PREPARED BY — LOCKED

- Current QUO authentication source is **`app_users`**.
- The generic shared production account **`admin`** has already been disabled
  by the owner (`app_users.enabled = 0`). **Do not re-enable it.**
- Named users (e.g. `nicholas`, `alson`) remain the intended model.

Rules going forward:

- `admin` is a **role / permission**, not a generic shared username.
- **Prepared By is never a normal free-text field.** It comes from the
  authenticated named user.
- On save, the **creator identity is preserved** with the quotation.
- Later edits by another user **must not replace** the original Prepared By.
- Editor / activity is tracked separately (e.g. Last edited by / activity log).
- Portal / Workspace handoff must preserve authenticated identity.
- An admin-only legacy/import override may exist later if genuinely required.
- **Do not delete old user rows** merely to clean the table.
- There is also an old **`users`** table containing an admin row. It has **not**
  been proven to be the current QUO login source. **Do not delete or change it**
  as part of the rewrite without explicit evidence.

---

## 6. QUOTATION HEADER — LOCKED

Remove the legacy wizard-like giant customer Step 1. The header is compact and
contextual.

**Customer selection**

- searchable customer combobox
- recent customers
- New Customer
- selecting a customer auto-fills stored customer info
- selected customer shown as a customer card / context
- quotation-specific contact / phone override allowed if needed

**Prepared By** — automatic authenticated named user; read-only system
metadata, not an input.

**Date** — sensible default = today.

**Issued By**

- a separate concept from Prepared By
- represents the issuer / company / letterhead profile
- must map to a proper **issuer profile**
- do not reuse one company's contact details for another issuer

**Remarks** — optional; collapsible / secondary; standard terms / default
wording come from settings.

**Unsaved quotation** — shows **Draft / Not saved**; never a formal Q-number as
if it exists.

**Formal quotation number** — allocated **only after a successful real Save**.

---

## 7. SAVE / DRAFT / REFRESH RECOVERY — LOCKED

Refresh, tab close, browser crash or mobile app/browser eviction must **not**
casually destroy unsaved work. Use **local draft autosave** for unsaved working
state. **Autosave is not formal quotation save.**

- local autosave after meaningful edits
- recover the draft after refresh / reopen
- the same authenticated named user owns the local draft
- autosave does **not** allocate a formal Q-number
- successful formal Save removes / clears the corresponding local draft
- explicit **Discard Draft** is available, and requires confirmation
- logout may preserve the user's local draft for next login
- saved-quotation edits can also have an unsaved working-copy recovery
- if server state changed independently, **do not silently overwrite**; surface
  a conflict

Possible UX: *Recovered unsaved changes* — **Continue Draft** / **Discard**.

---

## 8. MOBILE STRATEGY — HARD LOCK

Do **not** implement mobile as a squeezed desktop layout.

Phone uses a **native-app / super-app information architecture**, inspired by
modern mobile apps such as TNG eWallet (copy the IA philosophy, **not** TNG
colours or branding):

- account / context at top
- high-frequency quick actions
- card / list modules
- recent / favourite content
- persistent bottom navigation
- dedicated full-screen task flows

### Mobile Home v1

1. **App bar** — DNC Quotation · current user · compact navigation / menu
2. **Current / Recovered Draft** — customer · item count · current total ·
   Continue. If no draft: New Quotation.
3. **Quick Actions** — New Quotation · Quick Add · Companies · Price Lookup ·
   Calculator · Internal PO
4. **Recent Quotations** — small useful list (e.g. 5); the whole card opens the
   quotation; no permanent View / Edit / Delete button clutter
5. **Frequently Used Products** — Sag Rod · L Bolt · U-Bolt · Stud · J Bolt ·
   Anchor Bolt (may evolve from usage later)

### Bottom navigation

```
Home | Quotes | + | Companies | More
```

- Center **+**: New Quotation · Quick Add · Manual Add
- **More**: Price Lookup · Calculator · System Health · Settings · DNC
  Workspace · Language · Sign Out

### Not on Mobile Home

Default Prices · Diameter Settings · Pricing Guide · Version Updates · full
developer System Health · large KPI dashboard · delete controls · desktop
sidebar · desktop 4-step wizard.

---

## 9. RESPONSIVE TABLE / LIST STRATEGY — LOCKED

Desktop and mobile may use different presentation components but **must share**:
state · calculation engine · validation · item model · formatting rules ·
actions.

Example component direction:

```
QuotationItems/
  DesktopTable.tsx
  MobileList.tsx
```

**Do not duplicate business logic.**

Phone: quotation items, companies and quotations ⇒ **cards / list**.

Truly comparison-heavy data may use a compact responsive table with horizontal
scroll if necessary: Price History · admin master tables · diagnostic data ·
comparison matrices. **Do not simply shrink a 10-column desktop table to
393 px.**

Tablet:

- portrait: generally single-column / simplified
- landscape: may use denser split layouts
- desktop full table / right rail only when width comfortably supports it

---

## 10. MOBILE QUOTATION BUILDER — LOCKED

A focused single-column flow. **No desktop Step 1–4 wizard.**

```
Quotation Header
Items
+ Add Item
Total
Save
```

**Add Item** opens a dedicated full-screen task: Product · Material · Size ·
Dimensions · Accessories · Pricing · Add Item.

**Quick Add** also uses a dedicated full-screen flow.

Mobile item card surfaces only high-value information: product ·
size/dimensions · finish · qty · unit price · line total.

Detailed fields appear after open / edit: diameter · developed length · unit
weight · cost rate · additional cost · markup · accessories · price history.

Sticky bottom bar is encouraged:

- Unsaved: `3 items · RM428.50 | Save`
- Saved: `Q-2026-1317 · RM428.50 | Actions`

Saved Actions can include: Print · WhatsApp · Copy · Create Internal PO.

---

## 11. COMPANIES — LOCKED

Companies is a **customer directory**, not a dashboard of unrelated tools.
Remove the current combined layout (KPI dashboard + customer directory + recent
quotations + price lookup at once).

Directory provides: search · company list/table · New Company · useful usage
metadata (quotation count / last quoted date) · open company. Desktop may use a
proper directory table.

Company detail / profile tabs: **Overview · Quotations · Price History**.
Company-specific quotations/history appear after opening the company.

- Global quotation history belongs under **Quotations**.
- Global historical price search belongs under **Price Lookup**.
- **Do not expose Delete** as a permanent primary list action.

**Short Code**

- **removed** from the normal new UI
- the legacy DB column/data is **preserved** for compatibility
- new companies do not need a meaningful short code
- legacy short code may remain a hidden search alias if useful

New Company normal fields stay simple: Company Name · Phone/contact as
appropriate · Address · optional notes/contact fields as later justified.

Prefer a **side sheet / dialog on desktop** and a **full-screen form on mobile**,
rather than inserting a large editor into the directory list.

---

## 12. SIZE INPUT / METRIC / IMPERIAL — LOCKED

Remove reliance on native browser `datalist` for Size. Use a proper React
**searchable combobox**. **No separate Metric/Imperial selector** in the normal
workflow.

| Input | Normalised | System |
|---|---|---|
| `12` | `M12` | Metric |
| `m12` | `M12` | Metric |
| `1/2` | `1/2"` | Imperial |
| `3/8` | `3/8"` | Imperial |
| `1-1/4` | `1-1/4"` | Imperial |

- Pure integers default to metric M-size.
- Fractions default to Imperial.
- The system may lightly show the interpretation: `M12 · Metric`,
  `1/2" · Imperial`.
- Do not force a manual unit-system choice unless the value is genuinely
  ambiguous.

Historical bad-size decisions:

- bare `6` ⇒ normalise as **M6**
- bare `72` ⇒ **do not** blindly normalise; mark **Needs Review**

---

## 13. PRODUCT / MATERIAL MODEL — LOCKED

Canonical **materials**: MS · 4140 QT · 4140 (non-QT / plain) · 4340 QT · S45C ·
SS304 · SS316 · Y BAR.

- **Y BAR is a genuine Material.** Keep it as Material.
- **Finish is separate**: PL · ZP · HDG · N/A where applicable. Do not describe
  PL / ZP / HDG as materials.

Canonical 4140 rule:

- stored legacy `4140` maps / displays as **4140 QT** where supported
- `4140_PLAIN` means **non-QT / plain 4140**

Hardened variants are no longer fake combined materials. New structured model:

```
Material  ·  Treatment  ·  Property Class
```

| Material | Treatment | Property Class |
|---|---|---|
| S45C | HARDEN | 8.8 |
| 4140 QT | HARDEN | 10.9 |

Supported / common Property Class options: **8.8 · 10.9 · 12.9 · Custom/Other**.

- **12.9 is an owner-approved new valid option.** The historical export did not
  contain 12.9; do not present it as historical evidence.
- Legacy combined stored values (e.g. `4140_HARDEN_G10_9`, `S45C_HARDEN_G8_8`)
  **must remain readable.**

---

## 14. CUSTOMER-FACING HARDENED WORDING — LOCKED

Never output awkward wording such as:

```
S45C + HARDEN = G8.8 STUD (PL)
```

Preferred:

```
S45C STUD · HARDENED TO G8.8 (PL)
4140 QT STUD · HARDENED TO G10.9 (PL)
4140 QT STUD · HARDENED TO G12.9 (PL)
```

Internal data remains structured. Print / WhatsApp / Copy format those
attributes into customer-facing English.

---

## 15. DIAMETER MASTER — OWNER RULE LOCKED

Owner's rule: historical patterns that are **repeated, stable and clearly
systematic** are valid candidates for the new canonical diameter master. The
owner does **not** need to manually approve every obvious repeated value.

However:

- scope rules according to evidence
- do not convert a product/material-specific convention into a global rule
  without evidence
- conflicting / rare / ambiguous cases remain manual or **Needs Review**

Known repeated historical conventions:

- FULLSIZE M33 → Ø32
- FULLSIZE M24 → Ø25
- 1" → Ø25
- 4140 plain M12 → Ø13 — **LOCKED**
- UNDERSIZE M10 → Ø8.9 / 9.0 pattern
- UNDERSIZE M12 → Ø10.7
- certain scoped 4140 QT L Bolt M27 → Ø28 patterns

Missing diameter sizes are added based on historical evidence / frequency. The
exact canonical table is generated during characterisation / master-data work
and **tested**.

The production `diameter_settings` table has only **one** custom row, redundant
with built-in behaviour. Normal users do not need a Diameter Settings UI.

See §34 C-2 on the M12 Undersize legacy default.

---

## 16. DEFAULT PRICE / SAG ROD PRACTICE — LOCKED

- Production `default_prices` has **0** database rows. Do not confuse built-in
  code pricing rules with custom DB rows.
- Default Price Settings is removed from normal user UI.
- **MS UNDERSIZE Sag Rod**: preserve the proven existing practice / system
  rules unless tests / owner decisions say otherwise.

**MS FULLSIZE Sag Rod** historical practice:

| Finish | Cost Rate |
|---|---|
| PL | RM3.50/kg |
| ZP | RM5.00/kg |
| HDG | typical historical range RM6.50–RM7.00/kg |

Owner decision: **HDG default suggested Cost Rate = RM6.50/kg.**

The UI may show "Typical historical range RM6.50–RM7.00/kg", but actual pricing
calculation / storage **must use one numeric rate, never a numeric range.**

---

## 17. PRICE MODE / PRICING UI — LOCKED

Remove the legacy normal-user dropdown `Auto Round / No Round / Manual Price`;
it mixes two different concepts.

**Normal flow — CALCULATED PRICE**: Cost Rate · Additional Cost · Markup ·
product-specific DNC standard rounding.

**Manual Price** — an explicit override action; shows the calculated / reference
price; the user enters the final unit price intentionally.

**No Round** — preserve the capability if required; hide under **Advanced**,
not the primary normal flow.

The UI makes clear:

| Normal | Manual |
|---|---|
| Calculated | Calculated |
| DNC Rounded / Suggested | Suggested |
| Final Price | Manual Final |

**Do not silently overwrite pricing based on history.**

---

## 18. ACCESSORIES — LOCKED

Replace the legacy disabled-field wall.

Default: *No accessories* · **+ Add accessory**.

Options: Nut · Flat Washer · Custom.

A selected accessory may have: Qty per item · Finish · Unit Price · apply scope
where useful. Compact summary: `Nut ×2 · ZP · RM0.20`.

Quick Add: group-level defaults, row overrides. Explicitly label **Qty per
item**.

Existing pricing semantics remain, including the **WAS accessory markup
exception** (and the accepted accessory-inclusive final unit price — see
PROJECT-GUARDRAILS "ACCESSORIES — INSIDE THE FINAL UNIT PRICE").

**BUG FIX LOCKED**

- explicit accessory quantity **0 remains 0**
- **blank** means use default
- never convert explicit 0 into default 2/1

---

## 19. J HOOK — LOCKED

J Hook becomes an **official Product**. Historical de-facto dimensions:

```
Size · Diameter · L · W · TL
```

- Do **not** add unsupported H / ID fields.
- Developed length: **no hard automatic formula yet.** `L + W` may be offered as
  an editable **Suggested Developed Length**; never locked as fact; user can
  override.
- Unit weight: continue using the existing developed-length weight formula once
  a developed length exists.
- Quick Add should eventually parse historical free-text J Hook patterns into
  these structured fields.

---

## 20. EYE BOLT — LOCKED

Eye Bolt becomes an **official Product**. Canonical fields:

Material · Size · Diameter · L · ID · TL · optional S · optional Weld/FW
attribute · Size Type where appropriate · Finish.

- Keep **Eye Bolt** as the product name.
- If **S is present**: reuse the existing J Bolt geometry calculation engine. Do
  not rename the item to J Bolt merely because geometry is shared.
- If **S is absent**: developed length remains manual until better evidence /
  formula is owner-approved.
- **Weld / FW** is an optional variant / attribute, not a separate product.

---

## 21. SAG ROD TL — LOCKED

Sag Rod threads both ends. A single TL input such as `100` canonicalises to
**`100/100`**. Do not preserve ambiguous single-ended-looking text when the
business meaning is both ends.

---

## 22. SMART SEARCH / PRICE LOOKUP — HARD LOCK

The current literal search is insufficient. New search must understand /
normalise intent. These must work:

```
m12 sagrod
sagrod 12 zp
MSUNDERSIZESAGROD ZP M12
ms under m12
4140 m20 l bolt
4140qt m20
4140 harden 10.9
g10.9 stud
1/2 ss304 u bolt
ubolt
sagrod
```

Normalisation examples:

| Query | Interpretation |
|---|---|
| `4140` / `4140qt` / `4140 QT` | Material = 4140 QT |
| `4140 harden 10.9` | Material = 4140 QT · Treatment = HARDEN · Property Class = 10.9 |
| `12` | M12 |
| `1/2` | 1/2" |
| `u bolt` / `u-bolt` / `ubolt` | U-Bolt |

- **Search order does not matter.**
- Use tokenisation · normalisation · aliases · compact concatenated-word
  parsing where reasonable · fuzzy tolerance where safe.
- If the query resolves to structured filters, show the interpreted **chips**:

```
Search: 4140 m20 lbolt
[4140 QT] [L Bolt] [M20]
```

---

## 23. SEARCH GROUPING / HIGH-FREQUENCY HISTORY — LOCKED

Do not dump hundreds / thousands of repeated historical rows. For very common
combinations, first show a **canonical grouped result**:

```
MS UNDERSIZE SAG ROD · M12 · ZP
1,166 historical item lines
Last used: ...
Common TL: 100/100 ... 70/70 ... 75/75 ...
Typical pricing recipe / range
[View recent examples]  [View all history]
```

Then show only the most relevant historical examples by default.

Ranking favours, in order:

1. same customer
2. exact product
3. exact material
4. exact size type
5. exact size
6. exact finish
7. exact / closest dimensions
8. recency

- **Do not blindly copy old final unit prices when dimensions differ.**
- For similar dimensions: reuse / suggest the **pricing recipe** (Cost Rate,
  Additional Cost, Markup) and **recompute against the CURRENT item weight.**
- For an exact match: may offer **Use RMx.xx** or **Use pricing recipe**.
- **Suggestions never silently overwrite the current item.**

Conceptually provide: **Smart Groups** and **Raw History**.

---

## 24. PREVIOUS PRICING / SUGGESTED PRICING — LOCKED

The builder does not show a giant generic history list. Show the highest-value
contextual references:

- same-customer exact / best match
- closest recent matches
- useful price / rate range where appropriate

Label other-customer references clearly. Quick Add groups reuse the same
suggestion engine. **Historical suggestion always requires an explicit Apply
action.**

---

## 25. QUICK ADD — LOCKED DIRECTION

Quick Add and Manual Add belong in **one Add Items module** as clear **modes**,
not two giant simultaneously expanded forms.

- **Quick Add**: text · WhatsApp image · PDF · multiple items
- **Manual Add**: single / special item

Both create the **exact same canonical quotation item model.**

Quick Add target flow:

```
Input → Analyze → Detection Summary → Automatic Grouping
→ Review / Fix → Pricing / Accessories → Confirm → Add Items
```

- The source image/text must not dominate the screen after analysis — collapse
  it into a **Source Summary / View Original**.
- **Group first. Row exception second.**
- Aggregate attention issues by group rather than repeating the same warning
  badge on every row.

---

## 26. OUTPUT — PRINT / WHATSAPP / COPY — LOCKED

Output requires a **formally saved** quotation. Before save: no Print, no
WhatsApp, no Copy customer output. A formal Q-number must exist.

Customer-facing output:

- English
- **never** exposes Cost Rate, Additional Cost or Markup

**WhatsApp preview MUST equal the actual sent / copied WhatsApp content.**
Remove the legacy discrepancy where the preview merges differently.

**Preserve insertion-order numbering.**

Print:

- fully redesigned
- professional centred A4 preview
- visually compatible with the DNC Workspace / Internal PO family
- clean preview toolbar
- per-issuer letterhead profile
- **do not hard-code Der-Cheng details for every issuer**

---

## 27. QUOTATION → INTERNAL PO HANDOFF — LOCKED

A real workflow integration, not merely a visual link. A quotation can create an
Internal PO draft **without staff retyping** customer · item · specification ·
quantity · relevant source metadata.

Rules:

- create a **PREFILLED PO DRAFT**
- do **not** directly insert arbitrary rows across application databases
- use a controlled **signed / one-time handoff contract**
- keep source quotation ↔ PO **traceability**
- provide **Open PO / Open Quotation** links
- prevent accidental duplicate handoffs
- after a PO exists, the primary action becomes **Open PO**; **Create another
  PO** requires explicit action
- **Selling Price must NOT automatically become PO purchase price**

Reuse / port the existing unmerged Portal/DNC Handoff Contract v2 work where
appropriate instead of inventing another incompatible mechanism. At R0 that work
lives on branch `origin/round/r5-c-portal-handoff` (head `54cbc82`, "DNC
Workspace handoff into Quotation (contract v2, ships OFF)") — it is the
Workspace → Quotation identity handoff; the Quotation → PO direction reuses its
contract mechanism, not its exact payload.

---

## 28. SYSTEM HEALTH — LOCKED

System Health is required.

**Employee-safe view**: app up / degraded · DB reachable yes/no · session OK ·
Quick Add AI available yes/no · print available · Workspace link OK · release
version.

**Admin / developer detail** may include: release semver · full SHA · build
time · DB version / latency / schema conformance · session / cache / storage
status · PHP / runtime checks · upload / runtime limits · AI model / configured
yes/no (never the key value) · handoff configured yes/no · rollback release
availability.

**Never expose**: secrets · DB credentials · raw keys · sensitive server paths ·
dangerous raw error details.

**Version Updates UI is retired.** Minimal release / version / SHA / deploy
information lives under **System Health / About**.

---

## 29. LEGACY UI RETIRED FROM THE NORMAL USER EXPERIENCE

- Default Price Settings
- Diameter Settings
- Pricing Guide
- Version Updates
- generic shared admin login
- Price Mode dropdown
- Short Code management
- giant customer Step 1 wizard
- native browser datalist Size dropdown
- desktop tables squeezed into phone width

The underlying compatible data / rules may remain where required for migration
/ read compatibility.

---

## 30. MASTER DATA / HISTORICAL EVIDENCE

Known production inventory facts from the read-only export / audit:

| Fact | Value |
|---|---|
| quotations | 1,314 |
| historical item lines analysed | 3,691 |
| `default_prices` DB rows | 0 |
| `diameter_settings` DB rows | 1 (redundant with built-in behaviour) |
| J Hook historical lines | 15 |
| Eye Bolt historical lines | 7 |
| `4140_HARDEN_G10_9` historical lines | 12 |
| `S45C_HARDEN_G8_8` historical lines | 4 |
| historical 12.9 | none observed |

**Do not turn "not historically observed" into "not allowed"** where the owner
has explicitly approved a new value (e.g. Property Class 12.9).

---

## 31. R0 FINAL OPEN ITEMS

The owner has resolved enough decisions to begin the rewrite. Remaining work
such as exact generated diameter-master entries is implementation /
characterisation work, **not** a reason to block the application skeleton.

Return to the owner **only** where evidence is:

- conflicting
- genuinely ambiguous
- materially changes pricing / output / business meaning
- cannot be safely resolved from existing evidence / tests

**Do not repeatedly re-ask already locked decisions.**

---

## 32. ROUND / SESSION EXECUTION PLAN

```
R0 FINAL   this document (governance only)

R0b        Characterisation / golden fixtures / CI baseline

R1         Laravel + React/TS/Inertia/Vite/Tailwind/shadcn skeleton
           + test infrastructure + /health + preview deployment proof

Wave 1 (parallel)
  A  App Shell / Design System / Responsive / Mobile
  B  Domain Engine / Master Data
  C  Auth / Workspace / Named Identity
  D  Legacy Data Read Layer
  → W1 Integration → Fast sanity → Preview Deploy #1 → Owner Smoke → LOOP

Wave 2 (parallel)
  E  Quotation Builder
  F  Companies / Smart Search / Price Lookup
  G  Write Path
  H  Output
  → W2 Integration → Fast sanity → Preview Deploy #2 → Owner Smoke → LOOP

Wave 3
  I  Quick Add
  J  PO Handoff / System Health
  → Final Integration → Fast sanity → Preview Deploy #3 → Owner Smoke → LOOP

After owner function acceptance
  Full Pest · Full Vitest · Full Playwright · legacy/golden parity
  · browser/device matrix · write-path/concurrency verification
  · Security Check · final preview verification · Close
```

**Production remains separately owner-gated** (§2).

---

## 33. HARD PROHIBITIONS (summary)

Carried by every QUOTATION NEXT round unless the owner explicitly lifts one:

- no direct deploy to `quo.dnchardware.com`; production only with
  `PRODUCTION APPROVED BY OWNER`
- no production DB writes until write-path proof; no schema normalisation
  before cutover
- do not re-enable `app_users.admin`; do not delete user rows; do not touch the
  old `users` table without evidence
- do not rewrite historical evidence to agree with this document
- do not invent owner decisions; do not silently reinterpret accepted business
  rules
- do not expose Cost Rate / Additional Cost / Markup in customer output
- do not store a price range as a rate
- do not let a historical suggestion overwrite an item without explicit Apply

---

## 34. CONTRADICTION REGISTER (R0 FINAL)

Found while reconciling this handoff with the legacy control documents on
baseline `664c0d8`. None of these changes the legacy application. Each is to be
handled by R0b characterisation; the "Owner?" column applies §31.

| # | Topic | Legacy record | This handoff | Treatment | Owner? |
|---|---|---|---|---|---|
| C-1 | Bare grade → material | PROJECT-GUARDRAILS §MATERIAL: `8.8`/`G8.8`/`HT8.8` ⇒ **4140 QT**; `10.9`/`HT10.9` ⇒ **4340 QT** | §13/§22: hardened items are Material + Treatment + Property Class; `4140 harden 10.9` ⇒ 4140 QT + HARDEN + 10.9; history holds `4140_HARDEN_G10_9`. The handoff does **not** restate what a bare `10.9` (no base material) maps to. | Keep the legacy bare-grade mapping as the oracle; R0b characterises it; Smart Search shows the interpreted chips so the user sees the guess. Do not silently change bare `10.9` ⇒ 4340 QT to 4140 QT. | **Yes, if** the new engine is to change the bare-grade default (changes material / pricing) |
| C-2 | M12 Undersize diameter | PROJECT-GUARDRAILS §DIAMETER: M12 Undersize DIA = **10.6 mm**; legacy UI default 10.6 | §15: repeated historical convention UNDERSIZE M12 ⇒ **Ø10.7** | Generated diameter master must determine scope (global vs material/product-specific) from evidence. A global change of the M12 Undersize default from 10.6 to 10.7 changes weight and therefore price. | **Yes, if** evidence supports a *global* change; scoped, evidenced conventions follow §15 without re-asking |
| C-3 | Price mode as history identity | PROJECT-GUARDRAILS §HISTORY: identity includes **price mode** | §17 removes the dropdown (Calculated / Manual override / No Round under Advanced); §23 ranking list does not name price mode | Not a conflict in substance — the three capabilities survive. The new item model must still record which one produced the price so history identity can be characterised. | No |
| C-4 | WhatsApp order / preview | PROJECT-GUARDRAILS §Numbering identity: WhatsApp **grouped by material and finish**, each row carrying its own item number; numbering ORDER deferred to Stage 2 | §26: preview must equal sent content; preserve insertion-order numbering | Item-number identity (item 3 is item 3) is preserved by both. Whether WhatsApp *lines* stay grouped by material/finish is not changed by this handoff — keep legacy grouping unless the owner says otherwise. Preview/sent equality is a locked fix. | No (grouping unchanged); only if grouping is to change |
| C-5 | Accessory qty 0 | Owner-reported legacy defect: an explicit 0 is converted to the default 2/1 | §18: explicit 0 stays 0 — locked bug fix | Golden fixtures record it as an **intended divergence**, not a parity failure. Do not fix the legacy app under R0. | No |
| C-6 | Version Updates page | FULL-AUDIT/TRANSLATION-AUDIT treats Version Updates as a preserved historical record | §28/§29: Version Updates UI retired; release info under System Health / About | Retire the UI only; existing historical release records are not deleted. | No |
| C-7 | Hardened material values | Legacy stores combined values (`4140_HARDEN_G10_9`, `S45C_HARDEN_G8_8`) as materials | §13: structured Material / Treatment / Property Class; legacy values remain readable | Read-layer maps legacy combined values to the structured model; nothing stored is rewritten (no schema normalisation before cutover, §1). | No |
| C-8 | Deployment wording | PROJECT-GUARDRAILS §DEPLOYMENT: never deploy automatically; only Nicholas approves | §2 adds preview/staging and the exact phrase `PRODUCTION APPROVED BY OWNER` | Consistent; §2 is the stricter, more specific rule for QUOTATION NEXT. | No |

No contradiction was found for: Sag Rod TL `100 ⇒ 100/100` (legacy round QUO-A
already treats `x 50/50` as both ends), stainless Finish = N/A, Qty rules,
accessory-inclusive final unit price, deployment gating, named-user identity
(`app_users`, `dc_current_user()`).

---

## 35. VERDICT

```
R0 OWNER DECISIONS:  LOCKED
NEXT ROUND:          R0b — CHARACTERISATION / GOLDEN FIXTURES
```
