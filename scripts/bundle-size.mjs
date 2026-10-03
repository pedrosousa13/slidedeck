#!/usr/bin/env node
// Prints the gzipped size of every publishable package's built entry. A
// report, never a gate: bundle size is an aim, not a limit (ADR-0001), so
// this exits 0 whatever the numbers are. Run it after `pnpm build`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { publishablePackages } from './workspace-packages.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const rows = publishablePackages(repoRoot).map((pkg) => {
  const entry = pkg.manifest.exports['.'].default;
  const source = readFileSync(join(pkg.path, entry));
  return {
    name: pkg.manifest.name,
    raw: source.length,
    gzip: gzipSync(source).length
  };
});

const width = Math.max(...rows.map((row) => row.name.length));
/** @param {number} bytes */
const kb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`.padStart(9);

console.log(
  `${'package'.padEnd(width)}  ${'raw'.padStart(9)}  ${'gzip'.padStart(9)}`
);
for (const row of rows) {
  console.log(`${row.name.padEnd(width)}  ${kb(row.raw)}  ${kb(row.gzip)}`);
}
