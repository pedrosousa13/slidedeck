// What the landing page states about the package, read from the package's
// README and package.json when the site builds. Never retyped: a new
// `pnpm compare` measurement, or a new release, changes the page on the next
// build.
import { readFileSync } from 'node:fs';
import { createMarkdownRenderer } from '@pagedeck/markdown-loader';
import { comparison, fence } from './readme.ts';

const read = (file: string) =>
  readFileSync(
    new URL(`../../../packages/react/${file}`, import.meta.url),
    'utf8'
  );

const readme = read('README.md');

/** The README's comparison, slidedeck's row first. */
export const libraries = comparison(readme);

/** Slidedeck's min+gzip size, as the comparison measures it. */
export const size = libraries[0]!.size;

/** The released version, as "1.0". */
export const version = (
  JSON.parse(read('package.json')) as { version: string }
).version.replace(/\.\d+$/, '');

/** The README's install command. */
export const install = fence(readme, 'Install');

// The same theme pair as the pages' code blocks (pagedeck.config.ts), so
// styles/site.css switches it to dark the same way.
const renderer = await createMarkdownRenderer({
  languages: ['tsx'],
  theme: { light: 'github-light-default', dark: 'github-dark-default' }
});

/** The README's quickstart, highlighted, as HTML. */
export const quickstart = (
  await renderer.render(
    `\`\`\`tsx\n${fence(readme, 'Quickstart')}\n\`\`\`\n`,
    'packages/react/README.md'
  )
).html;
