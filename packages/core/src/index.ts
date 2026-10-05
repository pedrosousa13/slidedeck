/** What a deck publishes: where it rests, and how many places it can rest. */
export interface DeckState {
  /** The current index: the snap point the viewport is resting at. */
  index: number;
  /** How many snap points the viewport has. One means every slide fits. */
  count: number;
  /** The current slide: the first slide resting at the current snap point. */
  slide: number;
  /** The focal slide: the slide nearest the snap alignment point, read from
   * the current slide's `scroll-snap-align`. Not the current slide where
   * several slides are in view; -1 if no slide snaps. */
  focal: number;
}

/** The axis a deck scrolls along. Horizontal follows the writing direction,
 * so in a right-to-left document the deck starts at the right. */
export type Orientation = 'horizontal' | 'vertical';

export interface DeckOptions {
  /** The snap point to start at, clamped to the snap points there are. */
  index: number;
  /** Defaults to horizontal. */
  orientation?: Orientation;
  /** Called when the current index, the snap point count, the current slide
   * or the focal slide changes: when a scroll settles, never during one. */
  onChange: (state: DeckState) => void;
}

export interface DeckEngine {
  /** Scrolls to a snap point, clamped to the snap points there are. Does
   * nothing for a non-finite index, or while there are no snap points. With
   * loop, `direct` (the default) goes within the slides, never round the
   * seam; `short` goes whichever way is shorter, across the seam if need be.
   * Without loop the two are the same. */
  scrollTo(index: number, way?: 'direct' | 'short'): void;
  next(): void;
  prev(): void;
  /** The snap point a scroll the engine started is heading to, until it
   * ends or the user's scroll takes over; null when none is in flight. */
  target(): number | null;
  /** Re-reads the snap points, as after slides are added or removed. */
  refresh(): void;
  /** Turns mouse drag on or off; on from the start. A drag already under way
   * finishes. */
  setDrag(enabled: boolean): void;
  /** Turns click-to-focus on or off; off from the start. On, a pointer click
   * on a slide scrolls to the snap point of its page: with one slide to a
   * page, where that slide is at the alignment point, or as near as the
   * scroll range allows. A click that ends a mouse drag never reaches it,
   * and a keyboard click is ignored. */
  setClickToFocus(enabled: boolean): void;
  /** Changes the axis the deck scrolls along, and re-reads the snap points
   * on it. */
  setOrientation(orientation: Orientation): void;
  destroy(): void;
}

/**
 * Tracks the snap point a native scroll container rests at and asks it to
 * move. The browser does the scrolling and snapping; the engine reads where
 * it settled from layout, so slide size, gap and alignment stay plain CSS.
 *
 * The slides are the viewport's children, except snap targets and copies
 * (see `slidesOf`): where an effect stacks the slides in one place, an empty
 * snap target per slide lays out along the axis in its stead, and the engine
 * measures each slide by its target.
 *
 * Loop (clone and jump, ADR-0006, as built in ADR-0009): where the viewport
 * holds a copy of every slide before the slides and another after them, each
 * marked `data-slidedeck-copy` (`before` or `after`; DOM order does not
 * matter), scrolling past the last snap point arrives at the first, and
 * back. The copies are the caller's to render, inert and `aria-hidden`. Only
 * the slides' snap points are counted: a step across the seam scrolls on
 * onto the copies, and when the viewport comes to rest on a copy's snap
 * point the engine jumps it, instantly, a set of slides back onto the
 * identical slide's snap point. Never mid-motion: a jump then would show and
 * stop momentum. A set of slides no longer than the viewport has nothing to
 * loop: the engine then reports one snap point, as for any deck whose slides
 * all fit, and the caller should drop the copies.
 *
 * It also writes to each slide, and each copy, for CSS to read, once a
 * frame while the viewport scrolls and whenever it settles, never through
 * `onChange` (ADR-0003):
 *
 * - `--deck-slide-progress`: the slide's progress, its signed distance from the
 *   focal position in slides. 0 at the focal position, -1 one slide before
 *   it, 2.25 two and a quarter slides after it, the way the deck runs, so a
 *   vertical or right-to-left deck reads the same. The focal position is the
 *   snap alignment point of the slide resting at the current snap point (see
 *   `DeckState.focal`), placed between the slides by where their own
 *   alignment points are: with a slide exactly at the focal position, every
 *   slide's progress is a whole number whatever the gap. Where the scroll
 *   range keeps the focal slide from reaching it, as at either end of a
 *   centred deck, progress stays fractional at rest. Measured from the
 *   slides' boxes as they are drawn (their snap targets', where there are
 *   any), so an effect should not move a slide's alignment point: scale
 *   about it (`transform-origin`), not away from it.
 * - `data-in-view`: present on each slide with at least one pixel inside the
 *   viewport's scrollport, partly in view included. It hides nothing.
 */
