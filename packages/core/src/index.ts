/** What a deck publishes: where it rests, and how many places it can rest. */
export interface DeckState {
  /** The current index: the snap point the viewport is resting at. */
  index: number;
  /** How many snap points the viewport has. One means every slide fits. */
  count: number;
  /** The current slide: the first child of the viewport resting at the
   * current snap point. */
  slide: number;
}

export interface DeckOptions {
  /** The snap point to start at, clamped to the snap points there are. */
  index: number;
  /** Called when the current index, the snap point count or the current
   * slide changes. */
  onChange: (state: DeckState) => void;
}

export interface DeckEngine {
  /** Scrolls to a snap point, clamped to the snap points there are. Does
   * nothing for a non-finite index, or while there are no snap points. */
  scrollTo(index: number): void;
  next(): void;
  prev(): void;
  /** The snap point a scroll the engine started is heading to, until it
   * ends; null when none is in flight. */
  target(): number | null;
  /** Re-reads the snap points, as after slides are added or removed. */
  refresh(): void;
  /** Turns mouse drag on or off; on from the start. A drag already under way
   * finishes. */
  setDrag(enabled: boolean): void;
  destroy(): void;
}

/**
 * Tracks the snap point a native scroll container rests at and asks it to
 * move. The browser does the scrolling and snapping; the engine reads where
 * it settled from layout, so slide size, gap and alignment stay plain CSS.
 */
export function createDeck(
  viewport: HTMLElement,
  options: DeckOptions
): DeckEngine {
  // Not a reachable state, so the first settle always publishes.
  let state: DeckState = { index: -1, count: 0, slide: -1 };

  const publish = (next: DeckState) => {
    if (
      next.index === state.index &&
      next.count === state.count &&
      next.slide === state.slide
    ) {
      return;
    }
    state = next;
    options.onChange(state);
  };

  const settle = () => {
    const { points, slides } = snapPoints(viewport);
    const index = nearest(points, viewport.scrollLeft);
    publish({ index, count: points.length, slide: slides.indexOf(index) });
  };

  // The snap point a step is scrolling to, until the scroll ends: a second
  // press steps on from there, not from where the viewport last rested.
  let target: number | null = null;

  // Mouse drag (ADR-0006): see the pointer handlers below.
  let dragEnabled = true;
  let drag: 'idle' | 'dragging' | 'releasing' = 'idle';
  // The mouse button pressed on the viewport, until it lets go; -1 if none.
  let pointer = -1;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  // How far the pointer has dragged the deck forward, in scroll pixels.
  let travel = 0;
  let samples: { t: number; travel: number }[] = [];
  // A scrollTo asked for while the pointer held the deck.
  let deferred: number | null = null;
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
  // Where `scrollend` is missing, a scroll has ended once no scroll event has
  // come for this long (ADR-0006).
  const hasScrollEnd = 'onscrollend' in window;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  const onScroll = () => {
    scrolling = true;
    if (hasScrollEnd) return;
    clearTimeout(quiet);
    quiet = setTimeout(scrollEnded, SCROLL_END_DEBOUNCE_MS);
  };

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
    target = null;
    settle();
  };

  // Chromium can fire `scrollsnapchange` as a scroll the engine started
  // begins, before the viewport moves: that is not the scroll's end, and
  // clearing the target then would lose where it is heading. `scrollend`
  // still ends any scroll, including one a user interrupts.
  const onSnapChange = () => {
    if (target !== null) {
      const { points } = snapPoints(viewport);
      if (Math.abs(viewport.scrollLeft - points[target]) >= 1) return;
    }
    scrollEnded();
  };

  const refresh = () => {
    if (!scrolling && target === null && drag !== 'dragging') settle();
  };

  const scrollTo = (index: number) => {
    // The pointer holds the deck: go there once it lets go.
    if (drag === 'dragging') {
      deferred = index;
      return;
    }
    const { points } = snapPoints(viewport);
    // Nowhere to scroll to: a target set now would never clear either.
    if (!Number.isFinite(index) || points.length === 0) return;
    const next = clamp(index, points.length);
    // A scroll to where the viewport already rests ends no scroll, so a
    // target set for it would never clear and would block every refresh.
    if (target === null && Math.abs(viewport.scrollLeft - points[next]) < 1) {
      return;
    }
    target = next;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({
      left: points[target],
      behavior: reduce ? 'instant' : 'smooth'
    });
  };

  // With one slide per snap point, server HTML already rests here where the
  // browser honours `scroll-initial-target`, and this scroll is a no-op.
  // Where slides share snap points, slide `index` may rest at another snap
  // point, so the first paint may correct: server HTML cannot measure.
  const { points } = snapPoints(viewport);
  const start = points[clamp(options.index, points.length)] ?? 0;
  if (Math.abs(viewport.scrollLeft - start) >= 1) {
    viewport.scrollTo({ left: start, behavior: 'instant' });
  }
  settle();

  // `scrollsnapchange` reports a settled snap target where it exists, no
  // later than `scrollend`; `publish` drops whichever report comes second.
  viewport.addEventListener('scroll', onScroll, { passive: true });
  viewport.addEventListener('scrollsnapchange', onSnapChange);
  viewport.addEventListener('scrollend', scrollEnded);
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
    if (
      !dragEnabled ||
      event.pointerType !== 'mouse' ||
      event.button !== 0 ||
      drag === 'dragging'
    ) {
      return;
    }
    pointer = event.pointerId;
    startX = lastX = event.clientX;
    startY = event.clientY;
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
      target = null;
      removeSnap();
      viewport.setPointerCapture(pointer);
    }
    const delta = lastX - event.clientX;
    lastX = event.clientX;
    viewport.scrollLeft += delta;
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
    const { points } = snapPoints(viewport);
    const position = viewport.scrollLeft;
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
    scrollTo(deferred ?? next);
    deferred = null;
    // Already resting there, or nowhere to go: no scroll will end.
    if (target === null) scrollEnded();
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
  viewport.addEventListener('pointercancel', onPointerUp);
  viewport.addEventListener('lostpointercapture', onLostCapture);
  viewport.addEventListener('dragstart', onDragStart);

  // From the snap point a scroll in flight is heading to, if any.
  const step = (delta: number) => scrollTo((target ?? state.index) + delta);

  return {
    scrollTo,
    next: () => step(1),
    prev: () => step(-1),
    target: () => target,
    refresh,
    setDrag(enabled) {
      dragEnabled = enabled;
    },
    destroy() {
      clearTimeout(quiet);
      resizes.disconnect();
      window.removeEventListener('resize', refresh);
      viewport.removeEventListener('scroll', onScroll);
      viewport.removeEventListener('scrollsnapchange', onSnapChange);
      viewport.removeEventListener('scrollend', scrollEnded);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
      viewport.removeEventListener('pointercancel', onPointerUp);
      viewport.removeEventListener('lostpointercapture', onLostCapture);
      viewport.removeEventListener('dragstart', onDragStart);
      restoreSnap();
    }
  };
}

