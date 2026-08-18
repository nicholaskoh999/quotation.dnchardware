# UI POLISH 2 — INTERACTION / MICRO-UX EVIDENCE

Every pair was captured by `tests/ui-polish-2-shots.js` driving the real Quick
Add through the project's own harness, on the same 16-line Sag Rod enquiry.
`before/` is the accepted source at `e3d659b`; `after/` is the same source with
this round's interaction layer.

**Interaction states are performed, not painted.** A hover is a real pointer on
the control, a focus ring is a real keyboard focus, the disabled CTA is a list
whose rows are genuinely all blocked, and the reduced-motion frame is captured
with the media preference actually emulated. No class is added by hand to make
a state appear.

| # | Proof | File |
|---|---|---|
| 01 | Compact, at rest | `01-compact-normal.png` |
| 02 | **Hover + keyboard focus** — pointer on row 2's Details, focus ring on Edit | `02-compact-hover-and-focus.png` |
| 03 | **Fast Edit active** — the mode band, the ringed table, the disabled row actions | `03-fast-edit-active.png` |
| 04 | Fast Edit, a cell focused | `04-fast-edit-input-focused.png` |
| 05 | Five rows selected | `05-multiple-selected.png` |
| 06 | **Selected Items scope active** — the APPLY TO control, the active segment, the selection bar and the ticked rows, all in one frame | `06-selected-scope-active.png` |
| 07 | Bulk Edit shut, header hovered | `07-bulk-collapsed-hover.png` |
| 08 | Bulk Edit open, Pricing Entry expanded | `08-bulk-open.png` |
| 09 | Details open | `09-details-open.png` |
| 10 | History open | `10-history-open.png` |
| 11 | Previous Price state | `11-previous-price-state.png` |
| 12 | View control focused, then Expanded | `12a-view-control-focused.png`, `12b-expanded.png` |
| 13 | Add-to-quotation enabled and focused | `13-add-cta-focused.png` |
| 14 | **Add-to-quotation genuinely disabled** | `14-add-cta-disabled.png` |
| 15 | Laptop 1280 | `15-laptop-1280.png` |
| 16 | Tablet 820, phone 430 | `16a-tablet-820.png`, `16b-phone-430.png` |
| 17 | **Reduced motion** — frame plus computed durations | `17-reduced-motion.png`, `17-reduced-motion.json` |

## On frame 06 — a frame that asserts its own claim

The first version of this frame proved nothing. Ticking a box scrolls it into
view, so by the fifth tick the list had carried `APPLY TO` off the top of the
shot — leaving a picture captioned *Selected Items scope active* in which the
scope control was not visible at all.

The body is returned to the top before the shot now, the window is tall enough
to hold the scope control and the ticked rows together, and the four things the
frame exists to show are **measured inside the captured box before it is
written**: the `APPLY TO` label in frame, the active segment in frame and
reading `Selected Items`, at least two ticked boxes visible, at least two
selected-row states visible, and the selection bar in frame. If any of them is
missing the script throws and no file is produced.

Both sides of the pair were recaptured the same way — the `before/` frame from
the accepted baseline's own `index.php`, restored and verified by blob
afterwards — so the comparison is like for like.

## On frame 14 — why the CTA is disabled here and not elsewhere

The accepted rule is `blocked >= live`: one row short of a diameter holds up
itself, not the list, so the 16-item list keeps Add enabled **by design**. The
state that disables it is a list where every row is blocked. Frame 14 uses four
M24 undersize rows — a size with no diameter in the tables — so all four are
blocked and Add refuses. The script asserts `disabled === true` and fails the
run if it is not, so the frame cannot quietly become a picture of an enabled
button.

## On frame 17 — motion a screenshot cannot show

A still frame cannot prove a transition was skipped, so the durations are read
out of the live page under `prefers-reduced-motion: reduce` and written beside
it. Every measured control reports `1e-06s` — the sheet's global reduced-motion
rule — so nothing this round added animates for a person who asked for less
motion.

The first attempt at this frame was wrong and is worth recording: the harness
builds its page with `browser.newPage({viewport})` and forwards nothing else,
so a context-level `reducedMotion` was silently dropped and the frame reported
full 140–180ms durations while claiming to be reduced-motion evidence. It is
now asked of the page directly with `emulateMedia`, which cannot be ignored.

## What to compare

- **02** — before, hovering Details lit the whole row and left the button
  looking inert; after, the control under the pointer is the strongest thing on
  the line and the row only tints faintly.
- **03** — before, Details / History / × looked fully live during Fast Edit
  although they were already disabled; after, they look held, and the mode
  itself is marked.
- **06** — the tick, the row tint and the leading marker read as one statement.