export function createDeck(
  viewport: HTMLElement,
  options: DeckOptions
): DeckEngine {
  // Not a reachable state, so the first settle always publishes.
  let state: DeckState = { index: -1, count: 0, slide: -1, focal: -1 };

  const publish = (next: DeckState) => {
    if (
      next.index === state.index &&
      next.count === state.count &&
      next.slide === state.slide &&
      next.focal === state.focal
    ) {
      return;
    }
    state = next;
    options.onChange(state);
  };

  let vertical = options.orientation === 'vertical';
  // Read afresh for each use: an ancestor's `dir` can change at any time.
  const axis = () => axisOf(viewport, vertical);

  // The deck's snap alignment, read at each settle from the slide resting at
  // the snap point: a slide that does not snap, as within a page, has none.
  // Progress is measured from it; with no slide snapping, from the start.
  let align = 'start';

  // Progress and in-view, written at most once a frame while scrolling.
  let frame = 0;
  const paint = (along = axis()) => {
    cancelAnimationFrame(frame);
    frame = 0;
    writeProgress(viewport, along, align);
  };

  const settle = () => {
    alignCopies(viewport);
    const along = axis();
    const geometry = snapPoints(viewport, along);
    jumpOffCopies(along, geometry);
    const { points, slides } = geometry;
    const index = indexAt(geometry, along.position);
    const slide = slides.indexOf(index);
    const run = slidesOf(viewport);
    align =
      slide === -1 ? 'start' : along.snapAlign(run.boxes[run.first + slide]);
    paint(along);
    publish({
      index,
      count: points.length,
      slide,
      focal: slide === -1 ? -1 : focalSlide(viewport, along, align)
    });
  };

  // Resting on a copy, jump one set of slides onto the identical slide: only
  // on a snap point, as the browser would snap a jump that lands off one,
  // which shows (ADR-0006).
  const jumpOffCopies = (along: Axis, { points, length }: Geometry) => {
    if (length === 0) return;
    const at = along.position;
    const shift =
      at < points[0] - 1 ? length : at > points[0] + length - 1 ? -length : 0;
    if (shift === 0) return;
    const point = points.find((p) => Math.abs(at + shift - p) <= 1);
    if (point !== undefined) along.scrollTo(point, 'instant');
  };

  // The engine's move, a scroll it started (ADR-0006): null when idle, or
  // moving to `target`, the snap point it heads to, until it ends or the
  // user's scroll takes over. A second press steps on from the target, not
  // from where the viewport last rested. With loop it may be a set of slides
  // past either end, on the copies there (see `positionOf`). `stalled` once
  // a quiet has found it short of its target, until its next scroll event.
  // `startMove` and `endMove` below own it, with the quiet that ends it.
  let move: { target: number; stalled: boolean } | null = null;
  // The move has arrived: the viewport is at its target, its end not seen.
  const arrived = ({ target }: { target: number }) => {
    const along = axis();
    const geometry = snapPoints(viewport, along);
    return Math.abs(along.position - positionOf(geometry, target)) < 1;
  };

  // Mouse drag (ADR-0006): see the pointer handlers below.
  let dragEnabled = true;
  let drag: 'idle' | 'dragging' | 'releasing' = 'idle';
  // The mouse button pressed on the viewport, until it lets go; -1 if none.
  let pointer = -1;
  let startX = 0;
  let startY = 0;
  // The axis a drag moves along, fixed when the button is pressed.
  let dragAxis = axis();
  // Where the pointer last was along it.
  let last = 0;
  // How far the pointer has dragged the deck forward, in scroll pixels.
  let travel = 0;
  let samples: { t: number; travel: number }[] = [];
  // A move asked for while the pointer held the deck.
  let deferred: { index: number; across: boolean } | null = null;
  // The viewport's inline styles a drag overrides, while it does.
  let saved: { snap: string; select: string } | null = null;

  const removeSnap = () => {
    if (saved) return;
    const { style } = viewport;
    saved = { snap: style.scrollSnapType, select: style.userSelect };
    style.scrollSnapType = 'none';
    // No text selection follows the pointer across the slides.
    style.userSelect = 'none';
  };
  const restoreSnap = () => {
    if (!saved) return;
    const { style } = viewport;
    // A value the consumer set mid-drag is newer than the saved one, and
    // React would not set it again.
    if (style.scrollSnapType === 'none') style.scrollSnapType = saved.snap;
    if (style.userSelect === 'none') style.userSelect = saved.select;
    saved = null;
  };

  // Set by any scroll, cleared when it ends. A position read mid-scroll is
  // not a settled one, so a refresh then waits for the scroll's end.
  let scrolling = false;
  // Quiet (ADR-0006): a scroll has ended once no scroll event has come for
  // this long. It ends every scroll where `scrollend` is missing, and a move
  // in every engine, as the move's end event may never come. A move short of
  // its target ends only at a second quiet with no scroll between: the
  // first can come just after a long task held the main thread, before the
  // browser has gone on with the scroll, or sent its scroll events.
  const hasScrollEnd = 'onscrollend' in window;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  const stopQuiet = () => clearTimeout(quiet);
  const awaitQuiet = () => {
    stopQuiet();
    quiet = setTimeout(onQuiet, SCROLL_END_DEBOUNCE_MS);
  };
  const onQuiet = () => {
    if (move && !move.stalled && !arrived(move)) {
      move.stalled = true;
      awaitQuiet();
      return;
    }
    scrollEnded();
  };
  const onScroll = () => {
    scrolling = true;
    frame ||= requestAnimationFrame(() => paint());
    if (move) move.stalled = false;
    if (!hasScrollEnd || move) awaitQuiet();
  };
  const startMove = (target: number) => {
    move = { target, stalled: false };
    awaitQuiet();
  };
  // Ends the move, if any, without a settle. Where `scrollend` is there, a
  // scroll the engine did not start ends at its own end event, not quiet.
  const endMove = () => {
    move = null;
    if (hasScrollEnd) stopQuiet();
  };

  // Pointers pressed on the viewport, by id, with their type, until they
  // let go. While one is down the deck does not settle, so it never jumps
  // off a copy under a finger or the mouse; the settle waits for the last
  // to let go. A release must never go unheard, or the deck would never
  // settle again: the window hears every pointerup and pointercancel first,
  // before any listener can stop it; a pointer that moves or comes over
  // anything with no button down has let go; losing focus lets go of all,
  // as the release may then come to another window; and a primary pointer
  // pressed lets go of any other of its type, as none can still be down.
  const pressed = new Map<number, string>();
  let settleOwed = false;
  // Lets go of pointer `id`, or of every pointer.
  const letGo = (id?: number) => {
    if (id === undefined) pressed.clear();
    else if (!pressed.delete(id)) return;
    if (pressed.size > 0 || !settleOwed) return;
    settleOwed = false;
    // A scroll since, as a touch pan, settles at its own end.
    if (!scrolling && !move && drag !== 'dragging') settle();
  };
  const onWindowPointer = (event: PointerEvent) => {
    if (
      event.type === 'pointerup' ||
      event.type === 'pointercancel' ||
      event.buttons === 0
    ) {
      letGo(event.pointerId);
    }
  };
  const onBlur = () => letGo();
  const WINDOW_POINTER = [
    'pointerup',
    'pointercancel',
    'pointermove',
    'pointerover'
  ] as const;

  const scrollEnded = () => {
    // The pointer, not the browser, says where a drag ends.
    if (drag === 'dragging') return;
    // A drag's release rests on its snap point now: snapping can come back
    // without moving it.
    if (drag === 'releasing') {
      drag = 'idle';
      restoreSnap();
    }
    scrolling = false;
    endMove();
    if (pressed.size > 0) {
      settleOwed = true;
      return;
    }
    settle();
  };

  // `scrollend` and `scrollsnapchange` end a move only once it has arrived.
  // Before that, an end is not the move's: it is the late end of an earlier
  // scroll, which Chromium sends a few milliseconds after the viewport
  // arrives, after a move started in those milliseconds, or of a scroll that
  // interrupted the move; or `scrollsnapchange` as the move begins. Quiet
  // ends the move then.
  const onEnd = () => {
    if (move && !arrived(move)) return;
    scrollEnded();
  };

  // The user's scroll ends a move without a settle: the scroll in flight
  // ends as the user's, and nothing the engine asked for resumes. A wheel,
  // a key that scrolls, a touch or pen pan, which the browser takes over
  // with `pointercancel`, and a mouse drag (below). Focus entering a slide
  // scrolls it into view, so it is the user's scroll too, and the deck goes
  // on to it (below). Input that scrolls nothing leaves the move going: a
  // click, even one that focuses a control in another slide, Enter, a key
  // in a text field or one the page has prevented, and focus within a slide
  // or on the viewport, as Tab out of a slide gives (below).
  const onWheel = () => endMove();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || !SCROLL_KEYS.has(event.key)) return;
    const on = event.target;
    if (
      on instanceof HTMLElement &&
      (on.isContentEditable ||
        on.matches('input, textarea, select') ||
        // Space presses a button rather than scroll.
        (event.key === ' ' && on.matches('button, summary')))
    ) {
      return;
    }
    endMove();
  };
  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') endMove();
    onPointerUp(event);
  };
  // Focus in the viewport during a move scrolls the focus into view, and in
  // Chromium that stops the move's scroll where it is (ADR-0006). Focus
  // entering a slide from outside it, as Tab does, is the user's: focus
  // wins, and the move is replaced by one to the snap point of the focused
  // slide's page, so the deck rests with the focus in view. Focus within a
  // slide or on the viewport is not: the move goes on to its own target.
  // Either way the move's scroll starts again two frames on: the browser
  // scrolls the focus into view after this event, and Chromium ignores a
  // smooth scroll asked for until a frame after that, to the stopped
  // scroll's target above all. A looping move's target may be on the
  // copies, so the scroll may go across. A new move's target is set now, so
  // the end of the stopped scroll is a late one. A pointer pressed on the
  // viewport, as a mouse pressing a control in a slide, is a click: it
  // leaves the move going.
  let focusFrame = 0;
  const resume = () => {
    const focused = move;
    cancelAnimationFrame(focusFrame);
    focusFrame = requestAnimationFrame(() => {
      focusFrame = requestAnimationFrame(() => {
        if (focused && move === focused) scrollTo(focused.target, true);
      });
    });
  };
  const onFocusIn = (event: FocusEvent) => {
    if (!move || pressed.size > 0) return;
    let slide = event.target instanceof Element ? event.target : null;
    while (slide && slide.parentElement !== viewport) {
      slide = slide.parentElement;
    }
    const from = event.relatedTarget;
    if (!slide || (from instanceof Node && slide.contains(from))) {
      resume();
      return;
    }
    const { slides: own, boxes, first } = slidesOf(viewport);
    const index = own.indexOf(slide);
    if (index === -1) return;
    const along = axis();
    const geometry = snapPoints(viewport, along);
    const owner = pageOwner(viewport, along, geometry.slides, index);
    // A slide in no page, as one before the first snap point where the
    // slides snap to their start, goes to the snap point nearest its start,
    // so the deck still rests on a snap point.
    const target =
      owner === -1
        ? indexAt(
            geometry,
            along.position +
              alignOffset(along, along.view(), boxes[first + index], 'start')
          )
        : geometry.slides[owner];
    startMove(target);
    resume();
  };

  const refresh = () => {
    if (!scrolling && !move && drag !== 'dragging') settle();
    else paint();
  };

  // `across` lets a looping deck's move run past either end onto the copies
  // there, as a step across the seam does; otherwise it stays on the slides.
  const scrollTo = (index: number, across = false) => {
    // The pointer holds the deck: go there once it lets go.
    if (drag === 'dragging') {
      deferred = { index, across };
      return;
    }
    const along = axis();
    const geometry = snapPoints(viewport, along);
    const count = geometry.points.length;
    // Nowhere to scroll to: a move started now would never arrive either.
    if (!Number.isFinite(index) || count === 0) return;
    let next = across && geometry.length > 0 ? index : clamp(index, count);
    // A loop has no end, but a move can only run as far as the copies: a
    // move past them, as when presses come faster than the deck moves, goes
    // to the same slide's nearest copy, or the slide, ahead of the viewport
    // the way the move goes. Where none is ahead, as when presses come about
    // as fast as the deck moves and the viewport has overtaken them, it goes
    // to the furthest snap point ahead the copies reach, and a press beyond
    // that is dropped. So the deck passes fewer slides than were pressed, but
    // never moves against a press, never jumps mid-motion, and only ever
    // goes where it reports it rests (ADR-0009). Ahead means at least half
    // a snap point on: the viewport as read can trail the scroll by a frame.
    // A copy's snap point past either end of the scroll range, as a centred
    // deck's last copies' are, is out of reach like one past the copies.
    if (across && geometry.length > 0 && !reachable(geometry, along, next)) {
      const at = along.position;
      const ahead = Math.sign(positionOf(geometry, next) - at) || 1;
      const margin = geometry.length / count / 2;
      const distance = (i: number) => (positionOf(geometry, i) - at) * ahead;
      const onward = [-1, 0, 1]
        .map((set) => wrap(next, count) + set * count)
        .filter((i) => reachable(geometry, along, i) && distance(i) > margin);
      if (onward.length > 0) {
        next = onward.reduce((a, b) => (distance(b) < distance(a) ? b : a));
      } else {
        let furthest = ahead > 0 ? 2 * count - 1 : -count;
        while (!reachable(geometry, along, furthest)) furthest -= ahead;
        // Already there, or heading there: the press is dropped.
        if (furthest === move?.target || distance(furthest) <= margin) {
          return;
        }
        next = furthest;
      }
    }
    const to = positionOf(geometry, next);
    // A scroll to where the viewport already rests is no move: there is
    // nowhere to go.
    if (!move && Math.abs(along.position - to) < 1) return;
    // A move in flight, arrived or not, is superseded: it never settles.
    startMove(next);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    along.scrollTo(to, reduce ? 'instant' : 'smooth');
  };

  // With one slide per snap point, server HTML already rests here where the
  // browser honours `scroll-initial-target`, and this scroll is a no-op.
  // Where slides share snap points, slide `index` may rest at another snap
  // point, so the first paint may correct: server HTML cannot measure.
  const along = axis();
  const { points } = snapPoints(viewport, along);
  const start = points[clamp(options.index, points.length)] ?? 0;
  if (Math.abs(along.position - start) >= 1) along.scrollTo(start, 'instant');
  settle();

  // `scrollsnapchange` reports a settled snap target where it exists, no
  // later than `scrollend`; `publish` drops whichever report comes second.
  viewport.addEventListener('scroll', onScroll, { passive: true });
  viewport.addEventListener('scrollsnapchange', onEnd);
  viewport.addEventListener('scrollend', onEnd);
  viewport.addEventListener('wheel', onWheel, { passive: true });
  viewport.addEventListener('keydown', onKeyDown);
  viewport.addEventListener('focusin', onFocusIn);
  // A resize can add or remove snap points without any scroll, and only
  // Chromium reports that through `scrollsnapchange`.
  const resizes = new ResizeObserver(refresh);
  resizes.observe(viewport);
  // A media query can change which slides snap, as when a breakpoint changes
  // the page size, without resizing the viewport at all.
  window.addEventListener('resize', refresh);

  // Mouse drag (ADR-0006). Touch, pen and trackpad scroll natively. While
  // the primary button drags, snapping is off and the pointer moves the
  // scroll position. On release the velocity is projected to a snap point,
  // the engine scrolls there with snapping still off, and snapping comes back
  // when that scroll ends. Restoring snapping at release instead lets the
  // browser re-snap before the next frame, ignoring a flick.
  const onPointerDown = (event: PointerEvent) => {
    // A mouse's other buttons open menus, which can swallow the pointerup.
    if (event.pointerType !== 'mouse' || event.button === 0) {
      if (event.isPrimary) {
        for (const [id, type] of pressed) {
          if (type === event.pointerType) pressed.delete(id);
        }
      }
      pressed.set(event.pointerId, event.pointerType);
    }
    if (
      !dragEnabled ||
      event.pointerType !== 'mouse' ||
      event.button !== 0 ||
      drag === 'dragging'
    ) {
      return;
    }
    pointer = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragAxis = axis();
    last = dragAxis.at(event);
    travel = 0;
    samples = [{ t: event.timeStamp, travel: 0 }];
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    // The button let go where the viewport did not hear it.
    if ((event.buttons & 1) === 0) {
      release(event);
      return;
    }
    if (drag !== 'dragging') {
      if (!dragEnabled) return;
      // Under the threshold a press is still a click.
      const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (moved < DRAG_THRESHOLD_PX) return;
      // The drag takes over any scroll in flight, its own release included:
      // where the deck goes now is decided when the pointer lets go.
      drag = 'dragging';
      endMove();
      removeSnap();
      viewport.setPointerCapture(pointer);
    }
    // The deck follows the pointer: a pointer moving toward the deck's start
    // drags it forward.
    const at = dragAxis.at(event);
    const delta = last - at;
    last = at;
    dragAxis.position += delta;
    travel += delta;
    samples.push({ t: event.timeStamp, travel });
    if (samples.length > MAX_SAMPLES) samples.shift();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId === pointer) release(event);
  };

  // Lost mid-drag, the capture may never deliver the pointerup. After a
  // pointerup, which releases the capture, the pointer is already let go.
  const onLostCapture = (event: PointerEvent) => {
    if (event.pointerId === pointer && drag === 'dragging') release(event);
  };

  const release = (event: PointerEvent) => {
    pointer = -1;
    if (drag !== 'dragging') return;
    suppressClick();
    // With loop, the copies' snap points too, a set of slides either way.
    const geometry = snapPoints(viewport, dragAxis);
    const reach = geometry.length > 0 ? geometry.points.length : 0;
    const points = Array.from(
      { length: geometry.points.length + 2 * reach },
      (_, i) => positionOf(geometry, i - reach)
    );
    const position = dragAxis.position;
    const velocity = releaseVelocity(samples, event.timeStamp);
    let next = nearest(points, position + velocity * MOMENTUM_MS);
    // A flick always moves at least one snap point the way it was thrown.
    if (
      Math.abs(velocity) > FLICK_PX_PER_MS &&
      (points[next] - position) * velocity <= 0
    ) {
      const ahead =
        velocity > 0
          ? points.findIndex((point) => point > position)
          : points.filter((point) => point < position).length - 1;
      if (ahead !== -1) next = ahead;
    }
    drag = 'releasing';
    if (deferred) scrollTo(deferred.index, deferred.across);
    else scrollTo(next - reach, true);
    deferred = null;
    // Already resting there, or nowhere to go: no scroll will end.
    if (!move) scrollEnded();
  };

  // A drag ends in a click on whatever the pointer pressed, such as a link
  // in a slide: swallow that one click.
  const suppressClick = () => {
    const swallow = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    viewport.addEventListener('click', swallow, { capture: true, once: true });
    // The click, if any, comes in the same task as the release.
    setTimeout(() => viewport.removeEventListener('click', swallow, true));
  };

  // A pressed link or image would start the browser's own drag and drop.
  const onDragStart = (event: Event) => {
    if (pointer !== -1) event.preventDefault();
  };

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerCancel);
  for (const type of WINDOW_POINTER) {
    window.addEventListener(type, onWindowPointer, { capture: true });
  }
  window.addEventListener('blur', onBlur);
  viewport.addEventListener('lostpointercapture', onLostCapture);
  viewport.addEventListener('dragstart', onDragStart);

  let clickToFocus = false;
  // A bubbling listener: the click ending a drag is swallowed before it.
  // A pointer affordance: a keyboard click (detail 0) leaves the deck alone,
  // as focus moving into a slide already scrolls it into view.
  const onClick = (event: MouseEvent) => {
    if (!clickToFocus || state.slide === -1 || event.detail === 0) return;
    let slide = event.target instanceof Element ? event.target : null;
    while (slide && slide.parentElement !== viewport) {
      slide = slide.parentElement;
    }
    const along = axis();
    const { run, slides: own, first } = slidesOf(viewport);
    // A loop's copy is inert, so a click on it reaches the viewport itself:
    // the copy is the one under the pointer.
    let at = slide ? run.indexOf(slide) : -1;
    if (at === -1 && event.target === viewport) {
      const point = along.at(event);
      at = run.findIndex((box) => {
        const [start, end] = along.span(box.getBoundingClientRect());
        return start <= point && point < end;
      });
    }
    if (at === -1) return;
    // The snap point of the clicked slide's page. One slide to a page, that
    // is the slide's own. A copy's is a set of slides on from its slide's,
    // the way it is from the slides, so the deck moves to it across the seam.
    const index = wrap(at - first, own.length);
    const set = Math.floor((at - first) / own.length);
    const { points, slides } = snapPoints(viewport, along);
    const owner = pageOwner(viewport, along, slides, index);
    if (owner !== -1) scrollTo(slides[owner] + set * points.length, true);
  };
  viewport.addEventListener('click', onClick);

  // From the snap point a scroll in flight is heading to, if any. With loop,
  // a step from the last snap point goes on across the seam to the first.
  // At rest, from the snap point the viewport is at, a copy's included, so
  // a step from a copy the deck could not jump off still goes the way it is
  // pressed.
  const step = (delta: number) => {
    if (move) {
      scrollTo(move.target + delta, true);
      return;
    }
    const along = axis();
    const geometry = snapPoints(viewport, along);
    const count = geometry.points.length;
    if (geometry.length === 0 || count === 0) {
      scrollTo(state.index + delta, true);
      return;
    }
    let here = 0;
    const distance = (i: number) =>
      Math.abs(positionOf(geometry, i) - along.position);
    for (let i = -count; i < 2 * count; i++) {
      if (distance(i) < distance(here)) here = i;
    }
    scrollTo(here + delta, true);
  };

  return {
    scrollTo(index, way = 'direct') {
      const along = axis();
      const geometry = snapPoints(viewport, along);
      const count = geometry.points.length;
      if (way === 'direct' || geometry.length === 0) {
        scrollTo(index);
        return;
      }
      if (!Number.isFinite(index) || count === 0) return;
      // The slide's snap point or either copy of it, whichever is nearest.
      const same = [-1, 0, 1].map((set) => clamp(index, count) + set * count);
      const distance = (i: number) =>
        Math.abs(positionOf(geometry, i) - along.position);
      scrollTo(
        same.reduce((a, b) => (distance(b) < distance(a) ? b : a)),
        true
      );
    },
    next: () => step(1),
    prev: () => step(-1),
    // A target on the copies is the slides' snap point it copies.
    target: () => (move ? wrap(move.target, state.count) : null),
    refresh,
    setDrag(enabled) {
      dragEnabled = enabled;
    },
    setClickToFocus(enabled) {
      clickToFocus = enabled;
    },
    setOrientation(orientation) {
      vertical = orientation === 'vertical';
      refresh();
    },
    destroy() {
      stopQuiet();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
      for (const slide of slidesOf(viewport).run) {
        slide.removeAttribute(IN_VIEW);
        if (slide instanceof HTMLElement) slide.style.removeProperty(PROGRESS);
      }
      resizes.disconnect();
      window.removeEventListener('resize', refresh);
      viewport.removeEventListener('scroll', onScroll);
      viewport.removeEventListener('scrollsnapchange', onEnd);
      viewport.removeEventListener('scrollend', onEnd);
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('keydown', onKeyDown);
      viewport.removeEventListener('focusin', onFocusIn);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
      viewport.removeEventListener('pointercancel', onPointerCancel);
      for (const type of WINDOW_POINTER) {
        window.removeEventListener(type, onWindowPointer, { capture: true });
      }
      window.removeEventListener('blur', onBlur);
      viewport.removeEventListener('lostpointercapture', onLostCapture);
      viewport.removeEventListener('dragstart', onDragStart);
      viewport.removeEventListener('click', onClick);
      restoreSnap();
    }
  };
}

