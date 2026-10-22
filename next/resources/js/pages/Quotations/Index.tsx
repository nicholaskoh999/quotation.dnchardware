import { Head, Link } from '@inertiajs/react';
import { X } from 'lucide-react';
import { DataSourceNotice, ReadOnlyNote } from '@/components/legacy/data-source-notice';
import { QuotationList } from '@/components/legacy/quotation-list';
import { EmptyState, ORDER_OPTIONS, OrderToggle, PageHeader, Pager, SearchForm } from '@/components/legacy/read-parts';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { ListSort, QuotationsIndexProps } from '@/types/legacy';

/* Saved quotations, newest first by default (Oldest first on request — the
   order is presentation only). Read-only: no New / Edit / Delete. */
export default function QuotationsIndex({ source, filters, quotations }: QuotationsIndexProps) {
    const sort: ListSort = filters.sort === 'oldest' ? 'oldest' : 'newest';
    const query = (page: number, nextSort: ListSort = sort) => {
        const p = new URLSearchParams();
        if (filters.company !== null) p.set('company', String(filters.company));
        if (filters.search) p.set('q', filters.search);
        if (nextSort === 'oldest') p.set('sort', 'oldest');
        if (page > 1) p.set('page', String(page));
        const qs = p.toString();
        return qs ? `/quotations?${qs}` : '/quotations';
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
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
                        <div className="min-w-0 flex-1">
                            <SearchForm
                                action="/quotations"
                                value={filters.search}
                                label="Search quotations"
                                placeholder="Search by quotation no. or customer"
                                extra={{ ...(filters.company !== null ? { company: filters.company } : {}), ...(sort === 'oldest' ? { sort } : {}) }}
                            />
                        </div>
                        <div className="mb-4 md:mt-1">
                            <OrderToggle label="Sort quotations" value={sort} options={ORDER_OPTIONS} href={(v) => query(1, v)} testId="quotation-sort" />
                        </div>
                    </div>
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
