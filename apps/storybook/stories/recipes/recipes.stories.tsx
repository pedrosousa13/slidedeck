import * as Deck from '@slidedeck/react';
import { curve } from '@slidedeck/react/curve';
import type { Meta, StoryObj } from '@storybook/react-vite';
// Each recipe's CSS is a file the README quotes byte for byte, inlined into
// its story's <style> so it applies to that story alone.
import centredEnds from './centred-ends.css?inline';
import curveSize from './curve-size.css?inline';
import middleByProgress from './middle-by-progress.css?inline';
import middleCentred from './middle-centred.css?inline';
import { Products } from './custom-controls';

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