const SCROLL_END_DEBOUNCE_MS = 100;
/** Keys a focused scroller scrolls by. */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' '
]);

const PROGRESS = '--deck-slide-progress';
/** Marks a viewport child as a snap target rather than a slide. */
export const SNAP_TARGET = 'data-slidedeck-snap-target';
/** Marks a viewport child as a loop's copy of a slide rather than a slide:
 * `before` the slides, or `after` them. */
export const COPY = 'data-slidedeck-copy';
const IN_VIEW = 'data-in-view';
/** How much of a slide the scrollport must show for it to be in view. */
const IN_VIEW_MIN_PX = 1;

/** How far a mouse moves with its button down before a press is a drag. */
const DRAG_THRESHOLD_PX = 5;
/** Below this release speed, a drag places the deck rather than flicks it. */
const FLICK_PX_PER_MS = 0.4;
/** How far a flick carries: this long at its release speed. */
const MOMENTUM_MS = 220;
/** How many of the drag's latest moves it keeps to measure release speed. */
const MAX_SAMPLES = 8;
/** A pointer held still this long before letting go releases at rest. */
const STILL_MS = 60;
/** Release speed is measured over the drag's moves this long before its
 * last one. */
const VELOCITY_WINDOW_MS = 80;

/** Scroll pixels per ms over the drag's last moments; 0 if the pointer held
 * still before letting go. */
