import { Head, Link } from '@inertiajs/react';
import { X } from 'lucide-react';
import { DataSourceNotice, ReadOnlyNote } from '@/components/legacy/data-source-notice';
import { QuotationList } from '@/components/legacy/quotation-list';
import { EmptyState, PageHeader, Pager, SearchForm } from '@/components/legacy/read-parts';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { QuotationsIndexProps } from '@/types/legacy';

/* Saved quotations, most recent first. Read-only: no New / Edit / Delete. */
export default function QuotationsIndex({ source, filters, quotations }: QuotationsIndexProps) {
    const query = (page: number) => {
        const p = new URLSearchParams();
        if (filters.company !== null) p.set('company', String(filters.company));
        if (filters.search) p.set('q', filters.search);
        p.set('page', String(page));
        return `/quotations?${p.toString()}`;
    };
    return (
        <AppLayout>
            <Head title="Quotations" />
            <PageHeader title="Quotations" subtitle={<ReadOnlyNote />}>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/companies">Companies</Link>
                </Button>
            </PageHeader>
            {source !== 'connected' || !quotations ? (
                <DataSourceNotice source={source === 'connected' ? 'unavailable' : source} />
            ) : (
                <>
                    <SearchForm
                        action="/quotations"
                        value={filters.search}
                        label="Search quotations"
                        placeholder="Search by quotation no. or customer"
                        extra={filters.company !== null ? { company: filters.company } : undefined}
                    />
                    {filters.company !== null ? (
                        <div className="mb-3">
                            <Button asChild variant="secondary" size="sm">
                                <Link href="/quotations">
                                    One company only <X aria-hidden="true" />
                                </Link>
                            </Button>
                        </div>
                    ) : null}
                    {quotations.rows.length === 0 ? (
                        <EmptyState>{filters.search ? `No quotation matches “${filters.search}”.` : 'No quotations saved yet.'}</EmptyState>
                    ) : (
                        <>
                            <QuotationList rows={quotations.rows} />
                            <Pager page={quotations} href={query} />
                        </>
                    )}
                </>
            )}
        </AppLayout>
    );
}
