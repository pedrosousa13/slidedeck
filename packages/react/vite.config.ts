import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const serverCode = ['server', 'slides-in'];

export default defineConfig({
  plugins: [
    {
      // dist is not emptied, as it holds tsc's declarations: each build
      // removes the last one's modules, so a renamed or dropped chunk never
      // gets into a tarball.
      name: 'slidedeck-clean-modules',
      apply: 'build',
      buildStart() {
        const dist = fileURLToPath(new URL('dist/', import.meta.url));
        if (!existsSync(dist)) return;
        for (const file of readdirSync(dist, { withFileTypes: true })) {
          if (file.isFile() && /\.js(\.map)?$/.test(file.name)) {
            rmSync(dist + file.name);
          }
        }
      }
    },
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
        curve: 'src/curve.ts',
        // The `react-server` entry: a server component's Deck.Root.
        server: 'src/server.tsx'
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`
    },
    rollupOptions: {
      external: ['@slidedeck/core', 'react', 'react/jsx-runtime', 'react-dom'],
      // Every module is client code, effects included: a server component
      // passes `fade` to `Deck.Viewport` as a client reference. The bundler
      // drops a directive written in the source, so the banner writes it as
      // the first statement of every chunk, but two: the `react-server`
      // entry, and the slide count it shares with the client Root, which
      // must run in the server component, so has a chunk of its own.
      output: {
        banner: (chunk) =>
          serverCode.includes(chunk.name) ? '' : "'use client';",
        // The context the server component's Root provides is its own chunk
        // too, so that index.js still holds the client entry's code.
        manualChunks: (id) =>
          /\/src\/(slides-in|server-slides)\.tsx?$/.exec(id)?.[1],
        // Unhashed, so the packaging check can name each chunk.
        chunkFileNames: '[name].js'
      }
    },
    sourcemap: true,
    emptyOutDir: false
  }
});
