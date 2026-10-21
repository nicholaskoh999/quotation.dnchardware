import { describe, expect, it } from 'vitest';
import { loadGolden } from './golden';
import { DEFERRED_FAMILIES } from './golden-coverage';

/* Not implemented in Wave 1, by design:
     quickAdd — the Quick Add parser is Wave 3 (knownFailure cases are never tested against);
     history  — history identity / ranking is server-side (pricing_history.php) and belongs to a later wave.
   Wave 1 only proves the oracle is present and readable for them. */
describe.each(DEFERRED_FAMILIES)('golden (deferred): %s', (family) => {
    it('loads and is classified', () => {
        const cases = loadGolden(family);
        expect(cases.length).toBeGreaterThan(0);
        for (const c of cases) expect(['A', 'B', 'C']).toContain(c.cls);
    });
});
