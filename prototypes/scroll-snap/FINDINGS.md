# Findings: loop, mouse drag and fade on native scroll snap (#3)

THROWAWAY. This document answers ADR-0001's gate. It covers desktop
browsers only, as far as Playwright can drive them. **Every iOS Safari cell
is untested** and waits for the on-device check (#4). The recommendation at
the end is provisional until that check is done.

## What was tested, and how

- **Browsers.** Playwright 1.63 on Linux: Chromium 153, Firefox 155 and
  WebKit 26.6 (the WPE port). Playwright's WebKit is a proxy. It is not
  desktop Safari and it is not iOS Safari. No Mac was available, so desktop
  Safari is untested too.
- **Deck.** 12 slides. Each slide is 85% of the viewport, or a third of it
  with group snapping (3 slides per page). Every configuration ran in
  default, group, vertical and RTL.
- **Scenarios.** Each loop scenario starts next to the seam (slide 1, or the
  last page) and crosses it:
  - a wheel flick (10 wheel events of 200 px, 16 ms apart);
  - a smooth `scrollBy` of 3 pages;
  - 5 clicks on Next, 40 ms apart;
  - a CDP touch flick with fling (Chromium only, in a touch context);
  - a fast mouse drag (a flick), a slow short drag (25% of a page) and a
    slow long drag (65% of a page).
- **Focus and screen reader.** The suite pressed Tab 40 times from the
  control before the deck and recorded where focus landed: on a copy, on an
  invisible slide, or on a slide outside the viewport. Accessibility was
  read from Playwright's aria snapshot, and in Chromium also from the
  browser's own accessibility tree (CDP `Accessibility.getFullAXTree`).
  No real screen reader was used.
- **What counts as a jump.**
  - _Correction error_: each clone jump or rotation records how far the
    content moved visually. The value is read before and after the
    correction, in the same task. 0 means the correction landed on
    identical content. In the default runs the largest value was 0.0009 of
    a slide (under 1 px, from rounding to whole pixels). A value above 0.005
    of a slide is reported below as a jump.
  - _Edge hit_: on a loop page, the scroller reached its physical end while
    it was moving. You see this as a dead stop, or as a rubber band on iOS.
  - _Off snap_: the scroller came to rest more than 2 px from a snap point.
- The raw data is in `measure-results/<browser>.jsonl`, which is not
  committed. Run `pnpm --filter @slidedeck/proto-scroll-snap measure` to
  get it again. There are 200 scenario runs in Chromium and 175 each in
  Firefox and WebKit, plus a Tab walk and an accessibility check for every
  configuration.

The same correction error and edge-hit counters run live in the box under
each deck. The box turns red on a jump. Use it on the phone.

## Loop: clone and jump (`loop-clone-jump.html`)

Copies of the slides go before and after the real set. When the scroller
comes to rest inside the copies, it jumps by one set length onto the
identical real slides. The copies are `aria-hidden` and `inert`. The
defaults are a full set of copies on each side, a jump at rest, and only on
a snap point.

| Question                         | Chromium                                                                                                  | Firefox                                                                                                                                          | WebKit (Playwright)                                                                                                       | iOS Safari                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Hard flick across the seam       | **No jump** in all 4 configs: wheel, smooth `scrollBy`, 5× Next, touch flick. No edge hits.               | **No jump.** One edge hit: group + 5× Next went 12 slides and ran past the 4 pages of copies, because Firefox adds up queued `scrollBy` targets. | **No jump** from programmatic scrolls. Wheel flicks came to rest off snap (see the WebKit note), so the jump was put off. | Untested; maintainer to check on device (#4) |
| Drag snaps cleanly               | **Yes** in all 4 configs, also across the seam                                                            | **Yes**, with one exception: a flick in group measured 0 release velocity (harness timing) and stayed put                                        | **Yes** in all 4 configs                                                                                                  | Untested; maintainer to check on device (#4) |
| Focus or screen reader on a copy | **No.** Tab never landed on a copy. The browser's AX tree has 12 slide nodes, so the copies are excluded. | **No** on Tab. Aria snapshot: 12 slides (Playwright's model, not Firefox's AX tree).                                                             | **No** on Tab. Aria snapshot: 12 slides (Playwright's model).                                                             | Untested; maintainer to check on device (#4) |

Variants:

- **Fewest copies** (`clones=viewport`, one viewport of copies). A hard
  flick runs into the end of the copies in all three browsers: there are
  edge hits, and in Chromium and Firefox a jump of 0.18 slide when the
  scroller is snapped after the correction. Fewer copies than one viewport
  cannot work at all, because the jump lands past the end of the scroll
  range.
- **Jump mid-motion** (`fix=live`). There are visible jumps in all three
  browsers (Chromium up to 0.30 slide, Firefox 0.09, WebKit 0.13). The
  motion also stops: a Chromium wheel flick travelled 0 slides. A
  programmatic scroll ends any scroll animation that is running, and the
  browser snaps the new position.
- **No snap guard** (`guard=0`). Clean in Chromium and Firefox. In WebKit,
  correcting at a `scrollend` that was off snap gave jumps of 0.13 to 0.24
  slide.

## Loop: reposition (`loop-reposition.html`)

There are no copies. At rest, whole pages move from the far end to the near
end, so that the focal slide stays in the middle slot. The scroll position
is then corrected by exactly how far the focal slide moved. `mode=dom`
moves the nodes, with `moveBefore` where it exists. `mode=order` sets the
CSS `order` property instead.

| Question                         | Chromium                                                                                                                                          | Firefox                                                               | WebKit (Playwright)                                                                          | iOS Safari                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Hard flick across the seam       | Default and RTL are clean. **Vertical:** a forward wheel flick ran out of runway (jump 0.18). **Group:** edge hits on wheel, `scrollBy` and Next. | **5× Next ran into the end** (edge hit, jump 0.18). Group: edge hits. | **A forward wheel flick ran out of runway** (jump 0.18) in default, RTL, vertical and order. | Untested; maintainer to check on device (#4) |
| Drag snaps cleanly               | **Yes** in all configs                                                                                                                            | **Yes** in all configs                                                | **Yes** in all configs                                                                       | Untested; maintainer to check on device (#4) |
| Focus or screen reader on a copy | No copies exist (12 AX slide nodes). But see "Tab order" below.                                                                                   | No copies exist (12 in the aria snapshot)                             | No copies exist (12 in the aria snapshot)                                                    | Untested; maintainer to check on device (#4) |

Where it broke:

- **Runway is capped by the slide count.** There are only about n/2 slides
  of room on each side of the focal slide. Forward room is smaller still,
  because the last slide cannot snap to the start (about 4.8 slides of 12
  here). A flick that goes further hits the wall. A deck of 4 slides would
  have about one slide of room.
- **Tab order (DOM mode).** Tab enters at slide 7, because that is the
  first slide in the DOM. Each rotation then moves visited slides ahead of
  focus, so 40 presses of Tab never left the deck. Focus cycled around in
  all three browsers. That is a keyboard trap. In `mode=order`, Tab goes
  from 1 to 12 and then leaves the deck. But the visual order and the DOM
  order (and so the reading order) are different.
- **Rotating mid-motion** (`fix=live`) causes visible jumps of 0.33 to 0.50
  slide in Firefox and WebKit.
- Focus was never lost by a rotation. Only far-end slides move, never the
  focused one. WebKit has no `moveBefore` and uses `insertBefore`.

## Mouse drag (`drag.html`, and the same code on every page)

While the mouse button is down, snapping is off and the pointer moves the
scroll position. There are two handoffs on release:

- `scripted` (the default) projects the release velocity to a snap point,
  smooth-scrolls there with snapping still off, and turns snapping back on
  at the settle.
- `restore` turns snapping back on at once and lets the browser pick a snap
  point.

| Question                        | Chromium                                                                                                                                          | Firefox      | WebKit (Playwright) | iOS Safari                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------- | -------------------------------------------------- |
| Drag snaps cleanly (`scripted`) | **Yes** in all configs, also across loop seams. A slow short drag snaps back, a slow long drag advances one page, a flick moves one page or more. | **Yes**      | **Yes**             | n/a: touch is native scrolling; drag is mouse only |
| Drag snaps cleanly (`restore`)  | **No.** The snap is instant: the 240 px move finishes before the first frame after release. A flick is ignored.                                   | **No**, same | **No**, same        | n/a                                                |

This was observed with a per-frame trace of the scroll position after
release. With `scripted`, the move to the snap point eases out over about
14 to 30 frames in all three browsers.

## Fade (`fade.html`)

Empty snap targets give the viewport its scroll length. The slides are
stacked with `position: sticky` and take their opacity from scroll
progress. Group snapping does not apply to a fade, so that toggle is off.

| Question                                    | Chromium                                                                                                                                                                                                   | Firefox                                                      | WebKit (Playwright) | iOS Safari                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------- | -------------------------------------------- |
| Slides stay stacked, opacity follows scroll | **Yes.** At 2.25 slides of progress, every slide is at offset 0 and the opacities are 0, 0, 0.75, 0.25, 0, in default, vertical and RTL.                                                                   | **Yes**                                                      | **Yes**             | Untested; maintainer to check on device (#4) |
| CSS view timelines (`driver=css`)           | Yes, but **RTL is broken**: every opacity is 0                                                                                                                                                             | **Not supported** in Firefox 155 (the page falls back to JS) | Yes, also in RTL    | Untested; maintainer to check on device (#4) |
| Drag snaps cleanly                          | **Yes**                                                                                                                                                                                                    | **Yes**                                                      | **Yes**             | n/a                                          |
| Focus or screen reader on a hidden slide    | With `inert` (the default): Tab reaches only the focal slide, and the AX tree has 1 slide node. With `hide=none`: 22 Tab stops on invisible slides, because nothing scrolls when a stuck slide gets focus. | Same Tab result                                              | Same Tab result     | Untested; maintainer to check on device (#4) |

Getting sticky right took two attempts. A sticky box is held inside its
parent's box. A one-cell grid area gives it no room to stick, and an
overflowing grid track does not make the parent's box larger. The track
must be as long as the scroll range.

## Findings that apply to every technique

- **Group snapping and Tab (Chromium and WebKit).** When Tab crosses a page
  boundary, focus lands on the next page's first slide (slides 4, 7 and 10)
  while that slide is outside the viewport. Firefox scrolls it into view.
  This happens on the plain drag page too, so it is an engine issue. PRD
  story 39 needs code here, for example a `focusin` handler that scrolls to
  the page of the focused slide.
- **A correction must happen on a snap point.** A clone jump or a rotation
  is a programmatic scroll, and browsers snap programmatic scrolls. If the
  scroller is between snap points, the correction shows as a jump. The
  guard (wait for a settle that rests on a snap point) stopped every such
  jump that was measured.
- **WebKit note (Playwright WPE).** Wheel flicks often came to rest 70 to
  370 px off a snap point, and nothing snapped them later (checked 3 s
  after). This also happened on the non-loop drag and fade pages. Because of
  this, the WebKit wheel rows say nothing about Safari. Check this on a Mac
  trackpad.
- **Events.** `scrollend` is in all three browsers. `scrollsnapchange` is
  only in Chromium. `moveBefore` is in Chromium and Firefox but not WebKit.
  Scroll-driven animations are in Chromium and WebKit but not Firefox 155.
- **Programmatic Next adds up in Firefox.** Five quick `scrollBy` calls
  moved 5 pages in Firefox but 2 to 3 in Chromium. A real Next should
  compute its target from the current index and normalize the loop first,
  not stack relative scrolls.
- **Playwright's aria snapshot ignores `inert`.** It reported 12 fade
  slides where Chromium's own tree had 1. Use the browser's tree, or a real
  screen reader, for inert checks.

## On-device checklist for the maintainer (#4)

1. In `~/apps/slidedeck`, run
   `pnpm --filter @slidedeck/proto-scroll-snap serve`. With the iPhone on
   the same Wi-Fi, open `http://<machine LAN IP>:4317/`. Find the LAN IP
   with `hostname -I` on Linux, or `ipconfig getifaddr en0` on macOS.
2. On the index page, write down the iOS version and the "This browser"
   list (`scrollend`, scroll-driven animations).
3. **Clone and jump** (default settings). From slide 1, flick hard
   backward across the seam 5 times, then forward from slide 12 5 times.
   Watch for a flash, a jump or a stall at the seam, and for momentum that
   stops early. Read the box: "correction error" must stay at 0.000 and
   "edge hits" at 0. If "deferred" goes up but corrections stay at 0, iOS
   rests off snap after momentum: write that down.
4. Repeat step 3 with group snapping, vertical and RTL, one at a time.
   In vertical, check that the page itself does not scroll when you flick
   past the deck.
5. Set "Copies each side" to `viewport` and flick hard. A stop at the end
   of the copies (a rubber band) is expected. Write down how many slides a
   hard iOS flick travels: that tells us how many copies are enough.
6. Set "When to jump" to `live` and flick across the seam. Does momentum
   die at the jump? (On desktop, it does.)
7. **Reposition**: repeat steps 3 and 6. A stop after about 4 to 5 slides
   is expected (the runway).
8. **Fade**: swipe and flick. The cross-fade must follow your finger and
   momentum with no flicker. Compare "Opacity from" `js` and `css`, also in
   RTL.
9. **VoiceOver**, on clone and jump and on fade. Swipe right through the
   deck. Is any slide announced twice, or as a copy? Can VoiceOver reach
   every slide (with a three-finger swipe in the deck)? On fade, is only
   the visible slide announced?
10. If you have a Mac, repeat steps 3 and 8 in desktop Safari with a
    trackpad, and record whether wheel flicks come to rest on a snap point.

## Recommendation (provisional until #4)

- **Loop: clone and jump.** Use a full set of copies on each side, made
  `aria-hidden` and `inert`. Jump only when the scroller rests on a snap
  point after `scrollend` (or after a debounce where `scrollend` is
  missing). Never jump mid-motion. It was the only technique with no
  measured jump, edge hit or focus problem in its default configuration
  across Chromium, Firefox and WebKit. Its known limit: the copies are its
  runway. If a hard iOS flick travels more than one set of slides, small
  decks will need more copies (step 5 of the checklist answers this).
  Reject reposition: its runway is capped at about n/2, and moving DOM
  nodes traps Tab focus. Its CSS `order` variant fixes Tab but splits the
  visual order from the reading order.
- **Drag: the scripted handoff.** Snapping is off while dragging. On
  release, project the velocity to a snap point, smooth-scroll there, and
  restore snapping at the settle. Reject restoring snapping on release: the
  re-snap is instant in all three browsers and ignores the flick.
- **Fade: the sticky stack with opacity set from a scroll listener**, and
  non-focal slides `inert`. Reject CSS view timelines for now: Firefox 155
  does not have them and Chromium 153 breaks them in RTL.
- **Go or no-go.** On desktop evidence, native scroll snap passes the gate,
  so this is a provisional **go**. Take the **Embla fallback** if the iPhone
  shows any of these: a visible jump or flash at the seam with clone and
  jump; momentum that cannot cross the seam with a full set of copies; or
  VoiceOver reaching copies despite `aria-hidden` and `inert`.
