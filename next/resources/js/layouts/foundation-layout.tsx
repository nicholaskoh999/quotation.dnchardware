import { Link, usePage } from '@inertiajs/react';
import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import type { SharedProps } from '@/types';

/* R1 placeholder frame. Wave 1 Session A replaces it with the real App Shell;
   it exists so every page already has the logo → Home rule (handoff §4) and
   one Toaster from day one. */
export default function FoundationLayout({ children }: { children: ReactNode }) {
    const { release } = usePage<SharedProps>().props;
    return (
        <div className="min-h-dvh">
            <header className="border-b border-border bg-surface">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
                    <Link href="/" className="flex items-center gap-2 font-semibold" aria-label="DNC Quotation — Home">
                        <FileText className="size-5 text-accent" aria-hidden="true" />
                        DNC Quotation
                    </Link>
                    <span className="text-xs text-subtle-foreground" data-testid="release">
                        v{release.version}
                        {release.shortSha ? ` · ${release.shortSha}` : ''}
                    </span>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
            <Toaster />
        </div>
    );
}
