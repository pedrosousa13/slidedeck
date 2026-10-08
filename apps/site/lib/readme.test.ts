import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { comparison, fence } from './readme.ts';

const table = [
  '| Library    | Version   | Min+gzip | Native scroll | Accessibility out of the box | API shape |',
  '| ---------- | --------- | -------- | ------------- | ---------------------------- | --------- |',
  '| `a-lib`    | this repo | 1.25 KB  | Yes: snap     | Labelled, "n of m"           | Parts     |',
  '| `b-lib`    | 2.0.0     | 3.50 KB  | No: `x(…)`    | None                         | A hook    |'
].join('\n');

const readme = (between: string) =>
  [
    '# Title',
    '',
    '## Quickstart',
    '',
    '```tsx',
    "import * as Deck from '@slidedeck/react';",
    '',
    '<Deck.Root />',
    '```',
    '',
    '## Comparison',
    '',
    '| Not | The | Table |',
    '| --- | --- | ----- |',
    '',
    '<!-- comparison:start -->',
    between,
    '<!-- comparison:end -->'
  ].join('\n');

test('comparison reads each row between the markers, cell by cell', () => {
  assert.deepEqual(comparison(readme(`\n${table}\n\nMin+gzip: notes.\n`)), [
    {
      library: 'a-lib',
      version: 'this repo',
      size: '1.25 KB',
      nativeScroll: 'Yes: snap',
      accessibility: 'Labelled, "n of m"',
      api: 'Parts'
    },
    {
      library: 'b-lib',
      version: '2.0.0',
      size: '3.50 KB',
      nativeScroll: 'No: `x(…)`',
      accessibility: 'None',
      api: 'A hook'
    }
  ]);
});

test('comparison follows the table: a new size is a new value', () => {
  const [row] = comparison(readme(table.replace('1.25 KB', '9.99 KB')));
  assert.equal(row?.size, '9.99 KB');
});

test('comparison refuses a README without the markers or a table', () => {
  assert.throws(() => comparison('# No markers'), /comparison:start/);
  assert.throws(() => comparison(readme('No table.')), /table/);
});

test('comparison refuses a table whose columns moved', () => {
  assert.throws(
    () => comparison(readme(table.replace('Min+gzip', 'Size'))),
    /Min\+gzip/
  );
});

test("fence reads the first code block of a section, by the section's heading", () => {
  assert.equal(
    fence(readme(table), 'Quickstart'),
    "import * as Deck from '@slidedeck/react';\n\n<Deck.Root />"
  );
  assert.throws(() => fence(readme(table), 'Install'), /Install/);
});

test('the package README parses: three libraries, slidedeck first', () => {
  const real = readFileSync(
    new URL('../../../packages/react/README.md', import.meta.url),
    'utf8'
  );
  const rows = comparison(real);
  assert.deepEqual(
    rows.map((row) => row.library),
    ['@slidedeck/react', 'embla-carousel-react', 'keen-slider']
  );
  for (const row of rows) assert.match(row.size, /^\d+\.\d\d KB$/);
  assert.match(fence(real, 'Quickstart'), /<Deck\.Root aria-label=/);
  assert.equal(fence(real, 'Install'), 'pnpm add @slidedeck/react');
});
