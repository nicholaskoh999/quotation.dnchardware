import { Link } from '@inertiajs/react';
import { Building2, Calculator, ClipboardList, FilePlus2, Search, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Action {
    key: string;
    label: string;
    icon: LucideIcon;
    href: string;
}

const ACTIONS: Action[] = [
    { key: 'newQuotation', label: 'New Quotation', icon: FilePlus2, href: '/quotations/new' },
    { key: 'quickAdd', label: 'Quick Add', icon: Zap, href: '/quotations/new?mode=quick' },
    { key: 'companies', label: 'Companies', icon: Building2, href: '/companies' },
    { key: 'priceLookup', label: 'Price Lookup', icon: Search, href: '/price-lookup' },
    { key: 'calculator', label: 'Calculator', icon: Calculator, href: '/calculator' },
];

const TILE =
    'flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface p-2 text-center text-xs font-medium text-foreground shadow-xs';
const ROW =
    'flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-left text-sm font-medium text-foreground shadow-xs';

/* Quick Actions (handoff §8). Internal PO is a cross-system handoff to DNC
   Workspace (§27): live only when `workspace.url` is shared, otherwise an
   honest disabled "coming later" tile.
   layout="tiles" (phone Home): square tiles, accent icons. layout="list"
   (tablet / desktop Overview): compact rows with muted icons, so they do not
   compete with the page's primary New Quotation button. */
export function QuickActions({
    workspaceUrl,
    className,
    layout = 'tiles',
}: {
    workspaceUrl: string | null;
    className?: string;
    layout?: 'tiles' | 'list';
}) {
    const list = layout === 'list';
    const tile = list ? ROW : TILE;
    const icon = list ? 'size-4 shrink-0 text-muted-foreground' : 'size-5 text-accent';
    return (
        <section aria-labelledby="quick-actions-title" className={className} data-testid="quick-actions">
            <h2 id="quick-actions-title" className="mb-2 text-sm font-semibold text-foreground">
                Quick Actions
            </h2>
            <ul className={list ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2' : 'grid grid-cols-3 gap-2'}>
                {ACTIONS.map(({ key, label, icon: Icon, href }) => (
                    <li key={key}>
                        <Link href={href} className={cn(tile, 'hover:border-border-strong hover:bg-surface-muted')}>
                            <Icon className={icon} aria-hidden="true" />
                            <span className={list ? 'truncate' : undefined}>{label}</span>
                        </Link>
                    </li>
                ))}
                <li>
                    {workspaceUrl ? (
                        <a href={workspaceUrl} className={cn(tile, 'hover:border-border-strong hover:bg-surface-muted')}>
                            <ClipboardList className={list ? icon : 'size-5 text-special'} aria-hidden="true" />
                            Internal PO
                        </a>
                    ) : (
                        <div aria-disabled="true" className={cn(tile, 'cursor-not-allowed border-dashed text-subtle-foreground shadow-none')} data-testid="internal-po-disabled">
                            <ClipboardList className={list ? 'size-4 shrink-0' : 'size-5'} aria-hidden="true" />
                            <span className={list ? 'truncate' : undefined}>Internal PO</span>
                            <span className={cn('font-normal text-muted-foreground', list ? 'ml-auto text-[11px]' : 'text-[10px]')}>Coming later</span>
                        </div>
                    )}
                </li>
            </ul>
        </section>
    );
}
