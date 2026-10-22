import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { priceItem, rodWeight, round05, tlSurcharge } from '@/domain';
import { computeItem, itemTitle, materialCodeOf, toAccessoryInput } from './compute';
import { formatDayFirst, parseDayFirst, todayIso } from './dates';
import { clearDraft, draftKey, loadDraft, saveDraft } from './draft-storage';
import { duplicateItem, emptyItem, emptyQuotation, isMeaningful, type DraftItem } from './model';
import { readQuotation } from './quotation';

function item(over: Partial<DraftItem> = {}, dims: Partial<DraftItem['dims']> = {}): DraftItem {
    const base = emptyItem(over.product ?? 'sagrod', over.entryMode ?? 'manual');
    return { ...base, ...over, dims: { ...base.dims, ...dims } };
}

describe('one shared item model', () => {
    it('Quick Add and Manual Add produce exactly the same item shape', () => {
        const quick = emptyItem('lbolt', 'quick');
        const manual = emptyItem('lbolt', 'manual');
        const shape = (o: object): string[] => Object.keys(o).sort();
        expect(shape(quick)).toEqual(shape(manual));
        expect(shape(quick.dims)).toEqual(shape(manual.dims));
        expect(shape(quick.pricing)).toEqual(shape(manual.pricing));
        expect({ ...quick, uid: '', entryMode: 'x' }).toEqual({ ...manual, uid: '', entryMode: 'x' });
    });

    it('duplicates with a fresh identity and the same content', () => {
        const a = item({ size: 'M12', qty: '10' }, { length: '1000' });
        const b = duplicateItem(a);
        expect(b.uid).not.toBe(a.uid);
        expect({ ...b, uid: '' }).toEqual({ ...a, uid: '' });
        b.dims.length = '2000';
        expect(a.dims.length).toBe('1000');
    });
});

describe('material semantics (§13 / §14)', () => {
    it('maps canonical materials to the legacy stored codes', () => {
        expect(materialCodeOf(item({ material: '4140 QT' }))).toBe('4140');
        expect(materialCodeOf(item({ material: '4140' }))).toBe('4140_PLAIN');
        expect(materialCodeOf(item({ material: 'Y BAR' }))).toBe('Y_BAR');
        expect(materialCodeOf(item({ material: 'S45C', treatment: 'HARDEN', propertyClass: '8.8' }))).toBe('S45C_HARDEN_G8_8');
        expect(materialCodeOf(item({ material: '4140 QT', treatment: 'HARDEN', propertyClass: '10.9' }))).toBe('4140_HARDEN_G10_9');
    });

    it('keeps Harden structured: material + treatment + property class, never a fake material', () => {
        const stud = item({ product: 'stud', material: 'S45C', treatment: 'HARDEN', propertyClass: '8.8', sizeType: '' });
        expect(itemTitle(stud)).toBe('S45C STUD · HARDENED TO G8.8 · PL');
        const qt129 = item({ product: 'stud', material: '4140 QT', treatment: 'HARDEN', propertyClass: '12.9', sizeType: '' });
        expect(itemTitle(qt129)).toBe('4140 QT STUD · HARDENED TO G12.9 · PL');
        expect(computeItem(qt129).structuredMaterial).toEqual({ material: '4140 QT', treatment: 'HARDEN', propertyClass: '12.9' });
        expect(computeItem(item({ treatment: 'HARDEN', propertyClass: '' })).errors.propertyClass).toBe('Choose the property class');
    });

    it('keeps Finish separate from Material', () => {
        expect(itemTitle(item({ material: 'MS', finish: 'ZP', sizeType: 'UNDERSIZE' }))).toBe('MS UNDERSIZE SAG ROD · ZP');
        expect(computeItem(item({ finish: 'MS' })).errors.finish).toBe('Choose a finish');
        // stainless has no finish (N/A): nothing to choose, nothing printed
        const ss = computeItem(item({ material: 'SS304', finish: '' }));
        expect(ss.errors.finish).toBeUndefined();
        expect(ss.title).toBe('SS304 FULLSIZE SAG ROD');
    });
});

