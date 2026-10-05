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

## Agent skills

### Issue tracker

Issues live in the repo itself — GitHub issues on pedrosousa13/slidedeck, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label names, as repo labels on pedrosousa13/slidedeck — plus `in-progress` and `P0`–`P3`, labels that stand in for a missing field. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
