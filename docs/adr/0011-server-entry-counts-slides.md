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
