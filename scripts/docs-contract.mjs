// Checks a docs package against deck.cool's docs contract
// (pedrosousa13/deck-cool, docs/docs-contract.md): the rules deck.cool's docs
// loader (its packages/docs) applies when it builds a deck's site from
// @slidedeck/docs. The checks are that loader's, copied, so a page that would
// fail deck.cool's build fails here first. It reads and reports; it rewrites
// nothing.

import { parseFrontmatter } from '@pagedeck/markdown-loader';
import { Marked, Tokenizer } from 'marked';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

/**
 * @typedef {{ file: string; line: number; message: string }} Fault
 * @typedef {{ label: string; pages: string[] }} NavGroup
 */

const EXTENSION = '.md';
const NAV = 'nav.json';
/** npm puts these in every package, so they are not pages. */
const NOT_PAGES = new Set(['readme.md', 'changelog.md', 'license.md']);
const SKIPPED_DIRECTORIES = new Set(['assets', 'node_modules']);

const MARKER = /^<!-- demo:([A-Za-z0-9_-]+) -->$/;
const MARKER_START = /<!--\s*demo:/;
const NOT_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|\/|#|$)/i;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto']);

/**
 * Every page's path from the package root, POSIX-spelled and sorted.
 * @param {string} root
 * @param {string} [directory]
 * @returns {string[]}
 */
export const pageFiles = (root, directory = root) => {
  /** @type {string[]} */
  const files = [];
  for (const dirent of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, dirent.name);
    if (dirent.isDirectory()) {
      if (!(directory === root && SKIPPED_DIRECTORIES.has(dirent.name))) {
        files.push(...pageFiles(root, absolute));
      }
      continue;
    }
    if (!dirent.isFile() || !dirent.name.endsWith(EXTENSION)) continue;
    if (directory === root && NOT_PAGES.has(dirent.name.toLowerCase())) {
      continue;
    }
    files.push(relative(root, absolute).split(sep).join(posix.sep));
  }
  return files.sort();
};

/**
 * The route a page is served at, under `/docs/`: `guides/index.md` and
 * `guides.md` are both `/docs/guides/`.
 * @param {string} file
 */
const routeOf = (file) => {
  const parts = file.slice(0, -EXTENSION.length).split('/');
  if (parts.at(-1) === 'index') parts.pop();
  return `/${['docs', ...parts].join('/')}/`;
};

/** @param {string} path */
const isFile = (path) => existsSync(path) && statSync(path).isFile();

/**
 * @param {unknown} value
 * @returns {value is NavGroup[]}
 */
const isNav = (value) =>
  Array.isArray(value) &&
  value.every(
    (group) =>
      typeof group === 'object' &&
      group !== null &&
      typeof group.label === 'string' &&
      Array.isArray(group.pages) &&
      group.pages.every(
        (/** @type {unknown} */ page) => typeof page === 'string'
      )
  );

/**
 * nav.json against the pages: every page listed once, every entry a page.
 * @param {string} root
 * @param {ReadonlySet<string>} pages
 * @returns {Fault[]}
 */
const navFaults = (root, pages) => {
  const path = join(root, NAV);
  if (!isFile(path)) {
    return [{ file: NAV, line: 1, message: 'is missing' }];
  }
  const text = readFileSync(path, 'utf8');
  /** @type {unknown} */
  let groups;
  try {
    groups = JSON.parse(text);
  } catch {
    groups = undefined;
  }
  if (!isNav(groups)) {
    return [
      {
        file: NAV,
        line: 1,
        message: 'is not a list of groups, each with a label and pages'
      }
    ];
  }
  /** @type {Fault[]} */
  const faults = [];
  const listed = new Set();
  let cursor = 0;
  for (const page of groups.flatMap((group) => group.pages)) {
    const at = text.indexOf(JSON.stringify(page), cursor);
    cursor = at === -1 ? cursor : at + 1;
    const line = text.slice(0, Math.max(at, 0)).split('\n').length;
    if (listed.has(page)) {
      faults.push({
        file: NAV,
        line,
        message: `lists "${page}" a second time`
      });
    } else if (!pages.has(page)) {
      faults.push({
        file: NAV,
        line,
        message: `lists "${page}", which is not a page`
      });
    }
    listed.add(page);
  }
  for (const page of pages) {
    if (!listed.has(page)) {
      faults.push({ file: page, line: 1, message: `is not listed in ${NAV}` });
    }
  }
  return faults;
};

/**
 * Where `raw` is in `body`, from `from` on. Inside a block quote or a list,
 * marked strips each line's `>` and indent from a token's text, so a line
 * break in `raw` matches one in the body followed by any of those.
 * @param {string} body
 * @param {string} raw
 * @param {number} from
 */
