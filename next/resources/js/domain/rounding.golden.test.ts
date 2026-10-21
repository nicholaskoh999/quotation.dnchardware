import { describe, expect, it } from 'vitest';
import { assertedCases } from './golden-coverage';
import { ROUNDING_RULES, applyRounding, round05, roundCustom10, roundForProduct, roundMoney2 } from './rounding';
import { PRODUCT_TYPES } from './products';

type RoundingCase = { fn: 'round05' | 'roundCustom10' | 'roundMoney2' };
const FNS = { round05, roundCustom10, roundMoney2 } as const;

describe('golden: rounding', () => {
    const cases = assertedCases<number, number>('rounding');
    it.each(cases.map((c) => [`${(c as unknown as RoundingCase).fn}(${c.input}) [${c.cls}]`, c] as const))('%s', (_n, c) => {
        const fn = FNS[(c as unknown as RoundingCase).fn];
        expect(fn(c.input)).toBe(c.expected);
    });
});

/* Property / edge tests around the boundaries the golden file pins. */
describe('rounding: properties and boundaries', () => {
    const sen = (n: number): number => n / 100;

    it('round05 only ever moves a last sen digit of 9 up and 1 down', () => {
        for (let c = 0; c <= 2000; c++) {
            const v = sen(c);
            const r = round05(v);
            const last = c % 10;
            if (last === 9) expect(r).toBe(Math.round((v + 0.01) * 10) / 10);
            else if (last === 1) expect(r).toBe(Math.floor(v * 10) / 10);
            else expect(r).toBe(v);
        }
    });

    it('round05 result never moves by more than 1 sen and stays a 2 dp figure', () => {
        for (let i = 0; i < 5000; i++) {
            const v = (i * 7.3197) % 500;
            const r = round05(v);
            expect(Math.abs(r - v)).toBeLessThanOrEqual(0.015 + 1e-9);
            expect(Math.round(r * 100) / 100).toBe(r);
        }
    });

    it('roundCustom10 rounds sen 0–3 down and 4–9 up to the next 10 sen', () => {
        for (let c = 0; c <= 3000; c++) {
            const v = sen(c);
            const last = c % 10;
            const want = (last <= 3 ? c - last : c + (10 - last)) / 100;
            expect(roundCustom10(v)).toBe(want);
        }
    });

    it('roundCustom10 is monotonic and always lands on a 10-sen step', () => {
        let prev = -Infinity;
        for (let i = 0; i <= 20000; i++) {
            const v = i * 0.00137;
            const r = roundCustom10(v);
            expect(r).toBeGreaterThanOrEqual(prev);
            expect(Math.round(r * 100) % 10).toBe(0);
            prev = r;
        }
    });

    it('roundMoney2 keeps legacy float behaviour (1.005 → 1, 2.675 → 2.68, non-numbers → 0)', () => {
        expect(roundMoney2(1.005)).toBe(1);
        expect(roundMoney2(2.675)).toBe(2.68);
        expect(roundMoney2('3.456')).toBe(3.46);
        expect(roundMoney2('abc')).toBe(0);
        expect(roundMoney2(undefined)).toBe(0);
    });

    it('every product has a rule; legacy mapping is exact; J Hook / Eye Bolt carry no product rule yet (OG-B1)', () => {
        for (const p of PRODUCT_TYPES) expect(ROUNDING_RULES[p]).toBeDefined();
        for (const p of ['sagrod', 'stud', 'anchorbolt', 'plate', 'was'] as const) expect(ROUNDING_RULES[p]).toBe('round05');
        for (const p of ['ubolt', 'squbolt', 'lbolt', 'lbolt45', 'jbolt'] as const) expect(ROUNDING_RULES[p]).toBe('roundCustom10');
        for (const p of ['others', 'jhook', 'eyebolt'] as const) expect(ROUNDING_RULES[p]).toBe('money2');
        expect(roundForProduct('ubolt', 2.753557277)).toBe(2.8);
        expect(roundForProduct('sagrod', 2.539684163)).toBe(2.54);
        expect(roundForProduct('jhook', 2.753557277)).toBe(2.75);
        expect(applyRounding('money2', 3.452988)).toBe(3.45);
    });
});
