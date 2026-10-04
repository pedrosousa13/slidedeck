import { defineConfig } from 'vite';

export default defineConfig({
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
