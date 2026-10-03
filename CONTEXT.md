# Slidedeck

A headless carousel for React 19 built on native scroll snap: the browser
scrolls, and slidedeck tracks where it landed and asks it to go elsewhere. A
framework-neutral core holds the engine; the React package holds the
primitives a consumer composes. The project's language separates what a
consumer composes (primitives), where the scroller can rest (snap points,
pages), which slide the deck is about (current, focal), and what slidedeck
publishes for CSS to read (progress).

**Security sweeps: declined by the maintainer.**

Slidedeck is a client-only UI library: it accepts no untrusted input beyond
the React children its consumer passes, serves nothing, authenticates no one,
stores nothing and calls no third-party service. Decided 2026-10-03 when the
repo was created; revisit if the project gains a hosted service.

## Language

### Composition

**Deck**:
One carousel instance: a scroller, its slides and the controls bound to it.
Consumers import the primitives as `import * as Deck from '@slidedeck/react'`.
_Avoid_: carousel instance, slider

**Primitive**:
An exported React component a consumer composes into a deck, such as
`Deck.Viewport` or `Deck.Next`.
_Avoid_: component, widget

**Viewport**:
The native scroll container. Scroll snap, momentum and focus scrolling all
happen here, in the browser.
_Avoid_: track, container

**Slide**:
One child of the viewport the consumer supplies. Its size is plain CSS.

### Position

**Snap point**:
A scroll position the viewport can come to rest at, as the browser computes it
from the slides' `scroll-snap-align`.

**Page**:
A group of slides that snap together when a deck snaps in groups. Dots and the
counter count pages; with one slide per snap point, a page is a slide.
_Avoid_: group, set

**Current index**:
The index of the snap point the viewport is resting at. What `index` and
`onIndexChange` refer to. `defaultIndex` names a slide instead, because server
HTML can only start at a slide: the deck starts at the snap point that slide
rests at. With one slide per snap point the two are the same.
_Avoid_: active slide, selected slide

**Focal slide**:
The slide sitting at the snap alignment point — the one the deck is "about".
Distinct from the current index when several slides are in view. Exposed as
`data-focal` and `onFocalChange`.
_Avoid_: highlighted slide, active slide, centre slide

**Loop**:
Scrolling past the last snap point arrives at the first, and back, with no
visible jump.
_Avoid_: infinite, wrap-around

### Outputs

**Progress**:
How far a slide is from the focal position, published as a CSS custom property
for effects to read. Never React state.

**Effect**:
A transition built on progress while the viewport keeps scrolling natively —
fade and curve are effects, not separate engines.
_Avoid_: transition mode, render mode
