import { expect, test, type Page } from '@playwright/test';
import { requireAuthDb, signIn } from './support/auth';

/* W1 Owner Smoke Loop #2 — Quotation List + Quotation Detail final display,
   on the built app over the seeded throwaway fixture:
   list = one compact row (Quotation · Date · Customer · Item Summary · Valid
   until · Total), tablet drops Valid until, phone = 3-line cards, Newest /
   Oldest sort; detail = Product + Size Type groups in plain text, original
   item numbers, dimensions · Qty (no UOM), accessories, Weight, price row
   with ⭐ markup / Manual, group Total Weight, item order toggle. */

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

async function expectNoRecipeOrUom(page: Page) {
    await expect(page.locator('body')).not.toContainText(/cost rate|additional cost/i);
    // no invented UOM: Qty is the bare stored number; no "30 pcs / 2 sets / 1 lot"
    // (product names such as WELDING ANCHOR SET are not units)
    for (const t of await page.getByTestId('item-qty').allTextContents()) expect(t.trim()).toMatch(/^(Qty )?(\d+|—)$/);
    await expect(page.locator('body')).not.toContainText(/\d\s*(pcs?|sets?|lots?|lengths?)\b/i);
    expect(await page.content()).not.toMatch(/costRate|addCost|formData|rawItems/);
}

