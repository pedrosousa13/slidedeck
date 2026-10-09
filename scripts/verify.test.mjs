import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { CI_JOBS, ciJobs, gatesFor, plan, STEPS } from './verify.mjs';

const steps = (/** @type {string[]} */ argv) =>
  plan(argv).map(({ step }) => step);

const read = (/** @type {string} */ path) =>
  readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

test('with no arguments, every step runs, in order, with no arguments', () => {
  assert.deepEqual(
    plan([]),
    STEPS.map((step) => ({ step, args: [] }))
  );
});

test('--only runs the steps named, in the list order, not the order given', () => {
  assert.deepEqual(steps(['--only', 'lint,format:check']), [
    'format:check',
    'lint'
  ]);
  assert.deepEqual(steps(['--only=build,docs:check']), ['build', 'docs:check']);
});

test('--only refuses a step not in the list, and names it', () => {
  assert.throws(() => plan(['--only', 'lint,tset']), /unknown step `tset`/);
  assert.throws(() => plan(['--only', '']), /--only needs/);
  assert.throws(() => plan(['--only']), /--only needs/);
});

test('--project goes to test:e2e alone', () => {
  assert.deepEqual(plan(['--only', 'lint,test:e2e', '--project=webkit']), [
    { step: 'lint', args: [] },
    { step: 'test:e2e', args: ['--project=webkit'] }
  ]);
  assert.deepEqual(plan(['--project', 'firefox', '--only', 'test:e2e']), [
    { step: 'test:e2e', args: ['--project=firefox'] }
  ]);
});

test('--project with no test:e2e to take it is refused', () => {
  assert.throws(
    () => plan(['--only', 'lint', '--project=chromium']),
    /--project needs test:e2e/
  );
});

test('--shard goes to test alone', () => {
  assert.deepEqual(plan(['--only', 'lint,test', '--shard=2/4']), [
    { step: 'lint', args: [] },
    { step: 'test', args: ['--shard=2/4'] }
  ]);
  assert.throws(
    () => plan(['--only', 'lint', '--shard=1/4']),
    /--shard needs test/
  );
  // A change that needs no vitest runs nothing, rather than fail on --shard.
  assert.deepEqual(
    plan(['--job', 'unit', '--shard=1/4', '--changed'], () => ['README.md']),
    []
  );
});

test('an unknown argument is refused', () => {
  assert.throws(() => plan(['--onyl', 'lint']), /unknown argument `--onyl`/);
});

test('--job runs that CI job’s steps', () => {
  assert.deepEqual(steps(['--job', 'next']), ['test:next']);
  assert.deepEqual(steps(['--job=e2e', '--project=webkit']), ['test:e2e']);
  assert.throws(() => plan(['--job', 'nope']), /unknown CI job `nope`/);
  assert.throws(
    () => plan(['--job', 'unit', '--only', 'lint']),
    /--job and --only/
  );
});

// Path-to-gate mapping: which gates a change to these paths needs.

const SITE_SPECS = [
  'e2e/docs.spec.ts',
  'e2e/examples.spec.ts',
  'e2e/seo.spec.ts',
  'e2e/site.spec.ts'
];
const gateNames = (/** @type {string[]} */ paths) =>
  gatesFor(paths).map(({ step }) => step);

test('a change to a package, the lockfile or root config needs every gate', () => {
  for (const path of [
    'packages/react/src/index.tsx',
    'packages/react/README.md',
    'pnpm-lock.yaml',
    'package.json',
    'tsconfig.base.json',
    'playwright.config.ts'
  ]) {
    assert.deepEqual(
      gatesFor([path]),
      STEPS.map((step) => ({ step, args: [] })),
      path
    );
  }
});

test('a path no rule matches needs every gate', () => {
  for (const path of ['tests/compare/features.mjs', 'prototypes/x/y.ts']) {
    assert.deepEqual(gateNames([path]), STEPS, path);
  }
});

