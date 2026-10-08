---
'@slidedeck/core': patch
'@slidedeck/react': patch
---

A server-rendered deck with an effect, such as `curve` or `fade`, now paints its effect from the server HTML, before any script runs. Each slide carries its starting `--deck-slide-progress`, its distance in slides from the slide the deck starts at, so a curve deck no longer paints flat and then jumps into its arc at hydration. With equal-size slides, one per snap point, nothing changes at hydration; with slides of different sizes the engine corrects the estimate when it measures. A deck without an effect is unchanged.
