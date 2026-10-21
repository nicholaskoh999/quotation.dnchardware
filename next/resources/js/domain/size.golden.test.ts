import { describe, expect, it } from 'vitest';
import { assertedCases } from './golden-coverage';
import { MAX_METRIC_NOMINAL, inchKey, interpretSize, isKnownSize, nominalDiameter, normalizeSizeValue, sizeDisplay } from './size';

type Legacy = { normalised: string; known: boolean; display: string; inchKey: string; nominalDiameter: number | null };
type Expected = { normalised: string; system: string; needsReview: boolean };

describe('golden: size', () => {
    const cases = assertedCases<string, Legacy>('size');
    it.each(cases.map((c) => [`${JSON.stringify(c.input)} [${c.cls}]`, c] as const))('%s → expected', (_n, c) => {
        const got = interpretSize(c.input);
        const exp = c.expected as unknown as Expected;
        expect({ normalised: got.normalised, system: got.system, needsReview: got.needsReview }).toEqual(exp);
    });

    /* The legacy readers themselves are ported faithfully: they reproduce `legacy` for every case
       (including the B case — the owner rule lives in interpretSize, not in the legacy reader). */
    it.each(cases.map((c) => [JSON.stringify(c.input), c] as const))('%s: legacy readers reproduce the oracle', (_n, c) => {
        const n = normalizeSizeValue(c.input);
        expect({ normalised: n, known: isKnownSize(n), display: sizeDisplay(n), inchKey: inchKey(n), nominalDiameter: nominalDiameter(n) }).toEqual(c.legacy);
    });
});

describe('size: interpretation', () => {
    it('shows the interpretation chip', () => {
        expect(interpretSize('12').label).toBe('M12 · Metric');
        expect(interpretSize('1/2').label).toBe('1/2" · Imperial');
        expect(interpretSize('72').label).toBe('72 · Needs Review');
        expect(interpretSize('1/2').display).toBe('1/2"');
    });
    it('only a BARE number beyond the largest metric size escapes normalisation', () => {
        expect(MAX_METRIC_NOMINAL).toBe(65);
        expect(interpretSize('65').normalised).toBe('M65');
        expect(interpretSize('66').normalised).toBe('66');
        expect(interpretSize('72mm').reviewReason).toBe('bare_number_out_of_range');
        expect(interpretSize('M72')).toMatchObject({ normalised: 'M72', system: 'metric', needsReview: true });
    });
});
