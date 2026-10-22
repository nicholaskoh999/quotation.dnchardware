import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { priceItem, rodWeight, round05, tlSurcharge } from '@/domain';
import { computeItem, itemTitle, materialCodeOf, toAccessoryInput } from './compute';
import { formatDayFirst, parseDayFirst, todayIso } from './dates';
import { clearDraft, draftKey, loadDraft, saveDraft } from './draft-storage';
import { duplicateItem, emptyItem, emptyQuotation, isMeaningful, nextItemFrom, type DraftItem } from './model';
import { DEMO_LABEL, demoExtraction } from './quick-add-demo';
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
        expect(typed.diameterSource).toBe('custom');
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

describe('Bar Ø — nominal size is not the bar (Owner Smoke #2 §8/§9)', () => {
    it('M12 UNDERSIZE suggests Ø10.6; a custom 10.7 stays and drives weight and price (D)', () => {
        const auto = computeItem(item({ size: 'M12', sizeType: 'UNDERSIZE', qty: '1' }, { length: '1000' }));
        expect(auto.suggestedDiameter).toBe(10.6);
        expect(auto.diameter).toBe(10.6);
        expect(auto.diameterSource).toBe('built_in');
        const custom = computeItem(item({ size: 'M12', sizeType: 'UNDERSIZE', diameterOverride: '10.7', qty: '1' }, { length: '1000' }));
        expect(custom.diameter).toBe(10.7);
        expect(custom.diameterSource).toBe('custom');
        expect(custom.suggestedDiameter).toBe(10.6);
        expect(custom.unitWeight).toBeCloseTo(rodWeight(10.7, 1000), 12);
        expect(custom.errors.diameter).toBeUndefined();
        // a custom Ø is not overwritten when unrelated fields change
        const still = computeItem(item({ size: 'M12', sizeType: 'UNDERSIZE', finish: 'HDG', material: 'MS', diameterOverride: '10.7', qty: '1' }, { length: '1000' }));
        expect(still.diameter).toBe(10.7);
    });

    it('M24 suggests its table value; Ø25 typed is what weight and price use (E)', () => {
        const auto = computeItem(item({ size: 'M24', qty: '1' }, { length: '1000' }));
        expect(auto.suggestedDiameter).toBe(24);
        const c = computeItem(item({ size: 'M24', diameterOverride: '25', qty: '1' }, { length: '1000' }));
        expect(c.diameter).toBe(25);
        expect(c.unitWeight).toBeCloseTo(rodWeight(25, 1000), 12);
        const expected = priceItem({ product: 'sagrod', weight: rodWeight(25, 1000), costRate: 3.5, addCost: 0, markup: 0, qty: 1 });
        expect(c.calculated?.finalUnitPrice).toBe(expected.finalUnitPrice);
    });

    it('rejects a malformed Bar Ø but accepts decimals', () => {
        expect(computeItem(item({ size: 'M12', diameterOverride: '10.7.1' }, { length: '1000' })).errors.diameter).toMatch(/decimals allowed/);
        expect(computeItem(item({ size: 'M12', diameterOverride: '12.35' }, { length: '1000' })).errors.diameter).toBeUndefined();
    });
});

