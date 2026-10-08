---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

In WebKit, a deck no longer comes to rest one snap point or more short of where it was going. When WebKit rendered no frame for a moment, as it can under load, a move from a dot, Next or Prev could stop short of its target, and an arrow key could leave the deck where it was. A move now ends only once a frame has rendered with the scroll stopped, so it goes on to its target when frames come back. A mouse drag also now settles where the pointer took the deck, even where WebKit scrolled the deck back during the drag, as it did on a vertical deck of photos. Chromium and Firefox behave as before.
