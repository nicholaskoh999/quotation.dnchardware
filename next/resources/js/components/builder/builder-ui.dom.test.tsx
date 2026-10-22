import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeItem } from '@/builder/compute';
import { emptyItem, type DraftItem } from '@/builder/model';
import { Combobox } from './combobox';
import { ItemEditor } from './item-editor';
import { rowToItem } from './quick-add';

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

describe('Quick Add rows are the same item model as Manual Add', () => {
    it('a row becomes exactly the item a Manual Add would create, priced identically', () => {
        const group: DraftItem = { ...emptyItem('sagrod', 'quick'), finish: 'ZP', accessories: { nut: { qty: '0', finish: 'ZP', unitPrice: '0.2' }, fw: null, custom: null } };
        const fromQuick = rowToItem(group, { key: 'r', size: 'M12', dims: { length: '1245', threadLen: '100' }, qty: '30' });
        const manual: DraftItem = {
            ...emptyItem('sagrod', 'manual'),
            finish: 'ZP',
            size: 'M12',
            qty: '30',
            accessories: { nut: { qty: '0', finish: 'ZP', unitPrice: '0.2' }, fw: null, custom: null },
            dims: { ...emptyItem().dims, length: '1245', threadLen: '100' },
        };
        expect(fromQuick.entryMode).toBe('quick');
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

describe('Item editor', () => {
    it('blocks an incomplete item with messages next to the fields, then saves the shared model', () => {
        const onSave = vi.fn();
        render(<ItemEditor open onOpenChange={() => {}} initial={emptyItem('sagrod', 'manual')} isNew itemNumber={1} onSave={onSave} />);
        const editor = screen.getByTestId('item-editor');
        fireEvent.click(within(editor).getByTestId('ed-submit'));
        expect(onSave).not.toHaveBeenCalled();
        expect(within(editor).getByTestId('error-ed-size').textContent).toBe('Enter a size');
        expect(within(editor).getByTestId('error-ed-length').textContent).toBe('Enter L');
        expect(within(editor).getByTestId('error-ed-qty').textContent).toBe('Enter Qty');

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

    it('makes a manual override an explicit action and shows the calculated reference', () => {
        const start: DraftItem = { ...emptyItem('sagrod', 'manual'), size: 'M12', qty: '10', dims: { ...emptyItem().dims, length: '1000' } };
        render(<ItemEditor open onOpenChange={() => {}} initial={start} isNew={false} itemNumber={2} onSave={() => {}} />);
        const editor = screen.getByTestId('item-editor');
        // there is no price-mode dropdown in the normal flow
        expect(within(editor).queryByRole('combobox', { name: /price mode/i })).toBeNull();
        expect(within(editor).queryByText(/Auto Round/)).toBeNull();
        act(() => {
            fireEvent.click(within(editor).getByTestId('ed-set-manual'));
        });
        expect(within(editor).getByTestId('ed-price-mode').textContent).toBe('Manual override');
        expect(within(editor).getByTestId('ed-calculated-reference').textContent).toMatch(/^RM /);
        expect(within(editor).getByTestId('ed-preview-markup').textContent).toBe('Manual');
    });
});
