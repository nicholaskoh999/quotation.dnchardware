import { Link } from '@inertiajs/react';
import { formatDate, formatStoredMoney, orDash } from '@/components/legacy/format';
import type { QuotationSummary } from '@/types/legacy';

/* Saved quotations as a table on desktop and as cards on a phone (handoff §9:
   no desktop table squeezed into phone width). Prepared By is blank on most
   legacy rows, so it gets no column of its own: when a row has one it is a
   quiet second line under the quotation number (never inferred). */
export function QuotationList({ rows, showCustomer = true }: { rows: QuotationSummary[]; showCustomer?: boolean }) {
    return (
        <>
            <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-xs md:block">
                <table className="w-full text-sm" data-testid="quotation-table">
                    <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                            <th scope="col" className="w-48 px-5 py-2.5 font-medium">Quotation</th>
                            <th scope="col" className="w-36 px-5 py-2.5 font-medium">Date</th>
                            {showCustomer ? <th scope="col" className="px-5 py-2.5 font-medium">Customer</th> : null}
                            <th scope="col" className="w-36 px-5 py-2.5 font-medium">Valid until</th>
                            <th scope="col" className="w-40 px-5 py-2.5 text-right font-medium">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((q) => (
                            <tr key={q.id} className="border-t border-border hover:bg-surface-muted/60">
                                <td className="px-5 py-2.5 align-top font-medium">
                                    <Link href={`/quotations/${q.id}`} className="text-accent hover:underline">
                                        {q.refNo || `#${q.id}`}
                                    </Link>
                                    {q.preparedBy ? <div className="text-xs font-normal text-muted-foreground">by {q.preparedBy}</div> : null}
                                </td>
                                <td className="px-5 py-2.5 align-top">{formatDate(q.quoteDate ?? q.createdAt)}</td>
                                {showCustomer ? <td className="px-5 py-2.5 align-top">{orDash(q.customerDisplay)}</td> : null}
                                <td className="px-5 py-2.5 align-top text-muted-foreground">{formatDate(q.validUntil)}</td>
                                <td className="px-5 py-2.5 text-right align-top font-medium tabular-nums">{formatStoredMoney(q.totalAmount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="flex flex-col gap-2 md:hidden" data-testid="quotation-cards">
                {rows.map((q) => (
                    <li key={q.id}>
                        <Link
                            href={`/quotations/${q.id}`}
                            className="block rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs"
                        >
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="min-w-0 truncate font-semibold text-foreground">
                                    {showCustomer ? orDash(q.customerDisplay) : q.refNo || `#${q.id}`}
                                </span>
                                <span className="shrink-0 font-medium tabular-nums">{formatStoredMoney(q.totalAmount)}</span>
                            </div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                                {showCustomer ? <span className="font-medium text-accent">{q.refNo || `#${q.id}`}</span> : null}
                                {showCustomer ? ' · ' : null}
                                {formatDate(q.quoteDate ?? q.createdAt)}
                                {q.preparedBy ? ` · by ${q.preparedBy}` : null}
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    );
}
