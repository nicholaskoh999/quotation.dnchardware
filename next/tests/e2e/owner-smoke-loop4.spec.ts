import { expect, test, type Locator, type Page } from '@playwright/test';
import { requireAuthDb, signIn } from './support/auth';

/* W1 Owner Smoke Loop #4 — quotation detail as one aligned grid
   (# · Specification · Qty · Weight · Unit · Markup · Total), group header
   bands, accessories as a secondary Specification line, group Total Weight,
   Overall Weight for multi-group quotations, sort on the Items header, and a
   structured three-row layout on phones. */

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

async function boxes(loc: Locator) {
    return loc.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height, right: r.right })));
}

/** every element's right edge within 1px of the first one */
async function expectRightAligned(loc: Locator, what: string) {
    const b = await boxes(loc);
    expect(b.length, what).toBeGreaterThan(1);
    for (const r of b) expect(Math.abs(r.right - b[0]!.right), `${what} right edges align`).toBeLessThanOrEqual(1);
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

    test('one aligned grid: exact columns, numeric columns line up, compact rows, sort on the Items header', async ({ page }) => {
        await page.goto('/quotations/103');
        await expect(page.getByTestId('item-grid-header').getByRole('columnheader')).toHaveText(['#', 'Specification', 'Qty', 'Weight', 'Unit', 'Markup', 'Total']);
        const rows = page.getByTestId('item-row');
        await expect(rows).toHaveCount(7);
        for (const id of ['item-qty', 'item-weight', 'item-unit', 'item-markup-cell', 'item-total']) {
            await expectRightAligned(page.getByTestId(id), id);
        }
        // the header labels sit over their columns
        const headerTotal = (await page.getByTestId('item-grid-header').getByRole('columnheader', { name: 'Total' }).boundingBox())!;
        const firstTotal = (await page.getByTestId('item-total').first().boundingBox())!;
        expect(Math.abs(headerTotal.x + headerTotal.width - (firstTotal.x + firstTotal.width))).toBeLessThanOrEqual(1);
        // columns in order left → right on one line
        const r = rows.nth(5);
        const xs = [];
        for (const id of ['item-number', 'item-spec', 'item-qty', 'item-weight', 'item-unit', 'item-markup-cell', 'item-total']) xs.push((await r.getByTestId(id).boundingBox())!.x);
        expect([...xs].sort((a, b) => a - b)).toEqual(xs);
        // numbers stay together on the right: Unit → Total is compact, not page-wide
        expect(firstTotal.x - (await page.getByTestId('item-unit').first().boundingBox())!.x).toBeLessThan(260);
        // a plain row is one compact line
        for (const b of await boxes(page.getByTestId('item-row').filter({ hasNot: page.getByTestId('item-accessories') }).filter({ hasNot: page.getByTestId('item-identity') }))) {
            expect(b.h).toBeLessThanOrEqual(48);
        }
        // no per-item cards: rows are flat grid rows inside one container
        expect(await rows.first().evaluate((el) => getComputedStyle(el).borderRadius)).toBe('0px');
        // sort lives on the Items header row
        await expect(page.getByTestId('items-header').getByTestId('item-order')).toBeVisible();
        await expect(page.getByTestId('item-group').getByTestId('item-order')).toHaveCount(0);
        await expectNoRecipeOrUom(page);
        await expectNoHorizontalScroll(page);
    });

    test('accessories are a secondary Specification line; figures stay on the first line', async ({ page }) => {
        await page.goto('/quotations/103');
        const row = page.getByTestId('item-row').filter({ has: page.getByTestId('item-accessories') }).first();
        const size = (await row.getByTestId('item-size').boundingBox())!;
        const acc = (await row.getByTestId('item-accessories').boundingBox())!;
        expect(acc.y).toBeGreaterThan(size.y);
        expect(Math.abs(acc.x - size.x)).toBeLessThanOrEqual(1);
        for (const id of ['item-qty', 'item-weight', 'item-unit', 'item-total']) {
            expect(Math.abs((await row.getByTestId(id).boundingBox())!.y - size.y), `${id} on the spec line`).toBeLessThanOrEqual(4);
        }
        await expect(page.getByTestId('item-grid-header')).not.toContainText(/accessor/i);
    });

    test('group headers, Total Weight per multi-item group, Overall Weight only across groups', async ({ page }) => {
        // two single-item groups → no group Total Weight; Overall Weight = 6.928 + 10.364
        await page.goto('/quotations/101');
        await expect(page.getByTestId('group-title')).toHaveText(['MS UNDERSIZE SAG ROD · ZP', '4140 QT FULLSIZE L BOLT · HDG']);
        await expect(page.getByTestId('group-meta')).toHaveText(['1 item', '1 item']);
        await expect(page.getByTestId('group-total-weight')).toHaveCount(0);
        await expect(page.getByTestId('overall-weight-value')).toHaveText('17.292 kg');
        const overall = (await page.getByTestId('overall-weight').boundingBox())!;
        const total = (await page.getByTestId('quotation-total').boundingBox())!;
        expect(overall.y).toBeLessThan(total.y);
        await expect(page.getByTestId('item-markup')).toHaveText(['⭐ +20%']);

        // one mixed group of two → its Total Weight, aligned under Weight; no Overall Weight
        await page.goto('/quotations/102');
        await expect(page.getByTestId('group-title')).toHaveText(['STUD']);
        await expect(page.getByTestId('item-identity')).toHaveText(['S45C · HARDENED TO G8.8 · PL', '4140 QT · HARDENED TO G10.9 · PL']);
        await expect(page.getByTestId('group-total-weight-value')).toHaveText('9.468 kg');
        const tw = (await page.getByTestId('group-total-weight-value').boundingBox())!;
        const w = (await page.getByTestId('item-weight').first().boundingBox())!;
        expect(Math.abs(tw.x + tw.width - (w.x + w.width))).toBeLessThanOrEqual(1);
        await expect(page.getByTestId('overall-weight')).toHaveCount(0);
        await expect(page.getByTestId('item-manual')).toHaveText('Manual');
        await expect(page.getByTestId('item-markup')).toHaveCount(0);
        await expectNoRecipeOrUom(page);
    });
});

