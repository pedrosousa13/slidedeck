import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const page = (name: string) =>
  fileURLToPath(new URL(`./${name}.html`, import.meta.url));

export default defineConfig({
  // Relative asset paths, so `dist/` works served from any origin root or
  // subpath.
  base: './',
  build: {
    rolldownOptions: {
      input: {
        index: page('index'),
        'loop-clone-jump': page('loop-clone-jump'),
        'loop-reposition': page('loop-reposition'),
        drag: page('drag'),
        fade: page('fade')
      }
    }
  }
});
