// THROWAWAY (#3). Loop by repositioning slides inside the scroller.
//
// No copies. The focal slide is kept in the middle slot: at rest, slides
// move from the far end to the near end and the scroll position is
// corrected by exactly how far the focal slide moved, so nothing visible
// changes. Rotation is in whole pages so snap points stay on page starts.
//
// `dom` moves the nodes (with `moveBefore` where it exists, which keeps
// focus state; `insertBefore` otherwise). `order` leaves the DOM alone and
// sets the CSS `order` property, so the visual order and the DOM, tab and
// reading order disagree.

import { makeSlide, nearestSlide, type Deck } from '../deck';
import { focalIndex, logicalOf, setupPage } from '../page';

setupPage({
  title: 'Loop: reposition',
  note: 'Scroll past slide 12 to reach slide 1. Slides are moved, not copied: a screen reader and the tab order see exactly 12 slides.',
  controls: [
    { key: 'mode', label: 'Move by', values: ['dom', 'order'] },
    { key: 'fix', label: 'When to rotate', values: ['settle', 'live'] }
  ],
  build(deck, value, m) {
    const { axis, track, n, pageSize } = deck;
    const real = Array.from({ length: n }, (_, i) => makeSlide(i, deck));
    const center = Math.floor(n / pageSize / 2) * pageSize;
    // DOM (or `order`) sequence; starts with slide 1 in the middle slot.
    const order = real.map((_, slot) => real[(slot - center + n) % n]);
    const byOrder = value('mode') === 'order';
    track.append(...(byOrder ? real : order));
    const place = () => order.forEach((el, i) => (el.style.order = String(i)));
    if (byOrder) place();
    const canMoveBefore = typeof track.moveBefore === 'function';
    const move = (el: HTMLElement, ref: Element | null) => {
      if (canMoveBefore) track.moveBefore(el, ref);
      else track.insertBefore(el, ref);
    };

    /** Rotate so the focal slot is the middle; `slack` slots of tolerance. */
    const rotate = (slack: number) => {
      const focal = nearestSlide(deck, order);
      const slot = order.indexOf(focal);
      let shift = slot - center;
      if (Math.abs(shift) <= slack) return;
      shift = Math.trunc(shift / pageSize) * pageSize;
      if (shift === 0) return;
      const hadFocus = track.contains(document.activeElement);
      const before = axis.offset(focal);
      if (shift > 0) {
        const moved = order.splice(0, shift);
        order.push(...moved);
        if (!byOrder) for (const el of moved) move(el, null);
      } else {
        const moved = order.splice(n + shift);
        order.unshift(...moved);
        if (!byOrder) {
          const ref = track.firstElementChild;
          for (const el of moved) move(el, ref);
        }
      }
      if (byOrder) place();
      axis.pos = axis.pos + axis.offset(focal) - before;
      m.corrections++;
      if (hadFocus && document.activeElement === document.body) m.focusLost++;
    };

    axis.pos = axis.pos + axis.offset(real[0]);
    // Mid-motion, rotate only when the focal slot nears either end (within
    // 3 slides, or 1 page when grouped) rather than on every scroll event.
    const edgeSlack = pageSize === 1 ? 3 : 0;
    return {
      loops: true,
      logical: () => logicalOf(deck),
      focal: () => focalIndex(deck),
      settle: () => rotate(0),
      dragMove: () => rotate(edgeSlack),
      scroll: value('fix') === 'live' ? () => rotate(edgeSlack) : undefined,
      status: () => describe(deck, canMoveBefore, byOrder)
    };
  }
});

function describe(deck: Deck, canMoveBefore: boolean, byOrder: boolean) {
  const how = byOrder
    ? 'CSS order'
    : canMoveBefore
      ? 'moveBefore'
      : 'insertBefore';
  return `${deck.n} slides, no copies · rotate with ${how}`;
}
