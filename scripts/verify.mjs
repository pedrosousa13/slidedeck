#!/usr/bin/env node
// Every gate, in one command that stops at the first failure and names it.
// CI runs this same command (.github/workflows/ci.yml), so a gate added here
// runs in CI too, and there is no second list to keep in step with it.
//
// Assumes `pnpm install` has run and Playwright's chromium is installed
// (`pnpm exec playwright install chromium`): vitest's browser mode and the
// e2e suite both drive it.

import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const STEPS = [
  'format:check',
  'lint',
  'typecheck',
  'test',
  'build',
  'test:packages',
  // A report, never a failure: see scripts/bundle-size.mjs.
  'size',
  'test:e2e'
];

for (const step of STEPS) {
  console.log(`\n> ${step}`);
  try {
    execFileSync('pnpm', [step], { cwd: repoRoot, stdio: 'inherit' });
  } catch (error) {
    const code = /** @type {{ status?: unknown } | undefined} */ (error)
      ?.status;
    const status = typeof code === 'number' ? code : 1;
    console.error(`\nverify: step \`${step}\` failed (exit ${status})`);
    process.exit(status);
  }
}
console.log(`\nAll ${STEPS.length} verify steps passed.`);
