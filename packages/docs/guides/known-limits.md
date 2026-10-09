---
description: "Known limits of slidedeck: loop copies render a slide's children again, fade ignores slide geometry, and the first paint estimates progress from each index."
---

# Known limits

- **A loop copy renders the slide's children again.** Their state is their
  own, effects and refs in them run once per copy, and an `id` inside a slide
  repeats three times. Avoid `id`s in looping slides, or make them unique
  outside the slide. `Deck.useSlide()` tells content whether it is in a copy.
- **Presses beyond the reachable copies are dropped.** A step goes at most a
  set of copies past either end. When presses come faster than the deck
  moves, the deck passes fewer slides than were pressed, rather than moving
  against a press or jumping mid-motion. At rest, a press always moves it one
  snap point.
- **Fade ignores slide geometry.** Slide width, alignment and pages do not
  apply to a fade deck.
- **Curve draws on the slides' children**, not the slide box: a slide's own
  background and border stay flat.
- **Server HTML can only start at a slide.** With several slides per snap
  point, or pages, the first paint at a `defaultIndex` may correct after
  hydration, and Dots and Counter recount.
- **The first paint estimates progress from the slide's index.** Server HTML
  gives each slide its distance in slides from the starting slide. With
  slides of different sizes, pages that start past the first, or a start the
  scroll range keeps from the focal position, as at the end of a centred deck
  with no padding, an effect or CSS on progress can move slightly at
  hydration, when the engine measures.
- **A controlled index counts pages**, so a breakpoint that changes the page
  size points the same index at different slides.
- **A long task can let Chromium undo a wheel.** When a long task holds the
  main thread just after a wheel during a move, Chromium can carry the move
  on to its slide, against the wheel. The deck still rests on a snap point.
- **Touch flicks across a loop's seam are not covered by automated tests**;
  they are checked by hand on a phone and a trackpad.
