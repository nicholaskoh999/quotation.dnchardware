# App shell — notes (Wave 1 Session A)

Authority: `docs/quotation-next/OWNER-APPROVED-REWRITE-HANDOFF.md` §3, §4, §8, §9.

## Breakpoints (decision)

Tailwind default breakpoints, no custom screens:

| width | class range | shell |
|---|---|---|
| phone `< 640` | below `sm` | sticky app bar (logo · user · menu → More sheet) + fixed **bottom nav** `Home \| Quotes \| + \| Companies \| More`; no sidebar; Home renders the native-app **Mobile Home** |
| tablet `640–1023` | `sm`…`lg` | sticky app bar with a **menu button that opens the sidebar navigation in a left sheet**; **no bottom nav**; single main column (Home renders the Overview stacked in one column) |
| desktop / tablet landscape `>= 1024` | `lg`+ | fixed left **sidebar** (`--shell-sidebar-width`), richer Overview (2/3 + 1/3 grid) |

Tablet portrait chooses the **sheet, not the bottom nav**: tablet uses the
same navigation model as desktop (one list, §4) rather than the phone IA, and
the bottom nav's `+`/More sheets are tuned to one-handed phone use.

Toasts: desktop/tablet top-right; phone `bottom-center`, offset by
`--shell-bottom-nav-height + 12px + safe-area` so they sit **above** the bottom
nav (`components/ui/sonner.tsx`, `toasterPlacement`). Sonner's built-in mobile
switch is 600px, so the shell picks the position itself at 640px.

Safe areas: app bar pads `safe-area-inset-top`, bottom nav and bottom sheets
pad `safe-area-inset-bottom`; `<main>` reserves bottom-nav height + inset on
phone so content is never hidden under the bar. Viewport meta already has
`viewport-fit=cover`.

## Navigation data

`nav-config.ts` is the single source of every label/link (desktop sidebar,
tablet sheet, bottom nav, `+` sheet, More sheet, Home products).
`RETIRED_NAV_LABELS` (Default Prices, Diameter Settings, Pricing Guide,
Version Updates) is asserted absent by Vitest + Playwright. The logo
(`AppLogo`) always links to `/` (`SHELL_LOGO_HREF`), separate from Back to DNC
Workspace.

## Shared-prop contract the shell CONSUMES (all optional)

The shell never implements auth or data access; it renders an honest
placeholder when a prop is missing. Type: `ShellSharedProps` in
`resources/js/types/index.ts`; read through `useShell()`.

| prop | shape | provider | when absent |
|---|---|---|---|
| `auth.user` | `{ id: number\|string, username: string, displayName: string }` | Session C (Inertia shared prop) | "Not signed in" placeholder; More → Sign Out shown **disabled** with a note |
| `workspace.url` | `string` (absolute http/https only; anything else is ignored) | Session C | "Back to DNC Workspace" / More → DNC Workspace / Home → Internal PO shown **disabled** ("Not connected" / "Coming later") |
| `recentQuotations` (Home **page** prop, not shared) | `Array<{ id, refNo, customer, date, total }>`; `total` string shown verbatim, number shown to 2 dp | Session D read layer, wired at W1 integration | key missing ⇒ "Not connected yet"; `[]` ⇒ "No quotations yet" + New Quotation. First 5 shown; each card links to `/quotations/{id}` (route arrives later) |
| `release`, `flash` | existing R1 shared props | R1 | release label hidden; flash `success`/`error` become toasts |

Sign Out posts to `/logout` (Inertia `Link method="post"`) **only when
`auth.user` is present** — Session C ships the user and the route together.

## Routes / placeholders

`home` `/` · `quotations.index` `/quotations` · `quotations.create`
`/quotations/new` (accepts `?mode=quick|manual`, `?product=<legacy key>`:
`sagrod lbolt ubolt stud jbolt anchorbolt`) · `companies.index` · `price-lookup`
· `calculator` · `system-health` · `settings`. Each page is a small component
using `PreviewNotice`; later sessions replace the component, not the route
name.

## Primitives added (`components/ui/`)

`sheet` (Radix Dialog), `dropdown-menu`, `tooltip`, `input`, `label`,
`skeleton` (+ `LoadingList`), `empty-state`, `page-header`, `status-badge`
(tone + icon + words), `form-field` (`FormField` render-prop + `FieldError`,
presentation only), `inline-alert` (error/success/warning/info),
`preview-notice` ("not yet available in this preview"). No new npm packages
were needed (Radix dialog / dropdown / tooltip were already pinned in R1).
