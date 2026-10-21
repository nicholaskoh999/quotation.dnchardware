import { CheckCircle2, CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/* Inline (in-page) feedback: error / success / warning / info. Icon + title
   + text, never colour alone. Errors are announced (role=alert). */
type Tone = 'error' | 'success' | 'warning' | 'info';

const TONES: Record<Tone, { icon: LucideIcon; box: string; iconClass: string }> = {
    error: { icon: CircleAlert, box: 'border-danger/30 bg-danger-soft', iconClass: 'text-danger' },
    success: { icon: CheckCircle2, box: 'border-success/30 bg-success-soft', iconClass: 'text-success' },
    warning: { icon: TriangleAlert, box: 'border-warning/30 bg-warning-soft', iconClass: 'text-warning' },
    info: { icon: Info, box: 'border-border bg-surface-muted', iconClass: 'text-muted-foreground' },
};

export function InlineAlert({
    tone,
    title,
    children,
    action,
    className,
}: {
    tone: Tone;
    title: string;
    children?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}) {
    const t = TONES[tone];
    const Icon = t.icon;
    return (
        <div
            role={tone === 'error' ? 'alert' : 'status'}
            className={cn('flex gap-3 rounded-[var(--radius-md)] border p-3 text-sm', t.box, className)}
            data-tone={tone}
        >
            <Icon className={cn('mt-0.5 size-4 shrink-0', t.iconClass)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{title}</p>
                {children ? <div className="mt-0.5 text-muted-foreground">{children}</div> : null}
                {action ? <div className="mt-2">{action}</div> : null}
            </div>
        </div>
    );
}
