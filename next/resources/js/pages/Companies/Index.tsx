import { Head, Link } from '@inertiajs/react';
import { Building2, Phone } from 'lucide-react';
import { DataSourceNotice, ReadOnlyNote } from '@/components/legacy/data-source-notice';
import { formatDate, orDash } from '@/components/legacy/format';
import { EmptyState, PageHeader, SearchForm } from '@/components/legacy/read-parts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { CompaniesIndexProps, CompanyRow } from '@/types/legacy';

/* Customer directory (handoff §11): search · list · usage metadata · open
   company. Read-only in Wave 1 — no New / Edit / Delete. Short Code is not
   shown; a search may still match it as a hidden alias. */
export default function CompaniesIndex({ source, search, companies }: CompaniesIndexProps) {
    return (
        <AppLayout>
            <Head title="Companies" />
            <PageHeader title="Companies" subtitle={<ReadOnlyNote />}>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/quotations">All quotations</Link>
                </Button>
            </PageHeader>
            {source !== 'connected' ? (
                <DataSourceNotice source={source} />
            ) : (
                <>
                    <SearchForm action="/companies" value={search} label="Search companies" placeholder="Search by company name or phone" />
                    {companies.length === 0 ? (
                        <EmptyState>{search ? `No company matches “${search}”.` : 'No companies yet.'}</EmptyState>
                    ) : (
                        <CompanyDirectory companies={companies} />
                    )}
                </>
            )}
        </AppLayout>
    );
}

function AliasHint({ c }: { c: CompanyRow }) {
    return c.matchedBy === 'alias' ? <Badge tone="neutral">Matched a legacy code</Badge> : null;
}

function CompanyDirectory({ companies }: { companies: CompanyRow[] }) {
    return (
        <>
            <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-xs md:block">
                <table className="w-full text-sm" data-testid="company-table">
                    <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                            <th scope="col" className="px-5 py-2.5 font-medium">Company</th>
                            <th scope="col" className="w-52 px-5 py-2.5 font-medium">Phone</th>
                            <th scope="col" className="w-36 px-5 py-2.5 text-right font-medium">Quotations</th>
                            <th scope="col" className="w-40 px-5 py-2.5 font-medium">Last quoted</th>
                        </tr>
                    </thead>
                    <tbody>
                        {companies.map((c) => (
                            <tr key={c.id} className="border-t border-border hover:bg-surface-muted/60">
                                <td className="px-5 py-2.5">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <Link href={`/companies/${c.id}`} className="font-medium text-accent hover:underline">
                                            {c.name}
                                        </Link>
                                        <AliasHint c={c} />
                                    </span>
                                </td>
                                <td className="px-5 py-2.5 whitespace-nowrap text-muted-foreground">{orDash(c.phone)}</td>
                                <td className="px-5 py-2.5 text-right tabular-nums">{c.quotationCount}</td>
                                <td className="px-5 py-2.5 whitespace-nowrap">{formatDate(c.lastQuotedDate)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="flex flex-col gap-2 md:hidden" data-testid="company-cards">
                {companies.map((c) => (
                    <li key={c.id}>
                        <Link href={`/companies/${c.id}`} className="block rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs">
                            <div className="flex items-start gap-2">
                                <Building2 className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-accent">{c.name}</div>
                                    {c.phone ? (
                                        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                                            <Phone className="size-3" aria-hidden="true" /> {c.phone}
                                        </div>
                                    ) : null}
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {c.quotationCount} quotation{c.quotationCount === 1 ? '' : 's'} · last quoted {formatDate(c.lastQuotedDate)}
                                    </div>
                                    <AliasHint c={c} />
                                </div>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    );
}
