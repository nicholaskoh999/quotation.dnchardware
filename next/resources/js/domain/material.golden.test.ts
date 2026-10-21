import { describe, expect, it } from 'vitest';
import { assertedCases } from './golden-coverage';
import {
    customerMaterialWording,
    legacyBareGradeMaterial,
    legacyMaterialLabel,
    materialHasFinish,
    parseMaterial,
    toLegacyMaterialCode,
    finishFor,
} from './material';

type Expected = { material: string; treatment: string | null; propertyClass: string | null; hasFinish: boolean; customerWordingSample?: string };

describe('golden: material', () => {
    const cases = assertedCases<string, unknown>('material');
    it.each(cases.map((c) => [`${c.input} [${c.cls}]`, c] as const))('%s', (_n, c) => {
        const exp = c.expected as Expected;
        const sm = parseMaterial(c.input);
        expect(sm).not.toBeNull();
        const got: Expected = { material: sm!.material, treatment: sm!.treatment, propertyClass: sm!.propertyClass, hasFinish: materialHasFinish(c.input) };
        if (exp.customerWordingSample !== undefined) got.customerWordingSample = customerMaterialWording(c.input, 'STUD', 'PL');
        expect(got).toEqual(exp);
    });
    it.each(cases.filter((c) => c.legacy !== null).map((c) => [c.input, c] as const))('%s: legacy label is still readable', (_n, c) => {
        expect(legacyMaterialLabel(c.input)).toBe((c.legacy as { label: string }).label);
    });
});

describe('material: structured model', () => {
    it('maps structured back to a legacy code where one exists; 12.9 has none', () => {
        expect(toLegacyMaterialCode({ material: '4140 QT', treatment: null, propertyClass: null })).toBe('4140');
        expect(toLegacyMaterialCode({ material: '4140', treatment: null, propertyClass: null })).toBe('4140_PLAIN');
        expect(toLegacyMaterialCode({ material: 'Y BAR', treatment: null, propertyClass: null })).toBe('Y_BAR');
        expect(toLegacyMaterialCode({ material: 'S45C', treatment: 'HARDEN', propertyClass: '8.8' })).toBe('S45C_HARDEN_G8_8');
        expect(toLegacyMaterialCode({ material: '4140 QT', treatment: 'HARDEN', propertyClass: '10.9' })).toBe('4140_HARDEN_G10_9');
        expect(toLegacyMaterialCode({ material: '4140 QT', treatment: 'HARDEN', propertyClass: '12.9' })).toBeNull();
        for (const code of ['MS', 'S45C', 'S45C_HARDEN_G8_8', '4140', '4140_HARDEN_G10_9', '4140_PLAIN', '4340', 'SS304', 'SS316', 'Y_BAR']) {
            expect(toLegacyMaterialCode(parseMaterial(code)!)).toBe(code);
        }
    });
    it('reads legacy labels and custom property classes', () => {
        expect(parseMaterial('4140 QT + HARDEN = G10.9')).toEqual({ material: '4140 QT', treatment: 'HARDEN', propertyClass: '10.9' });
        expect(parseMaterial('S45C_HARDEN_G12_9')).toEqual({ material: 'S45C', treatment: 'HARDEN', propertyClass: '12.9' });
        expect(parseMaterial('Y BAR')).toEqual({ material: 'Y BAR', treatment: null, propertyClass: null });
        expect(parseMaterial('4140 plain')).toEqual({ material: '4140', treatment: null, propertyClass: null });
        expect(parseMaterial('unobtainium')).toBeNull();
        expect(parseMaterial('')).toBeNull();
    });
    it('§14 wording: no "+ HARDEN =" ever; stainless prints without a finish', () => {
        expect(customerMaterialWording('S45C_HARDEN_G8_8', 'STUD', 'PL')).toBe('S45C STUD · HARDENED TO G8.8 (PL)');
        expect(customerMaterialWording('4140 QT + HARDEN + 12.9', 'STUD', 'PL')).toBe('4140 QT STUD · HARDENED TO G12.9 (PL)');
        expect(customerMaterialWording('MS', 'FULLSIZE SAG ROD', 'ZP')).toBe('MS FULLSIZE SAG ROD (ZP)');
        expect(customerMaterialWording('SS304', 'STUD', '')).toBe('SS304 STUD');
        expect(finishFor('SS316', 'HDG')).toBe('');
        expect(finishFor('MS', 'HDG')).toBe('HDG');
    });
    it('§34 C-1: legacy bare grade kept — 8.8 ⇒ 4140 QT, 10.9 ⇒ 4340 QT, stainless outranks', () => {
        for (const g of ['8.8', 'G8.8', 'HT8.8', 'grade 8.8', 'HT 8.8']) expect(legacyBareGradeMaterial(g)?.material).toBe('4140 QT');
        for (const g of ['10.9', 'G10.9', 'HT10.9', 'GR 10.9']) expect(legacyBareGradeMaterial(g)?.material).toBe('4340 QT');
        expect(legacyBareGradeMaterial('8.8', 'SS304')?.material).toBe('SS304');
        expect(legacyBareGradeMaterial('12.9')).toBeNull();
    });
});
