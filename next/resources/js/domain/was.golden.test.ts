import { describe, expect, it } from 'vitest';
import { assertedCases, r9 } from './golden-coverage';
import { priceWAS } from './pricing';

type In = Record<string, unknown>;

function fromGolden(i: In) {
    return priceWAS({
        anchorDiameter: i['ab-diameter'] as number,
        anchorLength: i['ab-length'] as number,
        anchorQty: i['ab-qty'] as number,
        basePlateL: i['bp-l'] as number,
        basePlateW: i['bp-w'] as number,
        basePlateT: i['bp-t'] as number,
        basePlateQty: i['bp-qty'] as number,
        trianglePlateL: i['tp-l'] as number | undefined,
        trianglePlateH: i['tp-h'] as number | undefined,
        trianglePlateT: i['tp-t'] as number | undefined,
        trianglePlateQty: i['tp-qty'] as number | undefined,
        anchorCostRate: i.anchorCostRate as string,
        basePlateCostRate: i.basePlateCostRate as string,
        trianglePlateCostRate: i.trianglePlateCostRate as string | undefined,
        addCost: i.addCost as string,
        markup: i.markup as string,
        accessories: i.accessories as never,
    });
}

describe('golden: was', () => {
    const cases = assertedCases<In, Record<string, number>>('was');
    it.each(cases.map((c, n) => [`case ${n + 1} [${c.cls}]`, c] as const))('%s', (_n, c) => {
        const r = fromGolden(c.input);
        expect({
            setWeight: r9(r.setWeight),
            anchorWeight: r9(r.anchorWeight),
            basePlateWeight: r9(r.basePlateWeight),
            trianglePlateWeight: r9(r.trianglePlateWeight),
            basePrice: r9(r.basePrice),
            accessories: r9(r.accessories),
            rawUnitPrice: r9(r.rawUnitPrice),
            roundedUnitPrice: r.roundedUnitPrice,
            finalUnitPrice: r.finalUnitPrice,
        }).toEqual(c.expected);
    });
});

describe('WAS: accessories inside the markup; modes', () => {
    const base = { anchorDiameter: 18, anchorLength: 600, anchorQty: 4, basePlateL: 250, basePlateW: 250, basePlateT: 12, basePlateQty: 1, anchorCostRate: '4.00', basePlateCostRate: '3.50', addCost: '5.00', markup: '10' };
    it('the WAS exception marks the accessories up', () => {
        const without = priceWAS(base);
        const withAcc = priceWAS({ ...base, accessories: { nut: { qty: '2', price: '0.50' } } });
        expect(withAcc.rawUnitPrice - without.rawUnitPrice).toBeCloseTo(1 * 1.1, 9);
    });
    it('No Round and Manual', () => {
        expect(priceWAS({ ...base, mode: 'no_round' }).finalUnitPrice).toBe(Math.round(priceWAS(base).rawUnitPrice * 100) / 100);
        expect(priceWAS({ ...base, mode: 'manual', manualUnitPrice: '60' })).toMatchObject({ finalUnitPrice: 60, priceSource: 'manual' });
        expect(priceWAS({ ...base, qty: 3 }).totalAmount).toBeCloseTo(priceWAS(base).finalUnitPrice * 3, 9);
    });
});
