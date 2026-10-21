import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

/* Status badge. Colour is never the only signal (handoff §3): callers pass the
   words, and an icon where it helps. */
const badgeVariants = cva(
    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:size-3',
    {
        variants: {
            tone: {
                neutral: 'border-border bg-surface-muted text-muted-foreground',
                accent: 'border-transparent bg-accent-soft text-accent',
                success: 'border-transparent bg-success-soft text-success',
                warning: 'border-transparent bg-warning-soft text-warning',
                danger: 'border-transparent bg-danger-soft text-danger',
                special: 'border-transparent bg-special-soft text-special',
            },
        },
        defaultVariants: { tone: 'neutral' },
    },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
    return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
