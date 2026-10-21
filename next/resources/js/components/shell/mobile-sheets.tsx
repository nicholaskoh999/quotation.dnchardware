import { Link } from '@inertiajs/react';
import { ArrowLeftRight, ChevronRight, Languages, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { ShellUser } from '@/types';
import { MORE_LINKS, PLUS_ACTIONS } from './nav-config';
import { UserArea } from './user-area';

const rowClass =
    'flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 text-left text-[15px] font-medium text-foreground [&>svg:first-child]:size-5 [&>svg:first-child]:shrink-0 [&>svg:first-child]:text-muted-foreground';

function DisabledRow({ icon, label, note, testId }: { icon: ReactNode; label: string; note: string; testId?: string }) {
    return (
        <div aria-disabled="true" className={cn(rowClass, 'cursor-not-allowed py-2 text-subtle-foreground')} data-testid={testId}>
            {icon}
            <span className="flex flex-col leading-tight">
                <span>{label}</span>
                <span className="text-xs font-normal text-muted-foreground">{note}</span>
            </span>
        </div>
    );
}

/* Centre "+" sheet: New Quotation · Quick Add · Manual Add (handoff §8). */
export function PlusSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" title="Create" description="Start a new quotation." data-testid="plus-sheet">
                <ul className="flex flex-col gap-1">
                    {PLUS_ACTIONS.map((a) => {
                        const Icon = a.icon;
                        return (
                            <li key={a.key}>
                                <Link href={a.href} onClick={() => onOpenChange(false)} className={cn(rowClass, 'hover:bg-surface-muted')}>
                                    <Icon aria-hidden="true" />
                                    <span className="flex-1">{a.label}</span>
                                    <ChevronRight className="size-4 text-subtle-foreground" aria-hidden="true" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </SheetContent>
        </Sheet>
    );
}

/* "More" sheet: Price Lookup · Calculator · System Health · Settings · DNC
   Workspace · Language · Sign Out (handoff §8). Workspace and Sign Out are
   only live when their providers exist (NOTES.md) — otherwise shown disabled
   with the reason, never as a dead link. */
export function MoreSheet({
    open,
    onOpenChange,
    user,
    workspaceUrl,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: ShellUser | null;
    workspaceUrl: string | null;
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" title="More" data-testid="more-sheet">
                <UserArea user={user} className="rounded-[var(--radius-md)] bg-surface-muted p-3" />
                <ul className="flex flex-col gap-1">
                    {MORE_LINKS.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.key}>
                                <Link href={item.href} onClick={() => onOpenChange(false)} className={cn(rowClass, 'hover:bg-surface-muted')}>
                                    <Icon aria-hidden="true" />
                                    <span className="flex-1">{item.label}</span>
                                    <ChevronRight className="size-4 text-subtle-foreground" aria-hidden="true" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
                <div className="flex flex-col gap-1 border-t border-border pt-2">
                    {workspaceUrl ? (
                        <a href={workspaceUrl} className={cn(rowClass, 'hover:bg-surface-muted')}>
                            <ArrowLeftRight aria-hidden="true" />
                            <span className="flex-1">DNC Workspace</span>
                        </a>
                    ) : (
                        <DisabledRow icon={<ArrowLeftRight aria-hidden="true" />} label="DNC Workspace" note="Not connected in this preview" />
                    )}
                    <DisabledRow icon={<Languages aria-hidden="true" />} label="Language" note="English · other languages arrive later" />
                    {user ? (
                        <Link
                            href="/logout"
                            method="post"
                            as="button"
                            onClick={() => onOpenChange(false)}
                            className={cn(rowClass, 'text-danger hover:bg-danger-soft [&>svg:first-child]:text-danger')}
                        >
                            <LogOut aria-hidden="true" />
                            <span className="flex-1">Sign Out</span>
                        </Link>
                    ) : (
                        <DisabledRow
                            icon={<LogOut aria-hidden="true" />}
                            label="Sign Out"
                            note="Named sign-in is not connected in this preview"
                            testId="sign-out-disabled"
                        />
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
