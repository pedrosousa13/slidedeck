# The index is controllable, and also imperative

`index` / `defaultIndex` / `onIndexChange` work like a React input, which makes
synced decks (thumbnails) two decks sharing state rather than a feature. A
`handleRef` also exposes `scrollTo(i)`, `next()` and `prev()` for event handlers
that should not round-trip through state. Both drive the same engine. The
handle has its own prop so that `ref` stays the region element, as on every
other primitive.
