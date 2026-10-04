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

**Snap target**:
An empty element an effect lays out along the axis for each slide, and for
each copy where the deck loops, when it stacks the slides in one place, as
fade does. It stands in for its slide or copy: the browser snaps to it, and
the slide's snap point, progress, focal position and in-view state are
measured from it. Not a slide.
_Avoid_: placeholder, spacer

**Page**:
A group of slides that snap together when a deck snaps in groups. Dots and the
counter count pages; with one slide per snap point, a page is a slide.
_Avoid_: group, set (a set is loop's word: see **Copy**)

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

**Copy**:
A duplicate of a slide that loop lays out before or after the slides, inert
and `aria-hidden`, so the deck can scroll on across the seam. Loop lays out
two _sets_ of copies, one before the slides and one after, each a copy of
every slide, so a set runs as far as the slides do. Once the deck rests on a
copy it jumps a set back to the identical slide. Not a slide: indexes, Dots
and Counter never count copies. "Clone and jump" (ADR-0006) is the name of
the technique; the elements are copies.
_Avoid_: clone

**Autoplay**:
The deck moving itself one snap point on, on an interval. _Stopped_ by the
user, the user moving the deck, focus entering the deck or a preference for
reduced motion, until the user starts it again; _paused_ only while a pointer
is over the deck or the document is hidden. It also stops where a step leaves
the deck at the same snap point, as at the last one of a deck that does not
loop. Autoplay that is on is _playing_, paused or not; playing and not
paused, it is _rotating_ the deck, the APG carousel's "slide rotation". Only
moves the user makes are announced.
_Avoid_: autoscroll, slideshow

### Outputs

**Progress**:
How far a slide is from the focal position, in slides, signed the way the deck
runs: 0 at the focal position, negative before it, positive after it, so 2.25
is two and a quarter slides on. When a slide sits exactly at the focal
position, every slide's progress is a whole number, unless an effect moves the
slide's box at the alignment point: scale about that point
(`transform-origin`). Published as `--deck-progress` for effects to read.
Never React state.
_Avoid_: offset, distance in pixels

**In view**:
A slide with any part showing in the viewport, partly shown included. Marked
`data-in-view`; it hides nothing. Never React state.
_Avoid_: visible, active

**Effect**:
A transition built on progress while the viewport keeps scrolling natively —
fade and curve are effects, not separate engines.
_Avoid_: transition mode, render mode
