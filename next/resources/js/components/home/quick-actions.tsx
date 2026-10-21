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

const tile =
    'flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface p-2 text-center text-xs font-medium text-foreground shadow-xs';

/* Quick Actions (handoff §8). Internal PO is a cross-system handoff to DNC
   Workspace (§27): live only when `workspace.url` is shared, otherwise an
   honest disabled "coming later" tile. */
export function QuickActions({ workspaceUrl, className }: { workspaceUrl: string | null; className?: string }) {
    return (
        <section aria-labelledby="quick-actions-title" className={className} data-testid="quick-actions">
            <h2 id="quick-actions-title" className="mb-2 text-sm font-semibold text-foreground">
                Quick Actions
            </h2>
            <ul className="grid grid-cols-3 gap-2">
                {ACTIONS.map(({ key, label, icon: Icon, href }) => (
                    <li key={key}>
                        <Link href={href} className={cn(tile, 'hover:border-border-strong hover:bg-surface-muted')}>
                            <Icon className="size-5 text-accent" aria-hidden="true" />
                            {label}
                        </Link>
                    </li>
                ))}
                <li>
                    {workspaceUrl ? (
                        <a href={workspaceUrl} className={cn(tile, 'hover:border-border-strong hover:bg-surface-muted')}>
                            <ClipboardList className="size-5 text-special" aria-hidden="true" />
                            Internal PO
                        </a>
                    ) : (
                        <div aria-disabled="true" className={cn(tile, 'cursor-not-allowed border-dashed text-subtle-foreground shadow-none')} data-testid="internal-po-disabled">
                            <ClipboardList className="size-5" aria-hidden="true" />
                            Internal PO
                            <span className="text-[10px] font-normal text-muted-foreground">Coming later</span>
                        </div>
                    )}
                </li>
            </ul>
        </section>
    );
}
