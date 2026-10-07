---
'@slidedeck/react': patch
---

`@slidedeck/react`, `@slidedeck/react/fade` and `@slidedeck/react/curve` now start with `'use client'`. In a React Server Components framework, such as the Next.js App Router, a server component can render the deck, with `effect={fade}` or `effect={curve}`, without a client component of your own. Function props such as `onIndexChange`, and a `ref` to the handle, still need a client component.
