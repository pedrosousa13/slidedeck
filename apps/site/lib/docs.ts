// The docs, under /docs/: the package README's reference, moved into a page
// per section (#110). The markdown is @slidedeck/docs, packages/docs, written
// to deck.cool's docs contract (#133); this module declares its collection,
// its sidebar and how a page is put together, and pagedeck.config.ts wires
// them in.

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, posix } from 'node:path';
import {
  defineCollection,
  getEntry,
  listEntries,
  type Entry
} from '@pagedeck/content';
import type { ContentStoreReader, Loader } from '@pagedeck/content';
import type { EntryRef, Page, PageContent } from '@pagedeck/core';
import {
  defineMarkdownLoader,
  type MarkdownEntry
} from '@pagedeck/markdown-loader';
import type { DocsSection } from '../components/docs-page.tsx';

const SITE = join(import.meta.dirname, '..');
// The package's own directory, through the site's dependency on it, so turbo
// rebuilds the site when the docs change.
const DOCS = dirname(
  createRequire(import.meta.url).resolve('@slidedeck/docs/package.json')
);

// Every language a fence in the docs names. The loader refuses any other.
const LANGUAGES = ['css', 'sh', 'ts', 'tsx'] as const;

// The `-default` pair, as pagedeck's own docs use: every token clears 4.5:1.
// styles/site.css switches to the dark colours.
export const CODE_THEME = {
  light: 'github-light-default',
  dark: 'github-dark-default'
} as const;

// npm puts these in every package, so they are not pages, by the contract.
// pagedeck's loader still reads each, and refuses one with no title: each
// opens with a `#` heading, as a Changesets changelog does.
const NOT_PAGES = new Set(['readme', 'changelog', 'license']);

type Writer = Parameters<Loader<MarkdownEntry>['syncAll']>[0];

/** `loader`, without the package's README, CHANGELOG and LICENSE. */
function pagesOnly(loader: Loader<MarkdownEntry>): Loader<MarkdownEntry> {
  const isPage = (path: string) => !NOT_PAGES.has(path.toLowerCase());
  const filtered = async (
    writer: Writer,
    run: (writer: Writer) => ReturnType<Loader<MarkdownEntry>['syncAll']>
  ) => {
    const result = await run({
      upsert: (entry) => {
        if (isPage(entry.path)) writer.upsert(entry);
      },
      delete: (id) => writer.delete(id)
    });
    return {
      ...result,
      changed: result.changed.filter((id) => isPage(id.path))
    };
  };
  return {
    syncAll: (writer) => filtered(writer, (inner) => loader.syncAll(inner)),
    syncSince: (writer, cursor) =>
      filtered(writer, (inner) => loader.syncSince(inner, cursor))
  };
}

export const docs = defineCollection<MarkdownEntry>({
  name: 'docs',
  loader: pagesOnly(
    defineMarkdownLoader({
      root: DOCS,
      locale: 'en',
      languages: [...LANGUAGES],
      theme: CODE_THEME
    })
  ),
  schema: false
});

// The sidebar, in reading order, by entry path: the package's nav.json, which
// names each page by its file. The order is also the previous and next links'.
// A page left out of it, or a path there with no page, fails the build.
const SIDEBAR: readonly { label: string; pages: readonly string[] }[] = (
  JSON.parse(readFileSync(join(DOCS, 'nav.json'), 'utf8')) as {
    label: string;
    pages: string[];
  }[]
).map(({ label, pages }) => ({
  label,
  pages: pages.map((file) => file.replace(/\.md$/, ''))
}));

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
      `Docs sidebar: list every page in nav.json (packages/docs), and only pages there are. Not listed: ${unlisted.join(', ') || 'none'}. No page: ${missing.join(', ') || 'none'}.`
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

// A relative link to a page's .md file, as the contract writes one, in the
// rendered HTML: `href="../guides/loop.md#copies"`.
const PAGE_LINK = /href="((?![a-z][a-z0-9+.-]*:|\/|#)[^"#]*\.md)(#[^"]*)?"/gi;

/** `html` with each link to a page's file pointed at the page's route. */
function linkPages(html: string, file: string): string {
  return html.replace(PAGE_LINK, (_, path: string, fragment = '') => {
    const target = posix.join(posix.dirname(file), path).replace(/\.md$/, '');
    return `href="${hrefOf(target)}${fragment}"`;
  });
}

// A live example's place in the page: `<!-- demo:example-loop -->`.
const DEMO = /<!-- demo:([A-Za-z0-9_-]+) -->/g;

/** Every docs page, so a page re-renders when any title in its sidebar does. */
export function everyDocsPage(store: ContentStoreReader): EntryRef[] {
  return listEntries(store, docs).map(({ collection, locale, path }) => ({
    collection,
    locale,
    path
  }));
}

/** A docs page: the docs layout, with the page's examples as its children. */
export function docsContent(
  page: Page,
  store: ContentStoreReader
): PageContent {
  const entry =
    page.entry === undefined ? undefined : getEntry(store, docs, page.entry);
  if (entry === undefined) {
    throw new Error(`Docs: ${page.path} has no docs entry to render.`);
  }
  const { title, html, toc } = entry.data;
  const nav = sidebar(store, entry.path);
  const links = nav.flatMap((section) => section.links);
  const at = links.findIndex((link) => link.current);
  const examples = [...html.matchAll(DEMO)].map((match) => String(match[1]));
  return {
    tree: [
      {
        component: 'docs-page',
        props: {
          title,
          html: linkPages(html, entry.data.file),
          toc: toc.filter((heading) => heading.depth === 2),
          nav,
          previous: links[at - 1],
          next: links[at + 1]
        },
        children: examples.map((name) => ({ component: name }))
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
