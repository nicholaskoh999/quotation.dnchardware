import { describe, expect, it } from 'vitest';
import { DIAMETER_CANDIDATES, builtInDiameter, effectiveDiameter, findDiameterRule, formatSizeLabel } from './diameter';
import { assertedCases } from './golden-coverage';

type In = { type: string; material: string; sizeType: string; size: string };

describe('golden: diameter', () => {
    const cases = assertedCases<In, number | null>('diameter');
    it.each(cases.map((c) => [`${c.input.type} ${c.input.material} ${c.input.sizeType || '-'} ${c.input.size} [${c.cls}${c.gate ? ' ' + c.gate : ''}]`, c] as const))(
        '%s',
        (_n, c) => {
            const { type, material, sizeType, size } = c.input;
            expect(builtInDiameter(type, material, sizeType, size)).toBe(c.expected);
        },
    );
});

describe('diameter: rules beyond the golden grid', () => {
    it('reads canonical / structured materials the same as legacy codes', () => {
        expect(builtInDiameter('sagrod', '4140 QT', 'FULLSIZE', 'M12')).toBe(13);
        expect(builtInDiameter('sagrod', '4340 QT', 'FULLSIZE', 'M12')).toBe(13);
        expect(builtInDiameter('sagrod', { material: '4140', treatment: null, propertyClass: null }, 'FULLSIZE', 'M12')).toBe(13);
    });
    it('a hardened 4140 QT keeps legacy Ø12 at M12 FULLSIZE (OG-B2)', () => {
        expect(builtInDiameter('sagrod', '4140_HARDEN_G10_9', 'FULLSIZE', 'M12')).toBe(12);
    });
    it('stud always reads the undersize bar; undersize inch never falls back to fullsize', () => {
        expect(builtInDiameter('stud', 'MS', 'FULLSIZE', 'M12')).toBe(10.6);
        expect(builtInDiameter('sagrod', 'MS', 'UNDERSIZE', '1-1/4')).toBeNull();
        expect(builtInDiameter('sagrod', 'MS', 'UNDERSIZE', '1/2" BSW')).toBe(10.9);
        expect(builtInDiameter('sagrod', 'MS', 'FULLSIZE', '3/4" BSW')).toBe(19.05);
        expect(builtInDiameter('sagrod', 'MS', 'FULLSIZE', '')).toBeNull();
    });
    it('a custom rule outranks the built-in table (legacy Diameter Settings)', () => {
        const rules = [{ type: 'sagrod', material: '4140', sizeType: 'UNDERSIZE', size: 'M12', diameter: 10.7 }];
        expect(effectiveDiameter('sagrod', '4140', 'UNDERSIZE', 'm12', rules)).toEqual({ diameter: 10.7, source: 'custom' });
        expect(effectiveDiameter('sagrod', '4140 QT', 'UNDERSIZE', 'M12', rules).diameter).toBe(10.7);
        expect(effectiveDiameter('sagrod', 'MS', 'UNDERSIZE', 'M12', rules)).toEqual({ diameter: 10.6, source: 'built_in' });
        expect(effectiveDiameter('sagrod', 'MS', 'FULLSIZE', 'M72', rules)).toEqual({ diameter: null, source: 'none' });
        // blank fields are wildcards; stud ignores size type
        expect(findDiameterRule([{ type: 'stud', sizeType: 'FULLSIZE', size: 'M16', diameter: 14 }], 'stud', 'SS304', '', 'M16')?.diameter).toBe(14);
    });
    it('formatSizeLabel shows Ø only for a fullsize bar more than 0.2 mm off nominal', () => {
        expect(formatSizeLabel('M12', 13, 'FULLSIZE')).toBe('Ø13-M12');
        expect(formatSizeLabel('M12', 12.1, 'FULLSIZE')).toBe('M12');
        expect(formatSizeLabel('M12', 10.6, 'UNDERSIZE')).toBe('M12');
        expect(formatSizeLabel('1/2', 12.7, 'FULLSIZE')).toBe('1/2"');
        expect(formatSizeLabel('3/8', 9.525, 'FULLSIZE')).toBe('Ø9.5-3/8"');
        expect(formatSizeLabel('M12', '', 'FULLSIZE')).toBe('M12');
    });
    it('DG-1 / OG-1 candidates are documented data, never applied', () => {
        expect(DIAMETER_CANDIDATES.length).toBe(6);
        for (const c of DIAMETER_CANDIDATES) {
            expect(c.status).toBe('candidate');
            expect(c.applied).toBe(false);
            const d = builtInDiameter(c.scope.type ?? 'sagrod', c.scope.material ?? 'MS', c.scope.sizeType, c.scope.size);
            expect(d).toBe(c.legacy);
        }
        expect(DIAMETER_CANDIDATES.find((c) => c.gate === 'OG-1')?.candidate).toBe(10.7);
    });
});
