import type { Effect } from './index.js';

// Slides of the curve deck, the progress of each, from `--deck-progress`, or
// before the engine has written it, as in server HTML, 0: flat. The curve is
// drawn on a slide's content, its children: the slide box stays in place.
const slide = '[data-slidedeck-effect=curve]>[data-slidedeck-slide]';
const content = `${slide}>*`;
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

// The circle's radius, in slides, where `--deck-curve-radius` is not set.
const RADIUS = 4;
// A radius of 0 would divide by zero, and a negative one flip the arc, so the
// radius is at least a thousandth of a slide, the precision the engine writes
// progress at: there, every slide but the focal one has turned a quarter.
const MIN_RADIUS = 0.001;

const css =
  `:where(${slide}){` +
  '--slidedeck-curve-progress:var(--deck-progress,0);' +
  `--slidedeck-curve-radius:max(var(--deck-curve-radius,${RADIUS}),${MIN_RADIUS});` +
  `--slidedeck-curve-x:clamp(-1,${p}/${r},1);` +
  `--slidedeck-curve-turn:asin(${x});` +
  `--slidedeck-curve-drop:calc(${r}*(1 - sqrt(1 - ${x}*${x})));` +
  '--slidedeck-curve-sign:1;' +
  // abs() spelled with max() for older browsers.
  `opacity:calc(1 - max(${x},-1*${x}))}` +
  `:where(${slide}:dir(rtl)){--slidedeck-curve-sign:-1}` +
  // Rotation is about the content's centre, and the drop is across the axis.
  // A drop in slides is a percentage of the content's width, a slide's where
  // the content fills it; turned a quarter, a translateX moves it down by
  // that.
  `:where(${content}){transform:rotate(90deg) translateX(calc(${drop}*100%)) rotate(-90deg) rotate(calc(${sign}*${turn}))}` +
  // Vertical, the arc bends toward the inline end, by the content's height.
  `:where([data-orientation=vertical]${content}){` +
  `transform:rotate(-90deg) translateY(calc(${sign}*${drop}*100%)) rotate(90deg) rotate(calc(-1*${sign}*${turn}))}` +
  // No motion but the scroll's own: the slides stay flat and only fade.
  `@media (prefers-reduced-motion:reduce){:where(${content}){transform:none}}`;

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
 * The slides keep their place in the deck, their size, gap and alignment, and
 * snap as they would without the curve, in pages too. Each slide's content,
 * its children, turns about its centre and drops across the axis to sit on a
 * circle under the focal slide, and the slide fades with its distance from
 * it, following its progress. Give each slide one child that fills it, styled
 * as the slide is seen: a slide's own background stays in place, and several
 * children each turn about their own centre. The circle's radius, in slides,
 * is `--deck-curve-radius`, 4 by default and never 0 or less: set it in CSS
 * on the viewport, per breakpoint if needed. A slide a radius away or more has
 * turned a quarter and faded out.
 *
 * Each slide contains its layout, so its turned content is drawn on the arc
 * but adds nothing the viewport can scroll to, and focus never scrolls the
 * viewport after it. The viewport clips across the axis, so the arc never
 * shows a scrollbar: give it padding there to show more of the arc. A
 * vertical deck's arc bends toward the inline end, and a right-to-left deck's
 * mirrors. Under reduced motion the content stays flat
 * and the slides only fade.
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
    // The content's overflow, turned and dropped, is then ink overflow: drawn,
    // but never part of what the viewport can scroll, along the axis or
    // across it.
    slide: { contain: 'layout' }
  })
};
