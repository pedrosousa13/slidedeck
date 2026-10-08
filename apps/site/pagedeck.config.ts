import { cloudflarePages } from '@pagedeck/adapter-cloudflare-pages';
import { defineCollection } from '@pagedeck/content';
import { defineMarkdownLoader } from '@pagedeck/markdown-loader';
import { defineConfig, fromCollection, SECURITY_HEADERS } from '@pagedeck/core';

const pages = defineCollection({
  name: 'pages',
  loader: defineMarkdownLoader({
    root: './content',
    locale: 'en',
    languages: [],
    // The `-default` pair, as pagedeck's own docs use: every token clears
    // 4.5:1. styles/site.css switches to the dark colours.
    theme: { light: 'github-light-default', dark: 'github-dark-default' }
  }),
  schema: false
});

export default defineConfig({
  collections: [pages],
  build: {
    pages: [fromCollection(pages, { layout: 'layout' })],
    components: {
      layout: './components/layout.tsx',
      header: './components/site-header.tsx',
      footer: './components/site-footer.tsx',
      deck: './components/placeholder-deck.tsx'
    },
    // Around pagedeck's <main>, not in the layout, so the nav bar and the
    // footer are the page's banner and contentinfo landmarks.
    chrome: () => ({
      before: [{ component: 'header' }],
      after: [{ component: 'footer' }]
    }),
    css: ['./styles/site.css'],
    routing: { headers: [{ prefix: '/', set: [...SECURITY_HEADERS] }] },
    adapter: cloudflarePages()
  }
});
