import type { CSSProperties } from 'react';
import * as Deck from '@slidedeck/react';
import { curve } from '@slidedeck/react/curve';
import { stack } from '@slidedeck/react/stack';
import type { Meta, StoryObj } from '@storybook/react-vite';
// Each recipe's CSS is a file its docs page quotes byte for byte, inlined into
// its story's <style> so it applies to that story alone.
import cardStack from './card-stack.css?inline';
import cardStackFanned from './card-stack-fanned.css?inline';
import centredEnds from './centred-ends.css?inline';
import curveSize from './curve-size.css?inline';
import middleByProgress from './middle-by-progress.css?inline';
import middleCentred from './middle-centred.css?inline';
import responsiveDeck from './responsive-deck.css?inline';
import { Products } from './custom-controls';
import { ResponsiveDeck } from './responsive-deck';

const slidesOf = (count: number) =>
  Array.from({ length: count }, (_, i) => (
    <Deck.Slide key={i}>
      <p>Slide {i + 1}</p>
      <button type="button">Action {i + 1}</button>
    </Deck.Slide>
  ));

// The look, apart from each recipe's CSS.
const look = `
  [data-slidedeck-slide] { background: #eef; }
  [data-slidedeck-slide]:nth-child(even) { background: #fee; }
`;

/** A deck of six slides with the recipe's CSS, classed `products`. */
const productsWith = (css: string) => () => (
  <>
    <style>{look + css}</style>
    <Deck.Root aria-label="Featured slides" className="products">
      <Deck.Viewport>{slidesOf(6)}</Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
      <Deck.Dots />
    </Deck.Root>
  </>
);

const meta = { title: 'Recipes' } satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The README's recipe "centre the first and last slide": with
 * `scroll-snap-align: center`, the viewport's inline padding, half the
 * viewport less half a slide, lets the first and last slides reach the
 * centre without `loop`.
 */
export const CentredEnds: Story = { render: productsWith(centredEnds) };

/**
 * The README's recipe "highlight the middle slide in view", centred: the
 * focal slide is the one at the snap alignment point, here the centre, so
 * `[data-focal]` styles the middle of the three slides in view.
 */
export const MiddleCentred: Story = { render: productsWith(middleCentred) };

/**
 * The same recipe with the slides at the start: the focal slide is the
 * first in view, so the middle one is styled by its progress, 1.
 */
export const MiddleByProgress: Story = {
  render: productsWith(middleByProgress)
};

/**
 * The README's recipe "size a curve": a radius of 528px under 160px slides,
 * 16px apart, is 3 slides, and the viewport's block padding leaves the arc
 * room, so no slide that is not faded out is clipped, at rest or mid-move.
 */
export const CurveSize: Story = {
  render: () => (
    <>
      <style>{`
        .showcase .card {
          display: grid;
          place-content: center;
          border-radius: 12px;
          background: #eef;
        }
        .showcase [data-slidedeck-slide]:nth-child(even) .card {
          background: #fee;
        }
        ${curveSize}
      `}</style>
      <Deck.Root aria-label="Featured slides" className="showcase">
        <Deck.Viewport effect={curve}>
          {Array.from({ length: 6 }, (_, i) => (
            <Deck.Slide key={i}>
              <div className="card">
                <p>Slide {i + 1}</p>
                <button type="button">Action {i + 1}</button>
              </div>
            </Deck.Slide>
          ))}
        </Deck.Viewport>
        <Deck.Prev />
        <Deck.Next />
        <Deck.Dots />
      </Deck.Root>
    </>
  )
};

const cards = [
  { title: 'Draft', text: 'Write it down before it slips away.' },
  { title: 'Review', text: 'Read it again tomorrow, with fresh eyes.' },
  { title: 'Ship', text: 'Send it out, then start the next one.' }
];

/**
 * The recipe "a card stack": `effect={stack}` orders the cards, and the
 * recipe's CSS draws them on `--deck-slide-progress`. The cards behind the
 * top one are smaller and dimmer by depth, and peek out above it. Next, in
 * the card, throws the top card out toward the inline start, clear of the
 * stack, then back in behind it, at the back. Under reduced motion it cuts
 * to the next card instead.
 */
