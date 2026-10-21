import { type GoldenCase, type GoldenClass, loadGolden } from './golden';

/* Test support: WHICH golden cases the engine tests assert. Every family test
   iterates `assertedCases(family)`, and coverage.test.ts counts the same
   selection per class — so the coverage table is the assertion set, not a
   claim about it. Node-only (via golden.ts); never imported by application code. */

/** Families the Wave 1 engine asserts case-by-case. */
export const ENGINE_FAMILIES = [
    'rounding',
    'size',
    'diameter',
    'weight',
    'pricing',
    'was',
    'accessories',
    'defaultPrice',
    'tlSurcharge',
    'sagrodTL',
    'material',
    'output',
] as const;

/** Families deliberately NOT asserted in Wave 1 (load-only): Quick Add parser (Wave 3), history ranking (server-side, later wave). */
export const DEFERRED_FAMILIES = ['quickAdd', 'history'] as const;

export type EngineFamily = (typeof ENGINE_FAMILIES)[number];

/** The cases a family test asserts: every case except a parser knownFailure. */
export function assertedCases<I = any, O = any>(family: EngineFamily): GoldenCase<I, O>[] {
    return loadGolden<I, O>(family).filter((c) => !c.knownFailure);
}

export function countByClass(cases: readonly GoldenCase[]): Record<GoldenClass | 'composite', number> {
    const out: Record<GoldenClass | 'composite', number> = { A: 0, B: 0, C: 0, composite: 0 };
    for (const c of cases) {
        if (c.cls === 'A' || c.cls === 'B' || c.cls === 'C') out[c.cls]++;
        else out.composite++;
    }
    return out;
}

/** Golden values are stored rounded to 9 dp by the R0b harness (r6 = Math.round(v·1e9)/1e9). */
export function r9(v: number): number {
    return Math.round(v * 1e9) / 1e9;
}
