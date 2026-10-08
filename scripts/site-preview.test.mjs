import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  pagesDeployment,
  previewComment,
  upsertPreviewComment
} from './site-preview.mjs';

// What `wrangler pages deploy` 4.148.0 wrote to WRANGLER_OUTPUT_FILE_PATH for
// a deploy to the `wf-test` branch, one JSON object per line.
const OUTPUT = [
  '{"type":"wrangler-session","version":1,"wrangler_version":"4.148.0","command_line_args":["pages","deploy","site"],"timestamp":"2026-10-08T08:58:37.985Z"}',
  '{"type":"pages-deploy","version":1,"pages_project":"slidedeck","deployment_id":"1fc7a892-74b1-484b-9bc0-9c91c9119bd3","url":"https://1fc7a892.slidedeck.pages.dev","timestamp":"2026-10-08T08:58:48.012Z"}',
  '{"type":"pages-deploy-detailed","version":1,"pages_project":"slidedeck","deployment_id":"1fc7a892-74b1-484b-9bc0-9c91c9119bd3","url":"https://1fc7a892.slidedeck.pages.dev","alias":"https://wf-test.slidedeck.pages.dev","environment":"preview","production_branch":"main","timestamp":"2026-10-08T08:58:48.012Z"}',
  ''
].join('\n');

test('pagesDeployment reads the deployment and alias URLs', () => {
  assert.deepEqual(pagesDeployment(OUTPUT), {
    url: 'https://1fc7a892.slidedeck.pages.dev',
    alias: 'https://wf-test.slidedeck.pages.dev'
  });
});

test('pagesDeployment throws when wrangler recorded no deployment', () => {
  const session = OUTPUT.split('\n')[0];
  assert.throws(() => pagesDeployment(session), /no Pages deployment/);
});

const deployment = {
  url: 'https://1fc7a892.slidedeck.pages.dev',
  alias: 'https://pr-7.slidedeck.pages.dev'
};

test('previewComment names the alias, the deployment and the commit', () => {
  const body = previewComment({ ...deployment, sha: 'abc1234def' });
  assert.match(body, /https:\/\/pr-7\.slidedeck\.pages\.dev/);
  assert.match(body, /https:\/\/1fc7a892\.slidedeck\.pages\.dev/);
  assert.match(body, /abc1234def/);
});

const person = { login: 'pedrosousa13', type: 'User' };
const bot = { login: 'github-actions[bot]', type: 'Bot' };

/**
 * A pull request's comments, in memory.
 * @param {{ id: number, body: string, user: { login: string, type: string } }[]} comments
 */
const fakePr = (comments) => {
  /** @type {string[]} */
  const created = [];
  /** @type {{ id: number, body: string }[]} */
  const updated = [];
  return {
    created,
    updated,
    comments,
    /** @param {string} body */
    create: (body) => {
      created.push(body);
    },
    /** @param {number} id @param {string} body */
    update: (id, body) => {
      updated.push({ id, body });
    }
  };
};

test('upsertPreviewComment creates the comment on a first deploy', () => {
  const pr = fakePr([{ id: 1, body: 'Looks good.', user: person }]);
  const body = previewComment({ ...deployment, sha: 'abc' });
  upsertPreviewComment({ ...pr, body });
  assert.deepEqual(pr.created, [body]);
  assert.deepEqual(pr.updated, []);
});

test('upsertPreviewComment updates its own comment on a later push', () => {
  const earlier = previewComment({ ...deployment, sha: 'abc' });
  const pr = fakePr([
    { id: 1, body: 'Looks good.', user: person },
    { id: 2, body: earlier, user: bot }
  ]);
  const body = previewComment({ ...deployment, sha: 'def' });
  upsertPreviewComment({ ...pr, body });
  assert.deepEqual(pr.created, []);
  assert.deepEqual(pr.updated, [{ id: 2, body }]);
});

test('upsertPreviewComment leaves a comment from a person alone, marker or not', () => {
  const quoted = previewComment({ ...deployment, sha: 'abc' });
  const pr = fakePr([{ id: 3, body: quoted, user: person }]);
  const body = previewComment({ ...deployment, sha: 'def' });
  upsertPreviewComment({ ...pr, body });
  assert.deepEqual(pr.created, [body]);
  assert.deepEqual(pr.updated, []);
});
