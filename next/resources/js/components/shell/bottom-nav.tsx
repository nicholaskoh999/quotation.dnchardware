import { Link } from '@inertiajs/react';
import { Building2, Ellipsis, FileText, House, Plus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { activeHref, BOTTOM_NAV, type BottomNavKey } from './nav-config';

const ICONS: Record<BottomNavKey, LucideIcon> = { home: House, quotes: FileText, plus: Plus, companies: Building2, more: Ellipsis };
const ROUTED = BOTTOM_NAV.filter((i) => i.href).map((i) => i.href!);

/* Phone bottom navigation: Home | Quotes | + | Companies | More (handoff
   §8). Fixed, above the home-indicator safe area; icon + label (never
   icon-only). "Quotes" stays selected inside /quotations/... pages. */
export function BottomNav({ currentUrl, onPlus, onMore }: { currentUrl: string; onPlus: () => void; onMore: () => void }) {
    const active = activeHref(currentUrl, ROUTED);
    return (
        <nav
            aria-label="Bottom navigation"
            data-testid="bottom-nav"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        >
            <ul className="mx-auto grid h-[var(--shell-bottom-nav-height)] max-w-lg grid-cols-5">
                {BOTTOM_NAV.map((item) => {
                    const Icon = ICONS[item.key];
                    if (item.key === 'plus') {
                        return (
                            <li key={item.key} className="flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={onPlus}
                                    aria-label="Create — New Quotation, Quick Add, Manual Add"
                                    aria-haspopup="dialog"
                                    className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm active:bg-accent-hover"
                                >
                                    <Plus className="size-6" aria-hidden="true" />
                                </button>
                            </li>
                        );
                    }
                    const content = (
                        <>
                            <Icon className="size-5" aria-hidden="true" />
                            <span className="max-w-full truncate px-0.5 text-[11px] leading-none font-medium whitespace-nowrap">{item.label}</span>
                        </>
                    );
                    const cls = 'flex h-full w-full min-w-0 flex-col items-center justify-center gap-1';
                    if (!item.href) {
                        return (
                            <li key={item.key}>
                                <button type="button" onClick={onMore} aria-haspopup="dialog" className={cn(cls, 'text-muted-foreground')}>
                                    {content}
                                </button>
                            </li>
                        );
                    }
                    const isActive = active === item.href;
                    return (
                        <li key={item.key}>
                            <Link
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(cls, isActive ? 'text-accent [&>span]:font-semibold' : 'text-muted-foreground')}
                            >
                                {content}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
