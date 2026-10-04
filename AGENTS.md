# AGENTS.md

## Before landing anything

Run one command, from the repo root, and land only on green:

```sh
pnpm verify
```

It runs every gate in order and stops at the first failure: `format:check`,
`lint`, `typecheck`, `test` (vitest in browser mode), `build`,
`test:packages` (publint and attw on the packed tarballs), `size` and
`test:e2e` (Playwright with axe against storybook, in Chromium, Firefox and
WebKit). The list lives in `scripts/verify.mjs`.

CI (`.github/workflows/ci.yml`) runs the same `pnpm verify` on every pull
request and every push to `main`, so there is no second list to drift from
it. It does not replace running it locally; it catches the time you forgot.

Both browser suites drive Playwright's chromium, and the e2e suite also its
Firefox and WebKit. Install them once with
`pnpm exec playwright install chromium firefox webkit`.

`size` prints each package's gzipped size and never fails: bundle size is an
aim, not a gate (ADR-0001). Read the numbers; do not add a budget.

Formatting is checked, never written by the gate. Run
`pnpm exec prettier --write <files>` on the files you changed.

## Agent skills

### Issue tracker

Issues live in the repo itself — GitHub issues on pedrosousa13/slidedeck, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label names, as repo labels on pedrosousa13/slidedeck — plus `in-progress` and `P0`–`P3`, labels that stand in for a missing field. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
