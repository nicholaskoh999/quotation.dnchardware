import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ChevronRight, History } from 'lucide-react';
import { useState } from 'react';
import { DataSourceNotice, ReadOnlyNote } from '@/components/legacy/data-source-notice';
import { formatDate, formatStoredMoney, orDash } from '@/components/legacy/format';
import { QuotationList } from '@/components/legacy/quotation-list';
import { EmptyState, PageHeader, Pager } from '@/components/legacy/read-parts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import type { CompanyShowProps, QuotationSummary } from '@/types/legacy';

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'quotations', label: 'Quotations' },
    { id: 'price-history', label: 'Price History' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/* Company profile (handoff §11): Overview · Quotations · Price History. */
export default function CompanyShow({ source, companyId, company, quotations }: CompanyShowProps) {
    const [tab, setTab] = useState<TabId>(quotations && quotations.page > 1 ? 'quotations' : 'overview');
    return (
        <AppLayout>
            <Head title={company?.name ?? 'Company'} />
            <Button asChild variant="ghost" size="sm" className="mb-3">
                <Link href="/companies">
                    <ArrowLeft aria-hidden="true" /> Companies
                </Link>
            </Button>
            {source !== 'connected' || !company ? (
                <DataSourceNotice source={source === 'connected' ? 'unavailable' : source} />
            ) : (
                <>
                    <PageHeader title={company.name} subtitle={<ReadOnlyNote />} />
                    <div role="tablist" aria-label="Company sections" className="mb-4 flex gap-2 border-b border-border">
                        {TABS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                role="tab"
                                id={`tab-${t.id}`}
                                aria-selected={tab === t.id}
                                aria-controls={`panel-${t.id}`}
                                onClick={() => setTab(t.id)}
                                className={
                                    '-mb-px rounded-t-[var(--radius-sm)] border-b-2 px-3 py-2.5 text-sm ' +
                                    (tab === t.id
                                        ? 'border-accent font-semibold text-accent'
                                        : 'border-transparent font-medium text-muted-foreground hover:border-border-strong hover:text-foreground')
                                }
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {tab === 'overview' ? (
                        <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" data-testid="company-overview">
                            <OverviewPanel
                                company={company}
                                recent={quotations && quotations.page === 1 ? quotations.rows.slice(0, 5) : []}
                                onAll={() => setTab('quotations')}
                            />
                        </div>
                    ) : null}

                    {tab === 'quotations' ? (
                        <div role="tabpanel" id="panel-quotations" aria-labelledby="tab-quotations">
                            {quotations && quotations.rows.length > 0 ? (
                                <>
                                    <QuotationList rows={quotations.rows} showCustomer={false} />
                                    <Pager page={quotations} href={(n) => `/companies/${companyId}?page=${n}`} />
                                </>
                            ) : (
                                <EmptyState>No quotations saved for this company.</EmptyState>
                            )}
                        </div>
                    ) : null}

                    {tab === 'price-history' ? (
                        <div role="tabpanel" id="panel-price-history" aria-labelledby="tab-price-history">
                            <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface p-5">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                                    <History className="size-4" aria-hidden="true" />
                                </span>
                                <div>
                                    <h2 className="text-sm font-semibold">Price history is coming soon</h2>
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        The prices this customer was quoted for each item will be listed here in a later release.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </>
            )}
        </AppLayout>
    );
}

/* Overview: contact + usage facts and the latest quotations — existing
   read-only data only (no invented fields). */
function OverviewPanel({
    company,
    recent,
    onAll,
}: {
    company: NonNullable<CompanyShowProps['company']>;
    recent: QuotationSummary[];
    onAll: () => void;
}) {
    const latest = recent[0] ?? null;
    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card>
                <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 sm:px-5">
                    <Fact label="Phone" value={orDash(company.phone)} />
                    <Fact label="Quotations" value={String(company.quotationCount)} />
                    <Fact label="Last quoted" value={formatDate(company.lastQuotedDate)} />
                    <Fact label="Latest quotation" value={latest ? latest.refNo || `#${latest.id}` : '—'} />
                    <div className="col-span-2">
                        <Fact label="Address" value={orDash(company.address)} />
                    </div>
                </CardContent>
            </Card>
            <section aria-labelledby="company-recent-title" className="min-w-0">
                <div className="mb-2 flex items-center justify-between">
                    <h2 id="company-recent-title" className="text-sm font-semibold">
                        Latest quotations
                    </h2>
                    {company.quotationCount > recent.length && recent.length > 0 ? (
                        <button type="button" onClick={onAll} className="text-sm font-medium text-accent hover:underline">
                            View all {company.quotationCount}
                        </button>
                    ) : null}
                </div>
                {recent.length === 0 ? (
                    <EmptyState>No quotations saved for this company.</EmptyState>
                ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-xs" data-testid="company-recent">
                        {recent.map((q) => (
                            <li key={q.id}>
                                <Link href={`/quotations/${q.id}`} className="flex min-h-11 items-center gap-3 px-4 py-2 text-sm hover:bg-surface-muted">
                                    <span className="w-36 shrink-0 truncate font-medium text-accent">{q.refNo || `#${q.id}`}</span>
                                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{formatDate(q.quoteDate ?? q.createdAt)}</span>
                                    <span className="shrink-0 font-medium tabular-nums">{formatStoredMoney(q.totalAmount)}</span>
                                    <ChevronRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden="true" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-subtle-foreground">{label}</div>
            <div className="mt-0.5 text-sm break-words whitespace-pre-line">{value}</div>
        </div>
    );
}
