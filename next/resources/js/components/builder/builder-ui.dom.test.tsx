import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeItem } from '@/builder/compute';
import { emptyItem, type DraftItem } from '@/builder/model';
import { Combobox } from './combobox';
import { ItemEditor } from './item-editor';
import { rowToItem } from './batch-add';
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
vi.mock('@/lib/feedback', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undoable: vi.fn() } }));

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

    it('reviews extracted items (from an injected analyzer), lets uncertain fields be fixed, adds only confirmed ones', async () => {
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
        expect(within(items[1]!).getByTestId('qa-uncertain').textContent).toBe('Check: cost rate, finish');
        // the certain item is pre-confirmed; the uncertain one is not, and opens for review
        expect(within(items[0]!).getByTestId('qa-confirm').getAttribute('aria-checked')).toBe('true');
        expect(within(items[1]!).getByTestId('qa-confirm').getAttribute('aria-checked')).toBe('false');
        expect(within(qa).getByTestId('qa-add-confirmed').textContent).toBe('Add confirmed items (1)');
        fireEvent.click(within(qa).getByTestId('qa-add-confirmed'));
        expect(onAdd).toHaveBeenCalledTimes(1);
        const added = onAdd.mock.calls[0]![0] as DraftItem[];
        expect(added).toHaveLength(1);
        expect(added[0]!.entryMode).toBe('quick');
        expect(added[0]!.qty).toBe('30');
        expect(computeItem(added[0]!).threadLen).toBe('100/100');
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
        expect(within(editor).getByTestId('ed-preview-final').textContent).toMatch(/^RM \d+\.\d{2}$/);
        expect(within(editor).getByTestId('ed-price-mode').textContent).toBe('Calculated');
        fireEvent.click(within(editor).getByTestId('ed-submit'));
        expect(onSave).toHaveBeenCalledTimes(1);
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
