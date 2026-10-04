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
  /** Loop: past the last snap point is the first, and back. The viewport's
   * children are then three equal sets: copies of the slides, the slides,
   * and copies again. The copies are the caller's to make, inert and
   * aria-hidden; the engine only ever reports the slides' snap points. */
  loop?: boolean;
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
  const loop = options.loop ?? false;
  // The one place the scroll axis is read and written.
  const position = () => viewport.scrollLeft;
  const moveTo = (to: number, behavior: ScrollBehavior) =>
    viewport.scrollTo({ left: to, behavior });
  const measure = () => snapPoints(viewport, loop);

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
    const geometry = measure();
    if (loop) jumpOffCopies(geometry);
    const { points, slides } = geometry;
    const index = indexAt(geometry, position());
    publish({ index, count: points.length, slide: slides.indexOf(index) });
  };

  // Resting on a copy, jump one set length onto the identical slide. Only at
  // rest and on a snap point: a jump mid-motion stops momentum, and one off a
  // snap point is snapped by the browser, a visible jump (ADR-0006).
  const jumpOffCopies = ({ points, all, length }: Geometry) => {
    if (points.length === 0 || length <= 0) return;
    const at = position();
    const start = points[0];
    const shift =
      at < start - 1 ? length : at >= start + length - 1 ? -length : 0;
    if (shift !== 0 && all.some((point) => Math.abs(point - at) <= 1)) {
      moveTo(at + shift, 'instant');
    }
  };

  // The snap point a step is scrolling to, until the scroll ends: a second
  // press steps on from there, not from where the viewport last rested. With
  // loop it can run a set past either end, onto the copies there.
  let target: number | null = null;

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
      if (Math.abs(position() - positionOf(measure(), target)) >= 1) return;
    }
    scrollEnded();
  };

  const refresh = () => {
    if (!scrolling && target === null) settle();
  };

  // `across` lets a step cross the loop seam onto the copies; anything else
  // stays on the slides.
  const go = (index: number, across = false) => {
    const geometry = measure();
    const count = geometry.points.length;
    // Nowhere to scroll to: a target set now would never clear either.
    if (!Number.isFinite(index) || count === 0) return;
    const next =
      loop && across
        ? Math.min(Math.max(index, -count), 2 * count - 1)
        : clamp(index, count);
    const to = positionOf(geometry, next);
    // A scroll to where the viewport already rests ends no scroll, so a
    // target set for it would never clear and would block every refresh.
    if (target === null && Math.abs(position() - to) < 1) return;
    target = next;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    moveTo(to, reduce ? 'instant' : 'smooth');
  };

  // With one slide per snap point, server HTML already rests here where the
  // browser honours `scroll-initial-target`, and this scroll is a no-op.
  // Where slides share snap points, slide `index` may rest at another snap
  // point, so the first paint may correct: server HTML cannot measure.
  const { points } = measure();
  const start = points[clamp(options.index, points.length)] ?? 0;
  if (Math.abs(position() - start) >= 1) moveTo(start, 'instant');
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

  // From the snap point a scroll in flight is heading to, if any.
  const step = (delta: number) => go((target ?? state.index) + delta, true);

  return {
    scrollTo: (index) => go(index),
    next: () => step(1),
    prev: () => step(-1),
    // A target on the copies is reported as the slide's snap point.
    target: () => (target === null ? null : wrap(target, state.count)),
    refresh,
    destroy() {
      clearTimeout(quiet);
      resizes.disconnect();
      window.removeEventListener('resize', refresh);
      viewport.removeEventListener('scroll', onScroll);
      viewport.removeEventListener('scrollsnapchange', onSnapChange);
      viewport.removeEventListener('scrollend', scrollEnded);
    }
  };
}

const SCROLL_END_DEBOUNCE_MS = 100;

const clamp = (index: number, count: number) =>
  Math.min(Math.max(index, 0), count - 1);

const wrap = (index: number, count: number) =>
  ((index % count) + count) % count;

/** Where snap point `index` rests; with loop, an index a set past either end
 * rests on the copies there. */
function positionOf({ points, length }: Geometry, index: number): number {
  const set = Math.floor(index / points.length);
  return points[index - set * points.length] + set * length;
}

/** The snap point nearest `position`; with loop, nearest in the slides once
 * a position on the copies is wrapped onto them. */
function indexAt({ points, length }: Geometry, position: number): number {
  if (length <= 0 || points.length === 0) return nearest(points, position);
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

interface Geometry {
  /** The slides' snap points, ascending: copies' are not counted. */
  points: number[];
  /** For each slide, the index of the point it rests at (-1 if it does not
   * snap). */
  slides: number[];
  /** Every snap point, the copies' included. */
  all: number[];
  /** With loop, how far one set of slides runs; 0 without. */
  length: number;
}

/**
 * The scroll positions the viewport can rest at, ascending, as the browser
 * derives them from each slide's `scroll-snap-align`, and for each slide the
 * index of the point it rests at. Slides that clamp to the same scroll
 * position share one snap point. With loop, the slides are the middle third
 * of the viewport's children, between two sets of copies.
 */
function snapPoints(viewport: HTMLElement, loop: boolean): Geometry {
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
  const children = viewport.children;
  const count = loop ? Math.floor(children.length / 3) : children.length;
  const first = loop ? count : 0;
  const slides = positions.slice(first, first + count);
  const points = ascending(slides);
  const length =
    loop && count > 0
      ? Math.round(
          children[2 * count].getBoundingClientRect().left -
            children[count].getBoundingClientRect().left
        )
      : 0;
  return {
    points,
    slides: slides.map((p) => (p === null ? -1 : points.indexOf(p))),
    all: loop ? ascending(positions) : points,
    length
  };
}

const ascending = (positions: (number | null)[]) =>
  [...new Set(positions.filter((p): p is number => p !== null))].sort(
    (a, b) => a - b
  );
