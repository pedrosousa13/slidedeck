import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import { fade } from '@slidedeck/react/fade';
import {
  addStyle,
  expectSettledTo,
  expectSnaps,
  mouseDrag,
  nextFrame,
  pagesOf,
  setReducedMotion,
  viewportOf,
  WIDTH
} from './fixtures';

// The fade effect (#15, ADR-0006): the viewport scrolls, snaps and drags
// natively, while the slides stay stacked in place and crossfade by progress.

const HEIGHT = 200;

type FadeDeckProps = ComponentProps<typeof Deck.Root> & {
  slides?: number;
  viewportClassName?: string;
  dir?: 'ltr' | 'rtl';
};

function FadeDeck({
  slides = 4,
  viewportClassName,
  dir = 'ltr',
  orientation,
  ...props
}: FadeDeckProps) {
  return (
    <div dir={dir}>
      <Deck.Root aria-label="Test deck" orientation={orientation} {...props}>
        <Deck.Viewport
          effect={fade}
          className={viewportClassName}
          style={{ width: WIDTH, height: HEIGHT }}
        >
          {Array.from({ length: slides }, (_, i) => (
            <Deck.Slide key={i}>
              <button type="button">Button {i + 1}</button>
            </Deck.Slide>
          ))}
        </Deck.Viewport>
        <Deck.Next />
      </Deck.Root>
    </div>
  );
}

const slidesOf = (viewport: HTMLElement) => [
  ...viewport.querySelectorAll<HTMLElement>('[data-slidedeck-slide]')
];

const readDeck = (root: HTMLElement) => {
  const viewport = viewportOf(root);
  const slides = () => slidesOf(viewport);
  return {
    root,
    viewport,
    slides,
    opacity: () =>
      slides().map((slide) => Number(getComputedStyle(slide).opacity)),
    /** Each slide's offset from the viewport's top left corner. */
    offsets: () => {
      const box = viewport.getBoundingClientRect();
      return slides().map((slide) => {
        const rect = slide.getBoundingClientRect();
        return [
          Math.round(rect.left - box.left),
          Math.round(rect.top - box.top)
        ];
      });
    },
    inert: () => slides().map((slide) => slide.inert)
  };
};

const renderDeck = (props: FadeDeckProps = {}) => {
  render(<FadeDeck {...props} />);
  const root = screen.getByRole('region', { name: 'Test deck' });
  return {
    ...readDeck(root),
    next: screen.getByRole('button', { name: 'Next' })
  };
};

const closeTo = (values: number[]) =>
  values.map((value) => expect.closeTo(value, 2));

const STACKED = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0]
];

