import { fileURLToPath, URL } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  // Stories run the packages' source, not their built `dist`, so `storybook dev`
  // reflects an edit without a rebuild.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    resolve: {
      ...viteConfig.resolve,
      alias: {
        ...viteConfig.resolve?.alias,
        '@slidedeck/core': fileURLToPath(
          new URL('../../../packages/core/src/index.ts', import.meta.url)
        ),
        // A story inlines the theme into a <style>, so it applies to that
        // story alone; a consumer imports it plain. A string key matches
        // only the exact specifier, query and all, so each form needs one.
        '@slidedeck/react/theme.css?inline': `${fileURLToPath(
          new URL('../../../packages/react/src/theme.css', import.meta.url)
        )}?inline`,
        '@slidedeck/react/theme.css': fileURLToPath(
          new URL('../../../packages/react/src/theme.css', import.meta.url)
        ),
        // Before the bare specifier, which would otherwise swallow it.
        '@slidedeck/react/fade': fileURLToPath(
          new URL('../../../packages/react/src/fade.ts', import.meta.url)
        ),
        '@slidedeck/react/curve': fileURLToPath(
          new URL('../../../packages/react/src/curve.ts', import.meta.url)
        ),
        '@slidedeck/react': fileURLToPath(
          new URL('../../../packages/react/src/index.tsx', import.meta.url)
        )
      }
    }
  })
};

export default config;
