// The docs, under /docs/: the package README's reference, moved into a page
// per section (#110). The markdown is apps/site/docs; this module declares its
// collection, its sidebar and how a page is put together, and
// pagedeck.config.ts wires them in.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  defineCollection,
  getEntry,
  listEntries,
  type Entry
} from '@pagedeck/content';
import type { ContentStoreReader } from '@pagedeck/content';
import type { EntryRef, Page, PageContent } from '@pagedeck/core';
import {
  createMarkdownRenderer,
  defineMarkdownLoader,
  type MarkdownEntry
} from '@pagedeck/markdown-loader';
import type { DocsSection } from '../components/docs-page.tsx';

const SITE = join(import.meta.dirname, '..');

// Every language a fence in the docs names. The loader refuses any other.
const LANGUAGES = ['css', 'sh', 'ts', 'tsx'] as const;

// The `-default` pair, as pagedeck's own docs use: every token clears 4.5:1.
// styles/site.css switches to the dark colours.
export const CODE_THEME = {
  light: 'github-light-default',
  dark: 'github-dark-default'
} as const;

export const docs = defineCollection<MarkdownEntry>({
  name: 'docs',
  loader: defineMarkdownLoader({
    root: join(SITE, 'docs'),
    locale: 'en',
    languages: [...LANGUAGES],
    theme: CODE_THEME
  }),
  schema: false
});

// The sidebar, in reading order, by entry path. The order is also the
// previous and next links'. A page left out of it, or a path here with no
// page, fails the build.
const SIDEBAR: readonly { label: string; pages: readonly string[] }[] = [
  { label: 'Getting started', pages: ['index', 'install', 'quickstart'] },
  {
    label: 'Guides',
    pages: [
      'guides/layout',
      'guides/the-index',
      'guides/focal-slide',
      'guides/loop',
      'guides/drag',
      'guides/autoplay',
      'guides/vertical-and-rtl',
      'guides/pages',
      'guides/progress',
      'guides/effects',
      'guides/theme',
      'guides/server-rendering',
      'guides/accessibility',
      'guides/known-limits'
    ]
  },
  { label: 'Reference', pages: ['reference/primitives', 'reference/hooks'] },
  {
    label: 'Recipes',
    pages: [
      'recipes/index',
      'recipes/centred-ends',
      'recipes/middle-slide',
      'recipes/size-a-curve',
      'recipes/custom-controls',
      'recipes/per-breakpoint',
      'recipes/playdeck-video'
    ]
  },
  { label: 'Compare', pages: ['compare'] }
];

/** `/docs/` for `index`, `/docs/recipes/` for `recipes/index`. */
export function docsRoute(entry: Entry<MarkdownEntry>): readonly string[] {
  return ['docs', ...entry.path.split('/').filter((part) => part !== 'index')];
}

const hrefOf = (path: string) =>
  `/${docsRoute({ path } as Entry<MarkdownEntry>).join('/')}/`;

function sidebar(store: ContentStoreReader, current: string): DocsSection[] {
  const entries = new Map(
    listEntries(store, docs).map((entry) => [entry.path, entry])
  );
  const listed = new Set(SIDEBAR.flatMap((section) => section.pages));
  const unlisted = [...entries.keys()].filter((path) => !listed.has(path));
  const missing = [...listed].filter((path) => !entries.has(path));
  if (unlisted.length > 0 || missing.length > 0) {
    throw new Error(
      `Docs sidebar: list every page in SIDEBAR (apps/site/lib/docs.ts), and only pages there are. Not listed: ${unlisted.join(', ') || 'none'}. No page: ${missing.join(', ') || 'none'}.`
    );
  }
  return SIDEBAR.map(({ label, pages }) => ({
    label,
    links: pages.map((path) => {
      const { title, frontmatter } = entries.get(path)!.data;
      const short = frontmatter['label'];
      return {
        href: hrefOf(path),
        label: typeof short === 'string' ? short : title,
        current: path === current
      };
    })
  }));
}

// The README's comparison, between its generated markers, so the Compare page
// shows the table `pnpm compare` keeps fresh rather than a copy of it.
const README = join(SITE, '..', '..', 'packages', 'react', 'README.md');
const COMPARISON = /<!-- comparison:start -->([\s\S]*)<!-- comparison:end -->/;
const PLACEHOLDER = '<!-- readme:comparison -->';

let renderer: ReturnType<typeof createMarkdownRenderer> | undefined;

async function comparison(): Promise<string> {
  const table = COMPARISON.exec(readFileSync(README, 'utf8'))?.[1];
  if (table === undefined) {
    throw new Error(`Docs: ${README} has no comparison between its markers.`);
  }
  renderer ??= createMarkdownRenderer({
    languages: [...LANGUAGES],
    theme: CODE_THEME
  });
  return (await (await renderer).render(table, 'README.md')).html;
}

/** Every docs page, so a page re-renders when any title in its sidebar does. */
export function everyDocsPage(store: ContentStoreReader): EntryRef[] {
  return listEntries(store, docs).map(({ collection, locale, path }) => ({
    collection,
    locale,
    path
  }));
}

/** A docs page: the docs layout, with the page's examples as its children. */
export async function docsContent(
  page: Page,
  store: ContentStoreReader
): Promise<PageContent> {
  const entry =
    page.entry === undefined ? undefined : getEntry(store, docs, page.entry);
  if (entry === undefined) {
    throw new Error(`Docs: ${page.path} has no docs entry to render.`);
  }
  const { title, html, toc, frontmatter } = entry.data;
  const nav = sidebar(store, entry.path);
  const links = nav.flatMap((section) => section.links);
  const at = links.findIndex((link) => link.current);
  const examples = frontmatter['components'];
  return {
    tree: [
      {
        component: 'docs-page',
        props: {
          title,
          html: html.includes(PLACEHOLDER)
            ? html.replace(PLACEHOLDER, await comparison())
            : html,
          toc: toc.filter((heading) => heading.depth === 2),
          nav,
          previous: links[at - 1],
          next: links[at + 1]
        },
        children: (Array.isArray(examples) ? examples : []).map((name) => ({
          component: String(name)
        }))
      }
    ]
  };
}

// Each live example is its own 'use client' module in components/examples,
// registered by its file name: `quickstart-example.tsx` is
// `example-quickstart`. The suffix keeps an example's chunk name apart from
// the package's own, such as `fade`.
export const exampleComponents: Record<string, string> = Object.fromEntries(
  readdirSync(join(SITE, 'components', 'examples'))
    .filter((file) => file.endsWith('-example.tsx'))
    .map((file) => [
      `example-${file.replace(/-example\.tsx$/, '')}`,
      `./components/examples/${file}`
    ])
);
