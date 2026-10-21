import { expect, test, type Page } from '@playwright/test';

/* App shell (Wave 1 Session A): handoff §4 navigation, §8 mobile shell,
   §9 responsive. Projects: desktop 1440 · phone 393 (playwright.config.ts). */

const SHELL_ROUTES = ['/', '/quotations', '/quotations/new', '/companies', '/price-lookup', '/calculator', '/system-health', '/settings'];
const DESKTOP_ITEMS = ['Overview', 'Quotations', 'New Quotation', 'Companies', 'Price Lookup', 'Calculator', 'System Health', 'Settings'];
const RETIRED = ['Default Prices', 'Diameter Settings', 'Pricing Guide', 'Version Updates'];

async function expectNoHorizontalScroll(page: Page) {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, 'page must not scroll sideways').toBeLessThanOrEqual(clientWidth);
}

test.describe('desktop shell', () => {
    test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop', 'desktop only'));

    test('sidebar shows the locked items and no retired item', async ({ page }) => {
        await page.goto('/');
        const sidebar = page.getByTestId('sidebar');
        await expect(sidebar).toBeVisible();
        const nav = sidebar.getByRole('navigation', { name: 'Main navigation' });
        for (const label of DESKTOP_ITEMS) {
            await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
        }
        for (const label of ['Quotations', 'Customers', 'Tools', 'System']) {
            await expect(nav.getByText(label, { exact: true }).first()).toBeVisible();
        }
        await expect(nav.getByText('Back to DNC Workspace')).toBeVisible();
        for (const label of RETIRED) {
            await expect(page.getByText(label)).toHaveCount(0);
        }
        await expect(page.getByTestId('bottom-nav')).toBeHidden();
        await expect(page.getByTestId('user-area').first()).toContainText('Not signed in');
    });

    test('sidebar navigates, marks the current page, and the logo returns Home', async ({ page }) => {
        await page.goto('/');
        const nav = page.getByTestId('sidebar').getByRole('navigation', { name: 'Main navigation' });
        await nav.getByRole('link', { name: 'Calculator', exact: true }).click();
        await expect(page).toHaveURL(/\/calculator$/);
        await expect(nav.getByRole('link', { name: 'Calculator', exact: true })).toHaveAttribute('aria-current', 'page');
        await expect(page.getByTestId('preview-notice')).toBeVisible();

        await page.getByTestId('sidebar').getByRole('link', { name: 'DNC Quotation — Home' }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    });

    test('desktop Overview: honest draft and recent-quotation states, no fake data', async ({ page }) => {
        await page.goto('/');
        const overview = page.getByTestId('desktop-overview');
        await expect(overview.getByTestId('draft-card')).toContainText('No draft');
        await expect(overview.getByTestId('recent-quotations')).toContainText('Not connected yet');
        await expect(overview.getByTestId('recent-quotation-card')).toHaveCount(0);
        await expect(page.getByTestId('phone-home')).toBeHidden();
    });

    test('every shell route renders inside the shell', async ({ page }) => {
        for (const path of SHELL_ROUTES) {
            const res = await page.goto(path);
            expect(res?.status(), path).toBe(200);
            await expect(page.getByTestId('sidebar')).toBeVisible();
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        }
    });
});

test.describe('tablet portrait (768px)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });
    test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop', 'run once, in the desktop project'));

    test('single main column, nav in a sheet, no sidebar and no bottom nav', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('sidebar')).toBeHidden();
        await expect(page.getByTestId('bottom-nav')).toBeHidden();
        await expect(page.getByTestId('desktop-overview')).toBeVisible();

        const overview = page.getByTestId('desktop-overview');
        const recent = await overview.getByTestId('recent-quotations').boundingBox();
        const draft = await overview.getByTestId('draft-card').boundingBox();
        expect(recent && draft).toBeTruthy();
        // stacked, same left edge and width = one column
        expect(Math.abs(recent!.x - draft!.x)).toBeLessThan(2);
        expect(Math.abs(recent!.width - draft!.width)).toBeLessThan(2);
        expect(draft!.y).toBeGreaterThan(recent!.y);
        await expectNoHorizontalScroll(page);

        await page.getByRole('button', { name: 'Open navigation' }).click();
        const sheet = page.getByTestId('nav-sheet');
        await expect(sheet).toBeVisible();
        await sheet.getByRole('link', { name: 'Companies', exact: true }).click();
        await expect(page).toHaveURL(/\/companies$/);
        await expect(sheet).toBeHidden();
    });
});

