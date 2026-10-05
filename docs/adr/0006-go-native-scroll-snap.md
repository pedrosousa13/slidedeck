# Go: native scroll snap, with clone-and-jump loop, scripted drag and a sticky fade

This answers ADR-0001's gate (#4). The maintainer decided on 2026-10-03:
native scroll snap is the engine. Slidedeck does not fall back to Embla.

Evidence: the prototype's desktop measurements in Chromium, Firefox and
WebKit through Playwright ([FINDINGS.md](../../prototypes/scroll-snap/FINDINGS.md)),
and the maintainer's check on a real iPhone: "everything works great on the
phone". The prototype is throwaway and will be deleted, so the numbers that
decided each choice are summarised here.

**Loop: clone and jump.** A full set of copies goes on each side of the real
slides, `aria-hidden` and `inert`. When the viewport rests on a snap point
after `scrollend` (or a debounce where `scrollend` is missing), it jumps one
set length onto the identical real slides. It never jumps mid-motion. This
was the only technique with no measured jump, edge hit or focus on a copy in
any browser. Jumping mid-motion showed jumps of up to 0.30 slide and killed
momentum; one viewport of copies was too short for a hard scroll across the
seam. Reposition was rejected: its runway is about n/2 slides (4.8 forward
in a 12-slide deck, so a wheel burst hit the end), and moving DOM nodes
trapped Tab: 40 presses never left the deck. Its CSS `order` variant fixes
Tab but splits visual order from reading order. As built, the copies are
rendered by `Deck.Viewport` and never counted (ADR-0009).

**Drag: scripted handoff.** Snapping is off while the mouse drags. On
release slidedeck projects the velocity to a snap point, smooth-scrolls
there, and restores snapping at the settle. It turns snapping off inline on
the viewport (`scroll-snap-type: none`) and puts the inline value back at the
settle. Restoring snapping on release was rejected: in all three browsers
the re-snap finished before the first frame after release, and a flick was
ignored.

**A move's lifecycle (amended for #41).** A _move_ is a scroll the engine
started: a step, a `scrollTo`, a drag's release. The engine is _idle_ or
_moving_ to a target snap point; `startMove` and `endMove` own that state
and the quiet that ends a move. A move has _arrived_ once the viewport is
within a pixel of its target; that is read from the viewport, never stored.
A scroll's `scrollend` comes a few milliseconds after the viewport arrives.
Measured in Chromium: when a move starts in those milliseconds, the late
`scrollend` and `scrollsnapchange` of the scroll before it come once the new
move has started, and the new move gets no end event of its own. So an end
event cannot say which move it ends. The events, and what each does:

- _A new move_ (from idle, or moving, arrived or not): the engine is moving
  to the new target at once. It never waits for an end. A step goes on from
  the target in flight. An arrived move is superseded: it does not settle,
  publish or jump off a copy, and the new move goes on from where the
  viewport is, a copy included.
- _An end event_ (`scrollend`, `scrollsnapchange`): idle, it settles the
  deck. Moving, it ends the move and settles only if the move has arrived.
  Otherwise it is not this move's end: it is the late end of an earlier
  scroll, a copy's jump included, or of a scroll that interrupted the move.
  It is ignored. This also covers `scrollsnapchange` as a move begins.
- _Quiet_ (no scroll event for 100ms): ends the move and settles, once it
  has arrived. A move short of its target ends only at a second quiet with
  no scroll event between the two. Measured in Chromium: after a long task
  holds the main thread, the first quiet can come before the browser has
  started the move's scroll, or sent the events of a scroll it went on with.
  Quiet runs from the start of each move until it ends. Where `scrollend` is
  missing, it also ends every other scroll, the user's included, as before.
  So every move ends: at its end event, or at worst 200ms after its last
  scroll event.
