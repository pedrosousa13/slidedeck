import { useState } from 'react';
import * as Deck from '@slidedeck/react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const slidesOf = (count: number) =>
  Array.from({ length: count }, (_, i) => (
    <Deck.Slide key={i} className="slide">
      <p>Slide {i + 1}</p>
      <button type="button">Action {i + 1}</button>
    </Deck.Slide>
  ));

const slides = slidesOf(6);

const meta = {
  title: 'Deck',
  component: Deck.Root,
  args: { 'aria-label': 'Featured slides', defaultIndex: 0 },
  render: (args) => (
    <Deck.Root {...args}>
      <Deck.Viewport className="viewport">{slides}</Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
      <Deck.Dots />
      <Deck.Counter />
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

/**
 * Snapping in pages of several slides is consumer CSS too: only the first
 * slide of each page is a snap target, so Prev and Next move a page, and Dots
 * and Counter count pages. Each slide is still labelled "n of 10".
 *
 * Here one slide per page on narrow screens, and three in view, three to a
 * page, from 640px. Give both rules of a page size the same specificity, as
 * below, so the one in a later media query overrides every slide's alignment.
 * Slidedeck re-reads the pages when the window resizes. The server cannot
 * measure, so it renders a page per slide, and a paged deck corrects its
 * Dots and Counter at hydration.
 */
export const Pages: Story = {
  decorators: [
    (Story) => (
      <>
        <style>{`
          @media (min-width: 640px) {
            .slide { width: calc(100% / 3); }
            .slide:nth-child(3n + 1) { scroll-snap-align: start; }
            .slide:not(:nth-child(3n + 1)) { scroll-snap-align: none; }
          }
        `}</style>
        <Story />
      </>
    )
  ],
  render: (args) => (
    <Deck.Root {...args}>
      <Deck.Viewport className="viewport">{slidesOf(10)}</Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
      <Deck.Dots />
      <Deck.Counter />
    </Deck.Root>
  )
};

/**
 * A mouse can drag the deck; it settles on a snap point when it lets go, and
 * a drag never clicks the link it started on. A plain click still follows it.
 * Touch, pen and trackpad scroll natively. Turn drag off with `drag={false}`.
 */
export const Drag: Story = {
  args: { drag: true },
  render: (args) => (
    <Deck.Root {...args}>
      <Deck.Viewport className="viewport">
        {Array.from({ length: 6 }, (_, i) => (
          <Deck.Slide key={i} className="slide">
            <a
              href={`#article-${i + 1}`}
              style={{ display: 'block', padding: '4rem 1rem' }}
            >
              Article {i + 1}
            </a>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
    </Deck.Root>
  )
};

/**
 * The focal slide is the one at the snap alignment point (here the slides
 * use `scroll-snap-align: center`), marked `data-focal` for CSS and reported
 * by `onFocalChange`. With several slides in view it is not the current
 * slide, which is the first slide resting at the snap point. With
 * `clickToFocus`, clicking a slide brings it to the snap alignment point, as
 * near as the scroll range allows; it is off by default.
 */
export const ClickToFocus: Story = {
  args: { clickToFocus: true },
  decorators: [
    (Story) => (
      <>
        <style>{`
          .viewport { gap: 16px; }
          .slide {
            width: calc((100% - 2 * 16px) / 2.5);
            scroll-snap-align: center;
            background: #eef;
            opacity: 0.6;
          }
          .slide[data-focal] { opacity: 1; outline: 2px solid #335; }
        `}</style>
        <Story />
      </>
    )
  ],
  render: (args) => (
    <Deck.Root {...args}>
      <Deck.Viewport className="viewport">
        {Array.from({ length: 6 }, (_, i) => (
          <Deck.Slide key={i} className="slide">
            <p>Card {i + 1}</p>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
    </Deck.Root>
  )
};

/**
 * A full-height vertical feed: `orientation="vertical"` scrolls and snaps on
 * the block axis, and Prev and Next step up and down. The viewport's height
 * is the consumer's CSS; each slide fills it by default.
 */
export const Vertical: Story = {
  args: { orientation: 'vertical' },
  decorators: [
    (Story) => (
      <>
        <style>{`.viewport { height: 240px; }`}</style>
        <Story />
      </>
    )
  ]
};

/**
 * In a right-to-left document the deck follows the writing direction, which
 * it reads from any ancestor's `dir`: it starts at the right, Next moves
 * toward the inline end on the left, a mouse drag to the right moves on, and
 * the arrow keys scroll the focused viewport the way the page reads.
 */
export const RightToLeft: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    )
  ]
};