test.describe('tablet (768px)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'run once, in the desktop project');
        await signedIn(page);
    });

    test('compact grid holds: same columns, aligned totals, no overflow', async ({ page }) => {
        for (const id of [101, 102, 103]) {
            await page.goto(`/quotations/${id}`);
            await expect(page.getByTestId('item-grid-header')).toBeVisible();
            await expectRightAligned(page.getByTestId('item-total'), `Q${id} totals`);
            for (const b of await boxes(page.getByTestId('item-qty'))) expect(b.h, 'Qty never wraps').toBeLessThanOrEqual(24);
            for (const b of await boxes(page.getByTestId('item-unit'))) expect(b.h, 'Unit never wraps').toBeLessThanOrEqual(24);
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
        test(`structured three-row items with fixed field positions (${width}px)`, async ({ page }) => {
            await page.setViewportSize({ width, height: 852 });
            await page.goto('/quotations/103');
            await expect(page.getByTestId('item-grid-header')).toBeHidden();
            const rows = page.getByTestId('item-row');
            const specX = new Set<number>();
            const qtyX = new Set<number>();
            const weightX = new Set<number>();
            const totalRight = new Set<number>();
            for (let i = 0; i < (await rows.count()); i++) {
                const r = rows.nth(i);
                const b = async (id: string) => (await r.getByTestId(id).boundingBox())!;
                const spec = await b('item-spec');
                const qty = await b('item-qty');
                const weight = await b('item-weight');
                const unit = await b('item-unit');
                const markup = await b('item-markup-cell');
                const total = await b('item-total');
                // row 1 spec (+ accessories inside it) · row 2 Qty / Weight · row 3 Unit / Markup / Total
                expect(qty.y).toBeGreaterThanOrEqual(spec.y + spec.height - 1);
                expect(Math.abs(qty.y - weight.y)).toBeLessThanOrEqual(2);
                expect(unit.y).toBeGreaterThan(qty.y);
                expect(Math.abs(unit.y - total.y)).toBeLessThanOrEqual(2);
                expect(Math.abs(unit.y - markup.y)).toBeLessThanOrEqual(2);
                expect(qty.x).toBeLessThan(weight.x);
                expect(unit.x).toBeLessThan(markup.x);
                specX.add(Math.round(spec.x));
                qtyX.add(Math.round(qty.x));
                weightX.add(Math.round(weight.x));
                totalRight.add(Math.round(total.x + total.width));
            }
            expect(specX.size, 'Specification starts at the same x').toBe(1);
            expect(qtyX.size, 'Qty at the same x').toBe(1);
            expect(weightX.size, 'Weight at the same x').toBe(1);
            expect(totalRight.size, 'Total right-aligned').toBe(1);
            // accessories stay under the specification
            const accRow = rows.filter({ has: page.getByTestId('item-accessories') }).first();
            expect((await accRow.getByTestId('item-accessories').boundingBox())!.y).toBeGreaterThan((await accRow.getByTestId('item-size').boundingBox())!.y);
            expect((await accRow.getByTestId('item-accessories').boundingBox())!.y).toBeLessThan((await accRow.getByTestId('item-qty').boundingBox())!.y);
            await expectNoHorizontalScroll(page);
            await expectNoRecipeOrUom(page);

            // the last content clears the bottom nav
            await page.getByTestId('quotation-total').scrollIntoViewIfNeeded();
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            const nav = (await page.getByTestId('bottom-nav').boundingBox())!;
            const rev = (await page.locator('#history-heading').boundingBox())!;
            expect(rev.y + rev.height).toBeLessThanOrEqual(nav.y);
            await expect(page.getByTestId('bottom-nav')).toBeVisible();
        });
    }
});
