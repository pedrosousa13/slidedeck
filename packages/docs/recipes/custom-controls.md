---
title: Custom controls and a counter
description: "Build Previous, Next, a button per page and a counter from your own design system's components with Deck.useDeck(), behaving as the built-in controls do."
---

`Deck.useDeck()` (see [Hooks](../reference/hooks.md)) gives your own components what the
built-in controls read. Here Previous, Next, a button per page and a counter
are built from a design system's button, whose API is not a native button's:

<!-- demo:example-custom-controls -->

[example: custom-controls.tsx]: https://github.com/pedrosousa13/slidedeck/blob/main/apps/storybook/stories/recipes/custom-controls.tsx

```tsx
import * as Deck from '@slidedeck/react';
// Your design system's button.
import { Button } from './design-system';

/** Previous, Next, a button per page and a counter, from your own button. */
function Controls() {
  const { index, count, fits, canPrev, canNext, prev, next, scrollTo } =
    Deck.useDeck();
  // Every slide fits: there is nowhere to go.
  if (fits) return null;
  return (
    <div className="controls">
      <Button isDisabled={!canPrev} onPress={prev}>
        Previous
      </Button>
      {/* Pages, as Deck.Dots: none until the deck is measured. */}
      <div role="group" aria-label="Choose page">
        {Array.from({ length: count ?? 0 }, (_, page) => (
          <Button
            key={page}
            aria-label={`Go to page ${page + 1}`}
            aria-current={page === index ? 'true' : undefined}
            onPress={() => scrollTo(page)}
          >
            {page + 1}
          </Button>
        ))}
      </div>
      <span>{count !== null && `${index + 1} / ${count}`}</span>
      <Button isDisabled={!canNext} onPress={next}>
        Next
      </Button>
    </div>
  );
}

export function Products() {
  return (
    <Deck.Root aria-label="Featured slides">
      <Deck.Viewport>
        <Deck.Slide>One</Deck.Slide>
        <Deck.Slide>Two</Deck.Slide>
        <Deck.Slide>Three</Deck.Slide>
        <Deck.Slide>Four</Deck.Slide>
      </Deck.Viewport>
      <Controls />
    </Deck.Root>
  );
}
```

They do what the built-in controls do:

- They render nothing when every slide fits.
- Previous and Next are disabled at the ends, unless the deck loops.
- The page buttons are a group labelled "Choose page", the current page's
  marked `aria-current`, as `Deck.Dots`. There are none until the deck is
  measured: `count` is `null` on the server.
- `Deck.Root`'s live region still announces the slide the deck moves to, so
  the counter needs no live region of its own.
- A move stops autoplay, as a move with a built-in control does.

The story is `Recipes / Custom Controls`, where `./design-system` is a
stand-in.