test('a change to the site needs its checks and its e2e specs', () => {
  assert.deepEqual(gatesFor(['apps/site/docs/index.md']), [
    { step: 'format:check', args: [] },
    { step: 'lint', args: [] },
    { step: 'typecheck', args: [] },
    // apps/site/lib's tests run in test:scripts.
    { step: 'test:scripts', args: [] },
    { step: 'build', args: [] },
    { step: 'docs:check', args: [] },
    { step: 'compare:check', args: [] },
    { step: 'test:e2e', args: SITE_SPECS }
  ]);
  assert.deepEqual(
    gatesFor(['e2e/seo.spec.ts']).find(({ step }) => step === 'test:e2e'),
    { step: 'test:e2e', args: SITE_SPECS }
  );
});

test('a change to storybook or its spec needs the build and the deck spec', () => {
  for (const path of [
    'apps/storybook/stories/deck.stories.tsx',
    'e2e/deck.spec.ts'
  ]) {
    assert.deepEqual(
      gatesFor([path]),
      [
        { step: 'format:check', args: [] },
        { step: 'lint', args: [] },
        { step: 'typecheck', args: [] },
        { step: 'build', args: [] },
        { step: 'test:e2e', args: ['e2e/deck.spec.ts'] }
      ],
      path
    );
  }
});

test('a change to CI or a script needs the checks and the scripts’ tests', () => {
  for (const path of [
    '.github/workflows/ci.yml',
    'scripts/verify.mjs',
    'scripts/site-preview.test.mjs'
  ]) {
    assert.deepEqual(
      gateNames([path]),
      ['format:check', 'lint', 'typecheck', 'test:scripts'],
      path
    );
  }
});

test('a change to a script a gate runs needs every gate', () => {
  for (const path of [
    'scripts/verify-packaging.mjs',
    'scripts/workspace-packages.mjs'
  ]) {
    assert.deepEqual(gateNames([path]), STEPS, path);
  }
});

test('every script a gate runs is one that needs every gate', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  for (const step of STEPS) {
    for (const [file] of String(scripts[step]).matchAll(
      /scripts\/[\w.-]+\.mjs/g
    )) {
      assert.deepEqual(gateNames([file]), STEPS, `${step} runs ${file}`);
    }
  }
});

test('markdown and docs outside the site need format:check alone', () => {
  for (const path of [
    'README.md',
    'AGENTS.md',
    'docs/adr/0001-size.md',
    '.changeset/quick-fox.md'
  ]) {
    assert.deepEqual(gateNames([path]), ['format:check'], path);
  }
});

test('several paths need the union of their gates, in list order', () => {
  assert.deepEqual(
    gatesFor(['README.md', 'scripts/verify.mjs', 'apps/storybook/x.tsx']),
    [
      { step: 'format:check', args: [] },
      { step: 'lint', args: [] },
      { step: 'typecheck', args: [] },
      { step: 'test:scripts', args: [] },
      { step: 'build', args: [] },
      { step: 'test:e2e', args: ['e2e/deck.spec.ts'] }
    ]
  );
  // The site's specs and storybook's are every spec: no filter.
  assert.deepEqual(gatesFor(['apps/site/a.ts', 'apps/storybook/b.ts']).at(-1), {
    step: 'test:e2e',
    args: []
  });
  assert.deepEqual(
    gatesFor(['apps/site/a.ts', 'packages/core/src/a.ts']),
    STEPS.map((step) => ({ step, args: [] }))
  );
});

test('no changed paths need no gate', () => {
  assert.deepEqual(gatesFor([]), []);
});

test('the site’s and storybook’s specs are every e2e spec', () => {
  const specs = readdirSync(fileURLToPath(new URL('../e2e', import.meta.url)))
    .filter((file) => file.endsWith('.spec.ts'))
    .map((file) => `e2e/${file}`);
  const covered = new Set(
    [...SITE_SPECS, 'e2e/deck.spec.ts'].flatMap(
      (spec) =>
        gatesFor([spec]).find(({ step }) => step === 'test:e2e')?.args ?? []
    )
  );
  assert.deepEqual([...covered].sort(), specs.sort());
});

// --changed: the gates the paths changed since a ref need.