describe('Developed length — calculated value fills the field, custom wins (Owner Smoke #2 §10/§11)', () => {
    it('L Bolt L1000 W100 on a Ø25 bar calculates 1063 (F)', () => {
        const c = computeItem(item({ product: 'lbolt', size: 'M24', diameterOverride: '25', qty: '1' }, { l: '1000', w: '100', threadLen: '100' }));
        expect(c.calculatedDevelopedLength).toBe(1063);
        expect(c.developedLengthSource).toBe('auto');
        expect(c.geometry?.weighedLength).toBe(1063);
        expect(c.unitWeight).toBeCloseTo(rodWeight(25, 1063), 12);
    });

    it('a custom 1070 drives weight and price while 1063 stays as the calculated reference (G)', () => {
        const c = computeItem(item({ product: 'lbolt', size: 'M24', diameterOverride: '25', qty: '1', pricing: { costRate: '8.50', addCost: null, markup: null, noRound: false, override: null } }, { l: '1000', w: '100', developedLength: '1070' }));
        expect(c.developedLengthSource).toBe('custom');
        expect(c.calculatedDevelopedLength).toBe(1063);
        expect(c.geometry?.weighedLength).toBe(1070);
        expect(c.unitWeight).toBeCloseTo(rodWeight(25, 1070), 12);
        const auto = computeItem(item({ product: 'lbolt', size: 'M24', diameterOverride: '25', qty: '1', pricing: { costRate: '8.50', addCost: null, markup: null, noRound: false, override: null } }, { l: '1000', w: '100' }));
        expect(c.calculated!.finalUnitPrice).toBeGreaterThan(auto.calculated!.finalUnitPrice);
        // blank again = back to AUTO
        expect(auto.developedLengthSource).toBe('auto');
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
        const typed = item({ size: 'M12', finish: 'PL', qty: '1', pricing: { costRate: '4.10', addCost: null, markup: '5', noRound: false, override: null } }, { length: '1000' });
        expect(computeItem(typed).effective.costRate).toBe('4.10');
        expect(computeItem({ ...typed, finish: 'HDG' }).effective.costRate).toBe('4.10');
        expect(computeItem({ ...typed, finish: 'HDG' }).effective.addCost).toBe('1.60');
        expect(computeItem(typed).pricing?.rawUnitPrice).toBeCloseTo((rodWeight(12, 1000) * 4.1 + 0) * 1.05, 10);
    });

    it('Override unit price: the calculated unit stays, the final unit uses the override (I / J)', () => {
        const base = item({ size: 'M12', qty: '10' }, { length: '1000' });
        const calcOnly = computeItem(base);
        const ov = computeItem({ ...base, pricing: { ...base.pricing, override: '9.90' } });
        expect(ov.overrideUnitPrice).toBe(9.9);
        expect(ov.pricing?.priceSource).toBe('manual');
        expect(ov.pricing?.finalUnitPrice).toBe(9.9);
        expect(ov.pricing?.totalAmount).toBe(99);
        // the calculated price never disappears and is exactly the non-override price
        expect(ov.calculated?.finalUnitPrice).toBe(calcOnly.pricing?.finalUnitPrice);
        expect(ov.calculated?.finalUnitPrice).toBeGreaterThan(0);
        // it keeps recalculating while the override is in force (Bar Ø 12 → 13)
        const thicker = computeItem({ ...base, diameterOverride: '13', pricing: { ...base.pricing, override: '9.90' } });
        expect(thicker.calculated!.finalUnitPrice).toBeGreaterThan(ov.calculated!.finalUnitPrice);
        expect(thicker.pricing?.finalUnitPrice).toBe(9.9);
        // "Use calculated price" = override cleared → final returns to calculated
        const back = computeItem({ ...base, pricing: { ...base.pricing, override: null } });
        expect(back.pricing?.finalUnitPrice).toBe(calcOnly.pricing?.finalUnitPrice);
        expect(back.overrideUnitPrice).toBeNull();
        // an empty override blocks
        expect(computeItem({ ...base, pricing: { ...base.pricing, override: '' } }).errors.override).toBeDefined();
        // with an override, a missing cost rate warns (no calculated unit) instead of blocking
        const noRate = computeItem(item({ product: 'lbolt', size: 'M20', qty: '1', pricing: { costRate: null, addCost: null, markup: null, noRound: false, override: '20' } }, { l: '900', w: '70' }));
        expect(noRate.errors.costRate).toBeUndefined();
        expect(noRate.warnings.costRate).toMatch(/to see the calculated unit price/);
        expect(noRate.valid).toBe(true);
    });

    it('No Round applies to the calculated price only', () => {
        const base = item({ size: 'M12', qty: '1' }, { length: '1000' });
        const nr = computeItem({ ...base, pricing: { ...base.pricing, noRound: true } });
        expect(nr.calculated?.priceMode).toBe('no_round');
        expect(nr.calculated?.finalUnitPrice).toBe(Math.round(nr.calculated!.rawUnitPrice * 100) / 100);
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
        expect(emptyItem('lbolt').qty).toBe('1');
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
        expect(draftKey('nicholas')).toBe('dnc-quo:builder-draft:v2:nicholas:new');
        window.localStorage.setItem(draftKey('alson'), '{not json');
        expect(loadDraft('alson')).toBeNull();
        window.localStorage.setItem(draftKey('alson'), JSON.stringify({ v: 1, savedAt: 'x', username: 'nicholas', quotation: q }));
        expect(loadDraft('alson')).toBeNull();
        clearDraft('nicholas');
        expect(loadDraft('nicholas')).toBeNull();
    });

    it('carries a v1 draft forward (manual → override, no_round → noRound, quick rows → batch) instead of dropping it', () => {
        const v1item = { ...item({ size: 'M12' }, { length: '1000' }), entryMode: 'quick', pricing: { costRate: '3.50', addCost: null, markup: '5', mode: 'manual', manualUnitPrice: '4.80' } };
        const q = { ...emptyQuotation('2026-10-22'), items: [v1item] };
        window.localStorage.setItem('dnc-quo:builder-draft:v1:nicholas:new', JSON.stringify({ v: 1, savedAt: '2026-10-22T03:00:00.000Z', username: 'nicholas', quotation: q }));
        const d = loadDraft('nicholas')!;
        expect(d.v).toBe(2);
        expect(d.quotation.items[0]!.entryMode).toBe('batch');
        expect(d.quotation.items[0]!.pricing).toEqual({ costRate: '3.50', addCost: null, markup: '5', noRound: false, override: '4.80' });
        clearDraft('nicholas');
        expect(window.localStorage.getItem('dnc-quo:builder-draft:v1:nicholas:new')).toBeNull();
    });

    it('treats only real entries as meaningful (not the default date)', () => {
        const q = emptyQuotation('2026-10-22');
        expect(isMeaningful(q)).toBe(false);
        expect(isMeaningful({ ...q, remarks: 'x' })).toBe(true);
        expect(isMeaningful({ ...q, items: [item()] })).toBe(true);
    });
});

