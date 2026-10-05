import { defineConfig } from 'vitest/config';

// Firestore security-rules tests. Run with `npm run test:rules` (starts the emulator; needs Java).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
