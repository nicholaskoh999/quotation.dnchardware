import { describe, expect, it } from 'vitest';
import { goldenFamilies, loadGolden } from './golden';
import { DEFERRED_FAMILIES, ENGINE_FAMILIES, assertedCases, countByClass } from './golden-coverage';

/* Coverage is the assertion set: every family test iterates assertedCases(family),
   and this file counts exactly that selection. Every B and C case of an engine
   family must be in it. */
describe('golden coverage', () => {
    it('every golden family is either asserted by the engine or explicitly deferred', () => {
        const known = new Set<string>([...ENGINE_FAMILIES, ...DEFERRED_FAMILIES]);
        expect(goldenFamilies().filter((f) => !known.has(f))).toEqual([]);
    });

    it.each(ENGINE_FAMILIES)('%s: every B and C case is asserted; no case is skipped', (family) => {
        const all = loadGolden(family);
        const asserted = assertedCases(family);
        const bc = all.filter((c) => c.cls === 'B' || c.cls === 'C');
        for (const c of bc) expect(asserted).toContainEqual(c);
        expect(asserted.length).toBe(all.filter((c) => !c.knownFailure).length);
        expect(all.some((c) => c.knownFailure)).toBe(false);
    });

    it('per-class table', () => {
        const rows = ENGINE_FAMILIES.map((family) => ({ family, ...countByClass(assertedCases(family)) }));
        const total = rows.reduce((t, r) => ({ A: t.A + r.A, B: t.B + r.B, C: t.C + r.C, composite: t.composite + r.composite }), { A: 0, B: 0, C: 0, composite: 0 });
        // eslint-disable-next-line no-console
        console.table([...rows, { family: 'TOTAL', ...total }]);
        // Pinned so a silently dropped case fails the build.
        expect(total).toEqual({ A: 472, B: 19, C: 46, composite: 1 });
    });
});
