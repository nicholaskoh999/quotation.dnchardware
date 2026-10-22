import { expect, test, type Page } from '@playwright/test';
import { requireAuthDb, signIn } from './support/auth';

/* W1 Owner Smoke Loop #1 — the consolidated owner feedback, checked on the
   built app over the seeded throwaway fixture: wider desktop layout, Overview
   hierarchy, Companies directory / profile, quotation detail (title + chips,
   canonical dimensions, compact Issued By, "Quotation Total"), tablet and
   phone without regressions or sideways scroll. */

async function signedIn(page: Page) {
    requireAuthDb();
    test.skip(!process.env.E2E_LEGACY_SEEDED, 'needs the seeded legacy fixture');
    await signIn(page);
}

async function expectNoHorizontalScroll(page: Page) {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, 'page must not scroll sideways').toBeLessThanOrEqual(clientWidth);
}

/** Width of the main column's content box (main minus its side padding). */
async function contentWidth(page: Page): Promise<number> {
    return page.getByTestId('main').evaluate((el) => {
        const cs = getComputedStyle(el);
        return el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    });
}

async function expectNoCostLeak(page: Page) {
    await expect(page.locator('body')).not.toContainText(/cost rate|additional cost|markup/i);
    expect(await page.content()).not.toMatch(/costRate|addCost|formData|rawItems/);
}

test.describe('desktop', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'desktop only');
        await signedIn(page);
    });

    test('wide screens get ~1200–1320px of content, not a narrow centred column', async ({ page }) => {
        await page.setViewportSize({ width: 1680, height: 1000 });
        for (const url of ['/', '/companies', '/companies/1', '/quotations', '/quotations/101']) {
            await page.goto(url);
            const w = await contentWidth(page);
            expect(w, `${url} content width`).toBeGreaterThanOrEqual(1200);
            expect(w, `${url} content width`).toBeLessThanOrEqual(1320);
            await expectNoHorizontalScroll(page);
        }
        // at 1440 the content simply fills what is left beside the sidebar
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        const sidebar = (await page.getByTestId('sidebar').boundingBox())!.width;
        expect(await contentWidth(page)).toBeGreaterThanOrEqual(1440 - sidebar - 2 * 32 - 2);
    });

    test('Overview: one primary New Quotation, table-like recent list, roomy side column', async ({ page }) => {
        await page.goto('/');
        const overview = page.getByTestId('desktop-overview');
        const primaries = overview.locator('a.bg-accent', { hasText: 'New Quotation' });
        await expect(primaries).toHaveCount(1);
        await expect(overview.getByTestId('draft-card').getByRole('link', { name: 'New Quotation' })).not.toHaveClass(/bg-accent/);

        const recent = overview.getByTestId('recent-quotations');
        await expect(recent.getByText('Customer', { exact: true })).toBeVisible();
        await expect(recent.getByTestId('recent-quotation-card').first()).toBeVisible();
        const recentBox = (await recent.boundingBox())!;
        const sideBox = (await overview.getByTestId('quick-actions').boundingBox())!;
        expect(sideBox.width, 'Draft / Quick Actions column is not compressed').toBeGreaterThanOrEqual(320);
        expect(recentBox.width).toBeGreaterThan(sideBox.width * 1.8);
        await expect(overview.getByTestId('frequent-products')).toBeVisible();
        const chip = (await overview.getByTestId('frequent-products').getByRole('link').first().boundingBox())!;
        expect(chip.height).toBeLessThanOrEqual(40);
    });

    test('Companies directory: table uses the width, no Short Code, no delete', async ({ page }) => {
        await page.goto('/companies');
        const table = page.getByTestId('company-table');
        await expect(table).toBeVisible();
        for (const h of ['Company', 'Phone', 'Quotations', 'Last quoted']) {
            await expect(table.getByRole('columnheader', { name: h })).toBeVisible();
        }
        await expect(page.getByText(/short code/i)).toHaveCount(0);
        await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);
        expect((await table.boundingBox())!.width).toBeGreaterThanOrEqual(1050);
    });

    test('Company profile: denser Overview, clear tabs, no Prepared By column', async ({ page }) => {
        await page.goto('/companies/1');
        await expect(page.getByRole('heading', { name: 'ACME ENGINEERING SDN BHD' })).toBeVisible();
        const overviewTab = page.getByRole('tab', { name: 'Overview' });
        await expect(overviewTab).toHaveAttribute('aria-selected', 'true');
        const weight = await overviewTab.evaluate((el) => Number(getComputedStyle(el).fontWeight));
        expect(weight).toBeGreaterThanOrEqual(600);

        const overview = page.getByTestId('company-overview');
        await expect(overview.getByText('Latest quotation', { exact: true })).toBeVisible();
        await expect(page.getByTestId('company-recent').getByRole('link').first()).toBeVisible();

        await page.getByRole('tab', { name: 'Quotations' }).click();
        const table = page.getByTestId('quotation-table');
        await expect(table).toBeVisible();
        await expect(table.getByRole('columnheader', { name: /prepared by/i })).toHaveCount(0);
        await expect(table.getByRole('columnheader', { name: 'Valid until' })).toBeVisible();

        await page.getByRole('tab', { name: 'Price History' }).click();
        await expect(page.getByText('Price history is coming soon')).toBeVisible();
        await expectNoHorizontalScroll(page);
    });

    test('Quotation detail: canonical dimensions, compact Issued By, Quotation Total', async ({ page }) => {
        // Loop #2 replaced the title + chips with plain-text Product + Size Type groups.
        await page.goto('/quotations/101');
        await expect(page.getByTestId('group-title').first()).toHaveText('UNDERSIZE SAG ROD');
        await expect(page.getByTestId('item-size').first()).toHaveText('M12 × L1000 × TL100/100');

        const issued = page.getByTestId('issued-by');
        await expect(issued).toHaveText('Not recorded');
        await expect(issued.getByRole('button', { name: 'Legacy quotation — issuer was not stored.' })).toBeVisible();
        await expect(page.locator('body')).not.toContainText(/server-side|legacy application/i);

        await expect(page.getByText('Quotation Total', { exact: true })).toBeVisible();
        await expect(page.getByText(/as saved/)).toHaveCount(0);
        await expect(page.getByTestId('quotation-total')).toHaveText('RM 158.60');
        await expectNoCostLeak(page);
    });
});

