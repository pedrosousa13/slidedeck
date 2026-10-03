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
beat consumer CSS, which owns geometry. React state changes only when the
current index or the slide count changes, never per scroll frame.

Server HTML rests at slide `defaultIndex` where `scroll-initial-target` is
supported; elsewhere a layout effect moves there before the browser paints. No
layout shift either way. Where several slides share a snap point, or a deck
snaps in pages, the first paint may correct after hydration: server HTML can
only start at a slide.

A second accepted exception: the server cannot measure, so it renders the
controls as if each slide were a page and the slides overflow. Prev and Next
always render, and Dots and Counter count one page per slide. Layout shifts
only where that is wrong: hydration removes the controls when every slide
fits, and corrects Dots and Counter to the snap points when several slides
share one or the deck snaps in pages. Where Root cannot see the Viewport's
slides (a Viewport inside a custom component, or one child component that
renders several slides), the server count is a guess: Dots and Counter render
empty, or count the slides Root can see, and correct at hydration.
