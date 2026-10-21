import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { toasterPlacement } from '@/components/ui/sonner';
import { displayTotal } from '@/components/home/recent-quotations';
import { AppLogo } from './app-logo';
import { RETIRED_NAV_LABELS } from './nav-config';
import { SidebarNav } from './sidebar-nav';
import { initials, UserArea } from './user-area';

afterEach(cleanup);

describe('AppLogo', () => {
    it('renders a link to QUO Home', () => {
        render(<AppLogo />);
        const link = screen.getByRole('link', { name: 'DNC Quotation — Home' });
        expect(link.getAttribute('href')).toBe('/');
    });
});

describe('SidebarNav', () => {
    it('renders the locked items, marks the current page, and no retired item', () => {
        render(<SidebarNav currentUrl="/quotations/new?mode=manual" workspaceUrl={null} />);
        const nav = screen.getByRole('navigation', { name: 'Main navigation' });
        for (const label of ['Overview', 'Quotations', 'New Quotation', 'Companies', 'Price Lookup', 'Calculator', 'System Health', 'Settings']) {
            expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
        }
        expect(within(nav).getByRole('link', { name: 'New Quotation' }).getAttribute('aria-current')).toBe('page');
        expect(within(nav).getByRole('link', { name: 'Quotations' }).getAttribute('aria-current')).toBeNull();
        for (const retired of RETIRED_NAV_LABELS) {
            expect(within(nav).queryByText(retired)).toBeNull();
        }
    });

    it('disables Back to DNC Workspace without a workspace URL, links it when shared', () => {
        render(<SidebarNav currentUrl="/" workspaceUrl={null} />);
        expect(screen.queryByRole('link', { name: /Back to DNC Workspace/ })).toBeNull();
        expect(screen.getByTestId('workspace-link-disabled').getAttribute('aria-disabled')).toBe('true');
        cleanup();
        render(<SidebarNav currentUrl="/" workspaceUrl="https://workspace.example.com/" />);
        expect(screen.getByRole('link', { name: /Back to DNC Workspace/ }).getAttribute('href')).toBe('https://workspace.example.com/');
    });
});

describe('UserArea', () => {
    it('shows the named user when shared, a neutral placeholder otherwise', () => {
        render(<UserArea user={{ id: 1, username: 'nicholas', displayName: 'Nicholas Koh', source: 'app_users' }} />);
        expect(screen.getByText('Nicholas Koh')).toBeTruthy();
        expect(screen.getByText('@nicholas')).toBeTruthy();
        cleanup();
        render(<UserArea user={null} />);
        expect(screen.getByText('Not signed in')).toBeTruthy();
    });
    it('derives initials', () => {
        expect(initials('Nicholas Koh')).toBe('NK');
        expect(initials('alson')).toBe('AL');
    });
});

describe('feedback placement and display helpers', () => {
    it('puts phone toasts at the bottom (above the bottom nav), desktop top-right', () => {
        expect(toasterPlacement(false).position).toBe('top-right');
        const phone = toasterPlacement(true);
        expect(phone.position).toBe('bottom-center');
        expect(JSON.stringify(phone.mobileOffset)).toContain('--shell-bottom-nav-height');
    });
    it('shows a preformatted total verbatim and a number to 2 dp', () => {
        expect(displayTotal('RM 1,234.50')).toBe('RM 1,234.50');
        expect(displayTotal(1234.5)).toBe('1,234.50');
        expect(displayTotal(null)).toBeNull();
    });
});