test.describe('phone shell (393px)', () => {
    test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'phone', 'phone only'));

    test('bottom nav is visible, sidebar is not', async ({ page }) => {
        await page.goto('/');
        const bottom = page.getByTestId('bottom-nav');
        await expect(bottom).toBeVisible();
        for (const label of ['Home', 'Quotes', 'Companies', 'More']) {
            await expect(bottom.getByText(label, { exact: true })).toBeVisible();
        }
        await expect(bottom.getByRole('button', { name: /^Create/ })).toBeVisible();
        await expect(page.getByTestId('sidebar')).toBeHidden();
        await expect(bottom.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    });

    test('+ opens a sheet with New Quotation, Quick Add, Manual Add', async ({ page }) => {
        await page.goto('/');
        await page.getByTestId('bottom-nav').getByRole('button', { name: /^Create/ }).click();
        const sheet = page.getByRole('dialog', { name: 'Create' });
        await expect(sheet).toBeVisible();
        const links = sheet.getByRole('link');
        await expect(links).toHaveText(['New Quotation', 'Quick Add', 'Manual Add']);
        await sheet.getByRole('link', { name: 'Quick Add' }).click();
        await expect(page).toHaveURL(/\/quotations\/new\?mode=quick$/);
        await expect(page.getByTestId('bottom-nav').getByRole('link', { name: 'Quotes' })).toHaveAttribute('aria-current', 'page');
    });

    test('More opens a sheet with its items; Sign Out is honestly disabled when signed out', async ({ page }) => {
        await page.goto('/');
        await page.getByTestId('bottom-nav').getByRole('button', { name: 'More' }).click();
        const sheet = page.getByRole('dialog', { name: 'More' });
        await expect(sheet).toBeVisible();
        for (const label of ['Price Lookup', 'Calculator', 'System Health', 'Settings']) {
            await expect(sheet.getByRole('link', { name: label })).toBeVisible();
        }
        for (const label of ['DNC Workspace', 'Language', 'Sign Out']) {
            await expect(sheet.getByText(label, { exact: true })).toBeVisible();
        }
        await expect(sheet.getByTestId('sign-out-disabled')).toHaveAttribute('aria-disabled', 'true');
        for (const label of RETIRED) {
            await expect(sheet.getByText(label)).toHaveCount(0);
        }
        await sheet.getByRole('link', { name: 'System Health' }).click();
        await expect(page).toHaveURL(/\/system-health$/);
        await expect(page.getByTestId('system-health-release')).toBeVisible();
    });

    test('Mobile Home v1 sections, honest states, and products link to New Quotation', async ({ page }) => {
        await page.goto('/');
        const home = page.getByTestId('phone-home');
        await expect(home).toBeVisible();
        await expect(page.getByTestId('desktop-overview')).toBeHidden();
        await expect(page.getByTestId('app-bar')).toContainText('DNC Quotation');
        await expect(page.getByTestId('app-bar')).toContainText('Not signed in');

        await expect(home.getByTestId('draft-card')).toContainText('No draft');
        const qa = home.getByTestId('quick-actions');
        for (const label of ['New Quotation', 'Quick Add', 'Companies', 'Price Lookup', 'Calculator']) {
            await expect(qa.getByRole('link', { name: label })).toBeVisible();
        }
        await expect(qa.getByTestId('internal-po-disabled')).toContainText('Coming later');
        await expect(home.getByTestId('recent-quotations')).toContainText('Not connected yet');
        for (const label of ['Sag Rod', 'L Bolt', 'U-Bolt', 'Stud', 'J Bolt', 'Anchor Bolt']) {
            await expect(home.getByTestId('frequent-products').getByRole('link', { name: label })).toBeVisible();
        }
        for (const label of [...RETIRED, 'Delete', 'KPI']) {
            await expect(home.getByText(label)).toHaveCount(0);
        }

        await home.getByTestId('frequent-products').getByRole('link', { name: 'Sag Rod' }).click();
        await expect(page).toHaveURL(/\/quotations\/new\?product=sagrod$/);
        await expect(page.getByText('Selected product:')).toBeVisible();
    });

    test('logo returns Home from another page', async ({ page }) => {
        await page.goto('/settings');
        await page.getByTestId('app-bar').getByRole('link', { name: 'DNC Quotation — Home' }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByTestId('phone-home')).toBeVisible();
    });

    test('no horizontal scroll on any shell route, content clears the bottom nav', async ({ page }) => {
        for (const path of SHELL_ROUTES) {
            await page.goto(path);
            await expect(page.getByTestId('bottom-nav')).toBeVisible();
            await expectNoHorizontalScroll(page);
        }
        await page.goto('/');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const lastSection = await page.getByTestId('phone-home').getByTestId('frequent-products').boundingBox();
        const nav = await page.getByTestId('bottom-nav').boundingBox();
        expect(lastSection!.y + lastSection!.height).toBeLessThanOrEqual(nav!.y);
    });
});

test('an unknown URL renders the safe error page inside the shell, with a way Home', async ({ page }) => {
    const res = await page.goto('/definitely-not-a-page');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('alert')).toContainText('Page not found');
    await expect(page.getByRole('link', { name: 'DNC Quotation — Home' }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Back to Home' }).click();
    await expect(page).toHaveURL(/\/$/);
});
