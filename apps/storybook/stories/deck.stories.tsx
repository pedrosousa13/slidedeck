import * as Deck from '@slidedeck/react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Deck',
  component: Deck.Root,
  args: { 'aria-label': 'Featured slides', defaultIndex: 0 },
  render: (args) => (
    <Deck.Root {...args}>
      <Deck.Viewport className="viewport">
        {Array.from({ length: 6 }, (_, i) => (
          <Deck.Slide key={i} className="slide">
            <p>Slide {i + 1}</p>
            <button type="button">Action {i + 1}</button>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
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
