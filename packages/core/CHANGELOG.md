# @slidedeck/core

## 0.2.0

### Minor Changes

- 6a3621e: Add `Deck.useDeck()`, a hook that gives any component inside `Deck.Root` the deck's state and moves, so you can build Prev, Next, a counter or pagination from your own components. It returns `index`, `count` (`null` until the viewport is measured, as on the server), `loop`, `fits`, `canPrev`, `canNext`, and `scrollTo(index)`, `next()` and `prev()`. The values are the ones `Deck.Prev`, `Deck.Next` and `Deck.Counter` read, so a custom control and a built-in one agree; a move stops autoplay, as a built-in control does. It never re-renders while the deck scrolls, only when `Deck.Root` does: when the deck settles somewhere new, its snap points change or, with `autoplay`, autoplay starts, stops or pauses. It throws outside `Deck.Root`. Its return type is exported as `UseDeckResult`.

### Patch Changes

- 4891b56: A deck follows a change of `dir` on an ancestor after it mounts, as a locale switch makes, without a remount. It stays on its slide, at rest, a move in flight still arrives on its target, and Next, the arrow keys, a mouse drag and `--deck-slide-progress` go the new way. In Firefox and WebKit the deck went back to its first slide.
- 0318c28: The README gains recipes for setups that are CSS or a little of your own code, not options: centring the first and last slide without `loop`, highlighting the middle slide in view (centred, by `data-focal`, or at the start, by `--deck-slide-progress`), sizing a curve (a radius in pixels to `--deck-curve-radius` in slides, and the room the arc needs in the viewport), and custom controls and a counter built on `Deck.useDeck()`. They are linked from a Recipes index and from the sections they extend.
- 8340f43: A deck with mandatory snapping that comes to rest between snap points now moves to the nearest one, and then reports its index as usual. If the user's wheel or another scroll took over a move, it moves to the nearest one in that scroll's direction, and after a move cut short, in the move's direction. With `loop`, it then jumps off a copy to its slide as usual. In Chromium, a long task on the page could leave a deck there, and the browser never snapped it back. Decks with proximity snapping stay where they rest. The deck never moves while a pointer is pressed on it, during a drag, or while a scroll is still going on.

  The deck now measures its snap points as the browser rests the slides, `scroll-padding` and `scroll-margin` included, so a move to a slide with either set ends where the browser snaps it, at once.

- ea6ce7c: A deck keeps its place when `effect` or `loop` changes after it mounts, as when a media query picks them per breakpoint. It stays at its current index, at rest on its snap point, before the browser paints the new layout, with no `onIndexChange` and nothing announced; a move in flight ends on its target, and a deck a pointer holds still goes back once it lets go. Where the new layout has fewer snap points than the index needs, the deck rests on the last one and reports it. It went to another slide: fade's snap targets, or loop's copies in WebKit, moved the snap points under the viewport. The README gains a recipe, "Change `effect`, `loop` or `autoplay` per breakpoint", linked from Effects and Autoplay.

## 0.1.0

### Minor Changes

- 24534f7: The first release: a headless carousel for React 19 built on native CSS scroll snap. The browser scrolls, with its own momentum, snapping and focus scrolling; slidedeck tracks where the deck rests and asks the browser to move.

  - **Primitives**: `Deck.Root`, `Deck.Viewport`, `Deck.Slide`, `Deck.Prev`, `Deck.Next`, `Deck.Dots`, `Deck.Counter` and `Deck.AutoplayToggle`, composed as `import * as Deck from '@slidedeck/react'`. They work with no stylesheet.
  - **Layout is CSS**: slides per view, gap, alignment and their breakpoints are plain CSS, never props. Snap in pages by making only the first slide of each page a snap point; Dots and Counter then count pages.
  - **Current index**: uncontrolled with `defaultIndex`, controlled with `index` and `onIndexChange`, or imperative through `handleRef` (`scrollTo`, `next`, `prev`).
  - **Focal slide**: `data-focal`, `onFocalChange`, and `clickToFocus` to bring a clicked slide to the focal position.
  - **Loop**: `loop` runs on past the last snap point to the first with no visible jump, using `inert`, `aria-hidden` copies of the slides. `Deck.useSlide()` tells a slide's content its index and whether it is a copy, so content such as a video player can render differently in the copies.
  - **Drag**: a mouse drags the deck and a flick settles on the projected snap point; touch, pen and trackpad scroll natively. `drag={false}` turns it off.
  - **Autoplay**: `autoplay={ms}` with `Deck.AutoplayToggle`; it pauses at once when a pointer comes over the deck or the document is hidden, stops on focus or a user move, and starts stopped under reduced motion.
  - **Vertical and right-to-left**: `orientation="vertical"`, and the writing direction read from the viewport's computed `direction`, so `dir` on any ancestor applies.
  - **Progress and data attributes**: each slide's `--deck-slide-progress`, written every frame, and `data-*` state on every primitive, for CSS to read while the deck scrolls.
  - **Effects**: `fade` from `@slidedeck/react/fade` and `curve` from `@slidedeck/react/curve`, each its own entry point, so a deck ships only the effects it imports.
  - **Theme**: an optional `@slidedeck/react/theme.css` for the controls, every rule in `:where()` and every value a custom property. The autoplay toggle is filled with the accent while playing, and a dot that is not current changes under a pointer.
  - **Server rendering**: the primitives render on the server, and the deck starts at `defaultIndex` with no layout shift.
  - **Accessibility**: a carousel region with labelled slides, native buttons, a polite live region, keyboard scrolling on the viewport, focus moving into a slide bringing the deck to rest on that slide's page, even mid-move, focus within a slide or on the viewport leaving a move to arrive on the move's target snap point, and reduced-motion handling throughout.
  - **`@slidedeck/core`**: the framework-neutral engine the React package builds on.
