import { Link } from '@inertiajs/react';
import { ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { activeHref, DESKTOP_NAV, WORKSPACE_LABEL } from './nav-config';

const ALL_HREFS = DESKTOP_NAV.flatMap((s) => s.items.map((i) => i.href));

const itemClass =
    'flex h-9 items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-sm font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0';

/* Presentational: the desktop sidebar body and the tablet nav sheet both
   render this (handoff §4). Props-only, so it is unit-testable. */
export function SidebarNav({
    currentUrl,
    workspaceUrl,
    onNavigate,
}: {
    currentUrl: string;
    workspaceUrl: string | null;
    onNavigate?: () => void;
}) {
    const active = activeHref(currentUrl, ALL_HREFS);
    return (
        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-4" data-testid="sidebar-nav">
            {DESKTOP_NAV.map((section) => (
                <div key={section.key} className="flex flex-col gap-0.5">
                    {section.title ? (
                        <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-subtle-foreground uppercase">{section.title}</p>
                    ) : null}
                    <ul className="flex flex-col gap-0.5">
                        {section.items.map((item) => {
                            const isActive = active === item.href;
                            const Icon = item.icon;
                            return (
                                <li key={item.key}>
                                    <Link
                                        href={item.href}
                                        onClick={onNavigate}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={cn(
                                            itemClass,
                                            isActive
                                                ? 'bg-accent-soft text-accent'
                                                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                                        )}
                                    >
                                        <Icon aria-hidden="true" />
                                        {item.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
            <div className="mt-auto border-t border-border pt-3">
                {workspaceUrl ? (
                    <a href={workspaceUrl} className={cn(itemClass, 'text-muted-foreground hover:bg-surface-muted hover:text-foreground')}>
                        <ArrowLeftRight aria-hidden="true" />
                        {WORKSPACE_LABEL}
                    </a>
                ) : (
                    <span
                        aria-disabled="true"
                        className={cn(itemClass, 'h-auto cursor-not-allowed py-1.5 text-subtle-foreground')}
                        data-testid="workspace-link-disabled"
                    >
                        <ArrowLeftRight aria-hidden="true" />
                        <span className="flex flex-col leading-tight">
                            {WORKSPACE_LABEL}
                            <span className="text-xs font-normal">Not connected in this preview</span>
                        </span>
                    </span>
                )}
            </div>
        </nav>
    );
}
