import { describe, expect, it } from 'vitest';
import {
    accessorySummary,
    accessoryUnitTotal,
    accessoryWording,
    buildAccessories,
    readAccessoryQty,
    wasAccessoryWording,
    type AccessoryInput,
} from './accessories';
import { assertedCases, r9 } from './golden-coverage';

type Out = { nutQty: number | null; fwQty: number | null; accessoryUnitTotal: number; cwLabel: string | null };

describe('golden: accessories', () => {
    const cases = assertedCases<AccessoryInput, Out>('accessories');
    it.each(cases.map((c) => [`${JSON.stringify(c.input)} [${c.cls}]`, c] as const))('%s', (_n, c) => {
        const a = buildAccessories(c.input);
        expect({
            nutQty: a.nut.enabled ? a.nut.qty : null,
            fwQty: a.fw.enabled ? a.fw.qty : null,
            accessoryUnitTotal: r9(accessoryUnitTotal(a)),
            cwLabel: accessoryWording(a),
        }).toEqual(c.expected);
    });
});

describe('accessories: qty reading and wording', () => {
    it('blank ⇒ default; explicit 0 stays 0; numbers kept', () => {
        expect(readAccessoryQty('', 2)).toBe(2);
        expect(readAccessoryQty(null, 1)).toBe(1);
        expect(readAccessoryQty(undefined, 2)).toBe(2);
        expect(readAccessoryQty('0', 2)).toBe(0);
        expect(readAccessoryQty(0, 1)).toBe(0);
        expect(readAccessoryQty(' 4 ', 2)).toBe(4);
        expect(readAccessoryQty('abc', 2)).toBe(2);
    });
    it('a zero-qty accessory beside a real one adds no money and no wording', () => {
        const a = buildAccessories({ nut: { qty: '0', price: '0.50' }, fw: { qty: '2', price: '0.10' } });
        expect(accessoryUnitTotal(a)).toBeCloseTo(0.2, 12);
        expect(accessoryWording(a)).toBe('cw 2fw');
        expect(wasAccessoryWording(a)).toBe('cw 2fw');
    });
    it('no accessories ⇒ null wording; custom text joins with " + " on a WAS', () => {
        expect(accessoryWording(buildAccessories({}))).toBeNull();
        expect(accessoryWording(null)).toBeNull();
        const a = buildAccessories({ nut: { qty: '', price: '0.5' }, custom: { text: 'welding', price: '1' } });
        expect(accessoryWording(a)).toBe('cw 2nut\ncw welding');
        expect(wasAccessoryWording(a)).toBe('cw 2nut + welding');
    });
    it('reads a saved legacy accessory record (qty missing ⇒ legacy default)', () => {
        expect(accessoryWording({ nut: { enabled: true, unitPrice: 1 }, fw: { enabled: true, qty: 1, unitPrice: 0.3 }, custom: { enabled: false } })).toBe('cw 2nut & 1fw');
    });
    it('compact summary (§18)', () => {
        expect(accessorySummary(buildAccessories({ nut: { qty: '2', price: '0.20', finish: 'ZP' } }))).toEqual(['Nut ×2 · ZP · RM0.20']);
    });
});
