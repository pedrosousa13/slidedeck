#!/usr/bin/env node
// Keeps the docs' code honest: the package README's and every page of the
// site's docs, under apps/site/docs. Every `ts` and `tsx` block in them is
// type-checked against the built packages, as a consumer's code is: a block
// that no longer compiles fails. A block after an `<!-- example: <path> -->`
// line must instead match that file in the repo byte for byte; the file is
// type-checked where it lives, as the playdeck recipe's story is. A `css`
// block after such a line is held to its file too, as a recipe's story
// imports it; other `css` blocks are not checked. Run
// `pnpm build` first: the blocks import the packages' built declarations.

import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const README = 'packages/react/README.md';
const SITE_DOCS = 'apps/site/docs';
// Inside the storybook app's node_modules, so the blocks resolve
// `@slidedeck/react` and `react` through installed packages, as a consumer's
// code does.
const OUT = 'apps/storybook/node_modules/.cache/docs-examples';

// A fence of three or more backticks or tildes, indented or not, and the
// first word of its info string: `tsx` in ```tsx title="a.tsx"`.
const FENCE = /^( *)(`{3,}|~{3,})\s*([^\s`]*)/;
const CLOSE = /^ *(`{3,}|~{3,})\s*$/;
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
    const indent = fence[1]?.length ?? 0;
    const opening = fence[2] ?? '```';
    const language = fence[3] ?? '';
    // Closed by a fence of the same character, at least as long.
    const close = lines.findIndex((l, j) => {
      const closing = j > i ? CLOSE.exec(l)?.[1] : undefined;
      return (
        closing !== undefined &&
        closing[0] === opening[0] &&
        closing.length >= opening.length
      );
    });
    if (close === -1) {
      throw new Error(`The code block on line ${i + 1} is never closed.`);
    }
    if (LANGUAGES.has(language) || (file !== undefined && language === 'css')) {
      // Each line loses as much of the fence's indent as it has.
      const code =
        lines
          .slice(i + 1, close)
          .map((l) => l.replace(new RegExp(`^ {0,${indent}}`), ''))
          .join('\n') + '\n';
      examples.push({ line: i + 2, language, code, file });
    }
    file = undefined;
    i = close;
  }
  return examples;
};

/**
 * The markdown files whose code is checked, relative to `root`: the package
 * README, then every `.md` under the site's docs, sorted.
 * @param {string} root
 * @returns {string[]}
 */
export const markdownFiles = (root) => [
  README,
  ...readdirSync(join(root, SITE_DOCS), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.md'))
    .map((file) => `${SITE_DOCS}/${file.split('\\').join('/')}`)
    .sort()
];

const main = () => {
  const sources = markdownFiles(repoRoot);
  /** @type {(Example & { source: string })[]} */
  const examples = sources.flatMap((source) =>
    extractExamples(readFileSync(join(repoRoot, source), 'utf8')).map(
      (example) => ({ ...example, source })
    )
  );
  const failures = [];

  for (const { source, line, file, code } of examples) {
    if (file === undefined) continue;
    if (readFileSync(join(repoRoot, file), 'utf8') !== code) {
      failures.push(`${source}:${line} differs from ${file}. Copy it in.`);
    }
  }

  const dir = join(repoRoot, OUT);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const checked = examples.filter((example) => example.file === undefined);
  for (const { source, line, language, code } of checked) {
    // Named for the file and line, so tsc's errors point back to them.
    const name = source.replace(/\.md$/, '').replaceAll('/', '_');
    writeFileSync(join(dir, `${name}-line-${line}.${language}`), code);
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
    failures.push('The code blocks do not type-check (above).');
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log(
    `${checked.length} code blocks in ${sources.length} files type-check, and ${
      examples.length - checked.length
    } match their files.`
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
