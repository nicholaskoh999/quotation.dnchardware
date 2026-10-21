import { Link } from '@inertiajs/react';
import { LogOut, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShellUser } from '@/types';

export function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const letters = parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [parts[0]?.[0], parts[0]?.[1]];
    return letters.filter(Boolean).join('').toUpperCase() || '?';
}

function Avatar({ user, size = 'md' }: { user: ShellUser | null; size?: 'sm' | 'md' }) {
    const box = size === 'sm' ? 'size-7 text-[11px]' : 'size-8 text-xs';
    return user ? (
        <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent', box)}>
            {initials(user.displayName || user.username)}
        </span>
    ) : (
        <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground', box)}>
            <UserRound className="size-4" />
        </span>
    );
}

/* Current named user (handoff §5 — identity comes from auth, never typed).
   Without `auth.user` the shell says so plainly; it never invents a user. */
export function UserArea({ user, compact = false, className }: { user: ShellUser | null; compact?: boolean; className?: string }) {
    return (
        <div className={cn('flex min-w-0 items-center gap-2', className)} data-testid="user-area">
            <Avatar user={user} size={compact ? 'sm' : 'md'} />
            <div className="min-w-0 leading-tight">
                {user ? (
                    <>
                        <p className="truncate text-sm font-medium text-foreground" data-testid={compact ? undefined : 'current-user'}>
                            {user.displayName || user.username}
                        </p>
                        {!compact && <p className="truncate text-xs text-muted-foreground">@{user.username}</p>}
                    </>
                ) : (
                    <>
                        <p className="truncate text-sm text-muted-foreground">Not signed in</p>
                        {!compact && <p className="truncate text-xs text-subtle-foreground">Sign-in not connected yet</p>}
                    </>
                )}
            </div>
        </div>
    );
}

/* Desktop / tablet Sign out (W1 integration: Session C's POST /logout, CSRF
   protected by Inertia's XSRF cookie). Rendered only for a signed-in user. */
export function SignOutButton({ className }: { className?: string }) {
    return (
        <Link
            href="/logout"
            method="post"
            as="button"
            className={cn(
                'inline-flex h-8 items-center gap-2 rounded-[var(--radius-md)] px-2 text-sm text-muted-foreground hover:bg-danger-soft hover:text-danger [&_svg]:size-4',
                className,
            )}
        >
            <LogOut aria-hidden="true" />
            Sign out
        </Link>
    );
}
