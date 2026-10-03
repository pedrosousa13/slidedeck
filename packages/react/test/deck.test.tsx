import { Profiler, type ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import {
  expectSettledTo,
  gestureScroll,
  setReducedMotion,
  sleep,
  TestDeck,
  touchSwipe,
  viewportOf,
  WIDTH
} from './fixtures';

const renderDeck = (props: Parameters<typeof TestDeck>[0] = {}) => {
  const onIndexChange = vi.fn();
  const { container } = render(
    <TestDeck onIndexChange={onIndexChange} {...props} />
  );
  const root = screen.getByRole('region', { name: 'Test deck' });
  return {
    container,
    root,
    viewport: viewportOf(root),
    prev: screen.getByRole('button', { name: 'Previous' }),
    next: screen.getByRole('button', { name: 'Next' }),
    onIndexChange
  };
};

/** Where each slide's start edge sits relative to the viewport's. */
const slideOffsets = (viewport: HTMLElement) => {
  const left = viewport.getBoundingClientRect().left;
  return [...viewport.children].map((slide) =>
    Math.round(slide.getBoundingClientRect().left - left)
  );
};

const styleSheet = (css: string) => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
};

test('a client render starts at defaultIndex before the first paint', () => {
  const { viewport, onIndexChange } = renderDeck({ defaultIndex: 3 });

  expect(viewport.scrollLeft).toBe(3 * WIDTH);
  expect(onIndexChange).not.toHaveBeenCalled();
});

test('a defaultIndex past the last slide starts at the last, silently', async () => {
  const { viewport, next, onIndexChange } = renderDeck({ defaultIndex: 10 });

  expect(viewport.scrollLeft).toBe(4 * WIDTH);
  expect(next.hasAttribute('disabled')).toBe(true);
  await sleep(200);
  expect(onIndexChange).not.toHaveBeenCalled();
});

describe('with no stylesheet', () => {
  test('a scroll comes to rest on a snap point', async () => {
    const { viewport } = renderDeck();

    await userEvent.wheel(viewport, { delta: { x: 200 } });

    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
  });

  test('Next and Prev move one snap point', async () => {
    const { viewport, prev, next } = renderDeck();

    await userEvent.click(next);
    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
    await userEvent.click(next);
    await expectSettledTo(() => viewport.scrollLeft, 2 * WIDTH);
    await userEvent.click(prev);
    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
  });
});

describe('geometry from consumer CSS', () => {
  let removeStyle = () => {};
  afterEach(() => removeStyle());

  test('fractional slides per view and a gap produce matching snap points', async () => {
    // 2.5 slides in view with a 10px gap: 5 slides of 116px.
    removeStyle = styleSheet(`
      .peek { gap: 10px; }
      .peek > * { width: calc((100% - 2 * 10px) / 2.5); }
    `);
    const { viewport, next } = renderDeck({ viewportClassName: 'peek' });
    const max = viewport.scrollWidth - viewport.clientWidth;

    // Each Next lands a slide's start edge on the viewport's start edge,
    // until the scroll range runs out and the last snap point is its end.
    await userEvent.click(next);
    await expectSettledTo(() => slideOffsets(viewport)[1], 0);
    await userEvent.click(next);
    await expectSettledTo(() => slideOffsets(viewport)[2], 0);
    await userEvent.click(next);
    await expectSettledTo(() => viewport.scrollLeft, max);
    expect(next.hasAttribute('disabled')).toBe(true);
  });

  test('alignment set in consumer CSS is the alignment the deck snaps to', async () => {
    removeStyle = styleSheet(`
      .centred > * { width: 50%; scroll-snap-align: center; }
    `);
    const { viewport, next } = renderDeck({ viewportClassName: 'centred' });
    const centreOf = (el: Element) => {
      const box = el.getBoundingClientRect();
      return Math.round(box.left + box.width / 2);
    };

    expect(viewport.children[1].getBoundingClientRect().width).toBe(WIDTH / 2);
    await userEvent.click(next);

    await expectSettledTo(
      () => centreOf(viewport.children[1]),
      centreOf(viewport)
    );
  });
});

