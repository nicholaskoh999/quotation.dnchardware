import { describe, expect, it } from 'vitest';
import { tlSurcharge } from './defaults';
import { assertedCases } from './golden-coverage';

describe('golden: tlSurcharge', () => {
    const cases = assertedCases<string, number>('tlSurcharge');
    it.each(cases.map((c) => [`${JSON.stringify(c.input)} [${c.cls}]`, c] as const))('%s', (_n, c) => {
        expect(tlSurcharge(c.input)).toBe(c.expected);
    });
    it('bands meet: 120 ⇒ 0.60, 120.0001 ⇒ 1.00, 200 ⇒ 1.00, 200.0001 ⇒ 0', () => {
        expect(tlSurcharge('120')).toBe(0.6);
        expect(tlSurcharge('120.0001')).toBe(1);
        expect(tlSurcharge('200')).toBe(1);
        expect(tlSurcharge('200.0001')).toBe(0);
        expect(tlSurcharge(null)).toBe(0);
    });
});
