import type { ComponentProps, CSSProperties } from 'react';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import { curve } from '@slidedeck/react/curve';
import {
  addStyle,
  expectSettledTo,
  expectSnaps,
  mouseDrag,
  nextFrame,
  setReducedMotion,
  viewportOf
} from './fixtures';

// The curve effect (#16): the slides fan along an arc around the focal slide,
// rotating and fading with their progress, while the viewport scrolls, snaps
// and drags natively.

/** Each slide's size, square, and so the distance between two slides. */
const SIZE = 100;
/** Three slides in view, the focal one in the middle. */
const SPAN = SIZE * 3;

type CurveDeckProps = ComponentProps<typeof Deck.Root> & {
  slides?: number;
  dir?: 'ltr' | 'rtl';
  viewportStyle?: CSSProperties;
};

function CurveDeck({
  slides = 6,
  dir = 'ltr',
  orientation,
  viewportStyle,
  ...props
}: CurveDeckProps) {
  const vertical = orientation === 'vertical';
  return (
    <div dir={dir}>
      <Deck.Root aria-label="Test deck" orientation={orientation} {...props}>
        <Deck.Viewport
          effect={curve}
          className="curved"
          style={{
            boxSizing: 'border-box',
            // Room for the first and last slides to reach the middle.
            ...(vertical
              ? { width: SIZE, height: SPAN, paddingBlock: SIZE }
              : { width: SPAN, paddingInline: SIZE }),
            ...viewportStyle
          }}
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

const SLIDE_CSS = `.curved > [data-slidedeck-slide] {
  width: ${SIZE}px;
  height: ${SIZE}px;
  box-sizing: border-box;
}`;

const round = (value: number) => Math.round(value * 10) / 10 || 0;

const readDeck = (root: HTMLElement) => {
  const viewport = viewportOf(root);
  const slides = () => [
    ...viewport.querySelectorAll<HTMLElement>('[data-slidedeck-slide]')
  ];
  const matrices = () =>
    slides().map((slide) => new DOMMatrix(getComputedStyle(slide).transform));
  return {
    root,
    viewport,
    slides,
    /** Each slide's rotation, in degrees, clockwise. */
    angles: () =>
      matrices().map((m) => round((Math.atan2(m.b, m.a) * 180) / Math.PI)),
    /** How far each slide's centre has moved, in px: across the axis, and
     * along it. Rotation is about the centre. */
    moved: () =>
      matrices().map((m) => [round(m.e), round(m.f)] as [number, number]),
    opacity: () =>
      slides().map(
        (slide) =>
          Math.round(Number(getComputedStyle(slide).opacity) * 100) / 100
      ),
    progress: () =>
      slides().map((slide) =>
        Number(slide.style.getPropertyValue('--deck-progress'))
      )
  };
};

const renderDeck = (props: CurveDeckProps = {}) => {
  addStyle(SLIDE_CSS);
  render(<CurveDeck {...props} />);
  const root = screen.getByRole('region', { name: 'Test deck' });
  return {
    ...readDeck(root),
    next: screen.getByRole('button', { name: 'Next' })
  };
};

// With the default radius, four slides: a slide one slide from the focal
// position turns asin(1/4), two slides asin(2/4), three asin(3/4), and drops
// by where that puts it on the circle, 4 - sqrt(16 - p²) slides. It fades
// by a quarter a slide, gone at four.
const TURN = [0, 14.5, 30, 48.6, 90];
const DROP = [0, 12.7, 53.6, 135.4, 400];
const FADE = [1, 0.75, 0.5, 0.25, 0];
const at = (table: number[], distances: number[], sign = 1) =>
  distances.map((p) => round(Math.sign(p) * sign * table[Math.abs(p)]));
const AROUND_2 = [-2, -1, 0, 1, 2, 3];

describe('curve', () => {
  test('fans the slides along an arc around the focal slide, fading with distance', () => {
    const { angles, moved, opacity } = renderDeck({ defaultIndex: 2 });

    expect(angles()).toEqual(at(TURN, AROUND_2));
    expect(moved()).toEqual(
      AROUND_2.map((p) => [0, DROP[Math.abs(p)]] as [number, number])
    );
    expect(opacity()).toEqual(AROUND_2.map((p) => FADE[Math.abs(p)]));
  });

  test('rests at whole progress and snaps exactly with the curve on', async () => {
    const { viewport, next, progress, angles, root } = renderDeck();

    await userEvent.click(next);

    await expectSettledTo(progress, [-1, 0, 1, 2, 3, 4]);
    expect(viewport.scrollLeft).toBe(SIZE);
    expect(root.getAttribute('data-index')).toBe('1');
    expect(angles()).toEqual(at(TURN, [-1, 0, 1, 2, 3, 4]));
    await expectSnaps(viewport);
    expect(progress()).toEqual([-1, 0, 1, 2, 3, 4]);
  });

  test('curves with the scroll while dragging, and progress follows the scroll exactly', async () => {
    const { viewport, progress, angles } = renderDeck();

    const letGo = await mouseDrag(viewport, -SIZE * 0.4, {
      holdMs: 100,
      release: false
    });
    await expect.poll(() => viewport.scrollLeft).toBeGreaterThan(SIZE * 0.2);
    await nextFrame();
    await nextFrame();

    // Progress is the scroll alone: the curve does not move the boxes the
    // deck is measured by.
    const way = viewport.scrollLeft / SIZE;
    expect(progress()).toEqual(
      [0, 1, 2, 3, 4, 5].map((i) => expect.closeTo(i - way, 2))
    );
    const turn = (p: number) =>
      round((Math.asin(Math.min(Math.max(p / 4, -1), 1)) * 180) / Math.PI);
    expect(angles().slice(0, 3)).toEqual(
      [0, 1, 2].map((i) => expect.closeTo(turn(i - way), 0))
    );
    await letGo();
  });

  test('drags to the next slide and settles there', async () => {
    const { viewport, progress, root } = renderDeck();

    await mouseDrag(viewport, -SIZE * 0.7);

    await expectSettledTo(progress, [-1, 0, 1, 2, 3, 4]);
    expect(root.getAttribute('data-index')).toBe('1');
  });

  test('takes its radius, in slides, from --deck-curve-radius', () => {
    const { angles, moved, opacity } = renderDeck({
      viewportStyle: { '--deck-curve-radius': 2 } as CSSProperties
    });

    expect(angles().slice(0, 3)).toEqual([0, 30, 90]);
    expect(moved()[1]).toEqual([0, round((2 - Math.sqrt(3)) * SIZE)]);
    expect(opacity().slice(0, 3)).toEqual([1, 0.5, 0]);
  });

  test('never shows a scrollbar on the page or across the viewport while dragging', async () => {
    const { viewport, angles } = renderDeck();
    expect(angles()[1]).not.toBe(0);
    const html = document.documentElement;
    const measure = () => [
      html.scrollWidth - html.clientWidth,
      html.scrollHeight - html.clientHeight,
      html.clientWidth,
      html.clientHeight,
      viewport.clientWidth,
      viewport.clientHeight,
      viewport.scrollTop
    ];
    const start = measure();
    expect(start[0]).toBeLessThanOrEqual(0);
    expect(start[1]).toBeLessThanOrEqual(0);
    expect(start[6]).toBe(0);
    const seen = new Set<string>();
    let sampling = true;
    const sample = () => {
      seen.add(measure().join());
      if (sampling) requestAnimationFrame(sample);
    };
    sample();

    const letGo = await mouseDrag(viewport, -SIZE * 2.5, {
      steps: 20,
      holdMs: 100,
      release: false
    });
    await letGo();
    await mouseDrag(viewport, SIZE * 1.5, { steps: 20 });
    await nextFrame();
    sampling = false;

    expect([...seen]).toEqual([start.join()]);

    // The arc hangs below the viewport, but the viewport cannot be scrolled
    // down to it: there is nothing there to show a scrollbar for.
    await userEvent.wheel(viewport, { delta: { y: 200 } });
    await nextFrame();
    expect(viewport.scrollTop).toBe(0);
  });

  test('keeps every slide reachable, with no snap targets', () => {
    const { viewport, slides } = renderDeck();

    expect(slides().map((slide) => slide.inert)).toEqual(Array(6).fill(false));
    expect(viewport.querySelector('[data-slidedeck-snap-target]')).toBeNull();
  });

  test('fans across the other axis in a vertical deck', async () => {
    const { viewport, next, progress, angles, moved } = renderDeck({
      orientation: 'vertical'
    });

    await userEvent.click(next);
    await expectSettledTo(progress, [-1, 0, 1, 2, 3, 4]);
    expect(viewport.scrollTop).toBe(SIZE);

    // The arc bends toward the inline end: a slide below the focal one
    // turns anticlockwise, and every slide but it moves right.
    expect(angles().slice(0, 3)).toEqual(at(TURN, [-1, 0, 1], -1));
    expect(moved().slice(0, 3)).toEqual([
      [DROP[1], 0],
      [0, 0],
      [DROP[1], 0]
    ]);
    await expectSnaps(viewport, 'scrollTop');
  });

  test('fans the mirror way in a right-to-left deck', async () => {
    const { viewport, next, progress, angles, moved, slides } = renderDeck({
      dir: 'rtl',
      defaultIndex: 2
    });

    // The slide after the focal one is on its left, and turns anticlockwise.
    const [focal, after] = [slides()[2], slides()[3]];
    expect(after.getBoundingClientRect().left).toBeLessThan(
      focal.getBoundingClientRect().left
    );
    expect(angles()).toEqual(at(TURN, AROUND_2, -1));
    expect(moved()[3]).toEqual([0, DROP[1]]);

    await userEvent.click(next);
    await expectSettledTo(progress, [-3, -2, -1, 0, 1, 2]);
    expect(viewport.scrollLeft).toBe(-3 * SIZE);
  });

  test('server HTML draws the slides flat, as a plain deck, until it mounts', async () => {
    addStyle(SLIDE_CSS);
    const container = document.createElement('div');
    container.innerHTML = renderToString(<CurveDeck defaultIndex={2} />);
    document.body.append(container);
    await nextFrame();
    const { angles, moved, opacity } = readDeck(
      container.querySelector('[role=region]')!
    );

    expect(angles()).toEqual(Array(6).fill(0));
    expect(moved()).toEqual(Array(6).fill([0, 0]));
    expect(opacity()).toEqual(Array(6).fill(1));
    container.remove();
  });
});

describe('curve under reduced motion', () => {
  test('keeps the slides flat, fading with distance only', async () => {
    await setReducedMotion(true);
    try {
      const { angles, moved, opacity } = renderDeck({ defaultIndex: 2 });

      expect(angles()).toEqual(Array(6).fill(0));
      expect(moved()).toEqual(Array(6).fill([0, 0]));
      expect(opacity()).toEqual(AROUND_2.map((p) => FADE[Math.abs(p)]));
    } finally {
      await setReducedMotion(false);
    }
  });
});
