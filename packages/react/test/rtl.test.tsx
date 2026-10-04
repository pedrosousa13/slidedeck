import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import {
  expectSettledTo,
  expectSnaps,
  mouseAt,
  mouseDrag,
  viewportOf,
  WIDTH
} from './fixtures';

// A right-to-left document: the deck starts at the right, and its end is to
// the left. Browsers report scrollLeft as 0 at the start and negative toward
// the end.

let removeStyle = () => {};
afterEach(() => removeStyle());

function addStyle(css: string) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  removeStyle = () => style.remove();
}

type RtlDeckProps = ComponentProps<typeof Deck.Root> & {
  slides?: number;
  viewportClassName?: string;
};

/** The deck's direction comes from an ancestor's `dir`, as in a document. */
function RtlDeck({ slides = 5, viewportClassName, ...props }: RtlDeckProps) {
  return (
    <div dir="rtl">
      <Deck.Root aria-label="Test deck" {...props}>
        <Deck.Prev />
        <Deck.Viewport className={viewportClassName} style={{ width: WIDTH }}>
          {Array.from({ length: slides }, (_, i) => (
            <Deck.Slide key={i} style={{ height: 100 }}>
              Slide {i + 1}
            </Deck.Slide>
          ))}
        </Deck.Viewport>
        <Deck.Next />
        <Deck.Dots />
        <Deck.Counter />
      </Deck.Root>
    </div>
  );
}

const renderDeck = (props: RtlDeckProps = {}) => {
  const onIndexChange = vi.fn();
  render(<RtlDeck onIndexChange={onIndexChange} {...props} />);
  const root = screen.getByRole('region', { name: 'Test deck' });
  const viewport = viewportOf(root);
  return {
    root,
    viewport,
    onIndexChange,
    prev: screen.getByRole('button', { name: 'Previous' }),
    next: screen.getByRole('button', { name: 'Next' }),
    dots: () =>
      within(root)
        .getByRole('group', { name: 'Choose page' })
        .querySelectorAll('button'),
    counter: () => root.querySelector('[data-slidedeck-counter]')?.textContent,
    focal: () =>
      [...viewport.children].flatMap((slide, i) =>
        slide.hasAttribute('data-focal') ? [i] : []
      )
  };
};

/** Where a slide's right edge, its inline start, sits from the viewport's. */
const fromRight = (viewport: HTMLElement, index: number) =>
  Math.round(
    viewport.getBoundingClientRect().right -
      viewport.children[index].getBoundingClientRect().right
  );

const scrollLeft = (viewport: HTMLElement) => () => viewport.scrollLeft;

/** A slow drag: held still before release, so it carries no flick. */
const slowly = { steps: 10, stepMs: 20, holdMs: 120 };

