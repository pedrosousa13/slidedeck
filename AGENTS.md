# AGENTS.md

## Before landing anything

Run one command, from the repo root, and land only on green:

```sh
pnpm verify
```

It runs every gate in order and stops at the first failure: `format:check`,
`lint`, `typecheck`, `test` (vitest in browser mode), `test:scripts` (the
scripts' own tests), `build`, `docs:check` (the package README's code blocks
type-check), `compare:check` (the README's comparison table is fresh),
`test:packages` (publint and attw on the packed tarballs), `size` and
`test:e2e` (Playwright with axe against storybook, in Chromium, Firefox and
WebKit). The list lives in `scripts/verify.mjs`.

CI (`.github/workflows/ci.yml`) runs the same `pnpm verify` on every pull
request and every push to `main`, so there is no second list to drift from
it. It does not replace running it locally; it catches the time you forgot.

Both browser suites drive Playwright's Chromium, and the e2e suite also
drives its Firefox and WebKit. Install them once with
`pnpm exec playwright install chromium firefox webkit`. On Linux, Firefox and
WebKit also need system libraries: run `pnpm exec playwright install-deps
firefox webkit` once, or install with `--with-deps`.

`size` prints each package's gzipped size and never fails: bundle size is an
aim, not a gate (ADR-0001). Read the numbers; do not add a budget.

`compare:check` fails when the comparison in `packages/react/README.md` no
longer matches a fresh measurement: after a bump of a compared library in
`tests/compare`, or any change to `packages/*/src` that moves slidedeck's
gzipped size. Run `pnpm build && pnpm compare` and commit the new table. The
size is reported, never budgeted (ADR-0001): a bigger number is not a failure,
only a stale one is. A release does not stale it: slidedeck's row has no
version.

Formatting is checked, never written by the gate. Run
`pnpm exec prettier --write <files>` on the files you changed.

## Releasing

`@slidedeck/core` and `@slidedeck/react` release together at one version
(`fixed` in `.changeset/config.json`).

**A change that a consumer of either package can see needs a changeset**: a
fix, a feature, a changed prop or type, a changed package file. Run
`pnpm changeset`, pick the bump, write what changed for the consumer, and
commit the file with the change. Tests, docs outside the packages, CI and
scripts need none. Before 1.0, a breaking change is a `minor`.

**A release** is `.github/workflows/release.yml`, on every push to `main`. It
runs `pnpm verify` first, then:

- with changesets pending, it opens or updates the "Version packages" PR,
  which bumps the versions and writes the changelogs. Nothing is published.
- after that PR merges, it publishes the versions npm does not have yet, with
  provenance, from the tarballs the verify job packed, then tags them and
  creates the GitHub releases.

The version PR is opened with the workflow's `GITHUB_TOKEN`, and a PR that
token opens triggers no workflow, so `ci.yml` does not run on it. Its merge
runs the release workflow's own `pnpm verify` before anything is published.
If branch protection ever requires CI on it, close and reopen the PR, or push
an empty commit to its branch, to start `ci.yml`.

**One-time maintainer setup**, done only as far as step 2. Until the last
step, the jobs after `verify` show as skipped on every push, and nothing is
published:

1. In the repository's Settings, Actions, General, allow GitHub Actions to
   create and approve pull requests. Without it, the version job fails to
   open the PR.
2. Make the repository public. npm generates provenance only from a public
   repository, and both packages require it (`publishConfig.provenance`).
   Done: public since 2026-10-05.
3. Claim the `@slidedeck` scope on npm as an organization (#5).
4. Add an `NPM_TOKEN` repository secret for the first publish: a granular
   token that can publish the `@slidedeck` scope. npm configures trusted
   publishing per package, so a package must exist before it can have one.
5. Set the `RELEASE_ENABLED` repository variable to `true`.

With releases on, the publish job's first step fails loudly, before anything
reaches npm, if the repository is private or no credential can publish.

After the first publish, on npmjs.com add a trusted publisher to each
package: GitHub Actions, `pedrosousa13` / `slidedeck` / `release.yml`, no
environment. Then delete the `NPM_TOKEN` secret; later releases publish over
OIDC.

## Agent skills

### Issue tracker

Issues live in the repo itself — GitHub issues on pedrosousa13/slidedeck, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label names, as repo labels on pedrosousa13/slidedeck — plus `in-progress` and `P0`–`P3`, labels that stand in for a missing field. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