function releaseVelocity(
  samples: { t: number; travel: number }[],
  now: number
): number {
  const last = samples[samples.length - 1];
  if (now - last.t > STILL_MS) return 0;
  const first =
    samples.find((s) => last.t - s.t <= VELOCITY_WINDOW_MS) ?? samples[0];
  const dt = last.t - first.t;
  return dt > 0 ? (last.travel - first.travel) / dt : 0;
}

const clamp = (index: number, count: number) =>
  Math.min(Math.max(index, 0), count - 1);

/** `index` wrapped onto 0 up to `count`, as a loop's copies are onto the
 * slides. */
const wrap = (index: number, count: number) =>
  ((index % count) + count) % count;

/** Where snap point `index` rests. With loop, an index up to a set of slides
 * past either end is on the copies there: -1 is the last slide's copy before
 * the slides. */
function positionOf({ points, length }: Geometry, index: number): number {
  const set = Math.floor(index / points.length);
  return points[index - set * points.length] + set * length;
}

/** Whether a looping deck can rest at snap point `index`: a slide's, or a
 * copy's up to a set past either end that the scroll range reaches. */
function reachable(geometry: Geometry, axis: Axis, index: number): boolean {
  const count = geometry.points.length;
  if (index < -count || index > 2 * count - 1) return false;
  const position = positionOf(geometry, index);
  return position >= -1 && position <= axis.max() + 1;
}

