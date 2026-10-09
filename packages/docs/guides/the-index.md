---
label: The index
components: [example-controlled]
description: 'Read and set which snap point a slidedeck deck rests at: uncontrolled with defaultIndex, controlled with index and onIndexChange, or moved with its handle.'
---

# The index: controlled, uncontrolled and the handle

The current index is the snap point the viewport rests at. Uncontrolled, pass
`defaultIndex` and read changes with `onIndexChange`. Controlled, pass
`index` and `onIndexChange`, as with a React input's `value`:

```tsx
import { useState } from 'react';
import * as Deck from '@slidedeck/react';

export function Controlled() {
  const [index, setIndex] = useState(0);
  return (
    <>
      <Deck.Root aria-label="Photos" index={index} onIndexChange={setIndex}>
        <Deck.Viewport>
          <Deck.Slide>One</Deck.Slide>
          <Deck.Slide>Two</Deck.Slide>
          <Deck.Slide>Three</Deck.Slide>
        </Deck.Viewport>
      </Deck.Root>
      <button type="button" onClick={() => setIndex(2)}>
        Last photo
      </button>
    </>
  );
}
```

A controlled deck scrolls to a new `index`. A scroll that settles elsewhere
calls `onIndexChange`, and the deck returns to `index` unless the parent takes
the new one. `index` without `onIndexChange` compiles, as a read-only input,
and warns in development. `index` with `defaultIndex` is a type error. Two
decks that share one `index` state stay in step, as a main deck and its
thumbnail strip do.

## The handle

For event handlers that should not go through state, `handleRef` gives the
deck's moves:

```tsx
import { useRef } from 'react';
import * as Deck from '@slidedeck/react';

export function WithHandle() {
  const deck = useRef<Deck.RootHandle>(null);
  return (
    <>
      <Deck.Root aria-label="Steps" handleRef={deck}>
        <Deck.Viewport>
          <Deck.Slide>One</Deck.Slide>
          <Deck.Slide>Two</Deck.Slide>
        </Deck.Viewport>
      </Deck.Root>
      <button type="button" onClick={() => deck.current?.scrollTo(0)}>
        Back to the start
      </button>
    </>
  );
}
```

`scrollTo` clamps to the snap points there are. `ref` stays the region
element, as on every primitive. With pages, the index counts pages.

## When the index changes

`onIndexChange` and `onFocalChange` fire only when a scroll settles, never
during one, and not for where the deck starts. Scrolling never re-renders:
React state changes when the deck settles somewhere new (the index, the
current and focal slides, the live region's announcement), when the number
of snap points changes, and, on a deck with `autoplay`, when autoplay starts,
stops, or pauses for a pointer or a hidden tab.
