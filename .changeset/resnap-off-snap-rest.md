---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

A deck with mandatory snapping that comes to rest between snap points now moves to the nearest one, and then reports its index as usual. If the user's wheel or another scroll took over a move, it moves to the nearest one in that scroll's direction. With `loop`, it then jumps off a copy to its slide as usual. In Chromium, a long task on the page could leave a deck there, and the browser never snapped it back. Decks with proximity snapping stay where they rest. The deck never moves while a pointer is pressed on it, during a drag, or while a scroll is still going on.

The deck now measures its snap points as the browser rests the slides, `scroll-padding` and `scroll-margin` included, so a move to a slide with either set ends where the browser snaps it, at once.
