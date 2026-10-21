import { Construction } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/* The honest "not yet available in this preview" state (handoff §3: do not
   fake data or actions). `arrives` names the wave/step that delivers it. */
export function PreviewNotice({
    feature,
    arrives,
    children,
    className,
}: {
    feature: string;
    arrives: string;
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <section
            aria-label={`${feature} — not yet available`}
            data-testid="preview-notice"
            className={cn('rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-xs sm:p-6', className)}
        >
            <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
                    <Construction className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-warning uppercase">Not yet available in this preview</p>
                    <h2 className="mt-0.5 text-base font-semibold text-foreground">{feature}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Arrives in <span className="font-medium text-foreground">{arrives}</span>.
                    </p>
                    {children ? <div className="mt-3 text-sm text-muted-foreground">{children}</div> : null}
                </div>
            </div>
        </section>
    );
}
