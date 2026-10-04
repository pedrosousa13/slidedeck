#!/usr/bin/env node
// Writes the comparison of @slidedeck/react with Embla and Keen into the
// package README, between its `comparison:start` and `comparison:end`
// markers. `--check` writes nothing and fails if the README's table differs
// from a fresh run, so CI catches a stale one. Run `pnpm build` first: the
// slidedeck row bundles the built package, as a consumer gets it.
//
// Size is measured, never typed: each entry in tests/compare/entries is the
// smallest carousel a React user writes with that library, bundled in memory
// by Vite with React and ReactDOM external for all alike, minified, and
// gzipped. The figure is every JS chunk plus any stylesheet the entry has to
// import. The other columns cannot come out of a bundler: they are claims in
// tests/compare/features.mjs, each with where it was read.
//
// A report, never a gate on the numbers (ADR-0001): only a stale table fails.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixtureRoot = join(repoRoot, 'tests/compare');
const README = 'packages/react/README.md';

const START = '<!-- comparison:start -->';
const END = '<!-- comparison:end -->';

const REACT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client'
];

/**
 * @typedef {{
 *   name: string;
 *   version: string;
 *   bytes: number;
 *   nativeScroll: string;
 *   accessibility: string;
 *   api: string;
 * }} Row
 */

/** @param {number} bytes */
const kb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;

/**
 * A Markdown table, one row per library, each column padded to its widest
 * cell so the table reads aligned as text and prettier leaves it alone.
 * @param {readonly Row[]} rows
 */
export const renderTable = (rows) => {
  const header = [
    'Library',
    'Version',
    'Min+gzip',
    'Native scroll',
    'Accessibility out of the box',
    'API shape'
  ];
  const body = rows.map((row) => [
    row.name,
    row.version,
    kb(row.bytes),
    row.nativeScroll,
    row.accessibility,
    row.api
  ]);
  const widths = header.map((cell, column) =>
    Math.max(cell.length, ...body.map((cells) => cells[column]?.length ?? 0))
  );
  /** @param {readonly string[]} cells */
  const line = (cells) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join(' | ')} |`;
  return [
    line(header),
    line(widths.map((width) => '-'.repeat(width))),
    ...body.map(line)
  ].join('\n');
};

/**
 * `readme` with everything between the markers replaced by `content`.
 * @param {string} readme
 * @param {string} content
 */
export const spliceTable = (readme, content) => {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `${README} needs a ${START} line followed by a ${END} line.`
    );
  }
  return `${readme.slice(0, start + START.length)}\n\n${content}\n\n${readme.slice(end)}`;
};

/**
 * The gzipped bytes a consumer of `entry` ships: its JS chunks and the
 * stylesheets it imports, React aside.
 * @param {string} entry Relative to tests/compare.
 */
const measure = async (entry) => {
  const { build } = await import('vite');
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: fixtureRoot,
    build: {
      write: false,
      sourcemap: false,
      rollupOptions: {
        input: join(fixtureRoot, entry),
        external: REACT_EXTERNALS
      }
    }
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (bundle) => ('output' in bundle ? bundle.output : [])
  );
  return outputs.reduce((sum, item) => {
    if (item.type === 'chunk') return sum + gzipSync(item.code).length;
    if (item.fileName.endsWith('.css')) {
      return sum + gzipSync(item.source).length;
    }
    return sum;
  }, 0);
};

/**
 * The Version cell: the pinned install's version for a competitor, and none
 * for slidedeck's own package, which is measured from this repo's build. A
 * release bumps that package's version, and must not stale the table.
 * @param {string} name
 * @param {(name: string) => string} installed
 */
export const versionCell = (name, installed) =>
  name.startsWith('@slidedeck/') ? 'this repo' : installed(name);

/** @param {string} name */
const installedVersion = (name) =>
  JSON.parse(
    readFileSync(
      join(fixtureRoot, 'node_modules', name, 'package.json'),
      'utf8'
    )
  ).version;

const generate = async () => {
  const { libraries } = await import('../tests/compare/features.mjs');
  /** @type {Row[]} */
  const rows = [];
  for (const library of libraries) {
    rows.push({
      name: `\`${library.package}\``,
      version: versionCell(library.package, installedVersion),
      bytes: await measure(library.entry),
      nativeScroll: library.nativeScroll,
      accessibility: library.accessibility,
      api: library.api
    });
  }
  const sources = libraries.map(
    (library) => `- \`${library.package}\`: ${library.sources.join('; ')}.`
  );
  const { version: vite } = JSON.parse(
    readFileSync(join(repoRoot, 'node_modules/vite/package.json'), 'utf8')
  );
  return [
    `<!-- Generated by \`pnpm compare\` from tests/compare. Do not edit. -->`,
    '',
    renderTable(rows),
    '',
    `Min+gzip: each entry in \`tests/compare/entries\` is the same basic deck for all three, three slides with Previous and Next and no dots, bundled by Vite ${vite} with React external, minified, then gzipped, with the stylesheet the library needs. Each imports what its library documents: Keen's \`keen-slider/react\` has no exports map and resolves to its CommonJS build. Slidedeck's row is measured from this repo's build, so it has no version. The other columns, and where each was read:`,
    '',
    ...sources
  ].join('\n');
};

const main = async () => {
  const check = process.argv.includes('--check');
  const path = join(repoRoot, README);
  const before = readFileSync(path, 'utf8');
  const after = spliceTable(before, await generate());
  if (check) {
    if (before !== after) {
      console.error(
        `${README}'s comparison is stale. Run \`pnpm build && pnpm compare\` and commit the result.`
      );
      process.exit(1);
    }
    console.log(`${README}'s comparison matches a fresh run.`);
    return;
  }
  writeFileSync(path, after);
  console.log(`Wrote the comparison into ${README}.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
