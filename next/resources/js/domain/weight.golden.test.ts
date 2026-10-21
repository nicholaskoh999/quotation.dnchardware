import { describe, expect, it } from 'vitest';
import { computeGeometry, eyeBoltSuggestedDevelopedLength, jHookSuggestedDevelopedLength } from './geometry';
import { assertedCases, r9 } from './golden-coverage';
import { type GoldenGeometryInput as In, geometryFromGoldenInput } from './golden-inputs';
import { rodWeight } from './weight';

describe('golden: weight', () => {
    const cases = assertedCases<In, { developedLength: number | null; weight: number }>('weight');
    it.each(cases.map((c) => [`${c.input.type} ${JSON.stringify(c.input)} [${c.cls}]`, c] as const))('%s', (_n, c) => {
        const g = geometryFromGoldenInput(c.input);
        expect({ developedLength: g.developedLength, weight: r9(g.weight) }).toEqual(c.expected);
    });
});

describe('geometry: J Hook (§19) and Eye Bolt (§20)', () => {
    it('J Hook: L + W is only a suggestion — no developed length (and no weight) until one is entered', () => {
        const g = computeGeometry({ product: 'jhook', diameter: 12, l: 300, w: 80 });
        expect(g.suggestedDevelopedLength).toBe(380);
        expect(g.developedLength).toBeNull();
        expect(g.weight).toBe(0);
        const typed = computeGeometry({ product: 'jhook', diameter: 12, l: 300, w: 80, developedLength: 395.2 });
        expect(typed.developedLength).toBe(395.2);
        expect(typed.weighedLength).toBe(396);
        expect(typed.weight).toBe(rodWeight(12, 396));
        expect(typed.suggestedDevelopedLength).toBe(380); // still offered, never forced
        expect(jHookSuggestedDevelopedLength('', 80)).toBeNull();
    });
    it('Eye Bolt with S: J Bolt formula with H := L as an editable suggestion (OG-2); without S: manual only', () => {
        // same numbers as the J Bolt golden case (d20 H910 ID60 S150 → 1086)
        expect(eyeBoltSuggestedDevelopedLength(20, 910, 60, 150)).toBe(1086);
        const g = computeGeometry({ product: 'eyebolt', diameter: 20, l: 910, id: 60, s: 150 });
        expect(g.suggestedDevelopedLength).toBe(1086);
        expect(g.developedLength).toBeNull();
        expect(computeGeometry({ product: 'eyebolt', diameter: 20, l: 910, id: 60 }).suggestedDevelopedLength).toBeNull();
        expect(computeGeometry({ product: 'eyebolt', diameter: 20, l: 910, id: 60, developedLength: 1000 }).weight).toBe(rodWeight(20, 1000));
    });
    it('a formula that gives ≤ 0 is no length', () => {
        expect(computeGeometry({ product: 'lbolt', diameter: 0, l: 0, w: 0 }).developedLength).toBeNull();
        expect(computeGeometry({ product: 'ubolt', diameter: 10, id: 10, ih: 0 }).developedLength).toBe(Math.ceil(20 * 1.57 - 10));
    });
});
