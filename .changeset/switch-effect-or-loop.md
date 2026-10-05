---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

A deck keeps its place when `effect` or `loop` changes after it mounts, as when a media query picks them per breakpoint. It stays at its current index, at rest on its snap point, before the browser paints the new layout, with no `onIndexChange` and nothing announced; a move in flight ends on its target, and a deck a pointer holds still goes back once it lets go. Where the new layout has fewer snap points than the index needs, the deck rests on the last one and reports it. It went to another slide: fade's snap targets, or loop's copies in WebKit, moved the snap points under the viewport. The README gains a recipe, "Change `effect`, `loop` or `autoplay` per breakpoint", linked from Effects and Autoplay.
