import { describe, expect, it } from 'vitest';
import { cleanNum, evalExpr, isBlank, parseNum, withMm } from './numbers';

describe('numbers: legacy field readers', () => {
    it('evalExpr reads simple expressions like legacy (no eval)', () => {
        expect(evalExpr('2.8+0.5')).toBeCloseTo(3.3, 12);
        expect(evalExpr(' 4 * 1.1 ')).toBeCloseTo(4.4, 12);
        expect(evalExpr('10/4')).toBe(2.5);
        expect(evalExpr('2**3')).toBe(8);
        expect(evalExpr('-2.5')).toBe(-2.5);
        expect(evalExpr('2*-1')).toBe(-2);
        expect(evalExpr('.5')).toBe(0.5);
        expect(evalExpr('5.')).toBe(5);
    });
    it('evalExpr: thousands separators are numbers, a decimal comma is unreadable (0)', () => {
        expect(evalExpr('1,200')).toBe(1200);
        expect(evalExpr('1,200.50')).toBe(1200.5);
        expect(evalExpr('2,80')).toBe(0);
    });
    it('evalExpr: what strict-mode JavaScript rejects falls back to Number(), as legacy', () => {
        expect(evalExpr('012')).toBe(12); // legacy octal is a SyntaxError → Number('012')
        expect(evalExpr('2--1')).toBe(0); // decrement token → SyntaxError → NaN → 0
        expect(evalExpr('-2**2')).toBe(0);
        expect(evalExpr('1 2')).toBe(0);
        expect(evalExpr('3+')).toBe(0);
        expect(evalExpr('abc')).toBe(0);
        expect(evalExpr('1e3')).toBe(1000); // not arithmetic text → Number()
        expect(evalExpr('')).toBe(0);
        expect(evalExpr(null)).toBe(0);
        expect(evalExpr(7.5)).toBe(7.5);
    });
    it('parseNum is parseFloat(x)||0', () => {
        expect(parseNum('10abc')).toBe(10);
        expect(parseNum('abc')).toBe(0);
        expect(parseNum(undefined)).toBe(0);
        expect(parseNum(3)).toBe(3);
    });
    it('cleanNum / withMm / isBlank', () => {
        expect(cleanNum(1000)).toBe('1000');
        expect(cleanNum('12.50')).toBe('12.5');
        expect(cleanNum(12.345)).toBe('12.35');
        expect(cleanNum('abc')).toBe('abc');
        expect(withMm(' 100/100 ')).toBe('100/100mm');
        expect(withMm('')).toBe('');
        expect(isBlank('  ')).toBe(true);
        expect(isBlank(0)).toBe(false);
    });
});