test('--changed runs the gates the changed paths need', () => {
  /** @type {string[]} */
  const refs = [];
  const changed = (/** @type {string} */ ref) => {
    refs.push(ref);
    return ['README.md', 'scripts/verify.mjs'];
  };
  assert.deepEqual(
    plan(['--changed'], changed).map(({ step }) => step),
    ['format:check', 'lint', 'typecheck', 'test:scripts']
  );
  plan(['--changed=HEAD^1'], changed);
  assert.deepEqual(refs, ['main', 'HEAD^1']);
});

test('--changed with --only or --job runs what both ask for', () => {
  const changed = () => ['apps/site/index.md'];
  assert.deepEqual(
    plan(['--job', 'e2e', '--project=firefox', '--changed'], changed),
    [{ step: 'test:e2e', args: [...SITE_SPECS, '--project=firefox'] }]
  );
  assert.deepEqual(
    plan(['--only', 'lint,test', '--changed'], changed).map(({ step }) => step),
    ['lint']
  );
  // A job the change needs nothing of runs nothing, rather than fail on
  // --project.
  assert.deepEqual(
    plan(['--job', 'e2e', '--project=firefox', '--changed'], () => [
      'README.md'
    ]),
    []
  );
});

test('ciJobs says which CI jobs have a step to run', () => {
  assert.deepEqual(ciJobs(plan([])), {
    checks: true,
    unit: true,
    packages: true,
    next: true,
    e2e: true
  });
  assert.deepEqual(ciJobs(gatesFor(['README.md'])), {
    checks: true,
    unit: false,
    packages: false,
    next: false,
    e2e: false
  });
  assert.deepEqual(ciJobs(gatesFor(['e2e/deck.spec.ts'])), {
    checks: true,
    unit: false,
    packages: false,
    next: false,
    e2e: true
  });
});

test('vitest, test:packages and test:next each have a CI job of their own', () => {
  assert.deepEqual(CI_JOBS.unit, ['test']);
  assert.deepEqual(CI_JOBS.packages, ['test:packages']);
  assert.deepEqual(CI_JOBS.next, ['test:next']);
});

// CI runs the same list, split into jobs.

test("the union of CI's jobs is the whole list, each step once", () => {
  const all = Object.values(CI_JOBS).flat();
  assert.deepEqual(
    STEPS.filter((step) => all.includes(step)),
    STEPS,
    `no CI job runs: ${STEPS.filter((step) => !all.includes(step)).join(', ')}`
  );
  assert.equal(all.length, STEPS.length, 'a step is in two CI jobs');
});

const ci = read('.github/workflows/ci.yml');

test('ci.yml runs every CI job, and no other', () => {
  const jobs = [...ci.matchAll(/pnpm verify --job (\S+)/g)].map(
    (match) => /** @type {string} */ (match[1])
  );
  assert.deepEqual(jobs.sort(), Object.keys(CI_JOBS).sort());
});

test("ci.yml's unit matrix is every shard of one count", () => {
  const matrix = ci.match(/^\s+shard: \[([^\]]*)\]$/m)?.[1];
  assert.ok(matrix, 'ci.yml has no `shard: [...]` matrix');
  const shards = matrix.split(',').map((shard) => shard.trim());
  assert.deepEqual(
    shards,
    shards.map((_, i) => `${i + 1}/${shards.length}`)
  );
  assert.match(ci, /pnpm verify --job unit --shard="\$SHARD"/);
});

test("ci.yml's e2e matrix is every Playwright project", async () => {
  const configUrl = pathToFileURL(
    fileURLToPath(new URL('../playwright.config.ts', import.meta.url))
  ).href;
  const config = (await import(configUrl)).default;
  const projects = config.projects.map(
    (/** @type {{ name: string }} */ project) => project.name
  );
  const matrix = ci.match(/^\s+project: \[([^\]]*)\]$/m)?.[1];
  assert.ok(matrix, 'ci.yml has no `project: [...]` matrix');
  assert.deepEqual(
    matrix.split(',').map((name) => name.trim()),
    projects
  );
});
