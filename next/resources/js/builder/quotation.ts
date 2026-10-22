import { roundMoney2 } from '@/domain';
import { computeItem, type ComputedItem } from './compute';
import type { DraftQuotation } from './model';

/* Quotation-level reading of the Builder state: every item computed once,
   the summary, and the quotation-level validation (customer, dates, items).
   Validation messages stay next to their field; `issues` is only a count +
   pointer list for the "N issues" feedback, never a giant error dump. */

export type HeaderField = 'customer' | 'quoteDate' | 'validUntil';

export interface QuotationReading {
    items: ComputedItem[];
    summary: { itemCount: number; totalWeight: number; total: number; invalidItems: number };
    headerErrors: Partial<Record<HeaderField, string>>;
    /** Item numbers (1-based) that block the quotation. */
    invalidItemNumbers: number[];
    valid: boolean;
}

export function readQuotation(q: DraftQuotation): QuotationReading {
    const items = q.items.map(computeItem);
    const headerErrors: Partial<Record<HeaderField, string>> = {};
    if (q.customer.companyId === null && !q.customer.name.trim()) headerErrors.customer = 'Choose a customer, or type the customer name';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.quoteDate)) headerErrors.quoteDate = 'Enter the quotation date (DD-MM-YYYY)';
    if (q.validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(q.validUntil)) headerErrors.validUntil = 'Enter a date (DD-MM-YYYY)';
    else if (q.validUntil && q.quoteDate && q.validUntil < q.quoteDate) headerErrors.validUntil = 'Valid until cannot be before the quotation date';

    let totalWeight = 0;
    let total = 0;
    const invalidItemNumbers: number[] = [];
    items.forEach((c, i) => {
        if (c.lineWeight !== null) totalWeight += c.lineWeight;
        if (c.pricing) total += c.pricing.totalAmount;
        if (!c.valid) invalidItemNumbers.push(i + 1);
    });
    return {
        items,
        summary: { itemCount: items.length, totalWeight, total: roundMoney2(total), invalidItems: invalidItemNumbers.length },
        headerErrors,
        invalidItemNumbers,
        valid: Object.keys(headerErrors).length === 0 && invalidItemNumbers.length === 0 && items.length > 0,
    };
}
