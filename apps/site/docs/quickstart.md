---
components: [example-quickstart]
---

# Quickstart

```tsx
import * as Deck from '@slidedeck/react';

export function Featured() {
  return (
    <Deck.Root aria-label="Featured products">
      <Deck.Viewport>
        <Deck.Slide>Slide one</Deck.Slide>
        <Deck.Slide>Slide two</Deck.Slide>
        <Deck.Slide>Slide three</Deck.Slide>
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
      <Deck.Dots />
      <Deck.Counter />
    </Deck.Root>
  );
}
```

That is a working deck: one full-width slide per snap point, Prev and Next
buttons, a dot per page and a "1 / 3" counter. No stylesheet is needed. Give
`Deck.Root` an `aria-label`: it names the carousel region.
