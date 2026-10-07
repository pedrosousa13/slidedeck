---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

A looping deck no longer runs out of copies under quick chained trackpad or wheel flicks. Each flick went on from the momentum of the one before, so the deck never came to rest to jump off a copy, and it could scroll on to the end of the range. Now a wheel event along the deck's axis, while the deck is on the copies, moves it back onto the slides, to the same place, as a touch or a drag already did. Nothing shows: the index does not change and nothing is reported or announced.
