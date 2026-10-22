import { expect, test, type Page } from '@playwright/test';
import { requireAuthDb, signIn } from './support/auth';

/* Wave 2 · Session E — Quotation Builder on the built app (throwaway fixture
   + e2e test user). Local drafts live in the browser context, so every test
   starts clean. Formal save / Print / WhatsApp / Copy are later sessions and
   must be shown locked, never faked. */

async function openBuilder(page: Page, path = '/quotations/new') {
    requireAuthDb();
    test.skip(!process.env.E2E_LEGACY_SEEDED, 'needs the seeded legacy fixture');
    await signIn(page, path);
    if (!page.url().includes('/quotations/new')) await page.goto(path);
    await expect(page.getByTestId('builder')).toBeVisible();
}

async function expectNoHorizontalScroll(page: Page) {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(scrollWidth, 'page must not scroll sideways').toBeLessThanOrEqual(clientWidth);
}

async function pickCustomer(page: Page, q = 'acme') {
    await page.locator('#customer').fill(q);
    await page.getByRole('option', { name: /ACME ENGINEERING/ }).click();
    await expect(page.getByTestId('customer-card')).toContainText('ACME ENGINEERING SDN BHD');
}

async function quickAddSagRods(page: Page) {
    await page.getByTestId('open-quick-add').click();
    const sheet = page.getByTestId('quick-add');
    await expect(sheet).toBeVisible();
    await sheet.getByLabel('Row 1 size').fill('M12');
    await sheet.getByLabel('Row 1 L').fill('1245');
    await sheet.getByLabel('Row 1 TL').fill('100');
    await sheet.getByLabel('Row 1 Qty').fill('30');
    await sheet.getByLabel('Row 2 size').fill('12');
    await sheet.getByLabel('Row 2 L').fill('310');
    await sheet.getByLabel('Row 2 TL').fill('100');
    await sheet.getByLabel('Row 2 Qty').fill('2');
    await expect(sheet.getByTestId('qa-status')).toHaveText('2 rows ready');
    await sheet.getByTestId('qa-submit').click();
    await expect(sheet).toBeHidden();
}

