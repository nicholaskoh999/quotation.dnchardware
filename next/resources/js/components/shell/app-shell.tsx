import { Menu } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/sonner';
import { notify } from '@/lib/feedback';
import { AppLogo } from './app-logo';
import { BottomNav } from './bottom-nav';
import { MoreSheet, PlusSheet } from './mobile-sheets';
import { SidebarNav } from './sidebar-nav';
import { useShell } from './use-shell';
import { SignOutButton, UserArea } from './user-area';

/* The QUOTATION NEXT app shell (handoff §4 / §8 / §9). Breakpoints — see
   NOTES.md:
     phone   < 640   app bar + bottom nav (+ / More sheets), no sidebar
     tablet  640–1023 app bar with a nav sheet, single column, no bottom nav
     desktop >= 1024  fixed sidebar + richer layout */
export function AppShell({ children }: { children: ReactNode }) {
    const { url, user, workspaceUrl, release, flash } = useShell();
    const [navOpen, setNavOpen] = useState(false);
    const [plusOpen, setPlusOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);

    // Server flash messages become toasts, so a redirect-after-action is never silent.
    useEffect(() => {
        if (flash?.success) notify.success(flash.success);
        if (flash?.error) notify.error(flash.error);
    }, [flash]);

    const releaseLabel = release ? `v${release.version}${release.shortSha ? ` · ${release.shortSha}` : ''}` : null;

    return (
        <div className="min-h-dvh lg:pl-[var(--shell-sidebar-width)]">
            {/* desktop sidebar */}
            <aside
                className="fixed inset-y-0 left-0 z-30 hidden w-[var(--shell-sidebar-width)] flex-col gap-5 border-r border-border bg-surface px-3 py-4 lg:flex"
                data-testid="sidebar"
            >
                <AppLogo className="px-2" />
                <SidebarNav currentUrl={url} workspaceUrl={workspaceUrl} />
                <div className="flex flex-col gap-2 border-t border-border px-1 pt-3">
                    <UserArea user={user} />
                    {user ? <SignOutButton className="self-start" /> : null}
                    {releaseLabel ? (
                        <span className="px-1 text-[11px] text-subtle-foreground" data-testid="release">
                            {releaseLabel}
                        </span>
                    ) : null}
                </div>
            </aside>

            {/* phone + tablet app bar */}
            <header
                className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden"
                data-testid="app-bar"
            >
                <div className="flex h-14 items-center gap-2 px-4">
                    <button
                        type="button"
                        onClick={() => setNavOpen(true)}
                        aria-label="Open navigation"
                        aria-haspopup="dialog"
                        className="-ml-2 hidden size-10 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground hover:bg-surface-muted sm:inline-flex"
                    >
                        <Menu className="size-5" aria-hidden="true" />
                    </button>
                    <AppLogo className="flex-1" />
                    <UserArea user={user} compact className="max-w-[40%] justify-end" />
                    <button
                        type="button"
                        onClick={() => setMoreOpen(true)}
                        aria-label="Menu"
                        aria-haspopup="dialog"
                        className="-mr-2 inline-flex size-10 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground hover:bg-surface-muted sm:hidden"
                    >
                        <Menu className="size-5" aria-hidden="true" />
                    </button>
                </div>
            </header>

            <main
                className="mx-auto w-full max-w-6xl px-4 pt-5 pb-[calc(var(--shell-bottom-nav-height)+env(safe-area-inset-bottom)+1.5rem)] sm:px-6 sm:pb-8 lg:px-8 lg:pt-8"
                data-testid="main"
            >
                {children}
            </main>

            {/* tablet navigation sheet */}
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
                <SheetContent side="left" title="Navigation" hideTitle data-testid="nav-sheet">
                    <AppLogo className="px-2 pr-10" />
                    <SidebarNav currentUrl={url} workspaceUrl={workspaceUrl} onNavigate={() => setNavOpen(false)} />
                    <div className="flex flex-col gap-2 border-t border-border px-1 pt-3">
                        <UserArea user={user} />
                        {user ? <SignOutButton className="self-start" /> : null}
                    </div>
                </SheetContent>
            </Sheet>

            {/* phone bottom navigation + its sheets */}
            <BottomNav currentUrl={url} onPlus={() => setPlusOpen(true)} onMore={() => setMoreOpen(true)} />
            <PlusSheet open={plusOpen} onOpenChange={setPlusOpen} />
            <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} user={user} workspaceUrl={workspaceUrl} />

            <Toaster />
        </div>
    );
}
