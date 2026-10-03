import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'src/index.tsx', formats: ['es'], fileName: 'index' },
    rollupOptions: { external: ['react', 'react/jsx-runtime'] },
    sourcemap: true,
    emptyOutDir: false
  }
});