describe('dimensions and diameter', () => {
    it('canonicalises a single Sag Rod TL to both ends (100 → 100/100)', () => {
        const c = computeItem(item({ size: 'M12', qty: '30' }, { length: '1245', threadLen: '100' }));
        expect(c.threadLen).toBe('100/100');
        expect(c.dimensionLine).toBe('M12 x L 1245 x TL 100/100mm');
        expect(computeItem(item({ size: 'M12' }, { length: '1245', threadLen: '100/80' })).threadLen).toBe('100/80');
    });

    it('uses the locked diameter master: 4140 plain M12 FULLSIZE Ø13, UNDERSIZE M12 stays 10.6', () => {
        expect(computeItem(item({ material: '4140', size: '12', sizeType: 'FULLSIZE' }, { length: '1000' })).diameter).toBe(13);
        expect(computeItem(item({ material: 'MS', size: 'M12', sizeType: 'UNDERSIZE' }, { length: '1000' })).diameter).toBe(10.6);
        expect(computeItem(item({ material: 'MS', size: 'M12', sizeType: 'FULLSIZE' }, { length: '1000' })).diameter).toBe(12);
    });

    it('does not guess an unknown size: it asks for review / a typed diameter', () => {
        const bare72 = computeItem(item({ size: '72' }, { length: '1000' }));
        expect(bare72.diameter).toBeNull();
        expect(bare72.errors.size).toMatch(/looks like a length/);
        const typed = computeItem(item({ size: '72', diameterOverride: '70' }, { length: '1000' }));
        expect(typed.diameter).toBe(70);
        expect(typed.diameterSource).toBe('override');
        expect(typed.errors.size).toBeUndefined();
        expect(typed.warnings.size).toMatch(/needs review/);
    });

    it('builds the canonical L Bolt line and weight through the engine', () => {
        const c = computeItem(item({ product: 'lbolt', size: 'M20', qty: '30' }, { l: '900', w: '70', threadLen: '150' }));
        expect(c.dimensionLine).toBe('M20 x L 900 x W 70 x TL 150mm');
        expect(c.geometry?.developedLength).toBe(Math.ceil(900 + 70 - 20 * 1.5));
        expect(c.unitWeight).toBeCloseTo(rodWeight(20, 940), 10);
        expect(c.lineWeight).toBeCloseTo(rodWeight(20, 940) * 30, 10);
    });

    it('asks for a developed length where there is no formula, offering the J Hook suggestion', () => {
        const jh = computeItem(item({ product: 'jhook', size: 'M16', qty: '5' }, { l: '600', w: '100' }));
        expect(jh.errors.developedLength).toBe('Enter the developed length — suggested 700');
        const typed = computeItem(item({ product: 'jhook', size: 'M16', qty: '5' }, { l: '600', w: '100', developedLength: '690' }));
        expect(typed.errors.developedLength).toBeUndefined();
        expect(typed.geometry?.source).toBe('manual');
        expect(computeItem(item({ product: 'lbolt45', size: 'M16', qty: '5' }, { l: '600', w: '100' })).errors.developedLength).toMatch(/no formula/);
    });
});

describe('accessories (§18)', () => {
    it('keeps an explicit 0 as 0 and lets blank take the default', () => {
        const zero = computeItem(item({ size: 'M12', qty: '10', accessories: { nut: { qty: '0', finish: 'ZP', unitPrice: '0.20' }, fw: null, custom: null } }, { length: '1000' }));
        expect(zero.pricing?.accessories.nut).toEqual({ enabled: true, qty: 0, finish: 'ZP', unitPrice: 0.2 });
        expect(zero.pricing?.accessoriesCost).toBe(0);
        const blank = computeItem(item({ size: 'M12', qty: '10', accessories: { nut: { qty: '', finish: 'ZP', unitPrice: '0.20' }, fw: { qty: '', finish: 'ZP', unitPrice: '0.10' }, custom: null } }, { length: '1000' }));
        expect(blank.pricing?.accessories.nut.qty).toBe(2);
        expect(blank.pricing?.accessories.fw.qty).toBe(1);
        expect(blank.pricing?.accessoriesCost).toBe(0.5);
        expect(toAccessoryInput({ nut: { qty: '0', finish: '', unitPrice: '' }, fw: null, custom: null }).nut?.qty).toBe('0');
    });

    it('flags a malformed accessory quantity next to the accessory', () => {
        const c = computeItem(item({ accessories: { nut: { qty: '-1', finish: '', unitPrice: '' }, fw: null, custom: null } }));
        expect(c.errors.nut).toBe('Qty per item must be 0 or more');
    });
});

