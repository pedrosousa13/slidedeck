---
title: Loop
description: 'The loop prop runs a slidedeck deck past its last slide to the first with no visible jump, using inert copies of the slides on either side.'
---

`loop` makes the deck run on past the last snap point to the first, and back,
with no visible jump. Prev and Next are then never disabled, and a drag, flick
or wheel crosses the seam. `Deck.Viewport` renders a copy of every slide on
each side of the slides, `inert` and `aria-hidden`. Once the deck rests on a
copy, it jumps to the identical slide. Indexes, Dots, Counter, `data-current`
and `data-focal` count the slides only, never the copies. `scrollTo`, Dots
and a new controlled `index` go the direct way, within the slides. A deck
whose slides all fit does not loop. Content that must not run twice, such as
a video player, can render differently in a copy with `Deck.useSlide()`. See
[Known limits](./known-limits.md).

<!-- demo:example-loop -->
