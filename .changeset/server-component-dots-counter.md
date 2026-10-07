---
'@slidedeck/react': patch
---

A deck rendered straight from a React server component now has Dots and Counter filled in its server HTML, one page per slide, as a deck in a client component does. They no longer render empty until hydration. `@slidedeck/react` now has a `react-server` export condition, which frameworks such as the Next.js App Router resolve for a server component: its `Deck.Root` counts the slides there. The exports, props and types do not change. In a server file, `Deck.Root` is now a server component, so passing it as a value to a client component, as in `as={Deck.Root}`, fails: import it in the client component instead.