/** The snap point nearest `position`; with loop, once a position on the
 * copies is wrapped onto the slides. */
function indexAt({ points, length }: Geometry, position: number): number {
  if (length === 0) return nearest(points, position);
  const start = points[0];
  const wrapped = start + wrap(position - start, length);
  // Just short of a set past the first point is the first point again.
  return nearest([...points, start + length], wrapped) % points.length;
}

function nearest(points: number[], position: number): number {
  let best = 0;
  points.forEach((point, i) => {
    if (Math.abs(point - position) < Math.abs(points[best] - position)) {
      best = i;
    }
  });
  return best;
}

/**
 * The viewport's slides; the run of slides along the axis, which with loop is
 * the copies before the slides (children marked `data-slidedeck-copy=before`),
 * the slides and the copies after them, and without is the slides; and the
 * box each of the run is measured by: its own, or where the viewport holds
 * snap targets (children marked `data-slidedeck-snap-target`), the target in
 * the same place among them. Snap targets and copies are not slides. An effect
 * that stacks the slides in one place, where none of them could mark a snap
 * point, lays out one per slide, and per copy, along the axis instead.
 * `first` is where slide 0 is in the run.
 */
function slidesOf(viewport: HTMLElement): {
  slides: Element[];
  run: Element[];
  boxes: Element[];
  first: number;
} {
  const slides: Element[] = [];
  const before: Element[] = [];
  const after: Element[] = [];
  const targets: Element[] = [];
  for (const child of viewport.children) {
    if (child.hasAttribute(SNAP_TARGET)) targets.push(child);
    else if (!child.hasAttribute(COPY)) slides.push(child);
    else (child.getAttribute(COPY) === 'before' ? before : after).push(child);
  }
  const run = [...before, ...slides, ...after];
  const boxes =
    targets.length === 0 ? run : run.map((slide, i) => targets[i] ?? slide);
  return { slides, run, boxes, first: before.length };
}

