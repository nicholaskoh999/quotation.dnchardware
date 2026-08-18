# STAGE 1 — FINAL UI CLEANUP · EVIDENCE

Captured by `tests/stage-1-shots.js`, driving the shipped `index.php` and
`companies.php` through the project's own test harness.

**Every figure below was asserted by the capture script before its frame was
written, and the run fails if any of them moves.** The exact values it read are
in `evidence/FACTS.json`. A toast is dismissed and the dismissal verified before
each shot, so no frame carries a message from the step that set it up.

The before/after pair is produced from the **same page**, by re-asserting the
pre-Stage-1 geometry on the element — so the two frames differ by this round's
change and by nothing else.

| # | Proof | File |
|---|---|---|
| 01a | **430px, BEFORE.** `APPLY TO:` stranded at x=340.5 while the buttons it names sit at x=22.6 — **318px apart**, on different lines. The label reads against the Bulk Edit button; All Items / Selected Items read as belonging to nothing | `01a-430-apply-to-before.png` |
| 01b | **430px, AFTER.** Label at x=22.6, buttons at x=22.6 — directly above, left edges aligned, 9px apart. Page overflow **0px** | `01b-430-apply-to-after.png` |
| 02 | The whole 430px review, with no horizontal overflow | `02-430-review-no-overflow.png` |
| 03 | **1440px — unchanged.** The bar still holds label and control on one line, exactly as UI POLISH 1 and 2 left it | `03-desk-1440-unchanged.png` |
| 04 | Companies header at 430px — the language buttons are **44 × 44** (were 30.6 × 40 and 39 × 40) | `04-companies-430-header.png` |
| 05 | The whole Companies page at 430px, no horizontal overflow | `05-companies-430-page.png` |
| 06 | Companies modal at 430px — the **× is 44 × 44** (was 17 × 24) and every field is 44 tall | `06-companies-430-modal-actions.png` |
| 07 | **Companies at 1440px — unchanged.** Language button still 40 tall, × still **24 × 17**. The phone rule has not leaked onto the desk | `07-companies-desk-unchanged.png` |
| 08 | Numbering on screen — items 1–4, list reading Newest First | `08-numbering-screen.png` |
| 09 | Numbering in the WhatsApp message — grouped by material, numbers `1, 3` then `2, 4` | `09-numbering-whatsapp.png` |
| 10 | Numbering on the printed sheet — `1, 2, 3, 4` in insertion order | `10-numbering-print.png` |

## What frames 08–10 establish

**Identity is already consistent. Order is not, and that is deliberate.**

The same rod carries the same number on all three surfaces — M12 x L 1000 is
item 1 on screen, on paper and in the message; M20 x L 1500 is item 3 on all
three. What differs is the sequence they are read in:

| surface | reads | why |
|---|---|---|
| Print | `1, 2, 3, 4` | insertion order |
| Screen | `4, 3, 2, 1` | Newest First is the default view, and the source states sorting is view-only and must never renumber |
| WhatsApp | `1, 3` · `2, 4` | grouped by material and finish; each row carries its own item number rather than its position in the message |

Making these agree would change generated output — a data-generation change,
which Stage 1 was instructed not to make. **Verified here, ordering deferred to
Stage 2.**

## Deferred to Stage 2

| | |
|---|---|
| **Dark mode** | There is none to polish. `data-theme="light"` is hardcoded on all three pages, with zero `prefers-color-scheme` colour rules, zero `[data-theme="dark"]` rules and no toggle. Building one is a second 38-token palette across three pages plus re-proving every UI POLISH 1/2 state inside it. Raised before any byte was touched; deferred by Nicholas's decision |
| **Numbering order** | See above — needs a data-generation change |
| `index.php` sidebar toggle (34 × 34) and step pills (36px) | Recorded, not repaired: this round's tap-target goal names the Companies screens, and widening the header would move accepted density |
