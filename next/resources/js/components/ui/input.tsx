import * as React from 'react';
import { cn } from '@/lib/utils';

/* shadcn/ui-style text input. 16px text on phones stops iOS zooming on focus;
   44px+ height keeps it a comfortable touch target. */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, type = 'text', ...props }, ref) => (
        <input
            ref={ref}
            type={type}
            className={cn(
                'flex h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-base text-foreground shadow-xs transition-colors sm:text-sm',
                'placeholder:text-subtle-foreground hover:border-border-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
                'disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger',
                className,
            )}
            {...props}
        />
    ),
);
Input.displayName = 'Input';