describe('fade', () => {
  test('shows only the starting slide, stacked over the others', () => {
    const { opacity, offsets } = renderDeck();

    expect(opacity()).toEqual([1, 0, 0, 0]);
    expect(offsets()).toEqual(STACKED);
  });

  test('scrolls the viewport natively while the slides stay in place', async () => {
    const { viewport, next, opacity, offsets, root } = renderDeck();

    await userEvent.click(next);

    await expectSettledTo(opacity, [0, 1, 0, 0]);
    expect(viewport.scrollLeft).toBe(WIDTH);
    expect(offsets()).toEqual(STACKED);
    expect(root.getAttribute('data-index')).toBe('1');
  });

  test('crossfades with the scroll', async () => {
    const { viewport, opacity, offsets } = renderDeck();

    const letGo = await mouseDrag(viewport, -WIDTH * 0.25, {
      holdMs: 100,
      release: false
    });

    // Held a quarter of the way: whatever the scroll, opacity follows it.
    await expect.poll(() => viewport.scrollLeft / WIDTH).toBeCloseTo(0.25, 1);
    await nextFrame();
    const way = viewport.scrollLeft / WIDTH;
    expect(opacity()).toEqual(closeTo([1 - way, way, 0, 0]));
    expect(offsets()).toEqual(STACKED);
    await letGo();
  });

  test('snaps', async () => {
    const { viewport, next, opacity } = renderDeck();
    await userEvent.click(next);
    await expectSettledTo(opacity, [0, 1, 0, 0]);

    await expectSnaps(viewport);
  });

  test('drags to the next slide and settles there', async () => {
    const { viewport, opacity, root } = renderDeck();

    // Held still before letting go: a drag, not a flick.
    await mouseDrag(viewport, -WIDTH * 0.7, { holdMs: 120 });

    await expectSettledTo(opacity, [0, 1, 0, 0]);
    expect(root.getAttribute('data-index')).toBe('1');
  });

  test('runs the same way in a vertical deck', async () => {
    const { viewport, next, opacity, offsets } = renderDeck({
      orientation: 'vertical'
    });

    await userEvent.click(next);
    await expectSettledTo(opacity, [0, 1, 0, 0]);
    expect(viewport.scrollTop).toBe(HEIGHT);
    expect(offsets()).toEqual(STACKED);

    const letGo = await mouseDrag(viewport, -HEIGHT / 2, {
      axis: 'y',
      holdMs: 100,
      release: false
    });
    await expect.poll(opacity).toEqual(closeTo([0, 0.5, 0.5, 0]));
    expect(offsets()).toEqual(STACKED);
    await letGo();
  });

  test('runs the same way in a right-to-left deck', async () => {
    const { viewport, next, opacity, offsets } = renderDeck({ dir: 'rtl' });

    await userEvent.click(next);
    await expectSettledTo(opacity, [0, 1, 0, 0]);
    expect(viewport.scrollLeft).toBe(-WIDTH);
    expect(offsets()).toEqual(STACKED);

    // In right-to-left, a pointer moving right drags the deck forward.
    const letGo = await mouseDrag(viewport, WIDTH / 2, {
      holdMs: 100,
      release: false
    });
    await expect.poll(opacity).toEqual(closeTo([0, 0.5, 0.5, 0]));
    expect(offsets()).toEqual(STACKED);
    await letGo();
  });

  test('makes every slide but the focal one inert, so focus and clicks reach only the slide shown', async () => {
    const { viewport, next, inert, slides } = renderDeck();
    expect(inert()).toEqual([false, true, true, true]);

    await userEvent.click(next);

    await expectSettledTo(inert, [true, false, true, true]);
    const box = viewport.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2
    );
    expect(hit?.closest('[data-slidedeck-slide]')).toBe(slides()[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Button 2' }));
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Button 2' })
    );
  });

  test('keeps focus in the deck when the focused slide goes inert, so arrow keys go on', async () => {
    const { viewport, opacity } = renderDeck();
    screen.getByRole('button', { name: 'Button 1' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    await expectSettledTo(opacity, [0, 1, 0, 0]);
    expect(document.activeElement).toBe(viewport);

    await userEvent.keyboard('{ArrowRight}');
    await expectSettledTo(opacity, [0, 0, 1, 0]);
  });

  test('steps one slide at a time, with group snapping not applying', async () => {
    addStyle(pagesOf(2));
    const { next, opacity, root } = renderDeck({ viewportClassName: 'pages' });

    await userEvent.click(next);

    await expectSettledTo(opacity, [0, 1, 0, 0]);
    expect(root.getAttribute('data-index')).toBe('1');
  });

  test('server HTML shows only the starting slide, and only it is reachable', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<FadeDeck defaultIndex={2} />);
    document.body.append(container);
    await nextFrame();
    const { opacity, offsets, inert } = readDeck(
      container.querySelector('[role=region]')!
    );

    expect(opacity()).toEqual([0, 0, 1, 0]);
    expect(offsets()).toEqual(STACKED);
    expect(inert()).toEqual([true, true, false, true]);
  });
});

describe('fade under reduced motion', () => {
  test.each([
    [0.3, [1, 0, 0, 0]],
    [0.7, [0, 1, 0, 0]]
  ])(
    'cuts between slides halfway instead of crossfading: %s of the way',
    async (way, expected) => {
      await setReducedMotion(true);
      try {
        const { viewport, opacity } = renderDeck();

        const letGo = await mouseDrag(viewport, -WIDTH * way, {
          holdMs: 100,
          release: false
        });
        await expect
          .poll(() => Math.abs(viewport.scrollLeft - WIDTH * way))
          .toBeLessThan(5);
        await nextFrame();
        await nextFrame();
        expect(opacity()).toEqual(expected);
        await letGo();
      } finally {
        await setReducedMotion(false);
      }
    }
  );

  test('shows exactly one slide when the scroll rests exactly halfway', async () => {
    await setReducedMotion(true);
    try {
      const { viewport, opacity } = renderDeck();
      viewport.style.scrollSnapType = 'none';
      viewport.scrollLeft = WIDTH / 2;
      await nextFrame();
      await nextFrame();

      expect(opacity()).toEqual([0, 1, 0, 0]);
    } finally {
      await setReducedMotion(false);
    }
  });

  test('jumps on Next with no frame in between', async () => {
    await setReducedMotion(true);
    try {
      const { next, opacity } = renderDeck();
      const seen = new Set<string>();
      let sampling = true;
      const sample = () => {
        seen.add(opacity().join());
        if (sampling) requestAnimationFrame(sample);
      };
      sample();

      await userEvent.click(next);
      await expectSettledTo(opacity, [0, 1, 0, 0]);
      sampling = false;

      expect([...seen]).toEqual(['1,0,0,0', '0,1,0,0']);
    } finally {
      await setReducedMotion(false);
    }
  });
});

describe('a deck without the effect', () => {
  test('renders only its slides in the viewport, side by side', () => {
    render(
      <Deck.Root aria-label="Test deck">
        <Deck.Viewport style={{ width: WIDTH }}>
          <Deck.Slide>One</Deck.Slide>
          <Deck.Slide>Two</Deck.Slide>
        </Deck.Viewport>
      </Deck.Root>
    );
    const { viewport, offsets, inert } = readDeck(
      screen.getByRole('region', { name: 'Test deck' })
    );

    expect(viewport.children).toHaveLength(2);
    expect(offsets()).toEqual([
      [0, 0],
      [WIDTH, 0]
    ]);
    expect(inert()).toEqual([false, false]);
  });
});
