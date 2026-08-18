# STAGE 0B — ACCESSORY-INCLUSIVE FINAL UNIT PRICE · EVIDENCE

Captured by `tests/accessory-inclusive-shots.js`, driving the shipped
`index.php` through the project's own test harness on Nicholas's own case:

```
MS UNDERSIZE SAG ROD HDG · M12 x L1000 x TL100/100 · Qty 10
  rod          RM  5.76      0.6927443kg × RM6.50 + RM0.30, +20%
  2 HDG nuts   RM  2.00
  ─────────────────────────
  FINAL UNIT   RM  7.76      line total RM 77.60
```

**Every figure below was asserted by the capture script before its frame was
written, and the run fails if any of them moves.** The exact values it read are
in `evidence/FACTS.json`. A toast is dismissed and the dismissal is verified
before each shot, so no frame carries a message from the step that set it up.

| # | Proof | File |
|---|---|---|
| 01 | The rod alone — **RM 5.76** under a *Final Unit Price* headline, and no "Includes accessories" line, because there is nothing to include | `01-calculator-no-accessories.png` |
| 02 | Two HDG nuts ticked — **RM 7.76**, with **Includes accessories: RM 2.00** under it | `02-calculator-inclusive-7.76.png` |
| 03 | The whole calculator panel around it, so the figure is read in its own context | `03-calculator-full-panel.png` |
| 04 | 中文 — **最终单价 RM 7.76**, **已含配件：RM 2.00**, from the same translation key | `04-calculator-chinese.png` |
| 05 | The quotation item card — `Unit RM 7.76`, with `Bolt RM 5.76/pc` and `Accessories RM 2.00/pc` as internal breakdown, over a `RM 77.60` line total | `05-quotation-item-card.png` |
| 06 | The WhatsApp / copied text — `M12 x L 1000 x TL 100/100mm - RM7.76` then plain `cw 2nut`, with **no** accessory RM figure of its own | `06-whatsapp-copied-text.png` |
| 07 | The print / PDF preview — **ONE** priced row, Unit Price `RM 7.76`, Amount `RM 77.60`, accessories as wording in the description cell, Grand Total `RM 77.60` | `07-print-preview.png` |
| 08 | Saved and reopened — the same RM 7.76 / RM 5.76 / RM 2.00 / RM 77.60, nothing drifting across the round trip | `08-saved-reopened.png` |
| 09 | **Migration.** A quotation saved under the superseded `bolt-separate` rule (RM30.00 rod + RM0.70 nuts, RM307.00 for ten) reopens on the **same RM 307.00**, reading as `Unit RM 30.70` with `Bolt RM 30.00/pc` beside it | `09-bolt-separate-reopened.png` |
| 10 | The same item edited and re-saved — still **RM 307.00**. The accessories are not charged a second time | `10-bolt-separate-resaved.png` |

## What frames 09 and 10 are for

The one way this change could quietly cost money is a quotation that was already
sent. A `bolt-separate` item stored the **rod** in `finalUnitPrice` and the
customer's line in `lineUnitPrice`; read naively under the new rule its rod price
would become the customer's price and RM0.70 a piece would vanish, or its
accessories would be added a second time and the line would rise.

So such an item is normalised once, on load, and the total it was **saved** with
is the total that wins. Frame 09 is that quotation reopened; frame 10 is it
edited and committed again. Both read RM 307.00, which is what the customer
agreed to.
