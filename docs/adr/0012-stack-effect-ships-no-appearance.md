# The stack effect ships no appearance

Stack stacks the slides in one place, as cards, and orders them by
progress: the focal slide on top, the slides after it behind it in order,
and a slide leaving drops behind every slide halfway, to come back in at the
back. With loop, a slide's copy after the slides arrives at the back as the
slide leaves.

**Stack is the first effect with no appearance.** Its CSS sets only
`z-index`, from `--deck-slide-progress`, in zero-specificity rules. No
transform, colour or opacity. The look of a card stack and the throw that
takes the top card off it are the consumer's CSS on `--deck-slide-progress`,
as the card stack recipe shows.

The look depends on the card's size and design, which the effect cannot
know. How far a throw goes is the card's width plus how far the cards behind
stick out; how the cards behind turn, shift and show depends on the design.
Any default would be one design, and a consumer would override all of it.
What is easy to get wrong is the order: which card is on top, and the flip
halfway through a throw, when the card leaving must drop behind the stack so
it can come back in at the back. That is what the effect ships.

To place the back of the stack, the recipe needs the number of slides.
`Deck.Slide` sets `--deck-slide-count` on every slide and copy, copies not
counted (ADR-0010, amended).

Fade and curve keep their appearance. A crossfade and an arc are each one
look, and their opacity and transforms are what the effect is.

Stack lays the slides out as fade does, over snap targets (ADR-0007). The
layout is one internal module that both effects import, not an entry, so a
deck that imports either ships it once, in a shared chunk. Every slide but
the focal one is inert, as in fade: a card under the top card is still under
it, and focus or a click must not reach it.
