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
set length onto the identical real slides. It never jumps mid-motion, but for
a press or a wheel event on the copies, which shifts the deck a set onto the
slides where nothing shows (amended for #48 and #96, ADR-0009). This was the
only technique with no measured jump, edge hit or focus on a copy in any
browser. Jumping mid-motion showed jumps of up to 0.30 slide and killed
momentum; one viewport of copies was too short for a hard scroll across the
seam. Reposition was rejected: its runway is about n/2 slides (4.8 forward in
a 12-slide deck, so a wheel burst hit the end), and moving DOM nodes trapped
Tab: 40 presses never left the deck. Its CSS `order` variant fixes Tab but
splits visual order from reading order. As built, the copies are rendered by
`Deck.Viewport` and never counted (ADR-0009).

**Drag: scripted handoff.** Snapping is off while the mouse drags. On
release slidedeck projects the velocity to a snap point, smooth-scrolls
there, and restores snapping at the settle. It turns snapping off inline on
the viewport (`scroll-snap-type: none`) and puts the inline value back at the
settle. Restoring snapping on release was rejected: in all three browsers
the re-snap finished before the first frame after release, and a flick was
ignored.

The drag moves the deck, and is released, from where it last put the deck,
not from where the viewport is (amended for #123). Measured in Playwright's
WebKit under load, on a vertical deck of photos, the browser's own handling
of the mouse press scrolled the viewport, and the page, back toward the
start between the drag's moves and before its release, and the deck came to
rest where the drag began. Preventing the press's default stopped it, but
that would also stop a press focusing a control in a slide, so the drag no
longer reads its position back from the viewport but once per move, after
its own write, as the browser clamped it.

It still never fights the user. Mid-drag, the drag honours these scrolls it
did not make, and goes on, and is released, from where the viewport is:

- the user's wheel along the axis, and a key that scrolls, as `onKeyDown`
  counts one: for 500ms after each such event, as long as the browser's
  smooth scroll for it runs, the drag reads where it is from the viewport;
- a new layout: a refresh, as the engine makes for a resize, a slide added
  or removed, or a change of orientation, and a change of `dir`. Measured
  in Chromium and WebKit, a slide removed before the one held moves the
  viewport by its size, to keep what shows in place. The drag reads where
  it is from the viewport once, at its next move or its release.

Every other scroll mid-drag is the browser's own, and the drag's next move
undoes it: WebKit's scroll back after the press, above, and a focus scroll,
as of a control the press itself focused. Neither can be told from the
other by an event, and both are the press's, not the user's input. Within
the 500ms after a wheel or key, WebKit's scroll back is honoured too.

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
  scroll event, and a frame (below).
- _A frame before quiet decides_ (amended for #123): a quiet that finds a
  move short of its target, or the quiet a re-snap waits for (below), acts
  only once a frame has rendered with no scroll event since. Measured in
  Playwright's WebKit under load, no frame rendered for 300ms and more
  while the main thread was idle and timers ran, and a scroll in flight
  went nowhere and sent no scroll event until frames came back. A dot's
  move then ended at two quiets and re-snapped to the nearest snap point
  on, short of its target, which stopped the browser's scroll there; and
  an arrow key's scroll, whose `scrollend` WebKit sent part way, was
  re-snapped back where it began. A scroll event before the frame waits
  for quiet again. In a hidden document, which renders no frame, quiet
  decides at once, as before, so a move started in a background tab, as
  autoplay's, still settles and reports. The cost: a browser that stops
  rendering frames in a visible document holds such a move, or re-snap,
  until it renders one.
- _A new layout and a scroll with no end event_ (amended for #87): a
  scroll whose end event never came left a stale scrolling flag. Measured
  in Chromium: the scroll a shorter scroll range makes, as when slides are
  removed or shrink under the viewport, gets no `scrollend`, only a
  `scrollsnapchange`, and after a touch fling on another scroller was cut
  short none of either, nor for the scroll that puts the viewport where
  the browser chooses after an effect or loop switch. With the flag stale,
  a refresh only painted, a settle owed to a pointer was dropped and an
  effect or loop switch did not keep the deck's place, so its count and a
  controlled `index` went stale. Now a refresh that settles notes where,
  until the next quiet, and a scroll to there is the new layout's own: the
  deck stays at rest. A scroll that a refresh, or a switch under a pressed
  pointer, finds or starts, neither a move nor the user's, ends at its end
  event or at quiet, whichever comes first, and input that scrolls nothing
  does not end that wait; nor does a later scroll count as the user's,
  once a quiet has passed since that input. Like the re-snap, it never
  fights the user: a new layout during the user's scroll waits for its own
  end, however long the user holds still.
- _The user's scroll_ (a wheel, a key that scrolls, a touch or pen pan,
  which the browser takes over with `pointercancel`, a mouse drag): moving,
  the engine is idle again, without a settle, and quiet stops where
  `scrollend` is there. The user's scroll settles at its own end, and
  nothing the engine asked for resumes. Input that scrolls nothing leaves
  the move going: a click, even one that focuses a control in another
  slide, Enter, and a key in a text field or one the page has prevented.
  Focus within a slide or on the viewport, as Tab out of a slide gives,
  scrolls, but the move resumes to its target (below). A drag's release is
  a new move.
- _The shift's own end_ (amended for #96): a wheel event on the copies
  shifts the deck a set onto the slides mid-scroll (ADR-0009), and that
  instant scroll sends an end event of its own, with the viewport where the
  shift put it. Until the user's scroll moves on from there, an end event
  there is the shift's and is ignored: it settled the deck mid-scroll. If
  the user's scroll goes no further, quiet settles the deck instead.
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
- _Focus within a slide or on the viewport_ (amended for #51): it is not
  the user taking over, so the move goes on to its own target, and nothing
  is reported but what the move reports. Measured in Chromium, the
  browser's focus scroll stops the move's scroll short of its target, and
  `focus({ preventScroll: true })` does not. So the move's scroll starts
  again to the same target two frames on, as for focus entering a slide.
  A new move, the user's scroll or focus entering a slide in those two
  frames replaces the move, and the scroll is not started again.
- _A pointer held on the viewport_: an end does not settle until the last
  pointer lets go, so the deck never jumps off a copy under a finger or the
  mouse. A scroll after the end, as a touch pan, settles at its own end. A
  release the engine does not hear would hold the deck unsettled for good, so
  a pointer lets go at the first of (amended for #48: a touch the browser pans
  lets go only as its last finger lifts, below; amended for #97: a pen the
  browser pans lets go only as it lifts, or after a bounded wait, below): a
  `pointerup` or
  `pointercancel`, heard on the window in the capture phase, before any page
  listener can stop it; a `pointermove` or `pointerover` anywhere with no
  button down; the window losing focus, as the release may then go to another
  window; and a new primary pointer of its type pressed on the viewport, as
  none other of that type can then still be down.
- _A touch the browser pans_ (amended for #48): it lets go when the last
  finger lifts, not at the `pointercancel` that hands the pan to the
  browser. The finger is still down then, and the pan has sent no scroll
  yet, so a settle owed, as when a move or a fling comes to rest under the
  finger, jumped off a copy and reported as the pan began. Now the pan
  settles at its own end. The lift is the first `touchend` or `touchcancel`
  heard on the window in the capture phase or on the node the touch began
  on: the node hears it where the window does not, once the node has left
  the page, as when a consumer swaps a slide's content mid-pan. A browser
  with no touch events lets go at `pointercancel`, as before.
- _A pen the browser pans_ (amended for #97): as a touch, it lets go when it
  lifts, not at its `pointercancel`, which left a settle owed under the pen
  to jump off a copy and report as the pen swipe began. After the cancel the
  browser sends none of the pen's events, its `pointerup` included, so the
  lift is the first of: the lift (`touchend` or `touchcancel`, heard on
  the window) of a touch the browser marks as the pen's, as Safari marks
  Apple Pencil's with `touchType` 'stylus', never a finger's lift, which
  says nothing of the pen; a pen event with no button down, under any
  pointer id, as a lifted pen hovering sends; the window losing focus; a
  new primary pen pressed on the viewport; and, as a pen can lift with none
  of these, 1 second after the cancel. A browser that sends touch events
  for a pen but does not mark them lets the pen go only by the others.
  Then the deck settles, or, if the pan is still scrolling it, at the pan's
  own end.
  Measured: in Chromium, a touch pan sends no `pointerup` and no pointer
  event after its `pointercancel` until the lift, and its `scrollend` comes
  only after the lift, never while the finger is held still. No engine
  could be measured with a pen that pans: a pen through CDP
  (`Input.dispatchMouseEvent`, `pointerType: 'pen'`) or Chromium's
  `gpuBenchmarking` pen takes the mouse's path, sends `pointerup` and never
  pans, and Playwright drives no pen in Firefox or WebKit. So the tests
  send the `pointercancel` a pan would. The pan's `scrollend` was rejected as
  the lift: the shift off the copies at the cancel scrolls the deck and ends
  with a `scrollend` of its own, which cannot be told from the pan's. The
  cost: where none of the signals above comes, a pen held down past the
  wait without scrolling the deck, as when it pans the page across the
  deck, lets go while still down, and a settle owed then jumps off a copy
  and reports under it; and a pen that lifted unheard settles up to that
  wait late. Open check: a real pen, as an iPad with Apple Pencil and a
  Windows tablet's pen in Chromium and Firefox.
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
scroll sends no scroll event for two quiets in a row, each with a frame
after it, ends short of its target. That needs two long tasks with a frame
but no scroll between them, or a browser that pauses the scroll while it
renders; neither was measured. A visible document that renders no frame
holds the move until it does; a hidden one ends it at quiet as before
(amended for #123). The
deck then settles where the viewport is, and settles again at the scroll's
own end, if one comes, with one more `onIndexChange`.

**At rest off a snap point (amended for #60).** Measured in Chromium: when
a long task holds the main thread just after the user's wheel ends a move,
the browser can carry the move's smooth scroll on. It either runs on to the
move's target, against the wheel, or stops part way, off every snap point,
and never snaps the deck back. Page script that scrolls the viewport during
a move can also leave it off every snap point. The maintainer decided on
2026-10-05 (option B) that the engine re-snaps, and that the run-on case is
accepted: that rest is on a snap point, so the engine cannot tell it from a
move that arrived, and the deck reports the target.

So at a settle under `mandatory` snapping, a deck more than a pixel from
every snap point moves to the nearest one. Where the user's scroll took a
move over, it moves to the nearest one the way that scroll went: a wheel's
delta says the way, and for other input it is from where the user took
over to where the deck rests. Where quiet ended a move short of its target,
it moves the way the move went. Measured in WebKit under load, quiet can
end a move whose scroll goes on, and a re-snap back would stop it. Snap
points are measured as the browser rests the slides and copies, each from
its own box, scroll padding and scroll margin included: WebKit can rest a
copy a pixel or two off its slide's rest plus a set's length. With loop, a
copy's snap point counts, and that move's settle jumps off the copy.

- It waits for quiet and looks again first. Measured in Chromium, a wheel's
  scroll ends, with `scrollend`, before the browser's snap from there is
  done.
- It never fights the user. A pressed pointer, a drag and a scroll still
  going all hold it, and the user's scroll ends the wait. Where `scrollend`
  is missing, quiet cannot tell a finger held still from a scroll's end, so
  there is no re-snap.
- Proximity snapping is exempt: resting between snap points is the
  browser's choice there.
- _A copy's snap point past an end of the scroll range_ (amended for #48),
  as a centred deck's last copies' are, is none. The browser rests such a
  copy clamped to the end, but the deck cannot jump off it: its slide a
  set back would rest on no snap point. Measured in Chromium, a drag or a
  flick to the end left the deck there for good, on the copies, reporting
  a slide it did not show. It now re-snaps to the nearest snap point within
  the scroll range, and jumps off that copy as usual.
- Where the browser still holds the deck somewhere the engine does not
  measure, a re-snap from there moves nothing, and the deck settles there
  without trying again.

Stopping the move's scroll on the wheel, with an instant scroll by nothing,
was tried and rejected: where the wheel reached the main thread after the
long task, the stop also undid the wheel.

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
