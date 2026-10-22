import { Link } from '@inertiajs/react';
import { formatDate, formatStoredMoney, itemSummaryParts, moreLabel, orDash } from '@/components/legacy/format';
import type { QuotationSummary } from '@/types/legacy';

/* Saved quotations: one compact row per quotation on desktop / tablet, a
   compact card on a phone (handoff §9: no desktop table squeezed into phone
   width). Owner Smoke Loop #2:
     desktop  Quotation · Date · Customer · Item Summary · Valid until · Total
     tablet   Quotation · Date · Customer · Item Summary · Total
     phone    customer + total / quotation no. · date / item summary
   Item Summary takes the flexible width; the main summary ellipsises while
   the other-item count stays visible as a separate, muted `+N more`. No Prepared By (it
   stays on the quotation detail), no sizes, accessories, weight or pricing
   recipe in a list. */
export function QuotationList({ rows, showCustomer = true }: { rows: QuotationSummary[]; showCustomer?: boolean }) {
    return (
        <>
            <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-xs md:block">
                <table className="w-full table-fixed text-sm" data-testid="quotation-table">
                    <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                            <th scope="col" className="w-[7.5rem] px-3 py-2.5 font-medium lg:w-36 lg:px-5">Quotation</th>
                            <th scope="col" className="w-[6.75rem] px-3 py-2.5 font-medium lg:w-36 lg:px-5">Date</th>
                            {showCustomer ? <th scope="col" className="w-36 px-3 py-2.5 font-medium lg:w-60 lg:px-5 xl:w-72">Customer</th> : null}
                            <th scope="col" className="px-3 py-2.5 font-medium lg:px-5">Item Summary</th>
                            <th scope="col" className="hidden w-36 px-3 py-2.5 font-medium lg:table-cell lg:px-5">Valid until</th>
                            <th scope="col" className="w-[6.5rem] px-3 py-2.5 text-right font-medium lg:w-36 lg:px-5">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((q) => {
                            return (
                                <tr key={q.id} className="border-t border-border hover:bg-surface-muted/60" data-testid="quotation-row">
                                    <td className="truncate px-3 py-2.5 font-medium lg:px-5">
                                        <Link href={`/quotations/${q.id}`} className="text-accent hover:underline">
                                            {q.refNo || `#${q.id}`}
                                        </Link>
                                    </td>
                                    <td className="truncate px-3 py-2.5 whitespace-nowrap lg:px-5">{formatDate(q.quoteDate ?? q.createdAt)}</td>
                                    {showCustomer ? (
                                        <td className="truncate px-3 py-2.5 whitespace-nowrap lg:px-5" title={q.customerDisplay ?? undefined}>
                                            {orDash(q.customerDisplay)}
                                        </td>
                                    ) : null}
                                    <td className="px-3 py-2.5 lg:px-5">
                                        <ItemSummaryLine q={q} />
                                    </td>
                                    <td className="hidden truncate px-3 py-2.5 whitespace-nowrap text-muted-foreground lg:table-cell lg:px-5">{formatDate(q.validUntil)}</td>
                                    <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap tabular-nums lg:px-5">{formatStoredMoney(q.totalAmount)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <ul className="flex flex-col gap-2 md:hidden" data-testid="quotation-cards">
                {rows.map((q) => {
                    const ref = q.refNo || `#${q.id}`;
                    return (
                        <li key={q.id}>
                            <Link
                                href={`/quotations/${q.id}`}
                                className="block rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3 shadow-xs active:bg-surface-muted"
                                data-testid="quotation-card"
                            >
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="min-w-0 truncate font-semibold text-foreground">{showCustomer ? orDash(q.customerDisplay) : ref}</span>
                                    <span className="shrink-0 font-semibold tabular-nums">{formatStoredMoney(q.totalAmount)}</span>
                                </div>
                                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {showCustomer ? <span className="font-medium text-accent">{ref}</span> : null}
                                    {showCustomer ? ' · ' : null}
                                    {formatDate(q.quoteDate ?? q.createdAt)}
                                </div>
                                <ItemSummaryLine q={q} wrap className="mt-1.5" />
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

/* Main summary in primary text; `+N more` lighter, smaller, normal weight,
   clearly spaced — never a badge. `wrap` (phone cards) lets the count drop to
   its own line when space is tight; in a table cell the summary ellipsises
   and the count stays on the line. */
function ItemSummaryLine({ q, wrap = false, className }: { q: QuotationSummary; wrap?: boolean; className?: string }) {
    const parts = itemSummaryParts(q.itemSummary);
    if (!parts) {
        return wrap ? null : <span className="text-subtle-foreground" data-testid="item-summary">—</span>;
    }
    const more = moreLabel(parts.more);
    return (
        <div
            className={`flex min-w-0 items-baseline gap-x-3 ${wrap ? 'flex-wrap' : ''} ${className ?? ''}`}
            title={more ? `${parts.main} (${more})` : parts.main}
            data-testid="item-summary"
        >
            <span className={`min-w-0 truncate text-sm text-foreground ${wrap ? 'max-w-full' : ''}`} data-testid="item-summary-main">
                {parts.main}
            </span>
            {more ? (
                <span className="shrink-0 text-xs font-normal whitespace-nowrap text-muted-foreground" data-testid="item-summary-more">
                    {more}
                </span>
            ) : null}
        </div>
    );
}
