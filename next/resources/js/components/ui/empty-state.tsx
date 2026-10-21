import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/* Honest empty state: says what is (not) here and, where one exists, offers
   the real next action. Never filled with sample data. */
export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
    compact = false,
    ...props
}: {
    icon: LucideIcon;
    title: string;
    description?: React.ReactNode;
    action?: React.ReactNode;
    compact?: boolean;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>) {
    return (
        <div
            className={cn(
                'flex flex-col items-center rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface text-center',
                compact ? 'gap-1.5 p-4' : 'gap-2 p-8',
                className,
            )}
            {...props}
        >
            <span className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                <Icon className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {description ? <div className="max-w-sm text-sm text-muted-foreground">{description}</div> : null}
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    );
}
