import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/* shadcn/ui-style button. `loading` exists because no meaningful action may be
   silent (handoff §3): a pending action shows a spinner AND keeps its label. */
const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                primary: 'bg-accent text-accent-foreground shadow-xs hover:bg-accent-hover',
                secondary: 'border border-border bg-surface text-foreground shadow-xs hover:bg-surface-muted',
                ghost: 'text-foreground hover:bg-surface-muted',
                danger: 'bg-danger text-white shadow-xs hover:opacity-90',
                link: 'text-accent underline-offset-4 hover:underline',
            },
            size: {
                sm: 'h-8 px-3',
                md: 'h-9 px-4',
                lg: 'h-11 px-5 text-base',
                icon: 'size-9',
            },
        },
        defaultVariants: { variant: 'secondary', size: 'md' },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                ref={ref}
                className={cn(buttonVariants({ variant, size }), className)}
                disabled={disabled || loading}
                aria-busy={loading || undefined}
                {...props}
            >
                {asChild ? (
                    children
                ) : (
                    <>
                        {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
                        {children}
                    </>
                )}
            </Comp>
        );
    },
);
Button.displayName = 'Button';

export { buttonVariants };
