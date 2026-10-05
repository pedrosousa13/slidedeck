#!/usr/bin/env node
// Keeps the package README's code honest. Every `ts` and `tsx` block in it is
// type-checked against the built packages, as a consumer's code is: a block
// that no longer compiles fails. A block after an `<!-- example: <path> -->`
// line must instead match that file in the repo byte for byte; the file is
// type-checked where it lives, as the playdeck recipe's story is. A `css`
// block after such a line is held to its file too, as a recipe's story
// imports it; other `css` blocks are not checked. Run
// `pnpm build` first: the blocks import the packages' built declarations.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const README = 'packages/react/README.md';
// Inside the storybook app's node_modules, so the blocks resolve
// `@slidedeck/react` and `react` through installed packages, as a consumer's
// code does.
const OUT = 'apps/storybook/node_modules/.cache/docs-examples';

const FENCE = /^```(\w*)\s*$/;
const MARKER = /^<!-- example: (\S+) -->$/;
const LANGUAGES = new Set(['ts', 'tsx']);

/**
 * @typedef {{
 *   line: number;
 *   language: string;
 *   code: string;
 *   file: string | undefined;
 * }} Example
 */

/**
 * The `ts` and `tsx` blocks in `markdown`, and the `css` blocks an example
 * marker names a file for, each with the line its code starts on and the file
 * a preceding example marker names, if any.
 * @param {string} markdown
 * @returns {Example[]}
 */
export const extractExamples = (markdown) => {
  const lines = markdown.split('\n');
  /** @type {Example[]} */
  const examples = [];
  /** @type {string | undefined} */
  let file;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? '';
    const marker = MARKER.exec(text);
    if (marker) {
      file = marker[1];
      continue;
    }
    const fence = FENCE.exec(text);
    if (!fence) continue;
    const language = fence[1] ?? '';
    const close = lines.findIndex((l, j) => j > i && FENCE.test(l));
    if (close === -1) {
      throw new Error(`The code block on line ${i + 1} is never closed.`);
    }
    if (LANGUAGES.has(language) || (file !== undefined && language === 'css')) {
      const code = lines.slice(i + 1, close).join('\n') + '\n';
      examples.push({ line: i + 2, language, code, file });
    }
    file = undefined;
    i = close;
  }
  return examples;
};

const main = () => {
  const examples = extractExamples(
    readFileSync(join(repoRoot, README), 'utf8')
  );
  const failures = [];

  for (const { line, file, code } of examples) {
    if (file === undefined) continue;
    if (readFileSync(join(repoRoot, file), 'utf8') !== code) {
      failures.push(`${README}:${line} differs from ${file}. Copy it in.`);
    }
  }

  const dir = join(repoRoot, OUT);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const checked = examples.filter((example) => example.file === undefined);
  for (const { line, language, code } of checked) {
    // Named for the README line, so tsc's errors point back to it.
    writeFileSync(join(dir, `README-line-${line}.${language}`), code);
  }
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      extends: join(repoRoot, 'tsconfig.base.json'),
      compilerOptions: {
        noEmit: true,
        types: [],
        // Each block is its own module, whether or not it imports.
        moduleDetection: 'force',
        // A stylesheet, such as the theme, has no types to find. Its export
        // is checked by the theme's own test and `pnpm test:packages`.
        noUncheckedSideEffectImports: false
      },
      include: ['*.ts', '*.tsx']
    })
  );
  try {
    execFileSync(
      process.execPath,
      [join(repoRoot, 'node_modules/typescript/bin/tsc'), '-p', dir],
      { cwd: repoRoot, stdio: 'inherit' }
    );
  } catch {
    failures.push(`${README}'s code blocks do not type-check (above).`);
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log(
    `${checked.length} code blocks in ${README} type-check, and ${
      examples.length - checked.length
    } match their files.`
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
