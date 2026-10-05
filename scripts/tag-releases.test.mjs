import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backoff, changelogSection, tagReleases } from './tag-releases.mjs';

const CHANGELOG = [
  '# @slidedeck/core',
  '',
  '## 0.2.0',
  '',
  '- Newer.',
  '',
  '## 0.1.0',
  '',
  '- Older.'
].join('\n');

const core = {
  name: '@slidedeck/core',
  version: '0.2.0',
  changelog: CHANGELOG
};
const react = { name: '@slidedeck/react', version: '0.2.0', changelog: '' };

/**
 * A registry, a GitHub and a clock that live in memory. `appearsAfter` maps a
 * tag to the number of checks npm answers "not found" before it serves it;
 * a tag missing from it is never served.
 * @param {Record<string, number>} appearsAfter
 * @param {string[]} [released] tags that already have a GitHub release
 */
const fakes = (appearsAfter, released = []) => {
  /** @type {Record<string, number>} */
  const checks = {};
  /** @type {{ tag: string, notes: string }[]} */
  const created = [];
  /** @type {number[]} */
  const slept = [];
  /** @type {string[]} */
  const logged = [];
  return {
    checks,
    created,
    slept,
    logged,
    /** @param {string} name @param {string} version */
    isOnNpm: async (name, version) => {
      const tag = `${name}@${version}`;
      checks[tag] = (checks[tag] ?? 0) + 1;
      const after = appearsAfter[tag];
      return after !== undefined && checks[tag] > after;
    },
    /** @param {string} tag */
    hasRelease: (tag) =>
      released.includes(tag) || created.some((c) => c.tag === tag),
    /** @param {string} tag @param {string} notes */
    createRelease: (tag, notes) => {
      created.push({ tag, notes });
    },
    /** @param {number} ms */
    sleep: async (ms) => {
      slept.push(ms);
    },
    /** @param {string} line */
    log: (line) => {
      logged.push(line);
    }
  };
};

test('a version published in this run is tagged once npm shows it', async () => {
  const f = fakes({ '@slidedeck/core@0.2.0': 3, '@slidedeck/react@0.2.0': 1 });
  await tagReleases({
    releases: [core, react],
    published: [core, react],
    delays: [10, 20, 40, 60, 60],
    ...f
  });
  assert.deepEqual(
    f.created.map((c) => c.tag),
    ['@slidedeck/react@0.2.0', '@slidedeck/core@0.2.0']
  );
  assert.deepEqual(f.checks, {
    '@slidedeck/core@0.2.0': 4,
    '@slidedeck/react@0.2.0': 2
  });
  // Three waits: the first check and three more for core.
  assert.deepEqual(f.slept, [10, 20, 40]);
});

test('a version npm never shows fails the run, by name, once the wait runs out', async () => {
  const f = fakes({ '@slidedeck/core@0.2.0': 0 });
  await assert.rejects(
    tagReleases({
      releases: [core, react],
      published: [core, react],
      delays: [10, 20, 40],
      ...f
    }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /@slidedeck\/react@0\.2\.0/);
      assert.doesNotMatch(error.message, /@slidedeck\/core/);
      return true;
    }
  );
  // Core, on npm at once, is still tagged.
  assert.deepEqual(
    f.created.map((c) => c.tag),
    ['@slidedeck/core@0.2.0']
  );
  assert.deepEqual(f.slept, [10, 20, 40]);
  assert.equal(f.checks['@slidedeck/react@0.2.0'], 4);
});

test('with nothing published in this run, npm is checked once and nothing waits', async () => {
  const f = fakes({ '@slidedeck/core@0.2.0': 0 });
  await tagReleases({
    releases: [core, react],
    published: [],
    delays: [10, 20, 40],
    ...f
  });
  assert.deepEqual(
    f.created.map((c) => c.tag),
    ['@slidedeck/core@0.2.0']
  );
  assert.deepEqual(f.checks, {
    '@slidedeck/core@0.2.0': 1,
    '@slidedeck/react@0.2.0': 1
  });
  assert.deepEqual(f.slept, []);
  assert.ok(
    f.logged.includes('@slidedeck/react@0.2.0 is not on npm; not tagged.')
  );
});