/**
 * Gives each loop copy its slide's snap alignment, inline: CSS that picks the
 * slides that snap by their place among the viewport's children, as
 * `:nth-child()` does for pages, would pick other copies. Written only where
 * it differs, so a settle lays out once.
 */
function alignCopies(viewport: HTMLElement) {
  const { slides, run, first } = slidesOf(viewport);
  if (first === 0) return;
  // The whole value, both axes, not the axis's: a copy must snap as its
  // slide does on either axis, so it is copied as it is, not read.
  const aligns = slides.map((slide) => getComputedStyle(slide).scrollSnapAlign);
  run.forEach((copy, i) => {
    if (i >= first && i < first + slides.length) return;
    const align = aligns[wrap(i - first, slides.length)];
    if (copy instanceof HTMLElement && copy.style.scrollSnapAlign !== align) {
      copy.style.scrollSnapAlign = align;
    }
  });
}

/** The slides' snap points; see `snapPoints`. */
interface Geometry {
  /** The slides' snap points, ascending; never the copies'. */
  points: number[];
  /** For each slide, the index of the point it rests at, or -1. */
  slides: number[];
  /** With loop, how far one set of slides runs along the axis, from a slide
   * to its copy after the slides; 0 without. */
  length: number;
}

/**
 * The scroll positions the viewport can rest at, ascending, as the browser
 * derives them from each slide's `scroll-snap-align`, and for each slide the
 * index of the point it rests at (-1 if it does not snap). A slide's snap
 * alignment and position are its measured box's (see `slidesOf`).
 * Slides that clamp to the same scroll position share one snap point. With
 * loop, only the slides' points, not the copies' (see `Geometry`).
 */
