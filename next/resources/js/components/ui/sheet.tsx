import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/* shadcn-style Sheet / drawer on Radix Dialog: focus trap, Escape, scroll
   lock and aria wiring come from Radix. `side="bottom"` is the phone action
   sheet; it pads for the home-indicator safe area. */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const sheetVariants = cva(
    'fixed z-50 flex flex-col gap-3 bg-surface shadow-lg outline-none',
    {
        variants: {
            side: {
                left: 'inset-y-0 left-0 h-full w-[min(20rem,85vw)] border-r border-border p-4 pt-[max(1rem,env(safe-area-inset-top))]',
                right: 'inset-y-0 right-0 h-full w-[min(20rem,85vw)] border-l border-border p-4 pt-[max(1rem,env(safe-area-inset-top))]',
                bottom:
                    'inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[var(--radius-lg)] border-t border-border px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]',
            },
        },
        defaultVariants: { side: 'right' },
    },
);

export interface SheetContentProps
    extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
        VariantProps<typeof sheetVariants> {
    title: string;
    description?: string;
    /** Visually hide the title (still announced to screen readers). */
    hideTitle?: boolean;
}

export const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
    ({ side, className, children, title, description, hideTitle = false, ...props }, ref) => (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
            <DialogPrimitive.Content
                ref={ref}
                className={cn(sheetVariants({ side }), className)}
                {...(description ? {} : { 'aria-describedby': undefined })}
                {...props}
            >
                {side === 'bottom' && <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-border-strong" />}
                <div className={cn('flex items-start justify-between gap-3', hideTitle && 'sr-only')}>
                    <div className="min-w-0">
                        <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
                        {description ? (
                            <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                                {description}
                            </DialogPrimitive.Description>
                        ) : null}
                    </div>
                </div>
                {children}
                <DialogPrimitive.Close
                    className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    aria-label="Close"
                >
                    <X className="size-4" aria-hidden="true" />
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    ),
);
SheetContent.displayName = 'SheetContent';
