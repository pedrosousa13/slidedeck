import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: [
    {
      command:
        'pnpm --filter @slidedeck/storybook exec storybook dev --ci --no-open -p 4173 --host 127.0.0.1',
      url: 'http://127.0.0.1:4173/iframe.html?id=deck--default&viewMode=story',
      gracefulShutdown: { signal: 'SIGTERM', timeout: 500 },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      // The site, apps/site, built and then its output served as static files
      // by vite preview, which does not apply pagedeck's routing headers.
      // Never reused: with --strictPort, a busy port fails rather than testing
      // a stale site or another worktree's. e2e/site.spec.ts sets this as its
      // baseURL.
      command:
        'pnpm exec turbo run build --filter=@slidedeck/site && pnpm --filter @slidedeck/site exec vite preview --outDir site --port 4174 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4174/',
      gracefulShutdown: { signal: 'SIGTERM', timeout: 500 },
      reuseExistingServer: false,
      timeout: 120_000
    }
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
