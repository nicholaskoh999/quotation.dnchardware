import { Link } from '@inertiajs/react';
import { formatDate, formatStoredMoney, orDash } from '@/components/legacy/format';
import type { QuotationSummary } from '@/types/legacy';

/* Saved quotations as a table on desktop and as cards on a phone (handoff §9:
   no desktop table squeezed into phone width). */
export function QuotationList({ rows, showCustomer = true }: { rows: QuotationSummary[]; showCustomer?: boolean }) {
    return (
        <>
            <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-xs md:block">
                <table className="w-full text-sm" data-testid="quotation-table">
                    <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                            <th scope="col" className="px-4 py-2 font-medium">Quotation</th>
                            <th scope="col" className="px-4 py-2 font-medium">Date</th>
                            {showCustomer ? <th scope="col" className="px-4 py-2 font-medium">Customer</th> : null}
                            <th scope="col" className="px-4 py-2 font-medium">Prepared by</th>
                            <th scope="col" className="px-4 py-2 text-right font-medium">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((q) => (
                            <tr key={q.id} className="border-t border-border">
                                <td className="px-4 py-2 font-medium">
                                    <Link href={`/quotations/${q.id}`} className="text-accent hover:underline">
                                        {q.refNo || `#${q.id}`}
                                    </Link>
                                </td>
                                <td className="px-4 py-2">{formatDate(q.quoteDate ?? q.createdAt)}</td>
                                {showCustomer ? <td className="px-4 py-2">{orDash(q.customerDisplay)}</td> : null}
                                <td className="px-4 py-2">{orDash(q.preparedBy)}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{formatStoredMoney(q.totalAmount)}</td>
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
                                <span className="font-medium text-accent">{q.refNo || `#${q.id}`}</span>
                                <span className="tabular-nums">{formatStoredMoney(q.totalAmount)}</span>
                            </div>
                            {showCustomer ? <div className="mt-1 truncate text-sm">{orDash(q.customerDisplay)}</div> : null}
                            <div className="mt-1 text-xs text-muted-foreground">
                                {formatDate(q.quoteDate ?? q.createdAt)} · {orDash(q.preparedBy)}
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    );
}
