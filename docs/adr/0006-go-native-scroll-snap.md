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

**Fade: sticky stack.** Slides are stacked with `position: sticky`, opacity
is set from a scroll listener, and non-focal slides are `inert`. As built,
opacity is CSS on `--deck-progress` (ADR-0007). CSS view
timelines were rejected for now: Firefox 155 does not support them, and in
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
