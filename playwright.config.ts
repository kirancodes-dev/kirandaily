import { defineConfig, devices } from '@playwright/test';

// End-to-end smoke tests. Run `npm run build` first, then `npm run test:e2e`.
// If Playwright browsers are not installed, run `npx playwright install chromium` once.
// PW_PORT lets several checkouts run their tests at the same time.
const port = Number(process.env.PW_PORT || 4173);

// Kiran's own devices: iPhone 17 (Safari, 402×874 pt) and a 14" MacBook (1512×982).
// Chromium stands in for Safari here (only Chromium is installed); the user agents make
// the app treat them as an iPhone and a Mac.
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

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
    {
      name: 'iphone-17',
      use: {
        viewport: { width: 402, height: 874 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: IPHONE_UA,
        defaultBrowserType: 'chromium',
      },
    },
    { name: 'mac', use: { ...devices['Desktop Chrome'], viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2, userAgent: MAC_UA } },
  ],
});
