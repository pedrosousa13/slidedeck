# The index is controllable, and also imperative

`index` / `defaultIndex` / `onIndexChange` work like a React input, which makes
synced decks (thumbnails) two decks sharing state rather than a feature. A
`handleRef` also exposes `scrollTo(i)`, `next()` and `prev()` for event handlers
that should not round-trip through state. Both drive the same engine. The
handle has its own prop so that `ref` stays the region element, as on every
other primitive.

`index` without `onIndexChange` compiles, as a read-only input does: the deck
returns to `index` after every scroll, and development warns. `index` with
`defaultIndex` stays a compile error. A parent that takes the new `index`
asynchronously, as in a transition, sees the deck briefly return to the old
one before it moves, as a React input does.

A controlled `index` counts pages, so when a breakpoint changes the page size
the same `index` points at different slides: a parent that adopts
`onIndexChange` keeps the visible slide, and one that refuses returns the deck
to `index`.
