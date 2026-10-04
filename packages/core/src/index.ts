/** What a deck publishes: where it rests, and how many places it can rest. */
export interface DeckState {
  /** The current index: the snap point the viewport is resting at. */
  index: number;
  /** How many snap points the viewport has. One means every slide fits. */
  count: number;
  /** The current slide: the first child of the viewport resting at the
   * current snap point. */
  slide: number;
  /** The focal slide: the child of the viewport nearest the snap alignment
   * point, read from the current slide's `scroll-snap-align`. Not the
   * current slide where several slides are in view; -1 if no slide snaps. */
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
 * It also writes to each child of the viewport, for CSS to read, once a
 * frame while the viewport scrolls and whenever it settles, never through
 * `onChange` (ADR-0003):
 *
 * - `--deck-progress`: the slide's progress, its signed distance from the
 *   focal position in slides. 0 at the focal position, -1 one slide before
 *   it, 2.25 two and a quarter slides after it, the way the deck runs, so a
 *   vertical or right-to-left deck reads the same. The focal position is the
 *   snap alignment point of the slide resting at the current snap point (see
 *   `DeckState.focal`), placed between the slides by where their own
 *   alignment points are: with a slide exactly at the focal position, every
 *   slide's progress is a whole number whatever the gap. Where the scroll
 *   range keeps the focal slide from reaching it, as at either end of a
 *   centred deck, progress stays fractional at rest. Measured from the
 *   slides' boxes as they are drawn, so an effect should not move a slide's
 *   alignment point: scale about it (`transform-origin`), not away from it.
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
    const along = axis();
    const { points, slides } = snapPoints(viewport, along);
    const index = nearest(points, along.position);
    const slide = slides.indexOf(index);
    align = slide === -1 ? 'start' : along.snapAlign(viewport.children[slide]);
    paint(along);
    publish({
      index,
      count: points.length,
      slide,
      focal: slide === -1 ? -1 : focalSlide(viewport, along, align)
    });
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
  // The axis a drag moves along, fixed when the button is pressed.
  let dragAxis = axis();
  // Where the pointer last was along it.
  let last = 0;
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
    frame ||= requestAnimationFrame(() => paint());
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
      const along = axis();
      const { points } = snapPoints(viewport, along);
      if (Math.abs(along.position - points[target]) >= 1) return;
    }
    scrollEnded();
  };

  const refresh = () => {
    if (!scrolling && target === null && drag !== 'dragging') settle();
    else paint();
  };

  const scrollTo = (index: number) => {
    // The pointer holds the deck: go there once it lets go.
    if (drag === 'dragging') {
      deferred = index;
      return;
    }
    const along = axis();
    const { points } = snapPoints(viewport, along);
    // Nowhere to scroll to: a target set now would never clear either.
    if (!Number.isFinite(index) || points.length === 0) return;
    const next = clamp(index, points.length);
    // A scroll to where the viewport already rests ends no scroll, so a
    // target set for it would never clear and would block every refresh.
    if (target === null && Math.abs(along.position - points[next]) < 1) {
      return;
    }
    target = next;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    along.scrollTo(points[target], reduce ? 'instant' : 'smooth');
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
      target = null;
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
    const { points } = snapPoints(viewport, dragAxis);
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
    if (!slide) return;
    // The snap point of the clicked slide's page. One slide to a page, that
    // is the slide's own.
    const along = axis();
    const { slides } = snapPoints(viewport, along);
    const owner = pageOwner(
      viewport,
      along,
      slides,
      [...viewport.children].indexOf(slide)
    );
    if (owner !== -1) scrollTo(slides[owner]);
  };
  viewport.addEventListener('click', onClick);

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
    setClickToFocus(enabled) {
      clickToFocus = enabled;
    },
    setOrientation(orientation) {
      vertical = orientation === 'vertical';
      refresh();
    },
    destroy() {
      clearTimeout(quiet);
      cancelAnimationFrame(frame);
      for (const slide of viewport.children) {
        slide.removeAttribute(IN_VIEW);
        if (slide instanceof HTMLElement) slide.style.removeProperty(PROGRESS);
      }
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
      viewport.removeEventListener('click', onClick);
      restoreSnap();
    }
  };
}

const SCROLL_END_DEBOUNCE_MS = 100;

const PROGRESS = '--deck-progress';
const IN_VIEW = 'data-in-view';

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
function snapPoints(
  viewport: HTMLElement,
  axis: Axis
): {
  points: number[];
  slides: number[];
} {
  const max = axis.max();
  const position = axis.position;
  const view = axis.view();
  const positions: (number | null)[] = [];
  for (const slide of viewport.children) {
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
  return {
    points,
    slides: positions.map((p) => (p === null ? -1 : points.indexOf(p)))
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
  slides.forEach((point, i) => {
    if (point === -1) return;
    const align = axis.snapAlign(viewport.children[i]);
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

/** The child of the viewport nearest the alignment point for `align`. */
function focalSlide(viewport: HTMLElement, axis: Axis, align: string): number {
  const view = axis.view();
  let best = -1;
  let distance = Infinity;
  [...viewport.children].forEach((slide, i) => {
    const d = Math.abs(alignOffset(axis, view, slide, align));
    if (d < distance) {
      best = i;
      distance = d;
    }
  });
  return best;
}

/**
 * Writes each slide's progress and in-view state (see `createDeck`). Measures
 * every slide before writing to any, and writes only what changed, so a frame
 * lays out once.
 */
function writeProgress(viewport: HTMLElement, axis: Axis, align: string) {
  const view = axis.view();
  const slides = [...viewport.children];
  const spans = slides.map((slide) => axis.span(slide.getBoundingClientRect()));
  const focus = focalPosition(
    spans.map((span) => spanOffset(span, view, align)),
    spans
  );
  slides.forEach((slide, i) => {
    const [start, end] = spans[i];
    const inView = Math.min(end, view[1]) - Math.max(start, view[0]) >= 1;
    if (slide.hasAttribute(IN_VIEW) !== inView) {
      slide.toggleAttribute(IN_VIEW, inView);
    }
    if (!(slide instanceof HTMLElement)) return;
    const progress = String(Math.round((i - focus) * 1000) / 1000);
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
