# Native scroll snap is the engine, gated by a prototype

Slidedeck moves slides by letting the browser scroll a real scroll container
with CSS scroll snap. Embla and Keen move slides with transforms and their own
physics; Embla is ~7 KB, well built, and what shadcn wraps. Building another
transform engine would rebuild Embla and is unlikely to beat it, so the reason
slidedeck exists is what only native scrolling gives: the platform's momentum,
scroll restoration, scroll-driven animations, and focus or find-in-page
scrolling a slide into view.

The risk is that loop and mouse drag, both required in v1, are what native
scrollers do worst. So the engine is gated: a throwaway prototype must show
loop, mouse drag and the fade effect working on desktop Chrome, Firefox and
Safari and on a real iPhone, under a hard flick across the loop seam, before
any v1 work starts.

If the prototype fails, slidedeck does not write a transform engine. It
becomes accessible, composable primitives on top of Embla, or stops. Every v1
issue is blocked by the go/no-go decision so nothing is built on an engine that
has not been chosen.

Slidedeck must beat Embla and Keen on native scroll feel, built-in
accessibility, and a composable typed API. Bundle size is an aim, not a gate.