- _The user's scroll_ (a wheel, a key that scrolls, a touch or pen pan,
  which the browser takes over with `pointercancel`, a mouse drag): moving,
  the engine is idle again, without a settle, and quiet stops where
  `scrollend` is there. The user's scroll settles at its own end, and
  nothing the engine asked for resumes. Input that scrolls nothing leaves
  the move going: a click, even one that focuses a control in another
  slide, Enter, and a key in a text field or one the page has prevented.
  Focus within a slide or on the viewport, as Tab out of a slide gives, is
  meant to leave it going too, but in Chromium it stops the move short of
  its snap point (#51). A drag's release is a new move.
- _Focus entering a slide_ from outside it, as Tab does (amended for #43):
  the browser scrolls the slide into view and stops the move's scroll. Like
  the user's scroll, this ends the move, and focus wins: a new move replaces
  it, to the snap point of the focused slide's page. That is a slide, never
  a copy, so the deck rests with the focus in view, and Root announces the
  settle as the user's move. A slide in no page, as one before the first
  snap point where the slides snap to their start, goes to the snap point
  nearest its start, so the deck still rests on a snap point. The new
  move's target is set at once, so the stopped scroll's end is a late one,
  but its scroll starts two frames on: measured in Chromium, a smooth
  scroll asked for in the frame of the focus scroll, or the next, is
  ignored, above all one to the stopped scroll's own target. Focus while a
  pointer is pressed on the viewport, as a mouse pressing a control, is a
  click and leaves the move going. With no move in flight, focus changes
  nothing: the browser's focus scroll ends as any user scroll does.
- _A pointer held on the viewport_: an end does not settle until the last
  pointer lets go, so the deck never jumps off a copy under a finger or the
  mouse. A scroll after the end, as a touch pan, settles at its own end. A
  release the engine does not hear would hold the deck unsettled for good,
  so a pointer lets go at the first of: a `pointerup` or `pointercancel`,
  heard on the window in the capture phase, before any page listener can
  stop it; a `pointermove` or `pointerover` anywhere with no button down;
  the window losing focus, as the release may then go to another window;
  and a new primary pointer of its type pressed on the viewport, as none
  other of that type can then still be down.
- _The jump off a copy_ is part of a settle, so it comes only when idle or at
  a move's end. Its own end, if a new move has started, is a late end.

So a late end cannot end or settle a newer move; it is never waited for;
the user's scroll always ends a move; every move settles, snapping
included; and nothing is published between a superseded move and the move
after it, so a controlled parent has nothing to echo back. Two other models
were rejected. Holding a new move until the late end (100ms at most) lost a
new controlled `index`: the held move let the old scroll publish, the
parent echoed it, and the deck undid the new `index`; and a held move
replaced a handle's `scrollTo` with the next step. Settling the arrived move
first was also rejected: that settle publishes the arrived move's index in
the same task as the new move starts, a controlled parent echoes that index
back, and the deck undoes the new move. The cost of the model: a move whose
scroll sends no scroll event for two quiets in a row ends short of its
target. That needs two long tasks with no frame between them, or a browser
that pauses the scroll, as it may in a hidden tab; neither was measured. The
deck then settles where the viewport is, and settles again at the scroll's
own end, if one comes, with one more `onIndexChange`.

**Fade: sticky stack.** Slides are stacked with `position: sticky`, opacity
is set from a scroll listener, and non-focal slides are `inert`. As built,
opacity is CSS on `--deck-slide-progress` (ADR-0007; renamed by ADR-0010).
CSS view timelines were rejected for now: Firefox 155 does not support them, and in
Chromium 153 RTL every opacity was 0.

**Open checks, not yet done.** The maintainer deferred them:

- The VoiceOver pass (FINDINGS checklist step 9): no slide announced twice
  or as a copy, every slide reachable, and only the visible slide announced
  on fade.
- Desktop Chrome, Firefox and Safari by hand. Only Playwright's engines were
  measured, and its WebKit is not Safari.

This ADR reopens, and the Embla fallback of ADR-0001 comes back on the
table, if those checks show a visible jump or flash at the loop seam,
momentum that cannot cross the seam with a full set of copies, or VoiceOver
reaching copies despite `aria-hidden` and `inert`.
