# Effects are viewport values; fade stacks slides over snap targets

An effect is a value passed to `Deck.Viewport effect={…}`, imported from its
own entry point, such as `fade` from `@slidedeck/react/fade`. A deck that
imports none ships none of their code, and the main entry never imports one.

Fade stacks the slides with `position: sticky`, but a sticky slide cannot be a
snap target: Chromium snaps to where the slide is stuck. So the viewport holds
an empty element per slide, marked `data-slidedeck-snap-target`, laid out
along the axis. The engine treats these as stand-ins: where a viewport holds
any, each slide's snap point, focal position, progress and in-view state are
measured from its target. Snap targets are not slides. As built for loop,
there is one per copy too, in the order the copies and slides run
(ADR-0009).

Fade sets slide geometry inline, a deliberate exception to ADR-0003. Every
slide fills the viewport and snaps at its start, so a consumer's slide width,
alignment and pages do not apply: a fade shows one slide at a time. Opacity
stays CSS on `--deck-slide-progress` (renamed by ADR-0010), in
zero-specificity rules.

Every fade slide but the focal one is `inert`, as ADR-0006 decided. This is an
explicit exception to the PRD's "no off-screen slide hidden or inert" and to
ADR-0004: a stacked slide that is not shown is still under the one that is,
and focus or a click must not reach it. Keyboard and assistive technology users
reach slides through Prev, Next, Dots and the arrow keys. If the focused slide
goes inert, focus moves to the viewport, where the arrow keys still work.
