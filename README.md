# Slidedeck

A headless carousel for React 19 built on native CSS scroll snap: the browser
scrolls, and slidedeck tracks where the deck rests and asks it to move.

```sh
pnpm add @slidedeck/react
```

The documentation, a quickstart, a recipe that plays a playdeck video in the
focal slide and a comparison with Embla and Keen are in the package README:
[packages/react/README.md](packages/react/README.md).

| Package                              | What it is                                      |
| ------------------------------------ | ----------------------------------------------- |
| [`@slidedeck/react`](packages/react) | The React primitives. The only one to install.  |
| [`@slidedeck/core`](packages/core)   | The framework-neutral engine `react` builds on. |

Contributing: run `pnpm verify` before landing anything (see
[AGENTS.md](AGENTS.md)). Decisions are recorded in [docs/adr](docs/adr), and
the project's vocabulary in [CONTEXT.md](CONTEXT.md).

MIT licensed.
