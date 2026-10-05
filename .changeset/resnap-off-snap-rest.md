---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

A deck with mandatory snapping that comes to rest between snap points now moves to the nearest one, and then reports its index as usual. If the user's wheel or another scroll took over a move, it moves to the nearest one in that scroll's direction. With `loop`, it then jumps off a copy to its slide as usual. In Chromium, a long task on the page could leave a deck there, and the browser never snapped it back. Decks with proximity snapping stay where they rest. The deck never moves while a pointer is pressed on it, during a drag, or while a scroll is still going on.

When a wheel or a key takes over a move, the deck now settles even if the scroll then stops with no end event, for example because page script stopped it.
