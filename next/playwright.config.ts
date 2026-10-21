import { defineConfig, devices } from '@playwright/test';
import { E2E_LEGACY_DB } from './tests/e2e/support/env';

/* Playwright drives the BUILT application through `php artisan serve`, so the
   e2e run proves the same artefact a deployment would ship (public/build +
   manifest), not the Vite dev server. */
const PORT = Number(process.env.E2E_PORT || 8765);

export default defineConfig({
    testDir: 'tests/e2e',
    timeout: 30_000,
    /* Sign-in specs use a THROWAWAY local-MySQL app_users schema (never a real
       database); see tests/e2e/global-setup.ts. */
    globalSetup: './tests/e2e/global-setup.ts',
    globalTeardown: './tests/e2e/global-teardown.ts',
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        trace: 'off',
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
            ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
            : {}),
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } },
    ],
    webServer: {
        command: `php artisan serve --host=127.0.0.1 --port=${PORT}`,
        url: `http://127.0.0.1:${PORT}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
            APP_ENV: 'testing',
            LEGACY_DB_HOST: '127.0.0.1',
            LEGACY_DB_PORT: '3306',
            LEGACY_DB_DATABASE: E2E_LEGACY_DB,
            LEGACY_DB_USERNAME: 'root',
            LEGACY_DB_PASSWORD: '',
            DNC_HANDOFF_ENABLED: 'false',
        },
    },
});
