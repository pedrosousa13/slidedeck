import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import {
  expectSettledTo,
  gestureScroll,
  sleep,
  TestDeck,
  viewportOf,
  WIDTH
} from './fixtures';

// Loop (CONTEXT.md, ADR-0006): a full set of inert, aria-hidden copies on
// each side of the slides, and a jump of one set length onto the identical
// slides once the viewport rests on a copy.

const renderLoop = (props: Parameters<typeof TestDeck>[0] = {}) => {
  const onIndexChange = vi.fn();
  render(
    <TestDeck
      loop
      onIndexChange={onIndexChange}
      controls={
        <>
          <Deck.Dots />
          <Deck.Counter />
        </>
      }
      {...props}
    />
  );
  const root = screen.getByRole('region', { name: 'Test deck' });
  const viewport = viewportOf(root);
  return {
    root,
    viewport,
    prev: screen.getByRole('button', { name: 'Previous' }),
    next: screen.getByRole('button', { name: 'Next' }),
    onIndexChange,
    dots: () =>
      within(root)
        .getByRole('group', { name: 'Choose page' })
        .querySelectorAll('button'),
    counter: () => root.querySelector('[data-slidedeck-counter]')?.textContent,
    /** Where a slide (not a copy: copies are out of the accessibility tree)
     * sits relative to the viewport's start edge. */
    offsetOf: (label: string) =>
      Math.round(
        screen.getByRole('group', { name: label }).getBoundingClientRect()
          .left - viewport.getBoundingClientRect().left
      )
  };
};

const copiesIn = (viewport: HTMLElement) => [
  ...viewport.querySelectorAll('[data-slidedeck-copy]')
];

describe('loop', () => {
  test('Next on the last snap point moves across the seam to the first', async () => {
    const { root, next, onIndexChange, offsetOf } = renderLoop({
      defaultIndex: 4
    });

    await userEvent.click(next);

    await expectSettledTo(() => onIndexChange.mock.calls, [[0]]);
    expect(offsetOf('1 of 5')).toBe(0);
    expect(root.dataset.index).toBe('0');
  });

  test('Prev on the first snap point moves across the seam to the last', async () => {
    const { prev, onIndexChange, offsetOf } = renderLoop();

    await userEvent.click(prev);

    await expectSettledTo(() => onIndexChange.mock.calls, [[4]]);
    expect(offsetOf('5 of 5')).toBe(0);
  });

  test('neither Prev nor Next is ever disabled', async () => {
    const { prev, next } = renderLoop({ slides: 2 });

    expect(prev.hasAttribute('disabled')).toBe(false);
    expect(next.hasAttribute('disabled')).toBe(false);
    await userEvent.click(next);
    await sleep(500);
    expect(prev.hasAttribute('disabled')).toBe(false);
    expect(next.hasAttribute('disabled')).toBe(false);
  });

  test('a scroll back across the seam rests on the real last slide', async () => {
    const { viewport, onIndexChange, offsetOf } = renderLoop();

    await gestureScroll(viewport, -WIDTH);

    await expectSettledTo(() => onIndexChange.mock.calls, [[4]]);
    expect(offsetOf('5 of 5')).toBe(0);
  });

  test('a wheel scroll forward across the seam reports the logical index', async () => {
    const { viewport, onIndexChange, offsetOf } = renderLoop({
      defaultIndex: 4
    });

    await userEvent.wheel(viewport, { delta: { x: 200 } });

    await expectSettledTo(() => onIndexChange.mock.calls, [[0]]);
    expect(offsetOf('1 of 5')).toBe(0);
  });

  test('two quick presses of Next cross the seam and report once', async () => {
    const { next, onIndexChange, offsetOf } = renderLoop({ defaultIndex: 3 });

    next.click();
    next.click();

    await expectSettledTo(() => onIndexChange.mock.calls, [[0]]);
    expect(offsetOf('1 of 5')).toBe(0);
  });

  test('dots and counter count the slides, not the copies', async () => {
    const { prev, dots, counter } = renderLoop();

    expect(dots()).toHaveLength(5);
    expect(counter()).toBe('1 / 5');

    await userEvent.click(prev);

    await expect.poll(counter).toBe('5 / 5');
    expect(dots()[4].getAttribute('aria-current')).toBe('true');
  });

  test('a dot moves to its slide', async () => {
    const { dots, counter, offsetOf } = renderLoop();

    await userEvent.click(dots()[3]);

    await expectSettledTo(() => offsetOf('4 of 5'), 0);
    expect(counter()).toBe('4 / 5');
  });

  test('a scroll after a seam crossing still settles and reports', async () => {
    const { next, onIndexChange, offsetOf } = renderLoop({ defaultIndex: 4 });
    await userEvent.click(next);
    await expectSettledTo(() => onIndexChange.mock.calls, [[0]]);

    await userEvent.click(next);

    await expectSettledTo(() => onIndexChange.mock.calls, [[0], [1]]);
    expect(offsetOf('2 of 5')).toBe(0);
  });

  test('slides added after a seam crossing update the counter', async () => {
    const { rerender } = render(
      <TestDeck loop slides={3} defaultIndex={2} controls={<Deck.Counter />} />
    );
    const counter = () =>
      document.querySelector('[data-slidedeck-counter]')?.textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await expectSettledTo(counter, '1 / 3');

    rerender(
      <TestDeck loop slides={4} defaultIndex={2} controls={<Deck.Counter />} />
    );

    await expect.poll(counter).toBe('1 / 4');
  });
});