describe('onIndexChange fires once per settled scroll', () => {
  test('from Next and Prev', async () => {
    const { root, prev, next, onIndexChange } = renderDeck();

    await userEvent.click(next);
    await expectSettledTo(() => onIndexChange.mock.calls, [[1]]);
    expect(root.dataset.index).toBe('1');

    await userEvent.click(prev);
    await expectSettledTo(() => onIndexChange.mock.calls, [[1], [0]]);
    expect(root.dataset.index).toBe('0');
  });

  test('from a mouse wheel', async () => {
    const { viewport, onIndexChange } = renderDeck();

    await userEvent.wheel(viewport, { delta: { x: 200 } });

    await expectSettledTo(() => onIndexChange.mock.calls, [[1]]);
  });

  test('from a trackpad-style scroll gesture', async () => {
    const { viewport, onIndexChange } = renderDeck();

    await gestureScroll(viewport, WIDTH);

    await expectSettledTo(() => onIndexChange.mock.calls, [[1]]);
  });

  test('from a touch swipe', async () => {
    const { viewport, onIndexChange } = renderDeck();

    await touchSwipe(viewport, 200);

    await expectSettledTo(() => onIndexChange.mock.calls, [[1]]);
  });

  test('from the keyboard', async () => {
    const { viewport, onIndexChange } = renderDeck();

    viewport.focus();
    await userEvent.keyboard('{ArrowRight}');

    await expectSettledTo(() => onIndexChange.mock.calls, [[1]]);
  });

  test('once for two quick presses of Next, which move two snap points', async () => {
    const { viewport, next, onIndexChange } = renderDeck();

    next.click();
    next.click();

    await expectSettledTo(() => viewport.scrollLeft, 2 * WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[2]]);
  });

  test('once when the viewport resizes mid-scroll', async () => {
    const { viewport, onIndexChange } = renderDeck();
    // Resize while the viewport passes snap point 1 on its way to 2.
    const resizeMidway = () => {
      if (viewport.scrollLeft < WIDTH * 0.6) return;
      viewport.removeEventListener('scroll', resizeMidway);
      viewport.style.height = '200px';
    };
    viewport.addEventListener('scroll', resizeMidway);

    viewport.scrollTo({ left: 2 * WIDTH, behavior: 'smooth' });

    await expectSettledTo(() => viewport.scrollLeft, 2 * WIDTH);
    expect(viewport.style.height).toBe('200px');
    expect(onIndexChange.mock.calls).toEqual([[2]]);
  });

  test('not at all when a scroll comes back to the same snap point', async () => {
    const { viewport, onIndexChange } = renderDeck();

    await userEvent.wheel(viewport, { delta: { x: 20 } });

    await expectSettledTo(() => viewport.scrollLeft, 0);
    expect(onIndexChange).not.toHaveBeenCalled();
  });
});

describe('state as data attributes', () => {
  const marked = (elements: Element[], name: string) =>
    elements.map((el) => el.hasAttribute(name));

  test('the current slide carries data-current', async () => {
    const { viewport, next } = renderDeck({ slides: 3 });
    const slides = [...viewport.children];

    expect(marked(slides, 'data-current')).toEqual([true, false, false]);
    await userEvent.click(next);
    await expect
      .poll(() => marked(slides, 'data-current'))
      .toEqual([false, true, false]);
  });

  test('a button at its end carries data-disabled', async () => {
    const { prev, next } = renderDeck({ slides: 2 });

    expect(marked([prev, next], 'data-disabled')).toEqual([true, false]);
    await userEvent.click(next);
    await expect
      .poll(() => marked([prev, next], 'data-disabled'))
      .toEqual([false, true]);
  });
});

