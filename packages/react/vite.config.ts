import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'src/index.tsx', formats: ['es'], fileName: 'index' },
    rollupOptions: {
      external: ['@slidedeck/core', 'react', 'react/jsx-runtime', 'react-dom']
    },
    sourcemap: true,
    emptyOutDir: false
  }
});
