import { defineConfig, devices } from '@playwright/test';

// End-to-end smoke tests. Run `npm run build` first, then `npm run test:e2e`.
// If Playwright browsers are not installed, run `npx playwright install chromium` once.
// PW_PORT lets several checkouts run their tests at the same time.
const port = Number(process.env.PW_PORT || 4173);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${port}`,
    timezoneId: 'Asia/Kolkata',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
  },
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort`,
    port,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'mobile-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } } },
    { name: 'mobile-412', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
  ],
});
