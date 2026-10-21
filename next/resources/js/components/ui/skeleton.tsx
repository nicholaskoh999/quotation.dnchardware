import * as React from 'react';
import { cn } from '@/lib/utils';

/* Loading placeholder. Wrap groups in an element with aria-busy and a
   screen-reader label (see <LoadingList>) so loading is not visual-only. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div aria-hidden="true" className={cn('animate-pulse rounded-[var(--radius-sm)] bg-surface-muted', className)} {...props} />;
}

export function LoadingList({ rows = 3, label = 'Loading…' }: { rows?: number; label?: string }) {
    return (
        <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-2">
            <span className="sr-only">{label}</span>
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex flex-1 flex-col gap-2">
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-3 w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}
