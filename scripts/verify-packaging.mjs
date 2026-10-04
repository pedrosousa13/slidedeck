#!/usr/bin/env node
// Packs every publishable package and checks the tarball -- what npm would
// actually ship -- with publint and attw.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { publishablePackages } from './workspace-packages.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** @param {string[]} args */
const pnpm = (args) =>
  execFileSync('pnpm', args, { cwd: repoRoot, stdio: 'inherit' });

/** @param {string[]} args */
const passes = (args) => {
  try {
    pnpm(args);
    return true;
  } catch {
    return false;
  }
};

/**
 * The built files `file` imports, statically or dynamically, and theirs, with
 * itself: all a consumer who imports it ships.
 * @param {string} file
 * @param {Set<string>} [seen]
 */
const importGraph = (file, seen = new Set()) => {
  if (seen.has(file)) return seen;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  for (const [, specifier] of source.matchAll(
    /(?:\bfrom|\bimport\s*\(?)\s*["'](\.{1,2}\/[^"']+)["']/g
  )) {
    importGraph(normalize(join(dirname(file), specifier)), seen);
  }
  return seen;
};

const packages = publishablePackages(repoRoot);
const failures = [];

// Turbo replays a cached build, so this costs nothing after `pnpm build`.
pnpm(['exec', 'turbo', 'run', 'build', '--filter=./packages/*']);

for (const { manifest, path } of packages) {
  const { name } = manifest;

  // A subpath entry, such as an effect, ships only to a consumer who imports
  // it: the main entry must never reach it.
  const main = importGraph(join(path, manifest.exports['.'].default));
  for (const [subpath, entry] of Object.entries(manifest.exports)) {
    if (subpath === '.') continue;
    if (main.has(join(path, entry.default))) {
      failures.push(`${name} ships ${subpath} from its main entry`);
    }
  }

  const destination = mkdtempSync(join(tmpdir(), 'slidedeck-pack-'));
  try {
    pnpm(['--filter', name, 'pack', '--pack-destination', destination]);
    const tarball = join(destination, readdirSync(destination)[0]);

    console.log(`\n--- publint: ${name} ---`);
    if (!passes(['exec', 'publint', 'run', '--strict', tarball])) {
      failures.push(`publint failed for ${name}`);
    }

    // ESM only by design: the esm-only profile stops attw reporting the
    // CommonJS and node10 resolution modes these packages do not support.
    console.log(`\n--- attw: ${name} ---`);
    if (!passes(['exec', 'attw', '--pack', tarball, '--profile', 'esm-only'])) {
      failures.push(`attw failed for ${name}`);
    }
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log(`\n${packages.length} packages pass publint and attw.`);
