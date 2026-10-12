---
'@slidedeck/core': patch
---

A looping deck keeps its place when slides are added or removed. Before, a move across the seam that was still in flight could end on another slide, such as Next from the last slide ending back on it. A deck at rest also depended on the browser to re-snap after the change, which does not always happen in time.
