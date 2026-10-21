import { Head } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';

/* Page frame for every QUO page: <Head> title + the responsive app shell. */
export default function AppLayout({ title, children }: { title?: string; children: ReactNode }) {
    return (
        <AppShell>
            {title ? <Head title={title} /> : null}
            {children}
        </AppShell>
    );
}