describe('Prev and Next', () => {
  test('Prev is disabled at the first snap point and Next at the last', async () => {
    const { prev, next } = renderDeck({ slides: 2 });

    expect(prev.hasAttribute('disabled')).toBe(true);
    expect(next.hasAttribute('disabled')).toBe(false);

    await userEvent.click(next);

    await expect.poll(() => next.hasAttribute('disabled')).toBe(true);
    expect(prev.hasAttribute('disabled')).toBe(false);
  });

  test('Next re-enables when slides are added without a resize', async () => {
    const { rerender } = render(<TestDeck slides={2} />);
    const next = screen.getByRole('button', { name: 'Next' });
    await userEvent.click(next);
    await expect.poll(() => next.hasAttribute('disabled')).toBe(true);

    rerender(<TestDeck slides={4} />);

    await expect.poll(() => next.hasAttribute('disabled')).toBe(false);
  });

  test('both are absent when every slide fits', async () => {
    const removeStyle = styleSheet(`.fits > * { width: 25%; }`);
    try {
      render(<TestDeck viewportClassName="fits" slides={4} />);

      expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    } finally {
      removeStyle();
    }
  });

  test('both appear once the slides stop fitting', async () => {
    const removeStyle = styleSheet(`.fits > * { width: 25%; }`);
    try {
      const { container } = render(
        <TestDeck viewportClassName="fits" slides={4} />
      );
      const viewport = container.querySelector<HTMLElement>(
        '[data-slidedeck-viewport]'
      )!;

      expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
      viewport.style.width = `${WIDTH / 2}px`;

      await expect
        .poll(() => screen.queryByRole('button', { name: 'Next' }))
        .not.toBeNull();
    } finally {
      removeStyle();
    }
  });
});

describe('accessibility', () => {
  test('the deck is a carousel region with the label it is given', () => {
    const { root } = renderDeck();

    expect(root.getAttribute('aria-roledescription')).toBe('carousel');
  });

  test('each slide is a group labelled "n of m"', () => {
    renderDeck({ slides: 3 });

    const slides = screen.getAllByRole('group');
    expect(slides.map((slide) => slide.getAttribute('aria-label'))).toEqual([
      '1 of 3',
      '2 of 3',
      '3 of 3'
    ]);
    expect(slides[0].getAttribute('aria-roledescription')).toBe('slide');
  });

  test('no off-screen slide is hidden or inert', () => {
    renderDeck();

    for (const slide of screen.getAllByRole('group')) {
      expect(slide.hasAttribute('aria-hidden')).toBe(false);
      expect(slide.hasAttribute('inert')).toBe(false);
    }
  });

  test('tabbing to a control in an off-screen slide scrolls that slide into view', async () => {
    const { viewport, onIndexChange } = renderDeck();
    screen.getByRole('button', { name: 'Button 1' }).focus();

    await userEvent.tab();

    expect(document.activeElement?.textContent).toBe('Button 2');
    await expectSettledTo(() => slideOffsets(viewport)[1], 0);
    await expectSettledTo(() => onIndexChange.mock.calls, [[1]]);
  });
});

describe('reduced motion', () => {
  afterEach(() => setReducedMotion(false));

  test('Next scrolls smoothly by default', () => {
    const { viewport, next } = renderDeck();

    next.click();

    expect(viewport.scrollLeft).toBe(0);
  });

  test('with reduced motion, Next and Prev jump instead of scrolling smoothly', async () => {
    await setReducedMotion(true);
    const { viewport, prev, next } = renderDeck();

    next.click();
    expect(viewport.scrollLeft).toBe(WIDTH);

    await expect.poll(() => prev.hasAttribute('disabled')).toBe(false);
    prev.click();
    expect(viewport.scrollLeft).toBe(0);
  });
});

