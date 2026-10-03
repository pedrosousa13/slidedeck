# THROWAWAY: scroll-snap engine prototype

**This is not package code.** It answers ADR-0001's gate (issue #3): can a
native scroll-snap viewport loop, take a mouse drag and fade? Delete this
directory after the go/no-go decision. Nothing here is published, and none
of it is meant to be copied into `packages/` as is.

Findings: [`FINDINGS.md`](./FINDINGS.md).

## Pages

| Page                   | Technique                                                            |
| ---------------------- | -------------------------------------------------------------------- |
| `loop-clone-jump.html` | Copies at both ends; jump back by one set length at rest             |
| `loop-reposition.html` | No copies; move slides from the far end to the near end at rest      |
| `drag.html`            | Mouse drag on a plain deck (the loop pages and fade have it too)     |
| `fade.html`            | Slides stacked with `position: sticky`, opacity from scroll progress |

Every page has toggles for group snapping, vertical, RTL, mouse drag and the
drag handoff, plus technique-specific ones. Toggles are URL query
parameters, so a configuration is a link. The box under the deck is a live
jump detector, explained in `FINDINGS.md`.

## Run it

From the repo root:

```sh
pnpm --filter @slidedeck/proto-scroll-snap dev      # dev server
pnpm --filter @slidedeck/proto-scroll-snap build    # static dist/
pnpm --filter @slidedeck/proto-scroll-snap preview  # serve dist/ on :4173
```

`dist/` is plain HTML, JS and CSS with relative asset paths: it works served
from any origin root or subpath. To open it on a phone on the same network,
add `--host` to `dev` or `preview`.

## Measure it

```sh
pnpm exec playwright install chromium firefox webkit
pnpm --filter @slidedeck/proto-scroll-snap build
pnpm --filter @slidedeck/proto-scroll-snap measure
```

The suite in `measure/` drives each page in Playwright's chromium, firefox
and webkit and appends one JSON line per run to `measure-results/` (not
committed). It records what happened rather than asserting a verdict.
Playwright's WebKit is a proxy for desktop Safari, not iOS Safari.
