import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CompaniesIndex from '@/pages/Companies/Index';
import CompanyShow from '@/pages/Companies/Show';
import QuotationsIndex from '@/pages/Quotations/Index';
import QuotationShow from '@/pages/Quotations/Show';
import type { CompanyRow, QuotationDetail, QuotationSummary, ReadableItem } from '@/types/legacy';

vi.mock('@inertiajs/react', () => ({
    Head: () => null,
    Link: ({ href, children, preserveScroll: _p, ...rest }: { href: string; children: ReactNode; preserveScroll?: boolean }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
    router: { get: vi.fn() },
    usePage: () => ({ props: { release: { version: '0.1.0', shortSha: null } } }),
}));
vi.mock('@/layouts/app-layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

afterEach(cleanup);

const acme: CompanyRow = {
    id: 1, name: 'ACME ENGINEERING SDN BHD', phone: '012-345 6789', address: 'LOT 1', quotationCount: 3,
    lastQuotedDate: '2026-05-02', lastQuotationCreatedAt: '2026-05-02 10:00:00', matchedBy: null,
};
const summary: QuotationSummary = {
    id: 101, refNo: 'Q-2026-0001', quoteDate: '2026-03-01', validUntil: null, preparedBy: 'Nicholas',
    customerName: 'ACME ENGINEERING SDN BHD', customerPhone: null, companyId: 1, companyName: 'ACME ENGINEERING SDN BHD',
    customerDisplay: 'ACME ENGINEERING SDN BHD', totalAmount: '1158.60', createdAt: '2026-03-01 09:00:00',
    itemSummary: { count: 3, first: { displayDescription: '4140 QT FULLSIZE L BOLT', productType: 'L BOLT', sizeType: 'FULLSIZE', material: '4140', finish: 'PL' } },
};
const detail: QuotationDetail = {
    ...summary, previousRefNo: null, remarks: 'Price subject to change', issuer: null,
    issuerNote: 'Legacy quotation — issuer was not stored.',
    itemsState: 'ok', itemCount: 3, unreadableItemCount: 1,
    items: [
        {
            position: 1, state: 'ok', itemUid: 'itm_x', fieldsSource: 'stored', itemType: 'stud', productType: 'STUD', productKey: 'STUD',
            description: '4140 QT + HARDEN = G10.9 STUD', displayDescription: '4140 QT + HARDEN = G10.9 STUD',
            material: { code: '4140_HARDEN_G10_9', key: '4140_QT', label: '4140 QT', legacyLabel: '4140 QT + HARDEN = G10.9', treatment: 'HARDEN', propertyClass: '10.9', hasFinish: true, recognised: true },
            sizeType: null, finish: 'PL', finishLabel: 'PL', sizeLabel: 'M20 x L 400mm', cleanSize: 'M20', sizeSystem: 'metric',
            dimensionPreview: 'L 400mm', qty: 5, unitSuffix: '',
            pricing: { model: 'accessory-inclusive', customerUnitPrice: 33.4, boltUnitPrice: 31.1, accessoryUnitPrice: 2.3, ambiguous: false, total: 167, totalSource: 'stored', note: null, markupPercent: null, manual: false },
            weight: 1.2, accessories: { nut: { enabled: true, qty: 2, unitPrice: 1, finish: 'HDG' }, fw: null, custom: null, summary: '2 Nut HDG' },
        },
        { position: 2, state: 'unreadable', reason: 'This saved item could not be read.' },
        {
            position: 3, state: 'ok', itemUid: null, fieldsSource: 'stored', itemType: 'sagrod', productType: 'SAG ROD', productKey: 'SAG ROD',
            description: 'MS FULLSIZE SAG ROD', displayDescription: 'MS FULLSIZE SAG ROD',
            material: { code: 'MS', key: 'MS', label: 'MS', legacyLabel: 'MS', treatment: null, propertyClass: null, hasFinish: true, recognised: true },
            sizeType: 'FULLSIZE', finish: 'PL', finishLabel: 'PL', sizeLabel: 'M16 x L 1200', cleanSize: 'M16', sizeSystem: 'metric',
            dimensionPreview: 'L 1200', qty: 10, unitSuffix: '',
            pricing: { model: 'legacy', customerUnitPrice: 3.5, boltUnitPrice: null, accessoryUnitPrice: null, ambiguous: true, total: 35, totalSource: 'stored', note: 'cannot be separated' },
            weight: null, accessories: null,
        },
    ],
};

describe('legacy read pages', () => {
    it('shows an honest "not connected" state on every page', () => {
        render(<CompaniesIndex source="not_configured" search="" companies={[]} />);
        expect(screen.getByText('Data source not connected')).toBeTruthy();
        cleanup();
        render(<QuotationShow source="unavailable" quotationId={1} quotation={null} revisions={{ state: 'unavailable', entries: [] }} />);
        expect(screen.getByText('Data source not reachable')).toBeTruthy();
        cleanup();
        render(<CompanyShow source="not_configured" companyId={1} company={null} quotations={null} />);
        expect(screen.getByTestId('data-source-notice').getAttribute('data-source')).toBe('not_configured');
        cleanup();
        render(<QuotationsIndex source="not_configured" filters={{ company: null, search: '', page: 1, sort: 'newest' }} quotations={null} />);
        expect(screen.getByTestId('data-source-notice')).toBeTruthy();
    });

    it('renders the directory as a table and as phone cards, with usage figures', () => {
        render(<CompaniesIndex source="connected" search="" companies={[acme, { ...acme, id: 2, name: 'BINA', matchedBy: 'alias', quotationCount: 1 }]} />);
        const table = screen.getByTestId('company-table');
        expect(within(table).getByText('ACME ENGINEERING SDN BHD').getAttribute('href')).toBe('/companies/1');
        expect(within(table).getAllByText('2 May 2026')).toHaveLength(2);
        expect(within(screen.getByTestId('company-cards')).getByText(/3 quotations · last quoted 2 May 2026/)).toBeTruthy();
        expect(screen.getAllByText('Matched a legacy code').length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: /new|edit|delete/i })).toBeNull();
    });

    it('switches profile tabs and shows the Price History placeholder', () => {
        render(<CompanyShow source="connected" companyId={1} company={acme} quotations={{ rows: [summary], total: 1, page: 1, perPage: 25, lastPage: 1 }} />);
        expect(screen.getByText('LOT 1')).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: 'Quotations' }));
        expect(within(screen.getByTestId('quotation-table')).getByText('Q-2026-0001')).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: 'Price History' }));
        expect(screen.getByText(/Price history is coming soon/)).toBeTruthy();
    });

    it('fills the profile Overview with existing data only: facts + latest quotations', () => {
        render(<CompanyShow source="connected" companyId={1} company={acme} quotations={{ rows: [summary], total: 1, page: 1, perPage: 25, lastPage: 1 }} />);
        const overview = screen.getByTestId('company-overview');
        expect(within(overview).getByText('Latest quotation')).toBeTruthy();
        expect(within(screen.getByTestId('company-recent')).getByText('Q-2026-0001')).toBeTruthy();
        // the active tab is marked by aria-selected and weight, not colour alone
        const active = screen.getByRole('tab', { name: 'Overview' });
        expect(active.getAttribute('aria-selected')).toBe('true');
        expect(active.className).toContain('font-semibold');
    });

    it('gives Prepared By no column of its own in quotation lists', () => {
        render(<CompanyShow source="connected" companyId={1} company={acme} quotations={{ rows: [{ ...summary, preparedBy: null }], total: 1, page: 2, perPage: 25, lastPage: 2 }} />);
        const table = screen.getByTestId('quotation-table');
        expect(within(table).queryByText(/prepared by/i)).toBeNull();
        expect(within(table).getByText('Item Summary')).toBeTruthy();
    });

    it('lists quotations as one compact row: Quotation · Date · Customer · Item Summary · Valid until · Total', () => {
        render(
            <QuotationsIndex
                source="connected"
                filters={{ company: null, search: '', page: 1, sort: 'newest' }}
                quotations={{ rows: [summary, { ...summary, id: 102, refNo: 'Q-2026-0002', itemSummary: { count: 1, first: { displayDescription: 'S45C + HARDEN = G8.8 STUD', productType: 'STUD', sizeType: '', material: 'S45C_HARDEN_G8_8', finish: 'PL' } } }], total: 2, page: 1, perPage: 25, lastPage: 1 }}
            />,
        );
        const table = screen.getByTestId('quotation-table');
        const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
        expect(headers).toEqual(['Quotation', 'Date', 'Customer', 'Item Summary', 'Valid until', 'Total']);
        expect(within(table).getAllByTestId('item-summary').map((n) => n.textContent)).toEqual([
            '4140 QT FULLSIZE L BOLT · PL +2',
            'S45C STUD · HARDENED TO G8.8 · PL',
        ]);
        expect(table.textContent).not.toMatch(/Nicholas|prepared|× L|Weight|Markup/i);
        // phone cards: customer + total, quotation no. · date, item summary — nothing else
        const card = within(screen.getByTestId('quotation-cards')).getAllByTestId('quotation-card')[0]!;
        expect(card.textContent).toBe('ACME ENGINEERING SDN BHDRM 1,158.60Q-2026-0001 · 1 Mar 20264140 QT FULLSIZE L BOLT · PL +2');
        // sort: newest is the default; oldest keeps the filters in the URL
        const sort = screen.getByTestId('quotation-sort');
        expect(within(sort).getByText('Newest first').getAttribute('aria-current')).toBe('true');
        expect(within(sort).getByText('Oldest first').getAttribute('href')).toBe('/quotations?sort=oldest');
    });

    it('shows a saved quotation read-only: customer unit price, stored total, no recipe, no edit', () => {
        const { container } = render(
            <QuotationShow
                source="connected"
                quotationId={101}
                quotation={detail}
                revisions={{ state: 'ok', entries: [{ revisionNo: 1, event: 'create', createdAt: '2026-03-01 09:00:00', actor: { userId: 7, username: 'nicholas', displayName: 'Nicholas Koh' }, schemaVersion: 1 }] }}
            />,
        );
        const units = screen.getAllByTestId('item-unit-price').map((n) => n.textContent);
        expect(units).toEqual(['RM 33.40', 'RM 3.50']);
        expect(screen.getByTestId('quotation-total').textContent).toBe('RM 1,158.60');
        expect(screen.getByTestId('item-unreadable').textContent).toContain('Item 2');
        expect(screen.getByText('Accessory charge inside price')).toBeTruthy();
        // Issued By: compact "Not recorded" + a short hint, no developer wording
        const issued = screen.getByTestId('issued-by');
        expect(issued.textContent).toBe('Not recorded');
        expect(within(issued).getByRole('button', { name: 'Legacy quotation — issuer was not stored.' })).toBeTruthy();
        expect(container.textContent).not.toMatch(/server-side|legacy application/i);
        // groups: plain text, no coloured material / finish chips
        expect(screen.getAllByTestId('group-title').map((n) => n.textContent)).toEqual(['STUD', 'FULLSIZE SAG ROD']);
        expect(screen.getAllByTestId('group-meta').map((n) => n.textContent)).toEqual(['4140 QT · HARDENED TO G10.9 · PL · 1 item', 'MS · PL · 1 item']);
        expect(screen.queryByTestId('item-chips')).toBeNull();
        expect(screen.getAllByTestId('item-size').map((n) => n.textContent)).toEqual(['M20 × L400', 'M16 × L1200']);
        expect(screen.getAllByTestId('item-qty').map((n) => n.textContent)).toEqual(['Qty 5', 'Qty 10']);
        expect(screen.getByTestId('item-accessories').textContent).toBe('+ 2 Nut HDG');
        expect(screen.getByTestId('item-weight').textContent).toBe('Weight 6.000 kg');
        // a single-item group does not repeat the weight as a group total
        expect(screen.queryByTestId('group-total-weight')).toBeNull();
        expect(container.textContent).toContain('Quotation Total');
        expect(screen.getByTestId('revision-list').textContent).toContain('Nicholas Koh');
        // The bolt component (31.10) is internal and is not printed as a price.
        expect(container.textContent).not.toContain('31.10');
        expect(container.textContent).not.toMatch(/cost rate|additional cost/i);
        expect(screen.queryByRole('button', { name: /edit|delete|save/i })).toBeNull();
    });

    const item = (position: number, over: Partial<ReadableItem>): ReadableItem => ({
        position, state: 'ok', itemUid: null, fieldsSource: 'stored', itemType: 'lbolt', productType: 'L BOLT', productKey: 'L BOLT',
        description: null, displayDescription: 'MS FULLSIZE L BOLT',
        material: { code: 'MS', key: 'MS', label: 'MS', legacyLabel: 'MS', treatment: null, propertyClass: null, hasFinish: true, recognised: true },
        sizeType: 'FULLSIZE', finish: 'PL', finishLabel: 'PL', sizeLabel: 'M30 x L 950 x W 160 x TL 125mm', cleanSize: 'M30', sizeSystem: 'metric',
        dimensionPreview: null, qty: 10, unitSuffix: '',
        pricing: { model: 'accessory-inclusive', customerUnitPrice: 4.43, boltUnitPrice: 4.43, accessoryUnitPrice: 0, ambiguous: false, total: 44.3, totalSource: 'stored', note: null, markupPercent: null, manual: false },
        weight: 0.5, accessories: null,
        ...over,
    });
    const grouped: QuotationDetail = {
        ...detail, itemCount: 4, unreadableItemCount: 0,
        items: [
            item(1, { material: { code: '4140', key: '4140_QT', label: '4140 QT', legacyLabel: '4140 QT', treatment: null, propertyClass: null, hasFinish: true, recognised: true }, displayDescription: '4140 QT FULLSIZE L BOLT', pricing: { ...item(1, {}).pricing, markupPercent: 5 } }),
            item(2, { productType: 'SAG ROD', productKey: 'SAG ROD', sizeType: 'UNDERSIZE', finish: 'ZP', finishLabel: 'ZP', displayDescription: 'MS UNDERSIZE SAG ROD', sizeLabel: 'M12 x L 1245 x TL 100/100mm', qty: 30, weight: 0.8624666, accessories: { nut: { enabled: true, qty: 4, unitPrice: 0.2, finish: 'ZP' }, fw: { enabled: true, qty: 4, unitPrice: 0.1, finish: 'ZP' }, custom: null, summary: '4 Nut ZP + 4 FW ZP' } }),
            item(3, { pricing: { ...item(3, {}).pricing, manual: true } }),
            item(4, { finish: 'HDG', finishLabel: 'HDG', weight: 0.343, qty: 20 }),
        ],
    };

    it('groups items by Product + Size Type; material, finish and accessories do not split a group', () => {
        render(<QuotationShow source="connected" quotationId={1} quotation={grouped} revisions={{ state: 'empty', entries: [] }} />);
        const groups = screen.getAllByTestId('item-group');
        expect(screen.getAllByTestId('group-title').map((n) => n.textContent)).toEqual(['FULLSIZE L BOLT', 'UNDERSIZE SAG ROD']);
        // original numbers kept inside the group
        expect(within(groups[0]!).getAllByTestId('item-number').map((n) => n.textContent)).toEqual(['#1', '#3', '#4']);
        // mixed material / finish: each row carries its own plain-text identity
        expect(within(groups[0]!).getAllByTestId('item-identity').map((n) => n.textContent)).toEqual(['4140 QT · PL', 'MS · PL', 'MS · HDG']);
        expect(within(groups[0]!).getByTestId('group-meta').textContent).toBe('3 items');
        // uniform group: identity moves to the header, rows start with #n + dimensions
        expect(within(groups[1]!).getByTestId('group-meta').textContent).toBe('MS · ZP · 1 item');
        expect(within(groups[1]!).queryByTestId('item-identity')).toBeNull();
        expect(within(groups[1]!).getByTestId('item-line').textContent).toBe('M12 × L1245 × TL100/100·Qty 30');
        expect(within(groups[1]!).getByTestId('item-accessories').textContent).toBe('+ 4 Nut ZP + 4 FW ZP');
        expect(within(groups[1]!).getByTestId('item-weight').textContent).toBe('Weight 25.874 kg');
        // markup badge, manual label, no badge for 0 %
        expect(within(groups[0]!).getByTestId('item-markup').textContent).toBe('⭐ +5%');
        expect(within(groups[0]!).getAllByTestId('item-manual').map((n) => n.textContent)).toEqual(['Manual']);
        expect(screen.getAllByTestId('item-markup')).toHaveLength(1);
        // Total Weight only for the multi-item group: 5.000 + 5.000 + 6.860
        expect(within(groups[0]!).getByTestId('group-total-weight').textContent).toBe('Total Weight 16.860 kg');
        expect(within(groups[1]!).queryByTestId('group-total-weight')).toBeNull();
        // no invented UOM
        expect(document.body.textContent).not.toMatch(/\b(pcs|PCS|SET|LOT|LENGTH)\b|\d\s*pc\b/);
    });

    it('re-orders items newest / oldest without renumbering', () => {
        render(<QuotationShow source="connected" quotationId={1} quotation={grouped} revisions={{ state: 'empty', entries: [] }} />);
        const order = screen.getByTestId('item-order');
        expect(within(order).getByText('Oldest first').getAttribute('aria-pressed')).toBe('true');
        expect(screen.getAllByTestId('item-number').map((n) => n.textContent)).toEqual(['#1', '#3', '#4', '#2']);
        fireEvent.click(within(order).getByText('Newest first'));
        expect(screen.getAllByTestId('group-title').map((n) => n.textContent)).toEqual(['FULLSIZE L BOLT', 'UNDERSIZE SAG ROD']);
        expect(screen.getAllByTestId('item-number').map((n) => n.textContent)).toEqual(['#4', '#3', '#1', '#2']);
        fireEvent.click(within(order).getByText('Oldest first'));
        expect(screen.getAllByTestId('item-number').map((n) => n.textContent)).toEqual(['#1', '#3', '#4', '#2']);
    });

    it('says when a quotation’s items could not be read, and when history is empty', () => {
        render(
            <QuotationShow
                source="connected"
                quotationId={104}
                quotation={{ ...detail, itemsState: 'unreadable', items: [], itemCount: 0 }}
                revisions={{ state: 'empty', entries: [] }}
            />,
        );
        expect(screen.getByTestId('items-unreadable')).toBeTruthy();
        expect(screen.getByTestId('revision-state').getAttribute('data-state')).toBe('empty');
    });

    it('never infers Prepared By from the revision creator', () => {
        render(
            <QuotationShow
                source="connected"
                quotationId={101}
                quotation={{ ...detail, preparedBy: null }}
                revisions={{ state: 'ok', entries: [{ revisionNo: 1, event: 'create', createdAt: '2026-03-01 09:00:00', actor: { userId: 7, username: 'nicholas', displayName: 'Nicholas Koh' }, schemaVersion: 1 }] }}
            />,
        );
        expect(screen.getByTestId('prepared-by-missing').textContent).toBe('Not recorded');
        expect(screen.getByTestId('revision-list').textContent).toContain('Nicholas Koh');
    });
});
