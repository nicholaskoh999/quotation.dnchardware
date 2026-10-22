import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CompaniesIndex from '@/pages/Companies/Index';
import CompanyShow from '@/pages/Companies/Show';
import QuotationsIndex from '@/pages/Quotations/Index';
import QuotationShow from '@/pages/Quotations/Show';
import type { CompanyRow, QuotationDetail, QuotationSummary } from '@/types/legacy';

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
            pricing: { model: 'accessory-inclusive', customerUnitPrice: 33.4, boltUnitPrice: 31.1, accessoryUnitPrice: 2.3, ambiguous: false, total: 167, totalSource: 'stored', note: null },
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
        render(<QuotationsIndex source="not_configured" filters={{ company: null, search: '', page: 1 }} quotations={null} />);
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
        expect(within(table).getByText('Valid until')).toBeTruthy();
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
        expect(screen.getByText('Hardened')).toBeTruthy();
        expect(screen.getByText('G10.9')).toBeTruthy();
        expect(screen.getByTestId('item-unreadable').textContent).toContain('Item 2');
        expect(screen.getByText('Accessory charge inside price')).toBeTruthy();
        // Issued By: compact "Not recorded" + a short hint, no developer wording
        const issued = screen.getByTestId('issued-by');
        expect(issued.textContent).toBe('Not recorded');
        expect(within(issued).getByRole('button', { name: 'Legacy quotation — issuer was not stored.' })).toBeTruthy();
        expect(container.textContent).not.toMatch(/server-side|legacy application/i);
        // Title: product identity first, material + finish as chips, no repeated material
        expect(screen.getAllByTestId('item-title').map((n) => n.textContent)).toEqual(['STUD', 'FULLSIZE SAG ROD']);
        const chips = screen.getAllByTestId('item-chips')[0]!;
        expect(within(chips).getByText('4140 QT')).toBeTruthy();
        expect(within(chips).getByText('PL')).toBeTruthy();
        // Canonical dimensions
        expect(screen.getAllByTestId('item-size').map((n) => n.textContent)).toEqual(['M20 × L400', 'M16 × L1200']);
        expect(container.textContent).toContain('Quotation Total');
        expect(container.textContent).not.toContain('(as saved)');
        expect(screen.getByTestId('revision-list').textContent).toContain('Nicholas Koh');
        // The bolt component (31.10) is internal and is not printed as a price.
        expect(container.textContent).not.toContain('31.10');
        expect(container.textContent).not.toMatch(/cost rate|markup|additional cost/i);
        expect(screen.queryByRole('button', { name: /edit|delete|save/i })).toBeNull();
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
