# AGENTS.md

## Before landing anything

Run one command, from the repo root, and land only on green:

```sh
pnpm verify
```

It runs every gate in order and stops at the first failure: `format:check`,
`lint`, `typecheck`, `test` (vitest in browser mode), `test:scripts` (the
scripts' own tests and the site's), `build`, `docs:check` (the code blocks in
the package README and the docs type-check), `compare:check` (the
README's and the docs' comparison table is fresh), `test:packages` (publint and attw on the
packed tarballs, and the React entries' `'use client'`), `test:next` (a Next.js
server component renders a deck from the packed tarballs), `size` and
`test:e2e` (Playwright with axe against storybook, in Chromium, Firefox and
WebKit). The list lives in `scripts/verify.mjs`.

On its first run, `test:next` installs Next.js into `tests/next-rsc` from
that fixture's own lockfile, so it needs the network once; later runs install
from the pnpm store.

CI (`.github/workflows/ci.yml`) runs the same `pnpm verify` on every pull
request and every push to `main`, so there is no second list to drift from
it. It does not replace running it locally; it catches the time you forgot.

Both browser suites drive Playwright's Chromium, and the e2e suite also
drives its Firefox and WebKit, and vitest its WebKit for the tests of what
WebKit alone does. Install them once with
`pnpm exec playwright install chromium firefox webkit`. On Linux, Firefox and
WebKit also need system libraries: run `pnpm exec playwright install-deps
firefox webkit` once, or install with `--with-deps`.

`size` prints each package's gzipped size and never fails: bundle size is an
aim, not a gate (ADR-0001). Read the numbers; do not add a budget.

`compare:check` fails when the comparison in `packages/react/README.md`, or
the same table at the end of `packages/docs/compare.md`, no longer matches a
fresh measurement: after a bump of a compared library in `tests/compare`, or
any change to `packages/*/src` that moves slidedeck's gzipped size. Run
`pnpm build && pnpm compare` and commit the new tables. The size is
reported, never budgeted (ADR-0001): a bigger number is not a failure, only a
stale one is. A release does not stale it: slidedeck's row has no version.

Formatting is checked, never written by the gate. Run
`pnpm exec prettier --write <files>` on the files you changed.

## Releasing

`@slidedeck/core`, `@slidedeck/react` and `@slidedeck/docs` release together
at one version (`fixed` in `.changeset/config.json`).

**A change that a consumer of either package can see needs a changeset**: a
fix, a feature, a changed prop or type, a changed package file. Run
`pnpm changeset`, pick the bump, write what changed for the consumer, and
commit the file with the change. Tests, docs outside the packages, CI and
scripts need none. A breaking change is a `major`. A change to
`packages/docs` alone needs none either: the docs are published at the
version of the code they describe, so the change ships with the next release.

**A release** is `.github/workflows/release.yml`, on every push to `main`. It
runs `pnpm verify` first, then:

- with changesets pending, it opens or updates the "Version packages" PR,
  which bumps the versions and writes the changelogs. Nothing is published.
- after that PR merges, it publishes the versions npm does not have yet, with
  provenance, from the tarballs the verify job packed, then tags them and
  creates the GitHub releases. Then `tell-deck-cool` sends
  pedrosousa13/deck-cool a `deck-released` dispatch with the version, with a token from the
  `deck-cool-releases` App (the `DECK_APP_ID` variable and the
  `DECK_APP_PRIVATE_KEY` secret). deck.cool bumps `@slidedeck/docs` and
  rebuilds slidedeck's docs from it. Its `bump-deck` run holds a version for a
  day; send the dispatch again after that, as deck-cool's AGENTS.md says.

The version PR is opened with the workflow's `GITHUB_TOKEN`, and a PR that
token opens triggers no workflow, so `ci.yml` does not run on it. Its merge
runs the release workflow's own `pnpm verify` before anything is published.
If branch protection ever requires CI on it, close and reopen the PR, or push
an empty commit to its branch, to start `ci.yml`.

**One-time maintainer setup**, all five steps done; 0.1.0 published on
2026-10-05. Until the last step, the jobs after `verify` show as skipped on
every push, and nothing is published:

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
OIDC. Done on 2026-10-07 (#79): releases now publish over OIDC only.

`@slidedeck/docs` (#133) is not on npm yet, and trusted publishing needs a
package to exist, so the publish job's first step refuses to publish while no
`NPM_TOKEN` is set. For its first release, add the `NPM_TOKEN` secret again
(step 4), let the release publish, add the docs package's trusted publisher,
and delete the secret.

## Docs

The docs are `packages/docs`, published as `@slidedeck/docs`: markdown,
`nav.json` and `assets/`, no code. deck.cool builds slidedeck's docs site
from the published package, so every page follows deck.cool's docs contract
(`docs/docs-contract.md` in pedrosousa13/deck-cool):

- every page has a `title` and a `description` in its frontmatter, and no
  `#` heading. A `label` is the site's shorter sidebar name for it.
- `nav.json` lists every page, in reading order, under its group.
- a link to another page is a relative link to its `.md` file.
- a live example is `<!-- demo:example-<name> -->` on its own line, where
  `<name>` is a file `apps/site/components/examples/<name>-example.tsx`. It is
  the only HTML a page may hold.
- a code block that must match a file in the repo follows an unused link
  definition to the file,
  `[example: <name>]: https://github.com/pedrosousa13/slidedeck/blob/main/<path>`.

`scripts/docs-contract.test.mjs`, in `test:scripts`, checks the package
against the contract with the rules deck.cool's docs loader applies.

## Site

The site is `apps/site`, a pagedeck site. Its docs pages read
`packages/docs` until slide.deck.cool replaces the site. `pnpm build` writes
it to `apps/site/site/`, with the `_headers` and `_redirects` that
`@pagedeck/adapter-cloudflare-pages` compiles from its routing, security
headers included.

**It deploys from CI**, in the `deploy-site` job of `ci.yml`, after `verify`
passes on the same commit. The job builds the site again, with no pnpm or turbo
cache, and uploads it with the pinned `wrangler` in `apps/site` to the
Cloudflare Pages project `slidedeck`, a Direct Upload project:

- a push to `main` deploys production, https://slidedeck.pages.dev.
- a pull request from this repository deploys a preview at
  `https://pr-<number>.slidedeck.pages.dev`, and keeps one comment on the
  pull request with that URL and the URL of the latest deployment.
- a pull request from a fork gets no secrets, so the job is skipped, and CI
  passes without a deploy.

It needs two repository secrets: `CLOUDFLARE_API_TOKEN`, a token with Account
· Cloudflare Pages · Edit, and `CLOUDFLARE_ACCOUNT_ID`. The job fails loudly,
before it uploads anything, if either is missing.

## Agent skills

### Issue tracker

Issues live in the repo itself — GitHub issues on pedrosousa13/slidedeck, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label names, as repo labels on pedrosousa13/slidedeck — plus `in-progress` and `P0`–`P3`, labels that stand in for a missing field. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
