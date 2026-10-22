import { Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types/legacy';

/* Small, plain building blocks for the Wave 1 read pages. Session A owns the
   real app shell and visual system; these stay deliberately simple so the
   integration round can restyle them in one place. */

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
    return (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
                {subtitle ? <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div> : null}
            </div>
            {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
        </div>
    );
}

/** GET search form — the query lives in the URL, so a search can be shared or reloaded. */
export function SearchForm({ action, value, placeholder, label, extra }: {
    action: string;
    value: string;
    placeholder: string;
    label: string;
    extra?: Record<string, string | number>;
}) {
    const [q, setQ] = useState(value);
    const submit = (e: FormEvent) => {
        e.preventDefault();
        const query: Record<string, string | number> = { ...(extra ?? {}) };
        if (q.trim() !== '') query.q = q.trim();
        router.get(action, query, { preserveState: true, replace: true });
    };
    return (
        <form role="search" onSubmit={submit} className="mb-4 flex gap-2 md:max-w-2xl">
            <label className="sr-only" htmlFor="read-search">{label}</label>
            <input
                id="read-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder}
                className="h-10 min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm shadow-xs placeholder:text-subtle-foreground"
            />
            <Button type="submit" variant="secondary">
                <Search aria-hidden="true" /> Search
            </Button>
        </form>
    );
}

export function Pager<T>({ page, href }: { page: Paginated<T>; href: (n: number) => string }) {
    if (page.lastPage <= 1) return null;
    return (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
                Page {page.page} of {page.lastPage} · {page.total} total
            </span>
            <span className="flex gap-2">
                {page.page > 1 ? (
                    <Button asChild variant="secondary" size="sm">
                        <Link href={href(page.page - 1)} preserveScroll>
                            <ChevronLeft aria-hidden="true" /> Previous
                        </Link>
                    </Button>
                ) : null}
                {page.page < page.lastPage ? (
                    <Button asChild variant="secondary" size="sm">
                        <Link href={href(page.page + 1)} preserveScroll>
                            Next <ChevronRight aria-hidden="true" />
                        </Link>
                    </Button>
                ) : null}
            </span>
        </nav>
    );
}

/**
 * Two-option order switch (Newest first / Oldest first). Presentation only:
 * the selected option is marked with aria-pressed / aria-current and weight,
 * not colour alone. Each option is either a link (server-sorted lists) or a
 * button (client-side order).
 */
export function OrderToggle<T extends string>({
    label,
    value,
    options,
    href,
    onChange,
    testId,
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    href?: (v: T) => string;
    onChange?: (v: T) => void;
    testId?: string;
}) {
    const cls = (active: boolean) =>
        cn(
            'inline-flex h-8 items-center rounded-[var(--radius-sm)] px-3 text-xs whitespace-nowrap',
            active ? 'bg-surface font-semibold text-foreground shadow-xs' : 'font-medium text-muted-foreground hover:text-foreground',
        );
    return (
        <div role="group" aria-label={label} className="inline-flex shrink-0 gap-0.5 rounded-[var(--radius-md)] bg-surface-muted p-0.5" data-testid={testId}>
            {options.map((o) =>
                href ? (
                    <Link key={o.value} href={href(o.value)} preserveScroll aria-current={o.value === value ? 'true' : undefined} className={cls(o.value === value)}>
                        {o.label}
                    </Link>
                ) : (
                    <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange?.(o.value)} className={cls(o.value === value)}>
                        {o.label}
                    </button>
                ),
            )}
        </div>
    );
}

export const ORDER_OPTIONS = [
    { value: 'newest' as const, label: 'Newest first' },
    { value: 'oldest' as const, label: 'Oldest first' },
];

export function EmptyState({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface p-8 text-center text-sm text-muted-foreground">
            {children}
        </div>
    );
}