const locate = (body, raw, from) => {
  const pattern = raw
    .trimEnd()
    .split('\n')
    .map((line) => line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\n[ \\t>]*');
  const search = new RegExp(pattern, 'g');
  search.lastIndex = from;
  const match = search.exec(body);
  return match === null ? undefined : { at: match.index, text: match[0] };
};

/**
 * One page's faults: its frontmatter, its HTML (demo markers only), and each
 * link, image and definition.
 * @param {string} file
 * @param {string} text
 * @param {{ pages: ReadonlySet<string>; exists: (file: string) => boolean; demos: ReadonlySet<string> }} context
 * @returns {Fault[]}
 */
export const pageFaults = (file, text, context) => {
  const source = text.replace(/\r\n?/g, '\n');
  const { frontmatter, body } = parseFrontmatter(source, file);
  /** @type {Fault[]} */
  const faults = [];
  const firstLine = source.split('\n').length - body.split('\n').length + 1;
  /** @param {number} offset */
  const lineAt = (offset) =>
    firstLine + (body.slice(0, offset).match(/\n/g)?.length ?? 0);
  /** @param {number} offset @param {string} message */
  const fault = (offset, message) =>
    faults.push({ file, line: lineAt(offset), message });

  for (const field of ['title', 'description']) {
    const value = frontmatter[field];
    if (typeof value !== 'string' || value.trim() === '') {
      faults.push({
        file,
        line: 1,
        message: `has no "${field}" in its frontmatter`
      });
    }
  }

  // marked keeps a label's first definition and drops the rest without a
  // token, so every definition is recorded as it is read.
  /** @type {import('marked').Tokens.Def[]} */
  const definitions = [];
  const marked = new Marked({
    tokenizer: {
      /** @this {Tokenizer} @param {string} src */
      def(src) {
        const definition = Tokenizer.prototype.def.call(this, src);
        if (definition) definitions.push(definition);
        return false;
      }
    }
  });
  let offset = 0;
  for (const block of marked.lexer(body)) {
    let cursor = offset;
    marked.walkTokens([block], (token) => {
      if (
        token.type !== 'html' &&
        token.type !== 'link' &&
        token.type !== 'image' &&
        token.type !== 'def'
      ) {
        return;
      }
      const located = locate(body, token.raw, cursor);
      if (located === undefined) {
        fault(offset, `has ${token.type} the loader cannot find in the file`);
        return;
      }
      const { at, text } = located;
      cursor =
        token.type === 'link' || token.type === 'image'
          ? at + 1
          : at + text.length;

      if (token.type === 'html') {
        const html = /** @type {import('marked').Tokens.HTML} */ (token);
        if (!MARKER_START.test(html.raw)) {
          fault(at, `has raw HTML, ${html.raw.trim().split('\n')[0]}`);
          return;
        }
        const name = MARKER.exec(html.raw.trim())?.[1];
        if (!html.block || name === undefined) {
          fault(at, 'has a demo marker that is not on a line of its own');
        } else if (!context.demos.has(name)) {
          fault(at, `marks demo "${name}", which the site does not register`);
        }
        return;
      }

      const { href } = /** @type {{ href: string }} */ (token);
      // A reference-style link's destination is checked at its definition.
      if (
        token.type === 'link' &&
        token.raw.startsWith('[') &&
        !token.raw.includes('](')
      ) {
        return;
      }
      if (href.includes('&')) {
        fault(at, `links to "${href}", which holds a character reference`);
        return;
      }
      if (/^[/\\]{2}/.test(href)) {
        fault(at, `links to "${href}", which names no scheme`);
        return;
      }
      const scheme = SCHEME.exec(href)?.[1];
      if (scheme !== undefined && !ALLOWED_SCHEMES.has(scheme.toLowerCase())) {
        fault(at, `links to "${href}", a scheme the site does not allow`);
        return;
      }
      if (NOT_RELATIVE.test(href)) return;
      const hash = href.indexOf('#');
      const path = hash === -1 ? href : href.slice(0, hash);
      const target = posix.join(posix.dirname(file), path);
      if (token.type === 'image') {
        if (!target.startsWith('assets/') || !context.exists(target)) {
          fault(at, `shows "${href}", which is not a file under assets/`);
        }
      } else if (!target.endsWith(EXTENSION)) {
        fault(at, `links to "${href}", which is not a .md page`);
      } else if (!context.pages.has(target)) {
        fault(at, `links to "${href}", which is not a page in this package`);
      } else if (
        text.indexOf(href, text.indexOf(token.type === 'def' ? ']:' : '](')) ===
        -1
      ) {
        fault(at, `links to "${href}" in a form the loader cannot rewrite`);
      }
    });
    offset += block.raw.length;
  }

  const labels = new Set();
  let definitionCursor = 0;
  for (const definition of definitions) {
    const located = locate(body, definition.raw, definitionCursor);
    if (located !== undefined) {
      definitionCursor = located.at + located.text.length;
    }
    if (labels.has(definition.tag)) {
      fault(located?.at ?? 0, `defines [${definition.tag}] a second time`);
    }
    labels.add(definition.tag);
  }
  return faults;
};

/**
 * Every fault in the docs package at `root`, by file and then by line. `demos`
 * is every demo name the site registers.
 * @param {string} root
 * @param {{ demos: ReadonlySet<string> }} options
 * @returns {Fault[]}
 */
export const docsFaults = (root, { demos }) => {
  const files = pageFiles(root);
  const pages = new Set(files);
  const context = {
    pages,
    exists: (/** @type {string} */ file) => isFile(join(root, file)),
    demos
  };
  /** @type {Fault[]} */
  const faults = [...navFaults(root, pages)];
  /** @type {Map<string, string>} */
  const routes = new Map();
  for (const file of files) {
    const route = routeOf(file);
    const owner = routes.get(route);
    if (owner === undefined) routes.set(route, file);
    else {
      faults.push({
        file,
        line: 1,
        message: `has the route ${route}, as ${owner} does`
      });
    }
    faults.push(
      ...pageFaults(file, readFileSync(join(root, file), 'utf8'), context)
    );
  }
  return faults.sort((a, b) =>
    a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line
  );
};
