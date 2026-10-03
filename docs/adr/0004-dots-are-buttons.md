# Dots are buttons with aria-current, not tabs

The APG carousel pattern offers a tabbed variant where dots form a tablist and
slides are tab panels. With several slides in view a dot stands for a page,
not one slide, and the tabs pattern would describe a relationship that does
not exist. Dots are a labelled group of buttons, one per page, with
`aria-current` on the current one.

Focus is native: when focus moves to a slide outside the viewport, the browser
scrolls it into view and snap settles it. No slide is `aria-hidden` or inert
for being off-screen, and cloned slides used by loop are never focusable or
announced.
