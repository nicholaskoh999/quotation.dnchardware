import { expect, test } from '@playwright/test';

test('health answers with the app up and no secrets', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.app).toBe('up');
    expect(JSON.stringify(body)).not.toMatch(/password|SQLSTATE|\/home\//i);
});

test('home renders, and the logo returns home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /QUOTATION NEXT/i })).toBeVisible();
    await page.getByRole('link', { name: /DNC Quotation — Home/i }).click();
    await expect(page).toHaveURL(/\/$/);
});
