import * as React from 'react';
import { cn } from '@/lib/utils';

/* Text input. `aria-invalid` drives the error border, so validation state is
   announced as well as shown (handoff §3: never colour alone — pair it with
   <FieldError>). Phone-friendly height. */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, type = 'text', ...props }, ref) => (
        <input
            ref={ref}
            type={type}
            className={cn(
                'flex h-10 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 text-base text-foreground shadow-xs placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger sm:h-9 sm:text-sm',
                className,
            )}
            {...props}
        />
    ),
);
Input.displayName = 'Input';
