import { fileURLToPath, URL } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Tests import the packages by name, as a consumer does, and run their
    // source rather than a stale `dist`. Anchored so a future subpath export
    // is not swallowed by the bare specifier's alias.
    alias: [
      {
        find: /^@slidedeck\/core$/,
        replacement: fileURLToPath(
          new URL('./packages/core/src/index.ts', import.meta.url)
        )
      },
      {
        find: /^@slidedeck\/react\/fade$/,
        replacement: fileURLToPath(
          new URL('./packages/react/src/fade.ts', import.meta.url)
        )
      },
      {
        find: /^@slidedeck\/react$/,
        replacement: fileURLToPath(
          new URL('./packages/react/src/index.tsx', import.meta.url)
        )
      }
    ]
  },
  test: {
    include: ['packages/*/test/**/*.test.{ts,tsx}'],
    setupFiles: ['packages/react/test/setup.ts'],
    // A real browser, not a DOM emulation: a scroll-snap carousel is layout
    // and scrolling, which happy-dom and jsdom do not implement.
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      // Touch-enabled so a test can swipe with real CDP touch events.
      provider: playwright({ contextOptions: { hasTouch: true } })
    }
  }
});
