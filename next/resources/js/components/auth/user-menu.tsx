import { router, usePage } from '@inertiajs/react';
import { LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SharedProps } from '@/types';

/* The signed-in person + Sign out (POST /logout, CSRF-protected by Inertia's
   XSRF cookie). Presentation only; identity comes from the shared auth.user. */
export function UserMenu() {
    const { auth } = usePage<SharedProps>().props;
    const [busy, setBusy] = useState(false);
    if (!auth?.user) return null;

    return (
        <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:inline-flex" data-testid="current-user">
                <UserRound className="size-4" aria-hidden="true" />
                {auth.user.displayName}
            </span>
            <Button
                size="sm"
                variant="ghost"
                loading={busy}
                onClick={() => router.post('/logout', {}, { onStart: () => setBusy(true), onFinish: () => setBusy(false) })}
            >
                {!busy && <LogOut aria-hidden="true" />}
                Sign out
            </Button>
        </div>
    );
}
