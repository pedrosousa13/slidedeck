import { fileURLToPath, URL } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  // Stories run the package source, not its built `dist`, so `storybook dev`
  // reflects an edit without a rebuild.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    resolve: {
      ...viteConfig.resolve,
      alias: {
        ...viteConfig.resolve?.alias,
        '@slidedeck/react': fileURLToPath(
          new URL('../../../packages/react/src/index.tsx', import.meta.url)
        )
      }
    }
  })
};

export default config;