describe('pricing preview (engine wiring, no formula changes)', () => {
    it('suggests the locked MS FULLSIZE Sag Rod rates and prices through priceItem', () => {
        for (const [finish, rate, add] of [['PL', 3.5, 0.6], ['ZP', 5.0, 0.6], ['HDG', 6.5, 1.6]] as const) {
            const c = computeItem(item({ size: 'M12', finish, qty: '10' }, { length: '1000', threadLen: '100' }));
            expect(c.suggested.costRate).toBe(rate);
            expect(c.suggested.addCost).toBe(finish === 'HDG' ? 1.6 : tlSurcharge('100/100'));
            expect(Number(c.effective.addCost)).toBe(add);
            const expected = priceItem({ product: 'sagrod', weight: rodWeight(12, 1000), costRate: rate, addCost: add, markup: 0, qty: 10 });
            expect(c.pricing?.finalUnitPrice).toBe(expected.finalUnitPrice);
            expect(c.pricing?.roundedUnitPrice).toBe(round05(rodWeight(12, 1000) * rate + add));
            expect(c.pricing?.totalAmount).toBe(expected.totalAmount);
            expect(c.valid).toBe(true);
        }
    });

    it('applies the MS UNDERSIZE M12 PL TL 100/100 price list', () => {
        const c = computeItem(item({ size: 'M12', sizeType: 'UNDERSIZE', finish: 'PL', qty: '5' }, { length: '1000', threadLen: '100' }));
        expect(c.pricing?.finalUnitPrice).toBe(4.0);
        expect(c.pricing?.priceSource).toBe('price_list');
    });

    it('keeps a typed rate over the suggestion when the identity changes', () => {
        const typed = item({ size: 'M12', finish: 'PL', qty: '1', pricing: { costRate: '4.10', addCost: null, markup: '5', mode: 'calculated', manualUnitPrice: '' } }, { length: '1000' });
        expect(computeItem(typed).effective.costRate).toBe('4.10');
        expect(computeItem({ ...typed, finish: 'HDG' }).effective.costRate).toBe('4.10');
        expect(computeItem({ ...typed, finish: 'HDG' }).effective.addCost).toBe('1.60');
        expect(computeItem(typed).pricing?.rawUnitPrice).toBeCloseTo((rodWeight(12, 1000) * 4.1 + 0) * 1.05, 10);
    });

    it('marks a manual override explicitly and keeps the calculated reference', () => {
        const c = computeItem(item({ size: 'M12', qty: '10', pricing: { costRate: null, addCost: null, markup: null, mode: 'manual', manualUnitPrice: '9.90' } }, { length: '1000' }));
        expect(c.pricing?.priceMode).toBe('manual');
        expect(c.pricing?.priceSource).toBe('manual');
        expect(c.pricing?.finalUnitPrice).toBe(9.9);
        expect(c.pricing?.totalAmount).toBe(99);
        expect(c.pricing?.roundedUnitPrice).toBeGreaterThan(0);
        expect(computeItem(item({ size: 'M12', qty: '1', pricing: { costRate: null, addCost: null, markup: null, mode: 'manual', manualUnitPrice: '' } }, { length: '1000' })).errors.manualUnitPrice).toBeDefined();
    });

    it('requires a cost rate where no default exists (no invented price)', () => {
        const c = computeItem(item({ product: 'lbolt', size: 'M20', qty: '1' }, { l: '900', w: '70' }));
        expect(c.suggested.source).toBe('none');
        expect(c.errors.costRate).toMatch(/No default rate/);
    });
});

