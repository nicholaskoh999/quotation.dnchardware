import type { FieldKey } from './compute';
import { emptyDimensions, emptyItem, type DraftItem } from './model';

/* Quick Add DEMO analysis (Owner Smoke #2 Loop #2) — a fixed, local fixture
   that lets the owner see the future review → fix → add flow before the real
   analyzer (Wave 3 · Session I) exists. It is NOT AI output: it ignores the
   input, makes no network call, uploads nothing and stores nothing. Every
   call returns the same two items:

     A  Ready         SAG ROD · MS UNDERSIZE ZP · M12 · Bar Ø 10.7 · L1245 · TL100 · Qty 30
     B  Needs review  L BOLT · 4140 QT FULLSIZE PL · M16 · Bar Ø 17 · L900 · W70 · TL150 · Qty 20
                      (finish and cost rate uncertain — 4140 QT L Bolt has no
                      built-in rate, so the cost rate genuinely needs a person) */

export interface DemoExtractedItem {
    item: DraftItem;
    uncertain: FieldKey[];
    source: string;
}

export const DEMO_LABEL = 'Demo extracted items — not real AI output';

export function demoExtraction(): DemoExtractedItem[] {
    const a = emptyItem('sagrod', 'quick');
    const b = emptyItem('lbolt', 'quick');
    return [
        {
            item: {
                ...a,
                material: 'MS',
                sizeType: 'UNDERSIZE',
                finish: 'ZP',
                size: 'M12',
                diameterOverride: '10.7',
                qty: '30',
                dims: { ...emptyDimensions(), length: '1245', threadLen: '100' },
            },
            uncertain: [],
            source: 'M12 sag rod 10.7 1245 tl100 zp 30pcs',
        },
        {
            item: {
                ...b,
                material: '4140 QT',
                sizeType: 'FULLSIZE',
                finish: 'PL',
                size: 'M16',
                diameterOverride: '17',
                qty: '20',
                dims: { ...emptyDimensions(), l: '900', w: '70', threadLen: '150' },
            },
            uncertain: ['finish', 'costRate'],
            source: 'M16 L bolt 4140 900x70 tl150 20pcs',
        },
    ];
}