test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop', 'desktop only'));

    test('draft header, Prepared By preview, locked save and output actions', async ({ page }) => {
        await openBuilder(page);
        await expect(page.getByTestId('draft-badge')).toHaveText('Draft · Not saved');
        await expect(page.getByTestId('quotation-no')).toHaveText('Draft · Not saved');
        await expect(page.getByTestId('prepared-by')).toHaveText('E2E Tester');
        await expect(page.locator('#quoteDate')).toHaveValue(/^\d{2}-\d{2}-\d{4}$/);
        await expect(page.getByTestId('save-quotation')).toBeDisabled();
        for (const id of ['output-print', 'output-whatsapp', 'output-copy', 'output-copy-weight']) {
            await expect(page.getByTestId(id)).toBeDisabled();
        }
        await expect(page.getByTestId('builder-empty')).toBeVisible();
    });

    test('customer search selects from the directory and can be changed', async ({ page }) => {
        await openBuilder(page);
        await page.locator('#customer').fill('bsw9');
        await expect(page.getByRole('option', { name: /BINA STEEL WORKS/ })).toBeVisible();
        await expect(page.getByRole('listbox')).not.toContainText('BSW9');
        await page.locator('#customer').fill('acme');
        await page.getByRole('option', { name: /ACME ENGINEERING/ }).click();
        await expect(page.getByTestId('customer-card')).toContainText('LOT 1, JALAN KLANG LAMA');
        await expect(page.locator('#phone')).toHaveValue('012-345 6789');
        await page.getByTestId('customer-change').click();
        await expect(page.locator('#customer')).toHaveValue('');
        await page.locator('#customer').fill('NEW WALK-IN CO');
        await expect(page.getByRole('listbox')).toContainText('will be used as typed');
    });

    test('Quick Add rows become items: canonical TL, weight, price, totals', async ({ page }) => {
        await openBuilder(page);
        await pickCustomer(page);
        await quickAddSagRods(page);
        const rows = page.getByTestId('builder-item');
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(0).getByTestId('builder-item-title')).toHaveText('MS FULLSIZE SAG ROD · PL');
        await expect(rows.nth(0).getByTestId('builder-item-dims')).toHaveText('M12 × L1245 × TL100/100');
        await expect(rows.nth(1).getByTestId('builder-item-dims')).toHaveText('M12 × L310 × TL100/100');
        await expect(rows.nth(0).getByTestId('builder-item-qty')).toHaveText('Qty 30');
        await expect(rows.nth(0).getByTestId('builder-item-weight')).toHaveText('Weight 33.160 kg');
        await expect(rows.nth(0).getByTestId('builder-item-unit')).toHaveText('Unit RM 4.47');
        await expect(rows.nth(0).getByTestId('builder-item-total')).toHaveText('Total RM 134.10');
        await expect(page.getByTestId('summary-items')).toHaveText('2');
        await expect(page.getByTestId('summary-total')).toHaveText('RM 137.22');
        // no invented unit of measure
        await expect(page.getByTestId('builder-items')).not.toContainText(/\d\s*(pcs?|sets?|lots?)\b/i);
    });

    test('Manual Add: hardened 4140 QT L Bolt, accessories 0 vs default, markup', async ({ page }) => {
        await openBuilder(page);
        await page.getByTestId('open-manual-add').click();
        const ed = page.getByTestId('item-editor');
        await ed.locator('#ed-product').selectOption('lbolt');
        await ed.locator('#ed-material').selectOption('4140 QT');
        await ed.locator('#ed-treatment').check();
        await ed.getByTestId('ed-propertyClass').selectOption('10.9');
        await ed.locator('#ed-size').fill('M20');
        await ed.locator('#ed-l').fill('900');
        await ed.locator('#ed-w').fill('70');
        await ed.locator('#ed-threadLen').fill('150');
        await ed.locator('#ed-qty').fill('30');
        await ed.getByRole('button', { name: 'Nut', exact: true }).click();
        await ed.locator('#ed-nut-qty').fill('0');
        await ed.getByRole('button', { name: 'Flat washer' }).click();
        await ed.locator('#ed-fw-finish').selectOption('ZP');
        // no default rate for this identity: the cost rate is required, never invented
        await ed.getByTestId('ed-submit').click();
        await expect(ed.getByTestId('error-ed-costRate')).toContainText('No default rate');
        await ed.locator('#ed-costRate').fill('8.50');
        await ed.locator('#ed-markup').fill('5');
        await expect(ed.getByTestId('ed-title')).toHaveText('4140 QT FULLSIZE L BOLT · HARDENED TO G10.9 · PL');
        await expect(ed.getByTestId('ed-preview-markup')).toHaveText('+5%');
        await ed.getByTestId('ed-submit').click();
        await expect(ed).toBeHidden();
        const row = page.getByTestId('builder-item').first();
        await expect(row.getByTestId('builder-item-dims')).toHaveText('M20 × L900 × W70 × TL150');
        // explicit Nut 0 adds nothing; blank FW qty takes the default 1
        await expect(row.getByTestId('builder-item-accessories')).toHaveText('+ 1 FW ZP');
        await expect(row.getByTestId('builder-item-markup')).toHaveText('⭐ +5%');
        await expect(row.getByTestId('builder-item-weight')).toHaveText('Weight 69.546 kg');
    });

    test('manual price override is explicit and marked, and can go back to calculated', async ({ page }) => {
        await openBuilder(page);
        await quickAddSagRods(page);
        await page.getByTestId('builder-item').first().getByTestId('builder-item-title').click();
        const ed = page.getByTestId('item-editor');
        await ed.getByTestId('ed-set-manual').click();
        await expect(page.getByText('Manual price enabled')).toBeVisible();
        await expect(ed.getByTestId('ed-price-mode')).toHaveText('Manual override');
        await ed.locator('#ed-manualUnitPrice').fill('5.20');
        await ed.getByTestId('ed-submit').click();
        const row = page.getByTestId('builder-item').first();
        await expect(row.getByTestId('builder-item-markup')).toHaveText('Manual');
        await expect(row.getByTestId('builder-item-unit')).toHaveText('Unit RM 5.20');
        await expect(row.getByTestId('builder-item-total')).toHaveText('Total RM 156.00');
        await row.getByTestId('builder-item-title').click();
        await ed.getByRole('button', { name: 'Use calculated price' }).click();
        await expect(ed.getByTestId('ed-price-mode')).toHaveText('Calculated');
        await ed.getByTestId('ed-submit').click();
        await expect(row.getByTestId('builder-item-unit')).toHaveText('Unit RM 4.47');
    });

    test('validation stays next to the field; nothing incomplete is added', async ({ page }) => {
        await openBuilder(page);
        await page.getByTestId('open-manual-add').click();
        const ed = page.getByTestId('item-editor');
        await ed.getByTestId('ed-submit').click();
        await expect(page.getByText(/Fix \d+ fields? before adding/)).toBeVisible();
        await expect(ed.getByTestId('error-ed-size')).toHaveText('Enter a size');
        await expect(ed.getByTestId('error-ed-length')).toHaveText('Enter L');
        await expect(ed.getByTestId('error-ed-qty')).toHaveText('Enter Qty');
        await ed.locator('#ed-size').fill('72');
        await expect(ed.getByTestId('error-ed-size')).toContainText('looks like a length');
        await ed.locator('#ed-qty').fill('-5');
        await expect(ed.getByTestId('error-ed-qty')).toHaveText('Qty cannot be negative');
        await ed.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByTestId('builder-item')).toHaveCount(0);
        // quotation-level check: customer missing + no items
        await page.getByTestId('check-quotation').click();
        await expect(page.getByText(/Not ready yet/)).toBeVisible();
        await expect(page.getByTestId('error-customer')).toBeVisible();
    });

    test('duplicate, move and remove with Undo keep numbering understandable', async ({ page }) => {
        await openBuilder(page);
        await quickAddSagRods(page);
        const rows = page.getByTestId('builder-item');
        await rows.nth(0).getByTestId('builder-item-menu').click();
        await page.getByRole('menuitem', { name: 'Duplicate' }).click();
        await expect(page.getByText('Item 1 duplicated as item 2')).toBeVisible();
        await expect(rows).toHaveCount(3);
        await expect(page.getByTestId('builder-item-number')).toHaveText(['1', '2', '3']);
        await expect(rows.nth(1).getByTestId('builder-item-dims')).toHaveText('M12 × L1245 × TL100/100');
        await rows.nth(2).getByTestId('builder-item-menu').click();
        await page.getByRole('menuitem', { name: 'Move up' }).click();
        await expect(rows.nth(1).getByTestId('builder-item-dims')).toHaveText('M12 × L310 × TL100/100');
        await rows.nth(0).getByTestId('builder-item-menu').click();
        await page.getByRole('menuitem', { name: 'Remove' }).click();
        await expect(rows).toHaveCount(2);
        await page.getByRole('button', { name: 'Undo' }).click();
        await expect(rows).toHaveCount(3);
        await expect(page.getByText('Item 1 restored')).toBeVisible();
    });

    test('local draft: autosaved, recovered explicitly after reload, discard needs confirmation', async ({ page }) => {
        await openBuilder(page);
        await pickCustomer(page);
        await quickAddSagRods(page);
        await expect(page.getByTestId('draft-status')).toHaveAttribute('data-state', 'saved');
        await expect(page.getByTestId('draft-status')).toContainText('Kept on this device');
        page.once('dialog', (d) => d.accept()); // browser refresh warning may appear
        await page.reload();
        await expect(page.getByTestId('draft-recovered-summary')).toContainText('ACME ENGINEERING SDN BHD · 2 items');
        // nothing is applied until the person chooses, and nothing new overwrites the stored draft
        await expect(page.getByTestId('builder-item')).toHaveCount(0);
        await page.locator('#contact').fill('typed before choosing');
        await expect(page.getByTestId('draft-status')).toHaveAttribute('data-state', 'paused');
        await page.getByTestId('draft-continue').click();
        await expect(page.getByText('Draft recovered')).toBeVisible();
        await expect(page.getByTestId('builder-item')).toHaveCount(2);
        await expect(page.getByTestId('customer-card')).toContainText('ACME ENGINEERING SDN BHD');
        // discard asks first; dismissing keeps everything
        page.once('dialog', (d) => d.dismiss());
        await page.getByTestId('discard-draft').click();
        await expect(page.getByTestId('builder-item')).toHaveCount(2);
        page.once('dialog', (d) => d.accept());
        await page.getByTestId('discard-draft').click();
        await expect(page.getByTestId('builder-item')).toHaveCount(0);
        await page.reload();
        await expect(page.getByTestId('draft-recovered-summary')).toHaveCount(0);
    });

    test('leaving with unsaved entries asks first; nothing entered means no warning', async ({ page }) => {
        await openBuilder(page);
        const nav = page.getByTestId('sidebar').getByRole('navigation', { name: 'Main navigation' });
        // nothing meaningful: leaves without a prompt
        await nav.getByRole('link', { name: 'Quotations', exact: true }).click();
        await expect(page).toHaveURL(/\/quotations$/);
        await page.goto('/quotations/new');
        await page.locator('#customer').fill('SOMEONE');
        let asked = '';
        page.once('dialog', (d) => {
            asked = d.message();
            void d.dismiss();
        });
        await nav.getByRole('link', { name: 'Quotations', exact: true }).click();
        await expect.poll(() => asked).toContain('not saved yet');
        await expect(page).toHaveURL(/\/quotations\/new/);
    });

    test('dates are entered and shown day-first', async ({ page }) => {
        await openBuilder(page);
        await page.locator('#validUntil').fill('31/12/2026');
        await page.locator('#validUntil').press('Tab');
        await expect(page.locator('#validUntil')).toHaveValue('31-12-2026');
        await page.locator('#validUntil').fill('12/31/2026');
        await page.locator('#validUntil').press('Tab');
        await expect(page.getByTestId('error-validUntil')).toHaveText('Use DD-MM-YYYY');
    });

    test('entry points: ?product opens Quick Add on that product, ?mode=manual opens Manual Add', async ({ page }) => {
        await openBuilder(page, '/quotations/new?product=lbolt');
        await expect(page.getByTestId('quick-add')).toBeVisible();
        await expect(page.getByTestId('quick-add').locator('#qa-product')).toHaveValue('lbolt');
        await page.goto('/quotations/new?mode=manual');
        await expect(page.getByTestId('item-editor')).toBeVisible();
    });
});

