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
  /** Scrolls to a snap point, clamped to the snap points there are. */
  scrollTo(index: number): void;
  next(): void;
  prev(): void;
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

  const refresh = () => {
    if (!scrolling && target === null) settle();
  };

  const scrollTo = (index: number) => {
    const { points } = snapPoints(viewport);
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
  viewport.addEventListener('scrollsnapchange', scrollEnded);
  viewport.addEventListener('scrollend', scrollEnded);
  // A resize can add or remove snap points without any scroll, and only
  // Chromium reports that through `scrollsnapchange`.
  const resizes = new ResizeObserver(refresh);
  resizes.observe(viewport);

  // From the snap point a scroll in flight is heading to, if any.
  const step = (delta: number) => scrollTo((target ?? state.index) + delta);

  return {
    scrollTo,
    next: () => step(1),
    prev: () => step(-1),
    refresh,
    destroy() {
      clearTimeout(quiet);
      resizes.disconnect();
      viewport.removeEventListener('scroll', onScroll);
      viewport.removeEventListener('scrollsnapchange', scrollEnded);
      viewport.removeEventListener('scrollend', scrollEnded);
    }
  };
}

const SCROLL_END_DEBOUNCE_MS = 100;

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