describe('validation', () => {
    it('blocks negative, fractional and missing Qty', () => {
        expect(computeItem(item({ qty: '-3' })).errors.qty).toBe('Qty cannot be negative');
        expect(computeItem(item({ qty: '2.5' })).errors.qty).toBe('Qty must be a whole number');
        expect(computeItem(item({ qty: '' })).errors.qty).toBe('Enter Qty');
        expect(computeItem(item({ qty: '0' })).errors.qty).toBe('Qty must be at least 1');
    });

    it('requires the product dimensions and rejects malformed ones', () => {
        const c = computeItem(item({ product: 'lbolt', size: 'M20', qty: '1' }, { l: 'abc', threadLen: '100mmx' }));
        expect(c.errors.l).toBe('L must be a number above 0');
        expect(c.errors.w).toBe('Enter W');
        expect(c.errors.threadLen).toMatch(/TL is a number/);
    });

    it('reads the whole quotation: customer, dates, items, totals', () => {
        const q = emptyQuotation('2026-10-22');
        expect(readQuotation(q).headerErrors.customer).toBeDefined();
        expect(readQuotation(q).valid).toBe(false);
        const a = item({ size: 'M12', qty: '10' }, { length: '1000', threadLen: '100' });
        const b = item({ size: 'M16', finish: 'ZP', qty: '4' }, { length: '1200' });
        const r = readQuotation({ ...q, customer: { ...q.customer, name: 'WALK-IN' }, validUntil: '2026-10-01', items: [a, b] });
        expect(r.headerErrors.validUntil).toBe('Valid until cannot be before the quotation date');
        expect(r.summary.itemCount).toBe(2);
        expect(r.summary.totalWeight).toBeCloseTo(rodWeight(12, 1000) * 10 + rodWeight(16, 1200) * 4, 10);
        expect(r.summary.total).toBe(Math.round((r.items[0]!.pricing!.totalAmount + r.items[1]!.pricing!.totalAmount) * 100) / 100);
        expect(readQuotation({ ...q, customer: { ...q.customer, name: 'WALK-IN' }, items: [a, b] }).valid).toBe(true);
    });
});

describe('dates are day-first', () => {
    it('parses and formats DD-MM-YYYY, never month-first', () => {
        expect(parseDayFirst('22-10-2026')).toBe('2026-10-22');
        expect(parseDayFirst('5/1/2026')).toBe('2026-01-05');
        expect(parseDayFirst('31-02-2026')).toBeNull();
        expect(parseDayFirst('10-22-2026')).toBeNull();
        expect(formatDayFirst('2026-10-22')).toBe('22-10-2026');
        expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
});

/* Node 26 ships its own (empty) global localStorage that hides jsdom's, so
   the tests install a plain in-memory Storage on window. */
function memoryStorage(): Storage {
    const m = new Map<string, string>();
    return {
        get length() {
            return m.size;
        },
        clear: () => m.clear(),
        getItem: (k) => (m.has(k) ? m.get(k)! : null),
        key: (i) => Array.from(m.keys())[i] ?? null,
        removeItem: (k) => void m.delete(k),
        setItem: (k, v) => void m.set(k, String(v)),
    };
}

describe('local draft storage', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
    });
    afterEach(() => window.localStorage.clear());

    it('round-trips a draft under a per-user key and ignores another user’s or a corrupt draft', () => {
        const q = { ...emptyQuotation('2026-10-22'), remarks: 'hello' };
        expect(saveDraft('nicholas', q, 'new', new Date('2026-10-22T03:00:00Z'))).toBe('2026-10-22T03:00:00.000Z');
        expect(loadDraft('nicholas')?.quotation.remarks).toBe('hello');
        expect(loadDraft('alson')).toBeNull();
        expect(draftKey('nicholas')).toBe('dnc-quo:builder-draft:v1:nicholas:new');
        window.localStorage.setItem(draftKey('alson'), '{not json');
        expect(loadDraft('alson')).toBeNull();
        window.localStorage.setItem(draftKey('alson'), JSON.stringify({ v: 1, savedAt: 'x', username: 'nicholas', quotation: q }));
        expect(loadDraft('alson')).toBeNull();
        clearDraft('nicholas');
        expect(loadDraft('nicholas')).toBeNull();
    });

    it('treats only real entries as meaningful (not the default date)', () => {
        const q = emptyQuotation('2026-10-22');
        expect(isMeaningful(q)).toBe(false);
        expect(isMeaningful({ ...q, remarks: 'x' })).toBe(true);
        expect(isMeaningful({ ...q, items: [item()] })).toBe(true);
    });
});
