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

**Orientation**:
The axis a deck runs along: horizontal or vertical, set by the `orientation`
prop.
_Avoid_: direction, axis mode

**Writing direction**:
Left-to-right or right-to-left, read from the document's computed `direction`.
Next moves toward the inline end.
_Avoid_: left/right for start/end

### Position

**Snap point**:
A scroll position the viewport can come to rest at, as the browser computes it
from the slides' `scroll-snap-align`.

**Page**:
A group of slides that snap together when a deck snaps in groups. Dots and the
counter count pages; with one slide per snap point, a page is a slide.
_Avoid_: group, set

**Current index**:
The index of the snap point the viewport is resting at. What `index`,
`defaultIndex` and `onIndexChange` refer to. Where several slides share a snap
point, the first paint of a server-rendered `defaultIndex` may correct.
_Avoid_: active slide, selected slide

**Current slide**:
The first slide resting at the current index's snap point, marked
`data-current`. With one slide per snap point, the slide at the current index.
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
How far a slide is from the focal position, in slides, signed the way the deck
runs: 0 at the focal position, negative before it, positive after it, so 2.25
is two and a quarter slides on. When a slide sits exactly at the focal
position, every slide's progress is a whole number. Published as `--deck-progress` for effects to read. Never
React state.
_Avoid_: offset, distance in pixels

**In view**:
A slide with any part showing in the viewport, partly shown included. Marked
`data-in-view`; it hides nothing. Never React state.
_Avoid_: visible, active

**Effect**:
A transition built on progress while the viewport keeps scrolling natively —
fade and curve are effects, not separate engines.
_Avoid_: transition mode, render mode
