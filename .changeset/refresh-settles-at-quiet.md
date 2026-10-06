---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

In Chromium, after slides are removed or shrink so that the deck rests past the new end, the deck could stop following its layout: a controlled deck did not go back to `index` once slides were added again, Dots and Counter kept the old count, and a switch of `effect` or `loop` did not keep the current slide. It happened where Chromium never ended the scroll that moves the deck back into range, as after a touch fling on another scroller was cut short by leaving the page. The deck now treats that scroll as part of the new layout, and settles a scroll that is not the user's once no scroll event has come for 100ms. A scroll of the user's still settles only at its own end.
