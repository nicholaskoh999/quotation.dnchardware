import { defineConfig, devices } from '@playwright/test';

/* Playwright drives the BUILT application through `php artisan serve`, so the
   e2e run proves the same artefact a deployment would ship (public/build +
   manifest), not the Vite dev server. */
const PORT = Number(process.env.E2E_PORT || 8765);

export default defineConfig({
    testDir: 'tests/e2e',
    timeout: 30_000,
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
        env: { APP_ENV: 'testing' },
    },
});
