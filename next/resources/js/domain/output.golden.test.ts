import { describe, expect, it } from 'vitest';
import {
    buildWhatsAppItemsText,
    buildWhatsAppMessage,
    customerUnitPrice,
    grandTotal,
    groupWhatsAppItems,
    itemDescription,
    itemDimension,
    itemGroupTitle,
    printLines,
    whatsappOutput,
    WHATSAPP_DEFAULT_TEMPLATE,
    type OutputItem,
    type QuotationMeta,
} from './description';
import { assertedCases } from './golden-coverage';

type PerItem = { no: number; waGroupTitle: string; printDescription: string; printDimension: string; customerUnitPrice: number };
type Legacy = {
    perItem: PerItem[];
    whatsappPreviewItems: string;
    whatsappSentText: string;
    whatsappCopyWithWeight: string;
    grandTotal: number;
    defaultTemplate: string;
};
type OutputCase = {
    input: { items: OutputItem[]; meta: QuotationMeta };
    legacy: Legacy;
    checks: { noCostAddMarkupLeak: boolean; previewEqualsSent: boolean };
    divergences: { cls: string; ref: string; topic: string }[];
};

/* B-8 (§14): the owner wording that replaces the legacy hardened titles. */
const HARDENED_WORDING: Record<string, string> = {
    'S45C + HARDEN = G8.8 STUD (PL)': 'S45C STUD · HARDENED TO G8.8 (PL)',
    '4140 QT + HARDEN = G10.9 STUD (PL)': '4140 QT STUD · HARDENED TO G10.9 (PL)',
};
const owner = (s: string): string => Object.entries(HARDENED_WORDING).reduce((t, [a, b]) => t.split(a).join(b), s);

const [raw] = assertedCases('output');
const golden = raw as unknown as OutputCase;
const { items, meta } = golden.input;

describe('golden: output (6-item quotation)', () => {
    it('declares the B divergences this engine implements (§26 preview ≡ sent, §14 wording)', () => {
        const b = golden.divergences.filter((d) => d.cls === 'B').map((d) => d.ref).sort();
        expect(b).toEqual(['§14', '§26']);
        expect(golden.checks.previewEqualsSent).toBe(false); // the legacy defect being fixed
    });

    it.each(golden.legacy.perItem.map((p) => [p.no, p] as const))('item %i: description / dimension / price (hardened → §14)', (_no, p) => {
        const item = items[p.no - 1] as OutputItem;
        const isB = p.waGroupTitle in HARDENED_WORDING;
        const expected: PerItem = isB ? { ...p, waGroupTitle: owner(p.waGroupTitle), printDescription: owner(p.printDescription) } : p;
        expect({
            no: p.no,
            waGroupTitle: itemGroupTitle(item),
            printDescription: itemDescription(item),
            printDimension: itemDimension(item),
            customerUnitPrice: customerUnitPrice(item),
        }).toEqual(expected);
    });

    it('B-9: ONE text for preview and send — equal to what legacy actually sent (with §14 wording)', () => {
        const out = whatsappOutput(items, meta);
        expect(out.preview).toBe(out.sent);
        expect(out.sent).toBe(owner(golden.legacy.whatsappSentText));
        expect(out.preview).not.toContain('1, 3)'); // never merges two items into one row
    });

    it('copy with weight equals the legacy copy (with §14 wording)', () => {
        const out = whatsappOutput(items, meta, { includeUnitWeight: true });
        expect(out.sent).toBe(owner(golden.legacy.whatsappCopyWithWeight));
        expect(out.preview).toBe(out.sent);
    });

    it('grand total and default template match legacy', () => {
        expect(grandTotal(items)).toBeCloseTo(golden.legacy.grandTotal, 9);
        expect(WHATSAPP_DEFAULT_TEMPLATE).toBe(golden.legacy.defaultTemplate);
    });

    it('never leaks Cost Rate / Additional Cost / Markup', () => {
        expect(golden.checks.noCostAddMarkupLeak).toBe(true);
        const leaky = items.map((i) => ({ ...i, costRate: '9.87', addCost: '6.54', markup: 32.1, formData: { costRate: '9.87', addCost: '6.54', markup: '32.1' } }));
        const texts = [
            whatsappOutput(leaky, meta).sent,
            whatsappOutput(leaky, meta, { includeUnitWeight: true }).sent,
            JSON.stringify(printLines(leaky)),
        ].join('\n');
        expect(texts).not.toMatch(/9\.87|6\.54|32\.1|markup|cost rate|additional cost/i);
    });

    it('insertion-order numbering is preserved in print and in both WhatsApp groupings', () => {
        expect(printLines(items).map((l) => l.no)).toEqual([1, 2, 3, 4, 5, 6]);
        const byTitle = groupWhatsAppItems(items, { grouping: 'byTitle' });
        expect(byTitle.map((g) => g.rows.map((r) => r.no))).toEqual([[1, 3], [2], [4], [5], [6]]);
        const text = buildWhatsAppItemsText(items, { grouping: 'byTitle' });
        expect(text).toContain('MS UNDERSIZE SAG ROD (ZP)\n1) M12 x L 1000 x TL 100/100mm - RM2.50\n3) M12 x L 1000 x TL 100/100mm - RM2.50');
        expect(groupWhatsAppItems(items).map((g) => g.rows.map((r) => r.no))).toEqual([[1], [2], [3], [4], [5], [6]]);
    });

    it('an empty quotation reads "-" in the items block', () => {
        expect(buildWhatsAppMessage([], {})).toContain('Items:\n-\n');
    });
});