function snapPoints(viewport: HTMLElement, axis: Axis): Geometry {
  const max = axis.max();
  const position = axis.position;
  const view = axis.view();
  const { slides, boxes, first } = slidesOf(viewport);
  const own = boxes.slice(first, first + slides.length);
  const positions: (number | null)[] = [];
  for (const slide of own) {
    const align = axis.snapAlign(slide);
    if (align === 'none') {
      positions.push(null);
      continue;
    }
    const offset = alignOffset(axis, view, slide, align);
    positions.push(Math.round(Math.min(Math.max(position + offset, 0), max)));
  }
  const points = [
    ...new Set(positions.filter((p): p is number => p !== null))
  ].sort((a, b) => a - b);
  // From slide 0 to its copy after the slides.
  const length =
    first > 0 && boxes.length > first + slides.length
      ? axis.span(boxes[first + slides.length].getBoundingClientRect())[0] -
        axis.span(boxes[first].getBoundingClientRect())[0]
      : 0;
  // A set no longer than the viewport would bring a copy into view beside
  // its own slide: nothing to loop, as with any deck whose slides all fit.
  if (length > 0 && length - (view[1] - view[0]) < 1) {
    return {
      points: points.slice(0, 1),
      slides: positions.map((p) => (p === null ? -1 : 0)),
      length: 0
    };
  }
  return {
    points,
    slides: positions.map((p) => (p === null ? -1 : points.indexOf(p))),
    length
  };
}

/**
 * The snapping slide whose page holds slide `index`, as its alignment reaches:
 * of the snapping slides `start`-aligned at or before it, `end`-aligned at or
 * after it, or `center`-aligned either side, the nearest; -1 if none.
 * `slides` is from `snapPoints`.
 */
function pageOwner(
  viewport: HTMLElement,
  axis: Axis,
  slides: number[],
  index: number
): number {
  let owner = -1;
  const { boxes, first } = slidesOf(viewport);
  slides.forEach((point, i) => {
    if (point === -1) return;
    const align = axis.snapAlign(boxes[first + i]);
    if ((align === 'start' && i > index) || (align === 'end' && i < index)) {
      return;
    }
    if (owner === -1 || Math.abs(i - index) < Math.abs(owner - index)) {
      owner = i;
    }
  });
  return owner;
}

/** A span along the deck's axis: where something starts and ends, measured
 * the way the deck runs. */
type Span = [start: number, end: number];

/**
 * The deck's axis, as the viewport lays it out now. Every scroll position and
 * measurement the engine uses runs along it from the deck's start, so the
 * rest of the engine never asks which way the deck runs. Horizontal follows
 * the viewport's writing direction: in right-to-left the start is the right
 * edge, and browsers report `scrollLeft` as 0 there and negative past it.
 */
