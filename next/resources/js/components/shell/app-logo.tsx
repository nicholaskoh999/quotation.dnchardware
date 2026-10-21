import { Link } from '@inertiajs/react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHELL_APP_NAME, SHELL_LOGO_HREF } from './nav-config';

/* The app identity. ALWAYS returns to QUO Home — distinct from Back and
   from DNC Workspace (handoff §4). */
export function AppLogo({ className }: { className?: string }) {
    return (
        <Link
            href={SHELL_LOGO_HREF}
            className={cn('flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] font-semibold text-foreground', className)}
            aria-label={`${SHELL_APP_NAME} — Home`}
            data-testid="app-logo"
        >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-accent-foreground">
                <FileText className="size-4" aria-hidden="true" />
            </span>
            <span className="truncate">{SHELL_APP_NAME}</span>
        </Link>
    );
}
