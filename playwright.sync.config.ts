import { defineConfig, devices } from '@playwright/test';

// Two-device cloud sync test against the Firebase emulators.
// Run with `npm run test:sync` (builds with .env.emulators, starts Auth + Firestore emulators; needs Java).
export default defineConfig({
  testDir: './e2e-sync',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:4175',
    timezoneId: 'Asia/Kolkata',
    ...devices['Pixel 5'],
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'npx vite preview --outDir dist-emulators --port 4175 --strictPort',
    port: 4175,
    reuseExistingServer: false,
  },
});
