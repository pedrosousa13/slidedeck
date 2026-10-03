# Geometry is CSS; React re-renders only on index and focal changes

Slides per view, gap, alignment and their breakpoints are plain CSS on the
slides, never props. Slidedeck reads the resulting snap points from layout.
That makes responsiveness free and keeps it out of slidedeck's API.

React state changes only when the current index or the focal slide changes.
Continuous values — progress, in-view state — are written to the DOM as custom
properties and data attributes, so scrolling never re-renders.

The structural styles a deck needs to function (the scroller, snap type,
overflow) are set inline on the primitives, as playdeck does, so a deck works
with no stylesheet. Appearance ships as an optional `theme.css`.

Slide width and snap alignment are geometry, yet a deck with no stylesheet
still needs them. They ship as zero-specificity `:where()` defaults, injected
through React 19's `<style precedence>`, not inline: an inline style would
beat consumer CSS, which owns geometry. React state also changes when the
slide count changes, never on scroll.

The first server-rendered paint shows slide 0; a layout effect moves to
`defaultIndex` before the browser paints, using `scroll-initial-target` where
supported. No layout shift either way. Where several slides share a snap point,
the first paint may correct after hydration: server HTML can only start at a
slide.
