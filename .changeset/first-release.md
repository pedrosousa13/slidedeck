---
'@slidedeck/core': minor
'@slidedeck/react': minor
---

The first release: a headless carousel for React 19 built on native CSS scroll snap. The browser scrolls, with its own momentum, snapping and focus scrolling; slidedeck tracks where the deck rests and asks the browser to move.

- **Primitives**: `Deck.Root`, `Deck.Viewport`, `Deck.Slide`, `Deck.Prev`, `Deck.Next`, `Deck.Dots`, `Deck.Counter` and `Deck.AutoplayToggle`, composed as `import * as Deck from '@slidedeck/react'`. They work with no stylesheet.
- **Layout is CSS**: slides per view, gap, alignment and their breakpoints are plain CSS, never props. Snap in pages by making only the first slide of each page a snap point; Dots and Counter then count pages.
- **Current index**: uncontrolled with `defaultIndex`, controlled with `index` and `onIndexChange`, or imperative through `handleRef` (`scrollTo`, `next`, `prev`).
- **Focal slide**: `data-focal`, `onFocalChange`, and `clickToFocus` to bring a clicked slide to the focal position.
- **Loop**: `loop` runs on past the last snap point to the first with no visible jump, using `inert`, `aria-hidden` copies of the slides. `Deck.useSlide()` tells a slide's content its index and whether it is a copy, so content such as a video player can render differently in the copies.
- **Drag**: a mouse drags the deck and a flick settles on the projected snap point; touch, pen and trackpad scroll natively. `drag={false}` turns it off.
- **Autoplay**: `autoplay={ms}` with `Deck.AutoplayToggle`; it pauses on hover and in a hidden tab, stops on focus or a user move, and starts stopped under reduced motion.
- **Vertical and right-to-left**: `orientation="vertical"`, and the writing direction read from the viewport's computed `direction`, so `dir` on any ancestor applies.
- **Progress and data attributes**: each slide's `--deck-slide-progress`, written every frame, and `data-*` state on every primitive, for CSS to read while the deck scrolls.
- **Effects**: `fade` from `@slidedeck/react/fade` and `curve` from `@slidedeck/react/curve`, each its own entry point, so a deck ships only the effects it imports.
- **Theme**: an optional `@slidedeck/react/theme.css` for the controls, every rule in `:where()` and every value a custom property. The autoplay toggle is filled with the accent while playing, and a dot that is not current changes under a pointer.
- **Server rendering**: the primitives render on the server, and the deck starts at `defaultIndex` with no layout shift.
- **Accessibility**: a carousel region with labelled slides, native buttons, a polite live region, keyboard scrolling on the viewport, focus moving into a slide bringing the deck to rest on it, even mid-move, and reduced-motion handling throughout.
- **`@slidedeck/core`**: the framework-neutral engine the React package builds on.
