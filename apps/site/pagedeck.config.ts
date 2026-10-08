import { cloudflarePages } from '@pagedeck/adapter-cloudflare-pages';
import { defineCollection } from '@pagedeck/content';
import { defineMarkdownLoader } from '@pagedeck/markdown-loader';
import { defineConfig, fromCollection, SECURITY_HEADERS } from '@pagedeck/core';
import { defineSearch } from '@pagedeck/search';
import {
  docs,
  docsContent,
  docsRoute,
  everyDocsPage,
  exampleComponents
} from './lib/docs.ts';
import { headOf, pageMetaOf, SITE_ORIGIN, socialInputsOf } from './lib/seo.ts';
import { socialCard } from './lib/social-card.ts';

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
  collections: [pages, docs],
  build: {
    pages: [
      fromCollection(pages, { layout: 'layout' }),
      fromCollection(docs, {
        route: docsRoute,
        sharedDependsOn: everyDocsPage
      })
    ],
    // The docs pages: pages with no layout.
    content: docsContent,
    components: {
      layout: './components/layout.tsx',
      'docs-page': './components/docs-page.tsx',
      ...exampleComponents,
      search: { path: '@pagedeck/search/island', hydrate: 'idle' },
      header: './components/site-header.tsx',
      footer: './components/site-footer.tsx',
      'page-meta': './components/page-meta.tsx',
      landing: './components/landing.tsx',
      // The landing page's decks: registered, so each is an island where the
      // landing page renders it.
      'feature-deck': './components/feature-deck.tsx',
      'curve-deck': './components/curve-deck.tsx',
      // The Examples page, and its decks: each an island where a page renders
      // it, the landing page's teaser too.
      examples: './components/examples-page.tsx',
      'gallery-deck': './components/showcase/gallery-deck.tsx',
      'hero-deck': './components/showcase/hero-deck.tsx',
      'testimonials-deck': './components/showcase/testimonials-deck.tsx',
      'stories-deck': './components/showcase/stories-deck.tsx',
      'rtl-deck': './components/showcase/rtl-deck.tsx',
      'cover-flow-deck': './components/showcase/cover-flow-deck.tsx'
    },
    // Around pagedeck's <main>, not in the layout, so the nav bar and the
    // footer are the page's banner and contentinfo landmarks.
    chrome: (page) => ({
      before: [
        { component: 'page-meta', props: pageMetaOf(page) },
        {
          component: 'header',
          children: [
            {
              component: 'search',
              props: {
                locale: 'en',
                label: 'Search the docs',
                emptyLabel: 'No page matches'
              }
            }
          ]
        }
      ],
      after: [{ component: 'footer' }]
    }),
    css: ['./styles/site.css', './styles/docs.css'],
    // Each page's title, description, share card and structured data, from
    // the page itself: lib/seo.ts.
    head: (page, store) => headOf(page, store, pages),
    socialImages: {
      adapter: socialCard(SITE_ORIGIN),
      inputs: (page, store) => socialInputsOf(page, store, pages)
    },
    // Canonicals and the sitemap name the production origin on every deploy.
    // Cloudflare sends `x-robots-tag: noindex` on preview deploys, so they
    // stay out of the index whatever these files say.
    origin: SITE_ORIGIN,
    sitemap: { pattern: 'suffix' },
    robots: { allow: ['/'] },
    favicon: { src: './icons/favicon.ico' },
    // public/: the examples' photos at /photos/, and apple-touch-icon.png,
    // the address iOS asks for unprompted.
    passthrough: { root: './public' },
    search: defineSearch(),
    routing: { headers: [{ prefix: '/', set: [...SECURITY_HEADERS] }] },
    adapter: cloudflarePages()
  }
});
