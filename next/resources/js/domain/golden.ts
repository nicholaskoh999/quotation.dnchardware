import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/* Loader for the R0b golden fixtures (repository root fixtures/golden). Test
   support only — Node fs, never imported by application code. */
export type GoldenClass = 'A' | 'B' | 'C';
export interface GoldenCase<I = unknown, O = unknown> {
    input: I;
    legacy: O;
    expected: O;
    cls: GoldenClass;
    ref?: string;
    gate?: string;
    note?: string;
    knownFailure?: boolean;
}

export const GOLDEN_DIR = resolve(__dirname, '../../../../fixtures/golden');

export function goldenFamilies(): string[] {
    return readdirSync(GOLDEN_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''))
        .sort();
}

export function loadGolden<I = any, O = any>(family: string): GoldenCase<I, O>[] {
    const raw = JSON.parse(readFileSync(join(GOLDEN_DIR, `${family}.json`), 'utf8')) as { cases: unknown };
    const cases = raw.cases;
    return (Array.isArray(cases) ? cases : [cases]) as GoldenCase<I, O>[];
}