interface Axis {
  /** How far the viewport has scrolled from the deck's start. */
  position: number;
  /** The furthest the viewport can scroll from the start. */
  max(): number;
  scrollTo(position: number, behavior: ScrollBehavior): void;
  /** Where a point on screen falls along the axis. */
  at(point: { clientX: number; clientY: number }): number;
  /** Where a box on screen spans along the axis. */
  span(box: { left: number; right: number; top: number; bottom: number }): Span;
  /** Where the viewport's scrollport spans along the axis. */
  view(): Span;
  /** A slide's `scroll-snap-align` along the axis: of its block and inline
   * values, the block for a vertical deck, the inline for a horizontal one. */
  snapAlign(slide: Element): string;
}

function axisOf(viewport: HTMLElement, vertical: boolean): Axis {
  const sign =
    !vertical && getComputedStyle(viewport).direction === 'rtl' ? -1 : 1;
  const span: Axis['span'] = (box) =>
    vertical
      ? [box.top, box.bottom]
      : sign === 1
        ? [box.left, box.right]
        : [-box.right, -box.left];
  return {
    get position() {
      return vertical ? viewport.scrollTop : sign * viewport.scrollLeft;
    },
    set position(position) {
      if (vertical) viewport.scrollTop = position;
      else viewport.scrollLeft = sign * position;
    },
    max: () =>
      vertical
        ? viewport.scrollHeight - viewport.clientHeight
        : viewport.scrollWidth - viewport.clientWidth,
    scrollTo: (position, behavior) =>
      viewport.scrollTo(
        vertical
          ? { top: position, behavior }
          : { left: sign * position, behavior }
      ),
    at: (point) => (vertical ? point.clientY : sign * point.clientX),
    span,
    view() {
      const box = viewport.getBoundingClientRect();
      const left = box.left + viewport.clientLeft;
      const top = box.top + viewport.clientTop;
      return span({
        left,
        right: left + viewport.clientWidth,
        top,
        bottom: top + viewport.clientHeight
      });
    },
    snapAlign(slide) {
      const values = getComputedStyle(slide).scrollSnapAlign.split(' ');
      return (vertical ? values[0] : values.pop()) ?? 'none';
    }
  };
}

/** How far the viewport would scroll to put `slide` at the alignment point
 * for `align`, unclamped: 0 when it is there now. `view` is the axis's. */
function alignOffset(
  axis: Axis,
  view: Span,
  slide: Element,
  align: string
): number {
  return spanOffset(axis.span(slide.getBoundingClientRect()), view, align);
}

/** `alignOffset` for a slide spanning `[start, end]` along the axis. */
function spanOffset([start, end]: Span, view: Span, align: string): number {
  return align === 'center'
    ? (start + end) / 2 - (view[0] + view[1]) / 2
    : align === 'end'
      ? end - view[1]
      : start - view[0];
}

/** The slide nearest the alignment point for `align`, by its measured box;
 * with loop, the slide a copy there copies. */
function focalSlide(viewport: HTMLElement, axis: Axis, align: string): number {
  const view = axis.view();
  const { slides, boxes, first } = slidesOf(viewport);
  let best = -1;
  let distance = Infinity;
  boxes.forEach((slide, i) => {
    const d = Math.abs(alignOffset(axis, view, slide, align));
    if (d < distance) {
      best = i;
      distance = d;
    }
  });
  return best === -1 ? -1 : wrap(best - first, slides.length);
}

/**
 * Writes each slide's progress and in-view state (see `createDeck`). Measures
 * every slide before writing to any, and writes only what changed, so a frame
 * lays out once.
 */
function writeProgress(viewport: HTMLElement, axis: Axis, align: string) {
  const view = axis.view();
  // With loop, the copies too, each by its own place in the run: a copy in
  // view moves on as the slides do, and lands where its slide is after a
  // jump.
  const { run: slides, boxes } = slidesOf(viewport);
  const spans = boxes.map((box) => axis.span(box.getBoundingClientRect()));
  const focal = focalPosition(
    spans.map((span) => spanOffset(span, view, align)),
    spans
  );
  slides.forEach((slide, i) => {
    const [start, end] = spans[i];
    const inView =
      Math.min(end, view[1]) - Math.max(start, view[0]) >= IN_VIEW_MIN_PX;
    if (slide.hasAttribute(IN_VIEW) !== inView) {
      slide.toggleAttribute(IN_VIEW, inView);
    }
    if (!(slide instanceof HTMLElement)) return;
    const progress = String(Math.round((i - focal) * 1000) / 1000);
    if (slide.style.getPropertyValue(PROGRESS) !== progress) {
      slide.style.setProperty(PROGRESS, progress);
    }
  });
}

/**
 * Where the alignment point falls among the slides, in slides: 2 at slide
 * 2's alignment point, 2.25 a quarter of the way on to slide 3's. Before the
 * first slide's or past the last's, it carries on at the spacing of the
 * nearest two. `offsets` are the slides' `spanOffset`s, ascending.
 */
function focalPosition(offsets: number[], spans: Span[]): number {
  if (offsets.length === 0) return 0;
  if (offsets.length === 1) {
    const extent = spans[0][1] - spans[0][0];
    return extent > 0 ? -offsets[0] / extent : 0;
  }
  const before = offsets.filter((offset) => offset <= 0).length - 1;
  const k = clamp(before, offsets.length - 1);
  const spacing = offsets[k + 1] - offsets[k];
  return spacing > 0 ? k - offsets[k] / spacing : k;
}
