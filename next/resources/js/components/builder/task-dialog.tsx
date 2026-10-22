import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeft, X } from 'lucide-react';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* Builder task dialog (Owner Smoke #2): Quick Add · Manual Add · Batch Add ·
   Edit item.
     desktop / tablet (≥ 640)  centred large modal, max ~85vh, sticky header and
                               footer, the body scrolls inside
     phone (< 640)             full-screen task: Back / title header, scrolling
                               body, sticky footer actions
   Never a right-side inspector drawer. Focus trap, Escape and scroll lock come
   from Radix Dialog. While open, the footer height is published as
   --task-footer-h so phone toasts sit above the task's actions. */
export function TaskDialog({
    open,
    onOpenChange,
    title,
    description,
    width = 880,
    footer,
    children,
    testId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    /** Desktop width in px (Manual Add ~880, Quick / Batch Add wider). */
    width?: number;
    footer?: ReactNode;
    children: ReactNode;
    testId?: string;
}) {
    const footerRef = useRef<HTMLElement | null>(null);
    useEffect(() => {
        const el = footerRef.current;
        if (!open || !el || typeof ResizeObserver === 'undefined') return;
        const root = document.documentElement;
        const publish = () => root.style.setProperty('--task-footer-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
        publish();
        const ro = new ResizeObserver(publish);
        ro.observe(el);
        return () => {
            ro.disconnect();
            root.style.removeProperty('--task-footer-h');
        };
    });
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
                <DialogPrimitive.Content
                    data-testid={testId}
                    style={{ '--task-w': `${width}px` } as CSSProperties}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    {...(description ? {} : { 'aria-describedby': undefined })}
                    className={cn(
                        'fixed inset-0 z-50 flex flex-col bg-surface outline-none',
                        'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[85dvh] sm:w-[min(var(--task-w),calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-lg)] sm:border sm:border-border sm:shadow-lg',
                    )}
                >
                    <header className="flex shrink-0 items-start gap-2 border-b border-border px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6 sm:pt-4 sm:pb-3">
                        <DialogPrimitive.Close
                            className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground hover:bg-surface-muted sm:hidden"
                            aria-label="Back"
                        >
                            <ArrowLeft className="size-5" aria-hidden="true" />
                        </DialogPrimitive.Close>
                        <div className="min-w-0 flex-1 pt-1.5 sm:pt-0">
                            <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
                            {description ? <DialogPrimitive.Description className="mt-0.5 truncate text-sm text-muted-foreground">{description}</DialogPrimitive.Description> : null}
                        </div>
                        <DialogPrimitive.Close
                            className="hidden size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground hover:bg-surface-muted hover:text-foreground sm:inline-flex"
                            aria-label="Close"
                        >
                            <X className="size-4" aria-hidden="true" />
                        </DialogPrimitive.Close>
                    </header>
                    {children}
                    {footer ? (
                        <footer ref={footerRef} className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-[var(--radius-lg)] sm:px-6">
                            {footer}
                        </footer>
                    ) : null}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

/** Scrolling body of a TaskDialog. */
export function TaskBody({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6', className)}>{children}</div>;
}
