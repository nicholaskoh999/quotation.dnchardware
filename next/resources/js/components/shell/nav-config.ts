import {
    Activity,
    Building2,
    Calculator,
    FilePlus2,
    FileText,
    House,
    PencilLine,
    Search,
    Settings,
    Zap,
    type LucideIcon,
} from 'lucide-react';

/* Navigation is DATA, rendered by three presentations (desktop sidebar,
   tablet sheet, phone bottom nav + sheets) so the items can never drift apart
   (handoff §4 / §8). No business rules live here — only labels and links. */

/** The DNC Quotation logo ALWAYS returns to QUO Home (handoff §4). */
export const SHELL_LOGO_HREF = '/';
export const SHELL_APP_NAME = 'DNC Quotation';

export interface NavItem {
    key: string;
    label: string;
    href: string;
    icon: LucideIcon;
}

export interface NavSection {
    key: string;
    /** null = un-headed section (Overview). */
    title: string | null;
    items: NavItem[];
}

export const NAV: Record<string, NavItem> = {
    home: { key: 'home', label: 'Overview', href: '/', icon: House },
    quotations: { key: 'quotations', label: 'Quotations', href: '/quotations', icon: FileText },
    newQuotation: { key: 'newQuotation', label: 'New Quotation', href: '/quotations/new', icon: FilePlus2 },
    companies: { key: 'companies', label: 'Companies', href: '/companies', icon: Building2 },
    priceLookup: { key: 'priceLookup', label: 'Price Lookup', href: '/price-lookup', icon: Search },
    calculator: { key: 'calculator', label: 'Calculator', href: '/calculator', icon: Calculator },
    systemHealth: { key: 'systemHealth', label: 'System Health', href: '/system-health', icon: Activity },
    settings: { key: 'settings', label: 'Settings', href: '/settings', icon: Settings },
};

/** Desktop sidebar / tablet sheet (handoff §4). "Back to DNC Workspace" is
    rendered separately because its URL comes from a shared prop. */
export const DESKTOP_NAV: NavSection[] = [
    { key: 'overview', title: null, items: [NAV.home!] },
    { key: 'quotations', title: 'Quotations', items: [NAV.quotations!, NAV.newQuotation!] },
    { key: 'customers', title: 'Customers', items: [NAV.companies!, NAV.priceLookup!] },
    { key: 'tools', title: 'Tools', items: [NAV.calculator!] },
    { key: 'system', title: 'System', items: [NAV.systemHealth!, NAV.settings!] },
];

export const WORKSPACE_LABEL = 'Back to DNC Workspace';

/** Phone bottom navigation: Home | Quotes | + | Companies | More (handoff §8). */
export type BottomNavKey = 'home' | 'quotes' | 'plus' | 'companies' | 'more';
export const BOTTOM_NAV: { key: BottomNavKey; label: string; href?: string }[] = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'quotes', label: 'Quotes', href: '/quotations' },
    { key: 'plus', label: 'Create' },
    { key: 'companies', label: 'Companies', href: '/companies' },
    { key: 'more', label: 'More' },
];

/** Centre "+" sheet (handoff §8). Quick Add / Manual Add open the New
    Quotation route with a mode; the real flows arrive in later waves. */
export const PLUS_ACTIONS: NavItem[] = [
    { key: 'newQuotation', label: 'New Quotation', href: '/quotations/new', icon: FilePlus2 },
    { key: 'quickAdd', label: 'Quick Add', href: '/quotations/new?mode=quick', icon: Zap },
    { key: 'manualAdd', label: 'Manual Add', href: '/quotations/new?mode=manual', icon: PencilLine },
];

/** "More" sheet routed items. DNC Workspace / Language / Sign Out are
    rendered by the sheet itself (they depend on shared props). */
export const MORE_LINKS: NavItem[] = [NAV.priceLookup!, NAV.calculator!, NAV.systemHealth!, NAV.settings!];
export const MORE_EXTRA_LABELS = ['DNC Workspace', 'Language', 'Sign Out'] as const;

/** Frequently Used Products on Home (handoff §8). Keys are the legacy product
    type keys (fixtures/golden) so the builder can read `?product=` later. */
export const FREQUENT_PRODUCTS: { key: string; label: string }[] = [
    { key: 'sagrod', label: 'Sag Rod' },
    { key: 'lbolt', label: 'L Bolt' },
    { key: 'ubolt', label: 'U-Bolt' },
    { key: 'stud', label: 'Stud' },
    { key: 'jbolt', label: 'J Bolt' },
    { key: 'anchorbolt', label: 'Anchor Bolt' },
];

export function productHref(key: string): string {
    return `/quotations/new?product=${encodeURIComponent(key)}`;
}

/** Retired from normal navigation (handoff §4 / §29). A test asserts none of
    these labels appears in any navigation list above. */
export const RETIRED_NAV_LABELS = ['Default Prices', 'Diameter Settings', 'Pricing Guide', 'Version Updates'] as const;

/** Every label any shell navigation surface can show. */
export function allNavLabels(): string[] {
    return [
        ...DESKTOP_NAV.flatMap((s) => [...(s.title ? [s.title] : []), ...s.items.map((i) => i.label)]),
        WORKSPACE_LABEL,
        ...BOTTOM_NAV.map((i) => i.label),
        ...PLUS_ACTIONS.map((i) => i.label),
        ...MORE_LINKS.map((i) => i.label),
        ...MORE_EXTRA_LABELS,
    ];
}

/** Path part of an Inertia `page.url` (drops query and hash). */
export function pathOf(url: string): string {
    const p = url.split(/[?#]/, 1)[0] || '/';
    return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/** The single href that should show as selected for `url`: the longest
    candidate that equals the path or is a parent segment of it. '/' only
    matches Home itself, so Home is never selected on another page. */
export function activeHref(url: string, hrefs: string[]): string | null {
    const path = pathOf(url);
    let best: string | null = null;
    for (const raw of hrefs) {
        const href = pathOf(raw);
        const match = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
        if (match && (best === null || href.length > best.length)) best = href;
    }
    return best;
}

/** Only http(s) workspace URLs are rendered as links. */
export function safeExternalUrl(url: unknown): string | null {
    if (typeof url !== 'string' || url.trim() === '') return null;
    try {
        const u = new URL(url);
        return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
    } catch {
        return null;
    }
}