export const CardStack: Story = {
  render: () => (
    <>
      <style>{`
        .cards { font-family: system-ui, sans-serif; color: #222; }
        .cards .card { display: grid; gap: 8px; }
        .cards .card h3 { margin: 0; font-size: 1.05rem; }
        .cards .card p { margin: 0; line-height: 1.5; }
        .cards .card button { justify-self: start; }
        ${cardStack}
      `}</style>
      <Deck.Root aria-label="Featured slides" className="cards" loop>
        <Deck.Viewport effect={stack}>
          {cards.map((card) => (
            <Deck.Slide key={card.title}>
              <div className="card">
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <Deck.Next>Next</Deck.Next>
              </div>
            </Deck.Slide>
          ))}
        </Deck.Viewport>
      </Deck.Root>
    </>
  )
};

const tips = [
  {
    title: 'Local tip',
    body: 'Say sumimasen, which means excuse me, before asking for help at a Tokyo station, café or shop.',
    tint: '#e7b9c9'
  },
  {
    title: 'Getting around',
    body: 'Load a Suica card once and tap through trains, buses and kiosks.',
    tint: '#cdc5ef'
  },
  {
    title: 'Etiquette',
    body: 'Stand on the left on Tokyo escalators, on the right in Osaka.',
    tint: '#bfe0d4'
  }
];

/**
 * The same effect and recipe with another look: the recipe's fanned pile.
 * Behind the top card, each card turns and shows its tint by its depth. Only
 * the CSS changes.
 */
export const CardStackFanned: Story = {
  render: () => (
    <>
      <style>{`
        ${cardStack}
        ${cardStackFanned}
        .tips { font-family: system-ui, sans-serif; color: #222; }
        .tips .card {
          padding: 28px 22px;
          border: 1.5px solid #555;
          border-radius: 20px;
          outline: 2px dotted #555;
          outline-offset: -12px;
          box-shadow: none;
          filter: none;
          background: color-mix(
            in oklab,
            var(--tint),
            #f4f4f7 calc(clamp(0, 1 - var(--depth), 1) * 100%)
          );
          display: grid;
          gap: 12px;
          text-align: center;
        }
        .tips .card h3 { margin: 0; font-size: 1.05rem; }
        .tips .card p { margin: 0; line-height: 1.55; }
        .tips .card button {
          justify-self: center;
          border: 0;
          padding: 0;
          background: none;
          font: inherit;
          font-weight: 600;
          text-decoration: underline;
          cursor: pointer;
        }
      `}</style>
      <Deck.Root aria-label="Featured slides" className="cards tips" loop>
        <Deck.Viewport effect={stack}>
          {tips.map((tip) => (
            <Deck.Slide key={tip.title}>
              <div
                className="card"
                style={{ '--tint': tip.tint } as CSSProperties}
              >
                <h3>{tip.title}</h3>
                <p>{tip.body}</p>
                <Deck.Next>Next</Deck.Next>
              </div>
            </Deck.Slide>
          ))}
        </Deck.Viewport>
      </Deck.Root>
    </>
  )
};

/**
 * The README's recipe "custom controls and a counter": Previous, Next, a
 * button per page and a counter, from a design system's button, built on
 * `Deck.useDeck()`.
 */
export const CustomControls: Story = {
  render: () => (
    <>
      <style>{`
        ${look}
        .controls { display: flex; gap: 8px; align-items: center; }
        .controls [role=group] { display: flex; gap: 4px; }
        .ds-button { padding: 4px 12px; border: 1px solid #335; border-radius: 4px; background: #fff; color: #335; }
        .ds-button[aria-current] { background: #335; color: #fff; }
      `}</style>
      <Products />
    </>
  )
};

/**
 * The README's recipe "change `effect`, `loop` or `autoplay` per
 * breakpoint": a `useMediaQuery` hook picks the props. Below 768px the deck
 * crossfades one slide at a time; from 768px it shows three slides and
 * loops. Resizing the window across 768px keeps the deck on its slide.
 */
export const PerBreakpoint: Story = {
  render: () => (
    <>
      <style>{look + responsiveDeck}</style>
      <ResponsiveDeck>{slidesOf(6)}</ResponsiveDeck>
    </>
  )
};
