import type { Effect } from './index.js';
import { stackedLayout } from './stacked.js';

// Slides of the stack deck, the progress of each, from
// `--deck-slide-progress`, which Deck.Slide gives each slide from the first
// render, server HTML included, or where it is unset, 0 for the focal slide
// and 1 for the rest.
const slide = '[data-slidedeck-effect=stack]>[data-slidedeck-slide]';
const progress = (fallback: number) =>
  `--slidedeck-stack-progress:var(--deck-slide-progress,${fallback})`;
const p = 'var(--slidedeck-stack-progress)';

// The top card, at progress 0, is highest, and the cards behind it, at 1, 2,
// …, are lower in that order. A card leaving, from 0 to -1, stays on top until
// halfway, then drops behind every card, so it can come back in at the back.
// With loop, its copy arrives at the back as it goes: the copy's progress runs
// from the slide count to one less.
const css =
  `:where(${slide}){${progress(1)};` +
  `z-index:calc(1000 - max(${p},0)*10 - clamp(0,(-1*${p} - 0.5)*1000,1)*2000)}` +
  `:where(${slide}[data-focal]){${progress(0)}}`;

/**
 * Stacks the slides in one place, as cards, while the viewport scrolls, snaps
 * and drags natively (ADR-0006). Pass it to `Deck.Viewport`'s `effect`:
 *
 * ```tsx
 * import { stack } from '@slidedeck/react/stack';
 *
 * <Deck.Viewport effect={stack}>…</Deck.Viewport>
 * ```
 *
 * The slides are stacked as fade stacks them, and ordered by progress: the
 * focal slide on top, the slides after it behind it in order, and a slide
 * leaving drops behind every slide halfway, to come back in at the back.
 * Only the focal slide can be reached, so every other slide is inert.
 *
 * It ships no appearance: no transform, colour or opacity. The look and the
 * throw are your CSS on `--deck-slide-progress`, as the card stack recipe
 * shows (ADR-0012).
 */
export const stack: Effect = { name: 'stack', css, layout: stackedLayout };
