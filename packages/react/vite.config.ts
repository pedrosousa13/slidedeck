import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      // The optional theme ships as written, comments and all: no entry
      // imports it, so a deck that does not import it ships none of it.
      name: 'slidedeck-theme',
      generateBundle() {
        const theme = fileURLToPath(new URL('src/theme.css', import.meta.url));
        // No entry imports it, so `vite build --watch` would miss its edits.
        this.addWatchFile(theme);
        this.emitFile({
          type: 'asset',
          fileName: 'theme.css',
          source: readFileSync(theme, 'utf8')
        });
      }
    }
  ],
  build: {
    // Each effect is its own entry, so a deck that imports none ships none
    // of its code.
    lib: {
      entry: {
        index: 'src/index.tsx',
        fade: 'src/fade.ts',
        curve: 'src/curve.ts'
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`
    },
    rollupOptions: {
      external: ['@slidedeck/core', 'react', 'react/jsx-runtime', 'react-dom']
    },
    sourcemap: true,
    emptyOutDir: false
  }
});
