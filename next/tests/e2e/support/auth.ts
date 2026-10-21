import { expect, type Page, test } from '@playwright/test';
import { E2E_USER } from './env';

export function requireAuthDb() {
    test.skip(process.env.E2E_AUTH_DB !== '1', 'No local MySQL for the throwaway app_users schema.');
}

export async function signIn(page: Page, path = '/') {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Username').fill(E2E_USER.username);
    await page.getByLabel('Password', { exact: true }).fill(E2E_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/login/);
}
