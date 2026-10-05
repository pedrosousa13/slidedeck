---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

A deck follows a change of `dir` on an ancestor after it mounts, as a locale switch makes, without a remount. It stays on its slide, at rest, a move in flight still arrives on its target, and Next, the arrow keys, a mouse drag and `--deck-slide-progress` go the new way. In Firefox and WebKit the deck went back to its first slide.
