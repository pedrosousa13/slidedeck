import type { Effect } from './index.js';

// Slides of the fade deck, the progress of each, from
// `--deck-slide-progress`, which Deck.Slide gives each slide from the first
// render, server HTML included, or where it is unset, 0 for the focal slide
// and 1 for the rest, and its distance from the focal position, at most 1.
const slide = '[data-slidedeck-effect=fade]>[data-slidedeck-slide]';
const progress = (fallback: number) =>
  `--slidedeck-fade-progress:var(--deck-slide-progress,${fallback})`;
const p = 'var(--slidedeck-fade-progress)';
// abs() spelled with max() for older browsers.
const distance = `--slidedeck-fade-distance:min(max(${p},-1*${p}),1)`;

// Under reduced motion, opacity is a step: this steep a ramp goes from 0 to 1
// within a thousandth of a slide, the precision the engine writes progress
// at. A slide is shown while its progress is above -0.5 and at most 0.5, so
// exactly halfway between two slides, only the one ahead is shown.
const STEP = 1000;

const css =
  `:where(${slide}){${progress(1)};${distance};` +
  'opacity:calc(1 - var(--slidedeck-fade-distance))}' +
  `:where(${slide}[data-focal]){${progress(0)}}` +
  // No animated crossfade: the slide shown cuts to the next halfway there.
  '@media (prefers-reduced-motion:reduce){' +
  `:where(${slide}){opacity:clamp(0,min(0.5 + ${p},${0.5 + 1 / STEP} - ${p})*${STEP},1)}}`;

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
