import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { PHONE_QUERY, useMediaQuery } from '@/components/shell/use-media-query';

/* Toast placement per handoff §3: desktop/tablet top-right; phone ABOVE the
   bottom navigation (64px bar + gap + home-indicator safe area). Sonner's own
   "mobile" switch is at 600px, ours is 640px, so the position is chosen here. */
export const PHONE_TOAST_OFFSET = 'calc(var(--shell-bottom-nav-height, 64px) + 12px + env(safe-area-inset-bottom))';

export function toasterPlacement(isPhone: boolean): Pick<ToasterProps, 'position' | 'offset' | 'mobileOffset'> {
    return isPhone
        ? { position: 'bottom-center', offset: { bottom: PHONE_TOAST_OFFSET }, mobileOffset: { bottom: PHONE_TOAST_OFFSET } }
        : { position: 'top-right' };
}

export function Toaster() {
    const isPhone = useMediaQuery(PHONE_QUERY);
    return (
        <Sonner
            {...toasterPlacement(isPhone)}
            toastOptions={{ classNames: { toast: 'border border-border shadow-sm' } }}
            richColors
            closeButton
        />
    );
}