test.describe('tablet (768px)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });
    test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop', 'run once, in the desktop project'));

    test('same workflow in a narrower width, aligned item grid, no overflow', async ({ page }) => {
        await openBuilder(page);
        await pickCustomer(page);
        await quickAddSagRods(page);
        await expect(page.getByTestId('builder-items').getByRole('columnheader', { name: 'Total' })).toBeVisible();
        const totals = await page.getByTestId('builder-item-total').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().right)));
        expect(new Set(totals).size).toBe(1);
        await expectNoHorizontalScroll(page);
        await page.getByTestId('open-manual-add').click();
        await expectNoHorizontalScroll(page);
    });
});

test.describe('phone', () => {
    test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'phone', 'phone only'));

    for (const width of [393, 360]) {
        test(`stacked builder, full-screen tasks, sticky summary above the bottom nav (${width}px)`, async ({ page }) => {
            await page.setViewportSize({ width, height: 852 });
            await openBuilder(page);
            await pickCustomer(page);
            await expectNoHorizontalScroll(page);
            await quickAddSagRods(page);
            await expect(page.getByTestId('builder-items').getByRole('columnheader', { name: 'Total' })).toBeHidden();
            await expect(page.getByTestId('builder-item')).toHaveCount(2);
            await expectNoHorizontalScroll(page);
            const sticky = (await page.getByTestId('builder-sticky').boundingBox())!;
            const nav = (await page.getByTestId('bottom-nav').boundingBox())!;
            expect(sticky.y + sticky.height).toBeLessThanOrEqual(nav.y + 1);
            await expect(page.getByTestId('builder-sticky')).toContainText('2 items');
            await page.getByTestId('open-manual-add').click();
            const ed = (await page.getByTestId('item-editor').boundingBox())!;
            expect(Math.round(ed.width)).toBe(width);
            await expectNoHorizontalScroll(page);
        });
    }

    test('the centre + sheet opens Quick Add in the builder', async ({ page }) => {
        requireAuthDb();
        await signIn(page);
        await page.getByTestId('bottom-nav').getByRole('button', { name: /^Create/ }).click();
        await page.getByRole('dialog', { name: 'Create' }).getByRole('link', { name: 'Quick Add' }).click();
        await expect(page.getByTestId('quick-add')).toBeVisible();
    });
});
