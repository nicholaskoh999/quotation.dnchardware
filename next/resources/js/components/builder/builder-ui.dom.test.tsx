import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeItem } from '@/builder/compute';
import { emptyItem, type DraftItem } from '@/builder/model';
import { Combobox } from './combobox';
import { ItemEditor } from './item-editor';
import { BatchAdd, rowToItem } from './batch-add';
import { QuickAdd, quickAddAnalyzer, type QuickAddAnalyzer } from './quick-add';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
    router: { on: () => () => {}, get: vi.fn() },
    usePage: () => ({ url: '/quotations/new', props: { auth: { user: { id: 7, username: 'nicholas', displayName: 'Nicholas Koh', source: 'app_users' } } } }),
}));
vi.mock('@/layouts/app-layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/lib/feedback', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undoable: vi.fn(), added: vi.fn() } }));

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
beforeEach(() => Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true }));
afterEach(cleanup);

describe('Combobox (no native datalist)', () => {
    function Harness({ onPick }: { onPick?: (v: string) => void }) {
        const [v, setV] = useState('');
        return (
            <Combobox
                id="size"
                aria-label="Size"
                value={v}
                onChange={setV}
                onSelect={(o) => {
                    setV(o.value);
                    onPick?.(o.value);
                }}
                options={[
                    { value: 'M12', label: 'M12' },
                    { value: 'M16', label: 'M16' },
                    { value: '1/2', label: '1/2"' },
                ]}
            />
        );
    }

    it('filters, picks with the keyboard, keeps free text, and renders no <datalist>', () => {
        const onPick = vi.fn();
        const { container } = render(<Harness onPick={onPick} />);
        const input = screen.getByRole('combobox', { name: 'Size' });
        expect(container.querySelector('datalist')).toBeNull();
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'm1' } });
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['M12', 'M16']);
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(input.getAttribute('aria-activedescendant')).toMatch(/-1$/);
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onPick).toHaveBeenCalledWith('M16');
        expect((input as HTMLInputElement).value).toBe('M16');
        // an unusual size is never blocked
        fireEvent.change(input, { target: { value: 'M17.5' } });
        expect((input as HTMLInputElement).value).toBe('M17.5');
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(screen.queryByRole('listbox')).toBeNull();
    });
});

describe('Batch Add rows are the same item model as Manual Add', () => {
    it('a row becomes exactly the item a Manual Add would create, priced identically', () => {
        const group: DraftItem = { ...emptyItem('sagrod', 'batch'), finish: 'ZP', accessories: { nut: { qty: '0', finish: 'ZP', unitPrice: '0.2' }, fw: null, custom: null } };
        const fromQuick = rowToItem(group, { key: 'r', size: 'M12', dims: { length: '1245', threadLen: '100' }, qty: '30' });
        const manual: DraftItem = {
            ...emptyItem('sagrod', 'manual'),
            finish: 'ZP',
            size: 'M12',
            qty: '30',
            accessories: { nut: { qty: '0', finish: 'ZP', unitPrice: '0.2' }, fw: null, custom: null },
            dims: { ...emptyItem().dims, length: '1245', threadLen: '100' },
        };
        expect(fromQuick.entryMode).toBe('batch');
        expect({ ...fromQuick, uid: '', entryMode: '' }).toEqual({ ...manual, uid: '', entryMode: '' });
        const a = computeItem(fromQuick);
        const b = computeItem(manual);
        expect(a.pricing?.finalUnitPrice).toBe(b.pricing?.finalUnitPrice);
        expect(a.dimensionLine).toBe('M12 x L 1245 x TL 100/100mm');
        expect(a.pricing?.accessories.nut.qty).toBe(0);
        // rows never share accessory objects with the group
        fromQuick.accessories.nut!.qty = '5';
        expect(group.accessories.nut!.qty).toBe('0');
    });
});