test.describe('tablet (768px)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'run once, in the desktop project');
        await signedIn(page);
    });

    test('nav sheet layout holds and no page scrolls sideways', async ({ page }) => {
        for (const url of ['/', '/companies', '/companies/1', '/quotations', '/quotations/101', '/quotations/102']) {
            await page.goto(url);
            await expect(page.getByTestId('sidebar')).toBeHidden();
            await expect(page.getByTestId('bottom-nav')).toBeHidden();
            await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
            await expectNoHorizontalScroll(page);
        }
        await page.goto('/quotations/101');
        await expect(page.getByTestId('item-size').first()).toHaveText('M12 × L1000 × TL100/100');
        await page.goto('/companies/1');
        await page.getByRole('tab', { name: 'Quotations' }).click();
        await expect(page.getByTestId('quotation-table')).toBeVisible();
        await expectNoHorizontalScroll(page);
    });
});

test.describe('phone (393px)', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'phone', 'phone only');
        await signedIn(page);
    });

    test('Home keeps the app layout; recent cards lead with the customer', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('phone-home')).toBeVisible();
        await expect(page.getByTestId('desktop-overview')).toBeHidden();
        const card = page.getByTestId('phone-home').getByTestId('recent-quotation-card').first();
        await expect(card).toBeVisible();
        const customerWeight = await card.getByTestId('recent-customer').evaluate((el) => Number(getComputedStyle(el).fontWeight));
        expect(customerWeight).toBeGreaterThanOrEqual(600);
        expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        const draft = (await page.getByTestId('phone-home').getByTestId('draft-card').boundingBox())!;
        expect(draft.height, 'empty draft card stays compact').toBeLessThanOrEqual(150);
        await expectNoHorizontalScroll(page);
    });

    test('bottom nav labels stay on one line, also at 360px', async ({ page }) => {
        for (const width of [393, 360]) {
            await page.setViewportSize({ width, height: 800 });
            await page.goto('/');
            const nav = page.getByTestId('bottom-nav');
            for (const label of ['Home', 'Quotes', 'Companies', 'More']) {
                const box = (await nav.getByText(label, { exact: true }).boundingBox())!;
                expect(box.height, `${label} at ${width}px`).toBeLessThanOrEqual(16);
            }
            await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
            await expectNoHorizontalScroll(page);
        }
    });

    test('Companies, Quotations and a quotation detail fit the phone width', async ({ page }) => {
        await page.goto('/companies');
        await expect(page.getByTestId('company-cards')).toBeVisible();
        await expectNoHorizontalScroll(page);
        await page.goto('/quotations');
        await expect(page.getByTestId('quotation-cards')).toBeVisible();
        await expectNoHorizontalScroll(page);
        await page.goto('/companies/1');
        await expect(page.getByTestId('company-overview')).toBeVisible();
        await expectNoHorizontalScroll(page);
        await page.goto('/quotations/101');
        await expect(page.getByTestId('item-size').first()).toHaveText('M12 × L1000 × TL100/100');
        await expect(page.getByTestId('issued-by')).toHaveText('Not recorded');
        await expectNoCostLeak(page);
        await expectNoHorizontalScroll(page);
    });
});
