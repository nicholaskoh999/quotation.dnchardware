import { expect, test } from '@playwright/test';
import { requireAuthDb, signIn } from './support/auth';
import { E2E_USER } from './support/env';

test('a guest is sent to the sign-in page, which renders cleanly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    await expect(page.getByText(/remember me/i)).toHaveCount(0);

    // No horizontal scroll at this viewport (phone and desktop).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

test('an empty submit shows a visible message, not silence', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Please enter both username and password.');
});

test('a failed sign-in shows a visible error and stays signed out', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('nobody-here');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Wrong username or password.');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
});

test('show password reveals the typed password', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Password', { exact: true }).fill('abc');
    await page.getByLabel('Show password').check();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
});

test('the Workspace handoff ships switched off', async ({ request }) => {
    expect((await request.get('/auth/handoff/start', { maxRedirects: 0 })).status()).toBe(404);
    expect((await request.get('/auth/handoff/callback?token=v2.a.b', { maxRedirects: 0 })).status()).toBe(404);
});

test.describe('with a throwaway app_users schema', () => {
    test.beforeEach(() => requireAuthDb());

    test('a named user signs in, sees their name, and signs out', async ({ page, isMobile }) => {
        await signIn(page);
        await expect(page).toHaveURL(/\/$/);
        if (!isMobile) await expect(page.getByTestId('current-user')).toHaveText(E2E_USER.displayName);

        await page.getByRole('button', { name: 'Sign out' }).click();
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole('status')).toHaveText('You have been signed out on this device.');

        await page.goto('/');
        await expect(page).toHaveURL(/\/login$/);
    });

    test('a disabled account is refused with the generic message', async ({ page }) => {
        await page.goto('/login');
        await page.getByLabel('Username').fill('e2edisabled');
        await page.getByLabel('Password', { exact: true }).fill(E2E_USER.password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('alert')).toHaveText('Wrong username or password.');
    });
});
