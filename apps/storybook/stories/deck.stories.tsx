import { useState } from 'react';
import * as Deck from '@slidedeck/react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const slides = Array.from({ length: 6 }, (_, i) => (
  <Deck.Slide key={i} className="slide">
    <p>Slide {i + 1}</p>
    <button type="button">Action {i + 1}</button>
  </Deck.Slide>
));

const meta = {
  title: 'Deck',
  component: Deck.Root,
  args: { 'aria-label': 'Featured slides', defaultIndex: 0 },
  render: (args) => (
    <Deck.Root {...args}>
      <Deck.Viewport className="viewport">{slides}</Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
    </Deck.Root>
  )
} satisfies Meta<typeof Deck.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

/** No stylesheet at all: one full-width slide per snap point. */
export const Default: Story = {};

/**
 * Slides per view, gap and alignment are the consumer's CSS: here two and a
 * half slides in view, a 16px gap, and slides centred on the snap point.
 */
export const Peek: Story = {
  decorators: [
    (Story) => (
      <>
        <style>{`
          .viewport { gap: 16px; }
          .slide {
            width: calc((100% - 2 * 16px) / 2.5);
            scroll-snap-align: center;
            background: #eef;
          }
        `}</style>
        <Story />
      </>
    )
  ]
};

/** Starts at the third slide, on the server and in the browser. */
export const StartingIndex: Story = { args: { defaultIndex: 2 } };

function ControlledDeck() {
  const [index, setIndex] = useState(0);
  return (
    <>
      <Deck.Root
        aria-label="Featured slides"
        index={index}
        onIndexChange={setIndex}
      >
        <Deck.Viewport className="viewport">{slides}</Deck.Viewport>
      </Deck.Root>
      <div role="group" aria-label="Go to slide">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </>
  );
}

/** The index lives in the parent's state, like a controlled input's value:
 * the buttons set it, and scrolling the deck updates it. */
export const Controlled: Story = { render: () => <ControlledDeck /> };
