# Loop copies are rendered by Viewport and never counted

ADR-0006 chose clone and jump for loop: a full set of copies on each side of
the slides, `aria-hidden` and `inert`, and a jump of one set length onto the
identical slide once the viewport rests on a copy's snap point, never
mid-motion. This records how it is built (#11) and what loop does with the
deck's other features.

**React renders the copies; the engine finds them.** `Deck.Root loop` makes
`Deck.Viewport` render each slide three times: the slides, a set of copies
marked `data-slidedeck-copy="after"`, and a set marked `"before"`. Server
HTML holds them too, so it already rests on the slide at `defaultIndex`,
and hydration moves nothing. The engine takes no loop option: as with snap
targets (ADR-0007), a viewport that holds copies loops. A copy is a
`Deck.Slide` rendered again, so it looks like its slide with no cloning of
DOM, but its state is its own and an `id` inside a slide repeats.

**The copies before the slides come after them in the document**, placed
first with `order: -1`. A consumer's `:nth-child()`, as in pages, then still
counts the slides from 1. The copies are inert and hidden, so the split
between visual and reading order that rejected the `order` variant of
reposition in ADR-0006 does not apply to them. CSS that picks slides by their
place among the viewport's children would still pick the wrong copies, so the
engine copies each slide's computed `scroll-snap-align` onto its copies,
inline, at every settle: pages whose last page is short loop correctly.

**Only the slides are counted.** The current index, `onIndexChange`, the
handle, Dots, Counter, `data-current`, `data-focal`, `onFocalChange` and the
live region all speak of the slides' snap points and slides. A copy is never
current or focal. Internally a step may target a snap point up to a set past
either end, on the copies; `target()` reports the slide's index it copies.
Prev and Next step across the seam; `scrollTo`, Dots and a controlled `index`
go the direct way, within the slides, never round the seam.

**Copies carry the outputs.** `--deck-progress` and `data-in-view` are written
to every copy by its own place in the run, so a copy in view reads as the
slide it stands in for, and after the jump its slide reads the same. Effects
built on progress therefore draw copies as slides, and the jump shows
nothing.

**What loop does with the deck's other features:**

- Drag: a release projects onto the copies' snap points too, so a drag or
  flick crosses the seam and the jump follows the settle.
- Click to focus: a copy is inert, so a click on it reaches the viewport; the
  engine finds the copy under the pointer and moves to it across the seam.
- Autoplay: `next()` goes on from the last snap point to the first, so a
  looping deck's autoplay never stops at the end. It needs no change.
- Synced decks: the index is the slides', so a parent sharing it, as with
  thumbnails, sees a step across the seam as a move to slide 0.
- Fade: the copies stack with the slides over a snap target each, in the
  order they run, and crossfade by progress. They stay inert, as do the
  non-focal slides (ADR-0007).
- Curve: copies are curved by their progress like any slide (ADR-0008).
- Pages, vertical and right-to-left: the engine measures through `axisOf`,
  and a set's length along the axis is the distance from slide 0 to its copy
  after the slides.

**A deck whose slides all fit does not loop.** With a set no longer than the
viewport, a copy would show beside its own slide and the jump could land
past the end of the scroll range. The engine then reports one snap point,
and Viewport drops the copies, as Prev, Next, Dots and Counter drop for any
deck whose slides fit. Server HTML cannot measure, so it renders copies, and
hydration removes them where every slide fits: a layout shift of the kind
ADR-0003 already accepts for the controls.

The open checks of ADR-0006 still apply: VoiceOver reaching a copy, or a
flash at the seam in desktop Safari or on iOS, would reopen it. Firefox and
WebKit now run the e2e suite through Playwright, flicks across the seam
included; their momentum flicks are still untested.
