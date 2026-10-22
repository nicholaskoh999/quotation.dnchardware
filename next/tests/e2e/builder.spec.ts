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

async function fillSagRod(page: Page, l: string, qty = '1') {
    const ed = page.getByTestId('item-editor');
    await ed.locator('#ed-size').fill('M12');
    await ed.locator('#ed-length').fill(l);
    await ed.locator('#ed-threadLen').fill('100');
    await ed.locator('#ed-qty').fill(qty);
}

const toast = (page: Page) => page.locator('[data-sonner-toast]').filter({ hasText: 'added to quotation' });

async function batchAddSagRods(page: Page) {
    await page.getByTestId('open-batch-add').click();
    const sheet = page.getByTestId('batch-add');
    await expect(sheet).toBeVisible();
    await sheet.getByLabel('Row 1 size').fill('M12');
    await sheet.getByLabel('Row 1 L').fill('1245');
    await sheet.getByLabel('Row 1 TL').fill('100');
    await sheet.getByLabel('Row 1 Qty').fill('30');
    await sheet.getByLabel('Row 2 size').fill('12');
    await sheet.getByLabel('Row 2 L').fill('310');
    await sheet.getByLabel('Row 2 TL').fill('100');
    await sheet.getByLabel('Row 2 Qty').fill('2');
    await expect(sheet.getByTestId('ba-status')).toHaveText('2 valid rows · Total RM 137.22');
    await sheet.getByTestId('ba-submit').click();
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

    test('Batch Add rows become items: canonical TL, weight, price, totals', async ({ page }) => {
        await openBuilder(page);
        await pickCustomer(page);
        await batchAddSagRods(page);
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
        await expect(ed.getByTestId('ed-preview-markup')).toHaveCount(0); // markup is in the rate field, not repeated
        await ed.getByTestId('ed-submit').click();
        await expect(ed).toBeHidden();
        const row = page.getByTestId('builder-item').first();
        await expect(row.getByTestId('builder-item-dims')).toHaveText('M20 × L900 × W70 × TL150');
        // explicit Nut 0 adds nothing; blank FW qty takes the default 1
        await expect(row.getByTestId('builder-item-accessories')).toHaveText('+ 1 FW ZP');
        await expect(row.getByTestId('builder-item-markup')).toHaveText('⭐ +5%');
        await expect(row.getByTestId('builder-item-weight')).toHaveText('Weight 69.546 kg');
    });

    test('Override unit price keeps the calculated unit; Use calculated price restores it', async ({ page }) => {
        await openBuilder(page);
        await batchAddSagRods(page);
        await page.getByTestId('builder-item').first().getByTestId('builder-item-title').click();
        const ed = page.getByTestId('item-editor');
        await expect(ed.getByTestId('ed-calculated-unit')).toHaveText('RM 4.47');
        await expect(ed.getByTestId('ed-override-none')).toHaveText('—');
        await expect(ed.getByTestId('ed-final-unit')).toHaveText('RM 4.47');
        await ed.getByTestId('ed-override-unit').click();
        await expect(page.getByText('Unit price overridden')).toBeVisible();
        await expect(ed.getByTestId('ed-price-mode')).toHaveText('Override');
        await ed.getByTestId('ed-override-input').fill('5.20');
        await expect(ed.getByTestId('ed-calculated-unit')).toHaveText('RM 4.47');
        await expect(ed.getByTestId('ed-final-unit')).toHaveText('RM 5.20');
        // the calculated unit keeps recalculating under the override (Bar Ø 12 → 13)
        await ed.locator('#ed-diameter').fill('13');
        await ed.locator('#ed-diameter').blur();
        await expect(ed.getByTestId('ed-calculated-unit')).not.toHaveText('RM 4.47');
        await expect(ed.getByTestId('ed-final-unit')).toHaveText('RM 5.20');
        await ed.locator('#ed-diameter').fill('');
        await ed.locator('#ed-diameter').blur();
        await expect(ed.locator('#ed-diameter')).toHaveValue('12');
        await ed.getByTestId('ed-submit').click();
        const row = page.getByTestId('builder-item').first();
        await expect(row.getByTestId('builder-item-markup')).toHaveText('Override');
        await expect(row.getByTestId('builder-item-unit')).toHaveText('Unit RM 5.20');
        await expect(row.getByTestId('builder-item-total')).toHaveText('Total RM 156.00');
        await row.getByTestId('builder-item-title').click();
        await ed.getByTestId('ed-use-calculated').click();
        await expect(ed.getByTestId('ed-final-unit')).toHaveText('RM 4.47');
        await ed.getByTestId('ed-submit').click();
        await expect(row.getByTestId('builder-item-unit')).toHaveText('Unit RM 4.47');
    });

    test('Bar Ø: suggested and always editable; custom 10.7 / 25 drive weight; developed length auto-fills 1063, custom 1070', async ({ page }) => {
        await openBuilder(page);
        await page.getByTestId('open-manual-add').click();
        const ed = page.getByTestId('item-editor');
        await expect(ed.locator('#ed-qty')).toHaveValue('1');
        await ed.getByRole('radio', { name: 'Undersize' }).click();
        await ed.locator('#ed-size').fill('M12');
        await ed.locator('#ed-length').fill('1000');
        await expect(ed.locator('#ed-diameter')).toHaveValue('10.6');
        await expect(ed.getByTestId('ed-diameter-state')).toHaveText('Suggested from M12 · Undersize');
        await expect(ed.getByTestId('ed-preview-weight')).toContainText('0.693 kg/pc');
        await ed.locator('#ed-diameter').fill('10.7');
        await ed.locator('#ed-diameter').blur();
        await expect(ed.locator('#ed-diameter')).toHaveValue('10.7');
        await expect(ed.getByTestId('ed-diameter-state')).toContainText('Custom');
        await expect(ed.getByTestId('ed-preview-weight')).toContainText('0.706 kg/pc');
        // L Bolt M24 on a Ø25 bar: developed length 1063 shown in the field
        await ed.locator('#ed-product').selectOption('lbolt');
        await ed.getByRole('radio', { name: 'Fullsize' }).click();
        await ed.locator('#ed-size').fill('M24');
        await ed.locator('#ed-l').fill('1000');
        await ed.locator('#ed-w').fill('100');
        await expect(ed.locator('#ed-diameter')).toHaveValue('24');
        await ed.locator('#ed-diameter').fill('25');
        await ed.locator('#ed-diameter').blur();
        await expect(ed.locator('#ed-developedLength')).toHaveValue('1063');
        await expect(ed.getByTestId('ed-preview-weight')).toContainText('4.096 kg/pc');
        await ed.locator('#ed-developedLength').fill('1070');
        await ed.locator('#ed-developedLength').blur();
        await expect(ed.getByTestId('ed-developedLength-state')).toContainText('Calculated: 1063 mm');
        await expect(ed.getByTestId('ed-preview-weight')).toContainText('4.123 kg/pc');
        await ed.getByTestId('ed-developedLength-use-calculated').click();
        await expect(ed.locator('#ed-developedLength')).toHaveValue('1063');
    });

    test('Quick Add is AI intake (text / image / PDF), never the Batch Add row editor', async ({ page }) => {
        await openBuilder(page);
        await expect(page.getByTestId('open-quick-add')).toContainText('AI extract from text, image or PDF');
        await expect(page.getByTestId('open-batch-add')).toContainText('Enter multiple similar items');
        await page.getByTestId('open-quick-add').click();
        const qa = page.getByTestId('quick-add');
        await expect(qa.getByRole('tab', { name: 'Paste Text' })).toBeVisible();
        await expect(qa.getByRole('tab', { name: 'Upload Image / PDF' })).toBeVisible();
        await expect(qa.getByTestId('qa-text')).toBeVisible();
        await expect(qa.getByLabel(/Row 1/)).toHaveCount(0);
        await qa.getByTestId('qa-text').fill('M12 sag rod 1245 tl100 zp 30pcs');
        await expect(qa.getByTestId('qa-analyze')).toBeDisabled();
        await expect(qa.getByTestId('qa-unavailable')).toContainText('Session I');
        await qa.getByTestId('qa-tab-file').click();
        await qa.getByTestId('qa-file').setInputFiles({ name: 'po.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
        await expect(qa.getByTestId('qa-file-name')).toContainText('po.pdf');
        await expect(qa.getByTestId('qa-analyze')).toBeDisabled();
        // nothing was added, nothing parsed
        await qa.getByTestId('qa-switch-batch').click();
        await expect(page.getByTestId('batch-add')).toBeVisible();
        await expect(page.getByTestId('builder-item')).toHaveCount(0);
    });

    test('desktop: Quick / Manual / Batch / Edit open as centred dialogs, not side drawers', async ({ page }) => {
        await openBuilder(page);
        const vw = page.viewportSize()!.width;
        for (const id of ['open-quick-add', 'open-manual-add', 'open-batch-add']) {
            await page.getByTestId(id).click();
            const dlg = page.getByRole('dialog');
            const b = (await dlg.boundingBox())!;
            expect(Math.abs(b.x + b.width / 2 - vw / 2), `${id} centred`).toBeLessThanOrEqual(2);
            expect(b.width).toBeLessThan(vw - 100);
            expect(b.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.86);
            await page.keyboard.press('Escape');
            await expect(dlg).toBeHidden();
        }
    });

    test('validation stays next to the field; nothing incomplete is added', async ({ page }) => {
        await openBuilder(page);
        await page.getByTestId('open-manual-add').click();
        const ed = page.getByTestId('item-editor');
        await ed.getByTestId('ed-submit').click();
        await expect(page.getByText(/Fix \d+ fields? before adding/)).toBeVisible();
        await expect(ed.getByTestId('error-ed-size')).toHaveText('Enter a size');
        await expect(ed.getByTestId('error-ed-length')).toHaveText('Enter L');
        await expect(ed.locator('#ed-qty')).toHaveValue('1'); // new items start at Qty 1
        await expect(ed.getByTestId('error-ed-qty')).toHaveCount(0);
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
        await batchAddSagRods(page);
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
        await batchAddSagRods(page);
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

    test('Manual Add continuous entry: Add & another keeps the dialog, toast with item number / spec / Qty / total, items append in order', async ({ page }) => {
        await openBuilder(page);
        await page.getByTestId('open-manual-add').click();
        const ed = page.getByTestId('item-editor');
        await expect(ed.getByTestId('ed-add-another')).toContainText('Add & another');
        await expect(ed.getByTestId('kbd-hint').first()).toBeVisible();
        await ed.getByRole('radio', { name: 'ZP' }).click();
        await ed.locator('#ed-costRate').fill('5.20');
        await fillSagRod(page, '1070');
        await ed.getByTestId('ed-add-another').click();
        await expect(toast(page)).toHaveCount(1);
        await expect(toast(page)).toContainText('Item #1 added to quotation');
        await expect(toast(page).locator('[data-description]')).toHaveText(/^M12 × L1070 × TL100\/100 · Qty 1 · RM \d+\.\d{2}$/);
        // still open, next number; context kept (finish, cost rate), per-item fields reset
        await expect(ed).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Manual Add · item 2' })).toBeVisible();
        await expect(ed.getByRole('radio', { name: 'ZP' })).toHaveAttribute('aria-checked', 'true');
        await expect(ed.locator('#ed-costRate')).toHaveValue('5.20');
        await expect(ed.locator('#ed-size')).toHaveValue('');
        await expect(ed.locator('#ed-length')).toHaveValue('');
        await expect(ed.locator('#ed-qty')).toHaveValue('1');
        await expect(ed.locator('#ed-size')).toBeFocused();
        await expect(ed.getByTestId('ed-context')).toHaveText(/^1 item · RM \d+\.\d{2}$/);
        // keyboard: Enter = Add & another
        await fillSagRod(page, '1245', '30');
        await ed.locator('#ed-qty').press('Enter');
        await expect(toast(page)).toContainText('Item #2 added to quotation');
        await expect(toast(page)).toHaveCount(1); // replaced, not stacked
        await expect(ed.getByTestId('ed-context')).toHaveText(/^2 items · RM /);
        // Ctrl+Enter = add and close
        await fillSagRod(page, '310', '2');
        await ed.locator('#ed-qty').press('Control+Enter');
        await expect(ed).toBeHidden();
        await expect(page.getByTestId('builder-item-dims')).toHaveText(['M12 × L1070 × TL100/100', 'M12 × L1245 × TL100/100', 'M12 × L310 × TL100/100']);
        await expect(page.getByTestId('builder-item-title').first()).toHaveText('MS FULLSIZE SAG ROD · ZP');
        // Esc cancels without adding; Enter on an incomplete item adds nothing
        await page.getByTestId('open-manual-add').click();
        await ed.locator('#ed-qty').press('Enter');
        await expect(ed.getByTestId('error-ed-size')).toHaveText('Enter a size');
        await page.keyboard.press('Escape');
        await expect(ed).toBeHidden();
        await expect(page.getByTestId('builder-item')).toHaveCount(3);
    });

    test('Batch Add: 22 rows scroll inside the dialog, Enter moves cells, footer total, invalid row blocks, Ctrl+Enter adds', async ({ page }) => {
        await openBuilder(page);
        await page.getByTestId('open-batch-add').click();
        const ba = page.getByTestId('batch-add');
        for (let i = 0; i < 19; i++) await ba.getByTestId('ba-add-row').click();
        await expect(ba.getByTestId('ba-row')).toHaveCount(22);
        await ba.getByLabel('Row 1 size').fill('M12');
        await ba.getByLabel('Row 1 size').press('Enter');
        await expect(ba.getByLabel('Row 1 L')).toBeFocused();
        for (let n = 1; n <= 20; n++) {
            await ba.getByLabel(`Row ${n} size`).fill('M12');
            await ba.getByLabel(`Row ${n} L`).fill(String(1000 + n * 10));
            await ba.getByLabel(`Row ${n} TL`).fill('100');
        }
        await ba.getByLabel('Row 20 Qty').press('Enter');
        await expect(ba.getByLabel('Row 21 size')).toBeFocused();
        await expect(ba.getByTestId('ba-status')).toHaveText(/^20 valid rows · Total RM [\d,]+\.\d{2}$/);
        await expect(ba.getByTestId('ba-submit')).toContainText('Add 20 items');
        await expect(ba.getByTestId('ba-row').nth(19).getByTestId('ba-row-weight')).toHaveText(/kg$/);
        // the page never scrolls sideways; the dialog stays within the viewport and its body scrolls
        const box = (await ba.boundingBox())!;
        expect(box.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.86);
        await expectNoHorizontalScroll(page);
        await ba.getByLabel('Row 21 size').fill('M12');
        await expect(ba.getByTestId('ba-status')).toHaveText('20 ready · 1 needs attention');
        await expect(ba.getByTestId('ba-submit')).toHaveAttribute('aria-disabled', 'true');
        await ba.getByTestId('ba-submit').click({ force: true }); // a blocked attempt only reveals what needs attention
        await expect(page.getByText('Fix 1 row before adding')).toBeVisible();
        await expect(ba).toBeVisible();
        await expect(page.getByTestId('builder-item')).toHaveCount(0);
        await ba.getByLabel('Row 21 L').fill('900');
        await ba.getByLabel('Row 21 L').press('Control+Enter');
        await expect(ba).toBeHidden();
        await expect(page.getByTestId('builder-item')).toHaveCount(21);
        await expect(page.getByTestId('summary-items')).toHaveText('21');
    });

    test('Quick Add demo analysis: labelled demo, Ready / Needs review, fix in the shared editor, then add', async ({ page }) => {
        await openBuilder(page);
        await page.getByTestId('open-quick-add').click();
        const qa = page.getByTestId('quick-add');
        await expect(qa.getByTestId('qa-analyze')).toBeDisabled();
        await qa.getByTestId('qa-demo').click();
        await expect(qa.getByTestId('qa-demo-banner')).toContainText('Demo extracted items — not real AI output');
        const items = qa.getByTestId('qa-review-item');
        await expect(items).toHaveCount(2);
        await expect(items.nth(0).getByTestId('qa-status')).toHaveText('Ready');
        await expect(items.nth(1).getByTestId('qa-status')).toHaveText('Needs review');
        await expect(qa.getByTestId('qa-summary')).toHaveText('2 items · 1 needs review');
        await expect(qa.getByTestId('qa-add-confirmed')).toBeDisabled();
        await items.nth(1).getByTestId('qa-edit').click();
        const ed = page.getByTestId('item-editor');
        await expect(page.getByRole('heading', { name: 'Demo item 2 · review' })).toBeVisible();
        await expect(ed.locator('#ed-diameter')).toHaveValue('17');
        await ed.locator('#ed-costRate').fill('9.00');
        await ed.getByTestId('ed-submit').click();
        await expect(ed).toBeHidden();
        await expect(items.nth(1).getByTestId('qa-status')).toHaveText('Ready');
        await expect(qa.getByTestId('qa-add-confirmed')).toHaveText('Add confirmed items (2)');
        await qa.getByTestId('qa-add-confirmed').click();
        await expect(qa).toBeHidden();
        await expect(page.getByTestId('builder-item-title')).toHaveText(['MS UNDERSIZE SAG ROD · ZP', '4140 QT FULLSIZE L BOLT · PL']);
    });

    test('entry points: ?product opens Manual Add on that product; ?mode=quick / manual / batch open their mode', async ({ page }) => {
        await openBuilder(page, '/quotations/new?product=lbolt');
        await expect(page.getByTestId('item-editor')).toBeVisible();
        await expect(page.getByTestId('item-editor').locator('#ed-product')).toHaveValue('lbolt');
        await page.goto('/quotations/new?mode=quick');
        await expect(page.getByTestId('quick-add')).toBeVisible();
        await expect(page.getByTestId('quick-add').getByTestId('qa-text')).toBeVisible();
        await page.goto('/quotations/new?mode=batch');
        await expect(page.getByTestId('batch-add')).toBeVisible();
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
        await batchAddSagRods(page);
        await expect(page.getByTestId('builder-items').getByRole('columnheader', { name: 'Total' })).toBeVisible();
        const totals = await page.getByTestId('builder-item-total').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().right)));
        expect(new Set(totals).size).toBe(1);
        await expectNoHorizontalScroll(page);
        // Batch Add rows stay one aligned row each at tablet width
        await page.getByTestId('open-batch-add').click();
        const ba = page.getByTestId('batch-add');
        const sizeY = (await ba.getByLabel('Row 1 size').boundingBox())!.y;
        const qtyY = (await ba.getByLabel('Row 1 Qty').boundingBox())!.y;
        expect(Math.abs(sizeY - qtyY)).toBeLessThanOrEqual(2);
        await page.keyboard.press('Escape');
        await page.getByTestId('open-manual-add').click();
        const dlg = (await page.getByTestId('item-editor').boundingBox())!;
        expect(Math.abs(dlg.x + dlg.width / 2 - 384)).toBeLessThanOrEqual(2);
        expect(dlg.width).toBeLessThan(768);
        // continuous-entry footer with keyboard hints on a tablet
        await expect(page.getByTestId('ed-add-another')).toBeVisible();
        await expect(page.getByTestId('ed-add-another').getByTestId('kbd-hint')).toBeVisible();
        await expectNoHorizontalScroll(page);
        await page.keyboard.press('Escape');
        await page.getByTestId('open-quick-add').click();
        await page.getByTestId('qa-demo').click();
        await expect(page.getByTestId('qa-demo-banner')).toBeVisible();
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
            await batchAddSagRods(page);
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
            expect(Math.round(ed.height)).toBe(852);
            await expect(page.getByTestId('item-editor').getByRole('button', { name: 'Back' })).toBeVisible();
            const submit = (await page.getByTestId('ed-submit').boundingBox())!;
            expect(submit.y + submit.height).toBeLessThanOrEqual(852);
            for (const id of ['ed-cancel', 'ed-add-another', 'ed-submit']) {
                const b = (await page.getByTestId(id).boundingBox())!;
                expect(b.x, `${id} inside`).toBeGreaterThanOrEqual(0);
                expect(b.x + b.width, `${id} inside`).toBeLessThanOrEqual(width);
            }
            await expect(page.getByTestId('kbd-hint').first()).toBeHidden(); // no keyboard hints on a phone
            // compact pricing: the ladder is label-left / value-right, the preview does not repeat it
            await expect(page.getByTestId('ed-preview-final')).toHaveCount(0);
            await fillSagRod(page, '1070');
            await page.getByTestId('ed-add-another').click();
            await expect(toast(page)).toBeVisible();
            const footerTop = (await page.getByTestId('item-editor').locator('footer').boundingBox())!.y;
            // once the enter animation settles, the toast sits above the task footer
            await expect.poll(async () => {
                const t = (await toast(page).boundingBox())!;
                return t.y + t.height <= footerTop;
            }, { message: 'toast clears the task footer' }).toBe(true);
            await expectNoHorizontalScroll(page);
            await page.getByTestId('item-editor').getByRole('button', { name: 'Back' }).click();
            await page.getByTestId('open-quick-add').click();
            expect(Math.round((await page.getByTestId('quick-add').boundingBox())!.width)).toBe(width);
            await expect(page.getByTestId('qa-analyze')).toBeVisible();
            await page.getByTestId('qa-demo').click();
            await expect(page.getByTestId('qa-demo-banner')).toBeVisible();
            await expect(page.getByTestId('qa-review-item')).toHaveCount(2);
            await expectNoHorizontalScroll(page);
            await page.getByTestId('quick-add').getByRole('button', { name: 'Back' }).first().click();
            // Batch Add with many rows stays inside the phone width
            await page.getByTestId('open-batch-add').click();
            const ba = page.getByTestId('batch-add');
            for (let i = 0; i < 9; i++) await ba.getByTestId('ba-add-row').click();
            await expect(ba.getByTestId('ba-row')).toHaveCount(12);
            await ba.getByLabel('Row 12 size').fill('M12');
            await expectNoHorizontalScroll(page);
            const add = (await ba.getByTestId('ba-submit').boundingBox())!;
            expect(add.y + add.height).toBeLessThanOrEqual(852);
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
