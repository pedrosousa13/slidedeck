// THROWAWAY (#3). Geometry shared by every technique page.

export const SLIDES = 12;

/**
 * Scroll position along the deck's axis, in "logical" pixels: 0 at the
 * start edge and growing toward the end, whatever the writing direction.
 * Browsers report RTL `scrollLeft` as 0 at the start and negative beyond it.
 */
export class Axis {
  constructor(
    readonly vp: HTMLElement,
    readonly vertical: boolean,
    readonly rtl: boolean
  ) {}

  get pos(): number {
    const { vp } = this;
    if (this.vertical) return vp.scrollTop;
    return this.rtl ? -vp.scrollLeft : vp.scrollLeft;
  }

  set pos(value: number) {
    const { vp } = this;
    if (this.vertical) vp.scrollTop = value;
    else vp.scrollLeft = this.rtl ? -value : value;
  }

  get max(): number {
    const { vp } = this;
    return this.vertical
      ? vp.scrollHeight - vp.clientHeight
      : vp.scrollWidth - vp.clientWidth;
  }

  get viewSize(): number {
    return this.vertical ? this.vp.clientHeight : this.vp.clientWidth;
  }

  /** Distance from the viewport's start edge to `el`'s start edge. */
  offset(el: Element): number {
    const box = el.getBoundingClientRect();
    const view = this.vp.getBoundingClientRect();
    if (this.vertical) return box.top - view.top;
    return this.rtl ? view.right - box.right : box.left - view.left;
  }

  size(el: Element): number {
    const box = el.getBoundingClientRect();
    return this.vertical ? box.height : box.width;
  }

  smoothTo(value: number): void {
    this.vp.scrollTo(
      this.vertical
        ? { top: value, behavior: 'smooth' }
        : { left: this.rtl ? -value : value, behavior: 'smooth' }
    );
  }

  smoothBy(delta: number): void {
    this.vp.scrollBy(
      this.vertical
        ? { top: delta, behavior: 'smooth' }
        : { left: this.rtl ? -delta : delta, behavior: 'smooth' }
    );
  }

  /** Logical scroll delta for a pointer that moved by (dx, dy). */
  dragDelta(dx: number, dy: number): number {
    if (this.vertical) return -dy;
    return this.rtl ? dx : -dx;
  }
}

export interface DeckOptions {
  group: boolean;
  vertical: boolean;
  rtl: boolean;
}

export interface Deck {
  vp: HTMLElement;
  track: HTMLElement;
  axis: Axis;
  n: number;
  pageSize: number;
}

export function createDeck(host: HTMLElement, opts: DeckOptions): Deck {
  const vp = document.createElement('div');
  vp.className = 'viewport';
  vp.id = 'viewport';
  vp.classList.toggle('group', opts.group);
  vp.classList.toggle('vertical', opts.vertical);
  vp.dir = opts.rtl ? 'rtl' : 'ltr';
  vp.tabIndex = 0;
  vp.setAttribute('role', 'region');
  vp.setAttribute('aria-roledescription', 'carousel');
  vp.setAttribute('aria-label', 'Prototype deck');
  const track = document.createElement('div');
  track.className = 'track';
  vp.append(track);
  host.append(vp);
  return {
    vp,
    track,
    axis: new Axis(vp, opts.vertical, opts.rtl),
    n: SLIDES,
    pageSize: opts.group ? 3 : 1
  };
}

export function makeSlide(index: number, deck: Deck): HTMLElement {
  const el = document.createElement('div');
  el.className = 'slide';
  el.classList.toggle('page-start', index % deck.pageSize === 0);
  el.dataset.index = String(index);
  el.tabIndex = 0;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-roledescription', 'slide');
  el.setAttribute('aria-label', `Slide ${index + 1} of ${deck.n}`);
  el.style.setProperty('--hue', String((index * 360) / deck.n));
  el.innerHTML = `<div class="card"><span class="num">${index + 1}</span><button type="button">Button ${index + 1}</button></div>`;
  return el;
}

/** Clones are copies for the loop seam: hidden from AT and unfocusable. */
export function makeClone(slide: HTMLElement): HTMLElement {
  const clone = slide.cloneNode(true) as HTMLElement;
  clone.dataset.clone = '';
  clone.setAttribute('aria-hidden', 'true');
  clone.inert = true;
  return clone;
}

/** Every slide element in the track, clones included. */
export const slideEls = (deck: Deck): HTMLElement[] =>
  Array.from(deck.track.querySelectorAll<HTMLElement>('.slide'));

/**
 * The visual position in slide units, wrapped to [0, n): the real index of
 * the slide under the start edge plus how far past its start the edge is.
 * A clone reports the index it copies, so a clone jump that lands on
 * identical content leaves this unchanged; a visible jump changes it.
 */
export function logicalPosition(deck: Deck, els = slideEls(deck)): number {
  for (const el of els) {
    const start = deck.axis.offset(el);
    const size = deck.axis.size(el);
    if (start <= 0.5 && start + size > 0.5) {
      const value = Number(el.dataset.index) - start / size;
      return ((value % deck.n) + deck.n) % deck.n;
    }
  }
  return Number.NaN;
}

/** The slide whose start edge is nearest the viewport's start edge. */
export function nearestSlide(deck: Deck, els = slideEls(deck)): HTMLElement {
  let best = els[0];
  let distance = Infinity;
  for (const el of els) {
    const d = Math.abs(deck.axis.offset(el));
    if (d < distance) {
      distance = d;
      best = el;
    }
  }
  return best;
}

/** Snap positions in logical px, from whatever carries `scroll-snap-align`. */
export function snapPoints(deck: Deck): number[] {
  const { axis } = deck;
  const pos = axis.pos;
  const max = axis.max;
  const points = new Set<number>();
  for (const el of deck.track.children) {
    if (getComputedStyle(el).scrollSnapAlign === 'none') continue;
    const p = Math.round(pos + axis.offset(el));
    points.add(Math.min(Math.max(p, 0), Math.round(max)));
  }
  return [...points].sort((a, b) => a - b);
}
