// @polsia:user-owned — browser harness config for app journeys against BASE_URL.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    ...devices['Desktop Chrome'],
  },
});