describe('Quick Add = AI-assisted extraction (Owner Smoke #2 definition)', () => {
    it('opens a text / image / PDF intake — never a grouped row editor — and does not fake analysis (A)', () => {
        expect(quickAddAnalyzer).toBeNull();
        render(<QuickAdd open onOpenChange={() => {}} onAdd={() => {}} />);
        const qa = screen.getByTestId('quick-add');
        expect(within(qa).getByRole('heading', { name: 'Quick Add' }) ?? within(qa).getByText('Quick Add')).toBeTruthy();
        expect(within(qa).getByTestId('qa-tab-text').textContent).toBe('Paste Text');
        expect(within(qa).getByTestId('qa-tab-file').textContent).toBe('Upload Image / PDF');
        expect(within(qa).getByTestId('qa-text')).toBeTruthy();
        // no Batch Add row editor inside Quick Add
        expect(within(qa).queryByTestId('ba-rows')).toBeNull();
        expect(within(qa).queryByText(/Row 1/)).toBeNull();
        // Analyze is honestly unavailable without the Session I backend
        fireEvent.change(within(qa).getByTestId('qa-text'), { target: { value: 'M12 sag rod 1245 tl100 zp 30pcs' } });
        expect((within(qa).getByTestId('qa-analyze') as HTMLButtonElement).disabled).toBe(true);
        expect(within(qa).getByTestId('qa-unavailable').textContent).toMatch(/Session I/);
        fireEvent.click(within(qa).getByTestId('qa-tab-file'));
        const file = within(qa).getByTestId('qa-file') as HTMLInputElement;
        expect(file.accept).toBe('image/*,application/pdf');
    });

    it('reviews extracted items (injected analyzer): Ready / Needs review, Edit in the shared editor, add blocked until fixed', async () => {
        const extracted: DraftItem = { ...emptyItem('sagrod', 'quick'), size: 'M12', finish: 'ZP', qty: '30', dims: { ...emptyItem().dims, length: '1245', threadLen: '100' } };
        const unsure: DraftItem = { ...emptyItem('lbolt', 'quick'), size: 'M16', dims: { ...emptyItem().dims, l: '900', w: '70' } };
        const analyzer: QuickAddAnalyzer = async () => [
            { item: extracted, uncertain: [], source: 'M12 sag rod 1245 tl100 zp 30pcs' },
            { item: unsure, uncertain: ['costRate', 'finish'], source: 'M16 l bolt 900x70' },
        ];
        const onAdd = vi.fn();
        render(<QuickAdd open onOpenChange={() => {}} onAdd={onAdd} analyzer={analyzer} />);
        const qa = screen.getByTestId('quick-add');
        fireEvent.change(within(qa).getByTestId('qa-text'), { target: { value: 'two lines' } });
        await act(async () => {
            fireEvent.click(within(qa).getByTestId('qa-analyze'));
        });
        const items = within(qa).getAllByTestId('qa-review-item');
        expect(items).toHaveLength(2);
        expect(within(qa).queryByTestId('qa-demo-banner')).toBeNull(); // a real analyzer's output is not labelled demo
        expect(within(items[0]!).getByTestId('qa-status').textContent?.trim()).toBe('Ready');
        expect(within(items[1]!).getByTestId('qa-status').textContent?.trim()).toBe('Needs review');
        expect(within(items[1]!).getByTestId('qa-uncertain').textContent).toBe('Check: cost rate, finish');
        expect(within(qa).getByTestId('qa-summary').textContent).toBe('2 items · 1 needs review');
        expect((within(qa).getByTestId('qa-add-confirmed') as HTMLButtonElement).disabled).toBe(true);
        // fix item 2 in the shared item editor
        fireEvent.click(within(items[1]!).getByTestId('qa-edit'));
        const ed = screen.getByTestId('item-editor');
        expect(within(ed).getByText('Extracted item 2 · review')).toBeTruthy();
        fireEvent.change(ed.querySelector('#ed-costRate')!, { target: { value: '8.50' } });
        fireEvent.click(within(ed).getByTestId('ed-submit'));
        expect(screen.queryByTestId('item-editor')).toBeNull();
        const after = within(qa).getAllByTestId('qa-review-item');
        expect(within(after[1]!).getByTestId('qa-status').textContent?.trim()).toBe('Ready');
        expect(within(after[1]!).queryByTestId('qa-uncertain')).toBeNull();
        expect(within(qa).getByTestId('qa-summary').textContent).toMatch(/^2 items · all ready · RM [\d,]+\.\d{2}$/);
        expect(within(qa).getByTestId('qa-add-confirmed').textContent).toBe('Add confirmed items (2)');
        fireEvent.click(within(qa).getByTestId('qa-add-confirmed'));
        expect(onAdd).toHaveBeenCalledTimes(1);
        const added = onAdd.mock.calls[0]![0] as DraftItem[];
        expect(added).toHaveLength(2);
        expect(added.every((x) => x.entryMode === 'quick')).toBe(true);
        expect(added[0]!.qty).toBe('30');
        expect(computeItem(added[0]!).threadLen).toBe('100/100');
        expect(added[1]!.pricing.costRate).toBe('8.50');
    });

    it('View demo analysis: labelled demo, fixed items (1 Ready + 1 Needs review), Analyze stays disabled, nothing sent', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const onAdd = vi.fn();
        render(<QuickAdd open onOpenChange={() => {}} onAdd={onAdd} />);
        const qa = screen.getByTestId('quick-add');
        expect((within(qa).getByTestId('qa-analyze') as HTMLButtonElement).disabled).toBe(true);
        expect(within(qa).getByTestId('qa-demo-caption').textContent).toMatch(/not real AI output/);
        fireEvent.click(within(qa).getByTestId('qa-demo'));
        expect(within(qa).getByTestId('qa-demo-banner').textContent).toMatch(/^Demo extracted items — not real AI output/);
        const items = within(qa).getAllByTestId('qa-review-item');
        expect(items.map((li) => li.getAttribute('data-status'))).toEqual(['ready', 'needs-review']);
        expect(within(items[0]!).getByTestId('qa-item-title').textContent).toBe('MS UNDERSIZE SAG ROD · ZP');
        expect(within(items[0]!).getByTestId('qa-item-facts').textContent).toContain('Bar Ø10.7 mm');
        expect(within(items[0]!).getByTestId('qa-item-facts').textContent).toContain('M12 × L1245 × TL100/100');
        expect(within(items[0]!).getByTestId('qa-item-facts').textContent).toContain('Qty30');
        expect(within(items[1]!).getByTestId('qa-item-title').textContent).toBe('4140 QT FULLSIZE L BOLT · PL');
        expect(within(items[1]!).getByTestId('qa-item-facts').textContent).toContain('Bar Ø17 mm');
        expect(within(items[1]!).getByTestId('qa-item-facts').textContent).toContain('Qty20');
        expect(within(qa).getByTestId('qa-summary').textContent).toBe('2 items · 1 needs review');
        expect((within(qa).getByTestId('qa-add-confirmed') as HTMLButtonElement).disabled).toBe(true);
        // edit / fix through the shared editor
        fireEvent.click(within(items[1]!).getByTestId('qa-edit'));
        const ed = screen.getByTestId('item-editor');
        expect(within(ed).getByText('Demo item 2 · review')).toBeTruthy();
        expect((ed.querySelector('#ed-diameter') as HTMLInputElement).value).toBe('17');
        fireEvent.click(within(ed).getByTestId('ed-submit'));
        expect(within(ed).getByTestId('error-ed-costRate').textContent).toMatch(/No default rate/); // still blocked
        fireEvent.change(ed.querySelector('#ed-costRate')!, { target: { value: '9.00' } });
        fireEvent.click(within(ed).getByTestId('ed-submit'));
        expect(within(qa).getByTestId('qa-summary').textContent).toMatch(/^2 items · all ready/);
        fireEvent.click(within(qa).getByTestId('qa-add-confirmed'));
        const added = onAdd.mock.calls[0]![0] as DraftItem[];
        expect(added.map((x) => x.product)).toEqual(['sagrod', 'lbolt']);
        expect(added.every((x) => x.entryMode === 'quick')).toBe(true);
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});

describe('Item editor', () => {
    it('blocks an incomplete item with messages next to the fields, then saves the shared model', () => {
        const onSave = vi.fn();
        render(<ItemEditor open onOpenChange={() => {}} initial={emptyItem('sagrod', 'manual')} isNew itemNumber={1} onSave={onSave} />);
        const editor = screen.getByTestId('item-editor');
        fireEvent.click(within(editor).getByTestId('ed-submit'));
        expect(onSave).not.toHaveBeenCalled();
        expect(within(editor).getByTestId('error-ed-size').textContent).toBe('Enter a size');
        expect(within(editor).getByTestId('error-ed-length').textContent).toBe('Enter L');
        // a new item starts at Qty 1 (H)
        expect((editor.querySelector('#ed-qty') as HTMLInputElement).value).toBe('1');
        expect(within(editor).queryByTestId('error-ed-qty')).toBeNull();

        fireEvent.change(editor.querySelector('#ed-size')!, { target: { value: '12' } });
        fireEvent.change(editor.querySelector('#ed-length')!, { target: { value: '1245' } });
        fireEvent.change(editor.querySelector('#ed-threadLen')!, { target: { value: '100' } });
        fireEvent.change(editor.querySelector('#ed-qty')!, { target: { value: '-2' } });
        expect(within(editor).getByTestId('error-ed-qty').textContent).toBe('Qty cannot be negative');
        fireEvent.change(editor.querySelector('#ed-qty')!, { target: { value: '30' } });
        expect(within(editor).getByTestId('ed-preview-total').textContent).toMatch(/^RM \d+\.\d{2}$/);
        // de-duplicated: the preview no longer repeats Calculated / Override / Final / Markup
        expect(within(editor).queryByTestId('ed-preview-final')).toBeNull();
        expect(within(editor).queryByTestId('ed-preview-calculated')).toBeNull();
        expect(within(editor).queryByTestId('ed-preview-markup')).toBeNull();
        expect(within(editor).getByTestId('ed-price-mode').textContent).toBe('Calculated');
        fireEvent.click(within(editor).getByTestId('ed-submit'));
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave.mock.calls[0]![1]).toEqual({ keepOpen: false });
        const saved = onSave.mock.calls[0]![0] as DraftItem;
        expect(saved).toMatchObject({ product: 'sagrod', size: '12', qty: '30', entryMode: 'manual' });
        expect(saved.dims.threadLen).toBe('100');
        expect(computeItem(saved).threadLen).toBe('100/100');
    });

    it('Override unit price keeps the calculated unit visible; Use calculated price restores it (I / J)', () => {
        const start: DraftItem = { ...emptyItem('sagrod', 'manual'), size: 'M12', qty: '10', dims: { ...emptyItem().dims, length: '1000' } };
        render(<ItemEditor open onOpenChange={() => {}} initial={start} isNew={false} itemNumber={2} onSave={() => {}} />);
        const editor = screen.getByTestId('item-editor');
        // no price-mode dropdown in the normal flow
        expect(within(editor).queryByText(/Auto Round/)).toBeNull();
        const calc = within(editor).getByTestId('ed-calculated-unit').textContent!;
        expect(calc).toMatch(/^RM \d+\.\d{2}$/);
        expect(within(editor).getByTestId('ed-override-none').textContent).toBe('—');
        expect(within(editor).getByTestId('ed-final-unit').textContent).toBe(calc);
        act(() => {
            fireEvent.click(within(editor).getByTestId('ed-override-unit'));
        });
        expect(within(editor).getByTestId('ed-price-mode').textContent).toBe('Override');
        fireEvent.change(within(editor).getByTestId('ed-override-input'), { target: { value: '20.00' } });
        expect(within(editor).getByTestId('ed-calculated-unit').textContent).toBe(calc);
        expect(within(editor).getByTestId('ed-final-unit').textContent).toBe('RM 20.00');
        // the calculated unit keeps recalculating under an override (Bar Ø 12 → 13)
        const bar = editor.querySelector('#ed-diameter') as HTMLInputElement;
        fireEvent.focus(bar);
        fireEvent.change(bar, { target: { value: '13' } });
        fireEvent.blur(bar);
        expect(within(editor).getByTestId('ed-calculated-unit').textContent).not.toBe(calc);
        expect(within(editor).getByTestId('ed-final-unit').textContent).toBe('RM 20.00');
        act(() => {
            fireEvent.click(within(editor).getByTestId('ed-use-calculated'));
        });
        expect(within(editor).getByTestId('ed-override-none')).toBeTruthy();
        expect(within(editor).getByTestId('ed-final-unit').textContent).toBe(within(editor).getByTestId('ed-calculated-unit').textContent);
    });

    it('Bar Ø is always editable: suggested 10.6 prefilled, custom 10.7 kept (D)', () => {
        const start: DraftItem = { ...emptyItem('sagrod', 'manual'), size: 'M12', sizeType: 'UNDERSIZE', dims: { ...emptyItem().dims, length: '1000' } };
        const onSave = vi.fn();
        render(<ItemEditor open onOpenChange={() => {}} initial={start} isNew itemNumber={1} onSave={onSave} />);
        const editor = screen.getByTestId('item-editor');
        const bar = editor.querySelector('#ed-diameter') as HTMLInputElement;
        expect(bar.value).toBe('10.6');
        expect(bar.getAttribute('data-state')).toBe('auto');
        expect(within(editor).getByTestId('ed-diameter-state').textContent).toBe('Suggested from M12 · Undersize');
        fireEvent.focus(bar);
        fireEvent.change(bar, { target: { value: '' } });
        expect(bar.value).toBe(''); // clearing to retype never snaps back mid-edit
        fireEvent.change(bar, { target: { value: '10.7' } });
        fireEvent.blur(bar);
        expect(bar.value).toBe('10.7');
        expect(bar.getAttribute('data-state')).toBe('custom');
        expect(within(editor).getByTestId('ed-diameter-state').textContent).toMatch(/^Custom/);
        expect(within(editor).getByTestId('ed-preview-bar').textContent).toBe('10.7 mm · custom');
        // a finish change does not touch the custom Ø
        fireEvent.click(within(editor).getByRole('radio', { name: 'HDG' }));
        expect((editor.querySelector('#ed-diameter') as HTMLInputElement).value).toBe('10.7');
        fireEvent.click(within(editor).getByTestId('ed-diameter-use-suggested'));
        expect((editor.querySelector('#ed-diameter') as HTMLInputElement).value).toBe('10.6');
    });

    it('Developed length shows the calculated 1063 in the field; a custom 1070 shows the calculated reference (F / G)', () => {
        const start: DraftItem = { ...emptyItem('lbolt', 'manual'), size: 'M24', diameterOverride: '25', dims: { ...emptyItem().dims, l: '1000', w: '100', threadLen: '100' } };
        render(<ItemEditor open onOpenChange={() => {}} initial={start} isNew itemNumber={1} onSave={() => {}} />);
        const editor = screen.getByTestId('item-editor');
        const dl = editor.querySelector('#ed-developedLength') as HTMLInputElement;
        expect(dl.value).toBe('1063');
        expect(dl.getAttribute('data-state')).toBe('auto');
        fireEvent.focus(dl);
        fireEvent.change(dl, { target: { value: '1070' } });
        fireEvent.blur(dl);
        expect(dl.value).toBe('1070');
        expect(within(editor).getByTestId('ed-developedLength-state').textContent).toMatch(/Custom.*Calculated: 1063 mm/);
        fireEvent.click(within(editor).getByTestId('ed-developedLength-use-calculated'));
        expect((editor.querySelector('#ed-developedLength') as HTMLInputElement).value).toBe('1063');
    });
});

