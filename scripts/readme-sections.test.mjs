// The package README's reference moved to the site's docs (#110). The mapping
// lists every section the README had, by heading, and the docs page it moved
// to. These tests fail when a section has no page to show it, or when the
// README gains a section the mapping does not place.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (/** @type {string} */ file) =>
  readFileSync(join(repoRoot, file), 'utf8');

/** @type {Record<string, string>} */
const mapping = JSON.parse(read('apps/site/readme-sections.json'));

/**
 * The markdown file a docs URL is built from: `/docs/a/` from
 * `apps/site/docs/a.md`, or from `apps/site/docs/a/index.md`.
 * @param {string} url
 */
const pageFile = (url) => {
  const path = url.replace(/^\/docs\/?/, '').replace(/\/$/, '');
  const candidates =
    path === ''
      ? ['apps/site/docs/index.md']
      : [`apps/site/docs/${path}.md`, `apps/site/docs/${path}/index.md`];
  return candidates.find((file) => existsSync(join(repoRoot, file)));
};

/**
 * A page's title, from its frontmatter or its first heading, and the text of
 * every heading after it.
 * @param {string} markdown
 */
const headingsOf = (markdown) => {
  const title = /^---\n[\s\S]*?^title: (.+)$[\s\S]*?^---$/m.exec(markdown);
  const headings = [...markdown.matchAll(/^#{1,3} (.+)$/gm)].map(
    (match) => match[1] ?? ''
  );
  return title?.[1] === undefined
    ? headings
    : [title[1].replace(/^'(.*)'$/, '$1'), ...headings];
};

test('every README section from before the move has a docs page', () => {
  // The README's `##` headings on main before the move.
  assert.deepEqual(Object.keys(mapping), [
    'Install',
    'Quickstart',
    'Primitives',
    'Hooks',
    'Layout is CSS',
    'The index: controlled, uncontrolled and the handle',
    'Focal slide',
    'Loop',
    'Drag',
    'Autoplay',
    'Vertical and right-to-left',
    'Pages',
    'Progress and data attributes',
    'Effects: fade and curve',
    'Theme',
    'Server rendering',
    'Accessibility',
    'Known limits',
    'Recipes',
    'Recipe: centre the first and last slide',
    'Recipe: highlight the middle slide in view',
    'Recipe: size a curve',
    'Recipe: custom controls and a counter',
    'Recipe: change `effect`, `loop` or `autoplay` per breakpoint',
    'Recipe: play a playdeck video in the focal slide',
    'Comparison with Embla and Keen',
    'License'
  ]);
  for (const [heading, url] of Object.entries(mapping)) {
    const file = pageFile(url);
    assert.ok(file, `"${heading}" maps to ${url}, which has no page.`);
    // A recipe's page drops the "Recipe: " its README heading had.
    const wanted = heading.replace(/^Recipe: (.)/, (_, first) =>
      String(first).toUpperCase()
    );
    assert.ok(
      headingsOf(read(file)).includes(wanted),
      `${file} has no title or heading "${wanted}".`
    );
  }
});

test('every section the README has now is placed in the mapping', () => {
  const headings = [
    ...read('packages/react/README.md').matchAll(/^## (.+)$/gm)
  ].map((match) => match[1]);
  for (const heading of headings) {
    assert.ok(
      heading !== undefined && heading in mapping,
      `The README's "${heading}" is not in apps/site/readme-sections.json.`
    );
  }
});
