import type { Effect } from './index.js';

// Slides of the curve deck, the progress of each, from `--deck-progress`, or
// before the engine has written it, as in server HTML, 0: flat.
const slide = '[data-slidedeck-effect=curve]>[data-slidedeck-slide]';
const p = 'var(--slidedeck-curve-progress)';
const r = 'var(--slidedeck-curve-radius)';
// Where the slide is on the circle, as the sine of its turn: -1 and 1 are a
// quarter turn either way, where a slide as far as the radius or further
// stands.
const x = 'var(--slidedeck-curve-x)';
const turn = 'var(--slidedeck-curve-turn)';
// How far the slide drops from the focal slide's line, in slides.
const drop = 'var(--slidedeck-curve-drop)';
const sign = 'var(--slidedeck-curve-sign)';

const css =
  `:where(${slide}){` +
  '--slidedeck-curve-progress:var(--deck-progress,0);' +
  '--slidedeck-curve-radius:var(--deck-curve-radius,4);' +
  `--slidedeck-curve-x:clamp(-1,${p}/${r},1);` +
  `--slidedeck-curve-turn:asin(${x});` +
  `--slidedeck-curve-drop:calc(${r}*(1 - sqrt(1 - ${x}*${x})));` +
  '--slidedeck-curve-sign:1;' +
  // abs() spelled with max() for older browsers.
  `opacity:calc(1 - max(${x},-1*${x}));` +
  // Rotation is about the slide's centre, and the drop is across the axis,
  // so the centre never moves along it: the deck is measured and snaps
  // exactly as without the curve. A drop in slides is a percentage of the
  // slide's width; turned a quarter, a translateX moves it down by that.
  `transform:rotate(90deg) translateX(calc(${drop}*100%)) rotate(-90deg) rotate(calc(${sign}*${turn}))}` +
  `:where(${slide}:dir(rtl)){--slidedeck-curve-sign:-1}` +
  // Vertical, the arc bends toward the inline end, by the slide's height.
  `:where([data-orientation=vertical]${slide}){` +
  `transform:rotate(-90deg) translateY(calc(${sign}*${drop}*100%)) rotate(90deg) rotate(calc(-1*${sign}*${turn}))}` +
  // No motion but the scroll's own: the slides stay flat and only fade.
  `@media (prefers-reduced-motion:reduce){:where(${slide}){transform:none}}`;

/**
 * Fans the slides along an arc around the focal slide while the viewport
 * scrolls, snaps and drags natively (ADR-0006). Pass it to `Deck.Viewport`'s
 * `effect`:
 *
 * ```tsx
 * import { curve } from '@slidedeck/react/curve';
 *
 * <Deck.Viewport effect={curve}>…</Deck.Viewport>
 * ```
 *
 * The slides keep their place in the deck, their size and gap. Each turns
 * about its centre and drops across the axis to sit on a circle under the
 * focal slide, and fades with its distance from it, following its progress.
 * The circle's radius, in slides, is `--deck-curve-radius`, 4 by default:
 * set it in CSS on the viewport, per breakpoint if needed. A slide a radius
 * away or more has turned a quarter and faded out.
 *
 * Every slide snaps at its centre, so group snapping (pages) does not apply.
 * Nothing moves a slide's centre along the axis, so progress stays whole at
 * rest and the deck snaps where it would without the curve. The viewport
 * clips across the axis, so the arc never shows a scrollbar: give it padding
 * there to show more of the arc. A vertical deck's arc bends toward the
 * inline end, and a right-to-left deck's mirrors. Under reduced motion the
 * slides stay flat and only fade.
 */
export const curve: Effect = {
  name: 'curve',
  css,
  layout: (orientation) => ({
    // Across the axis, the arc is clipped rather than scrolled.
    viewport:
      orientation === 'vertical'
        ? { overflowX: 'hidden' }
        : { overflowY: 'hidden' },
    slide: { scrollSnapAlign: 'center' }
  })
};
