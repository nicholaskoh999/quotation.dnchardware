import { expect, test, type Page } from '@playwright/test';
import { signIn } from './support/auth';

/* Wave 1 · Session D — legacy READ pages.
   Default run (CI): no legacy database configured → every page shows the
   honest "Data source not connected" state, never an error page.
   Seeded run (E2E_LEGACY_SEEDED=1, see tests/e2e/support/legacy-fixture.php):
   the same pages over the throwaway fixture schema. */

const seeded = !!process.env.E2E_LEGACY_SEEDED;

async function noHorizontalScroll(page: Page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('without a legacy database', () => {
    /* W1 integration: the e2e server now always has the seeded throwaway
       schema (global-setup), so this leg only runs where no local MySQL
       exists — and then sign-in cannot work either. The "not connected" and
       "not reachable" states stay covered by Pest (ReadPagesTest). */
    test.skip(true, 'covered by Pest ReadPagesTest; the e2e server is always seeded or sign-in-less');

    for (const url of ['/companies', '/companies/1', '/quotations', '/quotations/1']) {
        test(`${url} says the data source is not connected`, async ({ page }) => {
            const res = await page.goto(url);
            expect(res?.status()).toBe(200);
            await expect(page.getByTestId('data-source-notice')).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Data source not connected' })).toBeVisible();
            await noHorizontalScroll(page);
        });
    }
});

test.describe('with the seeded legacy fixture', () => {
    test.skip(!seeded, 'set E2E_LEGACY_SEEDED=1 with a seeded LEGACY_DB_* to run');
    // W1 integration: the read pages are behind sign-in (Session C).
    test.beforeEach(async ({ page }) => signIn(page));

    test('directory → search by hidden alias → profile → quotation detail', async ({ page, isMobile }) => {
        await page.goto('/companies');
        const list = page.getByTestId(isMobile ? 'company-cards' : 'company-table');
        await expect(list).toBeVisible();
        await expect(list.getByText('ACME ENGINEERING SDN BHD')).toBeVisible();
        await expect(page.getByText('BSW9')).toHaveCount(0);
        await noHorizontalScroll(page);

        await page.getByLabel('Search companies').fill('bsw9');
        await page.getByRole('button', { name: 'Search' }).click();
        await expect(page).toHaveURL(/q=bsw9/);
        await expect(list.getByText('BINA STEEL WORKS')).toBeVisible();
        await expect(list.getByText('ACME ENGINEERING SDN BHD')).toHaveCount(0);

        await list.getByText('BINA STEEL WORKS').click();
        await expect(page.getByRole('heading', { name: 'BINA STEEL WORKS' })).toBeVisible();
        await page.getByRole('tab', { name: 'Quotations' }).click();
        await page.getByTestId(isMobile ? 'quotation-cards' : 'quotation-table').getByText('Q-2026-0005').click();

        await expect(page.getByRole('heading', { name: 'Q-2026-0005' })).toBeVisible();
        await expect(page.getByTestId('item-unreadable')).toHaveCount(2);
        await expect(page.getByTestId('quotation-total')).toHaveText('RM 99.90');
        await noHorizontalScroll(page);
    });

    test('a saved quotation shows customer prices and no edit, delete or pricing recipe', async ({ page }) => {
        await page.goto('/quotations/101');
        await expect(page.getByTestId('item-unit-price')).toHaveText(['RM 2.50', 'RM 33.40']);
        await expect(page.getByTestId('quotation-total')).toHaveText('RM 158.60');
        await expect(page.getByTestId('revision-list')).toContainText('Nicholas Koh');
        await expect(page.getByRole('button', { name: /edit|delete|save/i })).toHaveCount(0);
        await expect(page.locator('body')).not.toContainText(/cost rate|markup/i);
        const html = await page.content();
        expect(html).not.toMatch(/costRate|formData|rawItems/);
    });

    test('malformed items are a calm notice, not an error page', async ({ page }) => {
        const res = await page.goto('/quotations/104');
        expect(res?.status()).toBe(200);
        await expect(page.getByTestId('items-unreadable')).toBeVisible();
        await expect(page.getByTestId('quotation-total')).toHaveText('RM 50.00');
    });
});
