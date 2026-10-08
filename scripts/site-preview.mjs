#!/usr/bin/env node
// The CI workflow's `deploy-site` job, after `wrangler pages deploy`. Reads
// the deployment wrangler recorded in `WRANGLER_OUTPUT_FILE_PATH` and prints
// its URLs. On a pull request (`PR_NUMBER` set) it also writes them into one
// comment on the pull request, and updates that comment on later pushes.
//
// Node's built-ins and the `gh` CLI only. `gh` reads `GH_TOKEN`.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Marks the comment this script owns, so a later push finds it.
const MARKER = '<!-- slidedeck-site-preview -->';

/**
 * The URLs of the Pages deployment in wrangler's output file: `url` for this
 * deployment only, `alias` for the branch, which later deploys move.
 * @param {string} output newline-delimited JSON
 * @returns {{ url: string, alias: string }}
 */
export const pagesDeployment = (output) => {
  const entry = output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line))
    .find((record) => record.type === 'pages-deploy-detailed');
  if (!entry) {
    throw new Error('wrangler recorded no Pages deployment in its output.');
  }
  return { url: entry.url, alias: entry.alias };
};

/**
 * @param {{ url: string, alias: string, sha: string }} deployment
 */
export const previewComment = ({ url, alias, sha }) =>
  [
    MARKER,
    `**Site preview:** ${alias}`,
    '',
    `This commit, ${sha}: ${url}`
  ].join('\n');

/**
 * Updates the comment that carries the marker, or creates it if there is none.
 * @param {{
 *   comments: { id: number, body: string }[];
 *   body: string;
 *   create: (body: string) => void;
 *   update: (id: number, body: string) => void;
 * }} options
 */
export const upsertPreviewComment = ({ comments, body, create, update }) => {
  const own = comments.find((comment) => comment.body.startsWith(MARKER));
  if (own) update(own.id, body);
  else create(body);
};

/** @param {string} name */
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
};

/** @param {string[]} args */
const gh = (args) => execFileSync('gh', ['api', ...args], { encoding: 'utf8' });

const main = () => {
  const deployment = pagesDeployment(
    readFileSync(required('WRANGLER_OUTPUT_FILE_PATH'), 'utf8')
  );
  console.log(`Deployed ${deployment.url}, aliased ${deployment.alias}`);

  const pr = process.env.PR_NUMBER;
  if (!pr) return;
  const repo = required('GITHUB_REPOSITORY');
  const comments = gh([
    '--paginate',
    `repos/${repo}/issues/${pr}/comments`,
    '--jq',
    '.[] | {id, body}'
  ])
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line));
  upsertPreviewComment({
    comments,
    body: previewComment({ ...deployment, sha: required('HEAD_SHA') }),
    create: (body) => {
      gh([`repos/${repo}/issues/${pr}/comments`, '-f', `body=${body}`]);
    },
    update: (id, body) => {
      gh([
        '-X',
        'PATCH',
        `repos/${repo}/issues/comments/${id}`,
        '-f',
        `body=${body}`
      ]);
    }
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
