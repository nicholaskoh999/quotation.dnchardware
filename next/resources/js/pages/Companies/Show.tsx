import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, History } from 'lucide-react';
import { useState } from 'react';
import { DataSourceNotice, ReadOnlyNote } from '@/components/legacy/data-source-notice';
import { formatDate, orDash } from '@/components/legacy/format';
import { QuotationList } from '@/components/legacy/quotation-list';
import { EmptyState, PageHeader, Pager } from '@/components/legacy/read-parts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import type { CompanyShowProps } from '@/types/legacy';

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
                    <div role="tablist" aria-label="Company sections" className="mb-4 flex gap-1 border-b border-border">
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
                                    '-mb-px border-b-2 px-3 py-2 text-sm font-medium ' +
                                    (tab === t.id ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')
                                }
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {tab === 'overview' ? (
                        <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
                            <Card>
                                <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
                                    <Fact label="Phone" value={orDash(company.phone)} />
                                    <Fact label="Address" value={orDash(company.address)} />
                                    <Fact label="Quotations" value={String(company.quotationCount)} />
                                    <Fact label="Last quoted" value={formatDate(company.lastQuotedDate)} />
                                </CardContent>
                            </Card>
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
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <History className="size-4" aria-hidden="true" /> Price History
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    This customer’s price history arrives in a later release. The legacy lookup rules are already in
                                    place behind it.
                                </CardContent>
                            </Card>
                        </div>
                    ) : null}
                </>
            )}
        </AppLayout>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs uppercase tracking-wide text-subtle-foreground">{label}</div>
            <div className="mt-0.5 whitespace-pre-line text-sm">{value}</div>
        </div>
    );
}
