// THROWAWAY (#3). Mouse drag on a plain, non-looping deck: the handoff from
// pointer to snap without a loop in the way.

import { makeSlide } from '../deck';
import { focalIndex, logicalOf, setupPage } from '../page';

setupPage({
  title: 'Mouse drag',
  note: 'Click and drag with a mouse. Snapping is off while the button is down; "Drag handoff" picks how it comes back on. The loop pages have the same drag.',
  controls: [],
  build(deck) {
    for (let i = 0; i < deck.n; i++) deck.track.append(makeSlide(i, deck));
    return {
      loops: false,
      logical: () => logicalOf(deck),
      focal: () => focalIndex(deck),
      settle() {}
    };
  }
});
