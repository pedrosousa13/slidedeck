---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

A pen swipe no longer reports a slide as it starts. When the browser takes a pen over to pan the deck, a deck that came to rest under the pen now waits for the pen to lift before it settles and calls `onIndexChange`, as it does for a touch. Where the browser gives no sign that the pen lifted, the deck settles 1 second after the pan begins.
