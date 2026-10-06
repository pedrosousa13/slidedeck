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

**A move after the report (amended for #75).** A parent that takes the index
from `onIndexChange` never undoes a move started since. Measured in WebKit
under load: a press can come after the deck settles and reports its index,
but before React renders the parent taking it, and the deck went back to the
reported index, so the press was lost. Now that move goes on, and settles and
reports as any other. A deck at rest away from the taken `index`, as after
the user's scroll back in the same gap, still goes to it. So an imperative
call made inside `onIndexChange`, as `setIndex(1)` and then
`handle.scrollTo(3)`, now goes on to 3, where before the deck returned to 1.
