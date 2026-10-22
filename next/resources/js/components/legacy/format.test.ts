import { describe, expect, it } from 'vitest';
import { displayFinish, formatDate, formatDimensions, formatMarkup, formatPrice, formatStoredMoney, itemSummaryText, itemTitle, orDash } from './format';

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

describe('saved item display', () => {
    it('formats dimensions canonically without changing the stored numbers', () => {
        expect(formatDimensions('M20 x L 900 x W 70 x TL 150mm')).toBe('M20 × L900 × W70 × TL150');
        expect(formatDimensions('M20 x L 400mm')).toBe('M20 × L400');
        expect(formatDimensions('M16 x L 1200')).toBe('M16 × L1200');
        expect(formatDimensions('M12 x H 150 x ID 60 x S 50 x TL 75mm')).toBe('M12 × H150 × ID60 × S50 × TL75');
        expect(formatDimensions('M10.5 x L 90.5')).toBe('M10.5 × L90.5');
        expect(formatDimensions('1/2" x L 300')).toBe('1/2" × L300');
        expect(formatDimensions('L 200 x W 150 x T 10mm')).toBe('L200 × W150 × T10');
        expect(formatDimensions('M12 x L 1000 x TL 100/100mm')).toBe('M12 × L1000 × TL100/100');
        expect(formatDimensions('M12 x ID 60 x IH 100 x TL 75mm')).toBe('M12 × ID60 × IH100 × TL75');
    });

    it('leaves non-plain dimension text exactly as stored', () => {
        expect(formatDimensions('L 200 x W 200 x T 6mm x Ø18mm center hole')).toBe('L 200 x W 200 x T 6mm x Ø18mm center hole');
        expect(formatDimensions('M20 x L 900 x W 70 x TL 150mm 45deg')).toBe('M20 x L 900 x W 70 x TL 150mm 45deg');
        expect(formatDimensions('custom bend per drawing')).toBe('custom bend per drawing');
        expect(formatDimensions('')).toBe('');
        expect(formatDimensions(null)).toBe('');
    });

    it('formats multi-line sizes line by line', () => {
        expect(formatDimensions('M20 x L 500 x TL 100mm\nTriangle Plate: 2 pcs')).toBe('M20 × L500 × TL100\nTriangle Plate: 2 pcs');
    });

    const mat = (label: string, legacyLabel: string, treatment: string | null = null) => ({ label, legacyLabel, key: label, treatment });

    it('drops the material prefix from the title only when it is shown as a chip', () => {
        expect(itemTitle({ displayDescription: '4140 QT FULLSIZE L BOLT', productType: 'L BOLT', material: mat('4140 QT', '4140 QT') })).toBe('FULLSIZE L BOLT');
        expect(itemTitle({ displayDescription: '4140 QT + HARDEN = G10.9 STUD', productType: null, material: mat('4140 QT', '4140 QT + HARDEN = G10.9', 'HARDEN') })).toBe('STUD');
        expect(itemTitle({ displayDescription: 'MS FULLSIZE SAG ROD', productType: null, material: mat('MS', 'MS') })).toBe('FULLSIZE SAG ROD');
        expect(itemTitle({ displayDescription: '4140 FULLSIZE STUD', productType: null, material: mat('4140', '4140') })).toBe('FULLSIZE STUD');
    });

    it('keeps the full description when no chip would carry the material', () => {
        expect(itemTitle({ displayDescription: 'XYZ FULLSIZE STUD', productType: null, material: { label: 'XYZ', legacyLabel: 'XYZ', key: null, treatment: null } })).toBe('XYZ FULLSIZE STUD');
        expect(itemTitle({ displayDescription: 'MS FULLSIZE STUD', productType: null, material: null })).toBe('MS FULLSIZE STUD');
        expect(itemTitle({ displayDescription: 'MS', productType: null, material: mat('MS', 'MS') })).toBe('MS');
        expect(itemTitle({ displayDescription: 'MSX BOLT', productType: null, material: mat('MS', 'MS') })).toBe('MSX BOLT');
        expect(itemTitle({ displayDescription: '', productType: 'STUD', material: null })).toBe('STUD');
    });
});

describe('list item summary', () => {
    const first = (over: Record<string, unknown>) => ({ displayDescription: 'MS UNDERSIZE SAG ROD', productType: 'SAG ROD', sizeType: 'UNDERSIZE', material: 'MS', finish: 'ZP', ...over });

    it('reads Material + Size Type + Product (+ hardened wording) · Finish, then +N', () => {
        expect(itemSummaryText({ count: 1, first: first({}) })).toBe('MS UNDERSIZE SAG ROD · ZP');
        expect(itemSummaryText({ count: 5, first: first({}) })).toBe('MS UNDERSIZE SAG ROD · ZP +4');
        expect(itemSummaryText({ count: 2, first: first({ material: '4140', productType: 'L BOLT', sizeType: 'FULLSIZE', finish: 'PL' }) })).toBe('4140 QT FULLSIZE L BOLT · PL +1');
        expect(itemSummaryText({ count: 1, first: first({ material: 'S45C_HARDEN_G8_8', productType: 'STUD', sizeType: '', finish: 'PL' }) })).toBe('S45C STUD · HARDENED TO G8.8 · PL');
        expect(itemSummaryText({ count: 1, first: first({ material: 'SS304', productType: 'STUD', sizeType: null, finish: 'N/A' }) })).toBe('SS304 STUD');
    });

    it('falls back to the stored description, and says nothing when nothing is readable', () => {
        expect(itemSummaryText({ count: 3, first: first({ material: 'XYZ', productType: null, displayDescription: 'XYZ SPECIAL BRACKET', finish: '' }) })).toBe('XYZ SPECIAL BRACKET +2');
        expect(itemSummaryText({ count: 2, first: null })).toBeNull();
        expect(itemSummaryText(null)).toBeNull();
        expect(itemSummaryText(undefined)).toBeNull();
    });

    it('prints a finish only when it is a real finish, and markup as stored', () => {
        expect(displayFinish('N/A')).toBeNull();
        expect(displayFinish(' - ')).toBeNull();
        expect(displayFinish('')).toBeNull();
        expect(displayFinish('HDG')).toBe('HDG');
        expect(formatMarkup(5)).toBe('+5%');
        expect(formatMarkup(2.5)).toBe('+2.5%');
    });
});
