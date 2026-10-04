# Curve turns slides about their centre, snapping at it

Curve leaves the slides in the deck's flow, where they snap, and fans them
with CSS on `--deck-progress`: each slide turns about its centre and drops
across the axis onto a circle. The engine and the browser both measure a
slide by its drawn box, transforms included. A turn about the centre widens
that box evenly on both sides, and a drop across the axis does not move it
along the axis. So the centre of each box stays where the flow put it. Every
curve slide snaps at its centre, set inline, so progress stays whole at rest
and the deck snaps where it would without the curve.

We considered snap targets (ADR-0007). They work, but they stack the slides,
so a curve deck would lose the consumer's slide size and gap. They would also
need another way to lay the slides out along the axis. Turning about the
centre needs no layout of its own. The cost is that alignment is not the
consumer's: a start- or end-aligned slide would move its alignment point when
it turns, and pages do not apply.

The radius is a custom property, `--deck-curve-radius`, in slides, not an
option: CSS can change it per breakpoint (ADR-0003), and one stylesheet serves
every curve deck on a page. A length would need CSS to divide two lengths to
find a slide's turn, which browsers do not all support. In slides, the arc
scales with the deck.

The turned slides overflow the viewport across the axis. The viewport clips
that overflow (`overflow: hidden` across the axis, as `clip` cannot pair with
`auto`), so no scrollbar can appear while a slide turns.
