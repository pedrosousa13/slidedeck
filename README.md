# Slidedeck

A headless carousel for React 19 built on native CSS scroll snap: the browser
scrolls, and slidedeck tracks where the deck rests and asks it to move.

```sh
pnpm add @slidedeck/react
```

The documentation, with guides, the reference and recipes, each with a live
deck, is at [slidedeck.pages.dev/docs](https://slidedeck.pages.dev/docs/).
Its pages are markdown in [packages/docs](packages/docs), published as
`@slidedeck/docs` with each release. The package README,
[packages/react/README.md](packages/react/README.md), has a quickstart and a
comparison with Embla and Keen.

| Package                              | What it is                                      |
| ------------------------------------ | ----------------------------------------------- |
| [`@slidedeck/react`](packages/react) | The React primitives. The only one to install.  |
| [`@slidedeck/core`](packages/core)   | The framework-neutral engine `react` builds on. |
| [`@slidedeck/docs`](packages/docs)   | The docs as markdown, for deck.cool's site.     |

Contributing: run `pnpm verify` before landing anything (see
[AGENTS.md](AGENTS.md)). Decisions are recorded in [docs/adr](docs/adr), and
the project's vocabulary in [CONTEXT.md](CONTEXT.md).

MIT licensed.
