import * as React from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
    title,
    description,
    actions,
    className,
}: {
    title: string;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
            <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
                {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
    );
}
