import { Toaster as Sonner } from 'sonner';

/* Toast placement per handoff §3: desktop top-right; phone above the bottom
   navigation (the offset clears the 64px bottom bar + safe area). */
export function Toaster() {
    return (
        <Sonner
            position="top-right"
            mobileOffset={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
            toastOptions={{ classNames: { toast: 'border border-border shadow-sm' } }}
            richColors
            closeButton
        />
    );
}
