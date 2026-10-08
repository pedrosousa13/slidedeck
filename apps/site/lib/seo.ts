// What a page tells search engines and share cards, all derived from the page
// itself: its title, and the `description` in its frontmatter. A page sets
// its description there and nowhere else; e2e/seo.spec.ts fails on a page
// without one.

import { getEntry, listEntries, type Collection } from '@pagedeck/content';
import type { ContentStoreReader } from '@pagedeck/content';
import type {
  JsonLdNode,
  Page,
  PageHead,
  SocialImageInputs
} from '@pagedeck/core';
import type { MarkdownEntry } from '@pagedeck/markdown-loader';
import { docs, docsRoute } from './docs.ts';

/**
 * Where the site is served in production. Every canonical, og:url and
 * sitemap entry names it, whichever host serves a build, so a preview never
 * claims to be the page. Change it here to move the site to its own domain.
 */
export const SITE_ORIGIN = 'https://slidedeck.pages.dev';

const REPOSITORY = 'https://github.com/pedrosousa13/slidedeck';

interface Described {
  /** The page's own name: its frontmatter title, or its `#` heading. */
  name: string;
  /** What the tab and the share card show. */
  title: string;
  description: string | undefined;
}

/** The page's entry and how it is named, from whichever collection it is in. */
function describe(
  page: Page,
  store: ContentStoreReader,
  pages: Collection<MarkdownEntry>
): Described | undefined {
  if (page.entry === undefined) return undefined;
  const isDocs = page.collection === docs.name;
  const found = getEntry(store, isDocs ? docs : pages, page.entry);
  if (found === undefined) return undefined;
  const entry = found.data;
  const description = entry.frontmatter['description'];
  return {
    name: entry.title,
    title: !isDocs
      ? entry.title
      : found.path === 'index'
        ? 'slidedeck docs'
        : `${entry.title} · slidedeck docs`,
    description: typeof description === 'string' ? description : undefined
  };
}

const url = (path: string) => `${SITE_ORIGIN}${path}`;

/** The landing page: the repository, as schema.org describes source code. */
function sourceCode(description: string | undefined): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: 'slidedeck',
    ...(description === undefined ? {} : { description }),
    url: url('/'),
    codeRepository: REPOSITORY,
    programmingLanguage: 'TypeScript',
    runtimePlatform: 'React 19',
    license: 'https://opensource.org/licenses/MIT'
  };
}

/**
 * A docs page's trail: the site, then every page above this one, then this
 * one. `/docs/guides/` is no page, so a guide's trail skips it.
 */
function breadcrumbs(page: Page, store: ContentStoreReader): JsonLdNode {
  const names = new Map<string, string>([
    ['/', 'slidedeck'],
    ['/docs/', 'Docs']
  ]);
  for (const entry of listEntries(store, docs)) {
    const href = `/${docsRoute(entry).join('/')}/`;
    if (!names.has(href)) names.set(href, entry.data.title);
  }
  const parts = page.path.split('/').filter((part) => part !== '');
  const trail = [
    '/',
    ...parts.map((_, i) => `/${parts.slice(0, i + 1).join('/')}/`)
  ].filter((href) => names.has(href));
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((href, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: names.get(href)!,
      item: url(href)
    }))
  };
}

/** build.head: the title, the description and the structured data. */
export function headOf(
  page: Page,
  store: ContentStoreReader,
  pages: Collection<MarkdownEntry>
): PageHead | undefined {
  const described = describe(page, store, pages);
  if (described === undefined) return undefined;
  const { title, description } = described;
  const jsonLd =
    page.path === '/'
      ? sourceCode(description)
      : page.collection === docs.name
        ? breadcrumbs(page, store)
        : undefined;
  return {
    title,
    ...(description === undefined ? {} : { description }),
    ...(jsonLd === undefined ? {} : { jsonLd })
  };
}

/** build.socialImages' inputs: the card's headline and the line above it. */
export function socialInputsOf(
  page: Page,
  store: ContentStoreReader,
  pages: Collection<MarkdownEntry>
): SocialImageInputs | undefined {
  const described = describe(page, store, pages);
  if (described === undefined) return undefined;
  if (page.collection !== docs.name) return { headline: described.name };
  return page.path === '/docs/'
    ? { headline: 'Documentation' }
    : { headline: described.name, eyebrow: 'Docs' };
}

/** The props of the chrome's `page-meta`: what build.head has no field for. */
export const pageMetaOf = (page: Page) => ({ url: url(page.path) });
