---
label: Effects
components: [example-fade, example-curve]
description: "slidedeck's two effects: fade crossfades slides in one place, curve fans them along an arc. Each is its own import, so a deck without one ships none of it."
---

# Effects: fade and curve

An effect is a value passed to `Deck.Viewport`'s `effect`, imported from its
own entry point. A deck that imports none ships none of their code. The
viewport keeps scrolling, snapping and dragging natively under both.

```tsx
import * as Deck from '@slidedeck/react';
import { curve } from '@slidedeck/react/curve';
import { fade } from '@slidedeck/react/fade';

export function Effects() {
  return (
    <>
      <Deck.Root aria-label="Crossfade">
        <Deck.Viewport effect={fade}>
          <Deck.Slide>One</Deck.Slide>
          <Deck.Slide>Two</Deck.Slide>
        </Deck.Viewport>
        <Deck.Prev />
        <Deck.Next />
      </Deck.Root>
      <Deck.Root aria-label="Showcase">
        <Deck.Viewport effect={curve}>
          <Deck.Slide>
            <div className="card">One</div>
          </Deck.Slide>
          <Deck.Slide>
            <div className="card">Two</div>
          </Deck.Slide>
        </Deck.Viewport>
      </Deck.Root>
    </>
  );
}
```

## Fade

**Fade** stacks the slides in one place and crossfades them by progress. Each
slide fills the viewport and snaps at its start, so slide width, alignment and
pages do not apply: a fade shows one slide at a time. Every slide but the
focal one is `inert`. Under reduced motion it cuts from one slide to the next
halfway instead of fading.

## Curve

**Curve** fans the slides along an arc around the focal slide and fades them
with their distance from it. The slides keep their size, gap, alignment and
pages. The arc is drawn on each slide's children, so give each slide one child
that fills it, styled as the slide is seen. The radius, in slides, is
`--deck-curve-radius` (default 4), set in CSS on the viewport. Each curve slide
has `contain: layout`, so a `position: fixed` element inside it is placed
against the slide. Under reduced motion the content stays flat and only fades.
To turn a radius in pixels into slides and leave the arc room in the
viewport, see [size a curve](/docs/recipes/size-a-curve/).

Both effects' styles are zero-specificity rules on `--deck-slide-progress`, so
your CSS overrides any of them. Server HTML already carries each slide's
starting progress, so an effect draws from the first paint, before any script
runs (see [server rendering](/docs/guides/server-rendering/)). To use an
effect on some screens only, see
[change `effect`, `loop` or `autoplay` per breakpoint](/docs/recipes/per-breakpoint/).