test.describe('desktop', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'desktop only');
        await signedIn(page);
    });

    test('Quotations list: six compact columns, item summary, no Prepared By, newest / oldest', async ({ page }) => {
        await page.goto('/quotations');
        const table = page.getByTestId('quotation-table');
        await expect(table.getByRole('columnheader')).toHaveText(['Quotation', 'Date', 'Customer', 'Item Summary', 'Valid until', 'Total']);
        await expect(table.getByText(/prepared by/i)).toHaveCount(0);
        await expect(table).not.toContainText('Nicholas');

        const row = (ref: string) => table.getByTestId('quotation-row').filter({ hasText: ref });
        await expect(row('Q-2026-0001').getByTestId('item-summary-main')).toHaveText('MS UNDERSIZE SAG ROD · ZP');
        await expect(row('Q-2026-0001').getByTestId('item-summary-more')).toHaveText('+1 more');
        await expect(row('Q-2026-0002').getByTestId('item-summary-main')).toHaveText('S45C STUD · HARDENED TO G8.8 · PL');
        await expect(row('Q-2026-0005').getByTestId('item-summary-main')).toHaveText('4340 QT FULLSIZE ANCHOR BOLT · HDG');
        await expect(row('Q-2026-0005').getByTestId('item-summary-more')).toHaveText('+2 more');
        // "+N more" is secondary: muted, smaller, normal weight, spaced from the finish
        const more = row('Q-2026-0001').getByTestId('item-summary-more');
        const main = row('Q-2026-0001').getByTestId('item-summary-main');
        const style = await more.evaluate((el) => ({ size: parseFloat(getComputedStyle(el).fontSize), weight: Number(getComputedStyle(el).fontWeight), bg: getComputedStyle(el).backgroundColor }));
        const mainSize = await main.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(style.size).toBeLessThan(mainSize);
        expect(style.weight).toBeLessThanOrEqual(400);
        expect(style.bg).toBe('rgba(0, 0, 0, 0)');
        const gap = (await more.boundingBox())!.x - ((await main.boundingBox())!.x + (await main.boundingBox())!.width);
        expect(gap).toBeGreaterThanOrEqual(8);
        await expect(row('Q-2026-0004').getByTestId('item-summary')).toHaveText('—');
        await expect(table).not.toContainText(/× L|Weight|⭐/);

        // one line per row
        for (const box of await table.getByTestId('quotation-row').evaluateAll((rows) => rows.map((r) => r.getBoundingClientRect().height))) {
            expect(box).toBeLessThanOrEqual(48);
        }

        // newest first by default; oldest reverses the presentation only
        const refs = () => table.getByTestId('quotation-row').locator('td:first-child').allTextContents();
        const newest = await refs();
        // true chronological order by quotation date
        expect(newest).toEqual(['Q-2026-0004', 'Q-2026-0002', 'Q-2026-0003', 'Q-2026-0001', 'Q-2026-0005', 'Q-2025-0100']);
        await page.getByTestId('quotation-sort').getByText('Oldest first').click();
        await expect(page).toHaveURL(/sort=oldest/);
        await expect(table.getByTestId('quotation-row').first()).toContainText('Q-2025-0100');
        expect(await refs()).toEqual([...newest].reverse());
        await expectNoHorizontalScroll(page);
    });

    test('Company Quotations tab: same compact list, no Prepared By', async ({ page }) => {
        await page.goto('/companies/1');
        await page.getByRole('tab', { name: 'Quotations' }).click();
        const table = page.getByTestId('quotation-table');
        await expect(table.getByRole('columnheader')).toHaveText(['Quotation', 'Date', 'Item Summary', 'Valid until', 'Total']);
        await expect(table.getByTestId('quotation-row').filter({ hasText: 'Q-2026-0001' }).getByTestId('item-summary-main')).toHaveText('MS UNDERSIZE SAG ROD · ZP');
        await expect(table.getByTestId('quotation-row').filter({ hasText: 'Q-2026-0001' }).getByTestId('item-summary-more')).toHaveText('+1 more');
        await expect(table).not.toContainText(/prepared/i);
    });

    test('detail (multi-group): Product + Size Type groups, numbers kept, Qty, Weight, ⭐ markup', async ({ page }) => {
        await page.goto('/quotations/101');
        await expect(page.getByTestId('group-title')).toHaveText(['MS UNDERSIZE SAG ROD · ZP', '4140 QT FULLSIZE L BOLT · HDG']);
        const [sag, lbolt] = [page.getByTestId('item-group').nth(0), page.getByTestId('item-group').nth(1)];
        await expect(sag.getByTestId('group-meta')).toHaveText('1 item');
        await expect(sag.getByTestId('item-size')).toHaveText('M12 × L1000 × TL100/100');
        await expect(sag.getByTestId('item-qty')).toHaveText('Qty 10');
        await expect(sag.getByTestId('item-weight')).toHaveText('Weight 6.928 kg');
        await expect(sag.getByTestId('item-markup')).toHaveCount(0);
        await expect(lbolt.getByTestId('item-number')).toHaveText('2');
        await expect(lbolt.getByTestId('item-weight')).toHaveText('Weight 10.364 kg');
        await expect(lbolt.getByTestId('item-markup')).toHaveText('⭐ +20%');
        await expect(lbolt.getByTestId('item-accessories')).toContainText('+ ');
        // Loop #4 replaced the stacked rows with the aligned grid (owner-smoke-loop4.spec.ts).
        // single-item groups: no repeated Total Weight
        await expect(page.getByTestId('group-total-weight')).toHaveCount(0);
        await expect(page.getByTestId('quotation-total')).toHaveText('RM 158.60');
        await expect(page.getByTestId('item-chips')).toHaveCount(0);
        await expectNoRecipeOrUom(page);
    });

    test('detail (one group, mixed material): Manual label, group Total Weight, newest / oldest keeps numbers', async ({ page }) => {
        await page.goto('/quotations/102');
        await expect(page.getByTestId('group-title')).toHaveText(['STUD']);
        const g = page.getByTestId('item-group');
        await expect(g.getByTestId('group-meta')).toHaveText('2 items');
        await expect(g.getByTestId('item-identity')).toHaveText(['S45C · HARDENED TO G8.8 · PL', '4140 QT · HARDENED TO G10.9 · PL']);
        // Loop #3: #1 has no item-level markup (only a form copy) → no badge
        await expect(g.getByTestId('item-markup')).toHaveCount(0);
        await expect(g.getByTestId('item-manual')).toHaveText('Manual');
        await expect(g.getByTestId('group-total-weight-value')).toHaveText('9.468 kg');

        await expect(g.getByTestId('item-number')).toHaveText(['1', '2']);
        await page.getByTestId('item-order').getByText('Newest first').click();
        await expect(g.getByTestId('item-number')).toHaveText(['2', '1']);
        await page.getByTestId('item-order').getByText('Oldest first').click();
        await expect(g.getByTestId('item-number')).toHaveText(['1', '2']);
        await expectNoRecipeOrUom(page);
    });

    test('detail: material differences do not split a Product + Size Type group', async ({ page }) => {
        await page.goto('/quotations/103');
        const fullsize = page.getByTestId('item-group').filter({ has: page.getByTestId('group-title').getByText('FULLSIZE SAG ROD', { exact: true }) });
        // mixed material: heading = Size Type + Product; rows carry material · finish
        await expect(fullsize.getByTestId('item-number')).toHaveText(['2', '7']);
        await expect(fullsize.getByTestId('item-identity')).toHaveText(['MS · PL', 'Y BAR · PL']);
        const undersize = page.getByTestId('item-group').filter({ has: page.getByTestId('group-title').getByText('MS UNDERSIZE SAG ROD · ZP', { exact: true }) });
        expect(await undersize.getByTestId('item-number').allTextContents()).toContain('5');
        await expectNoHorizontalScroll(page);
    });
});

