// THROWAWAY (#3). Loop by clone and jump.
//
// Copies of the slides sit before and after the real set. When the
// scroller rests inside the copies, jump the scroll position by one set
// length onto the identical real slides. Copies are aria-hidden and inert.

import { makeClone, makeSlide, slideEls, type Deck } from '../deck';
import { focalIndex, logicalOf, setupPage } from '../page';

setupPage({
  title: 'Loop: clone and jump',
  note: 'Scroll past slide 12 to reach slide 1. "When" picks jumping at rest (scrollend) or as soon as the scroller enters the copies, even mid-momentum.',
  controls: [
    { key: 'clones', label: 'Copies each side', values: ['set', 'page'] },
    { key: 'fix', label: 'When to jump', values: ['settle', 'live'] },
    { key: 'mark', label: 'Mark copies', values: ['0', '1'] }
  ],
  build(deck, value, m) {
    const real = Array.from({ length: deck.n }, (_, i) => makeSlide(i, deck));
    const count = value('clones') === 'set' ? deck.n : deck.pageSize;
    const before = real.slice(deck.n - count).map(makeClone);
    const after = real.slice(0, count).map(makeClone);
    deck.track.append(...before, ...real, ...after);
    deck.vp.classList.toggle('mark-clones', value('mark') === '1');
    const els = slideEls(deck);
    const { axis } = deck;

    const realStart = () => axis.pos + axis.offset(real[0]);
    const setLength = () => axis.offset(after[0]) - axis.offset(real[0]);

    const normalize = () => {
      const pos = axis.pos;
      const start = realStart();
      const length = setLength();
      if (pos < start - 1) axis.pos = pos + length;
      else if (pos >= start + length - 1) axis.pos = pos - length;
      else return;
      m.corrections++;
    };

    axis.pos = realStart();
    const live = value('fix') === 'live';
    return {
      loops: true,
      logical: () => logicalOf(deck),
      focal: () => focalIndex(deck),
      settle: normalize,
      // A drag owns the position, so jumping mid-drag cannot cut momentum.
      dragMove: normalize,
      scroll: live ? normalize : undefined,
      status: () => describe(deck, els.length)
    };
  }
});

function describe(deck: Deck, total: number) {
  return `${deck.n} slides + ${total - deck.n} copies`;
}
