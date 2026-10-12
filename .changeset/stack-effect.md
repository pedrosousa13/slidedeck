---
'@slidedeck/react': minor
---

A new effect, `stack` from `@slidedeck/react/stack`, stacks the slides in one place, as cards, and orders them by progress: the focal slide on top, the slides after it behind it, and a slide leaving drops to the back halfway. It ships no appearance: the look and the throw are your CSS on `--deck-slide-progress`, as the card stack recipe in the docs shows.

Every slide and copy now carries `--deck-slide-count`, the number of slides, copies not counted, set inline from the first render, so server HTML has it.
