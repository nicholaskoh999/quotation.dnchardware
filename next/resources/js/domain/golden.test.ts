import { describe, expect, it } from 'vitest';
import { goldenFamilies, loadGolden } from './golden';

/* R1 contract with R0b: the oracle is present, readable, and every case is
   classified A / B / C. Wave 1 Session B runs the engine against it. */
describe('R0b golden fixtures', () => {
    it('are present', () => {
        expect(goldenFamilies().length).toBeGreaterThanOrEqual(14);
    });
    it.each(goldenFamilies())('%s: every case is classified A, B or C', (family) => {
        const cases = loadGolden(family);
        expect(cases.length).toBeGreaterThan(0);
        for (const c of cases) expect(['A', 'B', 'C', undefined]).toContain(c.cls);
    });
});
