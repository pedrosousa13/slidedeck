---
'@slidedeck/core': minor
'@slidedeck/react': minor
---

Add `Deck.useDeck()`, a hook that gives any component inside `Deck.Root` the deck's state and moves, so you can build Prev, Next, a counter or pagination from your own components. It returns `index`, `count` (`null` until the viewport is measured, as on the server), `loop`, `fits`, `canPrev`, `canNext`, and `scrollTo(index)`, `next()` and `prev()`. The values are the ones `Deck.Prev`, `Deck.Next` and `Deck.Counter` read, so a custom control and a built-in one agree; a move stops autoplay, as a built-in control does. It re-renders when the deck settles or its snap points change, never while it scrolls, and throws outside `Deck.Root`. Its return type is exported as `UseDeckResult`.
