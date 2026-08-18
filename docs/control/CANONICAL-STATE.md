# CANONICAL STATE

Authoritative description of the accepted application, as it exists in Git.

- **Application:** Der-Cheng Quotation (`quotation.dnchardware`)
- **Version string in `index.php`:** v2.24.0 (`brandSub`, `<title>`)
- **Status:** ACCEPTED
- **Last round applied:** Quick Add UI Polish 1 — Visual Density & Hierarchy

> `docs/control/` did not exist before UI POLISH 1. This file was written in
> that round by reading the source, so it records what the application *is*.

---

## Files

| File | What it is |
|---|---|
| `index.php` | The whole calculator UI: markup, CSS, i18n runtime and all client logic, including WhatsApp Quick Add |
| `companies.php` | Companies / saved quotations |
| `api.php` | JSON endpoints (quotations, price history, settings) |
| `ai_extract.php` | Server-side AI extraction for photo / PDF Quick Add |
| `auth.php`, `login.php`, `logout.php` | One shared account, session-based |
| `db.sample.php`, `ai_config.sample.php` | Templates; the real files are server-only |

## Quick Add — the accepted shape

**Step 1** Paste text, or upload a photo / PDF, with one optional line of
additional info for the analysis.

**Step 2 — Review**, top to bottom:

1. **WhatsApp Message** — the customer's own words. Collapsible; open by
   default above 640px, closed on a phone. Shown for a pasted source only.
2. **Common fields** — Product, Material, Finish, Size Type for the whole list.
3. **Bulk Edit** — one container holding four copy-once sections, each an
   accordion, each with its own Apply:
   - **Correct Items** — product / material / finish / size type, *Keep
     existing* by default, with *Fill blanks only*
   - **Common Item Fields** — Size and Thread
   - **Pricing Entry** — Cost Rate, Additional Cost, Markup, Price Mode, and
     Manual Unit Price when the mode is Manual
   - **Accessories** — Nut, Flat Washer, Custom
   Each section states the scope its Apply would use. Sections open
   independently.
4. **Table toolbar** — item count, selected count (only while the scope is
   Selected Items), the AI-assisted badge when an AI call produced the rows,
   and the Compact / Expanded view control.
5. **Item table** — one line per item: `# · Size · dimensions · Qty · Weight ·
   Price · badges · Edit · ✕`. Zebra striped, sticky column header, hairline
   dividers. A row opens in place into its full editor (dimensions, product,
   material, finish, size type, pricing entry, weights, previous price,
   accessories, raw source line).
6. **Footer** — `N need attention` when any row is blocked, Cancel, and
   `Add N Items to Quotation`.

### Roles

| Thing | Role |
|---|---|
| Compact / Expanded | a **view** over every row |
| Row `Edit` | deep edit of **one** row, in place |
| Bulk Edit sections | one shared value written to **many** rows, once, on Apply |
| Previous price | inside the open row; `Use Last Price` sets that row's manual price |

### Not present in this build

The following exist in some round briefs but not in the application:

- a named **Fast Edit** mode (a global edit that makes every row's cells
  editable at once while locking Expanded, Add, Delete and Bulk Edit)
- toolbar **Apply Previous Price** and **Clear Selection** actions
- a **Pricing Summary** line under each compact row
- one-accordion-open-at-a-time in Bulk Edit
- a per-row History **count**

## Responsive breakpoints (Quick Add)

| Width | Behaviour |
|---|---|
| ≥ 1024px | dialog `min(1280px, 100vw − 64px)`; ten-column table; generous tracks |
| 600–1023px | dialog `min(96vw, 900px)`; same single-line table, narrower tracks |
| ≤ 640px | full-screen sheet; message panel starts closed |
| < 600px | no column header; the row summary wraps instead of using fixed tracks |

## Language

EN and 中文, switched at runtime. Some Quick Add strings inside the review body
are still English-only literals — see `ROUND-SCOPE.md` findings.
