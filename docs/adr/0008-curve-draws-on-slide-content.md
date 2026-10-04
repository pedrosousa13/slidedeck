# Curve draws on the slides' content, in contained slides

Curve leaves the slides in the deck's flow, untransformed, and draws the arc
on their content with CSS on `--deck-progress`: each slide's children turn
about their centre and drop across the axis onto a circle, and the slide
fades. The slide boxes are where the flow put them, so the engine and the
browser measure and snap exactly as without the curve, with the consumer's
alignment and pages: no geometry is set inline, and ADR-0003 holds with no
exception.

A transformed box counts toward its scroll container's scrollable overflow.
Turning the slides themselves made a deck that fits scrollable, moved the end
of the scroll range while a deck dragged, so it came to rest off its snap
points, and let focus scroll the viewport across the axis after a dropped
slide, though that axis is `overflow: hidden`. So each curve slide has
`contain: layout`, set inline as structure: its content's overflow is then ink
overflow, drawn but never scrollable. `overflow: clip` with a wide
`overflow-clip-margin` was considered, but Chromium still counts content
inside the margin toward the viewport's scrollable overflow.

Layout containment has costs of its own. Each curve slide is always a stacking
context and the containing block for its `position: fixed` descendants, so a
fixed element inside a slide is positioned against the slide, not the viewport.

The cost is that the curve is drawn on the slide's children, not the slide.
A slide's own background and border stay flat, and several children each turn
about their own centre. A curve slide is best given one child that fills it,
styled as the slide is seen.

Snap targets (ADR-0007) were considered. Fade needs them because it stacks the
slides with `position: sticky`, and a sticky slide cannot be a snap target. A
curve deck on snap targets would lose the consumer's slide size and gap, and
would need another way to lay the slides out along the axis.

The radius is a custom property, `--deck-curve-radius`, in slides, not an
option: CSS can change it per breakpoint (ADR-0003), and one stylesheet serves
every curve deck on a page. A length would need CSS to divide two lengths to
find a slide's turn, which browsers do not all support. In slides, the arc
scales with the deck. A radius of 0 or less is taken as a thousandth of a
slide, so it neither divides by zero nor flips the arc.

The dropped content overflows the viewport across the axis, where the viewport
clips it (`overflow: hidden` across the axis, as `clip` cannot pair with
`auto`), so the arc is never drawn outside the deck.
