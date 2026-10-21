import { describe, expect, it } from 'vitest';
import {
    activeHref,
    allNavLabels,
    BOTTOM_NAV,
    DESKTOP_NAV,
    FREQUENT_PRODUCTS,
    MORE_EXTRA_LABELS,
    MORE_LINKS,
    PLUS_ACTIONS,
    productHref,
    RETIRED_NAV_LABELS,
    safeExternalUrl,
    SHELL_LOGO_HREF,
} from './nav-config';

describe('navigation config (handoff §4 / §8)', () => {
    it('logo always links to QUO Home', () => {
        expect(SHELL_LOGO_HREF).toBe('/');
    });

    it('desktop nav has exactly the locked sections and items, in order', () => {
        expect(DESKTOP_NAV.map((s) => [s.title, s.items.map((i) => i.label)])).toEqual([
            [null, ['Overview']],
            ['Quotations', ['Quotations', 'New Quotation']],
            ['Customers', ['Companies', 'Price Lookup']],
            ['Tools', ['Calculator']],
            ['System', ['System Health', 'Settings']],
        ]);
    });

    it('shows no retired item anywhere', () => {
        const labels = allNavLabels().map((l) => l.toLowerCase());
        for (const retired of RETIRED_NAV_LABELS) {
            expect(labels).not.toContain(retired.toLowerCase());
            expect(labels.some((l) => l.includes(retired.toLowerCase()))).toBe(false);
        }
        const hrefs = [...DESKTOP_NAV.flatMap((s) => s.items), ...PLUS_ACTIONS, ...MORE_LINKS].map((i) => i.href);
        expect(hrefs.some((h) => /default-price|diameter|pricing-guide|version/i.test(h))).toBe(false);
    });

    it('phone bottom nav is Home | Quotes | + | Companies | More', () => {
        expect(BOTTOM_NAV.map((i) => i.key)).toEqual(['home', 'quotes', 'plus', 'companies', 'more']);
        expect(BOTTOM_NAV[0]!.href).toBe('/');
    });

    it('+ sheet and More sheet carry the locked items', () => {
        expect(PLUS_ACTIONS.map((a) => a.label)).toEqual(['New Quotation', 'Quick Add', 'Manual Add']);
        expect([...MORE_LINKS.map((i) => i.label), ...MORE_EXTRA_LABELS]).toEqual([
            'Price Lookup',
            'Calculator',
            'System Health',
            'Settings',
            'DNC Workspace',
            'Language',
            'Sign Out',
        ]);
    });

    it('frequently used products use legacy keys and the New Quotation route', () => {
        expect(FREQUENT_PRODUCTS.map((p) => p.label)).toEqual(['Sag Rod', 'L Bolt', 'U-Bolt', 'Stud', 'J Bolt', 'Anchor Bolt']);
        expect(productHref('sagrod')).toBe('/quotations/new?product=sagrod');
    });
});

describe('activeHref', () => {
    const hrefs = ['/', '/quotations', '/quotations/new', '/companies'];
    it('selects Home only on Home', () => {
        expect(activeHref('/', hrefs)).toBe('/');
        expect(activeHref('/companies', hrefs)).toBe('/companies');
    });
    it('prefers the most specific match and ignores query strings', () => {
        expect(activeHref('/quotations/new?mode=quick', hrefs)).toBe('/quotations/new');
        expect(activeHref('/quotations/123', hrefs)).toBe('/quotations');
        expect(activeHref('/quotations/', hrefs)).toBe('/quotations');
    });
    it('does not match on a bare prefix', () => {
        expect(activeHref('/companies-archive', hrefs)).toBeNull();
    });
});

describe('safeExternalUrl', () => {
    it('accepts http(s) only', () => {
        expect(safeExternalUrl('https://workspace.example.com/')).toBe('https://workspace.example.com/');
        expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
        expect(safeExternalUrl('')).toBeNull();
        expect(safeExternalUrl(undefined)).toBeNull();
        expect(safeExternalUrl('/relative')).toBeNull();
    });
});
