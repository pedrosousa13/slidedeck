import type { Effect } from './index.js';

// Slides of the fade deck, and the distance of each from the focal position,
// in slides, at most 1: from `--deck-progress`, or before the engine has
// written it, as in server HTML, 0 for the focal slide and 1 for the rest.
const slide = '[data-slidedeck-effect=fade]>[data-slidedeck-slide]';
const distance = (fallback: number) => {
  const progress = `var(--deck-progress,${fallback})`;
  // abs() spelled with max() for older browsers.
  return `--slidedeck-fade-distance:min(max(${progress},-1*${progress}),1)`;
};

const css =
  `:where(${slide}){${distance(1)};` +
  'opacity:calc(1 - var(--slidedeck-fade-distance))}' +
  `:where(${slide}[data-focal]){${distance(0)}}` +
  // No animated crossfade: the slide shown cuts to the next halfway there.
  '@media (prefers-reduced-motion:reduce){' +
  `:where(${slide}){opacity:clamp(0,(0.5 - var(--slidedeck-fade-distance))*1000,1)}}`;

/**
 * Crossfades the slides in place while the viewport scrolls, snaps and drags
 * natively (ADR-0006). Pass it to `Deck.Viewport`'s `effect`:
 *
 * ```tsx
 * import { fade } from '@slidedeck/react/fade';
 *
 * <Deck.Viewport effect={fade}>…</Deck.Viewport>
 * ```
 *
 * The slides are stacked with `position: sticky` over an empty snap target
 * per slide, which gives the viewport its scroll length and snap points. Each
 * slide's opacity follows its progress, 1 at the focal position and 0 a slide
 * away; under reduced motion it cuts from one slide to the next halfway
 * instead. Only the focal slide can be seen, so every other slide is inert.
 *
 * Each slide fills the viewport and snaps at its start: a fade shows one slide
 * at a time, so slide size, alignment and group snapping (pages) do not apply.
 * A horizontal deck is as tall as its tallest slide; a vertical one needs a
 * height, as any vertical deck does.
 */
export const fade: Effect = {
  name: 'fade',
  css,
  layout(orientation, count) {
    const vertical = orientation === 'vertical';
    // The track is as long as the scroll range, and each slide's grid area
    // spans all of it: a sticky box is held inside its grid area.
    const track = `repeat(${Math.max(count, 1)}, 100%)`;
    const along = vertical ? 'gridRow' : 'gridColumn';
    const across = vertical ? 'gridColumn' : 'gridRow';
    return {
      viewport: {
        display: 'grid',
        gridTemplateColumns: vertical ? '100%' : track,
        gridTemplateRows: vertical ? track : '100%'
      },
      slide: {
        [across]: '1',
        [along]: '1 / -1',
        [vertical ? 'alignSelf' : 'justifySelf']: 'start',
        [vertical ? 'height' : 'width']: `calc(100% / ${Math.max(count, 1)})`,
        position: 'sticky',
        [vertical ? 'top' : 'insetInlineStart']: 0,
        // A stuck slide would snap wherever it is stuck: the targets snap.
        scrollSnapAlign: 'none'
      },
      target: (index) => ({
        [across]: '1',
        [along]: String(index + 1),
        scrollSnapAlign: 'start'
      })
    };
  }
};
