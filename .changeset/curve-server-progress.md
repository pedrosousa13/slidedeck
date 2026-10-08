---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

Server HTML now carries each slide's starting `--deck-slide-progress`: its distance in slides from the slide the deck starts at, a loop's copy by its own place. Effects and your own CSS on progress paint from the server HTML, before any script runs, so a server-rendered `curve` deck no longer paints flat and then jumps into its arc at hydration, and slides scaled by progress no longer render full size and then shrink. With equal-size slides, one per snap point, nothing changes at hydration; with slides of different sizes the engine corrects the estimate when it measures.
