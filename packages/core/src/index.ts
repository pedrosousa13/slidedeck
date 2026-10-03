/** What a deck publishes: where it rests, and how many places it can rest. */
export interface DeckState {
  /** The current index: the snap point the viewport is resting at. */
  index: number;
  /** How many snap points the viewport has. One means every slide fits. */
  count: number;
}

export interface DeckOptions {
  /**
   * The child of the viewport to start at. The deck starts at the snap point
   * that slide rests at, which is where `scroll-initial-target` on it puts
   * the viewport; several slides can share one snap point.
   */
  start: number;
  /** Called when the current index or the snap point count changes. */
  onChange: (state: DeckState) => void;
}

export interface DeckEngine {
  next(): void;
  prev(): void;
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
  let state: DeckState = { index: -1, count: 0 };

  const publish = (next: DeckState) => {
    if (next.index === state.index && next.count === state.count) return;
    state = next;
    options.onChange(state);
  };

  const settle = () => {
    const { points } = snapPoints(viewport);
    publish({
      index: nearest(points, viewport.scrollLeft),
      count: points.length
    });
  };

  const step = (delta: number) => {
    const { points } = snapPoints(viewport);
    const target = clamp(state.index + delta, points.length);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({
      left: points[target],
      behavior: reduce ? 'instant' : 'smooth'
    });
  };

  // Where the server HTML already rests if the browser honoured
  // `scroll-initial-target`; scrolling there is then a no-op.
  const { points, slides } = snapPoints(viewport);
  const start = points[Math.max(slides[options.start] ?? 0, 0)] ?? 0;
  if (Math.abs(viewport.scrollLeft - start) >= 1) {
    viewport.scrollTo({ left: start, behavior: 'instant' });
  }
  settle();

  // `scrollsnapchange` reports a settled snap target where it exists, no
  // later than `scrollend`; `publish` drops whichever report comes second.
  viewport.addEventListener('scrollsnapchange', settle);
  viewport.addEventListener('scrollend', settle);
  // A resize can add or remove snap points without any scroll, and only
  // Chromium reports that through `scrollsnapchange`.
  const resizes = new ResizeObserver(settle);
  resizes.observe(viewport);

  return {
    next: () => step(1),
    prev: () => step(-1),
    destroy() {
      resizes.disconnect();
      viewport.removeEventListener('scrollsnapchange', settle);
      viewport.removeEventListener('scrollend', settle);
    }
  };
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
