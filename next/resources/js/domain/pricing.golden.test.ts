import { describe, expect, it } from 'vitest';
import { assertedCases, r9 } from './golden-coverage';
import { computeGeometry } from './geometry';
import {
    itemBoltUnit,
    itemFinalUnit,
    lineMoney,
    migrateItemPricing,
    msUndersizeSagRodPriceList,
    normalizePriceMode,
    priceItem,
} from './pricing';
import type { ProductType } from './products';
import { geometryFromGoldenInput } from './golden-inputs';

type In = Record<string, unknown> & {
    type: ProductType;
    priceMode: string;
    material: string;
    sizeType: string;
    finish: string;
};
type Out = { weight: number; rawUnitPrice: number; roundedUnitPrice: number; accessoriesCost: number; boltUnitPrice: number; finalUnitPrice: number };

/* Recompute through the pricing API from the golden INPUT. */
function priceFromGolden(i: In) {
    const g = i.type === 'others'
        ? computeGeometry({ product: 'others', diameter: i.diameter as number, length: i.length as number })
        : geometryFromGoldenInput(i as never);
    return priceItem({
        product: i.type,
        weight: g.weight,
        costRate: i.costRate as string,
        addCost: i.addCost as string,
        markup: i.markup as string,
        mode: i.priceMode,
        manualUnitPrice: i.manualUnitPrice as string | undefined,
        accessories: i.accessories as never,
        priceList: { material: i.material, sizeType: i.sizeType, finish: i.finish, size: i.size, threadLen: i.threadLen, length: i.length as number },
    });
}

describe('golden: pricing', () => {
    const cases = assertedCases<In, Out>('pricing');
    it.each(cases.map((c) => [`${c.input.type} ${c.input.priceMode} ${c.note ?? ''} [${c.cls}]`, c] as const))('%s', (_n, c) => {
        const r = priceFromGolden(c.input);
        expect({
            weight: r9(r.weight),
            rawUnitPrice: r9(r.rawUnitPrice),
            roundedUnitPrice: r9(r.roundedUnitPrice),
            accessoriesCost: r.accessoriesCost,
            boltUnitPrice: r.boltUnitPrice,
            finalUnitPrice: r.finalUnitPrice,
        }).toEqual(c.expected);
    });

    it('records which capability produced each price (§34 C-3)', () => {
        const src = cases.map((c) => priceFromGolden(c.input).priceSource);
        expect(src).toContain('calculated');
        expect(src).toContain('no_round');
        expect(src).toContain('manual');
        expect(src).toContain('price_list');
    });
});

describe('pricing: modes, price list, saved breakdown', () => {
    const base = { product: 'sagrod' as const, weight: 0.692744344, costRate: '2.80', addCost: '0.60', markup: '0' };

    it('legacy "auto" reads as CALCULATED and is written back as auto', () => {
        expect(normalizePriceMode('auto')).toBe('calculated');
        expect(normalizePriceMode('bogus')).toBe('calculated');
        expect(priceItem({ ...base, mode: 'auto' }).legacyPriceMode).toBe('auto');
    });

    it('produces the breakdown legacy saves (accessory-inclusive)', () => {
        const r = priceItem({ ...base, qty: 10, accessories: { nut: { qty: '2', price: '0.50' }, fw: { qty: '', price: '0.30' } } });
        expect(r).toMatchObject({
            boltUnitPrice: 2.54,
            accessoryUnitPrice: 1.3,
            finalUnitPrice: 3.84,
            lineUnitPrice: 3.84,
            accessoryTotal: 13,
            totalAmount: 38.4,
            pricingModel: 'accessory-inclusive',
            priceSource: 'calculated',
        });
    });

    it('explicit accessory qty 0 adds nothing to the price (B-1)', () => {
        const r = priceItem({ ...base, accessories: { nut: { qty: '0', price: '0.50' } } });
        expect(r.accessoriesCost).toBe(0);
        expect(r.finalUnitPrice).toBe(2.54);
    });

    it('MANUAL wins over the price list; the list survives No Round', () => {
        const priceList = { material: 'MS', sizeType: 'UNDERSIZE', finish: 'PL', size: '12', threadLen: '100 / 100 mm', length: 1000 };
        expect(priceItem({ ...base, priceList, mode: 'no_round' })).toMatchObject({ finalUnitPrice: 4, priceSource: 'price_list', priceListApplied: true });
        expect(priceItem({ ...base, priceList, mode: 'manual', manualUnitPrice: '3.90' })).toMatchObject({ finalUnitPrice: 3.9, priceSource: 'manual', priceListApplied: false });
        expect(msUndersizeSagRodPriceList({ ...priceList, length: 1100 })).toBeNull();
        expect(msUndersizeSagRodPriceList({ ...priceList, finish: 'ZP' })).toBeNull();
        expect(msUndersizeSagRodPriceList({ ...priceList, threadLen: '100' })).toBeNull();
    });

    it('rate fields accept simple expressions like legacy evalExpr', () => {
        expect(priceItem({ ...base, costRate: '2.5+0.3' }).finalUnitPrice).toBe(2.54);
        expect(priceItem({ ...base, costRate: '2,80' }).basePrice).toBe(0.6); // unreadable ⇒ 0, never 2
    });

    it('J Hook / Eye Bolt get no product-specific rounding yet (OG-B1): two decimals', () => {
        const r = priceItem({ product: 'jhook', weight: 0.2006, costRate: '5', addCost: '1.5', markup: '10' });
        expect(r.roundingRule).toBe('money2');
        expect(r.finalUnitPrice).toBe(Math.round(r.rawUnitPrice * 100) / 100);
    });

    it('lineMoney separates the bolt from the customer price', () => {
        expect(lineMoney(10, { nut: { enabled: true, qty: 2, finish: '', unitPrice: 1 } }, 3)).toMatchObject({
            boltUnitPrice: 8, accessoryUnitPrice: 2, finalUnitPrice: 10, accessoryTotal: 6, totalAmount: 30,
        });
    });

    it('reads the three saved pricing vintages as written', () => {
        const inclusive = { pricingModel: 'accessory-inclusive', finalUnitPrice: 7.76, boltUnitPrice: 5.76, accessoryUnitPrice: 2 };
        const separate = { pricingModel: 'bolt-separate', finalUnitPrice: 5.76, accessoryUnitPrice: 2, lineUnitPrice: 7.76, qty: 10, totalAmount: 77.6 };
        const legacy = { finalUnitPrice: 7.76, accessoryUnitPrice: 2 };
        expect([itemFinalUnit(inclusive), itemBoltUnit(inclusive)]).toEqual([7.76, 5.76]);
        expect([itemFinalUnit(separate), itemBoltUnit(separate)]).toEqual([7.76, 5.76]);
        expect([itemFinalUnit(legacy), itemBoltUnit(legacy)]).toEqual([7.76, 7.76]);
        const m = migrateItemPricing({ ...separate, priceMode: 'manual', manualUnitPrice: '5.76' });
        expect(m.foldedManual).toBe(true);
        expect(m.item).toMatchObject({ pricingModel: 'accessory-inclusive', finalUnitPrice: 7.76, boltUnitPrice: 5.76, totalAmount: 77.6, accessoryTotal: 20, manualUnitPrice: '7.76' });
        expect(migrateItemPricing(inclusive).item).toBe(inclusive);
    });
});
