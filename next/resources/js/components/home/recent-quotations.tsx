import { Link } from '@inertiajs/react';
import { ChevronRight, FileText, Inbox, PlugZap } from 'lucide-react';
import { formatDate } from '@/components/legacy/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { RecentQuotation } from '@/types';

export const RECENT_LIMIT = 5;

/* Display only: a server-formatted string is shown verbatim; a bare number
   is shown to 2 decimal places. No arithmetic happens here. */
export function displayTotal(total: RecentQuotation['total']): string | null {
    if (total === null || total === undefined || total === '') return null;
    if (typeof total === 'number') {
        return Number.isFinite(total) ? total.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
    }
    return total;
}

/* Recent Quotations (handoff §8). `items` undefined = the data source is not
   connected yet (Session D read layer → W1 integration); [] = connected, none.
   Each card is ONE link to the quotation; no View/Edit/Delete clutter.
   Phone: two-line cards (customer, then quotation no. · date). Tablet and
   desktop: one table-like list using the full width (customer · quotation ·
   date · total). */
export function RecentQuotations({ items, className }: { items: RecentQuotation[] | undefined; className?: string }) {
    return (
        <section aria-labelledby="recent-quotations-title" className={className} data-testid="recent-quotations">
            <div className="mb-2 flex items-center justify-between">
                <h2 id="recent-quotations-title" className="text-sm font-semibold text-foreground">
                    Recent Quotations
                </h2>
                {items && items.length > 0 ? (
                    <Link href="/quotations" className="text-sm font-medium text-accent hover:underline">
                        View all
                    </Link>
                ) : null}
            </div>
            {items === undefined ? (
                <EmptyState
                    compact
                    icon={PlugZap}
                    title="Not connected yet"
                    description="Recent quotations are connected in a later step of this preview."
                />
            ) : items.length === 0 ? (
                <EmptyState
                    compact
                    icon={Inbox}
                    title="No quotations yet"
                    action={
                        <Button asChild size="sm" variant="primary">
                            <Link href="/quotations/new">New Quotation</Link>
                        </Button>
                    }
                />
            ) : (
                <div className="sm:overflow-hidden sm:rounded-[var(--radius-lg)] sm:border sm:border-border sm:bg-surface sm:shadow-xs">
                    <div
                        aria-hidden="true"
                        className="hidden items-center gap-4 bg-surface-muted px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:flex"
                    >
                        <span className="min-w-0 flex-1">Customer</span>
                        <span className="w-40 shrink-0">Quotation</span>
                        <span className="w-28 shrink-0">Date</span>
                        <span className="w-28 shrink-0 text-right">Total</span>
                        <span className="w-4 shrink-0" />
                    </div>
                    <ul className="flex flex-col gap-2 sm:gap-0 sm:divide-y sm:divide-border">
                        {items.slice(0, RECENT_LIMIT).map((q) => {
                            const total = displayTotal(q.total);
                            const date = formatDate(q.date);
                            return (
                                <li key={q.id}>
                                    <Link
                                        href={`/quotations/${encodeURIComponent(String(q.id))}`}
                                        className={cn(
                                            'flex min-h-14 items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3 shadow-xs hover:border-border-strong hover:bg-surface-muted',
                                            'sm:min-h-0 sm:gap-4 sm:rounded-none sm:border-0 sm:px-4 sm:py-2.5 sm:shadow-none',
                                        )}
                                        data-testid="recent-quotation-card"
                                    >
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent sm:hidden">
                                            <FileText className="size-4" aria-hidden="true" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-foreground sm:font-medium" data-testid="recent-customer">
                                                {q.customer}
                                            </span>
                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground sm:hidden">
                                                <span className="font-medium text-foreground/75">{q.refNo}</span>
                                                {' · '}
                                                {date}
                                            </span>
                                        </span>
                                        <span className="hidden w-40 shrink-0 truncate text-sm text-muted-foreground sm:block">{q.refNo}</span>
                                        <span className="hidden w-28 shrink-0 text-sm text-muted-foreground sm:block">{date}</span>
                                        <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums sm:w-28 sm:text-right sm:font-medium">
                                            {total ?? ''}
                                        </span>
                                        <ChevronRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden="true" />
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </section>
    );
}