describe('in a right-to-left document', () => {
  test('the deck starts at its first slide, on the right', () => {
    const { viewport, root } = renderDeck();

    expect(viewport.scrollLeft).toBe(0);
    expect(fromRight(viewport, 0)).toBe(0);
    expect(root.dataset.index).toBe('0');
  });

  test('starts at defaultIndex', () => {
    const { viewport, root } = renderDeck({ defaultIndex: 3 });

    expect(fromRight(viewport, 3)).toBe(0);
    expect(root.dataset.index).toBe('3');
  });

  test('Next moves toward the inline end, the left, and Prev back', async () => {
    const { viewport, root, prev, next, onIndexChange } = renderDeck();

    await userEvent.click(next);
    await expectSettledTo(scrollLeft(viewport), -WIDTH);
    expect(fromRight(viewport, 1)).toBe(0);
    await userEvent.click(next);
    await expectSettledTo(scrollLeft(viewport), -2 * WIDTH);
    await userEvent.click(prev);
    await expectSettledTo(scrollLeft(viewport), -WIDTH);

    expect(onIndexChange.mock.calls).toEqual([[1], [2], [1]]);
    expect(root.dataset.index).toBe('1');
  });

  test('Prev is disabled at the first slide and Next at the last', async () => {
    const { viewport, prev, next } = renderDeck({ defaultIndex: 3 });

    await userEvent.click(next);

    await expectSettledTo(scrollLeft(viewport), -4 * WIDTH);
    expect(next.hasAttribute('disabled')).toBe(true);
    expect(prev.hasAttribute('disabled')).toBe(false);
  });

  test('a scroll comes to rest on a snap point and reports it', async () => {
    const { viewport, onIndexChange } = renderDeck();

    await userEvent.wheel(viewport, { delta: { x: -200 } });

    await expectSettledTo(scrollLeft(viewport), -WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
    await expectSnaps(viewport);
  });

  test('ArrowLeft on the focused viewport moves on toward the end', async () => {
    const { viewport, onIndexChange } = renderDeck();

    viewport.focus();
    await userEvent.keyboard('{ArrowLeft}');

    await expectSettledTo(() => onIndexChange.mock.calls, [[1]]);
    expect(fromRight(viewport, 1)).toBe(0);
  });

  test('in pages of three, Next moves a page, and Dots and Counter count pages', async () => {
    addStyle(`
      .pages > :nth-child(3n + 1) { scroll-snap-align: start; }
      .pages > :not(:nth-child(3n + 1)) { scroll-snap-align: none; }
    `);
    const { viewport, next, dots, counter } = renderDeck({
      slides: 10,
      viewportClassName: 'pages'
    });

    expect(dots()).toHaveLength(4);
    expect(counter()).toBe('1 / 4');
    await userEvent.click(next);
    await expectSettledTo(scrollLeft(viewport), -3 * WIDTH);
    expect(counter()).toBe('2 / 4');
    expect(dots()[1].getAttribute('aria-current')).toBe('true');

    await userEvent.click(dots()[3]);
    await expectSettledTo(scrollLeft(viewport), -9 * WIDTH);
    expect(counter()).toBe('4 / 4');
  });

  test('end-aligned slides rest with their left edge on the viewport’s', async () => {
    addStyle(`.ends > * { width: 50%; scroll-snap-align: end; }`);
    const { viewport, next } = renderDeck({ viewportClassName: 'ends' });

    await userEvent.click(next);

    // Slides 1 and 2 fill the view at the start; Next brings slide 3 in.
    await expectSettledTo(scrollLeft(viewport), -WIDTH / 2);
    expect(
      Math.round(
        viewport.children[2].getBoundingClientRect().left -
          viewport.getBoundingClientRect().left
      )
    ).toBe(0);
  });
});

describe('the focal slide in a right-to-left document', () => {
  const CENTRED = `.centred > * { width: calc(100% / 3.5); scroll-snap-align: center; }`;

  test('is the slide at the snap alignment point', async () => {
    addStyle(CENTRED);
    const { next, focal } = renderDeck({
      slides: 7,
      viewportClassName: 'centred'
    });

    // At the start, slide 0 rests at the snap point but slide 1 is centred.
    await expect.poll(focal).toEqual([1]);
    await userEvent.click(next);
    await expectSettledTo(focal, [2]);
  });

  test('clicking a slide brings it to the focal position', async () => {
    addStyle(CENTRED);
    const { viewport, focal, onIndexChange } = renderDeck({
      slides: 7,
      viewportClassName: 'centred',
      clickToFocus: true
    });
    await expect.poll(focal).toEqual([1]);

    // Slide 3 is in view, left of the centre.
    const view = viewport.getBoundingClientRect();
    const box = viewport.children[2].getBoundingClientRect();
    const x = (Math.max(box.left, view.left) + box.right) / 2;
    const y = box.top + box.height / 2;
    await mouseAt('mousePressed', x, y, 1);
    await mouseAt('mouseReleased', x, y, 0);

    await expectSettledTo(focal, [2]);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });
});

describe('a mouse drag in a right-to-left document', () => {
  test('moves the deck with the pointer', async () => {
    const { viewport } = renderDeck();

    const letGo = await mouseDrag(viewport, 100, {
      ...slowly,
      release: false
    });

    await expect.poll(scrollLeft(viewport)).toBe(-100);
    await letGo();
  });

  test('to the right, past half a slide, settles on the next snap point', async () => {
    const { viewport, onIndexChange } = renderDeck();

    await mouseDrag(viewport, 200, slowly);

    await expectSettledTo(scrollLeft(viewport), -WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
    await expectSnaps(viewport);
  });

  test('a flick to the right moves on a snap point though it is short', async () => {
    const { viewport, onIndexChange } = renderDeck();

    await mouseDrag(viewport, 60, { steps: 4, stepMs: 10 });

    await expectSettledTo(scrollLeft(viewport), -WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });

  test('to the left goes back toward the start', async () => {
    const { viewport, onIndexChange } = renderDeck({ defaultIndex: 2 });

    await mouseDrag(viewport, -200, slowly);

    await expectSettledTo(scrollLeft(viewport), -WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });
});
