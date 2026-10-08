# A server entry counts the slides for a server component's deck

Root counts the slides in its Viewport on the first render, so Dots and
Counter render a page per slide in the server HTML (ADR-0003). Rendered
straight from a React server component, Root receives its Viewport as a
client reference, a lazy wrapper it cannot recognise, so Dots and Counter
rendered empty until hydration (#92, #94).

**`@slidedeck/react` has a `react-server` export condition.** React Server
Components frameworks, such as the Next.js App Router, resolve it for a
server component, and it resolves to `dist/server.js`. That entry has no
`'use client'`. Its `Deck.Root` is a server component; every other export is
the client entry's own. In the server component, `Deck.Viewport` is still the
client reference that the entry imports, so Root's slide walk recognises it
and counts its slides. The server Root then renders the client Root inside an
internal context that carries the count. The context is not exported. Its
provider is a client component in its own chunk, because a server component
cannot render a context.

**The client Root uses the count only where it cannot count the slides
itself.** It resets the context for its own children, so a deck nested in a
slide counts its own slides and not the outer deck's. The exports, props and
types do not change: `types` still resolves to the client entry's
declarations for every condition.

**A framework that does not resolve `react-server` gets the client entry.**
Root is then a client reference, as before, and Dots and Counter render empty
until hydration.

**One behaviour changes.** In a server file, `Deck.Root` is a server function,
not a client reference. Rendered as an element it works as before. Passed as a
value to a client component, as in `as={Deck.Root}`, it fails, because a
server function cannot cross to the client. A consumer who needs that imports
`Deck.Root` in a client component.

**Rejected:**

- A slide-count prop on Root. It changes the public API and repeats what the
  children already say.
- Viewport records its count during the render, for controls rendered after
  it. That is a side effect during render, and it depends on render order.
- Viewport renders the count-dependent markup or provides it by context. Dots
  and Counter are usually Viewport's siblings, not its children.
- CSS or another mechanism with no script. CSS counters could print "1 / 3"
  only after the Viewport in document order, and not as text in the DOM. CSS
  cannot create the Dots' buttons.
- Unwrap the lazy wrapper (`_payload`, `_init`). Those are React internals.
  `use()` accepts only promises and contexts, not a lazy.

## Server HTML carries the starting progress (amended for #125)

The engine writes `--deck-slide-progress` only once it has measured, in the
browser. Until then no slide had it, and CSS read its `var()` fallback, 0 in
fade's and curve's styles and in the docs' examples. A server-rendered curve
deck painted flat and jumped into its arc at hydration; slides scaled by
progress painted full size and then shrank.

**`Deck.Slide` renders the starting progress inline, from the first render,
server HTML included, on every deck.** It is the slide's distance in slides
from the slide the deck starts at, `index − start`, where `start` is the
starting index clamped to the slides, as `data-current` already counts it. A
loop's copy counts from its own place in the run: a set of slides after its
slide, or before it. Server HTML and the client's first render emit the same
value, so hydration has nothing to correct. The engine's first measured
write is the same wherever every slide is one snap point, the slides are the
same size, and the starting slide can reach the focal position, so nothing
changes at hydration. Elsewhere, as with slides of different sizes, pages
that start past the first, or a start the scroll range keeps from the focal
position, the estimate is near the measured value, never worse than every
slide at 0, and the engine corrects it in the layout effect that mounts it,
before the first frame after hydration.

**React never writes it over the engine's.** React writes a style property
only where its value differs from React's own last render. The value derives
only from the starting index, frozen on mount, and the slide's place in the
order, none of which change as the deck scrolls, so nothing is added to the
scroll, pointer or drag paths. A slide that moves to a new place gets its new
place's starting value, so `Deck.Viewport` refreshes the engine when the
slides change order, as it already does when they change in number, and the
engine paints over it before the frame is drawn.

**Rejected:** only decks with an effect. It fixed fade and curve, but left
the same flash in consumer CSS on progress without an effect, as the docs'
own progress example and middle-slide recipe show.
