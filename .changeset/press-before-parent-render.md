---
'@slidedeck/react': patch
---

A controlled deck no longer undoes a move that starts just after it reports a new index, before React renders the parent taking that index: Next, Prev, a dot, `scrollTo`, a drag's release or an autoplay step. The deck went back to the reported index, and ended one slide short. Under load, as in WebKit on a busy machine, a press could come in that gap. Now an `index` the parent takes from `onIndexChange` never undoes a move started since, and the move goes on. A deck at rest elsewhere still goes to `index`.
