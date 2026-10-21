import { describe, expect, it } from 'vitest';
import {
    MS_FULLSIZE_HDG_RATE_HINT,
    MS_SAGROD_FULLSIZE_RATES,
    findDefaultPrice,
    systemDefaultPriceRules,
    tlSurchargeApplies,
} from './defaults';
import { assertedCases } from './golden-coverage';

type In = { type: string; material: string; sizeType: string; size: string; finish: string };

describe('golden: defaultPrice', () => {
    const cases = assertedCases<In, unknown>('defaultPrice');
    it.each(cases.map((c) => [`${c.input.type} ${c.input.material} ${c.input.sizeType || '-'} ${c.input.size} ${c.input.finish} [${c.cls}]`, c] as const))(
        '%s',
        (_n, c) => {
            const { type, material, sizeType, size, finish } = c.input;
            expect(findDefaultPrice(type, material, sizeType, size, finish)).toEqual(c.expected);
        },
    );
});

describe('default price: built-ins and custom rules', () => {
    it('B-2 rates are single numbers; the range is a hint string only', () => {
        expect(MS_SAGROD_FULLSIZE_RATES).toEqual({ PL: 3.5, ZP: 5, HDG: 6.5 });
        expect(typeof MS_FULLSIZE_HDG_RATE_HINT).toBe('string');
        expect(MS_FULLSIZE_HDG_RATE_HINT).toBe('Typical historical range RM6.50–RM7.00/kg');
        for (const r of systemDefaultPriceRules()) expect(typeof r.costRate).toBe('number');
    });
    it('reads canonical materials and un-normalised sizes', () => {
        expect(findDefaultPrice('sagrod', '4140 QT', 'UNDERSIZE', '16', 'ZP')).toEqual({ costRate: 9.5, addCost: 2.5, markup: 0, source: 'system' });
        expect(findDefaultPrice('sagrod', 'MS', 'FULLSIZE', 'm12', 'PL')?.costRate).toBe(3.5);
        expect(findDefaultPrice('sagrod', '4140_PLAIN', 'FULLSIZE', 'M12', 'PL')).toBeNull();
    });
    it('a custom rule replaces the system rule with the same identity', () => {
        const custom = [{ type: 'sagrod', material: 'MS', sizeType: 'FULLSIZE', size: 'M12', finish: 'PL', costRate: 3.8, addCost: 0.6, markup: 5, source: 'custom' as const }];
        expect(findDefaultPrice('sagrod', 'MS', 'FULLSIZE', 'M12', 'PL', custom)).toEqual({ costRate: 3.8, addCost: 0.6, markup: 5, source: 'custom' });
        expect(findDefaultPrice('sagrod', 'MS', 'FULLSIZE', 'M16', 'PL', custom)?.costRate).toBe(3.5);
    });
    it('TL surcharge applies to MS non-HDG only (legacy onThreadLenChange)', () => {
        expect(tlSurchargeApplies('MS', 'PL')).toBe(true);
        expect(tlSurchargeApplies('MS', 'HDG')).toBe(false);
        expect(tlSurchargeApplies('4140 QT', 'PL')).toBe(false);
        expect(tlSurchargeApplies('SS304', '')).toBe(false);
    });
});
