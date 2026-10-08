---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

Decks no longer come to rest short of where they were going in Safari. A move from a dot, Next, Prev or the handle could stop a snap point or more short of its target, an arrow key could leave the deck where it was, and a mouse drag could settle back where it began.

Two changes in every browser make this so. A move that seems to have stopped short now ends only once the browser has rendered a frame with the scroll stopped, so a browser that pauses rendering for a moment, as Safari can under load, carries the scroll on to its target. In a hidden tab, which renders no frame, a move still settles as before. A mouse drag now tracks where it has put the deck, so a scroll the browser makes on its own during the drag no longer moves it back, while a wheel or a scroll key the user turns or presses mid-drag, and a slide added or removed, still move the deck, and the drag goes on and is released from there.