describe('Add & another — nextItemFrom (Owner Smoke #2 Loop #2)', () => {
    it('keeps the common context and resets everything per item', () => {
        const prev: DraftItem = {
            ...emptyItem('lbolt', 'manual'),
            material: '4140 QT',
            treatment: 'HARDEN',
            propertyClass: '10.9',
            sizeType: 'UNDERSIZE',
            finish: 'HDG',
            size: 'M20',
            diameterOverride: '19.5',
            qty: '30',
            dims: { ...emptyItem().dims, l: '900', w: '70', threadLen: '150', developedLength: '980' },
            accessories: { nut: { qty: '2', finish: 'HDG', unitPrice: '' }, fw: null, custom: null },
            pricing: { costRate: '8.50', addCost: '0.40', markup: '5', noRound: true, override: '20.00' },
        };
        const next = nextItemFrom(prev);
        expect(next.uid).not.toBe(prev.uid);
        expect(next).toMatchObject({ product: 'lbolt', entryMode: 'manual', material: '4140 QT', treatment: 'HARDEN', propertyClass: '10.9', sizeType: 'UNDERSIZE', finish: 'HDG' });
        expect(next.pricing).toEqual({ costRate: '8.50', addCost: '0.40', markup: '5', noRound: false, override: null });
        expect(next.size).toBe('');
        expect(next.diameterOverride).toBe('');
        expect(next.qty).toBe('1');
        expect(next.dims).toEqual(emptyItem().dims);
        expect(next.accessories).toEqual({ nut: null, fw: null, custom: null });
    });
});

describe('Quick Add demo fixture (not AI)', () => {
    it('is deterministic: Item A ready, Item B needs review', () => {
        const [a, b] = demoExtraction();
        expect(DEMO_LABEL).toBe('Demo extracted items — not real AI output');
        expect(demoExtraction().map((x) => ({ ...x, item: { ...x.item, uid: '' } }))).toEqual([a, b].map((x) => ({ ...x!, item: { ...x!.item, uid: '' } })));
        const ca = computeItem(a!.item);
        expect(a!.uncertain).toEqual([]);
        expect(ca.valid).toBe(true);
        expect(ca.title).toBe('MS UNDERSIZE SAG ROD · ZP');
        expect(ca.diameter).toBe(10.7);
        expect(ca.threadLen).toBe('100/100');
        expect(a!.item.qty).toBe('30');
        const cb = computeItem(b!.item);
        expect(b!.uncertain).toEqual(['finish', 'costRate']);
        expect(cb.title).toBe('4140 QT FULLSIZE L BOLT · PL');
        expect(cb.diameter).toBe(17);
        expect(cb.errors.costRate).toMatch(/No default rate/);
        expect(b!.item.qty).toBe('20');
    });
});

