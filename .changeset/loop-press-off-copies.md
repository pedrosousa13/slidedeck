---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

A looping deck no longer runs out of copies when swipes or drags come faster than it comes to rest. Each swipe carried on from the momentum of the one before, so the deck never rested, never jumped back off the copies, and stopped at an end of its scroll range after a few swipes, on an iPhone and with a mouse in Chrome. Now a touch or pen pressed on the viewport while it is on the copies, or a mouse drag starting there, moves the deck back one set of slides, to the same place among them, before the swipe or drag goes on. Nothing shows: the index stays the same, `onIndexChange` does not fire, nothing is announced, focus stays where it is, and `--deck-slide-progress` and `data-in-view` read as before. A mouse click, and a tap during a move, change nothing.

A touch that the browser turns into a pan now holds the deck until the finger lifts. Before, a deck that came to rest under the finger, at the end of a move or a fling, jumped off a copy and reported its index as the pan began.

A looping deck with centred slides at an end of its scroll range, as after a hard drag or flick, stayed there on the copies, off its slides' snap points, and reported a slide it did not show. It now moves to the nearest snap point within the scroll range, and then jumps back onto its slide as usual.
