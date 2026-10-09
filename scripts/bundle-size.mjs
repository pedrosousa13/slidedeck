#!/usr/bin/env node
// Prints the gzipped size of every publishable package's built entries. A
// report, never a gate: bundle size is an aim, not a limit (ADR-0001), so
// this exits 0 whatever the numbers are. Run it after `pnpm build`.

import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { publishablePackages } from './workspace-packages.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * The built files `file` imports statically, and theirs, with itself: what a
 * consumer who imports it always ships, shared chunks included.
 * @param {string} file
 * @param {Set<string>} [seen]
 */
const staticGraph = (file, seen = new Set()) => {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const [, specifier] of readFileSync(file, 'utf8').matchAll(
    /(?:\bfrom|\bimport)\s*["'](\.{1,2}\/[^"']+)["']/g
  )) {
    staticGraph(normalize(join(dirname(file), specifier)), seen);
  }
  return seen;
};

// One row per entry point, with the chunks it imports: an effect's own entry
// is shipped only by a deck that imports it, so it is measured apart from the
// main one.
const rows = publishablePackages(repoRoot).flatMap((pkg) =>
  // The docs package has no code, so no entry point.
  Object.entries(pkg.manifest.exports ?? {}).map(([subpath, entry]) => {
    const source = Buffer.concat(
      [...staticGraph(join(pkg.path, entry.default))].map((file) =>
        readFileSync(file)
      )
    );
    return {
      name: join(pkg.manifest.name, subpath),
      raw: source.length,
      gzip: gzipSync(source).length
    };
  })
);

const width = Math.max(...rows.map((row) => row.name.length));
/** @param {number} bytes */
const kb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`.padStart(9);

console.log(
  `${'package'.padEnd(width)}  ${'raw'.padStart(9)}  ${'gzip'.padStart(9)}`
);
for (const row of rows) {
  console.log(`${row.name.padEnd(width)}  ${kb(row.raw)}  ${kb(row.gzip)}`);
}
