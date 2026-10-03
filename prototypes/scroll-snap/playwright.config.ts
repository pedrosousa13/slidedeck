// THROWAWAY (#3). Measurement suite for the prototype, separate from the
// repo's e2e suite and its verify gate. Run `build` first: it serves dist/.

import { defineConfig, devices } from '@playwright/test';

const viewport = { width: 800, height: 700 };

export default defineConfig({
  testDir: './measure',
  outputDir: './measure-results/artifacts',
  // Timing matters (drag velocity, frame sampling): one browser at a time.
  workers: 1,
  timeout: 180_000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4180/' },
  webServer: {
    command: 'pnpm exec vite preview --port 4180 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4180/index.html',
    reuseExistingServer: true
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport } }
  ]
});