describe('Manual Add continuous entry (Owner Smoke #2 Loop #2)', () => {
    const ready = (): DraftItem => ({ ...emptyItem('sagrod', 'manual'), size: 'M12', qty: '1', dims: { ...emptyItem().dims, length: '1070', threadLen: '100' } });

    it('footer: Cancel · Add & another (primary) · Add item, with keyboard hints and live context; Edit keeps Save item', () => {
        render(<ItemEditor open onOpenChange={() => {}} initial={ready()} isNew itemNumber={7} onSave={() => {}} context="6 items · RM 412.30" />);
        const ed = screen.getByTestId('item-editor');
        const actions = within(ed).getByTestId('ed-actions');
        expect(Array.from(actions.querySelectorAll('button')).map((b) => b.getAttribute('data-testid'))).toEqual(['ed-cancel', 'ed-add-another', 'ed-submit']);
        expect(within(ed).getByTestId('ed-add-another').textContent).toBe('Add & another Enter');
        expect(within(ed).getByTestId('ed-submit').textContent).toMatch(/^Add item (Ctrl|⌘)\+Enter$/);
        expect(within(ed).getByTestId('ed-cancel').textContent).toBe('Cancel Esc');
        // hints are desktop / tablet only (hidden below sm)
        for (const k of within(ed).getAllByTestId('kbd-hint')) expect(k.className).toMatch(/\bhidden\b.*\bsm:inline-block\b/);
        expect(within(ed).getByTestId('ed-context').textContent).toBe('6 items · RM 412.30');
        cleanup();
        render(<ItemEditor open onOpenChange={() => {}} initial={ready()} isNew={false} itemNumber={2} onSave={() => {}} />);
        const edit = screen.getByTestId('item-editor');
        expect(within(edit).queryByTestId('ed-add-another')).toBeNull();
        expect(within(edit).getByTestId('ed-submit').textContent).toBe('Save item Enter');
    });

    it('Add & another (button or Enter) keeps the dialog; Ctrl/⌘+Enter adds and closes', () => {
        const onSave = vi.fn();
        render(<ItemEditor open onOpenChange={() => {}} initial={ready()} isNew itemNumber={1} onSave={onSave} />);
        const ed = screen.getByTestId('item-editor');
        fireEvent.click(within(ed).getByTestId('ed-add-another'));
        expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ size: 'M12' }), { keepOpen: true });
        const qty = ed.querySelector('#ed-qty')!;
        fireEvent.keyDown(qty, { key: 'Enter' });
        expect(onSave).toHaveBeenCalledTimes(2);
        expect(onSave.mock.calls[1]![1]).toEqual({ keepOpen: true });
        fireEvent.keyDown(qty, { key: 'Enter', ctrlKey: true });
        expect(onSave.mock.calls[2]![1]).toEqual({ keepOpen: false });
        fireEvent.keyDown(qty, { key: 'Enter', metaKey: true });
        expect(onSave.mock.calls[3]![1]).toEqual({ keepOpen: false });
    });

    it('keyboard guards: held Enter, Enter on an open combobox list and on buttons / selects never add; an invalid item is not added', () => {
        const onSave = vi.fn();
        render(<ItemEditor open onOpenChange={() => {}} initial={ready()} isNew itemNumber={1} onSave={onSave} />);
        const ed = screen.getByTestId('item-editor');
        fireEvent.keyDown(ed.querySelector('#ed-qty')!, { key: 'Enter', repeat: true });
        const size = ed.querySelector('#ed-size') as HTMLInputElement;
        fireEvent.focus(size);
        expect(size.getAttribute('aria-expanded')).toBe('true');
        fireEvent.keyDown(size, { key: 'Enter' });
        fireEvent.keyDown(ed.querySelector('#ed-product')!, { key: 'Enter' });
        fireEvent.keyDown(within(ed).getByTestId('ed-cancel'), { key: 'Enter' });
        expect(onSave).not.toHaveBeenCalled();
        cleanup();
        const blank = vi.fn();
        render(<ItemEditor open onOpenChange={() => {}} initial={emptyItem('sagrod', 'manual')} isNew itemNumber={1} onSave={blank} />);
        const ed2 = screen.getByTestId('item-editor');
        fireEvent.keyDown(ed2.querySelector('#ed-qty')!, { key: 'Enter' });
        expect(blank).not.toHaveBeenCalled();
        expect(within(ed2).getByTestId('error-ed-size').textContent).toBe('Enter a size');
    });
});