describe('loop copies', () => {
  test('a full set of copies sits on each side of the slides', () => {
    const { viewport } = renderLoop();

    const children = [...viewport.children];
    expect(children).toHaveLength(15);
    const copied = children.map((child) =>
      child.hasAttribute('data-slidedeck-copy')
    );
    expect(copied).toEqual([
      ...Array(5).fill(true),
      ...Array(5).fill(false),
      ...Array(5).fill(true)
    ]);
  });

  test('every copy is inert and aria-hidden', () => {
    const { viewport } = renderLoop();

    for (const copy of copiesIn(viewport)) {
      expect(copy.getAttribute('aria-hidden')).toBe('true');
      expect(copy.hasAttribute('inert')).toBe(true);
    }
  });

  test('only the slides are in the accessibility tree', () => {
    renderLoop();

    const slides = screen
      .getAllByRole('group')
      .filter((el) => el.getAttribute('aria-roledescription') === 'slide');
    expect(slides.map((slide) => slide.getAttribute('aria-label'))).toEqual([
      '1 of 5',
      '2 of 5',
      '3 of 5',
      '4 of 5',
      '5 of 5'
    ]);
  });

  test('tabbing never lands on a copy', async () => {
    renderLoop();
    screen.getByRole('button', { name: 'Previous' }).focus();

    const visited: Element[] = [];
    for (let i = 0; i < 12; i++) {
      await userEvent.tab();
      if (document.activeElement) visited.push(document.activeElement);
    }

    expect(visited.some((el) => el.closest('[data-slidedeck-copy]'))).toBe(
      false
    );
    expect(visited.map((el) => el.textContent)).toContain('Button 5');
  });

  test('only the current slide carries data-current', async () => {
    const { viewport } = renderLoop();

    expect(viewport.querySelectorAll('[data-current]')).toHaveLength(1);
    expect(
      viewport
        .querySelector('[data-current]')
        ?.hasAttribute('data-slidedeck-copy')
    ).toBe(false);
  });
});

describe('loop with pages of 3 over 9 slides', () => {
  let removeStyle = () => {};
  afterEach(() => removeStyle());
  beforeEach(() => {
    const style = document.createElement('style');
    style.textContent = `
      .pages > [data-slidedeck-slide]:nth-child(3n + 1) {
        scroll-snap-align: start;
      }
      .pages > [data-slidedeck-slide]:not(:nth-child(3n + 1)) {
        scroll-snap-align: none;
      }
    `;
    document.head.append(style);
    removeStyle = () => style.remove();
  });

  test('Next on the last page moves to the first and Prev back', async () => {
    const { next, prev, onIndexChange, counter, dots, offsetOf } = renderLoop({
      slides: 9,
      viewportClassName: 'pages',
      defaultIndex: 2
    });
    expect(dots()).toHaveLength(3);
    expect(counter()).toBe('3 / 3');

    await userEvent.click(next);
    await expectSettledTo(() => onIndexChange.mock.calls, [[0]]);
    expect(offsetOf('1 of 9')).toBe(0);
    expect(counter()).toBe('1 / 3');

    await userEvent.click(prev);
    await expectSettledTo(() => onIndexChange.mock.calls, [[0], [2]]);
    expect(offsetOf('7 of 9')).toBe(0);
  });
});

describe('loop, controlled', () => {
  function Controlled({ onIndexChange }: { onIndexChange: () => void }) {
    const [index, setIndex] = useState(4);
    return (
      <TestDeck
        loop
        index={index}
        onIndexChange={(next) => {
          onIndexChange();
          setIndex(next);
        }}
      />
    );
  }

  test('Next on the last snap point crosses the seam and the parent takes it', async () => {
    const onIndexChange = vi.fn();
    render(<Controlled onIndexChange={onIndexChange} />);
    const root = screen.getByRole('region', { name: 'Test deck' });

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await expectSettledTo(() => root.dataset.index, '0');
    expect(onIndexChange).toHaveBeenCalledOnce();
    const viewport = viewportOf(root);
    expect(
      Math.round(
        screen.getByRole('group', { name: '1 of 5' }).getBoundingClientRect()
          .left - viewport.getBoundingClientRect().left
      )
    ).toBe(0);
  });
});

describe('loop in an engine without scrollend', () => {
  const block = (event: Event) => event.stopImmediatePropagation();
  let restore = () => {};
  beforeEach(() => {
    const hosts = [window, Document.prototype, HTMLElement.prototype].filter(
      (host) => Object.hasOwn(host, 'onscrollend')
    );
    const saved = hosts.map((host) =>
      Object.getOwnPropertyDescriptor(host, 'onscrollend')!
    );
    hosts.forEach((host) => delete (host as Partial<Window>).onscrollend);
    window.addEventListener('scrollend', block, true);
    window.addEventListener('scrollsnapchange', block, true);
    restore = () => {
      hosts.forEach((host, i) =>
        Object.defineProperty(host, 'onscrollend', saved[i])
      );
      window.removeEventListener('scrollend', block, true);
      window.removeEventListener('scrollsnapchange', block, true);
    };
  });
  afterEach(() => restore());

  test('Prev on the first snap point still crosses the seam', async () => {
    expect('onscrollend' in window).toBe(false);
    const { prev, onIndexChange, offsetOf } = renderLoop();

    await userEvent.click(prev);

    await expectSettledTo(() => onIndexChange.mock.calls, [[4]]);
    expect(offsetOf('5 of 5')).toBe(0);
  });
});

test('without loop there are no copies', () => {
  render(<TestDeck />);

  expect(
    copiesIn(viewportOf(screen.getByRole('region', { name: 'Test deck' })))
  ).toEqual([]);
});