test('only the versions published in this run are waited for', async () => {
  const f = fakes({ '@slidedeck/react@0.2.0': 2 });
  await tagReleases({
    releases: [core, react],
    published: [react],
    delays: [10, 20, 40],
    ...f
  });
  assert.deepEqual(
    f.created.map((c) => c.tag),
    ['@slidedeck/react@0.2.0']
  );
  assert.equal(f.checks['@slidedeck/core@0.2.0'], 1);
});

test('a version that already has a release is not released again', async () => {
  const f = fakes({ '@slidedeck/core@0.2.0': 0 }, ['@slidedeck/core@0.2.0']);
  await tagReleases({
    releases: [core],
    published: [],
    delays: [],
    ...f
  });
  assert.deepEqual(f.created, []);
  assert.ok(f.logged.includes('@slidedeck/core@0.2.0 already has a release.'));
});

test("a release's notes are its version's changelog section", async () => {
  const f = fakes({ '@slidedeck/core@0.2.0': 0 });
  await tagReleases({ releases: [core], published: [], delays: [], ...f });
  assert.deepEqual(f.created, [
    { tag: '@slidedeck/core@0.2.0', notes: '- Newer.' }
  ]);
});

test('changelogSection stops at the next version, and is empty for a missing one', () => {
  assert.equal(changelogSection(CHANGELOG, '0.1.0'), '- Older.');
  assert.equal(changelogSection(CHANGELOG, '0.3.0'), '');
});

test('backoff doubles up to its cap and adds up to the total exactly', () => {
  assert.deepEqual(
    backoff({ first: 10, max: 60, total: 600 }),
    [10, 20, 40, 60, 60, 60, 60, 60, 60, 60, 60, 50]
  );
  const delays = backoff({ first: 10_000, max: 60_000, total: 600_000 });
  assert.equal(
    delays.reduce((sum, delay) => sum + delay, 0),
    600_000
  );
});

test('during the wait, an npm error counts as "not yet", and the last one is named at the end', async () => {
  // Core: a 503, a timeout, then found. React: a 429 every time.
  /** @type {Record<string, (string | boolean)[]>} */
  const answers = {
    '@slidedeck/core@0.2.0': ['HTTP 503', 'no answer: timed out', true],
    '@slidedeck/react@0.2.0': ['HTTP 429', 'HTTP 429', 'HTTP 429', 'HTTP 429']
  };
  const f = fakes({});
  await assert.rejects(
    tagReleases({
      releases: [core, react],
      published: [core, react],
      delays: [10, 20, 40],
      ...f,
      isOnNpm: async (name, version) => {
        const answer = answers[`${name}@${version}`]?.shift();
        if (typeof answer === 'string') throw new Error(answer);
        return answer === true;
      }
    }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(
        error.message,
        /@slidedeck\/react@0\.2\.0 \(npm's last answer: HTTP 429\)/
      );
      assert.doesNotMatch(error.message, /@slidedeck\/core/);
      return true;
    }
  );
  assert.deepEqual(
    f.created.map((c) => c.tag),
    ['@slidedeck/core@0.2.0']
  );
  assert.deepEqual(f.slept, [10, 20, 40]);
});

test('an npm error for a version not published in this run fails at once', async () => {
  const f = fakes({});
  await assert.rejects(
    tagReleases({
      releases: [core],
      published: [],
      delays: [10, 20, 40],
      ...f,
      isOnNpm: async () => {
        throw new Error('HTTP 503');
      }
    }),
    /HTTP 503/
  );
  assert.deepEqual(f.slept, []);
});