const SCROLL_END_DEBOUNCE_MS = 100;

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
 * The scroll positions the viewport can rest at, ascending, as the browser
 * derives them from each slide's `scroll-snap-align`, and for each child of
 * the viewport the index of the point it rests at (-1 if it does not snap).
 * Slides that clamp to the same scroll position share one snap point.
 */
function snapPoints(viewport: HTMLElement): {
  points: number[];
  slides: number[];
} {
  const view = viewport.getBoundingClientRect();
  const start = view.left + viewport.clientLeft;
  const width = viewport.clientWidth;
  const max = viewport.scrollWidth - width;
  const positions: (number | null)[] = [];
  for (const slide of viewport.children) {
    // The inline axis is the last of `scroll-snap-align`'s values.
    const align = getComputedStyle(slide).scrollSnapAlign.split(' ').pop();
    if (align === 'none') {
      positions.push(null);
      continue;
    }
    const box = slide.getBoundingClientRect();
    const offset =
      align === 'center'
        ? box.left + box.width / 2 - width / 2
        : align === 'end'
          ? box.right - width
          : box.left;
    positions.push(
      Math.round(
        Math.min(Math.max(viewport.scrollLeft + offset - start, 0), max)
      )
    );
  }
  const points = [
    ...new Set(positions.filter((p): p is number => p !== null))
  ].sort((a, b) => a - b);
  return {
    points,
    slides: positions.map((p) => (p === null ? -1 : points.indexOf(p)))
  };
}
