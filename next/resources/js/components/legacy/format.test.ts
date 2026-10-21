import { describe, expect, it } from 'vitest';
import { formatDate, formatPrice, formatStoredMoney, orDash } from './format';

describe('legacy read formatting', () => {
    it('formats ISO dates without a timezone shift', () => {
        expect(formatDate('2026-03-01')).toBe('1 Mar 2026');
        expect(formatDate('2026-12-31 23:59:00')).toBe('31 Dec 2026');
        expect(formatDate(null)).toBe('—');
        expect(formatDate('not a date')).toBe('not a date');
    });

    it('formats stored DECIMAL strings exactly', () => {
        expect(formatStoredMoney('158.60')).toBe('RM 158.60');
        expect(formatStoredMoney('1234567.05')).toBe('RM 1,234,567.05');
        expect(formatStoredMoney('0.00')).toBe('RM 0.00');
        expect(formatStoredMoney(null)).toBe('—');
    });

    it('formats rounded unit prices', () => {
        expect(formatPrice(33.4)).toBe('RM 33.40');
        expect(formatPrice(1250)).toBe('RM 1,250.00');
        expect(formatPrice(null)).toBe('—');
        expect(orDash('')).toBe('—');
        expect(orDash(0)).toBe('0');
    });
});
