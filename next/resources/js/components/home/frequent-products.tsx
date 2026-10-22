import { Link } from '@inertiajs/react';
import { Package } from 'lucide-react';
import { FREQUENT_PRODUCTS, productHref } from '@/components/shell/nav-config';

/* Frequently Used Products (handoff §8): starts a New Quotation with the
   product pre-chosen (`?product=<legacy key>`, read by the builder later).
   Phone: two-column touch targets. Tablet / desktop: compact chips. */
export function FrequentProducts({ className }: { className?: string }) {
    return (
        <section aria-labelledby="frequent-products-title" className={className} data-testid="frequent-products">
            <h2 id="frequent-products-title" className="mb-2 text-sm font-semibold text-foreground">
                Frequently Used Products
            </h2>
            <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {FREQUENT_PRODUCTS.map((p) => (
                    <li key={p.key}>
                        <Link
                            href={productHref(p.key)}
                            className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm font-medium text-foreground shadow-xs hover:border-border-strong hover:bg-surface-muted sm:h-9 sm:gap-1.5 sm:rounded-full sm:px-3.5"
                        >
                            <Package className="size-4 shrink-0 text-muted-foreground sm:size-3.5" aria-hidden="true" />
                            <span className="truncate">{p.label}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
