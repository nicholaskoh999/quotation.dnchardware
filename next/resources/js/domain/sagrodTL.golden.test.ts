import { describe, expect, it } from 'vitest';
import { assertedCases } from './golden-coverage';
import { canonicalSagRodTL, sagRodDimension } from './sagrod';

/* The harness adds MS UNDERSIZE M12 Ø10.6 L1000 through the manual add path. */
describe('golden: sagrodTL', () => {
    const cases = assertedCases<{ threadLen: string }, { size: string; threadLen: string }>('sagrodTL');
    it.each(cases.map((c) => [`${JSON.stringify(c.input.threadLen)} [${c.cls}]`, c] as const))('%s', (_n, c) => {
        const threadLen = canonicalSagRodTL(c.input.threadLen);
        const size = sagRodDimension({ size: 'M12', diameter: 10.6, sizeType: 'UNDERSIZE', length: 1000, threadLen: c.input.threadLen });
        expect({ size, threadLen }).toEqual(c.expected);
    });
    it('canonicalises a single TL (with or without mm) and keeps a/b', () => {
        expect(canonicalSagRodTL(' 100 mm ')).toBe('100/100');
        expect(canonicalSagRodTL('62.5')).toBe('62.5/62.5');
        expect(canonicalSagRodTL('100/100')).toBe('100/100');
        expect(canonicalSagRodTL(undefined)).toBe('');
    });
});
