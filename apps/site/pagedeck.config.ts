import { defineCollection } from '@pagedeck/content';
import { defineMarkdownLoader } from '@pagedeck/markdown-loader';
import { defineConfig, fromCollection, SECURITY_HEADERS } from '@pagedeck/core';

const pages = defineCollection({
  name: 'pages',
  loader: defineMarkdownLoader({
    root: './content',
    locale: 'en',
    languages: []
  }),
  schema: false
});

export default defineConfig({
  collections: [pages],
  build: {
    pages: [fromCollection(pages, { layout: 'layout' })],
    components: {
      layout: './components/layout.tsx',
      deck: './components/placeholder-deck.tsx'
    },
    routing: { headers: [{ prefix: '/', set: [...SECURITY_HEADERS] }] }
  }
});