test('scrolling re-renders React only when the current index changes', async () => {
  let commits = 0;
  const { container } = render(
    <Profiler id="deck" onRender={() => commits++}>
      <TestDeck />
    </Profiler>
  );
  const viewport = viewportOf(container);
  const next = screen.getByRole('button', { name: 'Next' });
  await sleep(100);
  let scrolls = 0;
  viewport.addEventListener('scroll', () => scrolls++);
  commits = 0;

  // A scroll that comes back to where it started: no index change.
  await userEvent.wheel(viewport, { delta: { x: 20 } });
  await expectSettledTo(() => viewport.scrollLeft, 0);
  expect(scrolls).toBeGreaterThan(1);
  expect(commits).toBe(0);

  // A smooth scroll to the next snap point: one index change.
  scrolls = 0;
  await userEvent.click(next);
  await expectSettledTo(() => viewport.scrollLeft, WIDTH);
  expect(scrolls).toBeGreaterThan(5);
  expect(commits).toBe(1);
});

describe('misuse fails loudly', () => {
  // React logs the error it rethrows; keep the run's output readable.
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

  test('a Root with no Viewport names the missing primitive', () => {
    const spy = quiet();
    try {
      expect(() => render(<Deck.Root aria-label="Empty" />)).toThrow(
        'Deck.Root must contain a Deck.Viewport'
      );
    } finally {
      spy.mockRestore();
    }
  });

  test('a Slide outside a Viewport names the missing primitive', () => {
    const spy = quiet();
    try {
      expect(() =>
        render(
          <Deck.Root aria-label="Stray">
            <Deck.Slide />
            <Deck.Viewport />
          </Deck.Root>
        )
      ).toThrow('Deck.Slide must be inside Deck.Viewport');
    } finally {
      spy.mockRestore();
    }
  });
});

test('reordering keyed slides moves them instead of remounting them', () => {
  const deck = (order: string[]) => (
    <Deck.Root aria-label="Keyed">
      <Deck.Viewport style={{ width: WIDTH }}>
        {order.map((name) => (
          <Deck.Slide key={name}>{name}</Deck.Slide>
        ))}
      </Deck.Viewport>
    </Deck.Root>
  );
  const { rerender } = render(deck(['a', 'b', 'c']));
  const slideA = screen.getByText('a');

  rerender(deck(['c', 'b', 'a']));

  expect(screen.getByText('a')).toBe(slideA);
  expect(slideA.getAttribute('aria-label')).toBe('3 of 3');
});

describe('Prev and Next props from the consumer', () => {
  const renderWith = (
    prevProps: ComponentProps<typeof Deck.Prev>,
    nextProps: ComponentProps<typeof Deck.Next>
  ) => {
    render(
      <Deck.Root aria-label="Props">
        <Deck.Prev {...prevProps} />
        <Deck.Viewport style={{ width: WIDTH }}>
          {[0, 1, 2].map((i) => (
            <Deck.Slide key={i}>Slide {i + 1}</Deck.Slide>
          ))}
        </Deck.Viewport>
        <Deck.Next {...nextProps} />
      </Deck.Root>
    );
    const root = screen.getByRole('region', { name: 'Props' });
    return {
      viewport: viewportOf(root),
      prev: screen.getByRole('button', { name: 'Previous' }),
      next: screen.getByRole('button', { name: 'Next' })
    };
  };

  test('an onClick runs and the button still steps', async () => {
    const onClick = vi.fn();
    const { viewport, next } = renderWith({}, { onClick });

    await userEvent.click(next);

    expect(onClick).toHaveBeenCalledOnce();
    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
  });

  test('an onClick that prevents default stops the step', async () => {
    const { viewport, next } = renderWith(
      {},
      { onClick: (event) => event.preventDefault() }
    );

    await userEvent.click(next);

    await expectSettledTo(() => viewport.scrollLeft, 0);
  });

  test('disabled={false} does not enable a button at its end', () => {
    const { prev } = renderWith({ disabled: false }, {});

    expect(prev.hasAttribute('disabled')).toBe(true);
  });
});