describe('Batch Add for 20–30 rows (Owner Smoke #2 Loop #2)', () => {
    const fillRow = (dlg: HTMLElement, n: number, size: string, l: string) => {
        fireEvent.change(within(dlg).getByLabelText(`Row ${n} size`), { target: { value: size } });
        fireEvent.change(within(dlg).getByLabelText(`Row ${n} L`), { target: { value: l } });
    };

    it('22 rows: weight · unit · total per row, "N valid rows · Total", Add N items; an invalid row blocks with "needs attention"', () => {
        const onAdd = vi.fn();
        render(<BatchAdd open onOpenChange={() => {}} onAdd={onAdd} />);
        const dlg = screen.getByTestId('batch-add');
        for (let i = 0; i < 19; i++) fireEvent.click(within(dlg).getByTestId('ba-add-row'));
        expect(within(dlg).getAllByTestId('ba-row')).toHaveLength(22);
        for (let n = 1; n <= 20; n++) fillRow(dlg, n, 'M12', String(1000 + n));
        expect(within(dlg).getByTestId('ba-status').textContent).toMatch(/^20 valid rows · Total RM [\d,]+\.\d{2}$/);
        expect(within(dlg).getByTestId('ba-submit').textContent).toMatch(/^Add 20 items/);
        const first = within(dlg).getAllByTestId('ba-row')[0]!;
        expect(within(first).getByTestId('ba-row-weight').textContent).toMatch(/kg$/);
        expect(within(first).getByTestId('ba-row-unit').textContent).toMatch(/^RM /);
        expect(within(first).getByTestId('ba-row-total').textContent).toMatch(/^RM /);
        // row 21 with a size but no L needs attention → blocked
        fireEvent.change(within(dlg).getByLabelText('Row 21 size'), { target: { value: 'M12' } });
        expect(within(dlg).getByTestId('ba-status').textContent).toBe('20 ready · 1 needs attention');
        fireEvent.click(within(dlg).getByTestId('ba-submit'));
        expect(onAdd).not.toHaveBeenCalled();
        fireEvent.change(within(dlg).getByLabelText('Row 21 L'), { target: { value: '900' } });
        // Ctrl+Enter adds all; the two blank rows are ignored
        fireEvent.keyDown(within(dlg).getByLabelText('Row 21 L'), { key: 'Enter', ctrlKey: true });
        expect(onAdd).toHaveBeenCalledTimes(1);
        expect((onAdd.mock.calls[0]![0] as DraftItem[]).length).toBe(21);
    });

    it('plain Enter moves to the next cell and adds a row after the last — it never submits', () => {
        const onAdd = vi.fn();
        render(<BatchAdd open onOpenChange={() => {}} onAdd={onAdd} />);
        const dlg = screen.getByTestId('batch-add');
        fillRow(dlg, 1, 'M12', '1000');
        const l1 = within(dlg).getByLabelText('Row 1 L');
        l1.focus();
        fireEvent.keyDown(l1, { key: 'Enter' });
        expect(document.activeElement).toBe(within(dlg).getByLabelText('Row 1 TL'));
        const qty3 = within(dlg).getByLabelText('Row 3 Qty');
        qty3.focus();
        fireEvent.keyDown(qty3, { key: 'Enter' });
        expect(within(dlg).getAllByTestId('ba-row')).toHaveLength(4);
        expect(onAdd).not.toHaveBeenCalled();
    });
});

