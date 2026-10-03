import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command:
      'pnpm --filter @slidedeck/storybook exec storybook dev --ci --no-open -p 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/iframe.html?id=placeholder-root--default&viewMode=story',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 500 },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
