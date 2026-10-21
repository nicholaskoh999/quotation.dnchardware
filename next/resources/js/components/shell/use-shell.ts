import { usePage } from '@inertiajs/react';
import type { ReleaseInfo, ShellSharedProps, ShellUser } from '@/types';
import { safeExternalUrl } from './nav-config';

export interface ShellContext {
    url: string;
    user: ShellUser | null;
    workspaceUrl: string | null;
    release: ReleaseInfo | null;
    flash: { success?: string | null; error?: string | null } | null;
}

/* Reads the shared props the shell consumes. Every one is optional: an error
   page rendered outside the web middleware has none of them, and Sessions C/D
   ship `auth.user` / `workspace.url` later (NOTES.md). */
export function useShell(): ShellContext {
    const page = usePage<Partial<ShellSharedProps>>();
    const props = page.props ?? {};
    const user = props.auth?.user;
    return {
        url: page.url ?? '/',
        user: user && typeof user.displayName === 'string' ? user : null,
        workspaceUrl: safeExternalUrl(props.workspace?.url),
        release: props.release ?? null,
        flash: props.flash ?? null,
    };
}
