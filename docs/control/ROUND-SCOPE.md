# ROUND SCOPE

**ROUND:** Quick Add UI Polish 1 — Visual Density & Hierarchy
**ROUND TYPE:** UI / visual polish only
**APPLICATION STATUS:** ACCEPTED
**DEPLOY:** NO
**STOP POINT:** implementation + tests + evidence + package. UI POLISH 2 is not started.

---

## 0. Control files

`docs/control/` **did not exist** in the repository when this round opened, so
there was nothing to read. `PROJECT-GUARDRAILS.md`, `CANONICAL-STATE.md`,
`CANONICAL-STATE.json` and this file were written during this round from the
round brief and from the application source as it actually stands. Later rounds
have an authoritative baseline to read; this one had to establish it.

## 1. Allowed this round

Quick Add modal width · layout spacing · padding and gaps · visual grouping ·
borders · shadows · background hierarchy · typography hierarchy · font weight ·
secondary-text emphasis · toolbar layout and grouping · selected-count
presentation · row vertical spacing · action spacing · Bulk Edit
collapsed/open visual hierarchy · responsive CSS needed by the above ·
EN / 中文 display wording where it serves visual clarity · UI tests ·
visual-evidence scripts.

## 2. Not allowed this round

Parser · extraction · pricing calculations · Price Mode behaviour · weight
formulas · DIA calculations · previous-price matching · history identity · Qty
rules · material mappings · finish mappings · Size Type rules · database
behaviour · Bulk Edit business behaviour · Details behaviour · selection logic ·
accessories calculations · add-to-quotation behaviour. No unrelated
refactoring.

## 3. What was changed

All changes are in `index.php` (CSS, plus small presentational DOM/JS), and in
`docs/control/`.

### Modal width
- ≥1024px the dialog is `min(1280px, 100vw − 64px)` instead of a flat 900px.
  Written as `min()`, so it cannot exceed the viewport at any width.
- The extra width goes into the table's own tracks, not into slack: Size, each
  dimension, Qty, Weight and Price all grow with the dialog.
- Below 1024px nothing about the layout changed.

### Border / card noise
- The four copy-once sections (Correct Items, Common Item Fields, Pricing
  Entry, Accessories) were four bordered cards stacked down the dialog. They
  are now **one** bordered container, `Bulk Edit`, divided by hairlines.
- Removed the outline from: the message text block, the unit/total weight
  strip, the per-row accessories editor.
- Previous-price and the manual-price warning became tinted bands with one
  coloured left edge instead of full outlines — the status still reads, the
  rectangle is gone.
- Structural boxes kept, per the brief: the message panel, the top Common
  fields area, the Bulk Edit container, the column header and the item table.

### Visual hierarchy
- Price is now the strongest thing on a row — by weight and size, in the
  ordinary text colour rather than accent blue.
- Dimensions, Size and Qty share one weight below it; Weight and the row number
  sit at level 3; the row's material/finish line is smaller, lighter and
  separated by a real gap.
- Thread length was metadata grey and is primary information, so it was lifted
  back to a readable weight.
- Panel titles dropped from 900 to 800; the `— Apply to All` suffix left the
  title and became a quiet tag on the right of the head.
- The `N incomplete` badge is amber (it is a warning); the `N active` badge is
  neutral. Neither is a second blue accent.

### Row breathing room
- Row minimum height 38px → 44px, and 48px at ≥1024px; column gap 8px → 16px
  at ≥1024px.
- The metadata line under a row gained its own gap so it no longer sits flush
  against the values above it.
- Row dividers are a hairline rather than the full border colour.

### Selected count
- One location: the table toolbar, beside the item count, present only while
  the tick boxes are (`N selected`, amber at zero).
- The footer no longer prints `16 items` beside a button reading
  `Add 16 Items to Quotation`; it shows the count only when the button has no
  number to carry.
- The zero-selected refusal toast is unchanged.

### Bulk Edit density
- Closed section = a quiet row with no border of its own.
- Open section = accent background, an inset left marker and a body.
- The container carries `Bulk Edit / One shared value, many items` once,
  instead of four headings each repeating the scope.
- On a wide dialog the panel body keeps a readable measure instead of
  stretching inputs across 1280px.

### Toolbar hierarchy
- The bar now separates what the list **is** (item count, selected count, the
  AI-assisted status badge) from how you **look** at it (a labelled
  `VIEW  [Compact][Expanded]` control).
- `Compact / Expanded` sits under a `VIEW` label so it no longer reads as two
  more equal buttons.

### Helper copy (§13)
Shortened without changing meaning, EN and 中文 together where a translation
exists:
- Bulk correction note (both languages).
- Common Item Fields, Pricing Entry and Accessories notes (English literals —
  see finding F4).
- The manual-price warning.

### Spacing system
One four-step scale for the whole dialog (`--wqa-s1` 6px, `--wqa-s2` 10px,
`--wqa-s3` 16px, `--wqa-s4` 22px) plus two line weights (`--wqa-hair` for a
divider, the ordinary border for a surface) and one level-3 text colour
(`--wqa-quiet`). Every gap this round touched reads from that scale.

### Responsive
- Verified at 1600, 1280, 1024, 820, 600, 430 and 360px: no horizontal
  overflow, dialog inside the viewport, Price not clipped, footer CTA on
  screen, selection tick box reachable and working.
- The `ACTIONS` column header was clipped to `ACTI…` at tablet widths; its
  track and letter-spacing were adjusted so the whole word fits.

## 4. What was NOT changed

No PHP, no `api.php`, no parser, no calculator, no validation, no selection
logic, no apply logic. Proven by probe: see `REPORTS/PROTECTED-BEHAVIOUR.md`.

---

## 5. NEW APPLICATION FINDINGS — BLOCKED BY ROUND SCOPE

Recorded, not fixed.

**F1 — The brief describes UI this build does not have.**
`Fast Edit` (a global edit mode with Expanded / Add / Delete / Bulk Edit
locked), toolbar `Apply Previous Price` and `Clear Selection`, a
`Pricing Summary` line under each compact row, a per-row History count, and
one-accordion-open-at-a-time in Bulk Edit are all absent. This round therefore
polished the states that exist and skipped the ones that do not; adding them
would be new functionality. Evidence item 04 (Fast Edit) has no screenshot for
that reason.

**F2 — The customer-message panel is open by default above 640px, and it is
the largest single consumer of vertical space on the review screen.** With the
panel open, a 1280×860 laptop shows no *complete* item row without scrolling
even after this round. Changing the default is a behaviour change and was left
alone. Highest-value candidate for UI POLISH 2.

**F3 — The review table's column widths are composed once, at render.**
`wqaSetListGrid` reads the breakpoint's custom properties when the list is
drawn, and nothing recomposes them on resize, so crossing a breakpoint by
resizing a window or rotating a tablet leaves the header and rows on the
previous width's tracks until the next render. Pre-existing; this round widened
the desktop/tablet gap, which makes it more visible.

**F4 — Some Quick Add review strings are English-only literals.** The three
copy-once panel notes, the `Size` / `Thread` / `Current:` labels, the column
headers (`SIZE`, `LENGTH`, `THREAD`, `QTY`, `WEIGHT`, `PRICE`, `ACTIONS`), the
row `Edit` / `Close` action and the previous-price wording are hard-coded
English and stay English in 中文. Pre-existing i18n gap; adding translations is
new i18n coverage, not display wording, so it was left for its own round.

**F5 — `wqaRenderRows` set the item count in English and `wqaUpdateAddButton`
immediately overwrote it from the i18n key.** The dead line was removed as part
of the toolbar work; no behaviour depended on it.
