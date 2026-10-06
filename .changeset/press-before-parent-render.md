---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

A controlled deck no longer loses a press of Next or Prev that comes just after it reports a new index, before React renders the parent taking that index. The deck went back to the reported index, so five quick presses could end four slides on. Under load, as in WebKit on a busy machine, the press could come in that gap. Now an `index` the parent takes from `onIndexChange` never moves the deck, and the press goes on.