test.describe('tablet (768px)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'run once, in the desktop project');
        await signedIn(page);
    });

    test('list drops Valid until, rows stay one line; detail groups without overflow', async ({ page }) => {
        await page.goto('/quotations');
        const table = page.getByTestId('quotation-table');
        await expect(table.getByRole('columnheader')).toHaveText(['Quotation', 'Date', 'Customer', 'Item Summary', 'Total']);
        for (const h of await table.getByTestId('quotation-row').evaluateAll((rows) => rows.map((r) => r.getBoundingClientRect().height))) {
            expect(h, 'no wrapped customer / summary').toBeLessThanOrEqual(48);
        }
        await expectNoHorizontalScroll(page);

        for (const id of [101, 102, 103]) {
            await page.goto(`/quotations/${id}`);
            await expect(page.getByTestId('item-group').first()).toBeVisible();
            await expectNoHorizontalScroll(page);
        }
    });
});

test.describe('phone', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'phone', 'phone only');
        await signedIn(page);
    });

    for (const width of [393, 360]) {
        test(`list cards stay compact and detail keeps the price hierarchy (${width}px)`, async ({ page }) => {
            await page.setViewportSize({ width, height: 852 });
            await page.goto('/quotations');
            const cards = page.getByTestId('quotation-cards');
            await expect(cards).toBeVisible();
            const card = cards.getByTestId('quotation-card').filter({ hasText: 'Q-2026-0001' });
            await expect(card.getByTestId('item-summary-main')).toHaveText('MS UNDERSIZE SAG ROD · ZP');
            await expect(card.getByTestId('item-summary-more')).toHaveText('+1 more');
            await expect(card).not.toContainText(/Nicholas|×|Weight/);
            for (const h of await cards.getByTestId('quotation-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
                expect(h, 'compact: ~3 lines, +N more may wrap').toBeLessThanOrEqual(120);
            }
            await expectNoHorizontalScroll(page);

            await page.goto('/quotations/101');
            await expect(page.getByTestId('item-row').first()).toBeVisible();
            await expect(page.getByTestId('bottom-nav')).toBeVisible();
            await expectNoRecipeOrUom(page);
            await expectNoHorizontalScroll(page);

            await page.goto('/quotations/103');
            await expect(page.getByTestId('item-group').first()).toBeVisible();
            await expectNoHorizontalScroll(page);
        });
    }
});
