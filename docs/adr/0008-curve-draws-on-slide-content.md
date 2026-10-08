# Curve draws on the slides' content, in contained slides

Curve leaves the slides in the deck's flow, untransformed, and draws the arc
on their content with CSS on `--deck-slide-progress` (renamed by ADR-0010):
each slide's children turn about their centre and drop across the axis onto a
circle, and the slide fades. The slide boxes are where the flow put them, so the engine and the
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

**Server HTML carries the starting progress (amended for #125).** The
engine writes progress only once it has measured, in the browser. Until
then every curve slide read 0, so a server-rendered curve deck painted flat
and jumped into its arc at hydration. Now, with an effect, `Deck.Slide`
renders `--deck-slide-progress` inline from the first render, server HTML
included: the slide's distance in slides from the slide the deck starts at,
`index − start`, where `start` is the starting index clamped to the slides.
A loop's copy counts from its own place in the run, a set after or before
its slide. The engine's first measured write is the same wherever every
slide is one snap point, the same size, and the starting slide can reach the
focal position, so hydration changes nothing. Elsewhere, as with slides of
different sizes, pages that start past the first, or a start the scroll range
keeps from the focal position, the estimate is near the measured value, never
flatter than 0 everywhere, and the engine corrects it before the first frame
after hydration.

The value is computed from the slide's index, the slide count, whether it is
a copy and the starting index, none of which change as the deck scrolls. React
writes a style property only when its value changes, so it never writes over
the engine's progress during a scroll, and nothing is added to the scroll,
pointer or drag paths. A slide that moves to a new place gets its new place's
starting value, so `Deck.Viewport` refreshes the engine when an effect deck's
slides change order, and the engine paints over it before the frame is drawn.

Only a deck with an effect gets the starting progress. A deck with none
renders as before: its consumer CSS reads its own `var()` fallback until the
engine measures. Writing it on every deck was the alternative. It would also
fix consumer CSS on progress without an effect, but it changes every deck's
server HTML and adds a property to every slide, for a flash only an effect
was reported to show.
